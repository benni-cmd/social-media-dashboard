# v54 — Rechtsklick-Kontextmenue an der Board-Karte

> Geplant 22.09.2026. Nummer v54 (v53 „board-karten-nicht-zusammendruecken" ist vergeben).

## PIG

**Problem:** Karten-Aktionen (verschieben, verwerfen, loeschen, Termin zuweisen …) sind heute
nur ueber das Oeffnen der Karte in der Detailspalte erreichbar. Ein Rechtsklick direkt auf die
Projektkarte (`.eintrag`, gerendert in `public/board.js` `kachel(k)`) fehlt.

**Intent:** Haeufige Karten-Aktionen mit einem Rechtsklick direkt an der Karte — schnell, ohne
Umweg ueber das Detailpanel.

**Goal:** Ein eigenes Kontextmenue bei Rechtsklick auf eine Board-Karte, im bestehenden
Retro-Design, kontextabhaengig. Jede Aktion ruft eine **bereits vorhandene** Store-/Board-Funktion
— keine neue Funktionalitaet ausser der Menue-Huelle.

## Plan

**Neue Datei `public/kontextmenu.js`** (self-contained): Menue aufbauen, positionieren, schliessen,
A11y. `board.js` bekommt NUR einen kleinen `contextmenu`-Listener in `kachel(k)`
(`e.preventDefault()` + Menue oeffnen). Rechtsklick ersetzt NICHT Linksklick (oeffnen) und Drag&Drop.

**Eintraege (kontextabhaengig):**
1. **Oeffnen** — `oeffne(k.id)` (wie Linksklick). Icon `auge`.
2. **Weiter in naechste Phase** — `naechstePhase(k.column)` → `schiebe(k, ziel)`; entfaellt bei
   `fertig`/`verworfen`. Icon `weiter`. (Wie Drag&Drop ruft es `schiebe` direkt — kein Gate-Block,
   konsistent mit dem Ziehen.)
3. **Verschieben in →** — Untermenue, listet alle Spalten ausser der aktuellen
   (`S.spalten`/`PHASEN`), Klick = `schiebe(k, spalte.id)`. Icon `raster`, Pfeil `weiter`.
4. **Naechsten freien Upload-Termin zuweisen** — dieselbe Logik wie die v52-Termin-Kachel in
   `detail.js` (`slotsForMonth` ueber 12 Monate + `naechsteFreieSlots`, Belegung aus
   Karten-Upload-Daten); setzt `k.dates`(via `einfacherPlan`)+`k.uploadTime`, dann
   `schwebendeNeuBerechnen()`. Icon `kalender`.
5. **Drehtermin zuordnen →** (optional) — Untermenue kommender Drehtermine
   (`S.drehtermine`, `datum >= heute`), `karteZuTermin(k.id, t.id)`. Icon `video`, Pfeil `weiter`.
6. ~~Kopieren~~ (optional) — **ausgelassen**, siehe Offene Entscheidung: es gibt keine bestehende
   Karten-Text-Kopierfunktion (die Detail-Kopierknoepfe kopieren je EINEN KI-Output, keinen
   „Kartentext"). Eine solche Aktion waere neu — gegen die Vorgabe „keine neue Funktionalitaet".
7. Trenner, dann **Verwerfen** (normale Schrift) → `schiebe(k, "verworfen")`; bei bereits
   verworfener Karte stattdessen **Zurueckholen** → `schiebe(k, "idee")` (wie Abschluss-Block).
   Icon `muell` (normal) bzw. `zurueck`.
8. **Loeschen** (unten, rot) → `loescheKarte(k.id)` mit Bestaetigung (`bestaetigen`). Icon `muell`,
   Farbe `--befund` (wie `knopf-gefahr`).

**Verhalten:** oeffnet an der Mauszeigerposition; schliesst bei Klick daneben, ESC, Scroll,
Fensterwechsel (`blur`); haelt sich im Viewport (Submenue klappt nach links, wenn rechts kein
Platz). A11y: `role="menu"`/`menuitem`, Pfeiltasten hoch/runter, Enter/Leertaste, ESC, Fokus
zurueck auf die Karte. Design nach `docs/ui-standard.md`: Icons via `icon()` (keine Unicode-Symbole,
Regel 5), Woerter statt Fragmente, Loeschen in `--befund`.

## Design-Belege (Bestand, nichts neu erfunden)

- Panel-Look: `background:var(--flaeche)`, `border:1px solid var(--linie-hell)`,
  `border-radius:var(--rund)`, `box-shadow:var(--schatten)` (style.css:2199, `.modal`).
- Gefahr-Rot: `--befund` #ff5a5a (style.css:29), `.knopf-gefahr` (style.css:347).
- Icons: `icon(name)` (ui.js:74), Namen aus `ICONS` (ui.js:13).
- Aktionen: `schiebe` (board.js:235), `naechstePhase` (lib/pipeline.js:86), `loescheKarte`
  (store.js:206), `bestaetigen` (ui.js:1669), `karteZuTermin` (store.js:677),
  `schwebendeNeuBerechnen` (store.js:584), Slot-Logik (detail.js:634-676),
  `slotsForMonth` (lib/scheduler.js:211), `naechsteFreieSlots` (lib/pipeline.js:499).

## Stand

- [x] Bestand + Design-Belege erhoben (board.js, detail.js, store.js, ui.js, style.css, ui-standard.md)
- [x] Parallel-Session „Social Media Board Status" per tell-session abgegrenzt (board.js heiss)
- [x] Paket angelegt
- [x] `public/kontextmenu.js` gebaut (self-contained, CSS ueber Tokens injiziert)
- [x] `board.js` `kachel()`: contextmenu-Listener + `tabIndex=-1` ergaenzt (2 Zeilen + 1 Import)
- [x] Verify: `node --check` beide Dateien (node v26.7.0, beide OK)
- [x] Verify: echter Browser-Screenshot — Menue offen, Untermenue rechts + Links-Klapp am rechten Rand,
      roter Loeschen-Eintrag, ESC schliesst + Fokus zurueck, „Oeffnen" feuert. Keine Konsolenfehler.
- [ ] Commit (`git -C` + Pathspec + Attribution) + Push

## DoD

- [x] Rechtsklick auf `.eintrag` oeffnet das Menue an der Mauszeigerposition.
- [x] Linksklick (oeffnen) und Drag&Drop unveraendert (`click`/`dragstart` weiter da; Rechtsklick separat).
- [x] Alle Eintraege rufen bestehende Funktionen; keine neue Funktionalitaet ausser der Huelle.
- [x] Kontextabhaengig: „Weiter zu <naechste Phase>" korrekt (Skript→Drehtermin, Schnitt→Caption
      im Screenshot); verworfene Karte zeigt „Zurueck zu Idee holen" (Code-Zweig `k.column==="verworfen"`).
- [x] Untermenue „Verschieben in" listet alle Spalten ausser der aktuellen; klappt bei Platzmangel
      nach links (am rechten Rand im Screenshot bestaetigt).
- [x] Schliesst bei Klick daneben, ESC, Scroll, blur/resize; bleibt im Viewport (clamp).
- [x] A11y: role=menu/menuitem, Pfeiltasten hoch/runter/links/rechts, Home/End, Enter/Leertaste,
      Fokus zurueck auf die Karte (`tabIndex=-1`).
- [x] Design gegen ui-standard.md: Icons statt Unicode (Regel 5), Loeschen in `--befund`, Woerter statt Fragmente.
- [x] Optischer Screenshot als Abnahme (Menue, Untermenue rechts + links, Detailoeffnen).

## Offene Entscheidung

- **Eintrag 6 „Kopieren"** ausgelassen: es gibt keine bestehende „Kartentext kopieren"-Aktion.
  Soll er rein, brauche ich die Vorgabe, WELCHER Text (fertiges Skript `k.skriptFinal`? Titel?
  Titel+Fokus?) — dann baue ich ihn als duenne `navigator.clipboard.writeText`-Huelle nach.
