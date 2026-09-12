// Zustand und Serverzugriff. Alles, was mehrere Ansichten teilen, steht hier — genau einmal.

import {
  migriere, leereKarte, STANDARD_PLATTFORMEN, leereDrehtermin, autoDrehNoetig, drehImFenster,
  rueckwaertsplan, phaseIndex, isoDatum, naechsteFreieSlots, fruehesterUpload,
} from "/lib/pipeline.js";
import { slotsForMonth } from "/lib/scheduler.js";
import { istAn as wfIstAn, param as wfParam } from "/lib/workflows.js";
import { feuere } from "./workflowengine.js";

export const S = {
  version: 1,
  cards: [],
  spalten: [], // Spalten aus Drive (v17b); leer => board.js faellt auf PHASEN zurueck
  drehtermine: [], // Batch-Drehtermine (v16)
  googleVerbunden: false, // gecachter Google-Verbindungsstand fuer den Auto-Sync (v16d-2)
  aktiv: null, // id der geoeffneten Karte
  ansicht: "board",
  monat: new Date(), // fuer die Kalenderansicht
  driveStand: new Map(), // Karten-id -> Ergebnis von /api/drive/scan
  driveScanLaeuft: new Set(), // Karten-ids, deren Drive-Scan gerade laeuft (v32 E2/B: Sanduhr auf der Kachel)
  zahlen: null, // zuletzt geholte Instagram-Zahlen
  zahlenLi: null, // zuletzt geholte LinkedIn-Zahlen
  defaults: { plattformen: STANDARD_PLATTFORMEN },
  workflows: {}, // Stand der Automationen (v26); leer => es gelten die Standards des Registers
  eigeneWorkflows: [], // selbstgebaute Workflows (v27); die Engine fragt genau diese Liste
};

// --- Workflows (v26) ------------------------------------------------------
//
// Jede Automation fragt vor ihrer Wirkung `an(id)`. Ein ausgeschalteter Workflow laeuft damit
// wirklich nicht mehr — ein Schalter ohne Wirkung waere eine Luege im UI.

export const an = (id) => wfIstAn(S.workflows, id);
export const stellschraube = (id, key) => wfParam(S.workflows, id, key);

function uebernimm(d) {
  S.workflows = {};
  for (const w of d.workflows || []) {
    S.workflows[w.id] = {
      an: w.an,
      params: Object.fromEntries((w.params || []).map((p) => [p.key, p.wert])),
    };
  }
  if (Array.isArray(d.eigene)) S.eigeneWorkflows = d.eigene;
}

export async function ladeWorkflows() {
  try {
    const d = await hole("/api/workflows");
    uebernimm(d);
    return d.workflows || [];
  } catch {
    return []; // ohne Antwort gelten die Standards des Registers
  }
}

// --- Selbstgebaute Workflows (v27) ----------------------------------------
//
// `feuere` ist der einzige Weg, auf dem ein eigener Workflow ueberhaupt laeuft. Jede Fundstelle
// unten im Board ruft ihn mit ihrem Ereignis — genau wie die eingebauten Neun `an(id)` rufen.

export { feuere };

export async function setzeEigenenWorkflow(workflow) {
  const d = await hole("/api/workflows/eigene", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workflow }),
  });
  if (Array.isArray(d.eigene)) S.eigeneWorkflows = d.eigene;
  return d.eigene || [];
}

