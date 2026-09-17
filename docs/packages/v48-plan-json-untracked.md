# v48 — data/plan.json aus dem Tracking nehmen (Drive-Cache, wie v41)

## PIG

**Problem:** `data/plan.json` ist getrackt, aber laut Code nur der schnelle **Cache** des
Redaktionsplans — „Drive ist Wahrheit, data/plan.json nur Cache (v17d)" (`server.js:238`,
`planCacheLesen/Schreiben`). Weil die Datei sich im Betrieb ständig ändert, taucht sie
wiederkehrend als uncommittete Änderung auf (zuletzt als Rest einer gestoppten Session) — genau
das Rausch-Muster, das v41 für `board.json` schon behoben hat.

**Intent:** Regenerierbare Cache-Dateien gehören nicht ins Repo; das wiederkehrende
„uncommittet"-Rauschen an der Wurzel beenden.

**Goal:** `data/plan.json` ist nicht mehr getrackt, per `.gitignore` ausgeschlossen; die App
läuft unverändert (fehlt der Cache, greift `pipeline.defaultPlan()`, `server.js:446`).

## Bestandsaufnahme (gemessen 17.09.2026)

- `data/plan.json` getrackt (`git ls-files data/`); Rolle Cache (`server.js:238,249–253,446`).
- Präzedenz bereits gitignoriert: `data/board.json` (v41), `data/spalten.json` (v17b) — gleiche
  „Drive ist Wahrheit, Cache lokal"-Begründung.
- NICHT angefasst: `prompts.json`, `kontext.json`, `workflows.json` — eigene Modul-Persistenz
  (`prompts/unternehmen/workflows.setzePfad`), nicht als Drive-Cache belegt. Separater Check nötig.

## Plan

1. `git rm --cached data/plan.json` (lokale Datei bleibt).
2. `.gitignore`: `data/plan.json` neben board.json/spalten.json, mit Begründung.
3. Commit (nur Löschung + `.gitignore` + dieses Paket; andere dirty Dateien unangetastet).

## Stand

- [x] Cache-Rolle belegt + andere data-Dateien abgegrenzt — 17.09.2026
- [x] `git rm --cached data/plan.json`
- [x] `.gitignore`-Eintrag
- [x] Commit + Push

## DoD

- `git ls-files data/plan.json` leer; `git check-ignore data/plan.json` bestätigt.
- Lokale Datei bleibt; App läuft (Default-Fallback vorhanden).
