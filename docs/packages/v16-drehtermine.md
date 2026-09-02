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

### Google Calendar — Weg GEWÄHLT: googleapis (Node) + Service-Account [Owner, 02.09.2026]
- Neuer Drehtermin → Google-Calendar-Event (Datum/Zeit) anlegen, `gcalEventId` merken.
- Karten zugeordnet → Drive-Links der Skript-Ordner via vorhandenem `drive.link()`
  (`lib/drive.js:341`, `rclone link`) in die Event-Beschreibung schreiben (Event updaten).
- In-Process im Server via `calendar.events.insert/patch/delete` (`googleapis`).
- **Service-Account statt OAuth**, weil unbeaufsichtigt und ohne Token-Ablauf: ein SA kann in
  einen persönlichen Gmail-Kalender schreiben, sobald der Kalender MIT der SA-Mail geteilt ist
  (Domain-wide Delegation ist nur für Workspace). Belege: github.com/googleapis/
  google-api-nodejs-client#3173, dev.to/divofred/…-530i (zwei Quellen, 02.09.2026).

#### Owner-Setup (einmalig, DU — ich darf keine Zugangsdaten eingeben)
1. console.cloud.google.com → Projekt wählen/anlegen.
2. „APIs & Services" → „Library" → **Google Calendar API** aktivieren.
3. „Credentials" → „Create credentials" → **Service account** (Name z. B. `content-maschine-cal`,
   keine Rollen nötig).
4. Beim Service-Account → Tab **„Keys"** → „Add key" → „Create new key" → **JSON** herunterladen
   (enthält `client_email` + `private_key`).
5. calendar.google.com → Ziel-Kalender → Einstellungen → **„Für bestimmte Personen freigeben"**
   → die `client_email` hinzufügen → Recht **„Termine ändern"**.
6. **Kalender-ID** notieren (Kalender-Einstellungen → „Kalender-ID"; Hauptkalender = Gmail-Adresse).
7. JSON **außerhalb des Repos** ablegen (z. B. `%USERPROFILE%\.secrets\content-maschine-cal.json`),
   dann in `.env` (gitignoriert): `GCAL_SA_KEYFILE=<pfad>` und `GCAL_CALENDAR_ID=<id>`.
   Namen (nicht Werte) in `.secrets/AI-ZUGAENGE.md` eintragen. **Kein Schlüssel ins Repo.**

#### Code-Design (baue ich nach dem Setup; Kollision mit v17b-Server vorher abstimmen)
- Neue `lib/gcal.js`: `google.auth.GoogleAuth({keyFile: GCAL_SA_KEYFILE, scopes:[calendar]})`;
  `eventAnlegen(t)→eventId`, `eventUpdaten(eventId, felder)`, `eventLoeschen(eventId)`.
  Beschreibung = zugeordnete Karten + `drive.link(projektPfad)`-Links.
- `server.js`: Endpunkt `POST /api/gcal/sync {drehterminId}` — legt an/patcht, gibt `gcalEventId`
  zurück (in `drehtermine` speichern). Fehlt der Zugang (keine Env) → No-Op mit Hinweis, lokales
  Feature läuft weiter.
- `public/store.js`: nach `drehterminAnlegen/Aendern` + `karteZuTermin/karteVonTermin` ein
  `gcalSync(terminId)` (fire-and-forget; Fehler melden, nicht blockieren).
- `npm i googleapis` (neue Abhängigkeit).

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
- [x] Google-Calendar-Weg gewählt: **googleapis (Node) + Service-Account** (Owner, 02.09.2026).
- [ ] **Owner-Aktion offen:** Service-Account anlegen, Kalender freigeben, `GCAL_SA_KEYFILE`/
      `GCAL_CALENDAR_ID` in `.env` setzen (Setup-Checkliste im Design-Abschnitt). Blockt nur v16d.
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
- [ ] v16d (Google Calendar, braucht Owner-Setup).

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
