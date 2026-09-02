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

### Google Calendar (Neuland) [recherchiert 02.09.2026, zwei Quellen]
- Neuer Drehtermin → Google-Calendar-Event (Datum/Zeit) anlegen, `gcalEventId` merken.
- Karten zugeordnet → Drive-Links der Skript-Ordner via vorhandenem `drive.link()`
  (`lib/drive.js:341`, `rclone link`) in die Event-Beschreibung schreiben (Event updaten).
- **Zugangsweg — offen, Owner entscheidet + richtet ein (ich kann keine Zugangsdaten eingeben):**
  - A) **gcalcli** (Python-CLI): `gcalcli add …` — CLI-first (Werkzeug-Regel), passt zum
    rclone-Spawn-Muster; braucht Python + OAuth-Login.
    Belege: github.com/insanum/gcalcli, manpages.ubuntu.com/…/gcalcli.1.html
  - B) **googleapis (Node)**: `calendar.events.insert` in-process; Service-Account (Kalender
    mit SA-Mail teilen, Schreibrecht) oder OAuth-Refresh-Token.
    Belege: github.com/googleapis/google-api-nodejs-client#3173, dev.to/divofred/…-530i

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
- [ ] Owner: Google-Cloud/OAuth-Weg wählen + einrichten (blockt nur v16d).
- [ ] Owner: Phasen-Split + Start v16a freigegeben.
- [ ] Bau v16a → v16b → v16c → v16d.

## DoD
- [ ] Drehtermin anlegen (Datum+Uhrzeit) über „+"-Button; Kachel mit „(in X Tagen)".
- [ ] Zuordnung nur bei fertigem Skript; Warnung außerhalb des Dreh-Fensters; kein Dreh in
      der Vergangenheit.
- [ ] Zugeordnete Karten erben `dates.dreh`; Upload bleibt; Termin-Datumsänderung zieht mit.
- [ ] Ohne Drehtermin in 30 Tagen erscheint der Sonntag der Folgewoche; nur der nächste sichtbar.
- [ ] Google-Calendar-Event entsteht; Drive-Skript-Links stehen im Termin.
- [ ] UI-Abnahme per Screenshot bestanden; kein toter Zustand beim Erst-Start.
