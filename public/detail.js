// Die Detailspalte: alles zu EINER Karte.
//
// Reihenfolge folgt dem Arbeitsweg, nicht der Datenstruktur: Was ist das · Wann ist es
// faellig · Was ist noch offen · Die Arbeit dieser Phase · Drive · Archiv.

import {
  PHASEN,
  TERMINE,
  CONTENTTYPEN,
  INHALTSKATEGORIEN,
  ZIELE,
  PLATTFORMEN,
  MASSE,
  DATEINAMEN,
  phase,
  naechstePhase,
  faelligkeit,
  tore,
  sperren,
  rueckwaertsplan,
  einfacherPlan,
  vorschlagUploadDatum,
  isoDatum,
  sprechzeit,
  saeuleName,
  plattformName,
  contenttypName,
  zielInfo,
  projektName,
  deutschesDatum,
  POSTZEITEN,
} from "/lib/pipeline.js";
import {
  S,
  karte,
  aktiveKarte,
  speichere,
  zeichne,
  loescheKarte,
  driveScan,
  driveAnlegen,
  driveSpeichern,
  ki,
  kiStream,
  melde,
  setStand,
  speichereDefaults,
  ladePlan,
  slotBelegen,
} from "./store.js";
import {
  icon,
  statusChip,
  escape,
  knopf,
  feld,
  feldMitInfo,
  eingabe,
  textfeld,
  auswahl,
  gruppe,
  befundZeile,
  eigenschaft,
  fortschritt,
  denkPanel,
  modalDatum,
  infoTipp,
  meldung,
  bestaetigen,
} from "./ui.js";

let schiebe = async () => {};
export const beiSchieben = (f) => (schiebe = f);

const KI_NAMEN = {
  recherche: "Recherche und Fokus",
  hooks_verbal: "Verbale Hooks",
  hooks_visuell: "Visuelle Hooks",
  skript: "Skript schreiben",
  caption: "Captions je Plattform",
  ideen: "Ideen-Nachschub",
};

// Nur Phasen mit einer generischen Knopfreihe. Idee und Skript haben eigene, gefuehrte Abläufe.
const PHASEN_KI = {
  caption: ["caption"],
};

export function zeichneDetail(el) {
  const k = aktiveKarte();
  if (!k) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  const p = phase(k.column);
  const stand = S.driveStand.get(k.id);
  const toreListe = tore(k, stand);

  el.innerHTML = "";

  // --- Kopf ---
  const kopf = document.createElement("div");
  kopf.className = "detail-kopf";
  kopf.innerHTML = `<span class="detail-phase">${escape(p.name)}</span>`;
  const zu = document.createElement("button");
  zu.className = "detail-schliessen";
  zu.setAttribute("aria-label", "Karte schliessen");
  zu.innerHTML = icon("schliessen");
  zu.addEventListener("click", () => {
    S.aktiv = null;
    zeichne();
  });
  kopf.appendChild(zu);
  el.appendChild(kopf);

  const koerper = document.createElement("div");
  koerper.className = "detail-koerper";
  el.appendChild(koerper);

  const merke = (pfad, wert, neuZeichnen = false) => {
    setzeTief(k, pfad, wert);
    speichere();
    if (neuZeichnen) zeichne();
  };

  // --- Worum geht es ---
  koerper.appendChild(blockStamm(k, merke));

  const istIdee = k.column === "idee";
  const stammFertig = !!(k.title && k.kategorie && k.goal);

  // --- Termine (in Idee erst nach Stamm-Daten) ---
  if (!istIdee || stammFertig) koerper.appendChild(blockTermine(k, merke));

  // --- Die Arbeit dieser Phase (in Idee erst nach Termin) ---
  const terminFertig = !!(k.dates && k.dates.upload);
  const arbeit = blockPhase(k, toreListe, stand);
  if (arbeit && (!istIdee || (stammFertig && terminFertig))) koerper.appendChild(arbeit);

  // --- Drive ---
  koerper.appendChild(blockDrive(k, stand));

  // --- Archiv ---
  if (k.ai && Object.keys(k.ai).length) koerper.appendChild(blockArchiv(k));

  // --- Weiter und Loeschen ---
  koerper.appendChild(blockAbschluss(k, toreListe));

  // Drive-Stand nachladen, falls noch nicht geschehen.
  if (!stand && k.title) {
    driveScan(k)
      .then(() => {
        if (S.aktiv === k.id) zeichne();
      })
      .catch(() => {});
  }
}

// --- Bloecke --------------------------------------------------------------

function blockStamm(k, merke) {
  const g = gruppe("Worum geht es", null, true);
  const box = document.createElement("div");

  const titel = eingabe(k.title, { platzhalter: "Thema in einem Halbsatz" });
  titel.addEventListener("input", () => merke("title", titel.value));
  titel.addEventListener("change", () => zeichne());
  box.appendChild(feld("Thema", titel));

  // Content-Typ: Single-Select Toggle-Buttons
  box.appendChild(feld("Typ", einzelwahlReihe(CONTENTTYPEN, k.contenttyp || "", (id) => merke("contenttyp", id, true))));

  // Kategorie (ex Content-Saeule): Single-Select Toggle-Buttons
  box.appendChild(feld("Kategorie", einzelwahlReihe(INHALTSKATEGORIEN, k.kategorie || "", (id) => merke("kategorie", id, true))));

  // Ziel: Single-Select Toggle-Buttons
  box.appendChild(feldMitInfo("Ziel", einzelwahlReihe(ZIELE, k.goal || "", (id) => merke("goal", id, true)), k.goal ? `Gemessen wird an: ${zielInfo(k.goal).kennzahl}.` : ""));

  // Plattformen: Multi-Select Toggle-Buttons
  const plattformen = document.createElement("div");
  plattformen.className = "schalterreihe";
  for (const pl of PLATTFORMEN) {
    const an = (k.platforms || []).includes(pl.id);
    const l = document.createElement("label");
    l.className = "schalter" + (an ? " an" : "");
    l.innerHTML = `<input type="checkbox" ${an ? "checked" : ""}><span>${escape(pl.name)}</span>`;
    l.querySelector("input").addEventListener("change", (e) => {
      const liste = new Set(k.platforms || []);
      e.target.checked ? liste.add(pl.id) : liste.delete(pl.id);
      merke("platforms", [...liste], true);
    });
    plattformen.appendChild(l);
  }
  const plWrap = feld("Plattformen", plattformen);

  const defaultPl = new Set(S.defaults.plattformen || []);
  const aktuellPl = new Set(k.platforms || []);
  const weichtAb = aktuellPl.size !== defaultPl.size || [...aktuellPl].some((p) => !defaultPl.has(p));
  if (weichtAb && k.platforms && k.platforms.length) {
    const stdBtn = knopf("Neuen Standard speichern", {
      klick: async (e) => {
        try {
          await speichereDefaults({ plattformen: [...k.platforms] });
          e.currentTarget.remove();
          meldung("Plattform-Standard gespeichert.", "erfolg");
        } catch {
          meldung("Standard konnte nicht gespeichert werden.", "fehler");
        }
      },
    });
    stdBtn.classList.add("standard-speichern");
    plWrap.appendChild(stdBtn);
  }
  box.appendChild(plWrap);
  g.appendChild(box);

  const { d, box: mehr } = klappe("Weitere Angaben");
  const reihe = document.createElement("div");
  reihe.className = "feld-reihe";
  const serie = eingabe(k.serie, { platzhalter: "z. B. ProjectOasis" });
  serie.addEventListener("change", () => merke("serie", serie.value, true));
  const episode = eingabe(k.episode, { platzhalter: "01" });
  episode.addEventListener("change", () => merke("episode", episode.value, true));
  reihe.appendChild(feld("Reihe", serie));
  const epFeld = feld("Episode", episode);
  epFeld.classList.add("feld-schmal");
  reihe.appendChild(epFeld);
  mehr.appendChild(reihe);

  const wer = eingabe(k.owner, { platzhalter: "Wer macht das?" });
  wer.addEventListener("change", () => merke("owner", wer.value));
  mehr.appendChild(feld("Verantwortlich", wer));

  const notizen = textfeld(k.notes, 3, "Was gehoert noch dazu?");
  notizen.addEventListener("change", () => merke("notes", notizen.value));
  mehr.appendChild(feld("Notizen", notizen));

  g.appendChild(d);
  return g;
}

