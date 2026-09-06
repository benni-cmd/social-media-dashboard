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

// --- Eingebaute Drive-Quellen (v34) -----------------------------------------------------------
//
// Vor v34 las server.js diese beiden Ordner an den KI-Aufrufen vorbei am Tab ein — unsichtbar.
// Jetzt sind sie normale Quellen: sie stehen im Tab, zeigen ihren Zustand und lassen sich
// abschalten. Loeschen geht nicht, sie gehoeren zur Drive-Konvention (docs/drive-convention.md).
export const EINGEBAUT_GLOBAL = {
  id: "eingebaut-global",
  art: "drive-ordner",
  pfad: "Kontext/_global",
  eingebaut: true,
  satz: "Drive-Ordner der Konvention — gilt fuer jeden Text.",
};

// Die reihenbezogene Quelle entsteht erst beim Aufruf, weil sie von der Karte abhaengt.
const eingebautReihe = (serie) => ({
  id: "eingebaut-reihe",
  art: "drive-ordner",
  pfad: `Kontext/${serie}`,
  eingebaut: true,
  satz: "Drive-Ordner der Reihe — gilt nur fuer Karten dieser Reihe.",
});

const LEER = () => ({ firma: { text: "", quellen: [] }, projekte: [], eingebaut: { global: true, reihe: true } });

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
      eingebaut: {
        global: roh.eingebaut?.global !== false,
        reihe: roh.eingebaut?.reihe !== false,
      },
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
//
// `gesehen` ist ein Set getrimmter Dateiinhalte ueber ALLE Bloecke hinweg (v34): kommt dieselbe
// Datei ueber zwei Wege — etwa als eingebaute Drive-Quelle UND als selbst eingetragene —, zaehlt
// sie einmal. Verglichen wird der Inhalt, nicht der Pfad: zwei Schreibweisen koennen denselben
// Ordner meinen, aber gleicher Text ist gleicher Text.
async function blockText(block, ueberschrift, quellen, gesehen) {
  const teile = [];
  const text = (block?.text || "").trim();
  if (text && !gesehen.has(text)) {
    gesehen.add(text);
    teile.push(text);
  }
  for (const q of quellen || []) {
    const gelesen = await leseQuelle(q);
    for (const d of gelesen.dateien) {
      const inhalt = d.text.trim();
      if (!inhalt || gesehen.has(inhalt)) continue;
      gesehen.add(inhalt);
      teile.push(`# ${d.name} (${q.pfad})\n${inhalt}`);
    }
  }
  if (!teile.length) return "";
  let zusammen = teile.join("\n\n");
  let gekuerzt = false;
  if (zusammen.length > ZEICHEN_MAX) {
    zusammen = zusammen.slice(0, ZEICHEN_MAX);
    gekuerzt = true;
  }
  return `${ueberschrift}\n${zusammen}${gekuerzt ? "\n[… gekuerzt]" : ""}`;
}

// Die Quellen des Firmenblocks, inklusive der eingebauten Drive-Ordner (v34).
// `serie` fuegt den reihenbezogenen Ordner hinzu — ohne Reihe entfaellt er.
export function firmenQuellen(stand, serie = "") {
  const raus = [];
  if (stand.eingebaut?.global !== false) raus.push(EINGEBAUT_GLOBAL);
  if (serie && stand.eingebaut?.reihe !== false) raus.push(eingebautReihe(serie));
  return raus.concat(stand.firma.quellen || []);
}

// Der gesammelte Kontext, wie er in die Prompts geht.
//   serie      — Reihe der Karte; schaltet den Drive-Ordner "Kontext/<reihe>" dazu
//   projektId  — waehlt EIN Projekt; ohne Angabe kommen alle aktiven
export async function sammle({ serie = "", projektId = null } = {}) {
  const stand = await lies();
  const gesehen = new Set();

  const firma = await blockText(
    stand.firma,
    "Unternehmens- und Markenkontext:",
    firmenQuellen(stand, serie),
    gesehen
  );

  const gewaehlt = projektId
    ? stand.projekte.filter((p) => p.id === projektId)
    : stand.projekte.filter((p) => p.aktiv !== false);

  const stuecke = [];
  for (const p of gewaehlt) {
    const t = await blockText(p, `Projektkontext „${p.name}":`, p.quellen, gesehen);
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
  const mitStand = async (block, extraQuellen = []) => ({
    text: block.text,
    quellen: await Promise.all(
      [...extraQuellen, ...(block.quellen || [])].map(async (q) => {
        // Eine abgeschaltete Quelle wird nicht gelesen — das spart bei Drive einen rclone-Aufruf
        // und die Wartezeit, die daran haengt. Sie bleibt trotzdem in der Liste, sonst gaebe es
        // keinen Weg, sie wieder einzuschalten.
        const g = q.an === false ? { ...q, anzahl: 0, zeichen: 0, fehler: null } : await leseQuelle(q);
        return {
          id: q.id,
          art: g.art,
          pfad: g.pfad,
          anzahl: g.anzahl,
          zeichen: g.zeichen,
          fehler: g.fehler,
          an: q.an !== false,
          // v34: eingebaute Quellen sind nicht loeschbar, nur abschaltbar — das UI braucht die
          // Unterscheidung, sonst bietet es einen Knopf an, der nichts tun darf.
          eingebaut: !!q.eingebaut,
          satz: q.satz || "",
        };
      })
    ),
  });
  // Die eingebaute globale Drive-Quelle erscheint im Firmenblock — immer, auch abgeschaltet,
  // sonst gaebe es keinen Weg zurueck. Die reihenbezogene taucht hier nicht auf: sie haengt an
  // der Karte und wird erst beim Aufruf gebildet.
  const eingebauteQuellen = [{ ...EINGEBAUT_GLOBAL, an: stand.eingebaut?.global !== false }];
  return {
    eingebaut: stand.eingebaut,
    firma: await mitStand(stand.firma, eingebauteQuellen),
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

// Schaltet eine eingebaute Drive-Quelle an oder aus (v34). `welche` ist "global" oder "reihe".
export async function setzeEingebaut(welche, an) {
  if (welche !== "global" && welche !== "reihe") throw new Error(`Unbekannte eingebaute Quelle: ${welche}`);
  const stand = await lies();
  stand.eingebaut = { ...stand.eingebaut, [welche]: !!an };
  await schreib(stand);
  return uebersicht();
}

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
