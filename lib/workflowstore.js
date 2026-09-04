// Der eingeschaltete Stand der Automationen (v26).
//
// Gespeichert wird NUR die Abweichung vom Register (lib/workflows.js). Wer nichts angefasst hat,
// hat eine leere Datei — und bekommt damit automatisch spaetere Standard-Aenderungen mit.
//
// Form der Datei:
//   { "auto-shutdown": { "an": true, "params": { "leerlaufMinuten": 90 } } }

import { readFile, writeFile } from "node:fs/promises";
import { WORKFLOWS, workflow, istAn, param } from "./workflows.js";

let PFAD = "data/workflows.json";

export function setzePfad(p) {
  PFAD = p;
}

export async function lies() {
  try {
    const roh = JSON.parse(await readFile(PFAD, "utf8"));
    return roh && typeof roh === "object" ? roh : {};
  } catch {
    return {};
  }
}

async function schreib(stand) {
  await writeFile(PFAD, JSON.stringify(stand, null, 2), "utf8");
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