// Single-Select Toggle-Buttons: klick waehlt, nochmal klick deselektiert.
function einzelwahlReihe(optionen, aktuell, beiWahl) {
  const reihe = document.createElement("div");
  reihe.className = "schalterreihe";
  for (const o of optionen) {
    const an = aktuell === o.id;
    const l = document.createElement("label");
    l.className = "schalter" + (an ? " an" : "");
    l.innerHTML = `<input type="radio" name="_ew" ${an ? "checked" : ""}><span>${escape(o.name)}</span>`;
    l.querySelector("input").addEventListener("change", () => beiWahl(o.id));
    l.addEventListener("click", (e) => {
      if (an) { e.preventDefault(); beiWahl(""); }
    });
    reihe.appendChild(l);
  }
  return reihe;
}

function blockTermine(k, merke) {
  const istIdee = k.column === "idee";

  if (istIdee) return blockTermineIdee(k, merke);

  const f = faelligkeit(k);
  const g = gruppe("Termin", null, true);
  const box = document.createElement("div");

  const satz = document.createElement("div");
  satz.className = "befund";
  satz.innerHTML = statusChip(f.status) + `<span class="befund-satz">${escape(f.satz)}</span>`;
  box.appendChild(satz);

  const hatUpload = (k.dates || {}).upload;
  if (hatUpload) {
    const zeile = document.createElement("div");
    zeile.className = "termin-kompakt";
    zeile.innerHTML = `<span>Uploaddatum: <strong>${deutschesDatum(hatUpload)}</strong>${k.uploadTime ? ` · ${k.uploadTime}` : ""}</span>`;
    const bearbeiten = knopf("bearbeiten", {
      zeichen: "kalender",
      klick: () => {
        modalDatum(
          "Upload-Datum aendern",
          "Dreh wird automatisch 2 Wochen vorher gesetzt.",
          (datum) => {
            merke("dates", einfacherPlan(datum), true);
            setStand(`Upload am ${deutschesDatum(datum)}.`);
          }
        );
      },
    });
    bearbeiten.classList.add("knopf-inline");
    zeile.appendChild(bearbeiten);
    box.appendChild(zeile);
  } else {
    const uZeile = document.createElement("div");
    uZeile.className = "feld-reihe";
    const uDatum = eingabe("", { typ: "date" });
    uDatum.addEventListener("change", () => setzeTermin(k, "upload", uDatum.value, merke));
    uZeile.appendChild(feld("Veroeffentlichung", uDatum));
    const uZeit = eingabe(k.uploadTime || "", { typ: "time" });
    uZeit.addEventListener("change", () => merke("uploadTime", uZeit.value, true));
    const zf = feld("Uhrzeit", uZeit);
    zf.classList.add("feld-schmal");
    uZeile.appendChild(zf);
    box.appendChild(uZeile);
  }

  g.appendChild(box);

  const { d, box: details } = klappe("Termine verwalten");
  details.appendChild(miniKalender(k));

  const plan = knopf("Restliche Termine rueckwaerts planen", {
    zeichen: "kalender",
    titel: "Setzt Idee, Skript, Dreh, Schnitt und Freigabe rueckwaerts vom Veroeffentlichungsdatum.",
    klick: () => {
      const upload = (k.dates || {}).upload;
      if (!upload) {
        melde("hinweis", "Setz zuerst das Veroeffentlichungsdatum — daraus rechnet der Plan rueckwaerts.");
        return;
      }
      merke("dates", { ...rueckwaertsplan(upload), upload }, true);
      setStand("Die uebrigen Termine stehen jetzt rueckwaerts vom Upload-Datum.");
    },
  });
  plan.classList.add("knopf-breit");
  details.appendChild(plan);

  for (const t of TERMINE) {
    const zeile = document.createElement("div");
    zeile.className = "feld-reihe";
    const datum = eingabe((k.dates || {})[t.key] || "", { typ: "date" });
    datum.addEventListener("change", () => setzeTermin(k, t.key, datum.value, merke));
    zeile.appendChild(feld(t.name, datum));
    details.appendChild(zeile);
  }
  g.appendChild(d);
  return g;
}

