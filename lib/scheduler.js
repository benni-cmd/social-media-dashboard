// Deterministischer Content-Scheduler — laeuft server- und browserseitig (kein Node-Import).
// v78: einzige Abhaengigkeit ist pipeline.js (ebenfalls browserfaehig) fuer die aktiven Kategorien.
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

import { aktiveKategorien, aktiveZiele } from "./pipeline.js";

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

// v113 (M12, Owner 07.10.2026): gewichtetes Reihum (smooth weighted round robin). Bis v112 standen die
// Kategorien als Bloecke in einer 20er-Liste (10x Bildung, 6x Spendenaufruf, 4x Umfrage) und wurden mit
// einem Zaehler gezogen, der je Woche bei wi*53 neu ansetzte — gemessen 41/31/28 % statt 50/30/20 % ueber
// 39 Slots, dazu bis zu 10x dieselbe Kategorie hintereinander. Jetzt: gemischte, periodische Folge, die je
// Periode die Gewichte exakt trifft; der Zaehler laeuft ueber alle Wochen fortlaufend (slotsVorWoche).
const ggT = (a, b) => (b ? ggT(b, a % b) : a);
function reihum(gewichte) {
  const g = gewichte.map((x) => ({ id: x.id, w: Math.max(0, Math.round(x.gewicht || 0)) })).filter((x) => x.w > 0);
  if (!g.length) return [];
  const teiler = g.reduce((t, x) => ggT(t, x.w), 0) || 1;
  for (const x of g) { x.w /= teiler; x.cur = 0; }
  const summe = g.reduce((s, x) => s + x.w, 0);
  const folge = [];
  for (let i = 0; i < summe; i++) {
    let best = null;
    for (const x of g) { x.cur += x.w; if (!best || x.cur > best.cur) best = x; }
    best.cur -= summe;
    folge.push(best.id);
  }
  return folge;
}
const an = (folge, nr) => folge[((nr % folge.length) + folge.length) % folge.length];

// v78 Phase D: Ist eine %-Verteilung gesetzt (plan.kategorienAnteil, Summe > 0 ueber die aktiven
// Kategorien), rotiert die Auswahl gewichtet. Sonst die Prioritaets-Treppe von vorher.
function kategorieFolge(aktiveKat, anteile) {
  if (!aktiveKat.length) return ["bildung"];
  const folge = reihum(aktiveKat.map((k) => ({ id: k.id, gewicht: ((anteile || []).find((a) => a.id === k.id) || {}).anteil || 0 })));
  if (folge.length) return folge;
  const s = [...aktiveKat].sort((a, b) => a.prioritaet - b.prioritaet);
  const n = s.length;
  const liste = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) liste.push(s[i].id);
  return liste;
}

function zielFolge(zielgewichte) {
  const folge = reihum(zielgewichte);
  return folge.length ? folge : [(aktiveZiele()[0] || {}).id || "reach_new"]; // v78: erstes aktives Ziel
}

