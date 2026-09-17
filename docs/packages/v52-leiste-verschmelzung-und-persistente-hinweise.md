# v52 — Redaktionsplan/Drehtermine verschmelzen, Google/Drive in den Kopf, Hinweise als Notification

## PIG

**Problem:** Die Wochenlast-Zeile (Redaktionsplan-Knopf) und die Drehtermine-Zeile liegen als
zwei getrennte Baelken UEBER dem Board, scrollen aber mit dem Board-Inhalt weg (`#ansicht-board`
ist EIN `overflow:auto`-Container fuer Wochenlast+Drehleiste+Nachschub+Board) — anders als die
Kopfzeile, die als eigene Flex-Zeile ausserhalb der Scrollflaeche liegt. Der Google-Verbunden-Chip
haengt in der Drehtermine-Zeile und verschwindet mit ihr. `melde()` (Hinweise/Fehlermeldungen)
schreibt in eine feste Zeile (`#meldung`) direkt unter der Kopfzeile — leicht uebersehen, und ein
neuer Aufruf ueberschreibt den vorigen Inhalt, bevor er gelesen wurde. Owner-Auftrag, 17.09.2026.

**Intent:** Ausblick-Infos (naechste Drehtermine, Redaktionsplan-Zugriff, Verbindungsstatus)
sollen so verlaesslich sichtbar sein wie die Kopfzeile, nicht wegscrollbar. Hinweise/Fehler duerfen
nicht durch Ueberschreiben oder Uebersehen verloren gehen.

**Goal:**
1. Wochenlast- und Drehtermine-Zeile sind zu einer Zeile verschmolzen, die wie die Kopfzeile
   ausserhalb der Board-Scrollflaeche liegt (bleibt stehen, egal wie weit im Board gescrollt wird).
2. In dieser Zeile: „Drehtermin"-Knopf (neuer Termin) ganz links, „Redaktionsplan"-Knopf ganz
   rechts.
3. Ein Google+Drive-Badge (Kalender verbunden + Drive erreichbar + letzter Live-Abgleich) sitzt in
   der Kopfzeile statt in der verschmolzenen Zeile.
4. `melde()` erzeugt eine Popup-Notification (wie die bestehenden Toasts), die NICHT automatisch
   verschwindet, sondern nur durch aktives Wegklicken — die alte `#meldung`-Zeile entfaellt.

## Plan

- `index.html`: `#meldung`-Zeile entfernen; `#ansicht-board` in `#board-leiste` (nicht scrollend,
  enthaelt `#drehleiste` + `#wochenlast`) und `#board-scroll` (scrollend, enthaelt `#nachschub` +
  `#board`) aufteilen; neues `#google-drive-badge` in `.kopf-rechts`.
- `style.css`: alte `.meldung`-Zeilen-Regeln (Zeile ~1294) loeschen (von den Toast-Regeln weiter
  unten ohnehin ueberschrieben, aber jetzt tote Zeilen-CSS); `.board-leiste`/`.board-scroll` neu;
  `.wochenlast`/`.drehleiste` von eigenstaendigen Baelken zu verschachtelten Flex-Kindern
  umbauen (`.drehleiste` waechst, `.wochenlast` bleibt kompakt am rechten Rand);
  `.drehleiste-neu` verliert `margin-left:auto` (steht jetzt zuerst, nicht zuletzt);
  `.kopf-badge` neu fuer den Google/Drive-Indikator.
- `drehtermine.js`: „Drehtermin"-Knopf zuerst anhaengen (statt zuletzt); Google-Verbunden-Chip aus
  der Zeile entfernen (Zustand/Lazy-Load bleibt fuer den bestehenden Sync-Knopf im Termin-Detail
  erhalten, nur die Anzeige in der Leiste faellt weg).
- `ui.js`: neue Funktion `hinweisToast(status, satz)` — Toast wie `meldung()`, aber mit
  `statusChip()` (sechs Status-Woerter, nicht nur gruen/rot) und OHNE Auto-Timeout.
- `store.js`: `melde()` ruft `hinweisToast()` statt in `#meldung` zu schreiben; `meldungEl`/
  `meldungWeg`/den zweiten `verdrahteKopf()`-Parameter entfernen (tot nach dem Umbau).
- `app.js`: `verdrahteKopf(el("stand"))` (ohne zweiten Parameter); „Abgleichen"-Handler zeigt seine
  Befunde als `hinweisToast()` pro Fund statt die alte `#meldung`-Liste zu bauen; neues
  Google/Drive-Badge (`gcalStatus()` + `driveStatus()` + Erfolg/Fehler der Abgleiche) speist
  `#google-drive-badge`.
- Verify: Board im Browser gegen ~15+ Karten/Testdaten, Screenshot vor/nach, Scroll-Test (Zeile
  bleibt stehen), Hinweis ausloesen (Popup bleibt bis Klick), Badge-Zustand pruefen.

## Stand

- [x] Bestand studiert (index.html, board.js, drehtermine.js, store.js, app.js, ui.js, style.css)
- [x] index.html umgebaut
- [x] style.css umgebaut
- [x] drehtermine.js umgebaut
- [x] ui.js: `hinweisToast()`
- [x] store.js: `melde()` auf Toast umgestellt
- [x] app.js: Kopf-Verdrahtung, Abgleichen-Handler, Google/Drive-Badge
- [x] Optische Abnahme im Browser (Screenshot, Scroll-Test, Popup-Test)
- [ ] Commit + Push

## DoD

- Leiste bleibt beim Scrollen im Board stehen (wie die Kopfzeile).
- „Drehtermin" ganz links, „Redaktionsplan" ganz rechts in der verschmolzenen Zeile.
- Google/Drive-Badge steht in der Kopfzeile, zeigt Kalender+Drive+Abgleich-Zustand.
- Ein `melde()`-Aufruf zeigt ein Popup, das nur durch Klick auf Schliessen verschwindet.
