// Zahlen von Instagram und LinkedIn holen — und sie so aufbereiten, dass sie eine Frage
// beantworten statt nur eine Zahl zu zeigen.
//
// Zwei gemessene Defekte sind hier behoben:
//   B9  Instagram: `impressions` und `plays` wurden zum 21.04.2025 abgeschafft. Der Aufruf
//       lieferte einen Fehler statt Zahlen. Ersatz ist die eine Kennzahl `views`.
//   B10 LinkedIn: der unversionierte Pfad `/v2/ugcPosts` ist stillgelegt. Heute gilt
//       `/rest/posts` mit den Kopfzeilen `LinkedIn-Version` und `X-Restli-Protocol-Version`.
//
// Welche Kennzahl zaehlt, haengt am Ziel der Karte — Mosseri 22.01.2025: Likes bewegen die
// bestehenden Follower, Weiterleitungen bewegen die, die uns noch nicht kennen.

import { MASSE, einordnung } from "./pipeline.js";

// einordnung lebt in pipeline.js, damit auch der Browser sie nutzen kann.
export { einordnung };

const GRAPH = "https://graph.instagram.com/v21.0";

// LinkedIn verlangt eine Version im Format JJJJMM. Ueberschreibbar, falls Ben eine
// neuere freigeschaltet bekommt.
const LI_VERSION = process.env.LINKEDIN_API_VERSION || "202601";

// networkSizes-edgeType: seit API-Version 202305 der Grossbuchstaben-Wert. Der frueher
// verwendete CamelCase "CompanyFollowedByMember" ist mit aktuellen Versionen unstimmig
// (Beleg: MS-Learn Org-Lookup li-lms-2026-08, docs/packages/v17-kpi-tabellen-drive.md).
const LI_EDGE = "COMPANY_FOLLOWED_BY_MEMBER";

const liHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": LI_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
});

// --- Instagram ------------------------------------------------------------

// Gueltige Medien-Kennzahlen nach der Abschaffung vom 21.04.2025.
// `views` ersetzt impressions, plays und video_views zugleich.
const IG_METRIKEN = ["views", "reach", "saved", "shares", "total_interactions"];

export async function instagramZahlen(ig) {
  const tok = ig.accessToken;

  const konto = await holeJson(
    `${GRAPH}/me?fields=id,username,name,followers_count,media_count,profile_picture_url&access_token=${tok}`
  );

  const medienRoh = await holeJson(
    `${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,timestamp,` +
      `like_count,comments_count,media_url,thumbnail_url,permalink&limit=${MASSE.vergleichsfenster}&access_token=${tok}`
  );

  const medien = await Promise.all(
    (medienRoh.data || []).map(async (m) => {
      let insights = {};
      let hinweis = "";
      try {
        const ins = await holeJson(
          `${GRAPH}/${m.id}/insights?metric=${IG_METRIKEN.join(",")}&access_token=${tok}`
        );
        for (const eintrag of ins.data || []) insights[eintrag.name] = eintrag.values?.[0]?.value ?? 0;
      } catch (e) {
        hinweis = e.message;
      }
      return { ...m, insights, hinweis, kennzahlen: kennzahlen(m, insights) };
    })
  );

  const reichweite30 = konto.id ? await instagramFenster30(konto.id, tok) : null;

  return { verbunden: true, konto, medien, median: median(medien), reichweite30 };
}

// Reichweite & Views der letzten 30 Tage UND der 30 Tage davor (Instagram).
// Zwei getrennte Zeitraum-Aufrufe: Reichweite ist je Fenster entdupliziert (Meta liefert
// `total_value` ueber den Zeitraum), darum NICHT Tageswerte summieren. Faellt ein Fenster
// aus (API-Grenze, junges Konto), bleibt es null — kein geratener Wert.
export async function instagramFenster30(igUserId, tok) {
  const TAG = 86400;
  const jetzt = Math.floor(Date.now() / 1000);
  async function fenster(since, until) {
    const r = { reichweite: null, views: null };
    try {
      const d = await holeJson(
        `${GRAPH}/${igUserId}/insights?metric=reach,views&period=day&metric_type=total_value` +
          `&since=${since}&until=${until}&access_token=${tok}`
      );
      for (const e of d.data || []) {
        const v = e.total_value?.value ?? null;
        if (e.name === "reach") r.reichweite = v;
        if (e.name === "views") r.views = v;
      }
    } catch {
      /* Fenster nicht abrufbar — bleibt null. */
    }
    return r;
  }
  const jetztF = await fenster(jetzt - 30 * TAG, jetzt);
  const davorF = await fenster(jetzt - 60 * TAG, jetzt - 30 * TAG);
  return { jetzt: jetztF, davor: davorF };
}

