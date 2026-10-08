// Lokaler Server der WEE Social Media Suit.
// Bewusst ohne Abhaengigkeiten: nur Node-Bordmittel.
//
// Diese Datei ist reine Wegweisung. Was die Sache selbst ausmacht, liegt in lib/:
//   pipeline.js  Phasen, Termine, Karten-Schema, Qualitaetstore (laeuft auch im Browser)
//   drive.js     rclone-Anbindung, trennt "gibt es nicht" von "geht gerade nicht"
//   projects.js  Projektordner anlegen, verschieben, lesen — und der Abgleich
//   ai.js        Prompts und die Claude-CLI
//   social.js    Instagram- und LinkedIn-Zahlen

import { createServer as createHttpsServer } from "node:https";
import { readFile, writeFile, mkdir, rename, mkdtemp, rm, readdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline as streamPipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { execSync, exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";

import * as pipeline from "./lib/pipeline.js";
import * as drive from "./lib/drive.js";
import * as driveSetup from "./lib/drivesetup.js"; // v63: Ordner/Konto wechseln
import * as ereignisse from "./lib/ereignisse.js"; // v58: was das Board nach aussen tut
import * as projekte from "./lib/projects.js";
import * as planstore from "./lib/planstore.js";
import * as ki from "./lib/ai.js";
import * as social from "./lib/social.js";
import * as kpi from "./lib/kpi.js";
import * as kpiDrive from "./lib/kpi-drive-lesen.js";
import * as gcal from "./lib/gcal.js";
import * as zip from "./lib/zip.js";
import * as prompts from "./lib/promptstore.js";
import * as workflows from "./lib/workflowstore.js";
import * as boardparam from "./lib/boardparamstore.js"; // v78: Kategorien/Ziele editierbar (Drive)
import * as defaultsStore from "./lib/defaultsstore.js";
import * as unternehmen from "./lib/kontextstore.js";
import * as wfRegister from "./lib/workflows.js";
import * as websuche from "./lib/websuche.js";
import * as claudeAuth from "./lib/claudeauth.js"; // v86: Claude-CLI im Board anmelden
import * as codexAuth from "./lib/codexauth.js"; // v103: ChatGPT ueber die Codex-CLI
import * as zuordnung from "./lib/zuordnung.js"; // v97: Posts -> Karten
import * as kampagnen from "./lib/kampagnen.js"; // v107: Kampagnen mit Drive-Tabelle
import { verstaendlicherFehler } from "./lib/fehlertext.js"; // v115: deutsche Fehlersaetze
import * as scheduler from "./lib/scheduler.js"; // v115: max. Abstand pruefen, bevor ein Plan gespeichert wird

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const DATA_DIR = join(__dirname, "data");
const BOARD_FILE = join(DATA_DIR, "board.json");
const TOKEN_FILE = join(DATA_DIR, "tokens.json");
const DEFAULTS_FILE = join(DATA_DIR, "defaults.json");
const PLAN_FILE = join(DATA_DIR, "plan.json");
const ordnerLinkCache = new Map();
async function ordnerLinkId(rel) {
  const root = drive.aktuellerRoot();
  const key = `${root}|${rel}`;
  let id = ordnerLinkCache.get(key);
  if (!id) id = rel ? await drive.ordnerId(rel) : root;
  if (id) ordnerLinkCache.set(key, id);
  return id;
}
const BOARD_SICHERUNGEN = join(DATA_DIR, "board-sicherungen"); // v63: je Drive-Ordner ein Board-Stand
const SPALTEN_FILE = join(DATA_DIR, "spalten.json");
const PROMPTS_FILE = join(DATA_DIR, "prompts.json");
const WORKFLOWS_FILE = join(DATA_DIR, "workflows.json");
const BOARDPARAM_FILE = join(DATA_DIR, "boardparameter.json"); // v78: Cache fuer Kategorien/Ziele
const KONTEXT_FILE = join(DATA_DIR, "kontext.json");
const EINRICHTUNG_LOKAL_FILE = join(DATA_DIR, "einrichtung-lokal.json"); // v101: Anbindungen dieses Rechners eingerichtet?
const PUBLIC_DIR = join(__dirname, "public");
const LIB_DIR = join(__dirname, "lib");

// Die beiden Ablagen kennen ihren Pfad nicht von selbst — hier bekommt jede ihren (v26).
prompts.setzePfad(PROMPTS_FILE);
workflows.setzePfad(WORKFLOWS_FILE);
boardparam.setzePfad(BOARDPARAM_FILE); // v78: Drive-Wahrheit, data/boardparameter.json nur Cache
defaultsStore.setzePfad(DEFAULTS_FILE); // v60: Defaults Drive-gestuetzt, data/defaults.json nur Cache
unternehmen.setzePfad(KONTEXT_FILE); // v33: Unternehmens- und Projektkontext

// --- Drive: Arbeitsordner und Konto wechseln (v63) ---------------------------------------
//
// Ein Ordnerwechsel tauscht die Wahrheit unter dem Board aus: die Karten zeigen auf Ordner im
// alten Root. Darum wird der Board-Stand je Drive-Ordner gesichert (data/board-sicherungen/
// <root>.json) und beim Zurueckwechseln wiederhergestellt; ein neuer Ordner startet leer.
let ordnerWechselLaeuft = false;

async function sichereBoardFuerRoot(root) {
  await mkdir(BOARD_SICHERUNGEN, { recursive: true });
  let board = null;
  try { board = JSON.parse(await readFile(BOARD_FILE, "utf8")); } catch { /* noch kein Board */ }
  if (board) {
    await writeFile(join(BOARD_SICHERUNGEN, `${root}.json`), JSON.stringify({ gesichertAm: new Date().toISOString(), board }, null, 2), "utf8");
  }
}

async function ladeBoardSicherung(root) {
  try { return JSON.parse(await readFile(join(BOARD_SICHERUNGEN, `${root}.json`), "utf8")).board; } catch { return null; }
}

async function wechsleDriveOrdner(neuId) {
  if (ordnerWechselLaeuft) throw Object.assign(new Error("Ein Ordnerwechsel laeuft bereits."), { status: 409 });
  ordnerWechselLaeuft = true;
  try {
    const alt = drive.aktuellerRoot();
    if (neuId === alt) return { unveraendert: true, art: "aktuell" };
    const pruef = await driveSetup.pruefeOrdner(neuId);
    if (pruef.art === "fremd" || pruef.art === "falsch") {
      // v87: Nur leer (Struktur wird angelegt) oder vollstaendige Struktur (wird geladen).
      if (pruef.art === "falsch") ereignisse.melde({ sektion: "drive", dienst: "Struktur", text: driveSetup.pruefSatz(pruef), status: "befund" });
      throw Object.assign(new Error(driveSetup.pruefSatz(pruef)), { status: 400 });
    }
    await sichereBoardFuerRoot(alt);
    const aktuell = await leseBoard();
    drive.setzeRoot(neuId, pruef.ablage ? pruef.ablage.teamDrive : null); // v103: geteilte Ablage merkt rclone mit
    // Alles, was am alten Ordner hing, ist ueberholt (die Caches regenerieren aus dem neuen Drive).
    for (const f of [SPALTEN_FILE, PLAN_FILE]) { try { await rm(f, { force: true }); } catch { /* egal */ } }
    projekte.scanCacheLeeren();
    driveSetup.kontoCacheLeeren();
    const sicherung = await ladeBoardSicherung(neuId);
    const version = Math.max(aktuell.version, (sicherung && sicherung.version) || 1) + 1; // offene Tabs laufen in den Versions-Lock und laden neu
    await schreibeBoard(sicherung ? (sicherung.cards || []) : [], version, sicherung ? sicherung.drehtermine || [] : []);
    let struktur = null;
    if (pruef.art === "leer") struktur = await driveSetup.legeStrukturAn();
    return { art: pruef.art, boardWiederhergestellt: !!sicherung, struktur };
  } finally {
    ordnerWechselLaeuft = false;
  }
}

// Kontowechsel: rclones Browser-Anmeldung laeuft im Hintergrund, die Oberflaeche fragt den Stand ab.
const kontoWechsel = { laeuft: false, gestartet: 0, ergebnis: null, satz: "" };
function starteDriveKontoWechsel(neu = null) {
  if (kontoWechsel.laeuft) return;
  kontoWechsel.laeuft = true;
  kontoWechsel.gestartet = Date.now();
  kontoWechsel.ergebnis = null;
  kontoWechsel.satz = "Anmeldung im Browser laeuft …";
  let fehlerText = "";
  const kind = driveSetup.starteKontoWechsel(undefined, neu);
  kind.stderr.on("data", (d) => { fehlerText += d; });
  const abbruch = setTimeout(() => { try { kind.kill(); } catch { /* schon beendet */ } }, 10 * 60 * 1000); // 10 Min. fuer den Login
  const fertig = (ok, satz) => {
    clearTimeout(abbruch);
    kontoWechsel.laeuft = false;
    kontoWechsel.ergebnis = ok ? "ok" : "fehler";
    kontoWechsel.satz = satz;
  };
  kind.on("error", (e) => fertig(false, e.code === "ENOENT" ? "rclone ist nicht installiert." : e.message));
  kind.on("close", (code) => {
    const letzteZeile = fehlerText.trim().split(/\r?\n/).pop() || "Abbruch";
    if (code !== 0) return fertig(false, `Anmeldung nicht abgeschlossen (${letzteZeile}).`);
    drive.ladeZugangNeu();
    driveSetup.kontoCacheLeeren();
    fertig(true, "Angemeldet. Jetzt den Arbeitsordner pruefen.");
  });
}

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

// v97: Posts von Instagram/LinkedIn holen und den Karten zuordnen. Eindeutige Treffer (Format passt, hoechstens
// 3 Std. neben dem geplanten Upload, keine Konkurrenz) werden eingetragen; alles andere wird ein Vorschlag an der
// Karte, den der Mensch bestaetigt oder ablehnt. Geaenderte Karten gehen auch in ihre projekt.json (Drive-Wahrheit).
// v97 Nachtrag: alle Posts der verbundenen Plattformen in Einheits-Form (fuer Automatik und Hand-Zuordnung).
// v113 (M9): welche Plattformen ueberhaupt verbunden sind — ohne Verbindung meldete die Upload-Phase
// „0 Posts geprüft" bzw. „alle sind schon Karten zugeordnet" statt „nicht verbunden".
async function verbundenePlattformen() {
  const tokens = await leseTokens();
  return ["instagram", "linkedin"].filter((p) => tokens[p] && tokens[p].accessToken);
}

async function allePosts() {
  const tokens = await leseTokens();
  const posts = [];
  if (tokens.instagram && tokens.instagram.accessToken)
    posts.push(...zuordnung.postsAusInstagram(await social.instagramMedienListe(tokens.instagram)));
  if (tokens.linkedin && tokens.linkedin.accessToken) {
    try { posts.push(...zuordnung.postsAusLinkedin((await social.linkedinZahlen(tokens.linkedin)).posts || [])); } catch { /* LinkedIn optional */ }
  }
  return posts;
}

async function zuordnungPruefen() {
  const tokens = await leseTokens();
  const posts = [];
  if (tokens.instagram && tokens.instagram.accessToken)
    posts.push(...zuordnung.postsAusInstagram(await social.instagramMedienListe(tokens.instagram)));
  if (tokens.linkedin && tokens.linkedin.accessToken) {
    try { posts.push(...zuordnung.postsAusLinkedin((await social.linkedinZahlen(tokens.linkedin)).posts || [])); } catch { /* LinkedIn optional */ }
  }
  if (!posts.length) return { auto: 0, vorschlaege: 0, posts: 0 };
  // v115 (v114 M1): auf dem NEUESTEN Stand zuordnen und schreiben (Board-Reihe) — die Posts kamen vorher aus dem Netz.
  let zahlen = { auto: [], vorschlaege: [] };
  const { ergebnis } = await aendereBoard((board) => {
    const { auto, vorschlaege } = zuordnung.ordneZu(board.cards, posts);
    zahlen = { auto, vorschlaege };
    const geaendert = new Set();
    for (const a of auto) {
      const k = board.cards.find((c) => c.id === a.cardId);
      k.published = { ...(k.published || {}), [a.plattform]: zuordnung.postEintrag(a.post, "auto", a.abweichungStunden) };
      k.floatUpload = false; // veroeffentlicht = Datum steht fest
      geaendert.add(k);
    }
    // Vorschlaege werden je Lauf neu gesetzt (alte, inzwischen zugeordnete fallen weg).
    for (const k of board.cards) {
      const neu = vorschlaege
        .filter((v) => v.cardId === k.id && !((k.published || {})[v.plattform] || {}).id)
        .map((v) => ({ plattform: v.plattform, post: zuordnung.postEintrag(v.post, "vorschlag"), grund: v.grund }));
      if (JSON.stringify(neu) !== JSON.stringify(k.zuordnungVorschlag || [])) {
        k.zuordnungVorschlag = neu;
        geaendert.add(k);
      }
    }
    return geaendert.size ? { auto, vorschlaege, geaendert } : false;
  });
  if (ergebnis) for (const k of ergebnis.geaendert) if (k.driveName) projekte.spiegeleKarte(k).catch(() => {});
  return { auto: zahlen.auto.length, vorschlaege: zahlen.vorschlaege.length, posts: posts.length };
}

async function leseBoard() {
  try {
    const roh = JSON.parse(await readFile(BOARD_FILE, "utf8"));
    const cards = (roh.cards || []).map(pipeline.migriere);
    return { version: roh.version || 1, cards, drehtermine: roh.drehtermine || [] };
  } catch {
    return { version: 1, cards: [], drehtermine: [] };
  }
}

// v115 (v114 M1): EIN Schreiber fuer board.json zur Zeit. Bis v114 lasen zehn gleichzeitige Speicherungen dieselbe
// Version, 3–6 meldeten „gespeichert", nur eine Aenderung ueberlebte, der Rest scheiterte mit EPERM/ENOENT an der
// gemeinsamen Temp-Datei. Jetzt: Lesen, Versionspruefung und Schreiben laufen hintereinander in dieser Reihe —
// nur der kurze Lese-/Schreib-Moment, nie ein Drive- oder Netzwerkaufruf, damit Speichern nie lange wartet.
let boardKette = Promise.resolve();
function boardReihe(f) {
  const lauf = boardKette.then(f);
  boardKette = lauf.then(() => {}, () => {});
  return lauf;
}
function schreibeBoard(cards, version, drehtermine) {
  return boardReihe(() => schreibeBoardRoh(cards, version, drehtermine));
}
// Liest den NEUESTEN Stand, laesst `aendere` ihn veraendern (kurz, ohne Netzwerk) und schreibt Version+1.
// `aendere` gibt false (oder ein Objekt mit `nichts: true`) zurueck, wenn nichts zu schreiben ist. Liefert { board, ergebnis }.
function aendereBoard(aendere) {
  return boardReihe(async () => {
    const board = await leseBoard();
    const ergebnis = await aendere(board);
    if (ergebnis === false || (ergebnis && ergebnis.nichts)) return { board, ergebnis };
    board.version += 1;
    await schreibeBoardRoh(board.cards, board.version, board.drehtermine);
    return { board, ergebnis };
  });
}

// v115 (v114 M1): Die KPI-Erfassung misst Sekunden bis Minuten im Netz. Bis v114 schrieb sie danach ihren
// Startstand zurueck — was Ben in der Zeit am Board geaendert hatte, war weg. Sie aendert nur `kpiMessungen`;
// genau das wird jetzt auf den neuesten Stand gelegt.
async function kpiUebernehmen(gemessen) {
  await aendereBoard((board) => {
    let n = 0;
    for (const c of gemessen) {
      const k = board.cards.find((x) => x.id === c.id);
      if (k && JSON.stringify(k.kpiMessungen || {}) !== JSON.stringify(c.kpiMessungen || {})) { k.kpiMessungen = c.kpiMessungen; n++; }
    }
    return n > 0;
  });
}

async function schreibeBoardRoh(cards, version, drehtermine) {
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
  const temp = `${BOARD_FILE}.${randomBytes(4).toString("hex")}.tmp`; // v115: nie zwei Schreiber auf einer Temp-Datei
  await writeFile(temp, inhalt, "utf8");
  await rename(temp, BOARD_FILE);
}

// v32 C3 (Flush): Seit C1 antwortet der Save sofort und spiegelt die Karten DANACH im
// Hintergrund nach Drive. Diese Menge haelt die laufenden Spiegelungen, damit der Beenden-Weg
// (/api/shutdown) sie zu Ende bringen kann, bevor der Prozess endet — so steht der letzte
// lokale Stand sicher in Drive.
const spiegelungenInFlight = new Set();

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

// v63: Instagram-Benutzername. Beim Verbinden wurde er frueher nicht immer gespeichert (Feld
// leer) — dann einmal live nachfragen und im Token nachtragen.
async function instagramName(tokens) {
  const ig = tokens.instagram;
  if (!ig || !ig.accessToken) return "";
  if (ig.username) return ig.username;
  try {
    const r = await fetch(`https://graph.instagram.com/v21.0/me?fields=username&access_token=${ig.accessToken}`);
    const j = await r.json();
    if (r.ok && j.username) {
      await speichereToken("instagram", { ...ig, username: j.username });
      return j.username;
    }
  } catch { /* Name bleibt leer */ }
  return "";
}

// v40: Trennen — den Token-Eintrag eines Dienstes entfernen und tokens.json neu schreiben.
// Gibt zurueck, was vorher gespeichert war (fuer ein best-effort Revoke beim Anbieter).
async function entferneToken(plattform) {
  const t = await leseTokens();
  const vorher = t[plattform];
  delete t[plattform];
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(t, null, 2), "utf8");
  return vorher || null;
}

// v41: Rollen->Modell-Zuordnung aus dem Request-Body. Der Client schickt `rollenModelle`
// {userkomm,recherche,kontext}; faellt das (alter Client) weg, nutzen alle Rollen das eine
// gesendete Modell — so bleibt der Aufruf rueckwaertskompatibel.
function rollenAusBody(body) {
  if (body.rollenModelle && typeof body.rollenModelle === "object") return body.rollenModelle;
  const eine = {
    provider: body.provider || "ollama",
    ollamaModel: body.ollamaModel || "qwen2.5",
    claudeModell: body.claudeModell || ki.CLAUDE_MODELL_STANDARD,
  };
  return { userkomm: eine, recherche: eine, kontext: eine };
}

const ROLLE_NAME = { userkomm: "Userkommunikation", recherche: "Recherche", kontext: "Kontextabgleich" };

// v41: Fuehrt die Schritt-Pipeline eines Knopfes aus. Jeder Schritt laeuft auf dem Modell seiner
// Rolle (rollenModelle), seine Ausgabe geht als {{vorschritt}} in den naechsten. Recherche-Schritte
// bekommen eine Web-Suche vorangestellt (Query = die vom Vorschritt formulierten Suchanfragen, sonst
// das Kartenthema). Der System-Vorspann geht NUR in userkomm-Schritte (Owner 15.09.2026). Nur der
// LETZTE Schritt streamt live; sein Text ist das Ergebnis. onStatus/onDelta sind optional.
// v51: onStufe(ereignis) meldet zusaetzlich die ECHTE Stufe als maschinenlesbares Objekt
// {stufe, schritt, von, rolle, rolleName, modell, …} — `onStatus` bleibt daneben als
// deutscher Satz erhalten, damit aeltere Anzeigen unveraendert weiterlaufen.
async function laufePipeline({ task, card, rollenModelle, onStatus = () => {}, onDelta = () => {}, onStufe = () => {}, signal }) {
  const c = card || {};
  // v51: Der Vorlauf (Prompts lesen, Firmen-/Projektkontext sammeln) dauerte in der Messung
  // vom 17.09.2026 allein 12,4 s, bevor ueberhaupt die erste Status-Zeile kam — bis dahin war
  // die Anzeige leer. Deshalb hier die erste Stufe, noch vor jeder Datei- und Drive-Leserei.
  onStufe({ stufe: "kontext", schritt: 0, von: 0 });
  await boardparamSicher(); // v78: KI sieht die editierten Kategorien/Ziele
  // v79: format-spezifische Pipeline (contenttypFormat der Karte). Fehlt eine, greift der Fallback
  // Task-Default -> Standard (in promptstore.effektiveSchritte).
  const format = pipeline.contenttypFormat(c.contenttyp || "reel");
  const schritte = await prompts.pipeline(task, format);
  if (!schritte.length) throw new Error(`Kein Prompt fuer die Aufgabe ${task}.`);
  const firmenKontext = await unternehmen
    .sammle({ serie: c.serie ? pipeline.slug(c.serie) : "" })
    .catch(() => ({ firmenkontext: "", projektkontext: "", stilregeln: "", stil: null }));
  // v110: globaler Stil-Block sitzt im Vorspann (Platzhalter {{stilregeln}}), den bekommen nur
  // Userkommunikations-Schritte. Rollen ohne Vorspann bekommen ihn an den Schritt-Prompt gehaengt,
  // jede Rolle zusaetzlich ihren eigenen Stil-Zusatz (KI-Rollen-Tab).
  const systemVorspann = await prompts.systemPrompt({
    firmenkontext: firmenKontext.firmenkontext || "",
    projektkontext: firmenKontext.projektkontext || "",
    stilregeln: firmenKontext.stilregeln || "",
  });
  const rollen = rollenModelle || {};
  const fallback = { provider: "ollama", ollamaModel: "qwen2.5", claudeModell: ki.CLAUDE_MODELL_STANDARD }; // v91: wird per loeseOllamaModell auf die installierte Groesse aufgeloest

  // v51: Waehrend ein kaltes Ollama-Modell laedt, kommt sekundenweise dieselbe Stufe mit
  // wachsender Sekundenzahl. Ohne das steht die Anzeige bis zu einer halben Minute still und
  // sieht aus wie ein Haenger (gemessen: 25,38 s Ladezeit fuer deepseek-r1:14b).
  function stufenTicker(basis, stufe) {
    const start = Date.now();
    onStufe({ ...basis, stufe, sekunden: 0 });
    const id = setInterval(() => {
      onStufe({ ...basis, stufe, sekunden: Math.round((Date.now() - start) / 1000) });
    }, 1000);
    if (id.unref) id.unref();
    return () => clearInterval(id);
  }

  let vorschritt = "";
  for (let i = 0; i < schritte.length; i++) {
    const s = schritte[i];
    const stepStart = Date.now();
    const rolle = s.rolle || "userkomm";
    const konf = rollen[rolle] || rollen.userkomm || fallback;
    const rolleName = ROLLE_NAME[rolle] || rolle;
    const modellName = konf.provider === "claude" ? "Claude" : konf.provider === "codex" ? "ChatGPT" : `${konf.ollamaModel} (lokal)`;
    const marke = `Schritt ${i + 1}/${schritte.length} · ${rolleName}`;
    // v51: dieselben Angaben, die `marke` zu einem String verklebt, zusaetzlich als Felder.
    const basis = { schritt: i + 1, von: schritte.length, rolle, rolleName, modell: modellName };

    // Web-Suche: nur fuer Recherche-Schritte. Query = die Zeilen des Vorschritts (bis 3, Nummerierung
    // entfernt), sonst das Kartenthema (Titel + Reihe).
    // v79: Web-Suche pro Schritt schaltbar (`s.websuche`). Fehlt das Feld (aeltere Fassung),
    // gilt weiter die v41-Regel „nur die Recherche-Rolle sucht" — abwaertskompatibel.
    let webBlock = "";
    const suchtImWeb = s.websuche !== undefined ? !!s.websuche : rolle === "recherche";
    if (suchtImWeb) {
      onStatus(`${marke} · sucht im Web …`);
      onStufe({ ...basis, stufe: "web-suche" });
      const queries = vorschritt
        ? vorschritt.split("\n").map((z) => z.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim()).filter(Boolean).slice(0, 3)
        : [[c.title, c.serie].filter(Boolean).join(" ").trim()].filter(Boolean);
      const { treffer, quelle } = await websuche.sucheWebViele(queries).catch(() => ({ treffer: [], quelle: "fehler" }));
      webBlock = websuche.alsPromptBlock(treffer);
      onStatus(`${marke} · ${treffer.length ? `${treffer.length} Web-Treffer (${quelle})` : "keine Web-Treffer"} · ${modellName}`);
      // Die Trefferzahl gab es bisher nur im Satz; als Feld kann die Anzeige sie selbst setzen.
      onStufe({ ...basis, stufe: "web-treffer", treffer: treffer.length, quelle });
    } else {
      onStatus(`${marke} · ${modellName}`);
    }

    const stepPrompt = ki.baueSchritt(s.prompt, c, {
      firmenkontext: firmenKontext.firmenkontext || "",
      projektkontext: firmenKontext.projektkontext || "",
      stilregeln: firmenKontext.stilregeln || "", // v110: auch in Schritt-Vorlagen verfuegbar
      vorschritt,
    }, task);
    const zusatz = String(konf.stilZusatz || "").trim().slice(0, 4000);
    const stilAnhang =
      rolle === "userkomm"
        ? (zusatz ? `\n\nSTIL-ZUSATZ FUER DIESE ROLLE (Einstellungen → KI-Rollen)\n${zusatz}` : "")
        : unternehmen.stilBlock(firmenKontext.stil, zusatz);
    const userMsg = webBlock + "\n\n---\n\n" + stepPrompt + stilAnhang;
    const system = rolle === "userkomm" ? systemVorspann : "";
    const letzter = i === schritte.length - 1;
    if (signal && signal.aborted) throw new ki.KiAbgebrochen(); // v115 (M6): Browser weg -> kein weiterer Schritt

    let text;
    if (konf.provider === "ollama") {
      // v51: Ob das Modell kalt ist, muss VOR dem Aufruf geklaert werden — die OpenAI-Schicht,
      // ueber die lib/ai.js generiert, liefert hinterher kein `load_duration` mit.
      const stand = await ki.modellStand(konf.ollamaModel);
      let tickerAus = () => {};
      let generiertGemeldet = false;
      const meldeGeneriert = () => {
        tickerAus();
        tickerAus = () => {};
        if (generiertGemeldet) return;
        generiertGemeldet = true;
        onStufe({ ...basis, stufe: "generiert" });
      };
      if (!stand.ollamaLaeuft) onStufe({ ...basis, stufe: "ollama-start" });
      else if (!stand.geladen) tickerAus = stufenTicker(basis, "modell-laedt");
      else meldeGeneriert();
      try {
        text = letzter
          ? await ki.runOllamaStream(system, userMsg, konf.ollamaModel, (d) => d && onDelta(d), {
              onErsterToken: meldeGeneriert,
              signal,
            })
          : await ki.runOllama(system, userMsg, konf.ollamaModel, { signal });
      } catch (e) {
        // Damit der Hinweistext zum Anbieter passt (bis v51 bekam ein Ollama-Fehler den
        // Claude-Hinweis, weil hinweisZuFehler ohne zweites Argument aufgerufen wurde).
        e.provider = "ollama";
        throw e;
      } finally {
        tickerAus();
      }
    } else if (konf.provider === "codex") {
      // v103: ChatGPT ueber die Codex-CLI — kein Stream; die fertige Antwort geht als ein Stueck an die Anzeige.
      onStufe({ ...basis, stufe: "generiert" });
      try {
        text = await ki.runCodex(system ? system + userMsg : userMsg, { modell: konf.codexModell || "", signal });
        if (letzter && text) onDelta(text);
      } catch (e) {
        e.provider = "codex";
        throw e;
      }
    } else {
      const prompt = system ? system + userMsg : userMsg;
      onStufe({ ...basis, stufe: "generiert" });
      try {
        text = letzter
          ? await ki.runClaudeStream(prompt, (d, st) => { if (d) onDelta(d); if (st) onStatus(st); }, { modell: konf.claudeModell, signal })
          : await ki.runClaude(prompt, { modell: konf.claudeModell, signal });
      } catch (e) {
        e.provider = "claude";
        throw e;
      }
    }
    vorschritt = text || "";
    // v79: Latenz je Schritt sichtbar — die serielle Kette macht Zeit unvermeidbar, also wird sie
    // benannt statt versteckt. Reitet auf den bestehenden Kanaelen (onStufe-Feld + Status-Satz).
    const dauerSek = Math.round((Date.now() - stepStart) / 1000);
    onStufe({ ...basis, stufe: "schritt-fertig", dauerSek });
    if (!letzter) onStatus(`${marke} · fertig in ${dauerSek}s`);
  }
  onStufe({ stufe: "fertig", schritt: schritte.length, von: schritte.length });
  return vorschritt;
}

// Der Drive-Abgleich als EINE Funktion (v51 T7) — die JSON-Route und die Stream-Route teilen
// sie sich, damit beide Wege nie auseinanderlaufen koennen. `onStufe` ist optional: ohne
// Rueckruf verhaelt sie sich exakt wie der Abgleich vor v51.
// Zuerst die Spalten (Drive fuehrt): Marker lesen, Hand-Umbenennungen erkennen, Seed
// sicherstellen. Danach steht der dynamische Ordner-Resolver fuer den Karten-Abgleich.
//
// v84: Laeuft schon ein Abgleich (zweites Fenster, Start + Knopf), haengt sich ein weiterer
// Aufrufer an DENSELBEN Lauf — seine Stufen-Meldungen bekommt er ab dem Einstieg mit. Vorher
// liefen beide komplett hintereinander durch die rclone-Kette (doppelte Zeit, doppelte Drosselung).
let abgleichLauf = null;
const abgleichHoerer = new Set();
function fuehreAbgleichAus(onStufe = () => {}) {
  abgleichHoerer.add(onStufe);
  if (!abgleichLauf) {
    const alle = (o) => { for (const h of abgleichHoerer) { try { h(o); } catch {} } };
    abgleichLauf = abgleichEinmal(alle).finally(() => {
      abgleichLauf = null;
      abgleichHoerer.clear();
    });
  }
  return abgleichLauf.finally(() => abgleichHoerer.delete(onStufe));
}

async function abgleichEinmal(onStufe) {
  // v87 (Owner 30.09.2026): Die Struktur steht fest (PHASEN). Statt die Spalten aus Drive zu
  // uebernehmen, wird die Struktur GEPRUEFT (ein rclone-Aufruf). Passt sie nicht, laedt das Board
  // nichts aus Drive: der Abgleich bricht mit dem Grund ab, das Board bleibt beim Cache (v81:
  // „Cache-Stand"), das Drive-Log nennt den Grund.
  onStufe({ stufe: "drive-spalten" });
  const spalten = pipeline.spaltenDefault();
  const liste = await drive.ordnerBaum("", 2);
  const struktur = pipeline.pruefeStruktur(liste);
  if (!struktur.ok) {
    const satz = `Das Board lädt nichts aus Drive, weil die Ordnerstruktur nicht stimmt: ${struktur.fehler.join(" ")}`;
    ereignisse.melde({ sektion: "drive", dienst: "Struktur", text: satz, status: "befund" });
    throw new Error(satz);
  }
  const spaltenBefunde = [];

  const aktuell = await leseBoard();
  const { cards: abgeglichen, befunde, geaendert, ordnerDa } = await projekte.abgleich(aktuell.cards, { onStufe });
  // v88 (Befund 01.10.2026): Der Abgleich dauert Sekunden; wer in der Zeit eine Karte anlegt oder
  // aendert, speichert in board.json. Frueher schrieb der Abgleich danach seinen STARTSTAND
  // zurueck (neue Karten weg) und lieferte ihn dem Browser (Karte verschwand, der naechste
  // Speichervorgang loeschte sie endgueltig). Jetzt: die Aenderungen des Abgleichs werden auf den
  // NEUESTEN Stand gelegt. Hat der Mensch eine Karte seit dem Start selbst geaendert, gewinnt
  // seine Fassung — der naechste Abgleich holt die Drive-Seite nach.
  // v115 (v114 M1): neuesten Stand lesen, zusammenlegen und schreiben als EIN Schritt der Board-Reihe.
  const { cards, version } = await boardReihe(async () => {
    const neuester = await leseBoard();
    const z = projekte.abgleichAufNeuesten(aktuell.cards, abgeglichen, neuester.cards);
    if (!(geaendert && z.zuSchreiben)) return { cards: z.cards, version: neuester.version };
    await schreibeBoardRoh(z.cards, neuester.version + 1);
    return { cards: z.cards, version: neuester.version + 1 };
  });
  // v85-B: Steckbriefe (menschenlesbarer Stand je Projektordner) im Hintergrund nachziehen — die
  // Antwort wartet nicht darauf. Im Ruhezustand 3 md5sum-Aufrufe, geschrieben wird nur Abweichendes.
  // v98: 30 s spaeter — die Steckbriefe (13 + 5 s md5sum, gemessen) sollen keine Board-Anfrage aufhalten.
  new Promise((r) => setTimeout(r, 30000))
    .then(() => projekte.steckbriefeAbgleichen(cards, ordnerDa))
    .then((r) => { if (r.geschrieben) console.log(`Steckbriefe: ${r.geschrieben} von ${r.geprueft} geschrieben.`); })
    .catch((e) => console.log(`Steckbrief-Abgleich fehlgeschlagen: ${e.message}`));
  return { cards, befunde: [...spaltenBefunde, ...befunde], geaendert, version, spalten };
}

// --- Redaktionsplan: Drive ist Wahrheit, data/plan.json nur Cache (v17d) -----
//
// Nur die Stellschrauben sind Config. Der Sanitizer schuetzt die Drive-Config davor, dass ein
// Client versehentlich Anzeige-Felder (planAbgleich, quelle) zurueckschreibt und den
// Fingerabdruck verfaelscht.
const PLAN_ERLAUBT = ["kadenz", "typenmix", "kategorienFokus", "kategorienAnteil", "zielgewichte", "kampagnen", "slots", "plattformen", "maxAbstandTage", "kampagnenVorlage"];
function nurPlanConfig(o) {
  const c = {};
  for (const k of PLAN_ERLAUBT) if (o && o[k] !== undefined) c[k] = o[k];
  return c;
}
// v78 Phase B: boardparameter (Einstellungs-Tab, Drive) ist die alleinige Wahrheit fuer Kategorien/Ziele.
// Einmal geladen und in die Live-Listen von pipeline.js gesetzt — Scheduler, ai.js, kpi-tabellen.js und
// planstore lesen von dort. Fehlschlag -> Konstanten bleiben, naechster Aufruf versucht es wieder.
let boardparamLauf = null;
function boardparamSicher() {
  if (!boardparamLauf)
    boardparamLauf = (async () => {
      const plan = (await planCacheLesen()) || pipeline.defaultPlan();
      pipeline.setzeBoardparameter(await boardparam.seedFallsLeer(plan));
    })().catch((e) => {
      boardparamLauf = null;
      console.warn(`boardparameter: nicht geladen, Konstanten bleiben (${e.message})`);
    });
  return boardparamLauf;
}

async function planCacheLesen() {
  try { return JSON.parse(await readFile(PLAN_FILE, "utf8")); } catch { return null; }
}
async function planCacheSchreiben(config) {
  try { await mkdir(DATA_DIR, { recursive: true }); await writeFile(PLAN_FILE, JSON.stringify(config, null, 2), "utf8"); } catch { /* Cache ist Absicherung */ }
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

// v115 (N3): Obergrenze fuer JSON-Bodies. board.json liegt bei ~100 KB; 20 MB lassen viel Luft, verhindern aber,
// dass eine Riesen-Anfrage den Prozess aufblaeht (v114: 600 MB -> 1,3 GB Speicher). Uploads streamen separat.
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const anfrageFehler = (status, satz) => Object.assign(new Error(satz), { status, satz });

async function readBody(req) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n <= MAX_BODY_BYTES) chunks.push(c); // darueber: weiter lesen (sauberes 413), aber nichts mehr halten
  }
  if (n > MAX_BODY_BYTES) throw anfrageFehler(413, `Die Anfrage ist zu gross (${Math.round(n / 1048576)} MB, erlaubt sind 20 MB).`);
  return Buffer.concat(chunks).toString("utf8");
}

