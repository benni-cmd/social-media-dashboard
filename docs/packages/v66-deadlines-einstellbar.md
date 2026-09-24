# v66 — Deadlines einstellbar (Upload als Basis, Tage bis zur nachfolgenden Deadline)

> Owner-Wunsch 24.09.2026 (Anschluss an v65): „bau ein dass man die Ampel-Schwellen einstellen kann.
> Benutze aber lieber das Wort Deadlines und baue das mit dem Upload-Termin als Basis ganz oben, in
> der Reihenfolge gehen die andern Schritte nach unten und man gibt immer die Zahl fuer die Tage bis
> zur nachfolgenden Deadline ein." Rueckfrage geklaert: volle Kette Upload·Freigabe·Schnitt·Dreh
> (Dreh = Tage vor Schnitt, ersetzt das feste Dreh-Fenster); Rot/Gelb-Grenzen bleiben fest (AMPEL 2/5).

## PIG

**Problem:** Die Deadline-Kette ist hartcodiert. `VORLAUF_TAGE = {schnitt:6, freigabe:3, upload:0}`
(Rueckwaertsplan) und die feste 14-Tage-Breite des Dreh-Fensters (`drehFenster`) lassen sich nirgends
einstellen. Owner will die Abstaende zwischen den Terminen selbst setzen.

**Intent:** Der Owner soll die Produktions-Deadlines an seinen realen Rhythmus anpassen koennen, ohne
Code zu aendern — und zwar in der Denkweise „Upload ist der Fixpunkt, alles andere liegt eine Zahl von
Tagen davor".

**Goal:**
1. Ein „Deadlines"-Panel: Upload als Basis oben; darunter Caption-Freigabe, Schnitt, Drehtag in dieser
   Reihenfolge; je ein Zahlenfeld „Tage bis zur nachfolgenden Deadline" (Freigabe→Upload,
   Schnitt→Freigabe, Dreh→Schnitt).
2. Die Werte speisen `rueckwaertsplan()` (Freigabe/Schnitt) und `drehFenster()` (Dreh-Breite). Standard
   = bisheriges Verhalten (kein Bruch, wenn nichts geaendert wird).
3. Persistenz + Clamping ueber das vorhandene Workflow-Register (`rueckwaertsplan`-Workflow), damit es
   in Drive/Cache liegt wie die uebrigen Stellschrauben.
4. Rot/Gelb-Grenzen NICHT hier (bewusst; `AMPEL` bleibt fest).

## Ist-Analyse (belegt)

- `lib/pipeline.js:162 VORLAUF_TAGE` (const) — nur in pipeline.js benutzt (Grep: keine Fremd-Importe).
  `rueckwaertsplan()` (171) und `drehFenster()` (185) lesen daraus. `drehFenster` = `[schnitt−14, schnitt]`.
- `public/store.js:81 terminplan()` gated am Workflow `rueckwaertsplan`; `detail.js` ruft `einfacherPlan`
  (= rueckwaertsplan) beim Upload-Setzen; `board.js`/`store.js`/`detail.js` rufen `drehImFenster`.
- **Server nutzt KEINE** dieser Funktionen (Grep server.js: 0 Treffer) → ein modul-lokaler,
  per Setter aktualisierter Offset-Zustand in pipeline.js ist sicher und erspart das Durchreichen
  durch ~9 Aufrufstellen.
- `lib/workflows.js` — Register mit `params:[{key,label,typ:"zahl",standard,min,max,einheit,hinweis}]`;
  `lib/workflowstore.js setze()` merged Params (behaelt `an` + andere Params, clampt). `store.js
  setzeWorkflow()` + `uebernimm()` laden/spiegeln nach `S.workflows`; `stellschraube(id,key)` liest.

## Regeln (Zielzustand)

- Kette (Tage bis zur naechsten Deadline): `freigabe` (Standard 3), `schnitt` (3), `dreh` (14).
- Ableitung: Freigabe = Upload − freigabe · Schnitt = Freigabe − schnitt (= Upload − (freigabe+schnitt))
  · Dreh-Fenster = [Schnitt − dreh, Schnitt]. Defaults ergeben exakt das alte Verhalten.
- Editierte Werte wirken sofort auf `drehFenster`/`drehImFenster` (live gerechnet) und auf NEU gesetzte
  Upload-Termine (der Rueckwaertsplan schreibt Karten-`dates` nur beim Upload-Setzen — bestehende
  Karten behalten ihre eingefrorenen Termine, bis der Upload neu gesetzt wird).

## Plan

