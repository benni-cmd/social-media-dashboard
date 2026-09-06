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

### Gruppe D — Live-Denk-Konsole im „Idee von der KI"-Popup (klein, hoher Nutzen)

Owner 05.09.2026: Beim „Idee von der KI"-Popup steht nur „Die KI recherchiert eine Idee …" —
es fuehlt sich an, als passiere nichts. Gewuenscht: die drehende Sanduhr UND darunter ein
konsolenartiges Fenster (im Dashboard-Stil), das den ECHTEN Live-Denkprozess der KI zeigt
(was geschrieben wird, in welcher Geschwindigkeit).

**Befund:** Das Streaming-Panel existiert bereits (`ui.js` `denkPanel` — Sanduhr-Kopf +
`<pre class="denk-text">`, streamt Deltas, scrollt mit) und wird beim Redaktionsplan
(`nachschub.js` `holePlan`) genutzt. Das Ideen-Popup (`nachschub.js` `naechste()`) ruft aber
`kiStream(..., () => {})` mit **leerem** Ereignis-Callback — die Live-Deltas werden weggeworfen,
darum der statische Text. Keine neue Streaming-Infrastruktur noetig.

- **D1** In `naechste()` den statischen Ladetext + leeren Callback durch ein `denkPanel` im
  Modal ersetzen und `kiStream`s `onEreignis` auf `panel.delta`/`panel.status` verdrahten.
- **D2** `.denk-text` konsolen-tauglich machen (Monospace, im Dashboard-Stil) — wirkt auch auf
  das schon vorhandene Plan-Panel konsistent.

### Gruppe E — Sanduhr ueberall als „hier passiert gerade was"-Indikator (querschnitt)

Owner 05.09.2026: An JEDER Stelle, wo die KI arbeitet, etwas laedt, ein Drive-Abgleich laeuft
oder Daten noch fehlen/nicht da sind, soll die drehende Sanduhr stehen — damit klar ist „da
kommt noch was, einen Moment warten". Nie einfach nichts oder ein toter statischer Text.

**Ansatz:** EINE wiederverwendbare Sanduhr-Primitive (spinnendes Sanduhr-Icon + optionaler
Text, respektiert `prefers-reduced-motion`) in `ui.js`, konsistent an allen Wartepunkten
eingesetzt. Das Sanduhr-Icon + die Dreh-Animation existieren schon (`knopf-symbol-sanduhr`,
`@keyframes sanduhr-dreht`, v29 R7); E buendelt sie in einen einzigen Helfer statt Einzelloesungen.

Wartepunkte (Bestand zu pruefen, dann bestuecken):
- **E1** Board-Start/Laden: solange `/api/board` laedt, Sanduhr statt leeres Board (verzahnt mit A).
- **E2** Kachel mit ausstehendem Drive-Scan: kleine Sanduhr am Status-Punkt, bis der Scan da
  ist — dann echter Status (verzahnt mit B).
- **E3** Detailspalte Drive-Block: Sanduhr, solange `driveScan` laeuft (heute leer/statisch).
- **E4** Kopfzeile „Aktualisieren"/„Mit Drive abgleichen": Sanduhr waehrend des Laufs.
- **E5** KI-Panels (Ideen-Popup D, Redaktionsplan): Sanduhr im `denkPanel` — bereits vorhanden,
  nur konsistent halten.

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

### Gruppe D + E umgesetzt + verifiziert (05.09.2026) — Owner-Auswahl B+C+D+E

- **D** — `nachschub.js` `naechste()`: statischer Ladetext + leerer kiStream-Callback ersetzt
  durch `denkPanel` (Sanduhr-Kopf + Live-Textstrom). `.denk-text` auf Monospace (Konsolen-Look).
- **E0** — `ui.js` `sanduhr(text, {klein})`: eine wiederverwendbare Sanduhr-Primitive (dreht,
  respektiert prefers-reduced-motion), plus CSS `.lade-sanduhr` und `.eintrag-punkt-lade`.
- **E1** — `app.js`: Board zeigt beim Laden die Sanduhr statt leeres Board.
- **E2 + B** — `store.js` `driveScan`: laufende Scans dedupliziert (Map `scanInFlight`), Kachel
  traegt waehrend des Scans die Sanduhr (`board.js` `.eintrag-punkt-lade`), und bei Abschluss
  zeichnet das Board VON SELBST neu — die Kachel aktualisiert sich ohne Karte-oeffnen-und-zurueck.
