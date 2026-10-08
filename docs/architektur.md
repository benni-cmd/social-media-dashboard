# Architektur & Integration — WEE Social Media Suit (Content-Board)

> Stand 06.10.2026, Paket [`v109`](packages/v109-architektur-und-integration.md). Alles hier ist aus dem
> Code gelesen (Fundstellen in Klammern) bzw. an der Showcase gemessen — nichts geraten. Wo etwas offen
> ist, steht es in Abschnitt 7.
>
> **Ziel für die fertige Software** (Board ersetzt den Social-Media-Bereich von Rootwork, gehostet,
> mehrere Nutzer): [`zielarchitektur.md`](zielarchitektur.md). Dieses Dokument beschreibt den heutigen Stand.
>
> **Für wen:** Leon, der das Board in die Rootwork-Showcase `https://showcase-rootwork.vercel.app/`
> einbetten und anpassen will. Kurzfassung der Empfehlung: **Abschnitt 6**.

---

## 0. Die eine Wahrheit vorab: das Board ist local-first

Das Board ist **keine Web-App, die man irgendwo hinlegt**. Es ist ein Node-Prozess auf dem Rechner des
Owners, der drei lokale Dinge benutzt:

| Lokale Abhängigkeit | Wofür | Fundstelle |
|---|---|---|
| **rclone** (CLI, Remote `gdrive:`) | jede Drive-Lese-/Schreiboperation; Drive ist die Wahrheit | `lib/drive.js` (`spawn("rclone", …)`) |
| **Claude-CLI / Codex-CLI** (`claude -p`, `codex exec`) | KI-Texte über das Abo des Owners — **ohne API-Token-Kosten** | `lib/ai.js` Z. 906, 961, 1032 |
| **Ollama** `http://localhost:11434` | lokale Modelle (Recherche, Kontextabgleich) | `lib/ai.js`, `server.js` |
| HTTPS-Server `https://localhost:4321`, selbstsigniertes Zertifikat (`data/localhost.crt`, per `openssl` erzeugt) | Oberfläche + API + OAuth-Rückrufe | `server.js` (Ende) |

Dazu: **`data/` ist nur Cache** (Board-Index, Plan-, Prompt-, Defaults-Cache) plus lokale Zugangsdaten
(`.env`, `data/tokens.json`, `data/.gdrive-env.json`). Der Server beendet sich nach 60 Min. Leerlauf
(Workflow `auto-shutdown`, `IDLE_LIMIT_MS`).

**Folge für Vercel:** Vercel liefert statische Dateien und kurzlebige serverlose Funktionen. Dort gibt es
kein rclone, keine angemeldete Claude-CLI, kein Ollama, kein `localhost`, keinen langlebigen Prozess und
kein beschreibbares `data/`. **Jede Einbettung, die mehr als ein Bild/Link ist, ist eine echte Anpassung.**

**Was davon portabel ist** (läuft ohne Änderung auch im Browser/in Rootwork):

| Portabel (reines JS, keine Node-Importe) | Lokal gebunden |
|---|---|
| `lib/pipeline.js` — Phasen, Formate, Kartenschema, Fristen, Qualitätstore | `lib/drive.js`, `drivesetup.js`, `projects.js`, `rclone-config.js` (rclone) |
| `lib/workflows.js` — Register der Automationen | `lib/ai.js`, `claudeauth.js`, `codexauth.js` (CLIs + Ollama) |
| `lib/kartenhinweise.js` — Katalog Hinweise/Warnungen | alle `lib/*store.js` (lesen/schreiben Drive per rclone) |
| `lib/uploadslots.js`, `lib/scheduler.js` — Slots, nächster freier Termin | `lib/kpi*.js`, `social.js`, `gcal.js` (Tokens in `data/tokens.json`, Schreiben nach Drive) |
| Datenformate: `projekt.json`, `redaktionsplan.json`, KPI-CSVs | `server.js` (HTTPS, OAuth-Callbacks auf `localhost:4321`) |

Das Frontend (`public/*.js`) ist Vanilla-JS mit ES-Modulen, **ohne Build-Schritt und ohne Framework**;
es spricht ausschließlich mit `/api/*` desselben Servers.

---

## 1. Komponenten-Karte und Datenfluss

