# v57 — Detailspalte resizable (bis 80vw) + eigener Resize-/Standard-Cursor im Haus-Stil

> Umgesetzt 23.09.2026, nach zwei Rueckfrage-Runden (AskUserQuestion) und expliziter Freigabe.

## PIG

**Problem:** Owner-Auftrag 23.09.2026: die Detailspalte (`.detail`, oeffnet beim Anklicken
einer Karte — jede Karte ist ein Projekt, siehe `lib/projects.js`) hat eine feste Breite
(`style.css:1004` `flex: 0 0 380px`, unter 1100px `320px`). Sie soll in der Breite per Ziehen
veraenderbar sein, mit einem eigenen (Haus-Stil-)Cursor an der Kante. Im selben Zug soll auch
der normale Maus-Cursor im Haus-Stil ausgetauscht werden.

**Bestand (nachgeprueft, nicht geraten):**
- `.detail` ist technisch ein normaler Flex-Sibling (`display:flex` auf `.hauptflaeche`,
  KEIN `position:fixed/absolute`, kein z-index-Overlay) — sitzt rechts neben `.ansicht-board`,
  nicht optisch darueber. Aber: seit v53 sind die Board-Spalten fest 260px breit
  (`flex:0 0 260px`, kein Schrumpfen mehr) — oeffnet die Detailspalte, nimmt sie ihre 380px
  vom sichtbaren Board-Bereich weg, OHNE dass die Spalten kleiner werden; man muss dafuer mehr
  horizontal scrollen. Das duerfte der Effekt sein, den der Owner als "ueberlagern" beschreibt
  — fuehlt sich wie eine Ueberlagerung an, ist technisch aber ein Flex-Breiten-Tausch.
- Kein Resize-Griff, keine eigene Cursor-Datei/-Stil existiert bisher im Projekt (`cursor:`
  nur Standardwerte wie `pointer`/`default`/`grab`/`grabbing`, keine `url()`-Cursor).
- Fokus-Modus (`style.css:2986` `.hauptflaeche.fokus .detail`) macht die Detailspalte bereits
  bis `max-width:760px` breit, `flex:1 1 auto` — ein bestehender Sonderfall, der mit der neuen
  Resize-Funktion kollidieren koennte (zwei Mechanismen, die beide die Detail-Breite steuern).

**Intent (so verstehe ich es — bitte korrigieren):** Die Detailspalte soll sich wie ein
Editor-Seitenpanel verhalten (VS Code/Figma-Stil): Ziehen an der linken Kante veraendert ihre
Breite live, bis maximal 80% der Bildschirmbreite. Die Board-Spalten bleiben dabei komplett
unveraendert (Groesse, Reihenfolge) — nur wie viel vom Board gleichzeitig sichtbar ist bzw. wie
weit horizontal gescrollt werden muss, aendert sich. Zusaetzlich: ein eigener, zum Haus-Stil
passender Cursor (a) beim Hover ueber die Zieh-Kante (Links-Rechts-Pfeil) und (b) als normaler
Maus-Cursor generell im Programm.

## Owner-Antworten (23.09.2026, zwei Runden)

Runde 1 (AskUserQuestion):
1. Mindestbreite beim Ziehen: **380px**, harte Untergrenze (heutige Standardbreite).
2. Persistenz: **merken** (localStorage, wie das Theme).
3. Cursor-Reichweite: **wirklich ueberall, auch der normale Pfeil** — voller Ersatz des
   OS-Cursors im Ruhezustand.
4. Fokus-Modus/Breite: **eine einzige Variable** — der Fokus-Knopf wird ein Shortcut, der
   dieselbe Zieh-Variable auf 80vw setzt, keine zweite parallele Breite mehr. Icon wechselt
   vom Kreis ("ziel") zu einem "von einem Strich aus nach links zeigenden Pfeil".

Runde 2 (Nachfrage zu den anderen zwei Fokus-Effekten — Board ausblenden + zentrieren):
**Fallen komplett weg.** Der Knopf wird ausschliesslich ein Breiten-Shortcut; das Board bleibt
sichtbar/scrollbar im verbleibenden Platz, kein Zentrieren mehr.