// Vereinfachter Terminblock fuer die Idee-Phase: Vorschlag + Akzeptieren oder manuell.
function blockTermineIdee(k, merke) {
  const g = gruppe("Termin", null, true);
  const box = document.createElement("div");
  const hatDatum = (k.dates || {}).upload;

  if (hatDatum) {
    // Kompakte Ansicht: eine Zeile + Bearbeiten-Button.
    const zeile = document.createElement("div");
    zeile.className = "termin-kompakt";
    zeile.innerHTML = `<span>Uploaddatum: <strong>${deutschesDatum(hatDatum)}</strong></span>`;
    const bearbeiten = knopf("bearbeiten", {
      zeichen: "kalender",
      klick: () => {
        modalDatum(
          "Upload-Datum aendern",
          "Dreh wird automatisch 2 Wochen vorher gesetzt.",
          (datum) => {
            merke("dates", einfacherPlan(datum), true);
            setStand(`Upload am ${deutschesDatum(datum)}.`);
          }
        );
      },
    });
    bearbeiten.classList.add("knopf-inline");
    zeile.appendChild(bearbeiten);
    box.appendChild(zeile);
  } else {
    // 2 Kacheln: oben nächstes freies Datum, unten manuell.
    const kacheln = document.createElement("div");
    kacheln.className = "termin-kacheln";

    // Obere Kachel: nächstes freies Datum aus Redaktionsplan (async befüllt).
    const slotKachel = document.createElement("div");
    slotKachel.className = "termin-kachel termin-kachel-slot";
    slotKachel.innerHTML = `<span class="termin-kachel-label">Naechstes freies Datum</span><span class="termin-kachel-datum">Wird geladen …</span>`;
    slotKachel.style.cursor = "wait";
    kacheln.appendChild(slotKachel);

    ladePlan().then((plan) => {
      const heute = isoDatum(new Date());
      const offen = (plan.slots || [])
        .filter((s) => !s.karteId && s.datum >= heute)
        .sort((a, b) => a.datum.localeCompare(b.datum));
      const naechster = offen[0];
      if (naechster) {
        slotKachel.querySelector(".termin-kachel-datum").textContent = deutschesDatum(naechster.datum);
        slotKachel.style.cursor = "pointer";
        slotKachel.addEventListener("click", async () => {
          merke("dates", einfacherPlan(naechster.datum), false);
          if (naechster.uhrzeit) merke("uploadTime", naechster.uhrzeit, false);
          await speichere();
          slotBelegen(naechster.id, k.id).catch(() => {
            meldung("Slot konnte nicht belegt werden.", "fehler");
          });
          zeichne();
          meldung(`Upload am ${deutschesDatum(naechster.datum)} geplant.`, "erfolg");
        });
      } else {
        slotKachel.querySelector(".termin-kachel-label").textContent = "Kein freier Slot";
        slotKachel.querySelector(".termin-kachel-datum").textContent = "Erstelle Slots im Redaktionsplan.";
        slotKachel.style.cursor = "default";
        slotKachel.classList.add("termin-kachel-leer");
      }
    }).catch(() => {
      slotKachel.querySelector(".termin-kachel-datum").textContent = "Nicht verfuegbar.";
      slotKachel.style.cursor = "default";
    });

    // Untere Kachel: manuell.
    const manuellKachel = document.createElement("div");
    manuellKachel.className = "termin-kachel termin-kachel-manuell";
    manuellKachel.innerHTML = `<span class="termin-kachel-label">Anderes Datum waehlen</span>`;
    manuellKachel.addEventListener("click", () => {
      modalDatum(
        "Wann soll das Video veroeffentlicht werden?",
        "Dreh wird automatisch 2 Wochen vorher gesetzt.",
        (datum) => {
          merke("dates", einfacherPlan(datum), true);
          setStand(`Upload am ${deutschesDatum(datum)}.`);
        }
      );
    });
    kacheln.appendChild(manuellKachel);
    box.appendChild(kacheln);
  }

  g.appendChild(box);
  return g;
}

// Ein Fristfeld setzen oder loeschen, ohne die anderen anzutasten.
function setzeTermin(k, key, wert, merke) {
  const neu = { ...(k.dates || {}) };
  if (wert) neu[key] = wert;
  else delete neu[key];
  merke("dates", neu, true);
}

// Aufklappbarer Unterblock — Sekundaeres ausblenden, ohne es zu verlieren.
function klappe(titel) {
  const d = document.createElement("details");
  d.className = "gruppe unterklappe";
  d.innerHTML = `<summary class="gruppe-kopf"><span class="gruppe-titel">${escape(titel)}</span></summary>`;
  const box = document.createElement("div");
  d.appendChild(box);
  return { d, box };
}

// --- Mini-Kalender der Fristen -------------------------------------------

const MINI_MONATE = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
let miniMonat = null;
let miniKarteId = null;

function standardMonat(k) {
  const gesetzt = Object.values(k.dates || {}).filter(Boolean).sort();
  const anker = gesetzt[0] || isoDatum(new Date());
  const d = new Date(anker + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function miniNav(zeichen, klick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "mini-nav";
  b.innerHTML = icon(zeichen);
  b.addEventListener("click", klick);
  return b;
}

function miniKalender(k) {
  if (miniKarteId !== k.id) {
    miniKarteId = k.id;
    miniMonat = null;
  }
  const monat = miniMonat || standardMonat(k);

  const wrap = document.createElement("div");
  wrap.className = "mini-kalender";

  const kopf = document.createElement("div");
  kopf.className = "mini-kopf";
  kopf.appendChild(miniNav("zurueck", () => {
    miniMonat = new Date(monat.getFullYear(), monat.getMonth() - 1, 1);
    zeichne();
  }));
  const name = document.createElement("span");
  name.className = "mini-monat";
  name.textContent = `${MINI_MONATE[monat.getMonth()]} ${monat.getFullYear()}`;
  kopf.appendChild(name);
  kopf.appendChild(miniNav("weiter", () => {
    miniMonat = new Date(monat.getFullYear(), monat.getMonth() + 1, 1);
    zeichne();
  }));
  wrap.appendChild(kopf);

  const raster = document.createElement("div");
  raster.className = "mini-raster";
  for (const wt of ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]) {
    const z = document.createElement("div");
    z.className = "mini-wt";
    z.textContent = wt;
    raster.appendChild(z);
  }

  const proTag = new Map();
  for (const t of TERMINE) {
    const d = (k.dates || {})[t.key];
    if (!d) continue;
    if (!proTag.has(d)) proTag.set(d, []);
    proTag.get(d).push(t);
  }

  const erster = new Date(monat.getFullYear(), monat.getMonth(), 1);
  const start = new Date(erster);
  start.setDate(start.getDate() - ((erster.getDay() + 6) % 7));
  const heute = isoDatum(new Date());

  for (let i = 0; i < 42; i++) {
    const tag = new Date(start);
    tag.setDate(start.getDate() + i);
    const iso = isoDatum(tag);
    const zelle = document.createElement("div");
    zelle.className =
      "mini-tag" +
      (tag.getMonth() !== monat.getMonth() ? " fremd" : "") +
      (iso === heute ? " heute" : "");
    const zahl = document.createElement("span");
    zahl.className = "mini-tag-zahl";
    zahl.textContent = tag.getDate();
    zelle.appendChild(zahl);

    const treffer = proTag.get(iso);
    if (treffer) {
      const punkte = document.createElement("span");
      punkte.className = "mini-punkte";
      for (const t of treffer) {
        const p = document.createElement("span");
        p.className = `mini-punkt marke-${t.key}`;
        p.title = `${t.name} am ${new Date(iso + "T00:00:00").toLocaleDateString("de-DE")}`;
        punkte.appendChild(p);
      }
      zelle.appendChild(punkte);
    }
    raster.appendChild(zelle);
  }
  wrap.appendChild(raster);

  const gesetzt = TERMINE.filter((t) => (k.dates || {})[t.key]);
  const leg = document.createElement("div");
  leg.className = "mini-legende";
  if (gesetzt.length) {
    leg.innerHTML = gesetzt
      .map(
        (t) =>
          `<span class="mini-legende-item"><span class="mini-punkt marke-${t.key}"></span>${escape(t.kurz)} ` +
          `${new Date((k.dates)[t.key] + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>`
      )
      .join("");
  } else {
    leg.innerHTML = `<span class="mini-legende-leer">Noch keine Fristen gesetzt — Datum unten, dann rueckwaerts planen.</span>`;
  }
  wrap.appendChild(leg);
  return wrap;
}

function blockTore(k, toreListe, stand) {
  const offen = toreListe.filter((t) => t.status !== "ok").length;
  const g = gruppe("Was noch offen ist", offen, offen > 0);
  const box = document.createElement("div");

  if (!toreListe.length) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = "In dieser Phase gibt es nichts automatisch zu pruefen.";
    box.appendChild(p);
  } else {
    const liste = document.createElement("ul");
    liste.className = "befundliste";
    for (const t of toreListe) liste.appendChild(befundZeile(t.status, t.satz, t.quelle));
    box.appendChild(liste);
  }

  if (stand && !stand.driveOk) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = stand.satz;
    box.appendChild(p);
  }

  g.appendChild(box);
  return g;
}