// Die drei Groessen, die Instagram selbst als Leitgroessen benannt hat — als Anteil,
// damit sich grosse und kleine Beitraege vergleichen lassen.
function kennzahlen(m, ins) {
  const reach = ins.reach || 0;
  const anteil = (n) => (reach ? Math.round((n / reach) * 1000) / 10 : null); // Prozent, eine Stelle
  return {
    views: ins.views ?? null,
    reach: reach || null,
    // Naeherung fuer "sends per reach": die API weist Weiterleitungen als `shares` aus.
    sendsProReichweite: anteil(ins.shares || 0),
    likesProReichweite: anteil(m.like_count || 0),
    savesProReichweite: anteil(ins.saved || 0),
    kommentare: m.comments_count ?? 0,
  };
}

// Gleitender Median der eigenen letzten Beitraege — die einzige ehrliche Vergleichslinie.
// Branchen-Benchmarks aus Blogs sind unbelegt und deshalb bewusst nicht verdrahtet.
export function median(medien) {
  const felder = ["views", "reach", "sendsProReichweite", "likesProReichweite", "savesProReichweite", "kommentare"];
  const m = {};
  for (const f of felder) {
    const werte = medien
      .map((x) => (x.kennzahlen || {})[f])
      .filter((v) => typeof v === "number" && !Number.isNaN(v))
      .sort((a, b) => a - b);
    if (!werte.length) {
      m[f] = null;
      continue;
    }
    const mitte = Math.floor(werte.length / 2);
    m[f] = werte.length % 2 ? werte[mitte] : Math.round(((werte[mitte - 1] + werte[mitte]) / 2) * 10) / 10;
  }
  m.grundlage = medien.length;
  return m;
}

// --- LinkedIn -------------------------------------------------------------

export async function linkedinZahlen(li) {
  const headers = liHeaders(li.accessToken);

  const folgen = await holeJson(
    `https://api.linkedin.com/rest/networkSizes/${encodeURIComponent(li.orgUrn)}?edgeType=${LI_EDGE}`,
    { headers }
  );

  const beitraege = await holeJson(
    `https://api.linkedin.com/rest/posts?q=author&author=${encodeURIComponent(li.orgUrn)}&count=${MASSE.vergleichsfenster}`,
    { headers }
  );

  const posts = await Promise.all(
    (beitraege.elements || []).map(async (post) => {
      const id = post.id || post.urn || "";
      let likes = 0;
      let kommentare = 0;
      let views = null; // Aufrufe = Impressions (nur via Share-Statistik)
      let shares = 0;
      let klicks = 0;
      try {
        const akt = await holeJson(
          `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(id)}`,
          { headers }
        );
        likes = akt.likesSummary?.totalLikes ?? 0;
        kommentare = akt.commentsSummary?.totalFirstLevelComments ?? 0;
      } catch {
        /* Ein Beitrag ohne Interaktionsdaten bleibt trotzdem sichtbar. */
      }
      // Aufrufe + Zaehler aus der Share-Statistik (dieselben Felder wie im KPI-Sammler).
      try {
        const stats = await holeJson(
          `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&shares=List(${encodeURIComponent(id)})`,
          { headers }
        );
        const s = (stats.elements || [])[0]?.totalShareStatistics;
        if (s) {
          views = s.impressionCount ?? null;
          shares = s.shareCount ?? 0;
          klicks = s.clickCount ?? 0;
          if (!likes) likes = s.likeCount ?? 0;
          if (!kommentare) kommentare = s.commentCount ?? 0;
        }
      } catch {
        /* Share-Statistik nicht verfuegbar (App-Freigabe) — Post bleibt sichtbar. */
      }
      return {
        id,
        text: post.commentary || post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text || "",
        erstellt: post.createdAt || post.firstPublishedAt || null,
        views,
        likes,
        kommentare,
        interaktionen: likes + kommentare + shares + klicks,
      };
    })
  );

  return {
    verbunden: true,
    konto: { name: li.orgName, follower: folgen.firstDegreeSize ?? 0 },
    posts,
  };
}

