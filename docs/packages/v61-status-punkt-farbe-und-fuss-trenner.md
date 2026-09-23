# v61 — Status-Punkt bleibt farbig (Ausrufezeichen zusaetzlich, nicht ersetzend) + Fuss-Trenner

> Umgesetzt 23.09.2026.

## PIG

**Problem:** Owner-Fund (Screenshot 23.09.2026): die Status-Punkte an den Karten wirken
"einfach transparent, nicht mehr gelb rot und gruen". Ursache nachgemessen (nicht geraten):
v56 hatte fuer Aufmerksamkeits-Zustaende (`befund`/`fehlt`) den gefuellten Punkt durch eine
Glyphe (Ausrufezeichen-Icon) ERSETZT. Bei `fehlt` (blasses Oliv/Tan, `--fehlt: #8f7f5c`) als
duenne Strich-Grafik gegen den aehnlich hellen Karten-Hintergrund (`--flaeche-hoch`) praktisch
unsichtbar — genau der Zustand, den die meisten Testkarten gerade tragen. Zusaetzlich: der
Fuss-Bereich mit "Karte anlegen"/"Idee von der KI" hatte keine sichtbare Abgrenzung zur
scrollenden Kartenliste darueber.

**Intent:** Status-Farbe bleibt immer erkennbar (Punkt gefuellt); die Formen-Regel (Farbe
traegt nie allein) bleibt ERGAENZEND bestehen, nicht anstelle der Farbe. Die feste
Knopf-Sektion am Spaltenende hebt sich klar von der Liste ab.

**Goal:**
1. Punkt ist bei JEDEM Status gefuellt sichtbar (wie vor v56).
2. Bei `befund`/`fehlt` erscheint zusaetzlich ein Ausrufezeichen LINKS vom Punkt, nicht an
   seiner Stelle.
3. Titelzeile 1 reserviert entsprechend mehr Platz, wenn das Ausrufezeichen dazukommt.
4. `.spalte-fuss` bekommt eine klare Trennlinie zur Kartenliste darueber.

## Umsetzung

- `board.js` (`kachel()`): `AUFMERKSAM`-Zweig baut jetzt ZWEI Elemente statt eines —
  `.eintrag-achtung` (Ausrufezeichen-Icon, links) UND weiterhin den normalen
  `.eintrag-punkt-STATUS` (gefuellt). `.eintrag` traegt zusaetzlich die Klasse
  `eintrag-hat-achtung`, damit CSS die Titel-Platzreservierung gezielt erweitern kann.
- `style.css`:
  - `.eintrag-punkt-glyphe` (ersetzte den Punkt) entfernt — der Punkt ist wieder immer
    `background: currentColor`, keine Sonderbehandlung mehr fuer Aufmerksamkeits-Zustaende.
  - Neu `.eintrag-achtung` (+ `-fehlt`/`-befund`-Farbvarianten), absolut positioniert links
    vom Punkt (`right: 24px`, Punkt selbst bei `right: 12px`, 8px breit).
  - `.eintrag-hat-achtung .eintrag-titel::before` erweitert die Zeile-1-Platzreservierung von
    16px auf 34px (Punkt + Ausrufezeichen + Abstand statt nur Punkt).
  - `.spalte-fuss`: `border-top: 1px solid var(--linie)` + `padding-top: 12px` (vorher 0) —
    derselbe Trenner-Stil, den `.spalte-kopf` fuer seine eigene Kante schon benutzt.

## Verify (Browser, 23.09.2026)

- Vor dem Fix: `getComputedStyle(punkt).backgroundColor` = `rgba(0,0,0,0)` (transparent) bei
  `fehlt`-Karten — Ursache bestaetigt, nicht vermutet.
- Nach dem Fix: `backgroundColor` = `rgb(143,127,92)` (gefuellt, `--fehlt`), Ausrufezeichen
  bei `x:209-222`, Punkt bei `x:226-234` — sauber getrennt, Icon links vom Punkt, kein
  Overlap mit dem Titeltext (`.eintrag-hat-achtung` korrekt gesetzt).
- `.spalte-fuss` zeigt `border-top: 1px solid rgb(44,42,38)`, `padding-top: 12px` — Screenshot
  bestaetigt sichtbare Trennlinie ueber "Karte anlegen"/"Idee von der KI".
- Nebenbei: lokaler Dev-Server war zwischenzeitlich nicht erreichbar (Port 4321 down) — mit
  `preview_start "board"` neu gestartet, kein Zusammenhang mit dieser Aenderung.

## Stand

- [x] Bestand geprueft (v56-Glyphe-Logik, tatsaechliche Farbwerte nachgemessen) — 23.09.2026
- [x] Umsetzung
- [x] Verify (Browser: computed styles vor/nach, Screenshot)
- [ ] Commit + Push

## DoD

- Status-Punkt ist bei jedem Status farbig gefuellt sichtbar.
- Ausrufezeichen bei `befund`/`fehlt` steht zusaetzlich links vom Punkt, ersetzt ihn nicht.
- Titelzeile 1 ueberlappt das Ausrufezeichen nicht.
- `.spalte-fuss` hat eine sichtbare Trennlinie zur Kartenliste.
