# v53 — Board-Karten duerfen beim vertikalen Platzmangel nicht schrumpfen

> Umgesetzt 22.09.2026, nach Owner-Antworten auf die vier Rueckfragen unten.

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

## Owner-Antworten (22.09.2026)

1. **Spaltenbreite:** fixieren (immer 260px) — nichts am Board atmet mehr, nur noch scrollen.
2. **`.spalte-fuss`:** immer sichtbar halten (Variante a).
3. **Reichweite:** ueberall gleich absichern — auch Drehtermin-Kacheln und KPI-Kacheln.
4. Browser-Messung + Screenshot als Abnahme (implizit, keine eigene Nachpruefung verlangt).

## Umsetzung

- `public/style.css`:
  - `.eintrag { flex-shrink: 0; }` — Kernfix, Board-Karten schrumpfen nie mehr.
  - `.spalte { flex: 0 0 260px; }` statt `flex:1 1 260px; min-width:230px; max-width:320px` —
    feste Breite, alte v23-2-Kommentar (atmend) ersetzt.
  - `.spalte-kopf`, `.spalte-fuss`: `flex-shrink: 0`.
  - `.spalte-liste`: `min-height: 56px` → `min-height: 0` (+ `flex-shrink:1` explizit) — sonst
    wurde bei extremem Platzmangel der Fuss durch die alte 56px-Mindesthoehe der Liste
    verdraengt (mit Browser-Messung nachgewiesen, siehe unten).
  - `.spalte`: bewusst OHNE `overflow:hidden` — bei einem Fenster, das nicht mal Kopf+Fuss
    Platz gibt (< ~300px Board-Hoehe, unrealistisch klein), soll der Fuss sichtbar ueber den
    Rand ragen (und per `.board-scroll` erreichbar bleiben) statt unsichtbar+unklickbar hinter
    dem Rand zu verschwinden — mit `overflow:hidden` waere er dort komplett verloren gewesen.
  - `.drehkachel`, `.kpi`: `flex-shrink: 0` ergaenzt (Reichweite-Antwort). Bei `.kpi` heute
    inert (Auswertung nutzt CSS-Grid, kein Flex-Vater, also nicht wirklich gefaehrdet) — trotzdem
    gesetzt, damit die Regel ueberall im Code sichtbar/konsistent steht.

## Verify (Browser-Messung, 22.09.2026)

- `1000×500` (Original-Repro): alle Karten einheitlich 89.4px hoch (vorher 24px in vollen
  Spalten), Spaltenbreite exakt 260px, jede Spalte scrollt einzeln (`.spalte-liste.scrollHeight`
  744-1233px bei 190-283px sichtbarer Hoehe) — Screenshot bestaetigt: Icons/Symbole wieder klar
  lesbar.
- `1000×280` (Stresstest, absichtlich unrealistisch klein): „Karte anlegen"/„Idee von der KI"
  zunaechst noch teils unter dem sichtbaren Rand — nach `min-height:0` auf `.spalte-liste` beide
  Knoepfe im normalen Board-Scroll erreichbar (herunterscrollen zeigt „Idee von der KI"
  vollstaendig), nichts mehr unsichtbar/unklickbar hinter einem `overflow:hidden`-Rand.
- `1000×700`: horizontale Achse unveraendert korrekt — 8 Spalten auf 260px, `.board.scrollWidth`
  1944px > `.board.clientWidth` 1000px, Board scrollt horizontal wie vorgesehen.
- Default-Fenstergroesse: normaler Board-Screenshot optisch geprueft, keine Regression.

## Nachlese (22.09.2026, Owner-Fund nach dem ersten Commit)

Owner-Screenshot nach `3e05bca`: Spalten sichtbar unterschiedlich breit ("Skript schreiben"
305px statt 260px). Nachgemessen, nicht geraten — Ursache: NUR die "idee"-Spalte (einzige mit
`.spalte-fuss`) war betroffen. Grund: ich hatte `.spalte` bewusst OHNE `overflow:hidden` gebaut
(fuer den 1000×280-Stresstest), aber genau das schaltet Flexbox' automatische Mindestbreite frei
— bei sichtbarem Overflow zieht der Browser den breitesten Nachfahren-Inhalt (hier: die
`.knopf-breit`-Fuss-Knoepfe) als Breiten-Untergrenze der Spalte heran. Live geprueft: mit
`overflow:hidden` sofort wieder exakt 260px ueberall, Knoepfe passen einwandfrei bei 226px
Innenbreite (einzeilig, kein Textabschnitt). `.knopf-breit{min-width:0}` allein hatte KEINE
Wirkung (Beleg: bleibt bei 305px) — bestaetigt, dass die Spalte selbst die Quelle war, nicht der
Knopf. Fix: `overflow:hidden` auf `.spalte` zurueckgebracht.

Tausch bewusst akzeptiert (einheitliche Breite hat laut Owner Vorrang): der 1000×280-Randfall
aus der ersten Runde (Fuss wird bei < ~160px Board-Hoehe wieder unsichtbar statt per Scroll
erreichbar) ist damit wieder da. Unrealistisch kleines Fenster, von Ben nie gemeldet — nur von
mir selbst als Stresstest gebaut. Wenn das doch stoeren sollte: sag Bescheid, dann brauchts einen
cleveren Mindesthoehen-Mechanismus statt overflow:visible.

## Stand

- [x] Ursache im Browser nachgemessen (nicht geraten) — 22.09.2026
- [x] Fix-Hypothese live getestet (Style-Injektion, keine Datei geaendert)
- [x] Owner-Antworten auf die vier Fragen
- [x] Umsetzung
- [x] Verify (Resize-Screenshots, drei Fenstergroessen + Default)
- [x] Nachlese: Spaltenbreite-Regression gefunden, nachgemessen, gefixt, erneut verifiziert
- [x] Commit + Push

## DoD

- [x] Karten behalten ihre natuerliche Groesse unabhaengig von Fensterhoehe/Kartenzahl in der Spalte.
- [x] Jede Spalte scrollt vertikal einzeln, Spaltenkopf bleibt sichtbar.
- [x] Horizontales Scrollen des Boards unveraendert (war nicht kaputt).
- [x] `.spalte-fuss` bleibt in normalen Fenstergroessen erreichbar (Randfall < ~160px Board-Hoehe
      bewusst in Kauf genommen, siehe Nachlese).
- [x] Spaltenbreite fest 260px, ausnahmslos alle Spalten (Owner-Nachlese-Fund behoben).
- [x] Drehtermin-Kacheln + KPI-Kacheln ebenfalls abgesichert (Owner-Entscheidung).
