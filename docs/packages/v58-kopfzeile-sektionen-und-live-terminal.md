# v58 — Kopfzeile in Sektionen, je Sektion ein Live-Terminal

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 23.09.2026.
> Status: **GEBAUT und verifiziert** (23.09.2026). Nummer v58 (hoechste vergebene ist v57,
> zweimal belegt: `v57-detail-resizable-und-cursor-stil.md` und `v57-inhalte-nach-drive.md`).

## PIG

**Problem:** Die Kopfzeile traegt heute EINEN Sammel-Marker (`public/app.js` `zeichneBadge`,
`#google-drive-badge`), der alle externen Anschluesse zu einem Satz zusammenzieht:
„Google + Drive verbunden, live abgeglichen". Daraus ist weder ablesbar, WELCHER Dienst
gerade arbeitet, noch WAS er tut. Wer wissen will, warum das Board 70 Sekunden lang Karten
umsortiert, sieht nur eine Sanduhr. Die technischen Aufrufe dahinter — welcher Drive-Ordner
gerade gelesen wird, was Google antwortet, wie lange es dauert — laufen komplett unsichtbar
im Server.

**Intent:** Jederzeit nachvollziehen koennen, was das System nach aussen tut, und zwar je
Anschluss getrennt: arbeitet er gerade, ist er in Ordnung — und, eine Ebene tiefer, welcher
Aufruf gerade laeuft und was zurueckkommt. Vertrauen durch Mitlesen statt durch Warten.

**Goal:** Die Kopfzeile zeigt VIER Sektionen mit je eigenem Marker (Sanduhr, wenn dort gerade
gearbeitet wird; sonst das Statuswort). Jede Sektion hat ein kleines Icon, das darunter ein
Terminal aufklappt — groesser als das Karten-Terminal aus v51, damit man lesen kann. Darin
laeuft live und mitlesbar, was dieser Anschluss tut: jeder externe Aufruf mit Befehl bzw.
Endpunkt, Dauer und Ergebnis. Beim Oeffnen steht die History der letzten Ereignisse schon da.

---

## Die vier Sektionen (Owner-Entscheidung 23.09.2026)

| Sektion | Dienste | Quelle im Code |
|---|---|---|
| **API-Abgleich** | Instagram, LinkedIn — **spaeter YouTube und TikTok** | `lib/social.js:358`, `lib/kpi.js:311` |
| **Drive-Abgleich** | Google Drive ueber rclone | `lib/drive.js:258` (der EINE `spawn`) |
| **Weitere externe Anschluesse** | Google Kalender + Tasks, Websuche (Tavily/DuckDuckGo) | `lib/gcal.js:80/111`, `lib/websuche.js:40/56` |
| **KI** | Ollama, Claude-CLI | `lib/ai.js` (`runOllama`, `runOllamaStream`, `pingOllama`, Claude-Spawn) |

Owner-Wortlaut zur ersten Sektion: „API = IG, LinkedIn und spaeter auch die anderen wie yt
oder tiktok" — die Sektion wird also **erweiterbar** gebaut (Dienst-Register, nicht drei
fest verdrahtete Namen). Google Kalender+Tasks faellt unter „weitere Anschluesse", weil die
API-Sektion nach Owner-Wortlaut die Social-Plattformen fuehrt.

**KI bekommt eine eigene, vierte Sektion** (Owner-Entscheidung) — zusaetzlich zum
Terminal am ausloesenden Knopf aus v51, das bleibt unveraendert.

## Abgleich-Knoepfe (Owner-Entscheidung 23.09.2026, zweite Runde)

Das Terminal liest nicht nur mit, es kann auch anstossen:

- **„Mit Drive abgleichen" im Kopf-Menue wird zu „Alles abgleichen"** — ruft ALLE
  Schnittstellen auf einmal ab und aktualisiert sie, nicht mehr nur Drive.
- **Jede Sektion bekommt zusaetzlich einen eigenen Knopf** fuer den erneuten Abgleich nur
  dieses Anschlusses.
