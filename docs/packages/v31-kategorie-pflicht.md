# v31 — Kategorie wird Pflicht vor "Drehtermin festlegen"

## Problem – Intent – Goal

**Problem:** Owner-Befund (05.09.2026, sinngemaess): "die Auswahl, ob das fuer Bildung
oder was auch immer ist, entsteht schon im ersten Schritt des Skriptschreibens — das
braucht es spaetestens in der zweiten Spalte, die ist sehr spartanisch, aber das ist ein
notwendiger Zwischenschritt." Am Datenstand geprueft (`data/board.json`, Spalte "skript" =
"Drehtermin festlegen"): 6 von 10 Karten dort haben `kategorie: ""` — die Wahl wurde nie
getroffen, weil `tore()` sie in der Idee-Phase nur als weiche `hinweis` fuehrt
(`sperrt: false`), waehrend Thema, Ziel und Fokus/Hook schon `sperrt: true` sind.

**Intent:** Die Kategorie-Entscheidung ist wie Ziel/Thema ein notwendiger Zwischenschritt,
kein optionales Extra — sie entscheidet ueber Redaktionsplan-Verteilung
(`saeulenVerteilung`, Wochenlast-Saeulen) und darf nicht stillschweigend leer bleiben.

**Goal:** Keine Karte kann die Idee-Phase mehr ohne Kategorie verlassen; Karten, die es
(aus der Zeit vor diesem Fix) schon ohne Kategorie in "Drehtermin festlegen" geschafft
haben, werden dort sichtbar als blockiert gefuehrt, bis die Kategorie nachgetragen ist —
nicht mit einer zweiten, doppelten Auswahl-UI, sondern indem die schon vorhandene, oben in
"Worum geht es" liegende Auswahl (bleibt offen, solange Kategorie fehlt) als "haelt die
Karte auf" zaehlt.

## Plan

1. `lib/pipeline.js` `tore()`, Zweig `p === "idee"`: den `saeule`-Tor auf `sperrt: true`
   setzen (wie `ziel` direkt daneben) und den Status bei fehlender Kategorie von `hinweis`
   auf `fehlt` aendern — Konvention der App: sperrend + fehlend heisst ueberall sonst
   `fehlt`, nie `hinweis` (siehe `thema`/`ziel`/`fokus`/`skript`/`hook` im selben Zweig).
2. `lib/pipeline.js` `tore()`, Zweig `p === "skript"`: denselben `saeule`-Tor zusaetzlich
   hier einfuegen (sperrend), damit die 6 schon betroffenen Bestandskarten in "Drehtermin
   festlegen" ab sofort korrekt als blockiert gefuehrt werden statt stillschweigend
   weiterzulaufen — sonst greift der neue Pflicht-Schalter nur fuer kuenftige Karten.
3. Keine neue UI: die Auswahl ist in `blockStamm()` bereits vollstaendig sichtbar, solange
   Kategorie fehlt (`stammVollstaendig` ist dann `false`). Der neue Tor macht sie nur
   SICHTBAR ALS PFLICHT — ueber `blockFortschritt()` ("N Punkte halten die Karte auf",
   steht seit v27 ganz oben ohne Scrollen) und den "Weiter"-Knopf (nennt den Grund beim
   Versuch weiterzugehen, `blockAbschluss()`).

## Stand

Geschrieben und umgesetzt 05.09.2026. Datenbeleg vor dem Fix: `node -e` gegen
`data/board.json` zeigte 6 Karten in Spalte "skript" mit `kategorie: ""`.

## DoD

- [ ] `saeule`-Tor in "idee" sperrend + Status `fehlt` bei leer.
- [ ] `saeule`-Tor auch in "skript" ergaenzt, sperrend.
- [ ] Screenshot: eine der 6 betroffenen Bestandskarten zeigt oben "1 Punkt haelt die
      Karte auf" und beim Versuch zu "Weiter" den Grund.
- [ ] Commit nur mit `git commit -m "…" -- lib/pipeline.js docs/packages/v31-*.md`.
