# v47 — Redaktionsplan: schnelles Öffnen, echtes Popup, sofortige Vorschau

## PIG

- **Problem** — Der Redaktionsplan (a) braucht beim Klick auf den Button sehr lange,
  bis er erscheint; (b) taucht inline im Board auf und drückt es nach unten statt als
  Popup auf eigener Ebene; (c) seine Kalender-Vorschau aktualisiert sich erst nach
  Schließen+Neuöffnen, nicht sofort beim Speichern der Einstellungen.
- **Intent** — Der Redaktionsplan soll sich anfühlen wie die übrigen Werkzeuge des
  Boards: sofort da, als klar abgegrenztes Overlay, mit Live-Rückmeldung beim Speichern.
- **Goal** — (1) Panel erscheint < 300 ms nach Klick, unabhängig von der Drive-Latenz.
  (2) Es liegt als `.modal-overlay`/`.modal`-Popup über dem Board (Muster aus
  `drehtermine.js`), Klick außerhalb + × schließen. (3) Ein Speichern zeichnet die
  Kalender-Vorschau sofort mit den neuen Werten neu — belegt per Browser-Screenshot.

## Befund (geprüft 16.09.2026)

- **F1 Ursache** — `zeigeRedaktionsplan` macht `await ladePlan()` VOR dem Panel-Bau
  (`redaktionsplan.js:112`). `GET /api/plan` liest synchron von Google Drive
  (`planstore.leseConfigVonDrive` + `abgleiche`, bis mehrere rclone-Aufrufe à 20 s;
  dokumentiert `planstore.js:58-69`). Der Button hängt an Drive.
- **F2 Ursache** — `anker.insertBefore(panel, anker.firstChild)` (`redaktionsplan.js:114`)
  hängt das Panel in `#nachschub`, kein Overlay/z-index.
- **F3 Status** — Code-Pfad sieht korrekt aus (`currentPlan = neuerPlan; nachSpeichern()`
  → `kalenderRendere()`, `slotsForMonth` rein clientseitig). Wird LIVE reproduziert,
  bevor gefixt wird — kein Fix ohne reproduzierten Fehler.

## Plan

1. **F2+F1 zusammen** — `zeigeRedaktionsplan` baut synchron ein `.modal-overlay` +
   `.modal modal-plan`, hängt es an `document.body`, zeigt sofort einen Lade-Zustand.
   Danach `ladePlan()` async; bei Auflösung Inhalt (Einstellungen + Kalender) einsetzen.
   Klick außerhalb + × schließen; erneuter Button-Klick togglet.
2. **CSS** — `.modal-plan`-Variante (breiter, scrollbar) in `style.css`, Muster der
   bestehenden `.modal-*`-Regeln.
3. **F3** — nach Live-Reproduktion: sicherstellen, dass Speichern die Vorschau sofort
   neu zeichnet. Fix erst nach bestätigtem Fehlerbild.
4. **Verify** — echter Screenshot: Öffnen-Tempo, Overlay über Board, Speichern→Vorschau.

## Stand

- [x] F1 sofortiges Öffnen — Modal erscheint sofort mit „wird geladen …"; zweites
  Öffnen rendert komplett aus Cache (Reopen gemessen: **1 ms**, Kalender sofort da).
- [x] F2 Modal-Overlay — `.modal-overlay`/`.modal modal-plan` über abgedunkeltem Board,
  ×-Knopf + Klick-außen + Esc schließen (× live geprüft: Modal weg).
- [x] F3 Vorschau live — Speichern zeichnet die Vorschau **1 ms** nach Klick neu
  (14 blau→14 lila belegt), Drive-PUT läuft im Hintergrund weiter.
- [x] Screenshot-Abnahme — 3 Screenshots: Sofort-Öffnen (Ladezustand), gefülltes
  Modal, Reopen aus Cache.

### Gemeinsame Ursache (Befund v47)

F1 und F3 hingen am selben Kern: der Client blockierte auf synchrone Drive-Round-Trips.
Live gemessen: `GET /api/plan` = **34,8 s** (Konsole: `await fetch('/api/plan')`); der
alte Speichern-Handler machte intern nochmal `await ladePlan()` vor dem Neuzeichnen →
Vorschau erst nach ~20–30 s, daher „erst nach Neuöffnen sichtbar".

**Fix (nur Client, Server/Drive-Wahrheit unangetastet):**
- `zeigeRedaktionsplan` baut das Modal synchron, füllt Inhalt nach `ladePlan()`; `currentPlan`
  überlebt Schließen → Reopen sofort aus Cache.
- Speichern setzt `neuerPlan` aus `currentPlan` + Formular zusammen (kein Re-Read),
  zeichnet sofort neu, persistiert per `speicherePlan()` im Hintergrund.

### Geänderte Dateien

- `public/redaktionsplan.js` — Modal statt Inline-Panel, Sofort-Öffnen + Cache-Reopen,
  Speichern ohne Drive-Blockade.
- `public/board.js` — Aufruf `zeigeRedaktionsplan()` ohne Anker-Argument.
- `public/style.css` — `.modal-plan`, `.modal-plan-koerper`, `.plan-schliessen`.

## DoD

- Panel < 300 ms sichtbar (unabhängig von Drive), Overlay über Board, Speichern
  aktualisiert Vorschau sofort — je per Browser-Screenshot belegt.
- Bestehendes Modal-Muster wiederverwendet, kein neues erfunden.
- Paket nachgeführt, committet, gepusht.
