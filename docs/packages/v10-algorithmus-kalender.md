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

## Stand (31.08.2026, v11 eingebaut)

- `lib/scheduler.js` — exportiert `generiereWoche`, `slotsForMonth`, `wochenIndexVonDatum`, `FORMAT_PLATTFORMEN`; slot.plattformen ist Schnittmenge aus Format-Plattformen und plan.plattformen; highlight als eigenständiger Slot-Typ entfernt
- `public/redaktionsplan.js` — Plattform-Auswahl-Sektion; PLAN_TYP_NAME-Map (Kurzformat-Video, Story / Highlight); plan.plattformen wird gespeichert; Tooltip zeigt plattformen-Array
- `public/nachschub.js` — slot.plattformen (Array) für Karten-Vorbelegung
- `plan.json` — enthält jetzt `plattformen: [...]`

## v11 Architektur (FORMAT_PLATTFORMEN)

| Format | Mögliche Plattformen | Zeitfenster-Logik |
|---|---|---|
| Kurzformat (reel) | IG, TK, YT, LI | Schnittmenge IG+LI optimiert; Fr/Sa 20:00 für TK wenn aktiv |
| Slider | IG, LI | Mi 12:00 (IG Carousel), Mi 16:00 (LI Peak) |
| Beitrag | IG, LI | Di/Do 11:00–17:00 |
| Story / Highlight | IG | Werktage 8:00 + Mo/Mi/Fr 19:00 |
| Langformat | YT, LI | Do/Di/Mi 15:00–17:00 |

highlight ist kein eigener Upload-Typ — wird aus Story erzeugt (Pinnin nach dem Posten).

---

## DoD

- [x] Kalender zeigt korrekte Tage (nicht um 1 verschoben) — Screenshot v11-04-kalender-echt.png
- [x] Hover-Tooltip zeigt Typ, Kategorie, Ziel, Uhrzeit, Plattformen (Array)
- [x] Einstellungen speichern → Kalender aktualisiert sich sofort
- [x] Monats-Navigation vor/zurück funktioniert
- [x] Ideen-KI erhält Scheduler-Slots (nicht mehr `plan.slots`)
- [x] Plattform-Auswahl sichtbar, Instagram + LinkedIn vorausgewählt
- [x] Story / Highlight als ein Typ, kein separates Highlight
- [x] Keine JS-Fehler im Browser (Edge headless CDP, 31.08.2026)
