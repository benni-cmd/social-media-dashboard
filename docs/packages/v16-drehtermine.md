# v16 — Drehtermine (Batch-Dreh, Board-Leiste, Google-Calendar-Sync)

## PIG

**Problem:** Ein „Drehtag" existiert heute nur als abgeleiteter Einzeltermin pro Karte
(`dates.dreh`). Es gibt keinen echten Dreh*termin* als eigene Sache — das Bündeln mehrerer
fertiger Skripte auf einen Tag/Ort, mit Eintrag im Google Calendar samt Skript-Links, fehlt.

**Intent:** Drehtermine als eigene Entität einführen. Nur Karten mit **fertigem Skript**
lassen sich einem Drehtermin zuordnen; die Drehtermine leben als Leiste auf dem Board und
landen im Google Calendar, mit den Drive-Links der zugeordneten Skripte im Termin.
[Owner, 02.09.2026]

**Goal:** Auf dem Board (unter der Wochenleiste) liegt eine Drehtermin-Leiste: Kacheln
„Datum (in X Tagen)" von links nach rechts, rechts ein „+"-Button (Datum+Uhrzeit). Ein neuer
Drehtermin erzeugt einen Google-Calendar-Eintrag; werden Karten zugeordnet, stehen deren
Drive-Skript-Links in der Termin-Beschreibung. Zuordnung nur bei fertigem Skript; kein
Drehtermin in der Vergangenheit; ohne Drehtermin in 30 Tagen wird der Sonntag der Folgewoche
gesetzt. UI-Abnahme per Screenshot besteht.

---

## Design-Entscheidungen

### Datenmodell — im Board-Dokument
`board.json` → `{ version, cards, drehtermine }` (ein atomarer Save, ein `version`-Lock).
```
Drehtermin = { id, datum:"YYYY-MM-DD", zeit:"HH:MM", ort:"", titel:"", notiz:"",
               karteIds:[...], gcalEventId:"", auto:false }
Karte      += { drehterminId: string|null }
```

### Terminkette (revidiert) [Owner, 02.09.2026]
- **Idee und Skript sind KEINE Datums-Meilensteine mehr** — raus aus der Kette.
- Anker bleibt **Upload** (im ersten Schritt automatisch aus dem Redaktionsplan gesetzt).
- Rückwärts vom Upload: **Freigabe = Upload − 3** · **Schnitt = Freigabe − 3 (= Upload − 6)**.
- **Dreh ist ein Fenster, kein fester Tag:** frühestens 14 Tage vor Schnitt →
  gültig `[Schnitt − 14, Schnitt]` = `[Upload − 20, Upload − 6]`.
- **Kein Dreh in der Vergangenheit** (Guard, greift NACH Upload-Wahl).
- **Upload wird beim Zuordnen NIE angetastet** (Batch = verteilt hochladen; Slots bleiben).

### Zuordnung nur bei fertigem Skript
Ein Drehtermin darf nur Karten aufnehmen, deren Skript fertig ist. Die Zuordnungs-Option
erscheint erst im Schritt **„Drehtermin festlegen"** (ex-Phase `skript`), vorher nicht.
Beim Zuordnen prüft das System, ob das Termin-Datum im Dreh-Fenster der Karte liegt — sonst
Warnung (keine harte Sperre, Owner darf bewusst abweichen).

### Phasen-Umbenennung [Owner, 02.09.2026]
Interne IDs bleiben (Drive-Ordner, `column`-Werte, `migriere` hängen daran); nur Anzeige
ändert sich:
- Phase `idee` → Name **„Skript schreiben"** — Recherche- und Skript-Loop laufen hier, nach
  der Logik des heutigen ersten Menüs.
- Phase `skript` → Name **„Drehtermin festlegen"** — hier die Zuordnung.
- **Annahme (bei Review bestätigen):** die Skript-Werkzeuge der heutigen Phase `skript`
  wandern in den ersten Schritt; `skript` wird zum reinen Zuordnungs-Schritt.

### Auto-Drehtermin
Ist in den nächsten 30 Tagen kein Drehtermin eingetragen, setzt das System den **Sonntag der
Folgewoche** als nächsten Drehtermin (`auto:true`). Es ist immer nur der **nächste** sichtbar;
der übernächste erscheint erst, wenn der aktuelle verstrichen ist.
- **Annahme (bei Review bestätigen):** der Auto-Termin wird als Kachel gesetzt (nicht nur
  vorgeschlagen), bleibt aber `auto:true`, bis Karten zugeordnet werden.

