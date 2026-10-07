// Harte Tests (v115) — Gruppe „drive-hand": Drive von Hand veraendert, gegen die isolierte Umgebung.
// Deckt aus v114: H1 (falscher Feldtyp in projekt.json), H2 (Syntaxfehler), H3c (Huellen automatisch weg),
// N1 (Fehlertexte deutsch), N8 (Umbenennen-Meldung), dazu die haltenden Faelle (geloescht, verschoben).

import { readFile, writeFile, rename, rm, mkdir, readdir } from "node:fs/promises";
import { starteUmgebung, neueKarte, findeOrdner, dateienIn, leseBoard } from "./umgebung.mjs";
import { pruefer, schlaf } from "./gemeinsam.mjs";

const befundText = (r) => JSON.stringify((r.daten && r.daten.befunde) || r.text);

export async function lauf({ port }) {
  const t = pruefer("drive-hand");
  const u = await starteUmgebung({ port });
  const abgleich = () => u.api("POST", "/api/drive/reconcile", {});
  try {
    const vorlage = await neueKarte(u, { title: "TEST hart Vorlage", column: "skript" });
    const vorlageJson = JSON.parse(await readFile(u.d("In Bearbeitung/2 Skript/TEST hart Vorlage/(AI only)/projekt.json"), "utf8"));

    // --- H1 falscher Feldtyp, Ordner ohne Board-Karte ---------------------------------------
    {
      const rel = "In Bearbeitung/3 Videodreh/TEST hart Typ";
      await mkdir(u.d(rel, "(AI only)"), { recursive: true });
      const roh = { ...vorlageJson, id: "harttyp1", title: "TEST hart Typ", driveName: "TEST hart Typ", column: "videodreh", caption: "Hallo von Hand", skriptFinal: ["als Liste"], notes: "WICHTIG von Hand" };
      await writeFile(u.d(rel, "(AI only)/projekt.json"), JSON.stringify(roh, null, 2));
      const r = await abgleich();
      t.ok("H1 Abgleich laeuft trotz falschem Feldtyp (200)", r.status === 200, `${r.status} ${r.text.slice(0, 120)}`);
      const k = (await leseBoard(u)).cards.find((c) => c.id === "harttyp1");
      t.ok("H1 Karte da, Felder typrichtig, Notiz erhalten", k && typeof k.caption === "object" && (k.skriptFinal === undefined || typeof k.skriptFinal === "string") && k.notes === "WICHTIG von Hand", k && { caption: k.caption, skriptFinal: k.skriptFinal, notes: k.notes });
      const ai = await readdir(u.d(rel, "(AI only)")).catch(() => []);
      const sicherung = ai.find((n) => /^projekt\.kaputt-.*\.json$/.test(n));
      t.ok("H1 Original als projekt.kaputt-…json gesichert", !!sicherung && (await readFile(u.d(rel, "(AI only)", sicherung), "utf8")).includes("Hallo von Hand"), ai);
      t.ok("H1 Befund nennt die Korrektur", /caption|Feld|Typ|gesichert/i.test(befundText(r)), befundText(r).slice(0, 300));
    }

    // --- H1 falscher Typ an einer Board-Karte, von Hand in andere Phase verschoben ----------------
    {
      const k = await neueKarte(u, { title: "TEST hart Typ Board", column: "skript" });
      await rename(u.d("In Bearbeitung/2 Skript/TEST hart Typ Board"), u.d("In Bearbeitung/4 Schnitt/TEST hart Typ Board"));
      const p = u.d("In Bearbeitung/4 Schnitt/TEST hart Typ Board/(AI only)/projekt.json");
      const j = JSON.parse(await readFile(p, "utf8"));
      await writeFile(p, JSON.stringify({ ...j, hook: "nur Text", platforms: "instagram", dates: { upload: "2026-13-45" } }));
      const r = await abgleich();
      const nach = (await leseBoard(u)).cards.find((c) => c.id === k.id);
      t.ok("H1 Abgleich 200 und Karte folgt Drive (Schnitt), Typen repariert", r.status === 200 && nach && nach.column === "schnitt" && typeof nach.hook === "object" && Array.isArray(nach.platforms) && !nach.dates.upload, nach && { column: nach.column, hook: nach.hook, platforms: nach.platforms, dates: nach.dates });
    }

    // --- H2 Syntaxfehler, Ordner ohne Board-Karte -------------------------------------------
    {
      const rel = "In Bearbeitung/3 Videodreh/TEST hart Syntax";
      await mkdir(u.d(rel, "(AI only)"), { recursive: true });
      const roh = JSON.stringify({ ...vorlageJson, id: "hartsyn1", title: "TEST hart Syntax", driveName: "TEST hart Syntax", column: "videodreh", notes: "WICHTIGER INHALT", hook: { text: "Mein Hook", visual: "Bild" } }, null, 2).replace(/\n}\s*$/, "\n,}");
      await writeFile(u.d(rel, "(AI only)/projekt.json"), roh);
      const r = await abgleich();
      const ai = await readdir(u.d(rel, "(AI only)")).catch(() => []);
      const sicherung = ai.find((n) => /^projekt\.kaputt-.*\.json$/.test(n));
      t.ok("H2 unlesbare projekt.json gesichert, Inhalt erhalten", !!sicherung && (await readFile(u.d(rel, "(AI only)", sicherung), "utf8")).includes("WICHTIGER INHALT"), ai);
      t.ok("H2 Meldung sagt „beschädigt“ statt „keine projekt.json“", /besch(ae|ä)digt/i.test(befundText(r)) && !/es gab keine projekt\.json/i.test(befundText(r)), befundText(r).slice(0, 300));
    }

    // --- H2 Syntaxfehler an einer Board-Karte -------------------------------------------------
    {
      const k = await neueKarte(u, { title: "TEST hart Syntax Board", column: "skript", notes: "Board-Notiz" });
      await rename(u.d("In Bearbeitung/2 Skript/TEST hart Syntax Board"), u.d("In Bearbeitung/3 Videodreh/TEST hart Syntax Board"));
      const p = u.d("In Bearbeitung/3 Videodreh/TEST hart Syntax Board/(AI only)/projekt.json");
      await writeFile(p, (await readFile(p, "utf8")).replace(/}\s*$/, ",}") + "NOTIZ VON HAND");
      await abgleich();
      const ai = await readdir(u.d("In Bearbeitung/3 Videodreh/TEST hart Syntax Board/(AI only)"));
      const nach = (await leseBoard(u)).cards.find((c) => c.id === k.id);
      t.ok("H2 Board-Karte: kaputte Datei gesichert, Board-Stand bleibt", ai.some((n) => /^projekt\.kaputt-/.test(n)) && nach && nach.notes === "Board-Notiz", { ai, notes: nach && nach.notes });
    }

    // --- N8 von Hand umbenannt ------------------------------------------------------------------
    {
      const k = await neueKarte(u, { title: "TEST hart Name", column: "skript" });
      await rename(u.d("In Bearbeitung/2 Skript/TEST hart Name"), u.d("In Bearbeitung/2 Skript/TEST hart Neuer Name"));
      const r = await abgleich();
      const nach = (await leseBoard(u)).cards.filter((c) => c.id === k.id);
      t.ok("N8 Umbenennen: dieselbe Karte, neuer Ordnername", nach.length === 1 && nach[0].driveName === "TEST hart Neuer Name", nach.map((c) => c.driveName));
      const txt = befundText(r);
      t.ok("N8 Meldung „umbenannt“, kein Widerspruch", /umbenannt/i.test(txt) && !/TEST hart Neuer Name\\?" ohne Karte/.test(txt) && !/keinen Ordner "TEST hart Name"/.test(txt), txt.slice(0, 300));
    }

    // --- von Hand geloescht (haelt) --------------------------------------------------------------
    {
      const k = await neueKarte(u, { title: "TEST hart Weg", column: "skript" });
      await rm(u.d("In Bearbeitung/2 Skript/TEST hart Weg"), { recursive: true, force: true });
      const r = await abgleich();
      t.ok("von Hand geloescht: Karte bleibt mit Befund", (await leseBoard(u)).cards.some((c) => c.id === k.id) && /TEST hart Weg/.test(befundText(r)));
      t.gleich("von Hand geloescht: nicht still neu angelegt", (await findeOrdner(u, "TEST hart Weg")).length, 0);
    }

    // --- H3c Huelle neben neuerer Kopie -> Papierkorb -----------------------------------------
    {
      const k = await neueKarte(u, { title: "TEST hart Huelle", column: "schnitt" });
      await writeFile(u.d("In Bearbeitung/4 Schnitt/TEST hart Huelle/Rohmaterial/clip.mp4"), "Clip");
      const alt = JSON.parse(await readFile(u.d("In Bearbeitung/4 Schnitt/TEST hart Huelle/(AI only)/projekt.json"), "utf8"));
      await mkdir(u.d("In Bearbeitung/3 Videodreh/TEST hart Huelle/(AI only)"), { recursive: true });
      await writeFile(u.d("In Bearbeitung/3 Videodreh/TEST hart Huelle/(AI only)/projekt.json"), JSON.stringify({ ...alt, column: "videodreh", aktualisiert: "2020-01-01T00:00:00.000Z" }));
      await schlaf(50);
      const r = await abgleich();
      const orte = await findeOrdner(u, "TEST hart Huelle");
      t.ok("H3c Huelle (nur projekt.json, aelter) liegt im Papierkorb", orte.filter((o) => o.startsWith("In Bearbeitung/")).length === 1 && orte.some((o) => o.startsWith("Papierkorb/")), orte);
      t.ok("H3c Karte bleibt bei der Kopie mit Inhalt", ((await leseBoard(u)).cards.find((c) => c.id === k.id) || {}).column === "schnitt");
      t.ok("H3c kein „zusammenführen“-Befund", !/mehrfach/.test(befundText(r)), befundText(r).slice(0, 300));
    }

    // --- H3c Huelle NEUER als die Kopie mit Inhalt -> bleibt, Befund ---------------------------
    {
      await neueKarte(u, { title: "TEST hart Huelle Neu", column: "schnitt" });
      await writeFile(u.d("In Bearbeitung/4 Schnitt/TEST hart Huelle Neu/Rohmaterial/clip.mp4"), "Clip");
      const alt = JSON.parse(await readFile(u.d("In Bearbeitung/4 Schnitt/TEST hart Huelle Neu/(AI only)/projekt.json"), "utf8"));
      await mkdir(u.d("In Bearbeitung/5 Caption/TEST hart Huelle Neu/(AI only)"), { recursive: true });
      await writeFile(u.d("In Bearbeitung/5 Caption/TEST hart Huelle Neu/(AI only)/projekt.json"), JSON.stringify({ ...alt, column: "caption", aktualisiert: "2099-01-01T00:00:00.000Z" }));
      await abgleich();
      const orte = await findeOrdner(u, "TEST hart Huelle Neu");
      t.gleich("H3c neuere Huelle wird nicht automatisch entfernt", orte.filter((o) => o.startsWith("In Bearbeitung/")).length, 2);
    }

    // --- von Hand verschoben (haelt) -------------------------------------------------------------
    {
      const k = await neueKarte(u, { title: "TEST hart Hand", column: "skript" });
      await rename(u.d("In Bearbeitung/2 Skript/TEST hart Hand"), u.d("In Bearbeitung/5 Caption/TEST hart Hand"));
      await abgleich();
      t.gleich("von Hand verschoben: Board folgt Drive", ((await leseBoard(u)).cards.find((c) => c.id === k.id) || {}).column, "caption");
    }

    // --- Ziel nicht beschreibbar: Dateien bleiben, Meldung deutsch --------------------------------
    {
      const k = await neueKarte(u, { title: "TEST hart Ziel", column: "skript" });
      await writeFile(u.d("In Bearbeitung/2 Skript/TEST hart Ziel/Rohmaterial/clip.mp4"), "Clip");
      await rename(u.d("In Bearbeitung/4 Schnitt"), u.d("In Bearbeitung/4 Schnitt.weg"));
      await writeFile(u.d("In Bearbeitung/4 Schnitt"), "kein Ordner");
      const r = await u.api("POST", "/api/drive/move", { card: k, ziel: "schnitt" });
      await rm(u.d("In Bearbeitung/4 Schnitt"));
      await rename(u.d("In Bearbeitung/4 Schnitt.weg"), u.d("In Bearbeitung/4 Schnitt"));
      t.ok("Ziel nicht beschreibbar: Dateien am alten Ort", ((await dateienIn(u, "In Bearbeitung/2 Skript/TEST hart Ziel")) || []).includes("Rohmaterial/clip.mp4"));
      const satz = (r.daten && (r.daten.satz || r.daten.error)) || r.text;
      t.ok("N1 Fehlermeldung deutsch, ohne rclone-Logzeile", r.status >= 400 && !/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}|ERROR :|failed/i.test(satz), satz.slice(0, 200));
    }
  } finally {
    await u.aufraeumen();
  }
  return t.ende();
}
