# Work package: v32 — Board laeuft fluessig, ohne manuelles Nachhelfen

> PLAN-STAND: Recherche abgeschlossen, Bau noch NICHT begonnen. Owner waehlt aus, was umgesetzt wird.

## Problem (was ist konkret kaputt)

Nach der parallelen v23–v31-Arbeit mehrerer Sessions sind vier Fluessigkeits-Defekte am
Board aufgetreten (Owner 05.09.2026):

1. **Leeres Board beim Start.** Beim Oeffnen zeigt das Dashboard eine leere Seite; erst ein
   Wechsel auf „Auswertung" und zurueck auf „Board" bringt Spalten und Karten.
2. **Kacheln aktualisieren sich nicht von selbst.** Eine neu angelegte Karte (ganz links,
   „Skript schreiben") zeigt ihren Termin/Status erst, nachdem man eine andere Karte oeffnet
   und wieder zurueckgeht — also die Detailspalte einmal erzwungen neu laedt.
3. **Drive-Abgleich fuehlt sich sehr langsam und zu falschen Zeitpunkten an.**
4. **Beenden-Slider funktioniert nicht.** (Owner-Frage: haengt das am Workflow-Builder?)

## Intent (warum)

Das Board soll in wenigen Klicks fluessig laufen — jede Aktion laeuft sichtbar sauber durch,
ohne dass der Nutzer manuell aktualisieren, Ansichten wechseln oder warten muss. Kein Umbau
um des Umbaus willen: die bestehende Architektur (token-freies rclone/Drive, `zeichne()`-
Abo-Modell, Workflow-Builder) bleibt; repariert werden gezielt die Stellen, an denen der
Datenfluss stockt.

## Goal (pruefbarer Zielzustand)

- Start zeigt das gefuellte Board direkt, ohne Ansichtswechsel.
- Neu angelegte/geaenderte Karten aktualisieren ihre Kachel (Termin, Ampel, offene Punkte)
  sofort, ohne Umweg ueber das Oeffnen einer anderen Karte.
- Beenden-Slider loest zuverlaessig aus.
- Drive-Operationen blockieren die UI nicht mehr sichtbar; Scans/Spiegelungen laufen zu
  nachvollziehbaren Zeitpunkten (nicht bei jeder Kleinigkeit erneut, nicht synchron im
  Speicher-Pfad).

## Recherche-Stand (Belege, kein One-Shot)

Geprueft: `public/app.js`, `store.js`, `board.js`, `detail.js`, `drehtermine.js`,
`workflowengine.js`, `index.html`; `server.js` (Board-/Drive-Routen, Start-IIFE, Slider-Route);
`lib/projects.js` (`scan`/`spiegeleKarte`), `lib/drive.js` (rclone-Schicht). Zusaetzlich der
laufende Server auf `https://localhost:4321` live in der Browser-Pane beobachtet
(DOM/Konsole/synthetischer Slider-Drag).

### Befund A — Start + Slider haengen an EINER fragilen Start-Schleife (Symptome 1 & 4)

`public/app.js` verdrahtet den Beenden-Slider **erst am Ende** der Start-IIFE (Zeilen ~233–301),
also **nach** `wechsle(ziel)` (Zeile 220), das das Board zeichnet. Wirft der Startup-Zeichenlauf
(`wechsle` → `zeichne` → `zeichneBoard`, das in Zeile 133 zuerst `boardEl.innerHTML=""` setzt),
bricht die IIFE ab: **Board bleibt leer UND der Slider wird nie verdrahtet.** Die
Ansicht-Knoepfe sind aber schon frueher (Zeile 94) verdrahtet — ein manueller Wechsel zeichnet
neu und repariert das Board, laesst den Slider aber tot. Das erklaert exakt, warum „Umschalten
das leere Board heilt, der Slider aber trotzdem nicht geht".

- Live verifiziert: auf dem **warmen** Server rendert das Board (8 Spalten, 16 Kacheln) und der
  Slider zieht sauber (synthetischer Drag: Handle folgt auf `translateX(30px)`, schnappt unter
  der 0.82-Schwelle zurueck, kein Shutdown). Direkt nach Reload war das Board ~2 s lang leer
  („Bereit.", 0 Spalten), dann gefuellt. Der Fehlzustand ist also **intermittent** (Race), nicht
  deterministisch — auf Kaltstart (rclone kalt, Cert-Erzeugung, `kpi.sammle` beim `listen`)
  wahrscheinlicher.
- `/api/shutdown` (server.js:567) ist simpel und **NICHT** workflow-gated — der Slider haengt
  **nicht** am Workflow-Builder. Antwort auf die Owner-Frage: nein, keine Builder-Komplikation.
- OFFEN (ehrlich): der exakte Ausloeser des Startup-Throws ist noch nicht per Kaltstart
  eingefangen (der laufende Server gehoert evtl. einer Parallel-Session; ich habe ihn NICHT
  neu gestartet). Der Fix haertet den Startpfad unabhaengig vom genauen Ausloeser.

### Befund B — Kachel-Status wird nur „on open" nachgeladen, nicht „on change" (Symptom 2)

Der Kachel-Status haengt an `S.driveStand` (Drive-Scan-Ergebnis pro Karte): `board.js:34`
(`offenePunkte`) liest `S.driveStand.get(k.id)`. Befuellt wird diese Map **nur beim Oeffnen einer
Karte** (`detail.js:191–198`: `driveScan(k).then(zeichne)`), und auch nur, wenn die Karte schon
einen Titel hat. Eine frisch angelegte Karte hat keinen Scan → Kachel bleibt neutral, bis man
sie oeffnet (was den Scan ausloest) und zurueckgeht (was das Board neu zeichnet). Zusaetzlich
schreiben manche Detail-Edits nur `speichere()` ohne `zeichne()` (z. B. `merke(...)` ohne
`neuZeichnen=true`, store.js), sodass Termin/Ampel auf der Kachel erst beim naechsten erzwungenen
Redraw erscheinen. Grundmuster: **das Board zieht Status „bei Bedarf beim Oeffnen" statt „bei
Aenderung zu pushen"**, und die vielen verstreuten manuellen `zeichne()`-Aufrufe lassen Luecken.

### Befund C — Drive ist teuer und liegt im synchronen Speicher-/Oeffnen-Pfad (Symptom 3)

`lib/drive.js` ruft je Operation **rclone als Subprozess** (`spawn`, Zeile 14) → Prozessstart +
Google-Netz-Round-Trip pro Aufruf (~Hunderte ms bis Sekunden). Zwei heisse Pfade:

- **Speichern (`PUT /api/board`, server.js:309–317):** spiegelt **jede geaenderte Karte
  sequentiell nach Drive und antwortet erst danach.** `store.speichere()` wartet auf diese
  Antwort → Speicher-Latenz = N × (mkdir+write) rclone-Round-Trips. Bei mehreren geaenderten
  Karten spuerbar traege.
- **Oeffnen:** `driveScan` (detail.js:193) = ~2–3 rclone-Aufrufe (`ordnerId`/`inhaltRekursiv`,
  ggf. `findeOrdner`), blockiert den Drive-Block der Detailspalte bis der Scan landet. Cache
  (`S.driveStand`, frisch=false) verhindert Wiederholung, aber der ERSTE Scan je Karte ist teuer.
- Kein serverseitiger Scan-Cache/Dedup; die Frontend-Map ist der einzige Puffer und wird bei
  `reconcile`/`neuladen` geleert.

## Plan — Vorschlag Punkt fuer Punkt (Owner waehlt aus)

### Gruppe A — Start + Slider robust (klein, hoher Nutzen, geringes Risiko)

- **A1** Slider-Verdrahtung aus der Start-IIFE loesen und **vor/unabhaengig** vom ersten
  Zeichnen ausfuehren (eigener `try/catch`), sodass ein Zeichenfehler den Slider nie mehr toetet.
- **A2** `beiAenderung`-Zeichen-Callback (app.js:100) defensiv machen: jede Ansicht in eigenem
  `try/catch`, damit eine werfende Ansicht die App nicht vergiftet; ein Fehler wird gemeldet,
  nicht verschluckt.
- **A3** Startpfad so ordnen, dass nach abgeschlossenem Laden **garantiert** ein Redraw des
  gewaehlten Ziels laeuft (kein Verlass auf einen einzelnen fragilen `wechsle`-Aufruf).
- **A4 (Verify-Pflicht):** Kaltstart reproduzieren (eigener Server auf freiem Port, nicht die
  Parallel-Session) und den leeren Zustand + den genauen Throw einfangen, bevor A1–A3 als
  erledigt gelten. Screenshot Board hell nach Kaltstart.

### Gruppe B — Kacheln aktualisieren sich bei Aenderung (mittel)

- **B1** Nach `neueKarte` und nach jeder termin-/status-relevanten Detail-Aenderung einen
  Board-Redraw sicherstellen (fehlende `zeichne()`-Aufrufe in detail.js/store.js schliessen —
  gezielt, nicht pauschal).
- **B2** Kachel-Status robust ohne Drive-Scan rendern: solange kein `driveStand` vorliegt, den
  termin-basierten Status (`faelligkeit`) zeigen und Drive-abhaengige Tore erst ergaenzen, wenn
  der Scan da ist — der Scan aktualisiert die Kachel dann per Push (kleiner, gezielter
  Hintergrund-Scan statt „nur beim Oeffnen").
- **B3 (optional, groesser):** kleiner zentraler Redraw-Anstoss, sodass Status-Aenderungen nicht
  von verstreuten Einzelaufrufen abhaengen. Nur wenn Owner die verstreuten `zeichne()` als
  Wurzel bestaetigt — sonst reicht B1.

### Gruppe C — Drive schneller / zu richtigen Zeitpunkten (mittel–gross, Owner-Entscheidung)

- **C1** Drive-Spiegelung im Speicher-Pfad **nicht mehr blockierend**: `PUT /api/board`
  antwortet sofort nach Cache-Schreiben, die Karten-Spiegelung laeuft danach (Board bleibt
  fuehrend, Fehler heilt der naechste Abgleich — das ist bereits die dokumentierte Absicht,
  nur die Reihenfolge blockiert heute).
- **C2** Drive-Scans buendeln/entzerren: nicht bei jeder Kleinigkeit erneut scannen; einen
  leichten serverseitigen Scan-Cache mit kurzer Lebensdauer erwaegen, damit wiederholte Scans
  nicht jedes Mal rclone spawnen.
- **C3** Klaeren, WANN ein Voll-Abgleich (`reconcile`) laufen soll (heute nur manuell ueber das
  Kopf-Menue) — Owner-Entscheidung ueber sinnvolle Ausloeser/Intervalle.

## Stand

Recherche abgeschlossen (siehe Belege oben). **Owner-Auswahl 05.09.2026: Gruppe A** (Start +
Slider). B und C bleiben offen fuer spaeter.

### Gruppe A umgesetzt + verifiziert (05.09.2026)

Nur `public/app.js` geaendert (kein HTML/CSS/Server):

- **A1** — Beenden-Slider aus der async Start-IIFE herausgeloest in eine Top-Level-Funktion
  `verdrahteShutdownSlider()`, die SYNCHRON beim Modulstart (eigenes try/catch) laeuft, bevor
  die async Start-Schleife beginnt. Damit kann kein Zeichenfehler den Slider mehr toeten.
- **A2** — `beiAenderung`-Zeichen-Callback defensiv: Board/Auswertung, Detailspalte und
  Fokus-Toggle je in eigenem try/catch; ein Fehler wird geloggt statt aus `zeichne()`
  herauszuschlagen (frueher riss er die ganze Start-Schleife mit).
- **A3** — Selbstheilung: nach einem gefangenen Zeichenfehler zeichnet die App begrenzt (max 5)
  kurz danach (200 ms) selbst neu — die haeufigste Ursache ist ein noch nicht fertig geladener
  Zustand, der sich sofort legt. Kein Ansichtswechsel von Hand mehr noetig.

**Verify (live am laufenden Server `https://localhost:4321`, Browser-Pane):**
- `node --check public/app.js` gruen; Server liefert die neue Datei aus (Marker im Fetch).
- Frischer Load: Board zeichnet (8 Spalten, 16 Kacheln), Slider zieht sauber (synthetischer
  Drag translateX(30px) → schnappt unter 0.82-Schwelle zurueck, KEIN Shutdown), keine
  Konsolenfehler. Echter Screenshot Board hell erstellt.
- **Selbstheilung live bewiesen:** `document.createElement('section')` einmalig zum Werfen
  gebracht → Board sofort leer (0 Spalten) → ~200 ms spaeter Retry → Board wieder voll (8
  Spalten), OHNE manuellen Umschalt. Der Slider funktionierte waehrend/nach dem erzwungenen
  Fehler weiter (Drag translateX(25px)) — die Entkopplung greift.
- **Owner-Frage beantwortet:** Der Beenden-Slider haengt NICHT am Workflow-Builder;
  `/api/shutdown` (server.js:567) ist simpel und nicht workflow-gated.

**Offen (ehrlich):** ein echter KALTSTART-Reproduktionsnachweis des urspruenglichen Leerstarts
wurde NICHT gemacht — dazu haette ein zweiter Server neben der laufenden Parallel-Session
gestartet werden muessen, der dieselbe `board.json`/Drive schreibt (`kpi.sammle` beim Start).
Das Risiko eines Schreibkonflikts war es nicht wert. Der Fix beseitigt aber den Mechanismus
(Kopplung Zeichnen↔Slider + fehlende Fehlerisolierung) unabhaengig vom genauen Ausloeser, und
die Selbstheilung ist mit einem erzwungenen Fehler live nachgewiesen.

## DoD

- [x] Owner hat ausgewaehlt: Gruppe A.
- [x] A1–A3 umgesetzt (nur `public/app.js`).
- [x] Beenden-Slider nachweislich funktionsfaehig (frischer Load + nach erzwungenem Zeichenfehler).
- [x] Kein Ansichtswechsel mehr noetig: Selbstheil-Retry fuellt das Board nach einem Fehler selbst.
- [x] Architektur unveraendert (rclone/Drive token-frei, Workflow-Builder unberuehrt).
- [ ] OFFEN: Kaltstart-Reproduktion des Original-Leerstarts (bewusst ausgelassen, s. o.).
- [ ] OFFEN: Gruppe B (Kachel-Auto-Refresh) und C (Drive-Tempo/Timing) — spaeter, Owner-Wahl.