// Die Arbeit der aktuellen Phase: KI-Aktionen, Auswahl, Felder.
function blockPhase(k, toreListe, stand) {
  const p = phase(k.column);
  const g = gruppe(`Arbeit in "${p.name}"`, null, true);
  const box = document.createElement("div");

  const merke = (pfad, wert, neu = false) => {
    setzeTief(k, pfad, wert);
    speichere();
    if (neu) zeichne();
  };

  // KI-Aktionen dieser Phase
  const aufgaben = PHASEN_KI[k.column] || [];
  if (aufgaben.length) {
    const hinweis = document.createElement("p");
    hinweis.className = "feld-hinweis";
    hinweis.textContent =
      "Die KI laeuft lokal ueber deine Claude-CLI — dein Abo, keine API-Kosten. Die Marken- und Praxis-Regeln stecken im Vorspann.";
    box.appendChild(hinweis);

    const reihe = document.createElement("div");
    reihe.className = "knopfreihe";
    for (const task of aufgaben) {
      reihe.appendChild(
        knopf(KI_NAMEN[task] || task, {
          art: "haupt",
          zeichen: "funken",
          klick: (e) => rufeKi(task, k, e.currentTarget, box),
        })
      );
    }
    box.appendChild(reihe);
  }

  if (k.column === "idee") guidedIdee(k, box);
  if (k.column === "skript") skriptLoop(k, box);
  if (k.column === "videodreh") felderDreh(k, box, merke);
  if (k.column === "schnitt") felderSchnitt(k, box, merke);
  if (k.column === "caption") felderCaption(k, box, merke);
  if (k.column === "upload") felderUpload(k, box, merke);
  if (k.column === "fertig") {
    const p2 = document.createElement("p");
    p2.className = "feld-hinweis";
    p2.textContent = "Diese Karte ist veroeffentlicht. Die Zahlen dazu stehen unter „Auswertung“.";
    box.appendChild(p2);
  }
  if (k.column === "verworfen") {
    const p2 = document.createElement("p");
    p2.className = "feld-hinweis";
    p2.textContent = "Verworfen und geparkt. Die KI schlaegt diese Idee bei der Ideensuche nicht mehr vor. Zurueckholen unten.";
    box.appendChild(p2);
  }

  g.appendChild(box);
  return g;
}

// --- Phasen-Felder --------------------------------------------------------