```
 Browser (public/index.html + ES-Module)
   app.js ── Verdrahtung: Kopf, Ansichten
   board.js · detail.js · kalender.js · redaktionsplan.js · auswertung.js · nachschub.js
   einrichtung.js · kontext.js · boardparameter.js · drehtermine.js · kontextmenu.js · anschluesse.js
   store.js ── der EINE Zustand + alle fetch()-Aufrufe       ui.js ── UI-Bausteine
   importiert direkt: /lib/pipeline.js, /lib/workflows.js, /lib/kartenhinweise.js (vom Server ausgeliefert)
        │  fetch /api/*  (JSON; Streams als NDJSON)
        ▼
 server.js  (node:https, keine npm-Abhängigkeiten, Port 4321)
   ├─ Board:      data/board.json (Cache, versioniert)  ──spiegelt──▶ projects.js
   ├─ Stores:     planstore · promptstore · workflowstore · defaultsstore · boardparamstore · kontextstore · kampagnen
   ├─ KI:         laufePipeline() ──▶ lib/ai.js ──▶ claude -p │ codex exec │ Ollama :11434   (+ websuche.js: DuckDuckGo/Tavily)
   ├─ Auswertung: social.js (Instagram/LinkedIn-API) · zuordnung.js · kpi.js · kpi-tabellen.js · kanal-kpi.js · kpi-drive-lesen.js
   ├─ Kalender:   gcal.js (Google Calendar + Tasks, nur Board → Google)
   └─ Ereignisse: ereignisse.js (Protokoll „was das Board nach außen tut", SSE-Stream)
        │  rclone (spawn je Aufruf, Warteschlange)
        ▼
 Google Drive — EIN Hauptordner je Board = die Wahrheit (Struktur in Abschnitt 3)
```

**Typische Flüsse**

1. **Board laden:** `GET /api/board` liefert sofort den Cache (`cacheStand` = Zeitstempel) → danach
   `POST /api/drive/reconcile/stream` liest alle Phasenordner in Drive; bei Widerspruch **gewinnt Drive**,
   jede Änderung erscheint als Satz.
2. **Karte ändern:** `PUT /api/board` mit `version` → schreibt `data/board.json` (409 bei Versionskonflikt,
   zwei Tabs überschreiben sich nicht) → antwortet sofort → spiegelt geänderte Karten **im Hintergrund**
   nach Drive `…/<Projekt>/(AI only)/projekt.json`.
3. **Spalte wechseln:** Board verschiebt den Projektordner per `POST /api/drive/move` in den Phasenordner.
4. **KI-Knopf:** `POST /api/ai/stream {task, card, rollenModelle}` → Schritt-Kette aus `prompts.json`;
   jeder Schritt läuft auf dem Modell seiner Rolle, nur der letzte streamt; Antwort NDJSON
   (`status`/`stufe`/`delta`/`done`/`error`).
5. **Zahlen:** beim Serverstart (60 s verzögert) und per `POST /api/kpi/collect`: Posts den Karten
   zuordnen → fällige Messungen holen → JSON je Projekt + CSV-Tabellen in Drive.

---

## 2. API-Oberfläche

80 Handler auf 70 Pfaden (`grep -cE 'if \(pfad === "/api/' server.js` → 80, Stand v115). Alle ohne Anmeldung —
der Server vertraut jedem, der ihn erreicht (siehe 4 und 5); seit v113 lauscht er deshalb nur auf `127.0.0.1`
(vorher im ganzen WLAN erreichbar). OAuth-Starts tragen einen einmal gültigen `state` (v113). Antworten JSON,
außer wo „NDJSON"/„ZIP"/„302".

**Eingang (v115):** Schreibende Anfragen (alles außer GET/HEAD) nur aus der eigenen Oberfläche oder von lokalen
Skripten — eine fremde Herkunft (`Origin` ≠ `https://localhost:<PORT>`, `Sec-Fetch-Site: cross-site`) → 403;
ein JSON-Endpunkt mit anderem Inhaltstyp → 415 (Ausnahme: `/api/projekt/upload`, dort ist der Body die Datei).
Jeder JSON-Body geht durch `leseJson()`: kaputt, leer oder kein Objekt → 400 mit Satz; über 20 MB → 413.
Fehler sprechen deutsch (`lib/fehlertext.js`, dieselbe Übersetzung im Browser). Ein Fehler nach Antwortbeginn
(ZIP, Stream) schließt nur diese Verbindung — bis v114 beendete er den ganzen Server.

**Board & Karten**

| Methode | Pfad | Zweck | Eingabe → Ausgabe |
|---|---|---|---|
| GET | `/api/board` | Board aus Cache | → `{version, cards[], drehtermine[], spalten, phasen, cacheStand}` |
| PUT | `/api/board` | Board speichern, danach Drive-Spiegelung | `{cards, version, drehtermine?}` → `{ok, version}` / 409 `{aktuell}` |
| GET/PUT | `/api/board/name` | Board-Name = Drive-Ordnername lesen/umbenennen | `{name}` → `{name}` |
| POST | `/api/board/zuruecksetzen` | Board vom Ordner lösen, lokale Caches löschen | `{anmeldungen?}` → `{ok, alterOrdner}` |
| POST | `/api/karte/loeschen` | Projektordner in Drive-`Papierkorb/` | Karte → Ergebnis |
| GET/PUT | `/api/defaults` | Benutzer-Voreinstellungen (Drive, Cache-Fallback) | Felder → `{ok, defaults}` |
| GET/PUT | `/api/boardparameter` | Inhaltskategorien + Ziele | Stand → Stand |