// v115 (v114 M4/N1): EIN Weg fuer JSON-Bodies. Kaputtes JSON, kein Objekt oder (ohne `optional`) ein leerer
// Body enden mit 400 und einem Satz — vorher 500 mit „Unexpected end of JSON input" oder, schlimmer, 200 mit
// einem geloeschten Redaktionsplan (`PUT /api/plan` mit `null`).
async function leseJson(req, { optional = false } = {}) {
  const text = await readBody(req);
  if (!text.trim()) {
    if (optional) return {};
    throw anfrageFehler(400, "Die Anfrage hatte keinen Inhalt.");
  }
  let daten;
  try { daten = JSON.parse(text); } catch { throw anfrageFehler(400, "Die Anfrage war kein gueltiges JSON."); }
  if (!daten || typeof daten !== "object" || Array.isArray(daten)) throw anfrageFehler(400, "Die Anfrage muss ein Objekt mit Feldern sein.");
  return daten;
}

// v115 (v114 M3): Schreibende Anfragen nur aus der eigenen Oberflaeche oder von lokalen Skripten (ohne Origin).
// Eine fremde Webseite im selben Browser schickt immer `Origin` bzw. `Sec-Fetch-Site: cross-site` mit — sie konnte
// bis v114 per einfachem POST (text/plain, ohne CORS-Vorabfrage) Karten loeschen oder den Server beenden.
const ROH_BODY_PFADE = new Set(["/api/projekt/upload"]); // Datei-Upload: Body ist die Datei selbst
function herkunftOk(req) {
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.origin;
  if (origin && origin !== `https://localhost:${PORT}` && origin !== `https://127.0.0.1:${PORT}`) return false;
  return true;
}
// v115 (v114 M6): Endet die Verbindung, bevor die Antwort fertig ist (Neuladen, Tab zu), feuert das Signal —
// laufePipeline bricht dann den laufenden KI-Schritt ab und startet keinen weiteren.
function kiAbbruchBeiVerbindungsende(res) {
  const ctrl = new AbortController();
  res.on("close", () => { if (!res.writableFinished) ctrl.abort(); });
  return ctrl;
}

