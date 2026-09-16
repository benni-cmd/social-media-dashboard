# v45 — Google-Status: echte Token-Gültigkeit statt bloßer Token-Existenz

> PLAN-Paket, angelegt 16.09.2026 zur Ausführung in einer NEUEN Session. Stand-Checkboxen
> unten sind bewusst offen — die bauende Session hakt sie ab.

## PIG

**Problem:** `/api/verbindungen/status` meldet Google als `verbunden`, sobald ein Refresh-Token
existiert (`server.js:1019` → `gcal.verbunden()`), **nicht** ob der Token noch gültig ist. Genau
das hat in v44 den Live-Test blockiert: Der Refresh-Token war abgelaufen („Token has been expired
or revoked", OAuth-App auf *Testing* → 7-Tage-Ablauf), die UI zeigte aber weiter „verbunden".
Der Nutzer sieht den Ausfall erst, wenn eine echte Kalender-Aktion fehlschlägt (v44-Paket Z.90–91).

**Intent:** Der Verbindungs-Status soll die Wahrheit zeigen — ein abgelaufener/entzogener Token
ist „nicht verbunden, bitte neu verbinden", kein grünes „verbunden". Ohne Google bei jedem
Status-Poll zu hämmern und ohne eine kurze Netzstörung fälschlich als „abgemeldet" zu werten.

**Goal:** `status.google.verbunden` spiegelt echte Gültigkeit: gültiger Token → true; abgelaufen/
entzogen → false mit `hinweis` „Token abgelaufen — neu verbinden"; reine Netzstörung → bleibt
„verbunden" (kein Fehlalarm). Ergebnis kurz gecacht, damit Status-Polling Google nicht überlastet.

## Bestandsaufnahme (gemessen 16.09.2026)

- Status-Endpoint: `server.js:1011–1023`; Google-Zeile `:1019` `verbunden: await gcal.verbunden()`.
- `gcal.verbunden()` entscheidet heute rein an Token-Existenz (v44-Befund Z.90).
- Billiger, bereits vorhandener Gültigkeits-Ping: `lib/gcal.js:128 kontoMail()` → `GET
  calendars/primary` (authentifiziert; scheitert bei totem Token). Auth-Fehlersignal: Google
  liefert `invalid_grant` / „expired or revoked".
- Vorbild für „gibt es nicht" vs. „geht gerade nicht": `lib/drive.js` (DriveFehler.fehlend,
  NICHT_GEFUNDEN) — dieselbe Trennung hier auf Auth-Fehler vs. Netzfehler anwenden.

## Plan (Reihenfolge)

1. [ ] `lib/gcal.js`: `gueltig()` — versucht einen billigen authentifizierten Call (Token-Refresh
       oder `kontoMail()`), fängt den Auth-Fehler ab. Rückgabe unterscheidet
       `{ gueltig:true }` · `{ gueltig:false, grund:"abgelaufen" }` (invalid_grant/expired/revoked)
       · Netzfehler → wirft/`{ unklar:true }` (NICHT als abgemeldet werten).
2. [ ] Kurzer Cache (z. B. 60 s, Modul-lokal) auf das Ergebnis, damit Status-Polling nicht bei
       jedem Aufruf Google trifft. Bei „neu verbunden" (OAuth-Callback `server.js:964`) Cache leeren.
3. [ ] `server.js:1019`: Google-Zeile auf das Gültigkeits-Ergebnis umstellen —
       `google: { verbunden, clientKonfiguriert, hinweis? }`. Netz-unklar → `verbunden:true`
       (Bestandsschutz), abgelaufen → `verbunden:false` + `hinweis`.
4. [ ] `public/ui.js`: Wenn `google.hinweis` gesetzt, ihn am Google-Chip zeigen (Ton wie die
       bestehenden „bereit zum Verbinden"-Chips, kein roter Alarm) + „Verbinden" anbieten.
5. [ ] Verify: (a) `node --check` aller Dateien; (b) mit gültigem Konto → Status „verbunden"
       (Screenshot Chip); (c) abgelaufenen Fall belegen — entweder echt (nach Owner-Reconnect
       eines Testkontos) ODER durch temporäres Erzwingen des Auth-Fehlerpfads, dann Chip zeigt
       „Token abgelaufen — neu verbinden". CDP-Screenshot gegen `docs/ui-standard.md`.

## Koordination (PFLICHT vor dem Bau)

Berührt **geteilte, heiße Dateien**: `lib/gcal.js`, `server.js`, `public/ui.js` — dieselben, an
denen v40/v44 gebaut wurde. Vor dem ersten Edit die aktiven Sessions per `tell-session` warnen
(„fasse gcal.js/server.js-Status/ui.js-Chip an"), das Bau-Fenster kurz halten, danach Bescheid
geben. `git status` vor dem Anfassen auf Fremd-Änderungen prüfen.

## Stand

- [ ] gcal `gueltig()` (Auth-Fehler vs. Netzfehler getrennt)
- [ ] 60-s-Cache + Cache-Reset beim Verbinden
- [ ] server.js Status-Zeile umgestellt (+ hinweis)
- [ ] ui.js Chip zeigt Hinweis + Verbinden-Angebot
- [ ] Verify (node --check + Screenshot gültig + abgelaufen-Fall belegt)
- [ ] Commit + Push

## DoD

- Bei gültigem Token: Status „verbunden" wie bisher (kein Regress).
- Bei abgelaufenem/entzogenem Token: Status „nicht verbunden" + Hinweis „neu verbinden", belegt.
- Reine Netzstörung kippt den Status NICHT auf „abgemeldet".
- Google wird durch Status-Polling nicht pro Aufruf getroffen (Cache belegt).
