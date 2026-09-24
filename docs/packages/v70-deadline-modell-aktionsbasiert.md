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

## OFFENE DESIGN-FRAGEN (vor dem Bau mit Owner klaeren)
1. **Welche Aktionen** tragen Deadlines (heutige Phasen: Idee/Skript/Freigabe/Dreh/Schnitt/Upload)? Welche NICHT?
2. **Default-Offsets** je Aktion (Tage vor Upload)?
3. **Aktion ↔ Spalte:** Board-Spalten bleiben; wie mappen Aktionen darauf (1:1, oder Aktionen quer)?
4. **Drehtermin:** bleibt der zugewiesene Drehtermin (`drehterminId`) eine eigene, feste Deadline neben den
   offset-basierten, oder wird er auch als Aktions-Offset gefuehrt?
5. **Migration** bestehender v66-Daten + Karten ohne Uploaddatum.

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

## Stand
- [x] Owner-Modell erfasst (24.09.2026, 2 AskUserQuestion-Runden)
- [x] Peer informiert (pause v66/6e5d1dc), Besitzerfrage gestellt
- [ ] Design-Fragen mit Owner geklaert
- [ ] Bestandsanalyse pipeline/redaktionsplan/6e5d1dc
- [ ] Bau + Verify

## DoD
- Genau eine Deadline-Quelle (Einstellungen), Redaktionsplan ohne Deadline-Bearbeitung.
- Ampel faerbt nach Upload−Offset; rot/gelb fest.
- Offsets editierbar + persistent (Drive); Migration verlustfrei; Browser-Verify.
