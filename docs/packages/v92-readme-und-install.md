# v92 — README und Installationsanleitung

> Owner 01.10.2026: „Fange an, ein umfangreiches Readme zu schreiben, weil das Board später ggf. an
> anderer Stelle importiert wird — über wenige Dateien wie ein Readme oder eine Install-Anleitung,
> gut nachvollziehbar."

## PIG

**Problem:** Das README beschrieb einen alten Stand (sieben Phasen, sechs Meilensteine, Ollama als
Standard für alles); Einrichtung und Umzug standen verstreut in Paketen; `.env.example` kannte die
Google-Zugänge nicht.
**Intent:** Jemand ohne Vorwissen kann das Board an anderer Stelle aufsetzen und versteht, nach welchen
Regeln es entscheidet.
**Goal:** Zwei Dateien — `README.md` (Funktionsweise und Regeln) und `INSTALL.md` (Voraussetzungen,
Drive, Ordnerwahl, Einrichtung, Umzug, Fehlerbehebung) — gegen den Code geprüft.

## Stand

01.10.2026 — geschrieben. Fakten aus dem Code gezogen: Phasen/Ordner (`PHASEN` in `lib/pipeline.js`),
Vorlauf-Standard 3/3/6 (`OFFSET_STANDARD`), Upload = Drehtermin + 8 (`UPLOAD_NACH_DREH_TAGE`), Drive-Struktur
(rclone-Listing 01.10.2026), Meldungsarten (`lib/kartenhinweise.js`), Diagnose-Ausgabe (`Diagnose.cmd`).
`.env.example` um `GOOGLE_OAUTH_CLIENT_ID/SECRET` ergänzt.

## DoD

- [x] README: Grundsatz, Drive-Struktur, Karten/Spalten/Sperren, Termine + Upload-Regel, Wochenziel, KI, Anbindungen, Auswertung, Code-Aufbau
- [x] INSTALL: Voraussetzungen, Start, rclone, Ordnerwahl, Einrichtung, Social-Apps, Umzug, Fehlerbehebung
- [ ] Gegenprobe durch einen Durchlauf auf einem frischen Rechner/Ordner (beim Ordnerwechsel)
