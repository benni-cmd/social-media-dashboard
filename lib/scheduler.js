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

// --- Zeitfenster (v95) ----------------------------------------------------
// Owner 01.10.2026: „der eine Post pro Woche wird manchmal auf den Samstag gelegt". Vorher: feste
// Fensterlisten je Format (u. a. Fr/Sa 20:00 „TikTok, wenn aktiv" — nie gefiltert) und eine Rotation,
// die jede Woche ein anderes Fenster nahm. Jetzt: Tage und Zeiten kommen aus der Beleg-Tabelle je
// Plattform (docs/best-practices.md §16 — Buffer 2026 + Sprout Social 2026, Klasse B, gleiche Richtung),
// und der Zeitpunkt richtet sich nach der HAUPTPLATTFORM des Formats.
// Tage in Vorrang-Reihenfolge (die Mitte der besten Tage zuerst); Zeiten: erste = bevorzugt.
export const PLATTFORM_ZEITEN = {
  instagram: { tage: [3, 2, 4], zeiten: ["11:30", "18:30"] }, // Di–Do, 11–13 oder 18–21 Uhr
  linkedin:  { tage: [3, 2, 4], zeiten: ["15:30", "17:00"] }, // Di–Do, 15–18 Uhr
  youtube:   { tage: [3, 2],    zeiten: ["15:00", "17:00"] }, // Di–Mi, 14–18 Uhr
  tiktok:    { tage: [6, 0, 1], zeiten: ["19:30", "07:30"] }, // Sa (am staerksten), So, Mo; 18–22 / 6–10 Uhr
};

// Hauptplattform je Format = erste AKTIVE dieser Liste; nach ihr richtet sich der Zeitpunkt.
// Slider und Beitrag primaer LinkedIn (Paket v79: Dokument-Post / Text-Beitrag).
export const FORMAT_PRIMAER = {
  reel:       ["instagram", "tiktok", "youtube", "linkedin"],
  langformat: ["youtube", "linkedin"],
  slider:     ["linkedin", "instagram"],
  beitrag:    ["linkedin", "instagram"],
  story:      ["instagram"],
};

// Stories sind zeitlich unkritischer und taeglich moeglich: Werktage morgens/abends.
const STORY_ZEITEN = { tage: [1, 2, 3, 4, 5], zeiten: ["08:00", "19:00"] };
// Werktage als Ausweichtage, wenn mehr Posts je Woche geplant sind, als die Plattform beste Tage hat.
const AUSWEICH_WERKTAGE = [1, 5]; // Mo, Fr

function hauptplattform(typ, aktive) {
  const liste = FORMAT_PRIMAER[typ] || [];
  return liste.find((p) => aktive.includes(p)) || liste[0] || "instagram";
}

function zeitenFuer(typ, aktive) {
  if (typ === "story") return STORY_ZEITEN;
  return PLATTFORM_ZEITEN[hauptplattform(typ, aktive)] || PLATTFORM_ZEITEN.instagram;
}

// Gleichmaessig ueber die Woche: aus den (chronologisch sortierten) Kandidaten n Tage mit grossem Abstand.
function verteileTage(kandidaten, n) {
  const k = [...kandidaten].sort((a, b) => tagVersatz(a) - tagVersatz(b));
  if (n >= k.length) return k;
  if (n === 1) return [k[Math.floor((k.length - 1) / 2)]];
  return Array.from({ length: n }, (_, i) => k[Math.round((i * (k.length - 1)) / (n - 1))]);
}

// "highlight" ist kein eigener Upload-Typ — Storys werden nach dem Posten gepinnt.
// Der Scheduler plant nur "story"-Slots.

const MAX_PRO_WOCHE = {
  reel:       4,
  langformat: 2,
  slider:     3,
  beitrag:    3,
  story:      7,
};

export function fensterFuerTyp(typ, aktive = ["instagram", "linkedin"]) {
  const z = zeitenFuer(typ || "reel", aktive);
  return z.tage.flatMap((tag) => z.zeiten.map((uhrzeit) => ({ tag, uhrzeit })));
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
  // Haeufigste Formate zuerst — sie bekommen die besten Tage; seltene weichen aus.
  const reihe = ["reel", "langformat", "slider", "beitrag", "story"]
    .filter((t) => (anzahl[t] || 0) > 0 && aktivePlattformenFuerFormat(t, aktivePl).length)
    .sort((a, b) => (anzahl[b] || 0) - (anzahl[a] || 0));
  const belegt = {}; // Wochentag -> Anzahl Posts (alle Formate)

  for (const typ of reihe) {
    const anz = anzahl[typ];
    const z = zeitenFuer(typ, aktivePl);
    // Kandidaten: beste Tage der Hauptplattform, bei Bedarf Werktage dazu; Wochenende nur, wenn die
    // Hauptplattform es selbst belegt (TikTok) oder bei Stories ab 6 je Woche.
    let kandidaten = [...z.tage];
    if (anz > kandidaten.length) kandidaten = [...kandidaten, ...AUSWEICH_WERKTAGE.filter((t) => !kandidaten.includes(t))];
    if (typ === "story" && anz > kandidaten.length) kandidaten = [...kandidaten, 6, 0];
    // Bei Kollision mit anderen Formaten: Tage mit weniger Posts bevorzugen, sonst die Verteilung behalten.
    const frei = kandidaten.filter((t) => !belegt[t]);
    const tage = verteileTage(frei.length >= anz ? frei : kandidaten, Math.min(anz, kandidaten.length));
    const plattformen = aktivePlattformenFuerFormat(typ, aktivePl);

    for (const tag of tage) {
      // Teilt sich der Tag mit einem anderen Format, nimmt dieses Format die zweite Uhrzeit.
      const uhrzeit = z.zeiten[(belegt[tag] || 0) % z.zeiten.length];
      belegt[tag] = (belegt[tag] || 0) + 1;
      const ms = EPOCH_MS + (wi * 7 + tagVersatz(tag)) * 86400000;
      slots.push({
        datum: isoTagUTC(ms),
        uhrzeit,
        typ,
        plattformen, // Array aller aktiven, kompatiblen Plattformen
        hauptplattform: hauptplattform(typ, aktivePl),
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
      // v95: nie auf Sa/So — dann auf den Freitag davor (liegt immer noch innerhalb der Grenze).
      let ziel = prev + maxTage * TAG;
      const wt = new Date(ziel).getUTCDay();
      if (wt === 6 || wt === 0) {
        const zurueck = ziel - (wt === 6 ? 1 : 2) * TAG;
        if (zurueck > prev) ziel = zurueck;
      }
      slots[i] = { ...slots[i], datum: isoTagUTC(ziel) };
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