1. `lib/pipeline.js`: `DEADLINE_STANDARD` + modul-lokale `deadlineKette` + `setDeadlineKette()` +
   `deadlineKetteJetzt()`; `VORLAUF_TAGE`-const durch abgeleitete `vorlaufTage()` ersetzen;
   `rueckwaertsplan`/`drehFenster` darauf umstellen.
2. `lib/workflows.js`: 3 Zahl-Params am `rueckwaertsplan`-Workflow (gapFreigabe/gapSchnitt/gapDreh).
3. `public/store.js`: `setDeadlineKette` importieren; in `uebernimm()` nach dem Laden `syncDeadlineKette()`
   (aus den `rueckwaertsplan`-Params) rufen — greift bei ladeWorkflows UND setzeWorkflow.
4. `public/redaktionsplan.js`: Sektion „Deadlines" oben in den Einstellungen (Upload-Basis + 3 Zeilen +
   „Deadlines speichern" → `setzeWorkflow("rueckwaertsplan",{params})`, dann `zeichne()` + Vorschau).

## Verify (Beleg, 24.09.2026)

- `node --check` fuer alle vier Dateien → OK.
- **Node-Probe gegen echtes `lib/pipeline.js`** (Upload 2026-11-01):
  - Defaults 3/3/14 → `rueckwaertsplan` {upload:11-01, freigabe:10-29, schnitt:10-26},
    `drehFenster` [10-12, 10-26] → **DEFAULT-CHECK PASS** (identisch zum alten VORLAUF/Dreh-Fenster).
  - Kette 5/4/10 → freigabe 10-27, schnitt 10-23, drehFenster [10-13, 10-23] → **CHANGED-CHECK PASS**.
  - Robust: `null`/`""`/ungueltig → Standard (3/3/14); `0` bleibt gueltig (0/7/20).
- **Live/DOM (Server :4321 mit v66-Code, echter Browser):**
  - `/api/workflows` liefert die 3 neuen Params am `rueckwaertsplan`-Workflow (Server-Register kennt sie).
  - `store.ladeWorkflows()` → `stellschraube` == Server-Werte, `pipe.deadlineKetteJetzt()` folgt
    (Sync `uebernimm→setDeadlineKette` bewiesen); `rueckwaertsplan`/`drehFenster` rechnen mit den Werten.
  - **Panel gerendert** (Screenshot): Sektion „Deadlines" ganz oben in den Redaktionsplan-Einstellungen —
    Zeile 1 „Upload · Veroeffentlichung … Basis", darunter „Caption-Freigabe [3] Tage bis Upload",
    „Schnitt fertig [3] Tage bis Freigabe", „Drehtag [14] Tage bis Schnitt", Knopf „Deadlines speichern".
  - **Voll-Kette ueber die UI:** Felder auf 7/2/9 gesetzt, echten Panel-Button geklickt →
    `data/workflows.json` = {gapFreigabe:7,gapSchnitt:2,gapDreh:9}, `stellschraube`/`pipeline` = 7/2/9,
    `drehFenster("2026-11-01")` = [10-14, 10-23]. Danach sauber auf 3/3/14 zurueckgesetzt (PUT 200).

## Stand

- [x] Ist-Analyse belegt (VORLAUF nur intern, Server nutzt Termin-Funktionen nicht, setze() merged)
- [x] pipeline.js: konfigurierbare Kette (Setter + abgeleitete Offsets), Defaults = altes Verhalten
- [x] workflows.js: 3 Zahl-Params am rueckwaertsplan-Workflow
- [x] store.js: syncDeadlineKette() in uebernimm()
- [x] redaktionsplan.js: Deadlines-Panel (Upload-Basis oben, 3 Zeilen „Tage bis nachfolgende Deadline")
- [x] Verify (node --check, Node-Probe, Live/DOM inkl. UI-Save-Roundtrip + Screenshot)
- [ ] Commit + Push

## DoD

Geprueft gegen: `node --check` (4 Dateien) · Node-Probe gegen `lib/pipeline.js` (Defaults == altes
Verhalten; geaenderte Kette verschiebt Termine/Fenster; Robustheit) · Live/DOM: Panel-Render +
UI-Save-Roundtrip (7/2/9 in `data/workflows.json`, `stellschraube`/`pipeline`/`drehFenster` folgen),
danach auf Standard zurueckgesetzt.
Offen: nichts im Auftrag. Bewusst ausserhalb: Rot/Gelb-Grenzen bleiben fest (Owner-Entscheid); bestehende
Karten behalten ihre eingefrorenen `dates` bis zum Neusetzen des Upload-Termins (das Dreh-Fenster folgt
sofort, da live gerechnet).
