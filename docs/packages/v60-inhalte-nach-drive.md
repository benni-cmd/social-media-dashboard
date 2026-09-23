# v60 — Firmendaten in Drive als Wahrheit, raus aus GitHub

> Umbenannt v57→v60 (23.09.2026): „v57" war schon von der Detailspalten-Resize-Arbeit belegt.

## PIG

**Problem:** Firmen-/projektbezogene Inhalte liegen teils **nur lokal** und teils **im GitHub-Repo**:
`data/prompts.json`, `data/workflows.json`, `data/kontext.json` sind getrackt (in git); `prompts`
und `workflows` haben zudem **kein Drive-Backup** (`promptstore.js`/`workflowstore.js` schreiben nur
lokal). `kontext` ist bereits Drive-gestützt (`kontextstore.js`, `Kontext/…`). Accounts/Keys sind
korrekt **nur lokal** (kein Token/`.env`/Key in git — geprüft 23.09.2026).

**Intent (Owner 23.09.2026):** Wahrheit für alle firmen-/projektbezogenen Inhalte liegt in **Drive**;
im GitHub sollen **keine Prompts, keine firmen-/projektbezogenen Daten und keine Accounts** stehen.
Accounts/APIs bleiben ausschließlich lokal.

**Goal:** `prompts`, `workflows`, `defaults` werden Drive-gestützt (Wahrheit in Drive, lokal nur
Cache) nach dem bestehenden Muster (`planstore.js`/`kontextstore.js`), geordnet unter
`System (AI only)/`. Danach sind `prompts.json`, `workflows.json`, `kontext.json` **aus dem
Tracking genommen** (`git rm --cached` + `.gitignore`, analog board.json v41 / plan.json v48).
Nichts geht verloren: Werte VOR dem Untracken nach Drive migrieren.

## PRÜFE ZUERST (kein One-Shot)
- Bestätige: getrackte Firmendaten = `data/kontext.json`, `data/prompts.json`, `data/workflows.json`
  (`git ls-files data/`); Accounts/Keys sind NICHT getrackt (`git ls-files | grep -iE token/env/key`
  = leer). `defaults.json` ist lokal/untracked.
- Bestätige Drive-Layout & Muster: `System (AI only)/…` (planstore), `Kontext/…` (kontextstore).

## Plan
1. **Drive-Backing** für `promptstore.js`, `workflowstore.js` und `defaults` (server.js `DEFAULTS_FILE`)
   nach dem `planstore.js`-Muster: Wahrheit Drive, lokal Cache, fehlertolerant (20 s Timeout +
   Cache-Fallback, kein Blockieren), Abgleich beim Laden. Ablage `System (AI only)/prompts.json`,
   `…/workflows.json`, `…/defaults.json`. `kontext` bleibt wie es ist (schon Drive).
2. **Migration ohne Verlust:** hat Drive die Datei schon, gewinnt Drive; sonst lokalen Stand
   einmalig hochschreiben. Immer erst lokal (Cache), dann Drive spiegeln; Fehler sichtbar (Toast),
   nie stumm.
3. **Aus GitHub raus:** `git rm --cached data/prompts.json data/workflows.json data/kontext.json`
   + `.gitignore`-Einträge (mit Begründung „Drive ist Wahrheit, Firmendaten nicht ins Repo").
   Lokale Dateien bleiben als Cache erhalten.
4. **Accounts bleiben lokal:** verifizieren, dass weiterhin kein Token/Key/`.env` getrackt wird.

## Offene Owner-Entscheidung (separat, nicht blockierend)
Der bereits committete Inhalt (`prompts.json` in `3f62a25`, ältere `kontext/workflows`-Commits)
bleibt in der **git-Historie**, bis sie umgeschrieben wird (`git filter-repo`/BFG + Force-Push).
Privates Repo, nur KI-Prompts/Firmenkontext, keine Secrets → Historie-Bereinigung ist optional.
**Owner entscheidet, ob die Historie zusätzlich bereinigt wird.**

## Stand
- [ ] Schritt 0: Audit bestätigt (getrackte Firmendaten, keine Accounts in git, Drive-Layout)
- [ ] Drive-Backing prompts/workflows/defaults (Muster planstore/kontextstore)
- [ ] Migration ohne Verlust (Drive gewinnt / lokal hochschreiben)
- [ ] `git rm --cached` + `.gitignore` für prompts/workflows/kontext
- [ ] Accounts-lokal erneut verifiziert
- [ ] Verify (node --check; Beleg: Edit landet in Drive UND übersteht gelöschten lokalen Cache; kein Token in git) + Commit/Push
- [ ] Owner-Entscheidung Historie-Bereinigung eingeholt

## DoD
- Prompt-/Workflow-/Defaults-Edit landet in Drive und übersteht das Löschen der lokalen Datei
  (aus Drive wiederhergestellt).
- `git ls-files data/` enthält keine prompts/workflows/kontext mehr; weiterhin kein Token/Key/.env.
- App läuft unverändert (Cache-Fallback), nichts blockiert bei Drive-Störung.

## Koordination
Berührt `server.js` + Stores — heiße Dateien mehrerer Sessions. `session-map`/`git status` prüfen,
per `tell-session` abgrenzen. Modell: Opus 5.
