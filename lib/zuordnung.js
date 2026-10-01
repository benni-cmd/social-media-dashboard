// v97 — Veroeffentlichte Posts der richtigen Karte zuordnen (rein: kein Netz, kein Dateisystem).
//
// Owner 01.10.2026: automatisch nur bei EINDEUTIGEM Treffer mit wenigen Stunden Toleranz; Reel und Story am selben
// Tag muessen unterscheidbar sein; im Zweifel fragt das Board nach. Plan + Befund:
// docs/packages/v97-upload-fest-und-kpi-zuordnung.md
//
// Ein Post passt zu einer Karte, wenn (1) die Plattform zur Karte gehoert, (2) das Format passt und (3) die
// Post-Zeit nah am geplanten Upload liegt:
//   sicher     — Abstand hoechstens TOLERANZ_STUNDEN zum geplanten Datum + Uhrzeit
//   vorschlag  — gleicher oder angrenzender Tag (ohne Uhrzeit an der Karte, oder Abstand > Toleranz)
// Automatisch eingetragen wird nur, wenn es fuer den Post genau EINE sichere Karte gibt UND diese Karte nur
// diesen einen sicheren Post hat. Alles andere wird ein Vorschlag zum Bestaetigen.

export const TOLERANZ_STUNDEN = 3;
const STUNDE = 3600000;

// Format der Karte -> passt dieser Instagram-Post? (Meta: media_type IMAGE|VIDEO|CAROUSEL_ALBUM,
// media_product_type FEED|REELS|STORY)
const IG_FORMAT = {
  reel: (m) => m.media_product_type === "REELS" || (m.media_type === "VIDEO" && m.media_product_type !== "STORY"),
  langformat: (m) => m.media_type === "VIDEO" && m.media_product_type !== "STORY",
  slider: (m) => m.media_type === "CAROUSEL_ALBUM",
  beitrag: (m) => m.media_type === "IMAGE" && m.media_product_type !== "STORY",
  story: (m) => m.media_product_type === "STORY",
  highlight: (m) => m.media_product_type === "STORY",
};

// Einheitliche Post-Form: { plattform, id, zeit (ms), url, text, passt(contenttyp) }
export function postsAusInstagram(medien = []) {
  return medien.map((m) => ({
    plattform: "instagram",
    id: m.id,
    zeit: Date.parse(m.timestamp),
    url: m.permalink || "",
    text: m.caption || "",
    passt: (typ) => (IG_FORMAT[typ || "reel"] || IG_FORMAT.reel)(m),
  }));
}

// LinkedIn liefert kein verlaessliches Format-Feld — dort entscheidet allein die Zeit (Story gibt es nicht).
export function postsAusLinkedin(posts = []) {
  return posts.map((p) => ({
    plattform: "linkedin",
    id: p.id,
    zeit: typeof p.erstellt === "number" ? p.erstellt : Date.parse(p.erstellt),
    url: p.url || "",
    text: p.text || "",
    passt: (typ) => typ !== "story" && typ !== "highlight",
  }));
}

// Geplanter Zeitpunkt der Karte in ms (Ortszeit des Boards). Ohne Uhrzeit: null (nur Tagesvergleich).
function geplantMs(card) {
  const d = (card.dates || {}).upload;
  if (!d || !card.uploadTime) return null;
  return new Date(`${d}T${card.uploadTime}:00`).getTime();
}

function tagAbstand(card, zeit) {
  const d = (card.dates || {}).upload;
  if (!d) return Infinity;
  const geplant = new Date(`${d}T12:00:00`).getTime();
  return Math.abs(zeit - geplant) / (24 * STUNDE);
}

const plattformenDer = (card) => (card.platforms && card.platforms.length ? card.platforms : ["instagram"]);

// cards: Board-Karten; posts: Einheits-Posts beider Plattformen.
// Liefert { auto: [{cardId, plattform, post, abweichungStunden}], vorschlaege: [{cardId, plattform, post, grund}] }.
export function ordneZu(cards, posts) {
  // Schon vergebene Posts und je Karte abgelehnte Posts nie wieder anbieten.
  const vergeben = new Set();
  for (const c of cards) for (const v of Object.values(c.published || {})) if (v && v.id) vergeben.add(v.id);

  const kandidaten = (c, pl) =>
    c.column !== "verworfen" &&
    (c.dates || {}).upload &&
    !((c.published || {})[pl] && c.published[pl].id) &&
    plattformenDer(c).includes(pl);

  const sicher = new Map(); // postId -> [{card, abw}]
  const kartenSicher = new Map(); // cardId|pl -> Anzahl sicherer Posts
  const vorschlaege = [];

  for (const p of posts) {
    if (!p.id || vergeben.has(p.id) || !Number.isFinite(p.zeit)) continue;
    const liste = [];
    for (const c of cards) {
      if (!kandidaten(c, p.plattform) || !p.passt(c.contenttyp)) continue;
      if ((c.zuordnungAbgelehnt || []).includes(p.id)) continue;
      const g = geplantMs(c);
      const abw = g != null ? Math.abs(p.zeit - g) / STUNDE : null;
      if (abw != null && abw <= TOLERANZ_STUNDEN) liste.push({ card: c, abw, art: "sicher" });
      else if (tagAbstand(c, p.zeit) <= 1.5) liste.push({ card: c, abw, art: "vorschlag" });
    }
    const s = liste.filter((x) => x.art === "sicher");
    if (s.length) {
      sicher.set(p.id, { post: p, liste: s });
      for (const x of s) kartenSicher.set(x.card.id + "|" + p.plattform, (kartenSicher.get(x.card.id + "|" + p.plattform) || 0) + 1);
    } else {
      for (const x of liste)
        vorschlaege.push({
          cardId: x.card.id, plattform: p.plattform, post: p,
          grund: x.abw == null ? "gleicher Tag, an der Karte steht keine Uhrzeit" : `${x.abw.toFixed(1).replace(".", ",")} Std. neben dem geplanten Upload`,
        });
    }
  }

  const auto = [];
  for (const { post, liste } of sicher.values()) {
    const eindeutig = liste.length === 1 && kartenSicher.get(liste[0].card.id + "|" + post.plattform) === 1;
    if (eindeutig) auto.push({ cardId: liste[0].card.id, plattform: post.plattform, post, abweichungStunden: Math.round(liste[0].abw * 10) / 10 });
    else
      for (const x of liste)
        vorschlaege.push({ cardId: x.card.id, plattform: post.plattform, post, grund: "mehrere passende Karten oder Posts im selben Zeitfenster" });
  }
  return { auto, vorschlaege };
}

// Was an der Karte gespeichert wird (ohne die Funktion `passt`).
export const postEintrag = (post, zuordnung, abweichungStunden = null) => ({
  id: post.id,
  url: post.url,
  zeit: new Date(post.zeit).toISOString(),
  zuordnung, // "auto" | "bestaetigt" | "manuell"
  ...(abweichungStunden != null ? { abweichungStunden } : {}),
});
