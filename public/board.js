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
  contenttypFormat,
  contenttypName,
  wochenlast,
  MASSE,
} from "/lib/pipeline.js";
import { S, karte, sichtbareKarten, speichere, zeichne, neueKarte, driveVerschieben, melde, setStand, spaltenUmbenennen, setzeSpaltenName, optimistisch, an } from "./store.js";
import { statusChip, escape, knopf, leer, icon, knopfLaeuft, STATUS } from "./ui.js";
import { holeIdee } from "./nachschub.js";
import { zeigeRedaktionsplan } from "./redaktionsplan.js";
import { zeichneDrehleiste } from "./drehtermine.js";
import { zeigeKontextmenu } from "./kontextmenu.js";

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

// Spalten-Kopf-Indikator (v58, Owner 23.09.2026): "sanduhr" solange irgendeine Karte der
// Spalte gerade gescannt wird (Arbeit passiert), "live" sobald mindestens eine Karte echten
// Drive-Stand traegt und nichts mehr laeuft (die Spalte ist mit Drive abgeglichen). Hat noch
// keine Karte der Spalte je einen Scan gesehen, bleibt der Indikator weg — sonst wuerde er
// einen Abgleich behaupten, der nie stattgefunden hat.
function spalteDriveStatus(karten) {
  if (karten.some((k) => S.driveScanLaeuft.has(k.id))) return "laedt";
  if (karten.some((k) => S.driveStand.has(k.id))) return "live";
  return null;
}

// --- Kachel ---------------------------------------------------------------

export function kachel(k) {
  const el = document.createElement("article");
  el.className = "eintrag" + (k.id === S.aktiv ? " aktiv" : "");
  el.draggable = true;
  el.dataset.saeule = k.kategorie || "";

  // Format statt Plattform auf der Kachel (v29, Owner-Vorgabe 04.09.2026): auf den ersten
  // Blick zaehlt, ob es ein Reel/Bild/Story/Longform ist — nicht, auf welcher Plattform es
  // laeuft (das steht weiterhin in der Detailspalte). Ein Symbol statt Plattform-Text-Marken.
  const FORMAT_SYMBOL = { Reel: "clip", Carousel: "bild", Bildpost: "bild", Story: "story", Video: "video" };
  const formatName = contenttypFormat(k.contenttyp);
  const formatSymbol = FORMAT_SYMBOL[formatName] || "video";

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

  const formatText = contenttypName(k.contenttyp || "reel");

  // v32 E2: Laeuft gerade der Drive-Scan dieser Karte, traegt die Kachel die drehende Sanduhr
  // statt des Status-Punkts — „die Drive-Daten sind noch nicht da, gleich aktualisiert sich das".
  // Sobald der Scan landet (store.driveScan zeichnet neu), erscheint der echte Status-Punkt.
  // v56 (v50 V2): Aufmerksamkeits-Zustaende tragen eine Glyphe (Form, nicht nur Farbe, Regel 3) —
  // neutral/ok bleibt schlichter Punkt, damit die Uebersicht knapp bleibt (board.js:56-58).
  const AUFMERKSAM = new Set(["befund", "fehlt"]);
  const statusHtml = S.driveScanLaeuft.has(k.id)
    ? `<span class="eintrag-punkt-lade" title="Drive-Daten werden geladen …" aria-label="Drive-Daten werden geladen …">${icon("sanduhr")}</span>`
    : AUFMERKSAM.has(statusCode)
      ? `<span class="eintrag-punkt eintrag-punkt-glyphe eintrag-punkt-${statusCode}" title="${escape(statusSatz)}" aria-label="${escape(statusSatz)}">${icon((STATUS[statusCode] || {}).icon || "achtung")}</span>`
      : `<span class="eintrag-punkt eintrag-punkt-${statusCode}" title="${escape(statusSatz)}" aria-label="${escape(statusSatz)}"></span>`;

  el.innerHTML =
    `<div class="eintrag-titel">${escape(k.title || "(ohne Titel)")}</div>` +
    `<span class="format-symbol format-${formatSymbol}" title="${escape(formatText)}" aria-label="${escape(formatText)}">${icon(formatSymbol)}</span>` +
    statusHtml;

  el.tabIndex = -1; // programmatisch fokussierbar: das Kontextmenue gibt den Fokus hierher zurueck
  el.addEventListener("click", () => oeffne(k.id));
  // Rechtsklick oeffnet das Karten-Kontextmenue (v54) — ersetzt weder Linksklick noch Drag&Drop.
  el.addEventListener("contextmenu", (e) => zeigeKontextmenu(k, e, el, oeffne));
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
    // Optimistisch (v55): der neue Name steht sofort (lokal in S.spalten), der Drive-Ordner wird
    // im Hintergrund mit umbenannt; scheitert das, geht der Name zurueck und ist wiederholbar.
    // `sichern:null` — Spalten stehen nicht in board.json, der Rename-Endpoint ist die Wahrheit.
    optimistisch({
      anwenden: () => setzeSpaltenName(p.id, neu),
      zuruecknehmen: () => setzeSpaltenName(p.id, alt),
      extern: () => spaltenUmbenennen(p.id, neu),
      was: `Spalte „${neu}" umbenennen`,
      sichern: null,
    }).finally(() => { umbenennenLaeuft = false; });
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
    const karten = sichtbareKarten().filter((c) => c.column === p.id);
    const spalte = document.createElement("section");
    spalte.className = "spalte";

    const driveStatus = spalteDriveStatus(karten);
    const driveStatusHtml =
      driveStatus === "laedt"
        ? `<span class="spalte-drive-status spalte-drive-status-laedt" title="Drive-Daten werden geladen …" aria-label="Drive-Daten werden geladen …">${icon("sanduhr")}</span>`
        : driveStatus === "live"
          ? `<span class="spalte-drive-status spalte-drive-status-live" title="Mit Drive abgeglichen" aria-label="Mit Drive abgeglichen">${icon("check")}</span>`
          : "";

    const kopf = document.createElement("div");
    kopf.className = "spalte-kopf";
    kopf.innerHTML =
      `<div class="spalte-kopf-zeile"><span class="spalte-name" title="Doppelklick zum Umbenennen (benennt den Drive-Ordner mit)">${escape(p.name)}</span>` +
      `<span class="spalte-kopf-rechts">${driveStatusHtml}<span class="spalte-anzahl">${karten.length}</span></span></div>` +
      `<p class="spalte-satz">${escape(p.satz || "")}</p>`;
    kopf.querySelector(".spalte-name").addEventListener("dblclick", (e) => starteUmbenennen(e.currentTarget, p));
    // v50: Die Phasen-Erklaerung (.spalte-satz) ist seit v29 fuer einheitliche Kopfhoehe
    // ausgeblendet — als Header-Tooltip bleibt sie erreichbar, ohne die Hoehe zu brechen.
    if (p.satz) kopf.title = p.satz;
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
      // Karten entstehen nur am Kettenanfang (idee) — spaetere Spalten fuellen sich per Zug.
      l.textContent =
        p.id === "idee"
          ? "Hier liegt nichts. Zieh eine Karte her oder leg unten eine neue an."
          : "Hier liegt nichts. Zieh eine Karte her.";
      liste.appendChild(l);
    }
    for (const k of karten) liste.appendChild(kachel(k));
    spalte.appendChild(liste);

    // Karten entstehen nur am Kettenanfang: „Karte anlegen" und „Idee von der KI" gibt es
    // ausschliesslich in der ersten Spalte (idee). Weiter hinten fuellen sich Spalten per Zug
    // oder Weiter-Schritt — dort wuerde eine Anlage-Option nur eine Karte ohne Vorlauf erzeugen.
    if (p.id === "idee") {
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
      neuKnopf.classList.add("knopf-breit", "knopf-symbol", "knopf-symbol-plus");
      fuss.appendChild(neuKnopf);

      const ideenKnopf = knopf("Idee von der KI", {
        zeichen: "funken",
        titel: "Eine Idee fuer den naechsten freien Upload-Slot recherchieren.",
        klick: async () => {
          neuKnopf.disabled = true;
          // v51: Der Knopf sagt selbst, dass es losgeht — bis das Modal steht, vergeht Zeit.
          const zustand = knopfLaeuft(ideenKnopf, "startet …");
          try {
            const id = await holeIdee(fuss);
            if (id) oeffne(id);
          } finally {
            neuKnopf.disabled = false;
            zustand.zurueck();
          }
        },
      });
      ideenKnopf.classList.add("knopf-breit", "knopf-symbol", "knopf-symbol-funken");
      ideenKnopf.style.marginTop = "7px";
      fuss.appendChild(ideenKnopf);
      spalte.appendChild(fuss);
    }

    boardEl.appendChild(spalte);
  }
}