export async function loescheEigenenWorkflow(id) {
  const d = await hole(`/api/workflows/eigene?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (Array.isArray(d.eigene)) S.eigeneWorkflows = d.eigene;
  return d.eigene || [];
}

export async function setzeWorkflow(id, { an: schalter, params } = {}) {
  const d = await hole("/api/workflows", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, an: schalter, params }),
  });
  uebernimm(d);
  return d.workflows || [];
}

// --- System Prompts (v26) -------------------------------------------------

export const promptsHolen = () => hole("/api/prompts");

export const promptSetzen = (id, text) =>
  hole("/api/prompts", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, text }),
  });

// Schnitt- und Freigabetermin aus dem Upload-Datum — Workflow "rueckwaertsplan" (v26).
// Ausgeschaltet bleibt nur das Upload-Datum stehen, die abgeleiteten Termine entfallen.
export const terminplan = (uploadDatum) => (an("rueckwaertsplan") ? rueckwaertsplan(uploadDatum) : {});

const abonnenten = new Set();
export const beiAenderung = (f) => abonnenten.add(f);
export const zeichne = () => abonnenten.forEach((f) => f());

export const karte = (id) => S.cards.find((c) => c.id === id) || null;
export const aktiveKarte = () => karte(S.aktiv);

// --- Anzeige im Kopf ------------------------------------------------------

let standEl;
let meldungEl;

export function verdrahteKopf(stand, meldung) {
  standEl = stand;
  meldungEl = meldung;
}

export function setStand(text) {
  if (standEl) standEl.textContent = text;
}

// Eine Meldung ist ein Satz mit Status — nie nur eine Farbe.
export async function melde(status, satz) {
  if (!meldungEl) return;
  const { statusChip, icon, escape } = await import("./ui.js");
  meldungEl.hidden = false;
  meldungEl.innerHTML =
    statusChip(status) +
    `<span class="befund-satz">${escape(satz)}</span>` +
    `<button class="meldung-schliessen" aria-label="Meldung schliessen">${icon("schliessen")}</button>`;
  meldungEl.querySelector(".meldung-schliessen").addEventListener("click", () => (meldungEl.hidden = true));
}

export function meldungWeg() {
  if (meldungEl) meldungEl.hidden = true;
}

// --- Server ---------------------------------------------------------------

async function hole(pfad, optionen) {
  const antwort = await fetch(pfad, optionen);
  const text = await antwort.text();
  let daten = {};
  try {
    daten = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Unerwartete Antwort des Servers (${antwort.status}).`);
  }
  if (!antwort.ok) {
    const fehler = new Error(daten.satz || daten.error || `Der Server antwortete mit ${antwort.status}.`);
    fehler.daten = daten;
    fehler.status = antwort.status;
    throw fehler;
  }
  return daten;
}

export async function ladeBoard() {
  // Erst die Workflows, dann das Board: `pruefeAutoDreh()` unten fragt schon `an(...)`, und die
  // selbstgebauten Workflows (v27) muessen stehen, bevor das erste Ereignis feuert. Faellt der
  // Aufruf aus, gelten die Standards des Registers — das Board laedt trotzdem.
  await ladeWorkflows();
  const daten = await hole("/api/board");
  S.version = daten.version;
  S.cards = (daten.cards || []).map(migriere);
  S.spalten = Array.isArray(daten.spalten) ? daten.spalten : [];
  S.drehtermine = Array.isArray(daten.drehtermine) ? daten.drehtermine : [];
  pruefeAutoDreh();
  await schwebendeNeuBerechnen(); // v30: schwebende Karten bei jedem Laden neu verteilen
  zeichne();
  // Google-Verbindungsstand fuer den Auto-Sync cachen (nicht blockierend).
  gcalStatus().then((s) => { S.googleVerbunden = !!s.verbunden; }).catch(() => {});
}

// Ohne Drehtermin im Vorlauf-Fenster den Sonntag der Folgewoche setzen (auto).
// speichere() schreibt ihn zurueck; ein zweites Fenster faengt der Versions-Lock ab.
// Workflow "auto-drehtermin" — abschaltbar, Fenster einstellbar (v26).
function pruefeAutoDreh() {
  if (!an("auto-drehtermin")) return;
  const heute = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const heuteIso = `${heute.getFullYear()}-${p(heute.getMonth() + 1)}-${p(heute.getDate())}`;
  const datum = autoDrehNoetig(S.drehtermine, heuteIso, stellschraube("auto-drehtermin", "vorlaufTage"));
  if (!datum) return;
  const t = leereDrehtermin(datum, "");
  t.auto = true;
  S.drehtermine.push(t);
  speichere();
}

let speicherLaeuft = null;

