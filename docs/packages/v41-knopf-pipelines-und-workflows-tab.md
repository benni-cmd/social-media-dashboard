# v41 — Knopf-Pipelines (Mehr-Schritt-Prompts je Knopf) + Workflows-Tab entfernen

> Planpaket, VOR dem Bau geschrieben (Owner-Auftrag 15.09.2026: „erst einen sauberen Plan,
> dass der Umbau direkt funktioniert"). Bau erst nach Freigabe der offenen Weichen.

## PIG

**Problem:** Zwei Dinge in den Einstellungen passen nicht mehr.
1. Der Tab **Workflows** (Builder, v27) ist unflexibel und ungewollt — die realen Automationen
   („was das System eh immer tut") hängen fest im Code an ihren Fundstellen (`an(id)`/`feuere`),
   der konfigurierbare Builder bringt darüber keinen echten Nutzen.
2. Der Tab **System Prompts** kann je Knopf nur **einen** Prompt (`data/prompts.json`
   `aufgaben[task] = "text"`). Ben will je Knopf eine **mehrschrittige Pipeline** bauen, in der
   jeder Schritt eine eigene Rolle/Modell UND einen eigenen Prompt hat — z. B. „Recherche und Fokus":
   Schritt 1 Userkommunikation (liest Prompts + Unternehmenskontext), Schritt 2 DeepSeek lokal
   (recherchiert, schreibt Fakten), Schritt 3 Userkommunikation (formuliert die Antwort aus den Fakten).

**Intent:** Die Knöpfe und ihre Wirkung sollen in den Einstellungen frei manipulierbar sein —
als Kette aus Schritten, jeder Schritt einer der drei KI-Rollen (v40) zugeordnet. Der Workflows-Tab
verschwindet, ohne dass eine der laufenden Automationen kaputtgeht.

**Goal:**
- Kein „Workflows"-Tab mehr; alle eingebauten Automationen (`an(id)`, `feuere`) laufen unverändert
  weiter.
- Jeder KI-Knopf ist eine editierbare Schritt-Liste `[{rolle, prompt, websuche}]`; die Schritte
  laufen nacheinander, jeder auf dem Modell seiner Rolle, Ausgabe → Eingabe des nächsten
  (Platzhalter `{{vorschritt}}`). Der System-Vorspann bleibt unverändert.

## Entscheidungen (Owner, 15.09.2026)

- **F1 → 3-Schritt-Kette als Default UND Editor bauen.** Default `recherche` = 3 Schritte:
  (1) Userkommunikation liest Auftrag/Kontext, (2) Recherche-Rolle recherchiert Fakten (Web-Suche),
  (3) Userkommunikation formuliert die JSON-Antwort. Andere Knöpfe: 1-Schritt-Default (ihre Rolle +
  Vorlage). Die harte v40-Verkettung recherche→kontextabgleich entfällt (durch die Schritte ersetzt).
- **F2 → Web-Suche fest an die Recherche-Rolle.** Kein Schritt-Feld `websuche`: ein Schritt mit
  `rolle:"recherche"` bekommt IMMER die Web-Treffer vorangestellt. Datenmodell vereinfacht sich zu
  `{rolle, prompt}`; im Editor genügt der Hinweis „Recherche-Schritt sucht automatisch im Web".
- **F3 → Tab weg + Engine sauber zurückbauen.** Ben hat keine eigenen Workflows angelegt. Entfernen:
  Workflows-Tab, `public/workflowengine.js`, `lib/ownworkflowstore.js`, `lib/workflowblocks.js`,
  `public/workflowbuilder.css`, `feuere`-Aufrufe/Export, `/api/workflows/eigene`-Endpunkte,
  `S.eigeneWorkflows`. **Bleibt (wie davor):** die eingebauten Automationen über `an(id)`/`wfIstAn`,
  `lib/workflowstore.js` + `lib/workflows.js`, `/api/workflows` GET und der `S.workflows`-Start-Load.

## Bestandsaufnahme (gemessen 15.09.2026)

- **Prompt-Store** `lib/promptstore.js`: `data/prompts.json` = `{system, aufgaben:{task:"text"}}`;
  nur Abweichungen gespeichert, leer = Vorlage. `aufgabePrompt(task,card,kontext)` →
  `baueAufgabe(task,card,override,kontext)` (`lib/ai.js`). Ein Prompt je Task.
- **Tasks mit Knopf** (`lib/ai.js` PROMPTS): recherche, hooks_verbal, hooks_visuell, skript, caption,
  ideen, plan. Ohne Knopf: regieplan, analyse. `kontextabgleich` ist heute „(automatisch nach der
  Recherche)". JSON-Aufgaben: recherche, kontextabgleich, hooks_verbal, hooks_visuell, caption, ideen, plan.
- **KI-Aufruf** heute: Client `ki/kiStream(task, …)` → `kiKonfig(task)` schickt EINE Rolle
  (provider/ollamaModel/claudeModell) → Server `/api/ai(/stream)` baut EINEN Prompt, ruft EIN Modell.
  Für `task==="recherche"` schaltet der Server heute eine Web-Suche vor (v40 `lib/websuche.js`),
  und `detail.js` verkettet danach automatisch `kontextabgleich` (v40 T2/T4).
- **System-Prompts-Tab** `ui.js` (`zeichnePrompts`, `promptBlock` ab 1148): je Task ein `<details>`
  mit einem Textfeld + Speichern/Zurücksetzen, PUT `/api/prompts {id,text}`.
- **Workflows-Tab** `ui.js` (Seite 6, `zeichneWorkflows` ab 1287, Editor ab 1453, lädt
  `/workflowbuilder.css` @1305). Endpunkte: `/api/workflows` GET/PUT, `/api/workflows/eigene` PUT/DELETE.
- **Laufzeit-Automationen bleiben zwingend:** `an=(id)=>wfIstAn(S.workflows,id)` (`store.js:34`) liest
  `S.workflows` (aus `/api/workflows` GET beim Start). Fundstellen u. a. `auto-drehtermin`,
  `gcal-autosync`, `drive-ordner-anlegen`, `skript-gespeichert-weiter`, `upload-fertig-weiter`,
  `drehtermin-zuordnen-videodreh`; `feuere(event,ctx)` in store/detail/board. Engine
  `public/workflowengine.js`.

## Teil A — Workflows-Tab entfernen (reine Konfig-UI, Laufzeit bleibt)

- **Weg:** Nav-Eintrag „Workflows"; `seite6` + `wfListe`; `zeichneWorkflows` + der Builder-Editor
  (ui.js ~1287–ende des Editors) + der dynamische `/workflowbuilder.css`-Load; der `i===6`-Zweig im
  Tab-Switching; `seiten`-Array + `navItems`-Liste anpassen (Indizes!).
- **Bleibt (NICHT anfassen):** `an(id)`/`wfIstAn`, `feuere`, `public/workflowengine.js`,
  `S.workflows`-Load beim Start (sonst fallen die eingebauten Automationen auf „aus"!),
  `lib/workflowstore.js`, die Fundstellen in store/detail/board.
- **Endpunkte:** `/api/workflows` GET **bleibt** (der Start-Load braucht ihn). `/api/workflows` PUT
  und `/api/workflows/eigene` PUT/DELETE werden ohne UI ungenutzt — Entscheidung F3 (siehe unten):
  vorerst stehen lassen (tot, aber harmlos) oder mit-entfernen. Selbstgebaute Workflows in
  `ownworkflowstore` laufen über `feuere` weiter, bis F3 anders entscheidet.
- **Prüfsatz nach dem Umbau:** ein `auto-drehtermin`/`drive-ordner-anlegen`-Auslöser wirkt noch
  (Regression-Check), obwohl der Tab weg ist.

## Teil B — Knopf-Pipelines (Kern)

### B1 Datenmodell (`data/prompts.json`)
```
{
  "system": "…",                         // Vorspann-Override — UNVERAENDERT
  "aufgaben": {
    "recherche": {
      "schritte": [
        {"rolle":"userkomm","prompt":"Lies Kontext & Auftrag …{{kontext}}","websuche":false},
        {"rolle":"recherche","prompt":"Recherchiere Fakten zu: {{vorschritt}}","websuche":true},
        {"rolle":"userkomm","prompt":"Formuliere daraus … {{vorschritt}} {{nurJson}}"}
      ]
    }
  }
}
```
- `rolle` ∈ `userkomm|recherche|kontext` (die drei v40-Rollen). Das Modell des Schritts = das der Rolle.
- `websuche` (bool): diesem Schritt frische Web-Treffer voranstellen (nutzt `lib/websuche.js`).
- **Abwärtskompatibel:** ist `aufgaben[task]` ein STRING (alt) → als `{schritte:[{rolle:rolleFuerTask(task),
  prompt:<string>}]}` lesen. Fehlt der Eintrag → Default-Pipeline (siehe B4).

### B2 Ausführung (Server, eine Wahrheit)
- `/api/ai` + `/api/ai/stream` bekommen im Body zusätzlich `rollenModelle:{userkomm,recherche,kontext}`
  (je `{provider,ollamaModel,claudeModell}`) — der Client kennt die Rollen-Konfig (v40), der Server
  mappt Schritt.rolle → Modell.
- Server lädt die Pipeline des Tasks (promptstore), dann je Schritt: (a) wenn `websuche` →
  Web-Treffer holen und als Block voranstellen; (b) Prompt bauen (Platzhalter füllen, inkl.
  `{{vorschritt}}` = Ausgabe des Vorschritts, `{{kontext}}`, Firmen-/Projektkontext, `{{nurJson}}`);
  (c) Modell der Rolle rufen; (d) Ausgabe merken. Stream: pro Schritt `status` „Schritt i/n ·
  ⟨Rollenname⟩" (das Denk-Panel-Etikett v40-T4 schaltet mit).
- **Ergebnis = Ausgabe des LETZTEN Schritts.** JSON-Parsing (JSON_AUFGABEN) nur auf den letzten Schritt.

### B3 Client
- `kiKonfig(task)` → schickt `rollenModelle` (alle drei Rollen-Konfigs) statt einer.
- Die v40-Spezialfälle **entfallen**: die harte `kontextabgleich`-Verkettung in `detail.js` und die
  „nur für recherche"-Web-Suche im Server werden durch die generische Pipeline ersetzt (F1).

### B4 Default-Pipelines (kein Override gespeichert)
- Jede Aufgabe ohne gespeicherte Schritte: **1 Schritt** = `{rolle: rolleFuerTask(task), prompt:
  <Vorlage aus lib/ai.js>, websuche: (task==="recherche")}`. Damit bleibt jeder Knopf sofort
  funktionsfähig; recherche sucht weiter im Web. Die frühere Auto-`kontextabgleich`-Zweitrunde
  entfällt als Default (F1) — Ben baut sie bei Bedarf als Schritt nach (sein 3-Schritt-Beispiel).

### B5 UI — „System Prompts"-Tab wird Pipeline-Editor
- System-Vorspann-Block: **unverändert** (ein Textfeld).
- Je Knopf ein `<details>` mit einer **Schritt-Liste**. Schritt-Zeile: Rollen-Dropdown
  (Userkommunikation/Recherche/Kontextabgleich) · Websuche-Checkbox · Prompt-Textarea · Platzhalter-
  Legende (inkl. `{{vorschritt}}`) · Schritt entfernen · hoch/runter. Darunter „+ Schritt".
  „Auf Standard zurücksetzen" = Schritte löschen (zurück zur Default-Pipeline).
- Speichern: PUT `/api/prompts {id, schritte}` (statt `text`). `promptstore.setze(id, schritte)`.

### B6 Server-Bausteine
- `promptstore`: `lies/schreib` bleiben; `setze(id, schritte)` schreibt `{schritte}` (oder löscht bei
  leer). `uebersicht()` liefert je Aufgabe die effektiven Schritte + die Default-Schritte + Platzhalter.
  Neue Funktion `pipeline(task)` = effektive Schritt-Liste (Override sonst Default), mit String-Migration.
- Neue Ausführungsschleife in `server.js` (`/api/ai` + `/api/ai/stream`), die `pipeline(task)` abfährt.

## Offene Weichen (VOR dem Bau entscheiden)

- **F1 — Recherche-Default:** Empfehlung: harte v40-Verkettung (recherche→kontextabgleich) **retiren**,
  Default recherche = 1 Schritt (Recherche-Rolle + Websuche); Ben baut die 3-Schritt-Variante selbst.
  Alternative: Default recherche = 2 Schritte (Recherche+Websuche → Kontextabgleich), um das heutige
  Verhalten 1:1 zu behalten.
- **F2 — Web-Suche:** Empfehlung: **pro Schritt** als Checkbox `websuche` (flexibel, Ben wählt den
  suchenden Schritt). Alternative: fest an die Recherche-Rolle gebunden.
- **F3 — Selbstgebaute Workflows/Engine:** Empfehlung: nur den **Tab** entfernen, `feuere`/Engine +
  bestehende eigene Workflows **laufen weiter** (minimaler Eingriff). Alternative: Engine +
  `ownworkflowstore` + Endpunkte ganz zurückbauen (mehr Arbeit, mehr Risiko).

## Bau-Reihenfolge (nach Freigabe)

1. **Teil A** — Workflows-Tab entfernen (ui.js Nav/Seite/Switching/CSS-Load), Regression-Check
   `an(id)` (eine Automation feuert noch) → Commit.
2. **B1/B6 Datenmodell + `pipeline(task)`** in promptstore/ai.js, mit String-Migration + Defaults;
   Node-Probe (Pipeline baut, Migration greift) → Commit.
3. **B2 Server-Ausführung** (`/api/ai`+`/stream` Schritt-Schleife, Websuche je Schritt, Threading,
   JSON nur letzter Schritt) + **B3 Client** (`rollenModelle` senden, v40-Spezialfälle raus);
   E2E-Probe am Stream (2–3 Schritte, Status je Schritt) → Commit.
4. **B5 UI-Editor** (Schritt-Liste, Rollen-Dropdown, Websuche, +/−/↑↓, Speichern) → Screenshot-Abnahme
   gegen `docs/ui-standard.md` → Commit.
5. Completeness-Audit + Fulfillment (Bens 3-Schritt-Beispiel real durchspielen) → Abschluss.

## Stand

- [x] **Teil A — Workflows-Tab + Engine entfernt** (15.09.2026). ui.js: Nav/Seite6/Switching/Builder
      (~647 Zeilen) raus; store.js/board.js/detail.js: `feuere`-Import + 4 Aufrufe raus; server.js:
      `eigeneWorkflows`-Import/Pfad + `/api/workflows/eigene` PUT/DELETE + `eigene`-Feld raus; gelöscht:
      `public/workflowengine.js`, `lib/ownworkflowstore.js`, `lib/workflowblocks.js`,
      `public/workflowbuilder.css`. **Behalten:** `an(id)`, `workflowstore`/`workflows.js`,
      `/api/workflows` GET+PUT, `S.workflows`-Load. Verifiziert: `node --check` (5 Dateien) grün,
      Reste-grep leer; Laufzeit: 9 Automationen geladen, `an('auto-drehtermin'/'gcal-autosync'/
      'drive-ordner-anlegen')`=true (wie davor), `feuere`=undefined; Screenshot: Settings-Nav ohne
      „Workflows", „System Prompts" lädt weiter.
- [x] **Teil B / Phase 1 — Datenmodell + `pipeline(task)` + Migration** (15.09.2026, additiv).
      Entscheidungen: 3-Schritt-Recherche-Default wie entworfen; System-Vorspann NUR in
      userkomm-Schritte. `lib/ai.js`: `standardRolle`, `standardPipeline` (recherche = 3er-Kette
      userkomm→recherche→userkomm, sonst 1 Schritt userkomm), `RECHERCHE_PIPELINE` (die 3 Prompts).
      `lib/promptstore.js`: `pipeline(task)` liest String-Override (Migration→1 Schritt) / `{schritte}`
      / Default. Node-Probe grün (recherche=3, skript=1, Migration, Override). Nichts an der Laufzeit
      geändert — alter Ein-Prompt-Pfad läuft weiter bis Phase 2.
- [x] **Teil B / Phase 2 — Server-Ausführung + Client + v40-Sonderfälle raus** (15.09.2026).
      Entscheidung Query-Quelle (Owner): der userkomm-Schritt formuliert 1–3 Web-Suchanfragen aus
      Karte+Brand; der Recherche-Schritt sucht mit dem Vorschritt-Output (Fallback Kartenthema),
      generalisiert je Recherche-Schritt. `server.js`: `laufePipeline` (Schritt-Schleife, Threading
      via {{vorschritt}}, Web-Suche `sucheWebViele` an Recherche-Schritten, System-Vorspann NUR
      userkomm, JSON nur letzter Schritt, Status je Schritt) + `rollenAusBody` (rückwärtskompatibel);
      beide `/api/ai`-Handler nutzen sie. `lib/ai.js`: `baueSchritt`, Schritt-1-Prompt = Suchanfragen;
      `kontextabgleich`-Task + JSON_AUFGABEN-Eintrag entfernt. `lib/websuche.js`: `sucheWebViele`.
      `store.js`: `kiKonfig` sendet `rollenModelle` (3 Rollen); `detail.js`: kontextabgleich-Auto-Kette
      raus. Bonus-Fix: tote `ladeModelle`-Aufrufe (v40-Altlast) entfernt.
      **Verifiziert (E2E):** echter Config-Lauf (userkomm=Claude, recherche/kontext=deepseek-r1:14b) →
      Schritt 1 Claude → Schritt 2 deepseek (8 Web-Treffer) → Schritt 3 Claude → `done` mit gültigem
      JSON (zusammenfassung/fokus=3/frame/keywords=6, markenkonform). Client baut rollenModelle korrekt
      (userkomm=claude/haiku, recherche/kontext=ollama/deepseek-r1:14b); laufender Modul-Code fix.
- [x] **Teil B / Phase 3 — Editor-UI + Server-Vertrag** (15.09.2026). `lib/promptstore.js`:
      `effektiveSchritte`, `uebersicht()` liefert je Knopf `schritte`+`standard`+`eigen`+`rollen`+
      Platzhalter (inkl. {{vorschritt}}/{{nurJson}}), `setze(id, wert)` nimmt Schritt-Liste (leer →
      Default) bzw. System-Text. `server.js`: `PUT /api/prompts` nimmt `schritte`. `ui.js`: „System
      Prompts"-Tab = `systemBlock` (Vorspann unverändert) + `aufgabeBlock` (Schritt-Liste mit Rollen-
      Dropdown, „sucht automatisch im Web" bei Recherche, +Schritt/↑↓/✕, Speichern/Zurücksetzen).
      `style.css`: Schritt-Editor-Regeln. Verifiziert: Screenshot (Recherche = 3 Schritte, Rollen
      korrekt), read_page (Schritt 1 userkomm / 2 recherche+web / 3 userkomm, +Schritt), Save-Round-
      Trip (skript: 2 Schritte gespeichert `eigen:true` → Reset `eigen:false` zurück auf Default).
      **v41 baulich komplett** (Teil A + Teil B Phase 1–3).

## DoD

- Kein Workflows-Tab; eine eingebaute Automation wirkt nachweislich weiter (Regression-Beleg).
- Ein Knopf (z. B. „Recherche und Fokus") lässt sich in den Einstellungen zu ≥2 Schritten mit je
  eigener Rolle + Prompt konfigurieren; beim Klick laufen die Schritte nacheinander auf den
  jeweiligen Modellen (Denk-Panel zeigt je Schritt die Rolle), Ergebnis kommt aus dem letzten Schritt.
- System-Vorspann unverändert; bestehende Ein-Prompt-Overrides laufen als 1-Schritt weiter (Migration).

## Risiken

- **Latenz:** mehrere Schritte = mehrere Modell-Läufe. Bewusst; Status je Schritt macht es sichtbar.
- **JSON-Bruch:** nur der letzte Schritt muss JSON liefern — Editor/Platzhalter (`{{nurJson}}`) müssen
  das klar anbieten, sonst liefert ein Zwischenschritt versehentlich JSON.
- **Tab-Entfernung:** `S.workflows`-Load MUSS bleiben, sonst kippen die eingebauten Automationen auf
  „aus" — expliziter Regression-Check in Schritt 1.
