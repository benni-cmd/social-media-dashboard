// Token-freie Google-Drive-Anbindung ueber die CLI `rclone` (Remote `gdrive:`).
//
// Zwei Regeln, die vorher fehlten und je einen gemessenen Defekt verursacht haben:
//
//   1. "Nicht gefunden" und "Drive nicht erreichbar" sind ZWEI Zustaende, nicht einer.
//      Vorher fing `list()` jeden Fehler zu einem leeren String — ein Ausfall sah aus wie
//      ein leerer Ordner (Befund B8). rclone unterscheidet das selbst ueber den Exit-Code:
//      3 = Ordner nicht gefunden, 4 = Datei nicht gefunden, alles andere = echte Stoerung.
//      Nachgemessen 27.08.2026: `rclone lsjson --stat` auf einen fehlenden Pfad → exit 3.
//
//   2. Jedes Pfadstueck wird geprueft, bevor es an rclone geht. Ohne die Pruefung legt
//      rclone aus "../.." echte Ordner namens "．．" an (Befund B3, nachgemessen).

import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync, statSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, mkdirSync } from "node:fs";
import { pfadstueckOk } from "./pipeline.js";
import * as ereignisse from "./ereignisse.js"; // v58: jeder rclone-Aufruf wird mitlesbar
import * as rcloneConfig from "./rclone-config.js";

// Arbeitsordner (v63): data/drive-root.json (in der App gesetzt) > DRIVE_ROOT_FOLDER_ID (.env) >
// eingebauter Standard. Veraenderbar zur Laufzeit (setzeRoot), damit ein Ordnerwechsel ohne
// Neustart wirkt.
const ROOT_DATEI = new URL("../data/drive-root.json", import.meta.url);
const ROOT_STANDARD = "1jjQoeBpIzOdvAawyoSAuMWL2NGiN0mvt";
function leseRootDatei() {
  try { return JSON.parse(readFileSync(ROOT_DATEI, "utf8")).root || null; } catch { return null; }
}
let ROOT = leseRootDatei() || process.env.DRIVE_ROOT_FOLDER_ID || ROOT_STANDARD;
export const aktuellerRoot = () => ROOT;
export function setzeRoot(id) {
  ROOT = id;
  writeFileSync(ROOT_DATEI, JSON.stringify({ root: id, gesetzt: new Date().toISOString() }));
}

// Wo rclone die Config im Onboarding ablegt (AppData\Roaming).
const CONFIG_QUELLE = process.env.RCLONE_CONFIG ||
  join(homedir(), "AppData", "Roaming", "rclone", "rclone.conf");

// STABILE Arbeitskopie in AppData\Local. Grund (gemessen 01.09.2026, data/drive-error.log):
// die Quelle in AppData\Roaming verschwand fuer ~18 s ("DATEI FEHLT") und kehrte mit
// UNVERAENDERTER mtime zurueck — Signatur eines externen Dienstes, der Roaming anfasst
// (Roaming-Profil-Sync/Backup). rclone lief in genau diesem Fenster und meldete
// "didn't find section". Local wird nie geroamt/gesynct; nur das Board schreibt hier hinein.
const CONFIG_ARBEIT = join(
  process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
  "social-media-dashboard",
  "rclone.conf"
);

// Legt/aktualisiert die stabile Arbeitskopie in Local, solange die Quelle lesbar ist.
// Dient nur noch als robuste LESE-Quelle fuer die Zugangsdaten (siehe gdriveEnv) — der
// Betrieb haengt nicht mehr an dieser Datei.
function seedeArbeitskopie() {
  try {
    mkdirSync(dirname(CONFIG_ARBEIT), { recursive: true });
    if (existsSync(CONFIG_QUELLE)) {
      const arbeitDa = existsSync(CONFIG_ARBEIT);
      const neuer = !arbeitDa || statSync(CONFIG_QUELLE).mtimeMs > statSync(CONFIG_ARBEIT).mtimeMs;
      if (neuer) copyFileSync(CONFIG_QUELLE, CONFIG_ARBEIT);
    }
  } catch {
    /* Kopie nicht moeglich — dann liest gdriveEnv direkt aus der Quelle. */
  }
}

