# v26 — Einstellungen: System Prompts + Workflows

## PIG

**Problem:** Die Prompts hinter jedem KI-Knopf stehen fest in `lib/ai.js` (`MARKE_REGELN` +
`AUFGABEN`). Ben kann sie im Betrieb weder sehen noch aendern — jede Formulierungs-Korrektur
braucht einen Code-Eingriff. Genauso unsichtbar sind die Automationen: dass ein Upload in
„Fertiges Video/" die Karte weiterschiebt oder dass ohne Drehtermin automatisch der Sonntag der
Folgewoche gesetzt wird, steht verstreut in `public/detail.js`, `public/store.js`, `public/board.js`
und `server.js`. Nichts davon ist an einer Stelle einsehbar oder abschaltbar.

**Intent:** Die Einstellungen werden die eine Stelle, an der die KI-Sprache und das
Automatik-Verhalten des Boards sichtbar und aenderbar sind — ohne Code, ohne Neustart-Ritual.

**Goal:** Einstellungen haben zwei neue Tabs:
1. **System Prompts** — der System-Vorspann plus JEDER Knopf, der eine KI-Funktion ausloest, mit
   dem darunterliegenden Prompt im Textfeld: bearbeitbar, speicherbar, zuruecksetzbar.
2. **Workflows** — alle Automationen des Boards als Liste: Ausloeser, Wirkung, An/Aus-Schalter und
   (wo vorhanden) Parameter. Ein ausgeschalteter Workflow laeuft nachweislich nicht mehr.

---

## Bestandsaufnahme (gemessen, nicht erinnert)

**KI-Aufgaben in `lib/ai.js`** (`grep -n "^export const AUFGABEN" -A9999 lib/ai.js`): 9 Stueck —
`recherche`, `hooks_verbal`, `hooks_visuell`, `skript`, `regieplan`, `caption`, `ideen`, `plan`,
`analyse`. Dazu der Vorspann `MARKE_REGELN`, der in JEDEN Aufruf geht
(`server.js:405/407/440/444`).

**Knoepfe, die eine KI-Funktion ausloesen** (`grep -rn "rufeKi(\|kiStream(" public/*.js`):

| Knopf | Ort | Aufgabe |
|---|---|---|
| „Recherche und Fokus" | `public/detail.js:791` | `recherche` |
| „Verbale Hooks holen" | `public/detail.js:838` (+ Auto-Nachlauf `:825`) | `hooks_verbal` |
| „Visuelle Hooks holen" | `public/detail.js:875` (+ Auto-Nachlauf `:852`) | `hooks_visuell` |
| „Skript schreiben" | `public/detail.js:974` | `skript` |
| „Captions je Plattform" | `public/detail.js:733` via `PHASEN_KI` | `caption` |
| Ideen-Nachschub | `public/nachschub.js:101` | `ideen` |
| Redaktionsplan erzeugen | `public/nachschub.js:303` | `plan` |

**Ohne Knopf, aber vorhanden:** `regieplan` und `analyse` — Prompts existieren, kein UI ruft sie
(`grep -rn "regieplan\|analyse" public/*.js` = 0 Treffer). Sie werden im Tab getrennt als „ohne
Knopf" gefuehrt, statt sie als Knopf zu behaupten.

**Automationen im Bestand** (je Fundstelle belegt):

| Id | Ausloeser → Wirkung | Fundstelle |
|---|---|---|
| `upload-fertig-weiter` | Fertiges Video hochgeladen → Karte rutscht in die naechste Phase, wenn die Qualitaetstore frei sind | `public/detail.js:1116-1131` |
| `drehtermin-zuordnen-videodreh` | Karte einem Drehtermin zugeordnet → Karte springt nach „Videodreh" | `public/detail.js:395-399` |
| `skript-gespeichert-weiter` | Skript gespeichert → Karte weiter zu „Drehtermin festlegen" | `public/detail.js:1008/1018` |
| `auto-drehtermin` | Kein Drehtermin in den naechsten N Tagen → Sonntag der Folgewoche automatisch setzen | `public/store.js:91`, `lib/pipeline.js:420` |
| `gcal-autosync` | Drehtermin geaendert → Google Kalender + Tasks sofort spiegeln | `public/store.js:462` |
| `rueckwaertsplan` | Upload-Datum gesetzt → Schnitt-/Freigabetermine rueckwaerts berechnen | `lib/pipeline.js:171` |
| `drive-ordner-anlegen` | Visueller Hook gewaehlt → Projektordner in Drive anlegen | `public/detail.js:887` |
| `drive-ordner-mitziehen` | Karte wechselt die Spalte → Drive-Ordner wird mitverschoben | `public/board.js:225` |
| `auto-shutdown` | Server N Minuten ohne Aktivitaet → beendet sich, entlaedt Ollama | `server.js:1043-1071` |

Kein Workflow: der Rohmaterial-Upload (`public/detail.js:1140`, bewusst OHNE Auto-Move) und der
Drive-Abgleich (`public/app.js:95`, manueller Knopf).

---

## Design-Entscheidungen

- **Prompt-Vorlagen statt Funktionen.** Jede Aufgabe wird eine Vorlage mit `{{platzhalter}}`;
  die dynamischen Teile (Plattform-Schema, Korridor-Sekunden, Karten-Kontext) kommen als Variablen
  hinein. Der Nutzer bearbeitet Text, nicht Code. Beweis-Pflicht: die gefuellte Vorlage muss
  Zeichen fuer Zeichen dem heutigen Prompt entsprechen (Schnappschuss vor dem Umbau).
