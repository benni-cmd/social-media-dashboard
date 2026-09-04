# Work package: v28 — Retro-Y2K-Look (rein visuell)

**Problem:** Das Dashboard traegt ein neutrales, schlichtes SaaS-Design (helle Flaechen,
duenne graue Linien, weicher Schatten). Owner will stattdessen den Look der mitgeschickten
Vorlage: cremefarbene Retro-Fenster mit bunten Titelleisten (Senfgelb/Koralle/Staubblau),
dicke dunkle Outlines, harte Versatz-Schatten (kein Blur), kleine Fenster-Chrome-Punkte.

**Intent:** Nur die Optik aendert sich — Layout, Struktur und Funktionen bleiben exakt wie
sie sind (eine parallele Session arbeitet an der Logik/Struktur, das hier ist ausschliesslich
Farb-/Form-/Icon-Ebene). Owner-Zitat: "das ist mehr logischer Natur, ich will das grafisch...
rein visuell".

**Goal:** Board- und Auswertungs-Ansicht (hell) zeigen den Retro-Look aus der Vorlage:
warme Creme-Basis, dicke dunkle Borders, harte Schatten statt weicher Blur-Schatten,
farbige Titelleisten an Kopfzeile/Spaltenkoepfen/Modalen, retro-eingefaerbte Icon-Kacheln
in der Auswertung. Kein HTML/JS geaendert, keine Funktion veraendert.

## Plan

- `public/style.css` `:root`: Farbpalette auf Retro-Tokens umstellen (`--grund` warmes
  Taupe, `--flaeche`/`-hoch`/`-tief` Cremeabstufungen, `--linie`/`-hell` dunkle Tinte statt
  Grau, `--akzent` Koralle, `--hinweis` Senfgelb, `--unlesbar` Staubblau als dritte
  Chrome-Farbe), `--schatten` von weichem Blur auf harten Versatz (`3px 3px 0 var(--linie)`).
  Dark-Mode-Block bleibt unangetastet (Owner hat nur den Hell-Modus referenziert) — als
  bewusste Luecke im DoD vermerkt.
- Neuer Abschnitt am Dateiende (Muster der bestehenden Datei: bisherige Umbauten haengen
  ebenfalls als eigener Kommentarblock hinten an, keine Umschreibung bestehender Regeln):
  - Border-Breite auf 2px fuer die Karten-Ebene (`.spalte`, `.kpi`, `.modal`, `.kanal`,
    `.rang`, `.bester`, `.vergleich-karte`, `.letzte-zeile`, `.eintrag`, `.drehkachel`).
  - Fenster-Titelleisten-Optik fuer `.kopf` (Hauptkopf), `.spalte-kopf` (Board-Spalten als
    Fenster), `.modal .modal-frage`-Zeile (Dialoge sehen der Vorlage ohnehin am naechsten):
    farbiger Balken + 3 kleine Chrome-Punkte per `::before`/Mehrfach-`box-shadow`
    (KEIN neues HTML-Element, reiner CSS-Pseudo-Trick) — Farbe rotiert zwischen
    Koralle/Senfgelb/Staubblau je Spalten-Index (`:nth-of-type`).
  - `.kpi-icon`, `.kanal-marke`-Umgebung: retro-farbige Kachel-Hintergruende (Koralle/
    Senfgelb/Staubblau im Wechsel) statt neutralem Grau — Lucide-Icons selbst bleiben
    (ui-standard.md Punkt 5 verbietet den Ersatz durch andere Symbolik, nicht die Einfaerbung
    der Kachel).
- Kein Icon-Bibliothekswechsel: Lucide bleibt (ui-standard.md Punkt 5), nur Kachel-Farbe/
  -Rahmen aendert sich — sonst waere das ein Bruch der etablierten Konvention fuer einen
  Auftrag, der ausdruecklich nur "rein visuell" sein soll.

## Stand

Umgesetzt in `public/style.css` (nur diese Datei, kein HTML/JS geaendert):

- `:root`-Tokens auf Retro-Palette umgestellt (Creme-Flaechen, Tinten-Linien, Koralle/
  Senfgelb/Staubblau als Akzent-Trio ueber neue `--chrome-a/-b/-c`-Tokens), `--schatten`
  von weichem Blur auf harten 3px-Versatz.
- Neuer Abschnitt am Dateiende: 2px-Rahmen auf der Karten-Ebene, Fenster-Chrome-Punkte
  (reiner `::before`/`box-shadow`-Trick, kein neues Markup) an `.kopf` und `.spalte-kopf`,
  Spaltenkoepfe rotieren farbig per `:nth-of-type(3n±)`, `.modal`/`.modal-dreh`/
  `.modal-kalender` bekommen einen 6px farbigen Titelbalken, `.kpi-icon` rotiert
  ebenfalls farbig (Lucide-Glyphe selbst unveraendert).
