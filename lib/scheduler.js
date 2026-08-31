// Deterministischer Content-Scheduler — laeuft server- und browserseitig (kein Node-Import).
//
// Zeitfenster-Quellen (alle 2026, Klasse B):
//   Instagram — Buffer 9,6 Mio. + Later 6 Mio. + RecurPost Beitraege
//   TikTok    — Sprout Social ~2 Mrd. Interaktionen + Buffer 7,1 Mio.
//   YouTube   — FlowShorts 24K+ Shorts + Viraly-Datensatz
//   LinkedIn  — Sprout Social + Kanbox 4,8 Mio. Beitraege
// Vollstaendige Belege: docs/best-practices.md, Abschnitt 16.
//
// Wochentag-Konvention: JS getDay() — 0=So 1=Mo 2=Di 3=Mi 4=Do 5=Fr 6=Sa

// --- Optimale Zeitfenster je Content-Typ ----------------------------------

const ZEITFENSTER = {
  reel: [
    { tag: 4, uhrzeit: "09:00", plattform: "instagram" }, // Do 9:00 — Instagram-Do-Peak
    { tag: 3, uhrzeit: "18:00", plattform: "instagram" }, // Mi 18:00
    { tag: 2, uhrzeit: "07:00", plattform: "instagram" }, // Di 7:00 — Reel-Morgenblock
    { tag: 4, uhrzeit: "19:00", plattform: "instagram" }, // Do 19:00
    { tag: 5, uhrzeit: "20:00", plattform: "tiktok" },    // Fr 20:00 — TikTok-Abendpeak
    { tag: 6, uhrzeit: "20:00", plattform: "tiktok" },    // Sa 20:00 — TikTok-Sa-Prime
    { tag: 2, uhrzeit: "14:00", plattform: "youtube" },   // Di 14:00 — YouTube-Mittagsfenster
    { tag: 3, uhrzeit: "15:00", plattform: "youtube" },   // Mi 15:00
  ],
  slider: [
    { tag: 3, uhrzeit: "12:00", plattform: "instagram" }, // Mi 12:00 — staerkster Carousel-Slot
    { tag: 4, uhrzeit: "09:00", plattform: "instagram" }, // Do 9:00
    { tag: 2, uhrzeit: "10:00", plattform: "instagram" }, // Di 10:00
    { tag: 3, uhrzeit: "16:00", plattform: "linkedin" },  // Mi 16:00 — LinkedIn-Einzelhoch
    { tag: 2, uhrzeit: "10:00", plattform: "linkedin" },  // Di 10:00
    { tag: 4, uhrzeit: "15:00", plattform: "linkedin" },  // Do 15:00
    { tag: 3, uhrzeit: "18:00", plattform: "instagram" }, // Mi 18:00
  ],
  beitrag: [
    { tag: 2, uhrzeit: "11:00", plattform: "instagram" }, // Di 11:00
    { tag: 4, uhrzeit: "18:00", plattform: "instagram" }, // Do 18:00
    { tag: 3, uhrzeit: "20:00", plattform: "instagram" }, // Mi 20:00
    { tag: 2, uhrzeit: "15:00", plattform: "linkedin" },  // Di 15:00
    { tag: 4, uhrzeit: "16:00", plattform: "linkedin" },  // Do 16:00
  ],
  story: [
    // Stories: Timing weniger kritisch — Morgen- und Abendfenster ganz Woche
    { tag: 1, uhrzeit: "08:00", plattform: "instagram" }, // Mo 8:00
    { tag: 2, uhrzeit: "08:00", plattform: "instagram" }, // Di 8:00
    { tag: 3, uhrzeit: "08:00", plattform: "instagram" }, // Mi 8:00
    { tag: 4, uhrzeit: "08:00", plattform: "instagram" }, // Do 8:00
    { tag: 5, uhrzeit: "08:00", plattform: "instagram" }, // Fr 8:00
    { tag: 1, uhrzeit: "19:00", plattform: "instagram" }, // Mo 19:00
    { tag: 3, uhrzeit: "19:00", plattform: "instagram" }, // Mi 19:00
    { tag: 5, uhrzeit: "19:00", plattform: "instagram" }, // Fr 19:00
  ],
  highlight: [
    { tag: 1, uhrzeit: "10:00", plattform: "instagram" }, // Mo 10:00 — sehr selten
    { tag: 3, uhrzeit: "10:00", plattform: "instagram" }, // Mi 10:00
    { tag: 5, uhrzeit: "10:00", plattform: "instagram" }, // Fr 10:00
  ],
};

// Wochenhaeufigkeit pro Typ — begrenzt durch Aufwand, nicht durch Wunsch
const MAX_PRO_WOCHE = {
  reel: 4,      // hoher Produktionsaufwand
  slider: 3,    // mittlerer Aufwand
  beitrag: 3,   // mittlerer Aufwand
  story: 7,     // leicht, taeglich moeglich
  highlight: 1, // sehr selten
};

