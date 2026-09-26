# v70 — Deadline-Modell: aktionsbasiert, upload-verankert, eine Quelle

> Architektur-Refactor. Ersetzt das spalten-/phasenbasierte Deadline-Modell (v66) durch ein
> aktionsbasiertes, das immer auf das geplante Uploaddatum referenziert. Owner-Entscheid 24.09.2026
> (zwei AskUserQuestion-Runden, wortgleich zu beiden Fragen).

## PIG

**Problem:** Deadlines existieren uneinheitlich/doppelt. v66 machte Phasen-Deadlines im **Redaktionsplan**
editierbar — spalten-/phasenabhaengig. Die Ampel liest `card.dates[phase.termin]` je Phase. `6e5d1dc`
machte zusaetzlich rot/gelb-Ampel-Schwellen editierbar. Owner will **weder** doppelte Deadlines **noch**
editierbare Farben.

**Intent (Owner 24.09.2026, wortgleich):** „Keine doppelten Deadlines. Lieber aus Redaktionsplan
entfernen und mit den echten Deadlines in den Einstellungen arbeiten, die nicht Spalten-, sondern
Aktions-abhaengig sind und immer auf das geplante Uploaddatum als zentrale Deadline referenzieren. Wie
viel Zeit die Deadline-Schritte davor haben, will ich in den Einstellungen veraendern koennen." Plus:
Farben/Ampel-Trigger NICHT editierbar.

**Goal (Zielzustand, pruefbar):**
1. **Eine zentrale Deadline je Karte = geplantes Uploaddatum.** Alle abgeleiteten Deadlines = Uploaddatum − Offset.
2. **Deadline-Schritte sind Aktionen** (nicht Board-Spalten), jede mit einem Offset „N Tage vor Upload".
3. **Offsets global editierbar an EINER Stelle** (Einstellungen, Drive-gestuetzt v60-Muster). Keine
   Deadline-Bearbeitung mehr im Redaktionsplan (v66-UI dort entfernt).
4. **Ampel** faerbt nach der dringlichsten abgeleiteten Aktions-Deadline; **rot ≤2 / gelb 3–5 bleiben fest**
   (nicht editierbar). `6e5d1dc` wird nicht im UI gezeigt (Defaults bleiben) oder zurueckgerollt — Owner-Entscheid.

## PRUEFE ZUERST (kein One-Shot)
- Bestand: wie berechnet `lib/pipeline.js` heute Deadlines (`faelligkeit()`, `phase.termin`, `card.dates`)?
  Wo sitzt die v66-Deadline-UI im `redaktionsplan.js`, welche Store/Workflow-Felder haengen dran (`17e8f27`)?
- Was macht `6e5d1dc` genau (`stellschraube("ampel-schwellen",...)`, `workflows.js`) und wer liest es?
- Welche Karten haben kein Uploaddatum (`floatUpload`) — wie greift das Modell dort?

## DESIGN-ENTSCHEIDE (Owner + Bau-Session, 25.09.2026)

Besitzer des Baus: die Ampel-/Deadline-Session (diese) — Owner-Entscheid per AskUserQuestion.

1. **Aktionen mit Deadline** = die bestehenden TERMINE: `dreh`, `schnitt`, `freigabe`, `upload`
   (Skript bleibt ohne Datum). Keine neuen Aktionen — minimaler, korrekter Umbau.
2. **Default-Offsets (Tage VOR Upload):** upload 0 · freigabe 3 · schnitt 6 · dreh 12. freigabe/schnitt
   = bisheriges Verhalten; dreh 12 = Ziel-Vorlauf, wenn kein echter Drehtermin zugewiesen ist. Alle
   editierbar an EINER Stelle (Einstellungen).
3. **Aktion ↔ Fortschritt:** Deadline-DATUM ist rein upload-verankert (Upload − Offset), NICHT
   spaltenabhaengig. Welche Aktionen fuer die Ampel noch RELEVANT sind (also faerben), bleibt an der
   Spalte: eine Aktion zaehlt, solange die Karte ihre Phase noch nicht hinter sich hat
   (`phaseIndex(card.column) <= phaseIndex(aktion.phase)`) — verhindert falsches Rot fuer erledigte Schritte.
4. **Drehtermin — „zugewiesener Termin gewinnt" + Gruen-Puffer-Block (Owner 25.09.2026):**
   - Ampel: ist ein echter Drehtermin zugewiesen (`drehterminId` → `S.drehtermine`), zaehlt SEIN Datum
     als Dreh-Deadline; sonst der ABGELEITETE spaeteste Dreh (kein eigener Offset).
   - **Spaetester Dreh = Schnitt-Deadline − (gelbTage+1) = Upload − offsetSchnitt − (gelbTage+1)**
     (Defaults 6+6 → Upload−12). Begruendung Owner: wird der Drehtag eingehalten, soll die Karte mit
     GRUENEM Punkt in den Schnitt rutschen — der Dreh muss so weit vor dem Schnitt liegen, dass die
     Schnitt-Deadline am Drehtag noch gruen ist (> gelbTage Tage entfernt), nicht schon gelb.
   - **Block bei Zuweisung (`store.js karteZuTermin`):** ein Drehtermin mit Datum > spaetester Dreh
     ist fuer diese Karte NICHT zuweisbar (Refusal mit Grund), nicht nur gewarnt. Greift je
     Karte↔Termin (geteilter Termin, je Karte eigener Upload). Kein Upload → kein Block (nicht rechenbar).
   - Hinweis-Text dazu in den Einstellungen bei den Deadline-Offsets (Peer/ui.js).
