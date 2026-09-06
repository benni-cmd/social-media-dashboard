# v35 — Projekt an der Karte + Projekt-Filter im Board

## PIG

**Problem:** Seit v33 gibt es Projekte in den Einstellungen, aber keine Verbindung zum Board.
Beim KI-Aufruf gehen deshalb ALLE aktiven Projekte in den Prompt (`lib/kontextstore.js`,
`sammle()` ohne `projektId`) — auch die, die mit der Karte nichts zu tun haben. Und im Board ist
nicht zu sehen, zu welchem Projekt eine Karte gehoert.

**Intent:** Eine Karte weiss, zu welchem Projekt sie gehoert. Daraus folgt beides: der richtige
Kontext im Prompt, und ein Board, das sich auf ein Projekt einengen laesst.

**Goal:**
1. Jede Karte hat ein Feld **Projekt** (Auswahl aus den in den Einstellungen angelegten, plus
   „keins"). Ist es gesetzt, geht beim KI-Aufruf genau dieses Projekt in den Prompt statt aller
   aktiven.
2. In der Kopfzeile des Boards ein **Projekt-Filter** („Alle Projekte" / je Projekt). Er blendet
   Karten anderer Projekte aus — Board, Wochenlast und Drehleiste folgen ihm.

---

## Bestandsaufnahme (gemessen 06.09.2026)

- `data/board.json`: 17 Karten. Keine hat heute ein Projekt-Feld — das Feld ist neu und beginnt
  ueberall leer. Kein Migrationsproblem.
- `lib/pipeline.js` `migriere(card)` ist die Stelle, an der Karten-Felder ihren Standard
  bekommen; ein neues Feld gehoert dorthin (`normalisiere`).
- `lib/kontextstore.js` `sammle({serie, projektId})` kann bereits ein einzelnes Projekt waehlen
  — die Uebergabe fehlt nur.
- `server.js` reicht beim KI-Aufruf schon `serie` durch (v34); `projektId` kommt daneben.
- `public/board.js` `zeichneBoard()` filtert Karten heute nur nach Spalte
  (`S.cards.filter((c) => c.column === p.id)`) — der Filter setzt genau dort an.

## Design-Entscheidungen

- **Das Feld heisst `projektId` und steht auf der Karte**, nicht auf der Reihe. Reihen gibt es
  nur bei 3 von 17 Karten (gemessen) — als Traeger waeren sie heute zu duenn. Der Weg ueber die
  Reihe (Vorschlag B) bleibt spaeter moeglich und wuerde dieses Feld nur vorbelegen.
- **Leer heisst „alle aktiven Projekte"** — genau das heutige Verhalten. Wer nichts setzt,
  merkt von der Aenderung nichts.
- **Der Filter lebt in `S.projektFilter`, nicht in der URL.** Er ist eine Arbeitseinstellung,
  kein Zustand, den man teilen will; `localStorage` merkt ihn ueber Neustarts hinweg.
- **Ein leeres Board darf nicht wie ein kaputtes aussehen.** Filtert der Nutzer auf ein Projekt
  ohne Karten, sagt der Leerzustand das ausdruecklich („kein Treffer in diesem Projekt"), statt
  die uebliche „Zieh eine Karte her"-Meldung zu zeigen.
- **Karten ohne Projekt sind in JEDEM Filter sichtbar.** Sonst verschwinden alle 17 bestehenden
  Karten beim ersten Filterklick, und das Board wirkt leer. Sie erscheinen mit dem Hinweis
  „ohne Projekt".

## Plan

- **v35-1 — Feld:** `lib/pipeline.js` (`normalisiere`: `projektId: ""`), Auswahlfeld in
  `public/detail.js` bei den uebrigen Karten-Eigenschaften; die Projektliste kommt ueber
  `GET /api/kontext`.
- **v35-2 — Prompt:** `server.js` gibt `projektId` der Karte an `unternehmen.sammle()`.
- **v35-3 — Filter:** `S.projektFilter` in `public/store.js`, Auswahl in der Kopfzeile
  (`public/index.html` + `public/app.js`), Filterung in `public/board.js`.
- **v35-4 — Verify:** Screenshot mit gesetztem Filter, echter KI-Lauf mit zwei Projekten, bei
  dem nachweislich nur das gewaehlte im Prompt landet.

## Stand

- (wird beim Abschluss nachgefuehrt)

## DoD

- [ ] Karte hat ein Projekt-Feld; gesetzt und gespeichert, ueberlebt Neuladen
- [ ] KI-Lauf mit zwei angelegten Projekten: nur das an der Karte gesetzte steht im Prompt
      (belegt ueber `GET /api/kontext/probe?projekt=…` und einen echten Lauf)
- [ ] Filter blendet Karten anderer Projekte aus; Karten ohne Projekt bleiben sichtbar
- [ ] Gefiltertes leeres Board sagt, dass gefiltert wird
- [ ] `node --check` gruen, Screenshot Board mit und ohne Filter
