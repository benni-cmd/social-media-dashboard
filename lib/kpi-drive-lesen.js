// Auswertung aus Drive lesen: rekonstruiert aus den KPI-CSVs (Auswertung-Tabellen/) dieselbe
// Antwort-FORM, die social.js live aus der API liefert — damit public/auswertung.js
// unveraendert damit rendert. Genutzt vom /api/stats/*-Zweig `?quelle=drive` (Paket v22).
//
// Quelle der Wahrheit fuer das CSV-Schema: lib/kpi-tabellen.js (Beitraege) und
// lib/kanal-kpi.js (Kanal-Verlauf). plattform steht in den CSVs als Anzeigename
// ("Instagram"/"LinkedIn"). Zahlen: Dezimalkomma, leere Zelle = null.

import * as drive from "./drive.js";
import { median } from "./social.js";
import { ORDNER } from "./kpi-tabellen.js";

const BEITRAEGE = `${ORDNER}/beitraege-kpi.csv`;
const VERLAUF = `${ORDNER}/kanal-verlauf.csv`;

// --- CSV-Parsen ------------------------------------------------------------

// Quoted-aware Split einer Semikolon-Zeile (spiegelbildlich zu kpi-tabellen csv()).
function splitCsv(zeile) {
  const felder = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (inQ) {
      if (c === '"' && zeile[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ";") { felder.push(cur); cur = ""; }
    else cur += c;
  }
  felder.push(cur);
  return felder;
}

function parseCsv(text) {
  const clean = String(text).replace(/^﻿/, "");
  const zeilen = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (zeilen.length < 2) return [];
  const kopf = splitCsv(zeilen[0]);
  return zeilen.slice(1).map((z) => {
    const f = splitCsv(z);
    const o = {};
    kopf.forEach((h, i) => (o[h] = f[i] !== undefined ? f[i] : ""));
    return o;
  });
}

// Dezimalkomma -> Zahl; leer -> null.
const num = (s) => {
  if (s == null || String(s).trim() === "") return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

// Anteil in Prozent (1 Nachkommastelle) — identisch zu social.js.
const anteil = (n, reach) => (reach ? Math.round(((n || 0) / reach) * 1000) / 10 : null);

// Aus mehreren Intervall-Zeilen eines Posts die AKTUELLSTE (groesstes tage_nach_upload) je post_id.
function neuesteJePost(zeilen) {
  const best = new Map();
  for (const z of zeilen) {
    const id = z.post_id || z.permalink || z.titel;
    if (!id) continue;
    const tage = num(z.tage_nach_upload) ?? -1;
    const vorhanden = best.get(id);
    if (!vorhanden || tage >= vorhanden._tage) best.set(id, { ...z, _tage: tage });
  }
  return [...best.values()];
}

// --- Reine Form-Builder (testbar ohne Drive) -------------------------------

// Instagram-Medien aus den Beitrags-CSV-Zeilen (nur plattform=Instagram).
export function medienAusCsv(text) {
  const zeilen = parseCsv(text).filter((z) => z.plattform === "Instagram");
  return neuesteJePost(zeilen).map((z) => {
    const views = num(z.views);
    const reach = num(z.reichweite);
    const shares = num(z.weiterleitungen);
    const saved = num(z.gespeichert);
    const likes = num(z.likes);
    const kommentare = num(z.kommentare);
    const interaktionen = num(z.interaktionen_gesamt);
    return {
      id: z.post_id || "",
      caption: z.titel || "",
      timestamp: z.upload_datum || "",
      media_type: "",
      media_product_type: "",
      permalink: z.permalink || "",
      plattform: "instagram",
      like_count: likes,
      comments_count: kommentare,
      insights: { views, reach, saved, shares, total_interactions: interaktionen },
      kennzahlen: {
        views,
        reach,
        sendsProReichweite: anteil(shares, reach),
        likesProReichweite: anteil(likes, reach),
        savesProReichweite: anteil(saved, reach),
        kommentare: kommentare ?? 0,
      },
    };
  });
}

// LinkedIn-Posts aus den Beitrags-CSV-Zeilen (nur plattform=LinkedIn).
export function postsAusCsv(text) {
  const zeilen = parseCsv(text).filter((z) => z.plattform === "LinkedIn");
  return neuesteJePost(zeilen).map((z) => ({
    id: z.post_id || "",
    text: z.titel || "",
    erstellt: z.upload_datum || "",
    views: num(z.views),
    likes: num(z.likes),
    kommentare: num(z.kommentare),
    interaktionen: num(z.interaktionen_gesamt),
  }));
}

// Neueste Kanal-Verlauf-Zeile einer Plattform (Anzeigename).
function neuesteVerlaufZeile(text, plattformName) {
  const zeilen = parseCsv(text).filter((z) => z.plattform === plattformName);
  if (!zeilen.length) return null;
  return zeilen.reduce((a, b) => ((b.datum || "") >= (a.datum || "") ? b : a));
}

// Instagram-Konto + reichweite30 aus dem Kanal-Verlauf.
export function igKontoAusVerlauf(text) {
  const z = neuesteVerlaufZeile(text, "Instagram");
  if (!z) return null;
  return {
    konto: { followers_count: num(z.follower_gesamt), media_count: num(z.media_anzahl) },
    reichweite30: {
      jetzt: { reichweite: num(z.reichweite_30t), views: num(z.views_30t) },
      davor: { reichweite: num(z.reichweite_30t_davor), views: num(z.views_30t_davor) },
    },
  };
}

// LinkedIn-Konto aus dem Kanal-Verlauf.
export function liKontoAusVerlauf(text) {
  const z = neuesteVerlaufZeile(text, "LinkedIn");
  if (!z) return null;
  return { name: "LinkedIn", follower: num(z.follower_gesamt) ?? 0 };
}

// --- Orchestrierung (liest Drive) ------------------------------------------

async function leseCsv(pfad) {
  try {
    return await drive.readFile(pfad);
  } catch (e) {
    if (e.fehlend) return "";
    throw e;
  }
}

export async function instagramAusDrive() {
  const [beitraege, verlauf] = await Promise.all([leseCsv(BEITRAEGE), leseCsv(VERLAUF)]);
  const medien = medienAusCsv(beitraege);
  const kv = igKontoAusVerlauf(verlauf);
  if (!kv && !medien.length) return { verbunden: false, quelle: "drive" };
  return {
    verbunden: true,
    quelle: "drive",
    konto: kv ? kv.konto : {},
    medien,
    median: median(medien),
    reichweite30: kv ? kv.reichweite30 : null,
  };
}

export async function linkedinAusDrive() {
  const [beitraege, verlauf] = await Promise.all([leseCsv(BEITRAEGE), leseCsv(VERLAUF)]);
  const posts = postsAusCsv(beitraege);
  const konto = liKontoAusVerlauf(verlauf);
  if (!konto && !posts.length) return { verbunden: false, quelle: "drive" };
  return { verbunden: true, quelle: "drive", konto: konto || { name: "LinkedIn", follower: 0 }, posts };
}
