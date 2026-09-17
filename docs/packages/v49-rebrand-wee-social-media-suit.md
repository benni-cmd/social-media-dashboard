# v49 — Rebrand: „Content-Maschine" → „WEE Social Media Suit"

## PIG

**Problem:** Der Produktname war halb umgestellt: `public/index.html` (Titel + Kopf) trug bereits
„WEE Social Media Suit" (Owner-Änderung), aber `README.md`, `server.js` und `public/style.css`
nannten weiter „Content-Maschine" — uneinheitlicher Auftritt.

**Intent:** Ein sauberer, konsistenter Name über alle Live-/Nutzer-sichtbaren Stellen.

**Goal:** „WEE Social Media Suit" überall dort, wo der Name auftritt (Kopf, Tab-Titel, README-H1,
Server-Startlog, Datei-Kopfkommentare). Historische `docs/packages/*` bleiben unverändert
(Zeitdokument, kein Rebrand rückwirkend).

## Umsetzung (17.09.2026)

- `public/index.html` — `<title>` + `.kopf-titel` (schon vorhanden, übernommen).
- `README.md:1` — H1.
- `server.js:1` (Kopfkommentar) + `server.js:1348` (Start-Log `console.log`).
- `public/style.css:1` (Kopfkommentar).
- Name exakt wie in der vorhandenen `index.html`: „WEE Social Media Suit" (ohne -e). Auf Wunsch
  global auf „Suite" umstellbar — ein Suchen-Ersetzen.

## Stand

- [x] Live-Fundstellen umgestellt (README, server.js ×2, style.css); index.html übernommen
- [x] Optische Abnahme: Board gestartet, Kopf + Browser-Tab zeigen „WEE Social Media Suit" (Screenshot)
- [x] Commit + Push

## DoD

- Kein „Content-Maschine" mehr in Live-Dateien (`grep` außerhalb `docs/packages/`).
- Kopf/Tab zeigen den neuen Namen (Screenshot-Beleg).
