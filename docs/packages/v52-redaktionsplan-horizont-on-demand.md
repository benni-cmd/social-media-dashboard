# v52 — „Kein freier Slot": detail.js liest die falsche Slot-Quelle

## PIG

**Problem:** Beim Zuweisen eines Upload-Termins meldet die Karte „Kein freier Slot — Erstelle
Slots im Redaktionsplan", obwohl der Plan endlos Slots erzeugen soll.

**Intent:** Es gibt immer einen nächsten freien Termin; der Nutzer muss nie manuell Slots anlegen.

**Goal:** Die Termin-Kachel der Karte zeigt zuverlässig das nächste freie Datum, mit einem
Vorausblick von ~1 Jahr statt 2 Monaten.

## Bestandsaufnahme (empirisch belegt, 17.09.2026)

- **Grundwahrheit:** Live `GET /api/plan` liefert `slots: 0` (curl gegen :4321), `quelle: drive`.
  Der Server schickt die Config, NICHT die Slots — `config.slots` ist leer (`data/plan.json`
  ebenso: 0 Slots).
- **Design:** Die Slots werden **client-seitig** aus der Config gerechnet, per
  `slotsForMonth(plan, year, month)` (`lib/scheduler.js`). So machen es `store.js:530–533`,
  `redaktionsplan.js`, `nachschub.js`. `berechneHorizontSlots` liefert mit der echten Config
  8 Slots (Node-Test) — die Generierung funktioniert.
- **Der Bug:** `detail.js:636` liest `(plan.slots || [])` — also den **leeren** Server-Wert —
  statt die Slots wie alle anderen client-seitig zu rechnen. Ergebnis: immer „Kein freier Slot".
- **Nebenbefund:** `store.js:530` blickt nur `delta < 2` Monate voraus („nächste zwei Monate").
  Betrifft schwebende Karten — separates, kleineres Thema, nicht in diesem Paket.

## Umsetzung (nur `public/detail.js`, kollisionsfrei — Datei ist clean)

1. Import `slotsForMonth` (scheduler) + `naechsteFreieSlots` (pipeline).
2. Termin-Kachel: Slots client-seitig über **12 Monate** rechnen (wie store.js), Belegung aus den
   Upload-Daten der anderen Karten (`datum|uhrzeit`), frühesten freien nehmen.
3. Den toten `slotBelegen(naechster.id, …)`-Aufruf entfernen (client-seitige Slots haben keine
   id; die Belegung entsteht dadurch, dass die Karte das Upload-Datum trägt — `store.js`-Modell).
4. Fallback-Meldung ehrlich: „Kein freier Termin im nächsten Jahr" statt „Erstelle Slots".

## Stand

- [x] Schritt 0: Slot-Lieferweg empirisch getract (curl slots:0, Node-Test 8 Slots, slotsForMonth-Muster)
- [x] detail.js Termin-Kachel auf client-seitige Berechnung (12 Monate)
- [x] toten slotBelegen-Aufruf + unbenutzten Import raus; Meldung „Kein freier Termin / im naechsten Jahr alles belegt"
- [x] Verify: `node --check` grün; Live-Logikbeleg gegen echte Config (Browser, dynamischer Import):
      serverSlots=0 (alter Weg) → neuer Weg rohSlots12Mon=52, freieZukunft=49, erster freier Termin
      25.09.2026 20:00. Optische Screenshot-Abnahme blockiert (App-Fenster im Hintergrund, Pane
      zeichnet nicht) — per DOM/Logik gegengeprueft; Screenshot nachholbar, wenn Fenster vorn ist.
- [x] Commit + Push

## NICHT in diesem Paket

- „Super lange laden" = Drive-gebundene `/api/plan`-Ladung (20 s Timeout) → v51-Feedback/Entkopplung.
- `store.js`-2-Monats-Fenster für schwebende Karten (delta<2) → separater kleiner Fix, v51-heiße Datei.

## DoD

- Karte mit ausgefülltem Thema zeigt in der Termin-Kachel ein konkretes nächstes freies Datum
  (Live-Beleg), kein „Kein freier Slot"-Deckel mehr, solange < 1 Jahr voll.
- Klick auf die Kachel setzt das Upload-Datum; die Karte belegt den Termin (schwebende Karten
  rutschen korrekt nach).