const RCLONE_CONFIG = existsSync(CONFIG_ARBEIT) ? CONFIG_ARBEIT : CONFIG_QUELLE; // nur fuer den Diagnose-Schnappschuss

// DER EIGENTLICHE FIX: rclone braucht KEINE Config-Datei, wenn der Remote per Umgebungs-
// variablen RCLONE_CONFIG_GDRIVE_* definiert ist (verifiziert 01.09.2026: rclone lsf gdrive:
// mit --config auf eine fehlende Datei -> exit 0). Die Zugangsdaten werden EINMAL in den
// Speicher gelesen und bei jedem Aufruf per Env uebergeben. Verschwindet die Config-Datei
// mitten in der Sitzung (Roaming-Sync/Backup entfernt sie zeitweise, Beleg data/drive-error.log:
// "DATEI FEHLT"), laeuft das Board weiter — die Werte stehen im Speicher.
let GDRIVE_ENV = null;

// STABILER Projekt-Cache der Zugangsdaten, AUSSERHALB von AppData. Beleg (data/drive-error.log
// 02.09. 02:40): beim Serverstart waren BEIDE AppData-Orte (Roaming UND Local) >12 s unlesbar —
// der externe Dienst greift die ganze AppData-Ablage, nicht nur Roaming. data/ dagegen ist
// zuverlaessig (board.json lebt hier). Enthaelt den Token -> gitignoriert, nie committen.
const CONFIG_CACHE = new URL("../data/.gdrive-env.json", import.meta.url);

// Struktur-Cache (type/scope/client_id — OHNE token/secret) fuer die Selbstheilung (v21).
const STRUKTUR_CACHE = new URL("../data/.gdrive-struktur.json", import.meta.url);