export async function speichere() {
  // Mehrere schnelle Aenderungen zu einem Schreibvorgang buendeln.
  if (speicherLaeuft) return speicherLaeuft;
  speicherLaeuft = (async () => {
    await new Promise((r) => setTimeout(r, 120));
    setStand("Speichere …");
    try {
      const daten = await hole("/api/board", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cards: S.cards, version: S.version, drehtermine: S.drehtermine }),
      });
      S.version = daten.version;
      setStand("Stand gespeichert.");
    } catch (e) {
      if (e.status === 409) {
        // Ein anderes Fenster war schneller. Nicht ueberschreiben — melden und neu laden.
        await melde("befund", e.message + " Der Stand wurde neu geladen; pruefe deine letzte Aenderung.");
        await ladeBoard();
      } else {
        setStand("Speichern fehlgeschlagen.");
        await melde("befund", `Speichern ging nicht: ${e.message}`);
      }
    } finally {
      speicherLaeuft = null;
    }
  })();
  return speicherLaeuft;
}

export function neueKarte(spalte) {
  const k = leereKarte(spalte);
  S.cards.push(k);
  speichere();
  // Ausloeser "karte-angelegt" fuer die selbstgebauten Workflows (v27).
  feuere("karte-angelegt", { karte: k });
  return k;
}

export function loescheKarte(id) {
  S.cards = S.cards.filter((c) => c.id !== id);
  if (S.aktiv === id) S.aktiv = null;
  speichere();
  zeichne();
}

// --- Drive ----------------------------------------------------------------

// Laufende Scans je Karten-id, damit derselbe Scan nicht mehrfach parallel startet. Wichtig:
// zeichneDetail ruft driveScan bei JEDEM Neuzeichnen, solange der Stand fehlt — ohne diese
// Deduplizierung wuerde der Start-Redraw (Sanduhr) einen zweiten Scan ausloesen und sich
// aufschaukeln. Ein zweiter Aufruf bekommt einfach dasselbe laufende Promise zurueck.
const scanInFlight = new Map();

export async function driveScan(k, frisch = false) {
  if (!frisch && S.driveStand.has(k.id)) return S.driveStand.get(k.id);
  if (!frisch && scanInFlight.has(k.id)) return scanInFlight.get(k.id);
  // v32 E2/B: laufenden Scan markieren (Kachel zeigt Sanduhr) und bei Abschluss das Board neu
  // zeichnen — so aktualisiert sich die Kachel VON SELBST, sobald die Drive-Daten da sind, ohne
  // dass man die Karte erst oeffnen und wieder schliessen muss.
  const p = (async () => {
    S.driveScanLaeuft.add(k.id);
    // Deferred: der Scan wird oft MITTEN im Zeichnen ausgeloest (aus zeichneDetail heraus). Ein
    // sofortiges zeichne() faellt dann in den Reentrance-Schutz und verpufft — als Microtask
    // laeuft es nach dem aktuellen Zeichenlauf, sodass die Kachel-Sanduhr wirklich erscheint.
    queueMicrotask(() => zeichne());
    try {
      // frisch=1: der Server-Scan-Cache (v32 C2) wird umgangen, wenn wir bewusst eine frische
      // Messung wollen (z. B. direkt nach Anlegen/Verschieben/Upload).
      const stand = await hole("/api/drive/scan" + (frisch ? "?frisch=1" : ""), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(k),
      });
      S.driveStand.set(k.id, stand);
      return stand;
    } finally {
      S.driveScanLaeuft.delete(k.id);
      scanInFlight.delete(k.id);
      zeichne();
    }
  })();
  scanInFlight.set(k.id, p);
  return p;
}

export async function driveAnlegen(k) {
  const ergebnis = await hole("/api/drive/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(k),
  });
  k.driveName = ergebnis.name;
  await speichere();
  S.driveStand.delete(k.id);
  return ergebnis;
}

export async function driveVerschieben(k, ziel) {
  const ergebnis = await hole("/api/drive/move", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ card: k, ziel }),
  });
  if (ergebnis.name) k.driveName = ergebnis.name;
  S.driveStand.delete(k.id);
  return ergebnis;
}

export async function driveSpeichern(k, dateiname, inhalt) {
  return hole("/api/drive/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ card: k, filename: dateiname, content: inhalt }),
  });
}

