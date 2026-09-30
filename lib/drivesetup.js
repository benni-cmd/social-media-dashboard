// Drive einrichten (v63): welches Google-Konto, welcher Arbeitsordner, Struktur anlegen.
//
// Alles laeuft ueber die schon vorhandene rclone-Anbindung (lib/drive.js) — kein eigener
// Google-API-Zugriff, keine zusaetzlichen Zugangsdaten.

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as drive from "./drive.js";
import { PHASEN, SYSTEM_ORDNER, pruefeStruktur, strukturOrdner } from "./pipeline.js";

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
    const bevorzugt = dateien.find((d) => d.Name === "LIESMICH.md") || dateien.find((d) => d.Name === "spalten.json") || dateien[0];
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
// v87 (Owner 30.09.2026): Die Struktur steht fest (PHASEN). Das Board passt sich nicht an,
// es prueft:
// leer   = keinerlei Inhalt                          -> Struktur wird angelegt
// board  = feste Struktur vollstaendig erkannt       -> wird geladen
// falsch = "System (AI only)" da, Struktur aber nicht -> abgelehnt, `fehler` sagt warum
// fremd  = etwas anderes (kein Board-Ordner)         -> abgelehnt
// Nicht erreichbar/kein Zugriff -> Fehler (nicht "fremd").
export async function pruefeOrdner(id) {
  let ausgabe;
  try {
    ausgabe = await drive.rcloneMitRoot(["lsf", "-R", "--fast-list", "--max-depth", "2", "gdrive:"], id, { timeoutMs: 45000 });
  } catch (e) {
    throw new Error(`Der Ordner ist mit diesem Google-Konto nicht erreichbar (${e.message}).`);
  }
  const eintraege = ausgabe.split(/\r?\n/).filter(Boolean);
  if (eintraege.length === 0) return { art: "leer", eintraege, fehler: [] };
  const ordner = eintraege.filter((e) => e.endsWith("/"));
  if (!ordner.some((e) => e.replace(/\/$/, "") === SYSTEM_ORDNER)) return { art: "fremd", eintraege, fehler: [] };
  const p = pruefeStruktur(ordner);
  return { art: p.ok ? "board" : "falsch", eintraege, fehler: p.fehler };
}

// Ein Satz fuer die Oberflaeche aus dem Pruefergebnis.
export function pruefSatz(p) {
  if (p.art === "leer") return "Der Ordner ist leer — die Board-Struktur wird darin angelegt.";
  if (p.art === "board") return "Die Board-Struktur ist vollständig — sie wird geladen.";
  if (p.art === "falsch") return `Das Board kann diesen Ordner nicht laden: ${p.fehler.join(" ")}`;
  return "Der Ordner ist nicht leer und enthält keine Board-Struktur — bitte einen leeren Ordner wählen.";
}

// --- Struktur anlegen ---------------------------------------------------------------
//
// Legt im (bereits als Root gesetzten) Ordner die feste Struktur an: alle Spaltenordner und
// „System (AI only)" mit einer LIESMICH.md, die Menschen die Struktur erklaert. Ein Upload als
// lokaler Baum (einzeln waeren es ~10 rclone-Aufrufe, gemessen 184 s). Vorhandenes bleibt.
export function liesMich() {
  return [
    "# Board-Struktur (fest)",
    "",
    "Diesen Ordner hat das Social-Media-Board angelegt. Die Struktur ist fest — Ordner hier",
    "nicht umbenennen, verschieben oder löschen, sonst lädt das Board nichts und sagt, warum.",
    "",
    ...PHASEN.map((p) => `- „${p.ordner}“ — ${p.name}: ${p.satz || ""}`),
    `- „${SYSTEM_ORDNER}“ — Einstellungen des Boards (nicht von Hand ändern)`,
    "",
    "Ohne Board: ein Projekt wechselt die Phase, indem man seinen Ordner in den nächsten",
    "Spaltenordner zieht. Jeder Projektordner hat einen Steckbrief.md mit Stand und Terminen.",
    "",
  ].join("\n");
}

export async function legeStrukturAn() {
  const wurzel = await mkdtemp(join(tmpdir(), "board-struktur-"));
  try {
    for (const o of strukturOrdner()) await mkdir(join(wurzel, ...o.split("/")), { recursive: true });
    await writeFile(join(wurzel, SYSTEM_ORDNER, "LIESMICH.md"), liesMich(), "utf8");
    await drive.baumHochladen(wurzel);
  } finally {
    await rm(wurzel, { recursive: true, force: true });
  }
  return { angelegt: strukturOrdner().length };
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
