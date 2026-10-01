// Zustand und Serverzugriff. Alles, was mehrere Ansichten teilen, steht hier — genau einmal.

import {
  migriere, leereKarte, STANDARD_PLATTFORMEN, leereDrehtermin, autoDrehNoetig, drehImFenster,
  rueckwaertsplan, phaseIndex, isoDatum, setDeadlineOffsets,
  spaetesterDreh, deutschesDatum,
} from "/lib/pipeline.js";
import { naechsterFreierUpload, belegteTermine, slotSchluessel } from "/lib/uploadslots.js";
import { istAn as wfIstAn, param as wfParam } from "/lib/workflows.js";

export const S = {
  version: 1,
  cards: [],
  spalten: [], // Spalten aus Drive (v17b); leer => board.js faellt auf PHASEN zurueck
  drehtermine: [], // Batch-Drehtermine (v16)
  plan: null, // zuletzt gelesener Redaktionsplan (v90); null = noch nicht geladen
  googleVerbunden: false, // gecachter Google-Verbindungsstand fuer den Auto-Sync (v16d-2)
  googleKonto: null, // Mail des verbundenen Google-Kontos, lazy geladen (v44)
  aktiv: null, // id der geoeffneten Karte
  ansicht: "board",
  monat: new Date(), // fuer die Kalenderansicht
  driveStand: new Map(), // Karten-id -> Ergebnis von /api/drive/scan
  driveScanLaeuft: new Set(), // Karten-ids, deren Drive-Scan gerade laeuft (v32 E2/B: Sanduhr auf der Kachel)
  abgleichStufe: "", // wo der laufende Drive-Abgleich steht, als Satz (v51 T7); leer = laeuft nicht
  zahlen: null, // zuletzt geholte Instagram-Zahlen
  zahlenLi: null, // zuletzt geholte LinkedIn-Zahlen
  defaults: { plattformen: STANDARD_PLATTFORMEN, personen: [] }, // personen: Team-Mailliste (v44)
  workflows: {}, // Stand der Automationen (v26); leer => es gelten die Standards des Registers
  // v81: Stammt das Gezeigte schon aus Drive? Bis der Abgleich durch ist, zeigt das Board den
  // lokalen Cache — Kopf, Spalten, Karten und Detail kennzeichnen das. `fehler` = letzter
  // gescheiterter Abgleich (Kennzeichnung bleibt dann stehen, mit Grund).
  live: { board: false, laeuft: false, fehler: null, cacheStand: null, spalten: new Set() }, // spalten: Phase-IDs, deren Drive-Ordner im laufenden Abgleich schon gelesen sind (v83)
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
  syncDeadlineOffsets();
}

