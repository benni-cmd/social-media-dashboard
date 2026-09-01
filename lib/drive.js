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
import { existsSync, statSync, readFileSync, appendFileSync, copyFileSync, mkdirSync } from "node:fs";
import { pfadstueckOk } from "./pipeline.js";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID || "1jjQoeBpIzOdvAawyoSAuMWL2NGiN0mvt";

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

function ladeGdriveEnv() {
  seedeArbeitskopie();
  for (const p of [CONFIG_ARBEIT, CONFIG_QUELLE]) {
    let roh;
    try {
      roh = readFileSync(p, "utf8");
    } catch {
      continue; // Datei gerade weg — naechster Ort
    }
    const sektion = roh.split(/^\[/m).find((s) => s.startsWith("gdrive]"));
    if (!sektion) continue;
    const env = {};
    for (const zeile of sektion.split(/\r?\n/).slice(1)) {
      const m = zeile.match(/^([a-z_]+)\s*=\s*(.*)$/i);
      if (m && m[2].trim() !== "") env["RCLONE_CONFIG_GDRIVE_" + m[1].toUpperCase()] = m[2].trim();
    }
    if (env.RCLONE_CONFIG_GDRIVE_TYPE) return env;
  }
  return null;
}

// Liefert die gecachten gdrive-Env-Variablen. Solange sie noch nie geladen werden konnten
// (Datei beim Start zufaellig weg), wird bei jedem Aufruf erneut versucht — sobald die Datei
// einmal da war, bleibt der Wert fuer die ganze Sitzung im Speicher (immun gegen spaeteres Verschwinden).
function gdriveEnv() {
  if (!GDRIVE_ENV) GDRIVE_ENV = ladeGdriveEnv();
  return GDRIVE_ENV;
}

gdriveEnv(); // beim Start einmal versuchen zu laden

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
function rcloneVersuch(args, { input = null, timeoutMs = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    // Kein --config: der Remote kommt aus RCLONE_CONFIG_GDRIVE_* in der Env, damit rclone
    // NICHT von der (zeitweise verschwindenden) Config-Datei abhaengt.
    const env = { ...process.env, ...(gdriveEnv() || {}) };
    const child = spawn("rclone", [...args, "--drive-root-folder-id", ROOT], { shell: false, env });
    let out = "";
    let err = "";
    let erledigt = false;

    const uhr = setTimeout(() => {
      if (erledigt) return;
      erledigt = true;
      child.kill();
      reject(new DriveFehler(`rclone antwortet seit ${Math.round(timeoutMs / 1000)} Sekunden nicht.`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));

    child.on("error", (e) => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
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
      if (code === 0) return resolve(out);
      // rclone schreibt Hinweise (etwa zur auslaufenden client_id) auf stderr — kein Fehler.
      const text = err.split(/\r?\n/).filter((z) => z && !/NOTICE/.test(z)).join(" ").trim();
      // Config-Race: den echten Config-Zustand in genau diesem Moment festhalten (Beweis statt Vermutung).
      const zustand = CONFIG_RACE.test(text) ? configSchnappschuss(args, text) : null;
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

export async function mkdir(pfad) {
  await rclone(["mkdir", `gdrive:${pruefePfad(pfad)}`]);
}

export async function writeFile(pfad, inhalt) {
  await rclone(["rcat", `gdrive:${pruefePfad(pfad)}`], { input: inhalt });
}

export async function readFile(pfad) {
  return rclone(["cat", `gdrive:${pruefePfad(pfad)}`]);
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

// Teilbaren Drive-Link holen. Ein fehlender Pfad liefert "" statt zu werfen — ein Link
// ist Beiwerk, sein Fehlen darf keine Ansicht kippen.
export async function link(pfad) {
  try {
    return (await rclone(["link", `gdrive:${pruefePfad(pfad)}`])).trim();
  } catch {
    return "";
  }
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

// Ist Drive ueberhaupt erreichbar? Fuer die Statusanzeige im Kopf der Oberflaeche.
export async function erreichbar() {
  try {
    await rclone(["lsf", "gdrive:", "--dirs-only", "--max-depth", "1"], { timeoutMs: 30000 });
    return { ok: true, satz: "Google Drive ist erreichbar." };
  } catch (e) {
    return { ok: false, satz: `Google Drive antwortet nicht: ${e.message}` };
  }
}
