# v102 — Board-Zoom: nur der Board-Inhalt, in 5-%-Schritten

> Owner-Auftrag 01.10.2026: „Auf dem Board und nur auf dieser Ebene unten rechts Buttons, im Stil
> unseres Boards. Dort soll man den Board-Inhalt größer und kleiner skalieren können, unabhängig
> von der Kopfleiste (die skaliere ich über die Browser-Skalierung). Plus und Minus, immer in
> 5-%-Schritten einrastend. Öffnet man eine Detailansicht, rutschen die Buttons nach links, sodass
> sie immer auf der Board-Ebene liegen."

**Problem:** Das Board lässt sich nur zusammen mit der ganzen Seite zoomen; mit fester Detailbreite fehlt eine Stellschraube nur für die Spalten.
**Intent:** Das Board an Bildschirm und Arbeitsweise anpassen, ohne Kopfzeile und Detailspalte mitzuskalieren.
**Goal:** Zwei Knöpfe (− / +) und ein Wert („100 %") unten rechts in der Board-Ansicht; Klick ±5 %, Bereich 50–150 %; Klick auf den Wert setzt auf 100 % zurück; wirkt nur auf Spalten und Nachschub-Leiste; bei geöffneter Detailspalte liegen die Knöpfe links davon; nicht in Auswertung.

## Plan

1. [x] `public/boardzoom.js` (Knöpfe, Schrittlogik, Wert in `localStorage` als Bequemlichkeit), Platz in `index.html` innerhalb von `#ansicht-board`, Stil nach Board-Vorbild (3-px-Kante, harter Schatten, gelb bei ≠ 100 %), `zoom: var(--board-zoom)` auf `#board, #nachschub`.
2. [x] Verify im Browser: 100 → 110 → 90 %, Kopfzeile unverändert (`zoom` 1), mit Detailspalte liegt die rechte Kante der Knöpfe bei 952 px, die Detailspalte beginnt bei 980 px.

## Status

01.10.2026 — Gebaut und gesehen (Screenshot 90 %, gelber Wert, Detailspalte offen). Auswertung hat keine Knöpfe (liegen nur in `#ansicht-board`).
Nicht geprüft: Drag-and-Drop von Karten bei Zoom ≠ 100 %; Dark Mode der Knöpfe; Verhalten im Firefox (CSS `zoom` ab Version 126).

## Definition of Done

Geprueft gegen: Skriptmessung Zoom-Variable, Kopf-Zoom, Position mit/ohne Detailspalte; Screenshot mit Detailspalte
Offen: Drag-and-Drop bei Zoom ≠ 100 % und Dark Mode ungeprüft — ICH