// v113 (M12): Wie viele Slots liegen VOR Woche `wi`? Damit zaehlt `nr` fortlaufend ueber Wochen- und
// Monatsgrenzen (vorher wi*53) und jedes Fenster (Monatsansicht, Drive-Horizont) bekommt dieselbe Folge.
function slotsVorWoche(wi, typenmix, aktivePl) {
  const zaehlt = (typ) => aktivePlattformenFuerFormat(typ, aktivePl).length > 0;
  let n = 0;
  for (let w = 0; w < wi; w++) {
    const anzahl = typAnzahlProWoche(w, typenmix);
    for (const [typ, a] of Object.entries(anzahl)) if (a > 0 && zaehlt(typ)) n += a;
  }
  return n;
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
  const aktiveKat   = aktiveKategorien(); // v78: Wahrheit = boardparameter (Einstellungs-Tab)
  // v78: im Tab deaktivierte Ziele fallen aus der Rotation, auch wenn der Plan noch Gewicht fuer sie hat.
  const zielAktiv   = new Set(aktiveZiele().map((z) => z.id));
  const zielgew     = (plan.zielgewichte || []).filter((z) => zielAktiv.has(z.id));
  const aktivePl    = plan.plattformen || ["instagram", "linkedin"];

  const slots = [];
  let nr = slotsVorWoche(wi, typenmix, aktivePl); // v113 (M12): fortlaufend statt wi * 53
  const katFolge = kategorieFolge(aktiveKat, plan.kategorienAnteil);
  const zFolge = zielFolge(zielgew);
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
      // Uhrzeit: beide belegten Fenster der Plattform im Wochenwechsel (Owner 01.10.2026: „darf variiert werden,
      // um langfristig Daten zu sammeln und zu vergleichen") — Tage bleiben fest. Teilt sich der Tag mit einem
      // anderen Format, nimmt dieses das jeweils andere Fenster.
      const uhrzeit = z.zeiten[((belegt[tag] || 0) + wi) % z.zeiten.length];
      belegt[tag] = (belegt[tag] || 0) + 1;
      const ms = EPOCH_MS + (wi * 7 + tagVersatz(tag)) * 86400000;
      slots.push({
        datum: isoTagUTC(ms),
        uhrzeit,
        typ,
        plattformen, // Array aller aktiven, kompatiblen Plattformen
        hauptplattform: hauptplattform(typ, aktivePl),
        kategorie: an(katFolge, nr),
        // v113 (M12): Ziele mit eigenem Versatz (+1 je Kategorie-Periode) — mit demselben Zaehler waeren
        // Kategorie und Ziel fest gekoppelt (v112: Spendenaufruf bekam nie das Ziel „Foerdern und spenden").
        ziel: an(zFolge, nr + Math.floor(nr / katFolge.length)),
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

// --- v115 (v114 H4/M5): EINE Abstands-Kette ab festem Anker ------------------------------
//
// Bis v114 begann die Deckelung je Monatsfenster neu (slotsForMonth) bzw. ab der laufenden Woche (Drive-Datei):
// derselbe Termin landete vorgezogen im Vormonat UND unveraendert im Folgemonat (Bens Plan: 161 statt 157 Termine
// in 12 Monaten, z. B. Reel am 30.11. und 02.12.2026), und die Drive-Datei wich vom Kalender ab. Jetzt rechnen
// Kalender, Upload-Vorschlaege, Wochen-Soll und Drive-Datei dieselbe Kette ab Woche 0 (01.01.2024) und schneiden
// nur ihr Fenster heraus. `deckleAbstand` zieht nur nach vorn — ein Termin haengt also allein von seinen
// Vorgaengern ab, und das Ergebnis ist vom Fenster unabhaengig.

const sortiere = (l) => l.sort((a, b) => a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit));
const heuteWi = () => Math.max(0, wochenIndexVonDatum(isoTagUTC(Date.now())));
const maxTageVon = (plan) => Math.max(0, Math.floor(Number(plan && plan.maxAbstandTage) || 0));
// Rechnet die Kette mindestens ~14 Monate ueber heute hinaus, damit 12-Monats-Fenster nicht neu rechnen muessen.
const kettenEnde = (bisWi) => Math.max(bisWi, heuteWi() + 60);
// generiereWoche haengt auch an den aktiven Kategorien/Zielen (Einstellungs-Tab) — die gehoeren in den Schluessel.
const kettenSchluessel = (plan, max) =>
  JSON.stringify([plan, max, aktiveKategorien().map((k) => [k.id, k.prioritaet]), aktiveZiele().map((z) => z.id)]);

const kettenSpeicher = new Map(); // Schluessel -> { bisWi, slots }
const KETTEN_MAX = 8;
function merke(speicher, schluessel, wert) {
  speicher.delete(schluessel);
  speicher.set(schluessel, wert);
  while (speicher.size > KETTEN_MAX) speicher.delete(speicher.keys().next().value);
  return wert;
}

function rohKette(plan, bisWi) {
  const slots = [];
  for (let w = 0; w <= bisWi; w++) slots.push(...generiereWoche(w, plan));
  return sortiere(slots);
}

function kette(plan, bisWi) {
  const max = abstandPruefung(plan).ok ? maxTageVon(plan) : 0; // unerfuellbar (nur per Handbearbeitung moeglich): ohne Deckel statt alles in 2024 zu ziehen
  const schluessel = kettenSchluessel(plan, max);
  const e = kettenSpeicher.get(schluessel);
  if (e && e.bisWi >= bisWi) return e.slots;
  const ende = kettenEnde(bisWi);
  return merke(kettenSpeicher, schluessel, { bisWi: ende, slots: deckleAbstand(rohKette(plan, ende), max) }).slots;
}

// Alle Slots mit Datum in [von, bis] (ISO), aus der einen Kette. Kopien — Aufrufer duerfen sie veraendern.
export function slotsImZeitraum(plan, von, bis) {
  const p = plan || {};
  const bisWi = Math.max(0, wochenIndexVonDatum(bis)) + 2; // Termine der Folgewochen koennen vorgezogen hereinfallen
  return kette(p, bisWi).filter((s) => s.datum >= von && s.datum <= bis).map((s) => ({ ...s }));
}

export function slotsForMonth(plan, year, month) {
  const von = isoTagUTC(Date.UTC(year, month, 1));
  const bis = isoTagUTC(Date.UTC(year, month + 1, 0));
  return slotsImZeitraum(plan, von, bis);
}

// Posts pro Woche laut Content-Mix (Summe perWoche).
export function postsProWoche(plan) {
  const mix = migriereTypenmix((plan && plan.typenmix) || [], plan && plan.kadenz && plan.kadenz.postsProWoche) || [];
  return mix.reduce((s, t) => s + (Number(t.perWoche) > 0 ? Number(t.perWoche) : 0), 0);
}

// Haelt der Planer diesen Abstand? „Einhaltbar" heisst: ueber die ganze Kette ist keine Luecke groesser als `max`,
// und kein Termin wird mehr als 7 Tage vor seine Plan-Woche gezogen. Sonst ruecken die Termine immer weiter nach
// vorn (v114: Klumpen am Monatsanfang, danach 26 Tage Luecke). Gemessen 07.10.2026 (tools/hart/logik.mjs): das
// Ergebnis ist monoton im Abstand und haengt am Format-Mix, nicht nur an 7/Posts — Bens Mix mit 1 Post/Woche braucht 11 Tage.
const MAX_VORZUG_TAGE = 7;
function haelt(roh, max) {
  if (max <= 0) return true;
  const gedeckelt = deckleAbstand(roh.map((s) => ({ ...s })), max);
  for (let i = 0; i < gedeckelt.length; i++) {
    if (i > 0 && (Date.parse(gedeckelt[i].datum) - Date.parse(gedeckelt[i - 1].datum)) / 86400000 > max) return false;
    if ((Date.parse(roh[i].datum) - Date.parse(gedeckelt[i].datum)) / 86400000 > MAX_VORZUG_TAGE) return false;
  }
  return true;
}

const pruefSpeicher = new Map();
const zahlDe = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

// v115 (v114 M5, Owner 07.10.2026: unerfuellbarer Abstand -> Speichern sperren). Liefert { ok, mindestTage, satz }.
export function abstandPruefung(plan) {
  const p = plan || {};
  const max = maxTageVon(p);
  const n = postsProWoche(p);
  if (max <= 0 || n <= 0) return { ok: true, mindestTage: 0, satz: "" };
  const schluessel = kettenSchluessel(p, "pruefung");
  const bekannt = pruefSpeicher.get(schluessel);
  if (bekannt) return bekannt;
  const roh = rohKette(p, kettenEnde(0));
  if (haelt(roh, max)) return merke(pruefSpeicher, schluessel, { ok: true, mindestTage: 0, satz: "" });
  let lo = max + 1, hi = 366;
  if (!haelt(roh, hi)) return merke(pruefSpeicher, schluessel, { ok: false, mindestTage: null, satz: `Mit ${zahlDe(n)} Posts pro Woche ist kein maximaler Abstand einhaltbar — auf 0 (keine Grenze) stellen oder mehr Posts pro Woche planen.` });
  while (lo < hi) { const mitte = Math.floor((lo + hi) / 2); if (haelt(roh, mitte)) hi = mitte; else lo = mitte + 1; }
  return merke(pruefSpeicher, schluessel, {
    ok: false,
    mindestTage: lo,
    satz: `Mit ${zahlDe(n)} Posts pro Woche ist ein Abstand von höchstens ${max} Tagen nicht einhaltbar — mindestens ${lo} Tage einstellen oder mehr Posts pro Woche planen.`,
  });
}
