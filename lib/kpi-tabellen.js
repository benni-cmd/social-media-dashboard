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

const ORDNER = "Videoauswertung/Auswertung-Tabellen";
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
function zahl(n, stellen = 0) {
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

// --- Anhaengen an die Drive-CSV --------------------------------------------

// Haengt neue Zeilen an beitraege-kpi.csv an (Datei/Ordner werden bei Bedarf angelegt).
// Bereits vorhandene Kombinationen (Post×Plattform×Intervall) werden uebersprungen.
export async function haengeBeitraege(zeilen) {
  if (!zeilen.length) return { geschrieben: 0 };

  await drive.mkdir(ORDNER);

  let bestehend = "";
  try {
    bestehend = await drive.readFile(BEITRAEGE);
  } catch (e) {
    if (!e.fehlend) throw e; // echte Stoerung nicht verschlucken
  }

  const vorhandeneSchluessel = new Set();
  if (bestehend.trim()) {
    for (const zeile of bestehend.split(/\r?\n/).slice(1)) {
      if (!zeile.trim()) continue;
      // Schluessel liegt in den ersten Spalten (projekt;titel;plattform;...;intervall).
      // Zum Entdoppeln reicht ein grober Split — Titel kann Semikolons enthalten, aber
      // projekt/plattform/intervall stehen fest an Position 0, 2 und 9.
      const sp = grobSplit(zeile);
      vorhandeneSchluessel.add(`${sp[0]}|${sp[2]}|${sp[9]}`);
    }
  }

  const neu = zeilen.filter((z) => !vorhandeneSchluessel.has(schluessel(z)));
  if (!neu.length) return { geschrieben: 0 };

  const kopf = bestehend.trim() ? bestehend.replace(/\r?\n$/, "") : BOM + HEADER;
  const inhalt = kopf + "\n" + neu.map(zeileZuCsv).join("\n") + "\n";
  await drive.writeFile(BEITRAEGE, inhalt);
  return { geschrieben: neu.length };
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
