# v77 — Detailspalte: einheitliches Design, Board-Look, Mehrspaltigkeit

> 28.09.2026. Gebaut und im Browser geprueft.

## PIG

**Problem:** Die Detailspalte einer Karte hatte kein einheitliches Vokabular fuer Abstaende,
wich optisch vom Board ab, blieb bei jeder Breite einspaltig, und enthielt tote Codepfade sowie
mehrfach parallel nachgebaute Bausteine (v. a. die Pillen-Auswahl viermal unabhaengig).

**Intent:** Ein sauberer, konsistenter Stand, der den gezogenen Platz nutzt und sich wie
derselbe "Fenster"-Baukasten wie das Board anfuehlt.

**Goal:** Farbige, board-artige Abschnitts-Koepfe; feste Abstands-Skala; Mehrspaltigkeit bei
Breite; verlaesslich haltendes Auf-/Zuklappen; toter Code entfernt; Pillen-Bausteine vereint.

## Bestand

Vollstaendiger Bestandsbericht als Agenten-Recherche vor dem Bau (Bloecke, Feld-Muster,
Knopf-Dopplungen, Breiten-/Responsive-Verhalten, Vergleich mit dem Board, weitere
Inkonsistenzen) — siehe Session-Protokoll 28.09.2026. Kernbefunde: `blockTore()` und `auswahl()`
tot; Pillen-Optik 4x parallel nachgebaut; Auf-/Zuklappen haelt nicht ueber einen Redraw;
undefinierte CSS-Variable `--rand`; drei fast wortgleiche "Upload-Datum aendern"-Bloecke;
verschachtelte gleich-schwere `.gruppe`-Rahmen im Archiv-Block; Spalte bleibt bei jeder Breite
einspaltig.

## Owner-Antworten (28.09.2026)

1. Optik: **staerker an den Board-Look angleichen** — farbige Kopfleisten (rotierend durch die
   vier Chrome-Farben), Rand/Radius/Schatten wie `.eintrag`.
2. Breite: **mehrspaltig ab genug Platz**.
3. Toter Code (`blockTore`, `auswahl()`): **beide entfernen**.
4. Auf-/Zuklappen: **im selben Aufwasch mitfixen** (Zustand soll ueber Redraws halten).
5. Pillen-Muster (4x parallel): **auf eine gemeinsame Basis ziehen**.

## Umsetzung

- **`public/ui.js`**: `gruppe()`/`klappe()` (in detail.js) bekommen `onToggle` — der Aufrufer
  merkt den Auf/Zu-Zustand je Karte+Abschnitt (`klappZustand`-Map in detail.js), sonst faellt
  jeder Abschnitt beim naechsten Redraw auf seinen Default zurueck. Neue Bausteine `pille()`
  (intern), `pillenReihe()` (ein gemeinsamer Wert: Single-Select mit Klick-zum-Abwaehlen ODER
  Mehrfachauswahl) und `pillenSchalter()` (mehrere UNABHAENGIGE Booleans) ersetzen vier eigene
  Nachbauten in detail.js. `auswahl()` entfernt (nirgends verwendet).
- **`public/detail.js`**: `einzelwahlReihe`/Plattform-Block/`floatSchalter`/`schalterFeld` sind
  jetzt duenne Fassaden auf `pillenReihe`/`pillenSchalter`. `blockTore()` entfernt. Drei
  identische "Upload-Datum aendern"-Bloecke zu `uploadDatumCallback()`/`bearbeitenUploadKnopf()`
  zusammengezogen. Archiv-Eintraege nutzen jetzt `klappe()` (leichter Unterblock) statt einer
  zweiten vollgewichtigen `.gruppe` ineinander. Jeder Top-Level-Abschnitt traegt eine FESTE
  Farb-Zuordnung nach Bedeutung (`ABSCHNITT_FARBE`, `gruppeMitFarbe()`) — nicht nach DOM-Position
  gezaehlt, weil nicht jeder Abschnitt bei jeder Karte erscheint (anders als bei `.spalte`, die
  immer da ist). Zwei doppelte `zeichen:`-Objektschluessel bereinigt (Drive-Knoepfe). Inline-
  Styles (`marginBottom`/`marginTop`) durch echte CSS-Klassen (`.dreh-wahl`, `.dreh-neu`) ersetzt.