// Ein laufender Abgleich wird geteilt (v32 C3): Start-, Intervall- und Button-Abgleich duerfen
// sich nicht ueberlagern — der zweite Aufrufer bekommt dasselbe laufende Promise.
let abgleichInFlight = null;
export function abgleichLaeuft() {
  return !!abgleichInFlight;
}
export function driveAbgleich() {
  if (abgleichInFlight) return abgleichInFlight;
  abgleichInFlight = (async () => {
    try {
      const ergebnis = await hole("/api/drive/reconcile", { method: "POST" });
      S.cards = (ergebnis.cards || []).map(migriere);
      if (Array.isArray(ergebnis.spalten)) S.spalten = ergebnis.spalten;
      S.version = ergebnis.version;
      S.driveStand.clear();
      zeichne();
      return ergebnis;
    } finally {
      abgleichInFlight = null;
    }
  })();
  return abgleichInFlight;
}

// Spalte umbenennen (v17b): benennt den Drive-Ordner mit und aktualisiert die Spalten-Wahrheit.
export async function spaltenUmbenennen(id, name) {
  const r = await hole("/api/spalten/rename", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, name }),
  });
  if (Array.isArray(r.spalten)) S.spalten = r.spalten;
  zeichne();
  return r;
}

export async function driveStatus() {
  return hole("/api/drive/status");
}

// --- v22: Projektordner-Download + Video-Upload ---------------------------

// Reine URL — der Browser laedt selbst herunter (GET, Content-Disposition). `was` ist
// "skript" oder "rohmaterial"; der Server laesst nur diese zwei Ordner zu.
export function downloadUrl(k, was) {
  return `/api/projekt/download?karteId=${encodeURIComponent(k.id)}&was=${encodeURIComponent(was)}`;
}

// Eine Datei nach Drive hochladen: roher Body (kein Multipart, kein `hole` — der Body sind
// Bytes, kein JSON). `ziel` = "fertig" (Fertiges Video/) oder "rohmaterial" (Rohmaterial/).
// Das Weiterschieben der Karte macht der Aufrufer danach. Wirft mit sprechendem Satz.
export async function dateiHochladen(k, datei, ziel = "fertig") {
  const url =
    `/api/projekt/upload?karteId=${encodeURIComponent(k.id)}` +
    `&name=${encodeURIComponent(datei.name)}&ziel=${encodeURIComponent(ziel)}`;
  const antwort = await fetch(url, { method: "POST", body: datei });
  let daten = {};
  try { daten = JSON.parse((await antwort.text()) || "{}"); } catch { daten = {}; }
  if (!antwort.ok) throw new Error(daten.satz || daten.error || `Upload fehlgeschlagen (${antwort.status}).`);
  S.driveStand.delete(k.id);
  return daten;
}

// Duenner Alias fuer den v22-Aufrufer (fertiges Video).
export const videoHochladen = (k, datei) => dateiHochladen(k, datei, "fertig");

// --- KI -------------------------------------------------------------------

// Standard ist Ollama: laeuft lokal, kostet keine Token. Wer auf Claude umstellt, bekommt
// standardmaessig Haiku — schnellste Antwort, kleinster Verbrauch (v26).
function kiKonfig() {
  try {
    return {
      provider: localStorage.getItem("cm-ai-provider") || "ollama",
      ollamaModel: localStorage.getItem("cm-ollama-model") || "llama3.2",
      claudeModell: localStorage.getItem("cm-claude-modell") || "haiku",
    };
  } catch { return { provider: "ollama", ollamaModel: "llama3.2", claudeModell: "haiku" }; }
}

export async function ki(task, nutzlast) {
  return hole("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task, card: nutzlast, ...kiKonfig() }),
  });
}

// Wie ki(), aber der Text kommt live: onEreignis({delta}|{status}) waehrend des Laufs,
// zurueck kommt {text, data} wie bei ki(). So sieht man, dass die KI wirklich arbeitet.
export async function kiStream(task, nutzlast, onEreignis) {
  const res = await fetch("/api/ai/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task, card: nutzlast, ...kiKonfig() }),
  });
  if (!res.ok || !res.body) {
    let d = {};
    try { d = await res.json(); } catch {}
    const f = new Error(d.error || `Der Server antwortete mit ${res.status}.`);
    f.daten = d;
    throw f;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let puffer = "";
  let ergebnis = null;
  let fehler = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    puffer += dec.decode(value, { stream: true });
    let nl;
    while ((nl = puffer.indexOf("\n")) >= 0) {
      const zeile = puffer.slice(0, nl).trim();
      puffer = puffer.slice(nl + 1);
      if (!zeile) continue;
      let o;
      try { o = JSON.parse(zeile); } catch { continue; }
      if (o.t === "delta") onEreignis({ delta: o.text });
      else if (o.t === "status") onEreignis({ status: o.text });
      else if (o.t === "done") ergebnis = { text: o.text, data: o.data };
      else if (o.t === "error") fehler = o;
    }
  }
  if (fehler) {
    const f = new Error(fehler.error);
    f.daten = fehler;
    throw f;
  }
  return ergebnis || { text: "", data: null };
}

