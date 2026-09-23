// Der eingeschaltete Stand der Automationen (v26).
//
// Gespeichert wird NUR die Abweichung vom Register (lib/workflows.js). Wer nichts angefasst hat,
// hat eine leere Datei — und bekommt damit automatisch spaetere Standard-Aenderungen mit.
//
// Form der Datei:
//   { "auto-shutdown": { "an": true, "params": { "leerlaufMinuten": 90 } } }
//
// v60: Wahrheit liegt in Drive (`System (AI only)/workflows.json`), `data/workflows.json` ist nur
// noch Cache — nach dem planstore/kontextstore-Muster. Fehlertolerant: 20s-Timeout, Cache-Fallback,
// nie blockieren. Geschrieben wird IMMER zuerst lokal (kein Datenverlust), dann nach Drive gespiegelt.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import * as drive from "./drive.js";
import { SYSTEM_ORDNER } from "./pipeline.js";
import { WORKFLOWS, workflow, istAn, param } from "./workflows.js";

let PFAD = "data/workflows.json";

export function setzePfad(p) {
  PFAD = p;
}

const DRIVE_PFAD = `${SYSTEM_ORDNER}/workflows.json`;
const DRIVE_TIMEOUT_MS = 20000;

async function liesCacheRoh() {
  try {
    return await readFile(PFAD, "utf8");
  } catch {
    return null;
  }
}

async function schreibCacheRoh(text) {
  try {
    await mkdir(dirname(PFAD), { recursive: true });
  } catch {
    /* Ordner existiert meist schon */
  }
  await writeFile(PFAD, text, "utf8");
}

// `null` = Datei fehlt (harmlos); echte Stoerung wirft (Aufrufer trennt "fehlt" von "geht nicht").
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

// Wahrheit ist Drive; Drive-Stoerung -> Cache-Fallback; Datei fehlt in Drive -> lokalen Stand
// einmalig hochschreiben (Migration ohne Verlust). Drive-Fehler bleiben ueber lib/ereignisse sichtbar.
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
      try {
        await schreibCacheRoh(ausDrive);
      } catch {
        /* Cache-Auffrischung ist Beiwerk */
      }
    }
    return ausDrive;
  }
  if (lokal != null && lokal.trim()) {
    try {
      await schreibDriveRoh(lokal);
    } catch {
      /* Migration best effort */
    }
  }
  return lokal;
}

export async function lies() {
  const roh = await liesRoh();
  if (roh == null) return {};
  try {
    const obj = JSON.parse(roh);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

async function schreib(stand) {
  const text = JSON.stringify(stand, null, 2);
  await schreibCacheRoh(text); // zuerst lokal -> nie Datenverlust
  try {
    await schreibDriveRoh(text); // dann Drive spiegeln
  } catch (e) {
    console.warn(`workflows: Drive-Spiegelung fehlgeschlagen (lokal gesichert): ${e.message}`);
  }
}

// Das Register plus dem aktuellen Stand — genau das, was der Einstellungs-Tab zeichnet.
export async function uebersicht() {
  const config = await lies();
  return WORKFLOWS.map((w) => ({
    ...w,
    an: istAn(config, w.id),
    params: (w.params || []).map((p) => ({ ...p, wert: param(config, w.id, p.key) })),
  }));
}

// Setzt Schalter und/oder Parameter EINES Workflows. Unbekannte Parameter werden verworfen.
export async function setze(id, { an, params } = {}) {
  const w = workflow(id);
  if (!w) throw new Error(`Unbekannter Workflow: ${id}`);
  const config = await lies();
  const eintrag = config[id] || {};
  if (typeof an === "boolean") eintrag.an = an;
  if (params && typeof params === "object") {
    eintrag.params = eintrag.params || {};
    for (const def of w.params || []) {
      if (!(def.key in params)) continue;
      const roh = params[def.key];
      if (def.typ === "zahl") {
        const z = Number(roh);
        if (!Number.isFinite(z)) continue;
        eintrag.params[def.key] = Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, z));
      } else if (def.typ === "schalter") {
        eintrag.params[def.key] = !!roh;
      } else {
        eintrag.params[def.key] = String(roh);
      }
    }
  }
  config[id] = eintrag;
  await schreib(config);
  return uebersicht();
}
