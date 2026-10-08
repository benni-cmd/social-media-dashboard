# v115 — Fixes aus dem harten Nachtest v114

> Owner-Auftrag 07.10.2026 (Antworten auf die fünf Fragen aus v114, am 08.10. bestätigt): ZIP64 bauen · **alle**
> Befunde beheben (B, H, M, N) · Hüllen mit nur interner `projekt.json` automatisch entfernen, wenn die andere
> Kopie neuer ist · die harten Testskripte als `tools/hart/` ins Repo · unerfüllbarer „max. Abstand": **Speichern
> sperren**. Befunde und Belege: `v114-harter-nachtest.md`. Stand vorher: Code `9f37ae3`.

## PIG

**Problem:** v114 fand 22 Brüche, darunter einen Server-Absturz beim Rohmaterial-Download über 4 GB,
Abgleich-/Board-Ausfälle durch eine einzige falsch bearbeitete `projekt.json`, stilles Überschreiben,
Doppel-Ordner durch Wettläufe und doppelte Kalendertermine an Monatsgrenzen.

**Intent:** Das Board soll im Alltag mit echten Videodaten weder abstürzen noch Daten verlieren oder
doppeln — und jeder Fix soll gegen denselben harten Test wiederholbar prüfbar sein.

**Goal:** Alle 22 Befunde aus v114 sind behoben oder mit Grund als „kein Umbau" entschieden; `tools/hart/`
baut eine isolierte Umgebung mit Schein-Drive selbst auf und zeigt für jeden Befund „ok"; UI-Änderungen
sind per Bildschirmfoto abgenommen.

## Entscheidungen (Owner, 07./08.10.2026)

| Frage | Antwort |
|---|---|
| ZIP über 4 GB | ZIP64 bauen |
| Umfang | Alles inkl. M und N |
| Hüllen nach Abgleich-Wettlauf | automatisch entfernen, wenn die andere Kopie neuer ist (in den Papierkorb, also wiederherstellbar) |
| Testskripte | ins Repo als `tools/hart/`, mit eigenem Schein-Drive-Aufbau |
| Unerfüllbarer max. Abstand | Speichern sperren, mit Satz, welcher Wert mindestens nötig ist |

## Plan

1. [x] **Testwerkzeug zuerst** — `tools/hart/` (Commit `83d29f7`): `umgebung.mjs` kopiert den Code in ein Temp-Verzeichnis, Schein-Drive per rclone-Alias, eigener Port, Einrichtung über die echte API, räumt weg. Gruppen `logik`, `api`, `wettlauf`, `drive-hand`, `zip`, `ki`; Gesamtlauf `node tools/hart/lauf.mjs [--zip-gross]`. Vorher-Lauf: 36 Befunde in 5 Gruppen (M2 und H3 erst nach deterministischem Nachstellen, M6 erst mit dreistufiger Testaufgabe).
2. [x] **B1 Absturz + ZIP64**
3. [x] **H1 Typ-Härte** (+ N7)
4. [x] **H2 unlesbare `projekt.json`**
5. [x] **H3 + M2 Sperre je Karte** (+ H3c Hüllen)
6. [x] **H4 + M5 Planer**
7. [x] **M1 Board-Schreiben**
8. [x] **M3/M4/N3 Eingang**
9. [x] **M6 KI-Abbruch**
10. [x] **M7 Kopfzeile**
11. [x] **N1, N2, N4, N5, N6, N8, N9, N10**
12. [x] **Abnahme** — Gesamtlauf, Selbsttests, Bildschirmfotos, Doku, Commit + Push

## Was gebaut wurde

