// Deterministischer Content-Scheduler — laeuft server- und browserseitig (kein Node-Import).
//
// Architektur:
//   1. Format-Frequenz (perWoche je Typ) bestimmt, WANN Slots erscheinen.
//   2. Plattform-Auswahl filtert Zeitfenster auf die Schnittmenge aktiver Plattformen.
//   3. Kategorie- und Ziel-Rotation verteilt den Inhalt gleichmaessig ueber alle Slots.
//
// Zeitfenster-Quellen (alle 2026, Klasse B — Schnittpunkt Instagram + LinkedIn optimiert):
//   Buffer 9,6 Mio. (Instagram), Sprout Social ~2 Mrd. (TikTok),
//   FlowShorts 24K+ (YouTube Shorts), Kanbox 4,8 Mio. (LinkedIn).
//   Vollstaendige Belege: docs/best-practices.md.
//
// Plan-Format typenmix: [{typ, perWoche}]
// Wochentag-Konvention: JS getDay() — 0=So 1=Mo 2=Di 3=Mi 4=Do 5=Fr 6=Sa

// --- Format → Plattform-Zuordnung -----------------------------------------
// Hartkodiert: auf welchen Plattformen kann ein Format erscheinen?

export const FORMAT_PLATTFORMEN = {
  reel:       ["instagram", "tiktok", "youtube", "linkedin"],
  langformat: ["youtube", "linkedin"],
  slider:     ["instagram", "linkedin"],
  beitrag:    ["instagram", "linkedin"],
  story:      ["instagram"],
};

// --- Zeitfenster je Format ------------------------------------------------
// Zeiten sind als Schnittmenge der besten Plaetze aller kompatiblen Plattformen gewaehlt.
// Kein einzelnes Plattform-Label mehr — die aktiven Plattformen werden zur Laufzeit bestimmt.

const ZEITFENSTER = {
  reel: [
    // Schnittmenge Instagram + LinkedIn (Do-Morgen beide stark); TikTok/YouTube ebenfalls gut
    { tag: 4, uhrzeit: "10:00" }, // Do 10:00 — IG Do-Peak, LI Morgen
    { tag: 3, uhrzeit: "11:00" }, // Mi 11:00 — IG Mi-Peak nahe, LI Vormittag
    { tag: 2, uhrzeit: "10:00" }, // Di 10:00 — IG + LI + YT Morgen
    { tag: 4, uhrzeit: "17:00" }, // Do 17:00 — LI Nachmittag, IG Abend rein
    { tag: 2, uhrzeit: "15:00" }, // Di 15:00 — LI + TK Nachmittag
    { tag: 3, uhrzeit: "14:00" }, // Mi 14:00 — YT Mittagsfenster, LI ok
    { tag: 5, uhrzeit: "20:00" }, // Fr 20:00 — TK Abendpeak (wenn aktiv)
    { tag: 6, uhrzeit: "20:00" }, // Sa 20:00 — TK Sa-Prime (wenn aktiv)
  ],
  langformat: [
    { tag: 4, uhrzeit: "15:00" }, // Do 15:00 — YT + LI Nachmittag
    { tag: 2, uhrzeit: "15:00" }, // Di 15:00
    { tag: 3, uhrzeit: "15:00" }, // Mi 15:00
    { tag: 4, uhrzeit: "17:00" }, // Do 17:00 — LI spaeter Nachmittag
    { tag: 2, uhrzeit: "17:00" }, // Di 17:00
  ],
  slider: [
    { tag: 3, uhrzeit: "12:00" }, // Mi 12:00 — IG Carousel-Spitze
    { tag: 3, uhrzeit: "16:00" }, // Mi 16:00 — LI Einzelhoch
    { tag: 4, uhrzeit: "10:00" }, // Do 10:00 — IG + LI
    { tag: 2, uhrzeit: "10:00" }, // Di 10:00
    { tag: 4, uhrzeit: "15:00" }, // Do 15:00
    { tag: 2, uhrzeit: "15:00" }, // Di 15:00
  ],
  beitrag: [
    { tag: 2, uhrzeit: "11:00" }, // Di 11:00 — IG + LI Morgen
    { tag: 4, uhrzeit: "17:00" }, // Do 17:00 — LI Nachmittag, IG Abend rein
    { tag: 3, uhrzeit: "12:00" }, // Mi 12:00 — IG + LI Mittag
    { tag: 2, uhrzeit: "15:00" }, // Di 15:00 — LI
    { tag: 4, uhrzeit: "15:00" }, // Do 15:00
  ],
  story: [
    // Nur Instagram — Timing weniger kritisch, Morgen + Abend jeden Werktag
    { tag: 1, uhrzeit: "08:00" }, // Mo 8:00
    { tag: 2, uhrzeit: "08:00" }, // Di 8:00
    { tag: 3, uhrzeit: "08:00" }, // Mi 8:00
    { tag: 4, uhrzeit: "08:00" }, // Do 8:00
    { tag: 5, uhrzeit: "08:00" }, // Fr 8:00
    { tag: 1, uhrzeit: "19:00" }, // Mo 19:00
    { tag: 3, uhrzeit: "19:00" }, // Mi 19:00
    { tag: 5, uhrzeit: "19:00" }, // Fr 19:00
  ],
};

