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
  phaseIndex,
  naechstePhase,
  faelligkeit,
  tore,
  sperren,
  // rueckwaertsplan laeuft ab v26 ueber store.terminplan() — Workflow-Schalter
  einfacherPlan,
  drehFenster,
  drehImFenster,
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
import { fensterFuerTyp } from "/lib/scheduler.js";
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
  rollenEtikett,
  melde,
  setStand,
  speichereDefaults,
  ladePlan,
  slotBelegen,
  drehtermin,
  drehterminAnlegen,
  drehterminAendern,
  karteZuTermin,
  karteVonTermin,
  downloadUrl,
  videoHochladen,
  dateiHochladen,
  an,
  stellschraube,
  terminplan,
  schwebendeNeuBerechnen,
} from "./store.js";
import { modalDrehtermin } from "./drehtermine.js";
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
  sanduhr,
  modalKalender,
  infoTipp,
  meldung,
  bestaetigen,
} from "./ui.js";
import { FOKUS } from "./fokus.js";

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
  const blockiert = sperren(toreListe);

  el.innerHTML = "";

  // --- Kopf ---
  const kopf = document.createElement("div");
  kopf.className = "detail-kopf";
  kopf.innerHTML = `<span class="detail-phase">${escape(p.name)}</span>`;

  // Fokus-Ansicht (P27 F4): Board ausblenden, nur diese Karte zeigen — konzentriertes Abarbeiten.
  const fokusKnopf = document.createElement("button");
  fokusKnopf.className = "detail-fokus" + (FOKUS.an ? " an" : "");
  fokusKnopf.setAttribute("aria-label", FOKUS.an ? "Fokus-Ansicht verlassen" : "Fokus-Ansicht: nur diese Karte zeigen");
  fokusKnopf.title = FOKUS.an ? "Board wieder einblenden" : "Board ausblenden, konzentriert an dieser Karte arbeiten";
  fokusKnopf.innerHTML = icon("ziel");
  fokusKnopf.addEventListener("click", () => {
    FOKUS.an = !FOKUS.an;
    zeichne();
  });
  kopf.appendChild(fokusKnopf);

  const zu = document.createElement("button");
  zu.className = "detail-schliessen";
  zu.setAttribute("aria-label", "Karte schliessen");
  zu.innerHTML = icon("schliessen");
  zu.addEventListener("click", () => {
    S.aktiv = null;
    FOKUS.an = false; // Fokus-Ansicht verlaesst sich automatisch mit dem Schliessen der Karte.
    zeichne();
  });
  kopf.appendChild(zu);
  el.appendChild(kopf);

  // --- Fortschritt: sofort sichtbar, ohne Scrollen (P27 F1) ---
  el.appendChild(blockFortschritt(k, blockiert));

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

  // --- Drehtermin (nur bei fertigem Skript: ab Schritt „Drehtermin festlegen") ---
  if (!["idee", "fertig", "verworfen"].includes(k.column)) koerper.appendChild(blockDrehtermin(k));

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

// Fortschritt sofort sichtbar, ohne Scrollen (P27 F1): Phasenband + die wichtigste Frage
// zuerst — was haelt die Karte auf. Bewusst kein `gruppe()`/details-Element: das hier soll
// nicht wegklappbar sein, es ist die erste Antwort, nicht ein Nebenblock.
function blockFortschritt(k, blockiert) {
  const wrap = document.createElement("div");
  wrap.className = "detail-fortschritt";

  // Phasenband nur fuer die Arbeitsschritte (Idee..Upload) — "Fertig"/"Verworfen" sind
  // Endzustaende, kein "Fortschritt" mehr im selben Sinn.
  if (k.column !== "fertig" && k.column !== "verworfen") {
    const arbeitsPhasen = PHASEN.filter((ph) => ph.id !== "fertig" && ph.id !== "verworfen");
    const idx = phaseIndex(k.column);
    const band = document.createElement("div");
    band.className = "phasenband";
    for (let i = 0; i < arbeitsPhasen.length; i++) {
      const teil = document.createElement("span");
      teil.className = "phasenband-teil" + (i < idx ? " erledigt" : i === idx ? " hier" : "");
      band.appendChild(teil);
    }
    wrap.appendChild(band);
  }

  const zeile = document.createElement("div");
  zeile.className = "befund";
  zeile.innerHTML = blockiert.length
    ? statusChip("befund") +
      `<span class="befund-satz"><strong>${blockiert.length}</strong> Punkt${blockiert.length === 1 ? "" : "e"} halten die Karte auf.</span>`
    : statusChip("ok") + `<span class="befund-satz">Nichts haelt die Karte auf.</span>`;
  wrap.appendChild(zeile);
  return wrap;
}

