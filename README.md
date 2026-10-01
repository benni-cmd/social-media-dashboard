# WEE Social Media Suit — Content-Board

Lokales Werkzeug für Social-Media-Content: von der Idee über Skript, Dreh, Schnitt und Caption bis
zum Upload — und danach die Zahlen zurück an die Karte, aus der der Beitrag kam. Läuft auf dem
eigenen Rechner (`https://localhost:4321`), speichert alles in **einem Google-Drive-Ordner** und
nutzt KI ohne API-Kosten (Claude-Abo über die Claude-CLI, lokale Modelle über Ollama).

> **Installieren, einrichten, umziehen:** [`INSTALL.md`](INSTALL.md).
> **Diese Datei:** wie das Board funktioniert — die Regeln, nach denen es entscheidet.

---

## 1. Grundsatz: Drive ist die Wahrheit

Ein Board = ein Drive-Hauptordner. **Der Name oben links ist der Name dieses Ordners**; wer das Board
umbenennt, benennt den Ordner um. Alles Dauerhafte liegt dort — Karten (als Projektordner), Einstellungen,
Prompts, Redaktionsplan, KI-Rollen. Lokal (`data/`) liegen nur Zwischenspeicher und Zugangsdaten.

Ohne Board bleibt Drive voll nutzbar: ein Projekt wechselt die Phase, indem man seinen Ordner in den
nächsten Spaltenordner zieht; jeder Projektordner trägt einen `Steckbrief.md` mit Stand und Terminen.
Vertrag im Detail: [`docs/drive-convention.md`](docs/drive-convention.md).

```
<Board-Name>/                      ← Drive-Hauptordner = Name des Boards
├── In Bearbeitung/
│   ├── 1 Idee/          Spalte „Skript schreiben"
│   ├── 2 Skript/        Spalte „Drehtermin festlegen"
│   ├── 3 Videodreh/
│   ├── 4 Schnitt/
│   ├── 5 Caption/
│   └── 6 Upload/
├── Videoauswertung/     Spalte „Fertig" (+ Auswertung-Tabellen/)
├── Verworfen/
├── Kontext/_global/     Dateien, die die KI über die Firma wissen soll
├── Papierkorb/
└── System (AI only)/    Einstellungen des Boards (nicht von Hand ändern)
```

Die Struktur ist **fest**. Ein leerer Ordner bekommt sie beim ersten Öffnen angelegt; ein Ordner mit
falscher Struktur wird abgelehnt — mit Grund. Ohne gewählten Ordner arbeitet das Board nicht in Drive
(es gibt keinen eingebauten Standard-Ordner); der Einrichtungs-Assistent fragt ihn ab.

## 2. Karten und Spalten

Eine Karte ist ein Beitrag. Sie trägt **Thema, Format, Kategorie, Ziel, Plattformen** („Worum geht es")
und wandert von links nach rechts. Die Detailspalte zeigt immer nur den nächsten sinnvollen Schritt:
erst „Worum geht es" vollständig, dann der Termin, dann die Arbeit der Spalte.

**Formate:** Reel · Slider · Beitrag mit Text · Story · Highlight · Langformat-Video. Video-Formate
(Reel, Langformat) durchlaufen Drehtermin und Videodreh; die anderen überspringen diese Sperren und
bekommen eigene KI-Schritte (Slides, Visual-Konzept, Story-Frames, Kapitel).

**Weiter-Knopf und Sperren:** „Weiter" prüft die Qualitätstore der Spalte (z. B. Kategorie gewählt,
Skript-Dokument in Drive, Sprechzeit, Hashtag-Grenzen). Was sperrt, steht mit Begründung an der Karte.
Ziehen per Maus und das Kontextmenü verschieben **ohne** Prüfung — bewusst, als Handsteuerung.
Herkunft jeder Regel: [`docs/best-practices.md`](docs/best-practices.md).

**Ampel an der Karte:** Punkt = Zeit bis zur dringlichsten Frist (rot ≤ 2 Tage oder überfällig, gelb
3–5, grün ab 6; fest). Rotes **„!"** = Warnung (etwas ist falsch oder verstößt gegen eine Regel);
gelber Kreis = Hinweis (etwas fehlt oder eine Empfehlung greift). Einzeln abschaltbar unter
Einstellungen → Mitteilungen.

## 3. Termine

**Eine zentrale Deadline je Karte: das Upload-Datum.** Alle anderen Fristen hängen als Kette davor
(Einstellungen → Termine & Fristen → Deadline-Vorlauf; Standard):

