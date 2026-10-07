// Redaktionsplan-Ablage in Drive (v17d). Drive ist die Wahrheit:
//
//   System (AI only)/redaktionsplan.json        = die STELLSCHRAUBEN (kadenz, typenmix,
//                                                  kategorienAnteil, zielgewichte, kampagnen; v78:
//                                                  aktive Kategorien aus boardparameter).
//   System (AI only)/redaktionsplan.slots.json  = das vom Skript BERECHNETE Ergebnis, plus der
//                                                  Fingerabdruck der Config, aus der es entstand.
//
// Der Redaktionsplan ist ein deterministisches Skript (lib/scheduler.js): dieselbe Config ergibt
// dieselben Slots. Darum ist die Wahrheit die CONFIG; die Slots werden jederzeit neu gerechnet.
// Beim Laden wird abgeglichen, ob das in Drive gespeicherte Ergebnis noch zur aktuellen Config
// passt (Fingerabdruck) — passt es nicht, gewinnt das Skript und Drive wird neu geschrieben.
// Der Server haelt keinen Plan-Zustand als Wahrheit; data/plan.json ist nur noch Cache.

import * as drive from "./drive.js";
import { SYSTEM_ORDNER, aktiveKategorien } from "./pipeline.js";
import { generiereWoche, wochenIndexVonDatum, migriereTypenmix, deckleAbstand } from "./scheduler.js";

const CONFIG_PFAD = `${SYSTEM_ORDNER}/redaktionsplan.json`;
const SLOTS_PFAD = `${SYSTEM_ORDNER}/redaktionsplan.slots.json`;

// Wie weit der berechnete Plan reicht — 8 Wochen decken den 2-Monats-Horizont des Nachschubs ab.
const HORIZONT_WOCHEN = 8;

// Nur die Stellschrauben, in fester Reihenfolge — daraus entsteht der Fingerabdruck.
function stellschrauben(config) {
  const c = config || {};
  return {
    kadenz: c.kadenz || {},
    typenmix: migriereTypenmix(c.typenmix, c.kadenz?.postsProWoche) || [],
    // v78: aktiv/prioritaet kommen aus boardparameter — der Fingerabdruck muss deren Aenderung sehen.
    kategorien: aktiveKategorien().map((k) => [k.id, k.prioritaet]),
    kategorienAnteil: c.kategorienAnteil || [],
    zielgewichte: c.zielgewichte || [],
    kampagnen: c.kampagnen || [],
    plattformen: c.plattformen || null,
    // v113 (M13): eine Aenderung nur des maximalen Abstands rechnete die Drive-Datei nicht neu (v112).
    maxAbstandTage: c.maxAbstandTage || 0,
  };
}

// Ein stabiler Fingerabdruck der Stellschrauben. Aendert er sich, ist das gespeicherte
// Ergebnis veraltet und wird neu gerechnet.
export function configFingerprint(config) {
  return JSON.stringify(stellschrauben(config));
}

