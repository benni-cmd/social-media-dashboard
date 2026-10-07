// Harte Tests (v115) — Gruppe „wettlauf": gleichzeitige Vorgaenge gegen die isolierte Umgebung.
// Deckt aus v114: M1 (gleichzeitige Speicherungen), M2 (Loeschen, dann Verschieben), H3 (Abgleich waehrend
// Verschieben), dazu die haltenden Faelle (doppeltes Verschieben, Verschieben + Loeschen).

import { writeFile } from "node:fs/promises";
import { starteUmgebung, neueKarte, findeOrdner, dateienIn, leseBoard } from "./umgebung.mjs";
import { pruefer, schlaf } from "./gemeinsam.mjs";

const PHASE_ORDNER = { idee: "1 Idee", skript: "2 Skript", videodreh: "3 Videodreh", schnitt: "4 Schnitt", caption: "5 Caption", upload: "6 Upload" };
const inPhasen = (liste) => liste.filter((p) => p.startsWith("In Bearbeitung/"));

async function mitInhalt(u, karte) {
  const pfad = `In Bearbeitung/${PHASE_ORDNER[karte.column]}/${karte.driveName}`;
  await writeFile(u.d(pfad, "Skript und Caption", "10_skript.txt"), "TEST hart Skript");
  await writeFile(u.d(pfad, "Rohmaterial", "clip.mp4"), "TEST hart Clip");
}

