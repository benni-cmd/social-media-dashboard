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

1. [ ] `lib/pipeline.js` — `migriere`: `card.drehterminId ??= null`; Helfer für
   Termin↔Karten-Konsistenz (rein, ohne DOM). Ggf. `leereDrehtermin()`.
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
- [ ] Design vom Owner freigegeben.
- [ ] Bau (Plan-Schritte 1–6).
- [ ] Verify + Commit + Push.

## DoD
- [ ] Drehtermin anlegen, Karten zuordnen; zugeordnete Karten erben das Datum.
- [ ] Termin-Datum ändern zieht `dates.dreh` aller Mitglieder mit.
- [ ] Ungebundene Karte behält frei wählbaren Einzel-Drehtag (gemischt-tauglich).
- [ ] Kalender zeigt Batch-Termine ohne Doppelanzeige der Einzel-Punkte.
- [ ] UI-Abnahme per Screenshot bestanden; kein toter Zustand beim Erst-Start.
