# v79 — Redaktionsplan: maximaler Abstand zwischen zwei Posts

> Owner-Auftrag 28.09.2026. Kleines, eigenständiges Feature (Slot-Erzeugung), separat von v78.

## PIG

**Problem:** Upload-Slots werden aus Format-Zeitfenstern (`lib/scheduler.js` FENSTER) + Kadenz
(`plan.kadenz.postsProWoche`) erzeugt (`slotsForMonth(plan, year, month)`, redaktionsplan.js:424).
Der Abstand zwischen zwei aufeinanderfolgenden Posts kann über Wochengrenzen stark schwanken —
Owner-Beispiel: 1 Post/Woche, Woche 1 Montag + Woche 2 Freitag = **11 Tage** dazwischen. Keine Obergrenze.

**Intent (Owner 28.09.2026):** Ein Feld im Redaktionsplan „max. Abstand zwischen 2 Posts (Tage)", das
die Slot-Erzeugung so begrenzt, dass zwischen zwei aufeinanderfolgenden Uploads nie mehr als N Tage liegen
(Beispiel: Begrenzung auf 9 verhindert die 11-Tage-Lücke).

**Goal:** `plan.maxAbstandTage` (Config, im Drive-gestützten Plan); Eingabefeld im Redaktionsplan bei der
Kadenz; `slotsForMonth` erzwingt die Obergrenze — kein erzeugter Slot-Abstand > `maxAbstandTage`.

## PRÜFE ZUERST (beim Bau)
- `lib/scheduler.js` `slotsForMonth` GANZ lesen: wie werden pro Woche/Monat die Fenster ausgewählt und
  chronologisch gereiht? Wo entsteht der Wochengrenzen-Abstand?
- Wirkt die Grenze nur auf die Slot-Vorschau, oder auch auf `naechsteFreieSlots`/Auto-Upload-Datum?

## Plan
1. `pipeline.js` `defaultPlan()`: `maxAbstandTage: 0` (0 = aus/keine Grenze; Default sicher, Owner setzt z. B. 9).
2. `public/redaktionsplan.js`: Zahlenfeld „Max. Abstand zwischen 2 Posts (Tage)" bei der Kadenz; 0/leer = aus.
3. `lib/scheduler.js` `slotsForMonth`: nach der Kadenz-Auswahl die chronologische Slot-Sequenz prüfen; wo der
   Abstand zum vorherigen Slot > `maxAbstandTage` würde, den Slot vorziehen (früheres Fenster derselben Woche
   wählen) bzw. einen Zwischenslot einfügen, bis die Grenze hält — auch über Monats-/Wochengrenzen.
   Genaue Strategie (vorziehen vs. zusätzlicher Slot) beim Bau festlegen und mit Owner-Beispiel testen.
4. Verify: Beispiel Woche 1 Montag + Woche 2, Grenze 9 → kein 11-Tage-Abstand mehr (Browser-Redaktionsplan).

## Dateikarte + Besitz
- `lib/pipeline.js` `defaultPlan` — Peer-Datei → abstimmen.
- `lib/scheduler.js` — Slot-Logik → Besitzer klären (Redaktionsplan-Ecke).
- `public/redaktionsplan.js` — andere Session (v66/v74) → abstimmen.

## Stand
- [x] Slot-Erzeugung lokalisiert (scheduler.slotsForMonth, redaktionsplan.js:424)
- [ ] Bau + Verify

## DoD
- Feld im Redaktionsplan setzbar (0 = aus), im Plan (Drive) persistent.
- Erzeugte Slots halten den max. Abstand ein (Owner-Beispiel verifiziert).
