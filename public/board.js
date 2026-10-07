// Die Board-Ansicht: Spalten, Kacheln, Ziehen und Ablegen.
//
// Die Kachel ist der Kern der Uebersicht. Sie beantwortet ohne Oeffnen vier Fragen:
// Worum geht es, wo steht es, was ist als Naechstes faellig, und was haelt es auf.

import {
  PHASEN,
  phase,
  phaseIndex,
  ampel,
  drehImFenster,
  tore,
  sperren,
  contenttypFormat,
  contenttypName,
  wochenlast,
  MASSE,
} from "/lib/pipeline.js";
import { S, spalteLive, karte, sichtbareKarten, speichere, zeichne, neueKarte, driveVerschieben, melde, setStand, optimistisch, an, drehtermin, offeneAnlaesse, zeitAmpel } from "./store.js";
import { statusChip, escape, knopf, leer, icon, knopfLaeuft, STATUS, CACHE_SATZ } from "./ui.js";
import { kartenMeldungen } from "/lib/kartenhinweise.js";
import { wochenlastNachPlan } from "/lib/uploadslots.js";
import { holeIdee } from "./nachschub.js";
import { zeigeRedaktionsplan } from "./redaktionsplan.js";
import { zeichneDrehleiste } from "./drehtermine.js";
import { zeigeKontextmenu } from "./kontextmenu.js";

let oeffne = () => {};
export const beiOeffnen = (f) => (oeffne = f);

// Tore, die den Drive-Stand brauchen. Ohne ihn duerfen sie nicht als "offen" gezaehlt
// werden — sonst behauptet die Kachel etwas, das niemand geprueft hat.
const BRAUCHT_DRIVE = new Set(["rohmaterial", "final", "skript-datei", "format-datei"]);

function pruefungen(k) {
  const stand = S.driveStand.get(k.id);
  return tore(k, stand).filter((t) => stand || !BRAUCHT_DRIVE.has(t.id));
}

// Spalten-Kopf-Indikator (v58, Owner 23.09.2026): "sanduhr" solange irgendeine Karte der
// Spalte gerade gescannt wird (Arbeit passiert), "live" sobald mindestens eine Karte echten
// Drive-Stand traegt und nichts mehr laeuft (die Spalte ist mit Drive abgeglichen). Hat noch
// keine Karte der Spalte je einen Scan gesehen, bleibt der Indikator weg — sonst wuerde er
// einen Abgleich behaupten, der nie stattgefunden hat.
// v81: Solange das Board den Cache zeigt, traegt JEDE Spalte das Cache-Zeichen; nach dem
// Drive-Abgleich ist die Spalte live (Haken), auch ohne dass eine ihrer Karten gescannt wurde —
// der Abgleich hat Spaltenliste und Kartenzuordnung aus Drive gelesen.
function spalteDriveStatus(karten, id) {
  if (karten.some((k) => S.driveScanLaeuft.has(k.id))) return "laedt";
  if (!spalteLive(id)) return "cache";
  return "live";
}

// --- Kachel ---------------------------------------------------------------

