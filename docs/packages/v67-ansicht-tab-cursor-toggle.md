# v67 — Tab "Ansicht" (Cursor-Toggle + Ampel-Erklaerung) + v62 Teil 2 abgeschlossen

> Owner-Auftrag 24.09.2026. Baustelle: `public/ui.js` (Einstellungen), `public/style.css`,
> `public/einstellungen.css`, `public/kontext.js`, `public/app.js` — Defaults-Persistenz bewusst
> per eigenem `fetch` gegen `/api/defaults`, NICHT ueber `public/store.js`/`lib/defaultsstore.js`
> (beide standen laut Auftrag auf der Kollisions-Sperrliste einer parallelen Sitzung).

## PIG

**Problem:** Zwei offene Stuecke im Einstellungsfenster: (A) kein Ort, um den Custom-Cursor
abzuschalten oder die Ampel-Schwellen nachzulesen; (B) v62 Teil 2 ("Unternehmenskontext +
System Prompts uebersichtlicher") stand seit dem 23.09.2026 mit zwei offenen Haken da
(`docs/packages/v62-einstellungen-layout-ueberarbeitung.md` Z. 117-118).

**Intent:** Ben will den Haus-Cursor bei Bedarf abschalten koennen (manche Situationen/Bildschirme
vertragen sich nicht mit dem eigenen SVG-Pfeil), die Ampel-Regeln nachlesen koennen ohne sie
raten zu muessen, und die Kontext-/Prompt-Tabs sollen nicht mehr alles auf einmal zeigen.

**Goal:** Neuer Tab "Ansicht" mit funktionierendem, persistentem Cursor-Toggle und einer
Ampel-Erklaerung (read-only); v62 Teil 2 umgesetzt (Projekte falten, visuelle Angleichung); beides
live im Browser bestaetigt, `node --check` auf allen geaenderten JS-Dateien gruen.

## Bestand (geprueft, nicht geraten)

- Tab-System: `public/ui.js:605-` (`einstellungenModal`), Namen-Array + `seiten`-Array + eine
  Index-parallele Klick-Schleife (~:1391) — ein neuer Tab braucht EINEN neuen Eintrag an
  derselben Stelle in beiden Arrays, plus Verschiebung aller nachfolgenden `i===`-Vergleiche.
- Cursor: `public/style.css:110-116` (v57) — `html { cursor: url("cursor-pfeil.svg") 5 4, auto; }`
  plus 28 weitere Stellen `cursor: url("cursor-hand.svg") 11 3, pointer;` (Knoepfe, ueberall) und
  1 Stelle `cursor: url("cursor-resize.svg") 16 10, ew-resize;` (`.detail-griff`). Grab/Grabbing/
  Progress/Help/Default sind bereits System-Cursor, bewusst unangetastet (v57-Owner-Entscheidung,
  nachgelesen in `docs/packages/v57-detail-resizable-und-cursor-stil.md:134-137`).
- Ampel-Schwellen: `docs/packages/v65-ampel-neudefinition.md` — `AMPEL = {rotTage:2, gelbTage:5}`,
  ueberfaellig/≤2 Tage = rot, 3-5 = gelb, ≥6 = gruen. Nur in `lib/pipeline.js` verankert, KEINE
  Settings-UI (v65 bewusst so gelassen, "Baustein 3 spaeter").
- Defaults-Store: `lib/defaultsstore.js` + `server.js:601-614` (`/api/defaults` GET/PUT) sind
  bereits ein voellig generisches, schemaloses Feld-Merge (Drive-Wahrheit, lokaler Cache-Fallback)
  — keine Server-Aenderung noetig, ein neues Feld `systemCursor` geht einfach mit durch.
- `public/store.js` (`S.defaults`, `ladeDefaults()`, `speichereDefaults()`) waere der
  naheliegende Ort fuer ein neues Defaults-Feld gewesen — stand aber auf der Kollisions-Sperrliste
  dieses Auftrags (parallele Sitzung an v65/v66). Deshalb: `public/ui.js` spricht `/api/defaults`
  direkt per `fetch` an (`holeCursorDefault`/`schreibeCursorDefault`), voellig unabhaengig von
  `S`/`store.js`. Zwei getrennte GET-Aufrufe beim Start (einer aus `store.js:ladeDefaults()` fuer
  Plattformen/Personen, einer aus `ui.js:ladeCursorModusVomServer()` fuer den Cursor) statt einer
  gemeinsamen — bewusster Mehraufwand von einem Extra-Request, um store.js nicht anzufassen.
- Verbindungs-Zeilen-Muster (v62 Teil 1): `.verb-zeile`/`.verb-kopf`/`.verb-detail` in
  `public/style.css:2800-2840` — Kopf immer sichtbar, Detail per Knopf ein-/ausklappbar
  (`baueVerbindungsZeile` in `ui.js:999`). Das ist das "neue Zeilen-/Abschnitts-Muster", auf das
  v62 Teil 2 sich bezieht.
- System Prompts (`public/ui.js:1436-`, v41): `aufgabeBlock()` ist bereits ein `<details>` OHNE
  `.open = true` — jeder Knopf-Block ist also schon standardmaessig gefaltet (nur `systemBlock()`,
  der EINE globale Vorspann-Block, ist bewusst offen). Diese Faltung war schon vor v62 da; hier
  nichts Neues noetig, nur die Optik angleichen.
- Unternehmenskontext (`public/kontext.js`): "Firma und Marke" ist ein Einzelblock (bleibt offen,
  analog zum System-Vorspann). "Projekte" war dagegen eine flache Liste voll aufgeklappter Boxen
  — genau der gemeldete Schmerzpunkt ("Projekte sollen sich falten lassen").

## Plan (umgesetzt)

1. **Tab "Ansicht"** (`ui.js`): neuer Eintrag im Namen-Array direkt nach "Darstellung" (Index 1),
   `seiteAnsicht` im `seiten`-Array an derselben Stelle, alle nachfolgenden `i===`-Vergleiche in
   der Klick-Schleife um 1 verschoben (2/3→3/4, 4→5, 5→6). Zwei Abschnitte: "Cursor" (Toggle,
   Erklaersatz) und "Ampel-Regeln" (reiner Erklaertext, keine Eingabefelder).
2. **Cursor-Mechanik** (`style.css`): drei CSS-Variablen `--cursor-pfeil`/`--cursor-hand`/
   `--cursor-resize` im `:root` (Standardwert = die bisherigen `url(...)`-Werte), alle 30
   `cursor:`-Regeln zeigen jetzt per `var(--cursor-*)` dorthin (28× Hand, 1× Pfeil, 1× Resize —
   Stellen nachgezaehlt: `grep -c 'cursor: var(--cursor-hand)' public/style.css` = 28). Eine
   Regel `html.system-cursor { --cursor-pfeil: auto; --cursor-hand: pointer; --cursor-resize:
   ew-resize; }` biegt bei aktivem Toggle ALLE drei auf den echten System-Fallback um — eine
   einzige Klasse auf `<html>` genuegt, keine der 30 Einzelregeln wird angefasst.
3. **Persistenz** (`ui.js`, eigenstaendig): `holeCursorDefault()`/`schreibeCursorDefault()` gegen
   `/api/defaults`; `wendeCursorModusAn()` setzt die DOM-Klasse UND einen `localStorage`-Cache
   (`cm-system-cursor`, selbes Muster wie `cm-theme` in `app.js`) gegen das Aufblitzen beim Start;
   `ladeCursorModusVomServer()` (in `app.js` nach `ladeBoard()`/`ladeDefaults()` aufgerufen) holt
   danach den wahren Server-Stand nach.
4. **v62 Teil 2 — Projekte falten** (`kontext.js`): jedes Projekt jetzt eine `.verb-zeile`-Zeile
   (Aktiv-Haken, Name, Kurzinfo "`N Quellen · <Textanfang>`", Bearbeiten-Knopf immer sichtbar) mit
   einem `.verb-detail`-Block (Name-Feld, Text, Quellen, Loeschen-Knopf), der per Bearbeiten-Knopf
   auf-/zuklappt — Standard: zugeklappt. Toter CSS-Rest `.kontext-projekt-kopf` entfernt.
5. **v62 Teil 2 — visuelle Angleichung**: `.einst-prompt` (System Prompts) und `.kontext-block`
   (Unternehmenskontext, "Firma und Marke") auf dieselbe Geometrie wie `.verb-zeile` gebracht
   (`border-radius: var(--rund)` statt `--rund-klein`, `background: var(--flaeche)` statt
   `--flaeche-tief`, Padding `12px 14px`) — alle gefalteten Abschnitte im Fenster sehen jetzt
   gleich aus, wie im Plan gefordert ("Abstaende, Labels, Trenner").
6. v62-Paket-Artefakt abgehakt (Stand-Zeilen 117/118 → erledigt, siehe dort).

## Stand

- [x] Bestand geprueft (Tab-System, Cursor-CSS, Defaults-Store, Verbindungs-Zeilen-Muster,
      Prompts-`<details>`-Verhalten, Kontext-Projekte) — 24.09.2026, per Read/Grep, nicht geraten.
- [x] Tab "Ansicht" gebaut: Cursor-Toggle + Ampel-Erklaerung.
- [x] Cursor-Toggle-Mechanik: CSS-Variablen + `html.system-cursor`-Override, alle 30 Stellen
      umgestellt (`grep -c 'cursor: url(' public/style.css` = 0 danach).
- [x] Persistenz ueber `/api/defaults`, EIGENSTAENDIG von `public/store.js` (Kollisionsvermeidung)
      — erster Versuch hatte `store.js` angefasst, beim Gegenlesen der Auftragsvorgaben bemerkt
      und vor dem Commit vollstaendig zurueckgebaut (`git diff -- public/store.js` jetzt leer).
- [x] v62 Teil 2: Projekte falten (Verbindungs-Zeilen-Muster), System Prompts/Unternehmenskontext
      visuell angeglichen.
- [x] v62-Paket abgehakt (Zeilen 117/118).
- [x] `node --check` auf `public/ui.js`, `public/app.js`, `public/kontext.js` — alle gruen.
- [x] CSS-Klammern ausgezaehlt (`style.css` 626/626, `einstellungen.css` 42/42) — balanciert.
- [x] Live/DOM-Beleg im Browser (Server lief bereits auf Port 4321, von anderer Sitzung/dem
      Owner gestartet — kein eigener Neustart noetig):
  - Tab-Reihenfolge live bestaetigt: Darstellung, Ansicht, KI-Rollen, Externe Dienste, Social
    Media Kanaele, Unternehmenskontext, System Prompts.
  - Ansicht-Tab zeigt Cursor-Abschnitt (Toggle "an", akzentfarben) + Ampel-Regeln-Text exakt wie
    im Auftrag formuliert.
  - Toggle aus: `document.documentElement.className` → `"system-cursor"`,
    `getComputedStyle(html).cursor` → `"auto"`, `getComputedStyle(.schalter).cursor` → `"pointer"`
    (vorher Custom-SVG) — UND `/api/defaults` liefert danach `{"systemCursor":true}`. Toggle
    wieder an: beides zurueck (`""`/`{"systemCursor":false}`).
  - Neustart-Probe: Seite neu geladen, VOR jedem weiteren Skript war `documentElement.className`
    schon `"system-cursor"` (aus dem `localStorage`-Cache) — kein Aufblitzen des eigenen Cursors.
  - Projekte-Faltung: Testprojekt ueber "Neues Projekt hinzufuegen" angelegt → Zeile erscheint
    zugeklappt ("0 Quellen · noch kein Text hinterlegt", Bearbeiten-Knopf), "Bearbeiten" klappt
    Name/Text/Quellen/Loeschen auf. Danach wieder geloescht (`/api/kontext` zeigt wieder 0
    Projekte — Live-Daten unveraendert hinterlassen).
  - System Prompts: `Knopf „Recherche und Fokus"` etc. laden zugeklappt (`<details>` ohne `open`),
    gleiche Kachel-Optik wie die Verbindungs-Zeilen.
  - Defaults-Endstand nach der Probe wieder auf `{"systemCursor":false}` zurueckgesetzt (Standard,
    Eigener Cursor an) — Live-System nicht in einem Test-Zustand hinterlassen.

## DoD

- Tab "Ansicht" existiert, an Index 1 direkt nach "Darstellung".
- Cursor-Toggle schaltet Custom-Cursor an/aus, wirkt sofort, persistiert ueber Neustart via
  `/api/defaults` (Drive-gestuetzter Defaults-Store), OHNE `public/store.js` anzufassen.
- Ampel-Regeln nur erklaert, nicht editierbar — keine Schwellen-Eingabefelder gebaut (Owner klaert
  editierbar-oder-fest separat).
- v62 Teil 2 umgesetzt: Projekte gefaltet, Unternehmenskontext/System Prompts optisch an das
  Verbindungs-Zeilen-Muster angeglichen; v62-Paket-Artefakt abgehakt.
- `node --check` gruen auf allen geaenderten JS-Dateien; CSS-Klammern balanciert; Live-Verhalten
  im Browser bestaetigt (Screenshots + `getComputedStyle`/DOM-Proben).

**Geprueft gegen:** `public/ui.js`, `public/app.js`, `public/kontext.js`, `public/style.css`,
`public/einstellungen.css` (gelesen + editiert), `docs/packages/v62-einstellungen-layout-ueberarbeitung.md`,
`docs/packages/v57-detail-resizable-und-cursor-stil.md`, `docs/packages/v65-ampel-neudefinition.md`,
`lib/defaultsstore.js`, `server.js:601-614`, Live-Browser-Probe (localhost:4321, DOM/`fetch`/
`getComputedStyle`, kein Screenshot des Cursors selbst moeglich — v57-Praezedenzfall, Beleg per
DOM statt Bild). · **Offen:** editierbare Ampel-Schwellen (bewusst nicht gebaut, Owner-Entscheidung
steht noch aus).
