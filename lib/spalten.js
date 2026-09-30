// Spalten-Wahrheit in Drive (v17b). "Anzeigename frei, Logik-ID fest":
//
//   System (AI only)/spalten.json  = [{ id, name, ordner, order, system }]  (die Spalten-Wahrheit)
//   <Spaltenordner>/.phase         = verstecktes Marker-Dotfile mit der stabilen Phasen-ID
//
// Die stabile ID (und ihre gesamte Logik in pipeline.js) bleibt; Drive bestimmt Anzeigename,
// Ordnername und Reihenfolge. Der `.phase`-Marker haelt die Identitaet eines Ordners fest, sodass
// ein von Hand in Drive umbenannter Ordner beim Abgleich wiedererkannt wird (Rueckwaerts-Richtung).
// Vorwaerts: eine Umbenennung im Board benennt den Drive-Ordner mit (moveDir, server-seitig).

import { createHash } from "node:crypto";
import * as drive from "./drive.js";
import { SYSTEM_ORDNER, pfadstueckOk, slug, PHASEN } from "./pipeline.js";

const CONFIG_PFAD = `${SYSTEM_ORDNER}/spalten.json`;
const MARKER = ".phase";

// Reduzierte Speicherform: nur die Felder, die Drive bestimmt. Die Logik-Felder
// (satz/termin/weiter) kommen beim Mischen aus PHASEN und werden NICHT gespeichert.
export function alsConfig(spalten) {
  return (spalten || []).map((s) => ({
    id: s.id, name: s.name, ordner: s.ordner, order: s.order, system: !!s.system,
  }));
}

export async function leseVonDrive() {
  try { return JSON.parse(await drive.readFile(CONFIG_PFAD)); } catch { return null; }
}

export async function schreibeNachDrive(spalten) {
  await drive.mkdir(SYSTEM_ORDNER);
  await drive.writeFile(CONFIG_PFAD, JSON.stringify(alsConfig(spalten), null, 2));
}

async function schreibeMarker(ordner, id) {
  try { await drive.mkdir(ordner); await drive.writeFile(`${ordner}/${MARKER}`, id + "\n"); } catch { /* Marker ist Kuer */ }
}
async function leseMarker(ordner) {
  try { return (await drive.readFile(`${ordner}/${MARKER}`)).trim(); } catch { return null; }
}

const elternVon = (ordner) => { const i = String(ordner).lastIndexOf("/"); return i < 0 ? "" : ordner.slice(0, i); };
const segmentFuer = (name) => (pfadstueckOk(name) ? name : slug(name));

// Neuer Ordnerpfad aus altem Pfad + neuem Anzeigenamen (die Eltern bleiben, nur das letzte Stueck aendert sich).
export function neuerOrdner(altOrdner, name) {
  const eltern = elternVon(altOrdner);
  const seg = segmentFuer(name);
  return eltern ? `${eltern}/${seg}` : seg;
}

// VORWAERTS: Umbenennung im Board -> Drive. Benennt den Ordner um (moveDir zieht den ganzen
// Unterbaum mit), setzt den Marker, aktualisiert die Config und schreibt sie nach Drive.
export async function benenneUm(mergedSpalten, id, name) {
  const sp = mergedSpalten.find((s) => s.id === id);
  if (!sp) throw new Error(`Unbekannte Spalte: ${id}`);
  const alt = sp.ordner;
  const neu = neuerOrdner(alt, name);
  if (neu !== alt && (await drive.existiert(alt))) await drive.moveDir(alt, neu);
  sp.name = name;
  sp.ordner = neu;
  await schreibeMarker(neu, id);
  await schreibeNachDrive(mergedSpalten);
  return mergedSpalten;
}

// Die Eltern-Ordner, unter denen umbenennbare Phasen liegen (aus den Defaults abgeleitet).
// Praktisch ist das "In Bearbeitung"; Wurzel-Phasen (Videoauswertung, Verworfen) sind terminal.
function arbeitsEltern() {
  const set = new Set();
  for (const p of PHASEN) { const e = elternVon(p.ordner); if (e) set.add(e); }
  return [...set];
}

