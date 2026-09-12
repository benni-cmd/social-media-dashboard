# v41 — board.json aus dem Tracking nehmen (Drive ist Wahrheit)

## PIG

**Problem:** `data/board.json` war seit v8/v9 im Git getrackt und wanderte nach GitHub.
Seit **v17** ist die Datei aber nur noch der schnelle **Cache** — die Single Source of Truth
liegt in Google Drive (je Karte `(AI only)/projekt.json`). Damit lag projektspezifischer,
regenerierbarer Laufzeit-Inhalt im Repo, inkonsequent zur Schwester-Cache-Datei
`data/spalten.json`, die bereits mit genau dieser Begründung gitignoriert ist. Zusätzlich
erzeugte die sich beim Benutzen ständig ändernde Datei dauerndes „uncommittet"-Rauschen.

**Intent:** Cache-Dateien gehören nicht ins Repo; die Board-Daten sollen erst existieren,
wenn Drive korrekt verbunden und abgeglichen ist [Owner, 12.09.2026].

**Goal:** `data/board.json` ist nicht mehr getrackt, per `.gitignore` ausgeschlossen (mit
Begründung), und ein frischer Klon startet mit leerem Board, das der Auto-Abgleich aus Drive
füllt.

## Bestandsaufnahme (gemessen 12.09.2026)

- `board.json` war getrackt (`git ls-files data/`), NICHT in `.gitignore`, seit v8/v9 committet
  (`git log -- data/board.json`).
- Rolle laut Code: schneller Cache, nicht Wahrheit — Wahrheit in Drive, bei Konflikt gewinnt
  Drive (`server.js:94–97`, `:292`).
- Fehlt die Datei, startet das Board leer (`leseBoard()` gibt `{version:1, cards:[]}`,
  `server.js:101–108`); der Auto-Abgleich (Start + 30 Min, Commit `3eb3d8c`) zieht aus Drive.
- Präzedenz: `data/spalten.json` ist bereits gitignoriert mit „Drive ist Wahrheit, regeneriert
  lokal — nicht committen".

## Plan

1. `git rm --cached data/board.json` — aus Index nehmen, lokale Datei bleibt.
2. `.gitignore`: `data/board.json` neben `spalten.json` eintragen, mit Begründung.
3. Commit (Löschung + `.gitignore` + dieses Paket).

## Stand

- [x] Bestand gemessen (Tracking, Cache-Rolle, leerer-Start-Pfad, Präzedenz) — 12.09.2026
- [x] `git rm --cached data/board.json`
- [x] `.gitignore`-Eintrag mit Begründung
- [x] Commit

## DoD

- `git ls-files data/board.json` liefert nichts (nicht mehr getrackt).
- `git check-ignore data/board.json` bestätigt den Ignore.
- Lokale `data/board.json` bleibt erhalten; App läuft unverändert weiter.
