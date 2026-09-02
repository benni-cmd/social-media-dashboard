// KPI-Tabellen: schreibt die gemessenen Zahlen zusaetzlich zum Maschinen-JSON als
// menschenlesbare CSV nach Drive — damit Mitarbeiter ohne API-Zugang (Sheets/Excel)
// die Auswertung oeffnen, filtern und vergleichen koennen.
//
// Entwurf und Belege: docs/packages/v17-kpi-tabellen-drive.md
//
// Datenmodell (tidy/long): eine Zeile = ein Post × eine Plattform × ein Intervall.
// IG und LinkedIn teilen denselben Spaltensatz mit deutschen Klarnamen; wo eine
// Plattform eine Zahl nicht liefert, bleibt die Zelle LEER (nicht 0). 0 = echt gemessen.
//
// CSV-Dialekt (Owner-Entscheidung 02.09.2026): UTF-8 mit BOM, Semikolon-Trenner,
// Dezimalkomma — oeffnet in deutschem Excel UND Google Sheets per Doppelklick, ohne
// Import-Dialog. Watch-Time in Sekunden (die APIs liefern Millisekunden).

import * as drive from "./drive.js";
import { projektName, kategorieName, contenttypFormat, zielInfo, plattformName } from "./pipeline.js";

export const ORDNER = "Videoauswertung/Auswertung-Tabellen";
const BEITRAEGE = `${ORDNER}/beitraege-kpi.csv`;
const BOM = "﻿";

// Spaltensatz Tabelle 1 — Reihenfolge ist der Vertrag. Header (deutsch) + Schluessel.
const SPALTEN = [
  ["projekt", "projekt"],
  ["titel", "titel"],
  ["plattform", "plattform"],
  ["format", "format"],
  ["ziel", "ziel"],
  ["saeule", "saeule"],
  ["upload_datum", "uploadDatum"],
  ["post_id", "postId"],
  ["permalink", "permalink"],
  ["intervall", "intervall"],
  ["tage_nach_upload", "tageNachUpload"],
  ["mess_datum", "messDatum"],
  ["views", "views"],
  ["reichweite", "reichweite"],
  ["video_views", "videoViews"],
  ["video_zuschauer", "videoZuschauer"],
  ["likes", "likes"],
  ["kommentare", "kommentare"],
  ["weiterleitungen", "weiterleitungen"],
  ["gespeichert", "gespeichert"],
  ["klicks", "klicks"],
  ["interaktionen_gesamt", "interaktionen"],
  ["watchtime_schnitt_s", "watchtimeSchnittS"],
  ["watchtime_gesamt_s", "watchtimeGesamtS"],
  ["skip_rate", "skipRate"],
  ["weiterleitungen_pro_reichweite", "weiterleitungenProReichweite"],
  ["likes_pro_reichweite", "likesProReichweite"],
  ["gespeichert_pro_reichweite", "gespeichertProReichweite"],
  ["interaktionen_pro_reichweite", "interaktionenProReichweite"],
  ["klickrate", "klickrate"],
];

const HEADER = SPALTEN.map(([h]) => h).join(";");

// --- Zelle formatieren ------------------------------------------------------

// leer = nicht geliefert/nicht anwendbar; 0 bleibt "0". Dezimalkomma.
export function zahl(n, stellen = 0) {
  if (n == null || Number.isNaN(Number(n))) return "";
  const gerundet = stellen > 0 ? Number(n).toFixed(stellen) : String(Math.round(Number(n)));
  return gerundet.replace(".", ",");
}

// Rate in Prozent (Zaehler/Nenner*100), 1 Nachkommastelle. Fehlender Nenner -> leer.
function rate(zaehler, nenner) {
  if (zaehler == null || nenner == null || !Number(nenner)) return "";
  return zahl((Number(zaehler) / Number(nenner)) * 100, 1);
}

// ms -> Sekunden, 1 Nachkommastelle.
function sekunden(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return "";
  return zahl(Number(ms) / 1000, 1);
}

