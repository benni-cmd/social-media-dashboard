# v17 — Drive als einzige Wahrheit (Board = Darstellung)

## PIG

**Problem:** Heute ist `board.json` (Version 187, 17 Karten) die Wahrheit; Drive ist nur ein
Teil-Spiegel. Die reichen Karten-Felder (Hook, CTA, Frame, Caption, Video-Checks, KPI, KI-Texte)
liegen NUR in `board.json` — die `projekt.json` im Ordner hält nur einen Bruchteil
(`lib/projects.js:22`). Die Spalten sind hart codiert (`lib/pipeline.js:15` PHASEN) mit fixen
Ordnernamen; ein Kommentar sagt sogar explizit „Umbenennen würde die Struktur zerreissen".
Der Redaktionsplan lebt lokal in `data/plan.json`. Damit ist Drive nicht die Wahrheit, sondern
eine Kopie, die veralten kann.

**Intent:** Google Drive wird die **einzige Wahrheit**. Das Board ist nur noch eine Darstellung
dessen, was in Drive liegt: Karten sind echte Ordner, alle Metadaten kommen aus Drive, Spalten
sind Drive-Ordner (beidseitig umbenennbar), und auch Redaktionsplan und Auswertung speisen sich
aus Drive. `board.json` bleibt nur noch als schneller Cache; bei Konflikt gewinnt Drive.
[Owner, 02.09.2026, vier Weichen bestätigt]

**Goal:** Nach dem Umbau gilt für JEDE angezeigte Angabe: sie stammt aus Drive und lässt sich
dort nachlesen. Eine Spalte hier umbenennen benennt den Drive-Ordner mit; ein in Drive von Hand
umbenannter Ordner erscheint beim nächsten Abgleich unter dem neuen Namen. Eine neue Idee landet
erst in Drive, wenn sie im Swipe-Popup nach rechts bestätigt wurde. Der Redaktionsplan schreibt
sein Ergebnis nach Drive und rechnet es beim Laden aus den in Drive liegenden Stellschrauben neu.
UI-Abnahme je UI-Paket per Screenshot besteht.

---

## Weichen (Owner 02.09.2026, alle bestätigt)

1. **Metadaten-Ort:** `projekt.json` = die **ganze** Karte (ein Wahrheitspunkt pro Ordner).
   Skript/Caption zusätzlich als lesbare Textdateien (abgeleitete Kopien).
2. **Spalten:** **Anzeigename frei, Logik-ID fest.** Interne Phasen-ID (trägt Tore/Termine/KPI)
   bleibt stabil; der Drive-Ordnername ist der beidseitig synchrone Anzeigename. Ein fremder
   Drive-Ordner erscheint als schlichte Spalte ohne Tore.
3. **Tempo:** `board.json` als **Cache**, Drive führt beim **Abgleich**. Kein Live-Polling.
4. **Redaktionsplan:** **Stellschrauben in Drive**, Ergebnis vom Skript neu gerechnet und nach
   Drive geschrieben; Board merkt sich nichts lokal.

---

## Design-Entscheidungen

### Datenmodell in Drive
```
<Root>/
  System (AI only)/            ← Maschinen-Ablage (reine KI-/Maschinen-Dateien)
    spalten.json               ← [{ id, name, ordner, order, system:true|false }]  (Spalten-Wahrheit)
    redaktionsplan.json        ← Stellschrauben (kadenz, typenmix, kategorienFokus, zielgewichte, kampagnen)
    redaktionsplan.slots.json  ← zuletzt berechnetes Ergebnis (Slots) — vom Skript geschrieben
  <Spalten-Ordner>/            ← z.B. "In Bearbeitung/Idee" (Name = Anzeigename, editierbar)
    .phase                     ← verstecktes Marker-Dotfile mit der stabilen Phasen-ID (Plumbing)
    <Projektordner pro Karte>/
      (AI only)/               ← reine Maschinen-Dateien der Karte
        projekt.json           ← DIE GANZE KARTE (Wahrheit)
      Skript und Caption/      ← menschlich lesbare/editierbare Dateien (10_skript.txt, 30_caption.md, …)
      Rohmaterial/
      Fertiges Video/
```
- `projekt.json` trägt ab jetzt die vollständige Karte (heutiges `leereKarte`-Schema, `pipeline.js:486`),
  nicht mehr den Auszug aus `projects.js:22`. `schema`/`id` bleiben enthalten.
