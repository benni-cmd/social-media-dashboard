# v68 — Einstellungen: Tab "Hinweise & Warnungen"

> 25.09.2026. Stand: gebaut und im Browser geprueft.

## PIG

**Problem:** Fast jede Karte zeigt ein gelbes "!", weil die Aktion ihrer Spalte noch nicht
erledigt ist (offene Sperr-Punkte). Das ist Dauerrauschen und sagt nichts mehr.

**Intent:** Der Owner entscheidet selbst, welche Hinweise und welche Warnungen auf den Karten
erscheinen — ohne Code und ohne "Speichern".

**Goal:** Neuer Tab "Hinweise & Warnungen" mit zwei Boxen (Hinweise, Warnungen), je eine
Checkbox-Liste aller Pruefungen. Haken setzen/entfernen speichert sofort; die Karten
zeichnen sich danach passend neu. Sinnvoller Default.

## Bestand (nachgemessen 25.09.2026, `lib/pipeline.js` tore(), `public/board.js` kachel())

Auf der Karte steht HEUTE nur ein "!" (Warnung) neben dem Zeit-Punkt. Es entsteht aus:
- allen Pruefungen mit `sperrt: true` und Status nicht "ok" (`sperren()`), plus
- "Drehtermin liegt ausserhalb des empfohlenen Fensters".

Nicht-sperrende Pruefungen (Status "hinweis") stehen nur in der Detailspalte, nicht auf der Karte.

| Spalte | Sperrend (heute auf Karte) | Nicht sperrend (nur Detail) |
|---|---|---|
| Idee | Thema, Kategorie, Ziel, Fokus+Hook gewaehlt | — |
| Skript | Kategorie, Sprechertext fehlt/zu lang, Hook fehlt, Hook als Bild | Text zu kurz, Korridor je Plattform, Hook zu lang, Problem/Loesung-Rahmen, Skript nach Drive gespeichert |
| Videodreh | Rohmaterial im Drive | Blick in die Kamera, Sprecher vor der Kamera |
| Schnitt | Fertiges Video im Drive, Untertitel, Wasserzeichen (Instagram) | — |
| Caption | Vorspann fehlt/zu lang, Hashtag-Limit ueberschritten, Like-Bitte, Aufruf zum Handeln fehlt/mehrfach | Suchbegriffe, Instagram-/TikTok-Hashtag-Empfehlung, Frage im Text |
| Upload | Plattform gewaehlt | Veroeffentlichungsdatum, Beitrag verknuepft |
| Alle | Drehtermin ausserhalb Fenster | — |

Der Zeit-Punkt (Ampel) ist eine eigene Sache und bleibt unberuehrt.

## Owner-Antworten (25.09.2026)

1. Einteilung **nach Farbe/Schwere**: Warnung = roter Befund (Text zu lang, Hashtag-Limit, Like-Bitte,
   mehrere Aufrufe, Caption-Vorspann zu lang) + Drehtermin ausserhalb Fenster; Hinweis = alles andere
   nicht "ok" (fehlt / Empfehlung).
2. Darstellung: **zwei Symbole** — Warnung rotes Ausrufezeichen, Hinweis gelber Info-Kreis.
3. Feinheit: **je Pruefung** (33 Haken, nach Spalte gruppiert).
4. Default: Warnungen alle an; Pflichtangaben der Spalte als Hinweis an, aber **erst bei gelber/roter
   Frist**; Empfehlungen aus.

## Umsetzung

- `lib/kartenhinweise.js` (neu, ohne Node-Importe, laeuft im Browser): Katalog, Standardwerte,
  `kartenMeldungen()`, Laden/Speichern (`/api/defaults`, Feld `kartenHinweise`, nur geaenderte Haken).
- `public/board.js`: Kachel zeigt Warnung und/oder Hinweis nach den Haken; Titel-Reservierung fuer 1 bzw. 2 Symbole.
- `public/ui.js`: Tab "Hinweise & Warnungen" (Index 2), zwei Kacheln, Haken speichert sofort, bei Fehler Zurueckrollen.
- `public/app.js`: Laden beim Start, Karten neu zeichnen bei Aenderung.

## Verify (Browser, 25.09.2026)

- 33 Haken sichtbar, Screenshot gegen bestehende Kachel-Optik geprueft; Haken "Drehtermin ausserhalb"
  aus -> Warnungen 8 -> 5, `/api/defaults` enthaelt `kartenHinweise`, wieder an -> 8.
- Karten zeigen Warnung, Hinweis oder beides nebeneinander ohne Titel-Ueberlappung.

## Stand

- [x] Bestand, Owner-Antworten, Bau, Verify
- OFFEN: Detailspalte zeigt weiter alle Pruefungen (nur die Karten sind einstellbar); Dark Mode nicht angesehen.