- **`public/style.css`**: neue Abstands-Skala `--sp-1/2/3` (6/10/14px), angewandt auf `.feld`,
  `.feld-reihe`, `.gruppe`-Innenabstand, `.phasen-arbeit`, `.dreh-wahl`. `.gruppe` traegt jetzt
  Rand 2px/Radius `var(--rund)`/Schatten wie `.eintrag`, `overflow:hidden` schneidet den Kopf auf
  die runden Ecken zu (wie `.spalte`/`.spalte-kopf`). Vier `.gruppe-c1..c4`-Farbklassen (Kopf,
  Titel, Anzahl-Badge, Klapp-Pfeil in Weiss). `.unterklappe` bleibt bewusst leichter (duenner
  Rand, gestrichelt, kein Schatten) — sonst zwei gleich schwere Rahmen ineinander. `.detail-koerper`
  von Flex-Spalte auf natives CSS-Mehrspalten-Layout (`column-width:340px`) umgestellt —
  Abschnitte verteilen sich ab genug Breite von selbst auf mehrere Spalten, der Abschluss-Block
  (Weiter/Loeschen) spannt bewusst ueber alle Spalten (`column-span:all`, letztes Kind). `.wahl`
  (Fokus/Hook/Caption-Auswahlkarten) von Flex-Spalte auf CSS-Grid `auto-fit/minmax(220px,1fr)`
  — ordnet sich bei ausreichend Breite von selbst nebeneinander an. Getippter Bug `var(--rand)`
  (nie definierte Variable) zu `var(--linie)` korrigiert.

## Verify (Browser, 28.09.2026)

- Farbige Koepfe sichtbar (4 Farben, Stamm/Termin/Drehtermin/Phase/Drive je fest zugeordnet),
  Klapp-Pfeil bleibt gegen die Farbe lesbar, Light UND Dark Mode geprueft.
- Detailspalte auf 900px gezogen: `.detail-koerper` bildet 2 Spalten, jeder Abschnitt bleibt ganz
  in einer Spalte, der Abschluss-Block spannt ueber beide — Screenshot bestaetigt sauberes Layout
  ohne Ueberlappung.
- Auf-/Zuklapp-Test: "Google Drive" per Klick geoeffnet, danach eine Plattform umgeschaltet
  (loest `zeichne()`/kompletten Redraw aus) — der Abschnitt blieb offen (vorher: klappte wieder
  zu). `node --check` auf allen vier geaenderten JS-Dateien ohne Fehler; keine Konsolenfehler
  beim Durchklicken mehrerer Karten in unterschiedlichen Phasen (Idee bis Videodreh).

## Stand

- [x] Bestand (Agenten-Recherche), Owner-Antworten, Bau, Verify
- OFFEN: die drei Klick-Interaktionen von `pillenReihe`/`pillenSchalter` nur ueber die schon
  bestehenden Aufrufer (Typ/Kategorie/Ziel/Plattformen/Drehtermin-Schalter/Video-Eigenschaften)
  gegengeprueft, nicht als isolierte Unit-Tests; `.wahl`-Grid bei SEHR breiter Spalte (>1000px,
  >2 Detail-Koerper-Spalten) faellt pro Spalte wieder auf 1 Karte pro Zeile zurueck (kein Bug,
  aber nicht perfekt monoton) — im Test bei 900px nicht relevant geworden.

## Nachtrag v78 — Kopf brach bei Mindestbreite um (28.09.2026)

**Problem:** Bei 380px (bisherige Mindestbreite) brach der Spaltenname im Kopf mitten im Wort um
("SKRIPT" / "SCHREIBEN" auf zwei Zeilen), sobald der Drive-Knopf und der Befund-Indikator
dazukamen — der Kopf wurde dadurch hoeher, was "sehr verwirrend fuers Auge" ist (Owner).

**Fix:** `.detail-phase` bricht nicht mehr um (`white-space:nowrap`). Die Mindestbreite der
Detailspalte (`detail-breite.js`, `MIN`) ist von 380 auf **460px** angehoben — nachgemessen im
Browser: der laengste Spaltenname ("Drehtermin festlegen") passt mit Drive-Knopf und
Befund-Indikator ab 444px in eine Zeile, 460 mit etwas Luft fuer z. B. einen zweistelligen
Befund-Zaehler.

**Verify:** Detailspalte auf ihre neue Default-/Mindestbreite (460px) gesetzt, Karte im Schritt
"Drehtermin festlegen" (laengster Name) geoeffnet — Kopf bleibt einzeilig, Screenshot bestaetigt.
