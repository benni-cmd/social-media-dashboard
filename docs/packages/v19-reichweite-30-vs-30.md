# Arbeitspaket v19 — Konto-Reichweite: 30 Tage vs. die 30 davor

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 02.09.2026.

**Problem:** Die Konto-Reichweite in Tabelle 2 (`kanal-verlauf.csv`) und auf der Auswertung
war ein **Tageswert** (`period=day`) — im Live-Test „reichweite_konto=1", weil nur der heutige
Tag gemessen wurde. Kein aussagekräftiger Verlauf, kein Vergleich.

**Intent:** Reichweite (und Views) als **letzte 30 Tage vs. die 30 Tage davor** erfassen, damit
man auf einen Blick sieht, ob die Reichweite wächst oder fällt. Reichweite je Fenster
entdupliziert (Meta `total_value` über `since`/`until`), NICHT Tageswerte summiert.

**Goal:**
- `lib/social.js`: Helfer `instagramFenster30(igUserId, tok)` → zwei Fenster (jetzt / davor)
  je für `reach` und `views`.
- Tabelle 2 speichert `reichweite_30t`, `reichweite_30t_davor`, `reichweite_delta_pct`,
  `views_30t`, `views_30t_davor` statt der Tageswerte.
- Auswertung-Seite: KPI-Kachel „Reichweite · 30 Tage" mit Trend-Pfeil (+/− % ggü. den 30
  davor) — nutzt den bisher toten `trend`-Parameter von `kpiKarte`.
- Ehrlichkeit: fehlt ein Fenster (API-Limit, junges Konto), bleibt die Zelle leer.

---

## Plan

1. [x] `instagramFenster30` in `social.js` (zwei `since`/`until`-Aufrufe, entdupliziert).
2. [x] In `instagramKonto` (Sammler) → Tabelle 2 neue Spalten.
3. [x] In `instagramZahlen` (Seite) → `reichweite30` im Rückgabewert.
4. [x] `kanal-kpi.js`: `VERLAUF_SPALTEN` + `verlaufZeile` (mit `deltaPct`) + Backfill.
5. [x] `auswertung.js`: KPI-Kachel „Reichweite · 30 Tage" mit Trend; LIESMICH + `drive-convention.md`.
6. [x] Alte Test-`kanal-verlauf.csv` entfernt; Live-Verify durchgeführt.

---

## Stand

02.09.2026 — Angelegt. Basis: v17 (Tabellen) + v18 (Umbau) stehen. Instagram-Token verbunden
(99 Follower), LinkedIn weiter im Review. `kpiKarte(zeichen,label,wert,satz,trend)` hat den
`trend`-Parameter bereits, wird bisher nirgends gefüttert.

---

02.09.2026 — Gebaut und live abgenommen. Unit-Test `test-v19.mjs` grün (11 Spalten, Delta
50,0/−50,0, leer ohne Vergleich). Server-Start schrieb `kanal-verlauf.csv` neu:
`Instagram;2026-09-02;99;;;356;1102;-67,7;506;1698;21` — Reichweite 30 T. 356 vs. 1102
davor (−67,7 %), Views 506 vs. 1698. Screenshot (Edge headless): KPI-Kachel „Reichweite ·
30 Tage 356" mit rotem Trend „−68 % ggü. 30 T. davor", 5 Kacheln, keine Konsolen-Fehler.

## Definition of Done

Geprueft gegen: `node --check` (4 Module) · Unit-Test `test-v19.mjs` · echter Edge-headless-
Screenshot der KPI-Kachel mit Trend · Live-`kanal-verlauf.csv` mit den 30-Tage-Spalten und
echten Werten.
Offen: LinkedIn-30-Tage-Fenster analog, sobald die API freigeschaltet ist (Share-Statistik
`timeIntervals`); optional die Konto-Views ebenfalls als Trend-Kachel.
