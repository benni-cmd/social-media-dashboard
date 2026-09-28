# v76 — Drehtermin-Popup: Knopf-Umbruch, echter Schliessen-Knopf

> 28.09.2026. Gebaut und im Browser geprueft.

**Problem:** Im Drehtermin-Detail-Popup ragte der Knopf "Loeschen" aus dem Fenster heraus
(4 Knoepfe in einer nicht umbrechenden Zeile quetschten sich zusammen); oben rechts stand eine
rein dekorative Flaeche, die wie ein Schliessen-Knopf aussieht, aber nichts tut.
**Intent:** Layout ohne Ueberlauf, und was wie ein Knopf aussieht, ist auch einer.
**Goal:** Knopfreihe bricht sauber um; ein echter × schliesst das Popup.

## Umsetzung
- `public/ui.js`: neuer Baustein `modalX(klick, titel)` — EIN echter Schliessen-Knopf fuer jeden
  `.modal-frage`-Kopf (ersetzt die dekorative `::after`-Flaeche, die nur im Redaktionsplan-Popup
  zufaellig schon einen echten Knopf obendrauf hatte, in den anderen drei Modalen aber nicht).
- Eingesetzt in: `drehtermine.js` (modalDrehtermin + Drehtermin-Detail), `ui.js` (modalKalender),
  `redaktionsplan.js` (ersetzt dessen lokalen `xBtn`).
- `public/style.css`: `.modal-frage::after` entfernt, `.modal-x` (echter Knopf, gleiche Position/
  Optik). `.modal-knoepfe` bekommt `flex-wrap: wrap`, Knoepfe darin `flex:0 0 auto; white-space:
  nowrap` — quetschen sich nicht mehr zusammen, brechen stattdessen in eine zweite Zeile um.

## Verify (Browser, 28.09.2026)
- Drehtermin-Detail: 4 Knoepfe jetzt in 2 sauberen Zeilen, keiner ragt heraus; × oben rechts
  schliesst das Popup.
- Redaktionsplan-Popup: × an gleicher Stelle/Optik wie vorher, schliesst weiterhin korrekt.

## Stand
- [x] Bau, Verify (Drehtermin-Detail + Redaktionsplan live getestet)
- OFFEN: modalDrehtermin (Neu/Bearbeiten) und modalKalender nur per Code-Pfad, nicht per Klick
  im Browser gegengeprueft (gleiche `modalX()`-Funktion wie die zwei getesteten Stellen).