### UI — auf dem Board, kein eigener Tab [Owner, 02.09.2026]
Neue **Drehtermin-Leiste direkt unter der Wochenleiste** (`public/board.js:203`):
- Kacheln links→rechts: `Datum` + `(in X Tagen)`; Klick öffnet die Termin-Detailansicht
  (zugeordnete Karten, hinzufügen/entfernen).
- Ganz rechts: Button **„+ Drehtermin"** (Datum + Uhrzeit).

### Google Calendar + Tasks — Weg GEWÄHLT: OAuth-User-Flow, roh per fetch [Owner, 02.09.2026]
**Kein Service-Account, kein googleapis-Paket.** Zwei Gründe:
- **Tasks erzwingen OAuth:** Ein Service-Account ohne Workspace-Domain-Delegation erreicht die
  Tasks eines privaten Gmail GAR NICHT (Übergabe der Drive-Session, s. u.). Für Tasks + Kalender
  ist der OAuth-User-Flow der einzige tragende Weg — eine Zustimmung, beide Scopes
  (`.../auth/calendar` + `.../auth/tasks`).
- **Dependency-frei:** Das Projekt hat null npm-Deps (`package.json` deps: {}); IG/LinkedIn machen
  OAuth schon roh per `fetch` (`server.js` `/api/auth/instagram|linkedin` + `/callback`, Token in
  `data/tokens.json`). Google Calendar/Tasks laufen genauso über die REST-APIs — kein `googleapis`.

#### Routing — „auf wen geht der Termin" [Owner, 02.09.2026]
- **Kalender an ANDERE geht über Teilnehmer** (deren E-Mail als `attendee`): das Event landet per
  Einladung in deren Kalender, und dafür reicht ALLEIN Bens Login.
- **Tasks sind privat pro Konto:** die Tasks-API schreibt nur in die Liste des eingeloggten Kontos;
  kein „Assignee". → **v1-Scope [Owner]: Kalender an alle (Teilnehmer-E-Mail), Tasks nur in Bens
  eigene Liste.** Echte Tasks bei anderen bräuchte deren eigenen OAuth (spätere Phase).
- **Personen**: Liste `{ id, name, email }` (Ben, Leon, Cutter …).
- **Routing-Tabelle** je Termin-Art: `{ typ, zielPersonId, kalender:bool, tasks:bool }`.
- **Termin-Arten je Projekt in den Kalender [Owner]: `dreh`, `schnitt`, `upload`** (Daten aus
  `card.dates.*`; `dreh` aus der Drehtermin-Zuordnung). Freigabe vorerst nicht.

#### Owner-Setup (einmalig, DU — ich darf keine Zugangsdaten eingeben)
APIs sind laut Übergabe schon aktiv (Projekt 1041532493098). Fehlt nur der OAuth-Client:
1. console.cloud.google.com → Projekt `1041532493098` → **Credentials → Create credentials →
   OAuth client ID → Web application**.
2. **Authorized redirect URI**: `https://localhost:4321/api/auth/google/callback`.
3. `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` in `.env` (gitignoriert); Namen in
   `.secrets/AI-ZUGAENGE.md`. **Kein Secret ins Repo.**
4. Danach im Board **„Mit Google verbinden"** klicken → Consent im Browser (Scopes Calendar+Tasks).

#### Code-Design (roh per fetch)
- Neue `lib/gcal.js`: Token aus `tokens.json` (`google`), Refresh via `grant_type=refresh_token`;
  `eventAnlegen/Updaten/Loeschen` → `calendar/v3/calendars/<calId>/events` (mit `attendees`);
  `taskAnlegen/Updaten/Loeschen` → `tasks/v1/lists/@default/tasks` (due, notes). Fehlt Token →
  No-Op mit Hinweis, lokales Feature läuft weiter.
- `server.js`: `/api/auth/google` (Redirect, `access_type=offline&prompt=consent`) +
  `/api/auth/google/callback` (Code→Token, in tokens.json); `GET /api/gcal/status`;
  `POST /api/gcal/sync` (Karte/Drehtermin → Events+Task anlegen/patchen, IDs zurück).
