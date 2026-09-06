// Lokaler Server der Content-Maschine.
// Bewusst ohne Abhaengigkeiten: nur Node-Bordmittel.
//
// Diese Datei ist reine Wegweisung. Was die Sache selbst ausmacht, liegt in lib/:
//   pipeline.js  Phasen, Termine, Karten-Schema, Qualitaetstore (laeuft auch im Browser)
//   drive.js     rclone-Anbindung, trennt "gibt es nicht" von "geht gerade nicht"
//   projects.js  Projektordner anlegen, verschieben, lesen — und der Abgleich
//   ai.js        Prompts und die Claude-CLI
//   social.js    Instagram- und LinkedIn-Zahlen

import { createServer as createHttpsServer } from "node:https";
import { readFile, writeFile, mkdir, rename, mkdtemp, rm, readdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline as streamPipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { execSync } from "node:child_process";

import * as pipeline from "./lib/pipeline.js";
import * as drive from "./lib/drive.js";
import * as projekte from "./lib/projects.js";
import * as planstore from "./lib/planstore.js";
import * as spaltenStore from "./lib/spalten.js";
import * as ki from "./lib/ai.js";
import * as social from "./lib/social.js";
import * as kpi from "./lib/kpi.js";
import * as kpiDrive from "./lib/kpi-drive-lesen.js";
import * as gcal from "./lib/gcal.js";
import * as zip from "./lib/zip.js";
import * as prompts from "./lib/promptstore.js";
import * as workflows from "./lib/workflowstore.js";
import * as unternehmen from "./lib/kontextstore.js";
import * as wfRegister from "./lib/workflows.js";
import * as eigeneWorkflows from "./lib/ownworkflowstore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const DATA_DIR = join(__dirname, "data");
const BOARD_FILE = join(DATA_DIR, "board.json");
const TOKEN_FILE = join(DATA_DIR, "tokens.json");
const DEFAULTS_FILE = join(DATA_DIR, "defaults.json");
const PLAN_FILE = join(DATA_DIR, "plan.json");
const SPALTEN_FILE = join(DATA_DIR, "spalten.json");
const PROMPTS_FILE = join(DATA_DIR, "prompts.json");
const WORKFLOWS_FILE = join(DATA_DIR, "workflows.json");
const KONTEXT_FILE = join(DATA_DIR, "kontext.json");
const EIGENE_WORKFLOWS_FILE = join(DATA_DIR, "own-workflows.json");
const PUBLIC_DIR = join(__dirname, "public");
const LIB_DIR = join(__dirname, "lib");

// Die beiden Ablagen kennen ihren Pfad nicht von selbst — hier bekommt jede ihren (v26).
prompts.setzePfad(PROMPTS_FILE);
workflows.setzePfad(WORKFLOWS_FILE);
unternehmen.setzePfad(KONTEXT_FILE); // v33: Unternehmens- und Projektkontext
eigeneWorkflows.setzePfad(EIGENE_WORKFLOWS_FILE); // v27: die selbstgebauten Workflows

// --- .env laden (ohne dotenv-Paket) --------------------------------------
async function ladeEnv() {
  try {
    const inhalt = await readFile(join(__dirname, ".env"), "utf8");
    for (const zeile of inhalt.split("\n")) {
      const m = zeile.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* keine .env vorhanden */
  }
}

// Schreibt/aktualisiert EINEN Schluessel in .env (Zeile ersetzen oder anhaengen). Nur fuer
// die Whitelist im /api/config/env-Handler; der Wert ist dort schon sanitisiert.
async function envSchreiben(key, wert) {
  const envPfad = join(__dirname, ".env");
  let zeilen = [];
  try { zeilen = (await readFile(envPfad, "utf8")).split("\n"); } catch { /* neu anlegen */ }
  let ersetzt = false;
  zeilen = zeilen.map((z) => {
    const m = z.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/);
    if (m && m[1] === key) { ersetzt = true; return `${key}=${wert}`; }
    return z;
  });
  if (!ersetzt) {
    while (zeilen.length && zeilen[zeilen.length - 1] === "") zeilen.pop();
    zeilen.push(`${key}=${wert}`);
  }
  await writeFile(envPfad, zeilen.join("\n") + "\n", "utf8");
}

// --- Board lesen und schreiben -------------------------------------------
//
// board.json ist ab v17 der schnelle CACHE, nicht mehr die Wahrheit. Die Wahrheit liegt in
// Drive (je Karte "(AI only)/projekt.json"); der Abgleich (/api/drive/reconcile) liest Drive
// und schreibt den Cache neu, bei Konflikt gewinnt Drive. Der Speicher-Weg (PUT) schreibt den
// Cache und spiegelt geaenderte Karten nach Drive.
// Geschrieben wird ueber eine Zwischendatei und mit Versionsnummer: zwei offene Tabs
// koennen sich damit nicht mehr gegenseitig ueberschreiben (Befund B12).

async function leseBoard() {
  try {
    const roh = JSON.parse(await readFile(BOARD_FILE, "utf8"));
    const cards = (roh.cards || []).map(pipeline.migriere);
    return { version: roh.version || 1, cards, drehtermine: roh.drehtermine || [] };
  } catch {
    return { version: 1, cards: [], drehtermine: [] };
  }
}

async function schreibeBoard(cards, version, drehtermine) {
  await mkdir(DATA_DIR, { recursive: true });
  // Aufrufer, die nur Karten schreiben (z.B. Drive-Reconcile), duerfen die Drehtermine
  // nicht verlieren: fehlt das Argument, bleiben die gespeicherten erhalten.
  if (drehtermine === undefined) {
    try {
      const roh = JSON.parse(await readFile(BOARD_FILE, "utf8"));
      drehtermine = roh.drehtermine || [];
    } catch {
      drehtermine = [];
    }
  }
  const inhalt = JSON.stringify({ version, cards, drehtermine }, null, 2);
  const temp = BOARD_FILE + ".tmp";
  await writeFile(temp, inhalt, "utf8");
  await rename(temp, BOARD_FILE);
}

async function leseTokens() {
  try {
    return JSON.parse(await readFile(TOKEN_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function speichereToken(plattform, daten) {
  const t = await leseTokens();
  t[plattform] = { ...daten, verbundenAm: new Date().toISOString() };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(t, null, 2), "utf8");
}

// --- Redaktionsplan: Drive ist Wahrheit, data/plan.json nur Cache (v17d) -----
//
// Nur die Stellschrauben sind Config. Der Sanitizer schuetzt die Drive-Config davor, dass ein
// Client versehentlich Anzeige-Felder (planAbgleich, quelle) zurueckschreibt und den
// Fingerabdruck verfaelscht.
const PLAN_ERLAUBT = ["kadenz", "typenmix", "kategorienFokus", "zielgewichte", "kampagnen", "slots", "plattformen"];
function nurPlanConfig(o) {
  const c = {};
  for (const k of PLAN_ERLAUBT) if (o && o[k] !== undefined) c[k] = o[k];
  return c;
}
async function planCacheLesen() {
  try { return JSON.parse(await readFile(PLAN_FILE, "utf8")); } catch { return null; }
}
async function planCacheSchreiben(config) {
  try { await mkdir(DATA_DIR, { recursive: true }); await writeFile(PLAN_FILE, JSON.stringify(config, null, 2), "utf8"); } catch { /* Cache ist Absicherung */ }
}

// --- Spalten: Drive ist Wahrheit, data/spalten.json nur Cache (v17b) ---------
async function spaltenCacheLesen() {
  try { return JSON.parse(await readFile(SPALTEN_FILE, "utf8")); } catch { return null; }
}
async function spaltenCacheSchreiben(config) {
  try { await mkdir(DATA_DIR, { recursive: true }); await writeFile(SPALTEN_FILE, JSON.stringify(config, null, 2), "utf8"); } catch { /* Cache ist Absicherung */ }
}
// Den dynamischen Ordner-Resolver in projects.js mit dem aktuellen (gemischten) Spaltenstand fuettern.
function spaltenResolverSetzen(gemischt) {
  projekte.setSpalten(spaltenStore.ordnerMap(gemischt));
}

// --- kleine Helfer --------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const umleitung = (res, ziel) => {
  res.writeHead(302, { location: ziel });
  res.end();
};

// Liest den Kontext aus Drive (global und je Reihe) fuer die Prompt-Anreicherung.
async function leseKontext(serie) {
  const ordner = ["Kontext/_global"];
  if (serie) ordner.push(`Kontext/${serie}`);
  const teile = [];
  for (const o of ordner) {
    let dateien = [];
    try {
      dateien = await drive.list(o, { filesOnly: true });
    } catch {
      continue; // Kontext ist Beiwerk; eine Stoerung darf den KI-Aufruf nicht verhindern.
    }
    for (const d of dateien) {
      if (!/\.(md|txt)$/i.test(d)) continue;
      try {
        const inhalt = await drive.readFile(`${o}/${d}`);
        if (inhalt.trim()) teile.push(`# Kontext: ${o}/${d}\n${inhalt.trim()}`);
      } catch {
        /* einzelne Datei unlesbar — der Rest zaehlt trotzdem */
      }
    }
  }
  return teile.join("\n\n");
}

// --- Wegweisung -----------------------------------------------------------

// --- v22: Projektordner-Download + Video-Upload ---------------------------
//
// Findet die Karte im Board und den TATSAECHLICHEN Drive-Ordner (scan folgt auch
// Hand-Verschiebungen). Trennt sauber: keine Karte / kein Ordner / Drive gestoert.
async function karteMitOrdner(karteId) {
  const board = await leseBoard();
  const card = board.cards.find((c) => c.id === karteId);
  if (!card) return { fehler: 404, satz: "Zu dieser Karte gibt es keinen Eintrag im Board." };
  const stand = await projekte.scan(card);
  if (!stand.driveOk) return { fehler: 502, satz: stand.satz };
  if (!stand.vorhanden) return { fehler: 404, satz: stand.satz };
  return { card, basis: stand.pfad };
}

// Alle Dateien unter einem Verzeichnis, rekursiv, mit relativem Namen (fuer die ZIP-Eintraege).
async function sammleDateien(wurzel, unter = "") {
  const eintraege = await readdir(join(wurzel, unter), { withFileTypes: true });
  const out = [];
  for (const e of eintraege) {
    const rel = unter ? `${unter}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await sammleDateien(wurzel, rel)));
    else if (e.isFile()) out.push({ name: rel, pfad: join(wurzel, rel) });
  }
  return out;
}

// „nur Dateien fuer Menschen" = genau diese zwei Unterordner. System (AI only)/ und
// projekt.json sind NICHT herunterladbar, Fertiges Video/ ist Upload-Ziel, kein Download.
const DOWNLOAD_ORDNER = { skript: "Skript und Caption", rohmaterial: "Rohmaterial" };

// v23: Upload-Ziele. `fertig` (Video, Pflicht-Endung) schiebt die Karte spaeter weiter;
// `rohmaterial` (beliebige Rohdatei) waechst nur an, ohne Phasenwechsel.
const UPLOAD_ZIELE = {
  fertig: { unter: "Fertiges Video", nurVideo: true },
  rohmaterial: { unter: "Rohmaterial", nurVideo: false },
};

async function handler(req, res) {
  aktivitaetGemeldet();
  try {
    const url = new URL(req.url, `https://localhost:${PORT}`);
    const pfad = url.pathname;

    // ---- Board ----------------------------------------------------------

    if (pfad === "/api/board" && req.method === "GET") {
      const board = await leseBoard();
      // Spalten kommen aus dem schnellen Cache (Drive fuehrt beim Abgleich). Fehlt der Cache,
      // liefert mischeSpalten die Defaults (= PHASEN mit den aktuellen Anzeigenamen).
      const spalten = pipeline.mischeSpalten(await spaltenCacheLesen());
      sendJson(res, 200, { ...board, spalten, phasen: spalten });
      return;
    }

    if (pfad === "/api/board" && req.method === "PUT") {
      const { cards, version, drehtermine } = JSON.parse(await readBody(req));
      if (!Array.isArray(cards)) {
        sendJson(res, 400, { error: "Das Board braucht eine Liste von Karten." });
        return;
      }
      const aktuell = await leseBoard();
      if (version != null && version !== aktuell.version) {
        // Jemand anderes war schneller. Nicht ueberschreiben, sondern melden.
        sendJson(res, 409, {
          error: "Der Board-Stand hat sich zwischenzeitlich geaendert.",
          satz: "Ein anderes Fenster hat gespeichert. Lade den Stand neu, damit nichts verloren geht.",
          aktuell,
        });
        return;
      }
      const neueVersion = aktuell.version + 1;
      const neueKarten = cards.map(pipeline.migriere);
      // board.json ist der schnelle CACHE (v17). Zuerst schreiben, damit der Speichern-Weg nie
      // an Drive haengt.
      // drehtermine mitschreiben; fehlen sie im Body, bleiben die gespeicherten erhalten.
      await schreibeBoard(
        neueKarten,
        neueVersion,
        Array.isArray(drehtermine) ? drehtermine : undefined
      );
      // v32 C1: SOFORT antworten, sobald board.json (der schnelle Cache, die Wahrheit) steht.
      // Frueher wartete die Antwort auf ALLE Drive-Spiegelungen (je ein rclone-Aufruf pro
      // geaenderter Karte) — bei mehreren Karten sekundenlang. Die Spiegelung laeuft jetzt NACH
      // der Antwort im Hintergrund; ein Fehler kippt den Save nicht und der naechste Abgleich
      // heilt. (Das Frontend hat driveWarnungen nie ausgewertet — geprueft.)
      sendJson(res, 200, { ok: true, version: neueVersion });

      // Hintergrund-Spiegelung: nur tatsaechlich geaenderte Karten mit vorhandenem Drive-Ordner
      // (Diff gegen den alten Cache), damit ein Save nicht 17 Drive-Schreibvorgaenge ausloest.
      const altPerId = new Map(aktuell.cards.map((c) => [c.id, JSON.stringify(c)]));
      (async () => {
        for (const k of neueKarten) {
          if (!k.driveName) continue; // noch kein Ordner -> nichts zu spiegeln
          if (altPerId.get(k.id) === JSON.stringify(k)) continue; // unveraendert
          try {
            await projekte.spiegeleKarte(k);
          } catch (e) {
            console.log(`Drive-Spiegelung fehlgeschlagen (${k.title}): ${e.message}`);
          }
        }
      })();
      return;
    }

    // ---- Benutzer-Defaults ------------------------------------------------

    if (pfad === "/api/defaults" && req.method === "GET") {
      try {
        const roh = JSON.parse(await readFile(DEFAULTS_FILE, "utf8"));
        sendJson(res, 200, roh);
      } catch {
        sendJson(res, 200, {});
      }
      return;
    }

    if (pfad === "/api/defaults" && req.method === "PUT") {
      const daten = JSON.parse(await readBody(req));
      await mkdir(DATA_DIR, { recursive: true });
      let alt = {};
      try { alt = JSON.parse(await readFile(DEFAULTS_FILE, "utf8")); } catch {}
      const neu = { ...alt, ...daten };
      await writeFile(DEFAULTS_FILE, JSON.stringify(neu, null, 2), "utf8");
      sendJson(res, 200, { ok: true, defaults: neu });
      return;
    }

    // ---- Redaktionsplan --------------------------------------------------

    if (pfad === "/api/plan" && req.method === "GET") {
      // Wahrheit ist die Config in Drive. Fehlt sie, aus Cache/Default seeden. Danach das
      // deterministische Ergebnis gegen Drive abgleichen. Drive-Fehler kippen nichts.
      let config = null, driveOk = true, quelle = "drive";
      try { config = await planstore.leseConfigVonDrive(); } catch { driveOk = false; }
      if (config) {
        await planCacheSchreiben(config);
      } else {
        config = (await planCacheLesen()) || pipeline.defaultPlan();
        quelle = driveOk ? "cache->drive" : "cache";
        if (driveOk) { try { await planstore.schreibeConfigNachDrive(config); } catch { driveOk = false; } }
        await planCacheSchreiben(config);
      }
      let planAbgleich = { neuGerechnet: false, hinweis: "" };
      if (driveOk) {
        try {
          const a = await planstore.abgleiche(config);
          planAbgleich = { neuGerechnet: a.neuGerechnet, hinweis: a.hinweis };
        } catch { driveOk = false; }
      }
      if (!driveOk) { quelle = "cache"; planAbgleich.hinweis = "Drive war nicht erreichbar — Redaktionsplan aus dem lokalen Cache."; }
      sendJson(res, 200, { ...config, planAbgleich, quelle });
      return;
    }

    if (pfad === "/api/plan" && req.method === "PUT") {
      const config = nurPlanConfig(JSON.parse(await readBody(req)));
      await planCacheSchreiben(config); // Cache zuerst — der Speichern-Weg haengt nie an Drive
      let planAbgleich = { neuGerechnet: false, hinweis: "" };
      try {
        await planstore.schreibeConfigNachDrive(config);
        const a = await planstore.abgleiche(config);
        planAbgleich = { neuGerechnet: a.neuGerechnet, hinweis: a.hinweis };
      } catch (e) {
        planAbgleich.hinweis = `Drive-Schreiben fehlgeschlagen: ${e.message} — lokal gesichert, naechster Aufruf gleicht ab.`;
      }
      sendJson(res, 200, { ok: true, planAbgleich });
      return;
    }

    if (pfad === "/api/plan/slot" && req.method === "PUT") {
      const { slotId, karteId } = JSON.parse(await readBody(req));
      let plan;
      try { plan = JSON.parse(await readFile(PLAN_FILE, "utf8")); } catch { plan = pipeline.defaultPlan(); }
      const slot = (plan.slots || []).find((s) => s.id === slotId);
      if (!slot) { sendJson(res, 404, { error: "Slot nicht gefunden." }); return; }
      slot.karteId = karteId || null;
      await writeFile(PLAN_FILE, JSON.stringify(plan, null, 2), "utf8");
      sendJson(res, 200, { ok: true, slot });
      return;
    }

    // ---- KI --------------------------------------------------------------

    if (pfad === "/api/ai" && req.method === "POST") {
      const {
        task,
        card,
        provider = "ollama",
        ollamaModel = "llama3.2",
        claudeModell = ki.CLAUDE_MODELL_STANDARD,
      } = JSON.parse(await readBody(req));
      if (!ki.PROMPTS[task]) {
        sendJson(res, 400, { error: `Unbekannte KI-Aufgabe: ${task}` });
        return;
      }
      try {
        let kontextBlock = "";
        if (card && card.serie && ["recherche", "skript", "regieplan"].includes(task)) {
          const kt = await leseKontext(pipeline.slug(card.serie)).catch(() => "");
          if (kt) kontextBlock = `\n\n--- Projekt-Kontext (aus Drive) ---\n${kt}`;
        }
        // v26: Prompt und Vorspann kommen aus der Ablage — Bens Fassung, sonst die Vorlage.
        // v33: Firmen- und Projektkontext aus den Einstellungen. Ein Fehler beim Lesen darf
        // den KI-Aufruf nie verhindern — Kontext ist Beiwerk, kein Tor.
        const firmenKontext = await unternehmen
          .sammle()
          .catch(() => ({ firmenkontext: "", projektkontext: "" }));
        const system = await prompts.systemPrompt(firmenKontext);
        const userMsg = kontextBlock + "\n\n---\n\n" + (await prompts.aufgabePrompt(task, card || {}, firmenKontext));
        let text;
        if (provider === "ollama") {
          text = await ki.runOllama(system, userMsg, ollamaModel);
        } else {
          text = await ki.runClaude(system + userMsg, { modell: claudeModell });
        }
        const data = ki.JSON_AUFGABEN.has(task) ? ki.parseJson(text) : null;
        sendJson(res, 200, { text, data });
      } catch (e) {
        sendJson(res, 502, { error: e.message, hint: ki.hinweisZuFehler(e, provider) });
      }
      return;
    }

    // Gleiche Aufgabe, aber der Text kommt live: NDJSON-Zeilen {t:"delta"|"status"|"done"|"error"}.
    if (pfad === "/api/ai/stream" && req.method === "POST") {
      const {
        task,
        card,
        provider = "ollama",
        ollamaModel = "llama3.2",
        claudeModell = ki.CLAUDE_MODELL_STANDARD,
      } = JSON.parse(await readBody(req));
      if (!ki.PROMPTS[task]) {
        sendJson(res, 400, { error: `Unbekannte KI-Aufgabe: ${task}` });
        return;
      }
      res.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
      });
      const schreib = (o) => res.write(JSON.stringify(o) + "\n");
      try {
        let kontextBlock = "";
        if (card && card.serie && ["recherche", "hooks_verbal", "hooks_visuell", "skript", "regieplan"].includes(task)) {
          const kt = await leseKontext(pipeline.slug(card.serie)).catch(() => "");
          if (kt) kontextBlock = `\n\n--- Projekt-Kontext (aus Drive) ---\n${kt}`;
        }
        // v33: Firmen- und Projektkontext aus den Einstellungen. Ein Fehler beim Lesen darf
        // den KI-Aufruf nie verhindern — Kontext ist Beiwerk, kein Tor.
        const firmenKontext = await unternehmen
          .sammle()
          .catch(() => ({ firmenkontext: "", projektkontext: "" }));
        const system = await prompts.systemPrompt(firmenKontext);
        const userMsg = kontextBlock + "\n\n---\n\n" + (await prompts.aufgabePrompt(task, card || {}, firmenKontext));
        let text;
        if (provider === "ollama") {
          text = await ki.runOllamaStream(system, userMsg, ollamaModel, (delta) => {
            if (delta) schreib({ t: "delta", text: delta });
          });
        } else {
          text = await ki.runClaudeStream(
            system + userMsg,
            (delta, status) => {
              if (delta) schreib({ t: "delta", text: delta });
              if (status) schreib({ t: "status", text: status });
            },
            { modell: claudeModell }
          );
        }
        const data = ki.JSON_AUFGABEN.has(task) ? ki.parseJson(text) : null;
        schreib({ t: "done", text, data });
      } catch (e) {
        schreib({ t: "error", error: e.message, hint: ki.hinweisZuFehler(e, provider) });
      }
      res.end();
      return;
    }

    // Die waehlbaren Claude-Modelle — eine Wahrheit, sie steht in lib/ai.js (v26).
    if (pfad === "/api/ai/modelle" && req.method === "GET") {
      sendJson(res, 200, { claude: ki.CLAUDE_MODELLE, standard: ki.CLAUDE_MODELL_STANDARD });
      return;
    }

    // ---- Unternehmenskontext (v33) ---------------------------------------
    // Firmen-/Brandwissen und Projektwissen: Freitext plus Verweise auf Dateien, lokal oder in
    // Drive. Geht ueber die Platzhalter {{firmenkontext}}/{{projektkontext}} in jeden Prompt.

    if (pfad === "/api/kontext" && req.method === "GET") {
      sendJson(res, 200, await unternehmen.uebersicht());
      return;
    }

    if (pfad === "/api/kontext" && req.method === "PUT") {
      const body = JSON.parse(await readBody(req));
      try {
        let stand;
        switch (body.was) {
          case "firma-text":
            stand = await unternehmen.setzeFirmaText(body.text);
            break;
          case "projekt-anlegen":
            stand = await unternehmen.projektAnlegen(body.name);
            break;
          case "projekt-aendern":
            stand = await unternehmen.projektAendern(body.id, body);
            break;
          case "projekt-loeschen":
            stand = await unternehmen.projektLoeschen(body.id);
            break;
          case "quelle-hinzufuegen":
            stand = await unternehmen.quelleHinzufuegen(body.ziel, { art: body.art, pfad: body.pfad });
            break;
          case "quelle-entfernen":
            stand = await unternehmen.quelleEntfernen(body.ziel, body.quelleId);
            break;
          default:
            sendJson(res, 400, { error: `Unbekannte Aenderung: ${body.was}` });
            return;
        }
        sendJson(res, 200, stand);
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
      return;
    }

    // Zeigt, was aus dem hinterlegten Kontext tatsaechlich in den Prompt geht — damit die
    // Wirkung nachpruefbar ist und nicht geglaubt werden muss.
    if (pfad === "/api/kontext/probe" && req.method === "GET") {
      sendJson(res, 200, await unternehmen.sammle(url.searchParams.get("projekt") || null));
      return;
    }

    // ---- System Prompts (v26) --------------------------------------------
    // Was hinter jedem KI-Knopf steht: Vorlage, Bens Fassung, Platzhalter-Legende.

    if (pfad === "/api/prompts" && req.method === "GET") {
      sendJson(res, 200, {
        ...(await prompts.uebersicht()),
        claudeModelle: ki.CLAUDE_MODELLE,
        claudeModellStandard: ki.CLAUDE_MODELL_STANDARD,
      });
      return;
    }

    if (pfad === "/api/prompts" && req.method === "PUT") {
      const { id, text } = JSON.parse(await readBody(req));
      try {
        await prompts.setze(id, text);
        sendJson(res, 200, await prompts.uebersicht());
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
      return;
    }

    // ---- Workflows (v26) -------------------------------------------------
    // Alle Automationen des Boards: einsehbar, abschaltbar, mit Parametern.

    if (pfad === "/api/workflows" && req.method === "GET") {
      // `workflows` = die eingebauten Neun (unveraendert seit v26), `eigene` = die selbstgebauten
      // (v27). Der Baustein-Katalog wandert NICHT durch die API — der Browser importiert
      // /lib/workflowblocks.js direkt, damit es genau eine Wahrheit gibt.
      sendJson(res, 200, {
        workflows: await workflows.uebersicht(),
        eigene: await eigeneWorkflows.uebersicht(),
      });
      return;
    }

    if (pfad === "/api/workflows" && req.method === "PUT") {
      const { id, an, params } = JSON.parse(await readBody(req));
      try {
        sendJson(res, 200, { workflows: await workflows.setze(id, { an, params }) });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
      return;
    }

    // Selbstgebaute Workflows (v27): anlegen/aendern ueber PUT, entfernen ueber DELETE.
    if (pfad === "/api/workflows/eigene" && req.method === "PUT") {
      const { workflow } = JSON.parse(await readBody(req));
      try {
        sendJson(res, 200, { eigene: await eigeneWorkflows.setze(workflow) });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
      return;
    }

    if (pfad === "/api/workflows/eigene" && req.method === "DELETE") {
      const id = url.searchParams.get("id");
      try {
        sendJson(res, 200, { eigene: await eigeneWorkflows.loesche(id) });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
      return;
    }

    if (pfad === "/api/ai/ping-ollama" && req.method === "POST") {
      const { model = "llama3.2" } = JSON.parse(await readBody(req));
      sendJson(res, 200, await ki.pingOllama(model));
      return;
    }

    if (pfad === "/api/shutdown" && req.method === "POST") {
      sendJson(res, 200, { ok: true });
      setTimeout(async () => {
        console.log("Shutdown via UI ausgeloest.");
        await ollamaEntladen();
        process.exit(0);
      }, 400);
      return;
    }

    // ---- Drive -----------------------------------------------------------

    if (pfad === "/api/drive/status" && req.method === "GET") {
      sendJson(res, 200, await drive.erreichbar());
      return;
    }

    if (pfad === "/api/drive/create" && req.method === "POST") {
      const card = JSON.parse(await readBody(req));
      sendJson(res, 200, await projekte.anlegen(card));
      return;
    }

    if (pfad === "/api/drive/move" && req.method === "POST") {
      const { card, ziel } = JSON.parse(await readBody(req));
      sendJson(res, 200, await projekte.verschiebe(card, ziel));
      return;
    }

    if (pfad === "/api/drive/scan" && req.method === "POST") {
      const card = JSON.parse(await readBody(req));
      sendJson(res, 200, await projekte.scan(card));
      return;
    }

    if (pfad === "/api/drive/save" && req.method === "POST") {
      const { card, filename, content } = JSON.parse(await readBody(req));
      // Der Dateiname kommt aus dem Browser — vorher ungeprueft, was in Drive echte
      // Ordner namens ".." erzeugte (Befund B3).
      if (!pipeline.pfadstueckOk(filename)) {
        sendJson(res, 400, {
          error: "Unzulaessiger Dateiname.",
          satz: "Ein Dateiname darf keine Schraegstriche und keine Punkt-Ordner enthalten.",
        });
        return;
      }
      const ziel = await projekte.speichereDatei(card, filename, content ?? "");
      sendJson(res, 200, { ok: true, pfad: ziel });
      return;
    }

    // v22: Projektordner-Teil als ZIP herunterladen (nur Skript oder Rohmaterial).
    if (pfad === "/api/projekt/download" && req.method === "GET") {
      const was = url.searchParams.get("was");
      const sub = DOWNLOAD_ORDNER[was];
      if (!sub) {
        sendJson(res, 400, { error: "Unbekannter Ordner.", satz: "Nur Skript oder Rohmaterial sind ladbar." });
        return;
      }
      const treffer = await karteMitOrdner(url.searchParams.get("karteId"));
      if (treffer.fehler) {
        sendJson(res, treffer.fehler, { error: "Download nicht moeglich.", satz: treffer.satz });
        return;
      }
      const tmp = await mkdtemp(join(tmpdir(), "smd-dl-"));
      try {
        await drive.kopiereOrdnerRunter(`${treffer.basis}/${sub}`, tmp);
        const dateien = await sammleDateien(tmp);
        if (!dateien.length) {
          sendJson(res, 404, { error: "Ordner ist leer.", satz: `Im Ordner „${sub}" liegen keine Dateien.` });
          return;
        }
        const zipName = `${pipeline.projektName(treffer.card)} - ${sub}.zip`;
        const asciiName = zipName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
        res.writeHead(200, {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
        });
        await zip.schreibeZip(res, dateien);
        res.end();
      } finally {
        await rm(tmp, { recursive: true, force: true });
      }
      return;
    }

    // v22: fertiges Video hochladen -> Fertiges Video/. Der Body IST die Datei (roh, kein
    // Multipart) — so bleibt der Server abhaengigkeitsfrei. Die Karte schiebt der Browser
    // danach weiter (der Upload erfuellt die Erkennungsregel „Fertiges Video enthaelt Video").
    if (pfad === "/api/projekt/upload" && req.method === "POST") {
      const ziel = UPLOAD_ZIELE[url.searchParams.get("ziel") || "fertig"];
      if (!ziel) {
        sendJson(res, 400, { error: "Unbekanntes Ziel.", satz: "Nur Rohmaterial oder fertiges Video." });
        req.resume();
        return;
      }
      const name = url.searchParams.get("name") || "";
      if (!pipeline.pfadstueckOk(name)) {
        sendJson(res, 400, { error: "Unzulaessiger Dateiname.", satz: "Der Dateiname darf keine Schraegstriche oder Punkt-Ordner enthalten." });
        req.resume();
        return;
      }
      if (ziel.nurVideo && !pipeline.VIDEO_ENDUNGEN.some((x) => name.toLowerCase().endsWith(x))) {
        sendJson(res, 400, { error: "Keine Videodatei.", satz: `„${name}" hat keine Video-Endung (${pipeline.VIDEO_ENDUNGEN.join(", ")}).` });
        req.resume();
        return;
      }
      const treffer = await karteMitOrdner(url.searchParams.get("karteId"));
      if (treffer.fehler) {
        sendJson(res, treffer.fehler, { error: "Upload nicht moeglich.", satz: treffer.satz });
        req.resume();
        return;
      }
      const tmp = await mkdtemp(join(tmpdir(), "smd-ul-"));
      const tempDatei = join(tmp, name);
      try {
        await streamPipeline(req, createWriteStream(tempDatei));
        await drive.kopiereDateiRauf(tempDatei, `${treffer.basis}/${ziel.unter}/${name}`);
        sendJson(res, 200, { ok: true, satz: `„${name}" liegt jetzt im Ordner „${ziel.unter}".` });
      } finally {
        await rm(tmp, { recursive: true, force: true });
      }
      return;
    }

    if (pfad === "/api/drive/reconcile" && req.method === "POST") {
      // Zuerst Spalten abgleichen (Drive fuehrt): Marker lesen, Hand-Umbenennungen erkennen,
      // Seed sicherstellen. Danach steht der dynamische Ordner-Resolver fuer den Karten-Abgleich.
      let spalten = pipeline.mischeSpalten(await spaltenCacheLesen());
      const spaltenBefunde = [];
      try {
        const driveConfig = await spaltenStore.leseVonDrive();
        const gemischt = pipeline.mischeSpalten(driveConfig);
        const r = await spaltenStore.reconcile(gemischt);
        spalten = r.spalten;
        spaltenBefunde.push(...r.befunde);
        await spaltenCacheSchreiben(spaltenStore.alsConfig(spalten));
      } catch (e) {
        spaltenBefunde.push({ status: "befund", satz: `Spalten-Abgleich mit Drive fehlgeschlagen: ${e.message}` });
      }
      spaltenResolverSetzen(spalten);

      const aktuell = await leseBoard();
      const { cards, befunde, geaendert } = await projekte.abgleich(aktuell.cards);
      let version = aktuell.version;
      if (geaendert) {
        version = aktuell.version + 1;
        await schreibeBoard(cards, version);
      }
      sendJson(res, 200, { cards, befunde: [...spaltenBefunde, ...befunde], geaendert, version, spalten });
      return;
    }

    if (pfad === "/api/spalten/rename" && req.method === "POST") {
      const { id, name } = JSON.parse(await readBody(req));
      if (!id || !name || !name.trim()) {
        sendJson(res, 400, { error: "id und name sind noetig." });
        return;
      }
      try {
        const driveConfig = await spaltenStore.leseVonDrive();
        const gemischt = pipeline.mischeSpalten(driveConfig || (await spaltenCacheLesen()));
        const neu = await spaltenStore.benenneUm(gemischt, id, name.trim());
        await spaltenCacheSchreiben(spaltenStore.alsConfig(neu));
        spaltenResolverSetzen(neu);
        sendJson(res, 200, { ok: true, spalten: neu });
      } catch (e) {
        sendJson(res, 502, { error: e.message, satz: `Umbenennen fehlgeschlagen: ${e.message}` });
      }
      return;
    }

    if (pfad === "/api/drive/kontext" && req.method === "GET") {
      const text = await leseKontext(pipeline.slug(url.searchParams.get("serie") || "")).catch(() => "");
      sendJson(res, 200, { text });
      return;
    }

    // ---- OAuth: Instagram (Weg B — Instagram Login, keine Facebook-Seite noetig) ---

    if (pfad === "/api/auth/instagram" && req.method === "GET") {
      const appId = process.env.INSTAGRAM_APP_ID;
      if (!appId) {
        sendJson(res, 500, { error: "INSTAGRAM_APP_ID fehlt in .env" });
        return;
      }
      const p = new URLSearchParams({
        client_id: appId,
        redirect_uri: `https://localhost:${PORT}/api/auth/instagram/callback`,
        scope: "instagram_business_basic,instagram_business_manage_insights",
        response_type: "code",
      });
      umleitung(res, `https://www.instagram.com/oauth/authorize?${p}`);
      return;
    }

    if (pfad === "/api/auth/instagram/callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      if (!code) {
        umleitung(
          res,
          `/?fehler=${encodeURIComponent(url.searchParams.get("error_description") || "Verbindung abgebrochen")}`
        );
        return;
      }
      try {
        const appId = process.env.INSTAGRAM_APP_ID;
        const appSecret = process.env.INSTAGRAM_APP_SECRET;
        const redirectUri = `https://localhost:${PORT}/api/auth/instagram/callback`;

        // Kurzzeit-Token (1 Stunde) — liefert auch die user_id direkt mit.
        const kurzRes = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
          }),
        });
        const kurz = await kurzRes.json();
        if (kurz.error_message) throw new Error(kurz.error_message);
        if (!kurz.access_token) throw new Error("Kein Token erhalten. Ist der Account als Tester eingeladen und akzeptiert?");

        // Langzeit-Token (60 Tage).
        const langRes = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${kurz.access_token}`
        );
        const lang = await langRes.json();
        const accessToken = lang.access_token || kurz.access_token;
        // Nutzername und echte ID holen (user_id aus dem Token-Tausch kann abweichen).
        const infoRes = await fetch(
          `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${accessToken}`
        );
        const info = await infoRes.json();
        const igUserId = String(info.user_id || info.id || kurz.user_id);

        await speichereToken("instagram", { accessToken, igUserId, username: info.username || "" });
        umleitung(res, "/?verbunden=instagram");
      } catch (e) {
        umleitung(res, `/?fehler=${encodeURIComponent(e.message)}`);
      }
      return;
    }

    // ---- OAuth: Google (Calendar + Tasks, v16d) --------------------------

    if (pfad === "/api/auth/google" && req.method === "GET") {
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      if (!clientId) {
        sendJson(res, 500, { error: "GOOGLE_OAUTH_CLIENT_ID fehlt in .env" });
        return;
      }
      const p = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `https://localhost:${PORT}/api/auth/google/callback`,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks",
        access_type: "offline",
        prompt: "consent", // erzwingt den Refresh-Token auch bei erneutem Verbinden
      });
      umleitung(res, `https://accounts.google.com/o/oauth2/v2/auth?${p}`);
      return;
    }

    if (pfad === "/api/auth/google/callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      if (!code) {
        umleitung(res, `/?fehler=${encodeURIComponent(url.searchParams.get("error") || "Google-Verbindung abgebrochen")}`);
        return;
      }
      try {
        const tok = await (
          await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
              client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
              redirect_uri: `https://localhost:${PORT}/api/auth/google/callback`,
              grant_type: "authorization_code",
            }),
          })
        ).json();
        if (tok.error) throw new Error(tok.error_description || tok.error);
        if (!tok.refresh_token) {
          throw new Error("Kein Refresh-Token erhalten. In den Google-Kontoeinstellungen den Zugriff der App entfernen und erneut verbinden.");
        }
        await gcal.speichereAusCode(tok);
        umleitung(res, "/?verbunden=google");
      } catch (e) {
        umleitung(res, `/?fehler=${encodeURIComponent(e.message)}`);
      }
      return;
    }

    if (pfad === "/api/gcal/status" && req.method === "GET") {
      sendJson(res, 200, { verbunden: await gcal.verbunden() });
      return;
    }

    // Loescht Event + Task eines Drehtermins (beim Loeschen auf dem Board). Einzelfehler
    // (schon geloescht) werden geschluckt — Hauptsache der jeweils andere geht durch.
    if (pfad === "/api/gcal/loeschen" && req.method === "POST") {
      try {
        const { eventId, taskId, calId } = JSON.parse(await readBody(req));
        if (eventId) { try { await gcal.eventLoeschen(calId, eventId); } catch { /* schon weg */ } }
        if (taskId) { try { await gcal.taskLoeschen(taskId); } catch { /* schon weg */ } }
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 502, { error: e.message });
      }
      return;
    }

    // ---- Verbindungs-Center (v24): .env-Whitelist schreiben + Status --------

    if (pfad === "/api/config/env" && req.method === "PUT") {
      const ENV_ERLAUBT = new Set([
        "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET",
        "INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET",
        "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET",
      ]);
      const { key, value } = JSON.parse(await readBody(req));
      if (!ENV_ERLAUBT.has(key)) {
        sendJson(res, 400, { error: "Unbekannter Schluessel — nur bekannte Zugangs-Felder sind erlaubt." });
        return;
      }
      const wert = String(value ?? "").replace(/[\r\n]/g, "").trim().slice(0, 500);
      await envSchreiben(key, wert);
      process.env[key] = wert; // sofort wirksam, ohne Neustart
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pfad === "/api/verbindungen/status" && req.method === "GET") {
      const tokens = await leseTokens();
      let driveOk = false;
      try { driveOk = !!(await drive.erreichbar())?.ok; } catch { /* Drive gestoert = nicht verbunden */ }
      let claudeOk = false;
      try { execSync("claude --version", { stdio: "ignore" }); claudeOk = true; } catch { /* CLI fehlt/nicht eingeloggt */ }
      sendJson(res, 200, {
        google: { verbunden: await gcal.verbunden(), clientKonfiguriert: !!process.env.GOOGLE_OAUTH_CLIENT_ID },
        drive: { verbunden: driveOk },
        instagram: { verbunden: !!(tokens.instagram && tokens.instagram.accessToken), clientKonfiguriert: !!process.env.INSTAGRAM_APP_ID },
        linkedin: { verbunden: !!(tokens.linkedin && tokens.linkedin.accessToken), clientKonfiguriert: !!process.env.LINKEDIN_CLIENT_ID },
        claude: { verbunden: claudeOk },
      });
      return;
    }

    // Sync eines Drehtermins → Kalender-Event (Bens Kalender) + Task (Bens Liste), v16d-1.
    // Routing/Teilnehmer/Deadlines kommen in v16d-2. Bestehende IDs werden geupdatet.
    if (pfad === "/api/gcal/sync" && req.method === "POST") {
      try {
        const { termin, karten, eventId, taskId, calId } = JSON.parse(await readBody(req));
        if (!termin || !termin.datum) {
          sendJson(res, 400, { error: "termin.datum fehlt" });
          return;
        }
        // Je Karte eine Zeile; dahinter der Google-Drive-Ordner-Link (per Datei-ID, ueberlebt
        // den Phasen-Umzug). drive.link liefert bei fehlendem Pfad "" statt zu werfen.
        const zeilen = [];
        for (const c of karten || []) {
          const titelC = (c && (c.title || c.titel)) || String(c);
          let link = "";
          try { if (c && c.column) link = await drive.link(pipeline.projektPfad(c)); } catch { link = ""; }
          zeilen.push(link ? `• ${titelC}\n  ${link}` : `• ${titelC}`);
        }
        const liste = zeilen.join("\n");
        const anzahl = (karten || []).length;
        const titel = `Dreh: ${termin.ort || termin.titel || "Drehtermin"}${anzahl ? ` (${anzahl})` : ""}`;
        const beschreibung = liste ? `Inhalte:\n${liste}` : "Noch keine Karten zugeordnet.";
        const felder = { titel, beschreibung, datum: termin.datum, zeit: termin.zeit || "", teilnehmer: [] };
        let neuEventId = eventId;
        let neuTaskId = taskId;
        if (eventId) await gcal.eventUpdaten(calId, eventId, felder);
        else neuEventId = await gcal.eventAnlegen(calId, felder);
        if (taskId) await gcal.taskUpdaten(taskId, { titel, notiz: beschreibung, faellig: termin.datum });
        else neuTaskId = await gcal.taskAnlegen({ titel, notiz: beschreibung, faellig: termin.datum });
        sendJson(res, 200, { eventId: neuEventId, taskId: neuTaskId });
      } catch (e) {
        sendJson(res, 502, { error: e.message });
      }
      return;
    }

    // ---- OAuth: LinkedIn -------------------------------------------------

    if (pfad === "/api/auth/linkedin" && req.method === "GET") {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      if (!clientId) {
        sendJson(res, 500, { error: "LINKEDIN_CLIENT_ID fehlt in .env" });
        return;
      }
      const p = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: `https://localhost:${PORT}/api/auth/linkedin/callback`,
        scope: "r_organization_social rw_organization_admin",
        state: "li_" + Date.now(),
      });
      umleitung(res, `https://www.linkedin.com/oauth/v2/authorization?${p}`);
      return;
    }

    if (pfad === "/api/auth/linkedin/callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      if (!code) {
        umleitung(res, `/?fehler=${encodeURIComponent("LinkedIn-Verbindung abgebrochen")}`);
        return;
      }
      try {
        const redirectUri = `https://localhost:${PORT}/api/auth/linkedin/callback`;
        const tok = await (
          await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
              client_id: process.env.LINKEDIN_CLIENT_ID,
              client_secret: process.env.LINKEDIN_CLIENT_SECRET,
            }),
          })
        ).json();
        if (tok.error) throw new Error(tok.error_description || tok.error);

        const accessToken = tok.access_token;
        const headers = {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202601",
          "X-Restli-Protocol-Version": "2.0.0",
        };
        const orgs = await (
          await fetch(
            "https://api.linkedin.com/rest/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&count=5",
            { headers }
          )
        ).json();
        const liste = orgs.elements || [];
        if (!liste.length) throw new Error("Keine LinkedIn-Unternehmensseite mit Administratorrolle gefunden.");

        const orgUrn = liste[0].organizationalTarget;
        const orgId = orgUrn?.split(":").pop() || "";
        const name = await (
          await fetch(`https://api.linkedin.com/rest/organizations/${orgId}`, { headers })
        ).json();

        await speichereToken("linkedin", { accessToken, orgUrn, orgId, orgName: name.localizedName || orgId });
        umleitung(res, "/?verbunden=linkedin");
      } catch (e) {
        umleitung(res, `/?fehler=${encodeURIComponent(e.message)}`);
      }
      return;
    }

    // ---- Zahlen ----------------------------------------------------------

    if (pfad === "/api/stats/instagram" && req.method === "GET") {
      // Quelle: ?quelle=drive liest aus den Drive-CSVs (Paket v22), sonst live API.
      if (url.searchParams.get("quelle") === "drive") {
        try {
          sendJson(res, 200, await kpiDrive.instagramAusDrive());
        } catch (e) {
          sendJson(res, 200, { verbunden: false, fehler: e.message, hinweis: "Auswertung aus Drive nicht lesbar." });
        }
        return;
      }
      const ig = (await leseTokens()).instagram;
      if (!ig) {
        sendJson(res, 200, { verbunden: false });
        return;
      }
      try {
        sendJson(res, 200, await social.instagramZahlen(ig));
      } catch (e) {
        sendJson(res, 200, { verbunden: true, fehler: e.message, hinweis: social.hinweisZuFehler("Instagram", e) });
      }
      return;
    }

    if (pfad === "/api/stats/linkedin" && req.method === "GET") {
      if (url.searchParams.get("quelle") === "drive") {
        try {
          sendJson(res, 200, await kpiDrive.linkedinAusDrive());
        } catch (e) {
          sendJson(res, 200, { verbunden: false, fehler: e.message, hinweis: "Auswertung aus Drive nicht lesbar." });
        }
        return;
      }
      const li = (await leseTokens()).linkedin;
      if (!li) {
        sendJson(res, 200, { verbunden: false });
        return;
      }
      try {
        sendJson(res, 200, await social.linkedinZahlen(li));
      } catch (e) {
        sendJson(res, 200, { verbunden: true, fehler: e.message, hinweis: social.hinweisZuFehler("LinkedIn", e) });
      }
      return;
    }

    // ---- KPI-Erfassung ----------------------------------------------------

    if (pfad === "/api/kpi/status" && req.method === "GET") {
      const board = await leseBoard();
      sendJson(res, 200, kpi.status(board.cards));
      return;
    }

    if (pfad === "/api/kpi/collect" && req.method === "POST") {
      const board = await leseBoard();
      const tokens = await leseTokens();
      const ergebnis = await kpi.sammle(board.cards, tokens);
      if (ergebnis.gesammelt > 0) {
        const neueVersion = board.version + 1;
        await schreibeBoard(ergebnis.cards, neueVersion);
      }
      sendJson(res, 200, { gesammelt: ergebnis.gesammelt, bericht: ergebnis.bericht });
      return;
    }

    // ---- Dateien ---------------------------------------------------------
    //
    // lib/ wird mit ausgeliefert: pipeline.js laeuft im Browser genauso wie hier.

    const wurzel = pfad.startsWith("/lib/") ? LIB_DIR : PUBLIC_DIR;
    const rel = pfad === "/" ? "index.html" : pfad.replace(/^\/(lib\/)?/, "");
    const datei = join(wurzel, normalize(rel));
    // Nach dem Zusammensetzen pruefen, dass der Pfad die Wurzel nicht verlassen hat.
    if (!datei.startsWith(wurzel + sep)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("Nicht erlaubt.");
      return;
    }
    try {
      const daten = await readFile(datei);
      res.writeHead(200, { "content-type": MIME[extname(datei)] || "application/octet-stream" });
      res.end(daten);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Nicht gefunden.");
    }
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
}

