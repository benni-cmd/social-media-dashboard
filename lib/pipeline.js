// Die EINE Quelle fuer Phasen, Drive-Ordner, Termine, Karten-Schema und Qualitaetstore.
//
// Diese Datei laeuft unveraendert im Server UND im Browser: sie importiert nichts aus Node.
// Vorher stand die Spalten-Reihenfolge vierfach im Code (Befund B7 in
// docs/packages/v9-content-maschine.md) — eine neue Phase brauchte vier Aenderungen.
//
// Alle Grenzwerte weiter unten sind belegt und stehen mit ihrer Quelle in
// docs/best-practices.md. Wer hier eine Zahl aendert, aendert sie zuerst dort.

// --- Phasen ---------------------------------------------------------------
//
// Die Drive-Ordnernamen bleiben so, wie sie in Bens Drive schon liegen — Umbenennen
// wuerde die vorhandene Struktur zerreissen, ohne etwas zu gewinnen.

export const PHASEN = [
  {
    id: "idee",
    name: "Skript schreiben",
    satz: "Thema recherchieren, Fokus und Hooks waehlen, Skript schreiben und in Drive speichern.",
    ordner: "In Bearbeitung/1 Idee",
    termin: null,
    weiter: "skript",
  },
  {
    id: "skript",
    name: "Drehtermin festlegen",
    satz: "Das fertige Skript einem Drehtermin zuordnen, dann weiter in den Videodreh.",
    ordner: "In Bearbeitung/2 Skript",
    termin: "dreh",
    weiter: "videodreh",
  },
  {
    id: "videodreh",
    name: "Videodreh",
    satz: "Drehen und das Rohmaterial in den Drive-Ordner legen.",
    ordner: "In Bearbeitung/3 Videodreh",
    termin: "dreh",
    weiter: "schnitt",
  },
  {
    id: "schnitt",
    name: "Schnitt",
    satz: "Schneiden, untertiteln, das fertige Video in den Drive-Ordner legen.",
    ordner: "In Bearbeitung/4 Schnitt",
    termin: "schnitt",
    weiter: "caption",
  },
  {
    id: "caption",
    name: "Caption",
    satz: "Vorspann, Text und Hashtags je Plattform schreiben.",
    ordner: "In Bearbeitung/5 Caption",
    termin: "freigabe",
    weiter: "upload",
  },
  {
    id: "upload",
    name: "Upload",
    satz: "Veroeffentlichen und den Beitrag mit der Karte verknuepfen.",
    ordner: "In Bearbeitung/6 Upload",
    termin: "upload",
    weiter: "fertig",
  },
  {
    id: "fertig",
    name: "Fertig",
    satz: "Veroeffentlicht — hier zaehlen nur noch die Zahlen.",
    ordner: "Videoauswertung",
    termin: null,
    weiter: null,
  },
  {
    id: "verworfen",
    name: "Verworfen",
    satz: "Ideen, die nicht passen — geparkt und aus der Ideensuche ausgeschlossen.",
    ordner: "Verworfen",
    termin: null,
    weiter: null,
  },
];

export const PHASE_IDS = PHASEN.map((p) => p.id);

export const phase = (id) => PHASEN.find((p) => p.id === id) || PHASEN[0];
export const phaseOrdner = (id) => phase(id).ordner;
export const naechstePhase = (id) => phase(id).weiter;
export const phaseIndex = (id) => Math.max(0, PHASE_IDS.indexOf(id));

// --- Feste Struktur (v87, Owner 30.09.2026) --------------------------------
//
// Anzahl, Funktion, Namen und Ordner der Spalten stehen FEST in PHASEN. Das Board passt sich
// nicht mehr an Drive an (v17b-Umbenennung aus Drive und spalten.json sind abgeloest): es legt
// die Struktur in einem leeren Ordner selbst an, erkennt sie, wenn sie vollstaendig ist, und
// nennt sonst in Saetzen, was fehlt oder falsch ist — dann laedt es nichts aus Drive.
// Die Ordner tragen vorn die Nummer der Arbeitsreihenfolge (Drive sortiert alphabetisch); im
// Board steht der Spaltenname ohne Nummer.

// Pflicht-Ordner der Struktur, relativ zum Arbeitsordner.
export const strukturOrdner = () => [...PHASEN.map((p) => p.ordner), SYSTEM_ORDNER];

// Prueft eine Ordnerliste (relative Pfade bis Tiefe 2, mit oder ohne "/" am Ende) gegen die
// feste Struktur. Rein, ohne Drive. Liefert { ok, fehler: [Saetze] }. Fremde Ordner in der
// Wurzel (z. B. „Kontext", „Papierkorb") sind erlaubt; unter „In Bearbeitung" nur die Spalten.
export function pruefeStruktur(ordnerListe) {
  const da = new Set((ordnerListe || []).map((o) => String(o).replace(/\/+$/, "")).filter(Boolean));
  const soll = strukturOrdner();
  const segment = (p) => p.slice(p.lastIndexOf("/") + 1);
  const eltern = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  const kern = (p) => segment(p).replace(/^\d+\s+/, "").toLowerCase();
  const fehler = [];
  const erklaert = new Set();
  for (const s of soll) {
    if (da.has(s)) continue;
    const aehnlich = [...da].find((o) => !soll.includes(o) && eltern(o) === eltern(s) && kern(o) === kern(s));
    if (aehnlich) { fehler.push(`Der Ordner „${aehnlich}“ muss „${s}“ heißen.`); erklaert.add(aehnlich); }
    else fehler.push(`Der Ordner „${s}“ fehlt.`);
  }
  for (const e of new Set(soll.map(eltern).filter(Boolean))) {
    for (const o of da) {
      if (eltern(o) !== e || soll.includes(o) || erklaert.has(o)) continue;
      fehler.push(`Unbekannter Ordner „${o}“ — in „${e}“ gehören nur die festen Spaltenordner.`);
    }
  }
  return { ok: fehler.length === 0, fehler };
}

// Default-Spalten aus PHASEN: die VOLLE Phase (id/name/satz/ordner/termin/weiter — die Logik-
// Felder muss das Frontend behalten) plus order und system:true (nicht loeschbar).
export function spaltenDefault() {
  return PHASEN.map((p, i) => ({ ...p, order: i, system: true }));
}

// Mischt eine (evtl. leere/teilweise) Drive-Spaltenliste ueber die Defaults:
//  - Jede System-Phase ist IMMER dabei, auch wenn sie in der Config fehlt (nicht loeschbar).
//  - Bekannte IDs: Config ueberschreibt Anzeigename, Ordner, Reihenfolge — ID und system:true bleiben.
//  - Unbekannte IDs: FREMDE Spalte, system:false, keine Tore.
//  - Sortiert stabil nach order (fehlt order, ans Ende).
export function mischeSpalten(config) {
  const defaults = spaltenDefault();
  const perId = new Map(defaults.map((s) => [s.id, s]));
  const liste = [];
  const gesehen = new Set();

  for (const e of Array.isArray(config) ? config : []) {
    if (!e || !e.id) continue;
    const basis = perId.get(e.id);
    if (basis) {
      liste.push({
        ...basis,
        name: e.name || basis.name,
        ordner: e.ordner || basis.ordner,
        order: Number.isFinite(e.order) ? e.order : basis.order,
      });
    } else {
      // Fremde Spalte (Drive-Ordner ohne bekannte Phase): schlichte Spalte, keine Logik/Tore.
      liste.push({
        id: e.id,
        name: e.name || e.id,
        satz: e.satz || "",
        ordner: e.ordner || e.name || e.id,
        termin: null,
        weiter: null,
        order: Number.isFinite(e.order) ? e.order : 999,
        system: false,
      });
    }
    gesehen.add(e.id);
  }
  for (const s of defaults) if (!gesehen.has(s.id)) liste.push({ ...s }); // fehlende System-Phasen

  return liste.sort((a, b) => (Number.isFinite(a.order) ? a.order : 999) - (Number.isFinite(b.order) ? b.order : 999));
}

// --- Termine --------------------------------------------------------------
//
// Datums-Meilensteine. Idee und Skript sind KEINE Termine mehr (v16): Recherche und
// Skript sind Arbeit im ersten Schritt, kein Datum. Der Dreh hat kein festes Datum, sondern
// ein Fenster (drehFenster) und wird erst durch die Drehtermin-Zuordnung gesetzt.
// Jede Phase haengt an genau einem `termin`, damit die Kachel sagt, was als Naechstes faellig ist.

export const TERMINE = [
  { key: "dreh", name: "Drehtag", kurz: "Dreh" },
  { key: "schnitt", name: "Schnitt fertig", kurz: "Schnitt" },
  { key: "freigabe", name: "Caption freigegeben", kurz: "Freigabe" },
  { key: "upload", name: "Veroeffentlichung", kurz: "Upload" },
];

// Deadline-Kette (v70b, Owner 26.09.2026): das upload-verankerte Modell mit KETTEN-Offsets. Das
// geplante Uploaddatum ist die EINE zentrale Deadline; jeder Schritt liegt eine Zahl von Tagen VOR
// der jeweils NAECHSTEN (spaeteren) Deadline — fuer bessere Uebersicht (3 + 3 + 6 statt 3, 6, 12):
//   freigabe = Tage der Caption-Freigabe vor dem Upload    (Standard 3)
//   schnitt  = Tage des fertigen Schnitts vor der Freigabe (Standard 3)
//   dreh     = Tage des Drehtags vor dem Schnitt           (Standard 6 → haelt die Karte gruen: der
//              Schnitt ist am Drehtag mehr als gelbTage Tage entfernt)
// Die abgeleiteten Deadlines rechnen sich kumuliert daraus (kumuliert()). Standards = bisheriges
// Verhalten (Upload−3 Freigabe / Upload−6 Schnitt / Upload−12 Dreh). EINE editierbare Quelle
// (Ansicht-Tab). store.js schiebt die Werte per setDeadlineOffsets() hierher; modul-lokaler Zustand ist
// sicher, weil der SERVER keine dieser Termin-Funktionen aufruft (nur der Browser rechnet).
export const OFFSET_STANDARD = { freigabe: 3, schnitt: 3, dreh: 6 };