// "highlight" ist kein eigener Upload-Typ — Storys werden nach dem Posten gepinnt.
// Der Scheduler plant nur "story"-Slots.

const MAX_PRO_WOCHE = {
  reel:       4,
  langformat: 2,
  slider:     3,
  beitrag:    3,
  story:      7,
};

export function fensterFuerTyp(typ) {
  return ZEITFENSTER[typ] || [];
}

// --- Epochen-Arithmetik ---------------------------------------------------

const EPOCH_MS = Date.UTC(2024, 0, 1); // 2024-01-01, Montag

export function wochenIndexVonDatum(isoStr) {
  return Math.floor((Date.parse(isoStr + "T00:00:00Z") - EPOCH_MS) / (7 * 86400000));
}

function isoTagUTC(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function tagVersatz(jsGetDay) {
  return (jsGetDay - 1 + 7) % 7; // Mo=0 ... Sa=5, So=6
}

// --- Format-Verteilung ---------------------------------------------------

// Migriert altes {anteil}-Format zu {perWoche}.
export function migriereTypenmix(typenmix, postsProWoche) {
  if (!typenmix || !typenmix.length) return typenmix;
  if (typenmix[0].perWoche !== undefined) {
    // Bereits migriert — "highlight"-Eintraege entfernen (kein eigener Slot-Typ mehr)
    return typenmix.filter((t) => t.typ !== "highlight");
  }
  const ppw = postsProWoche || 3;
  return typenmix
    .filter((t) => t.typ !== "highlight")
    .map((t) => ({
      typ: t.typ,
      perWoche: Math.round(((t.anteil || 0) / 100) * ppw * 4) / 4,
    }));
}

// Bresenham mit Math.floor — perWoche 0.25 ergibt exakt jede 4. Woche einen Post.
function typAnzahlProWoche(wi, typenmix) {
  const res = {};
  for (const { typ, perWoche } of typenmix) {
    if (!perWoche) { res[typ] = 0; continue; }
    res[typ] = Math.max(
      0,
      Math.min(
        Math.floor(perWoche * (wi + 1)) - Math.floor(perWoche * wi),
        MAX_PRO_WOCHE[typ] ?? 99,
      ),
    );
  }
  return res;
}

function waehleKategorie(aktiveKat, nr) {
  if (!aktiveKat.length) return "bildung";
  const s = [...aktiveKat].sort((a, b) => a.prioritaet - b.prioritaet);
  const n = s.length;
  const liste = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) liste.push(s[i].id);
  return liste[((nr % liste.length) + liste.length) % liste.length];
}

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