// --- Zahlen ---------------------------------------------------------------

// Auswertungsquelle (v24-2): "api" (Standard, live) oder "drive" (aus den Drive-CSVs).
// Lokale Nutzer-Einstellung wie Theme/Provider — dieselbe localStorage-Konvention.
export function auswertungQuelle() {
  try { return localStorage.getItem("cm-auswertung-quelle") || "api"; } catch { return "api"; }
}
export function setzeAuswertungQuelle(q) {
  try { localStorage.setItem("cm-auswertung-quelle", q === "drive" ? "drive" : "api"); } catch {}
}

export async function instagramZahlen() {
  return hole("/api/stats/instagram?quelle=" + auswertungQuelle());
}

export async function linkedinZahlen() {
  return hole("/api/stats/linkedin?quelle=" + auswertungQuelle());
}

// --- Redaktionsplan --------------------------------------------------------

export async function ladePlan() {
  try {
    const plan = await hole("/api/plan");
    // Owner 10.09.2026: ein haengender/fehlerhafter Drive-Zugriff darf nicht mehr still im
    // Cache-Fallback verschwinden — sichtbare Meldung mit Fehlercode, wie an anderer Stelle
    // (z. B. driveVerschieben) schon ueblich.
    const f = plan?.planAbgleich?.fehler;
    if (f) melde("befund", `Redaktionsplan: Drive-Zugriff fehlgeschlagen (${f.code ?? "?"}): ${f.message}`);
    return plan;
  } catch {
    return { slots: [] };
  }
}

export async function slotBelegen(slotId, karteId) {
  return hole("/api/plan/slot", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slotId, karteId }),
  });
}

// --- Forecast: schwebende Upload-Termine (v30) -----------------------------
//
// Eine Karte mit floatUpload===true traegt kein getipptes Datum, sondern "den naechsten
// freien Slot" — verschiebt sich automatisch, sobald eine andere, explizit datierte Karte
// diesen Slot belegt. Lauf: bei jedem Board-Laden (ladeBoard) und nach jeder Datums-relevanten
// Aenderung (Aufrufer in detail.js/nachschub.js). Stabile Reihenfolge: erst Phase (phaseIndex),
// dann die bestehende Reihenfolge in S.cards (entspricht der Spalten-Position).
//
// Schreibt ganz normal ueber terminplan(datum)+upload in k.dates (wie nachschub.js/detail.js
// es bei jedem anderen Termin auch tun) — faelligkeit(), tore(), wochenlast(), Kalender und
// KPI-Planung lesen dieselben Felder und brauchen keinen Sonderfall.
export async function schwebendeNeuBerechnen() {
  const schwebend = S.cards
    .filter((c) => c.floatUpload && c.column !== "fertig" && c.column !== "verworfen")
    .sort((a, b) => phaseIndex(a.column) - phaseIndex(b.column)); // stabiler Sort (Array#sort)

  if (!schwebend.length) return false;

  const plan = await ladePlan();
  const heute = new Date();
  const heuteIso = isoDatum(heute);
  const rohSlots = [];
  for (let delta = 0; delta < 2; delta++) {
    const year = heute.getFullYear() + Math.floor((heute.getMonth() + delta) / 12);
    const month = (heute.getMonth() + delta) % 12;
    rohSlots.push(...slotsForMonth(plan, year, month));
  }
  // P4 (v37): schwebende Karten rutschen nie vor „naechster Drehtermin + 8 Tage".
  const frueh = fruehesterUpload(S.drehtermine, heuteIso);
  const alleSlots = rohSlots
    .filter((s) => s.datum >= frueh)
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit || "").localeCompare(b.uhrzeit || ""));

  // Belegt ist jedes Upload-Datum einer NICHT-schwebenden Karte — schwebende Karten selbst
  // duerfen sich nicht gegenseitig blockieren, bevor sie neu verteilt sind.
  const schwebendIds = new Set(schwebend.map((c) => c.id));
  const belegt = new Set(
    S.cards
      .filter((c) => c.column !== "verworfen" && !schwebendIds.has(c.id) && (c.dates || {}).upload)
      .map((c) => c.dates.upload + "|" + (c.uploadTime || ""))
  );

  let geaendert = false;
  for (const k of schwebend) {
    const frei = naechsteFreieSlots(alleSlots, belegt, 1)[0];
    if (!frei) continue; // kein freier Slot in den naechsten 2 Monaten — Datum bleibt stehen
    belegt.add(frei.datum + "|" + (frei.uhrzeit || ""));
    if (k.dates.upload !== frei.datum || (k.uploadTime || "") !== (frei.uhrzeit || "")) {
      k.dates = { ...terminplan(frei.datum), upload: frei.datum };
      k.uploadTime = frei.uhrzeit || "";
      geaendert = true;
    }
  }
  if (geaendert) speichere();
  return geaendert;
}

