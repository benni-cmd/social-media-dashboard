# v112 — Finaler A-bis-Z-Abnahmetest vor dem Launch

> Owner-Auftrag 06.10.2026. Reiner Test- und Bericht-Auftrag: nichts umgebaut, nur geprüft, belegt und je
> Befund ein Fix vorgeschlagen. Prüf-Landkarte: `docs/architektur.md` (Stand v109) + Pakete. Getestet am
> Code-Stand `ab66f01` (v78 Phase B+D und v110 enthalten, beide laut Paket gebaut; keine Session lief parallel).

## PIG

**Problem:** Das Board ist über 110 Pakete gewachsen und wurde nur paketweise geprüft. Ob es als Ganzes —
Einrichtung, jeder Bedienschritt, jede Automation — fehlerfrei läuft, war nicht belegt.

**Intent:** Vor dem Launch wissen, was kaputt ist und was zuerst repariert werden muss, mit Beleg und
konkretem Fix je Befund, damit danach gezielt repariert statt erneut gesucht wird.

**Goal:** Ein priorisierter Befund-Katalog (BLOCKER / HOCH / MITTEL / NIEDRIG) mit Soll · Ist · Beleg ·
Fix-Vorschlag, eine ok/Befund-Zeile je Funktion und Automation und ein Launch-Urteil mit Blocker-Liste.

> **Stand 07.10.2026:** Alle Befunde außer N3 (Tastaturbedienung, vom Owner zurückgestellt) sind in
> [`v113-fixes-aus-abnahmetest.md`](v113-fixes-aus-abnahmetest.md) gebaut und isoliert belegt — mit 25 Owner-
> Entscheidungen, wo es Produktfragen waren. Der zweite, harte Prüfdurchlauf steht in `v114-harter-nachtest.md` (Launch-Urteil dort aktueller).

## Launch-Urteil (06.10.2026, vor v113)

**Nicht startklar.** Ein Blocker und neun hohe Befunde. Der Blocker zerlegt bei jedem Phasenwechsel die
Projektordner in Drive (Drive ist die Wahrheit — damit ist die Wahrheit kaputt) und lässt gelöschte Karten
zurückkehren. Vor dem Launch zu reparieren, in dieser Reihenfolge (kleinste und folgenreichste zuerst):

1. **H8** Server nur auf `127.0.0.1` lauschen lassen (eine Zeile, Sicherheit)
2. **H1** Tor „Fokus und Hook" auf die echten Felder umstellen (eine Zeile, Kernablauf)
3. **B1** Phasenwechsel zerlegt Projektordner (Kern der Drive-Wahrheit)
4. **H2** Upload-Vorschlag und Dreh-Frist auf dieselbe Rechnung bringen
5. **H4 · H5 · H6** Geisterkarten, gefährlicher „Kopie entfernen"-Rat, Titel-Doppelvergabe
6. **H3 · H7 · H9** Render-Schleife, CTA-Tor gegen KI-Caption, lokale KI 5 min

Was danach bleibt, ist Komfort (MITTEL/NIEDRIG) und darf nach dem Launch kommen.

## Testumgebung und Daten-Sicherheit

| Phase | Aufbau | Zweck |
|---|---|---|
| A — reale Daten, Drive aus | Kopie von `server.js`, `lib/`, `public/` + Cache aus `data/` (`board.json` mit 20 echten Karten, Plan, Prompts, Kontext …) im Session-Scratchpad, `PORT=4399`, `drive-root.json` ungültig, `RCLONE_CONFIG` auf fehlende Datei, danach „Token abgelaufen" simuliert (`invalid_grant`, 0,29 s je Aufruf) | Start-Tor, Fehlerwege ohne Drive, Ampel an echten Karten |
| B — frische Installation, Schein-Drive | leere Kopie (nur Zertifikat), rclone-Remote `gdrive` als **Alias auf einen Scratchpad-Ordner** (`type = alias`) — jede rclone-Operation des Boards läuft echt, nur gegen eine lokale Ablage | Einrichtung von Null, kompletter Kartenlauf Idee → Fertig mit echten Test-Dateien, Löschen, Abgleich |

- Keine Zugangsdaten kopiert (`.env`, `data/tokens.json`, `data/.gdrive-env.json` blieben im Projekt).
- Echtes Drive wurde **nicht** berührt: Der Zugriff über Bens Drive-Zugang wurde vom Berechtigungs-Wächter
  abgelehnt; stattdessen das Schein-Drive. Folge: alles, was direkt die Google-Drive-API nutzt (nicht rclone),
  ist unten als „nur durch Owner prüfbar" markiert.
