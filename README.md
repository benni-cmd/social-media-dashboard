# WEE Social Media Suit

Lokales Werkzeug fuer den Social-Media-Content der NGO World Eden Era. Es traegt den Weg von
der Idee bis zum veroeffentlichten Video — und holt die Zahlen danach zurueck an die Karte,
aus der das Video kam.

## Was es tut

**Board.** Sieben Phasen: Idee › Skript › Videodreh › Schnitt › Caption › Upload › Fertig.
Jede Phase ist ein Ordner in Google Drive; wandert die Karte, wandert der Ordner mit.

**Termine.** Sechs Meilensteine je Karte statt eines Upload-Datums: Idee, Skript, Dreh,
Schnitt, Freigabe, Veroeffentlichung mit Uhrzeit. Ein Knopf rechnet den Rueckwaertsplan aus
dem Veroeffentlichungsdatum. Der Kalender zeigt alles auf einen Blick.

**Qualitaetstore.** Vor jedem Phasenwechsel prueft das Werkzeug automatisch, was belegt
wirkt — Sprechzeit, Hooklaenge, Untertitel, fremde Wasserzeichen, Hashtag-Grenzen je
Plattform, genau ein Aufruf zum Handeln, keine Bitte um Likes. Herkunft jeder Regel:
[`docs/best-practices.md`](docs/best-practices.md). Was sperrt, sperrt sichtbar und mit
Begruendung.

**KI in drei Rollen.** Die KI-Aufgaben (Recherche, Skript, Regieplan, Captions je Plattform,
Ideen-Nachschub, Redaktionsplan) sind auf drei getrennt konfigurierbare Rollen verteilt —
**Userkommunikation**, **Recherche** und **Kontextabgleich** —, jede mit eigenem Modell: lokal
ueber **Ollama** (kostenlos, Default) oder ueber die **Claude-Code-CLI** (`claude -p`, dein Abo
statt der kostenpflichtigen API). Die **Recherche-Rolle sucht echt im Web** (DuckDuckGo,
schluessellos; Tavily optional per Key).

**Anbindungen.** Google (Kalender/Tasks, Drive), Instagram, LinkedIn und Claude lassen sich in
den Einstellungen **verbinden — und ebenso wieder trennen**.

**Auswertung.** Instagram- und LinkedIn-Zahlen, verglichen gegen den **eigenen gleitenden
Median** der letzten Beitraege. Branchen-Benchmarks aus Blogs sind bewusst nicht verdrahtet —
sie sind unbelegt.

## Einrichtung

```
npm i -g @anthropic-ai/claude-code   # CLI installieren
claude                               # einmal starten und interaktiv einloggen
```

Google Drive laeuft ueber `rclone` mit dem Remote `gdrive:`. **Eigene client_id ist Pflicht
geworden** — die geteilte wird 2026 abgeschaltet, Weg steht in
[`docs/drive-convention.md`](docs/drive-convention.md).

Fuer die Auswertung: `.env` aus `.env.example` anlegen und die App-Zugaenge eintragen.

## Starten

```
npm start
```

Dann `https://localhost:4321` oeffnen (HTTPS, selbstsigniert — der Browser fragt einmal nach).
Der Server braucht **keine** npm-Abhaengigkeiten, nur Node ab Version 20 — er nutzt ausschliesslich
Bordmittel. Unter Windows startet `Start-Board.cmd` dasselbe per Doppelklick.

## Auf einem anderen Rechner

```
git clone https://github.com/benni-cmd/social-media-dashboard.git
cd social-media-dashboard
npm start          # oder: node server.js
```

Voraussetzungen: **Node ab 20** und **`openssl` im PATH** — beim ersten Start erzeugt der Server
daraus sein selbstsigniertes Zertifikat (`data/localhost.key`/`.crt`). Bei „Git fuer Windows" ist
`openssl` dabei; fehlt es im `cmd`-PATH, bricht der Start ab. Google Drive (`rclone`) und die
Auswertungs-Zugaenge (`.env`) sind optional — ohne verbundenes Drive startet das Board **leer**:
die Karten-Daten liegen in Google Drive (die Wahrheit) und werden beim ersten Abgleich geholt.
`data/board.json` ist nur der lokale Cache und wird **nicht** mehr im Repo mitgeliefert; bis zum
ersten Abgleich meldet das Board Drive-Aktionen als „geht gerade nicht".

## Aufbau

| Ort | Aufgabe |
|---|---|
| `lib/pipeline.js` | Die eine Quelle: Phasen, Ordner, Termine, Karten-Schema, Qualitaetstore. Laeuft im Server UND im Browser. |
| `lib/drive.js` | rclone-Anbindung. Trennt "gibt es nicht" von "geht gerade nicht". |
| `lib/projects.js` | Projektordner anlegen, verschieben, lesen — und der Abgleich Board gegen Drive. |
| `lib/ai.js` | Marken- und Praxis-Regeln, Prompts, KI-Aufrufe (Claude-CLI + Ollama, KI-Rollen). |
| `lib/websuche.js` | Web-Suche fuer die Recherche-Rolle (DuckDuckGo schluessellos, Tavily optional). |
| `lib/social.js` | Instagram- und LinkedIn-Zahlen. |
| `server.js` | Nur Wegweisung. |
| `public/` | Oberflaeche: `board` · `kalender` · `auswertung` · `detail` · `nachschub`, Bausteine in `ui.js`. |
| `data/board.json` | Lokaler Karten-Cache mit Versionsnummer (nicht im Repo; Drive ist die Wahrheit). |
| `docs/best-practices.md` | Belegbasis jeder eingebauten Regel, mit Quelle und Belegstaerke. |
| `docs/drive-convention.md` | Der Drive-Vertrag. |
| `docs/packages/` | Arbeitspakete (Problem · Intent · Goal · Plan · Stand · DoD). |
