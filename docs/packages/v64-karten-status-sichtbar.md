# v64 — Ueberfaelliger Termin wird ROT sichtbar + kein leerer Platzhalter-Kreis

> Umgesetzt 24.09.2026. Nur `public/board.js` geaendert (`lib/pipeline.js` geprueft,
> kein Fehler → nicht angefasst). Parallel-Session-Kollision: `style.css`, `ui.js`,
> `drive.js`, `server.js`, `drivesetup.js` NICHT beruehrt.

## PIG

**Problem:** Owner-Beobachtung 24.09.2026 am laufenden Board:
1. Die meisten Status-Punkte oben rechts wirken „einfach grau und zeigen gar nichts an". Konkret:
   eine Karte in „Videodreh" mit Drehtermin 13.09.2026 (heute 24.09. → 11 Tage ueberfaellig) hat
   einen GRAUEN statt eines ROTEN Punkts.
2. Neben dem Punkt steht ein leerer Kreis als Platzhalter-Glyphe — soll nur bei echter Warnung da sein.
3. (nur falls ohne `style.css` machbar) Titelzeile darf etwas laenger sein.

**Intent:** Echte Zeit-Dringlichkeit (ueberfaelliger/naher Termin = `befund`/rot) darf nicht hinter
einem blassen `fehlt`-Zustand verschwinden. Die Aufmerksamkeits-Glyphe soll nur eine echte Warnung
markieren, keinen leeren Platzhalter.

**Goal:**
1. Ein ueberfaelliger (oder ≤1 Tag naher) Termin faerbt die Kachel ROT (`befund`), auch wenn ein
   `fehlt`-Sperr-Punkt offen ist — ohne neue Status-Woerter, ohne geaenderte Schwellen.
2. Glyphe erscheint nur bei `befund`; keine Glyphe (kein leerer Kreis) bei `fehlt`/`ok`/`hinweis`.

## Ursache (belegt, nicht geraten)

`board.js` `kachel()` setzte `statusCode = offen.length ? offen[0].status : f.status` — der erste
offene Sperr-Punkt gewann IMMER gegen den Termin. Fuer eine Videodreh-Karte mit gescanntem Drive
und leerem Rohmaterial liefert `tore()` das Sperr-Tor `rohmaterial` mit Status `fehlt`
(`--fehlt: #8f7f5c`, blasses Oliv), waehrend `faelligkeit()` fuer den ueberfaelligen Drehtermin
korrekt `befund` (`--befund: #ff5a5a`, rot) liefert. `offen[0].status = "fehlt"` verdeckte also
das rote `befund`. `lib/pipeline.js` ist korrekt — die Ursache lag allein in der Vorrang-Zeile.

Die „leere Kreis"-Glyphe: `AUFMERKSAM` enthielt `["befund","fehlt"]`; das Icon fuer `fehlt` ist
`kreis` (STATUS-Tabelle in `ui.js`) — ein LEERER Kreis in blassem Oliv, den der Owner als
Platzhalter „der nichts anzeigt" gemeldet hat.

Beleg (Node-Probe gegen das echte `lib/pipeline.js`, Owner-Karte nachgebaut):
`A) termin='befund', gate='fehlt' → alt_vorher='fehlt', neu_jetzt='befund'`. Gegenproben:
`C) hinweis+fehlt → fehlt` und `D) ok+fehlt → fehlt` (Sperr-Vorrang bleibt, wenn der Termin
NICHT dringlicher ist).

## Umsetzung (`public/board.js` `kachel()`)

- Vorrang per Dringlichkeitsrang statt „Sperr-Punkt gewinnt immer":
  `DRINGLICHKEIT = { befund:5, fehlt:4, hinweis:3, unlesbar:2, entfaellt:1, ok:0 }`.
  `zeigeTermin = !sperr || DRINGLICHKEIT[f.status] > DRINGLICHKEIT[sperr.status]` → die Kachel
  zeigt den DRINGLICHEREN der beiden; bei gleichem Rang behaelt der Sperr-Punkt Vorrang (Karte
  kann nicht weiter). `statusSatz` folgt entsprechend (Termin-Satz vs. Sperr-Satz inkl.
  „Insgesamt N Punkte offen"). Keine neuen Woerter, keine Schwellen geaendert.
- `AUFMERKSAM = new Set(["befund"])` (vorher `["befund","fehlt"]`) → Glyphe nur bei echter
  Warnung; der gefuellte Farbpunkt bleibt bei jedem Status stehen (Regel 3). Nebeneffekt: die
  breitere Titel-Reservierung (`eintrag-hat-achtung`) entfaellt fuer Nicht-Warnungen → mehr
  Titel-Platz (Ziel 3 teilweise erfuellt, ohne `style.css`).

## Verify (Beleg, 24.09.2026)

- `node --check public/board.js` → OK; `node --check lib/pipeline.js` → OK.
- Node-Probe gegen echtes `pipeline.js` (5 Faelle): A) fehlt→**befund**; B) ohne Drive-Scan
  bereits befund; C) hinweis+fehlt→fehlt; D) ok+fehlt→fehlt; E) Rohmaterial da→befund.
- Browser (Server der Parallel-Session auf 4321 serviert das geaenderte `board.js` statisch;
  eigenes Rendern der `kachel()`-Ausgabe + `getComputedStyle`, Live-Board-Daten hingen im Laden):
  - A) Videodreh/Dreh 13.09: `.eintrag-punkt-befund`, Farbe `rgb(255,90,90)`, Glyphe vorhanden
    (Achtung-Icon `M12 8v4`), Tooltip „Drehtag war am 13.9.2026 faellig, seit 11 Tagen ueberfaellig."
  - F) reine `fehlt`-Karte: `.eintrag-punkt-fehlt`, Farbe `rgb(143,127,92)`, **keine Glyphe**,
    `eintrag-hat-achtung` nicht gesetzt.
  - O) `ok`-Karte: `.eintrag-punkt-ok`, Farbe `rgb(79,157,74)`, keine Glyphe.
  - Screenshot der drei Probe-Kacheln bestaetigt: A rot + Warnung, F blasser Punkt ohne leeren
    Kreis, O gruen.

## Stand

- [x] Bestand + Ursache belegt (board.js Vorrang-Zeile, pipeline.js korrekt, Farbwerte nachgemessen)
- [x] Umsetzung (board.js: Dringlichkeitsrang + AUFMERKSAM)
- [x] Verify (node --check, Node-Probe, Browser-DOM/computed-styles + Screenshot)
- [x] Commit + Push

## DoD

Geprueft gegen: `node --check` (board.js, pipeline.js) · Node-Probe gegen `lib/pipeline.js`
(A–E) · Browser-Render der servierten `board.js` + `getComputedStyle` (A/F/O) + Screenshot.
Offen: Ziel 3 (Titelzeile generell laenger) nur teilweise — die Basis-Reservierung/Zeilenhoehe
liegt in `public/style.css` und ist der Parallel-Session vorbehalten → **ZURUECKGESTELLT**.