| v114 | Fix | Beleg |
|---|---|---|
| **B1** ZIP > 4 GB → Absturz | `server.js`: zentraler `catch` schließt bei gesendeten Kopfzeilen nur die Verbindung; `unhandledRejection` wird geloggt statt das Board zu beenden. `lib/zip.js`: ZIP64 (Extra 0x0001 lokal + zentral, 64-Bit-Deskriptor, ZIP64-Ende + Lokator) | `zip`: Einzeldatei 4,3 GB und 4,4 GB über den Server — Windows-`tar` und .NET lesen alle Einträge mit Größe, CRC ok, Server lebt (9/9). `api`: 105 kaputte Anfragen, Server überlebt alle |
| **H1** falscher Feldtyp | `lib/pipeline.js`: `normalisiere()` bringt jedes Feld aus `leereKarte()` und die optionalen KI-Felder auf ihren Typ, prüft ISO-Daten; `typFehler()`; `lib/projects.js`: Original als `projekt.kaputt-<Zeit>.json` gesichert, Befund nennt die Felder; `public/board.js`: eine Karte, die beim Zeichnen wirft, erscheint als „Karte beschädigt" | `logik`: 1 222 Feld/Typ-Kombinationen, `migriere` wirft nie, jedes Feld typrichtig, `tore`/`ampel` werfen nie. `drive-hand`: Abgleich 200 statt 500, Notiz erhalten, Sicherung da. Bildschirmfoto: alle Karten gezeichnet, Konsole ohne Fehler |
| **H2** Syntaxfehler → still überschrieben | `leseProjektJsonMitOrt`: „fehlt" / „unlesbar" / „Drive-Störung" getrennt; unlesbar → Sicherung + Befund „beschädigt"; Störung → diesmal nichts schreiben | `drive-hand`: Inhalt in der Sicherung, Meldung sagt „beschädigt", Board-Stand bleibt |
| **H3** Doppel-Ordner bei Abgleich während Verschieben | `mitKarte()` — ein Drive-Vorgang je Karte zur Zeit; der Abgleich liest/schreibt nur unter der Sperre und nur, wenn der Ordner noch da ist; Steckbrief-Abgleich ebenso | `wettlauf` (deterministisch nachgestellt: Verschieben genau nach dem Auflisten): genau ein Ordner, Board = Drive, kein „zusammenführen" |
| **H3c** Hüllen | Ordner nur mit Board-Dateien und älter als die Kopie mit Inhalt → Papierkorb; neuere Hülle bleibt mit Befund | `drive-hand`: ältere Hülle im Papierkorb, neuere bleibt |
| **H4** Doppel-Termine an Monatsgrenzen | `lib/scheduler.js`: `slotsImZeitraum()` — eine Kette ab 01.01.2024 für Kalender, Upload-Vorschläge, Wochenziel und Drive-Datei (`planstore.berechneHorizontSlots`) | `logik`: Bens Plan über 24 Monate so viele Termine wie ohne Deckel (keine Doppel), fensterunabhängig, größte Lücke 4 ≤ 4 |
| **M1** gleichzeitige Speicherungen | `boardReihe()` / `aendereBoard()` in `server.js`: Versionsprüfung und Schreiben in einer Reihe, Temp-Datei mit Zufallsnamen; Abgleich, Post-Zuordnung, KPI und Zurücksetzen legen ihre Änderung auf den neuesten Stand (KPI überschrieb bis v114 seinen Startstand) | `wettlauf`: 3 Runden × 10 gleichzeitig → je genau 1× 200, 9× 409, kein 500 |
| **M2** gelöschte Karte kommt zurück | gelöschte Karten-IDs: Verschieben/Anlegen/Speichern → 409, Spiegeln übersprungen; Browser verschiebt keine gelöschte Karte | `wettlauf`: nacheinander und 150 ms versetzt — kein neuer Ordner, kommt nach Abgleich nicht zurück |
| **M3** keine Herkunftsprüfung | `herkunftOk()` + `jsonTypOk()` für alle schreibenden Anfragen | `api`: fremde Seite (text/plain), fremde Herkunft, `Sec-Fetch-Site: cross-site`, http statt https → 403; eigene Oberfläche und lokales Skript dürfen; text/plain → 415 |
| **M4** Plan/Parameter mit Unsinn gelöscht | `leseJson()` für alle 30 Bodies; Plan braucht `typenmix`, Boardparameter `kategorien` + `ziele`; Karten-Endpunkte eine Karte mit id | `api`: Redaktionsplan und Boardparameter in Drive unverändert nach Unsinn, kein „Ohne Titel"-Ordner |
| **M5** unerfüllbarer max. Abstand | `scheduler.abstandPruefung()` rechnet den echten Planer durch (Messung: monoton, hängt am Format-Mix — Bens Mix mit 1 Post/Woche braucht 11 Tage, 3/Woche 4); Speichern gesperrt in Oberfläche und Server (400) | `logik`: Prüfung stimmt in 100 Einstellungen mit dem Planer überein. Bildschirmfoto: „… mindestens 4 Tage einstellen … Nichts gespeichert.", Plan in Drive unverändert |
| **M6** KI rechnet nach Neuladen weiter | Abbruch-Signal von `/api/ai(/stream)` durch `laufePipeline` bis Claude/Codex (Prozessbaum per `taskkill /T`) und Ollama (`fetch` abgebrochen); kein weiterer Schritt | `ki`: nach Abbruch still nach 0,0 s (vorher > 8 s). Echte Claude-CLI: Antwort „OK" in 5,1 s, abgebrochener Stream endet nach 0,5 s, kein Prozess bleibt |
| **M7** Kopfzeile bei halber Breite | `public/style.css`: unter 1 100 px zweizeilig, unter 620 px dreizeilig, Spalten-Fuß frei von der Zoom-Leiste | Bildschirmfotos 1 440 / 960 / 375 px: keine Überlappung, Seite 375 px breit, Kopf bei 1 440 px unverändert 62 px |
| **N1** rohe englische Fehler | `lib/fehlertext.js` (rclone-Logzeilen, Google-API-Gründe, JS-Fehler; Satzanfang bleibt) — Server-`satz` und `ui.js` | `drive-hand`: Verschieben ins nicht beschreibbare Ziel meldet deutsch ohne Logzeile |
| **N2** Prompt-Kennung `constructor` | `Object.hasOwn` in `promptstore.js` und `/api/ai(/stream)` | `api`: `constructor`, `toString`, `__proto__`, `hasOwnProperty` → 400, nichts in Drive |
| **N3** keine Größengrenze | `readBody` 20 MB → 413 | `api`: 30 MB → 413, Server lebt |
| **N4** Drehtermin zählt Gelöschte | Löschen trägt die Karte aus `karteIds` aus; Zähler zählen nur vorhandene Karten | Browser: „1 Karte" → nach Löschen „noch keine Karten", `karteIds: []` |
| **N5** leere Format-Datei | „Inhalt nach Drive speichern" speichert ohne Inhalt unter der Überschrift nichts | Bildschirmfoto: Befund-Toast, kein `10_slider.md`, Tor bleibt zu |
| **N6** Kampagnen-Datum rollt | `leseRegel`: Tag muss existieren (29.02. → nächstes Schaltjahr), Befund je Zeile | `logik`: 31.04./13.13. ohne Datum, 29.02. → 2028-02-29, Tabelle nennt die Zeile; Selbsttest 40/40 |
| **N7** NaN-Daten | über H1 + `istIsoDatum`, Vorlauf nur ganze Tage 0..365, ungültige Drehtermine ignoriert | `logik`: Fristen-Kette in allen Kombinationen gültig, kein NaN |
| **N8** widersprüchliche Umbenennen-Meldung | Abgleich erkennt dieselbe Karten-id: „Ordner wurde in Drive umbenannt: alt → neu" | `drive-hand`: eine Karte, neuer Name, Meldung „umbenannt" |
| **N9** Warteschlangen-Stau ohne Verbindung | nach verbrauchten Wiederholungen 30 s lang nur ein Versuch je Aufruf | Code-Prüfung; im Schein-Drive nicht auslösbar (Verbindung fehlt dort nie) |
| **N10** DEP0190 | feste Befehlstexte statt Argumentliste bei `shell: true` (Teile fest bzw. per Erlaubtliste) | echte Claude-CLI ohne Warnung |