// v115: Fehler-Antwort eines Handlers mit eigenem try/catch. Ein Anfrage-Fehler (4xx, z. B. kaputtes JSON aus leseJson)
// behaelt seinen Status — bis v114 wurde er pauschal zu 502; sonst der Standard-Status mit deutschem Satz (v114 N1).
function fehlerAntwort(res, e, standard = 500) {
  const status = e && e.status >= 400 && e.status < 500 ? e.status : standard;
  const satz = status < 500 ? (e.satz || e.message) : verstaendlicherFehler(e && e.message);
  sendJson(res, status, { error: satz, satz });
}

// v115: Karten-Endpunkte brauchen eine Karte mit id — ohne sie legte `/api/drive/create` bis v114 einen Ordner
// „Ohne Titel" an und `/api/karte/loeschen` schob ihn in den Papierkorb.
function karteAusBody(k) {
  if (!k || typeof k !== "object" || Array.isArray(k) || typeof k.id !== "string" || !k.id.trim())
    throw anfrageFehler(400, "Die Anfrage braucht eine Karte (mit id).");
  return k;
}
function jsonTypOk(req, pfad) {
  if (ROH_BODY_PFADE.has(pfad)) return true;
  const hatBody = Number(req.headers["content-length"] || 0) > 0 || !!req.headers["transfer-encoding"];
  return !hatBody || /^application\/json\b/i.test(req.headers["content-type"] || "");
}

const umleitung = (res, ziel) => {
  res.writeHead(302, { location: ziel });
  res.end();
};

