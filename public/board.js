// Die Board-Ansicht: Spalten, Kacheln, Ziehen und Ablegen.
//
// Die Kachel ist der Kern der Uebersicht. Sie beantwortet ohne Oeffnen vier Fragen:
// Worum geht es, wo steht es, was ist als Naechstes faellig, und was haelt es auf.

import {
  PHASEN,
  phase,
  phaseIndex,
  faelligkeit,
  tore,
  sperren,
  saeuleName,
  plattformName,
  contenttypName,
  wochenlast,
  saeulenVerteilung,
  INHALTSKATEGORIEN,
  MASSE,
} from "/lib/pipeline.js";
import { S, karte, speichere, zeichne, neueKarte, driveVerschieben, melde, setStand } from "./store.js";
import { icon, statusChip, escape, knopf, leer } from "./ui.js";
import { holeIdee } from "./nachschub.js";
import { zeigeRedaktionsplan } from "./redaktionsplan.js";
import { zeichneDrehleiste } from "./drehtermine.js";

let oeffne = () => {};
export const beiOeffnen = (f) => (oeffne = f);

// Tore, die den Drive-Stand brauchen. Ohne ihn duerfen sie nicht als "offen" gezaehlt
// werden — sonst behauptet die Kachel etwas, das niemand geprueft hat.
const BRAUCHT_DRIVE = new Set(["rohmaterial", "final"]);

function offenePunkte(k) {
  const stand = S.driveStand.get(k.id);
  const liste = sperren(tore(k, stand)).filter((t) => stand || !BRAUCHT_DRIVE.has(t.id));
  return liste;
}

// --- Kachel ---------------------------------------------------------------

export function kachel(k) {
  const el = document.createElement("article");
  el.className = "eintrag" + (k.id === S.aktiv ? " aktiv" : "");
  el.draggable = true;
  el.dataset.saeule = k.kategorie || "";

  const untertitel = k.serie
    ? `${k.serie} · Episode ${k.episode || "?"} · ${contenttypName(k.contenttyp || "reel")}`
    : `Einzelvideo · ${contenttypName(k.contenttyp || "reel")}`;

  const marken = [];
  if (k.kategorie) marken.push(`<span class="marke">${escape(saeuleName(k.kategorie))}</span>`);
  for (const p of k.platforms || [])
    marken.push(`<span class="marke marke-${p}">${escape(plattformName(p))}</span>`);

  const f = faelligkeit(k);
  const offen = offenePunkte(k);
  const stand = S.driveStand.get(k.id);

  // Was aufhaelt, hat Vorrang vor dem Termin — sonst sieht die Karte gruen aus, obwohl
  // sie nicht weiterkann.
  const statusZeile = offen.length
    ? statusChip(offen[0].status) +
      `<span>${escape(
        offen.length === 1
          ? offen[0].satz
          : `${offen[0].satz} Insgesamt ${offen.length} Punkte offen, bevor die Karte weiter darf.`
      )}</span>`
    : statusChip(f.status) + `<span>${escape(f.satz)}</span>`;

  // Der Ordnername gehoert nicht abgeschnitten auf die Kachel — abgeschnitten ist er ein
  // Fragment. Auf die Kachel kommt der Zustand, der volle Name in den Hinweistext.
  const driveZeichen = k.driveName
    ? `<span class="eintrag-fuss-rechts" title="${escape(
        stand && stand.vorhanden ? stand.satz : `Der Ordner heisst "${k.driveName}".`
      )}">${icon("ordner")}<span>${
        stand && stand.vorhanden === false ? "Ordner fehlt" : "in Drive"
      }</span></span>`
    : "";

  el.innerHTML =
    `<div class="eintrag-titel">${escape(k.title || "(ohne Titel)")}</div>` +
    `<div class="eintrag-untertitel">${escape(untertitel)}</div>` +
    (marken.length ? `<div class="eintrag-marken">${marken.join("")}</div>` : "") +
    `<div class="eintrag-status">${statusZeile}</div>` +
    (driveZeichen ? `<div class="eintrag-fuss">${driveZeichen}</div>` : "");

  el.addEventListener("click", () => oeffne(k.id));
  el.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", k.id);
    el.classList.add("zieht");
  });
  el.addEventListener("dragend", () => el.classList.remove("zieht"));
  return el;
}

// --- Spalten --------------------------------------------------------------