// --- Epochen-Arithmetik ---------------------------------------------------

// Epoche 2024-01-01 war ein Montag — alle Wochen-Indizes relativ dazu (UTC).
const EPOCH_MS = Date.UTC(2024, 0, 1);

export function wochenIndexVonDatum(isoStr) {
  return Math.floor((Date.parse(isoStr + "T00:00:00Z") - EPOCH_MS) / (7 * 86400000));
}

function isoTagUTC(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// Versatz ab Montag (0=Mo, 1=Di, ..., 5=Sa, 6=So) — aus JS getDay()-Wert
function tagVersatz(jsGetDay) {
  return (jsGetDay - 1 + 7) % 7;
}

// --- Verteilung -----------------------------------------------------------

// Bresenham-Verteilung: wie viele Posts je Typ in Woche wi?
function typAnzahlProWoche(wi, ppw, typenmix) {
  const res = {};
  let gesamt = 0;
  for (const { typ, anteil } of typenmix) {
    if (!anteil) { res[typ] = 0; continue; }
    const f = anteil / 100;
    const n = Math.max(
      0,
      Math.min(
        Math.round(f * ppw * (wi + 1)) - Math.round(f * ppw * wi),
        MAX_PRO_WOCHE[typ] ?? 99,
      ),
    );
    res[typ] = n;
    gesamt += n;
  }
  // Gesamtbudget nicht ueberschreiten: von hinten kuerzen
  let ueber = gesamt - ppw;
  if (ueber > 0) {
    for (const { typ } of [...typenmix].reverse()) {
      if (ueber <= 0) break;
      const ab = Math.min(res[typ], ueber);
      res[typ] -= ab;
      ueber -= ab;
    }
  }
  return res;
}

// Kategorie: Prio-gewichtet, deterministisch rotierend
function waehleKategorie(aktiveKat, nr) {
  if (!aktiveKat.length) return "bildung";
  const s = [...aktiveKat].sort((a, b) => a.prioritaet - b.prioritaet);
  const n = s.length;
  const liste = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) liste.push(s[i].id);
  return liste[((nr % liste.length) + liste.length) % liste.length];
}

// Ziel: gewichtsbasiert, deterministisch rotierend
function waehleZiel(zielgewichte, nr) {
  const gesamt = zielgewichte.reduce((s, z) => s + (z.gewicht || 0), 0);
  if (!gesamt) return "reach_new";
  const liste = [];
  for (const z of zielgewichte) {
    const anz = Math.max(0, Math.round((z.gewicht / gesamt) * 20));
    for (let i = 0; i < anz; i++) liste.push(z.id);
  }
  return liste.length ? liste[((nr % liste.length) + liste.length) % liste.length] : "reach_new";
}

// --- Haupt-API ------------------------------------------------------------

// Erzeugt alle Slots fuer Woche wi gemaess plan-Parametern.
export function generiereWoche(wi, plan) {
  const ppw = plan.kadenz.postsProWoche;
  const anzahl = typAnzahlProWoche(wi, ppw, plan.typenmix);
  const aktiveKat = (plan.kategorienFokus || []).filter((k) => k.aktiv);

  const slots = [];
  let nr = wi * Math.max(ppw, 1) * 17; // deterministischer Samen
  const reihe = ["reel", "slider", "beitrag", "story", "highlight"];

  for (let ti = 0; ti < reihe.length; ti++) {
    const typ = reihe[ti];
    const anz = anzahl[typ] || 0;
    const fenster = ZEITFENSTER[typ] || [];
    if (!fenster.length) continue;
    for (let i = 0; i < anz; i++) {
      const f = fenster[(wi * 13 + ti * 7 + i * 3) % fenster.length];
      const ms = EPOCH_MS + (wi * 7 + tagVersatz(f.tag)) * 86400000;
      slots.push({
        datum: isoTagUTC(ms),
        uhrzeit: f.uhrzeit,
        typ,
        kategorie: waehleKategorie(aktiveKat, nr),
        ziel: waehleZiel(plan.zielgewichte || [], nr),
        plattform: f.plattform,
      });
      nr++;
    }
  }

  return slots.sort((a, b) => a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit));
}

// Alle Slots fuer einen Kalendermonat (month: 0-basiert wie JS Date).
export function slotsForMonth(plan, year, month) {
  const erster = Date.UTC(year, month, 1);
  const letzter = Date.UTC(year, month + 1, 0);
  const vonWi = Math.max(0, Math.floor((erster - EPOCH_MS) / (7 * 86400000)));
  const bisWi = Math.ceil((letzter - EPOCH_MS) / (7 * 86400000)) + 1;
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const alle = [];
  for (let w = vonWi; w <= bisWi; w++) {
    for (const s of generiereWoche(w, plan)) {
      if (s.datum.startsWith(prefix)) alle.push(s);
    }
  }
  return alle;
}