// CSV-sicher: Feld mit ; " oder Zeilenumbruch wird gequotet, innere " verdoppelt.
function csv(feld) {
  const s = feld == null ? "" : String(feld);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// --- Eine Messung zu einer Tabellenzeile (als Feld-Objekt) ------------------

// `messung` ist ein Eintrag aus kpi.js (intervall, name, datum, tageNachUpload + Metriken).
// Metriken: views, reach, likes, kommentare, weiterleitungen, gespeichert, klicks,
// interaktionen, watchtime (Schnitt, ms), watchtimeGesamt (ms), videoViews, videoZuschauer,
// skipRate. Fehlende Felder bleiben leer.
export function zeileAusMessung(card, plattform, postId, messung) {
  const m = messung || {};
  const reichweite = m.reach;
  return {
    projekt: projektName(card),
    titel: card.title || "",
    plattform: plattformName(plattform),
    format: card.contenttyp ? contenttypFormat(card.contenttyp) : "",
    ziel: card.goal ? zielInfo(card.goal).name : "",
    saeule: card.kategorie ? kategorieName(card.kategorie) : "",
    uploadDatum: card.dates?.upload || "",
    postId: postId || "",
    permalink: m.permalink || "",
    intervall: m.name || m.intervall || "",
    tageNachUpload: zahl(m.tageNachUpload),
    messDatum: m.datum || "",
    views: zahl(m.views),
    reichweite: zahl(reichweite),
    videoViews: zahl(m.videoViews),
    videoZuschauer: zahl(m.videoZuschauer),
    likes: zahl(m.likes),
    kommentare: zahl(m.kommentare),
    weiterleitungen: zahl(m.weiterleitungen),
    gespeichert: zahl(m.gespeichert),
    klicks: zahl(m.klicks),
    interaktionen: zahl(m.interaktionen),
    watchtimeSchnittS: sekunden(m.watchtime),
    watchtimeGesamtS: sekunden(m.watchtimeGesamt),
    skipRate: m.skipRate == null ? "" : zahl(m.skipRate, 1),
    weiterleitungenProReichweite: rate(m.weiterleitungen, reichweite),
    likesProReichweite: rate(m.likes, reichweite),
    gespeichertProReichweite: rate(m.gespeichert, reichweite),
    interaktionenProReichweite: rate(m.interaktionen, reichweite),
    klickrate: rate(m.klicks, m.views),
  };
}

// Feld-Objekt -> CSV-Zeile in Spaltenreihenfolge.
export function zeileZuCsv(zeile) {
  return SPALTEN.map(([, key]) => csv(zeile[key])).join(";");
}

// Schluessel zum Entdoppeln: ein Post × Plattform × Intervall genau einmal.
function schluessel(zeile) {
  return `${zeile.projekt}|${zeile.plattform}|${zeile.intervall}`;
}

// --- Legende neben den Tabellen (fuer Mitarbeiter ohne API) -----------------

const LIESMICH = `${ORDNER}/LIESMICH.txt`;

const LEGENDE = `AUSWERTUNG-TABELLEN — was hier liegt und wie man es liest
========================================================

Diese Dateien werden vom Social-Media-Dashboard automatisch geschrieben. Sie sind zum
LESEN da (Google Sheets / Excel: Doppelklick). Bitte nicht von Hand umbenennen.

Format: CSV mit Semikolon (;) als Trenner und Komma als Dezimalzeichen. Eine LEERE Zelle
heisst "diese Plattform liefert die Zahl nicht" — eine 0 heisst "echt null gemessen".

--- beitraege-kpi.csv --- eine Zeile je Beitrag, Plattform und Mess-Zeitpunkt
Die Zahlen zu jedem Video, gemessen in festen Abstaenden nach dem Upload (24h, 3 Tage,
... bis 12 Monate). Wichtige Spalten:
  views/reichweite ... wie oft gesehen / von wie vielen verschiedenen Konten
  weiterleitungen ... geteilt/gesendet (bewegt Menschen, die uns noch nicht kennen)
  weiterleitungen_pro_reichweite, likes_pro_reichweite, watchtime_schnitt_s ...
     die drei Leitgroessen (Instagram, 22.01.2025): Sehdauer, Likes/Reichweite,
     Weiterleitungen/Reichweite. Likes bewegen Follower, Weiterleitungen die Neuen.

--- kanal-verlauf.csv --- eine Zeile je Plattform und Stichtag (woechentlich)
Der Konto-Verlauf: Follower gesamt, Zuwachs, Konto-Reichweite ueber die Zeit.
Hinweis: Der Follower-GESAMTstand laesst sich nicht rueckwirkend holen — die Kurve
waechst nur ab dem ersten Lauf. Der Zuwachs wurde einmalig 12 Monate nachgetragen.

--- follower-demografie.csv --- eine Zeile je Facette-Auspraegung (quartalsweise)
Woher die Follower kommen: Land, Alter, Geschlecht (Instagram), Land/Branche/Funktion/
Senioritaet (LinkedIn). Auch das ist nur ein Jetzt-Bild, keine Historie.
`;

// Legt die LIESMICH-Legende an, falls sie fehlt (einmalig). Fehler bleiben still —
// die Legende ist Beiwerk, kein Muss.
export async function stelleLegendeSicher() {
  try {
    if (!(await drive.existiert(LIESMICH))) {
      await drive.mkdir(ORDNER);
      await drive.writeFile(LIESMICH, LEGENDE);
    }
  } catch {
    /* Legende ist Kür, nie den eigentlichen Ablauf stoeren. */
  }
}

// --- Generischer CSV-Anhaenger (von allen drei Tabellen genutzt) ------------

// Haengt neue Zeilen an eine Drive-CSV an; legt Ordner/Datei bei Bedarf an und
// ueberspringt bereits vorhandene Schluessel (idempotent). Fehlende Datei = Neuanlage
// mit BOM+Header; echte Drive-Stoerung wirft.
//
//   pfad                 Ziel-CSV in Drive
//   header               Header-Zeile (Semikolon-getrennt), ohne BOM
//   zeilen               Feld-Objekte
//   zuCsv(obj)           Objekt -> CSV-Zeile in Spaltenreihenfolge
//   schluessel(obj)      Dedupe-Schluessel eines neuen Objekts
//   schluesselAusFelder(felder)  Dedupe-Schluessel einer bestehenden (grob gesplitteten) Zeile
export async function haengeCsv({ pfad, header, zeilen, zuCsv, schluessel, schluesselAusFelder }) {
  if (!zeilen.length) return { geschrieben: 0 };

  await drive.mkdir(ORDNER);

  let bestehend = "";
  try {
    bestehend = await drive.readFile(pfad);
  } catch (e) {
    if (!e.fehlend) throw e; // echte Stoerung nicht verschlucken
  }

  const vorhandene = new Set();
  if (bestehend.trim()) {
    for (const zeile of bestehend.split(/\r?\n/).slice(1)) {
      if (!zeile.trim()) continue;
      vorhandene.add(schluesselAusFelder(grobSplit(zeile)));
    }
  }

  const neu = zeilen.filter((z) => !vorhandene.has(schluessel(z)));
  if (!neu.length) return { geschrieben: 0 };

  const kopf = bestehend.trim() ? bestehend.replace(/\r?\n$/, "") : BOM + header;
  const inhalt = kopf + "\n" + neu.map(zuCsv).join("\n") + "\n";
  await drive.writeFile(pfad, inhalt);
  return { geschrieben: neu.length };
}

// --- Tabelle 1: Beitraege ---------------------------------------------------

// Haengt neue Zeilen an beitraege-kpi.csv an (Dedupe: Post×Plattform×Intervall).
// Der Schluessel steht fest an Spalten 0 (projekt), 2 (plattform), 9 (intervall).
export async function haengeBeitraege(zeilen) {
  if (zeilen.length) await stelleLegendeSicher();
  return haengeCsv({
    pfad: BEITRAEGE,
    header: HEADER,
    zeilen,
    zuCsv: zeileZuCsv,
    schluessel,
    schluesselAusFelder: (f) => `${f[0]}|${f[2]}|${f[9]}`,
  });
}

// Baut eine CSV-Zeile aus einem Feld-Objekt und einer Spaltenliste [[header,key],...].
export function zeileNachSpalten(zeile, spalten) {
  return spalten.map(([, key]) => csv(zeile[key])).join(";");
}
export function headerAusSpalten(spalten) {
  return spalten.map(([h]) => h).join(";");
}

// Grober CSV-Split, der gequotete Felder respektiert (fuer den Dedupe-Lesepfad).
function grobSplit(zeile) {
  const felder = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (inQuote) {
      if (c === '"' && zeile[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else if (c === '"') inQuote = true;
    else if (c === ";") { felder.push(cur); cur = ""; }
    else cur += c;
  }
  felder.push(cur);
  return felder;
}

export const _intern = { HEADER, SPALTEN, ORDNER, BEITRAEGE, grobSplit };