- KI lief echt: Claude-CLI (Bens Abo, token-frei), Ollama lokal, DuckDuckGo-Suche. Codex ist nicht installiert.
- Alle Testkarten/-dateien heißen „TEST v112 …" und lagen nur im Scratchpad; nach dem Test gelöscht.
- **Eigener Testfehler, offengelegt:** Ich hielt die leeren Ordner-Hüllen nach dem ersten Phasenwechsel zuerst
  für ein Artefakt des lokalen rclone und habe zwei davon per Skript entfernt. Die rclone-Probe danach hat das
  widerlegt (siehe B1); der zweite, unberührte Durchlauf (Caption → Upload → Fertig → Löschen) belegt den
  Befund ohne mein Zutun.

## Befunde

Je Befund: Soll · Ist · Beleg · Fix. Zeilennummern am Stand `ab66f01`.

### BLOCKER

**B1 — Phasenwechsel zerlegt den Projektordner; gelöschte Karten kehren zurück**
- **Soll:** Beim Spaltenwechsel wandert der Projektordner vollständig in den neuen Phasenordner
  (`docs/drive-convention.md`, `lib/drive.js:608` „move räumt den Quellordner selbst ab").
- **Ist:** `PUT /api/board` spiegelt die verschobene Karte sofort im Hintergrund an den **neuen** Pfad
  (`server.js:722-731` → `projects.spiegeleKarte`, `lib/projects.js:374`: `mkdir …/(AI only)` + `projekt.json`
  + `Steckbrief.md`). Erst danach kommt `POST /api/drive/move` → `moveDir` in ein **schon existierendes** Ziel.
  rclone verschiebt dann Datei für Datei und lässt die alte Ordner-Hülle stehen. Beim nächsten Wechsel nimmt
  `findeOrdner` (`lib/projects.js:194`, sucht in Phasen-Reihenfolge) die **leere Hülle der früheren Phase** und
  verschiebt sie — die echten Dateien bleiben liegen.
- **Beleg:**
  - rclone-Probe: Ziel fehlt → sauber verschoben, keine Hülle; Ziel existiert → Hülle `C/Proj/{Leer,Sub}` bleibt.
  - Durchlauf im Schein-Drive ohne Eingriff: nach Upload → Fertig lagen 2 Videos, Rohclip, `10_skript.txt`,
    `30_caption.md` in `In Bearbeitung/6 Upload/…`; nach `Videoauswertung/…` wanderte nur die leere Hülle aus
    `5 Caption`. Davor (erster Durchlauf): `10_skript.txt` in „3 Videodreh", Rohclip in „4 Schnitt", Videos in
    „5 Caption".
  - Löschen verschob wieder die Hülle (`Papierkorb/TEST v112 Regenwuermer im Hochbeet__2026-10-06T18-17-55-046Z`
    ohne Dateien); der nächste Abgleich meldete „In Drive lag … ohne Karte im Board. Die Karte wurde angelegt."
  - **Echtes Drive:** Der Code-Kommentar zu v87 hält am 30.09.2026 fest: „4 Projekte doppelt, Kopien ohne
    Inhalt" (`lib/projects.js:430-431`) — genau diese Hüllen.
- **Fix:**
  1. `server.js:722-731`: Karten, deren `column` sich gegenüber dem Cache geändert hat, **nicht** spiegeln —
     `verschiebe` schreibt `projekt.json` und Steckbrief am Ziel ohnehin selbst (`lib/projects.js:316-317`).
  2. `lib/drive.js:611`: `--delete-empty-src-dirs` ergänzen, damit auch ein dateiweiser Move keine Hülle lässt.
  3. `lib/projects.js:194` `findeOrdner`: bei mehreren Treffern den Ordner nehmen, dessen `projekt.json` die
     Karten-`id` trägt, sonst den mit Dateien.
  4. Abgleich: leere Hüllen (keine Datei im Baum) als solche erkennen und still entfernen statt „doppelt" melden.
  5. Einmal-Reparatur für Bens Drive: Hüllen suchen und zusammenführen (Skript, Owner-Freigabe).

### HOCH

**H1 — „Weiter" in „Skript schreiben" ist dauerhaft gesperrt**
- **Soll:** Nach Fokus, verbalem und sichtbarem Hook plus Skript-Datei ist „Weiter zu Drehtermin festlegen" frei.
- **Ist:** Das sperrende Tor prüft `card.chosenHook` (`lib/pipeline.js:1109`) — das Feld wird nirgends gesetzt
  (`grep chosenHook` → nur diese Zeile); die Oberfläche setzt `chosenVerbal`/`chosenVisuell`
  (`public/detail.js:1199-1295`). Die Meldung „Fokus und Hook sind noch nicht gewählt" steht auch, wenn alles gewählt ist.
- **Beleg:** Testkarte mit Fokus „Praktische Anleitung", beiden Hooks und Skript: Detail zeigte vor dem Speichern
  „Noch zu tun … Fokus und Hook sind noch nicht gewaehlt", Knopf `disabled`. Weiter ging es nur über die
  Automation „Skript speichern und weiter" (prüft keine Tore, `public/detail.js:1430-1460`).
- **Fix:** `lib/pipeline.js:1109`: `const gewaehlt = card.chosenFokus != null && card.chosenVerbal != null && card.chosenVisuell != null;`

**H2 — Board schlägt Upload-Termin vor, zu dem der Drehtermin dann „zu spät" ist**
- **Soll:** Ein vorgeschlagener Upload ist machbar (v89: „keine Deadline in der Vergangenheit").
- **Ist:** „Nächster freier Upload" = nächster Drehtermin **+ 8** (`lib/pipeline.js:723`, Regel aus v37);
  die v70-Sperre erlaubt einen Dreh nur bis Upload **− 12** (`spaetesterDreh`, Kette 3 + 3 + 6). Der eigene
  Vorschlag macht den nächsten Drehtermin unzuweisbar.
- **Beleg:** Frisches Board, Auto-Drehtermin So 18.10.; Vorschlag „27.10.2026"; Drehtermin 18.10. zuordnen →
  „Der Drehtermin am 18.10.2026 liegt zu spaet — spaetestens am 15.10.2026". Erst ein von Hand angelegter
  Drehtermin 14.10. ging.
- **Fix:** `lib/pipeline.js:735-739`: `fruehesterUpload` = nächster Drehtermin + `kumuliert().dreh` (dynamisch mit
  dem Deadline-Vorlauf); `UPLOAD_NACH_DREH_TAGE` streichen, Kommentar und README-Abschnitt „Termine" nachziehen.

**H3 — Endlosschleife bei offener Idee-Karte ohne Upload-Datum**
- **Soll:** Eine offene Karte erzeugt im Leerlauf keine Drive-Zugriffe.
- **Ist:** `blockTermineIdee` ruft bei jedem Zeichnen `ladePlan()` (`public/detail.js:818`) → `ladeAnstehende()`
  (`public/store.js:739`) → `zeichne()` (`public/store.js:758`) → Detail neu → wieder `ladePlan()`.
- **Beleg:** gemessen über `/api/ereignisse` (Differenz der Ereignis-IDs): Karte offen **261 Ereignisse in 10 s**
  (37 Zyklen: je 2× `rclone cat` der Kampagnen-CSVs + Plan-Spiegel), Detail geschlossen **0 in 10 s**. Mit echtem
  Drive belegt das die serielle rclone-Warteschlange dauerhaft — jeder Move/Speichern wartet dahinter.
- **Fix:** In `blockTermineIdee` den geladenen Plan `S.plan` nutzen und nur laden, wenn er fehlt; `ladeAnstehende`
  nur neu zeichnen, wenn sich `S.anstehend` geändert hat.

**H4 — Geisterkarten aus Systemordnern**
- **Soll:** Nur Projektordner werden Karten.
- **Ist:** Der Abgleich behandelt `Videoauswertung/Auswertung-Tabellen` (und `Videoauswertung/KPI`) als Projekt,
  legt eine Karte an und schreibt `projekt.json` + `Steckbrief.md` in den Systemordner (`lib/projects.js:515-537`).
- **Beleg:** frisches Board — nach dem ersten KPI-Lauf erschien „Auswertung-Tabellen @fertig". Bens echter Cache
  (`data/board.json`): Karten „KPI @fertig" und „Auswertung-Tabellen @fertig" (v80 C1 nannte sie Testkarten).
- **Fix:** Namensliste der Systemunterordner (`KPI`, `Auswertung-Tabellen`) in `lib/pipeline.js` neben
  `SYSTEM_ORDNER` und in `lib/projects.js:420-433` überspringen; die beiden Karten in Bens Board danach löschen.

**H5 — Abgleich rät zum Löschen echter Daten**
- **Soll:** Ein Hinweis auf doppelte Ordner führt zu einem sicheren Schritt.
- **Ist:** „Projektordner doppelt … Bitte in Drive eine Kopie entfernen." (`lib/projects.js:448`). Durch B1 enthält
  jede „Kopie" andere echte Dateien.
- **Beleg:** Meldung für „3 Videodreh"/„4 Schnitt"/„5 Caption" — dort lagen Skript bzw. Rohclip bzw. Videos.
- **Fix:** Satz ändern auf „zusammenführen", je Kopie die Dateien nennen; nach B1-Fix leere Hüllen automatisch weg.

**H6 — Zwei Karten mit gleichem Titel teilen sich einen Ordner**
- **Soll:** Jede Karte hat ihren eigenen Projektordner.
- **Ist:** Der Ordnername kommt aus dem Titel; `findeOrdner` sucht nur nach Namen. Die zweite Karte übernimmt den
  Ordner der ersten und überschreibt deren `projekt.json`.
- **Beleg:** zwei Karten „TEST v112 Schleife": `2 Skript/TEST v112 Schleife/(AI only)/projekt.json` trug danach
  `"id": "cmux06usasu5b"` (zweite Karte) statt `cmux057trpmxg`.
- **Fix:** beim ersten Anlegen (`lib/projects.js` `anlegen`/`verschiebe`) prüfen, ob der Name belegt ist und einer
  anderen `id` gehört → Zusatz „ (2)" und `driveName` sofort speichern; `findeOrdner` mit `id`-Prüfung (siehe B1.3).

**H7 — KI-Caption besteht das eigene CTA-Tor nicht**
- **Soll:** Ein KI-Vorschlag erfüllt die Tore der Caption-Phase.
- **Ist:** Feld und Prompt verlangen „genau einen Aufruf, indirekt formuliert"; `ctaAnzahl`
  (`lib/pipeline.js:1035-1042`) erkennt nur Verben (kommentier, schreib uns, folg, teil, speicher, schick, spend,
  Link in Bio). Eine Frage zählt nicht.
- **Beleg:** KI lieferte „Wie sieht es bei deinem Hochbeet aus? Sitzt da noch Leben drin?" → „Es steht kein Aufruf
  zum Handeln im Text", „Weiter zu Upload" gesperrt; erst „Schreib uns, …" öffnete. Die Standard-Vermeidungsliste
  (v110) enthält zudem „Anbiedernde Schlussfragen".
- **Fix:** Steht etwas im eigenen CTA-Feld (`card.cta.text`), zählt es als ein Aufruf; Muster nur noch für
  „mehrere Aufrufe" im Fließtext nutzen. Alternativ Caption-Prompt auf ein ausdrückliches Verb festlegen.

**H8 — Server ist im lokalen Netz erreichbar, ohne Anmeldung**
- **Soll:** Nur der eigene Rechner erreicht das Board (`docs/architektur.md` Abschnitt 4: „darf nie ungeschützt ins Netz").
- **Ist:** `server.listen(PORT, …)` ohne Host bindet alle Schnittstellen (`server.js:2221`).
- **Beleg:** `curl -k https://192.168.0.131:4399/api/board` → `200` (LAN-Adresse dieses Rechners). Wer im selben
  WLAN ist, kann Karten lesen/löschen, `.env`-Schlüssel setzen (`PUT /api/config/env`) und KI über Bens Abo
  auslösen — sofern die Windows-Firewall node.exe durchlässt (ungeprüft).
- **Fix:** `server.listen(PORT, "127.0.0.1", …)` — OAuth-Rückrufe gehen ohnehin an `localhost`.

**H9 — Lokale Recherche dauert über 5 Minuten**
- **Soll:** KI-Knöpfe liefern in vertretbarer Zeit (Claude-Schritte 16–90 s).
- **Ist:** Ollama lädt `deepseek-r1:14b` mit 131 072 Token Kontext: 35 GB, 56 % CPU / 44 % GPU (`ollama ps`).
  Das Board spricht Ollama über die OpenAI-kompatible Schnittstelle (`lib/ai.js:1099`) und kann so keinen
  `num_ctx` setzen; Ollama 0.34.3 nimmt dann den großen Standard.
- **Beleg:** Recherche-Kette gesamt ≈ 5,3 min: Claude 19 s → DuckDuckGo 2× 1 s → **Ollama 276 s** → Claude 21 s
  (`/api/ereignisse`). Die Oberfläche zeigte 3,5 min lang „Modell laedt …".
- **Fix:** Ollama über `/api/chat` mit `options.num_ctx: 8192` ansprechen oder `OLLAMA_CONTEXT_LENGTH=8192` in
  `Start-Board.cmd` setzen; danach neu messen.

### MITTEL

**M1 — Detailspalte und Board-Ampel widersprechen sich.** Detail-Termin nutzt `faelligkeit()` mit dem Cache
`card.dates[termin]` und Schwellen ≤ 1/≤ 3 Tage (`lib/pipeline.js:280-312`, `public/detail.js:608`); der Board-Punkt
rechnet live mit ≤ 2/≤ 5 (`ampel()`). An Bens echten Karten (Cache-Kopie): **4 von 6** Karten in „Drehtermin
festlegen"/„Videodreh" zeigen im Detail „Für Drehtag ist kein Datum gesetzt", obwohl ein Drehtermin zugeordnet
ist — z. B. „Boden wie ein Schwamm": Board rot (Dreh 13.09. überfällig). „Nächster Schritt" sortiert ebenfalls nach
`faelligkeit` (`public/app.js:111`). **Fix:** Detail und „Nächster Schritt" auf `ampel()`/`dringlichsteFrist()` mit
aufgelöstem Drehtermin umstellen; `faelligkeit()` entfernen.

**M2 — Kontextmenü „Weiter zu …" umgeht alle Tore.** `public/kontextmenu.js:163` ruft `schiebe` ohne `sperren()`.
Beleg: Karte ohne Fokus/Hook/Skript per Rechtsklick nach „Drehtermin festlegen". Das v75-Skript-Tor ist damit
umgehbar, obwohl der gleichnamige Detail-Knopf gesperrt ist. **Fix:** dieselbe Tor-Prüfung wie im Detail, oder den
Eintrag „Verschieben nach …" nennen (Ziehen bleibt bewusst ungeprüft).

**M3 — Einrichtung: „Weiter" ohne Rückmeldung.** Bei offenem Schritt zeigt „Weiter" denselben Schritt wieder
(`public/einrichtung.js:417-418`). Beleg: 13 Klicks auf „Weiter" bei „Google Drive verbinden", nichts erklärt. **Fix:**
Zeile „Noch nicht erledigt — erst ‚Verbinden', oder ‚Später'".

**M4 — Assistent öffnet bei jedem Start, solange Google übersprungen ist.** Google zählt zu den lokalen Pflicht-
schritten (`public/einrichtung.js:261`); „Später" gilt nur für die Sitzung. Beleg: nach Reload wieder „Schritt 11
von 11 · Google Kalender + Tasks verbinden". Für Bens bewusst verschobenes Google (Memory v44) bei jedem Start ein
Dialog. **Fix:** Google optional machen oder „Später" als „bewusst ausgelassen" in `einrichtung-lokal.json` merken.

**M5 — Start-Tor hängt bei gestörtem Drive.** `GET /api/einrichtung/stand` liest `einrichtung.json` aus Drive auch
dann, wenn die lokale Datei schon „nicht fertig" sagt (`server.js:1644-1656`). Beleg: fehlende rclone-Config
**38,97 s** Sperre (`curl -w %{time_total}`), abgelaufenes Token 7,5 s bis zum Assistenten. **Fix:** Drive-Lesen
überspringen, wenn `lokal.fertig` falsch ist; Timeout 5 s statt 15 s.

**M6 — Drive-Fehlermeldungen roh oder leer.** Sichtbar waren „CRITICAL: Failed to create file system for "gdrive:":
didn't find section in config file … [config-schnappschuss: DATEI FEHLT]" bzw. „verschieben ging nicht: rclone endete
mit Code 1". `lib/drive.js:356` verwirft alle NOTICE-Zeilen — dort steht bei abgelaufenem Token die Ursache
(`invalid_grant`). **Fix:** bekannte Ursachen übersetzen („Google-Anmeldung abgelaufen — Einstellungen → Google →
Konto wechseln"), NOTICE nur für den client_id-Hinweis filtern.

**M7 — Meldungsstapel verdeckt Detailspalte und Board.** Bis ~10 Toasts rechts übereinander, teils halbtransparent,
über Termin- und Arbeitsbereich; „Drehtermin … zu spät" stand über 30 min (Screenshots im Test). **Fix:** höchstens
3 sichtbar, Erfolgsmeldungen nach 4 s weg, Stapel nicht über `#detail`.

**M8 — „Verbinden" ohne App-Daten endet auf roher Fehlerseite.** `public/auswertung.js:366` und `public/ui.js:1819`
laden `/api/auth/<plattform>` als Seite; ohne `.env`-Einträge antwortet der Server `500 {"error":"INSTAGRAM_APP_ID
fehlt in .env"}` (gleich für LinkedIn, Google). **Fix:** vorher `clientKonfiguriert` prüfen und sonst in den
passenden Einstellungs-Tab führen.

**M9 — Upload-Phase ohne Instagram sagt Falsches.** „Jetzt nach Posts suchen" → „0 Posts geprüft: 0 zugeordnet";
„Post von Hand wählen" → „Keine freien Posts gefunden (alle sind schon Karten zugeordnet)". **Fix:** „Instagram ist
nicht verbunden — Einstellungen → Social Media".

**M10 — Prompt „Auf Standard zurücksetzen" ohne Rückfrage.** Die eigene Fassung des System-Vorspanns war nach einem
Klick weg (`public/ui.js:2288`, `:2372`). **Fix:** `bestaetigen()` davor.

**M11 — Einstellung „Ampel-Schwellen" ist registriert, aber tot.** `lib/workflows.js:166` mit Parametern, verweist auf
`setAmpelSchwellen` — existiert nicht; die Schwellen sind fest (`lib/pipeline.js:330`). **Fix:** Eintrag entfernen.

**M12 — Kategorie-Verteilung trifft den Plan nicht.** Soll 50/30/20 % (Bildung/Spendenaufruf/Umfrage), Ist über 39
Slots 41/31/28 % (`uploadslots.planSlots(plan, 3)`, Testskript `slot-probe.mjs`). **Fix:** Auswahl in
`lib/scheduler.js` nach größtem Rest-Defizit statt der jetzigen Gewichtung; mit Probe gegen ± 5 % absichern.

**M13 — Slot-Datei in Drive veraltet bei Änderung des maximalen Abstands.** Der Fingerabdruck
(`lib/planstore.js`, `configFingerprint`) enthält `maxAbstandTage` nicht; Beleg: Grenze 4 Tage gespeichert, Drive-
Datei `redaktionsplan.slots.json` zeigt weiter eine 6-Tage-Lücke (07.10. → 13.10.), `planAbgleich.neuGerechnet:
false`. Die Board-Rechnung selbst hält die 4 Tage ein. **Fix:** Feld in den Fingerabdruck.

### NIEDRIG

1. **Skript-Tor zu großzügig:** jede Datei mit „skript" im Namen zählt — „Transkript Interview.txt" öffnet das Tor
   (`lib/pipeline.js:1060`). Fix: Wortanfang `/(^|[_\s-])skript/i`.
2. **Plattform-Tor kann nie sperren:** `migriere`/`normalisiere` setzt leere Plattformen auf Instagram
   (`lib/pipeline.js:~939`); neue Karte zeigt im Browser zuerst keine Plattform, nach Reload Instagram. Fix: leere
   Liste erlauben, Tor greift.
3. **Barrierefreiheit:** Typ-/Kategorie-/Ziel-/Plattform-Schalter fehlen im Accessibility-Baum (nur per Maus).
4. **Einrichtung:** Abschluss zeigt „✓ ChatGPT anmelden", obwohl der gewählte Weg es nicht braucht; 15 Prompts
   einzeln bestätigen, kein „alle übernehmen"; Aufgabe `anlass_ideen` fehlt in der Reihe.
5. **Stille Korrekturen:** max. Abstand −3 wird ohne Hinweis zu 0 (= keine Grenze).
6. **Toter Code:** `PUT /api/plan/slot` sucht Slots in der Plan-Config (seit `.slots.json` leer) → immer 404;
   `store.slotBelegen` ohne Aufrufer (`server.js:826-835`, `public/store.js:766`).
7. **Anleitungen nennen fest `https://localhost:4321/...`** als Redirect (Google/Instagram/LinkedIn), auch bei anderem Port.
8. **WEE-Spezifisches im fremden Board:** Hashtag-Platzhalter „#WorldEdenEra #ProjectOasis", Aktionstage-Themen
   „Recycling in Deutschland" in jeder neuen Installation.
9. **Doku:** Skript heißt `10_skript.txt` (`lib/pipeline.js:841`), Doku/Steckbrief sagen `.md`; `architektur.md`
   behauptet „Automationen je einzeln abschaltbar unter Einstellungen" — der Tab ist seit v41 (`063aa41`) entfernt.
10. **„Zeigen, was die KI bekommt"** zeigt nur den Firmenkontext, nicht den Stil-Block (v110), obwohl
    `/api/kontext/probe` ihn liefert.
11. **OAuth ohne `state`-Parameter** (Google/IG/LI-Start, `server.js:1437ff`) — CSRF-Schutz fehlt.
12. **Beenden entlädt alle Ollama-Modelle**, auch die anderer Programme (z. B. LAUI) (`server.js:2196`).
13. **Optik:** Drehtermin-Pille oben links hat einen eigenen Scrollbalken; die Drehtermin-Auswahl bietet zu späte
    Termine klickbar an (Sperre erst nach Klick).
14. **`driveName` nach Kontextmenü-Verschieben** nur im Browser gesetzt, nicht gespeichert (`public/store.js:426`).
15. **Nach „Board zurücksetzen"** legt der Auto-Drehtermin sofort einen Termin an, obwohl kein Ordner gewählt ist;
    `LIESMICH.md` nennt Papierkorb, Kontext und Kampagnen nicht.

## Ergebnis je Funktion und Automation

### Einrichtung (frische Installation, Schein-Drive)

| Schritt | Ergebnis |
|---|---|
| Start-Tor: Sperre bis zur Entscheidung, nie bedienbar dazwischen | ok (Sperre ab 45 ms, Assistent ohne Lücke) · M5 bei gestörtem Drive |
| Google Drive verbinden | Status ok · M3 · „Verbinden" (rclone-Login) nur durch Owner prüfbar |
| Projektordner wählen (leer/Unsinn/Docs-Link/Ordner-Link) | ok — 400 mit Satz bzw. „leer — Struktur wird angelegt"; Struktur angelegt |
| Board-Name | Entwurf ok · Umbenennen in Drive nur durch Owner prüfbar (Google-API) |
| KI-Weg (Claude/ChatGPT/nur Cloud/nur lokal) | ok — alle vier setzen die Rollen korrekt |
| Claude / Ollama | ok — bei Bereitschaft übersprungen |
| Firmenkontext (Pflichtfelder) | ok — Leer-Meldung |
| System-Prompts | ok · N4 |
| Redaktionsplan aus dem Assistenten | ok |
| Google Kalender + Tasks | M4 · Verbinden nur durch Owner |
| „Speichern und loslegen" mit Log je Teil | ok (Firmenkontext 0,5 s, Rollen 0,2 s; Fehlschlag bleibt im Entwurf) |
| Board zurücksetzen, denselben Ordner wieder wählen | ok — Board aus Sicherung wiederhergestellt |

### Board-Grundnutzung

| Funktion | Ergebnis |
|---|---|
| Karte anlegen, Felder, Stammdaten klappen ein | ok · N2 |
| Weiter (Detail) mit Tor-Begründung | ok in Videodreh/Schnitt/Caption/Upload · **H1** in „Skript schreiben" |
| Kontextmenü (7 Einträge) | ok · M2 |
| Phasenwechsel (Ordner wandert) | **B1** |
| Verwerfen → `Verworfen/` | ok |
| Löschen → Papierkorb mit Bestätigung und Zeitstempel | Ablauf ok · **B1**-Folge: Karte kehrt zurück |
| Sonderzeichen-Titel (`A/B: "…" ../.. <b>`) | ok — kein Pfadausbruch, kein HTML |
| Gleicher Titel zweimal | **H6** |
| Upload-Termin doppelt vergeben | ok — zweite Karte bekommt den nächsten Slot (22.10. 11:30 / 27.10. 18:30), verworfene Karten blockieren nicht (Probe `naechsterFreierUpload`) |
| Zoom (+/−, gespeichert) | ok — 110 % nach Reload |
| Kopfzeile Anbindungen (API/Drive/Weitere/KI) | ok |
| Meldungen | M7 |
| Reload-Persistenz (Karten, Zoom, Dark Mode) | ok |
| Nebenläufigkeit (Versionskonflikt 409) | ok — „Dein Stand wurde … zusammengeführt" |
| Nächster Schritt | ok (Sortierung M1) |

### Automationen und Tore

| Automation / Tor | Ergebnis |
|---|---|
| Projektordner anlegen (sichtbarer Hook gewählt) | ok — Ordner, 3 Unterordner, Steckbrief, `projekt.json` |
| Skript gespeichert → „Drehtermin festlegen" | ok (prüft keine Tore — siehe H1) |
| v75 Skript-Tor | Logik ok (Tor-Probe) · N1 · per Kontextmenü umgehbar (M2) |
| Drehtermin zuordnen → Videodreh (v70) | ok |
| Zu später Drehtermin gesperrt | ok · **H2** |
| Rohmaterial-Tor (Videodreh → Schnitt) | ok — öffnet nach Upload |
| Fertiges Video → weiter | ok — bleibt mit Begründung bei offenen Untertitel/Wasserzeichen, schiebt bei freien |
| Auto-Drehtermin (Sonntag der Folgewoche) | ok — 18.10. am 06.10. · N15 |
| Rückwärtsplan | ok — Upload 27.10. → Freigabe 24.10., Schnitt 21.10. |
| Deadline-Vorlauf einstellbar, landet in Drive | ok — `workflows.json` (Dreh 4); −2 sichtbar auf 0 |
| Ampel-Punkt | ok (Tor-Probe 2/3/6 Tage) · M1 im Detail |
| Upload-Termin-Regel (v89) | **H2** |
| Max. Abstand (v79) | Board-Rechnung ok (max. 4) · M13 |
| Kalender-Spiegel (gcal-autosync) | nicht geprüft — kein Google verbunden; Drehtermin-Anlage ohne Google ohne Fehler |
| Auto-Shutdown 60 min | nicht geprüft (nicht abgewartet) |

### Detailspalte und KI (echte Aufrufe, token-frei)

| Funktion | Ergebnis |
|---|---|
| Recherchieren und Definieren | ok, Ergebnis lesbar (3 Fokus) · **H9** 5,3 min |
| Verbale / sichtbare Hooks | ok (130 s bzw. 16 s, Claude Haiku) |
| Skript | ok (71 s, „etwa 29 Sekunden Sprechzeit") |
| Caption je Plattform | ok (90 s) · **H7** |
| KI-Fortschritt (schwebendes Terminal) | ok bei Knopf-Aufrufen; bei Auswahl-Klick nicht sicher belegt |
| Fehlerfall: ChatGPT gewählt, Codex fehlt | ok — lesbar mit Installationshinweis |
| Rohmaterial/Video-Upload, ZIP-Download, ungültige Eingaben | ok — 404/400 mit Satz |

### Redaktionsplan, Einstellungen, Auswertung

| Bereich | Ergebnis |
|---|---|
| Plan: Plattformen, Frequenz, Summen-Prüfung (110 % → Meldung, nicht gespeichert) | ok · N5 |
| Plan: nur aktive Kategorien, Links in die Einstellungen | ok |
| Plan: Kategorie-Verteilung | M12 |
| Kampagne anlegen → Tabelle in Drive | ok — `Kampagnen/TEST v112 Kampagne.csv` mit Kopfzeile |
| Anlass-Kalender (Welternährungstag) → Idee → Karte | ok — Upload = Anlass-Tag, Hinweis „Knapp", Knopf verschwindet |
| Termine & Fristen | ok — sofort in Drive |
| Mitteilungen | ok — `defaults.json` `kartenHinweise.likebitte:false` |
| Kategorien & Ziele | ok — „Gespeichert.", wirkt im Plan |
| Unternehmenskontext + Stil & KI-Verhalten (v110) | ok — Freitext in Drive und in `/api/kontext/probe` · N10 |
| Prompts | Speichern ok (`prompts.json` in Drive) · M10 |
| KI-Rollen inkl. Stil-Zusatz je Rolle | ok |
| Google / Social Media | Anzeige ok · M8 · Verbinden nur durch Owner |
| Darstellung (Dark Mode) | ok, optisch geprüft |
| Auswertung ohne Konto | Leerzustand ok · M8 |

### Google (nur Funktion)

| Prüfung | Ergebnis |
|---|---|
| OAuth-Start mit App-Daten | ok — 302 auf accounts.google.com, Kalender + Tasks, `access_type=offline` · N11 |
| `.env`-Whitelist | ok — fremder Schlüssel `PATH` → 400 |
| Status ohne Verbindung | ok — „nicht verbunden" |

## Nur durch den Owner prüfbar (nicht ausgeführt)

1. Funktionen über die Google-Drive-API statt rclone: Board-Name umbenennen, Ordner-Link, Rechte der geteilten
   Ablage (v103), Konto-Anzeige — Zugriff auf echtes Drive war gesperrt.
2. B1 im echten Drive: in den Phasenordnern nach leeren Hüllen von Projekten suchen, die schon weiter sind.
3. Google Kalender + Tasks verbinden, Drehtermin-Einladungen (v44), Kalender-Spiegel — braucht die OAuth-App
   „In Produktion" (Memory v44).
4. Instagram/LinkedIn verbinden, KPI-Messung, Post-Zuordnung mit echten Beiträgen.
5. Langsames Drive (bekannter 20-s-Timeout) und Auto-Shutdown nach 60 min — nicht simuliert bzw. nicht abgewartet.
6. ChatGPT-Weg mit echter Codex-CLI — nur der Fehlerfall „nicht installiert" geprüft.

Grenzen dieses Tests (von mir, nicht vom Owner): Die Browser-Konsole wurde zu Beginn geprüft (keine Fehler), danach
nicht je Schritt — Fehler wurden über DOM, Meldungen, `/api/ereignisse` und die Server-Logs erfasst (Logs ohne eine
Ausnahme, nur erwartete „Kein Projektordner gewählt"-Zeilen vor der Ordnerwahl). Die Wirkung des Mitteilungen-
Schalters auf das „!" an der Karte und der Cursor-Schalter wurden nicht einzeln geprüft.

## Plan

1. [x] Bestand: Architektur, Pakete, Sessions (keine lief), Repo-Stand (sauber, gepusht)
2. [x] Testkopie Phase A (reale Daten, Drive aus), Server 4399
3. [x] Einrichtung von Null (Phase B, Schein-Drive)
4. [x] Board-Grundnutzung
5. [x] Automationen und Tore, kompletter Kartenlauf mit Test-Dateien
6. [x] Detailspalte, KI-Knöpfe
7. [x] Redaktionsplan, Einstellungen (alle 10 Tabs)
8. [x] Auswertung, Anlass-Kalender, Anbindungen
9. [x] Google (nur Funktion), Edge-Cases
10. [~] echtes Drive — ersetzt durch Schein-Drive (Zugriff gesperrt), Rest beim Owner
11. [x] Bericht, Aufräumen, Commit + Push

## Stand

07.10.2026 — Test abgeschlossen, Bericht geschrieben. Testserver beendet, Ollama-Modell entladen, Scratchpad-
Testdaten gelöscht. Keine Produktivdatei geändert.

## Definition of Done

Geprueft gegen:
1. Kompletter Kartenlauf im Schein-Drive (Idee → Fertig → Löschen → Abgleich) mit echten Test-Dateien und echter KI
2. Tor- und Fristen-Probe gegen `lib/pipeline.js` (25 Fälle), Ampel-Vergleich an den 18 offenen Karten der Cache-Kopie
3. rclone-Probe „Verschieben in vorhandenes Ziel", `/api/ereignisse`-Zählung, `curl`-Zeitmessungen, `ollama ps`
4. Browser-Pane (DOM + Screenshots) für Einrichtung, Board, Detail, Plan, alle Einstellungs-Tabs, Auswertung

Offen:
1. Fix-Reihenfolge freigeben (H8 → H1 → B1 → H2 → H4/H5/H6 → H3/H7/H9) — DEINE ENTSCHEIDUNG
2. Die sechs Owner-Prüfungen oben — DEINE HANDLUNG
