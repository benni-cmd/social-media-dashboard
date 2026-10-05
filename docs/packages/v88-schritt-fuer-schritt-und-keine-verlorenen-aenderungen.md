# v88 — Schritt für Schritt, sofortiges Feedback, keine verlorenen Änderungen

> Owner-Meldungen 01.10.2026 (Screenshots im Chat):
> 1. „Auf dem ganzen Board soll die Logik herrschen, dass der User nie mit Optionen überflutet
>    wird … die Terminkachel soll erst kommen, wenn der Rest ausgewählt ist. Immer alles Step by Step."
> 2. „Der Button für das Uploaddatum hat mir kein richtiges Feedback gegeben, und mit ein paar
>    Sekunden Verspätung hatte ich auf einmal viele Meldungen, dass er gedrückt wurde."
> 3. „Slider aufbauen" soll vor den Visuals kommen; der Visual-Knopf erst nach generiertem Text.
>    Nach „Slider aufbauen" kam nur „Ein anderes Fenster hat gespeichert …" und der Text war weg.

**Problem:**
1. `public/detail.js` hatte zwei Regeln für „Worum geht es ist fertig": die Termin-Freigabe prüfte
   nur Thema+Kategorie+Ziel, das Zuklappen Typ+Kategorie+Ziel+Plattform → Termin erschien vor
   Typ/Plattform.
2. Kachel „Naechstes freies Datum" und Schalter „Naechsten freien Upload-Termin" reagierten erst
   nach `schwebendeNeuBerechnen()` (liest den Redaktionsplan aus Drive, 5–20 s in der
   Drive-Warteschlange); jeder Klick in der Zeit wurde nachgeholt → Meldungsflut.
3. Format-Flows zeigten alle KI-Schritte gleichzeitig (Slider: Aufbau + Visual).
4. **Datenverlust, zwei Wege** (gefunden beim Test 01.10.2026):
   a. Speichern mit 409 (anderes Fenster war schneller — hier: meine Test-Browser-Sitzung auf
      Bens Board) lud einfach neu → Bens frisch erzeugter Slider-Text war weg (Server-Stand
      Version 433 ohne KI-Daten, geprüft in `data/board.json`).
   b. Der Drive-Abgleich schrieb/lieferte seinen STARTSTAND: eine währenddessen angelegte Karte
      verschwand im Browser, das nächste Speichern hätte sie auch auf dem Server gelöscht.
**Intent:** Schritt für Schritt, jede Handlung sofort sichtbar, nie eine Eingabe verlieren.
**Goal:** Termin erst nach vollständigem „Worum geht es"; Uploaddatum reagiert im selben Moment
und genau einmal; KI-Schritte erscheinen nacheinander; Konflikte und Abgleich verwerfen keine
eigenen Änderungen.

## Plan

1. [x] Eine Regel `stammKomplett()` (Thema, Typ, Kategorie, Ziel, ≥1 Plattform) für Zuklappen
   UND Termin-Freigabe.
2. [x] Kachel „Naechstes freies Datum": sofort setzen/zeichnen/melden, Doppelklick-Sperre,
   Speichern + Neuverteilen im Hintergrund. Schalter: sofort zeichnen, Sanduhr „Sucht den
   nächsten freien Termin …" während der Berechnung.
3. [x] Format-Flows: Schritt n erscheint erst, wenn Schritt n−1 ein Ergebnis hat.
4. [x] 409: eigene Änderungen gegenüber dem zuletzt vom Server bestätigten Stand (`basis`) auf
   den fremden Stand legen und erneut speichern (`legeAufFremdenStand`); Meldung statt Neuladen.
   Zusätzlich: Änderung während eines laufenden Speicherns löst ein zweites Speichern aus.
5. [x] Abgleich: Ergebnis auf den NEUESTEN Board-Stand legen (`projects.abgleichAufNeuesten`);
   Browser behält während des Abgleichs angelegte Karten.
6. [x] Verify in isolierter Testkopie (Port 4399, ohne Drive, Scratchpad) — nicht mehr auf Bens
   laufendem Board.

## Status

01.10.2026 — gebaut und geprüft:
- Bens Board (Port 4321, vor dem Fund des Konflikts): neue Karte zeigt nur „Worum geht es";
  mit Typ+Kategorie+Ziel, ohne Plattform → kein Termin (Screenshot); mit Plattform → Stamm
  klappt zu, Termin erscheint (Screenshot).
- Testkopie (Port 4399): Doppelklick auf „3.11.2026" → sofort „Uploaddatum: 3.11.2026" und
  „Arbeit in Skript schreiben" (Screenshot), danach keine nachgeholten Meldungen. Simuliertes
  zweites Fenster speichert, dann Titeländerung im ersten → Meldung „Ein anderes Fenster hatte
  gespeichert … zusammengeführt (1 eigene Änderung übernommen)"; Server-Stand enthält beide
  Änderungen (Version 437). Slider-Karte: „Slider aufbauen" da, „Visual je Slide" nicht.
- Unit-Tests (Scratchpad, `node --test`): `abgleichAufNeuesten` 5/5, `legeAufFremdenStand` 2/2.
- `node --check` auf `public/detail.js`, `public/store.js`, `lib/projects.js`, `server.js`.

05.10.2026 — Testkarte „Neue Idee" (Reel, id cmupdpjxzr5yy) ist nicht mehr im Board
(`data/board.json`, Version 472) — von Ben entfernt. Server-Teil (Abgleich auf neuesten Stand)
ist per Unit-Test belegt (5/5); im Live-Betrieb wirkt er, sobald das Board mit Code ab Commit
593b2c7 läuft.

## Definition of Done

Geprueft gegen: Screenshots Bens Board + Testkopie, Unit-Tests 5/5 + 2/2, Server-Stand nach Konflikt, board.json 05.10.2026
Offen: nichts
