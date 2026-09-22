# v53 — Board-Karten duerfen beim vertikalen Platzmangel nicht schrumpfen

> PLAN-Paket, angelegt 22.09.2026. Noch NICHT gebaut — Owner will Rueckfragen beantwortet
> haben, bevor irgendwas angefasst wird ("frag mich alles, rate an keiner Stelle").

## PIG

**Problem:** Owner-Meldung 22.09.2026 (Screenshot „Drehtermin festlegen"): beim vertikalen
Scrollen werden die Karten in vollen Spalten zusammengedrueckt, Symbole/Icons darin nicht mehr
erkennbar. Ursache im Browser nachgemessen (nicht geraten):

- Bei `1000×500`: Karten in „Skript schreiben"/„Drehtermin festlegen" (viele Karten) sind
  **24px hoch**. Karten in „Videodreh"/„Fertig" (wenige Karten, passen ohnehin) sind **89.4px**
  hoch — das ist die eigentlich vorgesehene Kartenhoehe.
- Grund: `.board-scroll` (v52, meine eigene Umbau-Aenderung fuer die angepinnte Leiste) ist
  `display:flex; flex-direction:column`. `.board` ist darin ein Flex-Kind OHNE `flex-shrink:0`
  — Flexbox-Standard ist `flex-shrink:1`. Wird die Spalte mit den meisten Karten hoeher als der
  sichtbare Bereich, quetscht Flexbox `.board` und darueber kaskadierend `.spalte` →
  `.spalte-liste` → jede einzelne `.eintrag`-Karte zusammen, STATT dass `.spalte-liste`
  (hat bereits `overflow-y:auto`) einfach scrollt. Das ist eine Regression aus meinem eigenen
  v52-Umbau (vorher war `#ansicht-board` kein Flex-Container, Karten konnten nicht kaskadierend
  gequetscht werden).
- Live im Browser geprueft (testweise `.eintrag{flex-shrink:0}` per injiziertem `<style>`, keine
  Datei geaendert): Karten bleiben bei 89.4px, Spaltenkopf bleibt stehen, JEDE Spalte scrollt
  wieder einzeln (`.spalte-liste.scrollHeight` 1251px bei nur 283px sichtbarer Hoehe) — exakt das
  Verhalten von vor dem v52-Umbau, nur mit der neu angepinnten Leiste obendrauf.
- Horizontale Achse ist NICHT betroffen: bei `1000×700` sitzen alle 8 Spalten sauber auf ihrer
  `min-width:230px`-Untergrenze, `.board.scrollWidth` (1944px) > `.board.clientWidth` (1000px) —
  `min-width` schuetzt die Breite bereits zuverlaessig, `.board-scroll` scrollt horizontal wie
  vorgesehen. Kein Fund hier.
- Nebenfund bei extremer Hoehen-Not (1000×280, mit dem Karten-Fix aktiv): `.spalte-fuss` (die
  Knoepfe „Karte anlegen"/„Idee von der KI" in der ersten Spalte) werden aus der Spalten-Box
  HERAUSGEDRUECKT (`spalte.bottom` 245px, aber `fuss.bottom` 328px, `.spalte` hat kein
  `overflow:hidden`) — die Knoepfe haengen dann sichtbar unter der Spalten-Karte in der Luft.
  Noch nicht behoben, siehe Frage 2 unten.

**Intent (so verstehe ich die Essenz — bitte korrigieren, falls falsch):** Das Board ist wie eine
feste Flaeche/Leinwand: Kartengroesse und Spalten-Anordnung bleiben IMMER gleich, unabhaengig von
Fenstergroesse/Zoom. Ist nicht genug Platz da, wird gescrollt (vertikal pro Spalte, horizontal
uebers ganze Board) — nichts schrumpft, nichts passt sich an. Die Ebene DARUEBER (Kopfzeile,
die angepinnte Redaktionsplan/Drehtermine-Leiste) darf sich weiterhin flexibel/responsiv
verhalten (umbrechen, kleiner werden) — nur die Kartenflaeche selbst nicht.

**Goal (Vorschlag, ungebaut):** `.eintrag` bekommt `flex-shrink: 0` (plus denselben Schutz fuer
`.spalte-fuss`, damit die Anlage-Knoepfe nicht aus der Spalte rutschen). Karten behalten ihre
Groesse unabhaengig von der Kartenzahl in der Spalte; jede Spalte scrollt einzeln, Spaltenkopf
bleibt stehen; Board-weit bleibt der horizontale Scroll unveraendert (dort besteht kein Fehler).

## Offene Fragen — bitte beantworten, ich rate nicht

1. **Spaltenbreite:** Aktuell `flex:1 1 260px; min-width:230px; max-width:320px` — die Breite
   „atmet" zwischen 230 und 320px, je nach Fensterbreite/Spaltenzahl. Soll das GENAUSO bleiben
   (nur die Karten-HOEHE ist das Problem), oder soll die Spaltenbreite ebenfalls auf einen festen
   Wert fixiert werden (z. B. immer 260px), sodass wirklich nichts am Board mehr „atmet" und
   ausschliesslich horizontal gescrollt wird?
2. **`.spalte-fuss`-Nebenfund:** Sollen „Karte anlegen"/„Idee von der KI" bei extremem
   Platzmangel (a) IMMER sichtbar bleiben (Spalte bekommt eine Mindesthoehe, die Kopf+Fuss+ein
   Stueck Liste garantiert, `.spalte` kriegt `overflow:hidden` gegen das Herausrutschen), oder
   (b) darf die ganze Spalte in diesem Extremfall selbst vertikal scrollen (Kopf scrollt dann mit
   weg, nicht mehr angepinnt)? Ich tendiere zu (a), weil es zu deiner Regel „das Arrangement
   bleibt gleich" passt — aber das ist meine Einschaetzung, keine Owner-Entscheidung.
3. **Reichweite:** Nur `.eintrag` (Board-Karten) fixen, oder soll dieselbe Nie-schrumpfen-Regel
   auch fuer andere Karten-Typen gelten, die technisch denselben Flex-Aufbau haben (z. B.
   Drehtermin-Kacheln in der Leiste, KPI-Kacheln in der Auswertung)? Die Meldung nennt nur das
   Board — ich will nicht stillschweigend mehr anfassen als gefragt.
4. **Test-Beleg:** Reicht dir die Browser-Messung + Screenshot (wie oben) als Abnahme, oder
   willst du selbst nochmal am echten Fenster nachscrollen, bevor ich committe?

## Plan (nach Antworten)

1. `public/style.css`: `.eintrag { flex-shrink: 0; }` ergaenzen (Kernfix).
2. Je nach Antwort 2: `.spalte-fuss`-Schutz + ggf. `.spalte{overflow:hidden}`.
3. Je nach Antwort 1: Spaltenbreite fixieren statt `flex:1 1 260px`.
4. Je nach Antwort 3: dieselbe Regel auf weitere Kartentypen uebertragen.
5. Verify: Browser-Resize-Test (kurz + extrem kurz), Screenshot vor/nach, gegen die
   Nie-schrumpfen-Regel aus Intent gegenpruefen.
6. Commit + Push.

## Stand

- [x] Ursache im Browser nachgemessen (nicht geraten) — 22.09.2026
- [x] Fix-Hypothese live getestet (Style-Injektion, keine Datei geaendert)
- [ ] Owner-Antworten auf die vier Fragen
- [ ] Umsetzung
- [ ] Verify (Resize-Screenshots)
- [ ] Commit + Push

## DoD

- Karten behalten ihre natuerliche Groesse unabhaengig von Fensterhoehe/Kartenzahl in der Spalte.
- Jede Spalte scrollt vertikal einzeln, Spaltenkopf bleibt sichtbar.
- Horizontales Scrollen des Boards unveraendert (war nicht kaputt).
- `.spalte-fuss` bleibt sichtbar/an der Spalte, rutscht nicht heraus.