const zahlOder = (v, def) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? def : Number(v);

let deadlineKette = { ...OFFSET_STANDARD };

export function setDeadlineOffsets(next = {}) {
  deadlineKette = {
    freigabe: Math.max(0, zahlOder(next.freigabe, OFFSET_STANDARD.freigabe)),
    schnitt: Math.max(0, zahlOder(next.schnitt, OFFSET_STANDARD.schnitt)),
    dreh: Math.max(0, zahlOder(next.dreh, OFFSET_STANDARD.dreh)),
  };
}

export const deadlineOffsetsJetzt = () => ({ ...deadlineKette });

// Kumulierte Tage VOR dem Upload je Aktion — aus der Kette aufsummiert.
function kumuliert() {
  const freigabe = deadlineKette.freigabe;
  const schnitt = freigabe + deadlineKette.schnitt;
  const dreh = schnitt + deadlineKette.dreh;
  return { upload: 0, freigabe, schnitt, dreh };
}

export function isoDatum(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Rechnet aus einem Upload-Datum den Anzeige-Cache fuer detail.js: Schnitt, Freigabe, Upload
// (Upload − Offset). Der Dreh ist NICHT dabei — er kommt aus der Drehtermin-Zuordnung. Ab v70 ist
// dies NICHT mehr die Ampel-Quelle (die rechnet live ueber deadlineFuer()), sondern nur der Cache,
// den detail.js beim Upload-Setzen in card.dates schreibt.
export function rueckwaertsplan(uploadDatum) {
  if (!uploadDatum) return {};
  const ziel = new Date(uploadDatum + "T00:00:00");
  const plan = {};
  const cum = kumuliert();
  const offsets = { upload: 0, freigabe: cum.freigabe, schnitt: cum.schnitt };
  for (const [key, off] of Object.entries(offsets)) {
    const d = new Date(ziel);
    d.setDate(d.getDate() - off);
    plan[key] = isoDatum(d);
  }
  return plan;
}

// Breite des Dreh-Fensters vor dem Schnitt (fuer die „!"-Empfehlung; der harte Block sitzt in
// spaetesterDreh()/store.karteZuTermin). Fest, nicht editierbar.
const DREH_FENSTER_TAGE = 14;

// Gueltiges Dreh-Fenster: fruehestens `DREH_FENSTER_TAGE` Tage vor dem Schnitt, spaetestens am Schnitt.
// Standard: Schnitt = Upload − 6 → Fenster [Upload − 20, Upload − 6].
export function drehFenster(uploadDatum) {
  if (!uploadDatum) return null;
  const spaet = new Date(uploadDatum + "T00:00:00");
  spaet.setDate(spaet.getDate() - kumuliert().schnitt);
  const frueh = new Date(spaet);
  frueh.setDate(frueh.getDate() - DREH_FENSTER_TAGE);
  return { frueh: isoDatum(frueh), spaet: isoDatum(spaet) };
}

// Liegt ein Dreh-Datum im gueltigen Fenster der Karte? Ohne Upload kein Urteil (true).
export function drehImFenster(drehDatum, uploadDatum) {
  const f = drehFenster(uploadDatum);
  if (!f || !drehDatum) return true;
  return drehDatum >= f.frueh && drehDatum <= f.spaet;
}

export function tageBis(iso) {
  if (!iso) return null;
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00") - heute) / 86400000);
}

export const deutschesDatum = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("de-DE") : "";

// v113 (M1): faelligkeit() entfernt — sie las den Zwischenspeicher card.dates[termin] mit eigenen Farbschwellen
// und widersprach dem Punkt auf der Kachel. Detailspalte und „Naechster Schritt" nutzen jetzt ampel() (store.zeitAmpel).

// --- Zeit-Ampel des Board-Punkts (v65, Owner 24.09.2026) -------------------
//
// Der Punkt auf der Kachel ist eine REINE Zeit-Ampel: er faerbt sich nach der DRINGLICHSTEN der
// RELEVANTEN Fristen und mischt sich NICHT mehr mit Sperr-Punkten (das trennt v65 vom v64-Vorrang-
// spiel — offene Blocker erscheinen jetzt als „!" daneben, siehe board.js). Relevant sind:
//  - die Termine der AKTUELLEN und noch KOMMENDEN Phasen (bereits durchlaufene zaehlen nicht),
//  - der zugewiesene Drehtermin als Drehtag-Frist, solange die Karte hoechstens in „videodreh" steht
//    (danach ist der Dreh vorbei und zaehlt nicht mehr).
// Der Drehtermin zaehlt AUCH, wenn `card.dates.dreh` leer ist: sein Datum kommt von aussen
// (`drehDatum`, in board.js aus `S.drehtermine` ueber `card.drehterminId` aufgeloest) — genau der
// Fall, der vorher einen ueberfaelligen Dreh grau stehen liess (Befund gegen data/board.json,
// 24.09.2026: „Boden wie ein Schwamm" videodreh, Drehtermin 13.09. ueberfaellig, dates.dreh leer).

// Ampel-Schwellen (Owner-Entscheid 25.09.2026: FEST, nicht editierbar): ueberfaellig ODER ≤rotTage →
// rot (befund) · rotTage+1..gelbTage → gelb (hinweis) · sonst gruen (ok). (v68/6e5d1dc machte sie
// kurzzeitig editierbar — mit v70 zurueckgerollt; der Owner will feste Farben.)
export const AMPEL = { rotTage: 2, gelbTage: 5 };

// Ampel-Status aus einer Tage-Zahl (Tage bis zur Frist; negativ = ueberfaellig). Ohne relevante
// Frist (`null`) ist nichts Dringliches faellig → gruen.
export function ampelStatus(tage, schwellen = AMPEL) {
  if (tage == null) return "ok";
  if (tage <= schwellen.rotTage) return "befund";
  if (tage <= schwellen.gelbTage) return "hinweis";
  return "ok";
}

// --- Aktionsbasierte Deadlines (v70) --------------------------------------
//
// EINE zentrale Deadline je Karte = geplantes Uploaddatum (card.dates.upload). Jede Aktion hat eine
// abgeleitete Deadline = Upload − Offset. Die Ampel rechnet LIVE hierueber (nicht mehr aus
// card.dates[termin] — das beendet die v66-Staleness). Jede Aktion ist relevant, solange die Karte
// die zugehoerige Phase noch nicht hinter sich hat.
const AKTION_PHASE = { dreh: "videodreh", schnitt: "schnitt", freigabe: "caption", upload: "upload" };

// Der spaeteste sinnvolle Drehtag = die Dreh-Deadline aus der Kette (Upload − kumulierter Dreh-Offset).
// Beim Standard (dreh 6 Tage vor Schnitt, Schnitt kumuliert 6 vor Upload) ist der Schnitt am Drehtag
// 6 Tage entfernt (> gelbTage 5) → die Karte rutscht GRUEN in den Schnitt (Owner 25.09.2026). Der Wert
// ist ueber das Dreh-Kettenglied einstellbar; ein zu spaeter Drehtermin wird in store.karteZuTermin geblockt.
export function spaetesterDreh(uploadDatum) {
  if (!uploadDatum) return null;
  const d = new Date(uploadDatum + "T00:00:00");
  d.setDate(d.getDate() - kumuliert().dreh);
  return isoDatum(d);
}

// Deadline-Datum einer Aktion, verankert am Uploaddatum. `dreh`: der zugewiesene Drehtermin gewinnt
// (drehDatum), sonst der abgeleitete spaeteste Drehtag. `upload`: das Uploaddatum selbst.
export function deadlineFuer(uploadDatum, aktion, drehDatum = null) {
  if (!uploadDatum) return null;
  if (aktion === "dreh") return drehDatum || spaetesterDreh(uploadDatum);
  if (aktion === "upload") return uploadDatum;
  const off = kumuliert()[aktion];
  if (off == null) return null;
  const d = new Date(uploadDatum + "T00:00:00");
  d.setDate(d.getDate() - off);
  return isoDatum(d);
}

// Die fuer die Ampel relevanten Fristen einer Karte, als Liste { termin, datum, tage }. Alle
// Deadlines sind upload-verankert (deadlineFuer). Ohne Uploaddatum gibt es keine abgeleiteten
// Deadlines → Ampel neutral. `drehDatum` = aufgeloester zugewiesener Drehtermin (oder null).
export function relevanteFristen(card, drehDatum = null) {
  const upload = (card.dates || {}).upload;
  if (!upload) return [];
  const idx = phaseIndex(card.column);
  const fristen = [];
  for (const [aktion, phaseId] of Object.entries(AKTION_PHASE)) {
    if (idx > phaseIndex(phaseId)) continue; // Phase schon hinter sich → Aktion erledigt
    const datum = deadlineFuer(upload, aktion, drehDatum);
    if (datum) fristen.push({ termin: aktion, datum, tage: tageBis(datum) });
  }
  return fristen;
}

// Die dringlichste relevante Frist (kleinste `tage`) oder null, wenn keine gesetzt ist.
export function dringlichsteFrist(card, drehDatum = null) {
  const fristen = relevanteFristen(card, drehDatum);
  return fristen.length ? fristen.reduce((a, b) => (b.tage < a.tage ? b : a)) : null;
}

// Ein fertiger Satz zu einer Frist — spiegelt die Formulierung von faelligkeit().
function fristSatz(frist) {
  if (!frist) return "Keine anstehende Frist.";
  const m = TERMINE.find((t) => t.key === frist.termin);
  const name = m ? m.name : frist.termin;
  const wann = deutschesDatum(frist.datum);
  if (frist.tage < 0) {
    const n = Math.abs(frist.tage);
    return `${name} war am ${wann} faellig, seit ${n} Tag${n === 1 ? "" : "en"} ueberfaellig.`;
  }
  const rest = frist.tage === 0 ? "heute" : frist.tage === 1 ? "morgen" : `in ${frist.tage} Tagen`;
  return `${name} ist ${rest} faellig, am ${wann}.`;
}

// Der Ampel-Zustand des Board-Punkts: reine Zeit ueber alle relevanten Fristen.
// Liefert { status, frist, satz } — frist ist null, wenn nichts anliegt.
export function ampel(card, drehDatum = null, schwellen = AMPEL) {
  const frist = dringlichsteFrist(card, drehDatum);
  return { status: ampelStatus(frist ? frist.tage : null, schwellen), frist, satz: fristSatz(frist) };
}

// --- Content-Saeulen, Ziele, Plattformen ----------------------------------

export const SAEULEN = [
  { id: "anleitung", name: "Anleitung", satz: "Zum Nachmachen: konkrete Schritte fuer den eigenen Hof." },
  { id: "hardfacts", name: "Hard Facts", satz: "Zahl, Studie, Zusammenhang — Autoritaet ohne Belehrung." },
  { id: "projekt", name: "Projekt-Einblick", satz: "Was bei uns gerade passiert, ehrlich gezeigt." },
  { id: "haltung", name: "Haltung", satz: "Warum wir das tun — Standpunkt, der Diskussion aushaelt." },
  { id: "mythos", name: "Mythos-Check", satz: "Verbreitete Annahme gegen die Datenlage gestellt." },
];

// Das Ziel bestimmt, welche Kennzahl zaehlt. Mosseri 22.01.2025: Likes bewegen die
// bestehenden Follower, Weiterleitungen bewegen die, die uns noch nicht kennen.
export const ZIELE_STANDARD = [
  {
    id: "reach_new",
    name: "Neue Leute erreichen",
    kennzahl: "Weiterleitungen je Reichweite",
    satz: "Weiterleitungen sind das Signal, das Instagram bei Nicht-Followern ausspielt.",
    tiefe: false,
  },
  {
    id: "deepen",
    name: "Bestand binden",
    kennzahl: "Durchschnittliche Sehdauer",
    satz: "Wer schon folgt, bleibt laenger — Sehdauer misst das, Likes nur die Zustimmung.",
    tiefe: true,
  },
  {
    id: "community",
    name: "Gespraech ausloesen",
    kennzahl: "Kommentare",
    satz: "Eine Frage in der Caption bringt messbar mehr Kommentare.",
    tiefe: false,
  },
  {
    id: "donations",
    name: "Foerdern und spenden",
    kennzahl: "Profilaufrufe und Klicks",
    satz: "Der Weg fuehrt ueber Vertrauen: Problem benennen, Handlung zeigen.",
    tiefe: true,
  },
];

// v78 Phase B: ZIELE ist die LIVE-Liste. Wahrheit ist boardparameter (Einstellungs-Tab, Drive);
// setzeBoardparameter() ersetzt den Inhalt in-place, damit jeder Importeur die editierte Liste sieht.
// Die Konstante oben bleibt Seed und Fallback. Deaktivierte Eintraege bleiben in der Liste (Karten
// behalten ihre Zuordnung), Auswahl-Listen nehmen aktiveZiele().
export const ZIELE = ZIELE_STANDARD.map((z) => ({ ...z, aktiv: true }));
export const aktiveZiele = () => ZIELE.filter((z) => z.aktiv !== false);

export const zielInfo = (id) =>
  ZIELE.find((z) => z.id === id) || ZIELE_STANDARD.find((z) => z.id === id) || aktiveZiele()[0] || ZIELE_STANDARD[0];

export const PLATTFORMEN = [
  {
    id: "instagram",
    name: "Instagram",
    hashtagsMax: 5, // hartes Plattform-Limit seit 18.12.2025
    hashtagsEmpfohlen: 2, // zwei Datensaetze: weniger Reichweite mit Hashtags
    korridor: { kurz: [15, 30], lang: [60, 90] },
  },
  {
    id: "tiktok",
    name: "TikTok",
    hashtagsMax: 8,
    hashtagsMin: 1, // gegenlaeufig zu Instagram: mit Hashtag mehr Views
    korridor: { kurz: [15, 30], lang: [120, 180] },
  },
  {
    id: "youtube",
    name: "YouTube Shorts",
    hashtagsMax: 5,
    korridor: { kurz: [15, 35], lang: [60, 180] },
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    // Bewusst KEINE hashtagsMax-Zahl: fuer die optimale Hashtag-Zahl auf LinkedIn gibt es
    // nur widerspruechliche Marketing-Blogs (Klasse D), kein Plattform-Wort und keinen
    // Anbieter-Datensatz. Statt eine Zahl zu erfinden, behandelt die Caption-Anweisung
    // LinkedIn-Hashtags neutral. Siehe docs/best-practices.md (Abschnitt LinkedIn).
    korridor: { kurz: [15, 30], lang: [120, 180] }, // LinkedIn (A) + Socialinsider (B), belegt in best-practices.md
  },
];

export const plattform = (id) => PLATTFORMEN.find((p) => p.id === id) || PLATTFORMEN[0];
export const plattformName = (id) => plattform(id).name;
export const saeuleName = (id) => kategorieName(id);

// Beste Veroeffentlichungszeiten je Plattform — Owner-Wunsch, hart hinterlegt (29.08.2026).
// Klasse B (Werkzeug-Anbieter-Datensaetze: Buffer 9,6 Mio./7 Mio./4,8 Mio. Beitraege, Sprout),
// also Richtung, nicht Gesetz: sobald ein Konto verbunden ist, schlaegt der eigene Median diese
// Defaults. Herkunft und Grenzen: docs/best-practices.md, Abschnitt 16.
export const POSTZEITEN = {
  instagram: { tage: ["Di", "Mi", "Do"], fenster: "11–13 oder 18–21 Uhr", satz: "Instagram Reels: Di bis Do, mittags 11–13 Uhr oder abends 18–21 Uhr." },
  tiktok: { tage: ["Sa", "So", "Mo"], fenster: "6–10 oder 18–22 Uhr", satz: "TikTok: am staerksten Sa, dazu So und Mo; morgens 6–10 oder abends 18–22 Uhr." },
  youtube: { tage: ["Di", "Mi"], fenster: "14–18 Uhr", satz: "YouTube Shorts: Di oder Mi, nachmittags 14–18 Uhr." },
  linkedin: { tage: ["Di", "Mi", "Do"], fenster: "15–18 Uhr", satz: "LinkedIn: Di bis Do, nachmittags 15–18 Uhr." },
};
export const postzeit = (id) => POSTZEITEN[id] || null;

// Standard-Plattformen fuer neue Karten (ueberschreibbar via /api/defaults).
export const STANDARD_PLATTFORMEN = ["instagram", "linkedin"];

// Wochentags-Nummern: Mo=1 .. So=7 (JS getDay: So=0 .. Sa=6).
const TAGE_NAMEN = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Schlaegt das naechste Upload-Datum vor: ≥21 Tage ab heute, Wochentag (Mo-Fr),
// bevorzugt die belegten besten Tage der gewaehlten Plattformen.
export function vorschlagUploadDatum(plattformen = STANDARD_PLATTFORMEN) {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const fruehestens = new Date(heute);
  fruehestens.setDate(fruehestens.getDate() + 21);

  // Beste Tage aller gewaehlten Plattformen sammeln, Schnittmenge bevorzugen.
  const alleTage = new Set();
  const schnitt = new Map();
  for (const pl of plattformen) {
    const pz = POSTZEITEN[pl];
    if (!pz) continue;
    for (const tag of pz.tage) {
      alleTage.add(tag);
      schnitt.set(tag, (schnitt.get(tag) || 0) + 1);
    }
  }
  // Sortiere nach Haeufigkeit (Schnittmenge zuerst), dann Reihenfolge Di>Mi>Do.
  const bevorzugt = [...alleTage]
    .sort((a, b) => (schnitt.get(b) || 0) - (schnitt.get(a) || 0))
    .map((t) => TAGE_NAMEN.indexOf(t));

  // Suche ab fruehestens: erst bevorzugte Tage, dann beliebigen Wochentag.
  for (let versatz = 0; versatz < 14; versatz++) {
    const kandidat = new Date(fruehestens);
    kandidat.setDate(kandidat.getDate() + versatz);
    const wt = kandidat.getDay();
    if (wt === 0 || wt === 6) continue; // Wochenende
    if (bevorzugt.length && bevorzugt.includes(wt)) return isoDatum(kandidat);
  }
  // Fallback: erster Wochentag ab fruehestens.
  for (let versatz = 0; versatz < 14; versatz++) {
    const kandidat = new Date(fruehestens);
    kandidat.setDate(kandidat.getDate() + versatz);
    const wt = kandidat.getDay();
    if (wt !== 0 && wt !== 6) return isoDatum(kandidat);
  }
  return isoDatum(fruehestens);
}

// Frueher ein Sonderweg (nur Dreh+Upload); ab v16 identisch zum Rueckwaertsplan, damit es
// keinen zweiten, widerspruechlichen Dreh-Vorlauf mehr gibt. Der Dreh kommt aus der
// Drehtermin-Zuordnung, nicht aus dem Upload-Datum.
export function einfacherPlan(uploadDatum) {
  return rueckwaertsplan(uploadDatum);
}

// --- Drehtermine (v16) ----------------------------------------------------

// Leerer Drehtermin. Karten kommen ueber karteIds hinzu; gcalEventId haelt den
// Google-Calendar-Eintrag; auto=true markiert einen automatisch gesetzten Termin.
export function leereDrehtermin(datum, zeit) {
  return {
    id: neueId(),
    datum: datum || "",
    zeit: zeit || "",
    ort: "",
    titel: "",
    notiz: "",
    karteIds: [],
    teilnehmer: [], // Mail-Adressen, die zum Kalender-Event eingeladen werden (v44)
    gcalEventId: "",
    auto: false,
  };
}

// Sonntag der FOLGE-Woche ab einem Stichtag (getDay: 0=So).
export function sonntagFolgewoche(ab = new Date()) {
  const d = new Date(ab);
  d.setHours(0, 0, 0, 0);
  const bisSonntag = (7 - d.getDay()) % 7; // 0, wenn der Stichtag ein Sonntag ist
  d.setDate(d.getDate() + bisSonntag + 7); // eine Woche weiter
  return isoDatum(d);
}

// Braucht es einen Auto-Drehtermin? Liefert das Datum (Sonntag der Folgewoche) oder null.
// Regel (Owner 02.09.2026): ist im Vorlauf-Fenster KEIN Drehtermin, wird einer gesetzt.
// Weil ein gesetzter Auto-Termin selbst in dieses Fenster faellt, erscheint der naechste erst,
// wenn der aktuelle verstrichen ist. Das Fenster ist seit v26 im Workflow-Tab einstellbar
// (Standard weiterhin 30 Tage).
export function autoDrehNoetig(drehtermine, heute = isoDatum(new Date()), vorlaufTage = 30) {
  const grenze = new Date(heute + "T00:00:00");
  grenze.setDate(grenze.getDate() + (Number(vorlaufTage) || 30));
  const grenzeIso = isoDatum(grenze);
  const kommend = (drehtermine || []).filter(
    (t) => t.datum && t.datum >= heute && t.datum <= grenzeIso
  );
  if (kommend.length) return null;
  return sonntagFolgewoche(new Date(heute + "T00:00:00"));
}

export const FORMATE = ["Reel", "Short", "TikTok", "LinkedIn-Video", "Carousel", "Bildpost"];

// --- Content-Typen, Inhaltskategorien (Redaktionsplan) --------------------

export const CONTENTTYPEN = [
  { id: "reel",       name: "Reel",              format: "Reel",     satz: "Kurzvideo — höchste organische Reichweite." },
  { id: "slider",     name: "Slider",             format: "Carousel", satz: "Karussell mit mehreren Karten — gut für Anleitungen." },
  { id: "beitrag",    name: "Beitrag mit Text",   format: "Bildpost", satz: "Einzelbild mit Caption-Fokus." },
  { id: "story",      name: "Story",              format: "Story",    satz: "Ephemer, 24 Stunden — Umfragen und direkter Austausch." },
  { id: "highlight",  name: "Highlight",          format: "Story",    satz: "Dauerhafter Story-Pin im Profil." },
  { id: "langformat", name: "Langformat-Video",   format: "Video",    satz: "Langes Video für YouTube oder LinkedIn." },
];

export const contenttypName = (id) => (CONTENTTYPEN.find((t) => t.id === id) || { name: id }).name;
export const contenttypFormat = (id) => (CONTENTTYPEN.find((t) => t.id === id) || { format: "Reel" }).format;

export const INHALTSKATEGORIEN_STANDARD = [
  { id: "bildung", name: "Bildung", satz: "Fakten, Anleitungen, Erklärungen — baut Autorität auf." },
  { id: "spendenaufruf", name: "Spendenaufruf", satz: "Bitte um finanzielle Unterstützung." },
  { id: "projektbegleitung", name: "Projektbegleitung", satz: "Einblicke in laufende Projekte." },
  { id: "partnerpost", name: "Partnerpost", satz: "Inhalte für und mit Förderern." },
  { id: "umfrage", name: "Umfrage / Austausch", satz: "Interaktionsformate: Fragen, Abstimmungen." },
];

// v78 Phase B: LIVE-Liste wie ZIELE (siehe dort) — Override aus boardparameter, Konstante als Fallback.
export const INHALTSKATEGORIEN = INHALTSKATEGORIEN_STANDARD.map((k, i) => ({ ...k, aktiv: true, prioritaet: i + 1 }));
export const aktiveKategorien = () =>
  INHALTSKATEGORIEN.filter((k) => k.aktiv !== false).sort((a, b) => (a.prioritaet ?? 99) - (b.prioritaet ?? 99));

export const kategorieName = (id) =>
  (INHALTSKATEGORIEN.find((k) => k.id === id) || INHALTSKATEGORIEN_STANDARD.find((k) => k.id === id) || { name: id }).name;

// Uebernimmt den boardparameter-Stand ({kategorien, ziele}) in die Live-Listen. Leere oder fehlende
// Listen lassen den bisherigen Stand stehen — lieber die Konstante als ein leeres Board.
export function setzeBoardparameter(bp) {
  const b = bp || {};
  const ersetze = (ziel, neu) => { ziel.splice(0, ziel.length, ...neu); };
  if (Array.isArray(b.kategorien) && b.kategorien.length)
    ersetze(INHALTSKATEGORIEN, b.kategorien.filter((k) => k && k.id).map((k, i) => ({
      ...(INHALTSKATEGORIEN_STANDARD.find((x) => x.id === k.id) || {}),
      ...k, name: k.name || k.id, aktiv: k.aktiv !== false,
      prioritaet: Number.isFinite(Number(k.prioritaet)) ? Number(k.prioritaet) : i + 1,
    })));
  if (Array.isArray(b.ziele) && b.ziele.length)
    ersetze(ZIELE, b.ziele.filter((z) => z && z.id).map((z) => ({
      ...(ZIELE_STANDARD.find((x) => x.id === z.id) || {}),
      ...z, name: z.name || z.id, aktiv: z.aktiv !== false,
    })));
}

export const neueSlotId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export function defaultPlan() {
  return {
    kadenz: { postsProWoche: 3 },
    maxAbstandTage: 0, // v79: 0 = keine Grenze; Owner setzt z. B. 9 (max. Tage zwischen 2 Posts)
    typenmix: [
      { typ: "reel", anteil: 60 },
      { typ: "slider", anteil: 25 },
      { typ: "beitrag", anteil: 10 },
      { typ: "story", anteil: 5 },
      { typ: "highlight", anteil: 0 },
    ],
    kategorienFokus: INHALTSKATEGORIEN_STANDARD.map((k, i) => ({
      id: k.id,
      aktiv: ["bildung", "spendenaufruf", "umfrage"].includes(k.id),
      prioritaet: i + 1,
    })),
    // v78 Phase D: %-Verteilung je Kategorie (Summe 100, analog zielgewichte). Aktiv/Prioritaet
    // stehen seit v78 in boardparameter; kategorienFokus bleibt nur als Seed-Quelle fuer die Migration.
    kategorienAnteil: [
      { id: "bildung", anteil: 50 },
      { id: "spendenaufruf", anteil: 30 },
      { id: "umfrage", anteil: 20 },
    ],
    zielgewichte: [
      { id: "reach_new", gewicht: 40 },
      { id: "deepen", gewicht: 20 },
      { id: "community", gewicht: 30 },
      { id: "donations", gewicht: 10 },
    ],
    kampagnen: [],
    slots: [],
  };
}

// --- Slot-Auswahl (v30, Forecast) ------------------------------------------
//
// Verallgemeinert die Ausschluss-Logik aus public/nachschub.js (ladeOffeneSlots()/holeIdee(),
// v17c): aus einer chronologisch sortierten Slot-Liste und einer Menge belegter
// "datum|uhrzeit"-Strings werden die ersten `anzahl` freien Slots geliefert (nicht nur der
// erste) — Grundlage fuer schwebende Karten (store.js schwebendeNeuBerechnen()). nachschub.js
// nutzt dieselbe Funktion, statt die Filterlogik ein zweites Mal zu pflegen.
export function naechsteFreieSlots(slots, belegteUploads, anzahl = 1) {
  const belegt = belegteUploads instanceof Set ? belegteUploads : new Set(belegteUploads || []);
  const frei = (slots || []).filter((s) => !belegt.has(s.datum + "|" + (s.uhrzeit || "")));
  return Number.isFinite(anzahl) ? frei.slice(0, anzahl) : frei;
}

// --- Fruehestes Upload-Datum (v37, P4) -------------------------------------
//
// Regel (Owner 07.09.2026): ein automatisch vergebenes Upload-Datum darf nie so frueh liegen,
// dass Schnitt oder Dreh in der Vergangenheit landen. Anker ist der NAECHSTE Drehtermin — so ist
// garantiert, dass der Content bis dahin gedreht werden kann. Gibt es keinen kommenden Drehtermin,
// greift der Sonntag der Folgewoche — genau das Datum, das der Auto-Drehtermin setzen wuerde.
// v113 (H2, Owner 07.10.2026): Upload = Drehtermin + kumulierter Dreh-Vorlauf der Deadline-Kette
// (Standard 3 + 3 + 6 = 12 Tage, folgt „Termine & Fristen"). Bis v112 stand hier fest + 8 (Regel v37) —
// das widersprach der v70-Sperre „Dreh spaetestens Upload − 12": der eigene Vorschlag machte den
// naechsten Drehtermin unzuweisbar (v112 H2, gemessen: Dreh 18.10., Vorschlag 27.10., Sperre ab 15.10.).
export const uploadNachDrehTage = () => kumuliert().dreh;

// Der naechste Drehtermin ab heute; ohne kommenden Termin der Sonntag der Folgewoche.
export function naechsterDrehterminDatum(drehtermine, heute = isoDatum(new Date())) {
  const kommend = (drehtermine || [])
    .map((t) => t && t.datum)
    .filter((d) => d && d >= heute)
    .sort();
  return kommend[0] || sonntagFolgewoche(new Date(heute + "T00:00:00"));
}

// Fruehestes zulaessiges Upload-Datum: naechster Drehtermin + Dreh-Vorlauf (uploadNachDrehTage).
export function fruehesterUpload(drehtermine, heute = isoDatum(new Date())) {
  const d = new Date(naechsterDrehterminDatum(drehtermine, heute) + "T00:00:00");
  d.setDate(d.getDate() + uploadNachDrehTage());
  return isoDatum(d);
}

// --- Namen und Pfade ------------------------------------------------------

export function slug(s) {
  return (
    (s || "")
      .replace(/[äÄ]/g, "ae")
      .replace(/[öÖ]/g, "oe")
      .replace(/[üÜ]/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .slice(0, 32) || "Ohne"
  );
}

// Der Ordnername eines Projekts. NUR beim Anlegen aufrufen — danach lebt das Ergebnis als
// card.driveName weiter, sonst verwaist jedes Umbenennen den Ordner (Befund B2).
//
// v85-C (Owner 30.09.2026, Grundsatz „ohne Board arbeitsfaehig"): NEUE Projektordner heissen im
// Klartext („Bienen und ihre Blumenfreunde" statt „BienenundihreBlumenfreunde"), mit Reihe
// „World Eden EP03 – Boden wie ein Schwamm". Bestehende Ordner behalten ihren eingefrorenen
// driveName. Nur Zeichen, die Windows (Projektordner-Download) oder URLs stoeren, fallen weg.
// --- KI-Antworten lesen (v104) --------------------------------------------
//
// Zieht das JSON-Objekt aus einer KI-Antwort — auch mit Code-Zaun, Text drumherum oder kleinen
// Formfehlern lokaler Modelle. Belegt 01.10.2026: eine Recherche-Antwort scheiterte nur an einem
// ueberzaehligen Komma vor „]" und landete als unlesbarer Rohtext im Board. Rein, Browser + Server.
export function parseJsonNachsichtig(text) {
  let t = String(text || "").trim();
  const zaun = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (zaun) t = zaun[1].trim();
  const a = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (a >= 0 && e > a) t = t.slice(a, e + 1);
  const versuche = [
    t,
    t.replace(/,\s*([\]}])/g, "$1"), // ueberzaehlige Kommas
    t.replace(/,\s*([\]}])/g, "$1").replace(/[“”„]/g, '"'), // typografische Anfuehrungszeichen als Trenner
  ];
  for (const v of versuche) {
    try { return JSON.parse(v); } catch { /* naechster Versuch */ }
  }
  return null;
}

