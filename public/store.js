// Zustand und Serverzugriff. Alles, was mehrere Ansichten teilen, steht hier — genau einmal.

import { migriere, leereKarte, STANDARD_PLATTFORMEN, leereDrehtermin, autoDrehNoetig, drehImFenster } from "/lib/pipeline.js";

export const S = {
  version: 1,
  cards: [],
  spalten: [], // Spalten aus Drive (v17b); leer => board.js faellt auf PHASEN zurueck
  drehtermine: [], // Batch-Drehtermine (v16)
  aktiv: null, // id der geoeffneten Karte
  ansicht: "board",
  monat: new Date(), // fuer die Kalenderansicht
  driveStand: new Map(), // Karten-id -> Ergebnis von /api/drive/scan
  zahlen: null, // zuletzt geholte Instagram-Zahlen
  zahlenLi: null, // zuletzt geholte LinkedIn-Zahlen
  defaults: { plattformen: STANDARD_PLATTFORMEN },
};

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
  const daten = await hole("/api/board");
  S.version = daten.version;
  S.cards = (daten.cards || []).map(migriere);
  S.spalten = Array.isArray(daten.spalten) ? daten.spalten : [];
  S.drehtermine = Array.isArray(daten.drehtermine) ? daten.drehtermine : [];
  pruefeAutoDreh();
  zeichne();
}

// Ohne Drehtermin in den naechsten 30 Tagen den Sonntag der Folgewoche setzen (auto).
// speichere() schreibt ihn zurueck; ein zweites Fenster faengt der Versions-Lock ab.
function pruefeAutoDreh() {
  const datum = autoDrehNoetig(S.drehtermine);
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
  return k;
}

export function loescheKarte(id) {
  S.cards = S.cards.filter((c) => c.id !== id);
  if (S.aktiv === id) S.aktiv = null;
  speichere();
  zeichne();
}

// --- Drive ----------------------------------------------------------------

export async function driveScan(k, frisch = false) {
  if (!frisch && S.driveStand.has(k.id)) return S.driveStand.get(k.id);
  const stand = await hole("/api/drive/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(k),
  });
  S.driveStand.set(k.id, stand);
  return stand;
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

export async function driveAbgleich() {
  const ergebnis = await hole("/api/drive/reconcile", { method: "POST" });
  S.cards = (ergebnis.cards || []).map(migriere);
  if (Array.isArray(ergebnis.spalten)) S.spalten = ergebnis.spalten;
  S.version = ergebnis.version;
  S.driveStand.clear();
  zeichne();
  return ergebnis;
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

// --- KI -------------------------------------------------------------------

function kiKonfig() {
  try {
    return {
      provider: localStorage.getItem("cm-ai-provider") || "claude",
      ollamaModel: localStorage.getItem("cm-ollama-model") || "llama3.2",
    };
  } catch { return { provider: "claude", ollamaModel: "llama3.2" }; }
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

export async function instagramZahlen() {
  return hole("/api/stats/instagram");
}

export async function linkedinZahlen() {
  return hole("/api/stats/linkedin");
}

// --- Redaktionsplan --------------------------------------------------------

export async function ladePlan() {
  try {
    return await hole("/api/plan");
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

// --- Drehtermine ----------------------------------------------------------

export function drehtermin(id) {
  return S.drehtermine.find((t) => t.id === id) || null;
}

export function drehterminAnlegen(datum, zeit) {
  const t = leereDrehtermin(datum, zeit);
  S.drehtermine.push(t);
  speichere();
  zeichne();
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
}

export function drehterminLoeschen(id) {
  const t = drehtermin(id);
  if (!t) return;
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
  // Falls die Karte schon an einem anderen Termin haengt: dort loesen.
  if (k.drehterminId && k.drehterminId !== terminId) {
    const alt = drehtermin(k.drehterminId);
    if (alt) alt.karteIds = (alt.karteIds || []).filter((x) => x !== karteId);
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
  return { ok: true, warnung };
}

export function karteVonTermin(karteId, terminId) {
  const k = karte(karteId);
  const t = drehtermin(terminId);
  if (t) t.karteIds = (t.karteIds || []).filter((x) => x !== karteId);
  if (k && k.drehterminId === terminId) k.drehterminId = null; // dates.dreh bleibt
  speichere();
  zeichne();
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
