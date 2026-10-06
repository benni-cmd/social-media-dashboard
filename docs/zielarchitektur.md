# Zielarchitektur — das Board als Social-Media-Modul von Rootwork

> Stand 06.10.2026, Paket [`v111`](packages/v111-zielarchitektur-rootwork.md). Ergänzt
> [`architektur.md`](architektur.md) (wie das Board **heute** funktioniert: API, Speicher-Vertrag,
> Funktionen, Tore). Dieses Dokument beschreibt das **Ziel**: Das Board ersetzt in der fertigen
> Rootwork-Software den kompletten Bereich „Social Media" und wird danach ergänzt.
>
> **Für wen:** Leon, der es einbaut. Alles, was nur er mit Rootwork-Wissen entscheiden kann, steht als
> Aufgabe in **Abschnitt 11**. Belegte Fakten tragen Fundstelle oder Quelle; Optionen sind als Optionen
> markiert, mit Empfehlung.

---

## 0. Festgelegt (Owner, 06.10.2026)

| Frage | Festlegung |
|---|---|
| Für wen | **Nur World Eden Era** — eine Organisation, keine Mandantentrennung |
| Board-Zahl | **Ein gemeinsames Board** = ein Drive-Ordner, den die Organisation freigibt |
| Drive-Zugang | **Jeder Nutzer verbindet sein eigenes Google-Konto**; Zugriff folgt den Drive-Freigaben |
| Google | **Google Workspace** (eigene Domain) |
| Rechte | **Rootwork-Rollen** — das Board bringt kein eigenes Rollenmodell mit |
| Claude in der gehosteten Version | **API-Schlüssel der Organisation** (Begründung 6.1) |
| Lokale KI | **Kleines Hilfsprogramm je PC** erlaubt, verbindet Rootwork mit Ollama |
| Speicher | **Speicher-Schicht für Drive UND Datenbank**; je Datenart umstellbar (Abschnitt 5) |
| Grundsatz | **Drive bleibt die Ausweichmöglichkeit:** Skripte, Videos und der Stand je Projekt liegen immer menschenlesbar in der wandernden Ordnerstruktur — fällt das System aus, wird in Drive weitergearbeitet |
| Erster Baustein | **Onboarding** — ohne es liegen keine Daten im Board (Abschnitt 3) |

---

## 1. Zielbild

```
 ┌─────────────────────── Rootwork (gehostet) ───────────────────────┐
 │ Browser: Rootwork-SPA (React/Vite, Hash-Routing)                  │
 │   Bereich „Marketing und Kommunikation → Social Media"            │
 │   = Board-Modul: Board · Detail · Kalender · Redaktionsplan ·     │
 │     Auswertung · Einstellungen · Onboarding                       │
 │        │ Rootwork-Anmeldung (Supabase Auth)                        │
 │        ▼                                                           │
 │ Server-Teil: Funktionen (Vercel und/oder Supabase) + Jobs          │
 │   Drive-Adapter (Drive-API, Token des Nutzers)                     │
 │   KI-Adapter (Claude-API, Schlüssel der Organisation)              │
 │   Social-Adapter (Instagram/LinkedIn), Kalender-Adapter            │
 │        │                                                           │
 │ Supabase-Datenbank: Nutzer/Rollen (Rootwork) · Google-Token ·     │
 │   Board-Zustand (Stufe 2) · KI-Aufträge für das Hilfsprogramm      │
 └────────┬──────────────────────────────────────┬───────────────────┘
          │ Drive-API                             │ Auftrag/Antwort
          ▼                                       ▼
 ┌── Google Drive (Workspace) ──┐      ┌── PC des Nutzers (optional) ──┐
 │ EIN Board-Ordner, Struktur   │      │ Hilfsprogramm → Ollama        │
 │ wie heute (drive-convention) │      │ (localhost:11434)             │
 │ = Ausweichweg ohne System    │      └───────────────────────────────┘
 └──────────────────────────────┘
```

