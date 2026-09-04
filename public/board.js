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
  wochenlast,
  saeulenVerteilung,
  INHALTSKATEGORIEN,
  MASSE,
} from "/lib/pipeline.js";
import { S, karte, speichere, zeichne, neueKarte, driveVerschieben, melde, setStand, spaltenUmbenennen, an } from "./store.js";
import { statusChip, escape, knopf, leer } from "./ui.js";
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

  const marken = [];
  if (k.kategorie) marken.push(`<span class="marke">${escape(saeuleName(k.kategorie))}</span>`);
  for (const p of k.platforms || [])
    marken.push(`<span class="marke marke-${p}">${escape(plattformName(p))}</span>`);

  const f = faelligkeit(k);
  const offen = offenePunkte(k);

  // Was aufhaelt, hat Vorrang vor dem Termin — sonst sieht die Karte gruen aus, obwohl
  // sie nicht weiterkann. Die Kachel zeigt nur noch den Punkt; Wort und Satz stehen in der
  // Detailspalte, damit die Uebersicht knapp bleibt und trotzdem nichts verschwindet.
  const statusCode = offen.length ? offen[0].status : f.status;
  const statusSatz = offen.length
    ? offen.length === 1
      ? offen[0].satz
      : `${offen[0].satz} Insgesamt ${offen.length} Punkte offen, bevor die Karte weiter darf.`
    : f.satz;

  el.innerHTML =
    `<div class="eintrag-titel">${escape(k.title || "(ohne Titel)")}</div>` +
    (marken.length ? `<div class="eintrag-marken">${marken.join("")}</div>` : "") +
    `<span class="eintrag-punkt eintrag-punkt-${statusCode}" title="${escape(statusSatz)}" aria-label="${escape(statusSatz)}"></span>`;

  el.addEventListener("click", () => oeffne(k.id));
  el.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", k.id);
    el.classList.add("zieht");
  });
  el.addEventListener("dragend", () => el.classList.remove("zieht"));
  return el;
}

// --- Spalte umbenennen (v17b): Inline-Edit -> benennt den Drive-Ordner mit ------
let umbenennenLaeuft = false;
function starteUmbenennen(nameEl, p) {
  if (umbenennenLaeuft) return;
  const alt = p.name;
  nameEl.contentEditable = "true";
  nameEl.style.outline = "2px solid var(--akzent, #6a8dff)";
  nameEl.style.borderRadius = "3px";
  nameEl.style.padding = "0 3px";
  nameEl.focus();
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  let fertig = false;
  const beenden = async (speichern) => {
    if (fertig) return;
    fertig = true;
    nameEl.contentEditable = "false";
    nameEl.style.outline = ""; nameEl.style.borderRadius = ""; nameEl.style.padding = "";
    const neu = nameEl.textContent.trim();
    if (!speichern || !neu || neu === alt) {
      nameEl.textContent = alt;
      return;
    }
    umbenennenLaeuft = true;
    setStand("Benenne Spalte und Drive-Ordner um …");
    try {
      await spaltenUmbenennen(p.id, neu);
      setStand(`Spalte heisst jetzt "${neu}" — im Board und in Drive.`);
    } catch (e) {
      nameEl.textContent = alt;
      await melde("befund", `Umbenennen ging nicht: ${e.message}`);
    } finally {
      umbenennenLaeuft = false;
    }
  };

  nameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
    else if (e.key === "Escape") { e.preventDefault(); fertig = true; nameEl.contentEditable = "false"; nameEl.classList.remove("spalte-name-edit"); nameEl.textContent = alt; }
  });
  nameEl.addEventListener("blur", () => beenden(true), { once: true });
}

// --- Spalten --------------------------------------------------------------

export function zeichneBoard(boardEl, lastEl) {
  boardEl.innerHTML = "";
  zeichneWochenlast(lastEl);
  zeichneDrehleiste();

  // Spalten kommen aus Drive (v17b). Ist der Stand noch nicht geladen, greifen die PHASEN-Defaults.
  const spalten = S.spalten && S.spalten.length ? S.spalten : PHASEN;

  for (const p of spalten) {
    const karten = S.cards.filter((c) => c.column === p.id);
    const spalte = document.createElement("section");
    spalte.className = "spalte";

    const kopf = document.createElement("div");
    kopf.className = "spalte-kopf";
    kopf.innerHTML =
      `<div class="spalte-kopf-zeile"><span class="spalte-name" title="Doppelklick zum Umbenennen (benennt den Drive-Ordner mit)">${escape(p.name)}</span>` +
      `<span class="spalte-anzahl">${karten.length}</span></div>` +
      `<p class="spalte-satz">${escape(p.satz || "")}</p>`;
    kopf.querySelector(".spalte-name").addEventListener("dblclick", (e) => starteUmbenennen(e.currentTarget, p));
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
  // Workflow "drive-ordner-mitziehen" (v26): aus laeuft das Board bewusst ohne Drive-Nachzug.
  if (!an("drive-ordner-mitziehen")) return;
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