// Der gefuehrte Idee-Loop: ein Anstoss, dann Schritt fuer Schritt. Jede getroffene Wahl
// verschwindet, die naechste Stufe erscheint — und baut auf der vorigen auf.
//   Recherche -> Fokus -> verbaler Hook -> visueller Hook -> rutscht ins Skript.
function guidedIdee(k, box) {
  const r = k.recherche;

  // Start: noch nichts recherchiert.
  if (!r) {
    box.appendChild(
      knopf("Recherchieren und Definieren", {
        art: "haupt",
        zeichen: "funken",
        klick: (e) => rufeKi("recherche", k, e.currentTarget, box),
      })
    );
    return;
  }
  if (r.raw || !Array.isArray(r.fokus)) {
    const pre = document.createElement("pre");
    pre.className = "textblock";
    pre.textContent = r.raw || JSON.stringify(r, null, 2);
    box.appendChild(pre);
    return;
  }

  const stufe = k.chosenFokus == null ? 1 : k.chosenVerbal == null ? 2 : 3;
  box.appendChild(schrittKopf(stufe));

  // Stufe 1: Fokus.
  if (stufe === 1) {
    if (r.zusammenfassung) box.appendChild(rechercheKlappe(r.zusammenfassung));
    box.appendChild(
      wahlgruppe(
        "Fokus — worum es im Kern geht",
        r.fokus.map((f, i) => ({ i, titel: f.titel, text: f.text })),
        null,
        (i) => {
          setzeTief(k, "chosenFokus", i);
          // Problem/Handlung und Suchbegriffe wandern still mit — keine Extra-Knoepfe.
          if (r.frame) setzeTief(k, "frame", { problem: r.frame.problem || "", solution: r.frame.solution || "" });
          if (Array.isArray(r.keywords)) setzeTief(k, "caption.keywords", r.keywords);
          delete k.hooksVerbal;
          delete k.chosenVerbal;
          delete k.hooksVisuell;
          delete k.chosenVisuell;
          speichere();
          rufeKi("hooks_verbal", k, null, box);
        }
      )
    );
    return;
  }

  // Stufe 2: verbaler Hook.
  if (stufe === 2) {
    box.appendChild(gewaehltZeile("Fokus", r.fokus[k.chosenFokus].titel));
    const hv = k.hooksVerbal;
    if (!hv || !Array.isArray(hv.hooks)) {
      box.appendChild(
        knopf("Verbale Hooks holen", { art: "haupt", zeichen: "funken", klick: (e) => rufeKi("hooks_verbal", k, e.currentTarget, box) })
      );
    } else {
      box.appendChild(
        wahlgruppe(
          "Verbaler Hook — der gesprochene Einstieg",
          hv.hooks.map((h, i) => ({ i, titel: h.label, text: h.verbal })),
          null,
          (i) => {
            setzeTief(k, "chosenVerbal", i);
            setzeTief(k, "hook.text", hv.hooks[i].verbal || "");
            delete k.hooksVisuell;
            delete k.chosenVisuell;
            speichere();
            rufeKi("hooks_visuell", k, null, box);
          }
        )
      );
    }
    box.appendChild(
      zurueckKnopf(() => {
        delete k.chosenFokus;
        delete k.hooksVerbal;
        delete k.chosenVerbal;
        speichere();
        zeichne();
      })
    );
    return;
  }

  // Stufe 3: visueller Hook -> danach ins Skript.
  box.appendChild(gewaehltZeile("Fokus", r.fokus[k.chosenFokus].titel));
  box.appendChild(gewaehltZeile("Verbaler Hook", (k.hook && k.hook.text) || ""));
  const hvis = k.hooksVisuell;
  if (!hvis || !Array.isArray(hvis.hooks)) {
    box.appendChild(
      knopf("Visuelle Hooks holen", { art: "haupt", zeichen: "funken", klick: (e) => rufeKi("hooks_visuell", k, e.currentTarget, box) })
    );
  } else {
    box.appendChild(
      wahlgruppe(
        "Sichtbarer Hook — was man in Sekunde 0 bis 1 sieht",
        hvis.hooks.map((h, i) => ({ i, titel: h.label, text: h.visuell })),
        null,
        async (i) => {
          setzeTief(k, "chosenVisuell", i);
          setzeTief(k, "hook.visual", hvis.hooks[i].visuell || "");
          await speichere();
          await schiebe(k, "skript");
          // Drive-Ordner automatisch anlegen, wenn noch nicht vorhanden.
          if (k.title && !k.driveName) {
            driveAnlegen(k)
              .then(() => meldung("Projektordner im Drive angelegt.", "erfolg"))
              .catch(() => meldung("Drive-Ordner konnte nicht angelegt werden.", "fehler"));
          }
        }
      )
    );
  }
  box.appendChild(
    zurueckKnopf(() => {
      delete k.chosenVerbal;
      delete k.hooksVisuell;
      delete k.chosenVisuell;
      if (k.hook) delete k.hook.text;
      speichere();
      zeichne();
    })
  );
}

function schrittKopf(n) {
  const p = document.createElement("p");
  p.className = "schritt-kopf";
  const namen = ["Fokus", "Verbaler Hook", "Sichtbarer Hook"];
  p.textContent = `Schritt ${n} von 3 · ${namen[n - 1]}`;
  return p;
}

function gewaehltZeile(label, text) {
  const d = document.createElement("div");
  d.className = "gewaehlt-zeile";
  d.innerHTML = icon("check") + `<span><strong>${escape(label)}:</strong> ${escape(text || "")}</span>`;
  return d;
}

function zurueckKnopf(klick) {
  const b = knopf("Einen Schritt zurueck", { zeichen: "zurueck", klick });
  b.classList.add("schritt-zurueck");
  return b;
}

function rechercheKlappe(text) {
  const d = document.createElement("details");
  d.className = "gruppe";
  d.innerHTML = `<summary class="gruppe-kopf"><span class="gruppe-titel">Recherche und Hard Facts</span></summary>`;
  const pre = document.createElement("pre");
  pre.className = "textblock";
  pre.textContent = text;
  d.appendChild(pre);
  return d;
}

// Loop 2: die drei Bausteine aus Loop 1 editierbar, EIN Knopf schreibt alles, danach das
// fertige Skript als Fliesstext editierbar, Speichern -> .txt in Drive -> Upload-Datum -> Videodreh.
function skriptLoop(k, box) {
  const merke = (pfad, wert) => {
    setzeTief(k, pfad, wert);
    speichere();
  };

  const fokusStart =
    k.fokusText != null
      ? k.fokusText
      : k.recherche && k.chosenFokus != null && k.recherche.fokus && k.recherche.fokus[k.chosenFokus]
      ? `${k.recherche.fokus[k.chosenFokus].titel}: ${k.recherche.fokus[k.chosenFokus].text}`
      : "";
  const fokusEl = textfeld(fokusStart, 2, "Der gewaehlte Fokus");
  fokusEl.addEventListener("change", () => merke("fokusText", fokusEl.value));
  box.appendChild(feld("Fokus", fokusEl));

  const vEl = eingabe((k.hook && k.hook.text) || "", { platzhalter: "Der gesprochene Einstieg" });
  vEl.addEventListener("change", () => merke("hook.text", vEl.value));
  box.appendChild(feld("Verbaler Hook", vEl, `Hoechstens etwa ${MASSE.hookWoerterMax} Woerter.`));

  const viEl = eingabe((k.hook && k.hook.visual) || "", { platzhalter: "Was man in Sekunde 0 bis 1 sieht" });
  viEl.addEventListener("change", () => merke("hook.visual", viEl.value));
  box.appendChild(feld("Sichtbarer Hook", viEl, "Vier von fuenf schauen ohne Ton — das Bild muss den Hook tragen."));

  // Ein Knopf, der alles schreibt.
  box.appendChild(
    knopf(k.skriptFinal || (k.ai && k.ai.skript) ? "Skript neu schreiben" : "Skript schreiben", {
      art: "haupt",
      zeichen: "funken",
      klick: (e) => rufeKi("skript", k, e.currentTarget, box),
    })
  );

  // Nach der Generierung: der fertige Text zum Rueberlesen und Aendern.
  const text = k.skriptFinal || (k.ai && k.ai.skript) || "";
  if (!text) return;

  const skript = textfeld(text, 12, "Der fertige Sprechertext");
  const zaehler = document.createElement("p");
  zaehler.className = "zaehler";
  const zaehle = () => {
    const s = sprechzeit(skript.value);
    zaehler.textContent = `Etwa ${s} Sekunden Sprechzeit — die Hausregel liegt bei ${MASSE.sprechzeitMax}.`;
    zaehler.classList.toggle("zuviel", s > MASSE.sprechzeitMax);
  };
  zaehle();
  skript.addEventListener("input", zaehle);
  skript.addEventListener("change", () => merke("skriptFinal", skript.value));
  box.appendChild(feld("Fertiges Skript", skript));
  box.appendChild(zaehler);

  box.appendChild(
    knopf("Nach Drive speichern und Upload planen", {
      art: "haupt",
      zeichen: "ordner",
      klick: async (e) => {
        setzeTief(k, "skriptFinal", skript.value);
        await nachDrive(k, DATEINAMEN.skript, skript.value, e.currentTarget, box);
        setzeTief(k, "skriptGespeichert", true);
        await speichere();
        modalDatum(
          "Wann soll das Video veroeffentlicht werden?",
          "Aus dem Upload-Datum setzt das Board Schnitt- und Drehtermine automatisch, dann rutscht die Karte in Videodreh.",
          async (datum) => {
            setzeTief(k, "dates", { ...rueckwaertsplan(datum), upload: datum });
            await speichere();
            await schiebe(k, "videodreh");
          }
        );
      },
    })
  );
}

