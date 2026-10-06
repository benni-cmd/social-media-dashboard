# v109 — Architektur- & Integrations-Doku (für Einbettung in die Rootwork-Showcase)

> Owner-Auftrag 06.10.2026. Rahmen/Plan in dieser Session; Bau durch eine Opus-5.5-Session (siehe Prompt).

## PIG

**Problem:** Es gibt keine konsolidierte Architektur-Doku. Leon will das Board in
**https://showcase-rootwork.vercel.app/** einbetten und anpassen — dafür muss glasklar sein, wie die
Software funktioniert (Komponenten, API, Speicher, Abhängigkeiten) und welche Integrationswege es gibt.

**Intent (Owner 06.10.2026):** Eine `docs/architektur.md` als Integrations-Spezifikation; zusätzlich die
verschiedenen **Integrationswege mit Aufwand + Pro/Contra**, konkret bezogen auf die genannte Vercel-
Showcase und darauf, wie der Rest der Software arbeitet.

**Goal:** Ein gepushtes `docs/architektur.md` (damit auf GitHub), das (a) die Architektur **akkurat aus den
echten Quellen** beschreibt und (b) die Einbettungs-Optionen bewertet — als Entscheidungsgrundlage für Leon.

## Zentrale Wahrheit (muss die Doku klar machen)
Das Board ist **local-first**: Node-Server `localhost:4321` + **rclone/Google-Drive** als Wahrheit +
**Claude-/Codex-CLI bzw. Ollama** für KI (token-frei), alles auf dem Owner-Rechner; `data/` nur Cache.
Es ist KEINE statische/serverlose App → Einbettung in Vercel (serverlos, kein rclone/CLI/localhost) ist
eine echte Anpassung, kein Quick-Embed. Diese Grenze (lokal-gebunden vs. portierbar) ist der Kern.

## Inhalt von docs/architektur.md (die 5-5-Session füllt, aus echten Quellen)
1. **Komponenten-Karte:** Frontend `public/*.js` (ES-Module) ↔ Server `server.js` (`/api/*`) ↔ Stores ↔
   Drive (`lib/drive.js`/rclone) ↔ KI-CLIs. Mit Datenfluss.
2. **API-Oberfläche:** alle `/api/*`-Endpunkte (GET/PUT …) mit Zweck + Ein/Ausgabe (aus server.js).
3. **Datenmodell + Speicher-Vertrag:** was in Drive liegt vs. lokaler Cache (`docs/drive-convention.md`
   verdichten); Stores (plan/workflow/kontext/defaults/boardparam).
4. **Pro Funktion: wer darf · wann (Auslöser) · was passiert · wo gespeichert** — Tabelle, aus
   `lib/workflows.js` (ausloeser/wirkung/ort), `pipeline.js` (PHASEN/Tore), `kartenhinweise.js`. Inkl. dem
   klaren Satz: Einzel-Owner je Board, kein App-Rollen-/Rechtemodell (Zugriff über Drive-Freigaben).
5. **Integrationswege für die Showcase** (konkret auf https://showcase-rootwork.vercel.app/ bezogen —
   Framework/Struktur der Showcase ansehen): z. B. iframe auf lokale Instanz · öffentliche Read-only-
   Ansicht aus Drive · komplettes Re-Host serverseitig · reiner visueller Showcase · hybrid. Je **grober
   Aufwand + Pro/Contra**, mit Bezug auf die local-first-Abhängigkeiten.

## Stand
- [x] Rahmen/Plan + zentrale Wahrheit festgehalten (diese Session, 06.10.2026)
- [ ] docs/architektur.md gebaut (Opus-5.5-Session) — akkurat aus Quellen + Showcase angesehen
- [ ] committet + gepusht (auf GitHub)

## DoD
- `docs/architektur.md` existiert, aus echten Quellen (nicht geraten), auf GitHub gepusht.
- Enthält Komponenten/API/Speicher/Abhängigkeiten, die Pro-Funktion-Tabelle und die bewerteten
  Integrationswege (Aufwand + Pro/Contra), konkret auf die Rootwork-Showcase bezogen.