// Liest die [gdrive]-Sektion aus einer rclone.conf und macht RCLONE_CONFIG_GDRIVE_*-Env daraus.
function parseConfig(roh) {
  const sektion = roh.split(/^\[/m).find((s) => s.startsWith("gdrive]"));
  if (!sektion) return null;
  const env = {};
  for (const zeile of sektion.split(/\r?\n/).slice(1)) {
    const m = zeile.match(/^([a-z_]+)\s*=\s*(.*)$/i);
    if (m && m[2].trim() !== "") env["RCLONE_CONFIG_GDRIVE_" + m[1].toUpperCase()] = m[2].trim();
  }
  return env.RCLONE_CONFIG_GDRIVE_TYPE ? env : null;
}

function leseAusAppData() {
  seedeArbeitskopie();
  for (const p of [CONFIG_ARBEIT, CONFIG_QUELLE]) {
    try {
      const env = parseConfig(readFileSync(p, "utf8"));
      if (env) return env;
    } catch {
      /* Datei gerade weg/unlesbar — naechster Ort */
    }
  }
  return null;
}

function schreibeCache(env) {
  try {
    writeFileSync(CONFIG_CACHE, JSON.stringify(env));
  } catch {
    /* Cache ist Absicherung, kein Muss */
  }
}

function leseCache() {
  try {
    const env = JSON.parse(readFileSync(CONFIG_CACHE, "utf8"));
    return env && env.RCLONE_CONFIG_GDRIVE_TYPE ? env : null;
  } catch {
    return null;
  }
}

// AppData zuerst (frisch, faengt Re-Auth) und dabei den stabilen Cache aktualisieren; ist AppData
// gerade weg, aus dem Projekt-Cache laden. So haengt der Betrieb an KEINEM AppData-Zugriff mehr.
function ladeGdriveEnv() {
  const frisch = leseAusAppData();
  if (frisch) {
    schreibeCache(frisch);
    return frisch;
  }
  return leseCache();
}

// Liefert die gecachten gdrive-Env-Variablen. Solange sie noch nie geladen werden konnten
// (Datei beim Start zufaellig weg), wird bei jedem Aufruf erneut versucht — sobald die Datei
// einmal da war, bleibt der Wert fuer die ganze Sitzung im Speicher (immun gegen spaeteres Verschwinden).
function gdriveEnv() {
  if (!GDRIVE_ENV) GDRIVE_ENV = ladeGdriveEnv();
  return GDRIVE_ENV;
}

// v63: nach einer Neu-Anmeldung (rclone config reconnect) die Zugangsdaten frisch einlesen —
// sonst bliebe das alte Konto fuer die ganze Sitzung im Speicher.
export function ladeZugangNeu() {
  GDRIVE_ENV = null;
  return !!gdriveEnv();
}

// Beim Modul-Start die Zugangsdaten ROBUST in den Speicher holen. Die Config-Datei ist
// gelegentlich fuer Sekunden nicht lesbar (extern angefasst, Beleg data/drive-error.log:
// "DATEI FEHLT" genau zum Serverstart). Darum bis zu 12 s lang alle 300 ms erneut versuchen,
// bis sie EINMAL gelesen werden konnte. Danach steht sie im Speicher (immun gegen spaeteres
// Verschwinden) UND als stabile Local-Kopie (immun beim naechsten Start). Blockiert den
// Server-Start nur im seltenen Fall, dass beide Orte beim Booten zufaellig weg sind.
// Selbstheilung VOR dem Lesen: fehlt in [gdrive] der `type` (unvollstaendiger Refresh,
// Beleg Paket v21), type/scope/client_id wieder ergaenzen — Token bleibt unberuehrt. So
// kann "couldn't find type field in config" den Betrieb nicht mehr blockieren. Bei gesunder
// Config wird die Struktur (ohne Geheimnisse) fuer den naechsten Notfall gesichert.
try {
  const h = rcloneConfig.heileGdriveConfig(CONFIG_QUELLE, STRUKTUR_CACHE);
  if (h.status === "geheilt") console.log(`rclone-Config repariert: ${(h.ergaenzt || []).join(", ")} wieder ergaenzt.`);
  else if (h.status === "defekt-nicht-heilbar") console.log("rclone-Config: [gdrive] unvollstaendig und nicht heilbar — ggf. `rclone config reconnect gdrive:`.");
} catch {
  /* Heilung ist Absicherung, darf den Start nie blockieren. */
}

{
  const bis = Date.now() + 12000;
  while (!gdriveEnv() && Date.now() < bis) {
    await new Promise((r) => setTimeout(r, 300));
  }
}

// rclone-Exit-Codes, die "gibt es nicht" bedeuten — im Gegensatz zu "geht gerade nicht".
const NICHT_GEFUNDEN = new Set([3, 4]);

export class DriveFehler extends Error {
  constructor(nachricht, { fehlend = false, code = null } = {}) {
    super(nachricht);
    this.name = "DriveFehler";
    this.fehlend = fehlend; // true = Pfad existiert nicht (harmlos, erwartbar)
    this.code = code;
  }
}

// Prueft einen kompletten Pfad Stueck fuer Stueck. Wirft, bevor irgendetwas passiert.
export function pruefePfad(pfad) {
  const stuecke = String(pfad || "").split("/").filter((s) => s !== "");
  if (!stuecke.length) throw new DriveFehler("Leerer Drive-Pfad.");
  for (const s of stuecke) {
    if (!pfadstueckOk(s))
      throw new DriveFehler(
        `Unzulaessiges Pfadstueck "${s}" — Namen duerfen keine Schraegstriche und keine Punkt-Ordner sein.`
      );
  }
  return stuecke.join("/");
}

// Transiente Config-Race: rclone refresht den OAuth-Token ~1x/Stunde und schreibt dabei
// rclone.conf neu. Ein parallel lesender rclone-Prozess erwischt die Datei im leeren
// Zwischenzustand und meldet "didn't find section in config file" — obwohl die Config
// gueltig ist. Kein Pfad-Fehler, sondern ein Timing-Race. Gemessen 01.09.2026 (Paket v15).
const CONFIG_RACE = /didn't find section in config file|couldn't find section in config file|failed to load config file/i;
const RETRY_MS = [300, 700, 1500, 3000]; // 4 Wiederholungen, ~5,5 s gesamt — deckt auch ein mehrsekuendiges Fenster ab.

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

// Beweis-Schnappschuss der Config GENAU im Moment eines "didn't find section"-Fehlers.
// Solange die Ursache nicht sicher steht, sichert das den echten Zustand statt Vermutungen:
// Pfad, Existenz, Groesse, Sektionszahl, mtime, erste Bytes — angehaengt an data/drive-error.log.
function configSchnappschuss(args, stderr) {
  let zustand;
  try {
    if (!existsSync(RCLONE_CONFIG)) {
      zustand = "DATEI FEHLT";
    } else {
      const st = statSync(RCLONE_CONFIG);
      const roh = readFileSync(RCLONE_CONFIG, "utf8");
      const sektionen = (roh.match(/^\[/gm) || []).length;
      zustand = `size=${st.size} sektionen=${sektionen} mtime=${st.mtime.toISOString()} kopf=${JSON.stringify(roh.slice(0, 40))}`;
    }
  } catch (e) {
    zustand = `Schnappschuss-Fehler: ${e.message}`;
  }
  const quelle = existsSync(CONFIG_QUELLE) ? `size=${statSync(CONFIG_QUELLE).size}` : "FEHLT";
  const zeile = `${new Date().toISOString()} CONFIG-RACE | cfg=${RCLONE_CONFIG} | ${zustand} | quelle(${CONFIG_QUELLE})=${quelle} | args=${JSON.stringify(args)} | stderr=${JSON.stringify(stderr.slice(0, 200))}\n`;
  try {
    appendFileSync(new URL("../data/drive-error.log", import.meta.url), zeile);
  } catch {
    /* Logdatei ist Diagnose-Kür, kein Muss — nie den eigentlichen Fehler verschlucken. */
  }
  return zustand;
}

// Serialisierung: alle rclone-Aufrufe laufen NACHEINANDER durch eine Promise-Kette.
// Grund: Ein Board-Laden feuerte bis zu Dutzende Drive-Calls gleichzeitig — das ueberlastete
// den Prozess (40 parallele Spawns blockierten) und ist die einzige Bedingung, unter der zwei
// rclone-Prozesse sich am Config-File in die Quere kommen koennen. Ein Aufruf nach dem anderen
// nimmt der ganzen Fehlerklasse den Boden. Drive-Calls sind selten genug, dass das nicht stoert.
let rcloneKette = Promise.resolve();

function rclone(args, opts = {}) {
  const lauf = rcloneKette.then(() => rcloneMitRetry(args, opts));
  rcloneKette = lauf.then(() => undefined, () => undefined); // Kette darf nie an einem Fehler brechen.
  return lauf;
}

// Wiederholt NUR die transiente Config-Race — echte Fehler und "nicht gefunden" (Exit 3/4)
// bleiben sofortige Fehler, damit kein Ausfall verschleiert wird. Der Backoff deckt bewusst
// mehrere Sekunden ab: der Fehler vom 01.09. 18:44 ueberlebte 1,4 s, das Fenster kann also
// laenger sein als eine ms-kurze Datei-Umschreibung (z.B. Datei kurz gesperrt).
async function rcloneMitRetry(args, opts = {}) {
  for (let versuch = 0; ; versuch++) {
    try {
      return await rcloneVersuch(args, opts);
    } catch (e) {
      if (versuch < RETRY_MS.length && e instanceof DriveFehler && CONFIG_RACE.test(e.message)) {
        await schlaf(RETRY_MS[versuch]);
        continue;
      }
      throw e;
    }
  }
}

// Ein einzelner rclone-Aufruf. Argumente als Array — Leerzeichen in Pfaden ("In Bearbeitung")
// sind damit sicher, ohne Shell-Anfuehrungszeichen.
function rcloneVersuch(args, { input = null, timeoutMs = 90000, root = null } = {}) {
  // v58: Dies ist der EINZIGE Ort, an dem das Board rclone startet — jeder Drive-Zugriff im
  // ganzen Projekt laeuft hier durch. Deshalb genuegt diese eine Anzapfung, damit die
  // Drive-Sektion der Kopfzeile jeden Aufruf mitlesen kann.
  const vorgang = ereignisse.starte({
    sektion: "drive",
    dienst: "rclone",
    text: args.join(" "),
  });
  return new Promise((resolve, reject) => {
    // Kein --config: der Remote kommt aus RCLONE_CONFIG_GDRIVE_* in der Env, damit rclone
    // NICHT von der (zeitweise verschwindenden) Config-Datei abhaengt.
    const env = { ...process.env, ...(gdriveEnv() || {}) };
    const child = spawn("rclone", [...args, "--drive-root-folder-id", root || ROOT], { shell: false, env });
    let out = "";
    let err = "";
    let erledigt = false;

    const uhr = setTimeout(() => {
      if (erledigt) return;
      erledigt = true;
      child.kill();
      vorgang.fehler(`Zeitueberschreitung nach ${Math.round(timeoutMs / 1000)} s`);
      reject(new DriveFehler(`rclone antwortet seit ${Math.round(timeoutMs / 1000)} Sekunden nicht.`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));

    child.on("error", (e) => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
      vorgang.fehler(e.code === "ENOENT" ? "rclone nicht gefunden" : e.message);
      reject(
        e.code === "ENOENT"
          ? new DriveFehler("Die CLI `rclone` ist nicht installiert oder nicht im Pfad.")
          : new DriveFehler(e.message)
      );
    });

    child.on("close", (code) => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
      if (code === 0) {
        // Ein Ergebnis-Mass, das fuer jeden rclone-Befehl stimmt: wie viel kam zurueck.
        const zeilen = out ? out.split(/\r?\n/).filter(Boolean).length : 0;
        vorgang.fertig(zeilen ? `${zeilen} Zeile(n) zurueck` : "erledigt, keine Ausgabe");
        return resolve(out);
      }
      // rclone schreibt Hinweise (etwa zur auslaufenden client_id) auf stderr — kein Fehler.
      const text = err.split(/\r?\n/).filter((z) => z && !/NOTICE/.test(z)).join(" ").trim();
      // Config-Race: den echten Config-Zustand in genau diesem Moment festhalten (Beweis statt Vermutung).
      const zustand = CONFIG_RACE.test(text) ? configSchnappschuss(args, text) : null;
      // „Nicht gefunden" (Exit 3/4) ist ein Zustand, keine Stoerung — im Terminal deshalb
      // das Statuswort „fehlt" statt „befund" (Regel 3, kein eigenes Wort erfinden). Und der
      // ANZEIGETEXT neutral: ein noch nie angelegter Ordner (z. B. „Verworfen", solange nichts
      // verworfen wurde) ist der Normalzustand — „leer / noch nicht angelegt" statt des
      // alarmierend klingenden „nicht gefunden (Code 3)" (Owner-Fund 23.09.2026). Der Exit-Code
      // bleibt am DriveFehler-Objekt (.code/.fehlend) fuer die echte Diagnose erhalten.
      if (NICHT_GEFUNDEN.has(code)) vorgang.fertig(`leer / noch nicht angelegt`, "fehlt");
      else vorgang.fehler(text || `Code ${code}`);
      reject(
        new DriveFehler(zustand ? `${text} [config-schnappschuss: ${zustand}]` : text || `rclone endete mit Code ${code}`, {
          fehlend: NICHT_GEFUNDEN.has(code),
          code,
        })
      );
    });

    if (input != null) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

// Existiert der Pfad? Liefert true/false — und wirft NUR bei echter Stoerung.
// Genau diese Trennung fehlte: vorher galt ein Projektordner als nicht vorhanden,
// solange seine Unterordner leer waren (Befund B1).
export async function existiert(pfad) {
  const p = pruefePfad(pfad);
  try {
    const out = await rclone(["lsjson", "--stat", `gdrive:${p}`]);
    return !!out.trim();
  } catch (e) {
    if (e.fehlend) return false;
    throw e;
  }
}

export async function mkdir(pfad, opts = {}) {
  await rclone(["mkdir", `gdrive:${pruefePfad(pfad)}`], opts);
}

export async function writeFile(pfad, inhalt, opts = {}) {
  await rclone(["rcat", `gdrive:${pruefePfad(pfad)}`], { input: inhalt, ...opts });
}

export async function readFile(pfad, opts = {}) {
  return rclone(["cat", `gdrive:${pruefePfad(pfad)}`], opts);
}

// Liste von Namen. Ein fehlender Ordner liefert eine leere Liste; eine Stoerung wirft.
export async function list(pfad, { dirsOnly = false, filesOnly = false } = {}) {
  const args = ["lsf", `gdrive:${pruefePfad(pfad)}`];
  if (dirsOnly) args.push("--dirs-only");
  if (filesOnly) args.push("--files-only");
  try {
    const out = await rclone(args);
    return out
      .split(/\r?\n/)
      .map((s) => s.replace(/\/$/, ""))
      .filter(Boolean);
  } catch (e) {
    if (e.fehlend) return [];
    throw e;
  }
}

export async function count(pfad, filesOnly = true) {
  return (await list(pfad, { filesOnly })).length;
}

// v23: Ganzer Ordnerinhalt in EINEM Aufruf (`lsjson -R`) — ersetzt im Scan die vielen
// list/count/link-Aufrufe. Liefert das rohe rclone-JSON (Dirs mit `ID`, Files mit `Path`/
// `Size`). `null` = Ordner existiert nicht (Exit 3/4); `[]` = existiert, aber leer.
export async function inhaltRekursiv(pfad) {
  try {
    const out = await rclone(["lsjson", "-R", `gdrive:${pruefePfad(pfad)}`]);
    return JSON.parse(out || "[]");
  } catch (e) {
    if (e.fehlend) return null;
    throw e;
  }
}

// v23: Drive-ID eines Ordners — und zugleich Existenz-Pruefung. `lsjson --stat` liefert KEINE
// ID (nachgemessen 03.09.2026: Path/Name/ID leer), darum ueber die Eltern-Auflistung, die je
// Eintrag eine ID traegt. `null` = Ordner (oder Eltern) nicht vorhanden.
export async function ordnerId(pfad) {
  const p = pruefePfad(pfad);
  const teile = p.split("/");
  const name = teile.pop();
  const eltern = teile.join("/");
  try {
    const out = await rclone(["lsjson", `gdrive:${eltern}`]);
    const eintrag = JSON.parse(out || "[]").find((e) => e.IsDir && e.Name === name);
    return eintrag ? eintrag.ID : null;
  } catch (e) {
    if (e.fehlend) return null;
    throw e;
  }
}

// v23: Drive-Ordner-Link aus der ID — ohne `rclone link` (der langsamste Aufruf). Fuer den
// Owner oeffnet dieser Link seinen Ordner direkt; eine Freigabe-fuer-alle setzt er nicht.
export function ordnerLink(id) {
  return id ? `https://drive.google.com/drive/folders/${id}` : "";
}

// Teilbaren Drive-Link holen. Ein fehlender Pfad liefert "" statt zu werfen — ein Link
// ist Beiwerk, sein Fehlen darf keine Ansicht kippen.
export async function link(pfad) {
  try {
    return (await rclone(["link", `gdrive:${pruefePfad(pfad)}`])).trim();
  } catch {
    return "";
  }
}

// Einen ganzen Drive-Ordner in ein lokales Verzeichnis kopieren (v22-Download). Die Bytes
// landen als Dateien auf Platte — NICHT durch den String-Puffer von `readFile`, der Video
// zerstoeren wuerde. `copy src dst` legt den INHALT von src nach dst (rekursiv). Grosszuegiger
// Timeout, weil Rohmaterial gross sein kann.
export async function kopiereOrdnerRunter(drivePfad, zielDir) {
  await rclone(["copy", `gdrive:${pruefePfad(drivePfad)}`, zielDir, "--transfers", "4"], { timeoutMs: 900000 });
}

// Eine einzelne lokale Datei nach Drive hochladen (v22, fertiges Video). `copyto` legt sie
// unter genau diesem Zielnamen ab (nicht in einen gleichnamigen Ordner). Bytes von Platte,
// nicht durch `rcat`/String.
export async function kopiereDateiRauf(lokalePfad, drivePfad) {
  await rclone(["copyto", lokalePfad, `gdrive:${pruefePfad(drivePfad)}`], { timeoutMs: 900000 });
}

// Ordner verschieben. `move` raeumt den Quellordner selbst ab und behaelt leere
// Unterordner am Ziel — am 27.08.2026 mit einer Probe nachgemessen.
export async function moveDir(von, nach) {
  await rclone(["move", `gdrive:${pruefePfad(von)}`, `gdrive:${pruefePfad(nach)}`, "--create-empty-src-dirs"], {
    timeoutMs: 180000,
  });
}

export async function purge(pfad) {
  await rclone(["purge", `gdrive:${pruefePfad(pfad)}`]);
}

// Eine EINZELNE Datei loeschen (nicht den Ordner). `purge` wuerfe bei einem Dateipfad,
// darum der eigene rclone-Befehl. Ein fehlender Pfad ist kein Fehler (schon weg = Ziel erreicht).
export async function deleteFile(pfad) {
  try {
    await rclone(["deletefile", `gdrive:${pruefePfad(pfad)}`]);
  } catch (e) {
    if (e.fehlend) return;
    throw e;
  }
}

// v63: Zugangsdaten (Env) fuer die Konto-/Ordner-Abfrage und ein rclone-Aufruf gegen einen
// ANDEREN Root-Ordner (Pruefung eines neuen Arbeitsordners, ohne ihn schon zu setzen).
export const zugang = () => gdriveEnv();

// v63: einen lokalen Verzeichnisbaum in EINEM Aufruf in den Arbeitsordner hochladen (legt alle
// Ordner samt Dateien an). Jeder rclone-Start kostet hier viele Sekunden — ein Baum statt
// dutzender Einzelaufrufe.
export async function baumHochladen(lokalerBaum) {
  await rclone(["copy", lokalerBaum, "gdrive:", "--create-empty-src-dirs"], { timeoutMs: 300000 });
}
export const rcloneMitRoot = (args, root, opts = {}) => rclone(args, { ...opts, root });

// Ist Drive ueberhaupt erreichbar? Fuer die Statusanzeige im Kopf der Oberflaeche.
export async function erreichbar() {
  try {
    await rclone(["lsf", "gdrive:", "--dirs-only", "--max-depth", "1"], { timeoutMs: 30000 });
    return { ok: true, satz: "Google Drive ist erreichbar." };
  } catch (e) {
    return { ok: false, satz: `Google Drive antwortet nicht: ${e.message}` };
  }
}
