# v83 — Abgleich sichtbar je Spalte, Detail markiert nur Ungelesenes, restliche Standard-Muster auf Retro

> Owner-Auftrag 30.09.2026 (Rückmeldung mit fünf Screenshots): Die Cache-Zeichen (gestrichelte
> Ränder, Uhr im Spaltenkopf) gefallen. Sie bleiben aber alle stehen, obwohl das Log zeigt, dass
> die Spalte abgeglichen ist. Sobald Karten in ihrer Spalte abgeglichen und bestätigt sind, sollen
> sie Stück für Stück normal erscheinen. In der Detailansicht sollen vor allem die noch nicht
> abgeglichenen Teile markiert sein, nicht die ganze Karte. Außerdem: Standard-KI-Muster suchen
> und auf Retro ziehen (Beispiele: runde Status-Pillen, runde Auswahl-Pillen, dünne Einstellungs-
> Karten mit Pfirsich-Auswahl, gestrichelte Aufklapp-Box), Abstände prüfen, entscheiden welche
> Texte wichtig sind und wie Inhalte in Aufklapp-Boxen logisch und visuell sitzen. Einstellungen:
> schlichter, aber im Retro-Look.

**Problem:** (a) `S.live.board` wird erst gesetzt, wenn der gesamte Abgleich durch ist; bis dahin
bleiben alle Spalten und Karten als Cache markiert, auch wenn ihr Drive-Ordner schon gelesen ist.
(b) In der Detailansicht markiert v81 alle Abschnitte außer Drive, obwohl gerade Drive der
ungelesene Teil ist. (c) Status-Chips und Auswahl-Pillen sind rund und weich (Standard-Look),
Einstellungen sind dünne Karten mit Versalien-Überschrift, die Unterklappe ist gestrichelt und
kollidiert damit mit der Bedeutung „Cache".
**Intent:** Das Board zeigt ehrlich und feinkörnig, was schon live ist, und sieht durchgehend
nach Retro aus; gestrichelt bedeutet nur noch „Cache".
**Goal:** Nach dem Lesen des Drive-Ordners einer Spalte verlieren deren Kopf-Uhr und Karten-
Ränder sofort das Cache-Zeichen (Spalte für Spalte); Detail markiert nur, was noch nicht live
ist; keine runden Standard-Pillen, keine Versalien-Karten, keine gestrichelte Nicht-Cache-Fläche
mehr; Einstellungen schlicht im Retro-Look; Abstände in Aufklapp-Boxen einheitlich.

## Plan

1. [x] Server meldet je Spalte „Ordner gelesen" (`drive-ordner-fertig`), Client führt `S.live.spalten`.
2. [x] Board: Spaltenkopf und Karten verlieren das Cache-Zeichen je Spalte; Kopf-Plakette zählt „n/8 Spalten".
3. [x] Detail: Kopf-/Abschnitts-Marken nur solange die Spalte der Karte nicht live ist; Drive-Teil markiert, solange nicht gelesen.
4. [x] Standard-Muster inventarisieren (Skript über alle Ansichten) und auf Retro ziehen: Status-Chips, Auswahl-Pillen, gestrichelte Flächen.
5. [x] Einstellungen: schlicht, Retro-Kanten, ohne Versalien-Karten und Pfirsich-Auswahl.
6. [x] Abstände und Texte: einheitliche Innenabstände in Aufklapp-Boxen, Erklärtexte nach Wichtigkeit sortieren.

## Status

30.09.2026 — Paket angelegt. Ursache (a): `driveAbgleich()` setzt `S.live.board = true` erst nach
`done`; der Server schickt `drive-ordner` (Beginn je Spalte) aber kein Ende; Kartendaten werden
erst mit `done` getauscht (`server.js:428 fuehreAbgleichAus`, `lib/projects.js:280 abgleich`).

30.09.2026 — Schritte 1–3 gebaut und im Browser gemessen: Server sendet `drive-ordner-fertig` je Spalte (`lib/projects.js`), Client führt `S.live.spalten` und `spalteLive()` (`public/store.js`); Board und Detail nutzen sie. Messung eines echten Abgleichs (Skript liest alle 1 s): Spalten-Uhren 8→7→6→5→4→3→2→1, Cache-Karten 17→11→6→5→3→3→3→0, je eine Spalte pro Sekunde; Plakette zählt „Abgleich läuft (n/8 Spalten)". Nach dem Lauf: Plakette weg, 0 Cache-Ränder; geöffnete Karte trägt nur die Marke „noch nicht gelesen" am Drive-Abschnitt. Cache-Marke als helle Plakette mit Tintenkante (Violett auf Orange war unlesbar).
Nicht geprüft: Abgleich-Fehler mitten im Lauf (bereits gelesene Spalten bleiben dann live-markiert, obwohl `done` fehlt).

30.09.2026 — Schritte 4+5 gebaut und geprüft (hell + dunkel, Einstellungen Darstellung + KI-Rollen, Board, Detail). Inventar per Skript: runde Pillen `.chip`, `.schalter`, `.stamm-chip`, `.drive-ort`, `.dreh-chip`, `.einst-format-tab`, Zähler-Badges; Versalien `.einst-label`, `.meldung-gruppenkopf`, `.termin-kachel-label`; gestrichelte Nicht-Cache-Flächen `.unterklappe`, `.einst-rolle-zusatz`. Regel: Rechteck-Marken mit 2-px-Tintenkante, Auswahl = gelbe Füllung (`--chrome-b`), Status-Chips getönt in Statusfarbe mit Tintentext (Wort bleibt), gestrichelt nur noch „Cache" (Drehtermin „auto" jetzt gepunktet). Einstellungen schlicht: flache Kacheln 2 px, Namen statt Versalien, blauer Titelstreifen, Nav-Auswahl gelb mit Tintenbalken, Drive-Icon aus der Nav entfernt (jede Seite nennt „Gespeichert in …" selbst).

30.09.2026 — Schritt 6 gebaut, hell + dunkel geprüft (Karte „Videodreh"): eine Regel für Aufklapp-Boxen — Farbkopf, 14 px Innenrand, Blöcke 10 px Abstand, nur die äußerste Box mit Schatten (Boxen in Boxen: 2-px-Kante, kein Schatten), „In Drive öffnen" einzeilig, Detail-Kopf bricht um statt zu quetschen. Textauswahl: nur eine Streichung ist sicher (Drive-Icon in der Einstellungs-Liste, weil jede Seite ihren Speicherort selbst nennt); weitere Erklärtexte nicht gestrichen, weil ich nicht jede Phase und Einstellungsseite gelesen habe.

## Definition of Done

Geprueft gegen: Abgleich-Lauf mit Sekundentakt-Messung (Spalten-Uhren 8→1, Cache-Karten 17→0), Screenshots hell + dunkel (Board, Detail Skript/Videodreh, Einstellungen Darstellung/KI-Rollen), Skript-Inventar der Standard-Muster, `node --check`
Offen:
1. Ansichten Auswertung, Redaktionsplan, Modale und übrige Einstellungsseiten (Social Media Kanäle, System Prompts, Board & Redaktionsplan) nicht im Retro-Rundgang gesehen — ICH
2. Erklärtexte je Phase auf Wichtigkeit sichten und streichen — DEINE ENTSCHEIDUNG (Kriterium?)
3. Abgleich-Fehler mitten im Lauf: bereits gelesene Spalten bleiben live-markiert — ICH
