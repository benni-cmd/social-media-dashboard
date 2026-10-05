// v107 — Kampagnen des Redaktionsplans mit je EINER Tabelle in Drive (Owner 05.10.2026).
//
// Die Kampagnen-Liste steht wie bisher im Plan (`System (AI only)/redaktionsplan.json`,
// `kampagnen: [{id, name, aktiv, tabelle}]`). Ihre Daten stehen menschenlesbar als CSV unter
// `Kampagnen/<Name>.csv` — gleicher Dialekt wie die KPI-Tabellen (UTF-8 mit BOM, Semikolon),
// oeffnet per Doppelklick in Sheets/Excel. Eine Zeile = ein Anlass (Feiertag, Aktionstag, Thema).
//
// Die erste Spalte des Boards zeigt einen Knopf je Anlass, der in den naechsten 60 Tagen liegt
// und noch kein Projekt hat. Entwurf und Belege: docs/packages/v107-anlass-kalender.md
//
// Rein bis auf die Funktionen, die `drive` als Argument bekommen — so laeuft der Selbsttest
// ohne Drive (tools/kampagnen-selbsttest.mjs).

import { ZIELE, CONTENTTYPEN, klartext } from "./pipeline.js";

export const ORDNER = "Kampagnen";
export const FENSTER_TAGE = 60;
const BOM = "﻿";
const SPALTEN = ["Anlass", "Datum", "Themen", "Ziel", "Zielgruppe", "Format", "Quelle"];
const KOPF = SPALTEN.join(";");

export const tabellePfad = (name) => `${ORDNER}/${klartext(name || "Kampagne")}.csv`;

// --- Datum ------------------------------------------------------------------

const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const utc = (j, m, t) => new Date(Date.UTC(j, m - 1, t));
const plusTage = (d, n) => new Date(d.getTime() + n * 86400000);

// Ostersonntag (gregorianisch, anonymer Algorithmus nach Meeus/Jones/Butcher — gleichwertig zur
// Gaussschen Osterformel).
export function ostersonntag(jahr) {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(jahr, monat, tag);
}

