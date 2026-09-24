// Drive einrichten (v63): welches Google-Konto, welcher Arbeitsordner, Struktur anlegen.
//
// Alles laeuft ueber die schon vorhandene rclone-Anbindung (lib/drive.js) — kein eigener
// Google-API-Zugriff, keine zusaetzlichen Zugangsdaten.

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as drive from "./drive.js";
import * as spaltenStore from "./spalten.js";
import { mischeSpalten, SYSTEM_ORDNER } from "./pipeline.js";

// --- Konto ---------------------------------------------------------------------
//
// rclone kennt keinen Befehl fuer die Konto-Mail. Aber Drive liefert bei jeder Datei den
// BESITZER mit (`rclone lsjson --metadata` -> Metadata.owner) — und die Dateien in
// "System (AI only)" hat das Board selbst mit dem verbundenen Konto geschrieben. Der Besitzer
// dieser Dateien IST das verbundene Konto. Kein zweiter Token-Weg, keine hinterlegten
// Fremd-Zugangsdaten. Ohne Board-Dateien im Ordner (frisch gewaehlt, Struktur noch nicht
// angelegt) ist das Konto nicht ableitbar -> null.
let kontoCache = null; // { zeit, root, wert }
const KONTO_TTL_MS = 5 * 60 * 1000;
export function kontoCacheLeeren() { kontoCache = null; }

export async function konto() {
  const root = drive.aktuellerRoot();
  if (kontoCache && kontoCache.root === root && Date.now() - kontoCache.zeit < KONTO_TTL_MS) return kontoCache.wert;
  let wert = null;
  try {
    const out = await drive.rcloneMitRoot(["lsjson", `gdrive:${SYSTEM_ORDNER}`, "--metadata", "--files-only"], root, { timeoutMs: 45000 });
    const dateien = JSON.parse(out || "[]");
    const bevorzugt = dateien.find((d) => d.Name === "spalten.json") || dateien[0];
    const mail = bevorzugt && bevorzugt.Metadata && bevorzugt.Metadata.owner;
    if (mail) wert = { email: mail };
  } catch {
    wert = null;
  }
  kontoCache = { zeit: Date.now(), root, wert };
  return wert;
}

// --- Ordner-ID aus Link oder ID --------------------------------------------------

export function parseOrdnerId(eingabe) {
  const t = String(eingabe || "").trim();
  if (!t) return null;
  const m = t.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || t.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : null;
}

// --- Ordner pruefen -----------------------------------------------------------------
//
// leer   = keinerlei Inhalt                        -> Struktur wird angelegt
// board  = "System (AI only)" liegt darin           -> vom Board angelegt, wird uebernommen
// fremd  = etwas anderes                            -> abgelehnt
// Nicht erreichbar/kein Zugriff -> Fehler (nicht "fremd").
export async function pruefeOrdner(id) {
  let ausgabe;
  try {
    ausgabe = await drive.rcloneMitRoot(["lsf", "gdrive:", "--max-depth", "1"], id, { timeoutMs: 45000 });
  } catch (e) {
    throw new Error(`Der Ordner ist mit diesem Google-Konto nicht erreichbar (${e.message}).`);
  }
  const eintraege = ausgabe.split(/\r?\n/).filter(Boolean);
  if (eintraege.length === 0) return { art: "leer", eintraege };
  if (eintraege.some((e) => e.replace(/\/$/, "") === SYSTEM_ORDNER)) return { art: "board", eintraege };
  return { art: "fremd", eintraege };
}

// --- Struktur anlegen ---------------------------------------------------------------
//
// Legt im (bereits als Root gesetzten) Ordner alle Spalten-Ordner an (samt .phase-Marker) und
// schreibt die Spalten-Konfiguration. Vorhandenes bleibt unangetastet.
export async function legeStrukturAn() {
  const spalten = mischeSpalten(null);
  // Alles als lokaler Baum, EIN Upload: je Spaltenordner ein .phase-Marker (legt den Ordner mit an)
  // plus System (AI only)/spalten.json. Einzeln waeren das ~10 rclone-Aufrufe zu je vielen
  // Sekunden (gemessen: 184 s), als Baum ein einziger.
  const wurzel = await mkdtemp(join(tmpdir(), "board-struktur-"));
  try {
    for (const sp of spalten) {
      if (!sp.ordner) continue;
      await mkdir(join(wurzel, ...sp.ordner.split("/")), { recursive: true });
      await writeFile(join(wurzel, ...sp.ordner.split("/"), ".phase"), sp.id + "\n", "utf8");
    }
    await mkdir(join(wurzel, SYSTEM_ORDNER), { recursive: true });
    await writeFile(join(wurzel, SYSTEM_ORDNER, "spalten.json"), JSON.stringify(spaltenStore.alsConfig(spalten), null, 2), "utf8");
    await drive.baumHochladen(wurzel);
  } finally {
    await rm(wurzel, { recursive: true, force: true });
  }
  return { spalten, angelegt: spalten.filter((s) => s.ordner).length };
}

// --- Konto wechseln -----------------------------------------------------------------
//
// Startet rclones Browser-Anmeldung (`rclone config reconnect gdrive:`). rclone oeffnet den
// Browser selbst und wartet auf den Rueckruf; erst nach erfolgreichem Login wird die Config
// neu geschrieben. Gibt den Prozess zurueck (Aufrufer entscheidet ueber Wartezeit/Abbruch).
export function starteKontoWechsel(configPfad) {
  const args = ["config", "reconnect", "gdrive:", "--auto-confirm"];
  if (configPfad) args.push("--config", configPfad);
  return spawn("rclone", args, { shell: false });
}