**Drive**

| Methode | Pfad | Zweck | Eingabe → Ausgabe |
|---|---|---|---|
| POST | `/api/drive/reconcile` · `/reconcile/stream` | Abgleich Drive ↔ Board (Stream: NDJSON-Stufen) | → `{cards, befunde, geaendert, version, spalten}` |
| POST | `/api/drive/create` | Projektordner anlegen | Karte → Stand |
| POST | `/api/drive/move` | Projektordner in andere Phase | `{card, ziel}` → Stand |
| POST | `/api/drive/scan` (`?frisch=1`) | Ordnerinhalt einer Karte (für Qualitätstore) | Karte → `{driveOk, vorhanden, pfad, …}` |
| POST | `/api/drive/save` | Textdatei (Skript/Caption) speichern | `{card, filename, content}` → `{ok, pfad}` |
| GET | `/api/projekt/download?karteId&was=skript\|rohmaterial` | Unterordner als ZIP | → ZIP |
| POST | `/api/projekt/upload?karteId&name&ziel=fertig\|rohmaterial` | Datei (roher Body) in Drive | Bytes → `{ok, satz}` |
| GET | `/api/drive/status` · `/einrichtung` · `/ordner-link?pfad` | Erreichbarkeit, rclone da?, Ordner-Link | → Status / `{url}` |
| POST | `/api/drive/ordner/pruefen` · `/ordner/setzen` | Arbeitsordner prüfen / wechseln (Struktur anlegen) | `{eingabe}` → `{art, ok, satz}` |
| POST/GET | `/api/drive/konto/wechseln` | rclone-Browser-Login starten / Stand abfragen | `{clientId?, clientSecret?}` → `{laeuft, satz}` |
| GET | `/api/drive/kontext?serie` | gesammelter Kontext als Text (ungenutzt) | → `{text}` |

**Redaktionsplan & Kampagnen**

| Methode | Pfad | Zweck | Eingabe → Ausgabe |
|---|---|---|---|
| GET | `/api/plan` | Plan-Config aus Drive (Cache-Fallback) + Slot-Abgleich | → Config + `{planAbgleich, quelle, istStandard}` |
| PUT | `/api/plan` | Plan speichern (Cache, dann Drive) | Config → `{ok, planAbgleich, kampagnen}` |
| GET | `/api/kampagnen/anstehend` | Anlässe aktiver Kampagnen (60 Tage) | → `{anstehend, befunde, kampagnen}` |

**KI**

| Methode | Pfad | Zweck | Eingabe → Ausgabe |
|---|---|---|---|
| POST | `/api/ai` · `/api/ai/stream` | KI-Aufgabe ausführen (Stream = NDJSON) | `{task, card, rollenModelle}` → `{text, data}` |
| GET | `/api/ai/modelle` | wählbare Claude-Modelle | → `{claude, standard}` |
| GET / POST | `/api/ai/ollama` · `/ollama/pull` · `/ping-ollama` | Ollama-Stand, Modell laden (NDJSON), Ping | → `{laeuft, modelle}` |
| GET/PUT | `/api/prompts` | System-Vorspann + Schritt-Ketten je Aufgabe/Format | `{id, text\|schritte, format?}` → Übersicht |
| GET/PUT | `/api/workflows` | Automationen an/aus + Parameter | `{id, an, params}` → `{workflows}` |
| GET/PUT | `/api/kontext` · GET `/kontext/probe` | Firmen-/Projektkontext pflegen; zeigen, was in den Prompt geht | `{was, …}` → Stand |

Aufgaben (`task`, `lib/ai.js` `PROMPTS`): `recherche`, `hooks_verbal`, `hooks_visuell`, `skript`,
`regieplan`, `caption`, `ideen`, `anlass_ideen`, `plan`, `analyse`, `slider_aufbau`, `slider_visual`,
`beitrag_visual`, `story_frames`, `langform_konzept`.

**Anmeldungen & Anbindungen**

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/auth/{instagram,google,linkedin}` + `/callback` | OAuth-Start (302 zum Anbieter) und Rückruf auf `https://localhost:4321/…/callback` → Token in `data/tokens.json` |
| POST | `/api/auth/{google,instagram,linkedin,claude,chatgpt}/trennen` | Token entfernen |
| GET/POST | `/api/auth/claude/{status,start,code}` | Claude-CLI aus dem Board anmelden |
| GET/POST | `/api/auth/chatgpt/{status,start,schluessel}` | Codex-CLI anmelden (Konto oder API-Schlüssel) |
| PUT | `/api/config/env` | einen erlaubten Schlüssel in `.env` schreiben (Whitelist: Google/Instagram/LinkedIn-App, `TAVILY_API_KEY`) |
| GET | `/api/verbindungen/status` | Zustand aller Anbindungen parallel (Drive, Claude, Codex, Google, IG, LI) |
| POST/GET | `/api/gcal/sync` · `/gcal/loeschen` · `/gcal/status` · `/gcal/konto` | Drehtermin → Kalender-Termin + Task |

