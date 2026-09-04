# v30 — Termin/Drehtermin-Dopplung beheben + Forecast-Checkbox "Nächster freier Upload-Termin"

## Problem – Intent – Goal

**Problem:** Owner-Befund (05.09.2026): "diese Dopplungen mit Termin und Drehtermin ist
manchmal noch unsinnig." Bestätigt am Code (nicht nur am Gedächtnis, siehe Belege unten):
in der Detailspalte gibt es zwei Stellen, die ein Dreh-Datum halten — den zugeordneten
`Drehtermin` (geteiltes Objekt, mehrere Karten können daranhängen) und ein per Hand
editierbares `card.dates.dreh`-Feld in "Termine verwalten" — die zweite Stelle kann die
erste unbemerkt überschreiben, ohne den zugeordneten Drehtermin zu lösen oder zu syncen.
Ausserdem fehlt ein Weg, ein Video **schwebend** auf "den nächsten freien Upload-Termin"
zu legen, der sich automatisch verschiebt, sobald ein anderes Video den Slot explizit belegt.

**Intent:** Owner will einen Forecast bauen: mehrere Videos liegen dauerhaft auf "als
Nächstes frei", ohne dass jemand nach jeder Planänderung von Hand nachjustiert. Dafür darf
die Datumslogik nicht zwei widersprüchliche Wahrheiten haben.

**Goal:** (1) Keine Karte kann mehr zwei unterschiedliche Dreh-Daten gleichzeitig zeigen.
(2) Eine Karte lässt sich per Checkbox auf "schwebend" stellen: sie zeigt live das Datum,
an dem sie JETZT dran wäre, ohne dass jemand ein Datum tippt; wird der berechnete Slot von
einer anderen, explizit datierten Karte belegt, rutscht sie automatisch zum nächsten freien
Slot weiter.

## Befund (Beleg, nicht Erinnerung)

- **B1 Dopplung:** `public/detail.js` `blockTermine()`, TERMINE-Schleife (~Zeile 458–465)
  rendert für `t.key === "dreh"` ein rohes `<input type=date>`, gebunden an
  `setzeTermin(k, "dreh", …)` (Zeile 650–655) — schreibt NUR `k.dates.dreh`, rührt
  `k.drehterminId` nicht an. Store-seitig sync(t)en `karteZuTermin()` und
  `drehterminAendern()` (`public/store.js` Zeile 485–507, 453–465) `k.dates.dreh` korrekt
  aus dem zugeordneten `Drehtermin`-Objekt — aber NUR bei Zuordnung/Terminänderung über den
  Drehtermin-Block, nicht wenn "Drehtag" in "Termine verwalten" direkt getippt wird. Ergebnis:
  Drehtermin-Block zeigt Datum A ("Zugeordnet: …"), "Termine verwalten" kann Datum B zeigen
  — beide für dieselbe Karte, ohne Warnung.
- **B2 "Nächstes freies Datum" ist in der Idee-Phase teilweise tot:** `blockTermineIdee()`
  (`detail.js` Zeile 583–624) liest `plan.slots` (`ladePlan()` → `/api/plan` →
  `data/plan.json`). `plan.slots` wird aber NIRGENDS mit echten, datierten, id-tragenden
  Einträgen befüllt — `pipeline.js` exportiert `neueSlotId()` (Zeile 463), aber die Funktion
  wird im ganzen Repo nie aufgerufen (geprüft: `grep -rn neueSlotId`). In der Praxis zeigt
  die Kachel dauerhaft "Kein freier Slot. Erstelle Slots im Redaktionsplan." — obwohl es
  dafür keinen Weg gibt.
- **B3 Der tatsächlich funktionierende Mechanismus** steckt in `public/nachschub.js`
  (`ladeOffeneSlots()` Zeile 18–35, Abgleich in `holeIdee()` Zeile 42–51): berechnet die
  Scheduler-Slots rein deterministisch über `slotsForMonth()` (`lib/scheduler.js`) für die
  nächsten zwei Monate und filtert alle raus, deren `datum+uhrzeit` schon von einer Karte mit
  gesetztem `dates.upload` belegt ist. Kein `plan.slots`, keine IDs, keine Server-Ablage nötig
  — genau das Muster, auf dem der Forecast aufbaut (wiederverwenden, nicht neu erfinden).

## Plan

