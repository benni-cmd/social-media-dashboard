// Harte Tests (v115) — isolierte Testumgebung mit Schein-Drive.
//
// Kopiert server.js, lib/, public/ und package.json in ein frisches Temp-Verzeichnis (NIE data/, .env, .git),
// legt einen Schein-Drive an (rclone-Alias auf einen lokalen Ordner, jede Board-rclone-Operation laeuft echt),
// startet den Server auf eigenem Port und richtet den Arbeitsordner ueber die echte API ein. Echtes Drive,
// Bens Zugangsdaten und das Live-Board (Port 4321) werden nie beruehrt. `aufraeumen()` stoppt den Server und
// loescht das Temp-Verzeichnis.
//
// Grenze: Funktionen ueber die Google-Drive-API (Umbenennen, Ordner-Link, geteilte Ablage, Konto) gehen mit dem
// Schein-Drive nicht — die bleiben „nur am echten Drive pruefbar" (v112/v114).

import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdtemp, cp, mkdir, writeFile, rm, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { schlaf, warteBis } from "./gemeinsam.mjs";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIVE_PORT = 4321;

// Selbstsigniertes Zertifikat der Testkopie: Pruefung nur fuer diesen Prozess aus, die Node-Warnung dazu stumm.
const warnung = process.emitWarning;
process.emitWarning = (w, ...rest) => (String(w).includes("NODE_TLS_REJECT_UNAUTHORIZED") ? undefined : warnung.call(process, w, ...rest));
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SCHEIN_ORDNER_ID = "SCHEINDRIVE_hart_0000000000000000";

