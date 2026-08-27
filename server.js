// Lokaler Server des Content-Pipeline-Boards.
// Bewusst ohne Abhaengigkeiten: nur Node-Bordmittel (http, fs, child_process).
// Drei Aufgaben: statische Dateien ausliefern, den Board-Stand lesen/speichern,
// und KI-Aktionen ueber die lokale Claude-Code-CLI (`claude -p`) ausfuehren —
// so laeuft die KI ueber das Abo, nicht ueber die kostenpflichtige API.

import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import * as drive from "./drive.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const BOARD_FILE = join(__dirname, "data", "board.json");
const PUBLIC_DIR = join(__dirname, "public");
// Wurzel der Projekt-Dateien (spaeter = Google-Drive-Wurzel). Siehe docs/drive-convention.md.
const PROJECTS_DIR = join(__dirname, "projects");

// Dateiname je KI-Aufgabe (Zahlen-Praefix haelt die Reihenfolge fuer Menschen in Drive).
const TASK_DATEI = {
  recherche: "00_recherche.md",
  skript: "10_skript.md",
  regieplan: "20_regieplan.md",
  caption: "30_caption.md",
};
const VIDEO_ENDUNGEN = [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"];

// Macht aus Text ein datei-/ordnertaugliches Stueck (spiegelt die Frontend-Logik).
function slug(s) {
  return (
    (s || "")
      .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .slice(0, 24) || "Ohne"
  );
}

// --- Google-Drive-Struktur (siehe docs/drive-convention.md) ---
const DRIVE_SUBS = ["Skript und Caption", "Rohmaterial", "Fertiges Video"];

// Pipeline-Spalte -> Drive-Ordner. Ein Projekt liegt in genau einem davon; Verschieben = Zustand.
const SPALTE_ORDNER = {
  idee: "In Bearbeitung/Idee",
  skript: "In Bearbeitung/Skript",
  videodreh: "In Bearbeitung/Videodreh",
  schnitt: "In Bearbeitung/Schnitt",
  caption: "In Bearbeitung/Caption",
  upload: "In Bearbeitung/Upload",
  fertig: "Videoauswertung",
};
function spaltenOrdner(col) {
  return SPALTE_ORDNER[col] || "In Bearbeitung/Idee";
}

// Projektname im Drive: <Serie>_EP<NN>_<Thema> (ohne WEE-Praefix, Owner-Entscheidung).
function projektName(card) {
  const serie = slug(card.serie) || "OhneReihe";
  const ep = (card.episode || "00").toString().padStart(2, "0");
  return `${serie}_EP${ep}_${slug(card.title)}`;
}
// Projektordner in der aktuellen Spalte.
function driveBase(card) {
  return `${spaltenOrdner(card.column)}/${projektName(card)}`;
}

// Maschinen-Index eines Projekts, menschenlesbar als projekt.json.
function projektJson(card) {
  return JSON.stringify(
    {
      name: projektName(card),
      serie: card.serie || "",
      episode: card.episode || "",
      title: card.title || "",
      format: card.format || "",
      column: card.column || "",
      uploadDate: card.uploadDate || null,
      aktualisiert: new Date().toISOString(),
    },
    null,
    2
  );
}

// Liest den Kontext (global + pro Serie) fuer die Prompt-Anreicherung. Best-effort.
async function leseKontext(serie) {
  const ordner = ["Kontext/_global"];
  if (serie) ordner.push(`Kontext/${serie}`);
  const teile = [];
  for (const o of ordner) {
    const dateien = await drive.list(o, { filesOnly: true }).catch(() => []);
    for (const d of dateien) {
      if (!/\.(md|txt)$/i.test(d)) continue;
      const inhalt = await drive.readFile(`${o}/${d}`).catch(() => "");
      if (inhalt.trim()) teile.push(`# Kontext: ${o}/${d}\n${inhalt.trim()}`);
    }
  }
  return teile.join("\n\n");
}

// Ordnerpfad eines Projekts: projects/<Serie>/EP<NN>__<ThemaSlug>/
function projektDir(card) {
  const serie = slug(card.serie) || "OhneReihe";
  const ep = (card.episode || "00").toString().padStart(2, "0");
  const thema = slug(card.title);
  return join(PROJECTS_DIR, serie, `EP${ep}__${thema}`);
}

// Zaehlt Dateien in einem Unterordner (optional nur Videos).
async function zaehleOrdner(dir, nurVideos) {
  try {
    const eintraege = await readdir(dir, { withFileTypes: true });
    const dateien = eintraege.filter((e) => e.isFile()).map((e) => e.name.toLowerCase());
    if (nurVideos) return dateien.filter((n) => VIDEO_ENDUNGEN.some((x) => n.endsWith(x))).length;
    return dateien.length;
  } catch {
    return 0;
  }
}

// Deterministische Erkennung: welche Dateien/Ordner-Inhalte hat das Projekt? Keine KI, keine Token.
async function scanProjekt(card) {
  const dir = projektDir(card);
  const vorhanden = async (name) => {
    try {
      await readFile(join(dir, name));
      return true;
    } catch {
      return false;
    }
  };
  const files = {};
  for (const [task, name] of Object.entries(TASK_DATEI)) files[task] = await vorhanden(name);
  const rohmaterial = await zaehleOrdner(join(dir, "rohmaterial"), false);
  const final = await zaehleOrdner(join(dir, "final"), true);
  return { dir, files, rohmaterial, final };
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// --- Fester Marken-/Regel-Rahmen: geht als System-Vorspann in JEDEN KI-Aufruf. ---
// Adaptiert aus Bens Arbeitsweise (World Eden Era / Project Oasis), nicht 1:1 uebernommen.
const MARKE_REGELN =
  `Du bist erfahrener Social-Media-Content-Creator und Video-Producer fuer die NGO World Eden ` +
  `Era (Projekte "World Eden" und "Project Oasis"): Naturschutz, Umweltschutz, Agraroekologie, ` +
  `Systemoekologie. Ziel jedes Stuecks: hohe Conversion (Follows, Kommentare, DMs, Spenden) und ` +
  `wissenschaftliche Autoritaet auf Augenhoehe.\n\n` +
  `Immer geltende Regeln:\n` +
  `- Ein Videoskript ist NIE laenger als etwa 50 Sekunden Sprechzeit.\n` +
  `- Wissenschaftlich praezise, aber umgangssprachlich uebersetzt: erklaer es wie einem Kumpel, ` +
  `mit Alltags-Metaphern (z. B. "Schwamm" statt "Wasserspeicherkapazitaet").\n` +
  `- Positiv und konstruktiv: keine kuenstliche Dramatik, keine Weltuntergangs-Bilder; ` +
  `motivierende Framings.\n` +
  `- Natuerlicher Sprechfluss: keine typischen KI-Floskeln, kein aufgesetzter Slang; muss sich ` +
  `stolperfrei laut vorlesen lassen.\n` +
  `- Hooks sprechen die persoenliche Lebensrealitaet der Zielgruppe an ("Was brauchst DU fuer ` +
  `deine Farm?" statt "Wie funktioniert Aquaponik?").\n` +
  `- Jeder Call-to-Action endet mit einer offenen oder leicht polarisierenden Frage an die ` +
  `Community und danach einem kurzen, natuerlichen Follow-Aufruf.\n` +
  `- Bei einer Videoreihe inhaltlich auf die vorherigen Videos aufbauen, keine Dopplungen.\n` +
  `Antworte auf Deutsch.`;

// Baut den Karten-Kontext-Block (Thema, Notizen, Reihe, bisherige Reihen-Videos).
function kontext(card) {
  const reihe = card.serie ? card.serie : "-";
  const geschwister =
    card.seriesSiblings && card.seriesSiblings.length
      ? card.seriesSiblings.join(" | ")
      : "keine";
  return (
    `\n\nThema: ${card.title || "(ohne Titel)"}\n` +
    `Notizen / bisheriger Stand: ${card.notes || "(keine)"}\n` +
    `Reihe: ${reihe} (bisherige Videos dieser Reihe: ${geschwister})`
  );
}

// --- KI-Aufgaben nach Bens Zwei-Phasen-Logik. ---
const AI_TASKS = {
  // PHASE 1 (Idee): iterativer Jam.
  recherche: (card) =>
    `Wir sind in PHASE 1 (iterativer Jam: Idee & Recherche). Liefere GENAU diese Struktur:\n` +
    `1. Zusammenfassung & Recherche: fundierte Hard Facts zum Thema, keine Oeko-Romantik.\n` +
    `2. Hauptfokus: welcher inhaltliche Schwerpunkt erzielt die hoechste Wirkung?\n` +
    `3. Fokus-Alternativen: 2 alternative Fokus-Vorschlaege.\n` +
    `4. Haupt-Hook (verbal & visuell): ein packender Pattern-Interrupt-Einstieg, persoenlich.\n` +
    `5. Hook-Alternativen: 2 alternative Hooks.\n` +
    `Schreib in dieser Phase KEIN fertiges Skript.` +
    kontext(card),

  // PHASE 2a (Skript): One-Screen-Teleprompter.
  skript: (card) =>
    `Wir sind in PHASE 2 (Produktion). Schreibe den reinen Sprechertext als One-Screen-` +
    `Teleprompter:\n` +
    `- maximal etwa 50 Sekunden Sprechzeit,\n` +
    `- in sehr kurze, gut ablesbare Absaetze unterteilt, jeweils markiert als [CHUNK 1], ` +
    `[CHUNK 2] usw.,\n` +
    `- KEINE Regieanweisungen im Text,\n` +
    `- Schluss exakt nach der CTA-Regel (offene/polarisierende Frage + kurzer Follow-Aufruf).` +
    kontext(card),

  // PHASE 2a (Skript): Produktions-Unterlage.
  regieplan: (card) =>
    `Wir sind in PHASE 2 (Produktion). Erstelle die Produktions-Unterlage als Text:\n` +
    `A) VIDEO-METADATEN: Format/Laenge (max 50 s), Dateiname nach Konvention ` +
    `WEE_<Reihe>_EP<Episode>_<Thema>_<Format>.mp4, Musik-Prompt fuer Suno/Udio, ` +
    `Schnitt-Rhythmus (extrem dynamisch).\n` +
    `B) REGIEPLAN als Tabelle mit Spalten: Zeit (sekundengenau) | Typ & Location (A-Roll/` +
    `B-Roll) | Visuell (Action am Set ODER englische Bild/Video-Prompts) | Audio (exakter ` +
    `Sprechertext + SFX wie Whoosh/Plopp/Klick/Glitch) | Schnitt & VFX. Zwingend alle 3-6 ` +
    `Sekunden Wechsel zwischen A-Roll/B-Roll oder Perspektive, dynamische Uebergaenge ` +
    `(Zoom Crash, Whip Pan, Slide).\n` +
    `Reihe: ${card.serie || "-"}, Episode: ${card.episode || "-"}, Format: ${
      card.format || "Reel"
    }.` +
    kontext(card),

  // PHASE 2b (Caption).
  caption: (card) =>
    `Wir sind in PHASE 2 (Produktion). Schreibe die Social-Media-Captions:\n` +
    `- Zwei optimierte Varianten: Variante A Fokus Instagram/TikTok, Variante B Fokus LinkedIn.\n` +
    `- Danach EXAKT 5 Hashtags: #WorldEdenEra, #ProjectOasis und 3 themenspezifische, ` +
    `reichweitenstarke Tags. Keine Ausnahme.` +
    kontext(card),
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

// Ruft die lokale Claude-Code-CLI im Headless-Modus auf. Der Prompt geht ueber stdin,
// damit keine Anfuehrungszeichen/Umbrueche in der Kommandozeile zerbrechen.
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    // Auf Windows ist `claude` eine .cmd -> shell:true. Der Prompt steht NICHT in den
    // Argumenten (kommt ueber stdin), darum ist shell:true hier unkritisch.
    // cwd bewusst auf ein neutrales Temp-Verzeichnis: sonst liest `claude` die
    // CLAUDE.md der Werkbank mit und deren Arbeitsregeln sickern in die Texte.
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      shell: true,
      cwd: tmpdir(),
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `claude endete mit Code ${code}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // --- Board-Stand lesen ---
    if (path === "/api/board" && req.method === "GET") {
      try {
        const data = await readFile(BOARD_FILE, "utf8");
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(data);
      } catch {
        sendJson(res, 200, { columns: [], cards: [] });
      }
      return;
    }

    // --- Board-Stand speichern ---
    if (path === "/api/board" && req.method === "PUT") {
      const body = await readBody(req);
      JSON.parse(body); // validiert, dass es JSON ist
      await writeFile(BOARD_FILE, body, "utf8");
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- KI-Aktion ---
    if (path === "/api/ai" && req.method === "POST") {
      const body = await readBody(req);
      const { task, card } = JSON.parse(body);
      const build = AI_TASKS[task];
      if (!build) {
        sendJson(res, 400, { error: `Unbekannte KI-Aufgabe: ${task}` });
        return;
      }
      try {
        // Projekt-Kontext aus Drive (global + pro Serie) mit in den Prompt geben.
        let kontextBlock = "";
        if (card && card.serie && ["recherche", "skript", "regieplan"].includes(task)) {
          const kt = await leseKontext(slug(card.serie)).catch(() => "");
          if (kt) kontextBlock = `\n\n--- Projekt-Kontext (aus Drive) ---\n${kt}`;
        }
        const text = await runClaude(
          MARKE_REGELN + kontextBlock + "\n\n---\n\n" + build(card || {})
        );
        // Ergebnis zusaetzlich als menschenlesbare Datei in die Projekt-Konvention schreiben.
        let datei = null;
        if (card && TASK_DATEI[task]) {
          try {
            const dir = projektDir(card);
            await mkdir(dir, { recursive: true });
            const kopf = `# ${task.toUpperCase()} — ${card.title || "(ohne Titel)"}\n` +
              `Reihe: ${card.serie || "-"} · Episode: ${card.episode || "-"} · Format: ${
                card.format || "Reel"
              }\n\n`;
            datei = join(dir, TASK_DATEI[task]);
            await writeFile(datei, kopf + text + "\n", "utf8");
          } catch (schreibFehler) {
            datei = null; // Datei-Schreiben ist Beiwerk, nicht kritisch.
          }
        }
        sendJson(res, 200, { text, datei });
      } catch (e) {
        // Haeufigster Fall: CLI nicht installiert oder nicht eingeloggt.
        const hint =
          e.code === "ENOENT" || /not recognized|not found|nicht gefunden/i.test(e.message)
            ? "Die Claude-Code-CLI ist nicht installiert. Einmalig: `npm i -g @anthropic-ai/claude-code`, dann `claude` starten und einloggen."
            : "Die KI-Aktion konnte nicht ausgefuehrt werden. Ist `claude` installiert und eingeloggt (`claude` einmal interaktiv starten)?";
        sendJson(res, 502, { error: e.message, hint });
      }
      return;
    }

    // --- Projekt-Scan: erkennt Dateien/Ordner deterministisch (ohne KI/Token) ---
    if (path === "/api/project" && req.method === "GET") {
      const card = {
        serie: url.searchParams.get("serie") || "",
        episode: url.searchParams.get("episode") || "",
        title: url.searchParams.get("title") || "",
      };
      sendJson(res, 200, await scanProjekt(card));
      return;
    }

    // --- Drive: Projektordner in der aktuellen Spalte anlegen (+ Unterordner + projekt.json) ---
    if (path === "/api/drive/create" && req.method === "POST") {
      const card = JSON.parse(await readBody(req));
      const base = driveBase(card);
      await drive.mkdir(base);
      for (const s of DRIVE_SUBS) await drive.mkdir(`${base}/${s}`);
      await drive.writeFile(`${base}/projekt.json`, projektJson(card));
      const links = {};
      for (const s of DRIVE_SUBS) links[s] = await drive.link(`${base}/${s}`);
      links["_projekt"] = await drive.link(base);
      sendJson(res, 200, { name: projektName(card), base, links });
      return;
    }

    // --- Drive: Projektordner beim Spaltenwechsel verschieben ---
    if (path === "/api/drive/move" && req.method === "POST") {
      const card = JSON.parse(await readBody(req)); // { serie, episode, title, from, to }
      const name = projektName(card);
      const von = `${spaltenOrdner(card.from)}/${name}`;
      const nach = `${spaltenOrdner(card.to)}/${name}`;
      if (von !== nach) {
        await drive.moveDir(von, nach);
        await drive.writeFile(`${nach}/projekt.json`, projektJson({ ...card, column: card.to }));
      }
      sendJson(res, 200, { ok: true, nach });
      return;
    }

    // --- Drive: Board-Stand direkt aus den Spalten-Ordnern lesen ---
    if (path === "/api/drive/board" && req.method === "GET") {
      const projekte = [];
      for (const [col, ordner] of Object.entries(SPALTE_ORDNER)) {
        const namen = await drive.list(ordner, { dirsOnly: true }).catch(() => []);
        for (const name of namen) projekte.push({ name, column: col });
      }
      sendJson(res, 200, { projekte });
      return;
    }

    // --- Drive: finales Skript/Caption speichern (in der aktuellen Spalte) ---
    if (path === "/api/drive/save" && req.method === "POST") {
      const { serie, episode, title, column, filename, content } = JSON.parse(await readBody(req));
      const base = driveBase({ serie, episode, title, column });
      await drive.mkdir(base);
      await drive.mkdir(`${base}/Skript und Caption`);
      await drive.writeFile(`${base}/Skript und Caption/${filename}`, content);
      sendJson(res, 200, { ok: true, pfad: `${base}/Skript und Caption/${filename}` });
      return;
    }

    // --- Drive: Projekt scannen (Rohmaterial/Fertiges Video/Skript erkennen) + Live-Links ---
    if (path === "/api/drive/scan" && req.method === "GET") {
      const card = {
        serie: url.searchParams.get("serie") || "",
        episode: url.searchParams.get("episode") || "",
        title: url.searchParams.get("title") || "",
        column: url.searchParams.get("column") || "",
      };
      const base = driveBase(card);
      const roh = await drive.count(`${base}/Rohmaterial`).catch(() => 0);
      const finDateien = await drive
        .list(`${base}/Fertiges Video`, { filesOnly: true })
        .catch(() => []);
      const final = finDateien.filter((n) =>
        VIDEO_ENDUNGEN.some((x) => n.toLowerCase().endsWith(x))
      ).length;
      const skriptDateien = await drive
        .list(`${base}/Skript und Caption`, { filesOnly: true })
        .catch(() => []);
      const vorhanden = skriptDateien.length + roh + final > 0;
      const links = {};
      if (vorhanden) {
        for (const s of DRIVE_SUBS) links[s] = await drive.link(`${base}/${s}`).catch(() => "");
      }
      sendJson(res, 200, { name: projektName(card), rohmaterial: roh, final, skriptDateien, links, vorhanden });
      return;
    }

    // --- Drive: Kontext lesen (fuer Prompt-Anreicherung, auch manuell abrufbar) ---
    if (path === "/api/drive/kontext" && req.method === "GET") {
      const text = await leseKontext(slug(url.searchParams.get("serie") || "")).catch(() => "");
      sendJson(res, 200, { text });
      return;
    }

    // --- Statische Dateien ---
    let rel = path === "/" ? "/index.html" : path;
    const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
    const file = join(PUBLIC_DIR, safe);
    try {
      const data = await readFile(file);
      res.writeHead(200, {
        "content-type": MIME[extname(file)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Nicht gefunden.");
    }
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`Content-Pipeline-Board laeuft auf http://localhost:${PORT}`);
});