export function kachel(k) {
  const el = document.createElement("article");
  el.className = "eintrag" + (k.id === S.aktiv ? " aktiv" : "") + (spalteLive(k.column) ? "" : " eintrag-cache");
  if (!spalteLive(k.column)) el.title = CACHE_SATZ;
  el.draggable = true;
  el.dataset.saeule = k.kategorie || "";

  // Format statt Plattform auf der Kachel (v29, Owner-Vorgabe 04.09.2026): auf den ersten
  // Blick zaehlt, ob es ein Reel/Bild/Story/Longform ist — nicht, auf welcher Plattform es
  // laeuft (das steht weiterhin in der Detailspalte). Ein Symbol statt Plattform-Text-Marken.
  const FORMAT_SYMBOL = { Reel: "clip", Carousel: "bild", Bildpost: "bild", Story: "story", Video: "video" };
  const formatName = contenttypFormat(k.contenttyp);
  const formatSymbol = FORMAT_SYMBOL[formatName] || "video";

  // v65 (Owner 24.09.2026): Der Punkt ist eine REINE Zeit-Ampel — er faerbt sich nach der
  // DRINGLICHSTEN relevanten Frist (aktuelle + noch kommende Phasen-Termine plus den zugewiesenen
  // Drehtermin) und mischt sich NICHT mehr mit Sperr-Punkten (das war v64). Offene Blocker und
  // Detail-Warnungen erscheinen jetzt getrennt als gelbes „!" daneben; der Punkt behaelt seine
  // Zeit-Farbe unabhaengig davon. Der zugewiesene Drehtermin zaehlt AUCH bei leerem card.dates.dreh
  // (aus S.drehtermine ueber card.drehterminId aufgeloest) und nur, solange die Karte hoechstens in
  // „videodreh" steht (danach ist der Dreh vorbei). Die Aufloesung passiert hier, weil pipeline.js
  // kein S kennt; die Ampel-Logik selbst liegt in pipeline.js (ampel()).
  const a = zeitAmpel(k); // { status, frist, satz, drehDatum } — reine Zeit (v113: geteilt mit der Detailspalte)
  const drehDatum = a.drehDatum;
  const statusCode = a.status;

  // „!" = Warnung, getrennt vom Punkt und immer im Hinweis-Ton: offene Blocker (offenePunkte) ODER
  // ein Drehtermin ausserhalb des empfohlenen Fensters (drehImFenster, sonst nur im Detail sichtbar).
  // v68: was erscheint, bestimmen die Haken unter Einstellungen > "Hinweise & Warnungen"
  // (lib/kartenhinweise.js). Warnung = roter Befund, Hinweis = fehlend/Empfehlung; Pflichtangaben
  // zaehlen als Hinweis erst bei gelber/roter Frist.
  const drehAusserhalb = !!drehDatum && !drehImFenster(drehDatum, (k.dates || {}).upload);
  const meldungen = kartenMeldungen(pruefungen(k), drehAusserhalb, statusCode !== "ok");
  const satzAus = (liste) => liste.length === 1 ? liste[0] : `${liste[0]} Insgesamt ${liste.length} Punkte.`;
  const hatWarnung = meldungen.warnungen.length > 0;
  const hatHinweis = meldungen.hinweise.length > 0;
  const warnSatz = hatWarnung ? satzAus(meldungen.warnungen) : "";
  const hinweisSatz = hatHinweis ? satzAus(meldungen.hinweise) : "";

  const formatText = contenttypName(k.contenttyp || "reel");

  // Laeuft gerade der Drive-Scan dieser Karte, traegt die Kachel die drehende Sanduhr statt des
  // Punkts. Sonst steht immer der gefuellte Zeit-Punkt (Farbe traegt nie allein — title/aria-label
  // geben den Satz), und links davon bei Bedarf die Warnung (rotes Ausrufezeichen, Icon „warnung")
  // und/oder der Hinweis (gelber Info-Kreis, Icon „info"). Form UND Farbe, plus Satz im Tooltip.
  // Ohne beides entfaellt die breitere Titel-Reservierung (eintrag-hat-achtung / -2).
  const anzahlZeichen = (hatWarnung ? 1 : 0) + (hatHinweis ? 1 : 0);
  el.classList.toggle("eintrag-hat-achtung", anzahlZeichen === 1);
  el.classList.toggle("eintrag-hat-achtung-2", anzahlZeichen === 2);
  const warnHtml = hatWarnung
    ? `<span class="eintrag-achtung" style="color:var(--befund)" title="Warnung: ${escape(warnSatz)}" aria-label="Warnung: ${escape(warnSatz)}">${icon("warnung")}</span>`
    : "";
  const hinweisHtml = hatHinweis
    ? `<span class="eintrag-achtung${hatWarnung ? " eintrag-achtung-zweit" : ""}" style="color:var(--hinweis)" title="Hinweis: ${escape(hinweisSatz)}" aria-label="Hinweis: ${escape(hinweisSatz)}">${icon("info")}</span>`
    : "";
  const statusHtml = S.driveScanLaeuft.has(k.id)
    ? `<span class="eintrag-punkt-lade" title="Drive-Daten werden geladen …" aria-label="Drive-Daten werden geladen …">${icon("sanduhr")}</span>`
    : warnHtml + hinweisHtml +
      `<span class="eintrag-punkt eintrag-punkt-${statusCode}" title="${escape(a.satz)}" aria-label="${escape(a.satz)}"></span>`;

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

    const driveStatus = spalteDriveStatus(karten, p.id);
    const driveStatusHtml =
      driveStatus === "laedt"
        ? `<span class="spalte-drive-status spalte-drive-status-laedt" title="Drive-Daten werden geladen …" aria-label="Drive-Daten werden geladen …">${icon("sanduhr")}</span>`
        : driveStatus === "cache"
          ? `<span class="spalte-drive-status spalte-drive-status-cache" title="${escape(CACHE_SATZ)}" aria-label="${escape(CACHE_SATZ)}">${icon("cache")}</span>`
        : driveStatus === "live"
          ? `<span class="spalte-drive-status spalte-drive-status-live" title="Mit Drive abgeglichen" aria-label="Mit Drive abgeglichen">${icon("check")}</span>`
          : "";

    const kopf = document.createElement("div");
    kopf.className = "spalte-kopf";
    kopf.innerHTML =
      `<div class="spalte-kopf-zeile"><span class="spalte-name">${escape(p.name)}</span>` +
      `<span class="spalte-kopf-rechts">${driveStatusHtml}<span class="spalte-anzahl">${karten.length}</span></span></div>` +
      `<p class="spalte-satz">${escape(p.satz || "")}</p>`;
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

      // v107: je Anlass einer aktiven Kampagne (naechste 60 Tage, noch kein Projekt) ein Knopf mit
      // seinem Namen. Klick = Themenvorschlaege wie "Idee von der KI", Upload am Anlass-Tag.
      for (const a of offeneAnlaesse()) {
        const datum = new Date(a.datum + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
        const wann = a.tage === 0 ? "heute" : a.tage === 1 ? "morgen" : `in ${a.tage} Tagen`;
        const ak = knopf(`${a.anlass} am ${datum}`, {
          zeichen: "kalender",
          titel: `Kampagne „${a.kampagne}“: ${a.anlass} ist ${wann}. Ein Klick holt Themenvorschläge; das Projekt bekommt den Anlass-Tag als Upload-Termin.`,
          klick: async () => {
            const zustand = knopfLaeuft(ak, "startet …");
            try {
              const id = await holeIdee({ anlass: a });
              if (id) oeffne(id);
            } finally { zustand.zurueck(); }
          },
        });
        ak.classList.add("knopf-breit", "knopf-symbol", "knopf-symbol-kalender", "knopf-anlass");
        ak.style.marginBottom = "7px";
        fuss.appendChild(ak);
      }
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
  // v90: gegen den Redaktionsplan (je Format), sobald er geladen ist; bis dahin die alte Faustregel.
  const w = S.plan ? wochenlastNachPlan(S.cards, S.plan) : wochenlast(sichtbareKarten());
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