async function portBelegt(port) {
  try {
    await fetch(`https://localhost:${port}/api/board`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch (e) {
    return !(e.cause && /ECONNREFUSED/.test(String(e.cause.code || e.cause)));
  }
}

export async function starteUmgebung({ port = 4399, einrichten = true } = {}) {
  if (Number(port) === LIVE_PORT) throw new Error("Port 4321 ist das Live-Board — die harten Tests laufen nie dort.");
  if (await portBelegt(port)) throw new Error(`Port ${port} ist belegt — anderen Port waehlen (--port N), fremde Prozesse werden nicht beendet.`);

  const basis = await mkdtemp(join(tmpdir(), "smd-hart-"));
  const code = join(basis, "code");
  const driveDir = join(basis, "drive");
  const appdata = join(basis, "localappdata");
  await mkdir(join(code, "data"), { recursive: true });
  await mkdir(driveDir, { recursive: true });
  await mkdir(appdata, { recursive: true });
  for (const teil of ["server.js", "package.json", "lib", "public"]) await cp(join(REPO, teil), join(code, teil), { recursive: true });
  const conf = join(basis, "rclone.conf");
  await writeFile(conf, `[gdrive]\ntype = alias\nremote = ${driveDir.replace(/\\/g, "/")}\n`);

  const env = { ...process.env, PORT: String(port), RCLONE_CONFIG: conf, LOCALAPPDATA: appdata };
  for (const k of Object.keys(env)) if (k.startsWith("RCLONE_CONFIG_GDRIVE_") || k === "DRIVE_ROOT_FOLDER_ID") delete env[k];
  const logPfad = join(basis, "server.log");
  const log = createWriteStream(logPfad);
  const kind = spawn(process.execPath, ["server.js"], { cwd: code, env, stdio: ["ignore", "pipe", "pipe"] });
  kind.stdout.pipe(log);
  kind.stderr.pipe(log);
  let beendet = null;
  kind.on("exit", (c, s) => { beendet = { code: c, signal: s, zeit: Date.now() }; });

  const url = `https://localhost:${port}`;
  const api = async (methode, pfad, body, { kopf = {}, roh = false, signal, ohneHerkunft = false } = {}) => {
    const headers = { ...(ohneHerkunft ? {} : { origin: url, "sec-fetch-site": "same-origin" }), ...kopf };
    let inhalt = body;
    if (body !== undefined && typeof body !== "string" && !(body instanceof Uint8Array) && !(body instanceof ReadableStream)) {
      inhalt = JSON.stringify(body);
      headers["content-type"] ??= "application/json";
    } else if (typeof body === "string") headers["content-type"] ??= "application/json";
    const res = await fetch(url + pfad, { method: methode, headers, body: inhalt, signal, ...(body instanceof ReadableStream ? { duplex: "half" } : {}) });
    if (roh) return res;
    const text = await res.text();
    let daten = null;
    try { daten = JSON.parse(text); } catch { /* kein JSON */ }
    return { status: res.status, daten, text };
  };
  const lebt = async () => {
    if (beendet) return false;
    try { return (await fetch(url + "/api/board", { signal: AbortSignal.timeout(5000) })).status === 200; } catch { return false; }
  };

  const bereit = await warteBis(lebt, { ms: 40000 });
  if (!bereit) {
    kind.kill();
    const t = existsSync(logPfad) ? await readFile(logPfad, "utf8") : "";
    throw new Error(`Testserver startet nicht (Port ${port}). Log:\n${t.slice(-1500)}`);
  }

  const u = {
    basis, code, driveDir, url, port, api, lebt, logPfad,
    get beendet() { return beendet; },
    async log() { try { return await readFile(logPfad, "utf8"); } catch { return ""; } },
    // Drive-Pfad (relativ zur Wurzel) im Schein-Drive.
    d: (...teile) => join(driveDir, ...teile),
    async aufraeumen() {
      if (!beendet) {
        try { await api("POST", "/api/shutdown", {}); } catch { /* schon weg */ }
        await warteBis(() => !!beendet, { ms: 10000 });
        if (!beendet) kind.kill();
      }
      for (let i = 0; i < 5; i++) {
        try { await rm(basis, { recursive: true, force: true }); return; } catch { await schlaf(500); }
      }
    },
  };

  if (einrichten) {
    const r = await api("POST", "/api/drive/ordner/setzen", { eingabe: SCHEIN_ORDNER_ID });
    if (r.status !== 200) { await u.aufraeumen(); throw new Error(`Schein-Drive einrichten scheiterte: ${r.status} ${r.text.slice(0, 300)}`); }
  }
  return u;
}

// --- Helfer fuer Karten im Testboard ------------------------------------------

export async function leseBoard(u) {
  return (await u.api("GET", "/api/board")).daten;
}

// Legt eine Testkarte an wie der Browser: Board speichern, dann Projektordner in Drive.
export async function neueKarte(u, felder, { mitOrdner = true } = {}) {
  const P = await import("../../lib/pipeline.js");
  const k = P.migriere({ ...P.leereKarte(felder.column || "idee"), kategorie: P.aktiveKategorien()[0].id, goal: P.ZIELE[0].id, ...felder });
  const b = await leseBoard(u);
  const r = await u.api("PUT", "/api/board", { cards: [...b.cards, k], version: b.version });
  if (r.status !== 200) throw new Error(`Testkarte speichern: ${r.status} ${r.text.slice(0, 200)}`);
  if (mitOrdner) {
    const a = await u.api("POST", "/api/drive/create", k);
    if (a.status !== 200) throw new Error(`Testordner anlegen: ${a.status} ${a.text.slice(0, 200)}`);
    k.driveName = a.daten.name;
    const b2 = await leseBoard(u);
    await u.api("PUT", "/api/board", { cards: b2.cards.map((c) => (c.id === k.id ? { ...c, driveName: k.driveName } : c)), version: b2.version });
  }
  return k;
}

// Alle Ordner unterhalb einer Wurzel, deren Name mit `praefix` beginnt (relativ zum Schein-Drive).
export async function findeOrdner(u, praefix) {
  const treffer = [];
  const geh = async (rel) => {
    for (const e of await readdir(join(u.driveDir, rel), { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.name.startsWith(praefix)) treffer.push(r);
      else await geh(r);
    }
  };
  await geh("");
  return treffer.sort();
}

// Dateien (rekursiv, relativ) in einem Schein-Drive-Ordner.
export async function dateienIn(u, rel) {
  const liste = [];
  const geh = async (r) => {
    for (const e of await readdir(join(u.driveDir, r), { withFileTypes: true })) {
      const p = `${r}/${e.name}`;
      if (e.isDirectory()) await geh(p);
      else liste.push(p.slice(rel.length + 1));
    }
  };
  try { await geh(rel); } catch { return null; }
  return liste.sort();
}

export async function groesse(pfad) {
  try { return (await stat(pfad)).size; } catch { return -1; }
}