function felderDreh(k, box, merke) {
  box.appendChild(
    schalterFeld(k, box, merke, [
      ["video.speakerOnCamera", "Jemand spricht vor der Kamera"],
      ["video.directGaze", "Es gibt eine Einstellung mit Blick in die Kamera"],
    ])
  );
  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.textContent =
    "Beides ist bei NGO-Inhalten belegt wirksam: Blick in die Kamera hebt die Interaktion, Fachleute schlagen den institutionellen Absender.";
  box.appendChild(hinweis);
}

function felderSchnitt(k, box, merke) {
  const sek = eingabe((k.video && k.video.seconds) || "", { typ: "number" });
  sek.addEventListener("change", () => merke("video.seconds", Number(sek.value) || 0, true));
  box.appendChild(feld("Laenge in Sekunden", sek));

  box.appendChild(
    schalterFeld(k, box, merke, [
      ["video.hasCaptions", "Das Video hat Untertitel"],
      ["video.watermarkFree", "Der Export traegt kein fremdes Wasserzeichen"],
    ])
  );
  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.textContent =
    "Beides sperrt: ohne Untertitel geht die Haelfte der Wirkung verloren, und ein TikTok- oder CapCut-Wasserzeichen kostet auf Instagram die gesamte Reichweite bei Nicht-Followern.";
  box.appendChild(hinweis);
}

function felderCaption(k, box, merke) {
  const c = k.caption || {};

  if (k.captionVorschlag && Array.isArray(k.captionVorschlag.varianten)) {
    box.appendChild(
      wahlgruppe(
        "Caption-Varianten",
        k.captionVorschlag.varianten.map((v, i) => ({
          i,
          titel: plattformName(v.plattform),
          text: `${v.lead || ""}\n\n${v.body || ""}`.trim(),
        })),
        k.chosenCaption,
        (i) => {
          const v = k.captionVorschlag.varianten[i];
          setzeTief(k, "chosenCaption", i);
          setzeTief(k, "caption.lead", (v.lead || "").slice(0, MASSE.captionLeadMax));
          setzeTief(k, "caption.body", v.body || "");
          if (k.captionVorschlag.keywords) setzeTief(k, "caption.keywords", k.captionVorschlag.keywords);
          if (k.captionVorschlag.hashtags) setzeTief(k, "caption.hashtags", k.captionVorschlag.hashtags);
          if (k.captionVorschlag.cta) setzeTief(k, "cta", k.captionVorschlag.cta);
          speichere();
          zeichne();
        }
      )
    );
  }

  const lead = textfeld(c.lead || "", 3, "Kernaussage plus Suchbegriff");
  const zaehler = document.createElement("p");
  zaehler.className = "zaehler";
  const zaehle = () => {
    const n = lead.value.length;
    zaehler.textContent = `${n} von ${MASSE.captionLeadMax} Zeichen.`;
    const zuviel = n > MASSE.captionLeadMax;
    zaehler.classList.toggle("zuviel", zuviel);
    lead.classList.toggle("zuviel", zuviel);
  };
  zaehle();
  lead.addEventListener("input", zaehle);
  lead.addEventListener("change", () => merke("caption.lead", lead.value, true));
  box.appendChild(
    feld(
      "Vorspann",
      lead,
      "Der einzige garantiert sichtbare Teil — und seit Juli 2025 der Ausschnitt, den Google zeigt."
    )
  );
  box.appendChild(zaehler);

  const body = textfeld(c.body || "", 6, "Der Rest der Caption");
  body.addEventListener("change", () => merke("caption.body", body.value, true));
  box.appendChild(feld("Caption-Text", body));

  const cta = eingabe((k.cta && k.cta.text) || "", { platzhalter: "Genau ein Aufruf, indirekt formuliert" });
  cta.addEventListener("change", () => merke("cta.text", cta.value, true));
  box.appendChild(
    feld("Aufruf zum Handeln", cta, "Genau einer. Indirekt wirkt bei NGO-Inhalten belegt besser als direkt. Nie um Likes bitten.")
  );

  const keys = eingabe((c.keywords || []).join(", "), { platzhalter: "drei bis sechs Begriffe, kommagetrennt" });
  keys.addEventListener("change", () =>
    merke("caption.keywords", keys.value.split(",").map((s) => s.trim()).filter(Boolean), true)
  );
  box.appendChild(feld("Suchbegriffe", keys, "Sie ersetzen die Auffindbarkeit, die Hashtags nie hatten."));

  for (const pl of k.platforms || []) {
    const tags = ((c.hashtags || {})[pl] || []).join(" ");
    const e = eingabe(tags, { platzhalter: "#WorldEdenEra #ProjectOasis" });
    e.addEventListener("change", () => {
      const neu = { ...(k.caption.hashtags || {}) };
      neu[pl] = e.value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
      merke("caption.hashtags", neu, true);
    });
    const info =
      pl === "instagram"
        ? "Hoechstens fuenf sind erlaubt, hoechstens zwei sind empfohlen."
        : pl === "tiktok"
        ? "Hier wirken Hashtags gegenlaeufig zu Instagram: mindestens einer."
        : "";
    box.appendChild(feld(`Hashtags fuer ${plattformName(pl)}`, e, info));
  }

  box.appendChild(
    knopf("Caption nach Drive speichern", {
      zeichen: "ordner",
      klick: (e) =>
        nachDrive(
          k,
          DATEINAMEN.caption,
          `${c.lead || ""}\n\n${c.body || ""}\n\n${(k.cta && k.cta.text) || ""}\n\n` +
            Object.entries(c.hashtags || {})
              .map(([p, t]) => `${plattformName(p)}: ${(t || []).join(" ")}`)
              .join("\n"),
          e.currentTarget,
          box
        ),
    })
  );
}

