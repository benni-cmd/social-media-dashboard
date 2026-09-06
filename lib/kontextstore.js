// Unternehmens- und Projektkontext (v33).
//
// Was die KI ueber die Firma wissen soll, fuer die geschrieben wird — als Freitext und als
// Verweis auf vorhandene Dateien, lokal oder in Drive. Bisher steckte dieses Wissen fest im
// Marken-Vorspann (lib/ai.js) oder unsichtbar in Drive (server.js, leseKontext); hier ist es
// sichtbar, aenderbar und pro Projekt trennbar.
//
// Form der Datei (data/kontext.json):
//   {
//     "firma":    { "text": "…", "quellen": [ … ] },
//     "projekte": [ { "id": "prj-…", "name": "…", "text": "…", "quellen": [ … ], "aktiv": true } ]
//   }
// Eine Quelle:
//   { "id": "q-…", "art": "lokal-datei"|"lokal-ordner"|"drive-datei"|"drive-ordner", "pfad": "…" }
//
// Gelesen wird NUR Text (.md/.txt/.markdown) — dieselbe Regel wie beim Drive-Kontext. Ordner
// eine Ebene tief, nicht rekursiv: ein versehentlich gewaehlter Projektordner wuerde sonst
// jeden Prompt sprengen.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import * as drive from "./drive.js";

let PFAD = "data/kontext.json";

export function setzePfad(p) {
  PFAD = p;
}

// Obergrenze je Block (Firma bzw. Projekt). Was darueber liegt, wird abgeschnitten — und das
// wird im UI auch gesagt, statt still zu verschwinden.
export const ZEICHEN_MAX = 60000;

const TEXT_ENDUNGEN = new Set([".md", ".txt", ".markdown"]);
const istText = (name) => TEXT_ENDUNGEN.has(extname(name).toLowerCase());

const ARTEN = new Set(["lokal-datei", "lokal-ordner", "drive-datei", "drive-ordner"]);

const LEER = () => ({ firma: { text: "", quellen: [] }, projekte: [] });

function neueId(praefix) {
  return `${praefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function sauberQuelle(q) {
  if (!q || !ARTEN.has(q.art) || !q.pfad) return null;
  return { id: q.id || neueId("q"), art: q.art, pfad: String(q.pfad).trim() };
}

function sauberBlock(b) {
  return {
    text: typeof b?.text === "string" ? b.text : "",
    quellen: Array.isArray(b?.quellen) ? b.quellen.map(sauberQuelle).filter(Boolean) : [],
  };
}

export async function lies() {
  try {
    const roh = JSON.parse(await readFile(PFAD, "utf8"));
    return {
      firma: sauberBlock(roh.firma),
      projekte: (Array.isArray(roh.projekte) ? roh.projekte : []).map((p) => ({
        id: p.id || neueId("prj"),
        name: typeof p.name === "string" && p.name.trim() ? p.name : "Ohne Namen",
        aktiv: p.aktiv !== false,
        ...sauberBlock(p),
      })),
    };
  } catch {
    return LEER();
  }
}

async function schreib(stand) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(PFAD, JSON.stringify(stand, null, 2), "utf8");
}

// --- Quellen lesen ---------------------------------------------------------------------------
//
// Jede Quelle liefert { dateien: [{name, text}], fehler } — ein Fehler bei einer Quelle darf
// den Rest nie verhindern. Kontext ist Beiwerk: lieber weniger Kontext als kein KI-Aufruf.

async function lokaleDatei(pfad) {
  const text = await readFile(pfad, "utf8");
  return [{ name: basename(pfad), text }];
}

async function lokalerOrdner(pfad) {
  const eintraege = await readdir(pfad);
  const raus = [];
  for (const name of eintraege) {
    if (!istText(name)) continue;
    try {
      const s = await stat(join(pfad, name));
      if (!s.isFile()) continue;
      raus.push({ name, text: await readFile(join(pfad, name), "utf8") });
    } catch {
      /* einzelne Datei unlesbar — der Rest zaehlt trotzdem */
    }
  }
  return raus;
}

async function driveDatei(pfad) {
  return [{ name: basename(pfad), text: await drive.readFile(pfad) }];
}

async function driveOrdner(pfad) {
  const dateien = await drive.list(pfad, { filesOnly: true });
  const raus = [];
  for (const name of dateien) {
    if (!istText(name)) continue;
    try {
      raus.push({ name, text: await drive.readFile(`${pfad}/${name}`) });
    } catch {
      /* einzelne Datei unlesbar */
    }
  }
  return raus;
}

// Liest EINE Quelle und beschreibt, was dabei herauskam — das UI zeigt genau das an.
export async function leseQuelle(q) {
  const quelle = sauberQuelle(q);
  if (!quelle) return { ...q, fehler: "Unbekannte Art oder leerer Pfad.", dateien: [], zeichen: 0 };
  try {
    let dateien;
    if (quelle.art === "lokal-datei") dateien = await lokaleDatei(quelle.pfad);
    else if (quelle.art === "lokal-ordner") dateien = await lokalerOrdner(quelle.pfad);
    else if (quelle.art === "drive-datei") dateien = await driveDatei(quelle.pfad);
    else dateien = await driveOrdner(quelle.pfad);

    dateien = dateien.filter((d) => (d.text || "").trim());
    const zeichen = dateien.reduce((n, d) => n + d.text.length, 0);
    return { ...quelle, dateien, anzahl: dateien.length, zeichen, fehler: null };
  } catch (e) {
    return { ...quelle, dateien: [], anzahl: 0, zeichen: 0, fehler: e.message };
  }
}

// Baut den Text EINES Blocks: erst das Freitextfeld, dann die Dateien der Quellen.
async function blockText(block, ueberschrift) {
  const teile = [];
  if ((block.text || "").trim()) teile.push(block.text.trim());
  for (const q of block.quellen || []) {
    const gelesen = await leseQuelle(q);
    for (const d of gelesen.dateien) {
      teile.push(`# ${d.name} (${q.pfad})\n${d.text.trim()}`);
    }
  }
  if (!teile.length) return "";
  let text = teile.join("\n\n");
  let gekuerzt = false;
  if (text.length > ZEICHEN_MAX) {
    text = text.slice(0, ZEICHEN_MAX);
    gekuerzt = true;
  }
  return `${ueberschrift}\n${text}${gekuerzt ? "\n[… gekuerzt]" : ""}`;
}

