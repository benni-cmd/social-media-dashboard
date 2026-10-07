// Selbsttest v113 — Tore, Fristen und Planer-Regeln aus dem Abnahmetest v112
// (docs/packages/v113-fixes-aus-abnahmetest.md).
// Aufruf im Projektordner: node tools/tore-selbsttest.mjs — je Fall „ok"/„BEF", Exit-Code 1 bei einem Befund.
// Laedt NUR reine Module (pipeline.js, scheduler.js). Nie lib/drive.js oder Module, die es importieren
// (planstore.js …): drive.js schreibt beim Import data/.gdrive-env.json.

import * as P from "../lib/pipeline.js";
import * as S from "../lib/scheduler.js";

const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return P.isoDatum(d); };
const basis = { title: "T", kategorie: P.aktiveKategorien()[0].id, goal: P.ZIELE[0].id };
const k = (o) => P.migriere({ ...P.leereKarte("idee"), ...basis, ...o });
const sp = (c, d) => P.sperren(P.tore(c, d)).map((t) => t.id).join(",") || "-";
const out = [];
const T = (n, ist, soll) => out.push(`${String(ist) === String(soll) ? "ok " : "BEF"} | ${n} | ist=${ist} soll=${soll}`);

// H1: Reel braucht Fokus + beide Hooks + Skript-Datei; andere Formate ihre Format-Datei
T("Reel alles gewaehlt + Skript -> frei", sp(k({ chosenFokus: 0, chosenVerbal: 1, chosenVisuell: 0 }), { skriptDateien: ["10_skript.txt"] }), "-");
T("Reel ohne sichtbaren Hook sperrt fokus", sp(k({ chosenFokus: 0, chosenVerbal: 1 }), { skriptDateien: ["10_skript.txt"] }), "fokus");
T("Slider ohne Format-Datei sperrt", sp(k({ contenttyp: "slider" }), { skriptDateien: [] }), "format-datei");
T("Slider mit 10_slider.md frei", sp(k({ contenttyp: "slider" }), { skriptDateien: ["10_slider.md"] }), "-");
T("Langformat mit 10_konzept.md frei", sp(k({ contenttyp: "langformat" }), { skriptDateien: ["10_konzept.md"] }), "-");
T("Highlight mit 10_story.md frei", sp(k({ contenttyp: "highlight" }), { skriptDateien: ["10_story.md"] }), "-");

// N1: „skript" nur als eigenes Wort
const r = (n) => sp(k({ chosenFokus: 0, chosenVerbal: 0, chosenVisuell: 0 }), { skriptDateien: [n] });
T("Transkript zaehlt nicht", r("Transkript Interview.txt"), "skript-datei");
T("Videoskript zaehlt nicht", r("Videoskript.md"), "skript-datei");
T("Skripte zaehlt nicht", r("Skripte Oktober.docx"), "skript-datei");
T("Skript final.docx zaehlt", r("Skript final.docx"), "-");
T("10_skript.txt zaehlt", r("10_skript.txt"), "-");

// H7: gefuelltes Aufruf-Feld = genau ein Aufruf
const cap = (o) => sp(k({ column: "caption", platforms: ["instagram"], caption: { lead: "Kurz und klar.", body: "Text." }, ...o }), {});
T("CTA-Feld mit Frage = ein Aufruf", cap({ cta: { text: "Wie sieht es bei dir aus?" } }), "-");
T("ohne CTA sperrt", cap({}), "cta");
T("Feld + Verb im Text = mehrere", cap({ caption: { lead: "Kurz.", body: "Teile das mit Freunden." }, cta: { text: "Schreib uns." } }), "cta");

// H2: fruehester Upload = Drehtermin + kumulierter Dreh-Vorlauf -> Drehtermin nie „zu spaet"
const dreh = [{ datum: iso(12) }];
T("fruehester Upload = Dreh + 12", P.fruehesterUpload(dreh), iso(24));
T("Drehtermin liegt nicht nach spaetestem Dreh", P.spaetesterDreh(P.fruehesterUpload(dreh)) >= iso(12), true);
P.setDeadlineOffsets({ freigabe: 3, schnitt: 3, dreh: 4 });
T("mit Dreh-Vorlauf 4: Dreh + 10", P.fruehesterUpload(dreh), iso(22));
P.setDeadlineOffsets({});

// M12/M13: Planer — max. Abstand, %-Treue, Ziele entkoppelt
const plan = {
  kadenz: { postsProWoche: 3 }, plattformen: ["instagram", "linkedin"], maxAbstandTage: 4,
  typenmix: [{ typ: "reel", perWoche: 1.75 }, { typ: "slider", perWoche: 0.75 }, { typ: "beitrag", perWoche: 0.25 }, { typ: "story", perWoche: 0.25 }],
  kategorienAnteil: [{ id: "bildung", anteil: 50 }, { id: "spendenaufruf", anteil: 30 }, { id: "umfrage", anteil: 20 }],
  zielgewichte: P.ZIELE_STANDARD.map((z, i) => ({ id: z.id, gewicht: [40, 20, 30, 10][i] || 0 })),
};
const slots = [];
for (const [y, m] of [[2026, 9], [2026, 10], [2026, 11], [2027, 0], [2027, 1], [2027, 2]]) slots.push(...S.slotsForMonth(plan, y, m));
let max = 0;
for (let i = 1; i < slots.length; i++) max = Math.max(max, (new Date(slots[i].datum) - new Date(slots[i - 1].datum)) / 864e5);
T("Slots halten max. Abstand 4", max <= 4, true);
const anteil = (id) => slots.filter((s) => s.kategorie === id).length / slots.length;
T("Bildung 50 % +- 5", Math.abs(anteil("bildung") - 0.5) <= 0.05, true);
T("Umfrage 20 % +- 5", Math.abs(anteil("umfrage") - 0.2) <= 0.05, true);
T("alle Kategorie/Ziel-Paare kommen vor", new Set(slots.map((s) => s.kategorie + "/" + s.ziel)).size, 12);

// H4: Systemordner
T("istSystemOrdner", P.istSystemOrdner("fertig", "KPI") && P.istSystemOrdner("fertig", "Auswertung-Tabellen") && !P.istSystemOrdner("idee", "KPI"), true);

console.log(out.join("\n"));
const bef = out.filter((z) => z.startsWith("BEF")).length;
console.log(`${out.length - bef}/${out.length} ok`);
if (bef) process.exit(1);
