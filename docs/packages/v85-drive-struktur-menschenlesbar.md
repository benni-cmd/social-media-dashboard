# v85 — Drive-Struktur: für Menschen lesbarer, für die Abfrage einfacher

> Owner-Auftrag 30.09.2026: „Lässt sich die Ordnerstruktur im Drive nochmal besser oder
> logischer aufbauen, um die Abfrage simpler zu gestalten? Dabei soll immer beibehalten werden,
> dass Drive der Point of Truth ist und man als Mensch auch aus dem Drive arbeiten kann, wenn
> das Board ausfallen sollte. Dieses Ziel fest verankern."
> Verankert: `docs/drive-convention.md`, Abschnitt „Grundsatz" (+ Verweis im README).

**Problem:** Gemessen 30.09.2026 (`rclone lsf -R --fast-list --max-depth 5`, 216 Einträge):
1. Drive sortiert die Spaltenordner alphabetisch — Caption, Idee, Schnitt, Skript, Upload,
   Videodreh — nicht in Arbeitsreihenfolge. Wer ohne Board arbeitet, sieht die Pipeline durcheinander.
2. Projektordner heißen zusammengeschrieben und nach 32 Zeichen abgeschnitten
   (`JungbodenschutzmitnatuerlichenMi`, `BodentestimGlasErkennedeineBoden`).
3. Termine, Uploaddatum, Kategorie und Ziel stehen nur in `(AI only)/projekt.json` — ein
   Mensch ohne Board sieht nicht, wann was fällig ist.
4. Die Abfrage selbst ist nach v84 schon schlank: Abgleich 8,8–9,8 s live
   (`curl -X POST /api/drive/reconcile`), 5 rclone-Aufrufe.
**Intent:** Grundsatz aus `docs/drive-convention.md` erfüllen — ohne Board arbeitsfähig — und
die Abfrage dabei nicht komplizierter, sondern einfacher machen.
**Goal:** Ein Mensch, der nur Drive öffnet, sieht die Phasen in Arbeitsreihenfolge, liest die
Projektnamen im Klartext und findet Termine/Stand je Projekt in einer lesbaren Datei; der
Abgleich bleibt ≤ 10 s.

## Optionen (Owner-Entscheidung offen)

| # | Änderung | Nutzen Mensch | Nutzen Abfrage | Risiko |
|---|---|---|---|---|
| A | Spaltenordner nummerieren: `1 Idee` … `6 Upload` (Board zeigt Namen ohne Nummer) | hoch: Reihenfolge stimmt | keiner | niedrig: 6 Ordner umbenennen; `.phase`-Marker erkennen die Umbenennung schon heute |
| B | `Steckbrief.md` je Projekt (Phase, Termine, Kategorie, Ziel, nächster Schritt), vom Board bei jedem Speichern mitgeschrieben | hoch: Stand ohne Board lesbar | keiner | niedrig: nur eine Datei mehr; Wahrheit bleibt projekt.json |
| C | Klartext-Projektnamen mit Leerzeichen für NEUE Projekte (`Bienen und ihre Blumenfreunde`) | mittel–hoch | keiner | mittel: Pfadprüfung/Slug anpassen; alte Ordner bleiben oder werden einmalig migriert |
| D | Abgleich in EINEM rclone-Aufruf (`lsjson -R --hash` ab Wurzel: Projektordner + Marker zusammen) | keiner | ~3–4 s schneller | niedrig: nur Code, Struktur bleibt |
| E | Alle Phasen unter einen Ordner (Videoauswertung/Verworfen umziehen) | gering | 1–2 Aufrufe weniger | hoch: KPI-Tabellen, Links, Gewohnheiten — **nicht empfohlen** |

Empfehlung: A + B + D. C nur für neue Projekte, falls gewünscht. E nicht.

## Plan

1. [ ] Owner-Entscheidung zu A–E
2. [ ] Bau je gewählter Option, einzeln verifiziert (Drive-Ansicht per `rclone lsf` + Board-Screenshot)
3. [ ] `docs/drive-convention.md` Strukturbild nachführen

## Status

30.09.2026 — Bestand gemessen, Grundsatz verankert, Optionen aufgestellt.

## Definition of Done

Geprueft gegen: `rclone lsf -R` Vorher/Nachher, Abgleich-Zeit live, Board-Screenshot
Offen: Owner-Entscheidung zu A–E