**Auswertung**

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/stats/instagram` · `/stats/linkedin` (`?quelle=drive`) | Kennzahlen live aus der API **oder aus den Drive-CSVs** (gleiche Antwort-Form, `lib/kpi-drive-lesen.js`) |
| GET | `/api/stats/zeitraum?wochen&vor` | Wochenstatistik |
| GET / POST | `/api/kpi/status` · `/kpi/collect` | fällige Messungen; Messung jetzt auslösen |
| POST/GET | `/api/zuordnung/{pruefen,posts,hand,entscheiden}` | echte Posts ↔ Karten (automatisch, Vorschlag, von Hand) |

**Betrieb**

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/ereignisse` · `/ereignisse/stream` | Protokoll der Außenwirkungen (Verlauf / SSE) |
| GET/POST | `/api/einrichtung/stand` · POST `/einrichtung/speichern` | Einrichtungs-Assistent (NDJSON-Fortschritt) |
| POST | `/api/shutdown` | offene Drive-Spiegelungen beenden, Ollama entladen, Prozess beenden |

Statisch: alles außer `/api/*` aus `public/`, Pfade `/lib/*` aus `lib/` (damit der Browser `pipeline.js`
& Co. importiert).

---

## 3. Datenmodell und Speicher-Vertrag

**Grundsatz** (`docs/drive-convention.md`): Drive ist die Wahrheit, `data/` ist Cache; ein Mensch muss
ohne Board direkt in Drive weiterarbeiten können. Phasen **sind** Ordner; ein Projekt wechselt die Phase,
indem sein Ordner wandert. Die Struktur ist fest (`PHASEN` in `lib/pipeline.js`) — falsche Struktur → das
Board lädt nichts aus Drive und nennt den Grund.

```
<Board-Name>/                         Drive-Hauptordner = Name des Boards
├── In Bearbeitung/1 Idee … 6 Upload/ je Phase ein Ordner
│   └── <Projekt>/                    Name einmal vergeben, als card.driveName eingefroren
│       ├── Steckbrief.md             Klartext für Menschen (vom Board geschrieben)
│       ├── (AI only)/projekt.json    Maschinen-Index der Karte = Wahrheit
│       ├── Skript und Caption/       00_recherche.md · 10_skript.txt · 20_regieplan.md · 30_caption.md
│       │                             (Slider/Beitrag/Story/Langformat: 10_slider.md · 10_beitrag.md · 10_story.md · 10_konzept.md)
│       ├── Rohmaterial/              Rohclips  (≥ 1 Datei ⇒ „Dreh ist durch")
│       └── Fertiges Video/           Schnitt   (Videodatei ⇒ „Schnitt fertig")
├── Videoauswertung/                  Phase „Fertig"; KPI/<projekt>_kpi.json; Auswertung-Tabellen/*.csv
├── Verworfen/ · Papierkorb/
├── Kontext/_global/ · Kontext/<Reihe>/   Dateien, die in jeden KI-Prompt gehen
└── System (AI only)/                 Einstellungen des Boards (Tabelle unten)
```

**Karte** (`leereKarte`/`migriere` in `lib/pipeline.js`, `SCHEMA = 2`): u. a. `id`, `title`, `serie`,
`column` (Phase), `contenttyp` (reel · slider · beitrag · story · highlight · langformat), `kategorie`,
`goal`, `platforms[]`, Upload-Datum + abgeleitete Fristen, `chosenFokus`/`chosenHook`, `hook`, `frame`,
`skriptFinal`, `ai.*` (KI-Ergebnisse), `published.{plattform}` (verknüpfter Post), `driveName`.

**Wer schreibt wohin**

| Komponente | Drive (Wahrheit) | Lokaler Cache / lokal |
|---|---|---|
| Board (`server.js`, `projects.js`) | `<Projekt>/(AI only)/projekt.json`, `Steckbrief.md`, Projektordner | `data/board.json` (+ `board-sicherungen/<root>.json` je Ordner) |
| `planstore.js` | `System (AI only)/redaktionsplan.json` + `redaktionsplan.slots.json` | `data/plan.json` |
| `kampagnen.js` | eine Tabelle je Kampagne in Drive (Anlässe) | — |
| `promptstore.js` | `System (AI only)/prompts.json` | `data/prompts.json` |
| `workflowstore.js` | `System (AI only)/workflows.json` | `data/workflows.json` |
| `defaultsstore.js` | `System (AI only)/defaults.json` | `data/defaults.json` |
| `boardparamstore.js` | `System (AI only)/boardparameter.json` | `data/boardparameter.json` |
| `kontextstore.js` | `System (AI only)/kontext.json`, liest `Kontext/_global`, `Kontext/<Reihe>` | `data/kontext.json` |
| Einrichtung | `System (AI only)/einrichtung.json` | `data/einrichtung-lokal.json` |
| `kpi.js`, `kpi-tabellen.js`, `kanal-kpi.js` | `Videoauswertung/KPI/*.json`, `Auswertung-Tabellen/beitraege-kpi.csv`, `kanal-verlauf.csv`, `follower-demografie.csv` | Messstand an der Karte |
| Zugangsdaten | **nie in Drive** | `.env`, `data/tokens.json`, `data/.gdrive-env.json` |