function felderUpload(k, box, merke) {
  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.textContent =
    "Nach dem Veroeffentlichen den Link des Beitrags hier eintragen — nur so kommen die Zahlen spaeter an diese Karte zurueck.";
  box.appendChild(hinweis);

  for (const pl of k.platforms || []) {
    const wert = ((k.published || {})[pl] || {}).permalink || "";
    const e = eingabe(wert, { platzhalter: `Link des Beitrags auf ${plattformName(pl)}` });
    e.addEventListener("change", () => {
      const neu = { ...(k.published || {}) };
      if (e.value) neu[pl] = { ...(neu[pl] || {}), permalink: e.value };
      else delete neu[pl];
      merke("published", neu, true);
    });
    box.appendChild(feld(`Beitrag auf ${plattformName(pl)}`, e));
  }
}

// --- Drive ----------------------------------------------------------------

function blockDrive(k, stand) {
  const g = gruppe("Google Drive", null, false);
  const box = document.createElement("div");

  if (!k.title) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = "Setz zuerst ein Thema — daraus entsteht der Ordnername.";
    box.appendChild(p);
    g.appendChild(box);
    return g;
  }

  box.innerHTML = eigenschaft("Ordnername", escape(projektName(k)));

  if (!stand) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = "Drive wird gelesen …";
    box.appendChild(p);
  } else if (!stand.driveOk) {
    const z = document.createElement("div");
    z.className = "befund";
    z.innerHTML = statusChip("unlesbar") + `<span class="befund-satz">${escape(stand.satz)}</span>`;
    box.appendChild(z);
  } else if (!stand.vorhanden) {
    const z = document.createElement("div");
    z.className = "befund";
    z.innerHTML = statusChip("fehlt") + `<span class="befund-satz">${escape(stand.satz)}</span>`;
    box.appendChild(z);
    box.appendChild(
      knopf("Projektordner in Drive anlegen", {
        art: "haupt",
        zeichen: "ordner",
        klick: async (e) => {
          const weg = fortschritt(box, "Lege den Projektordner an …");
          e.currentTarget.disabled = true;
          try {
            await driveAnlegen(k);
            meldung("Projektordner im Drive angelegt.", "erfolg");
            await driveScan(k, true);
            zeichne();
          } catch (fehler) {
            meldung(`Ordner konnte nicht angelegt werden: ${fehler.message}`, "fehler");
          } finally {
            weg();
          }
        },
      })
    );
  } else {
    const z = document.createElement("div");
    z.className = "befund";
    z.innerHTML = statusChip(stand.verschoben ? "hinweis" : "ok") + `<span class="befund-satz">${escape(stand.satz)}</span>`;
    box.appendChild(z);

    const zahlen = document.createElement("div");
    zahlen.innerHTML =
      eigenschaft("Rohmaterial", `${stand.rohmaterial} Dateien`) +
      eigenschaft("Fertiges Video", `${stand.final} Videos`) +
      eigenschaft("Skript und Caption", `${(stand.skriptDateien || []).length} Dateien`);
    box.appendChild(zahlen);

    const links = document.createElement("div");
    links.className = "drive-links";
    for (const [name, url] of Object.entries(stand.links || {})) {
      if (!url) continue;
      const a = document.createElement("a");
      a.className = "drive-link";
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = icon("extern") + `<span>${escape(name === "_projekt" ? "Projektordner" : name)}</span>`;
      links.appendChild(a);
    }
    if (links.children.length) box.appendChild(links);
  }

  box.appendChild(
    knopf("Drive erneut lesen", {
      zeichen: "neuladen",
      klick: async () => {
        await driveScan(k, true).catch(() => {
          meldung("Drive-Scan fehlgeschlagen.", "fehler");
        });
        zeichne();
      },
    })
  );

  g.appendChild(box);
  return g;
}

// --- Archiv ---------------------------------------------------------------

function blockArchiv(k) {
  const eintraege = Object.keys(k.ai);
  const g = gruppe("Gespeicherte KI-Ergebnisse", eintraege.length, false);
  const box = document.createElement("div");
  for (const task of eintraege) {
    const text = k.ai[task] || "";
    const d = document.createElement("details");
    d.className = "gruppe";
    let name = KI_NAMEN[task] || task;
    if (task === "skript") name += ` — etwa ${sprechzeit(text)} Sekunden`;
    d.innerHTML = `<summary class="gruppe-kopf"><span class="gruppe-titel">${escape(name)}</span></summary>`;
    const pre = document.createElement("pre");
    pre.className = "textblock";
    pre.textContent = text;
    d.appendChild(pre);
    const reihe = document.createElement("div");
    reihe.className = "knopfreihe";
    reihe.appendChild(
      knopf("Kopieren", {
        klick: async (e) => {
          try {
            await navigator.clipboard.writeText(text);
            e.currentTarget.querySelector("span").textContent = "Kopiert";
            setTimeout(() => (e.currentTarget.querySelector("span").textContent = "Kopieren"), 1400);
          } catch {
            melde("hinweis", "Der Browser hat das Kopieren nicht erlaubt.");
          }
        },
      })
    );
    d.appendChild(reihe);
    box.appendChild(d);
  }
  g.appendChild(box);
  return g;
}

// --- Abschluss ------------------------------------------------------------

function blockAbschluss(k, toreListe) {
  const box = document.createElement("div");
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.gap = "10px";

  // Verworfene Karten: nur zurueckholen und loeschen.
  if (k.column === "verworfen") {
    const zurueck = knopf("Zurueck zu Idee holen", {
      art: "haupt",
      zeichen: "zurueck",
      klick: async () => await schiebe(k, "idee"),
    });
    zurueck.classList.add("knopf-breit");
    box.appendChild(zurueck);
    box.appendChild(loeschenKnopf(k));
    return box;
  }

  const ziel = naechstePhase(k.column);
  if (ziel) {
    const blockiert = sperren(toreListe);
    const weiter = knopf(`Weiter zu ${phase(ziel).name}`, {
      art: "haupt",
      zeichen: "weiter",
      klick: async () => {
        if (blockiert.length) {
          await melde(
            "befund",
            `Die Karte kann noch nicht weiter: ${blockiert.map((b) => b.satz).join(" ")}`
          );
          return;
        }
        await schiebe(k, ziel);
      },
    });
    weiter.classList.add("knopf-breit");
    if (blockiert.length) {
      weiter.disabled = true;
      weiter.title = blockiert.map((b) => b.satz).join(" ");
    }
    box.appendChild(weiter);
    if (blockiert.length) {
      const p = document.createElement("p");
      p.className = "feld-hinweis";
      p.textContent = `${blockiert.length} Punkt${blockiert.length === 1 ? "" : "e"} halten die Karte auf.`;
      box.appendChild(p);
    }
  }

  // Verwerfen: parkt die Karte in „Verworfen", die KI schlaegt sie nicht mehr vor.
  box.appendChild(
    knopf("Diese Idee verwerfen", {
      zeichen: "muell",
      titel: "Parkt die Karte in „Verworfen“ — sie taucht in der Ideensuche nicht mehr auf.",
      klick: async () => await schiebe(k, "verworfen"),
    })
  );
  box.appendChild(loeschenKnopf(k));
  return box;
}

