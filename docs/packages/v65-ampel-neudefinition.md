# v65 — Ampel neu definiert: Punkt = reine Zeit-Ampel, „!" = Warnungen getrennt

> Umgesetzt 24.09.2026. Nur `lib/pipeline.js` und `public/board.js`. Parallel-Session-Kollision:
> `public/ui.js`, `public/style.css`, `server.js`, `lib/drive.js` NICHT beruehrt (bei Commit per
> `git status` geprueft). `style.css` bewusst gemieden — die „!"-Farbe kommt inline aus `var(--hinweis)`.

## PIG

**Problem (belegt gegen `data/board.json`, 24.09.2026):** `faelligkeit()` liest allein
`card.dates[phase.termin]`. Fuer Videodreh-Karten ist `card.dates.dreh` leer, obwohl ein Drehtermin
zugewiesen ist. Beleg: Karte „Boden wie ein Schwamm" (column `videodreh`) traegt
`drehterminId: cmtk4icomrqfn` (Drehtermin-Datum **13.09.2026**, heute 24.09. → 11 Tage ueberfaellig),
aber `dates = {schnitt, freigabe, upload}` — KEIN `dreh`. Darum liefert `faelligkeit()` Status `fehlt`
(grauer Punkt) statt `befund` (rot). Die Warnung „ausserhalb des empfohlenen Fensters"
(`drehImFenster`) steht nur in der Detailspalte (`detail.js:518`), nicht am Punkt.

Zweitproblem: v64 mischte Termin-Farbe und Sperr-Punkt in EINEN Punkt (Dringlichkeitsrang). Der Punkt
trug dadurch zwei Bedeutungen zugleich — Zeit UND Blocker —, was ihn mehrdeutig machte.

**Intent:** Der Punkt soll EINE Frage beantworten: wie dringlich ist die Zeit. Blocker und
Detail-Warnungen gehoeren daneben, nicht in die Punktfarbe. Ein zugewiesener Drehtermin muss zaehlen,
auch wenn er nur im Drehtermin-Objekt steht und nicht in `card.dates`.

**Goal:**
1. Punkt = reine Zeit-Ampel ueber die dringlichste RELEVANTE Frist: Termine der aktuellen + noch
   kommenden Phasen (durchlaufene zaehlen nicht) plus den zugewiesenen Drehtermin (relevant bis
   einschliesslich `videodreh`), aufgeloest ueber `card.drehterminId` — auch bei leerem `dates.dreh`.
2. Schwellen als benannte Konstanten `AMPEL = {rotTage:2, gelbTage:5}`: ueberfaellig ODER ≤2 = `befund`
   (rot) · 3–5 = `hinweis` (gelb) · ≥6 = `ok` (gruen). Keine Settings-UI hier (Baustein 3 spaeter).
3. „!" = gelbes Ausrufezeichen neben dem Punkt (Hinweis-Ton), wenn offene Blocker (`offenePunkte`)
   ODER Detail-Warnungen (Drehtermin ausserhalb `drehImFenster`) anliegen. Kein „!", wenn nichts
   anliegt. Der Punkt behaelt seine Zeit-Farbe unabhaengig davon.
4. Keine neuen Status-Woerter (Regel 3, `docs/ui-standard.md`); 6-Woerter-System bleibt.

## Ist-Analyse (belegt, nicht erinnert)

- `lib/pipeline.js:212 faelligkeit(card)` — liest `(card.dates||{})[p.termin]` der AKTUELLEN Phase;
  Schwellen bisher `tage<=1 befund`, `tage<=3 hinweis`, sonst `ok`. Kennt keinen Drehtermin.
- `public/store.js:772 karteZuTermin()` setzt `k.dates.dreh = t.datum` beim Zuordnen — deshalb haben
  NEU zugeordnete Karten `dates.dreh`. Aeltere/aus anderen Pfaden stammende Karten aber nicht:
  `board.json` zeigt „Boden wie ein Schwamm" und „Huehnernahrung mit Maden" mit `drehterminId`, aber
  ohne `dates.dreh`. Die robuste Quelle ist daher `card.drehterminId` → `S.drehtermine`, nicht `dates`.
- `public/board.js:64-86 kachel()` — v64-Merge: `faelligkeit` + `offenePunkte` ueber
  `DRINGLICHKEIT`-Rang in EINEN `statusCode`. `AUFMERKSAM = {befund}` erzeugte die Glyphe in
  Termin-Farbe (rot).
- `public/board.js:32 offenePunkte(k)` = `sperren(tore(k, stand))`, gefiltert um Drive-abhaengige
  Tore ohne Scan (`BRAUCHT_DRIVE`). Bleibt die Blocker-Quelle fuer das „!".
- Drehtermin-Aufloesung: `store.js:714 drehtermin(id)` = `S.drehtermine.find(t=>t.id===id)`;
  `card.drehterminId` verweist darauf. `S.drehtermine` = `[{id, datum, karteIds, ...}]`.
- `pipeline.js:195 drehImFenster(drehDatum, uploadDatum)` bleibt die Fenster-Pruefung fuer das „!".

## Regeln (Zielzustand)

- **Relevante Fristen** einer Karte: fuer jede Phase mit `phaseIndex(p.id) >= phaseIndex(card.column)`
  und gesetztem `p.termin` das Datum aus `card.dates[p.termin]`; zusaetzlich der aufgeloeste
  Drehtermin als `dreh`-Frist, solange `phaseIndex(card.column) <= phaseIndex("videodreh")`. Ist ein
  Drehtermin aufgeloest, gewinnt sein Datum die `dreh`-Frist (statt evtl. veraltetem `dates.dreh`).