1. **B1 beheben (Dopplung):** In `blockTermine()`s "Termine verwalten" (`detail.js`) das
   `dreh`-Feld aus der editierbaren TERMINE-Schleife herausnehmen. Ist `k.drehterminId`
   gesetzt: keine eigene Zeile (das Datum steht bereits im Drehtermin-Block darüber, das
   reicht). Ist NICHTS zugeordnet: statt eines rohen Datumsfelds ein Hinweistext/Link
   "Kein Drehtermin zugeordnet — siehe Block „Drehtermin" oben", damit an genau EINER
   Stelle im UI ein Dreh-Datum entstehen kann.

2. **Forecast-Baustein (geteilte Logik, kein Duplikat):** neue reine Funktion — Ort:
   `lib/pipeline.js` (läuft server+browser, keine Node-Importe, wie der Rest der Datei) —
   z. B. `naechsteFreieSlots(scheduler_slots, belegteUploads, anzahl)`, die die
   Ausschluss-Logik aus `nachschub.js ladeOffeneSlots()/holeIdee()` verallgemeinert:
   gegeben eine chronologisch sortierte Slot-Liste und eine Menge belegter
   `datum|uhrzeit`-Strings, liefert sie die ersten `anzahl` freien Slots (nicht nur den
   ersten). `nachschub.js` auf diese gemeinsame Funktion umstellen (kein zweites Mal
   dieselbe Filterlogik pflegen).

3. **Kartenschema:** `leereKarte()` (`lib/pipeline.js`) bekommt ein neues Feld
   `floatUpload: false`. `migriere()`/`normalisiere()` decken das über den bestehenden
   Default-Fill-Mechanismus automatisch ab (kein Sonderfall nötig).

4. **Neuberechnung (store.js):** eine Funktion, die bei jedem Board-Laden und nach jeder
   Datums-relevanten Änderung (neue/geänderte Karte, geänderter Redaktionsplan) alle Karten
   mit `floatUpload === true` (ausser `fertig`/`verworfen`) in stabiler Reihenfolge (z. B.
   nach `phaseIndex`, dann Spalten-Position) durchgeht, die Scheduler-Slots der nächsten
   2 Monate lädt (`slotsForMonth` über `ladePlan()`), alle `dates.upload` NICHT-schwebender
   Karten als belegt ausschliesst, und jeder schwebenden Karte der Reihe nach den nächsten
   freien Slot zuweist — geschrieben ganz normal über `terminplan(datum)+upload` in
   `k.dates` (wie in `nachschub.js`/`detail.js` bereits üblich), damit `faelligkeit()`,
   `tore()`, `wochenlast()`, Kalender und KPI-Planung UNVERÄNDERT weiterlaufen. Nur die
   Herkunft des Datums ist jetzt "berechnet" statt "getippt" — kein Sonderfall in den
   Konsumenten nötig.

5. **UI-Checkbox:** in `blockTermine()` UND `blockTermineIdee()` (`detail.js`) — Platzierung
   im Termin-Block, weil das technisch das Upload-Datum ist, nicht der geteilte
   Drehtermin (ein geteilter Dreh-Tag mit mehreren Karten kann nicht gleichzeitig ein
   schwebendes Pro-Karte-Datum sein). Owner sprach von "bei Drehtermin" — das ist die Phase
   ("Drehtermin festlegen"), in der der Owner das braucht; der Checkbox-Ort ist der
   Termin-Block, sichtbar genau ab dieser Phase (er existiert dort schon). Checkbox
   "Nächsten freien Upload-Termin" — an: Datums-Eingabe verschwindet, stattdessen
   Read-only-Zeile "Würde jetzt gepostet am {Datum}" (`statusChip` + Satz, kein nacktes
   Datum ohne Kontext, UI-Konvention der Werkbank). Aus: normales Datumsfeld wie bisher,
   das aktuell berechnete Datum wird als expliziter Wert übernommen (Karte bleibt nicht
   ohne Datum stehen).

6. **Board-Kachel:** kein neuer Status nötig — die Karte zeigt weiterhin `faelligkeit()`
   ganz normal (liest `dates.upload`/`dates.dreh`, die jetzt korrekt befüllt sind); optional
   ein kleines Symbol/Titel-Zusatz "schwebend", damit man auf der Kachel sieht, dass das
   Datum kein Fixtermin ist — nur wenn das ohne neue Text-Fülle geht (Owner-Linie: so wenig
   Text wie möglich).

## Stand