// Aktive Plattformen fuer dieses Format = Schnittmenge (Format-Plattformen ∩ aktive Plattformen).
function aktivePlattformenFuerFormat(typ, aktivePlattformen) {
  const moeglich = FORMAT_PLATTFORMEN[typ] || [];
  return moeglich.filter((p) => aktivePlattformen.includes(p));
}

// --- Haupt-API ------------------------------------------------------------

export function generiereWoche(wi, plan) {
  const typenmix    = migriereTypenmix(plan.typenmix, plan.kadenz?.postsProWoche);
  const anzahl      = typAnzahlProWoche(wi, typenmix);
  const aktiveKat   = (plan.kategorienFokus || []).filter((k) => k.aktiv);
  const aktivePl    = plan.plattformen || ["instagram", "linkedin"];

  const slots = [];
  let nr = wi * 53;
  const reihe = ["reel", "langformat", "slider", "beitrag", "story"];

  for (let ti = 0; ti < reihe.length; ti++) {
    const typ = reihe[ti];
    const anz = anzahl[typ] || 0;
    const fenster = ZEITFENSTER[typ] || [];
    if (!fenster.length) continue;

    const plattformen = aktivePlattformenFuerFormat(typ, aktivePl);
    // Wenn keine aktive Plattform fuer dieses Format: keine Slots erzeugen
    if (!plattformen.length) continue;

    for (let i = 0; i < anz; i++) {
      const f = fenster[(wi * 13 + ti * 7 + i * 3) % fenster.length];
      const ms = EPOCH_MS + (wi * 7 + tagVersatz(f.tag)) * 86400000;
      slots.push({
        datum: isoTagUTC(ms),
        uhrzeit: f.uhrzeit,
        typ,
        plattformen, // Array aller aktiven, kompatiblen Plattformen
        kategorie: waehleKategorie(aktiveKat, nr),
        ziel: waehleZiel(plan.zielgewichte || [], nr),
      });
      nr++;
    }
  }

  return slots.sort((a, b) => a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit));
}

// Deckelt den Abstand zwischen aufeinanderfolgenden Slots auf maxTage (v79).
// Erwartet eine chronologisch sortierte Liste. Zu weit entfernte Slots werden
// auf prevDatum+maxTage vorgezogen (Uhrzeit bleibt); die chronologische Ordnung
// bleibt erhalten, weil jeder Slot nur nach vorne (nie vor den Vorgaenger) rueckt.
export function deckleAbstand(slots, maxTage) {
  if (!maxTage || maxTage <= 0) return slots;
  const TAG = 86400000;
  for (let i = 1; i < slots.length; i++) {
    const prev = Date.parse(slots[i - 1].datum + "T00:00:00Z");
    const cur = Date.parse(slots[i].datum + "T00:00:00Z");
    if ((cur - prev) / TAG > maxTage) {
      slots[i] = { ...slots[i], datum: isoTagUTC(prev + maxTage * TAG) };
    }
  }
  return slots;
}

export function slotsForMonth(plan, year, month) {
  const erster = Date.UTC(year, month, 1);
  const letzter = Date.UTC(year, month + 1, 0);
  const vonWi = Math.max(0, Math.floor((erster - EPOCH_MS) / (7 * 86400000)));
  const bisWi = Math.ceil((letzter - EPOCH_MS) / (7 * 86400000)) + 1;
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  // Alle Slots des Zeitfensters chronologisch sammeln, damit die Abstands-Deckelung
  // auch ueber Wochen- und Monatsgrenzen den Vorgaenger kennt; erst danach auf den Monat filtern.
  const alle = [];
  for (let w = vonWi; w <= bisWi; w++) alle.push(...generiereWoche(w, plan));
  alle.sort((a, b) => a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit));
  deckleAbstand(alle, plan.maxAbstandTage);
  return alle.filter((s) => s.datum.startsWith(prefix));
}