// --- Drehtermine ----------------------------------------------------------

export function drehtermin(id) {
  return S.drehtermine.find((t) => t.id === id) || null;
}

export function drehterminAnlegen(datum, zeit) {
  const t = leereDrehtermin(datum, zeit);
  S.drehtermine.push(t);
  speichere();
  zeichne();
  autoSync(t.id); // sofort in Kalender + Tasks
  return t;
}

export function drehterminAendern(id, felder) {
  const t = drehtermin(id);
  if (!t) return;
  const altesDatum = t.datum;
  Object.assign(t, felder);
  // Datumsaenderung zieht die Dreh-Termine aller zugeordneten Karten mit (Upload bleibt).
  if (felder.datum && felder.datum !== altesDatum) {
    for (const kid of t.karteIds) {
      const k = karte(kid);
      if (k) k.dates = { ...(k.dates || {}), dreh: t.datum };
    }
  }
  speichere();
  zeichne();
  autoSync(id); // Datum/Ort/Titel-Aenderung nach Kalender + Tasks spiegeln
}

export function drehterminLoeschen(id) {
  const t = drehtermin(id);
  if (!t) return;
  gcalLoeschen(t); // Event + Task entfernen, bevor der Termin lokal verschwindet
  for (const kid of t.karteIds || []) {
    const k = karte(kid);
    if (k && k.drehterminId === id) k.drehterminId = null; // dates.dreh bleibt als freier Termin
  }
  S.drehtermine = S.drehtermine.filter((x) => x.id !== id);
  speichere();
  zeichne();
}

// Ordnet eine Karte einem Drehtermin zu. Liefert {ok, warnung}: warnung, wenn der Termin
// ausserhalb des Dreh-Fensters der Karte liegt (14 Tage vor Schnitt bis Schnitt) — keine Sperre.
export function karteZuTermin(karteId, terminId) {
  const k = karte(karteId);
  const t = drehtermin(terminId);
  if (!k || !t) return { ok: false };
  // Falls die Karte schon an einem anderen Termin haengt: dort loesen (und den mit-syncen).
  let altId = null;
  if (k.drehterminId && k.drehterminId !== terminId) {
    const alt = drehtermin(k.drehterminId);
    if (alt) { alt.karteIds = (alt.karteIds || []).filter((x) => x !== karteId); altId = alt.id; }
  }
  k.drehterminId = terminId;
  if (!Array.isArray(t.karteIds)) t.karteIds = [];
  if (!t.karteIds.includes(karteId)) t.karteIds.push(karteId);
  k.dates = { ...(k.dates || {}), dreh: t.datum };
  const warnung = drehImFenster(t.datum, (k.dates || {}).upload)
    ? ""
    : "Der Drehtermin liegt ausserhalb des empfohlenen Fensters (14 Tage vor Schnitt bis Schnitt).";
  speichere();
  zeichne();
  autoSync(terminId); // neue Kartenliste in Kalender + Tasks
  if (altId) autoSync(altId); // der alte Termin hat jetzt eine Karte weniger
  return { ok: true, warnung };
}