Die 1100px-Media-Query (Antwort auf Detailfrage 2, implizit durch "380px Mindestbreite beim
Ziehen" statt "380px immer") bleibt fuer den unberuehrten Fall (nie gezogen) bestehen — erst ein
tatsaechlicher Zieh-/Shortcut-Einsatz ersetzt sie per Inline-Style, das die Media Query dank
hoeherer Spezifitaet ueberschreibt. 80% bezieht sich auf `window.innerWidth` (Detailfrage 3, wie
vorgeschlagen, nicht widersprochen).

## Umsetzung

- **Icon:** `ui.js` — neuer ICONS-Eintrag `maximieren`, exakter Lucide-Pfad "arrow-left-from-
  line" (von der offiziellen Lucide-Quelle geladen, nicht nachgezeichnet/geraten).
- **Breiten-Zustand:** neues Modul `public/detail-breite.js` — `klemme()` haelt Breite zwischen
  380px und `80% von window.innerWidth`; `setzeBreite()`, `istMaximal()`,
  `springeZuMaximum()` (Fokus-Shortcut, merkt sich die Breite von VOR dem Sprung fuers
  Zurueckspringen), `verlasseMaximumFallsAktiv()` (beim Kartenschliessen). Bei Fenster-Resize
  wird neu geklemmt, damit eine gespeicherte Breite nie ueber 80% des JETZIGEN Fensters
  hinaussteht.
- **Zieh-Griff:** `index.html` — `#detail-griff`, eigener Flex-Sibling NEBEN `#detail` (nicht
  darin: `zeichneDetail()` leert `.detail.innerHTML` bei jedem Redraw, ein Kind-Element wuerde
  beim Ziehen mitten im Dragen verschwinden). `app.js` — `verdrahteDetailBreite()` einmalig beim
  Start verdrahtet (wie `verdrahteShutdownSlider`), Griff-`hidden` folgt manuell dem
  `.detail`-hidden-Stand (zeichneDetail kennt den Griff nicht).
- **Fokus-Knopf-Umbau:** `detail.js` — `FOKUS`-Import ersetzt durch `detail-breite.js`; Klick
  ruft `springeZuMaximum()`; Kartenschliessen ruft `verlasseMaximumFallsAktiv()`.
  `public/fokus.js` geloescht (nach Umbau nirgends mehr referenziert, geprueft per grep).
  `style.css` — `.hauptflaeche.fokus`/`.hauptflaeche.fokus .ansicht`/`.hauptflaeche.fokus
  .detail` (Board ausblenden + zentrieren + eigene 760px-Breite) komplett entfernt;
  `hauptflaecheEl`-Variable in `app.js` war danach ungenutzt, ebenfalls entfernt.
- **Cursor:** zwei neue SVG-Dateien im Haus-Stil (harter Versatz-Schatten wie `--schatten`,
  `--linie`-Umriss, `--akzent`-Orange beim Resize-Pfeil) — `cursor-pfeil.svg` (Standard,
  ersetzt den System-Pfeil global via `html{cursor:url(...) 8 6, auto}`, Hotspot nach der
  Nachlese-Neuzeichnung `9 7`) und `cursor-resize.svg` (Links-Rechts-Doppelpfeil auf
  `.detail-griff`, `ew-resize`-Fallback). Vor dem Verdrahten als normale `<img>` in einer
  Test-Seite vergroessert angeschaut (Cursor selbst lassen sich nicht screenshotten) — danach
  geloescht, war nur zur Formkontrolle.

## Verify (Browser, 23.09.2026)

- Ziehen am Griff (Maus-Drag): Breite 380px → 570px live, sofort in `localStorage`
  (`cm-detail-breite`) gespeichert. Board-Spalten waehrenddessen unveraendert 260px, alle acht.
- Untergrenze: Ziehen weit nach rechts klemmt hart bei 380px (nicht darunter).
- Obergrenze: Fokus-Knopf setzt exakt `Math.round(window.innerWidth*0.8)` (gemessen: 819px bei
  1024px Fensterbreite) — Board bleibt sichtbar/scrollbar (kein `display:none` mehr).
  Zweiter Klick springt zurueck auf die Breite von vorher (570px).
  Kartenschliessen bei aktivem Maximum springt ebenfalls zurueck, naechste Karte oeffnet NICHT
  wieder maximiert.
- Cursor korrekt verdrahtet: `getComputedStyle(html).cursor` und `getComputedStyle(griff)
  .cursor` zeigen die eigenen SVGs mit Hotspot-Koordinaten.
- Dunkles Theme: Screenshot ohne Bruch (Griff/Panel/Knopf weiterhin funktional und lesbar).

## Nachlese (23.09.2026): Owner-Feedback nach optischer Abnahme

Resize-Pfeil bestaetigt ("sieht super aus", unveraendert gelassen). Zwei Aenderungen:

1. **Standard-Pfeil war zu eckig** — neu gezeichnet als rundes Tropfen/Pfeil-Hybrid (kubische
   Bezierkurven statt gerader Linien), dazu unser Markengruen `#72ac43` verarbeitet: Umriss in
   Markengruen, Fuellung hell (Lesbarkeit auf jedem Hintergrund), Schatten in einem dunkleren
   Gruenton statt neutralem Dunkelbraun — vorher/nachher visuell an einer vergroesserten
   Testseite geprueft (light+dark Hintergrund), danach geloescht.
2. **Neu: Hand-Cursor beim Karten-Hover** — `.eintrag` (Board-Karte) zeigt jetzt eine
   zeigende Hand statt des System-Pointers. Bewusst der ECHTE Lucide-„pointer"-Pfad (von der
   Original-Quelle geladen, nicht nachgezeichnet — eine Hand-Anatomie freihaendig zu erfinden
   waere riskant), als dicke Strich-Version (Schatten dunkelgruen, Weiss-Halo fuer Kontrast auf
   jedem Hintergrund, Markengruen-Linie obenauf) statt gefuellter Silhouette, weil der Lucide-
   Pfad aus 5 einzelnen Strich-Segmenten besteht (Finger-Trenner etc.), keiner fuellbaren Kontur.
   Bewusst nur auf `.eintrag` beschraenkt (das ist die "Karte" im Owner-Wortlaut) — andere
   `cursor:pointer`-Stellen (Knoepfe etc.) unangetastet, bis explizit gewuenscht.

