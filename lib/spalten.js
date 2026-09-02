// Spalten-Wahrheit in Drive (v17b). "Anzeigename frei, Logik-ID fest":
//
//   System (AI only)/spalten.json  = [{ id, name, ordner, order, system }]  (die Spalten-Wahrheit)
//   <Spaltenordner>/.phase         = verstecktes Marker-Dotfile mit der stabilen Phasen-ID
//
// Die stabile ID (und ihre gesamte Logik in pipeline.js) bleibt; Drive bestimmt Anzeigename,
// Ordnername und Reihenfolge. Der `.phase`-Marker haelt die Identitaet eines Ordners fest, sodass
// ein von Hand in Drive umbenannter Ordner beim Abgleich wiedererkannt wird (Rueckwaerts-Richtung).
// Vorwaerts: eine Umbenennung im Board benennt den Drive-Ordner mit (moveDir, server-seitig).

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
export async function reconcile(mergedSpalten) {
  const befunde = [];
  let geaendert = false;

  const markerMap = new Map(); // id -> tatsaechlicher Ordner in Drive
  for (const eltern of arbeitsEltern()) {
    let kinder = [];
    try { kinder = await drive.list(eltern, { dirsOnly: true }); } catch { continue; }
    for (const k of kinder) {
      const ord = `${eltern}/${k}`;
      const id = await leseMarker(ord);
      if (id) markerMap.set(id, ord);
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
    // Marker sicherstellen (Seed), wo der Ordner existiert — ohne ihn anzulegen.
    if (!markerMap.has(sp.id) && (await drive.existiert(sp.ordner))) await schreibeMarker(sp.ordner, sp.id);
  }

  await schreibeNachDrive(mergedSpalten); // Config in Drive festschreiben (Seed/Update)
  return { spalten: mergedSpalten, befunde, geaendert };
}

// id -> ordner Map fuer den dynamischen Ordner-Resolver in projects.js.
export function ordnerMap(mergedSpalten) {
  const m = new Map();
  for (const s of mergedSpalten || []) m.set(s.id, s.ordner);
  return m;
}
