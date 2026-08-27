# Work package: v1 — Content-Pipeline-Board

> Work artifact per `working-method.md`: lebt im Repo dieses Projekts
> (`user-projects/social-media-dashboard/docs/packages/`) und landet mit dem Projekt
> auf GitHub. Angelegt beim Planen, nachgefuehrt bei jedem Paket-Abschluss.

**Problem:** Ben produziert Social-Media-Content (Kurzvideos fuer Instagram + LinkedIn)
ohne festen Ablauf und ohne Ort, an dem eine Idee bis zum Upload sichtbar wandert. KI-Hilfe
(Skript, Caption, Hooks) laeuft heute manuell in getrennten Tools und kostet dort API-Tokens.

**Intent:** Ein lokales Dashboard, das den Weg Idee -> Skript -> Schnitt -> Caption -> Upload
als Trello-artiges Board zeigt und KI-Funktionen direkt hinter Buttons anbietet — token-frei,
weil die KI ueber die lokale Claude-Code-CLI (`claude -p`) und damit ueber Bens Abo laeuft,
nicht ueber die kostenpflichtige API.

**Goal:** Ein per `npm start` startbares lokales Board (Browser, `localhost`), auf dem man
Karten anlegt, zwischen fuenf Spalten zieht und pro Karte mindestens drei KI-Aktionen
ausloest, deren Ergebnis in der Karte landet. Stand persistiert lokal. Optische Abnahme per
echtem Screenshot bestanden.

## Plan

1. [x] Weichen geklaert (KI-Backend = Claude-CLI · v1 = Board · Analytics spaeter via OAuth-APIs)
2. [x] Eigenes Repo `social-media-dashboard` (privat, `benni-cmd`) angelegt und verifiziert gepusht
3. [x] Server-Skelett: Node-`http` ohne Abhaengigkeiten, statisch + `/api/board` + `/api/ai`
4. [x] `/api/ai` ruft lokal `claude -p` (stdin-Prompt), klare Meldung wenn CLI fehlt/nicht eingeloggt
5. [x] Board-UI: fuenf Spalten (Idee/Skript/Schnitt/Caption/Upload), Karten anlegen, Drag&Drop, Detail-Panel
6. [x] KI-Buttons pro Karte: Skript-Entwurf · Caption schreiben · Hook-Ideen
7. [x] Persistenz: `data/board.json`, bei jeder Aenderung gespeichert
8. [ ] Claude-CLI installiert + eingeloggt (Bens Handlung: Login interaktiv)
9. [ ] Optische Abnahme: echter Browser-Screenshot gegen `docs/ui-standard.md`

## Status

2026-08-27 — Projekt aufgesetzt: eigenes Repo, lauffaehiges v1-Skelett (Server + Board-UI +
KI-Endpoint) gebaut und committet. Offen fuer echtes KI-Ergebnis: Claude-CLI muss lokal
installiert (`npm i -g @anthropic-ai/claude-code`, verifiziert 2.1.247) und eingeloggt sein —
Login ist Bens interaktiver Schritt. Optische Abnahme steht noch aus.

## Definition of Done

Geprueft gegen: `npm start` startet Server · Board oeffnet auf `localhost` · Karte anlegen +
ziehen + KI-Button loest `claude -p` aus und schreibt Ergebnis in die Karte · `data/board.json`
persistiert · Screenshot gegen `docs/ui-standard.md`.
Offen: Claude-CLI-Login (Ben) · optische Abnahme.

## Naechste Ausbaustufen (nicht v1)

- Analytics-Dashboard: Instagram Graph API + LinkedIn API (OAuth) — Zahlen automatisch ziehen.
- Attribut-Analyse: warum lief ein Video besser/schlechter (Laenge, Hook, Thema, Postzeit).
- Upload-Anbindung statt manuellem Haken in der Upload-Spalte.