// Der gesammelte Kontext, wie er in die Prompts geht.
// `projektId` waehlt EIN Projekt; ohne Angabe kommen alle aktiven Projekte.
export async function sammle(projektId = null) {
  const stand = await lies();

  const firma = await blockText(stand.firma, "Unternehmens- und Markenkontext:");

  const gewaehlt = projektId
    ? stand.projekte.filter((p) => p.id === projektId)
    : stand.projekte.filter((p) => p.aktiv !== false);

  const stuecke = [];
  for (const p of gewaehlt) {
    const t = await blockText(p, `Projektkontext „${p.name}":`);
    if (t) stuecke.push(t);
  }

  return {
    firmenkontext: firma ? `\n\n${firma}` : "",
    projektkontext: stuecke.length ? `\n\n${stuecke.join("\n\n")}` : "",
  };
}

// --- Das, was der Einstellungs-Tab zeichnet ---------------------------------------------------

export async function uebersicht() {
  const stand = await lies();
  const mitStand = async (block) => ({
    text: block.text,
    quellen: await Promise.all(
      (block.quellen || []).map(async (q) => {
        const g = await leseQuelle(q);
        return { id: g.id, art: g.art, pfad: g.pfad, anzahl: g.anzahl, zeichen: g.zeichen, fehler: g.fehler };
      })
    ),
  });
  return {
    firma: await mitStand(stand.firma),
    projekte: await Promise.all(
      stand.projekte.map(async (p) => ({ id: p.id, name: p.name, aktiv: p.aktiv, ...(await mitStand(p)) }))
    ),
    // Der Drive-Zustand wird hier bewusst NICHT geprueft: `drive.erreichbar()` ruft rclone mit
    // 30 Sekunden Zeitgrenze, das wuerde den Tab bei jedem Oeffnen blockieren. Das UI nimmt den
    // ohnehin vorhandenen Weg ueber /api/drive/status.
    zeichenMax: ZEICHEN_MAX,
  };
}

// --- Schreiben ---------------------------------------------------------------------------------

export async function setzeFirmaText(text) {
  const stand = await lies();
  stand.firma.text = typeof text === "string" ? text : "";
  await schreib(stand);
  return uebersicht();
}

export async function projektAnlegen(name = "Neues Projekt") {
  const stand = await lies();
  stand.projekte.push({ id: neueId("prj"), name: String(name).trim() || "Neues Projekt", text: "", quellen: [], aktiv: true });
  await schreib(stand);
  return uebersicht();
}

export async function projektAendern(id, { name, text, aktiv } = {}) {
  const stand = await lies();
  const p = stand.projekte.find((x) => x.id === id);
  if (!p) throw new Error(`Unbekanntes Projekt: ${id}`);
  if (typeof name === "string" && name.trim()) p.name = name.trim();
  if (typeof text === "string") p.text = text;
  if (typeof aktiv === "boolean") p.aktiv = aktiv;
  await schreib(stand);
  return uebersicht();
}

export async function projektLoeschen(id) {
  const stand = await lies();
  stand.projekte = stand.projekte.filter((p) => p.id !== id);
  await schreib(stand);
  return uebersicht();
}

// `ziel` ist "firma" oder eine Projekt-Id.
function blockVon(stand, ziel) {
  if (ziel === "firma") return stand.firma;
  const p = stand.projekte.find((x) => x.id === ziel);
  if (!p) throw new Error(`Unbekanntes Ziel: ${ziel}`);
  return p;
}

export async function quelleHinzufuegen(ziel, quelle) {
  const sauber = sauberQuelle(quelle);
  if (!sauber) throw new Error("Quelle braucht eine bekannte Art und einen Pfad.");
  const stand = await lies();
  const block = blockVon(stand, ziel);
  block.quellen = block.quellen || [];
  block.quellen.push(sauber);
  await schreib(stand);
  return uebersicht();
}

export async function quelleEntfernen(ziel, quelleId) {
  const stand = await lies();
  const block = blockVon(stand, ziel);
  block.quellen = (block.quellen || []).filter((q) => q.id !== quelleId);
  await schreib(stand);
  return uebersicht();
}
