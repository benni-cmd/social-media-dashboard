// Die Engine der selbstgebauten Workflows (v27).
//
// Ein Builder, der nur Zettel produziert, ist kein Builder. Diese Datei ist die Stelle, an der aus
// der gespeicherten Beschreibung eine echte Wirkung wird: das Board feuert an seinen Fundstellen
// ein Ereignis, die Engine sucht die passenden Workflows, prueft ihre Bedingungen und fuehrt ihre
// Aktionen aus.
//
// Was sie NICHT tut: die eingebauten Neun anfassen. Die haengen weiter fest an ihren Fundstellen
// und fragen dort `an(id)` — die Engine kennt sie nur als Beschreibung, nie als Auftrag.
//
// Sie laeuft im BROWSER. Ein selbstgebauter Workflow wirkt also, waehrend das Board offen ist —
// das steht so auch im Einstellungs-Tab, statt es zu verschweigen.
//
// Gefeuert wird heute an zwei Fundstellen:
//   public/store.js — neueKarte  -> "karte-angelegt"
//   public/board.js — schiebe    -> "karte-spalte-gewechselt"
// Jeder weitere Ausloeser im Katalog traegt `nurEingebaut: true`, solange ihn niemand feuert.

import { pruefe } from "/lib/workflowblocks.js";

const leseTief = (objekt, pfad) =>
  String(pfad).split(".").reduce((o, t) => (o == null ? o : o[t]), objekt);

function setzeTief(objekt, pfad, wert) {
  const teile = String(pfad).split(".");
  let ziel = objekt;
  for (const t of teile.slice(0, -1)) {
    if (!ziel[t] || typeof ziel[t] !== "object") ziel[t] = {};
    ziel = ziel[t];
  }
  ziel[teile[teile.length - 1]] = wert;
}

// --- Bedingungen ---------------------------------------------------------------------------
//
// Jede Bedingung ist eine reine Frage an Karte und Ereignis — keine Bedingung veraendert etwas.

export function pruefeBedingung(b, kontext) {
  const k = kontext.karte || {};
  switch (b.typ) {
    case "karte-in-spalte":
      return k.column === b.spalte;

    case "spaltenwechsel": {
      if (b.von && kontext.von !== b.von) return false;
      if (b.nach && kontext.nach !== b.nach) return false;
      return true;
    }

    case "plattform-gewaehlt":
      return Array.isArray(k.platforms) && k.platforms.includes(b.plattform);

    case "feld-vergleich": {
      const ist = leseTief(k, b.feld);
      const soll = b.wert === undefined || b.wert === null ? "" : String(b.wert);
      const alsText = ist === undefined || ist === null ? "" : String(ist);
      switch (b.vergleich) {
        case "ist":
          if (typeof ist === "boolean") return ist === (soll === "true" || soll === "ja" || soll === "1");
          return alsText === soll;
        case "ist-nicht":
          return alsText !== soll;
        case "enthaelt":
          return alsText.toLowerCase().includes(soll.toLowerCase());
        case "gefuellt":
          return alsText !== "" && ist !== false;
        case "leer":
          return alsText === "" || ist === false;
        case "groesser":
          return Number(ist) > Number(soll);
        case "kleiner":
          return Number(ist) < Number(soll);
        default:
          return false;
      }
    }

    default:
      // Ein Baustein, den die Engine nicht kennt, gilt als NICHT erfuellt — lieber nichts tun als
      // etwas Falsches tun. In den Builder kommt er ohnehin nicht (nur `ausfuehrbar: true`).
      return false;
  }
}

// --- Aktionen ------------------------------------------------------------------------------
//
// Dynamische Importe, weil store.js und board.js diese Datei ihrerseits benutzen — ein statischer
// Import waere ein Ring. Zur Laufzeit sind beide Module laengst geladen.

export async function fuehreAus(a, kontext) {
  const k = kontext.karte;
  switch (a.typ) {
    case "karte-verschieben": {
      if (!k || !a.ziel || k.column === a.ziel) return false;
      const { schiebe } = await import("./board.js");
      await schiebe(k, a.ziel);
      return true;
    }

    case "feld-setzen": {
      if (!k || !a.feld) return false;
      const def = (await import("/lib/workflowblocks.js")).feldDef(a.feld);
      if (!def || def.nurLesen) return false;
      let wert = a.wert === undefined ? "" : a.wert;
      if (def.typ === "zahl") wert = Number(wert) || 0;
      if (def.typ === "schalter") wert = wert === true || wert === "true" || wert === "ja" || wert === "1";
      setzeTief(k, a.feld, wert);
      const store = await import("./store.js");
      await store.speichere();
      store.zeichne();
      return true;
    }

    case "meldung-zeigen": {
      const { meldung } = await import("./ui.js");
      meldung(String(a.text || ""), a.art === "fehler" ? "fehler" : "erfolg");
      return true;
    }

    case "drive-ordner-anlegen": {
      if (!k || !k.title || k.driveName) return false;
      const store = await import("./store.js");
      await store.driveAnlegen(k);
      return true;
    }

    default:
      return false;
  }
}

// --- Der Lauf ------------------------------------------------------------------------------

// Wie tief darf ein Workflow einen anderen ausloesen? Die Aktion „Karte verschieben" feuert
// selbst wieder „karte-spalte-gewechselt" — zwei Workflows, die sich gegenseitig schieben,
// wuerden das Board sonst festfahren. Drei Stufen reichen fuer jede sinnvolle Kette.
const MAX_TIEFE = 3;
let tiefe = 0;

// Ereignis feuern. `kontext` traegt mindestens `karte`, beim Spaltenwechsel zusaetzlich
// `von`/`nach`. Wirft NIE nach aussen: ein kaputter eigener Workflow darf das Board nicht
// anhalten — er meldet sich stattdessen.
export async function feuere(ereignis, kontext = {}) {
  if (tiefe >= MAX_TIEFE) return [];
  let liste;
  try {
    const { S } = await import("./store.js");
    liste = Array.isArray(S.eigeneWorkflows) ? S.eigeneWorkflows : [];
  } catch {
    return [];
  }

  const gelaufen = [];
  tiefe += 1;
  try {
    for (const w of liste) {
      if (!w || w.an === false) continue;
      if (!w.ausloeser || w.ausloeser.typ !== ereignis) continue;
      if (pruefe(w).length) continue; // unvollstaendiger Entwurf laeuft nicht
      try {
        const bedingungen = Array.isArray(w.bedingungen) ? w.bedingungen : [];
        if (!bedingungen.every((b) => pruefeBedingung(b, kontext))) continue;
        for (const a of w.aktionen || []) await fuehreAus(a, kontext);
        gelaufen.push(w.id);
      } catch (e) {
        try {
          const { meldung } = await import("./ui.js");
          meldung(`Der Workflow „${w.name}“ lief auf einen Fehler: ${e.message}`, "fehler");
        } catch {
          /* ohne UI bleibt nur das Weglaufen */
        }
      }
    }
  } finally {
    tiefe -= 1;
  }
  return gelaufen;
}