**Was gleich bleibt:** der Ordnervertrag (`docs/drive-convention.md`), die Phasen und Qualitätstore
(`lib/pipeline.js`), die Automationen (`lib/workflows.js`), Hinweise/Warnungen (`lib/kartenhinweise.js`),
Redaktionsplan-Logik (`lib/scheduler.js`, `lib/uploadslots.js`), Prompts als Schritt-Ketten mit Rollen.

**Was ersetzt wird:** rclone → Drive-API; Claude-/Codex-CLI → Claude-API bzw. Hilfsprogramm; lokaler
Node-Server → Server-Teil von Rootwork; `data/` → Supabase; „ein Owner" → Rootwork-Nutzer mit Rollen;
OAuth-Rückrufe auf `localhost:4321` → Rootwork-Domain.

---

## 2. Was vom heutigen Code übernommen wird

### 2.1 Unverändert übernehmbar (reines JS, läuft schon heute im Browser)

| Datei | Inhalt |
|---|---|
| `lib/pipeline.js` (1350 Z.) | Phasen, Formate, Kartenschema + Migration, Fristen/Rückwärtsplan, Ampel, Qualitätstore `tore()`, Projektnamen, Pfadprüfung |
| `lib/workflows.js` | Register der Automationen (Auslöser, Wirkung, Parameter) |
| `lib/kartenhinweise.js` | Katalog der Hinweise und Warnungen |
| `lib/scheduler.js`, `lib/uploadslots.js` | Slots aus dem Redaktionsplan, nächster freier Upload-Termin |
| `lib/zuordnung.js`, `lib/kampagnen.js` (Rechenteile) | Post ↔ Karte, Kampagnen-Anlässe |
| Prompt-Vorlagen in `lib/ai.js` (`PROMPTS`) | 15 Aufgaben mit Schritt-Ketten |

Diese Dateien sind die **fachliche Logik** des Boards. Empfehlung: als eigenes Paket (z. B.
`@wee/board-core`) aus diesem Repo veröffentlichen oder kopieren — Rootwork importiert sie, statt sie
nachzubauen.

### 2.2 Zu ersetzen (Adapter — eine Datei je Außenwelt)

| Heute | Ziel | Umfang heute |
|---|---|---|
| `lib/drive.js` (rclone) | Drive-API-Adapter mit **derselben Schnittstelle** | 26 Exporte (`existiert, mkdir, writeFile, readFile, list, ordnerBaum, moveDir, deleteFile, kopiereDateiRauf, …`); rclone wird außerhalb nur in `lib/drivesetup.js` Z. 30 und 180 direkt aufgerufen (`rcloneMitRoot`) |
| `lib/ai.js` (`runClaude`, `runCodex`, `runOllama*`) | KI-Adapter (Abschnitt 6) | Pipeline-Steuerung `laufePipeline` in `server.js` bleibt fachlich gleich |
| `lib/*store.js` | Speicher-Schicht (Abschnitt 5) | 6 Stores, alle nach dem Muster „Cache lokal, Wahrheit in Drive" |
| `server.js` (81 Handler) | Server-Teil von Rootwork (Abschnitt 8) | Tabelle aller Endpunkte: `architektur.md` Abschnitt 2 |
| `data/tokens.json`, `.env` | Supabase (verschlüsselt, nur serverseitig lesbar) + Umgebungsvariablen der Plattform | — |

### 2.3 Oberfläche — Optionen

| Option | Wie | Aufwand | Pro | Contra |
|---|---|---|---|---|
| **O1 Nachbau in React** | Ansichten als Rootwork-Komponenten, Logik aus 2.1 importiert | hoch (Frontend heute 11 743 Z. Vanilla-JS, `cat public/*.js \| wc -l`) | einheitliches Rootwork-Design, ein Code-Stil | größter Aufwand; Board-Weiterentwicklung muss in zwei Codebasen oder wird hier eingefroren |
| **O2 Board-Frontend als Unterseite** | `public/` als eigene Route/Unterseite derselben Domain, `store.js` spricht die neuen Endpunkte | mittel | Board bleibt eine Codebasis; schnell lauffähig | zwei UI-Stile nebeneinander; Anmeldung muss geteilt werden (gleiche Domain → Supabase-Sitzung lesbar) |
| **O3 Schrittweise** | erst O2, dann Ansicht für Ansicht nach React (Auswertung zuerst — Rootwork hat dafür schon Kacheln) | verteilt | früh nutzbar, Risiko klein | Übergangszeit mit Mischbild |