- **Speicher server-seitig** (`data/prompts.json`, `data/workflows.json`) — die Prompts werden
  server-seitig gebaut, also muessen die Aenderungen dort ankommen, nicht im localStorage.
- **Leerer Text = Standard.** Zuruecksetzen loescht den Eintrag, statt den Standard zu kopieren —
  so wandern spaetere Standard-Verbesserungen automatisch mit.
- **Ein ausgeschalteter Workflow ist wirklich aus.** Jede Fundstelle bekommt eine Abfrage; ein
  Schalter ohne Wirkung waere eine Luege im UI.

## Plan (Phasen)

- **v26-1 — Prompt-Schicht:** `lib/ai.js` auf `PROMPT_VORLAGEN` + `bauePrompt()` umstellen,
  Schnappschuss-Vergleich gruen.
- **v26-2 — Prompt-Speicher + API:** `lib/promptstore.js`, `GET/PUT /api/prompts`, `server.js`
  nutzt die Overrides.
- **v26-3 — Tab „System Prompts":** Liste Vorspann + Knoepfe + Aufgaben ohne Knopf, Textfelder,
  Speichern/Zuruecksetzen, Platzhalter-Legende.
- **v26-4 — Workflow-Register + API:** `lib/workflows.js` (Register), `data/workflows.json`,
  `GET/PUT /api/workflows`; `server.js` liest `auto-shutdown` daraus.
- **v26-5 — Schalter verdrahten:** die neun Fundstellen oben fragen den Schalter ab.
- **v26-6 — Tab „Workflows":** Liste mit Schalter, Parametern, Ausloeser- und Wirkungssatz.

## Nachtrag [Owner, 04.09.2026] — Modellwahl

Waehrend des Baus ergaenzt: die Modell-Auswahl muss beide Anbieter abdecken.

- **Ollama:** die Auswahlliste der installierten Modelle gab es schon (`public/ui.js` — `ladeModelle`);
  neu ist, dass sie beim Umschalten auf Ollama von selbst laedt statt erst auf Knopfdruck.
- **Claude:** neue Liste `CLAUDE_MODELLE` in `lib/ai.js` (haiku · sonnet · opus), ausgeliefert ueber
  `GET /api/ai/modelle` — eine Wahrheit, keine zweite Liste im Frontend. `runClaude` und
  `runClaudeStream` haengen `--model <id>` an; belegt mit `claude --help`, Zeile "--model <model>".
- **Standards:** Anbieter-Standard ist **Ollama** (lokal, kein Token-Verbrauch). Wer auf Claude
  umstellt, bekommt **Haiku 4.5** — schnellste Antwort, kleinster Verbrauch.

## Stand — gebaut und geprueft, 04.09.2026

| Phase | Ergebnis |
|---|---|
| v26-1 Prompt-Schicht | `lib/ai.js`: `PROMPTS` (9 Aufgaben) + `SYSTEM_VORLAGE` + `fuelleVorlage()` + `baueAufgabe()`. `AUFGABEN` bleibt als Huelle bestehen. |
| v26-2 Speicher + API | `lib/promptstore.js`, `GET/PUT /api/prompts`; die KI-Endpunkte bauen Vorspann und Prompt jetzt ueber die Ablage. |
| v26-3 Tab System Prompts | Vorspann + 7 Knoepfe + 2 Prompts ohne Knopf, je Textfeld, Platzhalter-Legende, Speichern/Zuruecksetzen. |
| v26-4 Workflow-Register | `lib/workflows.js` (9 Eintraege, laeuft auch im Browser), `lib/workflowstore.js`, `GET/PUT /api/workflows`. |
| v26-5 Schalter verdrahtet | Alle 9 Fundstellen fragen den Schalter ab — `public/store.js` (`an`, `stellschraube`, `terminplan`), `public/board.js`, `public/detail.js`, `server.js`. |
| v26-6 Tab Workflows | Schalter, Ausloeser-/Wirkungssatz, Parameter, Warnhinweis und Fundstelle je Automation. |
| Nachtrag Modellwahl | `CLAUDE_MODELLE` + `--model`, `GET /api/ai/modelle`, Auswahlfeld in „Verbindungen"; Standard Ollama, bei Claude Haiku. |

## DoD

- [x] Schnappschuss-Vergleich: alle 9 Aufgaben + Vorspann zeichengleich vor/nach dem Umbau
      (`diff prompts-vorher.json prompts-nachher.json` = leer)
- [x] `node --check` gruen fuer alle 29 JS-Dateien (`for f in server.js lib/*.js public/*.js; do node --check $f; done`)
- [x] Ablagen im Rundlauf geprueft: Override wirkt, Zuruecksetzen wirkt, Parameter-Grenze greift
      (5000 Minuten wurden auf die Obergrenze 1440 gekappt)
- [x] Tab „System Prompts": Vorspann + 7 Knoepfe + 2 ohne Knopf sichtbar — Screenshot 04.09.2026
- [x] Tab „Workflows": alle 9 Automationen sichtbar; Schalter „Server beendet sich bei Leerlauf"
      aus- und wieder eingeschaltet, `data/workflows.json` und `GET /api/workflows` zogen mit
- [x] Optische Abnahme per Screenshot (Browser-Pane, eigener Server auf Port 4399) gegen die
      bestehende Einstellungs-Optik: gleiche Navigation links, gleiche Chips und Felder
- [ ] Noch nicht belegt: ein echter KI-Lauf mit einem GEAENDERTEN Prompt und mit `--model haiku`
      (braucht einen laufenden Aufruf gegen Claude bzw. Ollama)