// v113 (N11): OAuth-`state` gegen untergeschobene Rueckrufe (CSRF). Je Anmelde-Start ein Zufallswert,
// 10 Minuten gueltig, genau einmal einloesbar; der Rueckruf prueft ihn, bevor er einen Code eintauscht.
const OAUTH_STATE_MS = 10 * 60 * 1000;
const oauthStates = new Map(); // state -> { anbieter, zeit }
function neuerOauthState(anbieter) {
  const jetzt = Date.now();
  for (const [s, v] of oauthStates) if (jetzt - v.zeit > OAUTH_STATE_MS) oauthStates.delete(s);
  const s = `${anbieter}_${randomBytes(16).toString("hex")}`;
  oauthStates.set(s, { anbieter, zeit: jetzt });
  return s;
}
function oauthStateOk(anbieter, s) {
  const v = s ? oauthStates.get(s) : null;
  if (s) oauthStates.delete(s);
  return !!v && v.anbieter === anbieter && Date.now() - v.zeit <= OAUTH_STATE_MS;
}
const OAUTH_STATE_FEHLER = "/?fehler=" + encodeURIComponent("Sicherheitsprüfung der Anmeldung fehlgeschlagen — bitte erneut verbinden.");
// v113 (M8): Fehlen die App-Daten, zurueck ins Board mit einem Satz statt einer rohen JSON-Fehlerseite.
const appFehlt = (res, name, tab) =>
  umleitung(res, "/?fehler=" + encodeURIComponent(`Für ${name} fehlen noch App-ID und Secret — erst unter Einstellungen → ${tab} eintragen.`));

