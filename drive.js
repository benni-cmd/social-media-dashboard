// Token-freie Google-Drive-Anbindung ueber rclone (Remote `gdrive:`, im Onboarding verbunden).
// Alle Pfade sind relativ zur Testordner-Wurzel (RCLONE_DRIVE_ROOT_FOLDER_ID / DRIVE_ROOT).
// Siehe docs/drive-convention.md und docs/packages/v5-google-drive-phase.md.

import { spawn } from "node:child_process";

const ROOT = process.env.DRIVE_ROOT_FOLDER_ID || "1jjQoeBpIzOdvAawyoSAuMWL2NGiN0mvt";

// Ruft rclone auf. Argumente als Array -> Leerzeichen in Pfaden ("In Bearbeitung") sind sicher,
// kein Shell-Quoting noetig. Optionaler stdin-Text fuer `rcat`.
function rclone(args, input = null) {
  return new Promise((resolve, reject) => {
    const child = spawn("rclone", [...args, "--drive-root-folder-id", ROOT], { shell: false });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      // rclone schreibt Hinweise (retiring client_id) auf stderr, das ist kein Fehler.
      if (code === 0) resolve(out);
      else reject(new Error(err.trim() || `rclone endete mit Code ${code}`));
    });
    if (input != null) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

export async function mkdir(path) {
  await rclone(["mkdir", `gdrive:${path}`]);
}

export async function writeFile(path, content) {
  await rclone(["rcat", `gdrive:${path}`], content);
}

export async function readFile(path) {
  return rclone(["cat", `gdrive:${path}`]);
}

// Liste (Namen). dirsOnly -> nur Ordner. filesOnly -> nur Dateien.
export async function list(path, { dirsOnly = false, filesOnly = false } = {}) {
  const args = ["lsf", `gdrive:${path}`];
  if (dirsOnly) args.push("--dirs-only");
  if (filesOnly) args.push("--files-only");
  const out = await rclone(args).catch(() => "");
  return out.split(/\r?\n/).map((s) => s.replace(/\/$/, "")).filter(Boolean);
}

export async function count(path, filesOnly = true) {
  return (await list(path, { filesOnly })).length;
}

// Teilbaren Drive-Link eines Ordners/einer Datei holen.
export async function link(path) {
  const out = await rclone(["link", `gdrive:${path}`]).catch(() => "");
  return out.trim();
}

// Ordner verschieben (z. B. In Bearbeitung -> Videoauswertung).
export async function moveDir(from, to) {
  await rclone(["move", `gdrive:${from}`, `gdrive:${to}`, "--create-empty-src-dirs"]);
}