// --- Selbstsigniertes Zertifikat (Meta und LinkedIn verlangen https fuer Redirect-URIs) ---
async function ladeTls() {
  const keyFile = join(DATA_DIR, "localhost.key");
  const certFile = join(DATA_DIR, "localhost.crt");
  try {
    return { key: await readFile(keyFile), cert: await readFile(certFile) };
  } catch {
    console.log("Erzeuge selbstsigniertes Zertifikat …");
    await mkdir(DATA_DIR, { recursive: true });
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" ` +
      `-days 365 -nodes -subj "/CN=localhost"`,
      { stdio: "pipe" }
    );
    return { key: await readFile(keyFile), cert: await readFile(certFile) };
  }
}

await ladeEnv();

const tls = await ladeTls();
const server = createHttpsServer(tls, handler);
// --- Auto-Shutdown nach 1 Stunde Inaktivitaet ----------------------------

// v26: Schalter und Leerlauf-Dauer kommen aus dem Workflow-Register (data/workflows.json).
// Beim Start einmal gelesen — der Hinweis im UI sagt, dass eine Aenderung erst beim naechsten
// Start greift.
let idleAn = true;
let IDLE_LIMIT_MS = 60 * 60 * 1000;
let letzteAktivitaet = Date.now();

(async () => {
  try {
    const config = await workflows.lies();
    idleAn = wfRegister.istAn(config, "auto-shutdown");
    IDLE_LIMIT_MS = wfRegister.param(config, "auto-shutdown", "leerlaufMinuten") * 60 * 1000;
  } catch { /* ohne Datei gilt der Standard oben */ }
})();