// v34: leseKontext() ist entfallen. Die Drive-Ordner Kontext/_global und Kontext/<reihe>
// laufen jetzt als eingebaute Quellen ueber lib/kontextstore.js — damit steht an EINER Stelle,
// was in den Prompt geht, und der Tab zeigt es auch an.

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

    // v115 (v114 M3): schreibende Anfragen nur aus der eigenen Oberflaeche bzw. von lokalen Skripten.
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (!herkunftOk(req)) {
        sendJson(res, 403, { error: "Fremde Herkunft.", satz: "Diese Anfrage kam nicht aus dem Board selbst und wurde abgelehnt." });
        return;
      }
      if (!jsonTypOk(req, pfad)) {
        sendJson(res, 415, { error: "Falscher Inhaltstyp.", satz: "Das Board nimmt hier nur JSON an (content-type: application/json)." });
        return;
      }
    }

    // ---- Board ----------------------------------------------------------

    if (pfad === "/api/board" && req.method === "GET") {
      const board = await leseBoard();
      // v87: Die Spalten stehen fest (PHASEN) — nicht mehr aus Drive/Cache.
      const spalten = pipeline.spaltenDefault();
      // v81: Wann der Cache zuletzt geschrieben wurde — die Oberflaeche zeigt bis zum
      // Drive-Abgleich „Cache-Stand von <Zeit>" statt so zu tun, als sei das der Live-Stand.
      let cacheStand = null;
      try { cacheStand = (await stat(BOARD_FILE)).mtime.toISOString(); } catch {}
      // v113 (N15): ob ein Board-Ordner gewaehlt ist — ohne Ordner legt der Browser keinen Auto-Drehtermin an.
      sendJson(res, 200, { ...board, spalten, phasen: spalten, cacheStand, ordnerGewaehlt: !!drive.aktuellerRoot() });
      return;
    }

    if (pfad === "/api/board" && req.method === "PUT") {
      const { cards, version, drehtermine } = await leseJson(req);
      if (!Array.isArray(cards)) {
        sendJson(res, 400, { error: "Das Board braucht eine Liste von Karten." });
        return;
      }
      const neueKarten = cards.map(pipeline.migriere);
      // v115 (v114 M1): Versionspruefung und Schreiben in EINEM Schritt der Board-Reihe.
      const schritt = await boardReihe(async () => {
        const aktuell = await leseBoard();
        if (version != null && version !== aktuell.version) return { konflikt: true, aktuell };
        // board.json ist der schnelle CACHE (v17). Zuerst schreiben, damit der Speichern-Weg nie
        // an Drive haengt.
        // drehtermine mitschreiben; fehlen sie im Body, bleiben die gespeicherten erhalten.
        await schreibeBoardRoh(neueKarten, aktuell.version + 1, Array.isArray(drehtermine) ? drehtermine : undefined);
        return { aktuell, neueVersion: aktuell.version + 1 };
      });
      const { aktuell, neueVersion } = schritt;
      if (schritt.konflikt) {
        // Jemand anderes war schneller. Nicht ueberschreiben, sondern melden.
        sendJson(res, 409, {
          error: "Der Board-Stand hat sich zwischenzeitlich geaendert.",
          satz: "Ein anderes Fenster hat gespeichert. Lade den Stand neu, damit nichts verloren geht.",
          aktuell,
        });
        return;
      }
      // v32 C1: SOFORT antworten, sobald board.json (der schnelle Cache, die Wahrheit) steht.
      // Frueher wartete die Antwort auf ALLE Drive-Spiegelungen (je ein rclone-Aufruf pro
      // geaenderter Karte) — bei mehreren Karten sekundenlang. Die Spiegelung laeuft jetzt NACH
      // der Antwort im Hintergrund; ein Fehler kippt den Save nicht und der naechste Abgleich
      // heilt. (Das Frontend hat driveWarnungen nie ausgewertet — geprueft.)
      sendJson(res, 200, { ok: true, version: neueVersion });

      // Hintergrund-Spiegelung: nur tatsaechlich geaenderte Karten mit vorhandenem Drive-Ordner
      // (Diff gegen den alten Cache), damit ein Save nicht 17 Drive-Schreibvorgaenge ausloest.
      const altPerId = new Map(aktuell.cards.map((c) => [c.id, c]));
      const spiegelung = (async () => {
        for (const k of neueKarten) {
          if (!k.driveName) continue; // noch kein Ordner -> nichts zu spiegeln
          const alt = altPerId.get(k.id);
          if (alt && JSON.stringify(alt) === JSON.stringify(k)) continue; // unveraendert
          // v113 (B1): Spaltenwechsel NICHT spiegeln. Die Spiegelung schrieb an den NEUEN Pfad und legte damit
          // den Zielordner an, bevor /api/drive/move den Projektordner verschob — rclone verschob dann Datei fuer
          // Datei und liess die alte Huelle stehen; der naechste Wechsel griff die Huelle (v112 B1). Das
          // Verschieben schreibt projekt.json und Steckbrief am Ziel selbst (projects.verschiebe).
          if (alt && alt.column !== k.column) continue;
          try {
            await projekte.spiegeleKarte(k);
          } catch (e) {
            console.log(`Drive-Spiegelung fehlgeschlagen (${k.title}): ${e.message}`);
          }
        }
      })();
      // Fuer den Flush beim Beenden merken (C3).
      spiegelungenInFlight.add(spiegelung);
      spiegelung.finally(() => spiegelungenInFlight.delete(spiegelung));
      return;
    }

    // ---- Benutzer-Defaults ------------------------------------------------

    if (pfad === "/api/defaults" && req.method === "GET") {
      // v60: Wahrheit liegt in Drive; der Store faellt bei Drive-Stoerung still auf den lokalen
      // Cache zurueck (nie blockieren).
      sendJson(res, 200, await defaultsStore.lies());
      return;
    }

    if (pfad === "/api/defaults" && req.method === "PUT") {
      const daten = await leseJson(req);
      // v60: zuerst lokal (Cache), dann Drive spiegeln — feldweise verschmolzen.
      const neu = await defaultsStore.mische(daten);
      sendJson(res, 200, { ok: true, defaults: neu });
      return;
    }

    // ---- Redaktionsplan --------------------------------------------------

    if (pfad === "/api/plan" && req.method === "GET") {
      // Wahrheit ist die Config in Drive. Fehlt sie, aus Cache/Default seeden. Danach das
      // deterministische Ergebnis gegen Drive abgleichen. Drive-Fehler kippen nichts (das Board
      // bleibt bedienbar), aber der Fehler wird ab hier festgehalten statt verschluckt (Owner
      // 10.09.2026: "es soll definitiv eine Fehlermeldung mit Fehlercode kommen").
      let config = null, driveOk = true, quelle = "drive", driveFehler = null;
      const merkeFehler = (e) => {
        driveOk = false;
        driveFehler = { message: e?.message || String(e), code: e?.code ?? null };
      };
      try { config = await planstore.leseConfigVonDrive(); } catch (e) { merkeFehler(e); }
      if (config) {
        await planCacheSchreiben(config);
      } else {
        config = (await planCacheLesen()) || pipeline.defaultPlan();
        quelle = driveOk ? "cache->drive" : "cache";
        if (driveOk) { try { await planstore.schreibeConfigNachDrive(config); } catch (e) { merkeFehler(e); } }
        await planCacheSchreiben(config);
      }
      // v107: die zwei Start-Kampagnen einmalig anlegen — hier, damit jeder Plan-Leser sie sieht
      // (sonst koennte ein offener Redaktionsplan-Dialog sie mit einem alten Stand wieder loeschen).
      if (driveOk && !config.kampagnenVorlage) {
        try {
          if (await kampagnen.legeVorlagenAn(config, drive)) {
            await planstore.schreibeConfigNachDrive(config);
            await planCacheSchreiben(config);
          }
        } catch { /* naechster Aufruf versucht es wieder; /api/kampagnen/anstehend nennt den Grund */ }
      }
      let planAbgleich = { neuGerechnet: false, hinweis: "" };
      await boardparamSicher(); // v78: Scheduler-Kategorien aus boardparameter
      if (driveOk) {
        try {
          const a = await planstore.abgleiche(config);
          planAbgleich = { neuGerechnet: a.neuGerechnet, hinweis: a.hinweis };
        } catch (e) { merkeFehler(e); }
      }
      if (!driveOk) {
        quelle = "cache";
        planAbgleich.hinweis = `Drive war nicht erreichbar — Redaktionsplan aus dem lokalen Cache. (${driveFehler.code ?? "?"}: ${driveFehler.message})`;
        planAbgleich.fehler = driveFehler;
      }
      // v96: Einrichtung — ein Plan, der vom Standard abweicht, ist eine eigene Eingabe (Schritt erledigt).
      const vergleich = (p) => JSON.stringify({ t: p.typenmix, pl: p.plattformen, k: p.kadenz, m: p.maxAbstandTage || 0 });
      const istStandard = vergleich(config) === vergleich(pipeline.defaultPlan());
      sendJson(res, 200, { ...config, planAbgleich, quelle, istStandard });
      return;
    }

    if (pfad === "/api/plan" && req.method === "PUT") {
      const roh = await leseJson(req);
      // v115 (v114 M4): der Redaktionsplan wird immer vollstaendig gespeichert — ohne Content-Mix ist es kein Plan.
      // Bis v114 ueberschrieb `null` oder `{}` die Wahrheit in Drive mit einem leeren Plan.
      if (!Array.isArray(roh.typenmix)) {
        sendJson(res, 400, { error: "Content-Mix fehlt.", satz: "Der Redaktionsplan braucht den Content-Mix (Formate je Woche) — nichts gespeichert." });
        return;
      }
      // v115 (v114 M5, Owner 07.10.2026: „Speichern sperren"): ein max. Abstand, den die Frequenz nicht schaffen kann.
      const abstand = scheduler.abstandPruefung(roh);
      if (!abstand.ok) {
        sendJson(res, 400, { error: abstand.satz, satz: abstand.satz, mindestTage: abstand.mindestTage });
        return;
      }
      // v107: Kampagnen behalten ihre Tabelle (der Browser schickt sie evtl. nicht mit).
      const config = kampagnen.ordneTabellenZu(nurPlanConfig(roh), await planCacheLesen());
      await planCacheSchreiben(config); // Cache zuerst — der Speichern-Weg haengt nie an Drive
      defaultsStore.mische({ planBestaetigt: true }).catch(() => {}); // v96: Speichern = bestaetigt (Einrichtung)
      let planAbgleich = { neuGerechnet: false, hinweis: "" };
      await boardparamSicher();
      try {
        await planstore.schreibeConfigNachDrive(config);
        const a = await planstore.abgleiche(config);
        planAbgleich = { neuGerechnet: a.neuGerechnet, hinweis: a.hinweis };
        await kampagnen.sichereTabellen(config, drive); // v107: neue Kampagne -> leere Tabelle in Drive
      } catch (e) {
        planAbgleich.hinweis = `Drive-Schreiben fehlgeschlagen: ${e.message} — lokal gesichert, naechster Aufruf gleicht ab.`;
      }
      sendJson(res, 200, { ok: true, planAbgleich, kampagnen: config.kampagnen || [] });
      return;
    }

    // v113 (N6): PUT /api/plan/slot entfernt — suchte Slots in der Plan-Config (seit v52 leer, immer 404) und
    // hatte keinen Aufrufer mehr. Belegt ist ein Slot, sobald eine Karte sein Datum als Upload traegt.

    // v107: Anlaesse aktiver Kampagnen in den naechsten 60 Tagen (Knoepfe in der ersten Spalte).
    // Legt beim ersten Aufruf die zwei Start-Kampagnen an — aber nur, wenn die Plan-Config wirklich
    // aus Drive kam (sonst wuerde ein alter Cache den Drive-Stand ueberschreiben).
    if (pfad === "/api/kampagnen/anstehend" && req.method === "GET") {
      const befunde = [];
      let config = null, ausDrive = true;
      try { config = await planstore.leseConfigVonDrive(); } catch (e) { ausDrive = false; befunde.push(`Plan aus Drive nicht lesbar: ${e.message}`); }
      if (!config) config = (await planCacheLesen()) || pipeline.defaultPlan();
      if (ausDrive && !config.kampagnenVorlage) {
        try {
          if (await kampagnen.legeVorlagenAn(config, drive)) {
            await planstore.schreibeConfigNachDrive(config);
            await planCacheSchreiben(config);
          }
        } catch (e) { befunde.push(`Start-Kampagnen nicht angelegt: ${e.message}`); }
      }
      const tabellen = await kampagnen.leseTabellen(config, drive);
      const r = kampagnen.anstehende({ kampagnen: config.kampagnen || [], tabellen, heute: pipeline.isoDatum(new Date()) });
      sendJson(res, 200, { anstehend: r.anstehend, befunde: [...befunde, ...r.befunde], kampagnen: config.kampagnen || [] });
      return;
    }

    // ---- KI --------------------------------------------------------------

    if (pfad === "/api/ai" && req.method === "POST") {
      const body = await leseJson(req);
      const { task, card } = body;
      if (typeof task !== "string" || !Object.hasOwn(ki.PROMPTS, task)) { // v115 (N2)
        sendJson(res, 400, { error: `Unbekannte KI-Aufgabe: ${task}` });
        return;
      }
      const abbruch = kiAbbruchBeiVerbindungsende(res); // v115 (M6)
      try {
        // v41: Die Aufgabe laeuft als Schritt-Pipeline (jeder Schritt auf dem Modell seiner Rolle).
        const text = await laufePipeline({ task, card, rollenModelle: rollenAusBody(body), signal: abbruch.signal });
        const data = ki.JSON_AUFGABEN.has(task) ? ki.parseJson(text) : null;
        sendJson(res, 200, { text, data });
      } catch (e) {
        sendJson(res, 502, { error: e.message, hint: ki.hinweisZuFehler(e, e.provider) });
      }
      return;
    }

    // Gleiche Aufgabe, aber live: NDJSON-Zeilen {t:"delta"|"status"|"stufe"|"done"|"error"}.
    // `status` ist der deutsche Satz je Schritt, `stufe` (v51) dasselbe maschinenlesbar:
    // {stufe:"ollama-start"|"modell-laedt"|"generiert"|"web-suche"|"web-treffer"|"fertig",
    //  schritt, von, rolle, rolleName, modell, sekunden?, treffer?}. Aeltere Clients
    // verschlucken unbekannte Typen still (store.js), der Zusatz ist also rueckwaertskompatibel.
    if (pfad === "/api/ai/stream" && req.method === "POST") {
      const body = await leseJson(req);
      const { task, card } = body;
      if (typeof task !== "string" || !Object.hasOwn(ki.PROMPTS, task)) { // v115 (N2)
        sendJson(res, 400, { error: `Unbekannte KI-Aufgabe: ${task}` });
        return;
      }
      res.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
      });
      // Der Sekunden-Ticker der Ladephase schreibt auch dann noch, wenn der Browser die
      // Verbindung schon gekappt hat — deshalb vor jedem Schreiben pruefen.
      const schreib = (o) => {
        if (res.writableEnded || res.destroyed) return;
        res.write(JSON.stringify(o) + "\n");
      };
      const abbruch = kiAbbruchBeiVerbindungsende(res); // v115 (M6): Neuladen/Schliessen beendet den KI-Lauf
      try {
        const text = await laufePipeline({
          task,
          card,
          rollenModelle: rollenAusBody(body),
          signal: abbruch.signal,
          onStatus: (t) => schreib({ t: "status", text: t }),
          onDelta: (d) => schreib({ t: "delta", text: d }),
          onStufe: (o) => schreib({ t: "stufe", ...o }),
        });
        const data = ki.JSON_AUFGABEN.has(task) ? ki.parseJson(text) : null;
        schreib({ t: "done", text, data });
      } catch (e) {
        schreib({ t: "stufe", stufe: "fehler" });
        schreib({ t: "error", error: e.message, hint: ki.hinweisZuFehler(e, e.provider) });
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
      const body = await leseJson(req);
      try {
        let stand;
        switch (body.was) {
          case "firma-text":
            stand = await unternehmen.setzeFirmaText(body.text);
            break;
          case "stil": // v110: Stil & KI-Verhalten (global)
            stand = await unternehmen.setzeStil(body.stil);
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
          case "eingebaut-schalten":
            stand = await unternehmen.setzeEingebaut(body.welche, body.an);
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
        fehlerAntwort(res, e, 400);
      }
      return;
    }

    // Zeigt, was aus dem hinterlegten Kontext tatsaechlich in den Prompt geht — damit die
    // Wirkung nachpruefbar ist und nicht geglaubt werden muss.
    if (pfad === "/api/kontext/probe" && req.method === "GET") {
      sendJson(res, 200, await unternehmen.sammle({ projektId: url.searchParams.get("projekt") || null, serie: url.searchParams.get("serie") || "" }));
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
      const { id, text, schritte, format } = await leseJson(req);
      // System = Text; Aufgabe = Schritt-Liste (v41). Faellt schritte weg, gilt text (alt/Migration).
      const wert = id === "system" ? text : schritte !== undefined ? schritte : text;
      try {
        // v79: `format` (optional) speichert die format-spezifische Fassung unter perFormat.
        await prompts.setze(id, wert, format);
        sendJson(res, 200, await prompts.uebersicht());
      } catch (e) {
        fehlerAntwort(res, e, 400);
      }
      return;
    }

    // ---- Workflows (v26) -------------------------------------------------
    // Alle Automationen des Boards: einsehbar, abschaltbar, mit Parametern.

    if (pfad === "/api/workflows" && req.method === "GET") {
      // Die eingebauten Automationen (unveraendert seit v26). Der Browser liest daraus den
      // an/aus-Stand fuer `an(id)` — den selbstgebauten Builder gibt es seit v41 nicht mehr.
      sendJson(res, 200, { workflows: await workflows.uebersicht() });
      return;
    }

    if (pfad === "/api/workflows" && req.method === "PUT") {
      const { id, an, params } = await leseJson(req);
      try {
        sendJson(res, 200, { workflows: await workflows.setze(id, { an, params }) });
      } catch (e) {
        fehlerAntwort(res, e, 400);
      }
      return;
    }

    if (pfad === "/api/boardparameter" && req.method === "GET") {
      // v78: editierbare Inhaltskategorien + Ziele. Wahrheit in Drive; fehlt die Datei, wird aus den
      // pipeline.js-Konstanten geseedet und dabei plan.kategorienFokus (aktiv/prioritaet) verlustfrei
      // uebernommen (Plan aus dem lokalen Cache — kein zusaetzlicher Drive-Read auf dem Lesepfad).
      const plan = (await planCacheLesen()) || pipeline.defaultPlan();
      const stand = await boardparam.seedFallsLeer(plan);
      pipeline.setzeBoardparameter(stand);
      sendJson(res, 200, stand);
      return;
    }

    if (pfad === "/api/boardparameter" && req.method === "PUT") {
      const body = await leseJson(req);
      // v115 (v114 M4): `null`/`{}` leerte bis v114 Kategorien und Ziele in Drive.
      if (!Array.isArray(body.kategorien) || !Array.isArray(body.ziele)) {
        sendJson(res, 400, { error: "Kategorien und Ziele fehlen.", satz: "Die Board-Parameter brauchen eine Liste von Kategorien und eine Liste von Zielen." });
        return;
      }
      try {
        const stand = await boardparam.schreib(body);
        pipeline.setzeBoardparameter(stand); // v78: ab sofort fuer Scheduler/KI/KPI gueltig
        sendJson(res, 200, stand);
      } catch (e) {
        fehlerAntwort(res, e, 400);
      }
      return;
    }

    if (pfad === "/api/ai/ping-ollama" && req.method === "POST") {
      const { model = "qwen2.5" } = await leseJson(req);
      sendJson(res, 200, await ki.pingOllama(await ki.loeseOllamaModell(model)));
      return;
    }

    // v91 Einrichtung: laeuft Ollama, welche Modelle liegen da?
    if (pfad === "/api/ai/ollama" && req.method === "GET") {
      try {
        const r = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
        const d = await r.json();
        sendJson(res, 200, {
          laeuft: true,
          modelle: (d.models || []).map((m) => ({ name: m.name, gb: Math.round((m.size || 0) / 1e8) / 10 })),
        });
      } catch {
        sendJson(res, 200, { laeuft: false, modelle: [] });
      }
      return;
    }
    // v91 Einrichtung: Modell laden (ollama pull) — Fortschritt zeilenweise als NDJSON durchreichen.
    if (pfad === "/api/ai/ollama/pull" && req.method === "POST") {
      const { model } = await leseJson(req);
      if (!/^[a-z0-9._-]+(:[a-z0-9._-]+)?$/i.test(model || "")) { sendJson(res, 400, { error: "Ungueltiger Modellname." }); return; }
      try {
        const r = await fetch("http://localhost:11434/api/pull", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: true }),
        });
        if (!r.ok || !r.body) { sendJson(res, 502, { error: `Ollama ${r.status}` }); return; }
        res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache" });
        for await (const teil of r.body) res.write(teil);
        res.end();
      } catch (e) {
        if (!res.headersSent) sendJson(res, 502, { error: `Ollama nicht erreichbar: ${e.message}` });
        else res.end();
      }
      return;
    }

    if (pfad === "/api/shutdown" && req.method === "POST") {
      sendJson(res, 200, { ok: true });
      setTimeout(async () => {
        console.log("Shutdown via UI ausgeloest.");
        // v32 C3 (Flush): offene Drive-Spiegelungen zu Ende bringen, damit der letzte Stand
        // sicher in Drive steht. Mit Zeitgrenze, damit ein haengender rclone das Beenden nicht
        // ewig blockiert.
        if (spiegelungenInFlight.size) {
          console.log(`Warte auf ${spiegelungenInFlight.size} offene Drive-Spiegelung(en) …`);
          await Promise.race([
            Promise.allSettled([...spiegelungenInFlight]),
            new Promise((r) => setTimeout(r, 8000)),
          ]);
        }
        await ollamaEntladen();
        process.exit(0);
      }, 400);
      return;
    }

    // ---- Drive -----------------------------------------------------------

    // ---- Drive einrichten (v63) ------------------------------------------

    // Ist der Ordner (Link oder ID) brauchbar? Aendert nichts.
    if (pfad === "/api/drive/ordner/pruefen" && req.method === "POST") {
      const { eingabe } = await leseJson(req);
      const id = driveSetup.parseOrdnerId(eingabe);
      if (!id) { sendJson(res, 400, { error: "Das ist weder ein Drive-Ordner-Link noch eine Ordner-ID.", satz: "Das ist weder ein Drive-Ordner-Link noch eine Ordner-ID." }); return; }
      try {
        const p = await driveSetup.pruefeOrdner(id);
        // v87: „falsch" = Board-Ordner mit unvollstaendiger/falscher Struktur -> abgelehnt, mit Grund.
        // v103: geteilte Ablage + eigene Rechte gehen als eigener Satz mit (ablage = null: Meine Ablage).
        const ablageSatz = driveSetup.ablageSatz(p.ablage);
        sendJson(res, 200, { id, art: p.art, ok: p.art === "leer" || p.art === "board", satz: [driveSetup.pruefSatz(p), ablageSatz].filter(Boolean).join(" "), fehler: p.fehler, ablage: p.ablage || null });
      } catch (e) {
        sendJson(res, 200, { id, art: "unerreichbar", ok: false, satz: e.message });
      }
      return;
    }

    // Arbeitsordner wechseln: Board sichern, Caches leeren, ggf. Struktur anlegen.
    if (pfad === "/api/drive/ordner/setzen" && req.method === "POST") {
      const { eingabe } = await leseJson(req);
      const id = driveSetup.parseOrdnerId(eingabe);
      if (!id) { sendJson(res, 400, { error: "Ungueltiger Ordner.", satz: "Ungueltiger Ordner." }); return; }
      try {
        sendJson(res, 200, { ok: true, id, ...(await wechsleDriveOrdner(id)) });
      } catch (e) {
        sendJson(res, e.status || 502, { error: e.message, satz: e.message });
      }
      return;
    }

    // Konto wechseln: startet die Browser-Anmeldung; der Stand wird per GET abgefragt.
    if (pfad === "/api/drive/konto/wechseln" && req.method === "POST") {
      // v93: mit {clientId, clientSecret} wird die Verbindung erst angelegt (Einrichtung, frischer Rechner).
      let neu = null;
      try {
        const b = await leseJson(req, { optional: true });
        if (b.clientId && b.clientSecret) {
          // v103: Backslashes ergaenzt — seit v93 lehnte die Pruefung jede echte Client-ID ab ([w.-] statt [\w.-]).
          if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(b.clientId) || !/^[\w-]{10,}$/.test(b.clientSecret)) {
            sendJson(res, 400, { error: "Client-ID oder Client-Secret sieht nicht gueltig aus." });
            return;
          }
          neu = { clientId: b.clientId, clientSecret: b.clientSecret };
        }
      } catch { /* ohne Body: bestehende Verbindung erneuern */ }
      starteDriveKontoWechsel(neu);
      sendJson(res, 200, { laeuft: kontoWechsel.laeuft, satz: kontoWechsel.satz });
      return;
    }
    // v93 Einrichtung Schritt 1: ist rclone da, gibt es die Verbindung, ist Drive erreichbar?
    if (pfad === "/api/drive/einrichtung" && req.method === "GET") {
      const rcloneDa = await new Promise((ok) => {
        const k = spawn("rclone", ["version"], { shell: false });
        k.on("error", () => ok(false));
        k.on("close", (c) => ok(c === 0));
      });
      const verbindung = rcloneDa && !!drive.zugang();
      const erreichbar = verbindung ? await drive.erreichbar().then((r) => !!(r && r.ok)).catch(() => false) : false;
      sendJson(res, 200, { rclone: rcloneDa, verbindung, erreichbar, root: drive.aktuellerRoot() || "" });
      return;
    }
    if (pfad === "/api/drive/konto/wechseln" && req.method === "GET") {
      sendJson(res, 200, { ...kontoWechsel });
      return;
    }

    // v72: Link auf einen Drive-Ordner (Drive-Marke mit Ortsangabe in den Einstellungen und im
    // Detailkopf). `pfad` relativ zum Arbeitsordner; leer = der Arbeitsordner selbst. IDs kommen
    // aus der Eltern-Auflistung (ein rclone-Aufruf) und werden je Arbeitsordner gemerkt.
    if (pfad === "/api/drive/ordner-link" && req.method === "GET") {
      const rel = (url.searchParams.get("pfad") || "").replace(/^\/+|\/+$/g, "");
      const id = await ordnerLinkId(rel);
      if (!id) { sendJson(res, 404, { error: `Der Ordner „${rel}“ existiert in Drive noch nicht.` }); return; }
      sendJson(res, 200, { url: drive.ordnerLink(id) });
      return;
    }

    if (pfad === "/api/drive/status" && req.method === "GET") {
      sendJson(res, 200, await drive.erreichbar());
      return;
    }

    if (pfad === "/api/drive/create" && req.method === "POST") {
      const card = karteAusBody(await leseJson(req));
      sendJson(res, 200, await projekte.anlegen(card));
      return;
    }

    // v46: Karte loeschen — Drive-Ordner in den Papierkorb, damit der Abgleich die Karte nicht
    // aus dem zurueckgelassenen Ordner wieder aufbaut. Der Client nimmt die Karte NUR bei Erfolg
    // aus dem Board.
    if (pfad === "/api/karte/loeschen" && req.method === "POST") {
      const card = karteAusBody(await leseJson(req));
      sendJson(res, 200, await projekte.loesche(card));
      return;
    }

    if (pfad === "/api/drive/move" && req.method === "POST") {
      const roh = await leseJson(req);
      const card = karteAusBody(roh.card);
      const ziel = roh.ziel;
      if (!pipeline.PHASE_IDS.includes(ziel)) throw anfrageFehler(400, "Unbekannte Zielphase.");
      sendJson(res, 200, await projekte.verschiebe(card, ziel));
      return;
    }

    if (pfad === "/api/drive/scan" && req.method === "POST") {
      const card = karteAusBody(await leseJson(req));
      // v32 C2: `frisch=1` umgeht den Scan-Cache (Client erzwingt eine frische Messung nach
      // eigenen Aenderungen); sonst darf der kurzlebige Cache in projects.js antworten.
      const frisch = url.searchParams.get("frisch") === "1";
      sendJson(res, 200, await projekte.scan(card, frisch));
      return;
    }

    if (pfad === "/api/drive/save" && req.method === "POST") {
      const roh = await leseJson(req);
      const card = karteAusBody(roh.card);
      const { filename, content } = roh;
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
      sendJson(res, 200, { ok: true, pfad: ziel.pfad, name: ziel.name }); // v113: name = driveName der Karte
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
      sendJson(res, 200, await fuehreAbgleichAus());
      return;
    }

    // Derselbe Abgleich, aber live (v51 T7): NDJSON mit denselben Zeilen-Typen wie der
    // KI-Stream — {t:"stufe"} waehrend des Laufs, am Ende {t:"done", ...ergebnis}. Der
    // Abgleich braucht 10-70 s (v25 gemessen) und sagte bisher nur, DASS er laeuft.
    if (pfad === "/api/drive/reconcile/stream" && req.method === "POST") {
      res.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
      });
      const schreib = (o) => {
        if (res.writableEnded || res.destroyed) return;
        res.write(JSON.stringify(o) + "\n");
      };
      try {
        const ergebnis = await fuehreAbgleichAus((o) => schreib({ t: "stufe", ...o }));
        schreib({ t: "stufe", stufe: "fertig" });
        schreib({ t: "done", ...ergebnis });
      } catch (e) {
        schreib({ t: "stufe", stufe: "fehler" });
        schreib({ t: "error", error: e.message });
      }
      res.end();
      return;
    }

    if (pfad === "/api/drive/kontext" && req.method === "GET") {
      // v34: laeuft ueber den einen Weg. Kein Frontend ruft das hier, es bleibt der Vollstaendigkeit halber.
      const gesammelt = await unternehmen
        .sammle({ serie: pipeline.slug(url.searchParams.get("serie") || "") })
        .catch(() => ({ firmenkontext: "", projektkontext: "" }));
      const text = (gesammelt.firmenkontext + gesammelt.projektkontext).trim();
      sendJson(res, 200, { text });
      return;
    }

    // ---- OAuth: Instagram (Weg B — Instagram Login, keine Facebook-Seite noetig) ---

    if (pfad === "/api/auth/instagram" && req.method === "GET") {
      const appId = process.env.INSTAGRAM_APP_ID;
      if (!appId) {
        appFehlt(res, "Instagram", "Social Media");
        return;
      }
      const p = new URLSearchParams({
        client_id: appId,
        redirect_uri: `https://localhost:${PORT}/api/auth/instagram/callback`,
        scope: "instagram_business_basic,instagram_business_manage_insights",
        response_type: "code",
        state: neuerOauthState("instagram"),
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
      if (!oauthStateOk("instagram", url.searchParams.get("state"))) {
        umleitung(res, OAUTH_STATE_FEHLER);
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
        appFehlt(res, "Google Kalender + Tasks", "Google");
        return;
      }
      const p = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `https://localhost:${PORT}/api/auth/google/callback`,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks",
        access_type: "offline",
        prompt: "consent", // erzwingt den Refresh-Token auch bei erneutem Verbinden
        state: neuerOauthState("google"),
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
      if (!oauthStateOk("google", url.searchParams.get("state"))) {
        umleitung(res, OAUTH_STATE_FEHLER);
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
        gcal.statusCacheLeeren(); // v45: frisch verbunden — Gueltigkeits-Cache verwerfen
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
        const { eventId, taskId, calId } = await leseJson(req);
        if (eventId) { try { await gcal.eventLoeschen(calId, eventId); } catch { /* schon weg */ } }
        if (taskId) { try { await gcal.taskLoeschen(taskId); } catch { /* schon weg */ } }
        sendJson(res, 200, { ok: true });
      } catch (e) {
        fehlerAntwort(res, e, 502);
      }
      return;
    }

    // ---- Verbindungs-Center (v24): .env-Whitelist schreiben + Status --------

    if (pfad === "/api/config/env" && req.method === "PUT") {
      const ENV_ERLAUBT = new Set([
        "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET",
        "INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET",
        "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET",
        "TAVILY_API_KEY", // v40: optionaler Web-Such-Key der Recherche-Rolle
      ]);
      const { key, value } = await leseJson(req);
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

    // --- Ereignisse: was das Board gerade nach aussen tut (v58) ---------------
    //
    // Zwei Wege, absichtlich getrennt: der Verlauf ist eine normale Abfrage (beim Oeffnen
    // eines Terminals), der Strom ist eine dauerhaft offene Verbindung. Fuer den Strom
    // Server-Sent Events statt des Haus-NDJSON (v51): die beiden NDJSON-Stroeme gehoeren je
    // zu EINEM Vorgang und enden mit ihm, dieser Feed steht dagegen die ganze Sitzung offen —
    // und `EventSource` im Browser bringt das Wiederverbinden von selbst mit.
    if (pfad === "/api/ereignisse" && req.method === "GET") {
      const sektion = url.searchParams.get("sektion") || "";
      const seitId = Number(url.searchParams.get("seit") || 0);
      sendJson(res, 200, { verlauf: ereignisse.verlauf({ sektion, seitId }), aktiv: ereignisse.aktiv() });
      return;
    }

    if (pfad === "/api/ereignisse/stream" && req.method === "GET") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      const schreib = (o) => {
        if (res.writableEnded || res.destroyed) return;
        res.write(`data: ${JSON.stringify(o)}\n\n`);
      };
      // Erst den Stand mitgeben, damit der Browser die Marker sofort richtig zeichnet und
      // nicht bis zum naechsten Ereignis blind ist.
      schreib({ art: "stand", aktiv: ereignisse.aktiv() });
      const ab = ereignisse.abonniere((e) => schreib({ art: "ereignis", ereignis: e, aktiv: ereignisse.aktiv() }));
      // Ohne Lebenszeichen schliessen Zwischenstationen eine stille Verbindung nach ~60 s.
      const puls = setInterval(() => {
        if (res.writableEnded || res.destroyed) return;
        res.write(": puls\n\n");
      }, 25000);
      if (puls.unref) puls.unref();
      const aufraeumen = () => { ab(); clearInterval(puls); };
      req.on("close", aufraeumen);
      req.on("error", aufraeumen);
      return;
    }

    if (pfad === "/api/verbindungen/status" && req.method === "GET") {
      const tokens = await leseTokens();
      const execAsync = promisify(exec);
      // v63: alle Abfragen PARALLEL statt nacheinander — der Status haengt nur noch an der
      // langsamsten (vorher Summe aus Drive-Pruefung + Claude-CLI + Google), damit man nach dem
      // Serverstart schnell den echten Stand sieht.
      const [driveOk, driveKonto, claude, googleStatus, igName, driveName, codex] = await Promise.all([
        drive.erreichbar().then((r) => !!(r && r.ok)).catch(() => false), // Drive gestoert = nicht verbunden
        driveSetup.konto().catch(() => null),
        // v40: echter Login-Status statt nur „CLI installiert" — damit Trennen den Chip umschlagen laesst.
        // v62: dieselbe Antwort traegt die Konto-Mail (email) mit.
        execAsync("claude auth status", { encoding: "utf8", timeout: 15000 })
          .then((r) => { const st = JSON.parse(r.stdout); return { ok: !!st.loggedIn, email: st.email || "" }; })
          .catch(() => ({ ok: false, email: "" })), // CLI fehlt oder nicht eingeloggt
        // v45: echte Gueltigkeit + hinweis, kurz gecacht. v86: Konto, Zustand, Fluss und Anbindung
        // kommen aus statusGoogle() selbst (die Mail stammt aus derselben Pruefung).
        gcal.statusGoogle(),
        instagramName(tokens),
        driveSetup.ordnerName().catch(() => ""), // v86: Name statt ID in der Anzeige
        codexAuth.status(), // v103: ChatGPT (Codex-CLI)
      ]);
      sendJson(res, 200, {
        google: googleStatus,
        drive: {
          verbunden: driveOk, root: drive.aktuellerRoot(), name: driveName, email: driveKonto ? driveKonto.email : "",
          rolle: "Quelle der Wahrheit",
          fluss: "Board ↔ Drive: Karten, Projektordner und alle Einstellungen liegen in diesem Ordner. Das Board liest und schreibt; ohne Board bleibt Drive vollständig nutzbar.",
          anbindung: "rclone (lokal installiert) mit Google-Anmeldung des Drive-Kontos",
        },
        instagram: {
          verbunden: !!(tokens.instagram && tokens.instagram.accessToken),
          clientKonfiguriert: !!process.env.INSTAGRAM_APP_ID,
          konto: igName,
        },
        linkedin: {
          verbunden: !!(tokens.linkedin && tokens.linkedin.accessToken),
          clientKonfiguriert: !!process.env.LINKEDIN_CLIENT_ID,
          konto: (tokens.linkedin && tokens.linkedin.orgName) || "",
        },
        claude: {
          verbunden: claude.ok, email: claude.email,
          hinweis: claude.ok ? "" : "nicht angemeldet",
          rolle: "KI-Rechenleistung",
          fluss: "Board → Claude → Board: Prompt und Karteninhalt gehen an Claude, der Text kommt zurück in die Karte.",
          anbindung: "Claude-CLI auf diesem Rechner, angemeldet mit deinem Claude-Abo (keine API-Kosten)",
        },
        // v103: ChatGPT ueber die Codex-CLI (wahlweise statt oder neben Claude).
        chatgpt: {
          verbunden: codex.loggedIn, installiert: codex.installiert, art: codex.art,
          hinweis: codex.loggedIn ? "" : codex.installiert ? "nicht angemeldet" : "Codex-CLI nicht installiert",
          rolle: "KI-Rechenleistung",
          fluss: "Board → ChatGPT → Board: Prompt und Karteninhalt gehen an OpenAI, der Text kommt zurück in die Karte.",
          anbindung: codex.art === "apikey" ? "Codex-CLI auf diesem Rechner, mit API-Schlüssel (Abrechnung nach Verbrauch)" : "Codex-CLI auf diesem Rechner, angemeldet mit deinem ChatGPT-Konto",
        },
        tavily: { konfiguriert: !!process.env.TAVILY_API_KEY }, // v40: Web-Such-Key gesetzt?
      });
      return;
    }

    // v40: Trennen — den Zugang eines Dienstes loesen. Spiegelt das jeweilige Verbinden.
    if (pfad === "/api/auth/google/trennen" && req.method === "POST") {
      const vorher = await entferneToken("google");
      gcal.statusCacheLeeren(); // v45: getrennt — Chip sofort umschlagen lassen
      // best-effort Revoke beim Anbieter — verhindert nie das lokale Trennen.
      const tok = vorher && (vorher.refresh_token || vorher.access_token);
      if (tok) {
        try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(tok), { method: "POST" }); } catch { /* egal */ }
      }
      sendJson(res, 200, { ok: true });
      return;
    }
    if (pfad === "/api/auth/instagram/trennen" && req.method === "POST") {
      await entferneToken("instagram");
      sendJson(res, 200, { ok: true });
      return;
    }
    if (pfad === "/api/auth/linkedin/trennen" && req.method === "POST") {
      await entferneToken("linkedin");
      sendJson(res, 200, { ok: true });
      return;
    }
    // v101: Einrichtungsstand — das Erste, was die Oberflaeche beim Start liest. Lokal (Anbindungen dieses Rechners)
    // + Board-Ordner (Drive, ueber den md5-Spiegel). Ordner-ID in der lokalen Datei: ein Ordnerwechsel macht sie ungueltig.
    if (pfad === "/api/einrichtung/stand" && req.method === "GET") {
      const root = drive.aktuellerRoot() || null;
      let lokal = null;
      try { lokal = JSON.parse(await readFile(EINRICHTUNG_LOKAL_FILE, "utf8")); } catch { /* noch nie eingerichtet */ }
      if (lokal && lokal.ordner !== root) lokal = { ...lokal, fertig: false, grund: "anderer Ordner" };
      let board = null;
      // v113 (M5): Ist dieser Rechner nicht fertig eingerichtet, steht die Entscheidung schon fest (Assistent) —
      // dann Drive nicht fragen. Bei gestoertem Drive hielt dieses Lesen das Start-Tor bis 39 s gesperrt (v112).
      if (root && lokal && lokal.fertig) {
        try { board = JSON.parse(await drive.readFile(`${pipeline.SYSTEM_ORDNER}/einrichtung.json`, { timeoutMs: 15000 })); }
        catch { /* fehlt oder Drive gestoert -> Assistent entscheidet */ }
      }
      sendJson(res, 200, { ordner: root, lokal, board });
      return;
    }
    if (pfad === "/api/einrichtung/stand" && req.method === "POST") {
      const { lokal, board } = await leseJson(req, { optional: true });
      const jetzt = new Date().toISOString();
      const root = drive.aktuellerRoot() || null;
      const ergebnis = { lokal: false, board: false };
      if (lokal) {
        await writeFile(EINRICHTUNG_LOKAL_FILE, JSON.stringify({ ...lokal, ordner: root, aktualisiert: jetzt }, null, 2), "utf8");
        ergebnis.lokal = true;
      }
      if (board && root) {
        try {
          await drive.writeFile(`${pipeline.SYSTEM_ORDNER}/einrichtung.json`, JSON.stringify({ ...board, aktualisiert: jetzt }, null, 2));
          ergebnis.board = true;
        } catch (e) { ergebnis.fehler = e.message; }
      }
      sendJson(res, 200, ergebnis);
      return;
    }

    // v94: Einrichtung am Ende EINMAL nach Drive schreiben (Owner 01.10.2026: erst Zwischenspeicher, dann
    // ein Durchgang mit sichtbarem Log). Teil fuer Teil; jede Zeile NDJSON {teil, status, text, ms}.
    // Ein Fehler stoppt nicht die uebrigen Teile — der Assistent behaelt den fehlgeschlagenen Teil im Entwurf.
    if (pfad === "/api/einrichtung/speichern" && req.method === "POST") {
      const e = await leseJson(req, { optional: true });
      res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache" });
      const zeile = (o) => res.write(JSON.stringify(o) + "\n");
      const teil = async (id, text, f) => {
        const t0 = Date.now();
        zeile({ teil: id, status: "laeuft", text });
        try {
          await f();
          zeile({ teil: id, status: "ok", text, ms: Date.now() - t0 });
        } catch (err) {
          zeile({ teil: id, status: "fehler", text, fehler: err.message, ms: Date.now() - t0 });
        }
      };
      if (e.name) await teil("name", `Drive-Ordner umbenennen in „${e.name}“`, () => driveSetup.ordnerUmbenennen(e.name));
      if (typeof e.firma === "string") await teil("firma", "Firmenkontext speichern", () => unternehmen.setzeFirmaText(e.firma, { streng: true }));
      if (Array.isArray(e.prompts) && e.prompts.length)
        await teil("prompts", `${e.prompts.length} ${e.prompts.length === 1 ? "Prompt" : "Prompts"} speichern`, () => prompts.setzeMehrere(e.prompts, { streng: true }));
      const einst = {};
      for (const k of ["nameBestaetigt", "kiRollen", "promptsBestaetigt", "planBestaetigt", "einrichtungFertig"]) if (e[k] !== undefined) einst[k] = e[k];
      if (Object.keys(einst).length)
        await teil("einstellungen", "KI-Rollen und Einrichtungs-Stand speichern", () => defaultsStore.mische(einst, { streng: true }));
      zeile({ teil: "ende", status: "fertig" });
      res.end();
      return;
    }

    // v93: Board zuruecksetzen (Owner 01.10.2026: „sauber neue Projekte aufsetzen, Einrichtung pruefen").
    // Loest das Board vom Projektordner und leert die lokalen Zwischenspeicher. Die Daten IM Drive-Ordner
    // bleiben unberuehrt (vorher wird der Board-Stand dort gesichert). `anmeldungen: true` trennt zusaetzlich
    // Google Kalender/Tasks, Instagram, LinkedIn und meldet die Claude-CLI ab; die Drive-Verbindung bleibt.
    if (pfad === "/api/board/zuruecksetzen" && req.method === "POST") {
      try {
        const { anmeldungen = false } = await leseJson(req, { optional: true });
        const alt = drive.aktuellerRoot();
        if (alt) await sichereBoardFuerRoot(alt).catch(() => {});
        drive.setzeRoot(null);
        for (const f of [SPALTEN_FILE, PLAN_FILE, DEFAULTS_FILE, PROMPTS_FILE, WORKFLOWS_FILE, BOARDPARAM_FILE, KONTEXT_FILE, EINRICHTUNG_LOKAL_FILE]) {
          try { await rm(f, { force: true }); } catch { /* egal */ }
        }
        // offene Tabs laufen in den Versions-Lock und laden neu (v115: Lesen + Schreiben in der Board-Reihe)
        await aendereBoard((b) => { b.cards = []; b.drehtermine = []; });
        projekte.scanCacheLeeren();
        driveSetup.kontoCacheLeeren();
        if (anmeldungen) {
          for (const dienst of ["google", "instagram", "linkedin"]) await entferneToken(dienst).catch(() => {});
          gcal.statusCacheLeeren();
          try { execSync("claude auth logout", { stdio: "ignore" }); } catch { /* war nicht angemeldet */ }
        }
        sendJson(res, 200, { ok: true, alterOrdner: alt || null });
      } catch (e) {
        sendJson(res, 500, { error: e.message });
      }
      return;
    }

    // v91: Board-Name = Name des Drive-Hauptordners. PUT benennt den Drive-Ordner um.
    if (pfad === "/api/board/name" && req.method === "GET") {
      try {
        sendJson(res, 200, { name: await driveSetup.ordnerName(), root: drive.aktuellerRoot() });
      } catch (e) {
        sendJson(res, 200, { name: "", root: drive.aktuellerRoot(), fehler: e.message });
      }
      return;
    }
    if (pfad === "/api/board/name" && req.method === "PUT") {
      try {
        const { name } = await leseJson(req);
        sendJson(res, 200, { name: await driveSetup.ordnerUmbenennen(name) });
      } catch (e) {
        fehlerAntwort(res, e, 400);
      }
      return;
    }

    // v86: Claude-CLI aus dem Board anmelden — Schritt 1 liefert die Anmelde-Adresse, Schritt 2
    // nimmt den Code von claude.com entgegen (Ablauf in lib/claudeauth.js).
    if (pfad === "/api/auth/claude/status" && req.method === "GET") {
      sendJson(res, 200, await claudeAuth.status()); // v94: schnelle Einzelpruefung fuer die Einrichtung
      return;
    }
    if (pfad === "/api/auth/claude/start" && req.method === "POST") {
      try {
        sendJson(res, 200, await claudeAuth.starte());
      } catch (e) {
        fehlerAntwort(res, e, 502);
      }
      return;
    }
    if (pfad === "/api/auth/claude/code" && req.method === "POST") {
      try {
        const { code } = await leseJson(req);
        if (!code) { sendJson(res, 400, { error: "Code fehlt." }); return; }
        sendJson(res, 200, await claudeAuth.abschliessen(code));
      } catch (e) {
        fehlerAntwort(res, e, 502);
      }
      return;
    }

    // v103: ChatGPT (Codex-CLI) anmelden — Konto im Browser oder API-Schluessel (geht nur an die CLI).
    if (pfad === "/api/auth/chatgpt/status" && req.method === "GET") {
      sendJson(res, 200, await codexAuth.status());
      return;
    }
    if (pfad === "/api/auth/chatgpt/start" && req.method === "POST") {
      try { sendJson(res, 200, await codexAuth.starte()); } catch (e) { fehlerAntwort(res, e, 502); }
      return;
    }
    if (pfad === "/api/auth/chatgpt/schluessel" && req.method === "POST") {
      try {
        const { schluessel } = await leseJson(req);
        if (!schluessel || !String(schluessel).trim()) { sendJson(res, 400, { error: "Schlüssel fehlt." }); return; }
        sendJson(res, 200, await codexAuth.mitSchluessel(schluessel));
      } catch (e) { fehlerAntwort(res, e, 502); }
      return;
    }
    if (pfad === "/api/auth/chatgpt/trennen" && req.method === "POST") {
      sendJson(res, 200, await codexAuth.abmelden());
      return;
    }

    if (pfad === "/api/auth/claude/trennen" && req.method === "POST") {
      // Loggt die lokale Claude-CLI aus (betrifft das Konto auf DIESEM Rechner).
      try {
        execSync("claude auth logout", { stdio: "ignore" });
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 502, { error: "claude auth logout fehlgeschlagen: " + e.message });
      }
      return;
    }

    // Sync eines Drehtermins → Kalender-Event (Bens Kalender) + Task (Bens Liste), v16d-1.
    // Routing/Teilnehmer/Deadlines kommen in v16d-2. Bestehende IDs werden geupdatet.
    if (pfad === "/api/gcal/sync" && req.method === "POST") {
      try {
        const { termin, karten, eventId, taskId, calId, mailen } = await leseJson(req);
        if (!termin || !termin.datum) {
          sendJson(res, 400, { error: "termin.datum fehlt" });
          return;
        }
        const sendUpdates = mailen === "none" ? "none" : "all"; // still (Karten/Detail) vs. mailen
        // Je Karte eine Zeile; dahinter der Google-Drive-Ordner-Link (per Datei-ID, ueberlebt
        // den Phasen-Umzug). drive.link liefert bei fehlendem Pfad "" statt zu werfen.
        const zeilen = [];
        for (const c of karten || []) {
          const titelC = (c && (c.title || c.titel)) || String(c);
          let link = "";
          // v85: Pfad aus dem Drive-Stand der Spalten (nummerierte/umbenannte Ordner), nicht aus den Standards.
          try { if (c && c.column) link = await drive.link(projekte.projektPfadDyn(c)); } catch { link = ""; }
          zeilen.push(link ? `• ${titelC}\n  ${link}` : `• ${titelC}`);
        }
        const liste = zeilen.join("\n");
        const anzahl = (karten || []).length;
        const titel = `Dreh: ${termin.ort || termin.titel || "Drehtermin"}${anzahl ? ` (${anzahl})` : ""}`;
        const beschreibung = liste ? `Inhalte:\n${liste}` : "Noch keine Karten zugeordnet.";
        const felder = { titel, beschreibung, datum: termin.datum, zeit: termin.zeit || "", teilnehmer: termin.teilnehmer || [] };
        let neuEventId = eventId;
        let neuTaskId = taskId;
        if (eventId) await gcal.eventUpdaten(calId, eventId, felder, sendUpdates);
        else neuEventId = await gcal.eventAnlegen(calId, felder, sendUpdates);
        if (taskId) await gcal.taskUpdaten(taskId, { titel, notiz: beschreibung, faellig: termin.datum });
        else neuTaskId = await gcal.taskAnlegen({ titel, notiz: beschreibung, faellig: termin.datum });
        sendJson(res, 200, { eventId: neuEventId, taskId: neuTaskId });
      } catch (e) {
        fehlerAntwort(res, e, 502);
      }
      return;
    }

    // Mail des verbundenen Google-Kontos (fuer die Organisator-Zeile im Teilnehmer-UI, v44).
    if (pfad === "/api/gcal/konto" && req.method === "GET") {
      sendJson(res, 200, { email: await gcal.kontoMail() });
      return;
    }

    // ---- OAuth: LinkedIn -------------------------------------------------

    if (pfad === "/api/auth/linkedin" && req.method === "GET") {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      if (!clientId) {
        appFehlt(res, "LinkedIn", "Social Media");
        return;
      }
      const p = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: `https://localhost:${PORT}/api/auth/linkedin/callback`,
        scope: "r_organization_social rw_organization_admin",
        state: neuerOauthState("linkedin"),
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
      if (!oauthStateOk("linkedin", url.searchParams.get("state"))) {
        umleitung(res, OAUTH_STATE_FEHLER);
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

    // v100: Auswertung je Zeitraum — 2× `wochen` Kalenderwochen ab `vor` Wochen zurueck (der zweite Block ist der
    // Vergleichszeitraum). Liefert Konto-Werte je Woche und alle Posts darin mit Kennzahlen (Instagram + LinkedIn).
    if (pfad === "/api/stats/zeitraum" && req.method === "GET") {
      const wochen = Math.max(1, Math.min(26, Number(url.searchParams.get("wochen")) || 8));
      const vor = Math.max(0, Math.min(104, Number(url.searchParams.get("vor")) || 0));
      const tokens = await leseTokens();
      const montag = new Date();
      montag.setHours(0, 0, 0, 0);
      montag.setDate(montag.getDate() - ((montag.getDay() + 6) % 7));
      const bis = new Date(montag);
      bis.setDate(bis.getDate() - 7 * vor + 7);
      const von = new Date(montag);
      von.setDate(von.getDate() - 7 * (vor + 2 * wochen - 1));
      const antwort = { wochen: [], posts: [], instagram: false, linkedin: false };
      try {
        if (tokens.instagram && tokens.instagram.accessToken) {
          const me = await social.instagramIch(tokens.instagram).catch(() => null);
          const igId = me && me.id;
          antwort.follower = me ? me.followers_count ?? null : null;
          const [w, p] = await Promise.all([
            igId ? social.instagramWochen(igId, tokens.instagram.accessToken, 2 * wochen, vor) : [],
            social.instagramZeitraum(tokens.instagram, von.getTime(), bis.getTime()),
          ]);
          antwort.wochen = w;
          antwort.posts.push(...p);
          antwort.instagram = true;
        }
        if (tokens.linkedin && tokens.linkedin.accessToken) {
          try {
            const li = await social.linkedinZahlen(tokens.linkedin);
            for (const x of li.posts || []) {
              const t = typeof x.erstellt === "number" ? x.erstellt : Date.parse(x.erstellt);
              if (t >= von.getTime() && t < bis.getTime())
                antwort.posts.push({
                  plattform: "linkedin", id: x.id, zeit: new Date(t).toISOString(), url: x.url || "", text: x.text || "",
                  format: null, views: x.views ?? null, reach: null, likes: x.likes ?? null, kommentare: x.kommentare ?? null,
                  geteilt: x.shares ?? null, gespeichert: null, interaktionen: x.interaktionen ?? null,
                });
            }
            antwort.linkedin = true;
          } catch { /* LinkedIn optional */ }
        }
        sendJson(res, 200, antwort);
      } catch (e) {
        sendJson(res, 502, { ...antwort, error: e.message });
      }
      return;
    }

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

    // v97: veroeffentlichte Posts den Karten zuordnen (eindeutig -> automatisch, sonst Vorschlag).
    if (pfad === "/api/zuordnung/pruefen" && req.method === "POST") {
      try {
        sendJson(res, 200, { ...(await zuordnungPruefen()), verbunden: await verbundenePlattformen() });
      } catch (e) {
        fehlerAntwort(res, e, 502);
      }
      return;
    }
    // v97 Nachtrag: Hand-Zuordnung fuer Posts, die zeitlich zu keiner Karte passen. Liste = noch keiner Karte
    // zugeordnete Posts, naechste zum geplanten Upload zuerst; `passt` sagt, ob das Format zur Karte passt.
    if (pfad === "/api/zuordnung/posts" && req.method === "GET") {
      try {
        const cardId = url.searchParams.get("cardId");
        const board = await leseBoard();
        const k = board.cards.find((c) => c.id === cardId);
        if (!k) { sendJson(res, 404, { error: "Karte nicht gefunden." }); return; }
        const vergeben = new Set(board.cards.flatMap((c) => Object.values(c.published || {}).map((v) => v && v.id).filter(Boolean)));
        const bezug = (k.dates && k.dates.upload) ? new Date(`${k.dates.upload}T12:00:00`).getTime() : Date.now();
        const liste = (await allePosts())
          .filter((p) => !vergeben.has(p.id) && Number.isFinite(p.zeit))
          .sort((a, b) => Math.abs(a.zeit - bezug) - Math.abs(b.zeit - bezug))
          .slice(0, 20)
          .map((p) => ({ plattform: p.plattform, id: p.id, zeit: new Date(p.zeit).toISOString(), url: p.url, text: String(p.text || "").slice(0, 90), passt: !!p.passt(k.contenttyp) }));
        sendJson(res, 200, { posts: liste, verbunden: await verbundenePlattformen() });
      } catch (e) {
        fehlerAntwort(res, e, 502);
      }
      return;
    }
    if (pfad === "/api/zuordnung/hand" && req.method === "POST") {
      try {
        const { cardId, plattform, postId } = await leseJson(req);
        const post = (await allePosts()).find((p) => p.plattform === plattform && p.id === postId);
        if (!post) { sendJson(res, 404, { error: "Post nicht gefunden." }); return; }
        // v115 (v114 M1): Pruefen und Schreiben auf dem neuesten Stand, in der Board-Reihe.
        const { ergebnis } = await aendereBoard((board) => {
          const k = board.cards.find((c) => c.id === cardId);
          if (!k) return { status: 404, antwort: { error: "Karte nicht gefunden." }, nichts: true };
          const schon = board.cards.find((c) => c !== k && Object.values(c.published || {}).some((v) => v && v.id === postId));
          if (schon) return { status: 409, antwort: { error: `Der Post gehört schon zur Karte „${schon.title}“.` }, nichts: true };
          k.published = { ...(k.published || {}), [plattform]: zuordnung.postEintrag(post, "manuell") };
          k.floatUpload = false;
          // Karte ohne Termin: der echte Post-Zeitpunkt wird ihr Upload-Termin (Ortszeit des Boards).
          if (!(k.dates && k.dates.upload)) {
            const d = new Date(post.zeit);
            const zwei = (n) => String(n).padStart(2, "0");
            k.dates = { ...(k.dates || {}), upload: `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}` };
            if (!k.uploadTime) k.uploadTime = `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
          }
          k.zuordnungVorschlag = (k.zuordnungVorschlag || []).filter((x) => x.plattform !== plattform);
          for (const c of board.cards) if (c !== k && c.zuordnungVorschlag) c.zuordnungVorschlag = c.zuordnungVorschlag.filter((x) => x.post.id !== postId);
          return { status: 200, antwort: { ok: true }, karte: k };
        });
        if (ergebnis.karte && ergebnis.karte.driveName) projekte.spiegeleKarte(ergebnis.karte).catch(() => {});
        sendJson(res, ergebnis.status, ergebnis.antwort);
      } catch (e) {
        fehlerAntwort(res, e, 502);
      }
      return;
    }

    // v97: Vorschlag bestaetigen (ja) oder ablehnen (nein — der Post wird dieser Karte nie wieder angeboten).
    if (pfad === "/api/zuordnung/entscheiden" && req.method === "POST") {
      const { cardId, plattform, postId, ja } = await leseJson(req);
      // v115 (v114 M1): auf dem neuesten Stand, in der Board-Reihe.
      const { ergebnis } = await aendereBoard((board) => {
        const k = board.cards.find((c) => c.id === cardId);
        const v = k && (k.zuordnungVorschlag || []).find((x) => x.plattform === plattform && x.post.id === postId);
        if (!v) return { nichts: true, status: 404, antwort: { error: "Vorschlag nicht gefunden." } };
        if (ja) {
          k.published = { ...(k.published || {}), [plattform]: { ...v.post, zuordnung: "bestaetigt" } };
          k.floatUpload = false;
          k.zuordnungVorschlag = (k.zuordnungVorschlag || []).filter((x) => x.plattform !== plattform);
          // derselbe Post darf keiner anderen Karte mehr vorgeschlagen werden
          for (const c of board.cards) if (c !== k && c.zuordnungVorschlag) c.zuordnungVorschlag = c.zuordnungVorschlag.filter((x) => x.post.id !== postId);
        } else {
          k.zuordnungAbgelehnt = [...new Set([...(k.zuordnungAbgelehnt || []), postId])];
          k.zuordnungVorschlag = (k.zuordnungVorschlag || []).filter((x) => x.post.id !== postId);
        }
        return { status: 200, antwort: { ok: true } };
      });
      sendJson(res, ergebnis.status, ergebnis.antwort);
      return;
    }

    if (pfad === "/api/kpi/collect" && req.method === "POST") {
      await zuordnungPruefen().catch(() => {}); // v97: erst zuordnen, dann messen
      const board = await leseBoard();
      const tokens = await leseTokens();
      await boardparamSicher();
      const ergebnis = await kpi.sammle(board.cards, tokens);
      if (ergebnis.gesammelt > 0) await kpiUebernehmen(ergebnis.cards); // v115 (M1): auf den neuesten Stand legen
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
    // v115 (v114 B1): Lief die Antwort schon (ZIP, Stream), warf ein zweites writeHead und beendete den ganzen
    // Prozess (gemessen: Rohmaterial-ZIP ueber 4 GB, POST /api/einrichtung/speichern mit null). Jetzt: Verbindung
    // schliessen, Fehler ins Server-Fenster, Board laeuft weiter.
    if (res.headersSent) {
      console.error(`[${new Date().toISOString()}] Fehler nach Antwortbeginn (${req.method} ${req.url}): ${e && e.stack ? e.stack : e}`);
      res.destroy();
      return;
    }
    if (e && e.status >= 400 && e.status < 500) {
      sendJson(res, e.status, { error: e.satz || e.message, satz: e.satz || e.message });
      return;
    }
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}: ${e && e.stack ? e.stack : e}`);
    const satz = verstaendlicherFehler(e && e.message);
    sendJson(res, e && e.name === "DriveFehler" ? 502 : 500, { error: satz, satz, detail: String((e && e.message) || e).slice(0, 500) });
  }
}

// v115 (v114 B1): Ein Fehler, der trotzdem aus einem Handler entkommt, beendet nicht mehr das Board.
process.on("unhandledRejection", (grund) => {
  console.error(`[${new Date().toISOString()}] Unbehandelter Fehler (Board laeuft weiter): ${grund && grund.stack ? grund.stack : grund}`);
});

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
    // v113 (N12, Owner 07.10.2026): nur die Modelle entladen, die das Board selbst genutzt hat — nicht die
    // anderer Programme (z. B. LAUI), die zufaellig gerade geladen sind.
    const eigene = new Set(ki.vomBoardGenutzteOllamaModelle());
    const zuEntladen = (models || []).filter((m) => eigene.has(m.name) || eigene.has(m.model));
    for (const m of zuEntladen) {
      await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: m.name, keep_alive: 0 }),
      }).catch(() => {});
    }
    if (zuEntladen.length) console.log(`Ollama: ${zuEntladen.length} vom Board genutzte(s) Modell(e) entladen.`);
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