// RUECKWAERTS + Seed: liest die Marker unter den Arbeits-Eltern, erkennt von Hand umbenannte
// Ordner (Marker-ID != Config-Ordner) und zieht Anzeigename/Ordner nach. Stellt ausserdem sicher,
// dass jede existierende System-Spalte ihren Marker traegt (Seed beim ersten Lauf).
// v84: Alle Marker in EINEM rclone-Aufruf (md5sum) statt je Ordner list + cat. Der Inhalt eines
// Markers ist eine bekannte Phasen-ID, also verraet der Hash die ID. Liefert Map Ordner -> ID;
// ein Marker mit unbekanntem Hash (von Hand geaendert) wird einzeln gelesen. `null` = Drive
// nicht lesbar -> Aufrufer faellt auf den alten Einzelweg zurueck.
const MARKER_HASH = new Map();
for (const p of PHASEN) for (const inhalt of [p.id + "\n", p.id, p.id + "\r\n"]) {
  MARKER_HASH.set(createHash("md5").update(inhalt).digest("hex"), p.id);
}
async function alleMarker(mergedSpalten) {
  const muster = new Set(arbeitsEltern().map((e) => `/${e}/*/${MARKER}`));
  for (const sp of mergedSpalten) if (!elternVon(sp.ordner)) muster.add(`/*/${MARKER}`);
  // Tiefe = Eltern-Ebenen + Spaltenordner + Marker-Datei ("In Bearbeitung/Idee/.phase" = 3).
  const tiefe = Math.max(0, ...arbeitsEltern().map((e) => e.split("/").length)) + 2;
  let liste;
  try { liste = await drive.md5Liste("", [...muster], tiefe); } catch { return null; }
  const ordnerZuId = new Map();
  for (const { md5, pfad } of liste) {
    const ord = elternVon(pfad);
    const id = MARKER_HASH.get(md5) || (await leseMarker(ord));
    if (id) ordnerZuId.set(ord, id);
  }
  return ordnerZuId;
}

export async function reconcile(mergedSpalten, vorher = null) {
  const befunde = [];
  let geaendert = false;

  const markerMap = new Map(); // id -> tatsaechlicher Ordner in Drive (nur unter den Arbeits-Eltern)
  const markerDa = new Set(); // Ordner, die ihren Marker schon tragen (auch Wurzel-Spalten)
  const gebuendelt = await alleMarker(mergedSpalten);
  if (gebuendelt) {
    const eltern = new Set(arbeitsEltern());
    for (const [ord, id] of gebuendelt) {
      markerDa.add(ord);
      if (eltern.has(elternVon(ord))) markerMap.set(id, ord);
    }
  } else {
    for (const eltern of arbeitsEltern()) {
      let kinder = [];
      try { kinder = await drive.list(eltern, { dirsOnly: true }); } catch { continue; }
      for (const k of kinder) {
        const ord = `${eltern}/${k}`;
        const id = await leseMarker(ord);
        if (id) { markerMap.set(id, ord); markerDa.add(ord); }
      }
    }
  }

  for (const sp of mergedSpalten) {
    if (!sp.system) continue;
    const gefunden = markerMap.get(sp.id);
    if (gefunden && gefunden !== sp.ordner) {
      const alterName = sp.name;
      sp.ordner = gefunden;
      sp.name = gefunden.slice(gefunden.lastIndexOf("/") + 1);
      geaendert = true;
      befunde.push({ status: "hinweis", satz: `Spalte "${alterName}" wurde in Drive zu "${sp.name}" umbenannt — das Board folgt.` });
    }
    // Marker sicherstellen (Seed), wo der Ordner existiert — ohne ihn anzulegen. v84: Wurzel-
    // Spalten (Videoauswertung, Verworfen) standen nie in markerMap und bekamen deshalb bei JEDEM
    // Abgleich existiert+mkdir+rcat (~3,5 s je Spalte) — jetzt zaehlt jeder gefundene Marker.
    if (!markerMap.has(sp.id) && !markerDa.has(sp.ordner) && (await drive.existiert(sp.ordner))) await schreibeMarker(sp.ordner, sp.id);
  }

  // Config in Drive festschreiben (Seed/Update) — v84: nur wenn sie sich vom gelesenen Stand
  // unterscheidet; vorher schrieb jeder Abgleich mkdir+rcat (~3 s), auch ohne Aenderung.
  const unveraendert = vorher && JSON.stringify(alsConfig(vorher)) === JSON.stringify(alsConfig(mergedSpalten));
  if (!unveraendert) await schreibeNachDrive(mergedSpalten);
  return { spalten: mergedSpalten, befunde, geaendert };
}

// id -> ordner Map fuer den dynamischen Ordner-Resolver in projects.js.
export function ordnerMap(mergedSpalten) {
  const m = new Map();
  for (const s of mergedSpalten || []) m.set(s.id, s.ordner);
  return m;
}
