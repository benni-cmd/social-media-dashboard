# v104 — KI-Ergebnis lesbar, Kalender-Datum richtig, Weiter-Grund sichtbar, kein „!" für Spaltenarbeit

> Owner-Meldungen 01.10.2026 (Screenshots im Chat):
> 1. „Das ist keine gute Darstellung des KI-Ergebnisses … ohne Klammern und Code-Anhang, sodass
>    man es editieren kann, aber nicht das Gefühl hat, Code schreiben zu müssen."
> 2. „Im Kalender für das Uploaddatum den 26. November ausgewählt, er trägt immer den 25. ein."
> 3. „Jetzt kann ich bei der Karte nicht auf Weiter klicken, warum weiß ich nicht. Bitte
>    Funktionalität der Spalten nochmal prüfen."
> 4. „Auf der Karte ist ein Ausrufezeichen, die Info dahinter ist nur, dass das Skript fehlt …
>    logisch, weil die Karte noch in der Skript-Spalte ist. Kein Warnhinweis, wenn es nur um die
>    Arbeit in der jeweiligen Spalte geht."

**Problem (Ursachen gemessen):**
1. Die Recherche-Antwort der lokalen KI hatte ein überzähliges Komma vor „]" →
   `JSON.parse` scheiterte (`lib/ai.js parseJson`) → gespeichert als `{ raw }` → angezeigt als
   `<pre>` (Schreibmaschinenschrift) mit Klammern. Folge: Fokus/Hook nicht wählbar → Weiter gesperrt.
2. `public/ui.js modalKalender`: `tag.toISOString()` rechnet die deutsche Mitternacht in UTC um
   → Vortag. Gegenprobe `TZ=Europe/Berlin`: 26.11. → „2026-11-25", 15.07. → „2026-07-14".
   Kein Vorlauf, ein Fehler.
3. Weiter-Sperre war korrekt (Fokus/Hook + Skript-Dokument fehlen), der Grund stand nur im Tooltip.
4. `lib/kartenhinweise.js`: Tor „skript-datei" ist als Warnung katalogisiert — auch dort, wo es
   die Arbeit der eigenen Spalte ist (sperrend).
**Intent:** Das Board spricht Mensch, nicht Code; jede Sperre erklärt sich; Warnungen nur für echte Probleme.
**Goal:** KI-Ergebnisse erscheinen als Auswahl/Felder; Kalender trägt den geklickten Tag ein;
unter dem gesperrten Weiter steht der Grund; die eigene Spaltenarbeit erzeugt kein rotes „!".

## Plan

1. [x] `lib/pipeline.js parseJsonNachsichtig` (Zaun, Text drumherum, überzählige Kommas,
   typografische Anführungszeichen) — genutzt von `lib/ai.js` und im Browser.
2. [x] `public/detail.js`: `repariereRohAntworten` macht gespeicherte Roh-Antworten beim Öffnen
   zu Feldern (und speichert); nicht lesbare zeigt `rohBlock` als Lesetext mit „Erneut versuchen".
   `.textblock` in normaler Schrift statt monospace.
3. [x] `public/ui.js`: Kalender bildet das Datum aus der Ortszeit.
4. [x] `public/detail.js blockAbschluss`: „Noch zu tun, bevor es weitergeht: …" sichtbar.
5. [x] `lib/kartenhinweise.js`: sperrende Tore (Arbeit der eigenen Spalte) nie als Warnung — nur
   als Hinweis bei gelber/roter Frist.
6. [x] Spalten-Prüfung (Weiter-Regeln je Spalte, Reel + Slider).

## Status

02.10.2026 — gebaut und geprüft:
- Bens gespeicherte Antwort („Grundsaeuerung des Bodens einfach erklärt") wird gelesen:
  zusammenfassung, 3× fokus, frame, keywords. Kaputter Text bleibt `null`.
- Datum: Gegenprobe oben, neu 26.11. → „2026-11-26".
- Kartenhinweis-Regel (`node -e`): Skript-Spalte + Frist ok → nichts; Frist knapp → Hinweis;
  Altlast in späterer Spalte (nicht sperrend) → Warnung bleibt.
- Spalten-Prüfung (`spalten-tore.mjs`, Scratchpad): Reel — jede Spalte sperrt nur ihre eigene
  Arbeit (Skript schreiben: Fokus, Skript-Dokument; Drehtermin festlegen: Skript, Hook, Hook-Bild;
  Videodreh: Rohmaterial; Schnitt: Video, Untertitel, Wasserzeichen; Caption: Vorspann, CTA;
  Upload: nichts); vollständige Karte kommt überall weiter. Slider: nur Fokus und Caption sperren.
- Testkopie (Port 4399, ohne Drive), DOM-Prüfung der Karte: „Schritt 1 von 3 · Fokus" mit drei
  Fokus-Vorschlägen statt Code; Weiter-Grund sichtbar; kein rotes „!" auf der Karte.
- **Optische Abnahme blockiert:** Screenshots im Browser-Pane liefen in „page did not finish
  rendering" (Claude-Fenster im Hintergrund, s. Memory ui-screenshot-edge-headless).

## Definition of Done

Geprueft gegen: Parser-Probe mit Bens Antwort, TZ-Gegenprobe, Hinweis-Regel-Test, Spalten-Prüfung, DOM-Prüfung Testkopie
Offen:
1. Screenshot-Abnahme in der Testkopie (Agent) — sobald das Claude-Fenster vorne ist