- **E3** — `detail.js` `blockDrive`: „Drive wird gelesen …" jetzt mit Sanduhr.
- **E4** — `app.js`: Kopf-Stand zeigt Sanduhr bei „Aktualisieren"/„Mit Drive abgleichen".
- **E5** — `denkPanel` (Ideen-Popup + Redaktionsplan) traegt die Sanduhr konsistent.

**Verify (live, eigener Server — Parallel-Session hatte ihren beendet):** E1 (Board-Lade-Sanduhr,
`sanduhr-dreht 1.8s`), E3, E4 je mit sichtbarer drehender Sanduhr. D: `denkPanel` streamt Text in
Monospace + Sanduhr (mit simulierten Deltas belegt; echter Ollama-Stream nicht pruefbar — Modell
in dieser Umgebung nicht geladen, Fehlerpfad greift korrekt). E2+B: Karte geoeffnet → Kachel zeigt
Sanduhr waehrend des Scans → nach Scan-Abschluss automatisch echter Status-Punkt (Selbst-Update
ohne Klick-und-zurueck), kein Redraw-Loop (Scan-Dedup verifiziert). Nur eigene Dateien; `ui.js`
hunk-genau gestaged, fremde v33-Arbeit (Unternehmenskontext) unberuehrt.

**Offen (ehrlich):** Der urspruengliche „neue Karte, Termin laedt erst nach Klick-und-zurueck"
wurde nicht 1:1 reproduziert (haette das Anlegen+Ausfuellen einer echten Karte auf Live-Daten
verlangt). Der Selbst-Update-Mechanismus (driveScan zeichnet bei Abschluss neu) + die bestehenden
Termin-Redraws decken aber die Klasse „Kachel haengt hinterher, bis ein Redraw erzwungen wird".

### Gruppe C1 umgesetzt + verifiziert (05.09.2026)

- **C1** — `server.js` `PUT /api/board`: antwortet jetzt SOFORT nach dem board.json-Schreiben;
  die Drive-Spiegelung der geaenderten Karten (je ein rclone-Aufruf) laeuft DANACH im
  Hintergrund statt die Antwort zu blockieren. Frueher wartete jeder Save auf N sequentielle
  rclone-Schreibvorgaenge. `driveWarnungen` aus der Antwort entfernt (Frontend hat es nie
  ausgewertet — per grep geprueft); Fehler werden geloggt, der naechste Abgleich heilt.

**Verify (live, eigener Server 4321 neu gestartet):** `node --check server.js` gruen; GET+PUT-
Roundtrip **8 ms**, Status 200, Version 229→230, keine `driveWarnungen` mehr im Body. Die
Nicht-Blockierung ist strukturell garantiert (sendJson steht VOR der Spiegel-Schleife).

**Offen:** C2 (serverseitiger Scan-Cache / Scans entzerren) und C3 (WANN ein Voll-Abgleich
laufen soll — Owner-Entscheidung ueber Ausloeser/Intervalle) — beide bewusst NICHT gebaut:
spekulativer, `server.js` ist von der Parallel-Session (v33) umkaempft, und C2 traegt
Staleness-Risiken. Als eigenstaendige Schritte vormerken.

### Gruppe E erweitert: Auswertung + alle Fortschritt-Stellen (05.09.2026, Owner „wirklich ueberall")

- **Auswertung** (`auswertung.js`): beim Holen der IG-/LI-Zahlen jetzt die drehende Sanduhr statt
  eines blossen Fortschrittsbalkens.
- **Gemeinsame `fortschritt`-Komponente** (`ui.js`): traegt jetzt die Sanduhr vor dem Text —
  damit tragen ALLE Fortschritt-Stellen sie automatisch: Drive-Abgleich (Kopf), Datei-Upload,
  Projektordner-anlegen, „Speichere nach Drive". Ein Griff, alle Stellen.

**Verify (live, Server 4323):** Wechsel auf Auswertung → Sanduhr „Hole die Zahlen von
Instagram …" sichtbar, danach weg. `fortschritt`-Komponente per Import gerendert → Sanduhr
(`sanduhr-dreht 1.8s`) + Text + Balken, Screenshot erstellt.

**Bewusst NICHT bestueckt:** die „Lade …"/„Speichere …"-Texte im Einstellungsfenster
(prompts/workflows/kontext-Listen) — liegen im von v33 umkaempften `einstellungenModal`; klein
und sekundaer. Ebenso die haeufigen kurzen `setStand("Speichere …")` (wuerden bei jedem Save
flackern). Bei Bedarf spaeter.

### Gruppe C2 umgesetzt + verifiziert (05.09.2026)

