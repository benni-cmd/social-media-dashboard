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
