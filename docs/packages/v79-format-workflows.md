# v79 — Format-spezifische KI-Workflows + Workflow-Visualisierung

> Planpaket, VOR dem Bau geschrieben (Owner-Auftrag 28.09.2026: „recherchiere, was die beste
> Weise ist, und bei Fragen stell die immer, anstatt zu raten — bestmögliches Ergebnis mit
> super Plan und sauberer Umsetzung"). Bau erst nach Freigabe der offenen Weichen.

## PIG

**Problem:** Der gesamte KI-Workflow ist fest auf **Kurzformat-Video** verdrahtet.
Skript = One-Screen-Teleprompter mit Sprechzeit in Sekunden, danach Drehtermin, Videodreh,
Schnitt. Wer ein anderes Format produziert — **Slider/Carousel, Beitrag mit Text, Story/
Highlight, Langform-Video** — braucht ganz andere KI-Schritte, läuft aber trotzdem durch
„Drehtermin festlegen" und „Videodreh". Zusätzlich drei Feintuning-Wünsche am bestehenden
Pipeline-System (v41): Web-Suche pro Schritt frei wählbar, Latenz sichtbar/beherrschbar,
JSON-Bruch absichern.

**Intent:** Die KI-Schritte, die ein Content durchläuft, sollen sich **nach dem Format der
Karte** richten — jedes Format hat seine eigene, sinnvolle Schritt-Kette. Und diese Ketten
sollen in den Einstellungen **sichtbar und nachvollziehbar** sein (Workflow-Builder /
Visualisierung), nicht nur im Code stehen.

**Goal:**
1. Jede Karte mit Format ≠ Kurzform-Video bekommt die für ihr Format passenden KI-Schritte
   (Slider: Slide-Anzahl → Text je Slide → Visual je Slide → Cover/Hook → Caption; Beitrag:
   Visual-Konzept + Caption, Fokus LinkedIn; Story: kurzer Text + Visual (Bild/Video);
   Langform: stichpunktartiges Storytelling-Konzept statt mehrseitigem Skript).
2. Die format-fremden Video-Phasen (Drehtermin, Videodreh) gelten nur noch, wo sie passen.
3. In den Einstellungen lässt sich je Format sehen (und im gewählten Umfang bearbeiten),
   welche Schritte die KI durchläuft — visualisiert.
4. Feintuning: (a) Web-Suche pro Schritt als Schalter; (b) Latenz je Schritt sichtbar +
   Modellwahl je Schritt; (c) nur der letzte Schritt liefert JSON, im Editor klar markiert.

---

## Bestandsaufnahme (gemessen 28.09.2026, nicht erinnert)

Belege: `grep -rniE "format|contenttyp|kategorie" lib/ public/`,
`Read lib/pipeline.js`, `Read lib/ai.js`, `Read lib/promptstore.js`, `Read server.js`.

**Das Format-Konzept EXISTIERT bereits im Datenmodell — aber es steuert die Workflows nicht.**

| Baustein | Ort | Stand |
|---|---|---|
| Format je Karte | `card.contenttyp` (`lib/pipeline.js:751`) | Feld existiert, wird aber fast nirgends verzweigt |
| Format-Katalog | `CONTENTTYPEN` (`lib/pipeline.js:583-590`) | reel, slider, beitrag, story, highlight, langformat — mit `format`-Gruppe (Reel/Carousel/Bildpost/Story/Video) |
| Phasen (global) | `PHASEN` (`lib/pipeline.js:15-80`) | idee(Skript schreiben)→skript(Drehtermin)→videodreh→schnitt→caption→upload→fertig — **eine** Kette für ALLE Formate |
| Spalten | `mischeSpalten` (`pipeline.js:109`) | Spalten = Drive-Ordner, **global** (nicht pro Karte/Format) |
| KI-Tasks | `PROMPTS` (`lib/ai.js:152+`) | recherche, hooks_verbal, hooks_visuell, skript (Sekunden-Teleprompter), regieplan (A/B-Roll, Sekunden), caption, ideen, plan, analyse — **alle video-geformt** |
| Pipeline je Task | `standardPipeline` (`ai.js:577`), `pipeline(task)` (`promptstore.js:153`) | recherche = 3er-Kette, sonst 1 Schritt; Override je Task in `data/prompts.json` `aufgaben[task]` — **keine Format-Dimension** |
| Rollen→Modell | `rollenModelle` (`server.js:274`), `laufePipeline` (`server.js:293`) | userkomm/recherche/kontext, je eigenes Modell |
| Web-Suche | `laufePipeline` (`server.js:341`) | fest an Recherche-Rolle gebunden (v41-Entscheid F2) — **kein Schritt-Schalter mehr** |
| Editor | „System Prompts"-Tab (`public/ui.js`) | Schritt-Liste je Task, Rollen-Dropdown, Speichern/Zurücksetzen — **keine Format-Ansicht, keine Visualisierung** |

**Kernspannung (muss entschieden werden):** Spalten/Phasen sind **global und an physische
Drive-Ordner gebunden**; Karten wandern beim Spaltenwechsel physisch (rclone move). Format-
spezifische **Phasen** kollidieren damit. Format-spezifische **KI-Schritte** (was die Knöpfe
tun) kollidieren NICHT — die hängen an Task+Karte, nicht an Drive. → Trennen: Workflow der
KI (leicht format-abhängig zu machen) vs. Board-Phasen (teuer, Drive-gebunden).

---

## Recherche (läuft — Ergebnisse werden hier eingetragen)

### Strom A — Content-Best-Practices je Format (zurück 28.09.2026, ≥2 Quellen je Format)

**Kritische Rahmen-Befunde (steuern W4):**
- **LinkedIn hat KEIN Story-Format** (2021 eingestellt) → Story/Highlight ist reine
  **Instagram**-Pipeline. Für LinkedIn-First heißt das: Story ist ein Nebenformat.
- **„LinkedIn-Carousel" = Dokument/PDF-Post** (nicht Bilder-Slider wie IG). Organisch
  8–15 Slides; die 2–10-Grenze gilt nur für bezahlte Carousel-*Ads*.
- Hashtag-Cap „5 bei IG" ist ein Late-2025-Sekundärsignal, kein Meta-Wort → vor Hardcoding
  gegen aktuelle Meta-Doku prüfen (steht schon differenziert in `pipeline.js` PLATTFORMEN).

**Ideale KI-Schritt-Sequenz je Format (Default-Pipeline-Kandidaten):**

| Format | Schritt-Sequenz | Kernparameter |
|---|---|---|
| **Slider/Carousel** | Botschaft/Slide → Slide-Zahl daraus ableiten → Hook-Cover (Neugierlücke) → 1 Botschaft + Visual je Slide (EIN Design-System) → CTA letzte Slide → erweiternde Caption | LinkedIn 8–15 / IG 8–10 (max 20); 6–8 Zeilen/Slide, ≥24 pt; IG 4:5 1080×1350; Caption 150–300 W |
| **Beitrag+Visual** | Insight → Hook für mobile Fold → Body in kurzen Blöcken → CTA/Frage → 1 Visual-Konzept → Hashtags | LI-Hook ≤140 Z. / IG ≤125 Z.; LI-Ideallänge 1.200–1.600 Z.; Hashtags je 3–5; LI: Kommentare ~10× > Likes |
| **Story/Highlight (IG)** | Micro-Ziel/Frame → Bild vs. Video wählen → sparsamer Text 9:16 → 1 Interaktions-Sticker/Frame → Frames zu Mini-Bogen | Foto 7 Sek / Video ≤15 Sek/Segment; Polls/Quiz/Fragen; 2–5/Tag |
| **Langform-Video** | Narrative Struktur wählen (roter Faden) → Hook-Beat (30 Sek) → 6–8 Kapitel als Stichpunkte → Payoffs alle 2–4 Min → Ende+CTA → Chapter-Marker | KONZEPT statt Skript; 6 Struktur-Bögen; Dichte vor Dauer |
| **Kurzform-Video (Baseline)** | 1 Idee → Hook 1–3 Sek → Value → Content → CTA → volles Skript + Drehplan | ≤60 Sek; 9:16; stumm-optimiert (= heutiger Ist-Zustand) |

Belegt gegen je ≥2 unabhängige Quellen (LinkedIn/Instagram/YouTube-Best-Practices 2025/26),
Erstresultate gegengeprüft. Quellen im Agenten-Bericht (usevisuals, Oktopost, Sprout,
Metricool, Hootsuite, PrePublish, 1of10 u. a.).

### Strom B — Workflow-Builder Datenmodell + Visualisierung (zurück 28.09.2026, ≥2 Quellen)

**Empfehlung Datenmodell:** lineare Schritt-Liste **pro Format**, kein Graph. „Unterschiedlich
je Format" heißt NICHT ein verzweigter Graph, sondern N bereits aufgelöste lineare Listen —
eine je Format. Keyed über `contenttypFormat(card.contenttyp)` (5 Format-Werte, hält die
Matrix klein). Fallback-Kette in `effektiveSchritte`: `perFormat[format] → Task-Default (eigen)
→ standardPipeline(task)`. Abwärtskompatibel; fehlt `perFormat`, verhält sich alles wie heute.
Schema-Skizze (additiv zum heutigen `aufgaben[task]`):
```
aufgaben[task] = {
  schritte: [ {rolle, prompt} ],          // Default wie bisher
  perFormat?: { "video": { schritte:[…] }, "carousel": { schritte:[…] } }  // nur wo abweichend
}
```
Belege: APXML (sequenziell vor Graph, Graph erst bei Branch/Loop), Zapier Paths + G2
Make-vs-Zapier (lineare Wege bevorzugen), Hootsuite/Filestage (Content-Tools parametrisieren
Stages statt per-Format-Graphen), n8n-Docs (Voll-Graph = das schwergewichtige Gegenteil).

**Empfehlung Visualisierung:** vertikaler **Schritt-Flow** (DOM-Karten oben→unten, dazwischen
Konnektor-Pfeil = `{{vorschritt}}`-Datenfluss). Je Karte: Rollen-Badge (welches Modell), Prompt
collapsible (Progressive Disclosure), I/O-Chip (`← Ausgabe Schritt N` / `→ JSON` bei nurJson).
Reihenfolge per ▲/▼. Format-Umschaltung: Segmented-Control/Tabs (Formate) über dem Stepper;
Badge „erbt Standard" vs „eigene Fassung" (das `eigen`-Flag liefert `uebersicht()` schon).
SVG NUR für die kleinen Konnektor-Pfeile, KEIN Kanten-Editor/Canvas. Belege: Clarity Design +
Eleken (Stepper/Timeline für lineare, revidierbare Flows). Kanban/Node-Canvas verworfen
(falsche Metapher bzw. schwergewichtig).

**Ausbaupfad:** Phase 1 `perFormat`-Fallback + Format-Tabs am bestehenden Editor. Phase 2 nur
bei Bedarf „gemeinsame Schritte + Overrides" / `skipIf`. Phase 3 nur wenn echter Branch/Loop
auftaucht (z. B. Qualitäts-Gate mit Rücksprung) → dann erst Knoten-Modell erwägen.

---

## Entscheidungen (Owner, 28.09.2026)

- **W5 → Feintuning 1-3 ZUERST** (Agent-Entscheid, ausgeführt): klein, unabhängig vom
  Format-Umbau, schneller Gewinn. Danach Format-Arbeit.
- **W2 → perFormat-Datenmodell + Fallback-Kette** (aus Strom B übernommen, Standard-Empfehlung).
- **W1 → Nur KI-Schritte format-abhängig; Board-Phasen bleiben global** (Owner 28.09.2026).
  Video-Phasen (Drehtermin, Videodreh) werden für Nicht-Video-Formate zu nicht-sperrenden,
  überspringbaren Toren. KEIN Drive-/Spalten-Umbau.
- **W4 → Format-eigene Knopf-Sets + neue Tasks** (Owner 28.09.2026). Slider: „Slides aufbauen"
  + „Visual je Slide"; Langform: „Storytelling-Konzept"; Story: „Story-Frames"; Beitrag:
  „Visual-Konzept". Jeder Knopf hat eine format-eigene Pipeline.
- **W3 → Sichtbar UND editierbar je Format** (Owner 28.09.2026). Vertikaler Schritt-Flow mit
  Format-Tabs, Rolle/Modell-Badge, Datenfluss-Pfeilen, „erbt Standard" vs „eigene Fassung".

---

## Offene Weichen (VOR dem Bau entscheiden — Owner)

- **W1 — Umfang Phasen vs. nur KI-Schritte:** Nur die KI-**Schritte** format-abhängig machen
  (Board-Phasen bleiben global, Video-Phasen werden für andere Formate nur übersprungen/gated)
  ODER auch **format-spezifische Phasen/Spalten**? (Zweiteres ist der große, Drive-gebundene
  Eingriff.)
- **W2 — Datenmodell format×task:** Wie werden format-spezifische Pipelines abgelegt? (z. B.
  `prompts.json` → `formate[format].aufgaben[task]` mit Fallback auf globalen Task-Default.)
- **W3 — Builder-Tiefe:** Nur **Visualisierung** (Ansehen/Nachvollziehen) oder voll
  **editierbar** je Format (Schritte hinzufügen/umsortieren)?
- **W4 — Neue Tasks je Format:** Welche neuen KI-Tasks braucht es (z. B. `slider_aufbau`,
  `langform_konzept`, `visual_konzept`)? Aus Recherche-Strom A abgeleitet, dann bestätigt.
- **W5 — Feintuning-Reihenfolge:** Feintuning 1-3 VOR oder NACH dem Format-Umbau bauen?
  (Empfehlung folgt: 1-3 sind klein und unabhängig → zuerst, als schneller Gewinn.)

---

## Plan (Phasen) — freigegeben 28.09.2026

- **v79-A — Feintuning 1-3** (zuerst, klein, unabhängig):
  1. **Web-Suche pro Schritt:** Schritt-Modell `{rolle, prompt}` → `{rolle, prompt, websuche}`;
     `laufePipeline` (server.js) nutzt `step.websuche` statt fester Recherche-Rollen-Bindung
     (F2 aus v41 wird zurückgenommen); Editor bekommt Websuche-Checkbox je Schritt.
     Abwärtskompatibel: fehlt `websuche`, gilt weiter „Recherche-Rolle sucht".
  2. **Latenz sichtbar:** je Schritt die verstrichene Zeit im Status/Denk-Panel anzeigen
     (Chaining ist nicht parallelisierbar → Kosten transparent machen statt verstecken).
  3. **JSON nur letzter Schritt:** Editor markiert den End-Schritt; `{{nurJson}}` nur dort
     sinnvoll; Server erzwingt JSON-Parse ausschließlich am letzten Schritt (ist schon so) +
     Editor-Hinweis, damit kein Zwischenschritt versehentlich JSON liefert.
- **v79-B — perFormat-Datenmodell:** `promptstore.effektiveSchritte/uebersicht/setze` um
  `perFormat` + Fallback `perFormat[contenttypFormat(card.contenttyp)] → Task-Default → Standard`;
  Migration/abwärtskompatibel; node-Probe.
- **v79-C — Format-Tasks + Knopf-Sets:** neue Tasks mit Default-Pipelines aus Strom A
  (slider: `slider_aufbau` + `slider_visual`; langform: `langform_konzept`; story:
  `story_frames`; beitrag: `beitrag_visual`); je Format sichtbare Knopf-Menge auf der Karte.
- **v79-D — Board:** `tore()` (pipeline.js) format-bewusst — Video-Phasen (Drehtermin,
  Videodreh) für Nicht-Video-Formate nicht-sperrend/überspringbar; Regression-Check Video.
- **v79-E — Workflow-Ansicht:** vertikaler Schritt-Flow + Format-Tabs im „System Prompts"-Tab
  (editierbar je Format, Rolle/Modell-Badge, Datenfluss-Pfeile), Vanilla + CSS-Variablen.
- **v79-F — Verify:** `node --check` je Datei, E2E je Format, Screenshot-Abnahme Light/Dark
  gegen `docs/ui-standard.md`, Completeness-Audit + Fulfillment (echter Durchlauf je Format).

## Stand

28.09.2026 — Plan freigegeben (W1/W2/W3/W4/W5 entschieden). Bestandsaufnahme gemessen,
Recherche A+B eingetragen. Bau beginnt mit v79-A.

**v79-A gebaut+verifiziert (28.09.2026):**
- **Punkt 1 Websuche je Schritt:** Schritt-Modell trägt `websuche`; `server.js:laufePipeline`
  nutzt `s.websuche` (Fallback: Recherche-Rolle sucht — abwärtskompatibel); `standardPipeline`
  (ai.js) setzt es explizit; `promptstore` liest/schreibt es; Editor-Checkbox „im Web suchen".
- **Punkt 2 Latenz sichtbar:** je Schritt `dauerSek` via `onStufe({stufe:"schritt-fertig"})` +
  Status-Satz „fertig in Xs" (serielle Kette → Zeit benannt statt versteckt).
- **Punkt 3 JSON nur Endschritt:** Server parst JSON schon nur am letzten Schritt (unverändert);
  Editor markiert den letzten Schritt „· Ergebnis" + Warnung, wenn `{{nurJson}}` in einem
  Zwischenschritt steht.
- Verifiziert: `node --check` server.js/ai.js/promptstore.js/ui.js = grün; Probe
  `standardPipeline('recherche')` → nur Recherche-Schritt `websuche:true`; **Screenshot** (Server
  Port 4399, System-Prompts-Tab): Schritt 1 „im Web suchen" leer, Schritt 2 (Recherche) angehakt,
  „Schritt 3 · Ergebnis" beim Recherche-Knopf, „Schritt 1 · Ergebnis" bei Ein-Schritt-Knöpfen.
- Bewusst NICHT angefasst: `style.css` (Parallel-Session hält sie dirty) — Additionen nutzen
  bestehende Klassen + `var(--rot)` inline. Dark-Mode-Screenshot offen (Additionen erben
  vorhandene, getönte Klassen); Live-Latenz-Anzeige braucht echten KI-Lauf (Drive/CLI).

## DoD

- [x] **v79-A:** Websuche je Schritt schaltbar (Editor + Server); Latenz je Schritt sichtbar;
      JSON nur am letzten Schritt (Editor-Markierung + Server). node --check grün, Screenshot-Beleg.
- [x] **v79-B:** perFormat-Ablage + Fallback + Migration (28.09.2026). `promptstore.effektiveSchritte`
      (jetzt exportiert, rein) löst `perFormat[format] → Task-Default → Standard` auf; `pipeline(task,
      format)` + `setze(id, value, format)` (perFormat-Zweig erhält den anderen); `server.js`
      übergibt `contenttypFormat(card.contenttyp)` an die Pipeline, PUT `/api/prompts` reicht `format`
      durch. node --check grün; Probe 6/6 (leer→Standard, String-Migration, Format-Treffer,
      Format-Fehltreffer→Base, ohne Format→Base, recherche-Websuche `[false,true,false]`).
- [x] **v79-C1 (Tasks/Defaults):** 5 Format-Tasks in `lib/ai.js` (28.09.2026) — `slider_aufbau`,
      `slider_visual`, `beitrag_visual`, `story_frames`, `langform_konzept`; je Ein-Schritt-Default
      (userkomm), in `JSON_AUFGABEN`, LinkedIn-primär, Parameter aus Strom A. Probe 5/5 grün
      (1 Schritt, JSON-Flag, Prompt baut ohne offene Platzhalter).
- [ ] **v79-C2 (Karten-Knöpfe):** je Format die richtige Knopf-Menge auf der Karte — **blockiert**,
      bis Peer-Session `public/detail.js` freigibt. Danach: ein echter Lauf je Format liefert
      format-passenden Output.
- [ ] **v79-D:** Slider-/Beitrag-/Story-/Langform-Karte kommt ohne Drehtermin durchs Board;
      Video-Karte unverändert (Regression-Beleg).
- [ ] **v79-E:** Workflow je Format sichtbar + editierbar; Screenshot Light+Dark gegen
      ui-standard.md.
- [ ] Completeness + Fulfillment.