Schreibreihenfolge überall: **erst Cache, dann Drive** — ein Drive-Ausfall blockiert nie das Speichern;
der nächste Abgleich heilt. Lesereihenfolge: Drive, bei Störung Cache (mit sichtbarem Hinweis).

**Robustheit (v115, belegt mit `tools/hart`):**
- **Typen:** `migriere()` bringt jedes Kartenfeld auf seinen Typ (auch eine Ebene tief, ISO-Daten). Hat eine
  `projekt.json` in Drive falsche Typen oder ist sie kein gültiges JSON, sichert der Abgleich das Original als
  `(AI only)/projekt.kaputt-<Zeit>.json`, bevor er korrigiert, und sagt es im Befund. Eine Drive-Störung beim
  Lesen ändert nichts (vorher galt sie als „keine projekt.json" und der Board-Stand überschrieb Drive).
- **Ein Vorgang je Karte:** Anlegen, Verschieben, Löschen, Datei speichern, Spiegeln und der Abgleich derselben
  Karte laufen nacheinander (`mitKarte` in `projects.js`); der Abgleich schreibt nie in einen Ordner, der inzwischen
  gewandert ist, und eine eben gelöschte Karte wird nicht neu angelegt (409). Das Spiegeln nach dem Speichern
  schreibt nur in einen Ordner, der noch dort liegt.
- **Ein Schreiber für `board.json`:** Versionsprüfung und Schreiben laufen in einer Reihe (`boardReihe`); Zuordnung
  und KPI legen ihre Änderung auf den neuesten Stand statt ihren Startstand zurückzuschreiben.
- **Hüllen:** Liegt ein Projektordner doppelt und enthält eine Kopie nur Board-Dateien (`projekt.json`, `Steckbrief.md`)
  und ist älter als die Kopie mit Inhalt, wandert sie in den Papierkorb (Owner 07.10.2026).
- **ZIP64:** Rohmaterial über 4 GB lädt als gültiges ZIP (geprüft mit Windows-`tar` und .NET).
- **Board-Ordner weg:** „kein Ordner" gilt nur, wenn der Board-Ordner selbst erreichbar ist — sonst scheitern Löschen und Scan sichtbar (vorher: Löschen ohne Papierkorb, Karte kam zurück).
- **Upload:** Der Zielordner wird erst nach dem Hochladen unter der Karten-Sperre bestimmt — eine inzwischen verschobene Karte bekommt die Datei am neuen Ort.

---

## 4. Funktionen: wer darf · wann · was passiert · wo gespeichert

**Rechtemodell — es gibt keins in der App.** Ein Board = ein lokaler Owner, der den Server auf seinem
Rechner startet. Es gibt keine Benutzer, keine Rollen, keine Anmeldung am Board. Wer mitarbeiten soll,
bekommt **Zugriff auf den Google-Drive-Ordner** (Drive-Freigabe) und arbeitet entweder direkt in Drive
oder mit einem eigenen Board auf dem eigenen Rechner, das auf denselben Ordner zeigt. Wer den Server
erreicht, darf alles — darum darf er nie ungeschützt ins Netz.

**Automationen** (`lib/workflows.js`; an/aus und Parameter stehen in `System (AI only)/workflows.json` — einen
Schalter-Tab gibt es seit v41 nicht mehr, nur „Termine & Fristen" stellt die Deadline-Kette ein; Stand in
`System (AI only)/workflows.json`)

| Funktion | Wer | Auslöser | Was passiert | Wo gespeichert |
|---|---|---|---|---|
| Fertiges Video schiebt weiter (`upload-fertig-weiter`) | Owner (Board) | Video in „Fertiges Video" hochgeladen | Karte rückt vor, wenn Qualitätstore frei | Datei in Drive; Phase in `projekt.json` + Ordner wandert |
| Drehtermin → Videodreh (`drehtermin-zuordnen-videodreh`) | Owner | Karte einem Drehtermin zugeordnet | Karte springt nach „Videodreh" | `board.json` → `projekt.json` |
| Skript schiebt weiter (`skript-gespeichert-weiter`) | Owner | fertiges Skript gespeichert | weiter zu „Drehtermin festlegen" (fragt Upload-Datum ab) | `10_skript.txt` in Drive |
| Automatischer Drehtermin (`auto-drehtermin`) | Board selbst | kein Drehtermin im Vorlauf-Fenster | setzt Sonntag der Folgewoche, markiert „automatisch" | `board.json` (`drehtermine`) |
| Kalender-Spiegel (`gcal-autosync`) | Board selbst | Drehtermin angelegt/geändert/gelöscht | Google-Kalender-Termin + Task mitziehen; Fehler blockiert nie | Google Calendar/Tasks (nur hin) |
| Rückwärtsplan (`rueckwaertsplan`) | Board selbst | Upload-Datum gesetzt | Freigabe 3 Tage vor Upload, Schnitt 3 vor Freigabe, Dreh 6 vor Schnitt (einstellbar) | Karte |
| Projektordner anlegen (`drive-ordner-anlegen`) | Board selbst | visueller Hook gewählt, noch kein Ordner | Projektordner mit Unterordnern in Drive | Drive |
| Ordner folgt Karte (`drive-ordner-mitziehen`) | Board selbst | Karte wechselt Spalte | Projektordner wandert in den Phasenordner | Drive |
| Auto-Shutdown (`auto-shutdown`) | Board selbst | keine Anfrage für 60 Min. (Standard) | Ollama entladen, Prozess beenden | — |
| Ampel (fest, kein Workflow mehr seit v113) | Board selbst | Zeitpunkt einer Karte wird gefärbt | rot ≤ 2 Tage, gelb ≤ 5 — Kachel, Detailspalte und „Nächster Schritt" zeigen dieselbe Frist | `lib/pipeline.js` `AMPEL` |

**Phasen und Qualitätstore** (`PHASEN`, `tore()` in `lib/pipeline.js`; Anzeige über `KATALOG` in
`lib/kartenhinweise.js`). „Weiter" prüft die Tore; Ziehen und Kontextmenü verschieben bewusst **ohne** Prüfung.

| Phase (Drive-Ordner) | Arbeit | Sperrende Tore (Auswahl) |
|---|---|---|
| Skript schreiben (`1 Idee`) | recherchieren, Fokus/Hooks wählen, Skript | Thema, Kategorie, Ziel, Fokus+Hook, Skript-Datei in Drive |
| Drehtermin festlegen (`2 Skript`) | Skript einem Drehtermin zuordnen | Kategorie, Sprechertext (Sprechzeit-Hausregel), Hook, Bild-Hook |
| Videodreh (`3 Videodreh`) | drehen, Rohmaterial ablegen | Rohmaterial in Drive |
| Schnitt (`4 Schnitt`) | schneiden, untertiteln | fertiges Video in Drive, Untertitel, Wasserzeichen-frei (IG) |
| Caption (`5 Caption`) | Vorspann, Text, Hashtags je Plattform | Vorspann, Aufruf zum Handeln, Hashtag-Grenzen |
| Upload (`6 Upload`) | veröffentlichen, Post verknüpfen | Plattform gewählt |
| Fertig (`Videoauswertung`) · Verworfen (`Verworfen`) | nur noch Zahlen · geparkt | — |

Formate ohne Video (Slider, Beitrag, Story, Highlight) überspringen die Video-Sperren und bekommen eigene
KI-Schritte. Warnungen (rotes „!") = Regelverstoß, Hinweise (gelb) = Fehlendes/Empfehlung; Pflicht-Hinweise
erst, wenn die Frist gelb/rot ist.

**Hand-Funktionen**

| Funktion | Wer | Auslöser | Was passiert | Wo gespeichert |
|---|---|---|---|---|
| KI-Knopf | Owner | Klick in der Detailspalte | Schritt-Kette über Claude-/Codex-CLI/Ollama, Web-Suche bei Recherche | Ergebnis an der Karte; „Speichern" → `.md` in Drive |
| Ideen/Plan von der KI (`nachschub.js`) | Owner | Klick | Ideen-Karten bzw. Plan-Vorschlag | Karten → Drive |
| Redaktionsplan | Owner | Speichern | Slots neu berechnet (feste Wochentage je Hauptplattform) | `redaktionsplan(.slots).json` |
| Drehtermin-Leiste | Owner | anlegen/zuordnen | Sammeltermin für mehrere Karten | `board.json` + Google |
| Post ↔ Karte | Board + Owner | Start / Klick „prüfen" | eindeutig (≤ 3 Std., Format passt) automatisch, sonst Vorschlag zum Bestätigen | Karte → `projekt.json` |
| KPI-Messung | Board | Start (+60 s) / Klick | Messintervalle 24 h … 12 Monate | `Videoauswertung/…` JSON + CSV |
| Karte löschen | Owner | Klick | Projektordner → `Papierkorb/` (mit Zeitstempel) | Drive |

---

## 5. Integrationswege in die Rootwork-Showcase

### 5.1 Was die Showcase ist (gemessen 06.10.2026)

- **Technik:** Vite-gebaute React-SPA (`index.html` 612 Bytes, `<div id="root">`, ein Bundle
  `/assets/index-*.js` ≈ 4,9 MB), Tailwind-Klassen, **Hash-Routing** (`#/dashboard`,
  `#/board%3Asocial-media`, `#/board%3Asoftware`; `/projekte` ohne Hash → 404). Daten über **Supabase**
  (Tabellen u. a. `projects`, `tasks`, `donors`, `software_apps`, `web_apps`, `web_pages`); die
  öffentliche Showcase läuft mit **„Demo-Daten (synthetisch)"**. Gehostet auf Vercel (`Server: Vercel`).
- **Es gibt schon einen Platz für das Board:** Bereich *Marketing und Kommunikation → Social Media*
  (`#/board%3Asocial-media`) zeigt Kennzahl-Kacheln LinkedIn/Instagram/YouTube, „Letzter Post · Aufrufe",
  Follower, Reichweite, Aufrufe, Interaktionsrate und eine Beitragstabelle — mit dem Banner
  **„Demo-Werte — Anbindung an das Social-Media-Board folgt"**. Darunter ein generisches Kanban von
  Rootwork (Brainstorming/Geplant/In Arbeit/Erledigt), nicht unser Board.
- **Es gibt schon einen Einbettungs-Mechanismus:** Bereich *Software und Simulation* führt ein
  Anwendungs-Register (Felder `name, url, hosting, repo, branch, stage, vercelProject, embedUrl`).
  Anwendungen mit `embedUrl` erscheinen als `<iframe>` (Höhe 640 px, `referrerPolicy="no-referrer"`),
  Beispiel: Oasis Simulator. Vorher prüft Rootwork die Header der Anwendung: `frame-ancestors` in der CSP
  bzw. `X-Frame-Options` entscheidet über „Einbetten erlaubt / verboten"; sonst ein Knopf „in eigenem
  Fenster öffnen".
- **Unser Server setzt weder CSP noch `X-Frame-Options`** (`grep -i "frame-ancestors\|X-Frame" server.js`
  → 0 Treffer) — Rootwork würde ihn also als „setzt keine Einbettungs-Sperre" werten.

Wichtig: Die Kennzahlen, die Rootwork als Demo zeigt, **produziert das Board bereits** — als CSVs in
`Videoauswertung/Auswertung-Tabellen/` (Drive), und `lib/kpi-drive-lesen.js` rekonstruiert daraus schon
heute die Antwort-Form der Auswertung (`/api/stats/*?quelle=drive`).

### 5.2 Die Wege im Vergleich

Aufwand grob in Personentagen (PT) für eine Person, die beide Codebasen kennt.

**(a) iframe/Link auf die lokale Instanz** — `embedUrl = https://localhost:4321` im Rootwork-Register.

| | |
|---|---|
| Aufwand | ≈ 0,5 PT (Eintrag im Register; optional `frame-ancestors https://showcase-rootwork.vercel.app` im Board setzen) |
| Pro | volle Funktion inkl. KI und Drive; kein Umbau; Mechanismus existiert in Rootwork schon |
| Contra | funktioniert **nur auf dem Rechner, auf dem das Board gerade läuft** (für alle anderen Besucher leer); selbstsigniertes Zertifikat muss im Browser akzeptiert sein, sonst bleibt der Rahmen leer; Server beendet sich nach 60 Min. Leerlauf; Browser-Sperren für öffentliche Seite → `localhost` (Private Network Access) ungetestet; 640 px Höhe ist für Board + Detailspalte knapp. Variante „über Tunnel öffentlich machen" ist **ausgeschlossen ohne eigene Anmeldung davor** — die API hat keine Authentifizierung und kann Drive-Ordner verschieben, löschen und `.env` schreiben |

**(b) Öffentliche Read-only-Ansicht aus Drive** — Rootworks Social-Media-Kacheln und eine Board-Übersicht
aus Daten füllen, die das Board ohnehin schreibt.

| | |
|---|---|
| Aufwand | ≈ 3–5 PT: Export-Schritt im Board (nach KPI-Lauf/Abgleich eine schlanke `showcase.json`: Kennzahlen + Karten je Phase ohne Interna) **oder** Upload derselben Daten in eine Supabase-Tabelle; in Rootwork die Social-Media-Seite auf diese Quelle umstellen |
| Pro | passt exakt auf das vorhandene „Anbindung folgt"-Banner; keine Zugangsdaten in Vercel, wenn das Board **pusht** statt Vercel zieht; portable Logik (`pipeline.js` für Phasen-Namen, `kpi-drive-lesen.js`-Form) ist wiederverwendbar; für alle Besucher sichtbar |
| Contra | nur lesend; Datenstand so frisch wie der letzte Lauf auf dem Owner-Rechner; Datenschutz-Auswahl nötig (was ist öffentlich?); direktes Lesen aus Drive durch Vercel bräuchte ein Google-Dienstkonto + Drive-API statt rclone (≈ +2 PT, und ein Zugang in Vercel) |

**(c) Komplettes Re-Host serverseitig** — das Board als Mehrbenutzer-Dienst betreiben.

| | |
|---|---|
| Aufwand | ≈ 25–40 PT |
| Pro | echtes, überall erreichbares Board in Rootwork |
| Contra | ersetzt fast jede lokale Abhängigkeit: rclone → Drive-API mit Dienstkonto/OAuth je Nutzer; Claude-/Codex-CLI → bezahlte API (**token-frei entfällt**, laufende Kosten); Ollama → gehostete Modelle; `data/` → Datenbank (z. B. Rootworks Supabase); langlebiger Prozess, Streams, Datei-Uploads (Videos!) und 10–70 s Abgleich passen nicht zu Vercel-Funktionen → eigener Server nötig; dazu **Anmeldung und Rechtemodell neu bauen**, OAuth-Rückrufe von `localhost` auf echte Domain umziehen, App-Freigaben bei Meta/LinkedIn/Google neu. Faktisch ein zweites Produkt |

**(d) Reiner visueller Showcase/Demo** — das Board-Frontend mit festen Beispieldaten.

| | |
|---|---|
| Aufwand | ≈ 1–2 PT: `public/` statisch auf Vercel, `store.js`-Aufrufe gegen eine Attrappe mit Beispiel-JSON (Schreibzugriffe ins Leere), als zweites Vercel-Projekt; in Rootwork als `embedUrl` registrieren |
| Pro | zeigt das echte Aussehen und die Bedienung; null Risiko; passt zum Demo-Modus der Showcase |
| Contra | keine echten Daten, KI-Knöpfe nur simuliert; zweite Codebasis-Variante, die bei Board-Änderungen nachgezogen werden muss; 640 px-Rahmen knapp |

**(e) Hybrid = (b) + (a)-Knopf** — öffentlich lesen, gearbeitet wird lokal.

| | |
|---|---|
| Aufwand | ≈ 4–6 PT (Weg b) + 0,5 PT |
| Pro | Besucher sehen echte Zahlen und den Pipeline-Stand; der Owner bekommt in Rootwork einen Knopf „Board öffnen" (lokale Instanz, neues Fenster); local-first, token-frei und Drive-Wahrheit bleiben unangetastet; später erweiterbar (z. B. Ideen aus Rootwork als Karte vorschlagen per Drive-Datei) |
| Contra | zwei Orte (Lesen in Rootwork, Arbeiten im Board); Aktualität hängt am Owner-Rechner |

---

## 6. Empfehlung

**Weg (e) Hybrid**, in dieser Reihenfolge:

1. Board schreibt nach jedem KPI-Lauf und Abgleich einen schlanken Export (Kennzahlen je Plattform,
   letzte Beiträge, Anzahl Karten je Phase, nächste Upload-Termine) — Ziel: die Rootwork-Supabase oder
   eine öffentliche JSON-Datei. Das Board **pusht**; Vercel braucht keinen Drive-Zugang.
2. Rootwork ersetzt auf `#/board%3Asocial-media` die Demo-Werte durch diesen Export (das Banner
   „Anbindung folgt" ist genau dafür da).
3. Ein Knopf „Board öffnen" verweist auf `https://localhost:4321` — für den, auf dessen Rechner es läuft.
   Als `iframe` erst, wenn auf diesem Rechner getestet (Zertifikat, Browser-Sperren, Höhe).

**Begründung:** Der Wert des Boards entsteht lokal (Drive als Wahrheit, KI ohne Token-Kosten über das
Abo). Weg (c) gibt genau das auf und kostet ein zweites Produkt. Weg (a) allein zeigt Besuchern nichts.
Weg (b)/(e) liefert das, was die Showcase sichtbar schon erwartet, mit Daten, die das Board bereits
erzeugt — und ändert am Board nur einen zusätzlichen Export-Schritt.

---

## 7. Was nicht sicher festgestellt ist

- **Rootwork-Repo und Schreibweg:** Das Bundle zeigt Supabase und das Anwendungs-Register, aber nicht,
  in welchem Repo/Supabase-Projekt Leon den Export empfangen will und welche Tabelle/RLS-Regel dafür gilt.
- **iframe von öffentlicher Seite auf `https://localhost:4321`:** nicht getestet; abhängig vom Browser
  (Private-Network-Access-Regeln, Zertifikatsvertrauen).
- **Aufwände** sind Schätzungen aus der Codegröße (`wc -l`: `server.js` 2211 Z., `public/*.js` 11 743 Z. (`cat public/*.js | wc -l`)),
  nicht gemessen.
- **Welche Daten öffentlich sein dürfen** (Karten-Titel, Termine, Zahlen) ist eine Entscheidung von
  Owner und Leon, keine technische.
