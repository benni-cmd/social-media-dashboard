# v59 — Spalten-Kopf: Drive-Status-Indikator links neben der Karten-Anzahl

> Umgesetzt 23.09.2026.

## PIG

**Problem:** Owner-Auftrag 23.09.2026: die Board-Spalten zeigen nur die Karten-Anzahl
(`.spalte-anzahl`) im Kopf — ob fuer die Karten darin gerade Drive-Daten geladen werden oder
die Spalte mit Drive abgeglichen ("live") ist, war bisher nur PRO KARTE sichtbar (Sanduhr an
der einzelnen Kachel, `board.js:kachel()`), nicht auf einen Blick fuer die ganze Spalte.

**Intent:** Auf den ersten Blick am Spaltenkopf erkennen, ob dort gerade Drive-Arbeit
passiert oder die Spalte aktuell ist — ohne jede Karte einzeln absuchen zu muessen.

**Goal:** Links neben `.spalte-anzahl` ein kleiner Indikator: drehende Sanduhr, solange
irgendeine Karte der Spalte gerade gescannt wird; gruenes Haekchen, sobald die Spalte
(mindestens eine Karte) echten Drive-Stand traegt und nichts mehr laeuft. Kein Indikator,
wenn noch nie eine Karte der Spalte gescannt wurde — sonst wuerde ein Abgleich behauptet,
der nie stattgefunden hat.

## Umsetzung

- `board.js`: neue Funktion `spalteDriveStatus(karten)` — liest denselben Zustand, den die
  Kachel schon pro Karte nutzt (`S.driveScanLaeuft`, `S.driveStand`), nur pro Spalte
  aggregiert: `"laedt"` wenn irgendeine Karte gerade scannt, sonst `"live"` wenn irgendeine
  Karte einen Drive-Stand traegt, sonst `null` (kein Indikator).
- `zeichneBoard()`: baut `.spalte-kopf-rechts` als neuen Wrapper um `.spalte-drive-status`
  (bei Bedarf) + `.spalte-anzahl` — noetig, weil `.spalte-kopf-zeile` bereits
  `justify-content:space-between` mit GENAU zwei Kindern (Name links, Rest rechts) nutzt; ein
  drittes Element direkt daneben haette space-between in die Mitte gezogen statt es an die
  Anzahl zu kleben.
- `style.css`: `.spalte-kopf-rechts` (Flex, kleiner Gap), `.spalte-drive-status` (13px-Icon,
  wiederverwendet dieselbe `sanduhr-dreht`-Animation wie die Kachel inkl.
  `prefers-reduced-motion`-Ausnahme; live-Zustand in `var(--ok)`).

## Verify (Browser, 23.09.2026)

- Frischer Ladezustand: keine Spalte zeigt einen Indikator (noch keine Karte gescannt) —
  korrekt, kein falscher Abgleich behauptet.
- Karte in „Videodreh" geoeffnet (loest Drive-Scan aus): Spaltenkopf zeigt sofort die drehende
  Sanduhr (`spalte-drive-status-laedt`), nach Abschluss automatisch das gruene Haekchen
  (`spalte-drive-status-live`) — beides per DOM-Klassenpruefung UND Screenshot (500×400-
  Viewport, „Videodreh"-Kopf zeigt Haekchen links neben der „1") bestaetigt.
- Andere Spalten bleiben ohne Indikator, da fuer sie noch nichts gescannt wurde.

## Stand

- [x] Bestand geprueft (`kachel()`-Sanduhr-Muster, `.spalte-kopf-zeile`-Layout) — 23.09.2026
- [x] Umsetzung
- [x] Verify (Browser: laedt → live Uebergang, Screenshot)
- [ ] Commit + Push

## DoD

- Spaltenkopf zeigt links neben der Karten-Anzahl eine Sanduhr, solange fuer die Spalte
  Drive-Daten geladen werden.
- Sobald geladen (und nichts mehr laeuft): gruenes Haekchen an derselben Stelle.
- Keine Behauptung eines Abgleichs, der nie stattfand (kein Indikator ohne jemals gescannte
  Karte in der Spalte).
