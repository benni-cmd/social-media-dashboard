// Bens eigene Fassungen der Prompts (v26).
//
// Gespeichert wird NUR, was von der Vorlage abweicht: `prompts.json` enthaelt den
// System-Vorspann und die geaenderten Aufgaben, sonst nichts. Zuruecksetzen loescht den
// Eintrag statt den Standard hineinzukopieren — so wandern spaetere Verbesserungen der
// Standard-Vorlagen automatisch mit.
//
// Form der Datei:
//   { "system": "…", "aufgaben": { "recherche": "…" } }
//
// v60: Wahrheit liegt in Drive (`System (AI only)/prompts.json`), `data/prompts.json` ist nur
// noch Cache — nach dem planstore/kontextstore-Muster. Firmendaten (Prompts) gehoeren nicht ins
// GitHub-Repo (Intent Owner 23.09.2026). Fehlertolerant: 20s-Timeout, Cache-Fallback, nie
// blockieren. Geschrieben wird IMMER zuerst lokal (kein Datenverlust), dann nach Drive gespiegelt.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import * as drive from "./drive.js";
import { SYSTEM_ORDNER } from "./pipeline.js";
import {
  PROMPTS,
  SYSTEM_VORLAGE,
  SYSTEM_PLATZHALTER,
  KONTEXT_PLATZHALTER,
  baueSystem,
  standardPipeline,
  standardRolle,
} from "./ai.js";

let PFAD = "data/prompts.json";

export function setzePfad(p) {
  PFAD = p;
}

const LEER = { system: "", aufgaben: {} };

const DRIVE_PFAD = `${SYSTEM_ORDNER}/prompts.json`;
// Gleiche Zeitgrenze wie planstore (v42): kurz genug fuer Fail-Fast (<< rclone-90s-Default),
// lang genug fuer einen langsamen-aber-erfolgreichen Cold-Start / Token-Refresh.
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

// Roh-Inhalt aus Drive. `null` = Datei fehlt (harmlos, erwartbar); eine echte Stoerung
// (Timeout, Drive-Fehler) wirft, damit der Aufrufer sie vom "gibt es nicht" unterscheidet.
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

