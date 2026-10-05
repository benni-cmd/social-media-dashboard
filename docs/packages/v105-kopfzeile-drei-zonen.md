# v105 — Kopfzeile in drei festen Zonen, Verbindungen als eine Gruppe

> Owner-Auftrag 01.10.2026: „Der Gesamtlook sieht immer noch prototypmäßig aus — lässt sich das
> verändern, indem man die Kopfzeilen mal richtig stylt und organisiert?" Entscheidungen (Fragen
> beantwortet): (1) drei feste Zonen, (2) Verbindungen als eine Gruppe mit Gesamtampel,
> (3) die zweite Leiste (Drehtermine, Wochenstand, Redaktionsplan) bleibt eigene Leiste, neu geordnet.

**Problem:** Bei breitem Fenster schwimmen die Kopf-Elemente mit großen Lücken (Titel, Ansichten, Hauptknopf links, vier gleich große Verbindungs-Kästchen in der Mitte, System rechts); kein erkennbarer Aufbau, nur Retro-Kanten.
**Intent:** Ein Kopf mit klarer Ordnung: wer/wo (Marke, Ansichten) · was jetzt (Hauptaktion) · wie steht es um die Technik (Verbindungen, System).
**Goal:** Drei Zonen mit Trennlinien, Marke mit Wortmarke und Vier-Farben-Zeichen, großer Hauptknopf in der Mitte, Verbindungen als eine Gruppe aus vier Kacheln plus Gesamtampel (schlechtester Zustand), Log wie bisher per Klick, Abgleich-Knopf im Log-Kopf; kein Überlauf bei 1440 px, geordnet auch bei 2000 px.

## Plan

1. [x] `index.html`: Zonen `.kopf-marke`, `.kopf-mitte`, `.kopf-rechts`, Logo-Element; alle IDs unverändert.
2. [x] `anschluesse.js`: Kachel-Klick öffnet das Log, Abgleich-Knopf im Log-Kopf, `data-zustand` der Gruppe aus dem schlechtesten Sektions-Zustand.
3. [x] `style.css` Block „v105": Grid mit drei Spalten, Marke, Hauptknopf, Gruppe „Verbindungen" mit Ampelpunkt, Kacheln 32 px, Log-Kopf; Status-Satz erst ab 1700 px sichtbar.
4. [x] Verify: Screenshots hell 1440 und 2000, dunkel 1440 mit offenem Log (Edge-Headless auf isolierter Testkopie).

## Status

01.10.2026 — Gebaut und gesehen. Messung 1440 px: Kopfbreite 1440 = Fensterbreite, Zonen 432 / 500 / 507 px. Hauptknopf gelb/koralle, Plakette „Cache … Abgleich fehlgeschlagen" passt daneben.
Bewusst offen: Name der Verbindung steht nur im Tooltip der Kachel (Owner-Wahl „Name beim Darüberfahren"); die Statuszeile mit Konto/Zustand/„zuletzt ok" im Log kommt mit v86 (Anbindungen transparent). Der Status-Satz („Liest …") ist unter 1700 px ausgeblendet.
Beobachtung (nicht von v105): im Drive-Log stapelte eine Zeile ihren Text buchstabenweise — Ursache und Fix siehe Abschluss-Audit.

## Definition of Done

Geprueft gegen: Screenshots hell 1440/2000, dunkel 1440 mit Log, Skript `scrollWidth` = Fensterbreite, Log öffnet per Kachelklick, Gesamtampel `data-zustand`; Log-Zeilen: vorher 3 Zeilen mit 7 px breitem Befehl, nachher 0 von 40 Zeilen unter 60 px
Offen: Gesamtampel speist sich noch aus dem letzten Ereignis je Sektion, nicht aus der v86-Prüfung — gehört zu v86 Teil 2 (andere Session)

05.10.2026 — Abschluss-Audit (Vollständigkeits-Skill, 8 Fragen + 4 Gegenproben, gegen Auftrag, Code und Messungen):
- Ursache Log-Umbruch belegt: In Fehlerzeilen steht die ganze rclone-Meldung (bis ~7000 px, `nowrap`) in der Ergebnis-Spalte und quetschte den Befehl auf 7 px (Grid-Spalten gemessen). Fix: Befehl `minmax(0,1fr)`, Ergebnis höchstens 46 % der Zeile, umbrechend, 3 Zeilen, voller Text im Tooltip.
- Status-Satz: erst ab 1700 px sichtbar (bewusst; Owner-Frage aus v82 damit beantwortet).
- Folgepflicht: v86 Teil 2 setzt `data-zustand` aus dem Prüfergebnis; bis dahin zeigt die Ampel den „schlechtesten letzten Aufruf“.
Stand: **abgeschlossen** (Anbindung an v86 Teil 2 als Übergabe vermerkt).