Empfehlung: **O3**. Die Logik in 2.1 ist in allen drei Optionen dieselbe.

---

## 3. Onboarding (erster Baustein)

Heute führt `public/einrichtung.js` durch 11 Schritte und trennt schon „gilt für diesen Rechner" von
„gilt für das Board" (`LOKALE_SCHRITTE`). Gehostet wird daraus „gilt für den Nutzer" und „gilt für die
Organisation (einmal)":

| Schritt heute (`id`) | Gehostet | Wer, wann | Gespeichert |
|---|---|---|---|
| Google Drive verbinden (`drive`) | Google-Anmeldung über Rootwork (OAuth, interne Workspace-App) | **jeder Nutzer**, beim ersten Öffnen des Moduls | Refresh-Token in Supabase, nur serverseitig |
| Projektordner wählen (`ordner`) | Board-Ordner festlegen; Struktur prüfen oder anlegen (`pruefeStruktur`) | **Organisation, einmal** (Rolle laut 7) | Ordner-ID in Supabase |
| Board-Name (`name`) | = Name des Drive-Ordners, wie heute | Organisation, einmal | Drive |
| KI-Weg (`kiweg`) | Claude-API / Hilfsprogramm / beides | Organisation legt Standard fest, Nutzer kann Hilfsprogramm ergänzen | Supabase |
| Claude anmelden (`claude`) | **entfällt** → API-Schlüssel der Organisation hinterlegen | Organisation, einmal | Server-Umgebungsvariable / Geheimnis-Speicher |
| ChatGPT anmelden (`chatgpt`) | siehe 6.4 | — | — |
| Lokale KI (`ollama`) | Hilfsprogramm installieren und koppeln (6.2) | **jeder Nutzer**, optional | Kopplung in Supabase |
| Firmenkontext (`firma`) | wie heute | Organisation | Drive `System (AI only)/kontext.json` (Stufe 1) |
| System-Prompts (`prompts`) | wie heute | Organisation | Drive `System (AI only)/prompts.json` (Stufe 1) |
| Redaktionsplan (`plan`) | wie heute | Organisation | Drive `System (AI only)/redaktionsplan.json` (Stufe 1) |
| Google Kalender + Tasks (`google`) | Scope beim Google-Login mit anfragen | jeder Nutzer, optional | wie Drive-Token |
| *(neu)* Instagram/LinkedIn | Konten der Organisation verbinden | Organisation, einmal | Token in Supabase, serverseitig |

**Showcase:** Damit das Modul dort nicht leer ist, braucht das Onboarding einen Weg zu Daten. Optionen:
(a) Onboarding im Demo-Modus durchklickbar, danach synthetische Board-Daten wie der Rest der Showcase;
(b) echtes Onboarding gegen einen Test-Workspace-Ordner. Wahl bei Leon (Abschnitt 11).

---

## 4. Drive-Schicht