- **Ausnahme KI:** keine Abgleich-Knopf. Dort reicht das Terminal zum Mitlesen — ein
  KI-Lauf wird von einer Karte ausgeloest, nicht von der Kopfzeile.

Was der jeweilige Knopf aufruft — alles bereits vorhanden, nichts Neues:

| Sektion | Knopf ruft | Stelle |
|---|---|---|
| API-Abgleich | `instagramZahlen()` + `linkedinZahlen()` | `public/store.js:623/627` |
| Drive-Abgleich | `driveAbgleich()` (der v51-T7-Stufenstrom) | `public/store.js:406` |
| Weitere | `gcalStatus()` + `gcalSync()` je Drehtermin ohne `gcalEventId` | `public/store.js:795/805` |
| KI | (kein Knopf) | — |
| Kopf-Menue „Alles abgleichen" | die drei obigen nacheinander | `public/app.js`, Handler `el("abgleichen")` |

**Entschieden zur Sektion „Weitere" (Owner 23.09.2026, nach Empfehlung):** Der Knopf prueft
die Google-Verbindung UND zieht alle Drehtermine nach, die noch kein `gcalEventId` tragen —
sonst waere es ein Knopf, der nur eine Ampel umschaltet. Die Web-Suche hat keinen Zustand
zum Auffrischen und erscheint dort nur, wenn eine Recherche laeuft.

## Weitere Owner-Entscheidungen

- **Log-Tiefe: jeder Aufruf technisch.** Nicht nur die fachlichen Stufen aus v51, sondern
  der einzelne externe Aufruf mit Befehl/Endpunkt, Dauer und Ergebnis
  (`rclone lsjson gdrive:In Bearbeitung/Idee → 12 Eintraege, 1,3 s`;
  `GET calendars/primary → 200, 11,2 s`).
- **History: Server-Ringpuffer.** Die letzten ~500 Ereignisse liegen im Speicher des
  Servers, ueberleben ein Neuladen der Seite und sind nach einem Server-Neustart leer.
  Keine Logdatei auf Platte.

## Randbedingung, die ICH setze (Sicherheit, nicht verhandelbar)

Mitschneiden heisst nicht alles mitschneiden. **Keine Zugangsdaten ins Log**: Query-Parameter
`access_token`, `refresh_token`, `client_secret`, `key`, `code` werden vor dem Schreiben durch
`…` ersetzt; Header und Request-Bodies werden grundsaetzlich nicht geloggt. Grund: die
IG-/LinkedIn-Endpunkte tragen den Token in der URL, und der Google-Token-Refresh
(`lib/gcal.js:80`) schickt das Refresh-Token im Body. Ein Terminal, das man aufklappt und
jemandem zeigt, darf keine Schluessel zeigen.

---

## Bestand (belegt, 23.09.2026) — warum das billig zu bauen ist

Alle externen Aufrufe laufen durch **acht Engstellen**, nicht verstreut:

| Engstelle | Datei:Zeile | deckt ab |
|---|---|---|
| rclone-Subprozess | `lib/drive.js:258` | **jeden** Drive-Aufruf (eine globale Promise-Kette) |
| Google-Token-Refresh | `lib/gcal.js:80` | OAuth-Erneuerung |
| Google-API-Wrapper | `lib/gcal.js:111` | Kalender + Tasks |
| Instagram/Graph | `lib/social.js:358` | IG-Aufrufe |
| KPI-Abruf | `lib/kpi.js:311` | Zahlen-Abrufe |
| Tavily | `lib/websuche.js:40` | Web-Suche (Schluessel gesetzt) |
| DuckDuckGo | `lib/websuche.js:56` | Web-Suche (Fallback) |
| Ollama + Claude | `lib/ai.js` | KI-Laeufe |