const MONATE = ["januar", "februar", "maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const WOCHENTAGE = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const ohneUmlaut = (s) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

// n-ter (1..5) bzw. letzter (n = -1) Wochentag eines Monats.
function nterWochentag(jahr, monat, wt, n) {
  if (n > 0) {
    const erster = utc(jahr, monat, 1);
    const versatz = (wt - erster.getUTCDay() + 7) % 7;
    const d = plusTage(erster, versatz + (n - 1) * 7);
    return d.getUTCMonth() === monat - 1 ? d : null;
  }
  const letzter = utc(jahr, monat + 1, 0);
  return plusTage(letzter, -((letzter.getUTCDay() - wt + 7) % 7));
}

// Eine Datums-Regel in Menschenform -> Funktion(jahr) -> Date|null, plus `einmalig` (Jahr fest).
// Formen: "18.03." · "30.07.2026" · "Ostern" · "2. Sonntag im Mai" · "letzter Samstag im November",
// jede optional mit "+N"/"-N" Tagen ("Ostern+39", "4. Donnerstag im November+1").
export function leseRegel(regel) {
  const roh = ohneUmlaut(String(regel || "").trim());
  if (!roh) return { fehler: "Das Datum fehlt." };
  const ms = roh.match(/^(.*?)\s*([+-])\s*(\d{1,3})\s*(tage?)?$/);
  const basis = ms && !/^\d{1,2}\.\d{1,2}\.\d{0,4}$/.test(roh) ? ms[1].trim() : roh;
  const versatz = ms && basis !== roh ? (ms[2] === "-" ? -1 : 1) * Number(ms[3]) : 0;
  const mit = (f) => (j) => { const d = f(j); return d ? plusTage(d, versatz) : null; };

  let m;
  if ((m = basis.match(/^(\d{1,2})\.(\d{1,2})\.$/))) {
    const t = +m[1], mo = +m[2];
    if (mo < 1 || mo > 12 || t < 1 || t > 31) return { fehler: `„${regel}“ ist kein gültiges Datum.` };
    return { berechne: mit((j) => utc(j, mo, t)) };
  }
  if ((m = basis.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
    const t = +m[1], mo = +m[2], j0 = +m[3];
    if (mo < 1 || mo > 12 || t < 1 || t > 31) return { fehler: `„${regel}“ ist kein gültiges Datum.` };
    return { berechne: mit((j) => (j === j0 ? utc(j0, mo, t) : null)), einmalig: j0 };
  }
  if (basis === "ostern" || basis === "ostersonntag") return { berechne: mit(ostersonntag) };
  if ((m = basis.match(/^(\d)\.\s*(\S+)\s+im\s+(\S+)$/)) || (m = basis.match(/^(letzte[rn]?)\s+(\S+)\s+im\s+(\S+)$/))) {
    const n = /^letzte/.test(m[1]) ? -1 : +m[1];
    const wt = WOCHENTAGE.indexOf(m[2]);
    const mo = MONATE.indexOf(m[3]) + 1;
    if (wt < 0 || mo < 1 || n === 0 || n > 5) return { fehler: `„${regel}“ verstehe ich nicht (Wochentag oder Monat unbekannt).` };
    return { berechne: mit((j) => nterWochentag(j, mo, wt, n)) };
  }
  return { fehler: `„${regel}“ verstehe ich nicht. Erlaubt: 18.03. · 30.07.2026 · Ostern+39 · 2. Sonntag im Mai · letzter Samstag im November.` };
}

// Naechstes Datum (ISO) am oder nach `heute` (ISO), oder null (einmalig und vorbei).
export function naechstesDatum(regel, heute) {
  const r = leseRegel(regel);
  if (r.fehler) return { fehler: r.fehler };
  const h = new Date(heute + "T00:00:00Z");
  const j0 = h.getUTCFullYear();
  for (const j of [j0, j0 + 1]) {
    const d = r.berechne(j);
    if (d && d >= h) return { datum: iso(d) };
  }
  return { datum: null, vorbei: !!r.einmalig };
}

const tageBis = (heute, datum) => Math.round((Date.parse(datum + "T00:00:00Z") - Date.parse(heute + "T00:00:00Z")) / 86400000);

// --- CSV --------------------------------------------------------------------

// Semikolon-CSV mit Anfuehrungszeichen (wie Excel/Sheets sie schreiben). Liefert Zeilen als Arrays.
// Ein in Google Sheets gespeichertes CSV kommt mit Komma statt Semikolon zurueck: enthaelt die
// Kopfzeile kein Semikolon, aber Kommas, gilt Komma als Trenner.
export function leseCsv(text) {
  const s = String(text || "").replace(/^\uFEFF/, "");
  const kopf = s.split(/\r?\n/)[0] || "";
  const trenner = !kopf.includes(";") && kopf.includes(",") ? "," : ";";
  const zeilen = [];
  let zeile = [], feld = "", inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"' && s[i + 1] === '"') { feld += '"'; i++; }
      else if (ch === '"') inQ = false;
      else feld += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === trenner) { zeile.push(feld); feld = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      zeile.push(feld); zeilen.push(zeile); zeile = []; feld = "";
    } else feld += ch;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen.filter((z) => z.some((f) => f.trim()));
}
const csvFeld = (f) => { const s = f == null ? "" : String(f); return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const schreibeCsv = (zeilen) => BOM + [KOPF, ...zeilen.map((z) => SPALTEN.map((sp) => csvFeld(z[sp])).join(";"))].join("\r\n") + "\r\n";

const zielId = (wert) => {
  const w = ohneUmlaut(String(wert || "").trim());
  if (!w) return "";
  const z = ZIELE.find((x) => x.id === w || ohneUmlaut(x.name) === w || ohneUmlaut(x.name).startsWith(w));
  return z ? z.id : "";
};
const formatId = (wert) => {
  const w = ohneUmlaut(String(wert || "").trim());
  if (!w) return "";
  const t = CONTENTTYPEN.find((x) => x.id === w || ohneUmlaut(x.name) === w || ohneUmlaut(x.format) === w);
  return t ? t.id : "";
};

// Tabellentext -> { eintraege: [{anlass, regel, themen, ziel, zielgruppe, format, quelle, zeile}], befunde: [Satz] }.
export function leseTabelle(text) {
  const zeilen = leseCsv(text);
  if (!zeilen.length) return { eintraege: [], befunde: [] };
  const kopf = zeilen[0].map((h) => ohneUmlaut(h.trim()));
  const idx = Object.fromEntries(SPALTEN.map((sp) => [sp, kopf.indexOf(ohneUmlaut(sp))]));
  const befunde = [];
  if (idx.Anlass < 0 || idx.Datum < 0) return { eintraege: [], befunde: ["Die Kopfzeile braucht mindestens die Spalten „Anlass“ und „Datum“."] };
  const wert = (z, sp) => (idx[sp] >= 0 ? (z[idx[sp]] || "").trim() : "");
  const eintraege = [];
  zeilen.slice(1).forEach((z, i) => {
    const anlass = wert(z, "Anlass");
    if (!anlass) return;
    const zielRoh = wert(z, "Ziel"), formatRoh = wert(z, "Format");
    const e = {
      anlass, regel: wert(z, "Datum"), themen: wert(z, "Themen"), zielgruppe: wert(z, "Zielgruppe"),
      ziel: zielId(zielRoh), format: formatId(formatRoh), quelle: wert(z, "Quelle"), zeile: i + 2,
    };
    if (zielRoh && !e.ziel) befunde.push(`Zeile ${e.zeile} („${anlass}“): Ziel „${zielRoh}“ unbekannt — erlaubt: ${ZIELE.map((x) => x.name).join(", ")}.`);
    if (formatRoh && !e.format) befunde.push(`Zeile ${e.zeile} („${anlass}“): Format „${formatRoh}“ unbekannt — erlaubt: ${CONTENTTYPEN.map((x) => x.name).join(", ")}.`);
    eintraege.push(e);
  });
  return { eintraege, befunde };
}

// --- Anstehend --------------------------------------------------------------

// Alle Anlaesse aktiver Kampagnen, die in den naechsten `fenster` Tagen liegen (heute eingeschlossen).
// `tabellen`: Map kampagneId -> Tabellentext (oder {fehler}). Ob es schon ein Projekt gibt, entscheidet
// der Aufrufer am `schluessel` (Karten tragen ihn in `card.anlass.schluessel`).
export function anstehende({ kampagnen = [], tabellen = {}, heute, fenster = FENSTER_TAGE }) {
  const anstehend = [], befunde = [];
  for (const k of kampagnen) {
    if (!k || k.aktiv === false) continue;
    const t = tabellen[k.id];
    if (t == null) continue;
    if (t.fehler) { befunde.push(`Kampagne „${k.name}“: Tabelle nicht lesbar (${t.fehler}).`); continue; }
    const { eintraege, befunde: b } = leseTabelle(t);
    befunde.push(...b.map((s) => `Kampagne „${k.name}“, ${s}`));
    for (const e of eintraege) {
      const n = naechstesDatum(e.regel, heute);
      if (n.fehler) { befunde.push(`Kampagne „${k.name}“, Zeile ${e.zeile} („${e.anlass}“): ${n.fehler}`); continue; }
      if (!n.datum) continue;
      const tage = tageBis(heute, n.datum);
      if (tage > fenster) continue;
      anstehend.push({
        schluessel: `${k.id}|${e.anlass}|${n.datum}`,
        kampagneId: k.id, kampagne: k.name, anlass: e.anlass, datum: n.datum, tage,
        themen: e.themen, ziel: e.ziel, zielgruppe: e.zielgruppe, format: e.format, quelle: e.quelle,
      });
    }
  }
  anstehend.sort((a, b) => a.datum.localeCompare(b.datum) || a.anlass.localeCompare(b.anlass));
  return { anstehend, befunde };
}

// --- Vorlagen: die zwei Start-Kampagnen (Owner 05.10.2026) --------------------
//
// Gesetzliche Feiertage nur, wenn sie zur Oeko-Nische passen; Aktionstage mit Primaerquelle
// (Recherche v107: UN-Liste der Welttage, BIR, Plastic Free Foundation, utopia.de). Beide sind
// normale Kampagnen — editierbar und loeschbar; geloeschte kommen nicht wieder (Merker im Plan).
const UN = "https://www.un.org/en/observances/list-days-weeks";
export const VORLAGEN = [
  {
    name: "Gesetzliche Feiertage",
    zeilen: [
      { Anlass: "Neujahr", Datum: "01.01.", Themen: "nachhaltige Vorsätze; Silvester-Müll und Feuerwerk", Ziel: "Neue Leute erreichen" },
      { Anlass: "Ostern", Datum: "Ostern", Themen: "Plastik-Deko und Verpackung; Eier natürlich färben", Ziel: "Neue Leute erreichen" },
      { Anlass: "Christi Himmelfahrt", Datum: "Ostern+39", Themen: "Ausflüge ohne Müll in der Natur", Ziel: "Gespraech ausloesen" },
      { Anlass: "Weihnachten", Datum: "25.12.", Themen: "Geschenkverpackung; Weihnachtsbaum; Konsum", Ziel: "Neue Leute erreichen" },
    ],
  },
  {
    name: "Aktionstage",
    zeilen: [
      { Anlass: "Weltrecyclingtag", Datum: "18.03.", Themen: "Recycling in Deutschland; Wertstoffe als Rohstoff", Ziel: "Neue Leute erreichen", Quelle: "https://archive.bir.org/news-press/bir-in-the-press/bir-announces-first-global-recycling-day" },
      { Anlass: "Weltwassertag", Datum: "22.03.", Themen: "Wasser sparen; Mikroplastik im Wasser", Quelle: UN },
      { Anlass: "Internationaler Tag der Null-Verschwendung", Datum: "30.03.", Themen: "Zero Waste im Alltag; Müll vermeiden", Quelle: UN },
      { Anlass: "Tag der Erde", Datum: "22.04.", Themen: "Ressourcen; Klima; was jede Person tun kann", Ziel: "Neue Leute erreichen", Quelle: UN },
      { Anlass: "Weltumwelttag", Datum: "05.06.", Themen: "Plastikverschmutzung; Umweltschutz vor Ort", Ziel: "Neue Leute erreichen", Quelle: UN },
      { Anlass: "Welttag der Ozeane", Datum: "08.06.", Themen: "Plastik im Meer; Verpackungsmüll", Quelle: UN },
      { Anlass: "Plastikfreier Juli", Datum: "01.07.", Themen: "einen Monat ohne Einwegplastik; Mitmach-Challenge", Ziel: "Gespraech ausloesen", Quelle: "https://www.plasticfreejuly.org" },
      { Anlass: "Earth Overshoot Day", Datum: "30.07.2026", Themen: "Ressourcenverbrauch; Datum jedes Jahr neu (Global Footprint Network, meist im Juni verkündet)", Quelle: "https://overshoot.footprintnetwork.org" },
      { Anlass: "World Cleanup Day", Datum: "20.09.", Themen: "Müllsammeln; Mitmach-Aktion vor Ort", Ziel: "Gespraech ausloesen", Quelle: UN },
      { Anlass: "Tag der Lebensmittelverschwendung", Datum: "29.09.", Themen: "Lebensmittel retten; Reste verwerten", Quelle: UN },
      { Anlass: "Welternährungstag", Datum: "16.10.", Themen: "Ernährung und Ressourcen", Quelle: UN },
      { Anlass: "Kauf-nix-Tag", Datum: "letzter Samstag im November", Themen: "Konsum hinterfragen; Gegenpol zum Black Friday", Ziel: "Gespraech ausloesen", Quelle: "https://utopia.de/ratgeber/heute-geschlossen-kaufen-sie-nichts-kauf-nichts-tag-buy-nothing-day/" },
      { Anlass: "Internationaler Tag des Ehrenamts", Datum: "05.12.", Themen: "Ehrenamt bei uns; Mitmachen", Ziel: "Foerdern und spenden", Quelle: UN },
    ],
  },
];

export const LIESMICH = [
  "# Kampagnen",
  "",
  "Jede Datei hier ist die Tabelle EINER Kampagne des Redaktionsplans (Board → Redaktionsplan → Kampagnen).",
  "Öffnen per Doppelklick (Google Sheets oder Excel), Zeilen ergänzen, ändern oder löschen, speichern.",
  "",
  "Eine Zeile = ein Anlass. Liegt er in den nächsten 60 Tagen und gibt es noch kein Projekt dazu,",
  "zeigt das Board in der ersten Spalte einen Knopf mit seinem Namen; ein Klick holt Themenvorschläge.",
  "",
  "Spalten:",
  "- Anlass — Name, so steht er auf dem Knopf (Pflicht)",
  "- Datum — 18.03. (jedes Jahr) · 30.07.2026 (nur dieses Jahr) · Ostern · Ostern+39 · 2. Sonntag im Mai ·",
  "  letzter Samstag im November · 4. Donnerstag im November+1 (Pflicht)",
  "- Themen — Stichworte für die KI",
  "- Ziel — Neue Leute erreichen · Bestand binden · Gespraech ausloesen · Foerdern und spenden",
  "- Zielgruppe — wen das Video ansprechen soll (leer: aus dem Unternehmenskontext)",
  "- Format — Reel · Slider · Beitrag mit Text · Story · Langformat-Video (leer: Reel)",
  "- Quelle — woher das Datum stammt",
  "",
  "Der Upload-Termin eines Anlass-Projekts ist der Anlass-Tag selbst.",
  "",
].join("\n");

// --- Drive (drive wird hereingereicht) -----------------------------------------

async function existiert(drive, pfad) {
  try { await drive.readFile(pfad, { timeoutMs: 20000 }); return true; }
  catch (e) { if (e && e.fehlend) return false; throw e; }
}

async function legeTabelleAn(drive, pfad, zeilen = []) {
  if (await existiert(drive, pfad)) return false;
  await drive.mkdir(ORDNER, { timeoutMs: 20000 });
  await drive.writeFile(pfad, schreibeCsv(zeilen), { timeoutMs: 20000 });
  return true;
}

// Einmalig: die zwei Start-Kampagnen in den Plan + ihre Tabellen nach Drive. Liefert true, wenn
// der Plan geaendert wurde (der Aufrufer speichert ihn). Bestehende Tabellen werden nie ueberschrieben.
export async function legeVorlagenAn(config, drive) {
  if (config.kampagnenVorlage) return false;
  config.kampagnen = Array.isArray(config.kampagnen) ? config.kampagnen : [];
  if (!(await existiert(drive, `${ORDNER}/LIESMICH.md`))) {
    await drive.mkdir(ORDNER, { timeoutMs: 20000 });
    await drive.writeFile(`${ORDNER}/LIESMICH.md`, LIESMICH, { timeoutMs: 20000 });
  }
  for (const v of VORLAGEN) {
    const tabelle = tabellePfad(v.name);
    await legeTabelleAn(drive, tabelle, v.zeilen);
    if (!config.kampagnen.some((k) => k.name === v.name)) {
      config.kampagnen.push({ id: "k" + Date.now().toString(36) + config.kampagnen.length, name: v.name, aktiv: true, tabelle });
    }
  }
  config.kampagnenVorlage = true;
  return true;
}

// Beim Speichern des Plans (rein, vor Drive): jede Kampagne behaelt ihre Tabelle — auch wenn der
// Browser sie nicht mitschickt (`vorher` = zuletzt gespeicherter Plan) — und eine neue bekommt
// einen Pfad aus ihrem Namen. Umbenennen aendert den Pfad NICHT (die Daten bleiben verbunden).
export function ordneTabellenZu(config, vorher = null) {
  const alt = new Map(((vorher && vorher.kampagnen) || []).map((k) => [k.id, k.tabelle]));
  for (const k of config.kampagnen || []) {
    if (!k.tabelle && alt.get(k.id)) k.tabelle = alt.get(k.id);
    if (!k.tabelle && k.name && String(k.name).trim()) k.tabelle = tabellePfad(k.name);
  }
  if (vorher && vorher.kampagnenVorlage && config.kampagnenVorlage === undefined) config.kampagnenVorlage = true;
  return config;
}

// Danach: fehlende Tabellen (nur Kopfzeile) in Drive anlegen. Bestehende bleiben unangetastet.
export async function sichereTabellen(config, drive) {
  for (const k of config.kampagnen || []) if (k.tabelle) await legeTabelleAn(drive, k.tabelle);
}

// Liest die Tabellen aller aktiven Kampagnen: Map id -> Text oder {fehler}.
export async function leseTabellen(config, drive) {
  const out = {};
  for (const k of config.kampagnen || []) {
    if (!k || k.aktiv === false || !k.tabelle) continue;
    try { out[k.id] = await drive.readFile(k.tabelle, { timeoutMs: 20000 }); }
    catch (e) { out[k.id] = { fehler: e && e.fehlend ? `${k.tabelle} fehlt in Drive` : (e && e.message) || String(e) }; }
  }
  return out;
}
