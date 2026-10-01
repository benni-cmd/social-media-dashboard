// KPI-Erfassung: misst Video-Performance in festen Intervallen und archiviert in Drive.
//
// Jede Messung wird einmal erfasst und nie wiederholt (Owner 31.08.2026). Die Daten
// liegen pro Projekt als JSON in Drive unter Videoauswertung/KPI/.
//
// Verfuegbare Metriken je Plattform:
//   Instagram: views, reach, shares, saved, total_interactions, like_count, comments_count,
//              ig_reels_avg_watch_time (Reels, seit 2024)
//   LinkedIn:  impressionCount, clickCount, likeCount, commentCount, shareCount
//              (Watchtime nicht via API verfuegbar)

import { KPI_INTERVALLE, faelligeMessungen, projektName, isoDatum } from "./pipeline.js";
import * as ereignisse from "./ereignisse.js"; // v58: externe Aufrufe mitlesbar
import * as drive from "./drive.js";
import * as tabellen from "./kpi-tabellen.js";
import * as kanal from "./kanal-kpi.js";

const GRAPH = "https://graph.instagram.com/v21.0";
const KPI_ORDNER = "Videoauswertung/KPI";

// --- Instagram-Messung fuer einen einzelnen Post ----------------------------

const IG_POST_METRIKEN = "views,reach,saved,shares,total_interactions";
const IG_REELS_METRIKEN = "ig_reels_avg_watch_time,ig_reels_video_view_total_time";

async function messeInstagramPost(mediaId, accessToken) {
  const ergebnis = {
    views: null, reach: null, likes: null, kommentare: null, weiterleitungen: null,
    gespeichert: null, interaktionen: null, watchtime: null, watchtimeGesamt: null,
  };
  try {
    const basis = await holeJson(
      `${GRAPH}/${mediaId}?fields=like_count,comments_count,media_type,media_product_type,permalink&access_token=${accessToken}`
    );
    ergebnis.likes = basis.like_count ?? null;
    ergebnis.kommentare = basis.comments_count ?? null;
    ergebnis.permalink = basis.permalink ?? null;

    const ins = await holeJson(
      `${GRAPH}/${mediaId}/insights?metric=${IG_POST_METRIKEN}&access_token=${accessToken}`
    );
    for (const e of ins.data || []) {
      const w = e.values?.[0]?.value ?? null;
      if (e.name === "views") ergebnis.views = w;
      if (e.name === "reach") ergebnis.reach = w;
      if (e.name === "shares") ergebnis.weiterleitungen = w;
      if (e.name === "saved") ergebnis.gespeichert = w;
      if (e.name === "total_interactions") ergebnis.interaktionen = w;
    }

    // Watchtime nur bei Reels verfuegbar
    if (basis.media_product_type === "REELS" || basis.media_type === "VIDEO") {
      try {
        const reels = await holeJson(
          `${GRAPH}/${mediaId}/insights?metric=${IG_REELS_METRIKEN}&access_token=${accessToken}`
        );
        for (const e of reels.data || []) {
          if (e.name === "ig_reels_avg_watch_time") ergebnis.watchtime = e.values?.[0]?.value ?? null;
          if (e.name === "ig_reels_video_view_total_time") ergebnis.watchtimeGesamt = e.values?.[0]?.value ?? null;
        }
      } catch {
        // Watchtime-Metrik nicht verfuegbar fuer diesen Post-Typ — kein Fehler
      }
    }
  } catch (e) {
    ergebnis._fehler = e.message;
  }
  return ergebnis;
}

// --- LinkedIn-Messung fuer einen einzelnen Post -----------------------------

const LI_VERSION = process.env.LINKEDIN_API_VERSION || "202601";