// v113 (H8, Owner 07.10.2026): nur dieser Rechner. Die API hat keine Anmeldung — ohne Host-Angabe war sie im
// ganzen WLAN erreichbar (gemessen: https://192.168.0.131:4399/api/board -> 200). OAuth-Rueckrufe laufen ueber localhost.
server.listen(PORT, "127.0.0.1", async () => {
  console.log(`WEE Social Media Suit laeuft auf https://localhost:${PORT}`);
  // v98: Alles hier ist Hintergrundarbeit — sie wartet 60 s, damit das Board beim Start zuerst die Drive-
  // Warteschlange bekommt (alle rclone-Aufrufe laufen nacheinander; gemessen standen KPI-Tabellen mit 15 s
  // vor den Karten an).
  await new Promise((r) => setTimeout(r, 60000));
  // v72: Ordner-Links der Drive-Marken vorwaermen (nacheinander, ein Aufruf je Ordner), damit der Klick sofort oeffnet
  (async () => { for (const rel of ["System (AI only)", "Kontext", "Videoauswertung/Auswertung-Tabellen"]) { try { await ordnerLinkId(rel); } catch { /* Beiwerk */ } } })();
  driveSetup.konto().catch(() => {}); // v63: Drive-Konto vorwaermen, damit "Externe Dienste" sofort den Stand zeigt
  // KPI-Sammlung beim Start ausloesen (Owner 02.09.2026): wenn nach den Intervallen eine
  // Post-Messung faellig ist ODER die Konto-Kadenz (woechentl./quartalsw.) greift. Die
  // Faelligkeits-Logik steckt in kpi.sammle — der Aufruf ist selbst-gated und schreibt
  // Drive nur, wenn wirklich etwas erfasst wurde. Blockiert den Serverstart nicht.
  try {
    // v97: erst Posts den Karten zuordnen — sonst hat keine Karte eine Post-ID und es wird nichts gemessen.
    const z = await zuordnungPruefen().catch((e) => ({ fehler: e.message }));
    if (z.auto || z.vorschlaege) console.log(`Zuordnung beim Start: ${z.auto} automatisch, ${z.vorschlaege} Vorschlag/Vorschlaege.`);
    const board = await leseBoard();
    const tokens = await leseTokens();
    await boardparamSicher();
    const ergebnis = await kpi.sammle(board.cards, tokens);
    if (ergebnis.gesammelt > 0) await kpiUebernehmen(ergebnis.cards); // v115 (M1): auf den neuesten Stand legen
    const konto = ergebnis.bericht.some((b) => /^(kanal|demografie)/.test(b.status || ""));
    if (ergebnis.gesammelt > 0 || konto) {
      console.log(`KPI beim Start: ${ergebnis.gesammelt} Post-Messung(en)` + (konto ? " + Konto-Schnappschuss" : "") + " erfasst.");
    }
  } catch (e) {
    console.log(`KPI-Start uebersprungen: ${e.message}`); // darf den Betrieb nie blockieren
  }
});