// Schiebt die konfigurierten Deadline-Offsets (v70) aus den rueckwaertsplan-Params in pipeline.js,
// damit alle Deadlines (Ampel, rueckwaertsplan, drehFenster, spaetesterDreh) upload-verankert mit den
// eingestellten Offsets rechnen. Greift bei jedem Laden (ladeWorkflows) UND nach jedem Speichern.
function syncDeadlineOffsets() {
  setDeadlineOffsets({
    freigabe: wfParam(S.workflows, "rueckwaertsplan", "freigabeVorUpload"),
    schnitt: wfParam(S.workflows, "rueckwaertsplan", "schnittVorFreigabe"),
    dreh: wfParam(S.workflows, "rueckwaertsplan", "drehVorSchnitt"),
  });
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

// v55: Die auf Board/Kalender SICHTBAREN Karten. Eine optimistisch geloeschte Karte traegt
// `_geloescht` und ist ausgeblendet — sie bleibt aber in S.cards und in board.json, bis der
// Drive-Trash bestaetigt ist (sonst baut der Abgleich sie aus dem noch vorhandenen Ordner wieder
// auf, lib/projects.js:361 — der Wiederkehr-Bug). Jede Karten-Ansicht liest ueber diese Sicht.
export const sichtbareKarten = () => S.cards.filter((c) => !c._geloescht);

// --- Anzeige im Kopf ------------------------------------------------------

let standEl;

export function verdrahteKopf(stand) {
  standEl = stand;
}

export function setStand(text) {
  if (standEl) standEl.textContent = text;
}

// Eine Meldung ist ein Satz mit Status — nie nur eine Farbe. Erscheint als Popup-Notification
// (v52), die stehen bleibt, bis sie aktiv weggeklickt wird — vorher stand sie in einer festen
// Kopf-Zeile und ging beim naechsten Aufruf oder beim Wegscrollen unter.
export async function melde(status, satz) {
  const { hinweisToast } = await import("./ui.js");
  hinweisToast(status, satz);
}

// v55: EINE gemeinsame Hilfe fuer schreibende externe Aktionen — die Oberflaeche wartet nie auf
// den Dienst. Dieselbe Regel ueberall: lokal fuehrt, extern folgt im Hintergrund, und ein
// Fehlschlag ist NIE unsichtbar (Toast statt stiller catch — genau der Fehler in autoSync/
// gcalLoeschen bis v55). `zurueck` nimmt eine optimistische lokale Aenderung zurueck und zeichnet
// neu. Rueckgabe = Promise, das selbst nie rejectet — kein Aufrufer muss darauf blockieren.
export function imHintergrund(aktion, { was = "Der Abgleich", zurueck } = {}) {
  return Promise.resolve().then(aktion).catch(async (e) => {
    try { zurueck?.(); zeichne(); } catch {}
    await melde("befund", `${was} ging nicht: ${e.message}`);
  });
}

// Wie melde(), aber der Toast traegt einen „Wiederholen"-Knopf (v55, 2. Abschnitt): ein
// fehlgeschlagener Hintergrund-Abgleich ist so mit einem Klick erneut anstossbar.
export async function meldeWiederholbar(status, satz, onWiederholen) {
  const { hinweisToastAktion } = await import("./ui.js");
  hinweisToastAktion(status, satz, "Wiederholen", onWiederholen);
}

// v55 (2. Abschnitt): DIE gemeinsame Hilfe fuer eine schreibende externe Aktion, die sich sofort
// anfuehlen soll. Lokal fuehrt — `anwenden` macht die Aenderung, `zeichne()` zeigt sie, `sichern`
// schreibt sie dauerhaft (Standard: `speichere` -> board.json). Erst danach laeuft `extern` im
// Hintergrund. Scheitert der Dienst, wird `zuruecknehmen` gefahren und der Bruch SICHTBAR gemeldet
// — mit einem Klick „Wiederholen", der Aenderung und Dienst-Aufruf erneut startet. Kein Aufrufer
// blockiert; das zurueckgegebene Promise rejectet nie (der Fehler ist bereits behandelt).
export function optimistisch({ anwenden, zuruecknehmen, extern, was = "Die Aktion", sichern = speichere, beiErfolg }) {
  const fahre = () => {
    try { anwenden?.(); } catch {}
    zeichne();
    return Promise.resolve(sichern ? sichern() : undefined)
      .then(() => extern())
      .then((r) => { zeichne(); try { beiErfolg?.(r); } catch {} return r; })
      .catch(async (e) => {
        try { zuruecknehmen?.(); } catch {}
        zeichne();
        if (sichern) { try { await sichern(); } catch {} }
        await meldeWiederholbar("befund", `${was} ging nicht: ${e.message}`, fahre);
      });
  };
  return fahre();
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

// v83: Ist diese Spalte schon mit Drive abgeglichen (ganzer Abgleich durch ODER ihr Ordner gelesen)?
export function spalteLive(id) {
  return S.live.board || S.live.spalten.has(id);
}

export async function ladeBoard() {
  // v81: Erst der Cache, SOFORT gezeichnet (/api/board ~10 ms), dann die Workflows (bis 20 s,
  // Drive-gestuetzt). `pruefeAutoDreh()` fragt `an(...)` und laeuft deshalb erst danach —
  // vorher zeichnet das Board mit den Standards des Registers. Faellt der Workflow-Aufruf aus,
  // gelten diese Standards weiter.
  const daten = await hole("/api/board");
  S.version = daten.version;
  S.cards = (daten.cards || []).map(migriere);
  merkeBasis(); // v88: Server-Stand = Basis fuer das Zusammenfuehren bei Konflikten
  S.spalten = Array.isArray(daten.spalten) ? daten.spalten : [];
  S.drehtermine = Array.isArray(daten.drehtermine) ? daten.drehtermine : [];
  S.live.cacheStand = daten.cacheStand || null;
  zeichne();
  // v83: Der Drive-Abgleich startet sofort nach dem ersten Zeichnen und laeuft PARALLEL zu
  // Workflows/Plan — vorher begann er erst nach dem ganzen Start (ueber 60 s gemessen) und die
  // Kopf-Plakette stand solange auf „noch nicht live". Nach einem Fehlschlag nicht von selbst
  // wiederholen (Klick auf die Plakette).
  if (!S.live.board && !S.live.laeuft && !S.live.fehler) driveAbgleich().catch(() => {});
  await ladeWorkflows();
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
let nochmalSpeichern = false;

// v88 (Befund 01.10.2026: ein KI-Ergebnis ging verloren, weil ein zweites Fenster gespeichert
// hatte und der 409-Weg einfach neu lud): `basis` ist der Karten-Stand, den der Server zuletzt
// bestaetigt hat. Bei einem Konflikt werden NUR die eigenen Aenderungen gegenueber `basis` auf den
// Stand des anderen Fensters gelegt und erneut gespeichert — nichts wird mehr verworfen.
let basis = new Map();
export function merkeBasis(cards = S.cards) {
  basis = new Map(cards.map((c) => [c.id, JSON.stringify(c)]));
}

export function legeAufFremdenStand(eigene, basisMap, fremde) {
  const geaendert = eigene.filter((c) => basisMap.get(c.id) !== JSON.stringify(c));
  const eigeneIds = new Set(eigene.map((c) => c.id));
  const geloescht = new Set([...basisMap.keys()].filter((id) => !eigeneIds.has(id)));
  const perId = new Map(geaendert.map((c) => [c.id, c]));
  const cards = fremde.filter((c) => !geloescht.has(c.id)).map((c) => perId.get(c.id) || c);
  const da = new Set(cards.map((c) => c.id));
  for (const c of geaendert) if (!da.has(c.id)) cards.push(c);
  return { cards, uebernommen: geaendert.length + geloescht.size };
}

export async function speichere() {
  // Mehrere schnelle Aenderungen zu einem Schreibvorgang buendeln. Kommt waehrend eines laufenden
  // Speicherns eine neue Aenderung, wird danach noch einmal gespeichert (v88: vorher ging sie
  // bis zum naechsten Speichern verloren, falls keins mehr kam).
  if (speicherLaeuft) { nochmalSpeichern = true; return speicherLaeuft; }
  speicherLaeuft = (async () => {
    await new Promise((r) => setTimeout(r, 120));
    setStand("Speichere …");
    const gesendet = JSON.parse(JSON.stringify(S.cards)); // tiefe Kopie: Aenderungen waehrend des Sendens zaehlen danach als eigene
    try {
      const daten = await hole("/api/board", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cards: S.cards, version: S.version, drehtermine: S.drehtermine }),
      });
      S.version = daten.version;
      merkeBasis(gesendet);
      setStand("Stand gespeichert.");
    } catch (e) {
      if (e.status === 409 && e.daten && e.daten.aktuell) {
        // Ein anderes Fenster war schneller: eigene Aenderungen auf dessen Stand legen, nochmal speichern.
        const fremd = e.daten.aktuell;
        const { cards, uebernommen } = legeAufFremdenStand(S.cards, basis, (fremd.cards || []).map(migriere));
        S.cards = cards;
        S.version = fremd.version;
        if (Array.isArray(fremd.drehtermine)) {
          const ids = new Set(fremd.drehtermine.map((t) => t.id));
          S.drehtermine = [...fremd.drehtermine, ...S.drehtermine.filter((t) => !ids.has(t.id))];
        }
        merkeBasis((fremd.cards || []).map(migriere));
        zeichne();
        nochmalSpeichern = true;
        await melde("hinweis", `Ein anderes Fenster hatte gespeichert. Dein Stand wurde mit seinem zusammengeführt (${uebernommen} eigene Änderung${uebernommen === 1 ? "" : "en"} übernommen) und gespeichert.`);
      } else if (e.status === 409) {
        await melde("befund", e.message + " Der Stand wurde neu geladen; pruefe deine letzte Aenderung.");
        await ladeBoard();
      } else {
        setStand("Speichern fehlgeschlagen.");
        await melde("befund", `Speichern ging nicht: ${e.message}`);
      }
    } finally {
      speicherLaeuft = null;
      if (nochmalSpeichern) { nochmalSpeichern = false; speichere(); }
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

// Karten, deren Drive-Trash gerade laeuft (v55). Der Hintergrund-Abgleich (driveAbgleich) baut
// S.cards komplett neu und wuerde dabei das `_geloescht`-Flag verlieren — diese Menge stellt es
// wieder her, damit eine optimistisch geloeschte Karte nicht mitten im Trash zurueckpoppt.
const geloeschtInFlight = new Set();
export const istGeloeschtInFlight = (id) => geloeschtInFlight.has(id);

// Karte loeschen (v55): OPTIMISTISCH. Ohne Drive-Ordner ist nichts extern zu tun — sofort und
// dauerhaft raus. Mit Drive-Ordner verschwindet die Karte SOFORT aus der Ansicht (Anzeige-
// Tombstone `_geloescht`), waehrend der Ordner im Hintergrund in den Papierkorb wandert (bis 7
// Suchen + Move-Timeout 180 s; bis v54 stand die Oberflaeche dabei bis zu 180 s still). WICHTIG
// gegen den Wiederkehr-Bug: die Karte bleibt so lange in S.cards UND in board.json — es wird in
// diesem Fenster NICHT gespeichert, also gelangt `_geloescht` nie nach board.json, und der
// Abgleich sieht Ordner und Karte gepaart (baut nichts wieder auf, lib/projects.js:361). Erst
// wenn der Trash bestaetigt ist, wird die Karte dauerhaft entfernt. Scheitert der Trash, kommt
// die Karte zurueck und der Aufruf wirft (der Aufrufer meldet den Bruch; kein Datenverlust).
export async function loescheKarte(id) {
  const k = karte(id);
  if (!k) return;
  if (S.aktiv === id) S.aktiv = null;
  if (!k.driveName) {
    S.cards = S.cards.filter((c) => c.id !== id);
    await speichere();
    zeichne();
    return;
  }
  k._geloescht = true;
  geloeschtInFlight.add(id);
  zeichne(); // sofort weg aus Board + Kalender
  try {
    await hole("/api/karte/loeschen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(k),
    });
  } catch (e) {
    delete k._geloescht; // Anzeige zuruecknehmen — die Karte war nie wirklich fort
    geloeschtInFlight.delete(id);
    zeichne();
    throw e; // Aufrufer (kontextmenu/detail) meldet den Bruch selbst
  }
  // Trash bestaetigt: jetzt dauerhaft aus dem Board nehmen und sichern.
  geloeschtInFlight.delete(id);
  S.cards = S.cards.filter((c) => c.id !== id);
  await speichere();
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
// v51 T7: Wo der Abgleich gerade steht, als fertiger deutscher Satz. Eigene Mini-Anmeldung
// statt `zeichne()` — der Lauf meldet mehrmals pro Sekunde, und ein voller Board-Neuaufbau
// je Meldung waere um Groessenordnungen zu teuer.
let abgleichStufeHoerer = [];
// Rueckgabe meldet wieder ab — noetig fuer Hoerer, die an ein kurzlebiges Element haengen
// (der Balken im Kopf-Menue), sonst schreibt bei jedem Klick ein Hoerer mehr ins Leere.
export function beiAbgleichStufe(f) {
  abgleichStufeHoerer.push(f);
  return () => {
    abgleichStufeHoerer = abgleichStufeHoerer.filter((h) => h !== f);
  };
}
export function abgleichStufe() {
  return S.abgleichStufe || "";
}
function setzeAbgleichStufe(satz) {
  S.abgleichStufe = satz;
  for (const f of abgleichStufeHoerer) {
    try { f(satz); } catch {}
  }
}

// Die Stufen des Abgleichs als Saetze — dieselbe Trennung wie beim KI-Stream: der Server
// schickt den Code, die Anzeige besitzt den Wortlaut.
function abgleichSatz(o) {
  if (o.stufe === "drive-spalten") return "Gleicht die Spalten mit Drive ab …";
  if (o.stufe === "drive-ordner") return `Liest Drive-Ordner ${o.schritt}/${o.von}: ${o.was} …`;
  if (o.stufe === "drive-karte") return `Gleicht Karte ${o.schritt}/${o.von} ab: ${o.was} …`;
  if (o.stufe === "fertig") return "";
  return "";
}

export function driveAbgleich() {
  if (abgleichInFlight) return abgleichInFlight;
  abgleichInFlight = (async () => {
    S.live.laeuft = true;
    S.live.spalten = new Set();
    zeichne();
    // v88: Karten, die WAEHREND des Abgleichs hier im Browser entstanden sind, kennt das Ergebnis
    // evtl. noch nicht (Speichern lief noch). Sie bleiben stehen, statt zu verschwinden.
    const vorher = new Set(S.cards.map((c) => c.id));
    try {
      const ergebnis = await abgleichStream();
      const lokalNeu = S.cards.filter((c) => !vorher.has(c.id));
      S.cards = (ergebnis.cards || []).map(migriere);
      merkeBasis(S.cards); // v88: Abgleich-Ergebnis = Server-Stand
      const da = new Set(S.cards.map((c) => c.id));
      for (const c of lokalNeu) if (!da.has(c.id)) S.cards.push(c);
      // v55: Ein Abgleich mitten im Trash-Fenster darf eine optimistisch geloeschte Karte nicht
      // wieder sichtbar machen — Flag nach dem Neuaufbau erneut setzen.
      if (geloeschtInFlight.size) for (const c of S.cards) if (geloeschtInFlight.has(c.id)) c._geloescht = true;
      if (Array.isArray(ergebnis.spalten)) S.spalten = ergebnis.spalten;
      S.version = ergebnis.version;
      S.driveStand.clear();
      S.live.board = true;
      S.live.fehler = null;
      return ergebnis;
    } catch (e) {
      S.live.fehler = e.message || String(e);
      S.live.spalten = new Set(); // v83: Abgleich unvollstaendig -> die Kartendaten sind nicht bestaetigt, alles wieder als Cache zeigen
      // v87: Falsche Ordnerstruktur in Drive -> der Grund als Meldung, nicht nur im Tooltip.
      if (/Ordnerstruktur nicht stimmt/.test(S.live.fehler)) melde("befund", S.live.fehler);
      throw e;
    } finally {
      S.live.laeuft = false;
      zeichne();
      abgleichInFlight = null;
      setzeAbgleichStufe("");
    }
  })();
  return abgleichInFlight;
}

// Liest den NDJSON-Strom von /api/drive/reconcile/stream. Gleiche Zeilen-Typen wie beim
// KI-Stream, gleiche Nachsicht: unbekannte Typen werden still uebersprungen.
async function abgleichStream() {
  const res = await fetch("/api/drive/reconcile/stream", { method: "POST" });
  if (!res.ok || !res.body) throw new Error(`Der Server antwortete mit ${res.status}.`);
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
      if (o.t === "stufe" && o.stufe === "drive-ordner-fertig") {
        S.live.spalten.add(o.phase);
        zeichne();
      } else if (o.t === "stufe") setzeAbgleichStufe(abgleichSatz(o));
      else if (o.t === "done") ergebnis = o;
      else if (o.t === "error") fehler = o;
    }
  }
  if (fehler) throw new Error(fehler.error);
  if (!ergebnis) throw new Error("Der Abgleich hat kein Ergebnis geliefert.");
  return ergebnis;
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

// --- KI-Rollen (v40) ------------------------------------------------------
// Drei Rollen mit je eigenem Modell: Userkommunikation (Ausgabe an den Nutzer),
// Recherche (sucht/verdichtet), Kontextabgleich (gleicht Rechercheergebnisse mit Firmen- und
// Projektkontext ab). Jede KI-Aufgabe haengt an genau EINER Rolle; so laeuft die teure
// Nutzer-Ausgabe ueber Claude, die interne Recherche/Abgleich lokal ueber DeepSeek R1.
export const ROLLEN = ["userkomm", "recherche", "kontext"];

export const ROLLEN_META = {
  userkomm:  { name: "Userkommunikation", sub: "Texte, die der Nutzer sieht (Hooks, Skript, Caption, Ideen, Plan)." },
  recherche: { name: "Recherche",         sub: "Sucht im Internet und verdichtet die Treffer." },
  kontext:   { name: "Kontextabgleich",   sub: "Gleicht Rechercheergebnisse mit Firmen- und Projektkontext ab." },
};

// Defaults laut Owner (12.09.2026): Nutzer-Ausgabe ueber Claude/Abo, Recherche + Abgleich lokal.
export const ROLLEN_DEFAULT = {
  userkomm:  { provider: "claude", ollamaModel: "llama3.2",    claudeModell: "haiku" },
  recherche: { provider: "ollama", ollamaModel: "deepseek-r1", claudeModell: "haiku" },
  kontext:   { provider: "ollama", ollamaModel: "deepseek-r1", claudeModell: "haiku" },
};

export function rolleKonfig(rolle) {
  const def = ROLLEN_DEFAULT[rolle] || ROLLEN_DEFAULT.userkomm;
  try {
    const roh = localStorage.getItem(`cm-rolle-${rolle}`);
    return roh ? { ...def, ...JSON.parse(roh) } : { ...def };
  } catch { return { ...def }; }
}

export function setzeRolleKonfig(rolle, teil) {
  try {
    localStorage.setItem(`cm-rolle-${rolle}`, JSON.stringify({ ...rolleKonfig(rolle), ...teil }));
  } catch {}
}


// v41: Der Client schickt die Modell-Wahl ALLER drei Rollen mit; der Server waehlt je Pipeline-
// Schritt das Modell der jeweiligen Rolle (server.js laufePipeline).
function kiKonfig() {
  return {
    rollenModelle: {
      userkomm: rolleKonfig("userkomm"),
      recherche: rolleKonfig("recherche"),
      kontext: rolleKonfig("kontext"),
    },
  };
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
      // v51: echte Stufe des Laufs (kontext/modell-laedt/generiert/web-treffer/fertig/fehler)
      else if (o.t === "stufe") onEreignis({ stufe: o });
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
    S.plan = plan; // v90: Kopfzeile und Wochenstatistik messen gegen den zuletzt gelesenen Plan
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

  // Belegt ist jedes Upload-Datum einer NICHT-schwebenden Karte — schwebende Karten selbst
  // duerfen sich nicht gegenseitig blockieren, bevor sie neu verteilt sind.
  const belegt = belegteTermine(S.cards, new Set(schwebend.map((c) => c.id)));

  let geaendert = false;
  for (const k of schwebend) {
    // v89: Format der Karte + machbarer Vorlauf, dieselbe Regel wie Kachel und Kontextmenue.
    const { slot: frei } = naechsterFreierUpload({ plan, card: k, drehtermine: S.drehtermine, belegt });
    if (!frei) continue; // kein passender Slot — Datum bleibt stehen
    belegt.add(slotSchluessel(frei.datum, frei.uhrzeit));
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
  autoSync(t.id, "all"); // sofort in Kalender + Tasks (Erst-Einladung mailt, falls Teilnehmer)
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

// Ordnet eine Karte einem Drehtermin zu. Liefert {ok, warnung} bei Erfolg; {ok:false, grund} wenn der
// Termin zu spaet liegt (v70-Block). warnung = Termin ausserhalb des empfohlenen Fensters (keine Sperre).
export function karteZuTermin(karteId, terminId) {
  const k = karte(karteId);
  const t = drehtermin(terminId);
  if (!k || !t) return { ok: false };
  // v70-Block (Owner 25.09.2026): ein zu spaeter Drehtermin ist NICHT zuweisbar — der Drehtag muss so
  // weit vor dem Schnitt liegen, dass die Karte GRUEN in den Schnitt rutscht (spaetesterDreh). Ohne
  // Uploaddatum ist die Grenze nicht rechenbar → keine Sperre. Greift je Karte (eigener Upload).
  const grenze = spaetesterDreh((k.dates || {}).upload);
  if (grenze && t.datum && t.datum > grenze) {
    return {
      ok: false,
      grund: `Der Drehtermin am ${deutschesDatum(t.datum)} liegt zu spaet — spaetestens am ${deutschesDatum(grenze)}, sonst geht die Karte schon mit gelbem Punkt in den Schnitt.`,
    };
  }
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
export async function gcalSync(terminId, { mailen = "none" } = {}) {
  const t = drehtermin(terminId);
  if (!t) return null;
  // Volle Karten mitschicken: der Server loest daraus je Projekt den Drive-Ordner-Link auf.
  const karten = (t.karteIds || []).map((id) => karte(id)).filter(Boolean);
  const r = await hole("/api/gcal/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      termin: { datum: t.datum, zeit: t.zeit, ort: t.ort, titel: t.titel, teilnehmer: t.teilnehmer || [] },
      karten,
      eventId: t.gcalEventId || "",
      taskId: t.gtaskId || "",
      mailen, // "all" = Google mailt (Einladung/neuer Teilnehmer), "none" = still (Karten/Detail)
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
export function autoSync(terminId, mailen = "none") {
  if (!an("gcal-autosync")) return; // Workflow "gcal-autosync" (v26)
  if (!S.googleVerbunden || !terminId) return;
  const prev = syncInFlight.get(terminId) || Promise.resolve();
  // v55: `imHintergrund` faengt den Fehler ab und MELDET ihn sichtbar (frueher: `.catch(()=>{})`,
  // still verschluckt). Weiter serialisiert je Termin und nicht blockierend.
  const next = prev.catch(() => {})
    .then(() => imHintergrund(() => gcalSync(terminId, { mailen }), { was: "Der Kalender/Tasks-Abgleich" }))
    .finally(() => { if (syncInFlight.get(terminId) === next) syncInFlight.delete(terminId); });
  syncInFlight.set(terminId, next);
}

// Loescht Event + Task eines Termins (beim Loeschen auf dem Board). Nicht blockierend; ein
// Fehlschlag wird jetzt sichtbar gemeldet (v55) statt still verschluckt — ein verwaister
// Kalender-Eintrag blieb sonst unbemerkt.
export function gcalLoeschen(t) {
  if (!an("gcal-autosync")) return; // Workflow "gcal-autosync" (v26)
  if (!S.googleVerbunden || !t || (!t.gcalEventId && !t.gtaskId)) return;
  return imHintergrund(() => hole("/api/gcal/loeschen", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventId: t.gcalEventId || "", taskId: t.gtaskId || "" }),
  }), { was: "Das Loeschen des Kalender-Eintrags" });
}

// --- Drehtermin-Teilnehmer (v44) ------------------------------------------

// Mail des verbundenen Kontos, lazy geladen + gecacht (Organisator-Zeile im UI).
export async function kontoMail() {
  if (S.googleKonto != null) return S.googleKonto;
  try { S.googleKonto = (await hole("/api/gcal/konto")).email || ""; } catch { S.googleKonto = ""; }
  return S.googleKonto;
}

function normMail(m) { return String(m || "").trim().toLowerCase(); }

// Teilnehmer hinzufuegen/entfernen -> Aenderung an der Teilnehmerliste mailt (all).
export function teilnehmerHinzufuegen(terminId, mail) {
  const t = drehtermin(terminId);
  mail = normMail(mail);
  if (!t || !mail) return false;
  if (!Array.isArray(t.teilnehmer)) t.teilnehmer = [];
  if (t.teilnehmer.includes(mail)) return false;
  t.teilnehmer.push(mail);
  speichere();
  zeichne();
  autoSync(terminId, "all"); // neuer Teilnehmer -> Google verschickt die Einladung
  return true;
}
export function teilnehmerEntfernen(terminId, mail) {
  const t = drehtermin(terminId);
  if (!t) return;
  t.teilnehmer = (t.teilnehmer || []).filter((m) => m !== normMail(mail));
  speichere();
  zeichne();
  autoSync(terminId, "all"); // Absage an den Entfernten
}

// Personen-Liste (Team) lebt in den Defaults.
export function personen() {
  return (S.defaults && Array.isArray(S.defaults.personen)) ? S.defaults.personen : [];
}
export async function personMerken(name, email) {
  email = normMail(email);
  if (!email) return;
  const liste = personen().filter((p) => normMail(p.email) !== email);
  liste.push({ name: String(name || "").trim(), email });
  await speichereDefaults({ personen: liste });
}
export async function personLoeschen(email) {
  await speichereDefaults({ personen: personen().filter((p) => normMail(p.email) !== normMail(email)) });
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
    if (Array.isArray(d.personen)) S.defaults.personen = d.personen;
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
    if (Array.isArray(ergebnis.defaults.personen)) S.defaults.personen = ergebnis.defaults.personen;
  }
  return ergebnis;
}