export function klartext(s, max = 60) {
  let t = String(s || "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (t.length > max) {
    const schnitt = t.slice(0, max);
    const wort = schnitt.lastIndexOf(" ");
    t = (wort > max * 0.6 ? schnitt.slice(0, wort) : schnitt).replace(/[.\s]+$/g, "");
  }
  return t;
}

export function projektNameNeu(card) {
  const thema = klartext(card.title) || "Ohne Titel";
  if (!card.serie) return thema;
  const ep = (card.episode || "00").toString().padStart(2, "0");
  return `${klartext(card.serie, 40) || "Reihe"} EP${ep} – ${thema}`;
}

// Die Namensregel bis v84 (Slug) — nur noch fuer die Alt-Migration in migriere(): Karten, deren
// Ordner schon existiert, aber noch keinen driveName tragen, muessen den ALTEN Namen bekommen.
function projektNameAlt(card) {
  const thema = slug(card.title);
  if (!card.serie) return thema;
  const ep = (card.episode || "00").toString().padStart(2, "0");
  return `${slug(card.serie)}_EP${ep}_${thema}`;
}

// Der Ordnername, der tatsaechlich gilt: der gespeicherte, sonst ein frisch abgeleiteter.
export const projektName = (card) => card.driveName || projektNameNeu(card);
export const projektPfad = (card, spalte) => `${phaseOrdner(spalte || card.column)}/${projektName(card)}`;

