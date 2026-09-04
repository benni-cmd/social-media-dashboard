# Work package: v23 — Visueller Umbau (schlicht, simpel, uebersichtlich)

**Problem:** Kopfzeile, Wochenleiste und Drehtermin-Leiste zeigen staendig viel Text und viele
Knoepfe gleichzeitig; die Board-Kachel traegt Untertitel, Kategorie-Marke, Statussatz und
Drive-Fuss-Zeile auf einmal, obwohl die Detailspalte dieselben Infos beim Oeffnen ohnehin zeigt.

**Intent:** Weniger gleichzeitig sichtbare Elemente, mehr Weissraum, kuerzere Klickwege — ohne
Informationsverlust: Seltenes wandert hinter ein Menue, Kachel-Text wandert in die Detailspalte.

**Goal:** Kachel zeigt nur Titel + Plattform-Marken + Status-Punkt. Kopfzeile zeigt nur Ansichten
+ Stand staendig sichtbar, "Mit Drive abgleichen"/"Aktualisieren"/"Einstellungen" hinter einem
Menue-Knopf. Wochenleiste/Drehleiste optisch verdichtet. Sechs-Status-Woerter-System unveraendert
(nur die Kachel-Darstellung wird zum Punkt statt Chip+Satz; Tooltip/aria-label traegt weiterhin
das Wort).

## Plan

- `public/board.js` `kachel()`: Untertitel- und Fuss-Zeile (Drive) von der Kachel entfernen,
  Status-Chip+Satz durch einen farbigen Punkt mit `title`/`aria-label` = Status-Wort ersetzen.
- `public/style.css`: `.eintrag-punkt` (neu, farbig nach Status), `.eintrag` Padding verkleinert;
  `.wochenlast`/`.drehleiste` kompakter (Padding/Font); Kopf-Menue-Dropdown (`.kopf-menu*`).
- `public/index.html`: "Mit Drive abgleichen", "Aktualisieren", "Einstellungen" in ein
  Dropdown-Menue hinter einem Kebab-Knopf verschieben; Ansichten + Stand bleiben direkt sichtbar.
- `public/app.js`: Dropdown-Toggle-Logik (auf/zu, Aussenklick schliesst).
- `public/ui.js`: neues Icon `mehr` (Kebab-Punkte) fuer den Menue-Knopf.
- Detailspalte (`public/detail.js`) zeigt Untertitel (Serie/Episode/Typ unter "Weitere Angaben"),
  Kategorie (im Stamm-Block editierbar), Status+Satz (Termin-Block), Drive-Ordner (Drive-Block)
  bereits vollstaendig — keine Aenderung noetig, nur geprueft.

## Stand

- Umgesetzt (Runde 1): Kachel-Reduktion, Kopf-Menue, Wochenleiste/Drehleiste-Verdichtung.
- Verifiziert: Server gestartet, Screenshots Board/Auswertung/Detailspalte vor und nach dem Umbau.
- Ausgegrenzt aus Zeitgruenden: Auswertung nur leicht verdichtet (Tokensystem unveraendert,
  keine grosse Textkuerzung ueber die Kachel/Kopf/Leisten-Aenderungen hinaus).

### Runde 2 (Owner-Feedback nach dem ersten Durchgang, F1–F5)

- **F1 — Shutdown-Slider verlagert:** `index.html` — der rote "Beenden"-Pill stand ganz links
  vor dem Titel (optisch dominant, seltenste Aktion). Jetzt ans rechte Ende von `.kopf-rechts`
  verschoben, hinter das Kopf-Menue. Titel/Ansichten-Umschalter kommen beim Hinsehen zuerst.
  Screenshot bestaetigt: Board hell + dunkel, "Beenden" jetzt rechts aussen.