function loeschenKnopf(k) {
  return knopf("Diese Karte loeschen", {
    art: "gefahr",
    zeichen: "muell",
    klick: () => {
      bestaetigen(
        `"${k.title}" loeschen? Der Drive-Ordner bleibt bestehen.`,
        "Ja, loeschen",
        () => {
          loescheKarte(k.id);
          meldung("Karte geloescht.", "erfolg");
        }
      );
    },
  });
}

// --- Hilfen ---------------------------------------------------------------

function wahlgruppe(name, optionen, gewaehlt, beiWahl) {
  const wrap = document.createElement("div");
  wrap.className = "feld";
  const l = document.createElement("span");
  l.className = "feld-label";
  l.textContent = name;
  wrap.appendChild(l);

  const box = document.createElement("div");
  box.className = "wahl";
  for (const o of optionen) {
    const label = document.createElement("label");
    label.className = "wahl-option" + (gewaehlt === o.i ? " gewaehlt" : "");
    label.innerHTML =
      `<span class="wahl-text"><span class="wahl-titel">${escape(o.titel || "")}</span>${escape(o.text || "")}</span>`;
    label.addEventListener("click", (e) => {
      e.preventDefault();
      wrap.remove();
      beiWahl(o.i);
    });
    box.appendChild(label);
  }
  wrap.appendChild(box);
  return wrap;
}

function schalterFeld(k, box, merke, paare) {
  const reihe = document.createElement("div");
  reihe.className = "schalterreihe";
  for (const [pfad, text] of paare) {
    const an = !!leseTief(k, pfad);
    const l = document.createElement("label");
    l.className = "schalter" + (an ? " an" : "");
    l.innerHTML = `<input type="checkbox" ${an ? "checked" : ""}><span>${escape(text)}</span>`;
    l.querySelector("input").addEventListener("change", (e) => merke(pfad, e.target.checked, true));
    reihe.appendChild(l);
  }
  return reihe;
}

async function rufeKi(task, k, knopfEl, box) {
  const alle = box.querySelectorAll(".knopf");
  alle.forEach((b) => (b.disabled = true));
  const panel = denkPanel(box, `${KI_NAMEN[task] || task} — die KI schreibt …`);
  try {
    const antwort = await kiStream(task, kiNutzlast(k), (e) => {
      if (e.delta) panel.delta(e.delta);
      if (e.status) panel.status(e.status);
    });
    if (task === "recherche") setzeTief(k, "recherche", antwort.data || { raw: antwort.text || "" });
    else if (task === "hooks_verbal") setzeTief(k, "hooksVerbal", antwort.data || { raw: antwort.text || "" });
    else if (task === "hooks_visuell") setzeTief(k, "hooksVisuell", antwort.data || { raw: antwort.text || "" });
    else if (task === "caption") setzeTief(k, "captionVorschlag", antwort.data || { raw: antwort.text || "" });
    else {
      k.ai = k.ai || {};
      k.ai[task] = antwort.text || "";
      if (task === "skript" && !k.skriptFinal) k.skriptFinal = antwort.text || "";
    }
    await speichere();
    meldung("KI-Ergebnis gespeichert.", "erfolg");
    zeichne(); // baut die Detailspalte neu auf — das Panel verschwindet mit ihr.
  } catch (e) {
    panel.weg();
    alle.forEach((b) => (b.disabled = false));
    await melde("befund", (e.daten && e.daten.hint) || e.message);
  }
}

// Nutzlast fuer den KI-Aufruf. Der gewaehlte Fokus wandert mit, damit Hooks und Skript
// darauf aufbauen — die Stufen bauen aufeinander auf.
function kiNutzlast(k) {
  const n = {
    title: k.title,
    notes: k.notes,
    serie: k.serie,
    episode: k.episode,
    contenttyp: k.contenttyp,
    kategorie: k.kategorie,
    goal: k.goal,
    platforms: k.platforms,
    frame: k.frame,
    hook: k.hook,
    seriesSiblings: S.cards
      .filter((c) => c.id !== k.id && c.serie && c.serie === k.serie)
      .map((c) => c.title || "(ohne Titel)"),
  };
  if (k.recherche && Array.isArray(k.recherche.fokus) && k.chosenFokus != null) {
    const f = k.recherche.fokus[k.chosenFokus];
    if (f) n.fokus = `${f.titel}: ${f.text}`;
  }
  return n;
}

async function nachDrive(k, dateiname, inhalt, knopfEl, box) {
  const weg = fortschritt(box, "Speichere nach Drive …");
  if (knopfEl) knopfEl.disabled = true;
  try {
    const r = await driveSpeichern(k, dateiname, inhalt);
    setStand(`Gespeichert: ${r.pfad}`);
    meldung("Datei in Drive gespeichert.", "erfolg");
    await driveScan(k, true).catch(() => {});
    zeichne();
  } catch (e) {
    await melde("befund", `Speichern nach Drive ging nicht: ${e.message}`);
  } finally {
    weg();
    if (knopfEl) knopfEl.disabled = false;
  }
}

// Setzt und liest verschachtelte Felder ueber einen Pfad wie "caption.lead".
function setzeTief(objekt, pfad, wert) {
  const teile = pfad.split(".");
  let ziel = objekt;
  for (const t of teile.slice(0, -1)) {
    if (!ziel[t] || typeof ziel[t] !== "object") ziel[t] = {};
    ziel = ziel[t];
  }
  ziel[teile[teile.length - 1]] = wert;
}

function leseTief(objekt, pfad) {
  return pfad.split(".").reduce((o, t) => (o == null ? o : o[t]), objekt);
}
