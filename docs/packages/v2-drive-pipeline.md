# Work package: v2 — Drive-gestuetzte Content-Pipeline

> Nachfolger von `v1-content-board.md`. Erweitert das lokale Board zu einer Pipeline, deren
> Wahrheit in Google Drive liegt, damit mehrere Teammitglieder lokal dasselbe Board sehen.
> Angelegt beim Planen; Entscheidungen unten noch offen (siehe "Offene Entscheidungen").

**Problem:** v1 ist ein lokales Board mit lokalem `board.json`. Fuer echten Team-Betrieb und
den Wunsch, dass Rohmaterial/Skript/Video den Kartenstatus treiben, reicht das nicht: jeder
haette sein eigenes, divergierendes Board, und der Kartenstatus haengt in der Luft statt an
den tatsaechlichen Dateien.

**Intent:** Google Drive wird der Single Point of Truth. Das Board spiegelt eine Drive-Ordner-
struktur; die KI laeuft weiterhin lokal (token-frei ueber `claude -p`), schreibt Ergebnisse
aber in die Cloud. So kann jedes Teammitglied lokal mit KI arbeiten und sieht denselben Stand.

**Goal:** Voller Pipeline-Ablauf Idee > Skript > Videodreh > Schnitt > Caption > Upload >
Fertig, mit dateigetriebenen und haken-getriebenen Uebergaengen, Upload-Datum mit Ampel-Farbe,
Google-Calendar-Erinnerungen und automatisch angelegter Drive-Projektstruktur.

## Ziel-Pipeline (7 Spalten)

1. **Idee** — Sammlung. KI-Button: Fokus/Inhalt praezisieren.
2. **Skript** — KI-Button: Skript schreiben. Hier wird das **Upload-Datum** gesetzt. Beim
   Eintritt: Drive-Projektordner + Unterstruktur anlegen, Skript dort speichern, Calendar-
   Termin mit Erinnerungen (10 + 5 Tage vorher) erstellen.
3. **Videodreh** — Karte traegt Haken "Dreh durch". Rutscht bei Haken (oder wenn im Drive-
   Rohmaterial-Ordner Dateien liegen) nach Schnitt.
4. **Schnitt** — Haken "Schnitt fertig" (oder: sobald im Drive-Final-Ordner ein Video liegt)
   -> Caption.
5. **Caption** — KI-Button: Caption schreiben.
6. **Upload** — geplante fertige Posts. Karte bleibt hier GRUEN (Datum-Ampel ausgesetzt), bis
   IG/LinkedIn-API die Veroeffentlichung meldet (vorerst: manueller Haken "Veroeffentlicht").
7. **Fertig** — Archiv.

## Ampel am Upload-Datum

Datum immer auf der Karte sichtbar. >10 Tage vorher gruen, ab 10 Tagen gelb, ab 5 Tagen rot —
ausser die Karte ist in Spalte Upload, dann bleibt sie gruen. Reine lokale Rechnung.

## Architektur-Empfehlung (Kern-Reframe)

Drive traegt sowohl die Dateien ALS AUCH den Kartenzustand: pro Projekt ein Ordner mit einer
kleinen `project.json` (Spalte, Upload-Datum, Skript-Verweis, Haken) plus Unterordnern
`skript/`, `rohmaterial/`, `final/`. Das Board wird durch Auflisten des Projekt-Wurzelordners
gerendert. Auto-Uebergaenge per Drive-Polling (alle paar Minuten) oder Drive-Push. Der lokale
Server bleibt der KI- und Drive-Proxy; die Oberflaeche bleibt lokal.

## Plan (phasiert)

1. [ ] Phase 0: Claude-CLI-Login (Ben) — `claude auth login`, geprueft mit `claude auth status`.
2. [ ] Phase 1 (lokal, ohne Google): Spalten Videodreh + Fertig ergaenzen, Upload-Datum-Feld,
       Ampel-Farbe, Haken-getriebene Uebergaenge, kontext-spezifische Buttons pro Spalte.
3. [ ] Phase 2: Google verbinden (OAuth Drive + Calendar), Zugangsweg in `.secrets/` dokumentiert.
4. [ ] Phase 3: Drive-Projektstruktur automatisch anlegen beim Idee->Skript-Uebergang.
5. [ ] Phase 4: Drive als Zustandsspeicher (`project.json`), Board rendert aus Drive, Team-Sync.
6. [ ] Phase 5: Auto-Uebergaenge aus Drive-Ordnerinhalt (Rohmaterial->Schnitt, Final->Caption).
7. [ ] Phase 6: Calendar-Termine mit Erinnerungen 10 + 5 Tage vor Upload.
8. [ ] Phase 7 (spaeter, gated): IG/LinkedIn-API — Upload->Fertig automatisch + Analytics.

## Offene Entscheidungen (blockieren ab Phase 2)

- Drive als Single Point of Truth (Kartenzustand in Drive) — ja/nein.
- Google-Verbindung: OAuth-Desktop-Client pro Nutzer vs zentraler Service-Account.
- Welches (neue) Google-Konto, welche bestehende Ordnerstruktur (Wurzel-Ordner), welcher Kalender.
- Auto-Uebergang: Polling-Intervall vs Push.
- Upload->Fertig vorerst manueller Haken (bis IG/LinkedIn-API steht).

## Status

2026-08-27 — Plan angelegt. Login-Weg verifiziert (`claude auth login`). Phase 1 ist
entscheidungsfrei und wird als naechstes gebaut; Google-Phasen warten auf die Entscheidungen.

## Definition of Done

Geprueft gegen: voller Pipeline-Durchlauf mit echten Drive-Dateien und Calendar-Terminen,
zweites Teammitglied sieht denselben Board-Stand, optische Abnahme gegen `docs/ui-standard.md`.
Offen: alle Phasen (Plan-Stadium).
