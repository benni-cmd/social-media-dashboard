// Zustand und Serverzugriff. Alles, was mehrere Ansichten teilen, steht hier — genau einmal.

import { migriere, leereKarte } from "/lib/pipeline.js";

export const S = {
  version: 1,
  cards: [],
  aktiv: null, // id der geoeffneten Karte
  ansicht: "board",
  monat: new Date(), // fuer die Kalenderansicht
  driveStand: new Map(), // Karten-id -> Ergebnis von /api/drive/scan
  zahlen: null, // zuletzt geholte Instagram-Zahlen
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
  zeichne();
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
        body: JSON.stringify({ cards: S.cards, version: S.version }),
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
  S.version = ergebnis.version;
  S.driveStand.clear();
  zeichne();
  return ergebnis;
}

export async function driveStatus() {
  return hole("/api/drive/status");
}

// --- KI -------------------------------------------------------------------

export async function ki(task, nutzlast) {
  return hole("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task, card: nutzlast }),
  });
}

// --- Zahlen ---------------------------------------------------------------

export async function instagramZahlen() {
  return hole("/api/stats/instagram");
}

export async function linkedinZahlen() {
  return hole("/api/stats/linkedin");
}