export const UNTERORDNER = ["Skript und Caption", "Rohmaterial", "Fertiges Video"];

// (AI only)-Konvention (v17, Owner 02.09.2026): reine Maschinen-/KI-Dateien liegen nie im selben
// Ordner wie menschlich lesbare Dateien. Jeder Ordner, der NUR Maschinen-Dateien enthaelt, traegt
// dieses Suffix, damit ein Mensch beim Bearbeiten sofort sieht, was er ignorieren kann.
//   AI_ORDNER      pro Karte: haelt projekt.json (die Karten-Wahrheit)
//   SYSTEM_ORDNER  Root-Store: Spalten- und Redaktionsplan-Dateien (v17b/v17d)
// Beide sind pfadstueckOk-konform (Klammern und Leerzeichen erlaubt, kein Slash, kein Punkt-Ordner).
export const AI_ORDNER = "(AI only)";
export const SYSTEM_ORDNER = "System (AI only)";
// v113 (H4): Systemordner, die das Board selbst in „Videoauswertung" anlegt (KPI-Messungen, Auswertungs-
// Tabellen). Sie sind KEINE Projekte — der Abgleich machte bis v112 Geisterkarten daraus.
export const SYSTEM_UNTERORDNER = ["KPI", "Auswertung-Tabellen"];
export const istSystemOrdner = (phaseId, name) => phaseId === "fertig" && SYSTEM_UNTERORDNER.includes(name);

