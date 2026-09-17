# v50 — Intuitivere Bedienung (kein Feature, keine Entfernung, keine Mehr-Komplexität)

## PIG

**Problem:** Das Board funktioniert, aber ein paar vorhandene Infos sind am Ruhezustand nicht
sichtbar — man muss raten oder hovern. Owner-Auftrag (17.09.2026): reine Intuition verbessern,
ohne neue Funktionen, ohne Funktionen zu entfernen, ohne mehr Komplexität.

**Intent:** Was das Board ohnehin weiß, soll ohne Nachdenken lesbar sein.

**Goal:** Drei kleine Klarheits-Verbesserungen, jede belegt am Bestand + Haus-Standard
(`docs/ui-standard.md`), keine davon fügt Funktion/Dichte hinzu.

## Die drei Vorschläge

### V1 — Spaltenköpfe erklären sich selbst (Tooltip)  ✅ umgesetzt
Die Phasen-Erklärung („Thema recherchieren, Fokus und Hooks wählen, Skript schreiben…") wird in
`board.js:155` als `.spalte-satz` gerendert, in v29 aber per `style.css:2846`
(`display:none`) versteckt — für einheitliche Kopfhöhe. Der Text bleibt so unsichtbar. Fix:
denselben Text als `title`-Tooltip auf den Spaltenkopf legen → beim Hovern erklärt sich jede
Phase, die einheitliche Höhe (v29) bleibt unberührt. Kein neues Element, kein Layout-Bruch.

### V2 — Kartenstatus am Ruhezustand erkennbar  ⏸ dein Nicken nötig (dokumentierte Entscheidung)
Die Karte zeigt nur einen **Farbpunkt** (`board.js:72` `.eintrag-punkt`). Das verstößt gegen
`docs/ui-standard.md` Regel 3 („Sechs Status-Wörter, nie Farbe allein"). ABER `board.js:55–57`
hält bewusst fest: „die Kachel zeigt NUR den Punkt … damit die Übersicht knapp bleibt". Das ist
eine dokumentierte Dichte-Entscheidung — die walze ich nicht eigenmächtig um.
**Vorschlag, der beides ehrt:** Punkt bleibt (knapp), bekommt aber bei den Aufmerksamkeits-
Zuständen (überfällig/fehlt) eine unterscheidende **Glyphe** (Lucide-Icon, Regel 5), sodass der
Zustand ohne Farbsehen und ohne Text-Spalte erkennbar ist. Umsetzung auf dein OK.

### V3 — Klartext statt technischer Fragmente in Leerzuständen  ✅ umgesetzt
Drehtermin-Kacheln zeigen „0 Karten" (`drehtermine.js:119`) — ein Zähl-Fragment. Bei null Karten
liest sich „noch keine Karten" als bewusster Zustand statt als Defekt (Regel 1: Klartext).
Kein Funktionswechsel, nur Wortwahl.

## Umsetzung (17.09.2026)

- V1: `board.js` — `kopf.title = p.satz` (Phasen-Satz als Header-Tooltip).
- V3: `drehtermine.js` — Kachel-Fuß: `0 Karten` → `noch keine Karten` (n===0-Fall).

## Stand

- [x] Board studiert (Screenshot + A11y-Baum + Code) — 17.09.2026
- [x] V1 Spaltenkopf-Tooltip
- [x] V3 Leerzustand-Klartext
- [ ] V2 Status-Glyphe — wartet auf Owner-OK (berührt dokumentierte Entscheidung)
- [x] Optische Abnahme V1/V3 (Screenshot) gegen `docs/ui-standard.md`
- [x] Commit + Push

## DoD

- V1: Hover über Spaltenkopf zeigt die Phasen-Erklärung; Kopfhöhe unverändert (Screenshot).
- V3: Drehtermin ohne Karten zeigt „noch keine Karten".
- Keine neue Funktion, keine entfernt, keine zusätzliche Dichte.
