# v27 — Workflow-Builder im Einstellungsfenster

## PIG

**Problem:** Der Tab „Workflows" (v26) ist eine Liste von Sonderfaellen. Jede der neun
Automationen ist im Register `lib/workflows.js` fest verdrahtet, hat ihre eigenen Parameter und
laesst sich nur an- oder ausschalten. Es gibt keine gemeinsame Form, in der ein Workflow WIRKLICH
bearbeitet wird — und einen eigenen Workflow kann Ben gar nicht bauen.

**Intent:** Der Tab wird vom Schalterbrett zum Werkzeug. Alle Automationen — die eingebauten wie
die selbstgebauten — stehen in EINER Form da: Ausloeser → Bedingungen → Aktionen. Was Ben selbst
zusammensetzt, laeuft anschliessend auch wirklich; was nur beschrieben ist, sagt das von selbst.

**Goal:** Im Einstellungsfenster, Tab „Workflows":
1. alle 9 eingebauten Workflows in der einheitlichen Bausteinform sichtbar (Ausloeser/Bedingung/
   Aktion als Kacheln), mit ihrem heutigen Schalter und ihren Parametern weiterhin bedienbar;
2. ein Builder, der einen neuen Workflow aus dem Baustein-Katalog zusammensetzt;
3. fertige Workflows liegen dauerhaft in `data/own-workflows.json`;
4. ein selbstgebauter Workflow LAEUFT: beim echten Ereignis im Board werden seine Bedingungen
   geprueft und seine Aktionen ausgefuehrt. Jeder Baustein traegt sichtbar, ob er ausgefuehrt oder
   nur beschrieben wird.

---

## Bestandsaufnahme (gemessen, nicht erinnert)

Belege: `grep -n 'an("' public/*.js server.js`, `cat data/workflows.json`,
`grep -n "api/workflows" -r .`

| Was | Wo | Stand vor v27 |
|---|---|---|
| Register der 9 Automationen | `lib/workflows.js` | `{id,name,ausloeser,wirkung,ort,standard,params[],warnung?}` — Prosa + Schalter |
| Abweichung vom Register | `lib/workflowstore.js` → `data/workflows.json` | heute: `{"auto-shutdown":{"an":true}}` |
| API | `server.js:516/521` | `GET`/`PUT /api/workflows` |
| Frontend-Stand | `public/store.js:27-60` | `an(id)`, `stellschraube(id,key)`, `ladeWorkflows()` |
| Tab-Ansicht | `public/ui.js:1101-1216` | `workflowBlock` = Schalter + zwei Saetze + Parameter |

Fundstellen der neun Schalter (alle vorhanden, alle fragen `an(id)` ab):
`public/detail.js:506,996,1114,1237` · `public/store.js:75,150` · `public/board.js:224` ·
`server.js` (Auto-Shutdown) · `public/store.js` (autoSync).

---

## Design-Entscheidungen

**D1 — Baustein-Katalog als eine Wahrheit, isomorph.**
Neu: `lib/workflowblocks.js` (laeuft im Server UND im Browser, wie `pipeline.js` und
`workflows.js`). Darin drei Listen — `AUSLOESER`, `BEDINGUNGEN`, `AKTIONEN` — je Eintrag
`{typ, name, satz, felder[], ausfuehrbar, nurEingebaut?}`. Ein Baustein existiert im Katalog nur,
wenn entweder die Engine ihn ausfuehrt (`ausfuehrbar: true`) oder ein eingebauter Workflow ihn
beschreibt (`nurEingebaut: true`). Ein Baustein, der weder das eine noch das andere ist, waere
eine Luege im UI — dieselbe Regel wie in v26 fuer die Schalter.

**D2 — Die eingebauten neun werden NICHT umgebaut, sondern uebersetzt.**
`lib/workflows.js` bleibt Zeichen fuer Zeichen, wie es war (bis auf einen neuen, rein
beschreibenden Zusatz). `EINGEBAUTE_BAUPLAENE` in `lib/workflowblocks.js` bildet jede der neun IDs
auf `{ausloeser, bedingungen, aktionen}` ab — Beschreibung des Codes, nicht sein Ersatz. Damit ist
das heutige Verhalten unveraenderbar: `istAn()` und `param()` sind unberuehrt, die neun Fundstellen
fragen weiter genau dieselben Funktionen. Belegt wird das mit einem Vorher/Nachher-Schnappschuss
von `GET /api/workflows` (Feld `workflows`).

