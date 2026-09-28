// Board-/Redaktionsplan-Parameter: editierbare Inhaltskategorien und Ziele (v78).
//
// Bis v78 waren INHALTSKATEGORIEN und ZIELE hartkodierte Konstanten in lib/pipeline.js.
// Dieser Store macht sie verwaltbar (hinzufuegen / deaktivieren / Priorisieren) und legt die
// Wahrheit nach Drive — nach demselben Muster wie planstore/workflowstore (v60).
//
// Form der Datei (`System (AI only)/boardparameter.json`):
//   {
//     "kategorien": [{ id, name, satz, aktiv, prioritaet }],
//     "ziele":      [{ id, name, kennzahl, satz, tiefe, aktiv }]
//   }
//
// Fehlt die Datei, wird aus den pipeline.js-Konstanten geseedet (seed()) — nichts geht verloren.
// Fehlertolerant: 20s-Timeout, Cache-Fallback, nie blockieren. Geschrieben wird IMMER zuerst
// lokal (kein Datenverlust), dann nach Drive gespiegelt.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import * as drive from "./drive.js";
import { SYSTEM_ORDNER, INHALTSKATEGORIEN, ZIELE } from "./pipeline.js";

let PFAD = "data/boardparameter.json";

export function setzePfad(p) {
  PFAD = p;
}

const DRIVE_PFAD = `${SYSTEM_ORDNER}/boardparameter.json`;
const DRIVE_TIMEOUT_MS = 20000;

// --- Seed / Migration -----------------------------------------------------

// Neutraler Seed aus den Konstanten. Ohne Plan-Kontext sind alle Kategorien aktiv,
// Prioritaet nach Reihenfolge; alle Ziele aktiv.
export function defaultStand() {
  return {
    kategorien: INHALTSKATEGORIEN.map((k, i) => ({
      id: k.id, name: k.name, satz: k.satz || "", aktiv: true, prioritaet: i + 1,
    })),
    ziele: ZIELE.map((z) => ({
      id: z.id, name: z.name, kennzahl: z.kennzahl || "", satz: z.satz || "", tiefe: !!z.tiefe, aktiv: true,
    })),
  };
}

// Erstlauf-Seed mit verlustfreier Migration: bestehende plan.kategorienFokus (aktiv/prioritaet)
// werden auf den Konstanten-Seed uebernommen. Zielgewichte bleiben im Plan (nur Aktiv=true hier).
export function seed(plan) {
  const stand = defaultStand();
  const fokus = (plan && plan.kategorienFokus) || [];
  for (const k of stand.kategorien) {
    const f = fokus.find((x) => x.id === k.id);
    if (f) {
      if (typeof f.aktiv === "boolean") k.aktiv = f.aktiv;
      if (Number.isFinite(f.prioritaet)) k.prioritaet = f.prioritaet;
    }
  }
  return stand;
}

// --- Cache/Drive-Roh (1:1 workflowstore-Muster) ---------------------------

async function liesCacheRoh() {
  try { return await readFile(PFAD, "utf8"); } catch { return null; }
}

async function schreibCacheRoh(text) {
  try { await mkdir(dirname(PFAD), { recursive: true }); } catch { /* existiert meist schon */ }
  await writeFile(PFAD, text, "utf8");
}

// `null` = Datei fehlt (harmlos); echte Stoerung wirft.
async function liesDriveRoh() {
  try {
    return await drive.readFile(DRIVE_PFAD, { timeoutMs: DRIVE_TIMEOUT_MS });
  } catch (e) {
    if (e && e.fehlend) return null;
    throw e;
  }
}

async function schreibDriveRoh(text) {
  await drive.mkdir(SYSTEM_ORDNER, { timeoutMs: DRIVE_TIMEOUT_MS });
  await drive.writeFile(DRIVE_PFAD, text, { timeoutMs: DRIVE_TIMEOUT_MS });
}

// Wahrheit ist Drive; Drive-Stoerung -> Cache-Fallback; fehlt in Drive -> lokalen Stand einmalig
// hochschreiben (Migration ohne Verlust).
async function liesRoh() {
  const lokal = await liesCacheRoh();
  let ausDrive;
  try {
    ausDrive = await liesDriveRoh();
  } catch {
    return lokal;
  }
  if (ausDrive != null) {
    if (ausDrive !== lokal) {
      try { await schreibCacheRoh(ausDrive); } catch { /* Beiwerk */ }
    }
    return ausDrive;
  }
  if (lokal != null && lokal.trim()) {
    try { await schreibDriveRoh(lokal); } catch { /* best effort */ }
  }
  return lokal;
}

// --- Normalisierung -------------------------------------------------------

function normKategorie(k, i) {
  return {
    id: String(k.id || "").trim() || "kat" + i,
    name: String(k.name || "").trim(),
    satz: String(k.satz || ""),
    aktiv: k.aktiv !== false,
    prioritaet: Number.isFinite(Number(k.prioritaet)) ? Number(k.prioritaet) : i + 1,
  };
}

function normZiel(z, i) {
  return {
    id: String(z.id || "").trim() || "ziel" + i,
    name: String(z.name || "").trim(),
    kennzahl: String(z.kennzahl || ""),
    satz: String(z.satz || ""),
    tiefe: !!z.tiefe,
    aktiv: z.aktiv !== false,
  };
}

function normStand(obj) {
  const o = obj && typeof obj === "object" ? obj : {};
  const kategorien = Array.isArray(o.kategorien) ? o.kategorien.map(normKategorie) : [];
  const ziele = Array.isArray(o.ziele) ? o.ziele.map(normZiel) : [];
  return { kategorien, ziele };
}

// --- Oeffentliche API -----------------------------------------------------

// Aktueller Stand. Fehlt die Datei komplett, wird der Konstanten-Seed geliefert (nicht persistiert —
// das Persistieren mit Migration macht der Aufrufer beim ersten Schreiben ueber seed(plan)).
export async function lies() {
  const roh = await liesRoh();
  if (roh == null || !roh.trim()) return defaultStand();
  try {
    const norm = normStand(JSON.parse(roh));
    if (!norm.kategorien.length && !norm.ziele.length) return defaultStand();
    return norm;
  } catch {
    return defaultStand();
  }
}

// Vollstaendigen Stand schreiben (validiert/normalisiert). Zuerst lokal, dann Drive.
export async function schreib(stand) {
  const norm = normStand(stand);
  const text = JSON.stringify(norm, null, 2);
  await schreibCacheRoh(text);
  try {
    await schreibDriveRoh(text);
  } catch (e) {
    console.warn(`boardparameter: Drive-Spiegelung fehlgeschlagen (lokal gesichert): ${e.message}`);
  }
  return norm;
}

// Bequemer Erstlauf-Seed mit Plan-Migration: nur schreiben, wenn noch nichts existiert.
export async function seedFallsLeer(plan) {
  const roh = await liesRoh();
  if (roh != null && roh.trim()) return normStand(JSON.parse(roh));
  return schreib(seed(plan));
}
