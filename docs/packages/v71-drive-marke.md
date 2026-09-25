# v71 — Drive-Marke: zeigt, was aus Google Drive kommt

> 25.09.2026. Gebaut und im Browser geprueft.

**Problem:** In der App ist nicht erkennbar, welche Daten aus/in Google Drive liegen.
**Intent:** Ein einheitliches Zeichen macht die Drive-Herkunft sichtbar, ohne die Board-Karten zu belasten.
**Goal:** Kleine Drive-Kachel (Icon `drive`, `driveMarke()` in `public/ui.js`) an allen Stellen mit Drive-Bezug, nie auf den Karten.

## Stellen
- Einstellungen, Navigation: Hinweise & Warnungen, Unternehmenskontext, System Prompts (Daten liegen in Drive).
- Einstellungen: Google-Drive-Zeile, Abschnitt "Cursor" (Defaults in Drive), Option "Aus Google Drive" (Social Media Kanaele).
- Detailspalte: Marke im Kopf, wenn die Karte einen Projektordner hat; Knoepfe "Caption nach Drive speichern", "Projektordner in Drive anlegen", "Drive erneut lesen".
- Navigation um 16 px verbreitert (192 px), damit "Hinweise & Warnungen" mit Marke einzeilig bleibt.

## Stand
- [x] Bau, Screenshot-Verify (Einstellungen, Detailspalte)
- OFFEN: Dark Mode nicht angesehen; Knoepfe im Detail nicht einzeln angesehen.

## Nachtrag v72 — Marke als Link auf den Drive-Ordner (25.09.2026)
- `driveOrt(pfad, label)` / `driveOrtZeile()` in `public/ui.js`: Marke + Ordnername als Link; Klick oeffnet den Ordner in neuem Tab.
- Server: `GET /api/drive/ordner-link?pfad=…` (ID aus der Eltern-Auflistung, gemerkt je Arbeitsordner, beim Start fuer die drei Einstellungs-Ordner vorgewaermt).
- Stellen: Hinweise & Warnungen, System Prompts, Cursor -> "System (AI only)"; Unternehmenskontext -> "Kontext"; Datenquelle Auswertung -> "Videoauswertung/Auswertung-Tabellen"; Detailkopf -> "Projektordner" der Karte.
- Verify: Klick loest die richtigen Ordner-IDs auf (System, Projektordner); erster Klick ohne Vorwaermung dauert 5-25 s (langsames rclone).