export function zeichneBoard(boardEl, lastEl) {
  boardEl.innerHTML = "";
  zeichneWochenlast(lastEl);
  zeichneDrehleiste();

  for (const p of PHASEN) {
    const karten = S.cards.filter((c) => c.column === p.id);
    const spalte = document.createElement("section");
    spalte.className = "spalte";

    const kopf = document.createElement("div");
    kopf.className = "spalte-kopf";
    kopf.innerHTML =
      `<div class="spalte-kopf-zeile"><span class="spalte-name">${escape(p.name)}</span>` +
      `<span class="spalte-anzahl">${karten.length}</span></div>` +
      `<p class="spalte-satz">${escape(p.satz)}</p>`;
    spalte.appendChild(kopf);

    const liste = document.createElement("div");
    liste.className = "spalte-liste";
    liste.addEventListener("dragover", (e) => {
      e.preventDefault();
      liste.classList.add("zielt");
    });
    liste.addEventListener("dragleave", () => liste.classList.remove("zielt"));
    liste.addEventListener("drop", async (e) => {
      e.preventDefault();
      liste.classList.remove("zielt");
      const k = karte(e.dataTransfer.getData("text/plain"));
      if (!k || k.column === p.id) return;
      await schiebe(k, p.id);
    });

    if (!karten.length) {
      const l = document.createElement("div");
      l.className = "spalte-leer";
      l.textContent = "Hier liegt nichts. Zieh eine Karte her oder leg unten eine neue an.";
      liste.appendChild(l);
    }
    for (const k of karten) liste.appendChild(kachel(k));
    spalte.appendChild(liste);

    const fuss = document.createElement("div");
    fuss.className = "spalte-fuss";
    const neuKnopf = knopf("Karte anlegen", {
      art: "still",
      zeichen: "plus",
      klick: () => {
        const k = neueKarte(p.id);
        zeichne();
        oeffne(k.id);
      },
    });
    neuKnopf.classList.add("knopf-breit");
    fuss.appendChild(neuKnopf);

    // Nachschub gehoert an den Anfang der Kette, nicht in den Kopf: wer Ideen braucht,
    // steht vor der Idee-Spalte.
    if (p.id === "idee") {
      const ideenKnopf = knopf("Idee von der KI", {
        zeichen: "funken",
        titel: "Eine Idee fuer den naechsten freien Upload-Slot recherchieren.",
        klick: async () => {
          neuKnopf.disabled = true;
          ideenKnopf.disabled = true;
          try {
            const id = await holeIdee(fuss);
            if (id) oeffne(id);
          } finally {
            neuKnopf.disabled = false;
            ideenKnopf.disabled = false;
          }
        },
      });
      ideenKnopf.classList.add("knopf-breit");
      ideenKnopf.style.marginTop = "7px";
      fuss.appendChild(ideenKnopf);
    }
    spalte.appendChild(fuss);

    boardEl.appendChild(spalte);
  }
}

// Verschiebt eine Karte und zieht den Drive-Ordner mit.
export async function schiebe(k, ziel) {
  const alt = k.column;
  k.column = ziel;
  zeichne();
  await speichere();
  if (!k.title) return;
  setStand("Ziehe den Drive-Ordner nach …");
  try {
    await driveVerschieben(k, ziel);
    setStand(`"${k.title}" liegt jetzt in ${phase(ziel).name}, in Drive und im Board.`);
    zeichne();
  } catch (e) {
    // Das Board bleibt fuehrend — aber der Bruch wird gesagt, nicht verschluckt.
    k.column = alt;
    zeichne();
    await speichere();
    await melde("befund", `Der Drive-Ordner liess sich nicht verschieben, die Karte bleibt in ${phase(alt).name}: ${e.message}`);
  }
}

// --- Wochenleiste ---------------------------------------------------------

function zeichneWochenlast(el) {
  if (!el) return;
  const w = wochenlast(S.cards);
  const verteilung = saeulenVerteilung(S.cards.filter((c) => c.kategorie));
  el.innerHTML =
    statusChip(w.status) +
    `<span>${escape(w.satz)}</span>` +
    `<span class="wochenlast-saeulen">` +
    INHALTSKATEGORIEN.map((s) => {
      const v = verteilung.find((x) => x.id === s.id) || { anzahl: 0 };
      return (
        `<span class="saeulen-punkt" title="${escape(s.satz)}">` +
        `<span class="saeulen-marke" style="background:var(--saeule-${s.id})"></span>` +
        `${escape(s.name)}: ${v.anzahl}</span>`
      );
    }).join("") +
    `</span>`;

  // Der Redaktionsplan haengt an der Wochenleiste, weil er genau deren Frage beantwortet:
  // wie die naechsten Wochen gefuellt werden.
  const planKnopf = knopf("Redaktionsplan", {
    zeichen: "kalender",
    titel: "Kadenz, Content-Mix, Kategorien und Upload-Slots konfigurieren.",
    klick: () => zeigeRedaktionsplan(document.getElementById("nachschub")),
  });
  el.appendChild(planKnopf);
}

export { leer };
