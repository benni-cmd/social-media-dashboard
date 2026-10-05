# v86 — Externe Anbindungen: wer, womit, live, wann zuletzt

> Owner-Auftrag 30.09.2026: „In meinen Einstellungen steht, dass Drive und Tasks verbunden seien,
> aber nicht mit welchem Konto, ob das funktioniert, wann der letzte Abgleich war. Das soll bei
> allen externen Anbindungen immer ersichtlich sein. Gerade bin ich unsicher, ob Tasks und
> Kalender richtig verbunden sind. Drehtermine zieht sich das Board aus Drive; der Kalender
> bekommt nur den Eintrag und ist keine Datenquelle." — Wunsch in der logischen Essenz an
> sinnvollen Stellen im ganzen Programm umsetzen; ERST Problem verstehen und Fragen klären.

**Problem:** „Verbunden" bedeutet im Board heute nur „ein Token liegt vor" (bzw. bei Google:
„Netz unklar → Bestandsschutz"). Es sagt nicht, ob die Anbindung JETZT funktioniert, welches Konto
dahintersteht, wann sie zuletzt erfolgreich war und welche Rolle sie hat (Quelle oder nur Ziel).
Konkreter Beleg (30.09.2026, gemessen): Google lehnt den Refresh-Token seit Wochen ab
(`POST oauth2.googleapis.com/token` → `400 invalid_grant`, `data/tokens.json`: letzter gültiger
Access-Token lief am 09.09.2026 ab, verbunden am 03.09.2026), Kalender und Tasks schreiben also
NICHT — und `/api/verbindungen/status` meldet trotzdem `google.verbunden: true`, Konto leer.
Ursache im Code: `lib/gcal.js` `istAuthFehler()` prüft den Text „Token-Refresh fehlgeschlagen:
Bad Request"; `invalid_grant` steht nur im Log, nicht in der Fehlermeldung → gilt als „Netz unklar"
→ grüner Status.

**Intent:** Bei jeder Anbindung auf einen Blick erkennen: Bin ich verbunden — womit — geht es live —
seit wann zuletzt erfolgreich — und ist das eine Datenquelle oder nur ein Ziel. Ein Ausfall darf
nie grün aussehen.

**Goal:** Jede externe Anbindung zeigt an den passenden Stellen (mind. Einstellungen, Kopfzeile,
Nutzstelle) dieselben Angaben: Konto/Ziel · Zustand (live / gestört / getrennt, mit Grund) ·
letzter Erfolg mit Zeit · letzter Fehler · Rolle. Der Zustand stammt aus einer echten Prüfung, nicht
aus dem Vorhandensein eines Tokens.

## Bestand (gelesen 30.09.2026)

| Anbindung | Was `/api/verbindungen/status` heute liefert | Was fehlt |
|---|---|---|
| Drive (rclone) | verbunden (Erreichbarkeit), Root-Ordner, Konto-Mail | letzter Abgleich, letzter Fehler, Rolle |
| Google Kalender + Tasks | verbunden (nur Token, Netz-Zweifel = grün), Konto-Mail leer | echter Test je Dienst, Konto, letzter Erfolg, Rolle „nur Ziel" |
| Instagram | verbunden (Token), Kontoname | Token-Ablauf, letzter Abruf |
| LinkedIn | verbunden (Token), Seitenname | wie Instagram |
| Claude-CLI | eingeloggt, Konto-Mail | letzter Aufruf |
| Ollama (lokal) | nur über `/api/ai/ping-ollama` auf Knopfdruck | Dauerstatus, Modell |
| Web-Suche | Tavily-Key gesetzt ja/nein (sonst DuckDuckGo) | Zustand |

Vorhanden und nutzbar: Ereignis-Bus je Sektion (`lib/ereignisse.js`, Kopf-Sektionen API · Drive ·
Weitere · KI mit Log) — dort steht schon je Aufruf Zeit, Ergebnis, Dauer. Die „letzter Erfolg /
letzter Fehler"-Zeit lässt sich daraus ableiten, ohne neue Speicherung.

## Entscheidungen des Owners (30.09.2026, Antworten auf die Fragen)

1. **Umfang:** alle acht Anbindungen (Drive, Google Kalender, Google Tasks, Instagram, LinkedIn, Claude-CLI, Ollama, Web-Suche).
2. **Orte:** (a) Einstellungen: eine Karte je Dienst; (b) Kopfzeile: Plakette bei Störung; (c) Log der Kopf-Sektionen: Statusband oben — „bitte nochmal tiefer prüfen, wie weit man das sinnvoll und übersichtlich einbinden kann" (Studie unten). NICHT gewählt: Nutzstelle am Drehtermin.
3. **Prüftiefe:** echter Testaufruf beim Serverstart, alle 30 Minuten und per „Jetzt prüfen"-Knopf.
4. **Ausfall:** sichtbar melden mit „Neu verbinden"-Knopf (Plakette im Kopf + Zeile in den Einstellungen), kein Toast.

## Studie: Statusband im Log (gemessen 30.09.2026, 1440x900)

Ist: Das aufgeklappte Log ist 620 px breit, höchstens 372 px hoch und trägt oben nur eine Titelzeile
(z. B. „Google Kalender und Tasks, Web-Suche"); darunter die Ereigniszeilen (Drive 96, Weitere 12,
KI 15, API 1). Die Sektion „Weitere" bündelt DREI Dienste (Kalender, Tasks, Web-Suche), „KI" zwei
(Ollama, Claude), „API" zwei (Instagram, LinkedIn), „Drive" einen.
Vorschlag: ein Statusband über den Ereigniszeilen, eine Zeile je Dienst der Sektion (max. 3 Zeilen,
je ~22 px, also < 70 px Zuwachs bei 372 px Höhe):
`Dienst · Konto/Ziel · Zustand-Chip (live/gestört/getrennt) · „zuletzt ok vor 3 min" · Rolle`;
nur bei Störung zusätzlich ein Grund-Satz und die Knöpfe „Jetzt prüfen" / „Neu verbinden".
Grenze: Platz für Langtexte (Scopes, Projekt-ID, Ablaufdatum) hat das Log nicht — die gehören in die
Einstellungs-Karte. Der Marker der Sektion im Kopf soll aus dem schlechtesten Zustand ihrer Dienste
kommen (heute: Ergebnis des letzten Aufrufs — deshalb war Google grün, obwohl jeder Refresh scheiterte).
Rollen-Vorschlag (bitte bestätigen): Drive = Quelle der Wahrheit · Kalender = nur Ziel ·
Tasks = nur Ziel · Instagram/LinkedIn = Quelle nur für Zahlen (lesend) · Claude = KI-Rechenleistung ·
Ollama = lokale KI-Rechenleistung · Web-Suche = Recherche-Quelle.

## Plan (festgezogen nach den Antworten)

1. [x] Fehlfarbe beheben: Ablehnung durch Google (`invalid_grant`) zählt als „getrennt: Anmeldung abgelaufen", nie als „unklar".
2. [~] Ein gemeinsames Status-Modell je Anbindung: `konto`, `zustand` (live/gestört/getrennt), `grund`, `letzterErfolg`, `letzterFehler`, `rolle`.
3. [x] Aktive Prüfung je Anbindung mit Zeitstempel (Drive, Google, KI je genutztem Anbieter; Instagram/LinkedIn/Web-Suche noch aus dem letzten Aufruf).
4. [~] Einstellungen „Externe Dienste" / „Social Media Kanäle": jede Zeile zeigt die Angaben aus 2.
5. [x] Kopfzeile: gestörte Anbindung sichtbar (Kachel + Gesamtampel + Befundzeile im Log), mit „Neu verbinden".
6. [ ] Nutzstellen: z. B. Drehtermin zeigt „im Kalender eingetragen am … / fehlgeschlagen: …".
7. [ ] Verify: echter Ausfall (jetziger Google-Token) wird rot, nach Neuverbindung grün; Screenshots hell + dunkel.

## Status

01.10.2026 — Teil 1 gebaut (Owner-Go 01.10.2026: „ich sehe nicht, womit ich bei Kalender und Tasks angemeldet bin, woher die
Daten kommen und wohin sie gehen … Arbeitsordner nicht nutzerfreundlich benannt … Claude-CLI soll übers Board anmeldbar sein").
Rollen-Vorschlag oben gilt damit als bestätigt (Ben fragte genau nach Quelle/Ziel).
- `lib/gcal.js`: Refresh-Fehler trägt jetzt `invalid_grant` → Status „Anmeldung abgelaufen" statt grün (belegt: Kopie :4399 mit Bens totem Token → `zustand: getrennt`).
  Konto-Mail und letzter Erfolg werden bei jeder erfolgreichen Prüfung gemerkt. Netz-Zweifel = „gestört" (gelb), nie grün.
- `lib/drivesetup.js` `ordnerName()`: Name des Arbeitsordners über Drive-API mit dem rclone-Zugang (belegt: „Social Media Dashbaord Test").
- `lib/claudeauth.js` + `/api/auth/claude/start|code`: Claude-CLI im Board anmelden (Link → Code einfügen). Belegt: Start liefert Link;
  CLI liest Code von stdin (falscher Code → „Login failed 400").
- Einstellungen → Externe Dienste: je Anbindung Zeilen Datenfluss · Anbindung (inkl. Rechte) · Zustand (Grund, zuletzt erfolgreich, verbunden seit).
- Geheimnis-Prüfung Drive (01.10.2026, rclone lsf -R + Inhalt der 8 System-Dateien): keine Tokens/Keys/Mails in Drive;
  `git ls-files` ohne Geheimnis-Dateien. Alle Zugänge liegen nur lokal (`.env`, `data/tokens.json`, `data/.gdrive-env.json`).

05.10.2026 — **Teil 2 gebaut.** Es baut auf der v105-Kopfzeile auf (`public/anschluesse.js`).
- **Wann geprüft wird:**
  - 20 s nach dem Start (nicht im Start-Pfad, v98)
  - danach alle 30 min
  - bei jedem Öffnen eines Logs (= „Jetzt prüfen")
  - Quellen: `/api/verbindungen/status` und `/api/ai/ollama`
- **Kachel und Gesamtampel:**
  - zeigen den schlechteren Wert aus letztem Aufruf und Prüfung
  - oben im Log steht eine Befundzeile mit Grund und Prüfzeit, bei Störung mit dem Knopf **„Neu verbinden"**; er öffnet die Einstellungen direkt am passenden Tab (Google bzw. KI-Rollen)
  - der Tooltip der Kachel trägt denselben Grund
- **Was jede Kachel prüft:**
  - KI: nur die Anbieter, die die Rollen nutzen (Claude, ChatGPT aus v103, Ollama)
  - Google: nie verbunden = „fehlt" (offener Schritt), abgelaufen oder getrennt = Befund (rot), Netz-Zweifel = Hinweis (gelb)
  - Drive: nicht erreichbar = Befund
- **Beleg (Testkopie :4399):**
  - Drive ohne Ordner → rot
  - Google nie verbunden → „fehlt"
  - ChatGPT abgemeldet bei Rolle ChatGPT → KI rot, Gesamtampel rot, Befundzeile „ChatGPT nicht angemeldet — Einstellungen → KI-Rollen"
  - „Neu verbinden" öffnet den Tab KI-Rollen
  - alles bereit → KI grün
  - Screenshots angesehen

Offen (Rest): Die API-Kachel (Instagram/LinkedIn) und die Web-Suche haben noch keine eigene Prüfung. Sie zeigen weiter das Ergebnis des letzten Abrufs. Google-Konto-Mail erscheint erst nach dem Neu-Verbinden.


30.09.2026 — Paket angelegt, Bestand gelesen, Befund belegt (siehe Problem). Fragen beantwortet (Entscheidungen oben), Log-Studie gemacht. Noch nichts gebaut.

## Definition of Done

Geprueft gegen: echter Ausfall der Google-Anbindung sichtbar; Status jeder Anbindung aus Prüfung statt Token; Screenshots hell + dunkel
Offen: Eigene Prüfung für Instagram/LinkedIn/Web-Suche (heute letzter Abruf); Nutzstelle Drehtermin (Owner: nicht gewählt); Live-Verify „Google rot → nach Neuverbindung grün" auf Bens Board — Google neu verbinden (Owner). Rollen: bestätigt (Teil 1, 01.10.). Andockstelle: Kopf-Gruppe „Verbindungen“ aus v105 (`gesamtZustand()` in `anschluesse.js`, `data-zustand` am Gruppen-Element, Abgleich-Knopf im Log-Kopf).