// --- Konto-Schnappschuesse (Tabellen 2 + 3) -------------------------------
//
// Belegte Felder und Endpunkte: docs/packages/v17-kpi-tabellen-drive.md.
// Wichtig aus der Recherche: Follower-GESAMT und Demografie liefert die API nur als
// Jetzt-Wert (keine Historie) -> nur ab jetzt sammeln. Follower-ZUWACHS ist ~12 Monate
// rueckwirkend holbar. Jeder Einzelabruf ist gekapselt: faellt eine Kennzahl aus, bleibt
// der Rest des Schnappschusses erhalten.

// Instagram: Konto-Kennzahlen + Follower-Demografie (Land/Alter/Geschlecht, ab 100 Followern).
export async function instagramKonto(ig) {
  const tok = ig.accessToken;
  const konto = await holeJson(
    `${GRAPH}/me?fields=id,username,name,followers_count,media_count&access_token=${tok}`
  );
  const snap = {
    plattform: "instagram",
    followerGesamt: konto.followers_count ?? null,
    mediaAnzahl: konto.media_count ?? null,
    reichweiteJetzt: null, reichweiteDavor: null, viewsJetzt: null, viewsDavor: null,
    zuwachsOrganisch: null, zuwachsBezahlt: null,
    demografie: [],
  };

  // Reichweite/Views als 30-Tage-Fenster (jetzt vs. die 30 davor) statt Tageswert.
  const f = await instagramFenster30(konto.id, tok);
  snap.reichweiteJetzt = f.jetzt.reichweite;
  snap.reichweiteDavor = f.davor.reichweite;
  snap.viewsJetzt = f.jetzt.views;
  snap.viewsDavor = f.davor.views;

  // Demografie: eine Facette je Aufruf (Breakdown). Bei <100 Followern liefert Meta nichts.
  for (const [feld, label] of [["country", "land"], ["age", "alter"], ["gender", "geschlecht"]]) {
    try {
      const d = await holeJson(
        `${GRAPH}/${konto.id}/insights?metric=follower_demographics&period=lifetime` +
          `&metric_type=total_value&breakdown=${feld}&timeframe=last_30_days&access_token=${tok}`
      );
      const results = d.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
      for (const r of results) {
        snap.demografie.push({ facette: label, auspraegung: (r.dimension_values || []).join(" · "), anzahl: r.value ?? null });
      }
    } catch {
      /* Facette nicht verfuegbar (z. B. <100 Follower) — uebersprungen. */
    }
  }

  return snap;
}

// LinkedIn: Follower-Gesamt + Zuwachs (letzter Monat) + Demografie (Land/Branche/Funktion/Senioritaet).
export async function linkedinKonto(li) {
  const headers = liHeaders(li.accessToken);
  const org = encodeURIComponent(li.orgUrn);
  const snap = {
    plattform: "linkedin",
    followerGesamt: null, mediaAnzahl: null,
    // 30-Tage-Fenster analog Instagram — LinkedIn liefert das ueber Share-Statistik-
    // timeIntervals, sobald die API freigeschaltet ist (v19-Folgeschritt). Bis dahin null.
    reichweiteJetzt: null, reichweiteDavor: null, viewsJetzt: null, viewsDavor: null,
    zuwachsOrganisch: null, zuwachsBezahlt: null,
    demografie: [],
  };

  try {
    const folgen = await holeJson(
      `https://api.linkedin.com/rest/networkSizes/${org}?edgeType=${LI_EDGE}`,
      { headers }
    );
    snap.followerGesamt = folgen.firstDegreeSize ?? null;
  } catch {
    /* Follower-Gesamt optional. */
  }

  // Zuwachs im letzten Monat (zeitgebunden).
  try {
    const jetzt = Date.now();
    const vorMonat = jetzt - 31 * 86400000;
    const stat = await holeJson(
      `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity` +
        `&organizationalEntity=${org}&timeIntervals=(timeRange:(start:${vorMonat},end:${jetzt}),timeGranularityType:MONTH)`,
      { headers }
    );
    let organisch = 0;
    let bezahlt = 0;
    for (const el of stat.elements || []) {
      organisch += el.followerGains?.organicFollowerGain || 0;
      bezahlt += el.followerGains?.paidFollowerGain || 0;
    }
    snap.zuwachsOrganisch = organisch;
    snap.zuwachsBezahlt = bezahlt;
  } catch {
    /* Zuwachs optional. */
  }

  // Demografie (lifetime, ohne timeIntervals). Auspraegungen sind URNs — Aufloesung zu
  // Klarnamen ist ein offener Folgeschritt (siehe Paket v17).
  try {
    const stat = await holeJson(
      `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${org}`,
      { headers }
    );
    const el = (stat.elements || [])[0] || {};
    const facetten = [
      ["followerCountsByGeoCountry", "land", "geo"],
      ["followerCountsByIndustry", "branche", "industry"],
      ["followerCountsByFunction", "funktion", "function"],
      ["followerCountsBySeniority", "senioritaet", "seniority"],
    ];
    for (const [key, label, urnFeld] of facetten) {
      for (const eintrag of el[key] || []) {
        const anzahl = eintrag.followerCounts?.organicFollowerCount ?? 0;
        snap.demografie.push({ facette: label, auspraegung: eintrag[urnFeld] || "", anzahl });
      }
    }
  } catch {
    /* Demografie optional (braucht freigeschaltete App). */
  }

  return snap;
}