**D3 — Zweite Ablage `data/own-workflows.json`, nicht `data/workflows.json`.**
Begruendung: `data/workflows.json` speichert per Bauart NUR die Abweichung vom Register — leere
Datei heisst „alles Standard", und spaetere Standard-Aenderungen wandern automatisch mit. Ein
eigener Workflow hat keinen Register-Eintrag, von dem er abweichen koennte; seine Datei IST die
ganze Wahrheit. Zwei verschiedene Bedeutungen in einer Datei wuerden genau die Eigenschaft
zerstoeren, die `workflows.json` heute wertvoll macht. Also: zwei Dateien, eine Ablage je
Bedeutung (`lib/ownworkflowstore.js`).

**D4 — Die Engine laeuft im Browser, und das steht auch da.**
Die Ausloeser sind Ereignisse des Boards im Browser. Ein eigener Workflow laeuft daher, waehrend
das Board offen ist — nicht als Hintergrunddienst. Der Tab sagt das in einem Satz, statt es zu
verschweigen.

**D5 — Nur verdrahtete Ausloeser werden angeboten.**
Solange nichts einen Ausloeser feuert, traegt er im Katalog `nurEingebaut: true` und erscheint im
Builder NICHT — ein Ausloeser, der nie ausloest, waere eine Luege im UI.

