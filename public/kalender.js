// Kalender-Ansicht: was wann faellig ist.
//
// Das Board beantwortet "in welchem Zustand", der Kalender "an welchem Tag". Beide lesen
// dieselben Karten — die Termine stehen in card.dates, ein Feld je Meilenstein.

import { TERMINE, isoDatum, saeuleName } from "/lib/pipeline.js";
import { S, zeichne } from "./store.js";
import { icon, escape, knopf } from "./ui.js";

let oeffne = () => {};
export const beiOeffnen = (f) => (oeffne = f);

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MONATE = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// Alle Termine aller Karten, nach Tag sortiert.
function termineNachTag() {
  const karte = new Map();
  for (const k of S.cards) {
    for (const t of TERMINE) {
      const datum = (k.dates || {})[t.key];
      if (!datum) continue;
      if (!karte.has(datum)) karte.set(datum, []);
      karte.get(datum).push({ kartenId: k.id, titel: k.title, art: t.key, kurz: t.kurz, saeule: k.pillar, zeit: t.key === "upload" ? k.uploadTime : "" });
    }
  }
  return karte;
}

export function zeichneKalender(el) {
  el.innerHTML = "";
  const termine = termineNachTag();
  const monat = S.monat;

  // Kopf mit Monatswechsel
  const kopf = document.createElement("div");
  kopf.className = "kalender-kopf";
  const zurueck = knopf("Voriger Monat", {
    klick: () => {
      S.monat = new Date(monat.getFullYear(), monat.getMonth() - 1, 1);
      zeichne();
    },
  });
  const vor = knopf("Naechster Monat", {
    klick: () => {
      S.monat = new Date(monat.getFullYear(), monat.getMonth() + 1, 1);
      zeichne();
    },
  });
  const heuteKnopf = knopf("Heute", {
    klick: () => {
      S.monat = new Date();
      zeichne();
    },
  });
  const name = document.createElement("span");
  name.className = "kalender-monat";
  name.textContent = `${MONATE[monat.getMonth()]} ${monat.getFullYear()}`;

  kopf.appendChild(zurueck);
  kopf.appendChild(name);
  kopf.appendChild(vor);
  kopf.appendChild(heuteKnopf);

  const legende = document.createElement("span");
  legende.className = "kalender-legende";
  legende.innerHTML = TERMINE.map(
    (t) =>
      `<span class="legende-punkt"><span class="legende-marke marke-${t.key}"></span>${escape(t.name)}</span>`
  ).join("");
  kopf.appendChild(legende);
  el.appendChild(kopf);

  // Raster
  const raster = document.createElement("div");
  raster.className = "kalender-raster";
  for (const tag of WOCHENTAGE) {
    const z = document.createElement("div");
    z.className = "kalender-wochentag";
    z.textContent = tag;
    raster.appendChild(z);
  }

  const erster = new Date(monat.getFullYear(), monat.getMonth(), 1);
  const start = new Date(erster);
  start.setDate(start.getDate() - ((erster.getDay() + 6) % 7)); // auf Montag zurueck
  const heute = isoDatum(new Date());

  for (let i = 0; i < 42; i++) {
    const tag = new Date(start);
    tag.setDate(start.getDate() + i);
    const iso = isoDatum(tag);
    const zelle = document.createElement("div");
    zelle.className =
      "kalender-tag" +
      (tag.getMonth() !== monat.getMonth() ? " fremd" : "") +
      (iso === heute ? " heute" : "");

    const zahl = document.createElement("span");
    zahl.className = "kalender-tag-zahl";
    zahl.textContent = tag.getDate();
    zelle.appendChild(zahl);

    for (const e of termine.get(iso) || []) {
      const t = document.createElement("span");
      t.className = `termin termin-${e.art}`;
      t.title = `${e.kurz}: ${e.titel}${e.saeule ? ` (${saeuleName(e.saeule)})` : ""}`;
      t.innerHTML = `<strong>${escape(e.kurz)}</strong> <span>${escape(e.titel || "(ohne Titel)")}</span>` +
        (e.zeit ? ` <span>${escape(e.zeit)}</span>` : "");
      t.addEventListener("click", () => oeffne(e.kartenId));
      zelle.appendChild(t);
    }
    raster.appendChild(zelle);
  }
  el.appendChild(raster);

  const anzahl = [...termine.entries()].filter(([iso]) => iso.startsWith(
    `${monat.getFullYear()}-${String(monat.getMonth() + 1).padStart(2, "0")}`
  )).reduce((n, [, liste]) => n + liste.length, 0);

  const satz = document.createElement("p");
  satz.className = "feld-hinweis";
  satz.style.marginTop = "12px";
  satz.textContent = anzahl
    ? `In diesem Monat stehen ${anzahl} Termine aus ${S.cards.length} Karten.`
    : "In diesem Monat steht kein Termin. Termine setzt du in der Karte unter „Termine“.";
  el.appendChild(satz);
}

export { icon };