// Verschiebt eine Karte und zieht den Drive-Ordner mit — optimistisch (v55, 2. Abschnitt): die
// Karte springt SOFORT in die Zielspalte (lokal + board.json), der Drive-Move laeuft im
// Hintergrund. Scheitert er, geht die Karte zurueck und der Bruch ist sichtbar + mit einem Klick
// wiederholbar. Ohne Titel oder mit abgeschaltetem Workflow gibt es nichts extern zu tun.
export function schiebe(k, ziel) {
  const alt = k.column;
  if (!k.title || !an("drive-ordner-mitziehen")) {
    k.column = ziel;
    zeichne();
    return speichere();
  }
  return optimistisch({
    anwenden: () => { k.column = ziel; },
    zuruecknehmen: () => { k.column = alt; },
    extern: () => driveVerschieben(k, ziel),
    was: `„${k.title}" verschieben`,
  });
}

// --- Wochenleiste ---------------------------------------------------------

function zeichneWochenlast(el) {
  if (!el) return;
  const w = wochenlast(sichtbareKarten());
  el.innerHTML = statusChip(w.status) + `<span>${escape(w.satz)}</span>`;

  // Der Redaktionsplan haengt an der Wochenleiste, weil er genau deren Frage beantwortet:
  // wie die naechsten Wochen gefuellt werden.
  const planKnopf = knopf("Redaktionsplan", {
    zeichen: "kalender",
    titel: "Kadenz, Content-Mix, Kategorien und Upload-Slots konfigurieren.",
    klick: () => zeigeRedaktionsplan(),
  });
  planKnopf.classList.add("knopf-symbol", "knopf-symbol-kalender");
  el.appendChild(planKnopf);
}

export { leer };
