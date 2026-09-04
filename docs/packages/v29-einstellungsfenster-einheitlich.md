# v29 — Einstellungsfenster: eine Groesse fuer alle Tabs

## PIG

**Problem:** Das Einstellungsfenster hat je Tab eine andere Groesse. Gemessen am 04.09.2026 im
Browser bei einem Fenster von 1280x720 (`getBoundingClientRect()` ueber alle sechs Tabs):

| Tab | Breite | Hoehe | ragt aus dem Bild |
|---|---|---|---|
| Darstellung | 520 | 260 | nein |
| Verbindungen | 520 | 388 | nein |
| Externe Dienste | 520 | 631 | nein |
| Social Media Kanäle | 520 | **863** | **ja** — oben −71, unten 792 bei 720 Bildhoehe |
| System Prompts | 880 | 555 | nein |
| Workflows | 880 | 555 | nein |

Drei Ursachen, alle im CSS: (1) `.einstellungen-modal` hat `max-width: 520px`, die Klasse `breit`
setzt fuer die letzten zwei Tabs `880px` — zwei Breiten. (2) Die Hoehe ist frei und waechst mit
dem Inhalt, von 260 bis 863 Pixel. (3) Nur `.breit .einst-inhalt` hat `max-height` und darf
scrollen; die vier uebrigen Tabs haben keine Grenze — deshalb schiebt sich „Social Media Kanäle"
oben UND unten aus dem Bild, ohne dass man scrollen koennte.

**Intent:** Das Fenster soll bei jedem Tab gleich aussehen und gleich gross sein. Der Inhalt
richtet sich nach dem Fenster, nicht das Fenster nach dem Inhalt — sonst springt es bei jedem
Klick in der linken Liste.

**Goal:** Alle sechs Tabs haben dieselbe Breite und dieselbe Hoehe. Kein Tab ragt aus dem Bild.
Was nicht hineinpasst, ist ueber die Inhaltsspalte scrollbar erreichbar — nichts wird
abgeschnitten. Das Fenster ist merklich groesser als die bisherigen 520 Pixel.

---

## Design-Entscheidungen [04.09.2026]

- **Feste Groesse statt „passt sich an".** Breite 920 Pixel (hoechstens 92 % der Fensterbreite),
  Hoehe 78 % der Fensterhoehe, mindestens 520 und hoechstens 860 Pixel. Damit steht das Fenster
  still, wenn Ben zwischen den Tabs wechselt — ein springendes Fenster ist genau das, was er
  als „mal sehr gross, mal sehr klein" beschrieben hat.
- **Die Inhaltsspalte scrollt, nicht die Seite.** `.einst-inhalt` bekommt `overflow-y: auto` und
  `min-height: 0` (ohne das Zweite scrollt ein Flex-Kind nicht, sondern waechst). Die linke
  Navigation scrollt getrennt, damit sie bei langen Seiten stehen bleibt.
- **Die Klasse `breit` entfaellt.** Sie war der Sonderfall fuer die zwei neuen Tabs; mit einer
  Groesse fuer alle hat sie keinen Sinn mehr.
- **Eigene Stilseite `public/einstellungen.css`, eingebunden in `index.html`.**
  `public/style.css` wird zur Zeit von einer PARALLELEN SITZUNG bearbeitet (Stand `git status`:
  `M public/style.css`, 181 Zeilen eingefuegt, u. a. eine neue Regel fuer `.modal`). Wer diese
  Datei committet, nimmt deren unfertige Arbeit mit. Die neue Geometrie steht deshalb in einer
  eigenen Datei, die NACH `style.css` geladen wird und die alten Groessenregeln ueberschreibt.
  Der Anbau ist bewusst nur die Geometrie — Farben und Formen bleiben bei der anderen Sitzung.
  Offener Punkt: sobald `style.css` frei ist, die alten `.einstellungen-modal`-Groessenregeln
  dort loeschen, damit es nur eine Stelle gibt.

## Plan

- **v29-1** — `public/einstellungen.css` anlegen: Fenstergroesse, Navigation, scrollende
  Inhaltsspalte, Feldbreiten.
- **v29-2** — `public/index.html`: die Stilseite einbinden. `public/ui.js`: den `breit`-Umschalter
  entfernen.
- **v29-3** — Verify: alle sechs Tabs erneut messen (dieselbe Messung wie oben) und je einen
  Screenshot.

## Stand — gebaut und gemessen, 04.09.2026

Neu: `public/einstellungen.css`. Geaendert: `public/index.html` (Stilseite eingebunden),
`public/ui.js` (der `breit`-Umschalter ist raus).

Dieselbe Messung wie oben, nach dem Umbau, bei 1280x720:

| Tab | Breite | Hoehe | oben | unten | ragt raus | scrollt |
|---|---|---|---|---|---|---|
| Darstellung | 920 | 562 | 79 | 641 | nein | nein |
| Verbindungen | 920 | 562 | 79 | 641 | nein | nein |
| Externe Dienste | 920 | 562 | 79 | 641 | nein | nein |
| Social Media Kanäle | 920 | 562 | 79 | 641 | nein | ja (Inhalt 736) |
| System Prompts | 920 | 562 | 79 | 641 | nein | ja (Inhalt 1228) |
| Workflows | 920 | 562 | 79 | 641 | nein | ja (Inhalt 2577) |

Kleines Fenster (900x560, `resize_window`): Fenster 828x512, oben 24, unten 536 — passt, die
Ausnahmeregel fuer niedrige Fenster greift.

Nachgezogen waehrend der Abnahme: kurze Auswahlreihen (Light/Dark Mode, Datenquelle) wurden auf
460 Pixel begrenzt — auf 740 Pixel gezogene Zweier-Knoepfe sahen aus wie ein Fehler, nicht wie
eine Wahl. Anbieter-Karten und die Ollama-Hilfe stehen bei 620 Pixel.

## DoD

- [x] Alle sechs Tabs haben dieselbe Breite und dieselbe Hoehe (920 x 562, gemessen)
- [x] Kein Tab ragt aus dem Bild (`top` 79, `bottom` 641 bei 720 Bildhoehe — bei allen sechs)
- [x] Jeder Tab, dessen Inhalt hoeher ist als das Fenster, ist scrollbar (drei von sechs)
- [x] Screenshots: Darstellung · Externe Dienste · Social Media Kanäle · System Prompts ·
      Workflows · kleines Fenster 900x560
- [x] `public/style.css` unveraendert — `git diff --stat` zeigt vor und nach dieser Arbeit
      dieselben 181/59 Zeilen der parallelen Sitzung
- [ ] Offen: die alten Groessenregeln in `style.css` loeschen, sobald die Datei frei ist