- **NICHT nach Drive:** Zugänge/Geheimnisse bleiben lokal — `data/tokens.json` (OAuth-Token),
  `data/.gdrive-env.json`, TLS-`localhost.key/.crt`. Das sind Maschinen-Secrets, kein Content.

### (AI only)-Konvention [Owner, 02.09.2026]
- **Regel:** KI-/Maschinen-Dateien und menschlich lesbare Dateien liegen nie im selben Ordner.
  Jeder Ordner, der NUR Maschinen-Dateien enthält, trägt das Namens-Suffix **`(AI only)`**, damit
  ein Mensch beim Bearbeiten sofort sieht, was er ignorieren kann.
- **Reine Maschinen-Dateien (→ `(AI only)`):** `projekt.json` (Karten-Wahrheit) und der Root-Store
  `System (AI only)/` (Spalten- und Redaktionsplan-Dateien).
- **Menschlich (bleiben ohne Suffix):** `Skript und Caption/` (Skript, Caption, Recherche, Regieplan),
  `Rohmaterial/`, `Fertiges Video/`, `Kontext/` (vom Menschen verfasst, nur von der KI gelesen).
- Namens-Konstanten in `lib/pipeline.js`: `AI_ORDNER = "(AI only)"`, `SYSTEM_ORDNER = "System (AI only)"`.
  Beide sind `pfadstueckOk`-konform (Klammern/Leerzeichen erlaubt, kein Slash, kein Punkt-Ordner).
