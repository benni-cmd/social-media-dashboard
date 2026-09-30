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

1. [ ] Fehlfarbe beheben: Ablehnung durch Google (`invalid_grant`) zählt als „getrennt: Anmeldung abgelaufen", nie als „unklar".
2. [ ] Ein gemeinsames Status-Modell je Anbindung: `konto`, `zustand` (live/gestört/getrennt), `grund`, `letzterErfolg`, `letzterFehler`, `rolle`.
3. [ ] Server: aktive Prüfung je Anbindung (kleine echte Aufrufe), Ergebnis mit Zeitstempel; Zeiten aus dem Ereignis-Bus.
4. [ ] Einstellungen „Externe Dienste" / „Social Media Kanäle": jede Zeile zeigt die Angaben aus 2.
5. [ ] Kopfzeile: gestörte Anbindung sichtbar wie die Cache-Plakette, mit „Neu verbinden".
6. [ ] Nutzstellen: z. B. Drehtermin zeigt „im Kalender eingetragen am … / fehlgeschlagen: …".
7. [ ] Verify: echter Ausfall (jetziger Google-Token) wird rot, nach Neuverbindung grün; Screenshots hell + dunkel.

## Status

30.09.2026 — Paket angelegt, Bestand gelesen, Befund belegt (siehe Problem). Fragen beantwortet (Entscheidungen oben), Log-Studie gemacht. Noch nichts gebaut.

## Definition of Done

Geprueft gegen: echter Ausfall der Google-Anbindung sichtbar; Status jeder Anbindung aus Prüfung statt Token; Screenshots hell + dunkel
Offen: Rollen-Bezeichnungen bestätigen; Go für die Umsetzung; Google neu verbinden (Owner, Token ist tot)
