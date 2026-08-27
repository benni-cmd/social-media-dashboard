// Lokaler Server des Content-Pipeline-Boards.
// Bewusst ohne Abhaengigkeiten: nur Node-Bordmittel (http, fs, child_process).
// Drei Aufgaben: statische Dateien ausliefern, den Board-Stand lesen/speichern,
// und KI-Aktionen ueber die lokale Claude-Code-CLI (`claude -p`) ausfuehren —
// so laeuft die KI ueber das Abo, nicht ueber die kostenpflichtige API.

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const BOARD_FILE = join(__dirname, "data", "board.json");
const PUBLIC_DIR = join(__dirname, "public");

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
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      shell: true,
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
        const text = await runClaude(MARKE_REGELN + "\n\n---\n\n" + build(card || {}));
        sendJson(res, 200, { text });
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
