# v43 — README-Sync auf v40/v41/v42-Stand

## PIG

**Problem:** Die README beschreibt einen überholten Stand. Konkret:
1. „KI ohne Token-Kosten … laufen über die lokale Claude-Code-CLI" (`README:22–24`) — seit v40
   gibt es **drei getrennt konfigurierbare KI-Rollen** (Userkommunikation/Recherche/Kontextabgleich),
   lokal via Ollama oder Claude-Abo, und die **Recherche-Rolle sucht echt im Web** (v40 T2).
2. Verbinden/**Trennen** (v40 T3) und die Web-Suche fehlen ganz.
3. „ohne sie startet das Board mit dem mitgelieferten Karten-Stand (`data/board.json`)"
   (`README:64–65`) ist seit v41 **falsch** — die Datei ist nicht mehr im Repo (`git rm --cached`
   + `.gitignore`, Commit `d619c11`). Ein Klon startet leer und füllt sich aus Drive.
4. Aufbau-Tabelle: `data/board.json` als „Karten-Index" (ist jetzt lokaler Cache); `lib/ai.js`
   nur „Claude-CLI"; `lib/websuche.js` fehlt.

**Intent:** Doku synchron zum ausgelieferten Stand halten (Werkbank-Regel: Fixes landen synchron
in Werkbank, Bausatz und Doku). Ein Klon-Nutzer soll nicht auf falsche Zusagen bauen.

**Goal:** README nennt die KI-Rollen + Web-Suche + Verbinden/Trennen korrekt und sagt richtig,
dass ein Klon ohne Drive **leer** startet (board.json = lokaler Cache, nicht mitgeliefert).

## Bestandsaufnahme (gemessen 15.09.2026)

- Belege für den Ist-Stand: `v40-…md` Stand-Sektion (T2 Rollen + Web-Suche + T2-Rest, T3
  Verbinden/Trennen, alle [x], verifiziert 12.09.); `v41-board-json-untracked.md` + Commit
  `d619c11` (board.json aus Tracking); `server.js:101–108` (`leseBoard()` → leeres Board bei
  fehlender Datei); `lib/websuche.js` existiert (v40 T2).

## Plan

1. `README.md`: KI-Absatz auf 3 Rollen + Web-Suche; Anbindungen-Absatz (Verbinden/Trennen);
   „anderer Rechner"-Absatz auf „startet leer, Drive ist Wahrheit"; Aufbau-Tabelle nachziehen
   (board.json = Cache, ai.js = Claude+Ollama, websuche.js ergänzen).
2. Commit + Push (nur `README.md` + dieses Paket — kollisionsfrei zur Code-Arbeit).

## Stand

- [x] Ist-Stand belegt (v40/v41-Pakete, d619c11, server.js) — 15.09.2026
- [x] README KI-Rollen + Web-Suche + Anbindungen
- [x] README „anderer Rechner" board.json-Aussage korrigiert
- [x] Aufbau-Tabelle nachgezogen
- [x] Commit + Push

## DoD

- README nennt keine widerlegte Aussage mehr (kein „mitgelieferter board.json"-Klon-Start).
- KI-Rollen, Web-Suche und Verbinden/Trennen stehen drin.
- Aufbau-Tabelle passt zu den vorhandenen Dateien.

## Hinweis: Paket-Nummern-Kollision v41

Es existieren ZWEI v41-Pakete: `v41-board-json-untracked.md` (diese Session, `d619c11`) und
`v41-knopf-pipelines-und-workflows-tab.md` (Parallel-Session, `f8e3d79`). Nicht eigenmächtig
umbenannt — beide sind committet und die andere Session referenziert ihre Nummer. Auflösung ist
eine Abstimmungs-Entscheidung (Owner/Sessions), kein Solo-Griff.