export function karteVonTermin(karteId, terminId) {
  const k = karte(karteId);
  const t = drehtermin(terminId);
  if (t) t.karteIds = (t.karteIds || []).filter((x) => x !== karteId);
  if (k && k.drehterminId === terminId) k.drehterminId = null; // dates.dreh bleibt
  speichere();
  zeichne();
  autoSync(terminId); // Karte entfernt -> Kalender + Tasks aktualisieren
}

// --- Google Calendar + Tasks (v16d) ---------------------------------------

export async function gcalStatus() {
  try { return await hole("/api/gcal/status"); } catch { return { verbunden: false }; }
}

// Verbinden ist ein Browser-Redirect in den OAuth-Consent (Ben klickt, stimmt zu).
export function gcalVerbinden() {
  window.location.href = "/api/auth/google";
}

// Legt/aktualisiert Kalender-Event + Task fuer einen Drehtermin und merkt sich die IDs.
export async function gcalSync(terminId) {
  const t = drehtermin(terminId);
  if (!t) return null;
  // Volle Karten mitschicken: der Server loest daraus je Projekt den Drive-Ordner-Link auf.
  const karten = (t.karteIds || []).map((id) => karte(id)).filter(Boolean);
  const r = await hole("/api/gcal/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      termin: { datum: t.datum, zeit: t.zeit, ort: t.ort, titel: t.titel },
      karten,
      eventId: t.gcalEventId || "",
      taskId: t.gtaskId || "",
    }),
  });
  t.gcalEventId = r.eventId || t.gcalEventId;
  t.gtaskId = r.taskId || t.gtaskId;
  await speichere();
  return r;
}

// --- Auto-Sync (v16d-2): Board ist die eine Wahrheit --------------------------
// Jede Aenderung an einem Drehtermin spiegelt sich sofort in Kalender + Tasks. Pro Termin
// serialisiert, damit zwei schnelle Aenderungen nicht zwei Events anlegen. Ein fehlender
// Zugang oder ein API-Fehler darf die lokale Aktion NIE blockieren.
const syncInFlight = new Map();
export function autoSync(terminId) {
  if (!an("gcal-autosync")) return; // Workflow "gcal-autosync" (v26)
  if (!S.googleVerbunden || !terminId) return;
  const prev = syncInFlight.get(terminId) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => gcalSync(terminId)).catch(() => {})
    .finally(() => { if (syncInFlight.get(terminId) === next) syncInFlight.delete(terminId); });
  syncInFlight.set(terminId, next);
}

// Loescht Event + Task eines Termins (beim Loeschen auf dem Board).
export async function gcalLoeschen(t) {
  if (!an("gcal-autosync")) return; // Workflow "gcal-autosync" (v26)
  if (!S.googleVerbunden || !t || (!t.gcalEventId && !t.gtaskId)) return;
  try {
    await hole("/api/gcal/loeschen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: t.gcalEventId || "", taskId: t.gtaskId || "" }),
    });
  } catch { /* Auto-Sync darf nie blockieren */ }
}

// --- Verbindungs-Center (v24) ---------------------------------------------

// Setzt EINEN erlaubten .env-Schluessel (Server prueft die Whitelist + sanitisiert).
export async function envSetzen(key, value) {
  return hole("/api/config/env", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export async function verbindungenStatus() {
  try { return await hole("/api/verbindungen/status"); } catch { return {}; }
}

// --- Benutzer-Defaults -----------------------------------------------------

export async function ladeDefaults() {
  try {
    const d = await hole("/api/defaults");
    if (d.plattformen && Array.isArray(d.plattformen)) S.defaults.plattformen = d.plattformen;
  } catch { /* Defaults sind Beiwerk */ }
}

export async function speichereDefaults(daten) {
  const ergebnis = await hole("/api/defaults", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(daten),
  });
  if (ergebnis.defaults) {
    if (ergebnis.defaults.plattformen) S.defaults.plattformen = ergebnis.defaults.plattformen;
  }
  return ergebnis;
}
