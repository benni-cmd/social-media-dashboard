# v113 — Fixes aus dem Abnahmetest v112

> Owner-Auftrag 07.10.2026: „alles fixen, was du sauber fixen kannst. Stell überall Fragen, rate an keiner
> Stelle." Grundlage: `v112-finaler-abnahmetest.md` (Befund-Codes B/H/M/N von dort). 25 Fragen in 7 Blöcken
> gestellt, alle beantwortet (unten). Nicht umgesetzt: N3 Tastaturbedienung (Owner: eigenes Paket).

## PIG

**Problem:** Der Abnahmetest v112 fand 1 Blocker, 9 hohe, 13 mittlere und 15 niedrige Befunde; das Board ist
damit nicht startklar.

**Intent:** Jeden Befund beheben, der sich ohne Raten beheben lässt — mit den Owner-Entscheidungen, wo es
eine Produktfrage war — damit das Board launchen kann.

**Goal:** Alle Befunde außer N3 gebaut; Kartenlauf Idee → Fertig → Löschen im Schein-Drive ohne Ordner-
Zerfall, ohne Geisterkarten, ohne Endlosschleife; jede Änderung isoliert belegt; Doku nachgezogen.

## Owner-Entscheidungen (07.10.2026)

| Befund | Entscheidung |
|---|---|
| H2 Upload/Dreh | Frühester Upload = nächster Drehtermin + Dreh-Vorlauf (Kette, Standard 12 Tage) |
| B1 alte Hüllen | Leere Projektordner (keine einzige Datei), deren Name noch woanders liegt, entfernt der Abgleich automatisch (Drive-Papierkorb) |
| H4 Geisterkarten | Karten zu Systemordnern raus aus dem Board, Ordner unberührt; hineingeschriebene `projekt.json`/`Steckbrief.md` dort löschen; Löschen solcher Karten sperren |
| H6 Titel doppelt | Ordnername bekommt „ (2)", „ (3)" … |
| H8 Netzwerk | Nur dieser Rechner (127.0.0.1) |
| H9 Ollama | Kontext 16 384 Token |
| M2 Kontextmenü | „Weiter zu …" prüft dieselben Tore wie der Detail-Knopf |
| H7 CTA | Feld „Aufruf zum Handeln" gefüllt = genau ein Aufruf; Verb-Muster nur noch für „mehrere Aufrufe" |
| M12 Verteilung | Kategorien gemischt und %-treu, Ziele unabhängig rotiert |
| M1 Detail-Termin | Zeigt dieselbe dringlichste Frist wie der Punkt auf der Karte |
| M4 Google | „Später" bei Google wird auf diesem Rechner gemerkt; Assistent kommt deswegen nicht mehr von selbst |
| M7 Meldungen | Stapel nach unten rechts über die Zoom-Anzeige (nie über der Detailspalte), wächst nach oben, nichts wird gekürzt, bei Überlänge scrollbar; grüne Meldungen weiter nach 10 s weg; Hänger im Hintergrundfenster beheben |
| H1 + N1 Idee-Tor | Reel: Fokus + verbaler + sichtbarer Hook + Skript-Datei (Wort „skript" als eigenes Wort, nicht „Skripte"/„Transkript"/„Videoskript"); Slider/Beitrag/Story/Langformat: gespeicherte Format-Datei (`10_slider.md`, `10_beitrag.md`, `10_story.md`, `10_konzept.md`) |
| N2 Vorbelegungen | Neuer Einstellungs-Tab „Vorbelegungen" für neue Karten: Plattformen (Standard Instagram + LinkedIn), Format, Kategorie, Ziel (ohne Wahl leer wie heute); Kampagnen-Tabellen bekommen eine Spalte „Plattformen" (leer = Vorbelegung) |
| N4 Prompts | Knopf „alle übernehmen" im Assistenten; Anlass-Prompt in die Reihe |
| N8 WEE-Vorgaben | Neue Boards bekommen neutrale Platzhalter/Themen; bestehendes Board unverändert |
| N12 Ollama-Ende | Beenden entlädt nur Modelle, die das Board selbst genutzt hat |
| N3 Tastatur | später, eigenes Paket |

Ohne Rückfrage (keine Produktentscheidung, nur Fehlerbehebung): B1 Kern (Spiegel/Move/Suche), H3, H5-Satz,
M3, M5, M6, M8, M9, M10, M11, M13, N5, N6, N7, N9, N10, N11, N13, N14, N15.

## Plan

1. [x] Sicherheit: H8 (listen 127.0.0.1), N11 (OAuth `state`)
2. [x] Drive-Wahrheit: B1 (Spiegel, Move, Ordnersuche, Hüllen), H4, H5, H6, N14, N15
3. [x] Tore und Termine: H1/N1, H2, H7, M1, M2, M11
4. [x] Leistung: H3, H9, N12, M5, M13, M12
5. [x] Oberfläche: M3, M4, M6, M7, M8, M9, M10, N4, N5, N10, N13
6. [x] Vorbelegungen + Kampagnen-Spalte (N2), neutrale Vorgaben (N8), toter Code (N6), Port-Texte (N7)
7. [x] Doku: `architektur.md`, README, v112-Bericht nachgeführt (N9)
8. [x] Isoliert verifiziert: Proben je Fix + kompletter Kartenlauf im Schein-Drive + Browser
9. [x] Commit + Push

