# v25 — Drive-Abgleich (reconcile) entschärfen: er läuft in den Timeout

## PIG

**Problem** (Owner 03.09.2026): Das Board meldet „der Driveabgleich ist nicht möglich".
Reproduziert: `POST /api/drive/reconcile` liefert nach 180 s **HTTP 000** (Timeout, keine
Antwort). Der Server lebt danach weiter (200) — es ist **kein Absturz, sondern zu langsam**.

**Ursache (gemessen):** `projekte.abgleich()` macht seriell (rcloneKette):
- 7 Phasen-Listings (`drive.list dirsOnly`), und
- **1 rclone-`cat` je Karte** (`leseProjektJsonMitOrt` liest je Projekt die projekt.json).
Bei ~19 Karten = ~26 serielle rclone-Aufrufe. In meiner Session zusätzlich durch die
shared-client_id-Drossel gestreckt → >180 s. Nicht von v23 verursacht (`abgleich` unverändert).

**Intent:** Reconcile so kürzen, dass es im eingeschwungenen Zustand in Sekunden durchläuft,
ohne die Kern-Semantik (Drive gewinnt bei der Phase) zu verlieren.

**Goal:** Karten, die schon in ihrer Board-Phase liegen, brauchen **keinen projekt.json-Read**
mehr — die Phase steht bereits im Listing. Reads nur noch bei Phasen-Abweichung (Drive gewinnt)
oder verwaisten Drive-Ordnern. Reconcile im Normalfall = wenige Aufrufe. Gemessen belegt.

## Bestand
- `lib/projects.js:232 abgleich()` — Schleife liest je Karte `leseProjektJsonMitOrt(pfad)`
  (Zeile 263) auch dann, wenn Drive-Phase == Board-Phase und die Karte vollständig ist.
- Die **Phase** kommt aus dem Listing (`inDrive`-Map Ordner→Phase), NICHT aus der projekt.json.
- projekt.json-Read dient nur: (a) Backfill/Migration alter Formate, (b) reiche Felder bei
  Phasenwechsel aus Drive holen, (c) verwaiste Ordner (ohne Karte) zur Karte aufbauen.

## Design — Schnellpfad
- Wenn `drivePhase === karte.column` UND `karte.driveName === name`: **weiter, kein Read**.
  Die Karte ist am richtigen Ort, das Board-Cache ist ihre Wahrheit. Kein Backfill hier
  (der passiert beim Speichern/PUT ohnehin am erwarteten Ort).
- Reads bleiben für: Phasen-Abweichung (Drive gewinnt), fehlender `driveName`, verwaiste Ordner.
- **Trade-off (Owner-Hinweis):** Wer eine projekt.json IN DRIVE von Hand ändert, ohne den
  Ordner zu verschieben, wird beim Abgleich einer bereits richtig einsortierten Karte nicht
  mehr eingelesen. Das ist kein unterstützter Weg (reiche Felder ändert man über das Board,
  das schreibt projekt.json). Phasen-/Ordner-Verschiebungen greifen weiterhin.
- **Folgeschritt (optional):** die 7 Phasen-Listings zu 2 rekursiven Listings bündeln
  (`lsf -R` über „In Bearbeitung" + „Videoauswertung").

## Plan
1. [ ] `abgleich()`: Schnellpfad-Weiche vor `leseProjektJsonMitOrt`.
2. [ ] Verify: reconcile-Zeit vorher/nachher messen; Ergebnis unverändert (gleiche Karten,
       gleiche Phasen); node --check.
3. [ ] Optional: Listings bündeln, wenn 7 Aufrufe noch zu lahm sind.

## Stand
- [x] Diagnose + Messung: HTTP 000 nach 180 s, Server lebt; ~26 serielle rclone-Aufrufe.
- [ ] Bau + Verify.

## DoD
- [ ] Reconcile läuft im eingeschwungenen Zustand ohne projekt.json-Reads (gemessen: Aufrufe/Zeit).
- [ ] Ergebnis identisch: gleiche Karten, gleiche Phasen-Zuordnung, gleiche Befunde bei echten
      Abweichungen.
- [ ] node --check grün.
