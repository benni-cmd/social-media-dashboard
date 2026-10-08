// Harte Tests (v115) — Gruppe „logik": reine Module, kein Server, kein Drive.
// Deckt aus v114: H1/N7 (Typ-Haerte der Karte), Fristen-Kette, Datums-Grenzen, H4/M5 (Planer-Kette und
// erfuellbarer max. Abstand), N6 (Kampagnen-Daten). Laedt NUR reine Module — nie lib/drive.js oder Module,
// die es importieren (planstore.js, projects.js …): drive.js schreibt beim Import data/.gdrive-env.json.

import * as P from "../../lib/pipeline.js";
import * as S from "../../lib/scheduler.js";
import * as U from "../../lib/uploadslots.js";
import * as K from "../../lib/kampagnen.js";
import { pruefer } from "./gemeinsam.mjs";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isoGueltig = (s) => typeof s === "string" && ISO.test(s) && P.isoDatum(new Date(s + "T00:00:00")) === s;
const plus = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return P.isoDatum(d); };

// Bens echter Plan (Stand 07.10.2026, nur Einstellungen — keine Firmendaten).
export const BENS_PLAN = {
  kadenz: { postsProWoche: 3 }, plattformen: ["instagram", "linkedin"], maxAbstandTage: 4,
  typenmix: [{ typ: "reel", perWoche: 1.75 }, { typ: "slider", perWoche: 0.75 }, { typ: "beitrag", perWoche: 0.25 }, { typ: "story", perWoche: 0.25 }, { typ: "langformat", perWoche: 0 }],
};

// Erwartete Typen einer Karte nach migriere() — die Spezifikation, unabhaengig von der Umsetzung.
const TEXT = ["title", "notes", "serie", "episode", "contenttyp", "kategorie", "goal", "owner", "uploadTime", "driveName"];
const OBJEKT = ["hook", "cta", "frame", "caption", "video", "dates", "checks", "ai", "published", "metrics", "kpiMessungen"];
const UNTER_TEXT = [["hook", "text"], ["hook", "visual"], ["cta", "text"], ["cta", "directness"], ["frame", "problem"], ["frame", "solution"], ["caption", "lead"], ["caption", "body"]];
const OPTIONAL_TEXT = ["skriptFinal", "fokusText"];
const OPTIONAL_INDEX = ["chosenFokus", "chosenVerbal", "chosenVisuell", "chosenCaption"];
const MUELL = [null, 0, -1, 7.5, NaN, "", "x", [], ["a", 1], {}, { a: 1 }, true, false];
const istObjekt = (v) => !!v && typeof v === "object" && !Array.isArray(v);

function typFehler(k) {
  const f = [];
  for (const n of TEXT) if (typeof k[n] !== "string") f.push(n);
  for (const n of OBJEKT) if (!istObjekt(k[n])) f.push(n);
  for (const [a, b] of UNTER_TEXT) if (!istObjekt(k[a]) || typeof k[a][b] !== "string") f.push(`${a}.${b}`);
  if (!Array.isArray(k.platforms) || k.platforms.some((p) => typeof p !== "string")) f.push("platforms");
  if (!istObjekt(k.caption) || !Array.isArray(k.caption.keywords)) f.push("caption.keywords");
  if (!istObjekt(k.caption) || !istObjekt(k.caption.hashtags)) f.push("caption.hashtags");
  if (!istObjekt(k.video) || !Number.isFinite(k.video.seconds)) f.push("video.seconds");
  if (typeof k.floatUpload !== "boolean") f.push("floatUpload");
  if (!(k.drehterminId === null || typeof k.drehterminId === "string")) f.push("drehterminId");
  for (const n of OPTIONAL_TEXT) if (k[n] != null && typeof k[n] !== "string") f.push(n); // null = nicht gesetzt
  for (const n of OPTIONAL_INDEX) if (k[n] != null && !(Number.isInteger(k[n]) && k[n] >= 0)) f.push(n);
  if (istObjekt(k.dates)) for (const [n, v] of Object.entries(k.dates)) if (v != null && v !== "" && !isoGueltig(v)) f.push(`dates.${n}`);
  if (!P.PHASE_IDS.includes(k.column)) f.push("column");
  return f;
}

