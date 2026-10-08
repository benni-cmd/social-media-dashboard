# v114 — Harter Nachtest nach v113

> Owner-Auftrag 07.10.2026: „Nutze deine neu gewonnene Detailtiefe und führe eine Überprüfung wie am Anfang
> durch, aber mit wirklich harten Tests, um Eventualitäten und Fehler zu prüfen und die Funktionalität der Logik
> sicherzustellen." Stand: Code `9f37ae3` (v113). Testen, belegen, Fix vorschlagen — Umbau nur nach Rückfrage.
>
> **Stand 08.10.2026:** Alle 22 Befunde sind in v115 behoben und mit `tools/hart` belegt —
> `v115-fixes-aus-hartem-nachtest.md` (dort auch das aktuelle Launch-Urteil). Die Testskripte unten heißen jetzt
> `tools/hart/*.mjs` im Repo.

## PIG

**Problem:** v112/v113 haben die Hauptwege geprüft. Ob die Logik auch an den Rändern hält — kaputte Eingaben,
Wettläufe, Drive-Ausfälle mitten im Vorgang, von Hand veränderte Drive-Ordner, Datums-Grenzen —, ist nicht belegt.

**Intent:** Vor dem Launch wissen, wo das Board unter Druck bricht, damit danach nichts davon im Alltag mit
echten Daten passiert.

**Goal:** Ein Katalog harter Tests mit Ergebnis je Test (hält / bricht, Beleg) und für jeden Bruch ein
Fix-Vorschlag mit Datei und Ansatz; dazu ein aktualisiertes Launch-Urteil.

## Testumgebung

Wie v112/v113: Kopie im Session-Scratchpad, Schein-Drive (rclone-Alias auf einen lokalen Ordner), eigener
Server auf Port 4399, keine Zugangsdaten, echtes Drive und Live-Board (4321) nie berührt. Reine Module werden
direkt geprüft (nie `lib/drive.js` aus dem Projektordner laden). Vor den zerstörenden Tests wurde ein
Schnappschuss von Schein-Drive und `data/` gezogen und danach zurückgespielt. Die 17 Testskripte
(`hart/*.mjs`, unten als Befehl genannt) liegen im Session-Scratchpad unter `hart-skripte/`, nicht im Repo; sie
laufen in einer Testkopie, deren `lib/` eine Ebene höher liegt.

## Plan

1. [x] Logik-Fuzzing (rein): Tore, Fristen/Kette, Ampel, Planer, Kampagnen-CSV, Namen/Pfade
2. [x] Datums-Grenzen: Zeitumstellung 25.10.2026 und 28.03.2027, Jahreswechsel, Schaltjahr, ungültige Daten
3. [x] API-Härte: kaputte/fehlende Bodies auf 21 schreibenden Endpunkten, Pfad-Tricks, `.env`-Injektion, Prototyp-Verschmutzung, Riesen-Eingaben, Fremd-Herkunft
4. [x] Wettläufe: gleichzeitige Speicherungen, doppelte Verschiebung, Löschen ↔ Verschieben, Abgleich während Verschieben
5. [x] Drive von Hand verändert: umbenannt, gelöscht, `projekt.json` mit Syntaxfehler, mit falschem Feldtyp
6. [x] Drive-Ausfall mitten im Vorgang: Ziel nicht beschreibbar (Remote ganz weg: nur am echten Drive prüfbar)
7. [x] Oberfläche unter Druck: lange Titel, schmale Breite, Dark Mode, Neuladen während KI, kaputte Karte
8. [x] Nebenbefunde aus v113: Drehtermin-Zähler, leere Format-Datei, Warteschlangen-Stau
9. [x] Bericht, Launch-Urteil, Commit + Push

## Ergebnis in Zahlen