- `public/store.js`: `gcalStatus()`, `gcalVerbinden()`, `gcalSync(...)` (fire-and-forget).
- Personen + Routing-Tabelle: eigene Config (Drive-Wahrheit wie plan/spalten, oder `defaults.json`).

#### Phasen v16d
- **v16d-1 Foundation:** OAuth-Verbindung + `lib/gcal.js` + „Mit Google verbinden"-Button +
  minimaler Sync (Dreh-Event in Bens Kalender, 1 Task in Bens Liste). End-to-end testbar, sobald
  der OAuth-Client steht.
- **v16d-2 Routing/Personen:** Personen-Liste + Routing-Tabelle (Teilnehmer je Typ, Kanal-Toggles),
  Schnitt-/Upload-Events, Update/Delete bei Datumsänderung.

---

## Phasen (Arbeitspakete)

- **v16a — Modell + Terminlogik** (`lib/pipeline.js`, `server.js`, `public/store.js`):
  Kette Freigabe/Schnitt/Dreh-Fenster, Vergangenheits-Guard, Auto-Regel, `drehtermine` in
  Board-Persistenz + Store, Konsistenz-Helfer. Ohne externe Abhängigkeit — sofort baubar.
- **v16b — Board-Leiste + Zuordnung** (`public/board.js`, `public/detail.js`, `style.css`):
  Kacheln-Leiste, „+"-Button, Termin-Detail, Zuordnung im „Drehtermin festlegen"-Schritt.
- **v16c — Phasen-Umbenennung** (`lib/pipeline.js` PHASEN, Skript-Loop in Schritt 1).
- **v16d — Google-Calendar-Sync** (nach Owner-Setup): Event anlegen/updaten, Drive-Links.

---

## Plan (v16a zuerst)

1. [ ] `lib/pipeline.js` — Kette revidieren: `VORLAUF_TAGE` → nur `freigabe:3, schnitt:6,
   upload:0`; `dreh` als Fenster `[upload−20, upload−6]` (Helfer `drehFenster(upload)`);
   `planUmUpload(upload)` ohne idee/skript; `migriere`: `drehterminId ??= null`;
   `leereDrehtermin()`, `naechsterAutoDreh(drehtermine, heute)` (Sonntag der Folgewoche).
2. [ ] `server.js` — `leseBoard`/`schreibeBoard`/`PUT /api/board` tragen `drehtermine` mit.
3. [ ] `public/store.js` — `S.drehtermine`, PUT-Body + `ladeBoard`; Helfer
   `drehterminAnlegen/Aendern/Loeschen`, `karteZuTermin/karteVonTermin` (setzt/spiegelt
   `dates.dreh`, prüft Fenster + Vergangenheit, Upload unberührt).
4. [ ] v16b — Board-Leiste + Detail + Zuordnung; Screenshot-Abnahme.
5. [ ] v16c — Phasen-Umbenennung + Skript-Loop-Merge; Screenshot-Abnahme.
6. [ ] v16d — Google Calendar nach Owner-Setup.

---

## Stand
- [x] Bestand geprüft: `dates.dreh`/`TERMINE`/`PHASEN`/`einfacherPlan`/`rueckwaertsplan`,
      Persistenz (`leseBoard`/`schreibeBoard`, `/api/board`-Lock), `store.js`,
      Wochenleiste (`board.js:203`), `drive.link()` (`drive.js:341`).
- [x] Weichenstellung: beides kombiniert · gemischt (02.09.2026).
- [x] Kopplung: Upload bleibt stehen; Kette Freigabe−3/Schnitt−6/Dreh-Fenster (02.09.2026).
- [x] UI: Board-Leiste unter Wochenleiste, kein eigener Tab (02.09.2026).
- [x] Google-Calendar-Wege recherchiert (gcalcli vs. googleapis), zwei Quellen (02.09.2026).
- [x] Weg korrigiert (Übergabe 8eb747b): **OAuth-User-Flow, roh per fetch, kein SA/googleapis**
      — SA erreicht private-Gmail-Tasks nicht. Routing v1: Kalender an alle (Teilnehmer), Tasks
      nur in Bens Liste; Termin-Arten Dreh/Schnitt/Upload (Owner, 02.09.2026).