export async function lauf({ port }) {
  const t = pruefer("wettlauf");
  const u = await starteUmgebung({ port });
  try {
    // --- M1 gleichzeitige Speicherungen ---------------------------------------------------
    await neueKarte(u, { title: "TEST hart Speicher", column: "idee" }, { mitOrdner: false });
    for (let runde = 1; runde <= 3; runde++) {
      const b = await leseBoard(u);
      const st = await Promise.all(Array.from({ length: 10 }, (_, i) =>
        u.api("PUT", "/api/board", { cards: b.cards.map((c) => (c.title === "TEST hart Speicher" ? { ...c, notes: `Fenster ${i}` } : c)), version: b.version }).then((r) => r.status)));
      const nach = await leseBoard(u);
      const ok = st.filter((s) => s === 200).length, konflikt = st.filter((s) => s === 409).length;
      t.ok(`M1 Runde ${runde}: genau 1x gespeichert, 9x 409, kein 500`, ok === 1 && konflikt === 9, st.join(","));
      t.gleich(`M1 Runde ${runde}: Version +1`, nach.version, b.version + 1);
    }

    // --- doppeltes Verschieben (haelt) ------------------------------------------------------
    {
      const k = await neueKarte(u, { title: "TEST hart Doppel", column: "skript" });
      await mitInhalt(u, k);
      const r = await Promise.all([1, 2].map(() => u.api("POST", "/api/drive/move", { card: k, ziel: "videodreh" })));
      const orte = inPhasen(await findeOrdner(u, "TEST hart Doppel"));
      t.ok("doppeltes Verschieben: kein 500", r.every((x) => x.status < 500), r.map((x) => `${x.status} ${x.text.slice(0, 50)}`));
      t.gleich("doppeltes Verschieben: genau ein Ordner, am Ziel", orte, ["In Bearbeitung/3 Videodreh/TEST hart Doppel"]);
      t.ok("doppeltes Verschieben: Dateien vollstaendig", (await dateienIn(u, orte[0] || "x") || []).includes("Rohmaterial/clip.mp4"));
    }

    // --- Verschieben + Loeschen gleichzeitig (haelt) ------------------------------------------
    {
      const k = await neueKarte(u, { title: "TEST hart VL", column: "skript" });
      await mitInhalt(u, k);
      await Promise.all([u.api("POST", "/api/drive/move", { card: k, ziel: "videodreh" }), u.api("POST", "/api/karte/loeschen", k)]);
      const phasen = inPhasen(await findeOrdner(u, "TEST hart VL"));
      const korb = (await findeOrdner(u, "TEST hart VL")).filter((p) => p.startsWith("Papierkorb/"));
      t.ok("Verschieben + Loeschen: Ordner genau an einem Ort", phasen.length + korb.length === 1, { phasen, korb });
    }

    // --- M2 Loeschen, danach Verschieben mit veraltetem Kartenstand -----------------------------
    // (z. B. „Weiter zu …" scannt noch, waehrenddessen wird geloescht; oder ein zweiter Tab)
    for (const [name, versatz] of [["TEST hart LV", null], ["TEST hart LV2", 150]]) {
      const k = await neueKarte(u, { title: name, column: "caption" });
      await mitInhalt(u, k);
      let del, mov;
      if (versatz == null) {
        del = await u.api("POST", "/api/karte/loeschen", k);
        mov = await u.api("POST", "/api/drive/move", { card: k, ziel: "upload" });
      } else {
        [del, mov] = await Promise.all([u.api("POST", "/api/karte/loeschen", k), schlaf(versatz).then(() => u.api("POST", "/api/drive/move", { card: k, ziel: "upload" }))]);
      }
      // Wie der Browser: nach bestaetigtem Loeschen die Karte aus dem Board nehmen.
      const b2 = await leseBoard(u);
      await u.api("PUT", "/api/board", { cards: b2.cards.filter((c) => c.id !== k.id), version: b2.version });
      const phasen = inPhasen(await findeOrdner(u, name));
      const wie = versatz == null ? "nacheinander" : `${versatz} ms versetzt`;
      t.ok(`M2 (${wie}) geloeschte Karte: Verschieben abgelehnt, kein neuer Ordner`, del.status === 200 && phasen.length === 0 && (versatz != null || mov.status === 409), { del: del.status, move: `${mov.status} ${mov.text.slice(0, 80)}`, phasen });
      await u.api("POST", "/api/drive/reconcile", {});
      t.ok(`M2 (${wie}) geloeschte Karte kehrt nach Abgleich nicht zurueck`, !(await leseBoard(u)).cards.some((c) => c.title === name));
    }

    // --- H3 Abgleich waehrend Verschieben ------------------------------------------------------
    // Deterministisch: 20 Fuellkarten, deren Board-Spalte nicht zu Drive passt, zwingen den Abgleich, nach dem
    // Auflisten Karte fuer Karte zu lesen. Genau dann (erste Stufe „drive-karte" im Abgleich-Strom) verschiebt
    // der „Browser" die Testkarte optimistisch — ihr Ordner wandert, waehrend der Abgleich noch den alten Stand hat.
    {
      const fueller = [];
      for (let i = 0; i < 20; i++) fueller.push(await neueKarte(u, { title: `TEST hart Fueller ${String(i).padStart(2, "0")}`, column: "skript" }));
      const k = await neueKarte(u, { title: "TEST hart Abgleich", column: "upload" });
      await mitInhalt(u, k);
      const fuellIds = new Set(fueller.map((f) => f.id));
      const wege = [["upload", "caption"], ["caption", "schnitt"], ["schnitt", "upload"], ["upload", "caption"]];
      let befundeDoppel = 0;
      for (const [von, nach] of wege) {
        const b = await leseBoard(u);
        const karte = { ...b.cards.find((c) => c.id === k.id), column: von };
        // Fuellkarten im Board auf „Idee" (Drive: „2 Skript") — der Abgleich muss sie alle lesen. Die Testkarte
        // steht wie beim Ziehen im Browser schon optimistisch in der Zielspalte, ihr Drive-Ordner noch nicht.
        const karten = b.cards.map((c) => (fuellIds.has(c.id) ? { ...c, column: "idee" } : c.id === k.id ? { ...karte, column: nach } : c));
        await u.api("PUT", "/api/board", { cards: karten, version: b.version });
        const strom = await u.api("POST", "/api/drive/reconcile/stream", {}, { roh: true });
        const leser = strom.body.getReader();
        let text = "";
        while (!/"stufe":"drive-karte"/.test(text)) { const { value, done } = await leser.read(); if (done) break; text += new TextDecoder().decode(value); }
        // Der Abgleich hat Drive schon aufgelistet und liest nun Karte fuer Karte — jetzt kommt der Drive-Move.
        const mov = await u.api("POST", "/api/drive/move", { card: karte, ziel: nach });
        for (;;) { const { value, done } = await leser.read(); if (done) break; text += new TextDecoder().decode(value); }
        if (text.includes("mehrfach") || mov.status >= 500) befundeDoppel++;
      }
      await u.api("POST", "/api/drive/reconcile", {});
      const abg2 = await u.api("POST", "/api/drive/reconcile", {});
      const orte = inPhasen(await findeOrdner(u, "TEST hart Abgleich"));
      const karte = (await leseBoard(u)).cards.find((c) => c.id === k.id);
      t.gleich("H3 nach Abgleich-Wettlauf genau ein Ordner", orte.length, 1);
      t.ok("H3 Board-Spalte = Drive-Phase", karte && orte[0] === `In Bearbeitung/${PHASE_ORDNER[karte.column]}/TEST hart Abgleich`, { spalte: karte && karte.column, orte });
      t.ok("H3 Dateien vollstaendig im einen Ordner", (await dateienIn(u, orte[0] || "x") || []).includes("Rohmaterial/clip.mp4"), orte);
      t.ok("H3 kein „zusammenführen“-Befund", befundeDoppel === 0 && !JSON.stringify(abg2.daten.befunde).includes("mehrfach"), abg2.daten.befunde);
    }
  } finally {
    await u.aufraeumen();
  }
  return t.ende();
}