// Der gewinnende Roh-Stand. Wahrheit ist Drive; bei Drive-Stoerung greift der Cache-Fallback
// (nie blockieren). Fehlt die Datei in Drive, aber liegt lokal ein Stand vor, wird er einmalig
// hochgeschrieben (Migration ohne Verlust). Drive-Fehler sind ueber lib/ereignisse sichtbar.
async function liesRoh() {
  const lokal = await liesCacheRoh();
  let ausDrive;
  try {
    ausDrive = await liesDriveRoh();
  } catch {
    return lokal; // Drive gestoert -> Cache-Fallback
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
  // Drive erreichbar, aber Datei fehlt -> lokalen Stand nach Drive migrieren.
  if (lokal != null && lokal.trim()) {
    try {
      await schreibDriveRoh(lokal);
    } catch {
      /* Migration best effort, blockiert nie */
    }
  }
  return lokal;
}

export async function lies() {
  const roh = await liesRoh();
  if (roh == null) return { ...LEER, aufgaben: {} };
  try {
    const obj = JSON.parse(roh);
    return {
      system: typeof obj.system === "string" ? obj.system : "",
      aufgaben: obj.aufgaben && typeof obj.aufgaben === "object" ? obj.aufgaben : {},
    };
  } catch {
    return { ...LEER, aufgaben: {} };
  }
}

async function schreib(stand) {
  const text = JSON.stringify(stand, null, 2);
  await schreibCacheRoh(text); // zuerst lokal -> nie Datenverlust
  try {
    await schreibDriveRoh(text); // dann Drive spiegeln
  } catch (e) {
    // Lokal ist gesichert; der Drive-Fehler ist ueber die Kopfzeilen-Drive-Sektion
    // (lib/ereignisse) sichtbar — nie stumm, aber nie blockierend.
    console.warn(`prompts: Drive-Spiegelung fehlgeschlagen (lokal gesichert): ${e.message}`);
  }
}

// Der Vorspann, wie er in die naechste Anfrage geht.
export async function systemPrompt(kontext = {}) {
  const stand = await lies();
  return baueSystem(stand.system || "", kontext);
}

// v41: reine Fassung — die effektive Schritt-Liste aus einem bereits gelesenen Stand.
// `aufgaben[task]` kann sein: ein String (alte Ein-Prompt-Fassung -> 1 Schritt, Migration), ein
// Objekt mit `schritte`, oder fehlen (-> Standard-Pipeline).
function effektiveSchritte(stand, task) {
  const eigen = (stand.aufgaben || {})[task];
  if (typeof eigen === "string" && eigen.trim()) return [{ rolle: standardRolle(task), prompt: eigen }];
  if (eigen && Array.isArray(eigen.schritte) && eigen.schritte.length) {
    return eigen.schritte.map((s) => ({ rolle: s.rolle || standardRolle(task), prompt: s.prompt || "" }));
  }
  return standardPipeline(task);
}

// Die effektive Schritt-Liste hinter einem Knopf — Bens Fassung, sonst der Standard.
export async function pipeline(task) {
  return effektiveSchritte(await lies(), task);
}

// Alles, was der Schritt-Editor braucht: je Knopf die effektiven Schritte, die Standard-Schritte
// (fuer Zuruecksetzen/Vergleich), ob eine eigene Fassung existiert, die Rollen-Liste und die
// Platzhalter-Legende (inkl. {{vorschritt}}/{{nurJson}}).
export async function uebersicht() {
  const stand = await lies();
  const rollen = [
    { id: "userkomm", name: "Userkommunikation" },
    { id: "recherche", name: "Recherche" },
    { id: "kontext", name: "Kontextabgleich" },
  ];
  const zusatzPlatzhalter = {
    ...KONTEXT_PLATZHALTER,
    vorschritt: "Die Ausgabe des vorigen Schritts (im ersten Schritt leer)",
    nurJson: "Erzwingt eine reine JSON-Antwort (sinnvoll im letzten Schritt)",
  };
  return {
    system: {
      id: "system",
      name: "System-Vorspann",
      hinweis: "Geht als erster Block in jeden Userkommunikations-Schritt — vor dessen Prompt.",
      vorlage: SYSTEM_VORLAGE,
      eigen: stand.system || "",
      platzhalter: SYSTEM_PLATZHALTER,
    },
    rollen,
    aufgaben: Object.entries(PROMPTS).map(([id, p]) => ({
      id,
      name: p.name,
      knopf: p.knopf || "",
      ort: p.ort || "",
      schritte: effektiveSchritte(stand, id),
      standard: standardPipeline(id),
      eigen: !!(stand.aufgaben || {})[id],
      platzhalter: { ...(p.platzhalter || {}), ...zusatzPlatzhalter },
    })),
  };
}

// Speichert eine Fassung. System = Text (leer -> Vorlage). Aufgabe = Schritt-Liste [{rolle,prompt}]
// (leer -> zurueck auf die Standard-Pipeline); ein String zaehlt als 1 Schritt (Migration/alt).
export async function setze(id, value) {
  const stand = await lies();
  if (id === "system") {
    const s = typeof value === "string" ? value : "";
    if (s.trim()) stand.system = s;
    else delete stand.system;
  } else {
    if (!PROMPTS[id]) throw new Error(`Unbekannte KI-Aufgabe: ${id}`);
    stand.aufgaben = stand.aufgaben || {};
    let schritte;
    if (typeof value === "string") schritte = value.trim() ? [{ rolle: standardRolle(id), prompt: value }] : [];
    else if (Array.isArray(value))
      schritte = value
        .map((s) => ({ rolle: s.rolle || standardRolle(id), prompt: String(s.prompt || "") }))
        .filter((s) => s.prompt.trim());
    else schritte = [];
    if (schritte.length) stand.aufgaben[id] = { schritte };
    else delete stand.aufgaben[id];
  }
  await schreib(stand);
  return stand;
}