| Schritt | liegt vor … | Standard |
|---|---|---|
| Freigabe | dem Upload | 3 Tage |
| Schnitt | der Freigabe | 3 Tage |
| Dreh | dem Schnitt | 6 Tage |

Der **Drehtermin** kommt aus der Drehleiste oben (Sammeltermine für mehrere Karten). Zu späte
Drehtermine werden abgelehnt.

### Nächster freier Upload-Termin (eine Regel, überall gleich)

Gilt für die Kachel „Nächstes freies Datum", „Nächsten freien Upload-Termin" (schwebend, rutscht mit),
das Kontextmenü und „Idee von der KI" (`lib/uploadslots.js`):

1. **Format passt:** nur Slots des Redaktionsplans mit demselben Format (Slider bekommt nur Slider-Slots;
   Story und Highlight teilen sich die Story-Slots).
2. **Machbar:** Video-Formate frühestens **nächster Drehtermin + 8 Tage**; Formate ohne Dreh frühestens
   **heute + Freigabe- + Schnitt-Vorlauf** (Standard 6 Tage).
3. **Frei:** kein anderer Beitrag hat Datum + Uhrzeit schon belegt.
4. Ist für das Format nichts geplant, sagt das Board das im Klartext — es erfindet kein Datum.

## 4. Redaktionsplan und Wochenziel

Der Redaktionsplan legt fest: aktive Plattformen, **Posts pro Woche je Format** (0,25 = alle 4 Wochen),
maximaler Abstand zwischen zwei Posts, Kategorien, Zielgewichte, Kampagnen. Daraus rechnet das Board
feste Slots (`lib/scheduler.js`, v95):
- Der Zeitpunkt richtet sich nach der **Hauptplattform** des Formats (Reel → Instagram, Slider/Beitrag → LinkedIn,
  Langvideo → YouTube/LinkedIn, Story → Instagram) und deren belegten Tagen und Zeiten (Instagram Di–Do 11:30/18:30,
  LinkedIn Di–Do 15:30/17:00, YouTube Di–Mi 15:00/17:00, TikTok Sa/So/Mo).
- Jede Woche dieselben Tage: 1 Post → Mi, 2 → Di + Do, 3 → Di, Mi, Do; mehr → zusätzlich Mo/Fr.
- Wochenende nur, wenn die Hauptplattform es belegt (TikTok) oder bei vielen Stories.
- Mehrere Formate verteilen sich über die Woche; teilen sie einen Tag, bekommt das zweite die zweite Uhrzeit.
- Max-Abstand zieht einen Slot vor, aber nie auf Sa/So (dann auf den Freitag davor).