function isoHeute(heute = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${heute.getFullYear()}-${p(heute.getMonth() + 1)}-${p(heute.getDate())}`;
}

// Das deterministische Ergebnis: alle Slots von der aktuellen Woche an ueber den Horizont.
export function berechneHorizontSlots(config, heute = new Date()) {
  const wi0 = Math.max(0, wochenIndexVonDatum(isoHeute(heute)));
  const slots = [];
  for (let w = wi0; w < wi0 + HORIZONT_WOCHEN; w++) slots.push(...generiereWoche(w, config));
  // v113 (M13): dieselbe Abstands-Deckelung wie die Board-Rechnung (scheduler.slotsForMonth) — bis v112 fehlte
  // sie hier, die Drive-Datei zeigte z. B. 6 Tage Luecke bei eingestellten 4.
  slots.sort((a, b) => a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit));
  deckleAbstand(slots, config && config.maxAbstandTage);
  return slots;
}

// --- Drive-Zugriff (fehlertolerant) --------------------------------------

// Owner 10.09.2026: /api/plan hing bis zu mehreren Minuten (drei sequentielle rclone-Aufrufe
// a 90s-Default-Timeout), weil ein einzelner haengender rclone-Call durch die globale
// Serialisierungs-Kette (drive.js, rclone()) ALLE Drive-Aufrufe der ganzen App blockiert —
// direkt per CLI nachgestellt: `rclone cat gdrive:System (AI only)/redaktionsplan.json`
// haengt trotz funktionierendem `rclone lsf gdrive:`. Kurzer Timeout hier, weil es sich um
// eine kleine JSON-Konfigurationsdatei handelt, die nie legitim 90s brauchen sollte.
//
// v42 (12.09.2026): 8000 war zu aggressiv — ein normaler rclone-Cold-Start / Token-Refresh
// ueberschreitet 8s und loeste sporadisch den Fehler-Toast "rclone antwortet seit 8 Sekunden
// nicht" aus (Fallback auf Cache greift, aber die Meldung alarmiert). Auf 20s angehoben:
// faengt den langsamen-aber-erfolgreichen Lauf ab, haelt den Fail-Fast-Schutz aber << 90s.
const PLAN_TIMEOUT_MS = 20000;

export async function leseConfigVonDrive() {
  try {
    return JSON.parse(await drive.readFile(CONFIG_PFAD, { timeoutMs: PLAN_TIMEOUT_MS }));
  } catch (e) {
    // "fehlend" (Datei existiert noch nicht) ist normal und bleibt still — jede andere
    // Stoerung (Timeout, echter Drive-Fehler) muss beim Aufrufer ankommen, sonst kann er
    // nicht zwischen "gibt es nicht" und "geht gerade nicht" unterscheiden (der Kommentar
    // hier versprach das schon, loeste es vorher aber nicht ein).
    if (e && e.fehlend) return null;
    throw e;
  }
}

export async function schreibeConfigNachDrive(config) {
  await drive.mkdir(SYSTEM_ORDNER, { timeoutMs: PLAN_TIMEOUT_MS });
  await drive.writeFile(CONFIG_PFAD, JSON.stringify(config, null, 2), { timeoutMs: PLAN_TIMEOUT_MS });
}

async function leseSlotsDatei() {
  try {
    return JSON.parse(await drive.readFile(SLOTS_PFAD, { timeoutMs: PLAN_TIMEOUT_MS }));
  } catch (e) {
    if (e && e.fehlend) return null;
    throw e;
  }
}

async function schreibeSlotsDatei(obj) {
  await drive.mkdir(SYSTEM_ORDNER, { timeoutMs: PLAN_TIMEOUT_MS });
  await drive.writeFile(SLOTS_PFAD, JSON.stringify(obj, null, 2), { timeoutMs: PLAN_TIMEOUT_MS });
}

// Gleicht das in Drive gespeicherte Ergebnis gegen die aktuelle Config ab. Passt der
// Fingerabdruck nicht (oder fehlt die Datei), rechnet das Skript neu und schreibt Drive.
export async function abgleiche(config, heute = new Date()) {
  const fp = configFingerprint(config);
  const gespeichert = await leseSlotsDatei();
  const slots = berechneHorizontSlots(config, heute);

  if (!gespeichert || gespeichert.fingerprint !== fp) {
    await schreibeSlotsDatei({ berechnetAm: new Date().toISOString(), fingerprint: fp, slots });
    return {
      slots,
      neuGerechnet: true,
      hinweis: gespeichert
        ? "Der in Drive gespeicherte Redaktionsplan war veraltet — das Skript hat neu gerechnet."
        : "Redaktionsplan-Ergebnis erstmals nach Drive geschrieben.",
    };
  }
  return { slots: gespeichert.slots || slots, neuGerechnet: false, hinweis: "" };
}