function aktivitaetGemeldet() {
  letzteAktivitaet = Date.now();
}

async function ollamaEntladen() {
  try {
    const res = await fetch("http://localhost:11434/api/ps");
    if (!res.ok) return;
    const { models } = await res.json();
    for (const m of (models || [])) {
      await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: m.name, keep_alive: 0 }),
      }).catch(() => {});
    }
    if ((models || []).length) console.log("Ollama: Modelle entladen.");
  } catch { /* Ollama war nicht aktiv */ }
}

setInterval(async () => {
  if (!idleAn) return;
  if (Date.now() - letzteAktivitaet >= IDLE_LIMIT_MS) {
    console.log(`Auto-Shutdown: ${Math.round(IDLE_LIMIT_MS / 60000)} Minuten keine Aktivitaet.`);
    await ollamaEntladen();
    process.exit(0);
  }
}, 5 * 60 * 1000);

server.listen(PORT, async () => {
  console.log(`Content-Maschine laeuft auf https://localhost:${PORT}`);
  // Spalten-Resolver aus dem Cache setzen, damit Karten-Operationen schon vor dem ersten
  // Abgleich die (evtl. umbenannten) Drive-Ordner treffen. Fehlt der Cache, greifen die Defaults.
  try {
    spaltenResolverSetzen(pipeline.mischeSpalten(await spaltenCacheLesen()));
  } catch { /* Defaults greifen ohnehin */ }
  // KPI-Sammlung beim Start ausloesen (Owner 02.09.2026): wenn nach den Intervallen eine
  // Post-Messung faellig ist ODER die Konto-Kadenz (woechentl./quartalsw.) greift. Die
  // Faelligkeits-Logik steckt in kpi.sammle — der Aufruf ist selbst-gated und schreibt
  // Drive nur, wenn wirklich etwas erfasst wurde. Blockiert den Serverstart nicht.
  try {
    const board = await leseBoard();
    const tokens = await leseTokens();
    const ergebnis = await kpi.sammle(board.cards, tokens);
    if (ergebnis.gesammelt > 0) {
      await schreibeBoard(ergebnis.cards, board.version + 1);
    }
    const konto = ergebnis.bericht.some((b) => /^(kanal|demografie)/.test(b.status || ""));
    if (ergebnis.gesammelt > 0 || konto) {
      console.log(`KPI beim Start: ${ergebnis.gesammelt} Post-Messung(en)` + (konto ? " + Konto-Schnappschuss" : "") + " erfasst.");
    }
  } catch (e) {
    console.log(`KPI-Start uebersprungen: ${e.message}`); // darf den Betrieb nie blockieren
  }
});