- **F2 — Schatten/Radius-Regel:** neue Regel als Kommentar bei den `--rund`/`--schatten`-Tokens
  in `style.css` dokumentiert: Schatten + `--rund` (10px) fuer kompakte Zusammenfassungs-Karten
  auf freier Flaeche (`kpi`, `bester`, `rang`, `letzte-zeile`, `vergleich-karte`, `kanal`,
  `modal`); kein Schatten + `--rund-klein` (7px) fuer Elemente INNERHALB eines bereits
  umrandeten Containers (`.eintrag` in `.spalte`, `.drehkachel` in `.drehleiste`,
  `.termin-kachel`/`.gruppe` in `.detail`); `.spalte` selbst bleibt ohne Schatten (Container,
  keine Karte). Gefundene Abweichung behoben: `.kanal` hatte als einzige Klasse dieser Ebene
  keinen Schatten — jetzt `box-shadow: var(--schatten)` ergaenzt. `.zahl`/`.zahlenreihe` als
  unbenutztes Legacy-CSS kommentiert (auswertung.js nutzt laengst `.kpi`/`.kpi-reihe`) —
  bewusst nicht geloescht, um den Umbau nicht zu vergroessern. Screenshot bestaetigt: die
  Kanaele-Schnappschuss-Karten tragen jetzt denselben Schatten wie Plattform-Vergleich/KPI.
- **F3 — Farb-Check bestaetigt, kein Nachbessern noetig:** per JS-Inspektion geprueft
  (`getComputedStyle(el, '::before').backgroundColor`) — der Kategorie-Farbstreifen
  (`.eintrag[data-saeule=...]`) ist fuer ALLE echten Kategorie-Werte (`bildung`,
  `spendenaufruf`, …) inert: die CSS-Regeln kennen nur die alte Saeulen-Taxonomie
  (`anleitung`/`hardfacts`/…), also faellt der Streifen immer auf `--saeule-ohne` (neutrales
  Grau) zurueck. Auf der Kachel tragen daher effektiv nur zwei Dinge Farbe: Plattform-Marken
  und der Status-Punkt — kein Drei-Wege-Clash. Der inerte Farbstreifen selbst ist totes/
  irrefuehrendes CSS (Taxonomie-Mismatch), aber ausserhalb des heutigen Auftrags — nicht
  angefasst, hier nur vermerkt fuer eine spaetere Aufraeum-Runde.
- **F4 — Spaltenbreite responsiv, Scroll bleibt fuer die volle Pipeline:** `.spalte` von
  starrem `flex: 0 0 272px` auf `flex: 1 1 260px; min-width: 230px; max-width: 320px`
  umgestellt. Bei wenigen Spalten (z. B. 4–5 aktiven Phasen) nutzt das Board die Breite besser
  und braucht seltener Scroll. Bei der vollen 8-Phasen-Pipeline (Idee…Verworfen) bleibt
  Horizontal-Scroll bestehen, auch bei 1440px Fensterbreite — acht Spalten mit lesbarem
  Kacheltext passen nicht in eine typische Fensterbreite, wenn jede Spalte lesbar bleiben soll.
  **Bewusst offen gelassen:** ein vollstaendiger Fix braucht einklappbare/seltene Endspalten
  (z. B. "Fertig" und "Verworfen" default auf Name+Zahl reduziert, aufklappbar per Klick) —
  das aendert die Spalten-Interaktion (Drag&Drop-Ziel bleibt, Klick-Verhalten neu) und war in
  der verfuegbaren Zeit nicht risikoarm umsetzbar. Naechster Schritt fuer eine spaetere Runde.
- Verifiziert (Runde 2): Server neu gestartet, Board hell + dunkel screenshotted, Viewport auf
  1440×900 vergroessert um F4 zu pruefen, Kanaele-Karten-Schatten in der Auswertung geprueft,
  Konsole fehlerfrei.

## DoD

- [x] Kachel zeigt nur Titel + Marken + Punkt.
- [x] Kopfzeile: nur Ansichten + Stand staendig sichtbar, Rest im Menue.
- [x] Wochenleiste/Drehleiste optisch verdichtet.
- [x] Sechs Status-Woerter unveraendert, Punkt hat title/aria-label.
- [x] Shutdown-Slider steht rechts aussen, nicht mehr dominant vor dem Titel.
- [x] Schatten/Radius-Regel dokumentiert und konsequent angewendet (`.kanal` nachgezogen).
- [x] Farb-Clash auf der Kachel geprueft — bestaetigt: kein Clash (Kategorie-Streifen inert).
- [x] Spaltenbreite responsiv statt starr; volle 8-Spalten-Pipeline braucht weiterhin Scroll,
      als bewusst offen dokumentiert (einklappbare Endspalten waere der naechste Schritt).
- [x] Screenshots vorher/nachher gemacht und verglichen (beide Runden, hell + dunkel).
