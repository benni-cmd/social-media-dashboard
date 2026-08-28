# Content-Maschine

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

**KI ohne Token-Kosten.** Recherche, Skript, Regieplan, Captions je Plattform, Ideen-Nachschub
und Redaktionsplan laufen ueber die lokale **Claude-Code-CLI** (`claude -p`) — also ueber das
Abo, nicht ueber die kostenpflichtige API.

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

Dann `http://localhost:4321` oeffnen. Der Server braucht **keine** npm-Abhaengigkeiten, nur
Node ab Version 20 — er nutzt ausschliesslich Bordmittel.

## Aufbau

| Ort | Aufgabe |
|---|---|
| `lib/pipeline.js` | Die eine Quelle: Phasen, Ordner, Termine, Karten-Schema, Qualitaetstore. Laeuft im Server UND im Browser. |
| `lib/drive.js` | rclone-Anbindung. Trennt "gibt es nicht" von "geht gerade nicht". |
| `lib/projects.js` | Projektordner anlegen, verschieben, lesen — und der Abgleich Board gegen Drive. |
| `lib/ai.js` | Marken- und Praxis-Regeln, Prompts, Claude-CLI. |
| `lib/social.js` | Instagram- und LinkedIn-Zahlen. |
| `server.js` | Nur Wegweisung. |
| `public/` | Oberflaeche: `board` · `kalender` · `auswertung` · `detail` · `nachschub`, Bausteine in `ui.js`. |
| `data/board.json` | Karten-Index mit Versionsnummer. |
| `docs/best-practices.md` | Belegbasis jeder eingebauten Regel, mit Quelle und Belegstaerke. |
| `docs/drive-convention.md` | Der Drive-Vertrag. |
| `docs/packages/` | Arbeitspakete (Problem · Intent · Goal · Plan · Stand · DoD). |
