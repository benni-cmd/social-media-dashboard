// Bens eigene Fassungen der Prompts (v26).
//
// Gespeichert wird NUR, was von der Vorlage abweicht: `data/prompts.json` enthaelt den
// System-Vorspann und die geaenderten Aufgaben, sonst nichts. Zuruecksetzen loescht den
// Eintrag statt den Standard hineinzukopieren — so wandern spaetere Verbesserungen der
// Standard-Vorlagen automatisch mit.
//
// Form der Datei:
//   { "system": "…", "aufgaben": { "recherche": "…" } }

import { readFile, writeFile } from "node:fs/promises";
import {
  PROMPTS,
  SYSTEM_VORLAGE,
  SYSTEM_PLATZHALTER,
  KONTEXT_PLATZHALTER,
  baueSystem,
  baueAufgabe,
  standardPipeline,
  standardRolle,
} from "./ai.js";

let PFAD = "data/prompts.json";

export function setzePfad(p) {
  PFAD = p;
}

const LEER = { system: "", aufgaben: {} };

export async function lies() {
  try {
    const roh = JSON.parse(await readFile(PFAD, "utf8"));
    return {
      system: typeof roh.system === "string" ? roh.system : "",
      aufgaben: roh.aufgaben && typeof roh.aufgaben === "object" ? roh.aufgaben : {},
    };
  } catch {
    return { ...LEER, aufgaben: {} };
  }
}

async function schreib(stand) {
  await writeFile(PFAD, JSON.stringify(stand, null, 2), "utf8");
}

// Der Vorspann, wie er in die naechste Anfrage geht.
export async function systemPrompt(kontext = {}) {
  const stand = await lies();
  return baueSystem(stand.system || "", kontext);
}

// Der Prompt einer Aufgabe, gefuellt mit den Werten der Karte.
export async function aufgabePrompt(task, card, kontext = {}) {
  const stand = await lies();
  const eigen = (stand.aufgaben || {})[task];
  // Rueckwaertskompatibel: nur ein String-Override zaehlt hier noch als Ein-Prompt-Fassung; die
  // Schritt-Fassung (v41) laeuft ueber pipeline()/die Schritt-Ausfuehrung, nicht ueber diese Funktion.
  return baueAufgabe(task, card, typeof eigen === "string" ? eigen : "", kontext);
}

// v41: Die effektive Schritt-Liste hinter einem Knopf — Bens Fassung, sonst der Standard.
// `aufgaben[task]` kann sein: ein String (alte Ein-Prompt-Fassung -> 1 Schritt auf der Standard-
// Rolle, Migration), ein Objekt mit `schritte`, oder fehlen (-> Standard-Pipeline).
export async function pipeline(task) {
  const stand = await lies();
  const eigen = (stand.aufgaben || {})[task];
  if (typeof eigen === "string" && eigen.trim()) return [{ rolle: standardRolle(task), prompt: eigen }];
  if (eigen && Array.isArray(eigen.schritte) && eigen.schritte.length) {
    return eigen.schritte.map((s) => ({ rolle: s.rolle || standardRolle(task), prompt: s.prompt || "" }));
  }
  return standardPipeline(task);
}

// Alles, was der Einstellungs-Tab braucht: Vorlage, Bens Fassung, Platzhalter-Legende,
// und wo der Knopf sitzt, der die Aufgabe ausloest.
export async function uebersicht() {
  const stand = await lies();
  return {
    system: {
      id: "system",
      name: "System-Vorspann",
      hinweis: "Geht als erster Block in JEDEN KI-Aufruf — vor jeder einzelnen Aufgabe.",
      vorlage: SYSTEM_VORLAGE,
      eigen: stand.system || "",
      platzhalter: SYSTEM_PLATZHALTER,
    },
    aufgaben: Object.entries(PROMPTS).map(([id, p]) => ({
      id,
      name: p.name,
      knopf: p.knopf || "",
      ort: p.ort || "",
      vorlage: p.vorlage,
      eigen: (stand.aufgaben || {})[id] || "",
      // v33: Die Kontext-Platzhalter stehen in JEDER Aufgabe zur Verfuegung — sie hier
      // dazuzumischen ist eine Stelle statt zehn Eintraege im Katalog.
      platzhalter: { ...(p.platzhalter || {}), ...KONTEXT_PLATZHALTER },
    })),
  };
}

// Speichert eine Fassung. Leerer Text = zurueck auf die Vorlage.
export async function setze(id, text) {
  const stand = await lies();
  const sauber = typeof text === "string" ? text : "";
  if (id === "system") {
    if (sauber.trim()) stand.system = sauber;
    else delete stand.system;
  } else {
    if (!PROMPTS[id]) throw new Error(`Unbekannte KI-Aufgabe: ${id}`);
    stand.aufgaben = stand.aufgaben || {};
    if (sauber.trim()) stand.aufgaben[id] = sauber;
    else delete stand.aufgaben[id];
  }
  await schreib(stand);
  return stand;
}