async function messeLinkedinPost(postUrn, accessToken) {
  const ergebnis = {
    views: null, reach: null, likes: null, kommentare: null, weiterleitungen: null,
    klicks: null, interaktionen: null, watchtime: null,
  };
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LI_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
  try {
    const akt = await holeJson(
      `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}`,
      { headers }
    );
    ergebnis.kommentare = akt.commentsSummary?.totalFirstLevelComments ?? null;
    ergebnis.likes = akt.likesSummary?.totalLikes ?? null;
  } catch {
    // socialActions nicht verfuegbar
  }

  // Organisational Share Statistics: Impressions, Reichweite, Klicks, Likes, Shares.
  // Beleg-Felder aus li-lms-2026-08 (docs/packages/v17-kpi-tabellen-drive.md).
  try {
    const stats = await holeJson(
      `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&shares=List(${encodeURIComponent(postUrn)})`,
      { headers }
    );
    const el = (stats.elements || [])[0];
    const s = el?.totalShareStatistics;
    if (s) {
      ergebnis.views = s.impressionCount ?? null;
      ergebnis.reach = s.uniqueImpressionsCount ?? null;
      ergebnis.klicks = s.clickCount ?? null;
      ergebnis.weiterleitungen = s.shareCount ?? null;
      // Share-Stats hat eigene Zaehler; socialActions kann fehlen -> hier auffuellen.
      if (ergebnis.likes == null) ergebnis.likes = s.likeCount ?? null;
      if (ergebnis.kommentare == null) ergebnis.kommentare = s.commentCount ?? null;
    }
  } catch (e) {
    if (!ergebnis._fehler) ergebnis._fehler = e.message;
  }

  // Interaktionen = Likes + Kommentare + Shares + Klicks (die per API belegten Rohzahlen).
  const summe = (ergebnis.likes || 0) + (ergebnis.kommentare || 0) + (ergebnis.weiterleitungen || 0) + (ergebnis.klicks || 0);
  ergebnis.interaktionen = summe || null;

  // Watch-Time/Video-Views liegen bei LinkedIn auf dem eigenen videoAnalytics-Endpunkt
  // (6-Monats-Verfall) — noch nicht angebunden, siehe Paket v17.
  return ergebnis;
}

// --- Drive-Speicherung ------------------------------------------------------

function kpiDateiname(card) {
  return `${projektName(card)}_kpi.json`;
}

async function leseKpiDatei(card) {
  try {
    const inhalt = await drive.readFile(`${KPI_ORDNER}/${kpiDateiname(card)}`);
    return JSON.parse(inhalt);
  } catch (e) {
    if (e.fehlend) return { projekt: projektName(card), titel: card.title, messungen: {} };
    throw e;
  }
}

async function schreibeKpiDatei(card, daten) {
  await drive.mkdir(KPI_ORDNER);
  await drive.writeFile(`${KPI_ORDNER}/${kpiDateiname(card)}`, JSON.stringify(daten, null, 2));
}

// --- Sammeln ----------------------------------------------------------------

// Prueft welche Karten faellige Messungen haben.
export function pruefeKarten(cards) {
  const faellig = [];
  for (const card of cards) {
    if (!card.published || !Object.keys(card.published).length) continue;
    for (const [plattform, postDaten] of Object.entries(card.published)) {
      const postId = typeof postDaten === "string" ? postDaten : postDaten?.id || postDaten?.url || "";
      if (!postId) continue;
      // v97: Messintervalle ab der ECHTEN Veroeffentlichung (zugeordneter Post), sonst ab dem geplanten Datum.
      const uploadDatum = (postDaten && postDaten.zeit ? String(postDaten.zeit).slice(0, 10) : null) || card.dates?.upload;
      if (!uploadDatum) continue;

      const erfasst = ((card.kpiMessungen || {})[plattform] || []).map((m) => m.intervall);
      const ausstehend = faelligeMessungen(uploadDatum, erfasst);
      if (ausstehend.length) {
        faellig.push({ card, plattform, postId, ausstehend, erfasst });
      }
    }
  }
  return faellig;
}

// Fuehrt EINE Messung fuer eine Karte+Plattform+Intervall durch.
async function messe(card, plattform, postId, intervall, tokens) {
  const heute = isoDatum(new Date());
  let metriken;

  if (plattform === "instagram" && tokens.instagram?.accessToken) {
    metriken = await messeInstagramPost(postId, tokens.instagram.accessToken);
  } else if (plattform === "linkedin" && tokens.linkedin?.accessToken) {
    metriken = await messeLinkedinPost(postId, tokens.linkedin.accessToken);
  } else {
    return { ok: false, grund: `Kein Token fuer ${plattform}` };
  }

  return {
    ok: true,
    messung: {
      intervall: intervall.id,
      name: intervall.name,
      datum: heute,
      tageNachUpload: intervall.tage,
      ...metriken,
    },
  };
}