// P27 F2: Karten-IDs, deren Stamm-Felder trotz vollstaendiger Wahl gerade zum Bearbeiten
// aufgeklappt sind. Rein im Speicher — nach einem Neuladen startet jede Karte eingeklappt.
const stammOffenIds = new Set();

function blockStamm(k, merke) {
  const g = gruppe("Worum geht es", null, true);
  const box = document.createElement("div");

  const titel = eingabe(k.title, { platzhalter: "Thema in einem Halbsatz" });
  titel.addEventListener("input", () => merke("title", titel.value));
  titel.addEventListener("change", () => zeichne());
  box.appendChild(feld("Thema", titel));

  // P27 F2: Sind Typ+Kategorie+Ziel+Plattform alle gesetzt, verschwinden die vier offenen
  // Wahlreihen zugunsten einer kompakten Zeile — sie haben ihre Entscheidung schon getroffen,
  // permanente Buttons dafuer sind nur noch Ablenkung. Solange nicht alle vier stehen, bleibt
  // die volle Ansicht (Erstausfuellen darf nicht erschwert werden).
  const stammVollstaendig = !!(k.contenttyp && k.kategorie && k.goal && (k.platforms || []).length);
  const offen = !stammVollstaendig || stammOffenIds.has(k.id);

  if (!offen) {
    box.appendChild(stammZusammenfassung(k));
  } else {
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

    if (stammVollstaendig) {
      const fertig = knopf("Fertig — einklappen", {
        zeichen: "check",
        klick: () => {
          stammOffenIds.delete(k.id);
          zeichne();
        },
      });
      fertig.classList.add("knopf-inline");
      box.appendChild(fertig);
    }
  }
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

// P27 F2: die eingeklappte Zeile fuer vollstaendig gesetzte Stamm-Felder.
function stammZusammenfassung(k) {
  const wrap = document.createElement("div");
  wrap.className = "stamm-zusammenfassung";
  const teile = [
    contenttypName(k.contenttyp),
    saeuleName(k.kategorie),
    zielInfo(k.goal).name,
    (k.platforms || []).map(plattformName).join(", "),
  ].filter(Boolean);
  const text = document.createElement("span");
  text.className = "stamm-zusammenfassung-text";
  text.textContent = teile.join(" · ");
  text.title = text.textContent;
  wrap.appendChild(text);
  const bearbeiten = knopf("bearbeiten", {
    klick: () => {
      stammOffenIds.add(k.id);
      zeichne();
    },
  });
  bearbeiten.classList.add("knopf-inline");
  wrap.appendChild(bearbeiten);
  return wrap;
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

  box.appendChild(floatSchalter(k, merke));

  if (k.floatUpload) {
    box.appendChild(schwebendAnzeige(k));
  } else {
    const hatUpload = (k.dates || {}).upload;
    if (hatUpload) {
      const zeile = document.createElement("div");
      zeile.className = "termin-kompakt";
      zeile.innerHTML = `<span>Uploaddatum: <strong>${deutschesDatum(hatUpload)}</strong>${k.uploadTime ? ` · ${k.uploadTime}` : ""}</span>`;
      const bearbeiten = knopf("bearbeiten", {
        zeichen: "kalender",
        klick: () => {
          modalKalender(
            "Upload-Datum aendern",
            "Dreh wird automatisch 2 Wochen vorher gesetzt.",
            fensterFuerTyp(k.contenttyp || ""),
            async (datum, zeit) => {
              merke("dates", einfacherPlan(datum), false);
              if (zeit) merke("uploadTime", zeit, false);
              setStand(`Upload am ${deutschesDatum(datum)}.`);
              await schwebendeNeuBerechnen(); // kann eine schwebende Karte verdraengt haben (v30)
              zeichne();
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
      merke("dates", { ...terminplan(upload), upload }, true);
      setStand("Die uebrigen Termine stehen jetzt rueckwaerts vom Upload-Datum.");
    },
  });
  plan.classList.add("knopf-breit");
  details.appendChild(plan);

  for (const t of TERMINE) {
    if (t.key === "dreh") {
      // B1 (v30): kein zweites, roh editierbares Dreh-Datum mehr — das kann den zugeordneten
      // Drehtermin unbemerkt ueberschreiben, ohne ihn zu loesen oder zu syncen. Zugeordnet:
      // das Datum steht schon oben im Block "Drehtermin", hier keine eigene Zeile. Sonst ein
      // Hinweis statt eines Feldes — genau EINE Stelle im UI kann ein Dreh-Datum erzeugen.
      if (!k.drehterminId) {
        const hinweis = document.createElement("p");
        hinweis.className = "feld-hinweis";
        hinweis.textContent = "Kein Drehtermin zugeordnet — im Block „Drehtermin“ oben zuordnen oder neu anlegen.";
        details.appendChild(hinweis);
      }
      continue;
    }
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
// Drehtermin-Zuordnung in der Karte. Erscheint nur bei fertigem Skript (ab Schritt
// „Drehtermin festlegen"). Zugeordnet: Anzeige + Loesen; sonst: vorhandenen waehlen oder neuen anlegen.
function blockDrehtermin(k) {
  const g = gruppe("Drehtermin", null, true);
  const box = document.createElement("div");
  const heute = isoDatum(new Date());
  const kommend = (S.drehtermine || [])
    .filter((t) => t.datum && t.datum >= heute)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const t = k.drehterminId ? drehtermin(k.drehterminId) : null;

  if (t) {
    const zeile = document.createElement("div");
    zeile.className = "termin-kompakt";
    zeile.innerHTML =
      `<span>Zugeordnet: <strong>${deutschesDatum(t.datum)}</strong>${t.zeit ? " · " + escape(t.zeit) : ""}${t.ort ? " · " + escape(t.ort) : ""}</span>`;
    const loesen = knopf("loesen", { klick: () => karteVonTermin(k.id, t.id) });
    loesen.classList.add("knopf-inline");
    zeile.appendChild(loesen);
    box.appendChild(zeile);

    if (!drehImFenster(t.datum, (k.dates || {}).upload)) {
      const f = drehFenster((k.dates || {}).upload);
      const w = document.createElement("p");
      w.className = "feld-hinweis";
      w.textContent = f
        ? `Achtung: liegt ausserhalb des empfohlenen Fensters (${deutschesDatum(f.frueh)} – ${deutschesDatum(f.spaet)}).`
        : "";
      box.appendChild(w);
    }
  } else {
    // Zuordnen + Karte gleich in den Videodreh schieben (Termin steht -> Skript ist fertig).
    const zuordnen = async (terminId) => {
      const r = karteZuTermin(k.id, terminId);
      if (r && r.warnung) melde("hinweis", r.warnung);
      // Workflow "drehtermin-zuordnen-videodreh" (v26)
      if (r && r.ok && an("drehtermin-zuordnen-videodreh") && phaseIndex(k.column) < phaseIndex("videodreh"))
        await schiebe(k, "videodreh");
    };

    if (kommend.length) {
      const label = document.createElement("div");
      label.className = "feld-label";
      label.textContent = "Naechster Drehtermin — direkt zuordnen";
      box.appendChild(label);
      const wahl = document.createElement("div");
      wahl.className = "dreh-wahl";
      for (const x of kommend) {
        const b = knopf(
          `${deutschesDatum(x.datum)}${x.zeit ? " · " + x.zeit : ""}${x.ort ? " · " + x.ort : ""} (${(x.karteIds || []).length})`,
          { zeichen: "kalender", klick: () => zuordnen(x.id) }
        );
        b.classList.add("knopf-breit");
        b.style.marginBottom = "5px";
        wahl.appendChild(b);
      }
      box.appendChild(wahl);
    } else {
      const leer = document.createElement("p");
      leer.className = "feld-hinweis";
      leer.textContent = "Noch kein Drehtermin geplant. Leg unten einen an.";
      box.appendChild(leer);
    }

    const neu = knopf("Neuer Drehtermin", {
      zeichen: "plus",
      klick: () =>
        modalDrehtermin(async (werte) => {
          const nt = drehterminAnlegen(werte.datum, werte.zeit);
          if (werte.ort || werte.titel) drehterminAendern(nt.id, { ort: werte.ort, titel: werte.titel });
          await zuordnen(nt.id);
        }),
    });
    neu.classList.add("knopf-breit");
    neu.style.marginTop = "7px";
    box.appendChild(neu);
  }

  g.appendChild(box);
  return g;
}

function blockTermineIdee(k, merke) {
  const g = gruppe("Termin", null, true);
  const box = document.createElement("div");

  box.appendChild(floatSchalter(k, merke));

  if (k.floatUpload) {
    box.appendChild(schwebendAnzeige(k));
    g.appendChild(box);
    return g;
  }

  const hatDatum = (k.dates || {}).upload;

  if (hatDatum) {
    // Kompakte Ansicht: eine Zeile + Bearbeiten-Button.
    const zeile = document.createElement("div");
    zeile.className = "termin-kompakt";
    zeile.innerHTML = `<span>Uploaddatum: <strong>${deutschesDatum(hatDatum)}</strong></span>`;
    const bearbeiten = knopf("bearbeiten", {
      zeichen: "kalender",
      klick: () => {
        modalKalender(
          "Upload-Datum aendern",
          "Dreh wird automatisch 2 Wochen vorher gesetzt.",
          fensterFuerTyp(k.contenttyp || ""),
          async (datum, zeit) => {
            merke("dates", einfacherPlan(datum), false);
            if (zeit) merke("uploadTime", zeit, false);
            setStand(`Upload am ${deutschesDatum(datum)}.`);
            await schwebendeNeuBerechnen(); // kann eine schwebende Karte verdraengt haben (v30)
            zeichne();
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
          await schwebendeNeuBerechnen(); // kann eine schwebende Karte verdraengt haben (v30)
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
      modalKalender(
        "Wann soll das Video veroeffentlicht werden?",
        "Dreh wird automatisch 2 Wochen vorher gesetzt.",
        fensterFuerTyp(k.contenttyp || ""),
        async (datum, zeit) => {
          merke("dates", einfacherPlan(datum), false);
          if (zeit) merke("uploadTime", zeit, false);
          setStand(`Upload am ${deutschesDatum(datum)}.`);
          await schwebendeNeuBerechnen(); // kann eine schwebende Karte verdraengt haben (v30)
          zeichne();
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
  merke("dates", neu, key === "upload" ? false : true);
  // Ein explizit gesetztes Upload-Datum kann eine schwebende Karte verdraengt haben (v30).
  if (key === "upload") schwebendeNeuBerechnen().then(zeichne);
}

// v30: Checkbox "Naechsten freien Upload-Termin" — an: die Karte traegt kein getipptes
// Datum mehr, sondern zeigt den live berechneten Slot (schwebendAnzeige). Aus: das zuletzt
// berechnete Datum bleibt als expliziter Wert stehen (k.dates.upload wurde bereits beim
// letzten Lauf von schwebendeNeuBerechnen() geschrieben) — die Karte steht nie ohne Datum da.
function floatSchalter(k, merke) {
  const reihe = document.createElement("div");
  reihe.className = "schalterreihe";
  const an = !!k.floatUpload;
  const l = document.createElement("label");
  l.className = "schalter" + (an ? " an" : "");
  l.innerHTML = `<input type="checkbox" ${an ? "checked" : ""}><span>Naechsten freien Upload-Termin</span>`;
  l.querySelector("input").addEventListener("change", async (e) => {
    const checked = e.target.checked;
    merke("floatUpload", checked, false);
    if (checked) await schwebendeNeuBerechnen();
    zeichne();
  });
  reihe.appendChild(l);
  return reihe;
}

// v30: Read-only-Zeile fuer eine schwebende Karte — kein Datumsfeld, sondern der live
// berechnete Stand (statusChip + Satz, kein nackter Wert ohne Kontext).
function schwebendAnzeige(k) {
  const wrap = document.createElement("div");
  wrap.className = "befund";
  const datum = (k.dates || {}).upload;
  if (datum) {
    wrap.innerHTML =
      statusChip("hinweis") +
      `<span class="befund-satz">Wuerde jetzt gepostet am ${escape(deutschesDatum(datum))}` +
      `${k.uploadTime ? ` um ${escape(k.uploadTime)} Uhr` : ""} — rutscht automatisch weiter, ` +
      `sobald eine andere Karte den Termin belegt.</span>`;
  } else {
    wrap.innerHTML =
      statusChip("fehlt") +
      `<span class="befund-satz">Kein freier Redaktionsplan-Slot in den naechsten zwei Monaten gefunden.</span>`;
  }
  return wrap;
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
  // P5 (v37): vertikaler Abstand zwischen den gestapelten Elementen (Buttons, Felder,
  // Ergebniszeilen) — ohne Gap klebten sie aneinander.
  box.className = "phasen-arbeit";

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

  // Schritt 1 „Skript schreiben" (idee): Recherche-/Hook-Loop und — sobald die Hooks stehen —
  // der Skript-Loop im selben Schritt (v16c). Kein Auto-Sprung mehr.
  if (k.column === "idee") {
    guidedIdee(k, box);
    const ideeFertig =
      k.recherche && k.chosenFokus != null && k.chosenVerbal != null && k.chosenVisuell != null;
    if (ideeFertig) skriptLoop(k, box);
  }
  // Schritt 2 „Drehtermin festlegen" (skript): keine Skript-Werkzeuge mehr — die Zuordnung
  // steht im eigenen Drehtermin-Block darueber.
  if (k.column === "skript") {
    const hin = document.createElement("p");
    hin.className = "feld-hinweis";
    hin.textContent = "Ordne die Karte oben einem Drehtermin zu, dann „Weiter“ in den Videodreh.";
    box.appendChild(hin);
  }
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
  // P6a (v37): Ist der sichtbare Hook gewaehlt, ist die Entscheidung getroffen — dann keine
  // Auswahlpunkte mehr, sondern die Ergebniszeile (wie Fokus/Verbaler Hook darueber). Der
  // Skript-Loop erscheint darunter (ideeFertig). „Zurueck" oeffnet die Auswahl wieder.
  if (k.chosenVisuell != null) {
    box.appendChild(gewaehltZeile("Sichtbarer Hook", (k.hook && k.hook.visual) || ""));
    box.appendChild(
      zurueckKnopf(() => {
        delete k.chosenVisuell;
        if (k.hook) delete k.hook.visual;
        speichere();
        zeichne();
      })
    );
    return;
  }
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
          // Drive-Ordner automatisch anlegen — Workflow "drive-ordner-anlegen" (v26).
          if (an("drive-ordner-anlegen") && k.title && !k.driveName) {
            driveAnlegen(k)
              .then(() => meldung("Projektordner im Drive angelegt.", "erfolg"))
              .catch(() => meldung("Drive-Ordner konnte nicht angelegt werden.", "fehler"));
          }
          // v16c: Karte bleibt in „Skript schreiben"; der Skript-Loop erscheint jetzt darunter.
          zeichne();
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

// P6b (v37): ein Textfeld waechst mit seinem Inhalt bis maxPx, danach scrollt es. Die erste
// Messung braucht das Element im DOM — die Karte wird erst nach dem Bau eingehaengt, deshalb
// requestAnimationFrame statt sofortiger Messung (scrollHeight waere sonst 0).
function wachsePassend(el, maxPx = 260) {
  const anpassen = () => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxPx) + "px";
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  };
  el.addEventListener("input", anpassen);
  requestAnimationFrame(anpassen);
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
  // P6b (v37): alle drei Felder mehrzeilig (textfeld) statt einzeiliger Eingaben — langer Text
  // war in <input> weder ganz sichtbar noch bequem editierbar. Textareas scrollen von selbst;
  // wachsePassend() vergroessert sie zusaetzlich bis zu einer Deckelung mit dem Inhalt.
  const fokusEl = textfeld(fokusStart, 3, "Der gewaehlte Fokus");
  fokusEl.addEventListener("change", () => merke("fokusText", fokusEl.value));
  box.appendChild(feld("Fokus", fokusEl));
  wachsePassend(fokusEl);

  const vEl = textfeld((k.hook && k.hook.text) || "", 2, "Der gesprochene Einstieg");
  vEl.addEventListener("change", () => merke("hook.text", vEl.value));
  box.appendChild(feld("Verbaler Hook", vEl, `Hoechstens etwa ${MASSE.hookWoerterMax} Woerter.`));
  wachsePassend(vEl);

  const viEl = textfeld((k.hook && k.hook.visual) || "", 2, "Was man in Sekunde 0 bis 1 sieht");
  viEl.addEventListener("change", () => merke("hook.visual", viEl.value));
  box.appendChild(feld("Sichtbarer Hook", viEl, "Vier von fuenf schauen ohne Ton — das Bild muss den Hook tragen."));
  wachsePassend(viEl);

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
    knopf("Skript speichern und weiter zu „Drehtermin festlegen“", {
      art: "haupt",
      zeichen: "ordner",
      klick: async (e) => {
        setzeTief(k, "skriptFinal", skript.value);
        await nachDrive(k, DATEINAMEN.skript, skript.value, e.currentTarget, box);
        setzeTief(k, "skriptGespeichert", true);
        await speichere();
        // Workflow "skript-gespeichert-weiter" (v26): aus bleibt die Karte stehen.
        if (!an("skript-gespeichert-weiter")) {
          meldung("Skript gespeichert. Die Karte bleibt stehen (Workflow ist aus).", "erfolg");
          zeichne();
          return;
        }
        // v16c: Upload wurde in Schritt 1 schon aus dem Redaktionsplan gesetzt — direkt weiter
        // zu „Drehtermin festlegen". Fehlt es doch, wird es hier als Fallback nachgeholt.
        if ((k.dates || {}).upload) {
          await schiebe(k, "skript");
        } else {
          modalKalender(
            "Wann soll das Video veroeffentlicht werden?",
            "Aus dem Upload-Datum setzt das Board Schnitt- und Freigabetermine automatisch.",
            fensterFuerTyp(k.contenttyp || ""),
            async (datum, zeit) => {
              setzeTief(k, "dates", { ...terminplan(datum), upload: datum });
              if (zeit) setzeTief(k, "uploadTime", zeit);
              await speichere();
              await schiebe(k, "skript");
            }
          );
        }
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

  box.appendChild(rohmaterialZone(k));
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

  box.appendChild(videoUploadZone(k));
}

// v22/v23: Drag&Drop-Upload-Zone, generisch. `opt` = { titel, accept, mehrere, verarbeite }.
// `verarbeite(dateien, zone)` traegt die eigentliche Logik (Ziel, Auto-Move, Meldung).
function uploadZone(k, opt) {
  const zone = document.createElement("div");
  zone.className = "upload-zone";
  zone.innerHTML =
    `<div class="upload-zone-inner knopf-symbol knopf-symbol-ordner">${icon("ordner")}` +
    `<p><strong>${escape(opt.titel)}</strong><br>oder klicken zum Auswaehlen</p></div>`;

  const feldEingabe = document.createElement("input");
  feldEingabe.type = "file";
  feldEingabe.accept = opt.accept;
  if (opt.mehrere) feldEingabe.multiple = true;
  feldEingabe.hidden = true;
  zone.appendChild(feldEingabe);

  const handhabe = async (dateiliste) => {
    const dateien = [...(dateiliste || [])].filter(Boolean);
    if (!dateien.length) return;
    zone.classList.add("laedt");
    try {
      await opt.verarbeite(dateien, zone);
    } catch (fehler) {
      meldung(`Upload fehlgeschlagen: ${fehler.message}`, "fehler");
    } finally {
      zone.classList.remove("laedt");
    }
  };

  zone.addEventListener("click", () => feldEingabe.click());
  feldEingabe.addEventListener("change", () => handhabe(feldEingabe.files));
  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add("ueber");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.remove("ueber");
    })
  );
  zone.addEventListener("drop", (e) => handhabe(e.dataTransfer && e.dataTransfer.files));
  return zone;
}

// Schnitt: fertiges Video -> Fertiges Video/, danach Karte weiter, wenn die Qualitaetssperren
// (Untertitel, Wasserzeichen, Laenge) frei sind — sonst bleibt sie in Schnitt, mit Ansage.
function videoUploadZone(k) {
  return uploadZone(k, {
    titel: "Fertiges Video hierher ziehen",
    accept: "video/*",
    mehrere: false,
    verarbeite: async (dateien, zone) => {
      const datei = dateien[0];
      const weg = fortschritt(zone, `Lade „${datei.name}" nach Drive — das kann bei grossen Dateien dauern …`);
      try {
        const r = await videoHochladen(k, datei);
        // Workflow "upload-fertig-weiter" (v26): aus bleibt die Karte stehen, egal wie die Tore stehen.
        if (!an("upload-fertig-weiter")) {
          meldung(r.satz || "Video hochgeladen.", "erfolg");
          zeichne();
          return;
        }
        const frisch = await driveScan(k, true).catch(() => null);
        const offen = stellschraube("upload-fertig-weiter", "toreBeachten") ? sperren(tore(k, frisch)) : [];
        if (offen.length) {
          await melde("hinweis", `${r.satz || "Video hochgeladen."} Die Karte bleibt in Schnitt: ${offen.map((b) => b.satz).join(" ")}`);
          zeichne();
        } else {
          const ziel = naechstePhase(k.column);
          meldung(r.satz || "Video hochgeladen.", "erfolg");
          if (ziel) await schiebe(k, ziel);
          else zeichne();
        }
      } finally {
        weg();
      }
    },
  });
}

// Videodreh: Rohmaterial -> Rohmaterial/. Mehrere Clips nacheinander, KEIN Auto-Move —
// Rohmaterial waechst ueber die Zeit, ein einzelner Clip beendet die Phase nicht.
function rohmaterialZone(k) {
  return uploadZone(k, {
    titel: "Rohmaterial hierher ziehen (mehrere moeglich)",
    accept: "video/*,image/*,audio/*",
    mehrere: true,
    verarbeite: async (dateien, zone) => {
      let n = 0;
      for (const datei of dateien) {
        const weg = fortschritt(zone, `Lade „${datei.name}" (${n + 1}/${dateien.length}) nach Drive …`);
        try {
          await dateiHochladen(k, datei, "rohmaterial");
          n += 1;
        } finally {
          weg();
        }
      }
      await driveScan(k, true).catch(() => {});
      meldung(`${n} ${n === 1 ? "Datei" : "Dateien"} als Rohmaterial hochgeladen.`, "erfolg");
      zeichne();
    },
  });
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
    p.appendChild(sanduhr("Drive wird gelesen …"));
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

    // v22: Skript- und Rohmaterial-Ordner direkt herunterladen (nur fuer Menschen —
    // System (AI only)/ und projekt.json sind ausgenommen). Nur in Videodreh und Schnitt.
    if (["videodreh", "schnitt"].includes(k.column)) {
      const runter = (was, label, anzahl) => {
        const b = knopf(`${label} (${anzahl})`, {
          zeichen: "ordner",
          klick: () => {
            const a = document.createElement("a");
            a.href = downloadUrl(k, was);
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
          },
        });
        if (!anzahl) {
          b.disabled = true;
          b.title = "Dieser Ordner ist leer.";
        }
        return b;
      };
      const reihe = document.createElement("div");
      reihe.className = "knopfreihe";
      reihe.appendChild(runter("skript", "Skript laden", (stand.skriptDateien || []).length));
      reihe.appendChild(runter("rohmaterial", "Rohmaterial laden", stand.rohmaterial || 0));
      box.appendChild(reihe);
    }
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
    // Die "N Punkte halten die Karte auf"-Zeile steht seit P27 F1 bereits oben, sofort
    // sichtbar direkt unter dem Kopf — hier keine zweite, redundante Zeile mehr.
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
  const panel = denkPanel(box, `${KI_NAMEN[task] || task} — die KI schreibt …`, rollenEtikett(task));
  try {
    const antwort = await kiStream(task, kiNutzlast(k), (e) => {
      if (e.delta) panel.delta(e.delta);
      if (e.status) panel.status(e.status);
    });
    if (task === "recherche") {
      setzeTief(k, "recherche", antwort.data || { raw: antwort.text || "" });
      // v40: Kontextabgleich als zweiter Pass ueber die eigene (lokale) Kontext-Rolle — passt die
      // Roh-Recherche an Firmen-/Projektkontext an. Nicht-blockierend: schlaegt er fehl, bleibt die
      // Rohfassung stehen. Nur wenn echte, strukturierte Recherche vorliegt.
      if (antwort.data && antwort.data.zusammenfassung) {
        k.rechercheRoh = antwort.data;
        try {
          panel.modell(rollenEtikett("kontextabgleich")); // Badge auf die Kontext-Rolle umstellen
          panel.status("Kontextabgleich — passt an Firmen-/Projektkontext an …");
          const ab = await kiStream(
            "kontextabgleich",
            { ...kiNutzlast(k), recherche: antwort.data },
            (e) => {
              if (e.delta) panel.delta(e.delta);
              if (e.status) panel.status(e.status);
            }
          );
          if (ab && ab.data && ab.data.zusammenfassung) setzeTief(k, "recherche", ab.data);
        } catch { /* Abgleich ist optional — die Rohfassung bleibt stehen */ }
      }
    }
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