- Logik-Fuzzing: 9 744 Fälle, 47 verschiedene Auffälligkeiten (`node hart/fuzz-logik.mjs`) — eingeordnet unten; die meisten nur über Handbearbeitung erreichbar.
- Datums-Grenzen: 19/19 hält (`TZ=Europe/Berlin node hart/datum-grenzen.mjs`).
- Integrations- und Oberflächentests: 22 Befunde (1 Blocker, 4 hoch, 7 mittel, 10 niedrig) und 15 Prüfungen, die halten (Tabelle „Was hält").
- Kaputte Anfragen: 21 schreibende Endpunkte × 6 Varianten = 126 Fälle, Server überlebt 125 (`node hart/api-kaputt.mjs`).

## Befunde

Schwere: **B** = Blocker (Absturz/Datenverlust im normalen Gebrauch) · **H** = hoch · **M** = mittel · **N** = niedrig.
„Erreichbar" sagt, ob der Fall im Alltag aus der Oberfläche heraus passiert oder nur über Handbearbeitung/API.

### B1 — Rohmaterial-Download über 4 GB bringt den ganzen Server zum Absturz

- **Erreichbar:** Alltag. Knopf „Rohmaterial herunterladen" an einer Karte, deren Rohmaterial zusammen mehr als 4 GB hat — bei Videodrehs normal.
- **Beleg:** Zwei Test-Clips à 2,2 GB im Schein-Drive, `GET /api/projekt/download?was=rohmaterial` → HTTP 200, 4 724 464 290 Bytes ausgeliefert (kaputtes ZIP ohne Verzeichnis), danach Server tot: `ERR_HTTP_HEADERS_SENT` in `sendJson`, Prozess Ende (Log `server-c5.log`). Einzeltest des ZIP-Schreibers: `RangeError … must be <= 4294967295` nach 4,40 GB.
- **Ursache 1:** `lib/zip.js` schreibt Größen und Offsets als 32 Bit (Zeilen 90–91, 110–111, 129) — kein ZIP64.
- **Ursache 2 (gilt für jeden Fehler, der nach Antwortbeginn bis zum zentralen `catch` durchschlägt):** Der zentrale `catch` in `server.js:2191` ruft `sendJson` auch dann, wenn die Kopfzeilen schon gesendet sind; das wirft erneut und beendet den Prozess. Zweiter Auslöser belegt: `POST /api/einrichtung/speichern` mit Inhalt `null` (nur per API). Die Stream-Endpunkte für KI und Abgleich fangen ihre Fehler selbst und sind nicht betroffen.
- **Folge:** Board weg, `Start-Board.cmd` meldet „Board beendet" und schließt sich nach 4 s; kein automatischer Neustart. Was der Browser bis zum Neustart speichern will, scheitert (Verhalten nach dem Neustart nicht gemessen).
- **Fix-Vorschlag:** (a) `server.js` zentraler `catch`: bei `res.headersSent` nur `res.destroy()` statt `sendJson`; zusätzlich ein `process.on("unhandledRejection")`, das loggt statt abzustürzen. (b) `lib/zip.js`: ZIP64-Erweiterung (Extra-Feld 0x0001, EOCD64) **oder** vor dem Senden Gesamtgröße prüfen und ab 4 GB mit einem Satz ablehnen („Rohmaterial ist 4,4 GB groß — bitte direkt in Drive herunterladen", mit Ordner-Link). **Entscheidung Owner:** ZIP64 bauen oder ab 4 GB auf Drive verweisen.

### H1 — Eine von Hand falsch bearbeitete `projekt.json` legt Abgleich oder Board lahm

- **Erreichbar:** Wenn jemand in Drive eine `projekt.json` von Hand ändert (z. B. Caption als Text statt Objekt, eine Liste statt Text).
- **Beleg A:** `caption: "Hallo von Hand"` in einem Ordner → `POST /api/drive/reconcile` → HTTP 500 nach 1,2 s, „Cannot create property 'keywords' on string 'Hallo von Hand'" — der Abgleich bricht für **alle** Karten ab.
- **Beleg B:** Eine Karte mit `skriptFinal` als Liste im Board → Board zeichnet nur noch 4 Karten, Konsole 36× „Zeichenfehler (Versuch 6): (text || "").trim is not a function" aus `pipeline.js:990` (`sprechzeit` über `tore`). Bildschirmfoto scheiterte (Claude-Fenster im Hintergrund), Beleg ist DOM-Zählung + Konsolen-Stack.
- **Ursache:** `normalisiere()` (`lib/pipeline.js:904–917`) prüft nur `caption`, `platforms`, `column` auf den Typ; Drive gewinnt beim Abgleich komplett (`lib/projects.js:604`).
- **Fix-Vorschlag:** `normalisiere()` erzwingt für jedes Feld aus `leereKarte()` den Typ (Text → `String`, Liste → Liste, Objekt → Objekt, sonst Standardwert) und meldet die Korrektur als Befund. Zusätzlich in `public/board.js` `kachel()` je Karte in `try/catch`: eine kaputte Karte erscheint als „Karte beschädigt — Details" statt das Board zu leeren.

### H2 — `projekt.json` mit Syntaxfehler wird still mit einer leeren Karte überschrieben

- **Erreichbar:** Handbearbeitung (ein Komma zu viel) oder eine abgebrochene Übertragung.
- **Beleg:** Ordner ohne Board-Karte, `projekt.json` mit Notizen und Hook, am Ende `,}` → Abgleich: Karte „angelegt", Notiz „Aus dem Drive-Ordner übernommen — es gab keine projekt.json zum Auslesen", Hook leer; die Datei in Drive ist danach durch die leere Karte ersetzt (`grep -c "WICHTIGER INHALT"` → 0). Die Meldung ist falsch: die Datei gab es, sie war nur nicht lesbar.
- **Ursache:** `leseProjektJsonMitOrt` (`lib/projects.js:421–432`) unterscheidet nicht „fehlt" von „unlesbar"; danach schreibt `schreibeProjektJson` blind (`lib/projects.js:651`, ebenso Zeile 621 für Karten im Board).
- **Fix-Vorschlag:** „unlesbar" eigener Fall: Datei nicht überschreiben, sondern als `projekt.kaputt-<Zeitstempel>.json` daneben sichern und Befund „projekt.json ist beschädigt — Inhalt gesichert als …". Google Drive hält zwar Vorversionen 30 Tage, aber niemand erfährt, dass er sie braucht.

### H3 — Abgleich während einer Verschiebung erzeugt Doppel-Ordner

- **Erreichbar:** Alltag. Der Abgleich läuft beim Start und alle 30 Minuten (`public/app.js:486–500`) und braucht mit echtem Drive 10–70 s (v25 gemessen); wer in dieser Zeit Karten zieht, trifft ihn.
- **Beleg:** Drei Runden „Verschieben + Abgleich gleichzeitig": Runde 1 Board zeigt alte Phase, Drive neue; Runde 2 und 3 je ein zweiter Ordner am alten Ort, der nur `(AI only)/projekt.json` enthält (der Abgleich hat sie dorthin zurückgeschrieben). Nächster Abgleich: Befund „liegt mehrfach mit Inhalt … Bitte in Drive zusammenführen" — Ben soll eine Hülle von Hand aufräumen, die nur interne Daten enthält.
- **Ursache:** `abgleich` liest den Ordner, findet die `projekt.json` nicht mehr (sie wandert gerade) und schreibt sie per `schreibeProjektJson` an den alten Pfad (`lib/projects.js:596–621`); `mkdir`/`writeFile` legen den Ordner dabei neu an.
- **Fix-Vorschlag:** (a) Server-Sperre je Karte: `verschiebe`/`loesche`/`anlegen` und der Abgleich derselben Karte laufen nacheinander (eine `Map` Karten-ID → Promise in `lib/projects.js`); der Abgleich überspringt Karten mit laufendem Vorgang. (b) Vor jedem Zurückschreiben prüfen, ob der Ordner noch existiert — sonst Karte für diesen Lauf auslassen. (c) Optional: Ordner, die nur `(AI only)/projekt.json` und `Steckbrief.md` enthalten, als Hülle behandeln und automatisch entfernen, wenn die andere Kopie neuer ist. **Entscheidung Owner zu (c).**

### H4 — Planer zeigt an Monatsgrenzen Termine doppelt (mit Bens echter Einstellung)

- **Erreichbar:** Alltag, mit dem echten Plan (3 Posts/Woche, max. 4 Tage Abstand).
- **Beleg:** 12 Monate Okt 2026–Sep 2027: Board-Kalender 161 Termine, durchgehende Rechnung 157 (`node hart/planer-echt2.mjs`). Vier Reels erscheinen doppelt, z. B. 30.11.2026 und 02.12.2026, 29.01.2027 und 02.02.2027. Die Upload-Vorschläge (`lib/uploadslots.js:27–35`) und der Wochen-Soll (`planSlotsZwischen`, `lib/uploadslots.js:98`) nutzen dieselben Monatslisten — eine Woche über die Monatsgrenze zählt den doppelten Reel also mit. Die Drive-Datei `redaktionsplan.slots.json` startet mit einer eigenen Kette und weicht am Anfang ab (07.10. statt 05.10.).
- **Ursache:** `slotsForMonth` (`lib/scheduler.js:287–299`) beginnt die Abstands-Kette je Monat neu; `deckleAbstand` zieht Termine nach vorn, also landet derselbe Termin einmal vorgezogen im Vormonat und einmal unverändert im Folgemonat.
- **Fix-Vorschlag:** Eine Funktion `slotsImZeitraum(plan, von, bis)`, die die Kette immer ab festem Anker (Wochenindex 0 = 01.01.2024) rechnet und dann filtert; `slotsForMonth`, `planSlots` und `berechneHorizontSlots` (`lib/planstore.js:54–63`) nutzen nur noch sie. Rechenaufwand: rund 150 Wochen je Aufruf, bei Bedarf je Plan-Fingerabdruck zwischenspeichern.

### M1 — Gleichzeitige Speicherungen: „gespeichert" gemeldet, Änderung trotzdem weg

- **Erreichbar:** zwei Tabs oder ein Abgleich, der genau beim Speichern zurückschreibt. Ein einzelnes Fenster bündelt seine Speicherungen sauber (`public/store.js:268`).
- **Beleg:** 10 gleichzeitige `PUT /api/board` mit derselben Version, drei Runden: 3–6× HTTP 200, 0× 409, Rest 500 „EPERM/ENOENT rename … board.json.tmp"; Version steigt nur um 1, eine einzige Änderung überlebt.
- **Ursache:** Versionsprüfung und Schreiben sind nicht atomar (`server.js:716–745`), alle Schreiber teilen eine Temp-Datei (`server.js:279`).
- **Fix-Vorschlag:** Alle Board-Schreibwege (`PUT /api/board`, Abgleich, `schreibeBoard`) über eine Server-Warteschlange (Promise-Kette) führen; Temp-Datei mit Zufallsnamen.

### M2 — Gelöschte Karte kann durch eine spätere Verschiebung zurückkommen

- **Erreichbar:** knapp, aber aus einem Fenster: „Weiter zu …" scannt erst einige Sekunden; wer in dieser Zeit „Löschen" klickt, bekommt danach trotzdem einen neuen Ordner. Leichter mit zwei Tabs.
- **Beleg:** Löschen → 200 (Ordner im Papierkorb), 150 ms später Verschieben derselben Karte → 200 „angelegt: true", neuer Ordner in `6 Upload` mit voller `projekt.json`. Der nächste Abgleich baut daraus die Karte wieder auf. Umgekehrte Reihenfolge hält (Verschieben gewinnt, Löschen scheitert sauber, Karte bleibt).
- **Ursache:** `verschiebe` legt ohne vorhandenen Ordner neu an (`lib/projects.js:368–372`), ohne zu wissen, dass die Karte gerade gelöscht wurde.
- **Fix-Vorschlag:** Server merkt sich gelöschte Karten-IDs (bzw. prüft gegen `board.json`) und lehnt Verschieben/Anlegen für sie mit 409 ab; Browser: `driveVerschieben` bricht ab, wenn die Karte `_geloescht` trägt. Mit der Sperre aus H3 erledigt sich der Rest.

### M3 — Keine Herkunftsprüfung: fremde Webseiten könnten Aktionen auslösen

- **Erreichbar:** Eine Webseite, die Ben im selben Browser öffnet, schickt eine einfache POST-Anfrage an `https://localhost:4321` (kein CORS-Vorabtest nötig bei `text/plain`).
- **Beleg:** `POST /api/drive/create` mit `Origin: https://boese-seite.example`, `Sec-Fetch-Site: cross-site`, `Content-Type: text/plain` → HTTP 200, Ordner im Schein-Drive angelegt. Im Server gibt es keine Prüfung auf `Origin`, `Sec-Fetch-Site` oder Content-Type (`grep -n "origin\|sec-fetch" server.js` → 0 Treffer). Möglich wären so u. a. Karte löschen, Server beenden, Drive-Ordner umbenennen (`/api/einrichtung/speichern`).
- **Abschwächung:** Chrome ab 141 und Edge ab 143 fragen nach, bevor eine öffentliche Seite `localhost` erreicht ([Chrome-Blog](https://developer.chrome.com/blog/local-network-access), [Microsoft Learn](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)). Der Angriff braucht damit einen Klick auf „Zulassen".
- **Fix-Vorschlag:** Am Eingang jedes schreibenden Endpunkts: `Origin` (falls vorhanden) muss `https://localhost:<PORT>` sein, `Sec-Fetch-Site` darf nicht `cross-site` sein, Content-Type muss `application/json` sein (außer beim Datei-Upload). Etwa 10 Zeilen in `server.js`.

### M4 — Plan und Kategorien lassen sich mit einer leeren Anfrage komplett löschen

- **Erreichbar:** nur per API oder durch einen Fehler im eigenen Browser-Code — dann aber in Drive (= Wahrheit).
- **Beleg:** `PUT /api/plan` mit `null`, `[]`, `5` oder `"x"` → 200; danach `redaktionsplan.json` in Drive = `{"kampagnenVorlage": true}`, alle Frequenzen, Kategorien-Anteile, Ziele weg. `PUT /api/boardparameter` mit `null` → `{"kategorien": [], "ziele": []}` in Drive.
- **Fix-Vorschlag:** `server.js:843` und `:1068`: Body muss ein Objekt mit den Pflichtfeldern sein (`typenmix` als Liste bzw. `kategorien`/`ziele` als Listen), sonst 400. Gleiches Muster für `PUT /api/defaults` (nimmt heute alles mit 200).

### M5 — Unerfüllbarer „max. Abstand" wird still in Termin-Klumpen verwandelt

- **Erreichbar:** Einstellung im Redaktionsplan, z. B. 1 Post/Woche mit max. 3 Tagen Abstand.
- **Beleg:** Monatsansicht: 5–6 Termine am Monatsanfang, danach 26 Tage Lücke (max. 3 eingestellt); 0,25 Posts/Woche mit max. 7: 49 Tage Lücke (`node hart/planer-grenze.mjs`). Kein Hinweis in der Oberfläche (`public/redaktionsplan.js:266–277`).
- **Fix-Vorschlag:** Beim Speichern prüfen: `7 / Posts pro Woche > max. Abstand` → Satz „Mit 1 Post pro Woche ist ein Abstand von höchstens 3 Tagen nicht einhaltbar — mindestens 7 Tage oder mehr Posts einstellen." **Entscheidung Owner:** nur warnen oder Speichern sperren.

### M6 — KI rechnet nach Neuladen oder Schließen weiter

- **Beleg:** Recherche-Lauf (lokales Ollama) nach 8 s im Browser abgebrochen → Server rechnete noch rund 27 s weiter, drei weitere Ollama-Aufrufe, Ergebnis (1 349 Zeichen) ins Leere. Mit Claude bis zu 5 min (Zeitlimit), und ein erneuter Start läuft parallel.
- **Ursache:** `/api/ai/stream` (`server.js:912–946`) bricht die Pipeline bei Verbindungsende nicht ab; `child.kill()` gibt es nur beim Zeitlimit (`lib/ai.js:926/983/1053`).
- **Fix-Vorschlag:** `req.on("close")` → `AbortController` durch `laufePipeline` bis zu `runClaude`/`runCodex`/Ollama-`fetch` reichen und dort `child.kill()` bzw. `abort()`.

### M7 — Kopfzeile überlappt bei halber Bildschirmbreite

- **Beleg:** Fenster 960 px (halber Full-HD-Bildschirm): „Nächster Schritt" liegt 54 px über dem Reiter „Auswertung"; ab etwa 1 090 px frei (1 100 px: 12 px Abstand, 1 024 px: 26 px Überlappung). Bei 375 px ist die linke Kopfzeile (Logo, Board/Auswertung) abgeschnitten, die Zoom-Knöpfe liegen über „Idee von der KI".
- **Fix-Vorschlag:** `.kopf` in `public/style.css:231`: Umbruch in zwei Zeilen unter ~1 100 px (`flex-wrap` + Medienabfrage) statt fester Lage.

### Niedrig

| # | Befund | Beleg | Fix-Vorschlag |
|---|---|---|---|
| N1 | Rohe englische Fehlertexte im Toast: rclone-Zeilen „2026/10/07 … ERROR : … Server side directory move failed", JS-Fehler „Cannot create property …" | Doppel-Verschieben, nicht beschreibbares Ziel, Abgleich H1 | `verstaendlich()` (`public/ui.js:2700`): rclone-Logzeilen erkennen → „Drive hat den Vorgang abgelehnt" + Details aufklappbar; Server-500 mit deutschem `satz` |
| N2 | Prompts nehmen unbekannte Kennungen wie `constructor`, `toString` an (200) und spiegeln sie nach Drive | `PUT /api/prompts {"id":"constructor"}` → Eintrag in `prompts.json` | `lib/promptstore.js:280`: `Object.hasOwn(PROMPTS, id)` statt `PROMPTS[id]` |
| N3 | Keine Größengrenze für Anfragen | 600 MB → 500 nach 1,5 s, Server lebt, belegt danach 1,33 GB | `readBody` (`server.js:620`): Grenze z. B. 20 MB, sonst 413 |
| N4 | Drehtermin zählt gelöschte Karten mit („(1)", Liste leer) | `loescheKarte` (`public/store.js:339`) nimmt die ID nicht aus `karteIds`; Zähler `public/drehtermine.js:101` | beim Löschen aus allen Drehterminen austragen; Zähler nur vorhandene Karten |
| N5 | „Inhalt nach Drive speichern" schreibt bei unbrauchbarem KI-Ergebnis nur „# Slider: Titel" — Format-Tor gilt als erfüllt | `formatAlsText` (`public/detail.js:1668`), Tor prüft nur den Dateinamen (`lib/pipeline.js:1049`) | ohne Inhalt nicht speichern („KI-Ergebnis leer — neu erzeugen") |
| N6 | Kampagnen-CSV: ungültige Daten rollen still weiter („31.04." → 01.05., „29.02." in Nicht-Schaltjahr → 01.03.) | Fuzzing | `lib/kampagnen.js:72–81`: Tag/Monat gegenprüfen, sonst Befund „Zeile N: Datum ungültig" |
| N7 | Ungültige Datums-/Zahlenwerte (Upload „2026-13-45", Vorlauf 2,5) ergeben „NaN" und „Invalid Date" | Fuzzing; Oberfläche verhindert es (Datumsfeld, Rundung `public/ui.js`), nur Handbearbeitung | mit H1 erledigt (Typ-Härte in `normalisiere`) |
| N8 | Ordner von Hand umbenannt: zwei widersprüchliche Meldungen („kein Ordner mehr" + „Karte wurde angelegt"), obwohl nur neu verknüpft | Abgleich nach Umbenennen | Abgleich erkennt gleiche Karten-ID und meldet „Ordner wurde umbenannt in …" |
| N9 | Fehlt die rclone-Verbindung ganz, staut sich die Drive-Warteschlange: Rückmeldung zu einem Verschieben erst nach über 1 Minute | in v113 beobachtet, in v114 nicht neu gemessen. Mechanismus im Code: jeder rclone-Aufruf wiederholt den Config-Fehler 4× (`RETRY_MS` = 5,5 s, `lib/drive.js:224/280`), ein Verschieben braucht mehrere Aufrufe, alle laufen nacheinander | nach einem Lauf, der alle Wiederholungen verbraucht hat, 30 s lang sofort „Drive nicht verbunden" melden statt erneut zu warten |
| N10 | Node-Warnung DEP0190 (`shell: true`) im Log | `lib/ai.js:915`, `claudeauth.js`, `codexauth.js` — Argumente fest oder per Erlaubtliste geprüft, Prompt über stdin: nicht ausnutzbar | nur Hinweis; bei Gelegenheit `.cmd`-Pfad direkt starten |

Info ohne Befund: Das Board hat keinen Dark Mode (0 `prefers-color-scheme`-Regeln) — bleibt hell. Nur relevant, falls gewünscht.

## Was hält

| Test | Ergebnis |
|---|---|
| Datums-Grenzen (Zeitumstellung, Jahreswechsel, Schaltjahr, Ostern 2027) | 19/19 hält |
| `.env`-Injektion (`PUT /api/config/env` mit Zeilenumbruch, fremder Schlüssel) | hält: Erlaubtliste, Umbrüche entfernt |
| Prototyp-Verschmutzung über `/api/defaults` (`__proto__`, `constructor.prototype`) | hält: keine globale Wirkung |
| Pfad-Tricks (`..`, `../System (AI only)`, `/` im Titel, unbekannte Spalte) | hält: abgelehnt bzw. entschärft |
| Systemordner/Phasenordner löschen (`KPI`, `1 Idee`, `System (AI only)`) | hält: nichts gelöscht |
| Doppeltes Verschieben derselben Karte | hält: einer gewinnt, keine Datei verloren (Meldung roh, N1) |
| Verschieben, dann Löschen gleichzeitig | hält: Löschen scheitert sauber, Karte bleibt |
| Ordner von Hand umbenannt | hält: Karte folgt, IDs eindeutig (Meldung N8) |
| Ordner von Hand gelöscht | hält: Karte bleibt mit Befund, nichts still gelöscht |
| Ordner von Hand in andere Phase verschoben | hält: „Das Board folgt Drive" |
| Ziel beim Verschieben nicht beschreibbar | hält: alle Dateien am alten Ort |
| Riesen-Anfrage 600 MB | hält: 500, Server lebt (N3) |
| Kaputte JSON-Bodies (21 Endpunkte × 6 Varianten) | Server lebt bei 125/126 (Ausnahme: B1-Ursache 2) |
| Lange Titel (222 Zeichen, Wort mit 85 Buchstaben) | hält: bricht um, kein Überlauf |
| Shell-Aufrufe der KI-CLIs | hält: nicht injizierbar (N10) |

## Nur am echten System prüfbar (Owner)

1. Drive-Wurzel gelöscht/entzogen oder Netz weg mitten im Verschieben — der Schein-Drive legt eine fehlende Wurzel einfach neu an, echtes Google Drive meldet Fehler. Prüfen: Board-Ordner in Drive kurz umbenennen, eine Karte verschieben, Meldung ansehen, zurückbenennen.
2. Alle Punkte aus v112 „nur manuell" bleiben offen (Drive-Umbenennen über die Google-API, Ordner-Link, geteilte Ablage, Kontowechsel, OAuth Google/Instagram/LinkedIn live, KPI, Codex-Weg).
3. ZIP-Download eines echten großen Rohmaterial-Ordners — erst nach dem Fix aus B1.

## Launch-Urteil (07.10.2026, nach v114)

**Nicht startklar, aber nah dran.** v113 hat alle Hauptwege repariert; v114 findet vier Dinge, die im Alltag mit echten Videodaten passieren können: der Absturz beim großen Rohmaterial-Download (B1), eine falsch bearbeitete `projekt.json` legt Abgleich oder Board lahm bzw. wird still überschrieben (H1, H2), Doppel-Ordner, wenn der Abgleich beim Start läuft und man sofort Karten zieht (H3), und doppelte Termine im Kalender (H4). Mit B1–H4 behoben ist das Board aus Sicht dieser Tests startklar; M1–M7 sind Härtung für die Zeit danach, M3 (Herkunftsprüfung) empfehle ich trotzdem gleich mitzunehmen, weil es 10 Zeilen sind.

## Fragen an den Owner (vor jedem Umbau)

1. B1: ZIP64 bauen (große Downloads gehen) oder ab 4 GB auf Drive verweisen?
2. H3 (c): Hüllen mit nur `projekt.json` automatisch entfernen, wenn die andere Kopie neuer ist?
3. M5: Unerfüllbaren max. Abstand nur warnen oder Speichern sperren?
4. Umfang des Fix-Pakets v115: nur B1–H4 (+ M3) oder alles inkl. M- und N-Befunde?
5. Die 17 Testskripte liegen nur im Session-Scratchpad und verschwinden mit der Sitzung. Als wiederholbares Werkzeug ins Repo übernehmen (z. B. `tools/hart/`, mit eigenem Schein-Drive-Aufbau), damit v115 jeden Fix gegen denselben Test prüfen kann?

## Stand

07.10.2026 — Paket angelegt; alle neun Planschritte durchgeführt; Bericht geschrieben. Test-Umgebung danach
geräumt (Server gestoppt, Scratchpad-Daten gelöscht). Kein Code geändert.

## Definition of Done

- [x] Jeder Planschritt mit Ergebnis je Test (hält/bricht) und Beleg
- [x] Jeder Bruch mit Fix-Vorschlag (Datei + Ansatz)
- [x] Launch-Urteil aktualisiert
- [x] Nur der Bericht committet, gepusht

Geprueft gegen: Code `9f37ae3` (v113) in isolierter Kopie, Schein-Drive, lokales Ollama, Browser-Pane (1440/1280/1100/1024/960/375 px), Chrome-Blog und Microsoft Learn zu Local Network Access · Offen: Fix-Paket v115 nach Owner-Entscheidung (Fragen 1–5); Punkte „nur am echten System prüfbar"
