# Work package: v46 — Karte loeschen bleibt geloescht (Drive-Ordner in den Papierkorb)

**Problem:** Eine geloeschte Karte kommt beim naechsten Board-Laden/Aktualisieren zurueck. Owner
16.09.2026: „Wenn ich Karten loesche, sind sie nach Aktualisieren/Neuladen wieder da."

**Root cause (zwei Quellen, kein One-Shot):**
- `public/store.js` `loescheKarte` entfernt die Karte NUR aus `board.json` (dem Cache) und fasst
  Drive nicht an — der Drive-Ordner bleibt (der Loesch-Dialog sagt das sogar woertlich:
  `detail.js:1753` „Der Drive-Ordner bleibt bestehen.").
- `lib/projects.js` `abgleich` (Zeilen 335–358) baut aus JEDEM Phasen-Ordner OHNE Karte im
  Board eine Karte NEU auf („In Drive lag X ohne Karte im Board. Die Karte wurde angelegt.").
  Der zurueckgelassene Ordner ist also so eine Waise → die geloeschte Karte wird resurrektiert.
- Seit v32-C3 (Auto-Abgleich beim Board-Start) passiert das jetzt bei JEDEM Laden, nicht mehr
  nur beim Button „Mit Drive abgleichen" — daher faellt es dem Owner jetzt auf.

Das ist ein Design-Widerspruch: „Ordner behalten" + „Abgleich baut Waisen zu Karten" =
Wiederkehr. Es ist KEIN Problem der Drive-Verknuepfung (die driveName ist gespeichert — genau
deshalb existiert der Ordner und wird gefunden).

**Intent:** Loeschen soll bleiben — nachhaltig, ohne die legitime Funktion „ein von Hand in
Drive angelegter Ordner wird zur Karte" zu brechen. Und nicht-destruktiv: die Skripte/Videos
sollen wiederherstellbar bleiben, nicht hart geloescht werden.

**Goal:** Eine geloeschte Karte bleibt nach Aktualisieren, Neuladen und Auto-Abgleich weg. Ihr
Drive-Ordner liegt wiederherstellbar im `Papierkorb/` (ausserhalb der Phasen-Ordner, die der
Abgleich scannt). Cards ohne Drive-Ordner loeschen weiterhin sofort.

## Plan

- `lib/projects.js` (uncontested): `export async function loesche(card)` — findet den aktuellen
  Ordner (`findeOrdner`, folgt Hand-Verschiebungen) und verschiebt ihn nach
  `Papierkorb/<name>__<zeitstempel>` (Kollisionsschutz). Kein Ordner → nichts zu tun. Scan-Cache
  (C2) fuer die Karte verwerfen.
- `server.js` (nur EINE neue Route, fern der v45-Fremdhunks): `POST /api/karte/loeschen` →
  `projekte.loesche(card)`.
- `public/store.js`: `loescheKarte` wird async und ATOMAR — hat die Karte einen `driveName`,
  ERST den Ordner in den Papierkorb (await), NUR bei Erfolg die Karte aus `board.json` nehmen +
  speichern. Schlaegt das Trashen fehl, bleibt die Karte (kein Waisen-Ordner → keine Wiederkehr).
- `public/detail.js`: Loesch-Dialog-Text ehrlich („wandert in den Papierkorb, wiederherstellbar"),
  Aufrufer awaitet + faengt Fehler ab.

**Warum kein Tombstone:** Ein „geloescht"-Merker in board.json + Abgleich-Skip waere anfaellig
fuer das board.json-Wettrennen (ein parallel laufender Abgleich koennte den Merker ueberschreiben)
und braucht Schema-Aenderungen im umkaempften server.js. Der Ordner-in-Papierkorb-Weg ist
robuster: ist der Ordner raus aus den Phasen-Ordnern, sieht ihn KEIN Abgleich mehr als Waise —
unabhaengig von Timing.

**Andere Stellen geprueft:** Feld-Edits/Umbenennen/Spaltenwechsel sind NICHT betroffen — der
Abgleich hat einen Schnellpfad (`projects.js:297`), der Karten in ihrer Phase komplett
ueberspringt; „Drive gewinnt" nur bei Hand-Verschiebung/-Umbenennung in Drive. `loescheKarte` hat
genau einen Aufrufer (`detail.js:1756`). Nur das Loeschen liess Waisen zurueck.

## Stand

Umgesetzt (16.09.2026): `lib/projects.js` `loesche(card)` (Ordner → `Papierkorb/<name>__<ts>`
via `drive.moveDir`, Scan-Cache verworfen), Route `POST /api/karte/loeschen` in `server.js`
(fern der v45-Fremdhunks bei 961+), `store.js` `loescheKarte` async + atomar (erst trashen, dann
aus Board), `detail.js` Dialogtext + Aufrufer mit await/try-catch.

**Verify (live, Server 4326, echte Drive-Aufrufe):**
- Karte OHNE Ordner: `POST /api/karte/loeschen` → `{getrasht:false}` (nichts zu tun).
- Karte MIT Ordner: `create` legt `In Bearbeitung/Idee/ZZZ Loeschtest v46` an → `loeschen` →
  `{getrasht:true, pfad:"Papierkorb/ZZZ Loeschtest v46__2026-09-16T11-53-54-241Z"}`.
- Frischer Scan danach: `vorhanden:false` ("Fuer diese Karte gibt es noch keinen Ordner in
  Drive") — der Ordner ist AUS dem Phasen-Ordner raus, den `abgleich` scannt → keine Waise →
  keine Wiederkehr. Test-Ordner danach aus dem Papierkorb entfernt (Drive tidy).
- Frontend: neue Module ausgeliefert (async loescheKarte, Endpoint-Aufruf, Papierkorb-Dialog),
  Board laedt (23 Karten), keine Konsolenfehler. `node --check` aller 4 Dateien gruen.

## DoD

- [x] `loesche` in projects.js + Route + async loescheKarte + Dialog/Aufrufer.
- [x] Live: Karte mit Drive-Ordner loeschen → Ordner im Papierkorb, aus Phasen-Ordner raus
      (Scan `vorhanden:false`) → Abgleich sieht keine Waise mehr.
- [x] Karte OHNE Drive-Ordner loeschen → `{getrasht:false}`, kein Fehler.
- [x] Trashen fehlgeschlagen → Karte bleibt (await wirft VOR dem Entfernen), Fehlermeldung —
      code-verifiziert (Fehlerpfad nicht kuenstlich ausgeloest).
- [x] `node --check` aller geaenderten Dateien gruen.
- Andere Stellen geprueft: nur Loeschen liess Waisen zurueck (Edits/Umbenennen/Move sicher via
  Schnellpfad/driveVerschiebe); `loescheKarte` hat genau einen Aufrufer.
