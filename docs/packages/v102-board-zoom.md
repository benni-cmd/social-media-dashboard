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

Geprueft gegen: Skriptmessung Zoom-Variable, Kopf-Zoom (bleibt 1), Position mit/ohne Detailspalte, Grenzen 50/150 % (Plus bzw. Minus gesperrt), Wert bleibt gespeichert (`localStorage`); Trefferprobe der Karten bei 90/100/120 % (7 von 8 an der Position, gleich wie bei 100 %); Screenshot dunkel bei 80 %
Offen: echtes Ziehen und Ablegen mit der Maus sowie Firefox (CSS `zoom`) — beim ersten Gebrauch beobachten (Owner)

05.10.2026 — Abschluss-Audit (Vollständigkeits-Skill, 8 Fragen + 4 Gegenproben, gegen Auftrag, Code und Messungen):
- Konflikt gefunden und behoben: Toasts unten rechts deckten die Zoom-Knöpfe ab → Stapel liegt 84 px höher.
- Zoom wirkt nur auf `#board`/`#nachschub`; in der Auswertung ist er nicht vorhanden (Breite 0).
- Grenze der Prüfung: Die Trefferprobe ersetzt kein echtes Drag-and-Drop (HTML5-Ziehen ist in der Testumgebung nicht auslösbar); Chrome rechnet bei CSS `zoom` Koordinaten selbst um.
Stand: **abgeschlossen mit zwei beobachtenden Punkten beim Owner**.

## Nachtrag 05.10.2026 — Zoom auch in der Auswertung (Owner-Auftrag)

Entscheidung (Annahme, vom Owner nicht widersprochen): **eigener Wert je Ansicht** (Board und Auswertung getrennt, `localStorage` `cm-board-zoom` / `cm-auswertung-zoom`), gleicher Stil, gleiche Schritte (5 %, 50–150 %), unten rechts, mit offener Detailspalte links davon.
Umsetzung: `public/boardzoom.js` verallgemeinert (Schlüssel, CSS-Variable, Name je Aufruf); `index.html`: Auswertung in einer Hülle `.ansicht-huelle` (Position für den Knopf; sonst scrollt er mit dem Inhalt und verschwindet beim Neuzeichnen per `innerHTML`); `style.css`: Hülle verschwindet mit ihrer Ansicht (`:has(> .ansicht[hidden])`), `#ansicht-auswertung > *` bekommt `zoom: var(--auswertung-zoom)`.
Gemessen auf der isolierten Kopie (Edge-Headless): Board-Zoom in der Auswertung unsichtbar (Breite 0) und umgekehrt; Plus ×4 → 120 %, Variable 1,2, Inhalt wächst; nach Scrollen um 300 px bleibt der Knopf an derselben Stelle; nach Neuzeichnen 3 Knöpfe mit 120 %; Abstand zum Rand 22 / 26 px; nur `cm-auswertung-zoom` gespeichert, Board-Wert unberührt. Screenshot gesehen.
Nicht geprüft: Auswertung mit echten Daten und geöffneter Detailspalte; Dark Mode der Auswertungs-Knöpfe (Stil identisch zum Board-Zoom, dort gesehen).