## Was gebaut wurde (Datei · Kern)

| Befund | Fix | Datei |
|---|---|---|
| B1 Ordner zerfällt | Spaltenwechsel wird nicht mehr vorab gespiegelt; nach `move` räumt `rmdirs` die Quell-Hülle; Ordnersuche überspringt leere Hüllen und entfernt sie, wenn der Name woanders mit Inhalt liegt; Abgleich entfernt leere Kopien | `server.js` (PUT /api/board), `lib/drive.js` (`moveDir`, `rmdirs`), `lib/projects.js` (`findeOrdner`, `abgleich`) |
| H1 + N1 Idee-Tor | Reel: Fokus + beide Hooks + Skript-Datei (Wort „skript" als eigenes Wort); andere Formate: Format-Datei | `lib/pipeline.js` (`tore`, `FORMAT_DATEINAMEN`), `lib/kartenhinweise.js`, `public/board.js` |
| H2 Upload/Dreh | frühester Upload = Drehtermin + kumulierter Dreh-Vorlauf | `lib/pipeline.js` (`fruehesterUpload`) |
| H3 Schleife | Plan aus dem Speicher, Kampagnen zeichnen nur bei Änderung neu | `public/detail.js`, `public/store.js` |
| H4 Geisterkarten | Systemordner nie Projekt; Geisterkarten raus (auch im Zusammenführen mit dem neuesten Stand), Fremddateien weg, Löschen/Anlegen dort gesperrt | `lib/pipeline.js` (`istSystemOrdner`), `lib/projects.js` |
| H5 Rat | „zusammenführen" mit Dateizahl je Kopie | `lib/projects.js` |
| H6 gleicher Titel | eigener Ordner je Karte („ (2)"), Eigentum per `id` in `projekt.json` | `lib/projects.js` (`freierName`, `findeEigenenOrdner`), `public/detail.js` |
| H7 CTA | gefülltes Aufruf-Feld = ein Aufruf | `lib/pipeline.js` |
| H8 Netz | `listen(PORT, "127.0.0.1")` | `server.js` |
| H9 Ollama | native `/api/chat`, `num_ctx` 16 384, Denk-Token beendet „Modell lädt" | `lib/ai.js` |
| M1 Termin | eine Zeit-Ampel für Kachel, Detail, „Nächster Schritt"; `faelligkeit()` entfernt | `public/store.js` (`zeitAmpel`), `public/detail.js`, `public/app.js`, `public/board.js` |
| M2 Kontextmenü | „Weiter zu …" prüft die Tore | `public/kontextmenu.js` |
| M3/M4/N4 Assistent | Hinweis bei „Weiter"; Google-„Später" gemerkt (`einrichtung-lokal.json` → `ausgelassen`), im Einrichtungs-Tab sichtbar; „nicht nötig" im Abschluss; alle Prompts übernehmen; Anlass-Prompt | `public/einrichtung.js`, `public/ui.js` |
| M5 Start-Tor | Drive nur lesen, wenn lokal fertig | `server.js` |
| M6 Meldungen | Ursache aus rclone behalten, Übersetzungen in allen Meldungswegen | `lib/drive.js`, `public/ui.js` |
| M7 Stapel | unten rechts über dem Zoom, links neben der Detailspalte, scrollbar; Hänger im Hintergrundfenster | `public/ui.js`, `public/style.css` |
| M8 | fehlende App-Daten → zurück ins Board mit Satz | `server.js` |
| M9 | „nicht verbunden" statt „0 Posts" | `server.js`, `public/detail.js` |
| M10 | Rückfrage vor „Auf Standard zurücksetzen" | `public/ui.js` |
| M11 | Workflow „ampel-schwellen" entfernt | `lib/workflows.js` |
| M12 | gewichtetes Reihum, fortlaufender Zähler, Ziele entkoppelt | `lib/scheduler.js` |
| M13 | Drive-Slot-Datei mit Abstands-Deckel, Fingerabdruck mit `maxAbstandTage` | `lib/planstore.js` |
| N2 | Tab „Vorbelegungen" (Plattformen, Format, Kategorie, Ziel); Kampagnen-Spalte „Plattformen" | `public/vorbelegung.js` (neu), `public/store.js`, `public/nachschub.js`, `lib/kampagnen.js` |
| N5/N7/N10/N13 | Hinweis bei negativem Abstand; echter Port; Stil in der Vorschau; „zu spät" vorab | `public/redaktionsplan.js`, `public/einrichtung.js`, `public/ui.js`, `public/kontext.js`, `public/store.js` |
| N6 | `PUT /api/plan/slot`, `slotBelegen`, Slot-Rückschreiben entfernt | `server.js`, `public/store.js`, `public/nachschub.js` |
| N8 | neutrale Platzhalter; neue Kampagnen-Tabellen ohne WEE-Themen; Stimme neutral nur ohne vorhandene Kontext-Datei | `public/detail.js`, `lib/kampagnen.js`, `lib/kontextstore.js` |
| N11 | OAuth-`state` (Zufall, 10 min, einmalig) | `server.js` |
| N12 | Beenden entlädt nur vom Board genutzte Modelle | `lib/ai.js`, `server.js` |
| N14/N15 | Ordnername gespeichert; kein Auto-Drehtermin ohne Ordner; LIESMICH ergänzt; Lösch-Meldung nach Ergebnis | `public/store.js`, `server.js`, `lib/drivesetup.js`, `public/detail.js`, `public/kontextmenu.js` |

## Belege (isoliert: Scratchpad-Kopie, Schein-Drive per rclone-Alias, Port 4399/4398)

1. **Logik-Proben 20/20 ok** (Scratchpad, mit Drive-Slot-Datei) und **`tools/tore-selbsttest.mjs` 22/22 ok** (im Repo, nur reine Module): Reel-/Format-Tor, Skript-Wort, CTA-Feld, Upload = Dreh + 12 bzw. + 10, Slot-Abstand ≤ 4, Fingerabdruck, Systemordner.
2. **Kartenlauf Idee → Fertig → Löschen:** nach vier Phasenwechseln alle Dateien in EINEM Ordner, keine Hülle; Fertig: 5 Dateien zusammen in `Videoauswertung`; Löschen: 6 Dateien im Papierkorb, nächster Abgleich „Board und Drive stimmen überein" (v112: Dateien über 3 Phasen verteilt, gelöschte Karte kam zurück).
3. **Altlasten:** leere Hülle entfernt; Doppelung mit Inhalt → „zusammenführen (1 Datei / 3 Dateien)"; Geisterkarten „KPI" raus, Fremddateien weg, `test_kpi.json` bleibt.
4. **Gemessen:** Endlosschleife 0 Ereignisse/10 s (v112: 261); Recherche lokal 68 s (v112: 276 s), `ollama ps` 12 GB, 100 % GPU, Kontext 16 384; Start-Tor bei kaputtem Drive 0,22 s (v112: 38,97 s); Planer 49/31/21 % (Soll 50/30/20), Ziele 39/21/29/11 % (Soll 40/20/30/10), 12/12 Kombinationen.
5. **Oberfläche (Browser):** Vorbelegung Instagram + LinkedIn sichtbar; Detail-Termin wortgleich mit Kartenpunkt; „25.10.2026 … · zu spät" vorab; Meldung über dem Zoom und links der Detailspalte (Screenshot); Kontextmenü-„Weiter" gesperrt mit Grund; gleiche Titel → „TEST v113 Gleich" und „… (2)" mit eigener `id`; Assistent: 16 Prompts, „Alle übrigen 16 übernehmen", Google-„Später" gemerkt, kein Assistent beim nächsten Start; OAuth: ohne/falscher/fremder `state` abgewiesen, gültiger geht weiter; LAN-Adresse antwortet nicht mehr; fremdes Ollama-Modell bleibt nach „Beenden" geladen; Auto-Shutdown nach 60 min Leerlauf beobachtet.

## Stand

07.10.2026 — gebaut, isoliert verifiziert, Doku nachgezogen. Nebenbefunde für den harten Nachtest (v114):
gelöschte Karten bleiben in `karteIds` ihres Drehtermins (Zähler „(1)"); „Inhalt nach Drive speichern" mit
unbrauchbarer KI-Antwort schreibt eine fast leere Format-Datei und öffnet das Tor; bei fehlender rclone-Config
staut sich die Drive-Warteschlange (Rückmeldung zu einem Verschieben erst nach über einer Minute).

## Definition of Done

Geprueft gegen:
1. `node tools/tore-selbsttest.mjs` 22/22, `node tools/kampagnen-selbsttest.mjs` 40/40, Kampagnen-Spalten-Probe
2. Kartenlauf mit echter KI im Schein-Drive inkl. Löschen und Abgleich; Altlasten-Abgleich
3. Messungen über `/api/ereignisse`, `curl -w %{time_total}`, `ollama ps`
4. Browser-Pane (DOM + Screenshot) für Assistent, Board, Detail, Einstellungen

Offen:
1. N3 Tastaturbedienung der Schalter — DEINE ENTSCHEIDUNG (eigenes Paket, von dir zurückgestellt)
2. Live am echten Drive nicht prüfbar (Zugriff gesperrt): Umbenennen, Ordner-Link, geteilte Ablage — DEINE HANDLUNG nach Board-Neustart
3. Nebenbefunde oben → harter Nachtest v114 — ICH, direkt im Anschluss
