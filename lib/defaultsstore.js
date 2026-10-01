// Benutzer-Defaults (v60).
//
// Kleine, flache Vorgaben-Ablage (zuletzt gewaehlte Plattform, Ziel usw.). Bis v60 lag sie nur
// lokal in `data/defaults.json` und wurde direkt in server.js gelesen/gemischt. Jetzt ist die
// Wahrheit Drive (`System (AI only)/defaults.json`), lokal nur Cache — nach dem planstore/
// kontextstore-Muster. Fehlertolerant: 20s-Timeout, Cache-Fallback, nie blockieren. Geschrieben
// wird IMMER zuerst lokal (kein Datenverlust), dann nach Drive gespiegelt.
//
// Form der Datei: ein flaches Objekt, das per `mische()` feldweise zusammengefuehrt wird.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import * as drive from "./drive.js";
import { SYSTEM_ORDNER } from "./pipeline.js";

let PFAD = "data/defaults.json";

export function setzePfad(p) {
  PFAD = p;
}

const DRIVE_PFAD = `${SYSTEM_ORDNER}/defaults.json`;
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

// v94: `streng` (Einrichtung) meldet einen Drive-Fehler weiter, statt ihn nur zu loggen — das
// Speicher-Log darf kein ✓ zeigen, wenn Drive den Stand nicht hat.
async function schreib(obj, { streng = false } = {}) {
  const text = JSON.stringify(obj, null, 2);
  await schreibCacheRoh(text); // zuerst lokal -> nie Datenverlust
  try {
    await schreibDriveRoh(text); // dann Drive spiegeln
  } catch (e) {
    console.warn(`defaults: Drive-Spiegelung fehlgeschlagen (lokal gesichert): ${e.message}`);
    if (streng) throw new Error(`lokal gesichert, Drive nicht erreicht (${e.message})`);
  }
}

// Fuehrt neue Felder in die Vorgaben ein (flache Verschmelzung) und gibt den neuen Stand zurueck.
export async function mische(daten, optionen = {}) {
  const alt = await lies();
  const neu = { ...alt, ...(daten && typeof daten === "object" ? daten : {}) };
  await schreib(neu, optionen);
  return neu;
}
