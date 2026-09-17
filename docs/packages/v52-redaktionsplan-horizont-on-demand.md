# v52 — Redaktionsplan-Horizont: on-demand statt 8-Wochen-Deckel

> PLAN-Paket, angelegt 17.09.2026. **Bau erst, wenn `server.js`/`lib/ai.js` der Session
> „KI-Fortschritt Audit" committet sind** (Weg A, Owner 17.09.2026) — sonst Kollision.

## PIG

**Problem:** Beim Zuweisen eines Upload-Termins meldet die Karte „Kein freier Slot — Erstelle
Slots im Redaktionsplan", obwohl der Redaktionsplan ein deterministisches Skript ist, das Slots
selbst erzeugen soll. Ursache belegt: `HORIZONT_WOCHEN = 8` (`planstore.js:22`) — der Plan
materialisiert nur 8 Wochen; sind die belegt (bei ~23 Karten schnell erreicht), gibt es keinen
freien. Zusätzlich rollt `abgleiche()` (`planstore.js:105–121`) bei gleichem Fingerabdruck NICHT
mit dem Datum mit — es gibt die gespeicherten Slots zurück, deren Zukunft mit der Zeit schrumpft.

**Intent:** Der Plan soll sich anfühlen wie „endlos": es gibt immer einen nächsten freien Slot;
der Nutzer muss nie manuell Slots anlegen.

**Goal:** Der Horizont wächst **on-demand bis zu einer 52-Wochen-Kappe** — es werden so lange
freie Zukunfts-Slots erzeugt, bis ein sinnvoller Puffer da ist, ohne bestehende Slots/Belegungen
anzutasten. Die irreführende „Erstelle Slots"-Meldung entfällt/entschärft sich.

## OFFEN vor dem Bau — Slot-Lieferweg sicher tracen (Schritt 0, Pflicht)

Vor jedem Edit lückenlos klären (ich verstehe es noch NICHT vollständig, deshalb kein Blind-Fix):
- Wie kommt `config.slots` zum Client? `/api/plan GET` gibt `{...config}` zurück, benutzt
  `abgleiche().slots` NICHT sichtbar (`server.js:498–518`); `defaultPlan().slots` existiert als Feld.
- Zwei Belegungs-Modelle: Slot-`karteId` (Detail-Weg, `server.js:/api/plan/slot`) vs. `datum|uhrzeit`
  (schwebende Karten, `store.js:535–548`, `pipeline.js:499 naechsteFreieSlots`).
- Zwei Speicher: Drive-Slots-Datei (`SLOTS_PFAD`, aus `abgleiche`) vs. `data/plan.json` (Cache,
  bekommt die `karteId`-Belegungen).
- Rollt der zurückgegebene Slot-Satz mit dem heutigen Datum? (Fingerabdruck ist datum-unabhängig.)

## Plan (nach Schritt 0)

1. On-Demand-Wachstum: additive Erweiterung um freie Zukunfts-Slots bis Puffer erreicht / 52 Wochen —
   bestehende Slots + `karteId` unverändert lassen (nur anhängen, Match per `datum|uhrzeit`,
   neue Slots bekommen eine `id`).
2. Roll-forward: sicherstellen, dass der zurückgegebene Satz immer ab heute freie Slots enthält.
3. Meldungen anpassen: „in den nächsten zwei Monaten" / „Erstelle Slots im Redaktionsplan"
   (`detail.js:730,649`, `store.js:547`) an die neue Realität (bis ~1 Jahr) — Frontend, mit der
   aktiven Session abstimmen.
4. Verify: reine Funktion in Node testen (voller 8-Wochen-Plan, alle belegt → es erscheinen freie
   Zukunfts-Slots > Woche 8; Kappe bei 52 greift). `node --check`. Danach Live-Screenshot der Karte.

## NICHT in diesem Paket

- „Super lange laden" beim Termin-Vorschlag = Drive-gebundene `/api/plan`-Ladung (20 s Timeout,
  `planstore.js:69`). Gehört zum v51-Feedback/Entkopplungs-Paket, nicht hierher.

## Stand

- [x] Ursache diagnostiziert (8-Wochen-Horizont, kein Roll-forward, Drive-Ladezeit) — 17.09.2026
- [ ] Schritt 0: Slot-Lieferweg sicher getract
- [ ] On-Demand-Wachstum + Roll-forward
- [ ] Meldungen angepasst (Frontend, abgestimmt)
- [ ] Verify (Node-Funktion + node --check + Screenshot)
- [ ] Commit + Push

## DoD

- Ein Termin-Vorschlag findet immer einen freien Slot, solange < 52 Wochen voll — kein „Erstelle
  Slots im Redaktionsplan"-Deckel mehr.
- Bestehende Belegungen bleiben erhalten (Node-Beleg).
- Kappe bei 52 Wochen greift (keine Endlosschleife).
