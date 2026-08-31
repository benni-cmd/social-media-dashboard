# v10 — Deterministischer Algorithmus & Kalender-Vorschau

## PIG

**Problem:** Die KI-generierten Upload-Slots (v9) laufen jeweils nur 4 Wochen weit und kosten pro Generierung eine KI-Anfrage; der Kalender fehlt komplett.

**Intent:** Einen deterministischen Algorithmus einbauen, der aus den Plan-Parametern eine unbegrenzte, stabile Slot-Folge erzeugt — ohne KI, ohne Ablaufdatum, ohne Speichern einzelner Slots.

**Goal:** Im Redaktionsplan-Panel gibt es eine Monatsansicht, die algorithmisch erzeugte Upload-Slots zeigt (farbcodiert nach Typ, Hover-Tooltip mit Metadaten). Parameter-Änderung + Speichern aktualisiert die Vorschau sofort.

---

## Plan

1. [x] Forschung — optimale Posting-Zeiten für Instagram, TikTok, YouTube Shorts, LinkedIn (2026-Datensätze).
2. [x] `lib/scheduler.js` — deterministischer Scheduler (Bresenham-Verteilung, Zeitfenster, Kategorie/Ziel-Rotation).
3. [x] `public/redaktionsplan.js` — Slot-Abschnitt durch Monats-Kalender ersetzen (Legende, Grid, Tooltip).
4. [x] `public/nachschub.js` — `ladeOffeneSlots()` auf Scheduler umstellen statt `plan.slots`.
5. [ ] UI-Abnahme im Browser gegen Monatsansicht (Screenshot erforderlich).

---

## Algorithmus-Entscheidungen

### Zeitfenster (hardcoded, Klasse B)

| Typ | Optimal | Quelle |
|---|---|---|
| Reel | Do 9:00, Mi 18:00, Di 7:00 (IG); Fr/Sa 20:00 (TK); Di 14:00 (YT) | Buffer 9,6M + Sprout ~2B + FlowShorts 24K |
| Slider | Mi 12:00, Do 9:00 (IG); Mi 16:00, Di 10:00 (LI) | Buffer 9,6M + Kanbox 4,8M |
| Beitrag | Di 11:00, Do 18:00 (IG); Di 15:00, Do 16:00 (LI) | Buffer 9,6M |
| Story | Mo–Fr 8:00 + Mo/Mi/Fr 19:00 (IG) — Timing weniger kritisch | Buffer/Later 6M |
| Highlight | Mo/Mi/Fr 10:00 (IG) — max 1/Woche | Aufwands-Einschränkung |

### Bresenham-Verteilung

Jede Woche: `anzahl[typ] = round(anteil * ppw * (wi+1)) - round(anteil * ppw * wi)`. Über viele Wochen konvergiert die Verteilung exakt zum gewünschten Anteil; einzelne Wochen weichen um ±1 ab. Budget-Deckel bei `postsProWoche` Gesamt und Typ-Maximum.

### Epochen-Anker

2024-01-01 (UTC, Montag). Alle Wochenindizes relativ dazu. UTC-basierte Datumsberechnung, nicht lokale Zeit — schützt vor Zeitzonenfehlern.

### Kategorie- und Ziel-Rotation

Kategorien: Prio-gewichtet (Prio 1 = n Einträge, Prio 2 = n-1, ...), rotierend über einen globalen Slot-Zähler. Ziele: proportional zu `gewicht`, normiert auf 20 Schritte, gleiche Rotation.

---

## Stand (31.08.2026)

- `lib/scheduler.js` — angelegt, exportiert `generiereWoche`, `slotsForMonth`, `wochenIndexVonDatum`
- `public/redaktionsplan.js` — Kalender-Vorschau eingebaut; Einstellungen bleiben; KI-Slot-Generierung entfernt
- `public/nachschub.js` — `ladeOffeneSlots` nutzt jetzt Scheduler, nicht mehr `plan.slots`
- `plan.json` — `slots`-Feld wird nicht mehr geschrieben (vorhandene Daten ignoriert, nicht gelöscht)

---

## DoD

- [ ] Kalender zeigt korrekte Tage (nicht um 1 verschoben) — Screenshot
- [ ] Hover-Tooltip zeigt Typ, Kategorie, Ziel, Uhrzeit, Plattform
- [ ] Einstellungen speichern → Kalender aktualisiert sich sofort
- [ ] Monats-Navigation vor/zurück funktioniert
- [ ] Ideen-KI erhält Scheduler-Slots (nicht mehr `plan.slots`)

**Offen:** UI-Abnahme im Browser (Screenshot) — Blocker bis Fertig-Meldung.
