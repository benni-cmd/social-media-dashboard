# v56 — Karten-Status: Glyphe bei Aufmerksamkeit (v50 V2, Owner-OK 22.09.2026)

## PIG

**Problem:** Der Status-Punkt oben rechts auf jeder Karte (`public/board.js` `kachel()`, `:71–73`,
`.eintrag-punkt`) ist reine Farbe. Haus-Regel 3 (`docs/ui-standard.md`): „Status als Wort, nicht
Farbe allein". Die Kachel soll aber bewusst knapp bleiben (`board.js:56–58`).

**Intent:** Aufmerksamkeits-Zustände ohne Hovern/Farbsehen erkennbar — ohne die Übersicht zu
verdichten. Owner-Entscheidung (22.09.2026): Glyphe **nur** bei Aufmerksamkeit, neutral bleibt Punkt.

**Goal:** Die Codes **`befund`** (überfällig/unter Schnitt) und **`fehlt`** (Datum/Blocker fehlt)
zeigen statt des gefüllten Punkts eine kleine Lucide-Glyphe in der Statusfarbe (Icon aus der
kanonischen `STATUS`-Map: befund→`achtung`, fehlt→`kreis`). ok/hinweis/unlesbar/entfaellt bleiben
schlichter Punkt. Hover-Satz/`aria-label` unverändert.

## Umsetzung (22.09.2026, in dieser Session gebaut)

- `board.js`: `STATUS` aus `ui.js` importiert; Aufmerksamkeits-Set `{befund,fehlt}`; statusHtml
  rendert für diese Codes `icon(STATUS[code].icon)` in einem `.eintrag-punkt.eintrag-punkt-glyphe`.
- `style.css`: `.eintrag-punkt-glyphe` hebt den gefüllten Punkt auf (kein Hintergrund, auto-Größe),
  Icon ~13px in Statusfarbe.

## Stand

- [x] Owner-OK (Glyphe nur Aufmerksamkeit) — 22.09.2026
- [x] board.js: STATUS-Import + Glyphe für befund/fehlt
- [x] style.css: `.eintrag-punkt-glyphe`
- [x] Verify: node --check + DOM/Screenshot (überfällige Karte zeigt Glyphe, ok-Karte nur Punkt)
- [x] Commit + Push

## DoD

- Überfällige/blockierte Karte (`befund`/`fehlt`) trägt eine formunterscheidbare Glyphe, kein reiner Farbpunkt.
- Neutrale Karten unverändert (Punkt); Hover-Satz bleibt; keine zusätzliche Textdichte.