// Der Ort der Karten-Wahrheit innerhalb eines Projektordners.
export const projektJsonPfad = (basis) => `${basis}/${AI_ORDNER}/projekt.json`;

// Ein Pfadstueck ist gueltig, wenn es weder Trenner noch Auf-/Absteiger enthaelt.
// Ohne diese Pruefung legt rclone Ordner namens ".." an (Befund B3).
export const pfadstueckOk = (s) =>
  typeof s === "string" && s.length > 0 && s.length <= 120 && !/[\\/]/.test(s) && !/^\.+$/.test(s);

export const DATEINAMEN = {
  recherche: "00_recherche.md",
  skript: "10_skript.txt",
  regieplan: "20_regieplan.md",
  caption: "30_caption.md",
};

export const VIDEO_ENDUNGEN = [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"];

export function videoDateiname(card) {
  const format = slug(contenttypName(card.contenttyp || "reel"));
  const thema = slug(card.title);
  if (!card.serie) return `WEE_${thema}_${format}.mp4`;
  const ep = (card.episode || "00").toString().padStart(2, "0");
  return `WEE_${slug(card.serie)}_EP${ep}_${thema}_${format}.mp4`;
}

// --- Karten-Schema und Migration -----------------------------------------

export const SCHEMA = 2;

export const neueId = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function leereKarte(spalte) {
  return {
    id: neueId(),
    schema: SCHEMA,
    column: spalte || "idee",
    title: "Neue Idee",
    notes: "",
    serie: "",
    episode: "",
    contenttyp: "",
    kategorie: "",
    goal: "",
    platforms: [],
    owner: "",
    hook: { text: "", visual: "" },
    cta: { text: "", directness: "indirekt" },
    frame: { problem: "", solution: "" },
    caption: { lead: "", body: "", keywords: [], hashtags: {} },
    video: { seconds: 0, hasCaptions: false, watermarkFree: false, speakerOnCamera: false, directGaze: false },
    dates: {},
    uploadTime: "",
    floatUpload: false, // v30: schwebend auf "naechster freier Slot" statt festem Datum
    drehterminId: null,
    checks: {},
    ai: {},
    driveName: "",
    published: {},
    metrics: {},
    kpiMessungen: {},
  };
}

// Hebt eine Karte aus dem alten Schema an, ohne etwas zu verlieren.
export function migriere(card) {
  const k = { ...card };
  if (k.schema === SCHEMA) return normalisiere(k);

  k.dates = k.dates || {};
  if (k.uploadDate && !k.dates.upload) k.dates.upload = k.uploadDate;
  delete k.uploadDate;

  if (!Array.isArray(k.platforms))
    k.platforms = k.format === "LinkedIn" ? ["linkedin"] : ["instagram"];

  // Karten von vor dem stabilen Namen: Namen jetzt einfrieren, damit ein spaeteres
  // Umbenennen den vorhandenen Drive-Ordner nicht verliert (Befund B2).
  if (!k.driveName && k.driveCreated && k.title) k.driveName = projektNameAlt(k); // v85-C: Alt-Ordner heissen nach der alten Regel

  // Der alte Freitext "freigabe" trug Fokus und Hook zusammen — Hook daraus retten.
  if (!k.hook && typeof k.freigabe === "string") {
    const verbal = (k.freigabe.match(/Hook verbal:\s*(.+)/) || [])[1] || "";
    const visuell = (k.freigabe.match(/Hook visuell:\s*(.+)/) || [])[1] || "";
    if (verbal || visuell) k.hook = { text: verbal.trim(), visual: visuell.trim() };
  }

  // v10→v11: pillar → kategorie, format → contenttyp
  if (k.pillar && !k.kategorie) { k.kategorie = k.pillar; delete k.pillar; }
  if (k.format && !k.contenttyp) {
    const map = { Reel: "reel", Carousel: "slider", Bildpost: "beitrag", Story: "story" };
    k.contenttyp = map[k.format] || "reel";
    delete k.format;
  }

  k.schema = SCHEMA;
  return normalisiere(k);
}

// Fuellt fehlende Zweige auf, ohne vorhandene Werte anzufassen.
function normalisiere(k) {
  const leer = leereKarte(k.column);
  for (const [feld, wert] of Object.entries(leer)) {
    if (feld === "id") continue;
    if (k[feld] === undefined || k[feld] === null) k[feld] = wert;
    else if (wert && typeof wert === "object" && !Array.isArray(wert) && typeof k[feld] === "object")
      k[feld] = { ...wert, ...k[feld] };
  }
  if (!PHASE_IDS.includes(k.column)) k.column = "idee";
  if (!Array.isArray(k.platforms) || !k.platforms.length) k.platforms = ["instagram"];
  if (!Array.isArray(k.caption.keywords)) k.caption.keywords = [];
  if (!k.caption.hashtags || typeof k.caption.hashtags !== "object") k.caption.hashtags = {};
  return k;
}

// --- Masse (alle belegt, Quelle in docs/best-practices.md) ----------------

// --- KPI-Messintervalle ---------------------------------------------------
//
// Jeder Upload wird pro Plattform in diesen Abstaenden gemessen. "tage" zaehlt ab
// dem Upload-Datum. Eine erfasste Messung wird nie wiederholt (Owner 31.08.2026).

export const KPI_INTERVALLE = [
  { id: "24h", name: "24 Stunden", tage: 1 },
  { id: "3d", name: "3 Tage", tage: 3 },
  { id: "5d", name: "5 Tage", tage: 5 },
  { id: "2w", name: "2 Wochen", tage: 14 },
  { id: "1m", name: "1 Monat", tage: 30 },
  { id: "2m", name: "2 Monate", tage: 60 },
  { id: "3m", name: "3 Monate", tage: 90 },
  { id: "4m", name: "4 Monate", tage: 120 },
  { id: "5m", name: "5 Monate", tage: 150 },
  { id: "6m", name: "6 Monate", tage: 180 },
  { id: "7m", name: "7 Monate", tage: 210 },
  { id: "8m", name: "8 Monate", tage: 240 },
  { id: "9m", name: "9 Monate", tage: 270 },
  { id: "10m", name: "10 Monate", tage: 300 },
  { id: "11m", name: "11 Monate", tage: 330 },
  { id: "12m", name: "12 Monate", tage: 365 },
];

// Welche Messung ist als naechste faellig? Gibt null zurueck, wenn alle erfasst oder
// der Post noch zu jung ist.
export function naechsteMessung(uploadDatum, erfassteIds = []) {
  if (!uploadDatum) return null;
  const upload = new Date(uploadDatum + "T00:00:00");
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const tageHer = Math.round((heute - upload) / 86400000);
  if (tageHer < 0) return null;

  const erfasst = new Set(erfassteIds);
  for (const intervall of KPI_INTERVALLE) {
    if (erfasst.has(intervall.id)) continue;
    if (tageHer >= intervall.tage) return intervall;
  }
  return null;
}

// Alle faelligen Messungen auf einmal (fuer Batch-Erfassung).
export function faelligeMessungen(uploadDatum, erfassteIds = []) {
  if (!uploadDatum) return [];
  const upload = new Date(uploadDatum + "T00:00:00");
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const tageHer = Math.round((heute - upload) / 86400000);
  if (tageHer < 0) return [];

  const erfasst = new Set(erfassteIds);
  return KPI_INTERVALLE.filter((i) => !erfasst.has(i.id) && tageHer >= i.tage);
}

export const MASSE = {
  // Owner-Regel seit v3, KEINE Messfrage — bleibt Vorgabe, auch wo die Daten anderes nahelegen.
  sprechzeitMax: 50,
  sprechzeitMin: 20,
  woerterProSekunde: 2.3, // deutsche Sprechrate, rund 140 Woerter je Minute
  hookSekunden: 3, // Instagram misst Skip Rate bei genau 3 Sekunden (24.08.2025)
  hookWoerterMax: 12, // was in 3 Sekunden gesprochen hineinpasst
  captionLeadMax: 125, // danach kappt Instagram; zugleich der Google-Ausschnitt seit 10.07.2025
  postsProWocheMin: 3, // einzige unstrittige Frequenz-Aussage: Wochen ohne Beitrag schaden
  bewertungsfensterTage: 10, // TikTok: 96 % der Reichweite faellt in die ersten 10 Tage
  vergleichsfenster: 20, // gleitender Median der eigenen letzten 20 Beitraege statt Branchenwerte
};

export const sprechzeit = (text) =>
  Math.round((text || "").trim().split(/\s+/).filter(Boolean).length / MASSE.woerterProSekunde);

// Der erste gesprochene Satz eines Skripts — der Hook.
export function ersterSatz(text) {
  const zeilen = (text || "")
    .split(/\r?\n/)
    .map((z) => z.replace(/^\s*\[CHUNK\s*\d+\]\s*/i, "").trim())
    .filter((z) => z && !/^[#*>|-]/.test(z));
  if (!zeilen.length) return "";
  return zeilen[0].split(/(?<=[.!?])\s/)[0] || zeilen[0];
}

// Erkennt die Bitte um Likes — sie kostet belegt 60 % der Interaktionen.
export const bittetUmLikes = (text) =>
  /\b(lik(e|es|et|t)\s*(mal|doch|das|den|diesen)?|daumen\s*hoch|gef[äa]llt\s*mir\s*(dr[üu]ck|klick)|herz\s*dalassen)\b/i.test(
    text || ""
  );

// Zaehlt die Aufrufe zum Handeln — genau einer ist belegt am besten.
export function ctaAnzahl(text) {
  const t = (text || "").toLowerCase();
  const muster = [
    /\bkommentier/, /\bschreib(\s|t\s|e\s)?(mir|uns)/, /\bfolg(e|t|en)\b/, /\bteil(e|t)\b/,
    /\bspeicher/, /\bsende?\s|\bschick/, /\bspend(e|et|en)\b/, /\blink\s+in\s+(der\s+)?bio/,
  ];
  return muster.filter((m) => m.test(t)).length;
}

// Der Laengen-Korridor fuer Plattform und Ziel.
export function korridor(platformId, goalId) {
  const p = plattform(platformId);
  return zielInfo(goalId).tiefe ? p.korridor.lang : p.korridor.kurz;
}

// --- Qualitaetstore -------------------------------------------------------
//
// Status folgt dem UI-Standard der Werkbank: ok · hinweis · fehlt · befund · entfaellt.
// `sperrt: true` heisst: die Karte darf nicht weiter, bevor das behoben ist.

const tor = (id, status, satz, sperrt = false, quelle = "") => ({ id, status, satz, sperrt, quelle });

// v75: eine echte Skript-Datei im Drive-Ordner „Skript und Caption". Nur Dateien mit „skript" im
// Namen zaehlen (case-insensitive) — sonst wuerde eine reine Caption-Datei im selben Ordner die Sperre
// faelschlich oeffnen. Nutzt den Scan (`d.skriptDateien`, projects.scan()).
// v113 (N1, Owner 07.10.2026): Skript-Dokument = eine Datei, die „skript" als EIGENES Wort im Namen traegt
// („10_skript.txt", „Skript final.docx") — nicht „Transkript Interview.txt", „Videoskript", „Skripte".
const SKRIPT_WORT = /(^|[^a-zäöüß])skript([^a-zäöüß]|$)/i;
const hatSkript = (d) => (((d && d.skriptDateien) || []).some((n) => SKRIPT_WORT.test(String(n))));

// v113 (H1, Owner 07.10.2026): Slider, Beitrag, Story/Highlight und Langformat haben eigene KI-Ablaeufe ohne
// Fokus/Hook (public/detail.js guidedFormat). Sie geben „Skript schreiben" mit ihrer gespeicherten Format-Datei
// frei. Dieselbe Tabelle nutzt der Speichern-Knopf der Format-Ablaeufe.
export const FORMAT_DATEINAMEN = { Carousel: "10_slider.md", Bildpost: "10_beitrag.md", Story: "10_story.md", Video: "10_konzept.md" };
const formatDatei = (card) => (card && card.contenttyp && card.contenttyp !== "reel" ? FORMAT_DATEINAMEN[contenttypFormat(card.contenttyp)] || null : null);
// Reel (oder noch kein Format) laeuft den Fokus/Hook/Skript-Ablauf.
export const istReelAblauf = (card) => !formatDatei(card);
const formatDateiTor = (card, d, sperrt) => {
  const datei = formatDatei(card);
  const da = ((d && d.skriptDateien) || []).some((n) => String(n).toLowerCase() === datei);
  return tor("format-datei", da ? "ok" : "fehlt",
    da
      ? `Im Ordner „Skript und Caption“ liegt „${datei}“.`
      : `Im Ordner „Skript und Caption“ liegt noch kein „${datei}“ — „Inhalt nach Drive speichern“ legt ihn dort ab.`,
    sperrt);
};
// Das Dokument, das „Skript schreiben" abschliesst: Skript (Reel) oder Format-Datei (alle anderen).
const dokumentTor = (card, d, sperrt) => (istReelAblauf(card) ? skriptDateiTor(d, sperrt) : formatDateiTor(card, d, sperrt));

// Das Skript-Datei-Tor (v75): in `idee` sperrt es den Uebergang nach „Drehtermin festlegen"; in
// `skript`/`videodreh` markiert es Altlasten (nicht sperrend, ueber KATALOG als rotes „!"). Braucht den
// Drive-Scan — steht in board.js BRAUCHT_DRIVE, damit es nicht vor dem Scan feuert.
const skriptDateiTor = (d, sperrt) =>
  tor("skript-datei", hatSkript(d) ? "ok" : "fehlt",
    hatSkript(d)
      ? "Im Ordner „Skript und Caption“ liegt ein Skript-Dokument."
      : "Im Ordner „Skript und Caption“ liegt noch kein Skript-Dokument (Datei mit „skript“ im Namen).",
    sperrt);

// v79 (W1): Hat dieses Format eine Video-Produktion (Dreh, Rohmaterial, Schnitt, Untertitel)?
// Reel (Kurzvideo) und Video (Langformat) schon; Carousel/Bildpost/Story nicht — fuer sie werden
// die video-spezifischen SPERR-Tore unten nicht-sperrend, damit die Karte durchs Board kann, ohne
// Drehtermin/Rohmaterial/Untertitel. Format-neutrale Tore (Thema, Kategorie, Ziel, Plattform,
// Caption) bleiben unveraendert. Ein-Stellen-Schraube: hier das Format ergaenzen/wegnehmen.
export function hatVideoProduktion(card) {
  const f = contenttypFormat((card && card.contenttyp) || "reel");
  return f === "Reel" || f === "Video";
}

// Video-spezifische Sperr-Tore, die fuer Formate OHNE Videoproduktion entfallen.
const VIDEO_SPERR_TORE = new Set([
  "skript", "hook", "hook-bild", "rohmaterial", "final", "untertitel", "wasserzeichen", "skript-datei",
]);

export function tore(card, drive) {
  const d = drive || {};
  const t = [];
  const p = card.column;
  const ziel = zielInfo(card.goal);

  if (p === "idee") {
    const hatThema = card.title && card.title !== "Neue Idee";
    t.push(tor("thema", hatThema ? "ok" : "fehlt",
      hatThema ? `Das Thema heisst "${card.title}".` : "Die Karte hat noch kein eigenes Thema.", true));

    t.push(tor("saeule", card.kategorie ? "ok" : "fehlt",
      card.kategorie
        ? `Die Karte gehoert zur Kategorie "${kategorieName(card.kategorie)}".`
        : "Keine Kategorie gewaehlt — ohne sie laesst sich nicht messen, welche Richtung traegt.", true));

    t.push(tor("ziel", card.goal ? "ok" : "fehlt",
      card.goal
        ? `Ziel ist "${ziel.name}", gemessen wird an: ${ziel.kennzahl}.`
        : "Ohne Ziel weiss niemand, welche Zahl hinterher zaehlt.", true,
      "Mosseri 22.01.2025"));

    // v113 (H1): bis v112 pruefte das Tor `card.chosenHook` — ein Feld, das nirgends gesetzt wird; „Weiter" war
    // dadurch in „Skript schreiben" immer gesperrt. Der Reel-Ablauf setzt chosenFokus/chosenVerbal/chosenVisuell.
    if (istReelAblauf(card)) {
      const gewaehlt = card.chosenFokus != null && card.chosenVerbal != null && card.chosenVisuell != null;
      t.push(tor("fokus", gewaehlt ? "ok" : "fehlt",
        gewaehlt ? "Fokus, gesprochener und sichtbarer Hook sind gewaehlt." : "Fokus und Hooks (gesprochen und sichtbar) sind noch nicht gewaehlt.", true));
    }

    // v75: erst mit echtem Dokument in Drive weiter nach „Drehtermin festlegen" (v113: Format-Datei je Format).
    t.push(dokumentTor(card, d, true));
  }

  if (p === "skript") {
    // v31: manche Karten haben die Idee-Phase vor der Kategorie-Pflicht (unten) verlassen —
    // hier trotzdem sperrend fuehren, statt es dabei zu belassen.
    t.push(tor("saeule", card.kategorie ? "ok" : "fehlt",
      card.kategorie
        ? `Die Karte gehoert zur Kategorie "${kategorieName(card.kategorie)}".`
        : "Keine Kategorie gewaehlt — ohne sie laesst sich nicht messen, welche Richtung traegt.", true));

    const text = card.skriptFinal || (card.ai && card.ai.skript) || "";
    const s = sprechzeit(text);

    if (!text) t.push(tor("skript", "fehlt", "Es gibt noch keinen Sprechertext.", true));
    else if (s > MASSE.sprechzeitMax)
      t.push(tor("skript", "befund",
        `Der Sprechertext dauert etwa ${s} Sekunden — ${s - MASSE.sprechzeitMax} ueber der Hausregel von ${MASSE.sprechzeitMax}.`,
        true, "Owner-Regel seit v3"));
    else if (s < MASSE.sprechzeitMin)
      t.push(tor("skript", "hinweis", `Der Sprechertext dauert nur etwa ${s} Sekunden — knapp fuer eine Aussage.`));
    else t.push(tor("skript", "ok", `Der Sprechertext dauert etwa ${s} Sekunden und liegt im Rahmen.`));

    // Wo Plattform und Ziel einen anderen Korridor nahelegen, wird das gemeldet — nicht erzwungen.
    for (const pl of card.platforms || []) {
      const [min, max] = korridor(pl, card.goal);
      if (s && (s < min || s > max))
        t.push(tor(`korridor-${pl}`, "hinweis",
          `Fuer ${plattformName(pl)} mit dem Ziel "${ziel.name}" liegen ${min} bis ${max} Sekunden im belegten Korridor, das Skript hat etwa ${s}.`,
          false, "docs/best-practices.md, Regel 7"));
    }

    const hookText = (card.hook && card.hook.text) || ersterSatz(text);
    const hw = hookText ? hookText.trim().split(/\s+/).length : 0;
    if (!hookText) t.push(tor("hook", "fehlt", "Der gesprochene Einstieg fehlt.", true));
    else if (hw > MASSE.hookWoerterMax)
      t.push(tor("hook", "hinweis",
        `Der Einstieg hat ${hw} Woerter — in die ersten ${MASSE.hookSekunden} Sekunden passen etwa ${MASSE.hookWoerterMax}.`,
        false, "Instagram Skip Rate, 24.08.2025"));
    else t.push(tor("hook", "ok", `Der Einstieg hat ${hw} Woerter und passt in die ersten ${MASSE.hookSekunden} Sekunden.`));

    const visuell = card.hook && card.hook.visual;
    t.push(tor("hook-bild", visuell ? "ok" : "fehlt",
      visuell
        ? "Der Einstieg ist auch als Bild beschrieben und funktioniert ohne Ton."
        : "Es steht nicht, was in der ersten Sekunde zu SEHEN ist — bei stummem Abspielen traegt nur das Bild.",
      true, "Meta: 80 bis 85 Prozent schauen ohne Ton"));

    const pr = card.frame && card.frame.problem;
    const lo = card.frame && card.frame.solution;
    if (pr && lo) t.push(tor("frame", "ok", "Problem und Handlung stehen beide — der belegte Kompromiss."));
    else if (pr && !lo)
      t.push(tor("frame", "hinweis",
        "Nur das Problem steht. Das bringt mehr Reichweite, aber negativere Resonanz.",
        false, "Science Communication 2025, 3,1 Mio. Beitraege"));
    else if (!pr && lo)
      t.push(tor("frame", "hinweis",
        "Nur die Loesung steht. Das bringt positivere Resonanz, aber belegt weniger Reichweite.",
        false, "Science Communication 2025"));
    else t.push(tor("frame", "fehlt", "Weder Problem noch Handlung sind benannt."));

    // v75: ersetzt den weichen `gespeichert`-Flag-Hinweis durch das scan-basierte Skript-Datei-Tor
    // (nicht sperrend hier — Altlast-Markierung, kein Zurueckschieben). v113: je Format das passende Dokument.
    t.push(dokumentTor(card, d, false));
  }

  if (p === "videodreh") {
    t.push(tor("rohmaterial", d.rohmaterial > 0 ? "ok" : "fehlt",
      d.rohmaterial > 0
        ? `Im Ordner "Rohmaterial" liegen ${d.rohmaterial} Dateien.`
        : "Im Ordner „Rohmaterial“ liegt noch nichts.", true));

    // v75: Altlast-Markierung — Karte steht im Videodreh ohne Skript-Dokument (nicht sperrend).
    t.push(dokumentTor(card, d, false));

    const v = card.video || {};
    t.push(tor("blick", v.directGaze ? "ok" : "hinweis",
      v.directGaze
        ? "Es gibt eine Einstellung mit Blick in die Kamera."
        : "Keine Einstellung mit Blick in die Kamera vermerkt — bei NGO-Inhalten belegt wirksam.",
      false, "Mass Communication and Society 2024"));

    t.push(tor("sprecher", v.speakerOnCamera ? "ok" : "hinweis",
      v.speakerOnCamera
        ? "Eine Person spricht vor der Kamera."
        : "Niemand spricht vor der Kamera — Fachleute schlagen belegt den institutionellen Absender.",
      false, "Frontiers in Climate 2026"));
  }

  if (p === "schnitt") {
    t.push(tor("final", d.final > 0 ? "ok" : "fehlt",
      d.final > 0
        ? "Im Ordner „Fertiges Video“ liegt das geschnittene Video."
        : "Im Ordner „Fertiges Video“ liegt noch kein Video.", true));

    const v = card.video || {};
    t.push(tor("untertitel", v.hasCaptions ? "ok" : "fehlt",
      v.hasCaptions
        ? "Das Video hat Untertitel."
        : "Das Video hat keine Untertitel — vier von fuenf schauen ohne Ton.",
      true, "Meta Business Help Center, TikTok Marketing Science 2021"));

    const iG = (card.platforms || []).includes("instagram");
    if (iG)
      t.push(tor("wasserzeichen", v.watermarkFree ? "ok" : "fehlt",
        v.watermarkFree
          ? "Der Export traegt kein fremdes Wasserzeichen."
          : "Nicht bestaetigt, dass der Export frei von TikTok- oder CapCut-Wasserzeichen ist. Instagram schliesst solche Videos von Empfehlungen an Nicht-Follower aus.",
        true, "Instagram Recommendation Eligibility"));
  }

  if (p === "caption") {
    const c = card.caption || {};
    const lead = (c.lead || "").trim();
    if (!lead) t.push(tor("lead", "fehlt", "Der Caption-Vorspann fehlt — er ist der einzige garantiert sichtbare Teil.", true,
      "Google-Indexierung seit 10.07.2025"));
    else if (lead.length > MASSE.captionLeadMax)
      t.push(tor("lead", "befund",
        `Der Vorspann hat ${lead.length} Zeichen — nach ${MASSE.captionLeadMax} kappt Instagram mit „mehr“.`, true));
    else
      t.push(tor("lead", "ok",
        `Der Vorspann hat ${lead.length} von ${MASSE.captionLeadMax} Zeichen und bleibt damit ganz sichtbar.`));

    const kw = (c.keywords || []).length;
    t.push(tor("keywords", kw >= 3 ? "ok" : "hinweis",
      kw >= 3
        ? `${kw} Suchbegriffe hinterlegt — sie ersetzen die Auffindbarkeit, die Hashtags nie hatten.`
        : "Weniger als drei Suchbegriffe. Seit Juli 2025 indexiert Google die Caption.",
      false, "Meta-Ankuendigung 10.07.2025"));

    // Hashtags je Plattform: Instagram und TikTok verlangen Gegenlaeufiges.
    for (const pl of card.platforms || []) {
      const info = plattform(pl);
      const tags = (c.hashtags && c.hashtags[pl]) || [];
      if (info.hashtagsMax != null && tags.length > info.hashtagsMax)
        t.push(tor(`hashtags-${pl}`, "befund",
          `${tags.length} Hashtags fuer ${info.name} — dort sind hoechstens ${info.hashtagsMax} erlaubt.`,
          true, pl === "instagram" ? "Instagram-Limit seit 18.12.2025" : ""));
      else if (pl === "instagram" && tags.length > info.hashtagsEmpfohlen)
        t.push(tor("hashtags-instagram", "hinweis",
          `${tags.length} Hashtags fuer Instagram. Zwei grosse Datensaetze zeigen dort weniger Reichweite mit Hashtags — hoechstens ${info.hashtagsEmpfohlen} sind die Empfehlung.`,
          false, "Metricool 2026, SocialPilot 2024"));
      else if (pl === "tiktok" && tags.length < (info.hashtagsMin || 0))
        t.push(tor("hashtags-tiktok", "hinweis",
          "Auf TikTok wirken Hashtags gegenlaeufig zu Instagram: mit mindestens einem gibt es mehr Views.",
          false, "Metricool TikTok 2026"));
      else t.push(tor(`hashtags-${pl}`, "ok", `${tags.length} Hashtag${tags.length === 1 ? "" : "s"} fuer ${info.name}.`));
    }

    const ganz = `${lead}\n${c.body || ""}\n${(card.cta && card.cta.text) || ""}`;
    if (bittetUmLikes(ganz))
      t.push(tor("likebitte", "befund",
        "Der Text bittet um Likes. Das senkt die Interaktionen belegt um 60 Prozent.", true,
        "Metricool TikTok 2026"));

    // v113 (H7, Owner 07.10.2026): Steht etwas im Feld „Aufruf zum Handeln", zaehlt das als genau EIN Aufruf —
    // auch indirekt formuliert (eine Frage), wie Feld und Caption-Prompt es verlangen. Die Verb-Muster zaehlen
    // nur noch im Vorspann/Text, damit dort zusaetzliche Aufrufe als „mehrere" auffallen.
    const ctaFeld = ((card.cta && card.cta.text) || "").trim();
    const n = (ctaFeld ? 1 : 0) + ctaAnzahl(`${lead}\n${c.body || ""}`);
    if (n === 0) t.push(tor("cta", "fehlt", "Es steht kein Aufruf zum Handeln im Text.", true));
    else if (n > 1)
      t.push(tor("cta", "befund",
        `Es stehen ${n} verschiedene Aufrufe im Text. Mehrere zusammen heben ihre Wirkung gegenseitig auf — genau einer.`,
        true, "Mass Communication and Society, Folgestudie 2025"));
    else t.push(tor("cta", "ok", "Genau ein Aufruf zum Handeln — so wirkt er am besten."));

    const frage = /\?/.test(ganz);
    t.push(tor("frage", frage ? "ok" : "hinweis",
      frage
        ? "Der Text stellt eine Frage — belegt mehr Kommentare."
        : "Keine Frage im Text. Eine Frage bringt auf Instagram 37 und auf TikTok 26 Prozent mehr Kommentare.",
      false, "Metricool 2026"));
  }

  if (p === "upload") {
    const wann = (card.dates || {}).upload;
    t.push(tor("termin", wann ? "ok" : "hinweis",
      wann
        ? `Veroeffentlichung geplant fuer den ${deutschesDatum(wann)}${card.uploadTime ? ` um ${card.uploadTime} Uhr` : ""}.`
        : "Fuer die Veroeffentlichung ist kein Datum gesetzt."));

    const pl = card.platforms || [];
    t.push(tor("plattform", pl.length ? "ok" : "fehlt",
      pl.length ? `Geplant fuer ${pl.map(plattformName).join(" und ")}.` : "Es ist keine Plattform ausgewaehlt.", true));

    const verknuepft = Object.keys(card.published || {}).length;
    t.push(tor("verknuepft", verknuepft ? "ok" : "hinweis",
      verknuepft
        ? `Der veroeffentlichte Beitrag ist mit dieser Karte verknuepft.`
        : "Noch kein veroeffentlichter Beitrag verknuepft — ohne die Verknuepfung kommen keine Zahlen zurueck."));
  }

  // v79 (W1): Formate ohne Videoproduktion (Slider/Beitrag/Story) werden von den video-spezifischen
  // Sperr-Toren nicht aufgehalten — sie entfallen. Format-neutrale Tore bleiben sperrend.
  if (!hatVideoProduktion(card)) {
    for (const g of t) {
      if (VIDEO_SPERR_TORE.has(g.id) && g.sperrt) {
        g.sperrt = false;
        if (g.status === "fehlt" || g.status === "befund") {
          g.status = "entfaellt";
          g.satz = "Entfaellt fuer dieses Format (kein Videodreh).";
        }
      }
    }
  }

  return t;
}

export const sperren = (toreListe) => toreListe.filter((x) => x.sperrt && x.status !== "ok");

// --- Board-Ebene ----------------------------------------------------------

// Wochen ohne Veroeffentlichung schaden belegt. Prueft die laufende Woche.
export function wochenlast(cards, heute = new Date()) {
  const start = new Date(heute);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Montag
  const ende = new Date(start);
  ende.setDate(ende.getDate() + 7);

  const geplant = cards.filter((c) => {
    const u = (c.dates || {}).upload;
    if (!u) return false;
    const d = new Date(u + "T00:00:00");
    return d >= start && d < ende;
  }).length;

  if (geplant >= MASSE.postsProWocheMin)
    return { status: "ok", anzahl: geplant, satz: `Diese Woche sind ${geplant} Veroeffentlichungen geplant.` };
  if (geplant === 0)
    return {
      status: "befund",
      anzahl: 0,
      satz: "Diese Woche ist keine Veroeffentlichung geplant. Wochen ohne Beitrag kosten belegt Wachstum.",
    };
  return {
    status: "hinweis",
    anzahl: geplant,
    satz: `Diese Woche ${geplant} statt der angestrebten ${MASSE.postsProWocheMin} Veroeffentlichungen.`,
  };
}

// Wie oft trägt jede Kategorie? Ohne diese Verteilung wird ein Kanal ein Sammelsurium.
export function saeulenVerteilung(cards) {
  const gesamt = cards.length || 1;
  return aktiveKategorien().map((s) => {
    const n = cards.filter((c) => c.kategorie === s.id).length;
    return { ...s, anzahl: n, anteil: Math.round((n / gesamt) * 100) };
  });
}

// --- Einordnung von Zahlen ------------------------------------------------
//
// Steht hier und nicht in social.js, damit auch der Browser sie nutzen kann: social.js
// liest process.env und laeuft nur im Server.

// Ordnet einen veroeffentlichten Beitrag gegen den EIGENEN Median ein — als Satz.
// Branchen-Benchmarks sind bewusst nicht verdrahtet, sie sind unbelegt.
export function einordnung(beitrag, med, zielKennzahl) {
  const feld =
    zielKennzahl === "Weiterleitungen je Reichweite"
      ? "sendsProReichweite"
      : zielKennzahl === "Kommentare"
      ? "kommentare"
      : "views";
  const wert = (beitrag.kennzahlen || {})[feld];
  const ref = (med || {})[feld];
  if (wert == null || ref == null)
    return { status: "unlesbar", satz: "Fuer diesen Beitrag liegen noch keine vergleichbaren Zahlen vor." };
  if (!ref) return { status: "hinweis", satz: "Es gibt noch zu wenige eigene Beitraege fuer einen Vergleich." };

  const faktor = Math.round((wert / ref) * 100) / 100;
  const grundlage = `Vergleich: eigener Median aus ${med.grundlage} Beitraegen.`;
  if (faktor >= 1.5) return { status: "ok", satz: `Deutlich ueber dem eigenen Schnitt — das ${faktor}-fache. ${grundlage}` };
  if (faktor >= 1.1) return { status: "ok", satz: `Ueber dem eigenen Schnitt, Faktor ${faktor}. ${grundlage}` };
  if (faktor >= 0.9) return { status: "hinweis", satz: `Etwa auf dem eigenen Schnitt. ${grundlage}` };
  return { status: "befund", satz: `Unter dem eigenen Schnitt, Faktor ${faktor}. ${grundlage}` };
}
