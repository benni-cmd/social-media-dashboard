# v55 — Echtzeit-Gefuehl fuer alle externen Abgleiche

> Geplant 22.09.2026. Nummer v55 (v54 „karten-kontextmenu" ist die hoechste vergebene).
> Status: **AUDIT + PLAN. Bau blockiert, bis v54 gelandet ist** (siehe Koordination).

## PIG

**Problem:** Aktionen, die mit externen Diensten sprechen, blockieren die Oberflaeche, bis der
externe Aufruf fertig ist. Am deutlichsten beim Loeschen: `store.js` `loescheKarte` (`:206`)
verschiebt den Drive-Ordner ZUERST in den Papierkorb und nimmt die Karte erst danach aus dem
Board — Ordner suchen kostet bis 7 rclone-Aufrufe, das Verschieben laeuft in ein Timeout bis
180 s (`loescheKarte`-Kommentar `:209-211`). Die Karte bleibt derweil sichtbar, nur ein
Kopf-Statuswort zeigt Arbeit. Dasselbe Muster-Risiko bei `driveAnlegen` (`:265`),
`spaltenUmbenennen` (`:385`) und beim Datei-Upload (`:411`).

**Intent:** Jede Nutzeraktion fuehlt sich sofort an; der Austausch mit externen Diensten (Drive,
Google Kalender + Tasks, Instagram/LinkedIn-APIs) laeuft im Hintergrund — ueberall im Board,
nicht nur an einer Stelle.

**Goal:** Optimistische UI fuer alle SCHREIBENDEN externen Aktionen (lokale Aenderung +
Neuzeichnen sofort, externer Abgleich ohne blockierendes `await` im Hintergrund); nicht-
blockierende Ladeanzeige fuer LESENDE (Stats). Kein Datenverlust: der lokale/Cache-Stand wird
IMMER zuerst dauerhaft geschrieben (`speichere()` → board.json), und ein fehlgeschlagener
Hintergrund-Abgleich meldet sich SICHTBAR (Toast) + ist wiederholbar — nie stilles Verschlucken.
Nur die Firma nutzt das Board (kein Mehrbenutzer-Wettlauf, ausser dem bestehenden 409-Lock).

## Audit — ALLE Stellen mit externem Datenaustausch (Belege, kein One-Shot)

Erhoben aus `public/store.js` (voll gelesen) + Aufrufer-Grep ueber `public/*.js`.
Klassen: **W** = schreibend (external side effect) · **R** = lesend · **Muster** = wie es sich
heute anfuehlt.

### A. Schreibend — HANDLUNGSBEDARF (blockiert oder verschluckt Fehler)

| # | Funktion | Stelle | Endpoint | Aufrufer | Heute | Problem |
|---|---|---|---|---|---|---|
| A1 | `loescheKarte` | store.js:206 | POST /api/karte/loeschen | kontextmenu.js:260, detail.js:1789 | **trash-first, await, UI-blockiert bis 180 s** | Headline. Karte bleibt sichtbar; nur Kopf-Wort. Grund fuer trash-first: sonst baut der Reconcile die Karte aus dem Ordner wieder auf (Wiederkehr-Bug, Kommentar :202-205) → optimistisch erfordert **Tombstone**, sonst Auferstehung. |
| A2 | `autoSync` | store.js:750 | (ruft `gcalSync` :723) POST /api/gcal/sync | drehterminAnlegen/-Aendern/-Zuordnen, teilnehmer* | non-blocking + serialisiert, ABER `.catch(()=>{})` | Zeitverhalten schon gut (Vorbild!) — aber Fehler werden **still verschluckt** (`:754`). Verletzt „Fehler sichtbar + wiederholbar". |
| A3 | `gcalLoeschen` | store.js:760 | POST /api/gcal/loeschen | drehterminLoeschen:665 | fire-and-forget, `catch{}` still | Fehler still (`:769`). Event/Task koennen verwaist stehenbleiben, keiner erfaehrt es. |
| A4 | `driveAnlegen` | store.js:265 | POST /api/drive/create | detail.js:1116/1584, nachschub.js:196 | `await`, dann `speichere` | 1584/196 `await` → Uebernehmen/Anlegen blockiert bis Drive geantwortet hat. |
| A5 | `dateiHochladen`/`videoHochladen` | store.js:411/424 | POST /api/projekt/upload (rohe Bytes) | detail.js:1373/1410 | `await`, blockiert | Upload ist echt lang; **nicht** optimierbar zu „sofort fertig" — braucht Fortschritt (v51), darf aber nicht einfrieren. |
| A6 | `spaltenUmbenennen` | store.js:385 | POST /api/spalten/rename | (Spalten-UI) | `await`, redraw danach | Umbenennen benennt Drive-Ordner mit → blockiert bis fertig. |
| A7 | `driveSpeichern` | store.js:288 | POST /api/drive/save | (Detail-Speicherwege) | gibt Promise, Aufrufer entscheidet | pruefen, ob ein Aufrufer blockiert. |

### B. Schreibend — SCHON OPTIMISTISCH (Vorbild, nur pruefen/nicht anfassen)

| # | Funktion | Stelle | Muster |
|---|---|---|---|
| B1 | `speichere` | store.js:165 | **v32 C1-Referenz.** Debounce 120 ms, Kopf-Status, 409-Lock → neu laden. Lokal-durabler Schreibpfad (board.json) = die „Cache zuerst"-Wahrheit. |
| B2 | `schiebe` | board.js:239 | **Referenz-Wrapper.** `k.column=ziel; zeichne(); await speichere();` DANN `driveVerschieben` im try mit **Rollback** (`k.column=alt`) + `melde("befund")`. Genau das Zielmuster. |
| B3 | Drehtermin-Mutatoren | store.js:636/645/677/701/784/796 | Lokal aendern → `zeichne()` → `speichere()` → `autoSync()` im Hintergrund. Nur der Fehlerpfad (A2) fehlt. |

### C. Lesend — SCHON NICHT-BLOCKIEREND (Vorbild)

| # | Funktion | Stelle | Muster |
|---|---|---|---|
| C1 | `driveScan` | store.js:233 | Dedup (`scanInFlight`), Sanduhr auf Kachel (`driveScanLaeuft`), redraw bei Abschluss. Read-Referenz. |
| C2 | `driveAbgleich`/`abgleichStream` | store.js:334/355 | **v51 T7-Referenz.** NDJSON-Stufenstrom → `setzeAbgleichStufe(satz)` → eigener Hoerer (`beiAbgleichStufe`), kein voller Redraw je Meldung. |
| C3 | `instagramZahlen`/`linkedinZahlen` | store.js:541/545 | Aufrufer auswertung.js:69/78 zeigt `ladeMarke`-Sanduhr + faengt Fehler in `S.zahlen.fehler` → `fehlerZeile`. Schon Ladezustand + Fehler sichtbar. (Klein: IG dann LI sequenziell — parallelisierbar.) |
| C4 | Status-Reads | store.js:713/396/831/837/47/70/775/551 | `gcalStatus/driveStatus/verbindungenStatus/ladeDefaults/ladeWorkflows/promptsHolen/kontoMail/ladePlan` — try/catch, Fallback. `ladePlan` (:551) meldet Drive-Fehler bereits sichtbar (Vorbild fuer A2/A3). |
| C5 | `downloadUrl` | store.js:404 | reine GET-URL, Browser laedt selbst, kein JS-Block. |

### Audit-Fazit

Das optimistische Muster existiert schon (B1/B2/C1/C2) — es ist nur **ungleich angewandt**. Drei
echte Luecken: (1) **`loescheKarte`** blockiert trash-first [A1]; (2) **`autoSync`/`gcalLoeschen`**
verschlucken Fehler still [A2/A3]; (3) **`driveAnlegen`/`spaltenUmbenennen`** blockieren im
`await` der Aufrufer [A4/A6]. Uploads [A5] bleiben bewusst „mit Fortschritt", nicht optimistisch.

## Plan (Bau erst nach v54)

**EINE gemeinsame Hilfe in `store.js`**, kein Sonderweg je Stelle — verallgemeinert das
`schiebe`-Muster (B2):

```
optimistisch({ anwenden, zuruecknehmen, extern, was })
  1. anwenden()          // lokale Mutation an S
  2. zeichne()           // sofort sichtbar
  3. await speichere()   // lokal-durabel ZUERST (board.json) — kein Datenverlust
  4. extern() im Hintergrund (kein await im Handler):
       .then(reconcile?) .catch(e => { zuruecknehmen(); zeichne(); speichere();
                                        melde("befund", `${was}: ${e.message}`, {wiederholen}) })
```

- **A1 loescheKarte:** Karte sofort aus `S.cards` nehmen + `zeichne()` + `speichere()`;
  Drive-Trash im Hintergrund. **Tombstone** noetig, damit der Reconcile die Karte nicht
  wiederbelebt, solange der Trash laeuft/fehlt (Design-Risiko #1 — vor Bau klaeren: Merkliste
  getrashter `driveName` bzw. Server-seitige Ausblendung). Fehlschlag → Karte zurueck + Toast.
- **A2/A3 autoSync/gcalLoeschen:** Zeitverhalten bleibt; nur der stille `catch` wird zu
  `melde("befund", …)` + Wiederholen (Muster wie `ladePlan` C4).
- **A4/A6 driveAnlegen/spaltenUmbenennen:** ueber `optimistisch()` fuehren, Aufrufer entblocken.
- **A5 Upload:** unangetastet optimistisch — stattdessen v51-Fortschritt sicherstellen, nie
  einfrieren.
- Toast/Wiederholen nach `docs/ui-standard.md`; Fortschritt ueber das v51-Stufenmuster (C2).

**Randbedingungen:** keine neue Fachfunktion, nur Zeitverhalten + Fehlersichtbarkeit. Nur
blockieren, wo inhaltlich zwingend (Upload). Reads zeigen Ladezustand (v51), frieren nie ein.

## Koordination (Pflicht — beruehrt die heisse Datei `store.js`)

- `store.js` ist das Hauptziel; angrenzend `board.js` (v54) + `kontextmenu.js` (v54, Aufrufer A1).
- **v54 ist NICHT gelandet:** v54-Paket hakt alles ab und nennt Commit `3c2fb96`, aber der Hash
  ist **nicht in der History** (HEAD `3f62a25`); `board.js` (M) + `kontextmenu.js` (??) liegen
  uncommitted. Session „Kontextmenue fuer Board-Karten" laeuft noch (session-map 22.09. 17:38).
- **Bau blockiert**, bis v54 committed+gepusht ist. Per `tell-session` abgegrenzt.

## Stand

- [x] Bestand erhoben: `store.js` voll gelesen, Aufrufer-Grep (loescheKarte/driveVerschieben/
      driveAnlegen/Upload/Stats/Abgleich), Referenz-Wrapper `schiebe` (board.js:239) gelesen
- [x] Audit als belegte Liste (A/B/C) ins Paket
- [x] session-map + git-status geprueft → v54 nicht gelandet, Bau blockiert
- [x] Paket angelegt
- [ ] `tell-session` an v54-Session (Abgrenzung store.js/board.js)
- [ ] **Bau — erst nach v54-Landung** (gemeinsame Hilfe + A1–A6)
- [ ] Verify: `node --check`; Live-Zeitmessung (Loeschen fuehlt sich sofort an); Fehlerpfad
      (Drive/Kalender simuliert fehlschlagen → Toast, Daten bleiben); Screenshot des Feedbacks
- [ ] Commit (`git -C` + Pathspec + Attribution) + Push

## DoD

- [ ] Loeschen fuehlt sich sofort an (Karte weg < 100 ms), Drive-Trash im Hintergrund; Karte
      kehrt bei Fehlschlag zurueck + Toast; kein Wiederkehr-Bug (Tombstone).
- [ ] Alle schreibenden externen Aktionen laufen ueber die EINE gemeinsame Hilfe (kein Sonderweg).
- [ ] Kein stiller `catch` mehr bei gcal (A2/A3) — Fehler als Toast, wiederholbar.
- [ ] Lokaler Stand IMMER zuerst dauerhaft geschrieben (`speichere` vor externem Aufruf); im
      Fehlerfall kein Datenverlust (verifiziert am simulierten Fehlschlag).
- [ ] Reads zeigen Ladezustand (v51), frieren nie ein.
- [ ] Design/Feedback gegen `docs/ui-standard.md`; optischer Screenshot als Abnahme.

## Offene Entscheidung (vor Bau)

- **Tombstone-Mechanik fuer A1:** Wie verhindert der Reconcile die Auferstehung einer optimistisch
  geloeschten Karte, solange der Drive-Trash laeuft? Kandidaten: (a) lokale Merkliste getrashter
  `driveName`, die der naechste Abgleich ausblendet; (b) Server meldet „getrasht" und der
  Reconcile ueberspringt. Vor dem Bau von A1 zu entscheiden — sonst ist „optimistisch loeschen"
  gleichbedeutend mit dem alten Wiederkehr-Bug.