5. **rot/gelb FEST** — `6e5d1dc` (editierbare Schwellen) wird ZURUECKGEROLLT: `AMPEL` wieder feste
   Konstante, `ampel-schwellen`-Workflow + `setAmpelSchwellen`/`syncAmpelSchwellen` raus.
6. **Migration:** Karten behalten `dates.upload` (Anker). Abgeleitete Deadlines werden LIVE aus Upload +
   Offsets gerechnet — die Ampel liest NICHT mehr `card.dates[termin]` (Ende der v66-Staleness). Karten
   ohne Uploaddatum (`floatUpload`/kein Upload) haben keine abgeleiteten Deadlines → Ampel neutral (gruen).
   `card.dates.schnitt/freigabe` bleiben als Anzeige-Cache fuer detail.js (rueckwaertsplan unveraendert),
   sind aber nicht mehr Ampel-Quelle. `detail.js` wird NICHT angefasst.

## Bau-Plan (diese Session)

- `lib/pipeline.js`: `AKTIONEN` (dreh/schnitt/freigabe/upload, je Offset + `phase`), `deadlineOffsets`
  + `setDeadlineOffsets()`; `deadlineFuer(card, key, drehDatum)` = Upload − Offset (dreh: zugewiesener
  Termin gewinnt). `relevanteFristen`/`ampel` auf abgeleitete Deadlines umstellen. `AMPEL` wieder feste
  Konstante; `AMPEL_STANDARD`/`ampelSchwellen`/`setAmpelSchwellen`/`ampelSchwellenJetzt` entfernen.
  `deadlineKette`/`setDeadlineKette` durch `deadlineOffsets`/`setDeadlineOffsets` ersetzen; `rueckwaertsplan`
  bleibt (detail.js-Cache), liest die Offsets.
- `lib/workflows.js`: `ampel-schwellen`-Eintrag raus (Rollback 6e5d1dc); `rueckwaertsplan`-Params von
  gap* (Tage-zu-naechster) auf offset* (Tage-vor-Upload) umstellen: `offsetDreh`/`offsetSchnitt`/`offsetFreigabe`.
- `public/store.js`: `syncAmpelSchwellen` raus; `syncDeadlineKette` → `syncDeadlineOffsets` (liest offset*-Params).
- `public/redaktionsplan.js`: `baueDeadlines`-Sektion entfernen (v66-UI raus, keine Doppelung).
- `public/board.js`: `ampel()`-Aufruf an die neue Signatur anpassen (Drehtermin-Aufloesung bleibt).
- `public/ui.js` (Peer): EIN Einstellungen-Feldblock fuer die Offsets — Ort mit Peer abstimmen; API:
  `stellschraube("rueckwaertsplan","offsetDreh"/…)` lesen, `setzeWorkflow` schreiben.

## Plan (nach Design-Freigabe)
1. Datenmodell: Aktions-Offsets in den Drive-Defaults (v60), zentrale `deadlineFuer(card, aktion)` = Upload − Offset in `pipeline.js`.
2. Ampel/`board.js` auf abgeleitete Deadlines umstellen; feste rot/gelb-Schwellen behalten.
3. v66-Deadline-UI aus `redaktionsplan.js` entfernen (keine Doppelung).
4. Einstellungen-Feld (ui.js) fuer die Offsets. `6e5d1dc` klaeren (verstecken/zurueckrollen).
5. Verify im Browser (Ampel faerbt korrekt nach Upload−Offset), `node --check`, Commit.

## Kollision / Koordination
Ueberlappt v66 (`17e8f27`) + `6e5d1dc` der Ampel-Session HART (pipeline.js, board.js, redaktionsplan.js,
ui.js, style.css, stores/workflows). Nur EINE Session baut. Owner entscheidet Besitzer; Peer ist informiert
(pausiert weiteren v66/6e5d1dc-Aufbau). Architektur-schwer → Modell Opus 5, eigene Session (Owner-Muster fuer Grosses).

## Verify (Beleg, 25.09.2026)
- `node --check` pipeline/workflows/store/redaktionsplan/kontextmenu → OK.
- Node-Probe gegen echtes `lib/pipeline.js` + echte `data/board.json`:
  - deadlineFuer(U=11-01): upload 11-01 · freigabe 10-29 (−3) · schnitt 10-26 (−6) · dreh 10-20
    (=spaetesterDreh); zugewiesener Dreh gewinnt (10-15).
  - **Gruen-Puffer bewiesen:** spaetesterDreh 10-20 → Schnitt 10-26 = 6 Tage entfernt (> gelbTage 5)
    → GRUEN beim Eintritt in den Schnitt. Schwellen fest 2/5 (−1/0/2 befund · 3/5 hinweis · 6 ok).
  - Alle realen Karten faerben sinnvoll, keine Crashes; Karten OHNE Uploaddatum → neutral (gruen).
