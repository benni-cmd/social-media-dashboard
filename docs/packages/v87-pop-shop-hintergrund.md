# v87 — Pop-Shop-Hintergrund für Board und Auswertung

> Owner-Auftrag 01.10.2026: „Auf den Hintergrund im Board und der Auswertungsseite (nichts
> Detailansicht oder Kopfzeilen) eine Textur passend zum Board-Stil, z. B. Pop-Shop-like, blass in
> den Hintergrund, dass das nicht so leer aussieht."

**Problem:** Die Fläche zwischen und unter den Spalten sowie die Auswertungsseite sind einfarbig und wirken leer.
**Intent:** Der Retro-/Pop-Look zieht sich bis in den Hintergrund, ohne Inhalte zu stören.
**Goal (Runde 2, Owner 01.10.2026: „mehr so Keith-Haring-Pop-Shop-mäßig“):** Kachelmuster aus Street-Art-Kritzeln (dicke Tintenkontur, flache Signalfarben, Schlangenlinien, Zickzack, Strahlenkränze, Strichgruppen, dicht gefüllt) nur hinter `.board-scroll` und `#ansicht-auswertung`; Kopfzeile, Board-Leiste und Detailspalte bleiben unverändert; hell und dunkel sichtbar, aber blass.

## Plan

1. [x] Runde 1: zwei versetzte Punktraster (Koralle, Himmelblau) als `radial-gradient`. Runde 2 ersetzt sie: 480-px-SVG-Kachel `public/texture-popshop.svg` (hell, Deckkraft 0,30) und `texture-popshop-dark.svg` (dunkel, 0,24), eingebunden über `--textur-bild`, `background-attachment: local`.
2. [x] Verify: Screenshot Board hell + dunkel, Auswertung hell; Skript: Kopf, Leiste, Detail ohne Hintergrundbild.

## Status

01.10.2026 — Gebaut in `public/style.css` (Block „v87"). Hell: Alpha 0,14, dunkel nach erstem Blick (0,09/0,08 kaum sichtbar) auf 0,13/0,12 angehoben. Gemessen: `.kopf`, `#board-leiste`, `#detail` haben `background-image: none`; `#ansicht-auswertung` trägt das Raster.
Nicht gesehen: Auswertung im Dark Mode und mit Daten (in der Test-Instanz auf Port 4321 lag ein Einrichtungs-Dialog davor, nur im DOM ausgeblendet).

01.10.2026 (Runde 2) — Muster neu: Herz, Stern, Sonne mit Strahlen, Blitz, Spirale, Sticker-Kreis, Dreieck, Wolke, X-Kreuze, Schlangenlinien, Zickzack, Strichgruppen, Punkte; Kontur 6 px, Füllkritzel gegen leere Stellen. Bewusst KEINE nachgezeichneten Figuren von Keith Haring (urheberrechtlich geschützt) — nur die Formsprache mit eigenen Motiven. Screenshots Board hell + dunkel bei 1440x900 gesehen; Karten bleiben lesbar.

01.10.2026 (Runde 3, Owner: „wirklich so ein Pattern, das sich endlos fortsetzt … Hintergrund muss nicht mitscrollen") —
Antwort auf „selbst zeichnen oder Grafik suchen": selbst, per Generator. Gründe: Harings Linienlabyrinthe und Nachahmungen davon sind urheberrechtlich heikel; ein eigener Generator ist frei nutzbar, nahtlos und in Dicke/Dichte/Farbe änderbar. `tools/make-texture-popshop.mjs`: zufälliger Spannbaum (Tiefensuche) auf einem Torus → dicke, weich gerundete Linien, Kachel 572×572 px schließt sich an allen Rändern (mit überhöhtem Kontrast an der Kachelkante geprüft: keine Naht). Ausgabe `public/texture-popshop.svg` (hell 0,16) / `-dark.svg` (dunkel 0,12), ca. 28 KB. `background-attachment: fixed` → Muster steht, Inhalt scrollt darüber. Runde 2 (Kritzelmotive) ersetzt.
Stellschrauben im Generator: `ZELLE` (Dichte), `STRICH` (Dicke), `WACKEL` (Unruhe), `SEED` (anderes Muster). Aufruf: `node tools/make-texture-popshop.mjs`.

01.10.2026 (Runde 4, Owner: „sieht aus wie ein schlecht gezeichnetes Labyrinth-Game … näher am Haring-Stil … etwas kleiner skaliert, Strichstärke besser ins Board-Design"): Generator neu (`tools/make-texture-popshop.mjs`): 9 tanzende Silhouetten-Figuren (zufällige Posen, teils kopfüber, Tintenkontur unter flacher Signalfarbe, Bewegungsstriche am Kopf) plus 61 Füllmotive (Wellen, Zickzack, Strichgruppen, Strahlen, Spiralen, Herzen, Sterne, Kreuze, kleine Kraken) auf einem Torus; Kachel 760 px, Deckkraft hell 0,30 / dunkel 0,24; Anzeige auf 60 % (456 px), Kontur ≈ 3,6 px wie die Board-Ränder. Mit vollem Kontrast gesehen (bunt, nahtlos) und im Board hell gesehen (blass, Karten lesbar). Eigene Figuren, keine von Harings.
Nicht gesehen: Dark Mode des neuen Musters, Auswertung.

## Definition of Done

Geprueft gegen: Screenshots Board hell + dunkel, Auswertung hell + dunkel, Nahtprüfung der Kachel mit überhöhtem Kontrast, Computed-Style-Skript (Board und Auswertung `fixed` mit Bild; Kopf, Leiste, Detail ohne Bild)
Offen: nichts (Stärke, Dichte und Figuren lassen sich per Generator nachjustieren)

05.10.2026 — Abschluss-Audit (Vollständigkeits-Skill, 8 Fragen + 4 Gegenproben, gegen Auftrag, Code und Messungen):
- Auswertung mit Muster gesehen (hell + dunkel). Befund: Titel und Hinweis lagen direkt auf dem Muster → Untergrund-Plaketten und Retro-Override (siehe v83 Nachtrag); das Muster bleibt dahinter.
- Urheberrecht: Das Muster ist eigener Generator-Output (`tools/make-texture-popshop.mjs`), keine nachgezeichneten Haring-Figuren.
- Folgepflicht Wiederherstellung: Generator und Seed `1987` liegen im Repo; Aufruf `node tools/make-texture-popshop.mjs`.
Stand: **abgeschlossen**.
