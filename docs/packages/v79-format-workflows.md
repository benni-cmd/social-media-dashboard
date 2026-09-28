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

- **Strom A — Content-Best-Practices je Format** (LinkedIn primär, IG sekundär): ideale
  KI-Schritt-Sequenz + Parameter je Format (Slide-Anzahl, Textlängen, Hook-Konventionen,
  Langform-Storytelling-Struktur). Status: läuft.
- **Strom B — Workflow-Builder Datenmodell + Visualisierung** unter Randbedingung „Vanilla
  JS, keine Libs, Light/Dark": Format→Pipeline-Modell, leichtgewichtige Visualisierung.
  Status: läuft.

*(Wird nach Rücklauf mit Quellen gefüllt; erst dann die Weichen unten final an den Owner.)*

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

## Plan (Phasen) — nach Weichen-Freigabe

*(Wird nach den Entscheidungen gefüllt. Grobskizze:)*
- **v79-A — Feintuning 1-3** am bestehenden Pipeline-System (klein, unabhängig).
- **v79-B — Format→Pipeline-Datenmodell** + Fallback + Migration.
- **v79-C — Format-Tasks** (Default-Pipelines je Format aus Recherche A).
- **v79-D — Board-Anpassung** (Phasen gaten/überspringen je Format, je nach W1).
- **v79-E — Workflow-Visualisierung/Builder** im Einstellungs-Tab (aus Recherche B).
- **v79-F — Verify:** node --check, E2E je Format, Screenshot-Abnahme Light/Dark,
  Completeness + Fulfillment (echter Durchlauf je Format).

## Stand

28.09.2026 — angelegt vor dem Bau. Bestandsaufnahme gemessen. Recherche läuft, Weichen offen.

## DoD

*(Wird mit dem Plan finalisiert.)*