Gefeuert wird an fuenf Fundstellen: `public/store.js — neueKarte` („karte-angelegt"),
`public/board.js — schiebe` („karte-spalte-gewechselt"), `public/detail.js — Skript speichern`
(„skript-gespeichert"), `public/detail.js — videoUploadZone` („video-hochgeladen") und
`public/detail.js — Drehtermin zuordnen` („drehtermin-zugeordnet").

**Nachtrag 04.09.2026 — die drei Fundstellen in `detail.js`.** Beim Bau des Pakets lagen sie
brach: an `public/detail.js` arbeitete eine PARALLELE SITZUNG (`git status` zeigte `detail.js`,
`app.js`, `index.html`, `style.css` als fremd geaendert), die Datei wurde deshalb bewusst nicht
angefasst und die drei Ereignisse blieben `nurEingebaut`. Dieselbe Sitzung hat `detail.js`
danach freigegeben und die Freigabe belegt (`git status -s -- public/detail.js` leer, hier
gegengeprueft: `git diff HEAD -- public/detail.js` ebenfalls leer). Die drei `feuere()`-Aufrufe
stehen jetzt drin; im Katalog sind sie `ausfuehrbar: true` mit Fundstelle.

**D6 — Eigene Stilseite statt Anbau an `style.css`.**
Aus demselben Grund: `public/workflowbuilder.css` wird vom Tab beim ersten Oeffnen nachgeladen
(`public/ui.js — stilLaden`). Sie benutzt ausschliesslich die vorhandenen Farb-Variablen, damit
Light und Dark ohne Zutun mitkommen (beides per Screenshot geprueft).

**D5 — Ausfuehrbar vs. beschrieben ist ein sichtbares Merkmal.**
Jede Baustein-Kachel traegt eine Marke: „laeuft" (die Engine fuehrt sie aus) oder „fest
verdrahtet" (steht im Code, hier nur beschrieben). Der Builder bietet ausschliesslich ausfuehrbare
Bausteine an — man kann also gar keinen Workflow bauen, der nur behauptet zu laufen.

## Plan (Phasen)

- **v27-1 — Baustein-Katalog:** `lib/workflowblocks.js` mit Katalog, Bauplaenen der neun,
  `normalisiere()` und `pruefe()`.
- **v27-2 — Ablage + API:** `lib/ownworkflowstore.js` (`data/own-workflows.json`),
  `GET /api/workflows` um `eigene` und `bausteine` erweitert, `PUT`/`DELETE /api/workflows/eigene`.
- **v27-3 — Engine:** `public/workflowengine.js` — `feuere(ereignis, kontext)`, Bedingungspruefung,
  Aktionsausfuehrung. `public/store.js` laedt die eigenen Workflows mit.
- **v27-4 — Ereignisse verdrahten:** `board.js` (`schiebe`), `store.js` (`neueKarte`), `detail.js`
  (Skript gespeichert, Video hochgeladen, Drehtermin zugeordnet) feuern.
- **v27-5 — Builder-Oberflaeche:** Tab 6 in `public/ui.js` neu — eingebaute und eigene Workflows in
  derselben Kachelform, Editor mit Ausloeser-/Bedingungs-/Aktions-Zeilen, Speichern und Loeschen.
- **v27-6 — Verify:** `node --check` fuer jede geaenderte Datei, Rundlauf ueber die API,
  Schnappschuss-Vergleich der neun, optische Abnahme per Screenshot.

## Stand

04.09.2026 — angelegt vor dem Bau (v27-1 bis v27-6 offen).

04.09.2026 — v27-1 bis v27-6 gebaut und geprueft.

| Phase | Ergebnis |
|---|---|
| v27-1 Katalog | `lib/workflowblocks.js`: 2 ausfuehrbare Ausloeser + 4 Bedingungen + 4 Aktionen; 12 nur beschriebene Bausteine; `EINGEBAUTE_BAUPLAENE` fuer alle 9 IDs; `KARTEN_FELDER`, `normalisiere()`, `pruefe()`, `beschreibe()`, `alsBauplan()`. |
| v27-2 Ablage + API | `lib/ownworkflowstore.js` → `data/own-workflows.json`; `GET /api/workflows` liefert zusaetzlich `eigene`; `PUT`/`DELETE /api/workflows/eigene`. Der Baustein-Katalog geht NICHT durch die API — der Browser importiert `/lib/workflowblocks.js` direkt, damit es genau eine Wahrheit gibt. |
| v27-3 Engine | `public/workflowengine.js` — `feuere()`, `pruefeBedingung()`, `fuehreAus()`, Rekursionsbremse (`MAX_TIEFE = 3`, sonst schieben sich zwei Workflows gegenseitig im Kreis); `store.js` haelt `S.eigeneWorkflows` und laedt sie in `ladeWorkflows()` mit, `ladeBoard()` holt sie vor dem Board. |
| v27-4 Ereignisse | `public/store.js — neueKarte` und `public/board.js — schiebe` feuern echte Ereignisse (siehe D5 zu den drei uebrigen). |
| v27-5 Builder | Tab „Workflows": beide Gruppen in derselben Kachelform, Editor mit Ausloeser-/Bedingungs-/Aktionszeilen, Marke „laeuft"/„fest verdrahtet" je Baustein, Befund-Zeilen fuer alles, was zum Laufen fehlt. |
| v27-6 Verify | siehe DoD |

### Bausteine im Katalog (Stand 04.09.2026)

| Art | ausfuehrbar (Builder bietet sie an) | nur beschrieben |
|---|---|---|
| Ausloeser | `karte-angelegt`, `karte-spalte-gewechselt`, `skript-gespeichert`, `video-hochgeladen`, `drehtermin-zugeordnet` | `upload-datum-gesetzt`, `kein-drehtermin-im-fenster`, `drehtermin-geaendert`, `hook-visuell-gewaehlt`, `server-leerlauf` |
| Bedingungen | `karte-in-spalte`, `spaltenwechsel`, `feld-vergleich` (7 Vergleiche), `plattform-gewaehlt` | `qualitaetstore-frei`, `karte-vor-videodreh`, `kein-drive-ordner` |
| Aktionen | `karte-verschieben`, `feld-setzen` (21 Karten-Felder, `column`/`driveName` nur lesbar), `meldung-zeigen`, `drive-ordner-anlegen` | `karte-naechste-phase`, `termine-rueckwaerts-rechnen`, `gcal-spiegeln`, `drive-ordner-mitziehen`, `drehtermin-automatisch-setzen`, `server-beenden` |

## DoD

- [x] Schnappschuss-Vergleich der neun eingebauten Workflows vor/nach dem Umbau:
      `curl -sk https://localhost:4399/api/workflows` → Feld `workflows`,
      `diff wf-vorher.json wf-nachher.json` = **leer**. Die Neun sind zeichengleich geblieben.
- [x] `node --check` gruen fuer alle beruehrten Dateien: `server.js`, `lib/workflowblocks.js`,
      `lib/ownworkflowstore.js`, `lib/workflows.js`, `lib/workflowstore.js`, `public/ui.js`,
      `public/store.js`, `public/board.js`, `public/workflowengine.js`
- [x] Rundlauf der Ablage: `PUT /api/workflows/eigene` → `data/own-workflows.json` enthaelt ihn →
      `GET /api/workflows` liefert ihn unter `eigene` → `DELETE …?id=…` → Datei wieder `[]`
- [x] Rundlauf ueber die OBERFLAECHE: „Neuen Workflow bauen" → Name, Aktion „Ein Feld der Karte
      setzen" (Feld Verantwortlich, Wert Ben) → Speichern → Karte erscheint in der Kette →
      „Bearbeiten" laedt die gespeicherten Werte → „Loeschen" mit Rueckfrage entfernt ihn
- [x] Ein selbstgebauter Workflow LAEUFT nachweislich. Zwei Belege im Browser-Pane:
      (1) `feuere("karte-spalte-gewechselt", {karte, von:"videodreh", nach:"schnitt"})` →
      Workflow lief, `owner` wurde auf „Ben" gesetzt, Toast erschien (Screenshot). Dasselbe
      Ereignis mit `nach:"skript"` lief NICHT — die Bedingung greift.
      (2) Verdrahtung: `store.neueKarte("idee")` → Ausloeser „karte-angelegt" → der ueber die
      Oberflaeche gebaute Workflow setzte `owner` auf „Ben".
      Beide Tests liefen gegen eine Testkarte bzw. mit abgefangenem `PUT /api/board`;
      `diff cards-vorher.json cards-final.json` = leer, das Board blieb unberuehrt.
- [x] Optische Abnahme per Screenshot (Browser-Pane, eigener Server auf Port 4399), Light UND
      Dark; gegen `docs/ui-standard.md`: Befunde als `statusChip`-Zeilen (Punkt 3), Entfernen-
      Knopf als Lucide-Icon statt Unicode (Punkt 5, dabei auch die aus v26 uebernommenen
      ✅/❌-Statuszeichen im Workflow-Tab durch Woerter ersetzt)
- [x] Jede Baustein-Kachel traegt sichtbar „laeuft" oder „fest verdrahtet"

Geprueft gegen: `lib/workflows.js`, `lib/workflowstore.js`, `public/ui.js`, `public/store.js`,
`public/board.js`, `server.js`, `data/workflows.json`,
`docs/packages/v26-system-prompts-und-workflows.md`, `docs/ui-standard.md` (Werkbank);
Befehle: `node --check`, `curl -sk https://localhost:4399/api/workflows`, `diff`;
Screenshots: Tab leer · eigener Workflow in der Kette · Editor · eingebaute Neun · Dark Mode

Offen:
- ~~Die drei Ausloeser mit Fundstelle in `public/detail.js`~~ — **erledigt 04.09.2026**, siehe
  Nachtrag unter D5. Beleg: `feuere()` an `public/detail.js:507,1116,1240`; im Browser gegen
  einen Probe-Workflow gefeuert (Ausloeser `skript-gespeichert`, Aktion „Meldung zeigen") —
  die Meldung erschien, der Probe-Workflow wurde danach wieder geloescht
  (`data/own-workflows.json` = `[]`).
- Server-seitige Ausloeser (z. B. „taeglich um X Uhr"): die Engine laeuft im Browser, ein
  eigener Workflow braucht also ein offenes Board. Der Tab sagt das; ein Hintergrunddienst
  ist Stoff fuer ein eigenes Paket.
- `public/app.js` holt die Workflows beim Start inzwischen ebenfalls (fremde Aenderung) —
  zusammen mit `ladeBoard()` ist das ein doppelter, sehr billiger Aufruf auf eine lokale
  Datei. Beim naechsten Anfassen von `app.js` zusammenlegen.
