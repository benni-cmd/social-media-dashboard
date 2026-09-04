// Die selbstgebauten Workflows (v27).
//
// WARUM eine zweite Datei neben data/workflows.json:
// `data/workflows.json` speichert per Bauart NUR die Abweichung vom Register — eine leere Datei
// heisst „alles Standard", und spaetere Standard-Aenderungen wandern damit automatisch mit.
// Ein selbstgebauter Workflow hat aber gar keinen Register-Eintrag, von dem er abweichen koennte:
// seine Beschreibung IST die ganze Wahrheit. Beide Bedeutungen in eine Datei zu legen wuerde genau
// die Eigenschaft zerstoeren, die workflows.json heute wertvoll macht. Also: eine Ablage je
// Bedeutung.
//
// Form der Datei — eine Liste, Reihenfolge ist die Anzeigereihenfolge:
//   [ { "id": "eigen-…", "name": "…", "an": true,
//       "ausloeser": { "typ": "karte-spalte-gewechselt" },
//       "bedingungen": [ { "typ": "karte-in-spalte", "spalte": "schnitt" } ],
//       "aktionen": [ { "typ": "meldung-zeigen", "text": "…", "art": "erfolg" } ] } ]

import { readFile, writeFile } from "node:fs/promises";
import { normalisiere, pruefe } from "./workflowblocks.js";

let PFAD = "data/own-workflows.json";

export function setzePfad(p) {
  PFAD = p;
}

export async function lies() {
  try {
    const roh = JSON.parse(await readFile(PFAD, "utf8"));
    if (!Array.isArray(roh)) return [];
    return roh.map(normalisiere);
  } catch {
    return [];
  }
}

async function schreib(liste) {
  await writeFile(PFAD, JSON.stringify(liste, null, 2), "utf8");
}

// Das, was der Builder zeichnet: jeder Workflow in der gemeinsamen Form, plus seine offenen Punkte.
export async function uebersicht() {
  const liste = await lies();
  return liste.map((w) => ({ ...w, fehlt: pruefe(w) }));
}

// Anlegen oder aendern — dieselbe Tuer, weil der Builder beides ueber „Speichern" macht.
// Ein unvollstaendiger Workflow darf gespeichert werden (Entwurf), laeuft aber nicht: die Engine
// ueberspringt alles mit `fehlt.length > 0`, und der Builder sagt es.
export async function setze(roh) {
  const w = normalisiere(roh);
  const liste = await lies();
  const i = liste.findIndex((x) => x.id === w.id);
  if (i >= 0) liste[i] = w;
  else liste.push(w);
  await schreib(liste);
  return uebersicht();
}

export async function loesche(id) {
  const liste = await lies();
  const uebrig = liste.filter((w) => w.id !== id);
  if (uebrig.length === liste.length) throw new Error(`Unbekannter Workflow: ${id}`);
  await schreib(uebrig);
  return uebersicht();
}