- **C2** — Serverseitiger Scan-Cache in `lib/projects.js` (uncontested, damit `server.js` — von
  der Parallel-Session/v34 gerade umkaempft — nur EINE Zeile braucht): `scan(card, frisch)` cacht
  erfolgreiche Scans je Karte 60 s lang. Jede Karten-veraendernde Operation verwirft ihren
  Eintrag sofort (`anlegen`/`verschiebe`/`speichereDatei`), der Voll-Abgleich leert alles
  (`abgleich`). `server.js` reicht `?frisch=1` durch, `store.js` (`driveScan`) setzt es bei
  bewussten Refreshes (nach Anlegen/Verschieben/Upload) — so bleibt eine erzwungene Messung frisch.

**Verify (live, Server 4324):** derselbe Scan zweimal — erster (rclone kalt) **21057 ms**,
zweiter (Cache) **2 ms**. `frisch=1` umgeht den Cache (**2376 ms** echter Scan), danach wieder
**2 ms** (Cache vom frischen Scan neu gefuellt). Invalidierung bei Mutationen code-seitig
(scanCacheWeg/scanCacheLeeren an den vier Stellen).

### Gruppe C3 umgesetzt + verifiziert (06.09.2026, Owner-Entscheidung)

Owner-Wahl: Abgleich beim Start + alle 30 Min (nicht 10), Flush beim Beenden (kein voller
Abgleich), Button bleibt.

- **Start + Intervall** (`app.js`, `store.js`): nach dem Board-Laden ein Voll-Abgleich im
  HINTERGRUND (nicht blockierend — der Start haengt/leert nie), danach alle 30 Min, aber nur
  wenn das Fenster im Vordergrund ist. `driveAbgleich` teilt einen laufenden Abgleich
  (`abgleichLaeuft`/In-Flight-Promise), sodass Start/Intervall/Button sich nicht ueberlagern.
- **Flush beim Beenden** statt vollem Abgleich (der waere im 400ms-Fenster bis `process.exit`
  ohnehin abgeschnitten): (a) Client (`app.js`-Slider) schreibt den lokalen Stand erst durch
  (`await speichere()`), dann `/api/shutdown`; (b) Server (`server.js`) merkt sich die offenen
  Hintergrund-Spiegelungen (seit C1) und bringt sie beim Beenden zu Ende (mit 8s-Zeitgrenze,
  damit ein haengender rclone nicht ewig blockiert).

**Warum Flush reicht (Owner-Frage „Unterschied Flush vs. Abgleich; gehen Skripte verloren?"):**
Flush = nur die letzten LOKALEN Aenderungen nach Drive schreiben (Board→Drive, billig). Voller
Abgleich = ganze Drive-Struktur lesen und das Board daran heilen (Drive→Board, teuer). Verloren
geht nichts: Skripte werden schon beim Speichern DIREKT nach Drive geschrieben (`/api/drive/save`
wartet auf den Schreibvorgang), board.json ist lokal die persistierte Wahrheit, und der Abgleich
hat einen Schnellpfad (`projects.js:297`) — Karten in ihrer Phase werden uebersprungen, „Drive
gewinnt" nur bei einer Hand-Verschiebung/-Umbenennung in Drive.

**Verify (live, Server 4325):** Start feuert `POST /api/drive/reconcile` (genau einer — Dedup
greift). Board laedt (8 Spalten, 17 Karten), Slider mechanisch intakt. Slider ueber Schwelle:
`PUT /api/board` (Flush) kommt VOR `/api/shutdown` (Reihenfolge belegt), Server beendet sauber
(exit 0, Log „Shutdown via UI ausgeloest."). Flush-WARTE-Zweig (offene Spiegelung beim Beenden)
nur code-verifiziert — mangels Karten-Mutation im Test nicht zur Laufzeit ausgeloest.

## DoD

- [x] Owner hat ausgewaehlt: Gruppe A.
- [x] A1–A3 umgesetzt (nur `public/app.js`).
- [x] Beenden-Slider nachweislich funktionsfaehig (frischer Load + nach erzwungenem Zeichenfehler).
- [x] Kein Ansichtswechsel mehr noetig: Selbstheil-Retry fuellt das Board nach einem Fehler selbst.
- [x] Architektur unveraendert (rclone/Drive token-frei, Workflow-Builder unberuehrt).
- [ ] OFFEN: Kaltstart-Reproduktion des Original-Leerstarts (bewusst ausgelassen, s. o.).
- [ ] OFFEN: Gruppe B (Kachel-Auto-Refresh) und C (Drive-Tempo/Timing) — spaeter, Owner-Wahl.