**Neuer Befund unterwegs (behoben):** Das Spiegeln nach dem Speichern schrieb `projekt.json` blind an den
erwarteten Pfad — hatte Ben den Ordner in Drive von Hand verschoben oder gelöscht, entstand am alten Ort wieder eine
Hülle (bis zum nächsten Abgleich, bis zu 30 Minuten). Jetzt schreibt es nur in einen Ordner, der noch dort liegt
(`drive-hand`, Fälle „von Hand gelöscht/umbenannt").

**Unabhängige Gegenprüfung (08.10.2026, nach Commit `b41c3c3`):** Ein zweiter Prüfer las den ganzen Umbau gegen und
fand sieben Stellen, die die Tests nicht erfassten. Alle sind behoben:

| Fund | Fix | Beleg |
|---|---|---|
| Abbruch eines KI-Laufs mit großem Prompt konnte per EPIPE den Server beenden (kein `stdin`-Fehler-Listener) | `child.stdin.on("error")` in `ai.js` (3×), `drive.js`, `claudeauth.js`, `codexauth.js` | echte Claude-CLI, ~400-KB-Prompt, Abbruch nach 30 ms: „abgebrochen", kein Absturz |
| Hülle in den Papierkorb ohne erneute Prüfung unter der Sperre — ein gleichzeitiges Verschieben konnte den vollen Ordner in den Papierkorb legen | Inhalt unter `mitKarte` erneut lesen, nur bei reinen Board-Dateien verschieben | Code-Prüfung (Zeitfenster nicht verlässlich nachstellbar) |
| Ordnerwechsel außerhalb der Board-Reihe — ein Tab konnte danach das neue Board mit alten Karten überschreiben | Sichern, Lesen, Umstellen, Schreiben in einem Schritt von `boardReihe` | Code-Prüfung (Ordnerwechsel braucht die Drive-API) |
| Zwei gleichzeitige KPI-Läufe konnten Messungen zurückdrehen | `kpiUebernehmen` hängt nur die in diesem Lauf neuen Messungen an (je Plattform und Intervall) | Einzeltest: beide Messungen bleiben erhalten |
| Upload legte nach gleichzeitigem Verschieben einen Doppel-Ordner an | Zielordner erst nach dem Upload unter der Karten-Sperre frisch bestimmen | neuer Test `wettlauf`: gegen `b41c3c3` BEF (zwei Ordner), jetzt ok |
| Eine Drive-Störung bei einer Karte brach den ganzen Abgleich ab | `ordnerDaOderBefund`: Befund für diese Karte, Rest läuft weiter | Code-Prüfung (Schein-Drive kennt keine Störung) |
| `projekt.json` mit BOM galt als beschädigt; Mehrbyte-Zeichen an Blockgrenzen der rclone-Ausgabe | BOM vor dem Parsen entfernen; rclone-Ausgabe als UTF-8 dekodieren | neuer Test `drive-hand`: gegen `b41c3c3` BEF, jetzt ok |

**Entschieden ohne Umbau:** Dark Mode gibt es weiterhin nicht (v114: nur Info, kein Befund).

**Nur per Code geprüft, nicht im Test ausgelöst** (Vollständigkeits-Check 08.10.2026):
1. Post-Zuordnung und KPI-Übernahme auf den neuesten Stand (M1) — Instagram/LinkedIn sind in der Testkopie nicht verbunden.
2. Drive-Störung beim Lesen einer `projekt.json` („diesmal nichts ändern") — der Schein-Drive kennt keine Störung außer „fehlt".
3. „Karte beschädigt"-Kachel — seit der Typ-Härte erreicht keine kaputte Karte mehr das Zeichnen; die Kachel ist die zweite Sicherung.
4. N9 (schneller Fehler ohne Verbindung) — im Schein-Drive fehlt die Verbindung nie.
5. Ein schon gespeicherter unerfüllbarer Abstand (nur per Handbearbeitung möglich): der Planer setzt ihn beim Rechnen aus, statt alle Termine nach 2024 vorzuziehen; die Sperre greift beim nächsten Speichern.

**Folgepflichten:** `projekt.kaputt-*.json` bleiben in `(AI only)` liegen, bis jemand sie löscht (bewusst — sie sind
die Sicherung); Hüllen landen im Papierkorb wie gelöschte Karten. Ein automatisches Aufräumen beider gibt es nicht.

## Belege (Befehle)

- `node tools/hart/lauf.mjs --zip-gross` → logik 43 · api 32 · wettlauf 19 · drive-hand 20 · zip 9 · ki 4 = **127 ok, 0 Befunde** (08.10.2026, nach der Gegenprüfung).
- `node tools/tore-selbsttest.mjs` → 22/22 · `node tools/kampagnen-selbsttest.mjs` → 40/40.
- Bildschirmfotos (Edge headless gegen eine `tools/hart`-Kopie, Browser-Bereich lehnt das selbstsignierte Zertifikat ab): Board 1 440 px, Kopfzeile 960/375 px, Abstand-Sperre, leerer Slider, Drehtermin-Zähler.

## Launch-Urteil (08.10.2026, nach v115)

**Aus Sicht aller Tests startklar.** Die 22 Befunde aus v114, ein unterwegs gefundener und sieben aus der unabhängigen Gegenprüfung sind behoben und
wiederholbar belegt. Offen bleibt, was nur am echten System prüfbar ist (unten).

## Stand

08.10.2026 — gebaut, mit `tools/hart`, Bildschirmfotos und einer unabhängigen Gegenprüfung abgenommen, Doku nachgezogen (`docs/architektur.md`,
`README.md`, v114-Bericht verweist hierher). Das Live-Board muss neu gestartet werden, damit v115 läuft.

## Nur am echten System prüfbar (Owner)

1. Live-Board neu starten (`Start-Board.cmd`), danach einmal „Alles abgleichen" — der erste Abgleich repariert vorhandene Karten mit falschen Typen und legt ggf. Sicherungen an.
2. Drive-Wurzel kurz umbenennen, eine Karte verschieben, Meldung ansehen, zurückbenennen (Schein-Drive legt eine fehlende Wurzel neu an).
3. Einen echten großen Rohmaterial-Ordner als ZIP laden.
4. Unverändert aus v112: Drive-API-Funktionen (Umbenennen, Ordner-Link, geteilte Ablage, Kontowechsel), OAuth live, KPI, Codex-Weg.

## Definition of Done

- [x] Jeder der 22 v114-Befunde: behoben mit Beleg aus `tools/hart` oder Bildschirmfoto (N9: Code-Prüfung, im Schein-Drive nicht auslösbar)
- [x] `tools/hart` läuft ohne echte Daten und ohne echtes Drive und räumt hinter sich auf (0 Temp-Ordner übrig)
- [x] Selbsttests grün, Doku synchron, Commit per Pfad + Push

Geprueft gegen: `node tools/hart/lauf.mjs --zip-gross` (127 ok), unabhängige Gegenprüfung (7 Funde, behoben), Selbsttests 22/22 und 40/40, echte Claude-CLI, lokales Ollama, Bildschirmfotos 1 440/960/375 px · Offen: Live-Board-Neustart und Echt-Drive-Prüfungen (Owner, Liste oben)
