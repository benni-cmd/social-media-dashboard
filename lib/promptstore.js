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
  baueSystem,
  baueAufgabe,
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
export async function systemPrompt() {
  const stand = await lies();
  return baueSystem(stand.system || "");
}

// Der Prompt einer Aufgabe, gefuellt mit den Werten der Karte.
export async function aufgabePrompt(task, card) {
  const stand = await lies();
  return baueAufgabe(task, card, (stand.aufgaben || {})[task] || "");
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
      platzhalter: p.platzhalter || {},
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
