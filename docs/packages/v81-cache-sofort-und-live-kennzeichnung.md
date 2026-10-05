# v81 — Board sofort aus dem Cache, „noch nicht live" überall sichtbar

> Owner-Auftrag 30.09.2026 (Antwort im Board-Rundgang): „Lass den Cache direkt anzeigen, aber in
> der Kopfzeile muss auf jeden Fall ersichtlich sein, dass das noch nicht der Live-Stand ist.
> Dafür muss es an verschiedensten Stellen (ganzes Board, einzelne Spalten, einzelne Karten,
> einzelne Teile der Detailansichten) ersichtlich sein."

**Problem:** Beim Start zeigt das Board über 30 s nur „Board wird geladen …", obwohl der lokale
Board-Cache sofort da ist. Gemessen 30.09.2026 (`curl -sk -w "%{time_total}"` je Endpunkt):
`/api/board` 0,008 s · `/api/workflows` 14,0 s · `/api/defaults` 5,5 s · `/api/plan` 9,4 s.
Der Start (`app.js`) wartet auf `ladeWorkflows()` (zweimal: im Start und in `ladeBoard()`) und
auf `ladeDefaults()`, und `ladeBoard()` wartet vor dem ersten Zeichnen auf den Plan
(`schwebendeNeuBerechnen`).
**Intent:** Sofort arbeiten können, ohne je zu glauben, man sehe schon den Drive-Stand — der
Unterschied Cache ↔ live muss auf jeder Ebene ablesbar sein.
**Goal:** Board steht < 1 s nach Seitenaufruf mit Cache-Karten; bis der Drive-Abgleich
(`/api/drive/reconcile/stream`) erfolgreich durch ist, tragen Kopfzeile, jede Spalte, jede
Karte und jeder Detail-Block, dessen Daten aus dem Cache stammen, eine sichtbare
Cache-Kennzeichnung; nach dem Abgleich verschwindet sie ebenenweise; scheitert er, bleibt sie
mit Grund stehen.

## Datenquellen je Ebene (Bestand gelesen 30.09.2026)

| Ebene | Quelle der Anzeige | „live" ab |
|---|---|---|
| Board (Kopf) | `S.cards`/`S.spalten` aus `data/board.json` | `driveAbgleich()` erfolgreich |
| Spalte | Spaltenliste + Kartenzuordnung aus Cache | wie Board |
| Karte (Kachel) | Kartenfelder aus Cache | wie Board |
| Detail: Stamm/Termine/Phase | Kartenfelder | wie Board |
| Detail: Drive-Block + Drive-Tore | `S.driveStand` (`/api/drive/scan`) | Scan der Karte fertig |

## Plan

1. [ ] Server: `/api/board` liefert `cacheStand` (mtime von `data/board.json`), damit die
   Kennzeichnung „Cache von <Datum Uhrzeit>" sagen kann.
2. [ ] Store: `S.live = { board: false, fehler: null, cacheStand }`; `driveAbgleich()` setzt
   `board = true` bei Erfolg, `fehler` bei Misserfolg.
3. [ ] Start entkoppeln: `ladeBoard()` zeichnet direkt nach `/api/board`; Workflows,
   Auto-Drehtermin und schwebende Karten laufen danach und zeichnen erneut. Doppeltes
   `ladeWorkflows()` im Start entfällt.
4. [ ] Kopfzeile: Plakette „Cache-Stand · <Zeit> — Live-Abgleich läuft" / „… fehlgeschlagen"
   links in der Werkzeugzeile; verschwindet bei live.
5. [ ] Spalte: Indikator-Platz aus v59 zeigt bis live ein Cache-Symbol (statt nichts).
6. [ ] Karte: gestrichelter Rand + Cache-Symbol-Tooltip bis live.
7. [ ] Detail: Kopf-Plakette „Cache" solange Board nicht live; Drive-Block zeigt „noch nicht
   gelesen" / Sanduhr / live getrennt.
8. [ ] Verify: Screenshot direkt nach Start (Cache sichtbar markiert) und nach Abgleich
   (Markierung weg), hell + dunkel; `node --check` aller geänderten Dateien.

## Status