### 4.1 Zugang
- **Anmeldung je Nutzer** mit Google (OAuth), App-Typ **intern** im Workspace: keine Google-Verifizierung
  nötig ([Google: Production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview),
  [Google Cloud FAQ](https://support.google.com/cloud/answer/13463817)). Für Drive-Scopes kann der
  Workspace-Admin die App freigeben müssen (App-Zugriffsregeln der Admin-Konsole).
- **Scope:** Das Board verschiebt Ordner, die Menschen auch von Hand verschieben, und liest den ganzen
  Board-Ordner → es braucht Zugriff auf Dateien, die es nicht selbst angelegt hat (voller Drive-Scope).
  Ein Scope nur für selbst angelegte Dateien (`drive.file`) reicht für den Ausweichweg „Menschen arbeiten
  direkt in Drive" nicht.
- **Ablage des Ordners — Optionen:** geteilte Ablage (Shared Drive) der Organisation oder ein freigegebener
  Ordner in „Meine Ablage" eines Kontos. Das Board unterstützt beides schon (`setzeRoot(id, teamDrive)`,
  v103). Empfehlung: **geteilte Ablage** — gehört der Organisation, nicht einer Person.
- **Wer schreibt:** Jede Aktion läuft mit dem Token des handelnden Nutzers → Drive zeigt, wer was geändert
  hat; wer keine Freigabe hat, kann nichts tun.

### 4.2 Hintergrundarbeit ohne angemeldeten Nutzer
KPI-Messung, Steckbriefe, Abgleich nach Hand-Verschiebungen laufen heute beim Serverstart. Gehostet braucht
das einen Zugang ohne Browser. Optionen:
1. Refresh-Token eines festgelegten Nutzers (einfach; hängt an einer Person).
2. Dienstkonto als Mitglied der geteilten Ablage (hängt an der Organisation; Dienstkonto-Schlüssel muss
   sicher verwahrt werden).
Empfehlung: **2**, wenn die geteilte Ablage gewählt wird.

### 4.3 Abgleich Drive ↔ Board
Heute: `POST /api/drive/reconcile` liest alle Phasenordner (10–70 s mit rclone, gemessen v25).
Gehostet — Optionen:
1. Gleicher Vollscan über die Drive-API, ausgelöst beim Öffnen des Moduls (einfach; Laufzeit mit der API
   nicht gemessen).
2. Änderungen statt Vollscan: Drive `changes`-Liste/`changes.watch` oder die Workspace Events API, die
   u. a. „Datei in Ordner verschoben" meldet
   ([Drive Push](https://developers.google.com/workspace/drive/api/guides/push),
   [Workspace Updates 07/2025](https://workspaceupdates.googleblog.com/2025/07/google-drive-events-api-now-available.html)).
Regel bleibt: **Drive gewinnt**, jede Korrektur wird als Satz gemeldet (`docs/drive-convention.md`).

### 4.4 Dateien und Videos
Vercel-Funktionen nehmen höchstens **4,5 MB** Request-Body an
([Vercel Functions Limits](https://vercel.com/docs/functions/limitations)). Videos gehen deshalb
**direkt vom Browser nach Drive** per Resumable Upload (Pflicht ab 5 MB, Sitzungs-URL + Teil-Uploads,
fortsetzbar). Der Server erzeugt nur die Upload-Sitzung mit dem Token des Nutzers. ZIP-Download
(`/api/projekt/download`) entsprechend: Links auf die Drive-Ordner statt Server-ZIP, oder ZIP im Browser.

---

## 5. Speicher-Schicht

Eine Schnittstelle je Datenart mit zwei Ausführungen: **Drive** (= heutiger Vertrag) und **Datenbank**
(Supabase). Umstellung je Datenart einzeln.

| Datenart | Heute (Wahrheit · Cache) | Stufe 1 gehostet | Stufe 2 (Ziel) | Bleibt immer in Drive |
|---|---|---|---|---|
| Projektordner je Karte | Drive | Drive | Drive | **ja** — Ordner wandert mit der Phase |
| Skripte, Captions (`.md`) | Drive | Drive | Drive | **ja** |
| Rohmaterial, fertige Videos | Drive | Drive | Drive | **ja** |
| `Steckbrief.md` (Stand für Menschen) | Drive | Drive | Drive (vom System geschrieben) | **ja** — Ausweichweg |
| Karten-Index (`projekt.json`, `board.json`) | Drive · `data/board.json` | Drive · Supabase als Cache | **Supabase** | Option: `projekt.json` weiter spiegeln |
| Drehtermine | `data/board.json` | Supabase | Supabase | im Steckbrief |
| Redaktionsplan + Slots | Drive `System (AI only)/redaktionsplan*.json` | Drive | Supabase | Option: Export |
| Prompts, Workflows, Defaults, Kategorien/Ziele | Drive `System (AI only)/*.json` | Drive | Supabase | Option: Export |
| Firmenkontext | Drive `kontext.json` + `Kontext/_global` | Drive | Text in Supabase, Dateien in Drive | Kontext-Dateien |
| KPI-Messungen | Drive `Videoauswertung/KPI/*.json` + CSVs | Drive | Supabase (+ CSV-Export nach Drive) | CSVs für Menschen |
| Zugangsdaten | `.env`, `data/tokens.json` | **Supabase, verschlüsselt, nur serverseitig** | ebenso | **nie** |

**Regeln, die in beiden Stufen gelten** (heute schon im Code):
- Versionsnummer gegen gleichzeitiges Überschreiben (`PUT /api/board` → 409). Mit mehreren Nutzern wird
  das Pflicht; in Supabase z. B. als Versionsspalte je Karte.
- Erst schnell speichern, dann Drive im Hintergrund spiegeln; Drive-Fehler kippen das Speichern nicht,
  werden aber gemeldet.
- Bei Widerspruch zwischen Datenbank und Drive-Ordnerlage gewinnt die **Ordnerlage** (ein Mensch hat in
  Drive gearbeitet).

---

## 6. KI-Schicht

Fachlich unverändert: Jede Aufgabe ist eine Kette aus Schritten; jeder Schritt hat eine Rolle
(`userkomm`, `recherche`, `kontext`), die Rolle bestimmt das Modell; Recherche-Schritte holen vorher
Web-Treffer; nur der letzte Schritt streamt (`laufePipeline`, `server.js` Z. 348–483). Die Anzeige
erwartet NDJSON-Zeilen `status | stufe | delta | done | error` (`architektur.md` Abschnitt 1).

### 6.1 Claude über API-Schlüssel der Organisation (Standard gehostet)
Ein Claude-Abo darf ein Produkt nicht für mehrere Nutzer verwenden:
[Agent-SDK-Doku](https://code.claude.com/docs/en/agent-sdk/overview) (Drittentwickler dürfen kein
claude.ai-Login und keine Abo-Rate-Limits anbieten; API-Schlüssel verwenden) und
[Anthropic-Verbraucherbedingungen](https://anthropic.com/legal/terms) (Konto niemandem zugänglich machen).
Folge: Server-Funktion ruft die Claude-API mit dem Schlüssel der Organisation (Claude Console), streamt
die Antwort an den Browser. **Kosten je Token** statt heute token-frei. Laufzeit passt: Vercel-Funktionen
bis 300 s im Standard ([Vercel Limits](https://vercel.com/docs/functions/limitations)).

### 6.2 Lokales Hilfsprogramm (optional je Nutzer)
Zweck: Ollama-Modelle auf dem PC des Nutzers aus der gehosteten Seite nutzen (heute Rollen „Recherche"
und „Kontextabgleich"). Verbindungswege — Optionen:

| Weg | Wie | Pro | Contra |
|---|---|---|---|
| **H1 Browser → localhost** | Seite ruft `http://localhost:<port>` des Hilfsprogramms | einfach, kein Server dazwischen | Browser-Sperren für öffentliche Seite → privates Netz und CORS müssen je Browser getestet werden; nur auf dem PC, auf dem die Seite offen ist |
| **H2 Auftragstabelle** | Browser schreibt Auftrag in Supabase; Hilfsprogramm hält eine **ausgehende** Verbindung (Supabase Realtime) und schreibt die Antwort zurück | keine eingehenden Ports, gleiche Anmeldung wie Rootwork, Rechte über RLS | Nachrichtengröße begrenzt (Realtime Broadcast 256 KB Free / 3000 KB Pro, [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)) → Streaming in Stücken |

Empfehlung: **H2**. Sicherheitsrahmen für beide:
- Kopplung per Einmal-Code aus Rootwork; das Hilfsprogramm handelt nur für **diesen** Nutzer.
- Es führt nur die festen KI-Aufgaben aus (Prompt rein, Text raus) — **keine** Befehle, keine Dateizugriffe.
- Abschaltbar, zeigt an, welche Aufträge es bearbeitet hat.

### 6.3 Eigenes Claude-Abo über das Hilfsprogramm — offen
Heute nutzt das Board das Abo des Owners über die CLI auf dessen Rechner. Ob das erlaubt bleibt, wenn
das Hilfsprogramm Teil von Rootwork (einem Produkt) ist, ist **nicht belegt** — siehe Abschnitt 11.
Bis dahin: Cloud = API-Schlüssel, lokal = Ollama.

### 6.4 ChatGPT (heute Codex-CLI)
Gleiche Frage wie 6.3 für OpenAI-Konten — nicht geprüft. Gehostet sauber möglich nur mit einem
OpenAI-API-Schlüssel der Organisation (gleiches Muster wie 6.1). Entscheidung, ob überhaupt nötig: Abschnitt 11.

### 6.5 Web-Suche
`lib/websuche.js` (DuckDuckGo ohne Schlüssel, optional Tavily `TAVILY_API_KEY`) läuft unverändert
serverseitig.

---

## 7. Rechte

Das Board hat heute **kein** Rechtemodell (ein Owner). Gehostet gilt: **Rootwork-Rolle UND Drive-Freigabe**
— wer keine Drive-Freigabe hat, kann nichts lesen oder schreiben, egal welche Rolle.

Damit Leon die Rootwork-Rollen zuordnen kann, sind die Board-Funktionen hier in Rechte-Klassen gebündelt
(Vorschlag; Zuordnung zu Rollen = Abschnitt 11):

| Klasse | Funktionen |
|---|---|
| **Lesen** | Board, Karten, Kalender, Redaktionsplan, Auswertung ansehen |
| **Bearbeiten** | Karten anlegen/ändern, KI-Knöpfe, Skript/Caption speichern, Dateien hochladen, Drehtermine |
| **Steuern** | Karte weiterschieben (Tore), von Hand verschieben ohne Prüfung, Post ↔ Karte bestätigen, Karte löschen (Papierkorb) |
| **Einrichten** | Redaktionsplan, Kampagnen, Prompts, Workflows an/aus, Kategorien/Ziele, Firmenkontext |
| **Verwalten** | Board-Ordner wählen, Instagram/LinkedIn verbinden, API-Schlüssel, Board zurücksetzen |

---

## 8. Server-Teil

| Aufgabe heute | Dauer/Größe | Gehostet — wo |
|---|---|---|
| Board laden/speichern, Stores lesen/schreiben | kurz | Funktion (Vercel oder Supabase) |
| KI-Aufgabe mit Stream | Sekunden bis Minuten | Funktion mit Streaming (Vercel bis 300 s Standard) |
| Drive-Abgleich | 10–70 s heute (rclone) | Funktion oder Job; mit Änderungs-Meldungen (4.3) kürzer |
| Video-Upload | GB | **Browser → Drive direkt** (4.4) |
| KPI-Messung, Post-Zuordnung (heute beim Start) | Minuten | zeitgesteuerter Job (täglich), Zugang nach 4.2 |
| Steckbriefe nachziehen | ~18 s heute (md5sum, v98) | Job |
| Kalender-Spiegel (Drehtermin → Google) | kurz | Funktion mit Token des Nutzers |
| OAuth-Rückrufe Instagram/LinkedIn/Google | kurz | Funktion; **Redirect-URIs** von `https://localhost:4321/api/auth/*/callback` auf die Rootwork-Domain umstellen, in den Apps bei Meta, LinkedIn, Google eintragen |
| Auto-Shutdown, Ollama entladen | — | entfällt (nur noch im Hilfsprogramm) |

Supabase Edge Functions als Alternative: Wanduhr-Grenze 150 s (Free) / 400 s (bezahlt)
([Supabase Limits](https://supabase.com/docs/guides/functions/limits)).

---

## 9. Einbau in die Rootwork-Oberfläche

- Rootwork führt Social Media als Abschnitt `slug: "social-media", kind: "board"` im Bereich
  „Marketing und Kommunikation"; Route `#/board%3Asocial-media` (gemessen 06.10.2026).
- Heute zeigt die Seite **Demo-Kennzahlen** (LinkedIn/Instagram/YouTube, letzter Post, Follower,
  Reichweite, Aufrufe, Interaktionsrate, Beitragstabelle) mit dem Banner „Anbindung an das
  Social-Media-Board folgt", darunter das **generische Rootwork-Kanban**.
- Ziel: Kennzahlen kommen aus der Board-Auswertung (gleiche Daten wie `/api/stats/*`, auch aus den
  Drive-CSVs rekonstruierbar: `lib/kpi-drive-lesen.js`); das generische Kanban wird durch das Board
  ersetzt (Phasen-Spalten, Detailspalte, Tore). Ansichten des Moduls: Board · Kalender · Redaktionsplan ·
  Auswertung · Einstellungen · Onboarding.
- Ergänzungen später (Owner: „optional ergänzt") docken an die Speicher- und KI-Schicht an, nicht an
  einzelne Ansichten.

---

## 10. Stufen der Umstellung

Jede Stufe hat einen Rückfallweg; weil alle Stufen denselben Drive-Ordnervertrag nutzen, kann das lokale
Board **parallel** auf demselben Ordner weiterlaufen, bis die gehostete Fassung trägt.

| Stufe | Inhalt | Rückfallweg |
|---|---|---|
| **S0 heute** | lokales Board, ein Owner | Drive direkt |
| **S1 Showcase** | Modul-Oberfläche + Onboarding in der Showcase (Demo oder Test-Ordner, 3) | lokales Board |
| **S2 gehostet, Drive als Speicher** | Google je Nutzer, Drive-Adapter, Claude-API, Rootwork-Rollen, Jobs | lokales Board auf demselben Ordner; Drive direkt |
| **S3 Hilfsprogramm** | lokale KI über H2 | Claude-API |
| **S4 Datenbank** | Datenarten nach Abschnitt 5 in Supabase; Drive behält Dateien, Ordnerlage, Steckbriefe | Drive direkt (Steckbrief + Ordnerlage zeigen den Stand) |

---

## 11. Aufgaben für Leon beim Einbau

Bewusst offen gelassen — sie hängen an Rootwork-Wissen:

1. **Repo und Supabase-Projekt** der echten Rootwork-Software festlegen; Board-Logik (2.1) dort einbinden.
2. **Rootwork-Rollen** den Rechte-Klassen aus Abschnitt 7 zuordnen; RLS-Regeln für Board-Tabellen.
3. **Oberfläche:** Option O1, O2 oder O3 (2.3).
4. **Showcase-Onboarding:** Demo-Daten oder Test-Ordner (3).
5. **Server-Ort** je Aufgabe aus Abschnitt 8 (Vercel-Funktionen, Supabase Edge Functions, Jobs).
6. **Drive:** geteilte Ablage oder freigegebener Ordner (4.1); Zugang für Hintergrundarbeit (4.2);
   Workspace-Admin gibt die interne App für Drive frei.
7. **KI:** Claude-API-Schlüssel der Organisation anlegen (Kostenrahmen); bei Anthropic bzw. OpenAI klären,
   ob ein eigenes Abo über das Hilfsprogramm zulässig ist (6.3, 6.4); ob ChatGPT überhaupt gebraucht wird.
8. **Social-Apps:** Redirect-URIs bei Meta, LinkedIn, Google auf die Rootwork-Domain umstellen.

## 12. Quellen

- Code dieses Repos (Fundstellen im Text), `docs/architektur.md`, `docs/drive-convention.md`.
- Rootwork-Showcase, angesehen und Bundle ausgewertet am 06.10.2026.
- [Agent-SDK-Überblick](https://code.claude.com/docs/en/agent-sdk/overview) ·
  [Anthropic Consumer Terms](https://anthropic.com/legal/terms) ·
  [Claude-Code-Authentifizierung](https://code.claude.com/docs/en/authentication)
- [Google OAuth Production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) ·
  [Google Cloud FAQ](https://support.google.com/cloud/answer/13463817) ·
  [Drive Push-Benachrichtigungen](https://developers.google.com/workspace/drive/api/guides/push) ·
  [Drive Events API](https://workspaceupdates.googleblog.com/2025/07/google-drive-events-api-now-available.html)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) ·
  [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits) ·
  [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
