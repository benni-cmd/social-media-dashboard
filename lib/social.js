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
    `${GRAPH}/me?fields=username,name,followers_count,media_count,profile_picture_url&access_token=${tok}`
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

  return { verbunden: true, konto, medien, median: median(medien) };
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
    `https://api.linkedin.com/rest/networkSizes/${encodeURIComponent(li.orgUrn)}?edgeType=CompanyFollowedByMember`,
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
      return {
        id,
        text: post.commentary || post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text || "",
        erstellt: post.createdAt || post.firstPublishedAt || null,
        likes,
        kommentare,
      };
    })
  );

  return {
    verbunden: true,
    konto: { name: li.orgName, follower: folgen.firstDegreeSize ?? 0 },
    posts,
  };
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