- Browser-Integration (Server :4399, echte kachel() × Modell v70 × Peer-kartenMeldungen):
  12 Karten gerendert, 0 Fehler; Punkt-Klassen ok/befund korrekt; Screenshot bestaetigt Punkt +
  Warn-/Hinweis-Glyphen.

## Stand
- [x] Owner-Modell erfasst (24./25.09.2026, mehrere AskUserQuestion-Runden inkl. Drehtermin-Block)
- [x] Peer informiert, Besitzer = diese Session, Freeze der 4 Logik-Files bestaetigt
- [x] Design-Fragen mit Owner geklaert (Aktionen, Offsets, Drehtermin gewinnt, Gruen-Puffer-Block)
- [x] Bestandsanalyse pipeline/redaktionsplan/store/workflows/board (board.js unveraendert noetig)
- [x] Bau: pipeline (offset-Modell + AMPEL fest + deadlineFuer/spaetesterDreh), workflows (offset-Params,
      ampel-schwellen raus), store (syncDeadlineOffsets + Dreh-Block), redaktionsplan (v66-UI raus),
      kontextmenu (Block-Meldung)
- [x] Verify (node --check, Node-Probe, Browser-Integration + Screenshot)
- [x] Commit + Push (Logik-Teil): 1fbbe9d
- [x] detail.js: Block-Meldung (Refusal) — Layout-Session, b9d370a
- [x] ui.js: Offset-Feldblock im Ansicht-Tab (Deadline-Vorlauf) — Layout-Session, b46fe24
- [x] End-to-End verifiziert (25.09.2026): UI schreibt offsetFreigabe/offsetSchnitt (Param-Keys passen zu
      store.syncDeadlineOffsets), setzeWorkflow persistiert (Datei), ladeWorkflows → pipeline: offsetSchnitt
      10 → Schnitt-Deadline U−10, spaetesterDreh U−16 (Gruen-Puffer −6 erhalten); danach auf 3/6 zurueckgesetzt.

## DoD — ERFUELLT (25.09.2026)
- Genau eine Deadline-Quelle (Ansicht-Tab, Offset-Felder), Redaktionsplan ohne Deadline-Bearbeitung. ✓
- Ampel faerbt nach Upload−Offset; rot/gelb fest (2/5). ✓
- Offsets editierbar (`offsetFreigabe`/`offsetSchnitt`) + persistent; Karten ohne Upload neutral. ✓
- Drehtermin: zugewiesener gewinnt; zu spaeter Termin blockiert (Gruen-Puffer). ✓
Geprueft gegen: `node --check` (pipeline/workflows/store/redaktionsplan/kontextmenu) · Node-Probe gegen
`lib/pipeline.js` + `data/board.json` · Browser-Integration :4399 (12 Karten, 0 Fehler) + Screenshot ·
End-to-End UI→pipeline (offsetSchnitt 10 → Deadlines verschoben, dann 3/6) · Commits 1fbbe9d (Logik),
b9d370a (detail.js), b46fe24 (ui.js). Offen: nichts — v70 vollstaendig.

## Nachtrag v70b — Ketten-Offsets + Dreh-Feld + vertikale Anordnung (Owner 26.09.2026)

Owner an der Ansicht-Tab-UI: (1) das Dreh-Kettenglied fehlte, (2) die Tage sollen sich auf die VORHERIGE
Deadline beziehen (3 + 3 + 6 statt 3, 6 — bessere Uebersicht), (3) Felder untereinander: oben Upload,
darunter Freigabe, Schnitt, Dreh.

Logik (diese Session, committet): Offsets sind jetzt eine KETTE (Tage vor der jeweils naechsten Deadline);
`pipeline.kumuliert()` summiert sie zu Upload-Offsets. Standard 3/3/6 → kumuliert 3/6/12 = altes Verhalten.
Der Dreh ist ein eigenes, editierbares Kettenglied; `spaetesterDreh` = Upload − kumulierter Dreh-Offset
(Standard 6 vor Schnitt haelt gruen). Register-Params neu (Kollision mit Alt-Daten vermieden):
`freigabeVorUpload` (3), `schnittVorFreigabe` (3), `drehVorSchnitt` (6). `store.syncDeadlineOffsets` liest sie.
Verify: node-Probe Default-CHECK + Changed-CHECK PASS (2/4/8 → freigabe−2/schnitt−6/dreh−14); zugewiesener
Dreh gewinnt.

Frontend (an Layout-Session): ui.js-Feldblock neu — 3 vertikale Zeilen (Upload als Basis oben, dann
Freigabe/Schnitt/Dreh), Labels „Tage vor Upload/Freigabe/Schnitt", lesen/schreiben die 3 neuen Keys;
alte `offsetFreigabe`/`offsetSchnitt` entfallen.