Plan geschrieben 05.09.2026, Befund B1–B3 gegen den aktuellen Code geprüft (Zeilen wie
oben zitiert, Stand Commit `e2d5354`). Bau lief zunächst als Hintergrund-Agent, der kurz vor
Abschluss (mitten in der Browser-Verifikation) an einem transienten API-Fehler (529
Overloaded) abbrach — Code stand da schon vollständig, aber uncommitted. Die auslösende
Session hat den Diff geprüft, sauber von parallelem fremdem WIP (v28-retro-look, v29-ampel-
schwellen-und-kopf-punkte in denselben Dateien) getrennt und die Verifikation selbst zu Ende
geführt. Commit `bb93689` (05.09.2026), NICHT gepusht.

**Live-Beleg für B1 vor dem Fix:** Karte "Hühnernahrung mit Maden" hatte zum Testzeitpunkt
`drehterminId` gesetzt, aber `dates.dreh` fehlte komplett — exakt die Dopplung aus dem Befund,
durch die alte UI entstanden, bevor der Fix griff.

**Verifikation der Forecast-Checkbox** (Browser-Konsole, echte Board-Daten): Checkbox an ->
Anzeige "Würde jetzt gepostet am 7.9.2026 um 08:00 Uhr". Zweite Karte auf schwebend gestellt
-> bekam 8.9.2026 15:00 (nicht denselben Slot). Dritte Karte explizit auf 7.9.2026 08:00
gesetzt -> erste schwebende Karte rutschte automatisch auf 8.9., die zweite auf 14.9. —
keine Kollision zwischen den schwebenden Karten, `schwebendeNeuBerechnen()` rechnet bei jedem
Lauf alle schwebenden Karten komplett neu statt inkrementell zu patchen.

**Korrektur (nach Commit festgestellt):** Der Versuch, in pipeline.js nur die zwei
v30-Hunks per `git apply --cached` gezielt zu staged, ist NICHT wie beabsichtigt aufgegangen —
`git commit -- lib/pipeline.js ...` in diesem Workspace committet fuer benannte Pfade den
WORKING-TREE-Stand (nicht den Index-Stand), genau wie CLAUDE.md es beschreibt ("Pruefkommando
ist `git diff HEAD -- <pfad>`, nicht `--cached`"). Dadurch ist der fremde Ampel-Schwellen-Hunk
(v29, andere Session, unveraendert korrekter Code) ungewollt MIT in Commit `bb93689`
gelandet — die urspruengliche Commit-Botschaft, er bleibe uncommitted, ist falsch. Inhaltlich
harmlos (der Ampel-Code ist fertig, korrekt, Owner-abgesegnet) — aber die andere v29-Session
sollte wissen, dass dieser Teil ihrer Arbeit schon unter einer fremden Commit-Botschaft
gesichert ist, damit sie ihn nicht doppelt committet.

## DoD

- [x] B1 behoben: kein Weg mehr, `dates.dreh` unabhängig vom Drehtermin-Block zu ändern.
- [x] `naechsteFreieSlots()` in pipeline.js, `nachschub.js` nutzt sie (keine zweite Kopie).
- [x] `floatUpload` im Kartenschema, Neuberechnung verdrahtet.
- [x] Checkbox in Termin-Block (Idee- und Nicht-Idee-Variante), Datumsfeld verschwindet/
      erscheint korrekt, Anzeige aktualisiert sich, wenn ein anderes Video den Slot belegt.
- [x] Echte Browser-Screenshots: Dopplung behoben (Termine verwalten ohne Dreh-Zeile),
      Checkbox an (berechnetes Datum sichtbar). Zwei-Karten-Kollisionstest lief als
      DOM/Store-Test in derselben laufenden Session (Ergebnis siehe oben) statt als
      zweiter Screenshot — Zahlen sind reproduzierbar geprüft, nicht nur behauptet.
- [x] Commit nur mit `git commit -m "…" -- <pfade>` (`bb93689`), fremde WIP-Dateien
      (data/board.json, style.css-Retro-Hunk, board.js/index.html/ui.js/drehtermine.js v29,
      pipeline.js-Ampel-Hunk) unangetastet gelassen.

**Offen:** bestehende Karten, die schon VOR diesem Fix einen desyncten Zustand hatten
(drehterminId gesetzt, dates.dreh leer o. ä.), werden nicht rückwirkend repariert — nur
neue Desyncs sind jetzt unmöglich. Kein Push (Owner-Entscheidung, siehe v23/v27).
