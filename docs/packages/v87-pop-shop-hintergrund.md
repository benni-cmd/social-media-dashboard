# v87 — Pop-Shop-Hintergrund für Board und Auswertung

> Owner-Auftrag 01.10.2026: „Auf den Hintergrund im Board und der Auswertungsseite (nichts
> Detailansicht oder Kopfzeilen) eine Textur passend zum Board-Stil, z. B. Pop-Shop-like, blass in
> den Hintergrund, dass das nicht so leer aussieht."

**Problem:** Die Fläche zwischen und unter den Spalten sowie die Auswertungsseite sind einfarbig und wirken leer.
**Intent:** Der Retro-/Pop-Look zieht sich bis in den Hintergrund, ohne Inhalte zu stören.
**Goal:** Blasses Ben-Day-Punktraster nur hinter `.board-scroll` und `#ansicht-auswertung`; Kopfzeile, Board-Leiste und Detailspalte bleiben unverändert; hell und dunkel sichtbar, aber blass.

## Plan

1. [x] Zwei versetzte Punktraster (Koralle, Himmelblau) als `radial-gradient`, Tokens `--textur-a/-b` für hell und dunkel, `background-attachment: local`.
2. [x] Verify: Screenshot Board hell + dunkel, Auswertung hell; Skript: Kopf, Leiste, Detail ohne Hintergrundbild.

## Status

01.10.2026 — Gebaut in `public/style.css` (Block „v87"). Hell: Alpha 0,14, dunkel nach erstem Blick (0,09/0,08 kaum sichtbar) auf 0,13/0,12 angehoben. Gemessen: `.kopf`, `#board-leiste`, `#detail` haben `background-image: none`; `#ansicht-auswertung` trägt das Raster.
Nicht gesehen: Auswertung im Dark Mode und mit Daten (in der Test-Instanz auf Port 4321 lag ein Einrichtungs-Dialog davor, nur im DOM ausgeblendet).

## Definition of Done

Geprueft gegen: Screenshots Board hell + dunkel, Auswertung hell, Computed-Style-Skript für Kopf, Leiste, Detail
Offen: Auswertung im Dark Mode nicht gesehen; Geschmack (Punktgröße/Stärke) — Owner
