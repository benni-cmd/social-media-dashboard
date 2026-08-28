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
import { pfadstueckOk } from "./pipeline.js";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID || "1jjQoeBpIzOdvAawyoSAuMWL2NGiN0mvt";

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

// Ruft rclone auf. Argumente als Array — Leerzeichen in Pfaden ("In Bearbeitung") sind
// damit sicher, ohne Shell-Anfuehrungszeichen.
function rclone(args, { input = null, timeoutMs = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("rclone", [...args, "--drive-root-folder-id", ROOT], { shell: false });
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
      reject(
        new DriveFehler(text || `rclone endete mit Code ${code}`, {
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