Befehl: `grep -n "fetch(\|spawn(" lib/*.js`. Bereits vorhanden und wiederzuverwenden:
`statusChip()` (sechs Status-Woerter), `sanduhr()`, das `.denk`-Terminal aus v51
(`public/ui.js`, `public/style.css:1950 ff.`) samt aufklappbarem Verlauf, und die
NDJSON-Stroeme aus v51 (`/api/ai/stream`, `/api/drive/reconcile/stream`) als Hausmuster.
Ein Ereignis-/Log-Modul gibt es NICHT (`ls lib/`), ebenso wenig SSE (`grep -rn "EventSource"`)
— beides kommt neu dazu.

## Plan (Teilpakete)

1. [x] **Ereignis-Bus im Server** — neues `lib/ereignisse.js`: Ringpuffer (500),
       `melde({sektion, dienst, text, dauerMs, ergebnis})`, Abonnenten-Liste,
       Schluessel-Schwaerzung. Kein Fremd-Modul, keine Datei auf Platte.
2. [x] **Die acht Engstellen anzapfen** — je Engstelle eine Zeile vor und eine nach dem
       Aufruf; die Aufrufe selbst bleiben unveraendert. Kein neues Verhalten, nur Mitschnitt.
3. [x] **Live-Feed** — `GET /api/ereignisse/stream` als Server-Sent Events (nicht NDJSON wie
       v51: der Feed steht DAUERHAFT offen, und `EventSource` bringt den Wiederverbinden-
       Mechanismus von selbst mit) plus `GET /api/ereignisse` fuer die History beim Oeffnen.
4. [x] **Kopfzeile in vier Sektionen** — `public/index.html` + `public/app.js`: das eine
       `#google-drive-badge` wird zu vier Sektionen, je mit Marker, Aufklapp-Icon und
       Abgleich-Knopf (KI ohne Knopf). Dienst-Register statt fester Namen, damit
       YouTube/TikTok spaeter nur eine Zeile sind.
5. [x] **Terminal je Sektion** — die `.denk`-Komponente aus v51 wiederverwenden, in der
       groesseren Fassung unter der Sektion verankert, gefuellt aus History + Live-Feed.
5b. [x] **„Alles abgleichen"** — der Kopf-Menue-Eintrag „Mit Drive abgleichen" ruft kuenftig
       alle Sektionen nacheinander auf. Fehlschlaege einzeln sichtbar ueber
       `meldeWiederholbar()` aus v55 (`public/store.js:130`), nicht als Sammelfehler.
6. [x] **Verify** — `node --check`, echter Browser-Screenshot je Sektion gegen
       `docs/ui-standard.md` (Regel 3 Status-Woerter, Regel 5 keine Unicode-Symbole), plus
       ein Live-Beleg: laufender Drive-Abgleich, im Terminal die einzelnen rclone-Aufrufe
       mitlesbar; Gegenprobe, dass keine Zugangsdaten im Log stehen.

## Umgesetzt + verifiziert (23.09.2026)

**Teilpakete 1–3** (`c133a98`): `lib/ereignisse.js` — Ringpuffer 500 im Speicher,
Abonnenten, Zaehler je Sektion, Schwaerzung. Die acht Engstellen angezapft, ohne einen
einzigen Aufruf selbst zu aendern. `server.js`: `GET /api/ereignisse` (Verlauf + Stand) und
`GET /api/ereignisse/stream` als Server-Sent Events mit Puls alle 25 s.

**Teilpakete 4, 5, 5b** (`85764aa`): `public/anschluesse.js` als eigenes Modul, damit die
Leiste an EINER Stelle lebt und `app.js` nicht weiter waechst. Das alte
`#google-drive-badge` samt `googleOk`/`driveOk`/`syncOk` ist entfallen; der
Kopf-Menue-Eintrag heisst „Alles abgleichen".

**Befund waehrend des Baus, behoben:** Die erste Fassung liess das Ergebnis die
Befehlszeile ERSETZEN — nach Abschluss stand dort nur noch „12 Zeile(n) zurueck", und
genau die Frage „welcher Ordner war das?" war wieder unbeantwortet. Jetzt stehen Befehl
und Ergebnis nebeneinander.