## Nachlese 2 (23.09.2026): zweiter Owner-Durchgang — komplett neu gezeichnet

Owner-Feedback auf Nachlese 1: Resize-Pfeil weiterhin bestaetigt (nur "bisschen rundere
Ecken"), aber Pfeil UND Hand nochmal neu — diesmal "Apple-like": Markengruen `#72ac43` als
FUELLUNG (nicht als Umriss wie in Nachlese 1), dazu schwarze Umrisse, Schatten, an den
Dimensionen/der Machart des Resize-Pfeils orientiert. Ausserdem: Hand-Cursor soll ÜBERALL
gelten, wo `cursor:pointer` vorkommt — Karten waren nur ein Beispiel, keine Grenze.

- **Quelle diesmal: Phosphor Icons "fill"-Familie** statt Lucide-Strichpfade — `cursor-fill.svg`
  (Pfeil) und `hand-pointing-fill.svg` (Hand), beides GESCHLOSSENE, fuellbare Silhouetten aus
  derselben Icon-Familie (konsistente Rundung/Gewicht zueinander, "Apple-like" von Haus aus).
  Von der offiziellen Quelle geladen (github.com/phosphor-icons/core), nicht nachgezeichnet.
  Damit erledigt sich auch das Lucide-Strich-Problem aus Nachlese 1 (keine 5-Segment-Behelfsloesung
  mehr noetig — die Hand ist jetzt eine echte fuellbare Kontur).
- Farben: Fuellung `#72ac43` (Markengruen), Umriss+Schatten `#141210` (schwarz/nahezu schwarz).
- Resize-Pfeil: Farben/Form unveraendert (Owner: "sehr schoen geworden"), nur `stroke-width`
  1.4→2.6 fuer sichtbar rundere Ecken bei gleicher Silhouette.
- **Reichweite korrigiert:** alle 28 Stellen mit `cursor: pointer;` in `style.css` per
  gezieltem Ersetzen (`sed`, danach mit grep verifiziert — 0 `cursor: pointer;` mehr uebrig,
  28 `cursor-hand.svg`-Treffer) auf den Hand-Cursor umgestellt. Andere, bewusst ANDERE
  Cursor-Zustaende (`grab`/`grabbing`/`progress`/`help`/`default`) unangetastet geprueft.
- Wieder vorab an vergroesserter Testseite visuell geprueft (hell+dunkel), danach geloescht.

## Nachlese 3 (23.09.2026): Breiten-Shortcut-Knopf umplatziert + eigene Icon-Box

Owner: der Maximal-Breite-Knopf soll linksbuendig direkt neben dem Spalten-Titel sitzen (war
per `margin-left:auto` an den rechten Rand gedrueckt, neben dem Schliessen-Knopf), und sein
Icon soll eine farbige Box bekommen "wie ein richtiger Button".

- `style.css`: `margin-left:auto` von `.detail-fokus` entfernt — `.detail-schliessen` traegt
  sein eigenes `margin-left:auto` und bleibt dadurch allein am rechten Rand.
- `detail.js`/`style.css`: `fokusKnopf` bekommt zusaetzlich `knopf-symbol knopf-symbol-
  maximieren` — dieselbe farbige Icon-Kachel-Familie wie Einstellungen-Zahnrad/Redaktionsplan-
  Kalender/KI-Funken/Karte-Plus (`--chrome-c`, Blau, bisher nur am Kopf-Menue-Zahnrad benutzt,
  keine Ueberschneidung mit dem Detail-Panel). Bewusst in diese bestehende Familie eingereiht
  statt einer Einzel-Regel, wie im Code-Kommentar dort dokumentiert vorgesehen.
- Verify: Browser-Screenshot (Knopf jetzt direkt neben "SKRIPT SCHREIBEN", blaue Icon-Box,
  Schliessen-Knopf weiterhin rechts), Klick-Test Maximieren/Zurueck weiterhin funktionsfaehig
  (819px bei 1024px Fenster, wie zuvor).

## Stand

- [x] Bestand geprueft (`.detail`-CSS, Fokus-Modus, fehlende Cursor-Infrastruktur) — 23.09.2026
- [x] Owner-Antworten (zwei AskUserQuestion-Runden)
- [x] Umsetzung
- [x] Verify (Browser: Ziehen, Min/Max, Fokus-Toggle, Theme-Wechsel)
- [x] Commit + Push (eacc394)
- [x] Nachlese: Pfeil rund + Markengruen, Hand-Cursor fuer Karten (b92d517)
- [x] Nachlese 2: Pfeil+Hand komplett neu (Phosphor-Fill), Hand-Cursor ueberall statt nur Karten
- [x] Nachlese 3: Breiten-Shortcut-Knopf linksbuendig + eigene Icon-Box

## DoD

- [x] Detailspalte per Ziehen an der linken Kante in der Breite veraenderbar, 380px–80vw.
- [x] Board-Spalten (Groesse/Reihenfolge) bleiben beim Ziehen unveraendert, nur der Scroll-
      Bereich aendert sich.
- [x] Eigener Resize-Cursor an der Kante im Haus-Stil.
- [x] Normaler Cursor im Haus-Stil, sitzweit (Owner-Entscheidung: wirklich ueberall).
- [x] Fokus-Knopf ist ein reiner Breiten-Shortcut (keine zweite Variable, Board-Ausblenden/
      Zentrieren entfernt), neues Icon.
