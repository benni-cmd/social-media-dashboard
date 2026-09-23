// Ereignis-Bus fuer alles, was das Board nach aussen tut (v58).
//
// Zweck: nachvollziehen koennen, was gerade passiert. Jeder externe Aufruf — rclone,
// Google, Instagram/LinkedIn, Websuche, Ollama/Claude — meldet sich hier an und wieder ab.
// Die Kopfzeile liest daraus zwei Dinge: ob eine Sektion gerade arbeitet (Marker) und was
// sie zuletzt getan hat (Terminal).
//
// Bewusst klein gehalten: ein Ringpuffer im Speicher, eine Abonnenten-Liste, kein
// Fremd-Modul, KEINE Datei auf Platte (Owner-Entscheidung 23.09.2026). Nach einem
// Server-Neustart ist der Verlauf leer — das ist gewollt, nicht vergessen.

export const SEKTIONEN = {
  api: "API-Abgleich",
  drive: "Drive-Abgleich",
  weitere: "Weitere externe Anschluesse",
  ki: "KI",
};

const GROESSE = 500; // Ringpuffer-Tiefe (Owner: „letzte ~500 Ereignisse")

const puffer = [];
const hoerer = new Set();
let naechsteId = 1;

// Wie viele Vorgaenge in einer Sektion gerade laufen. Zaehler statt Flagge, weil mehrere
// Aufrufe derselben Sektion sich ueberlappen duerfen (zwei Drive-Scans, IG und LinkedIn).
const laufend = { api: 0, drive: 0, weitere: 0, ki: 0 };

// --- Schwaerzung ----------------------------------------------------------
//
// Mitschneiden heisst nicht alles mitschneiden. Die Instagram-/LinkedIn-Endpunkte tragen den
// Zugangstoken IN DER URL, und der Google-Token-Refresh schickt das Refresh-Token im Body.
// Ein Terminal, das man aufklappt und jemandem zeigt, darf keine Schluessel zeigen.
// Deshalb: Werte der bekannten Geheimnis-Parameter raus, und Header/Bodies werden gar nicht
// erst uebergeben (siehe die Anzapf-Stellen in lib/drive.js, lib/gcal.js, ...).
const GEHEIM = /\b(access_token|refresh_token|client_secret|client_id|api_key|apikey|key|code|token|password)\b(\s*[=:]\s*)("?)([^&\s"'#]+)\3/gi;

export function schwaerze(text) {
  if (!text) return "";
  return String(text)
    .replace(GEHEIM, (_, name, trenn, q) => `${name}${trenn}${q}…${q}`)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 …");
}

// --- Schreiben ------------------------------------------------------------

function schreibe(ereignis) {
  const e = { id: naechsteId++, zeit: Date.now(), ...ereignis };
  puffer.push(e);
  if (puffer.length > GROESSE) puffer.splice(0, puffer.length - GROESSE);
  for (const f of hoerer) {
    try { f(e); } catch { /* ein kaputter Zuhoerer darf den Aufruf nicht stoppen */ }
  }
  return e;
}

// Einzelnes Ereignis ohne Dauer — fuer Dinge, die keinen Anfang und kein Ende haben.
export function melde({ sektion = "weitere", dienst = "", text = "", status = "" }) {
  return schreibe({ sektion, dienst, text: schwaerze(text), status, laeuft: false });
}

// Ein Vorgang MIT Anfang und Ende. Rueckgabe: `fertig(text, status)` bzw. `fehler(text)`.
// Die Dauer misst der Bus selbst — so steht sie ueberall im selben Format und niemand
// muss sie an der Aufrufstelle mitrechnen.
export function starte({ sektion = "weitere", dienst = "", text = "" }) {
  laufend[sektion] = (laufend[sektion] || 0) + 1;
  const t0 = Date.now();
  const anfang = schreibe({ sektion, dienst, text: schwaerze(text), status: "", laeuft: true });
  let beendet = false;
  const ende = (ergebnisText, status) => {
    if (beendet) return anfang; // doppeltes Beenden darf den Zaehler nicht unter null ziehen
    beendet = true;
    laufend[sektion] = Math.max(0, (laufend[sektion] || 1) - 1);
    return schreibe({
      sektion,
      dienst,
      text: schwaerze(ergebnisText),
      status,
      laeuft: false,
      dauerMs: Date.now() - t0,
      zuId: anfang.id,
    });
  };
  return {
    id: anfang.id,
    fertig: (text2, status = "ok") => ende(text2, status),
    fehler: (text2) => ende(text2, "befund"),
  };
}

// --- Lesen ----------------------------------------------------------------

// Der Verlauf, optional nur einer Sektion und optional erst ab einer Ereignis-Id
// (damit ein wiederverbundener Zuhoerer nicht alles erneut bekommt).
export function verlauf({ sektion = "", seitId = 0 } = {}) {
  return puffer.filter((e) => (!sektion || e.sektion === sektion) && e.id > seitId);
}

// Welche Sektionen arbeiten gerade — das speist die Marker in der Kopfzeile.
export function aktiv() {
  const out = {};
  for (const s of Object.keys(SEKTIONEN)) out[s] = (laufend[s] || 0) > 0;
  return out;
}

export function abonniere(f) {
  hoerer.add(f);
  return () => hoerer.delete(f);
}