- **Dringlichste Frist** = kleinste `tageBis` (negativ = ueberfaellig).
- **Ampel-Status**: `ueberfaellig|≤rotTage → befund`; `≤gelbTage → hinweis`; sonst `ok`. Keine
  relevante Frist → `ok` (nichts Dringliches).
- **„!"**: `offenePunkte(k).length > 0` ODER (Drehtermin relevant UND `!drehImFenster`). Immer
  Hinweis-Ton (gelb), Icon `warnung` (Dreieck mit Ausrufezeichen). Farbe inline `var(--hinweis)`.

## Plan

1. `pipeline.js`: `AMPEL`, `ampelStatus(tage)`, `relevanteFristen(card, drehDatum)`,
   `dringlichsteFrist(...)`, `ampel(card, drehDatum)` (liefert `{status, frist, satz}`). `faelligkeit()`
   unangetastet (detail.js:395, app.js:88 nutzen sie weiter fuer den Phasen-Satz).
2. `board.js`: `kachel()` auf `ampel()` umstellen; Drehtermin ueber `drehtermin(k.drehterminId)`
   aufloesen (nur wenn relevant); „!" von der Punktfarbe entkoppeln (immer Hinweis-Ton, inline-Farbe).
   v64-`DRINGLICHKEIT`-Merge entfaellt.

## Verify (Beleg, 24.09.2026, heute laut Node = 2026-09-24)

- `node --check public/board.js` → OK; `node --check lib/pipeline.js` → OK.
- **Node-Probe gegen echtes `lib/pipeline.js`** (Import + echte `data/board.json`-Karten):
  - „Boden wie ein Schwamm" (videodreh, `dates.dreh` leer, Drehtermin 13.09.): `ampel().status =
    befund`, Satz „Drehtag war am 13.9.2026 faellig, seit 11 Tagen ueberfaellig.", `drehAus = true`.
  - Schwellen (`column=upload`, synthetische Frist): −3/0/+2 → `befund` · +3/+4/+5 → `hinweis` ·
    +6/+10 → `ok`. `ampelStatus` direkt: −5/0/2 → befund, 3/5 → hinweis, 6/null → ok.
- **Live/DOM + computed styles** (echte `kachel()` aus dem servierten `/board.js`, echte Karten aus
  `/api/board`, im DOM gerendert, `getComputedStyle`):
  - „Boden wie ein Schwamm": `.eintrag-punkt-befund` → `rgb(255,90,90)` (`--befund`, rot); „!"-Glyphe
    vorhanden, Farbe `rgb(255,185,55)` (`--hinweis`, gelb), Titel „Drehtermin liegt ausserhalb des
    empfohlenen Fensters."; Punkt-Titel „… seit 11 Tagen ueberfaellig." → **rot + gelbes !**.
  - „Waldvierecke" (Schnitt in 2 Tagen): `.eintrag-punkt-befund` (rot).
  - „MachuPicchu" (Schnitt in 31 Tagen): `.eintrag-punkt-ok` `rgb(79,157,74)` (gruen) + gelbes „!"
    (2 offene Blocker) → **Punkt behaelt Zeitfarbe unabhaengig von der Warnung**.
  - „Oberflaechenspannung" (schnitt, past videodreh): gruen, „!" NUR aus Blocker, KEINE
    Dreh-Fenster-Warnung → Dreh-Relevanz endet nach „videodreh" bestaetigt.
  - „kein !": Fertig-Karten (Digitaler Sandkasten/KPI/Auswertung-Tabellen) gruen ohne Glyphe;
    synthetische Fertig-Karte `hatAchtung=false`. „Jungbodenschutz" hat roten Zeit-Punkt OHNE „!"
    (kein Blocker offen) → Punkt und Warnung sind sauber getrennt.
  - **Screenshot** der hochskalierten Probe-Kacheln bestaetigt optisch: gelbes Warndreieck links,
    farbiger Zeit-Punkt rechts (Boden=rot, Waldvierecke=rot, MachuPicchu=gruen).
- Hinweis: Das Live-Board selbst hing im Ladezustand (App wartet auf Drive-/Defaults-Calls der
  Parallel-Umgebung, Konsole fehlerfrei); der DOM-Beleg rendert daher die echte `kachel()` isoliert
  gegen die echten Kartendaten — kein Fenster im Vordergrund noetig.

## Stand

- [x] Bestand + Ursache belegt (board.json, faelligkeit, karteZuTermin, drehtermin-Aufloesung)
- [x] pipeline.js: Ampel-Funktionen + AMPEL-Konstante (`faelligkeit()` unangetastet)
- [x] board.js: kachel() auf reine Zeit-Ampel + getrenntes „!" (v64-DRINGLICHKEIT entfaellt)
- [x] Verify (node --check, Node-Probe gegen echtes pipeline.js, Live/DOM + computed styles + Screenshot)
- [ ] Commit + Push

## DoD

Geprueft gegen: `node --check` (pipeline.js, board.js) · Node-Probe gegen echtes `lib/pipeline.js`
mit den echten `board.json`-Karten (Boden wie ein Schwamm = rot+!, Schwellen 2T=rot / 4T=gelb /
>6T=gruen / ohne Warnung = kein !) · Live/DOM + `getComputedStyle` der echten `kachel()` + Screenshot.
Offen: nichts im Auftrag. Bewusst NICHT gemacht (ausserhalb Auftrag): Settings-UI fuer die Schwellen
(Baustein 3 — `AMPEL` liegt als benannte Konstante bereit); `public/style.css` bewusst nicht
angefasst (die „!"-Farbe kommt inline aus `var(--hinweis)`).