- Verifiziert per echtem Browser-Screenshot (Edge headless/CDP, da der Server dieser
  Session aus einer anderen, bereits beendeten Sitzung lief — Port 4321 gehoerte einer
  fremden Session-Config, direkte HTTP-Verbindung war trotzdem moeglich): Board hell,
  Auswertung hell, `modal-dreh` (Neuer Drehtermin) — alle drei zeigen den Fensterlook
  konsistent (farbige Titelleiste/-balken, Creme-Flaeche, dicke Tinten-Kante, harter
  Schatten auf Knoepfen/Kacheln).
- Keine anderen Dateien angefasst; bestehende unstaged Aenderungen einer anderen, bereits
  beendeten Session (`app.js`, `detail.js`, `index.html`, `board.json`, …) unberuehrt
  gelassen und NICHT mitcommittet — sie gehoeren nicht zu diesem Paket.

### Runde 2 (Owner-Feedback 04.09.2026: "etwas heller und farbenfroher... auch den passenden darkmode")

- Licht-Palette angehoben: `--grund` von dumpfem Taupe (#8c8271) auf helleres warmes
  Sand-Beige (#ddcfa0), `--flaeche` auf helleres Creme (#fdf7e6), Akzente kraeftiger
  gesaettigt (Koralle `#ff6b3d`, Senfgelb `#ffb937`, Himmelblau `#3aa8d8`) plus vierte
  Chrome-Farbe `--chrome-d` (Pink `#ff7fb0`) — Spaltenkoepfe und KPI-Kacheln rotieren
  jetzt 4-farbig (`:nth-of-type(4n±)`) statt 3-farbig, dadurch bunter/abwechslungsreicher.
  `--schatten` von `var(--linie)` auf festes `rgba(51,41,28,.9)` entkoppelt (Vorbereitung
  fuer den Dark Mode, siehe unten).
- Dark Mode NEU gebaut (`[data-theme="dark"]`): keine Fortfuehrung des alten neutralen
  Blaugrau-Darkmodes, sondern dieselbe warme Tinte-auf-Creme-Logik invertiert — dunkles
  Kakaobraun (`--grund #120e0a`, `--flaeche #2a2116`) statt Schwarz, cremefarbener Text,
  dieselben vier Chrome-Farben nur heller gezogen fuer Kontrast (`#ff8256`/`#ffc857`/
  `#55bbea`/`#ff96c2`), `--linie` auf warmes Tan (`#b39b68`) statt dunkler Linie (auf
  dunklem Grund muss die Kante heller als die Flaeche sein), eigener dunkler Hart-Schatten
  `rgba(0,0,0,.6)`.
- Verifiziert per Screenshot (Board + Auswertung, hell UND dunkel — Theme-Wechsel per
  `document.documentElement.setAttribute('data-theme','dark')` im CDP-Treiber ausgeloest,
  kein UI-Klick noetig da `app.js` das Attribut direkt liest): beide Modi zeigen konsistent
  bunte Titelleisten/Icon-Kacheln, dicke Kante, harten Schatten.

### Runde 3 (Owner-Feedback 04.09.2026: Grundflaeche hell zu dunkel/"beengend", Dark-Outline-Farbton "komisch", nochmal genau gegen die Vorlage schauen)

- **Zwischenfall:** Waehrend dieser Sitzung hat eine andere, parallel arbeitende Session
  (P27 "Fokus und Informationsdichte") `public/style.css` ueberschrieben — die komplette
  Runde-1/2-Arbeit war aus der Arbeitskopie verschwunden (kein Commit, kein Stash betroffen,
  reines Arbeitskopie-Ereignis). Kein Datenverlust, da der volle Aenderungstext aus dem
  Sitzungsverlauf rekonstruierbar war — auf dem NEUEN Dateistand (inkl. der P27-Ergaenzungen
  am Dateiende) neu aufgesetzt, ohne die fremde Arbeit zu beruehren.
- `--grund` (Licht) nochmal von #ddcfa0 auf #f2e9d0 aufgehellt — die Fenster-Flaechen
  (`--flaeche` #fdf7e6) heben sich jetzt wieder klar vom Canvas ab, ohne dass der Canvas
  selbst schwer/dunkel wirkt.
- Dark-Mode `--linie` von khakifarbenem Tan (#b39b68, wirkte oliv-/gruenstichig neben den
  bunten Chrome-Farben) auf waermeres Karamellgold (#caa06a) gewechselt — naeher an
  `--chrome-b`, kein Farbclash mehr mit Koralle/Pink.
- Vorlage nochmal im Detail abgeglichen (nicht nur Farben, auch Fenster-Konstruktion):
  - `.modal-frage` ist jetzt eine ECHTE volle Titelleiste (blutet ueber das Modal-Padding
    bis an den Rand, `overflow:hidden` am Modal haelt die runden Ecken sauber) — vorher nur
    ein 6px-Farbbalken als Andeutung, jetzt wie die Error/Login/Information-Fenster der
    Vorlage. Dekoratives helles Quadrat oben rechts nimmt die Position der "X"-Schliessen-
    Flaeche der Vorlage auf (rein optisch, kein neuer Klick-Handler — ein echtes X waere
    eine funktionale Faehigkeits-Aenderung und damit ausserhalb des "rein visuell"-Auftrags).
  - Chrome-Punkte von leicht abgerundeten Quadraten auf echte Kreise (`border-radius:50%`)
    gewechselt — naeher an der Vorlage.
  - Kanten der Karten-Ebene von 2px auf 3px verstaerkt (Vorlage wirkt kraeftiger/illustrierter
    als ein duenner 2px-Strich), `--schatten` von 3px auf 4px Versatz.
  - `.fortschritt-balken` (Ladebalken) traegt jetzt ein diagonales Streifenmuster, angelehnt
    an den "Downloading..."-Balken der Vorlage.
- Verifiziert per Screenshot: Board hell (neue Grundflaeche + 4er-Rotation), Modal hell
  (echte Titelleiste), Board dunkel (neuer Outline-Ton).

### Runde 4 (Owner-Feedback 04.09.2026: Ergebnis "sehr braunlastig", stattdessen grauer
Office-Look mit farbigen Akzenten/Symbolen — Alternativen vorschlagen VOR der Umsetzung)

- Vor der Umsetzung drei Grundton-Alternativen als Vergleichsseite gebaut und dem Owner
  vorgelegt (`docs/packages/assets/grundton-varianten.html`, als Artifact geteilt):
  1. Kuehles Studio-Grau, 2. Warmes Papier-Grau, 3. Mittelgrau mit farbigem Kartenrahmen —
     alle drei mit unveraenderten Akzentfarben (Koralle/Senfgelb/Himmelblau/Pink) und
     demselben Fenster-Vokabular (Titelleiste, Chrome-Punkte, Icon-Kacheln), nur die
     Grundflaeche/Rahmenlogik unterscheidet sich.
  - Owner-Wahl: **Option 2 — Warmes Papier-Grau**.
- In `public/style.css` umgesetzt, Licht UND Dunkel (Owner-Zitat galt ausdruecklich fuer
  "alte Menues und Hintergrund", also beide Modi):
  - Licht: `--grund` #f2e9d0 (Creme) → #eae9e5 (warmes Grau), `--flaeche` #fdf7e6 → #fbfaf8,
    `--linie` #33291c → #2c2a26 (neutraleres warmes Ink-Schwarz statt Braun-Ton).
  - Dunkel: komplette Umstellung von Kakaobraun (`--grund` #120e0a, `--flaeche` #2a2116)
    auf neutrales dunkles Graphit (`--grund` #171613, `--flaeche` #201f1b), `--linie` von
    Karamellgold #caa06a (Runde-3-Fix, aber immer noch aus der Braunfamilie) auf neutrales
    Warmgrau #6e6a5c.
  - Chrome-Akzentfarben (Koralle/Senfgelb/Himmelblau/Pink) in beiden Modi unveraendert.
- Verifiziert per Screenshot: Board hell, Board dunkel, Auswertung hell — Grundflaeche
  jetzt durchgehend grau statt braun, Akzente/Icon-Kacheln weiterhin lebhaft farbig.

## DoD

- [x] `:root`-Palette auf Retro-Tokens umgestellt, `--schatten` hart statt weich.
- [x] Karten-Ebene 2px Border.
- [x] Kopf/Spaltenkoepfe/Modal tragen Titelleisten-Optik (Farbe + Chrome-Punkte).
- [x] Icon-Kacheln (KPI) retro eingefaerbt, Lucide-Icons unveraendert. (Kanal-Marken
      bewusst NICHT umgefaerbt — deren Farbe kodiert die Plattform, nicht Dekoration.)
- [x] Screenshot Board + Auswertung + ein Modal (hell) gegen die Vorlage geprueft.
- [x] Runde 2: Licht-Palette heller + 4-farbig statt 3-farbig (Owner-Feedback).
- [x] Runde 2: Dark Mode als eigenstaendige Retro-Variante gebaut und per Screenshot
      (Board + Auswertung) verifiziert.
- [x] Runde 3: Grundflaeche hell nochmal aufgehellt, Dark-Outline-Farbton korrigiert,
      Modal-Titelleiste echt (volle Bar statt Balken), Chrome-Punkte rund, Kanten/Schatten
      kraeftiger, gestreifter Ladebalken — gegen die Vorlage nachgeschaerft und verifiziert.
- [x] Runde 4: Grauer Office-Grundton statt Braun/Creme, in Licht UND Dunkel — drei
      Alternativen vorgeschlagen (Artifact), Owner-Wahl (Option 2) umgesetzt und verifiziert.
- [ ] Nicht committet (siehe Stand) — Owner/naechste Sitzung entscheidet ueber den Commit,
      da die Datei parallel unstaged Fremdaenderungen traegt.
