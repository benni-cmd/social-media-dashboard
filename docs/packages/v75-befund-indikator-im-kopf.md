# v75 — Befunde in die Kopfzeile, Fortschritt-Zeile entfaellt

> 28.09.2026. Gebaut und im Browser geprueft.

**Problem:** Die Fortschritt-Zeile (Phasenband + "N Punkte halten die Karte auf") kostete eine
eigene Zeile direkt unter dem Kopf und war rein optisch, ohne Details auf Blick.
**Intent:** Der Platz wird gespart, ohne den Befund unsichtbar zu machen.
**Goal:** Ein Zeichen in der Kopfzeile, rechtsbuendig neben dem Schliessen-Knopf, das per
Hover/Fokus/Klick eine kategorisierte Liste aller offenen Punkte zeigt.

## Umsetzung
- `public/detail.js`: `blockFortschritt()` (Phasenband + Zeile) entfernt; `befundIndikator(toreListe)`
  baut ein Icon in der Farbe des schwersten offenen Status (befund > fehlt > hinweis > unlesbar,
  "ok"/"entfaellt" zaehlen nicht), mit Popup darunter (nach Status gruppiert, `befundZeile()` je Punkt).
- CSS: `.befund-indikator` traegt den `margin-left:auto`, der vorher an `.detail-schliessen` sass
  (zwei auto-margins in derselben Zeile haetten die Luecke geteilt); `.befund-popup` (Hover/Fokus/
  `.offen`-Klasse zeigt sie), ein globaler Click-Away-Listener schliesst offene Popups.

## Verify (Browser, 28.09.2026)
- Fortschritt-Zeile/Phasenband verschwunden, Indikator sitzt links vom X.
- Klick oeffnet Popup mit Gruppe "Fehlt (3)" und den drei Saetzen; Klick ausserhalb schliesst es.
- `node --check server.js` ok (keine Server-Aenderung, nur zur Kontrolle).

## Stand
- [x] Bau, Verify
- OFFEN: Dark Mode nicht angesehen; `.phasenband`/`.phasenband-teil`-CSS ist jetzt tot (nicht entfernt, ungenutzt).