// LinkedIn: Follower-Zuwachs der letzten `monate` Monate (rueckwirkend, einmaliger Backfill).
// Gibt [{ datum, organisch, bezahlt }] je Monat zurueck. Follower-GESAMT ist NICHT
// rueckwirkend holbar — die Backfill-Zeilen tragen darum nur den Zuwachs.
export async function linkedinZuwachsReihe(li, monate = 12) {
  const headers = liHeaders(li.accessToken);
  const org = encodeURIComponent(li.orgUrn);
  const jetzt = Date.now();
  const start = jetzt - monate * 31 * 86400000;
  const stat = await holeJson(
    `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity` +
      `&organizationalEntity=${org}&timeIntervals=(timeRange:(start:${start},end:${jetzt}),timeGranularityType:MONTH)`,
    { headers }
  );
  const reihe = [];
  for (const el of stat.elements || []) {
    const ende = el.timeRange?.end ?? el.timeRange?.start ?? null;
    reihe.push({
      datum: ende ? new Date(ende).toISOString().slice(0, 10) : null,
      organisch: el.followerGains?.organicFollowerGain ?? null,
      bezahlt: el.followerGains?.paidFollowerGain ?? null,
    });
  }
  return reihe;
}

// --- gemeinsam ------------------------------------------------------------

async function holeJson(url, optionen = {}) {
  const antwort = await fetch(url, optionen);
  const text = await antwort.text();
  let daten;
  try {
    daten = JSON.parse(text);
  } catch {
    throw new Error(`Unerwartete Antwort (${antwort.status}): ${text.slice(0, 200)}`);
  }
  if (daten.error) throw new Error(daten.error.message || daten.error_description || String(daten.error));
  if (!antwort.ok) throw new Error(daten.message || `HTTP ${antwort.status}`);
  return daten;
}

// Fehler in Klartext, damit im Zweifel klar ist, was zu tun ist.
export function hinweisZuFehler(plattform, e) {
  const m = e.message || "";
  if (/deprecat|does not exist|nonexisting field|unsupported/i.test(m))
    return (
      `${plattform} hat eine dieser Kennzahlen abgeschafft. Bekannt: Instagram hat impressions und ` +
      `plays zum 21.04.2025 durch views ersetzt. Siehe docs/best-practices.md.`
    );
  if (/token|expired|OAuth|401/i.test(m))
    return `Der Zugang zu ${plattform} ist abgelaufen. Auf der Analytics-Seite neu verbinden.`;
  if (/403|permission|ACCESS_DENIED|not authorized/i.test(m))
    return (
      `${plattform} verweigert den Zugriff. Bei LinkedIn braucht die Community Management API eine ` +
      `freigeschaltete Anwendung — ohne Freigabe liefert der Pfad nichts.`
    );
  return `${plattform} antwortete nicht wie erwartet: ${m}`;
}