### Belege

**Live-Feed waehrend eines Drive-Abgleichs** (`curl -sk --no-buffer https://localhost:4399/api/ereignisse/stream`,
24 rclone-Ereignisse):

```
[drive/rclone] → cat gdrive:In Bearbeitung/Idee/.phase
[drive/rclone] ✓ 1 Zeile(n) zurueck  (3207 ms)  [ok]
[drive/rclone] → lsf gdrive:In Bearbeitung --dirs-only
[drive/rclone] ✓ 6 Zeile(n) zurueck  (832 ms)  [ok]
```

**Schwaerzung gegen echte Daten** (`curl https://localhost:4399/api/ereignisse` nach einem
echten Instagram-Abruf): 93 Ereignisse im Puffer, **0 unschwaerzte Geheimnis-Parameter**,
24-mal `access_token=…`. Die Gegenprobe lief ueber einen regulaeren Ausdruck auf
`(access_token|refresh_token|client_secret|api_key|key|code|token)=` gefolgt von etwas
anderem als dem Schwaerzungszeichen.

**Optische Abnahme** (Browser, eigener Server `PORT=4399`, 1440×900): vier Sektionen im
Kopf — API, Drive, Weitere, KI. KI traegt genau EINEN Knopf (Mitlesen), die drei anderen je
zwei (Mitlesen + Abgleich), gepruefte Knopfzahlen 2/2/2/1. Das Drive-Terminal zeigt 22
Zeilen mit Uhrzeit, Statuswort, Dienst, Befehl, Ergebnis und Dauer; das API-Terminal zeigt
echte Instagram-Aufrufe mit sichtbar geschwaerztem Token. Der API-Abgleich-Knopf lief durch
und stellte den Marker auf „ok".

### Nachlese nach dem ersten Einsatz (Owner 23.09.2026, Commit `96344ac`)

**Feste Sektionsbreite.** Die Sektionen sprangen, sobald sich in einer der Zustand aenderte —
der Knopf wanderte unter dem Finger weg. Alle vier jetzt fest 132 px; Marker und Knoepfe haben
ihre eigene feste Spur, der Name kuerzt statt zu schieben.

**Der Leerzustand log.** Das Terminal zeigte „Noch nichts passiert, seit der Server laeuft",
obwohl es nichts wissen KONNTE. Ursache beim Owner: das Frontend kommt frisch von der Platte,
der Serverprozess lief aber noch mit dem Code vor v58 und kannte `/api/ereignisse` nicht —
belegt mit `curl` auf denselben Server: `/api/board` HTTP 200, `/api/ereignisse` HTTP 404.
„Nichts passiert" und „ich kann es nicht wissen" sind jetzt zwei Zustaende: bei 404 steht da,
dass der Server neu gestartet werden muss (Statuswort `unlesbar`), bei einem Abriss ebenso.
Belegt gegen beide Server: alter Server → Neustart-Hinweis, aktueller Server → „Noch nichts
passiert" mit `entfaellt` und laufendem Verlauf; Breiten je 132 px in beiden Faellen.

**Daraus gelernt, ueber dieses Paket hinaus:** Ein Leerzustand muss unterscheiden, ob nichts
geschah oder ob die Quelle fehlt. Beides mit demselben Satz zu beantworten ist eine Behauptung
ohne Grundlage — genau das, was die Werkbank-Regel „Zahlen messen, nicht erinnern" fuer Zahlen
verbietet, hier fuer Zustaende.

### Nachlese 3: der Kopf-Satz (Owner 25.09.2026, Commit `edf7864`)

**Problem:** Der Satz in der Kopfzeile wurde allein vom Drive-Stufenstrom gespeist. Nach dem
Reconcile stand dort „Bereit.", auch wenn Drive weiter Ordner las oder API/Weitere/KI
arbeiteten — der Kopf behauptete Ruhe, waehrend anderswo gearbeitet wurde. (Die Vorgeschichte:
v69 hatte den umgekehrten Fehler behoben, bei dem die letzte Stufe samt Sanduhr ewig
stehenblieb.)

