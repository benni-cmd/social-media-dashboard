# v90 — Woche gegen den Redaktionsplan + Wochenstatistik

> Owner 01.10.2026: „Der Redaktionsplan pro Woche sollte erfüllt sein. Und in der Auswertung soll es
> immer eine Wochenstatistik geben (von Montag bis Sonntag, unabhängig von den Uploads)."

## PIG

**Problem:** Die Kopfzeile prüfte die Woche gegen eine feste 3 (`lib/pipeline.js` `MASSE.postsProWocheMin`),
nicht gegen den Redaktionsplan (aktuell 1 Reel/Woche) → Dauer-Fehlwarnung „2 statt der angestrebten 3".
Die Auswertung kannte nur 30-Tage-Fenster, keine Kalenderwochen.
**Intent:** Auf einen Blick sehen, ob die Woche den Plan erfüllt — und wie jede Woche lief.
**Goal:** Kopfzeile = Soll aus dem Plan je Format gegen terminierte Karten. Auswertung zeigt immer
8 Kalenderwochen (Mo–So): Plan erfüllt?, veröffentlicht, Reichweite, Views, Interaktionen.

## Regel

- **Soll einer Woche** = Plan-Slots Mo–So je Format (`slotsForMonth`, inkl. Max-Abstand und
  Frequenzen unter 1/Woche — 0,25 = jede 4. Woche ein Slot).
- **Ist** = nicht verworfene Karten mit Upload-Datum in der Woche, je Format.
- Erfüllt, wenn je Format Ist ≥ Soll. Sonst nennt die Kopfzeile, was fehlt: „es fehlt 1× Reel".
- Bis der Plan geladen ist (Drive, einige Sekunden nach Start), gilt die alte Faustregel.
- **Wochenstatistik**: Konto-Werte je Woche über einen Zeitraum-Aufruf (`total_value`, Reichweite
  entdupliziert — Tageswerte werden nicht summiert). Veröffentlicht = Instagram-Medien + LinkedIn-Posts
  nach Zeitstempel. Ohne Instagram stehen die Wochen trotzdem da, Werte „—".

## Gebaut

1. `lib/uploadslots.js`: `wocheGegenPlan`, `wochenlastNachPlan`, `montagVon`, `plusTage`, `planSlotsZwischen`.
2. `public/store.js`: `S.plan` (gesetzt von `ladePlan`); `public/app.js` lädt den Plan nach dem Start im Hintergrund;
   `public/redaktionsplan.js` setzt `S.plan` beim Speichern.
3. `public/board.js`: Kopfzeile nutzt `wochenlastNachPlan`, sobald `S.plan` da ist.
4. `lib/social.js`: `instagramWochen()` (8 Wochen parallel), Feld `wochen` in `/api/stats/instagram`.
5. `public/auswertung.js` + `style.css`: Block „Wochenstatistik" direkt unter den Kennzahlen.

## Stand

01.10.2026 — gebaut und belegt.
- Node: `wocheGegenPlan` mit echtem `data/plan.json` + `data/board.json` → KW 40 Soll {reel:1}, Ist {reel:1, story:1}, erfüllt.
- Live-API: `instagramWochen` lieferte 8 Wochen mit echten Werten (z. B. KW 38: Reichweite 4, Views 32, Interaktionen 2).
- Browser-Kopie :4399: Kopfzeile „Redaktionsplan diese Woche erfuellt (Plan 1, terminiert 2)."; Tabelle KW 40–33 mit
  Plan-Spalte (✓ 2/1 … ⚠ 0/1 rot), Screenshot geprüft.

## DoD

- [x] Kopfzeile misst gegen den Plan je Format
- [x] Wochenstatistik immer sichtbar, Mo–So, laufende Woche markiert
- [x] Live-Werte von Instagram, ehrliches „—" ohne Verbindung
- [ ] LinkedIn-Konto-Werte je Woche (LinkedIn liefert Reichweite/Views nur mit Community-Management-Freigabe — aktuell nicht verbunden)