export async function lauf() {
  const t = pruefer("logik");
  const basis = () => P.migriere({ ...P.leereKarte("caption"), title: "Thema", kategorie: P.aktiveKategorien()[0].id, goal: P.ZIELE[0].id, contenttyp: "reel", platforms: ["instagram"], skriptFinal: "Ein Skript.", chosenFokus: 0, chosenVerbal: 1, chosenVisuell: 0, dates: { upload: "2026-11-20" } });

  // --- H1/N7: jedes Feld mit jedem falschen Typ ---------------------------------------
  {
    let wirftMig = 0, wirftTore = 0, falscherTyp = 0, nan = 0, faelle = 0;
    const beispiele = [];
    const felder = [...TEXT, ...OBJEKT, "platforms", "floatUpload", "drehterminId", ...OPTIONAL_TEXT, ...OPTIONAL_INDEX, "column"];
    const unter = [...UNTER_TEXT, ["caption", "keywords"], ["caption", "hashtags"], ["video", "seconds"], ["dates", "upload"], ["dates", "dreh"]];
    const varianten = [];
    for (const f of felder) for (const m of MUELL) varianten.push((k) => { k[f] = m; return `${f}=${JSON.stringify(m)}`; });
    for (const [a, b] of unter) for (const m of [...MUELL, "2026-13-45", "2026-02-30", "abc"]) varianten.push((k) => { k[a] = { ...(istObjekt(k[a]) ? k[a] : {}), [b]: m }; return `${a}.${b}=${JSON.stringify(m)}`; });
    for (const mach of varianten) {
      for (const schema of [P.leereKarte("idee").schema, undefined]) {
        faelle++;
        const roh = basis();
        const was = mach(roh);
        if (schema === undefined) delete roh.schema;
        let k;
        try { k = P.migriere(roh); } catch (e) { wirftMig++; if (beispiele.length < 4) beispiele.push(`migriere ${was}: ${e.message}`); continue; }
        const tf = typFehler(k);
        if (tf.length) { falscherTyp++; if (beispiele.length < 8) beispiele.push(`${was} -> falscher Typ ${tf.join(",")}`); }
        try {
          for (const stand of [{}, { skriptDateien: ["10_skript.txt"] }, null]) P.sperren(P.tore(k, stand));
          const a = P.ampel(k);
          if (/NaN|Invalid/.test(JSON.stringify(a))) { nan++; if (beispiele.length < 10) beispiele.push(`${was} -> Ampel ${JSON.stringify(a).slice(0, 80)}`); }
          P.projektName(k);
        } catch (e) { wirftTore++; if (beispiele.length < 10) beispiele.push(`tore/ampel ${was}: ${e.message}`); }
      }
    }
    t.ok(`H1 migriere wirft nie (${faelle} Faelle)`, wirftMig === 0, `${wirftMig}x; ${beispiele.join(" || ")}`);
    t.ok("H1 nach migriere hat jedes Feld seinen Typ (auch eine Ebene tief, ISO-Daten)", falscherTyp === 0, `${falscherTyp}x; ${beispiele.join(" || ")}`);
    t.ok("H1 tore/ampel/projektName werfen nie bei migrierten Karten", wirftTore === 0, `${wirftTore}x; ${beispiele.join(" || ")}`);
    t.ok("N7 keine NaN/Invalid Date in der Ampel", nan === 0, `${nan}x`);
    const sauber = basis();
    t.gleich("H1 gueltige Karte bleibt unveraendert", JSON.stringify(P.migriere(sauber)), JSON.stringify(sauber));
  }

  // --- Fristen-Kette ---------------------------------------------------------------
  {
    const heute = "2026-10-07";
    let kaputt = 0, zuSpaet = 0;
    const bsp = [];
    for (const wert of [0, 1, 3, 6, 12, 40, -5, "x", null, undefined, 2.5, 1e9, "7", Infinity, NaN]) {
      for (const glied of ["freigabe", "schnitt", "dreh"]) {
        P.setDeadlineOffsets({ [glied]: wert });
        const kette = P.deadlineOffsetsJetzt();
        if (Object.values(kette).some((v) => !Number.isInteger(v) || v < 0 || v > 365)) { kaputt++; bsp.push(`${glied}=${wert} -> ${JSON.stringify(kette)}`); }
        for (const drehs of [[], [{ datum: "2026-10-20" }], [{ datum: "2026-13-45" }], [{ datum: null }], [{ datum: "2026-02-30" }, { datum: "2026-10-25" }]]) {
          const up = P.fruehesterUpload(drehs, heute);
          if (!isoGueltig(up)) { kaputt++; if (bsp.length < 6) bsp.push(`${glied}=${wert} ${JSON.stringify(drehs)} -> ${up}`); continue; }
          const naechster = P.naechsterDrehterminDatum(drehs, heute);
          if (!isoGueltig(naechster)) { kaputt++; bsp.push(`naechster Drehtermin ${naechster}`); continue; }
          if (P.spaetesterDreh(up) < naechster) { zuSpaet++; if (bsp.length < 6) bsp.push(`${glied}=${wert}: Upload ${up} macht Dreh ${naechster} zu spaet`); }
        }
      }
    }
    P.setDeadlineOffsets({});
    t.ok("Fristen: Kette nur ganze Tage 0..365, Upload immer gueltiges Datum", kaputt === 0, `${kaputt}x; ${bsp.join(" || ")}`);
    t.ok("Fristen: vorgeschlagener Upload macht den Drehtermin nie zu spaet", zuSpaet === 0, `${zuSpaet}x; ${bsp.join(" || ")}`);
    for (const k of ["2026-13-45", "2026-02-30", "abc", "", null]) {
      const r = P.rueckwaertsplan(k);
      t.ok(`N7 Rueckwaertsplan(${JSON.stringify(k)}) ohne NaN`, !/NaN|Invalid/.test(JSON.stringify(r)), r);
    }
  }

  // --- Datums-Grenzen (Zeitzone Europe/Berlin noetig) -------------------------------
  {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz !== "Europe/Berlin") t.hinweis(`Zeitzone ist ${tz} — Datums-Grenzen gelten fuer Europe/Berlin (lauf.mjs setzt TZ selbst).`);
    t.gleich("Zeitumstellung Okt: Dreh 20.10. + 12", P.fruehesterUpload([{ datum: "2026-10-20" }], "2026-10-01"), "2026-11-01");
    t.gleich("Zeitumstellung Maerz: Dreh 20.03. + 12", P.fruehesterUpload([{ datum: "2027-03-20" }], "2027-03-01"), "2027-04-01");
    t.gleich("spaetester Dreh vor Upload 01.11.2026", P.spaetesterDreh("2026-11-01"), "2026-10-20");
    t.gleich("Jahreswechsel: spaetester Dreh vor 05.01.2027", P.spaetesterDreh("2027-01-05"), "2026-12-24");
    t.gleich("Schaltjahr: spaetester Dreh vor 10.03.2028", P.spaetesterDreh("2028-03-10"), "2028-02-27");
    t.gleich("Rueckwaertsplan 02.01.2027 Freigabe", P.rueckwaertsplan("2027-01-02").freigabe, "2026-12-30");
    t.gleich("Rueckwaertsplan 01.03.2028 Freigabe", P.rueckwaertsplan("2028-03-01").freigabe, "2028-02-27");
    t.gleich("Wochenindex ueber den Jahreswechsel", S.wochenIndexVonDatum("2026-12-28") + 1, S.wochenIndexVonDatum("2027-01-04"));
    t.gleich("Ostern 2027", K.ostersonntag(2027).toISOString().slice(0, 10), "2027-03-28");
    for (const [n, soll] of [[-1, "befund"], [0, "befund"], [2, "befund"], [3, "hinweis"], [5, "hinweis"], [6, "ok"]])
      t.gleich(`Ampel bei ${n} Tagen`, P.ampel({ column: "upload", dates: { upload: plus(P.isoDatum(new Date()), n) } }).status, soll);
  }

  // --- H4: eine Kette fuer Kalender, Vorschlaege, Wochen-Soll ---------------------------
  {
    const monate = []; for (let d = 0; d < 24; d++) monate.push([2026 + Math.floor((9 + d) / 12), (9 + d) % 12]);
    const kalender = monate.flatMap(([y, m]) => S.slotsForMonth(BENS_PLAN, y, m));
    const k = (s) => `${s.datum} ${s.uhrzeit} ${s.typ}`;
    const roh = monate.flatMap(([y, m]) => S.slotsForMonth({ ...BENS_PLAN, maxAbstandTage: 0 }, y, m));
    t.gleich("H4 Kalender 24 Monate: so viele Termine wie ohne Deckel (keine Doppel)", kalender.length, roh.length);
    t.gleich("H4 Kalender ohne doppelte Termine", new Set(kalender.map(k)).size, kalender.length);
    // Fensterunabhaengig: dieselben Termine, egal ab welchem Monat gerechnet wird.
    const ab = (y, m, n) => { const l = []; for (let d = 0; d < n; d++) l.push(...S.slotsForMonth(BENS_PLAN, y + Math.floor((m + d) / 12), (m + d) % 12)); return l.map(k); };
    const a = ab(2026, 9, 6), b = ab(2026, 11, 4);
    t.ok("H4 Dez–Mrz gleich, ob ab Okt oder ab Dez gerechnet", JSON.stringify(a.filter((x) => x >= "2026-12")) === JSON.stringify(b), { nurAbOkt: a.filter((x) => x >= "2026-12" && !b.includes(x)).slice(0, 3), nurAbDez: b.filter((x) => !a.includes(x)).slice(0, 3) });
    const vorschlag = U.planSlots(BENS_PLAN, 6, new Date("2026-10-07T12:00:00")).map(k);
    t.ok("H4 Upload-Vorschlaege = Kalender", vorschlag.every((x) => kalender.map(k).includes(x)) && new Set(vorschlag).size === vorschlag.length, vorschlag.filter((x) => !kalender.map(k).includes(x)).slice(0, 3));
    const woche = U.planSlotsZwischen(BENS_PLAN, "2026-11-30", "2026-12-06").map(k);
    t.gleich("H4 Wochen-Soll ueber die Monatsgrenze ohne Doppel", new Set(woche).size, woche.length);
    if (typeof S.slotsImZeitraum === "function") {
      const z = S.slotsImZeitraum(BENS_PLAN, "2026-10-05", "2026-11-29").map(k);
      t.ok("H4 slotsImZeitraum (Drive-Datei) = Kalender", z.every((x) => kalender.map(k).includes(x)), z.filter((x) => !kalender.map(k).includes(x)).slice(0, 3));
    } else t.ok("H4 slotsImZeitraum fuer die Drive-Datei vorhanden", false, "scheduler.slotsImZeitraum fehlt");
    let gap = 0; const so = [...kalender].sort((x, y) => x.datum.localeCompare(y.datum));
    for (let i = 1; i < so.length; i++) gap = Math.max(gap, (Date.parse(so[i].datum) - Date.parse(so[i - 1].datum)) / 864e5);
    t.ok(`H4 groesste Luecke ${gap} <= max. Abstand 4`, gap <= 4, gap);
  }

  // --- M5: erfuellbarer max. Abstand -------------------------------------------------
  {
    const pruef = S.abstandPruefung;
    if (typeof pruef !== "function") t.ok("M5 scheduler.abstandPruefung vorhanden", false, "fehlt");
    else {
      const mit = (n, max) => ({ ...BENS_PLAN, kadenz: { postsProWoche: n }, typenmix: [{ typ: "reel", perWoche: n }], maxAbstandTage: max });
      t.ok("M5 Bens Plan (3/Woche, max 4) ist erfuellbar", pruef(BENS_PLAN).ok, pruef(BENS_PLAN));
      const r1 = pruef(mit(1, 3));
      t.ok("M5 1/Woche mit max 3 ist nicht erfuellbar, Satz nennt Mindestwert", !r1.ok && Number.isInteger(r1.mindestTage) && /\d/.test(r1.satz || ""), r1);
      t.ok("M5 max 0 (keine Grenze) ist immer erfuellbar", pruef(mit(0.25, 0)).ok);
      // Jede als erfuellbar gemeldete Einstellung haelt ihren Abstand wirklich ein; jede abgelehnte wuerde ihn reissen.
      let falsch = 0; const bsp = [];
      for (const n of [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7]) for (const max of [1, 2, 3, 4, 5, 6, 7, 10, 14, 28]) {
        const plan = mit(n, max);
        const r = pruef(plan);
        const sl = []; for (let d = 0; d < 12; d++) sl.push(...S.slotsForMonth(plan, 2026 + Math.floor((9 + d) / 12), (9 + d) % 12));
        sl.sort((x, y) => x.datum.localeCompare(y.datum));
        let g = 0; for (let i = 1; i < sl.length; i++) g = Math.max(g, (Date.parse(sl[i].datum) - Date.parse(sl[i - 1].datum)) / 864e5);
        if (r.ok && g > max) { falsch++; if (bsp.length < 4) bsp.push(`${n}/Woche max ${max}: erfuellbar gemeldet, Luecke ${g}`); }
        if (!r.ok && r.mindestTage < max) { falsch++; if (bsp.length < 4) bsp.push(`${n}/Woche max ${max}: Mindestwert ${r.mindestTage} < eingestellt`); }
      }
      t.ok("M5 Pruefung stimmt mit dem Planer ueberein (100 Einstellungen)", falsch === 0, bsp.join(" || "));
    }
  }

  // --- N6: Kampagnen-Daten -----------------------------------------------------------
  {
    const r = (x) => K.naechstesDatum(x, "2026-10-07");
    t.ok("N6 31.04. ergibt kein Datum, sondern einen Fehler", !r("31.04.").datum, r("31.04."));
    t.ok("N6 13.13. ergibt kein Datum", !r("13.13.").datum, r("13.13."));
    t.gleich("N6 29.02. landet auf dem naechsten 29.02.", r("29.02.").datum, "2028-02-29");
    t.ok("N6 18.03. weiter gueltig", isoGueltig(r("18.03.").datum), r("18.03."));
    const tab = K.leseTabelle("﻿Anlass;Datum;Themen\r\nKaputt;31.04.;x\r\nGut;18.03.;y\r\n");
    const text = JSON.stringify(tab);
    t.ok("N6 Tabelle meldet die Zeile mit ungueltigem Datum", /31\.04\./.test(text) && /(ungueltig|ungültig|gibt es nicht)/i.test(text), text.slice(0, 300));
  }

  return t.ende();
}
