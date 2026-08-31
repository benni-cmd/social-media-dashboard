# Work package: v12 — Sidebar-Vereinheitlichung + Vorauswahl-Logik

> Owner-Auftrag 31.08.2026: Manuelle Karte = komplett leer, KI-Karte = voll
> ausgefuellt (inkl. Termin aus naechstem freien Slot), Sidebar-Struktur
> (Stamm/Termin/Arbeit) auf alle Spalten einheitlich anwenden.

**Problem:** Manuelle Karten haben Vorauswahl (Reel, Instagram, reach_new), die
der User nicht will. KI-Karten setzen keine Plattform aus dem Slot. Die Sidebar
sieht in jeder Spalte anders aus — kein einheitliches Schema.

**Intent:** Klare Trennung: manuell = Blanko-Karte zum Ausfuellen, KI = fertig
konfigurier- und direkt bearbeitbar. Sidebar ueberall im gleichen Dreiklang
Stamm → Termin → Arbeit, visuell konsistent.

**Goal:** (1) `leereKarte()` liefert leere Felder (kein contenttyp/goal/platforms).
(2) KI-Karten aus nachschub.js setzen Plattform aus Slot.
(3) Sidebar-Bloecke folgen ueberall demselben Schema, Nicht-Idee-Termin nutzt
Kompaktansicht mit optionaler Detail-Klappe.

## Plan

| # | Was | Datei |
|---|-----|-------|
| 1 | `leereKarte`: contenttyp/goal/platforms leer | `lib/pipeline.js` |
| 2 | KI-Karten: `platforms` aus Slot-Daten | `public/nachschub.js` |
| 3 | `blockTermine` (Nicht-Idee): Kompaktansicht + Detail-Klappe | `public/detail.js` |
| 4 | Optische Abnahme alle Spalten | Browser |
| 5 | Commit + Push | git |

## Stand

- [ ] Schritt 1
- [ ] Schritt 2
- [ ] Schritt 3
- [ ] Schritt 4
- [ ] Schritt 5

## DoD

- Manuelle Karte oeffnet sich ohne Vorauswahl (Typ/Kategorie/Ziel/Plattform leer)
- KI-Karte hat Plattform aus Slot gesetzt
- Sidebar in Idee, Skript, Videodreh, Schnitt, Caption, Upload visuell einheitlich
- Browser-Screenshot ohne Fehler
