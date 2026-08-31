# Work package: v11 — Toast-Notifications

> Owner-Auftrag 31.08.2026: Notification Boxes oben rechts, grün/rot, 10 Sek Auto-Close.
> Überall wo heute Feedback fehlt oder stumm verschluckt wird; Konvention für Folge-Schritte.

**Problem:** Drive-Aktionen, Slot-Belegungen und KI-Läufe geben heute kein sichtbares
Feedback — Fehler verschwinden lautlos, Erfolge bleiben unsichtbar. `confirm()` beim
Löschen ist ein nativer Browser-Dialog ohne Stil-Konsistenz.

**Intent:** Jede abgeschlossene Aktion, die der User ausgelöst hat, bekommt ein
kurzlebiges Signal: grün bei Erfolg, rot bei Fehler. Der User muss nicht auf den
Kopfbereich achten und verpasst keinen Fehler mehr.

**Goal:** (1) `meldung(text, typ)` in `ui.js` — Toast oben rechts, 10 Sek, grün/rot.
(2) `bestaetigen(text, onJa)` — ersetzt `confirm()` durch einen Toast mit Bestätigungs-
buttons. (3) Alle 11 identifizierten Stellen in detail.js, nachschub.js, app.js verdrahtet.
(4) `docs/notifications-konvention.md` als Regelblatt für Folge-Schritte.

## Plan

| Schritt | Datei | Was |
|---|---|---|
| P1 CSS | style.css | `.meldung-stapel` + `.meldung` + Animationen |
| P2 ui.js | ui.js | `meldung()` + `bestaetigen()` exportieren |
| P3 detail.js | detail.js | 8 Stellen verdrahten (Drive, Slot, Löschen, KI, Skript) |
| P4 nachschub.js | nachschub.js | 2 Stellen (Slot-Fehler, Ideen-Erfolg) |
| P5 app.js | app.js | 1 Stelle (Drive-Startup-Fehler) |
| P6 Konvention | docs/notifications-konvention.md | Regelblatt |

## Stand — 31.08.2026

| Schritt | Status |
|---|---|
| P1 CSS | fertig |
| P2 ui.js | fertig |
| P3 detail.js | fertig |
| P4 nachschub.js | fertig |
| P5 app.js | fertig |
| P6 Konvention | fertig |

## Definition of Done

- [ ] Toast erscheint oben rechts, grün bei Erfolg, rot bei Fehler.
- [ ] Auto-Close nach 10 Sekunden; manuelles Schließen per ×.
- [ ] Drive-Ordner anlegen: grün bei Erfolg, rot bei Fehler (guidedIdee + blockDrive).
- [ ] Drive erneut lesen: rot wenn Scan fehlschlägt.
- [ ] Standard speichern: rot wenn API-Fehler.
- [ ] Karte löschen: kein nativer confirm() mehr; Toast-Bestätigung + grüner Abschluss-Toast.
- [ ] Slot-Belegung: rot wenn PUT fehlschlägt (nachschub.js + detail.js).
- [ ] Skript in Drive speichern: grüner Toast (nachDrive).
- [ ] KI-Ergebnis gespeichert: grüner Toast (rufeKi).
- [ ] Drive-Startup-Fehler: roter Toast statt lautlosem catch.
- [ ] Keine Konsolenfehler in Light + Dark Mode.