- [ ] **Owner-Aktion offen:** OAuth-Client (Web app) im Projekt 1041532493098 anlegen, Redirect
      `…/api/auth/google/callback`, `GOOGLE_OAUTH_CLIENT_ID/SECRET` in `.env`. Blockt v16d-Test.
- [x] **v16a gebaut + funktional verifiziert (02.09.2026):** pipeline (Kette Schnitt−6/
      Freigabe−3, `drehFenster` [Upload−20,Upload−6], `leereDrehtermin`, `autoDrehNoetig`/
      `sonntagFolgewoche`, `drehterminId` via `leereKarte`+`normalisiere`); server
      (`leseBoard`/`schreibeBoard`/PUT tragen `drehtermine`, andere Schreiber erhalten sie);
      store (`S.drehtermine`, PUT-Body, `pruefeAutoDreh`, Helfer `drehterminAnlegen/Aendern/
      Loeschen`, `karteZuTermin/karteVonTermin`). Verify: Server-Roundtrip PUT→GET,
      `drehtermine` + `drehterminId`/`dates.dreh` persistiert; `node --check` aller Dateien grün.
- [x] **v16b gebaut + UI verifiziert (02.09.2026):** neue `public/drehtermine.js`
      (Leiste `zeichneDrehleiste`, Kacheln „Datum (in X Tagen)", „+ Drehtermin"-Modal mit
      Vergangenheits-Guard, Termin-Detail mit Karten-Loesen/Bearbeiten/Loeschen);
      `index.html` (#drehleiste unter #wochenlast); `board.js` (Aufruf in zeichneBoard);
      `app.js` (Karten-Oeffnen verdrahtet); `detail.js` (`blockDrehtermin`, gated auf
      fertiges Skript = Spalte ≥ Skript, nicht idee/fertig/verworfen); `style.css`.
      Verify: Edge-headless-Screenshot Board — Leiste sitzt unter der Wochenleiste, Auto-Kachel
      „13.9.2026 (in 11 Tagen) · automatisch gesetzt" (30-Tage-Regel live), „+"-Button rechts.
- [x] Sicht-Pruefung Detailspalte (02.09.2026): CDP-Screenshot Skript-Karte zeigt den
      Drehtermin-Block (Dropdown „Termin waehlen", „Zuordnen", „+ Neuer Drehtermin"),
      korrekt gated auf die Skript-Phase. **v16b damit voll verifiziert.**
- [x] **v16c gebaut + UI verifiziert (02.09.2026):** PHASEN umbenannt (idee→„Skript
      schreiben", skript→„Drehtermin festlegen", neue Saetze; IDs/Drive-Ordner stabil).
      `detail.js`: Schritt 1 zeigt Recherche-Loop UND — sobald Hooks stehen — den Skript-Loop
      (`blockPhase` idee ruft `guidedIdee`+`skriptLoop`); `guidedIdee` Stufe 3 verschiebt
      nicht mehr automatisch, `zeichne()` blendet den Skript-Loop ein; `skriptLoop`-Abschluss
      speichert + schiebt nach „Drehtermin festlegen" (Upload schon in Schritt 1 gesetzt,
      Fallback bleibt); Schritt 2 zeigt keine Skript-Werkzeuge, nur Hinweis + Drehtermin-Block.
      Verify: CDP-Screenshots Board (Spalten „Skript schreiben"/„Drehtermin festlegen") +
      Detailspalte (Schritt 2 ohne Skript-Tools). Step-1-Merge per Code (interaktiver
      Loop braucht KI-Laeufe fuer den Screenshot).
- Transitional: Karten, die vor v16c in der Spalte „skript" standen, ohne fertiges Skript,
  zeigen dort keine Skript-Werkzeuge mehr — zum Weiterschreiben zurueck nach „Skript schreiben"
  ziehen. (Owner-Hinweis, keine Auto-Migration gebaut.)
- [x] **v16d-1 Foundation gebaut (02.09.2026):** `lib/gcal.js` (OAuth-Token aus tokens.json +
      Refresh; Calendar events + Tasks roh per fetch); `server.js` `/api/auth/google[/callback]`,
      `/api/gcal/status`, `/api/gcal/sync`; `store.js` `gcalStatus/gcalVerbinden/gcalSync`;
      `drehtermine.js` „Mit Google verbinden"-Knopf + „Zu Google Kalender + Tasks" im Detail;
      `app.js` Rücklauf `?verbunden=google`. Smoke-Test: Server bootet, status→{verbunden:false},
      auth/google→500 „CLIENT_ID fehlt", sync ohne datum→400. `node --check` aller Dateien grün.
- [ ] **Owner: OAuth-Client anlegen + `.env` (s. Setup) → „Mit Google verbinden" → funktional
      testen** (Event + Task entstehen). Erst danach v16d-1 als verifiziert markieren.
- [ ] v16d-2: Personen + Routing-Tabelle (Teilnehmer je Typ, Kanal-Toggles), Schnitt/Upload-Events,
      Auto-Sync bei Datumsänderung, Drive-Links in der Beschreibung.

## Parallel-Session-Hinweis (02.09.2026)
`server.js` wurde ausserhalb dieses Kontexts zu einem **v17-Umbau** erweitert (board.json =
Cache, Wahrheit in Drive; PUT spiegelt geaenderte Karten nach Drive) — aufgesetzt auf die
v16a-drehtermine-Aenderungen. v16b fasst `server.js` NICHT an. Beim naechsten Sichern der
Backend-Arbeit gehoert dieser v17-Stand der anderen Session, nicht diesem Paket.

## v16b-Merkzettel (beim Bau erledigen)
- `detail.js`-Hinweistexte „Dreh wird automatisch 2 Wochen vorher gesetzt" stimmen nicht mehr
  (Dreh kommt aus dem Drehtermin) — umtexten.
- `merke("dates", einfacherPlan(datum), true)` ERSETZT `dates` und löscht damit ein via
  Drehtermin gesetztes `dates.dreh`. Beim Upload-Ändern `dreh` erhalten (mergen statt ersetzen).

## DoD
- [ ] Drehtermin anlegen (Datum+Uhrzeit) über „+"-Button; Kachel mit „(in X Tagen)".
- [ ] Zuordnung nur bei fertigem Skript; Warnung außerhalb des Dreh-Fensters; kein Dreh in
      der Vergangenheit.
- [ ] Zugeordnete Karten erben `dates.dreh`; Upload bleibt; Termin-Datumsänderung zieht mit.
- [ ] Ohne Drehtermin in 30 Tagen erscheint der Sonntag der Folgewoche; nur der nächste sichtbar.
- [ ] Google-Calendar-Event entsteht; Drive-Skript-Links stehen im Termin.
- [ ] UI-Abnahme per Screenshot bestanden; kein toter Zustand beim Erst-Start.

## Übergabe von der Drive-Session (02.09.2026) — Calendar/Tasks-API + Service-Account-Caveat
Voraussetzungen für den Google-Calendar-Teil sind jetzt vorbereitet:
- Im Google-Cloud-Projekt **1041532493098** (Konto bennibi03@gmail.com — dasselbe Projekt wie
  die rclone-Drive-client_id) sind **Google Calendar API UND Google Tasks API aktiviert**.
  Drive dort verifiziert (eigene client_id, `rclone lsd` listet).
- **Stolperstein Service-Account + privates Gmail:** Ein Service-Account sieht den Kalender
  eines normalen Gmail-Kontos NICHT automatisch — der Nutzer muss den Kalender **explizit mit
  der Service-Account-Adresse teilen** (Kalender-Einstellungen → „Für bestimmte Personen
  freigeben" → SA-Adresse). Ohne das: leere API-Antwort, kein Fehler.
- **Tasks:** Ein reiner Service-Account ohne Domain-weite Delegation kommt an die Tasks eines
  privaten Gmail (ohne Workspace) gar nicht heran → für Tasks ggf. OAuth-User-Flow statt SA prüfen.
- Prüfen, dass die APIs in DEM Projekt aktiv sind, zu dem der Service-Account gehört (falls er
  in einem anderen Projekt liegt, dort Calendar/Tasks ebenfalls aktivieren).
- Owner-Bitte: Calendar/Tasks **funktional testen** (mit dem SA-Credential), bevor als erledigt
  markiert. Von der Drive-Session aus nicht testbar (kein Token mit Calendar/Tasks-Scope dort).