- **Phasen-Identität:** das `.phase`-Dotfile ist verstecktes Plumbing (ein ID-Marker, keine
  „AI-Datei"), bleibt darum im Spaltenordner. **Annahme (bei Review bestätigen):** das reicht;
  falls strengere Trennung gewünscht, wandert der Marker in einen `(AI only)`-Unterordner je Spalte.

### Spalten aus Drive (beidseitig)
- **Wahrheit** ist `.board/spalten.json` (beim Erststart aus PHASEN geseedet). PHASEN in
  `pipeline.js` wird zum **Default/Seed**, nicht mehr zur laufenden Wahrheit.
- **Identität über Umbenennen:** jede Spalte hat eine stabile `id`; im Spaltenordner liegt `.phase`
  mit dieser id. Der Abgleich ordnet Ordner den Spalten über die Markerdatei zu — NICHT über den
  Namen. So übersteht ein Hand-Rename in Drive die Zuordnung, und der Anzeigename zieht ins Board.
- **Umbenennen im Board** → `.board/spalten.json` aktualisieren + Drive-Ordner via `drive.moveDir`
  server-seitig umbenennen (Google Drive: nativer Rename, kein Re-Upload).
- **Fremder Ordner** (kein `.phase`) → neue Spalte mit generierter id, `system:false`, keine Tore.
- Logik (`tore()`, `TERMINE`, KPI in `pipeline.js`) bleibt an der stabilen id — überlebt Renames.
- **Annahme (bei Review bestätigen):** die sieben System-Phasen (idee … verworfen) bleiben nicht
  löschbar; nur ihr Anzeigename ist editierbar. Fremde Spalten sind frei löschbar/umbenennbar.

### Tempo: Cache + Abgleich
- `GET /api/board` liefert weiter sofort den Cache (`board.json`). Ein **Abgleich** (erweitertes
  `/api/drive/reconcile`) liest Drive, Drive gewinnt bei Konflikt, schreibt den Cache neu.
- Abgleich läuft: (a) beim Board-Öffnen einmal im Hintergrund, (b) auf „Aktualisieren"-Knopf.
- **Schreiben:** jede Karten-Mutation schreibt Drive (`projekt.json`) als Wahrheit UND den Cache.
  **Annahme (bei Review bestätigen):** optimistisch — Cache sofort, Drive-Schreiben in einer
  serialisierten Warteschlange (rclone ist ohnehin seriell, `drive.js:209`); scheitert Drive,
  meldet die Oberfläche einen Befund und der nächste Abgleich heilt.
- Kosten offen benannt: Abgleich = 1 rclone-`lsf` je Spalte + 1 `cat projekt.json` je Karte,
  seriell. Bei heutigen 17 Karten unkritisch; wächst linear. Darum Abgleich auf Abruf, kein Poll.

### Ideen-Swipe (neu)
- Popup mittig: eine KI-generierte Idee als Karte (Titel groß, darunter 2–3 Sätze aus `warum`).
- **Links = Dislike:** Titel in eine **Sitzungs-Ablehnliste** (fließt in den Prompt, kein Wiederholen)
  → nächste Idee generieren. **Rechts = Like:** Karte in Phase `idee` anlegen UND sofort den
  Drive-Ordner mit voller `projekt.json` erzeugen (`projekte.anlegen`).
- Nur „Like" schreibt nach Drive. Baut auf vorhandenem `holeIdee`/`kiStream` (`public/nachschub.js:38`),
  ersetzt das ungefragte `S.cards.push`.
- **Annahme (bei Review bestätigen):** Dislikes sind sitzungslokal (kein Verworfen-Ordner in Drive
  für bloße Dislikes); die bestehende `verworfen`-Spalte bleibt für echte, angelegte Karten.

### Redaktionsplan (Sonderfall)
- **Stellschrauben** (kadenz/typenmix/kategorienFokus/zielgewichte/kampagnen) → `.board/redaktionsplan.json`
  in Drive (= Wahrheit für Eingaben). `data/plan.json` wird nur noch Cache.
- `lib/scheduler.js` rechnet die Slots **deterministisch** aus der Config.
- Beim Laden: Config aus Drive lesen → Slots neu rechnen → mit `redaktionsplan.slots.json`
  vergleichen. Weichen sie ab, gewinnt das Skript → Drive-Ergebnis neu schreiben, Befund melden
  („Der gespeicherte Plan war veraltet, neu gerechnet."). Board hält KEINEN Plan-Zustand lokal.
- **Umsetzung v17d (gebaut):** `lib/planstore.js` — Config-Datei + Ergebnis-Datei in `System (AI only)/`,
  Abgleich über einen **Fingerabdruck der Stellschrauben** (nicht über die datierten Slots, sonst
  täglicher Leerlauf), Horizont 8 Wochen. `server.js` `/api/plan` GET/PUT: Drive = Wahrheit,
  `data/plan.json` nur Cache, fehlertolerant (Drive weg → Cache + Hinweis, kippt nie).
- **Altlast (offen, mit v17c neu gedacht):** `/api/plan/slot` (Slot↔Karte-Zuordnung) schreibt nur
  in den Cache; die berechneten Slots haben keine stabilen IDs, die Zuordnung ist seit je fragil.
  In v17d bewusst NICHT geheilt, um keine Regression im Idee-/Slot-Fluss zu bauen.

---

## Phasen (Arbeitspakete)

- **v17a — Vollkarte-`projekt.json` in `(AI only)/` + Cache-Rolle** (`lib/pipeline.js`, `lib/projects.js`,
  `server.js`): `AI_ORDNER`/`SYSTEM_ORDNER` einführen; `projektJson` schreibt die ganze Karte nach
  `<Karte>/(AI only)/projekt.json`; `scan`/`abgleich` lesen die volle Karte (Fallback auf Alt-Ort im
  Ordnerwurzel für Migration); Backfill für die 17 vorhandenen Ordner; `board.json` als Cache
  dokumentiert. Ohne UI. Sofort baubar.
- **v17b — Spalten aus Drive** (`.board/spalten.json`, `.phase`-Marker, `lib/pipeline.js` PHASEN→Seed,
  `lib/projects.js` Abgleich per Marker, `server.js` Spalten-API, `public/board.js` editierbarer
  Kopf): beidseitige Umbenennung, fremde Ordner als schlichte Spalte. Screenshot-Abnahme.
- **v17c — Ideen-Swipe-Popup** (`public/nachschub.js`, `public/ui.js`, `style.css`): mittiges Popup,
  eine Idee, links/rechts, Like→Drive-Ordner, Ablehnliste. Screenshot-Abnahme.
- **v17d — Redaktionsplan in Drive** (`.board/redaktionsplan*.json`, `lib/scheduler.js`, `server.js`
  `/api/plan`, `public/redaktionsplan.js`): Config in Drive, Ergebnis neu gerechnet + abgeglichen.
- **v17e — Auswertung aus Drive** — **abgegeben an die Parallel-Session** (deren Paket
  `docs/packages/v18-auswertung-umbau.md`, 02.09.2026). Nicht mehr in dieser Spur, um doppelte
  Arbeit an `public/auswertung.js`/`lib/kpi.js` zu vermeiden. Anforderung bleibt: Metriken/KPI aus
  der Drive-`projekt.json`, Token lokal — an die v18-Session weitergegeben.

Reihenfolge zwingend: v17a legt das Schema, auf dem b–d stehen. v17b vor c (Swipe legt in eine
Spalte). v17d konnte parallel (erledigt).

---

## Plan (v17a zuerst)

1. [ ] `lib/pipeline.js` — `AI_ORDNER = "(AI only)"`, `SYSTEM_ORDNER = "System (AI only)"`, Helfer
   `projektJsonPfad(basis)` = `${basis}/${AI_ORDNER}/projekt.json`.
2. [ ] `lib/projects.js` — `projektJson(card)` = ganze Karte; `leseProjektJson` liest aus `(AI only)/`
   mit Fallback auf Alt-Ort in der Ordnerwurzel; `abgleich`/`scan` bauen Karten aus der vollen
   `projekt.json` (via `migriere`) statt aus Feld-Auszug; `anlegen`/`verschiebe` legen `(AI only)/` an
   und schreiben die volle `projekt.json` dorthin.
3. [ ] Backfill-Lauf: für jede vorhandene Karte die volle `projekt.json` nach `(AI only)/` schreiben
   (einmalig über den erweiterten Abgleich); Alt-`projekt.json` in der Wurzel wird ersetzt/aufgeräumt.
4. [ ] `server.js` — Kommentar/Rollen: `board.json` = Cache; Abgleich schreibt den Cache aus Drive.
5. [ ] v17b — `System (AI only)/spalten.json` + `.phase`-Marker + dynamische PHASEN + Umbenenn-Wege +
   Board-Kopf; Screenshot-Abnahme gegen `docs/ui-standard.md`.
6. [ ] v17c — Swipe-Popup; Screenshot-Abnahme.
7. [ ] v17d — Redaktionsplan-Config+Ergebnis in Drive, Abgleich-Check.
8. [ ] v17e — Auswertung aus Drive bestätigen; Screenshot-Abnahme.

---

## Stand
- [x] Bestand geprüft: `board.json` (v187/17 Karten/Felder), `PHASEN`+`phaseOrdner` (`pipeline.js:15`),
      `projektJson`/`abgleich`/`scan` (`projects.js`), Persistenz+Lock+`/api/drive/reconcile`
      (`server.js`), `holeIdee`/`kiStream` (`nachschub.js`), `plan.json`+`/api/plan`, rclone-Layer
      (`drive.js`: list/mkdir/read/write/moveDir/link/serialisiert). (02.09.2026)
- [x] Vier Weichen bestätigt (Owner 02.09.2026): Vollkarte-projekt.json · Anzeigename frei/ID fest ·
      Cache+Abgleich · Stellschrauben in Drive.
- [x] Owner: „alles umsetzen" (02.09.2026) — drei Annahmen abgenommen, Bau freigegeben.
- [x] **v17a gebaut + verifiziert** (Commit 3542e56): Vollkarte-`projekt.json` in `(AI only)/`,
      Abgleich Drive-gewinnt + Migration ohne Feldverlust, Schreib-Spiegelung, `deleteFile`.
      Verify: `node --check` + Logik-Test 21/21. Live-Drive-Migration steht aus (Owner: „migrieren").
- [x] **v17d-Backend gebaut + verifiziert**: `lib/planstore.js` + `/api/plan` GET/PUT auf Drive.
      Verify: `node --check` + Logik-Test 6/6. Live-Drive-Seed/Abgleich steht aus (mit Migration).
- [x] Teammate hat v16c committet (339eb62); Anzeigenamen idee=„Skript schreiben",
      skript=„Drehtermin festlegen" als v17b-Seed übernommen.
- [x] **v17b gebaut** (`lib/spalten.js`, `projects.js` dynamischer Ordner-Resolver, `server.js`
      Board-GET/reconcile/`/api/spalten/rename`/Start, `store.js`, `board.js` editierbarer Kopf).
      Verify offline: `node --check` 6/6, Logik 16/16 + 7/7.
- [x] **Live migriert (02.09.2026, echtes Drive)**: v17a-Backfill `(AI only)/projekt.json` (7 Karten
      migriert, Alt-Ort aufgeräumt, 1 verwaister Ordner als Karte); v17b-Seed `System (AI only)/spalten.json`
      + `.phase`-Marker (idee/skript/fertig geprüft); v17d-Plan `redaktionsplan.json`+`slots.json` (22 Slots).
      Drive-Gegenprüfung bestätigt. board.json v191.
- [x] **UI-Abnahme bestanden**: Edge-headless-Screenshot `board-v17b.png` — Board zeichnet Spalten aus
      Drive (Teammate-Namen), keine Konsolenfehler, editierbarer Kopf vorhanden.
- [ ] **1 Daten-Defekt (Owner-Aktion):** `In Bearbeitung/Skript/BiointensiveLandwirtschaft/(AI only)`
      hat 2× `projekt.json` (überlappende Migrationsläufe unter Doppel-Server-Last). `rclone cat`
      verkettet beide → ungültiges JSON. Fix = `rclone dedupe` (Löschen, mir vom Classifier verwehrt);
      bis dahin NICHT „Mit Drive abgleichen" für diese Karte (re-backfill würde ein 3. Duplikat schreiben).
- [ ] Forward-Umbenennung (Ordner-Move) ist code-komplett, aber live noch nicht round-trip-getestet.
      Rückwärts-Erkennung (Drive-Hand-Umbenennung) via `.phase`-Marker gebaut, live-Test offen.
- [ ] Alte App auf Port 4321 läuft mit altem Code — neu starten für v17 (Prozess-Kill war blockiert).
- [ ] v17c (Swipe): nach v17b. v17e an v18-Session (Auswertung) abgegeben.

## DoD
- [ ] Jede angezeigte Karten-Angabe steht vollständig in der Drive-`projekt.json`; Board zeigt nach
      Löschen/Neuaufbau des Caches denselben Stand (aus Drive rekonstruiert).
- [ ] `(AI only)`-Trennung gilt: `projekt.json` liegt in `<Karte>/(AI only)/`, Maschinen-Store unter
      `System (AI only)/`; kein Ordner mischt Maschinen- und Menschen-Dateien.
- [ ] Spalte im Board umbenennen → Drive-Ordner heißt neu; Drive-Ordner von Hand umbenennen → Board
      zeigt beim Abgleich den neuen Namen; Zuordnung übersteht das (Marker).
- [ ] Fremder Drive-Ordner erscheint als schlichte Spalte ohne Tore.
- [ ] Neue Idee: Popup mittig, links = neue Idee, rechts = Karte + Drive-Ordner; nur „rechts" schreibt Drive.
- [ ] Redaktionsplan: Stellschrauben liegen in Drive; beim Laden aus Drive gelesen, Slots neu gerechnet,
      Abweichung wird gemeldet und Drive-Ergebnis neu geschrieben; kein lokaler Plan-Zustand.
- [ ] Auswertung speist sich aus Drive-Karten; Token bleiben lokal.
- [ ] UI-Abnahme per Screenshot bestanden (v17b, v17c, v17e); Zugänge nie in einer Repo-Datei.
