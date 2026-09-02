// Selbstheilung der rclone.conf-[gdrive]-Sektion.
//
// Belegter Defekt (02.09.2026, Paket v21): Beim Token-Refresh wurde die Sektion
// unvollstaendig geschrieben — `type` (und `scope`) fehlten, nur `token` blieb. Danach
// scheitert JEDER rclone-Aufruf mit "couldn't find type field in config".
//
// Dieses Modul erkennt genau diesen Zustand und ergaenzt die Struktur-Felder wieder —
// den Token fasst es NIE an, und es legt KEIN zusaetzliches Geheimnis auf Platte
// (Struktur-Snapshot enthaelt weder token noch client_secret). Verlorener Token/Secret
// ist nicht heilbar (dann `rclone config reconnect`) — das meldet die Funktion nur.

import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";

const REMOTE = "gdrive";
// Was ein gdrive-Remote strukturell braucht; type/scope haben sichere Defaults, weil ein
// Google-Drive-Remote per Definition so aussieht. Token/Secret stehen bewusst NICHT hier.
const DEFAULTS = { type: "drive", scope: "drive" };
const STRUKTUR_FELDER = ["type", "scope", "client_id", "team_drive", "root_folder_id"];

// Grenzen der [<name>]-Sektion in einem Zeilenarray: { start (Header), end (exklusiv) }.
function findeSektion(lines, name) {
  const start = lines.findIndex((l) => l.trim() === `[${name}]`);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\[.*\]\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function keysIn(lines, start, end) {
  const keys = {};
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^\s*([a-z_]+)\s*=\s*(.*)$/i);
    if (m) keys[m[1].toLowerCase()] = m[2];
  }
  return keys;
}

const gueltig = (v) => v !== undefined && String(v).trim() !== "";

// Ist die [gdrive]-Sektion defekt (Token da, aber type fehlt)?
export function braucheHeilung(text) {
  const lines = String(text).split(/\r?\n/);
  const s = findeSektion(lines, REMOTE);
  if (!s) return false;
  const k = keysIn(lines, s.start, s.end);
  return gueltig(k.token) && !gueltig(k.type);
}

// Struktur-Felder aus einer GESUNDEN Sektion ziehen (ohne token/client_secret).
export function strukturSnapshot(text) {
  const lines = String(text).split(/\r?\n/);
  const s = findeSektion(lines, REMOTE);
  if (!s) return null;
  const k = keysIn(lines, s.start, s.end);
  if (!gueltig(k.type)) return null; // nur aus gesunder Datei schnappschussen
  const out = {};
  for (const f of STRUKTUR_FELDER) if (gueltig(k[f])) out[f] = k[f].trim();
  return out;
}

// Ergaenzt fehlende Struktur-Felder direkt nach dem [gdrive]-Header. Nur aktiv, wenn `type`
// fehlt (der eigentliche Defekt) — eine gesunde Datei wird nie angefasst. Token bleibt, wo er ist.
// Rueckgabe: { text, geheilt, ergaenzt: [feldnamen] }.
export function heile(text, struktur = {}) {
  const lines = String(text).split(/\r?\n/);
  const s = findeSektion(lines, REMOTE);
  if (!s) return { text, geheilt: false, ergaenzt: [] };
  const k = keysIn(lines, s.start, s.end);
  if (gueltig(k.type)) return { text, geheilt: false, ergaenzt: [] }; // gesund

  const wunsch = { ...DEFAULTS, ...struktur };
  const neueZeilen = [];
  const ergaenzt = [];
  for (const feld of STRUKTUR_FELDER) {
    if (!gueltig(k[feld]) && gueltig(wunsch[feld])) {
      neueZeilen.push(`${feld} = ${wunsch[feld]}`);
      ergaenzt.push(feld);
    }
  }
  if (!neueZeilen.length) return { text, geheilt: false, ergaenzt: [] };

  const neu = [...lines];
  neu.splice(s.start + 1, 0, ...neueZeilen);
  return { text: neu.join("\n"), geheilt: true, ergaenzt };
}

// Datei-Orchestrierung: liest `pfad`, heilt bei Bedarf (atomar via temp+rename), sonst
// aktualisiert den Struktur-Cache. Wirft nie — Heilung ist Absicherung, kein Muss.
export function heileGdriveConfig(pfad, cachePfad) {
  try {
    if (!existsSync(pfad)) return { status: "keine-datei" };
    const text = readFileSync(pfad, "utf8");

    if (braucheHeilung(text)) {
      let struktur = {};
      try {
        if (cachePfad && existsSync(cachePfad)) struktur = JSON.parse(readFileSync(cachePfad, "utf8")) || {};
      } catch {
        /* Cache unlesbar — dann Defaults */
      }
      const { text: neu, geheilt, ergaenzt } = heile(text, struktur);
      if (geheilt) {
        const tmp = String(pfad) + ".heal.tmp";
        writeFileSync(tmp, neu, "utf8");
        renameSync(tmp, pfad);
        return { status: "geheilt", ergaenzt };
      }
      return { status: "defekt-nicht-heilbar" };
    }

    // Gesund: Struktur (ohne Geheimnisse) fuer den naechsten Notfall sichern.
    if (cachePfad) {
      const snap = strukturSnapshot(text);
      if (snap) {
        try {
          writeFileSync(cachePfad, JSON.stringify(snap, null, 2), "utf8");
        } catch {
          /* Cache ist Kür */
        }
      }
    }
    return { status: "gesund" };
  } catch (e) {
    return { status: "fehler", grund: e.message };
  }
}