**Regel jetzt:** Solange IRGENDEIN Anschluss arbeitet, steht im Kopf die **neueste** Aktion
ueber alle vier Bereiche; sobald nichts mehr laeuft, steht dort „Bereit.". Die Bedingung
kennt nur der Ereignis-Bus, denn nur er sieht alle vier — also fuehrt er den Kopf.

**Zwei Feinheiten, beide aus einem echten Fehlversuch:**

1. Der Bus besitzt den Kopf NUR waehrend der Arbeit und schreibt danach genau EINMAL
   „Bereit.". Wuerde er im Ruhezustand weiterschreiben, wischte er Bestaetigungen wie
   „Upload am 3.10." (`public/detail.js`) im Sekundentakt weg.
2. Meine erste Fassung gab Drive unbedingten Vorrang, sobald der Stufenstrom lief. Gemessen
   25.09.2026: ein Klick auf „Zahlen neu abrufen" erzeugte 24 Instagram-Aufrufe, und der Kopf
   zeigte die ganze Zeit „Gleicht die Spalten mit Drive ab …" — also gerade NICHT die neueste
   Aktion. Jetzt entscheidet allein die Zeit; der lesbarere Drive-Stufensatz gewinnt nur, wenn
   die neueste Aktion ohnehin von Drive kommt.

**Belegt im Browser:** Der Kopf wechselte in dieser Reihenfolge — `API · GET
https://graph.instagram.com/v21.0/me/media…` → zwei weitere API-Zeilen → `Drive · cat
gdrive:System (AI only)/redaktionsplan.slots.json` → `Drive · cat gdrive:System (AI
only)/defaults.json`, also genau der Abfolge der echten Aufrufe nach. Im Ruhezustand
„Bereit." ohne Sanduhr, bei gleichzeitig ruhigen Sektions-Markern.

Der Ruhezustand ist mit dem FERTIGEN Code nachgemessen (25.09.2026, eigener Server
`PORT=4399`): waehrend des Laufs „Gleicht die Spalten mit Drive ab …" mit Sanduhr, danach
`{"stand":"Bereit.","sanduhr":false,"sektionAktiv":false}` — beide Sanduhren weg.

## Stand

**23.09.2026** — Paket angelegt, vier Rueckfragen vom Owner beantwortet, Bestand geprueft.
Kein Code geaendert. Koordination: die Session „Wir arbeiten am Social Media Board" lief
zuletzt 23.09.2026 10:48 im selben Repo; `git status` ist bis auf den fremden Stand von
`docs/packages/v29-…md` sauber, v57 ist gelandet (`eacc394`, `4723c53`).

## Definition of Done

Geprueft gegen: vier Sektionen im Kopf mit je eigenem Marker · je Sektion ein aufklappbares
Terminal mit History und Live-Zeilen · jeder der acht Engstellen-Aufrufe erscheint mit
Befehl/Endpunkt, Dauer und Ergebnis · Ringpuffer haelt 500 Ereignisse und ueberlebt ein
Neuladen der Seite · keine Zugangsdaten im Log (Gegenprobe mit gesetztem IG-Token) ·
`node --check` auf jede geaenderte Datei · echter Browser-Screenshot gegen
`docs/ui-standard.md`.

Offen:
- Die Sektion „Weitere" ist gebaut, aber noch nicht im Lauf abgenommen: dafuer muesste ein
  Drehtermin ohne `gcalEventId` existieren, den der Knopf nachzieht. Die Google-Aufrufe
  selbst erscheinen bereits im Terminal (Token-Refresh und API-Wrapper sind angezapft).
- Die KI-Sektion ist verdrahtet, aber in diesem Durchgang nicht mit einem echten Lauf
  bespielt — v51 belegt denselben Weg bereits am Karten-Terminal.