**Wochenziel (Kopfzeile):** Soll = Slots der laufenden Kalenderwoche (Mo–So) je Format; Ist = Karten mit
Upload-Datum in dieser Woche. Die Kopfzeile sagt, was fehlt („es fehlt 1× Reel").

## 5. KI

Jeder KI-Knopf ist eine **Kette aus Schritten**; jeder Schritt hat eine **Rolle** und einen **Prompt**.
Die Rolle bestimmt das Modell:

| Rolle | Aufgabe | Empfehlung |
|---|---|---|
| Userkommunikation | Texte, die man sieht (Hooks, Skript, Caption, Ideen) | Claude (Haiku/Sonnet/Opus) über die Claude-CLI |
| Recherche | Fakten sammeln, mit Web-Suche | `deepseek-r1:14b` lokal (gründlich, langsamer) |
| Kontextabgleich | Texte mit dem Firmenkontext abgleichen | `qwen2.5:14b` lokal (schnell, genau) |

- **Prompts** (Einstellungen → System Prompts): ein **System-Vorspann** für jeden Text, dann je Knopf
  die Schritte. `{{Platzhalter}}` setzt das Board ein (Karteninhalt, Firmenkontext, Hausregeln).
  Je Format kann ein Knopf eine eigene Fassung haben; sonst gilt der Standard.
- **Standard-Prompts sind neutral** (reine Social-Media-Funktion, kein Unternehmen eingebaut) und gleich
  gegliedert: AUFGABE · DU BEKOMMST · REGELN · AUSGABE. Marke, Zielgruppe, Ton und Marken-Hashtags kommen
  ausschließlich aus dem Firmenkontext.
- **Die Schritte geben weiter:** jeder KI-Schritt bekommt im Karten-Kontext, was vorher entschieden wurde —
  gewählter Fokus, gesprochener und Bild-Hook, recherchierte Fakten und Suchbegriffe, das aktuelle Skript und
  bisherige Format-Ergebnisse (z. B. bekommt „Visual je Slide" die Slides aus „Slider aufbauen"; Caption und
  Regieplan bekommen das Skript).
- **Firmenkontext** (Einstellungen → Unternehmenskontext, gespeichert in Drive `System (AI only)/kontext.json`): Text + Dateien aus `Kontext/_global/`; geht
  in jeden Prompt. Kein Standard — die Einrichtung fragt ihn ab.
- **Web-Suche:** DuckDuckGo ohne Schlüssel; optional Tavily (`TAVILY_API_KEY`).
- Lokale Modellnamen ohne Größe (`deepseek-r1`) löst das Board auf das installierte Modell auf.

## 6. Anbindungen — wer, womit, wohin

| Anbindung | Rolle | Datenfluss | Womit |
|---|---|---|---|
| Google Drive | Quelle der Wahrheit | Board ↔ Drive (lesen + schreiben) | rclone, Google-Konto des Ordners |
| Google Kalender + Tasks | nur Ziel | Board → Google: Drehtermin = Kalendertermin + Aufgabe; nichts zurück | Google-Anmeldung über eigene Google-Cloud-App |
| Claude | KI-Rechenleistung | Prompt hin, Text zurück | Claude-CLI, eigenes Claude-Abo |
| Ollama | lokale KI | bleibt auf dem Rechner | Ollama-Dienst `localhost:11434` |
| Instagram / LinkedIn | Quelle nur für Zahlen | Plattform → Board (lesen) | eigene Meta- bzw. LinkedIn-App |

Einstellungen → Google, → Social Media und → KI-Rollen (Claude) zeigen je Anbindung **Konto, Datenfluss, Anbindung und Zustand** (live /
gestört / abgelaufen, mit Grund und „zuletzt erfolgreich"). Eine von Google abgelehnte Anmeldung
erscheint als „Anmeldung abgelaufen", nie als grün. Claude lässt sich dort direkt anmelden.

**Zugangsdaten** liegen nur lokal: `.env` (App-Schlüssel), `data/tokens.json` (Anmeldungen),
`data/.gdrive-env.json` (rclone). Nichts davon liegt in Drive oder auf GitHub (geprüft 01.10.2026).

## 7. Auswertung

- Kennzahlen der letzten 30 Tage, verglichen mit den 30 davor.
- **Wochenstatistik** (Mo–So, 8 Wochen, neueste oben): Redaktionsplan erfüllt? · veröffentlicht ·
  Reichweite · Views · Interaktionen.
- Letzte Beiträge beider Plattformen, Plattform-Vergleich, Bestperformer.
- Vergleichslinie ist der **eigene gleitende Median** — Branchen-Benchmarks sind unbelegt und deshalb
  nicht eingebaut.

## 8. Aufbau des Codes

| Ort | Aufgabe |
|---|---|
| `server.js` | HTTPS-Server, API-Wegweisung, statische Dateien. Keine npm-Abhängigkeiten. |
| `lib/pipeline.js` | Die eine Quelle: Phasen, Formate, Karten-Schema, Fristen, Qualitätstore. Läuft in Server **und** Browser. |
| `lib/uploadslots.js` | Nächster freier Upload-Termin, Woche gegen Redaktionsplan. |
| `lib/scheduler.js` | Slots aus dem Redaktionsplan. |
| `lib/drive.js`, `lib/drivesetup.js`, `lib/projects.js` | rclone-Anbindung, Ordnerprüfung/-name, Projektordner und Abgleich. |
| `lib/ai.js`, `lib/promptstore.js`, `lib/websuche.js` | KI-Aufrufe (Claude-CLI, Ollama), Prompts, Web-Suche. |
| `lib/gcal.js`, `lib/claudeauth.js` | Google Kalender/Tasks, Claude-Anmeldung aus dem Board. |
| `lib/social.js`, `lib/kpi*.js` | Instagram/LinkedIn-Zahlen, Auswertungs-Tabellen. |
| `lib/*store.js` | Einstellungen in Drive (Plan, Prompts, Defaults, Workflows, Board-Parameter, Kontext). |
| `public/` | Oberfläche: `board`, `detail`, `redaktionsplan`, `auswertung`, `einrichtung`, Bausteine in `ui.js`, Zustand in `store.js`. |
| `docs/packages/` | Arbeitspakete (Problem · Intent · Goal · Plan · Stand · DoD) — die Historie jeder Entscheidung. |
