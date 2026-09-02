# v16 — Drehtermine (Batch-Dreh + Einzel-Drehtag)

## PIG

**Problem:** Ein „Drehtag" existiert heute nur als *abgeleiteter Einzeltermin pro Karte*
(`dates.dreh` = Upload − 14 Tage, gesetzt von `einfacherPlan()`/`rueckwaertsplan()`).
Es gibt keinen echten Dreh*termin* als eigene Sache — das Bündeln mehrerer Inhalte auf
einen Tag/Ort („am 15.9. drehe ich diese 4 Reels") kann das System nicht abbilden.

**Intent:** Einen Drehtermin als eigene Entität einführen, dem mehrere Karten zugeordnet
werden — ohne den bestehenden freien Einzel-Drehtag zu verlieren. Ben arbeitet gemischt
(mal Batch, mal einzeln), also müssen beide Wege nebeneinander funktionieren.
[Owner, 02.09.2026: „beides kombiniert" · „gemischt"]

**Goal:** Es gibt einen Bereich „Drehtermine", in dem man einen Termin (Datum, Zeit, Ort)
anlegt und ihm Karten zuordnet. Zugeordnete Karten erben das Dreh-Datum (Quelle der
Wahrheit = Termin); ungebundene Karten behalten ihren frei wählbaren Einzel-Drehtag.
Der Kalender zeigt Batch-Drehtermine als eigene Ebene. UI-Abnahme per Screenshot besteht.

---

## Design-Entscheidungen

### Datenmodell (Speicherort: Board-Dokument)
Drehtermine leben als Geschwister der Karten im **selben** `board.json` →
`{ version, cards, drehtermine }`. Grund: ein atomarer Save, eine Version, keine
Cross-Datei-Drift (Karte↔Termin verweisen aufeinander). Der bestehende Optimistic-Lock
über `version` deckt beides ab.

**Drehtermin:**
```
{ id, datum: "YYYY-MM-DD", zeit: "HH:MM"|"", ort: "", titel: "", notiz: "",
  karteIds: [ ... ] }
```
**Karte:** neues Feld `drehterminId: string|null`.

### Konsistenzregel — Termin ist die Wahrheit
- Karte zuordnen → `k.drehterminId = t.id` **und** `k.dates.dreh = t.datum` (gespiegelt,
  damit Kalender + Rückwärtsplan-Kompatibilität ohne Sonderfälle weiterlaufen).
- Termin-Datum ändern → `dates.dreh` **aller** Mitgliedskarten mitziehen.
- Karte lösen → `drehterminId = null`; `dates.dreh` bleibt als freier Einzeltermin stehen.
- Ungebundene Karte (kein `drehterminId`): heutiges Verhalten unverändert, `dates.dreh`
  frei editierbar. → deckt den „einzeln"-Fall ab.

### Kopplung beim Zuordnen — Upload bleibt stehen [Owner, 02.09.2026]
Beim Zuordnen (und bei jeder Datumsänderung des Termins) werden die Termine der Karte
**rund um den Dreh** neu gerechnet — **außer Upload**:
- `skript`, `idee` = Dreh − Vorlauf · `schnitt`, `freigabe` = Dreh + Nachlauf.
- **`upload` wird NIE angetastet.** Begründung: Batch heißt einmal drehen, über Wochen
  verteilt hochladen — der Upload ist die Verteil-Entscheidung, nicht aus dem Dreh
  ableitbar; außerdem bleiben reservierte Redaktionsplan-Slots (`slotBelegen`) erhalten.
- Ausnahme Einzel-Fall: ist `upload` leer, darf er optional aus dem Dreh folgen
  (Dreh + 14). Bei belegtem `upload` niemals.

### Vorlauf-Kette harmonisiert — Dreh−Upload = 14 Tage [Owner, 02.09.2026]
Heute widersprüchlich: `einfacherPlan` nimmt Dreh = Upload−14, `rueckwaertsplan` +
`VORLAUF_TAGE` nehmen Dreh = Upload−6. Standard künftig **14 Tage**. Damit die Kette
monoton fallend bleibt (Idee > Skript > Dreh > Schnitt > Freigabe > Upload), wird die
ganze `VORLAUF_TAGE`-Tabelle neu gesetzt — Tage VOR Upload:

| Meilenstein | alt | neu | relativ zum Dreh |
|---|---|---|---|
| idee     | 10 | 21 | Dreh − 7 |
| skript   |  8 | 17 | Dreh − 3 |
| dreh     |  6 | 14 | 0 |
| schnitt  |  3 | 10 | Dreh + 4 |
| freigabe |  1 |  3 | Dreh + 11 |
| upload   |  0 |  0 | Dreh + 14 |

`einfacherPlan` und `rueckwaertsplan` lesen künftig dieselbe Tabelle → ein Widerspruch weg.

### UI
- **Neuer Nav-Tab „Drehtermine"** (`public/drehtermine.js`): kommende Termine als Liste,
  je Termin Datum/Zeit/Ort + zugeordnete Karten; Anlegen/Bearbeiten/Löschen; Karten
  zuordnen/entfernen.
- **Karten-Detail** (`blockTermine`): Zeile „Drehtermin" — entweder „zugeordnet: <Datum,
  Ort>" + Lösen, oder „vorhandenem zuordnen / neuen anlegen". Bei gebundener Karte ist
  das Einzel-Dreh-Feld read-only (zeigt geerbtes Datum).
- **Kalender** (`public/kalender.js`): Batch-Drehtermine als eigene Marke mit Zähler
  („Dreh · 4 Inhalte"); per-Karte-`dreh`-Punkt nur, wenn die Karte KEINEM Batch angehört
  (sonst Doppelanzeige).

---

## Plan

1. [ ] `lib/pipeline.js` — `VORLAUF_TAGE` harmonisieren (Tabelle oben, Dreh=14);
   `einfacherPlan`/`rueckwaertsplan` auf dieselbe Tabelle; `migriere`:
   `card.drehterminId ??= null`; reiner Helfer `planUmDreh(dreh, altUpload)` (Skript/Idee/
   Schnitt/Freigabe um den Dreh, Upload unberührt); `leereDrehtermin()`.
2. [ ] `server.js` — `leseBoard`/`schreibeBoard`/`PUT /api/board` tragen `drehtermine`
   mit (Default `[]`); `migriere` auf Karten wie gehabt.
3. [ ] `public/store.js` — `S.drehtermine`, PUT-Body + `ladeBoard` erweitern; Helfer
   `drehterminAnlegen/Aendern/Loeschen`, `karteZuTermin/karteVonTermin`.
4. [ ] `public/drehtermine.js` — neue Ansicht + Nav-Verdrahtung in `index.html`/`app.js`.
5. [ ] `public/detail.js` — `blockTermine`: Drehtermin-Zuordnung; Einzel-Feld read-only
   bei Bindung.
6. [ ] `public/kalender.js` — Batch-Ebene + Doppelanzeige-Regel; `public/style.css` Marke.
7. [ ] UI-Abnahme im Browser (Screenshot gegen `docs/ui-standard.md`, Edge headless).

---

## Stand
- [x] Bestand geprüft: `dates.dreh`/`TERMINE`/`einfacherPlan`/`rueckwaertsplan`,
      Persistenz (`leseBoard`/`schreibeBoard`, `/api/board` mit `version`-Lock), `store.js`.
- [x] Weichenstellung mit Owner: beides kombiniert · gemischt (02.09.2026).
- [x] Kopplung geklärt: Upload bleibt stehen; Rest um den Dreh (02.09.2026).
- [x] Vorlauf-Standard geklärt: 14 Tage, Kette harmonisiert (02.09.2026).
- [ ] Design vom Owner final freigegeben (Vorlauf-Kette bestätigt?).
- [ ] Bau (Plan-Schritte 1–6).
- [ ] Verify + Commit + Push.

## DoD
- [ ] Drehtermin anlegen, Karten zuordnen; zugeordnete Karten erben das Datum.
- [ ] Termin-Datum ändern zieht `dates.dreh` aller Mitglieder mit.
- [ ] Ungebundene Karte behält frei wählbaren Einzel-Drehtag (gemischt-tauglich).
- [ ] Kalender zeigt Batch-Termine ohne Doppelanzeige der Einzel-Punkte.
- [ ] UI-Abnahme per Screenshot bestanden; kein toter Zustand beim Erst-Start.