// Sammelt alle faelligen Messungen fuer alle Karten. Gibt einen Bericht zurueck.
export async function sammle(cards, tokens) {
  const faellig = pruefeKarten(cards);

  const bericht = [];
  const tabellenZeilen = [];
  let gesammelt = 0;

  for (const { card, plattform, postId, ausstehend } of faellig) {
    for (const intervall of ausstehend) {
      const ergebnis = await messe(card, plattform, postId, intervall, tokens);
      if (!ergebnis.ok) {
        bericht.push({
          titel: card.title,
          plattform,
          intervall: intervall.id,
          status: "uebersprungen",
          grund: ergebnis.grund,
        });
        continue;
      }

      // In die Karte schreiben
      if (!card.kpiMessungen) card.kpiMessungen = {};
      if (!card.kpiMessungen[plattform]) card.kpiMessungen[plattform] = [];
      card.kpiMessungen[plattform].push(ergebnis.messung);

      // In Drive archivieren
      try {
        const daten = await leseKpiDatei(card);
        if (!daten.messungen[plattform]) daten.messungen[plattform] = [];
        daten.messungen[plattform].push(ergebnis.messung);
        daten.titel = card.title;
        daten.letzteAktualisierung = new Date().toISOString();
        await schreibeKpiDatei(card, daten);
      } catch (e) {
        bericht.push({
          titel: card.title,
          plattform,
          intervall: intervall.id,
          status: "drive-fehler",
          grund: `Messung erfasst, aber Drive-Speicherung fehlgeschlagen: ${e.message}`,
        });
      }

      // Menschenlesbare CSV-Zeile fuer Drive (Tabelle 1) vormerken.
      tabellenZeilen.push(tabellen.zeileAusMessung(card, plattform, postId, ergebnis.messung));

      gesammelt++;
      bericht.push({
        titel: card.title,
        plattform,
        intervall: intervall.id,
        status: "erfasst",
        views: ergebnis.messung.views,
        kommentare: ergebnis.messung.kommentare,
        interaktionen: ergebnis.messung.interaktionen,
        watchtime: ergebnis.messung.watchtime,
      });
    }
  }

  // Zusaetzlich zur JSON-Ablage: die menschenlesbare KPI-Tabelle in Drive fortschreiben.
  // Ein Fehler hier darf die schon erfassten Messungen nicht entwerten — nur berichten.
  if (tabellenZeilen.length) {
    try {
      const { geschrieben } = await tabellen.haengeBeitraege(tabellenZeilen);
      bericht.push({ status: "tabelle", titel: `beitraege-kpi.csv: ${geschrieben} Zeile(n) angehaengt` });
    } catch (e) {
      bericht.push({ status: "tabelle-fehler", grund: `KPI-Tabelle nicht geschrieben: ${e.message}` });
    }
  }

  // Konto-KPIs (Follower-Verlauf + Demografie) — eigene Kadenz, unabhaengig vom Post-Alter.
  // Laeuft auch, wenn keine Post-Messung faellig war. Fehler bleiben Bericht, kein Abbruch.
  try {
    bericht.push(...(await kanal.schnappschussWennFaellig(tokens)));
  } catch (e) {
    bericht.push({ status: "kanal-fehler", grund: e.message });
  }

  return { gesammelt, bericht, cards };
}

// --- Status-Uebersicht -----------------------------------------------------

export function status(cards) {
  const projekte = [];
  for (const card of cards) {
    if (!card.published || !Object.keys(card.published).length) continue;
    const uploadDatum = card.dates?.upload;
    if (!uploadDatum) continue;

    const plattformen = {};
    for (const [pl, postDaten] of Object.entries(card.published)) {
      const erfasst = ((card.kpiMessungen || {})[pl] || []).map((m) => m.intervall);
      const ausstehend = faelligeMessungen(uploadDatum, erfasst);
      const gesamt = KPI_INTERVALLE.length;
      plattformen[pl] = {
        postId: typeof postDaten === "string" ? postDaten : postDaten?.id || "?",
        erfasst: erfasst.length,
        gesamt,
        faellig: ausstehend.length,
        naechstes: ausstehend[0]?.name || null,
        letzteMessung: ((card.kpiMessungen || {})[pl] || []).slice(-1)[0] || null,
      };
    }
    projekte.push({ id: card.id, titel: card.title, uploadDatum, plattformen });
  }
  return { projekte, intervalle: KPI_INTERVALLE };
}

// --- Helfer -----------------------------------------------------------------

async function holeJson(url, optionen = {}) {
  // v58: derselbe Mitschnitt wie in lib/social.js — der Zahlen-Abruf ist Teil der API-Sektion.
  const vorgang = ereignisse.starte({
    sektion: "api",
    dienst: /linkedin/i.test(String(url)) ? "linkedin" : "instagram",
    text: `${optionen.method || "GET"} ${url}`,
  });
  const antwort = await fetch(url, optionen).catch((e) => { vorgang.fehler(e.message); throw e; });
  const text = await antwort.text();
  let daten;
  try {
    daten = JSON.parse(text);
  } catch {
    vorgang.fehler(`unerwartete Antwort (${antwort.status})`);
    throw new Error(`Unerwartete Antwort (${antwort.status}): ${text.slice(0, 200)}`);
  }
  if (daten.error) {
    const satz = daten.error.message || daten.error_description || String(daten.error);
    vorgang.fehler(satz);
    throw new Error(satz);
  }
  if (!antwort.ok) {
    vorgang.fehler(daten.message || `HTTP ${antwort.status}`);
    throw new Error(daten.message || `HTTP ${antwort.status}`);
  }
  vorgang.fertig(`${antwort.status} OK, ${text.length} Zeichen`);
  return daten;
}