30.09.2026 — Plan angelegt nach Messung und Code-Lektüre (`app.js:375-440`,
`store.js:191-208`, `store.js:419-440`, `board.js:44-48`, `detail.js:132-175`).

30.09.2026 (Übergabe an neue Session) — Schritte 1–7 als Code geschrieben, **UNGETESTET und
UNCOMMITTED** im Arbeitsbaum; `node --check` auf app.js, store.js, board.js, detail.js, ui.js,
server.js ohne Fehler. Was drin ist:
- `server.js`: `stat` importiert, `/api/board` liefert `cacheStand` (mtime `data/board.json`).
- `store.js`: `S.live = {board, laeuft, fehler, cacheStand}`; `ladeBoard()` zeichnet sofort nach
  `/api/board`, lädt Workflows danach; `driveAbgleich()` setzt `laeuft`/`board`/`fehler`.
- `app.js`: doppeltes `ladeWorkflows()` im Start entfernt; `zeichneLiveStand()` füllt die
  Kopf-Plakette `#live-stand` (Klick = Abgleich neu starten).
- `index.html`: `<button id="live-stand" class="live-plakette">` zwischen „Naechster Schritt"
  und `.kopf-rechts`.
- `board.js`: Spaltenstatus `cache` (Uhr-Zeichen) bis live; Kachel-Klasse `eintrag-cache`
  (gestrichelter violetter Rand) + Tooltip.
- `detail.js`: „Cache"-Marke im Detail-Kopf + Uhr-Zeichen an jedem Abschnitt außer Drive
  (`gruppe-drive`).
- `ui.js`: Icon `cache`, `CACHE_SATZ`, `cacheZeit()`, `cacheMarke()`.
- `style.css`: Tokens `--cache`/`--cache-tief` (hell + dunkel), Block „v81" am Dateiende.

Bewusste Entscheidung: Nach „Aktualisieren" oder 409-Neuladen bleibt `S.live.board` wie es war
(Cache wurde in dieser Sitzung schon abgeglichen und seither nur durch eigene Speicherungen
geändert).

30.09.2026 (Verify) — Schritte 1–8 abgenommen im Browser (1440x900, hell + dunkel):
- Karten < 1 s sichtbar, gestrichelter violetter Rand, Uhr-Zeichen in allen Spaltenköpfen, Cache-Marken in Detail-Kopf und Abschnitten außer „Google Drive".
- Nach Abgleich (ca. 100 s bei träger Drive-Leitung): Plakette weg, 0 Cache-Zeichen, 7 Haken in Spaltenköpfen.
- Fix aus dem Verify: Plakette schrumpfte im überlaufenden Kopf auf 24 px (nur Icon) → `flex: 0 0 auto`; `.kopf-rechts`/`.kopf-stand` bekommen `min-width: 0`.
- Beobachtung: Der Start-Abgleich beginnt erst, wenn der Start (Plan, Workflows) durch ist; bis dahin steht „noch nicht live — jetzt abgleichen" (ehrlich, Klick startet ihn). Nicht geändert.
- Nicht geprüft: Fehlerfall des Abgleichs (Plakette „fehlgeschlagen").

05.10.2026 — Fehlerfall geprüft in isolierte Testkopie (Scratchpad `board-test-3`, Port 4399, ohne echtes Drive; Strukturliste per Umgebungsvariable vorgegeben: „In Bearbeitung/Schnitt" statt „4 Schnitt"): Kopf-Plakette „Cache 05.10. 18:50 · Abgleich
fehlgeschlagen" mit roter Umrandung (Klasse `live-plakette-fehler`), Tooltip nennt den Grund
(„Der Abgleich mit Drive schlug fehl: Das Board lädt nichts aus Drive, weil die Ordnerstruktur nicht
stimmt …"); alle 20 Karten tragen die Cache-Markierung (DOM-Zählung `.eintrag-cache` = 20).
Screenshot im Browser-Pane.

## Definition of Done

Geprueft gegen: Screenshots Start/nach Abgleich hell + dunkel, Screenshot Fehlerfall, DOM-Zählung Cache-Zeichen, `node --check`
Offen: nichts
