# v89 — Nächster freier Upload-Termin: eine Regel statt vier

> Owner 01.10.2026: „Bei der neuen Karte wird mir der 1.10.2026 als nächstes freies Uploaddatum
> vorgeschlagen — das wäre quasi heute, die Deadlines sind unmöglich einzuhalten. Er schlägt mir
> auch den 1.10. vor, wenn ich ein anderes Format als Reel wähle, dabei ist im Redaktionsplan nur
> 1 Reel pro Woche geplant. Logische Verknüpfungen prüfen, nachhaltig korrigieren, dokumentieren."

## PIG

**Problem:** „Nächster freier Termin" wurde an vier Stellen je eigen gerechnet:

| Stelle | Frühestes Datum | Format beachtet |
|---|---|---|
| `public/detail.js:697` Kachel „Naechstes freies Datum" | **heute** | nein |
| `public/kontextmenu.js:216` „Naechsten freien Upload-Termin" | **heute** | nein |
| `public/store.js:745` schwebende Karten | nächster Drehtermin + 8 | nein |
| `public/nachschub.js:18` Idee von der KI | nächster Drehtermin + 8 | egal (Slot bestimmt Format) |

Folge: ein Slider bekam den Reel-Slot von heute.

**Intent:** Ein vorgeschlagener Termin muss machbar sein (keine Deadline in der Vergangenheit) und
zum Format der Karte passen — überall gleich.

**Goal:** Eine Funktion `naechsterFreierUpload()` in `lib/uploadslots.js`; alle vier Stellen rufen
sie. Ist für das Format nichts geplant, sagt das Board das im Klartext statt ein falsches Datum zu zeigen.

## Regel (gilt ab v89)

1. **Format passt:** Ein Slot passt nur, wenn sein Typ dem Format der Karte entspricht
   (Reel→Reel-Slot, Slider→Slider-Slot, Beitrag→Beitrag-Slot, Story/Highlight→Story-Slot,
   Langformat→Langformat-Slot). Karte ohne Format zählt als Reel.
2. **Machbar:**
   - Video-Formate (Reel, Langformat): frühestens **nächster Drehtermin + 8 Tage** (Regel v37,
     ohne kommenden Drehtermin: Sonntag der Folgewoche + 8).
   - Andere Formate (kein Dreh): frühestens **heute + Freigabe-Vorlauf + Schnitt-Vorlauf**
     (Einstellungen → Ansicht → Deadline-Vorlauf, Standard 3 + 3 = 6 Tage).
3. **Frei:** kein anderer (nicht verworfener) Beitrag hat dasselbe Datum + dieselbe Uhrzeit.
4. **Nichts passt:** Klartext — „Im Redaktionsplan ist kein Slider geplant. Frequenz im
   Redaktionsplan erhöhen oder Datum von Hand wählen."

## Plan

1. `lib/uploadslots.js` (neu, rein, Browser + Node): `slotTyp`, `fruehesterUploadFuer`, `planSlots`, `naechsterFreierUpload`.
2. Die vier Stellen umstellen; keine eigene Slot-Rechnung mehr dort.
3. Node-Probe: Slider bei reinem Reel-Plan → Klartext; Reel am 01.10. mit Drehtermin 01.10. → ≥ 09.10.; Beitrag → ≥ heute + 6.
4. README-Abschnitt „Termine" (Paket v92) beschreibt die Regel.

## Stand

01.10.2026 — gebaut und belegt. `lib/uploadslots.js` neu; detail.js, kontextmenu.js, store.js, nachschub.js rufen nur noch `naechsterFreierUpload()`.
Belege: Node-Probe (Plan = 1 Reel/Woche, Drehtermin 01.10.): Reel → 14.10., Slider → Klartext, Beitrag (Testplan) → 15.10.; Browser-Kopie :4399: Slider-Karte „Kein passender Termin · Im Redaktionsplan ist kein Slider geplant …“, dieselbe Karte als Reel → 3.11.2026 (14./20./31.10. belegt, per `data/board.json` nachgezählt).

## DoD

- [x] eine Funktion, vier Aufrufer, keine Duplikat-Rechnung (`grep slotsForMonth public/` nur noch Redaktionsplan-Kalender)
- [x] Node-Probe grün
- [x] im Browser: Slider-Karte zeigt Klartext, Reel-Karte ein Datum ≥ Drehtermin + 8
