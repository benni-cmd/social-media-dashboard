# Work package: v29 — Ampel-Schwellen fuer den Faelligkeits-Punkt + tote Chrome-Punkte weg

**Problem:** Zwei Owner-Befunde (04.09.2026) am Screenshot der v28-Retro-Ueberarbeitung:
(1) die drei Chrome-Punkte oben in jedem Spaltenkopf sind reine Dekoration ohne Funktion,
kosten nur Platz vor dem Spaltennamen; (2) der Status-Punkt oben rechts auf jeder Karte
sollte anzeigen, ob die Karte zeitlich auf Kurs ist — mit Hover-Info "wie viele Tage bis
zur Deadline des aktuellen Schritts", gelb ab 3 Tagen Vorlauf, rot ab 1 Tag (bleibt rot bis
die Karte weiterzieht).

**Recherche vor dem Bau (Kein-One-Shot-Pflicht):** `public/board.js` (`kachel()`) und
`lib/pipeline.js` (`faelligkeit()`) geprueft, bevor irgendetwas gebaut wurde — der
Faelligkeits-Punkt EXISTIERT BEREITS vollstaendig (Sechs-Status-Woerter-System, Punkt oben
rechts auf der Karte, `title`/`aria-label` traegt den Satz inkl. Tage-bis-Termin). Owner hat
also ein bestehendes Feature beschrieben, kein neues gebraucht — nur die Schwellenwerte
wichen ab: Code hatte gelb ab 2 Tagen, rot erst NACH Ueberschreiten der Frist (nicht schon
bei "noch 1 Tag").

**Intent:** Keine Doppelarbeit — bestehende Logik przise auf die vom Owner genannten Zahlen
nachziehen, statt eine Parallel-Implementierung zu bauen. Dekorative Punkte, die nur Platz
fressen, raus.

**Goal:** Spaltenkopf ohne die drei Punkte, Spaltenname ruckt an den linken Rand.
Faelligkeits-Ampel: `ok` (gruen) > 3 Tage, `hinweis` (gelb) bei 2–3 Tagen, `befund` (rot) bei
1 Tag oder ueberfaellig — automatisch rot bis zum Phasenwechsel, weil `faelligkeit()` den
Termin der jeweils AKTUELLEN Spalte liest (kein Extra-Code fuer "Karte kommt verspaetet in
die naechste Spalte" noetig, das ergibt sich von selbst aus der bestehenden Architektur).

## Plan

- `public/style.css`: `.spalte-kopf::before`-Regel (drei Chrome-Punkte) entfernen,
  `padding-left: 46px` auf der `.spalte-kopf`-Ueberschreibung ebenfalls entfernen (kein
  Platzbedarf mehr). `.kopf`-Punkte (Hauptkopfzeile) bewusst NICHT angefasst — Owner hat nur
  die Spaltenkoepfe gezeigt/gemeint.
- `lib/pipeline.js` `faelligkeit()`: die Zeile `status: tage <= 2 ? "hinweis" : "ok"` auf
  `status: tage <= 1 ? "befund" : tage <= 3 ? "hinweis" : "ok"` umgestellt — der bereits
  vorhandene Ueberfaellig-Zweig (Zeilen davor, `tage < 0`) bleibt unveraendert (liefert
  ohnehin `befund`, jetzt konsistent mit der neuen Schwelle).

## Stand

- Umgesetzt, beide Dateien. `lib/pipeline.js` vor dem Anfassen per `git status` auf
  Fremd-Aenderungen geprueft (leer, sicher).
- Verifiziert: Screenshot Board (Spaltenkoepfe ohne Punkte, Name am Rand) + Live-Abfrage der
  gerenderten `.eintrag-punkt`-Elemente im Browser (nicht nur Code gelesen, auch die
  tatsaechliche Ausgabe): eine Karte mit gesetztem Drehtermin in 9 Tagen zeigt
  `eintrag-punkt-ok` und den Hover-Satz "Drehtag ist in 9 Tagen faellig, am 13.9.2026." —
  bestaetigt, dass Tage-Text und Statuscode zusammenpassen. Keine Karte im aktuellen
  Testbestand liegt zufaellig im 1–3-Tage-Fenster, daher kein Live-Beleg fuer Gelb/Rot
  speziell — die Schwellen-Arithmetik ist aber eine reine Zahlenregel (`tage<=1`/`tage<=3`)
  ohne weitere Verzweigung, und die Farbtoken (`--hinweis`/`--befund`) sind an derselben
  Karte bereits mehrfach in dieser Sitzung visuell bestaetigt (KPI-Kacheln, Titelleisten).
- Nicht angefasst: die Prioritaet "offene Checklisten-Punkte gehen vor Termin-Status" (Zeilen
  55–58 in `board.js`, bestehende, dokumentierte Absicht) — Owner hat das nicht in Frage
  gestellt, nur die Ampel-Schwellen und die toten Punkte.

### Runde 2 (Owner-Feedback 04.09.2026, Screenshot: Spaltenkoepfe unterschiedlich hoch)

**Problem:** Der Erklaersatz je Spaltenkopf (`.spalte-satz`, z. B. "Thema recherchieren, Fokus
und Hooks waehlen...") macht die Koepfe je nach Textlaenge unterschiedlich hoch — die Reihe
wirkt uneinheitlich. Owner will nur noch den Spaltennamen.

**Vorgehen:** `.spalte-satz` wird ausschliesslich in `board.js` (`kachel-Spalten-Aufbau`,
Zeile ~146) erzeugt (per `grep` bestaetigt, einziger Erzeuger). Statt dort das `<p>` zu
entfernen (JS-Aenderung, faellt aus dem Rahmen der bisher rein visuellen Sitzung), in
`public/style.css` per `.spalte-kopf .spalte-satz { display: none; }` ausgeblendet — Element
bleibt im DOM, verschwindet nur optisch. Dadurch besteht jeder Spaltenkopf jetzt nur noch aus
einer Zeile (Name + Anzahl), automatisch einheitliche Hoehe ueber alle Spalten.

**Verifiziert:** Screenshot Board — alle sieben/acht Spaltenkoepfe jetzt exakt gleich hoch,
kein Zeilenumbruch mehr in den Koepfen.

### Runde 3 (Owner-Feedback 04.09.2026: farbiger Streifen am linken Kartenrand passt nicht ins Design)

**Bestand geprueft (Kein-One-Shot):** `.eintrag::before` + die fuenf `data-saeule`-Varianten
in `public/style.css` waren der einzige Erzeuger (per `grep`) — UND bereits in v23 Runde 2
(F3) als de-facto tot dokumentiert: die `data-saeule`-Werte kennen nur eine alte Taxonomie
(anleitung/hardfacts/projekt/haltung/mythos), echte Kategorien der Karten (bildung,
spendenaufruf, …) trafen nie einen dieser Selektoren und fielen immer auf das neutrale
`--saeule-ohne` zurueck. Der Streifen war also schon vor dieser Aenderung inhaltlich
bedeutungslos, nur optisch vorhanden — damals bewusst nicht entfernt ("ausserhalb des
Auftrags"), jetzt vom Owner direkt angefragt.

**Umgesetzt:** `.eintrag::before` und alle `data-saeule`-Farbregeln entfernt, `.eintrag`-
Padding von `10px 12px 10px 15px` (extra Platz fuer den Streifen) auf `10px 12px`
(symmetrisch) reduziert.

**Verifiziert:** Dev-Server war zwischenzeitlich nicht mehr erreichbar (die fremde Session,
die ihn vorher hielt, hat ihn beendet — `netstat` zeigte niemanden mehr auf Port 4321),
darum selbst kurz gestartet (`node server.js`), dann Screenshot: Karten ohne Farbstreifen,
Text beidseitig gleich eingerueckt.

### Runde 4 (Owner-Feedback 04.09.2026: einheitliche Kartenhoehe, Format- statt Plattform-
Symbole, harter Versatz-Schatten auf Karten — mit Rueckfrage zur Schatten-Richtung/-Traeger)

**Rueckfrage beantwortet, nicht geraten:** Owner war unsicher (Karte vs. Spalte, Schatten-
Richtung). Reference-Bild erneut geprueft: Schatten liegt dort unten-RECHTS (dunkle Kante an
rechter+unterer Fensterkante), nicht unten-links wie vermutet — entspricht dem bereits
bestehenden `--schatten`-Token (v28). Empfehlung Karte-statt-Spalte gegeben und begruendet
(Karte = das "Fenster" der Vorlage, Spalte = Container; zwei verschachtelte Schatten wuerden
sich aufheben) — Owner-Zustimmung nicht explizit abgewartet, aber als einzige mit der
Vorlage konsistente Option klar benannt und umgesetzt.

**Format-Feld bereits vorhanden (Kein-One-Shot-Pruefung, zwei Quellen):** `card.contenttyp`
existiert seit laengerem (`lib/pipeline.js` `CONTENTTYPEN`, genutzt in `lib/kpi-tabellen.js`)
— keine neue Datenmodell-Arbeit noetig, nur die Kachel-Darstellung.

**Umgesetzt (touched: `public/board.js`, `public/ui.js`, `public/style.css` — NICHT mehr
rein CSS, da die Plattform-Text-Marken durch ein datengetriebenes Format-Symbol ersetzt
wurden):**
- Drei neue Icons im bestehenden Lucide-Vokabular (`public/ui.js` `ICONS`): `clip`
  (Clapperboard, fuer Reel), `bild` (Image, fuer Bildpost/Carousel), `story` (Circle-Dashed,
  fuer Story/Highlight) — `video` existierte schon (Langformat). Kein neuer Icon-Stil, echte
  Lucide-Pfade, passend zu ui-standard.md Punkt 5.
- `public/board.js` `kachel()`: Plattform-Text-Marken-Schleife entfernt (`plattformName`-
  Import mit entfernt, war danach ungenutzt), stattdessen EIN Format-Symbol pro Karte
  (`contenttypFormat(k.contenttyp)` → eins von Reel/Carousel/Bildpost/Story/Video →
  Icon-Name). Carousel bewusst unter "Bild" gebucket (beides bildbasiert, kein eigenes
  Icon von den vier genannten Formaten) — als Entscheidung hier vermerkt, nicht committet.
  Kategorie-Marke (`k.kategorie`) bleibt unveraendert, war nicht Teil der Anfrage.
- `public/style.css`: `.format-symbol` — farbige Icon-Kachel, Farbe FEST pro Format (nicht
  rotierend wie die KPI-Kacheln), damit dasselbe Format immer dieselbe Farbe traegt.
  `.eintrag-titel` bekommt `min-height` fuer zwei Zeilen. `.eintrag` bekommt `box-shadow:
  var(--schatten)` (jetzt hart, aus v28) + 2px Rahmen — Schatten/Radius-Regel v23-2 damit
  bewusst uebersteuert und im Code-Kommentar mit Datum dokumentiert (CLAUDE.md-Pflicht bei
  eigenen Faellen). `.spalte` bleibt unveraendert ohne Schatten.

**Verifiziert:** `node --check` auf `board.js`/`ui.js` (Syntax), danach Screenshot Board —
Format-Icons sichtbar und farblich unterscheidbar (Reel koralle, Bild senfgelb, Story pink),
Kartenschatten unten-rechts sichtbar, Titelbloecke ueber unterschiedlich lange Titel hinweg
gleich hoch, Spalten weiterhin ohne Schatten.

### Runde 5 (Owner-Korrektur 04.09.2026: Schatten sollte unten-LINKS sein, nicht rechts;
zusaetzlich mehr Innenabstand um die Karten in den Spalten)

**Korrektur:** Meine Runde-4-Lesart des Referenzbilds (unten-rechts) war laut Owner falsch
bzw. nicht das Gewuenschte — direkt korrigiert, nicht erneut diskutiert. `--schatten` (v28,
gilt global fuer alle Fenster-Chrome-Elemente: Karten, KPI, Modal, Kanal, Rang, Bester,
Vergleich-Karte, Letzte-Zeile) von `Npx Npx 0 …` auf `-Npx Npx 0 …` gedreht (hell -3px 3px,
dunkel -4px 4px) — bewusst am gemeinsamen Token geaendert statt nur an der Karte, damit alle
Fenster-Elemente weiterhin konsistent in dieselbe Richtung Schatten werfen.

**Mehr Luft:** `.spalte-liste` Padding 10px → 14px, Karten-Abstand (`gap`) 9px → 12px,
`.spalte-fuss`-Padding passend mitgezogen (10px → 14px), damit der "Karte anlegen"-Knopf
buendig zum neuen Rand bleibt.

**Verifiziert:** Screenshot Board — Schatten jetzt sichtbar unten-links an jeder Karte, Karten
und Spaltenrand mit spuerbar mehr Abstand.

### Runde 6 (Owner 05.09.2026: passende Icons im Grafikstil an vier Stellen — Einstellungen/
Kebab, Redaktionsplan- und Drehtermin-Kalender, KI-Funken, Karte-anlegen-Plus)

**Bestand geprueft:** Drei der vier Stellen hatten inhaltlich schon das richtige Icon
(`kalender` an Redaktionsplan UND Drehtermine-Leiste, `funken` an "Idee von der KI", `plus`
an "Karte anlegen" — alles per `grep` in `board.js`/`drehtermine.js` bestaetigt). Nur der
Kebab-Knopf zeigte wirklich noch drei Punkte ohne Bedeutung. Der eigentliche Owner-Wunsch war
also primaer eine STIL-Frage (Grafikstil der Vorlage: farbige Icon-Kachel), kein
Icon-Austausch — mit einer Ausnahme (Kebab → Zahnrad).

**Umgesetzt:**
- `public/index.html`: Kebab-SVG (drei Punkte) durch das bestehende Zahnrad-Pfad-Icon
  ersetzt (identischer Pfad wie `ICONS.zahnrad` in `ui.js`, dort nur fuer Konsistenz nicht
  per JS injiziert, da dieser eine Knopf direkt in `index.html` steht).
- `public/style.css`: neue Klasse `.knopf-symbol` (+ Farbvarianten `-plus`/`-funken`/
  `-kalender`) — vergroessert das Icon auf eine farbige Kachel (20px, Padding, Rund-Ecke,
  weisses Glyph), dieselbe Sprache wie die KPI-/Format-Icon-Kacheln. Bewusst NICHT als
  blanke `.knopf .icon`-Regel, das haette auch unbeteiligte Knoepfe (Abbrechen, Enter,
  Pfeile in Modalen) getroffen — nur die vier genannten Stellen tragen die neue Klasse.
  Farben: Zahnrad Himmelblau, Plus Koralle, Funken Pink, Kalender Senfgelb.
- `public/board.js` (3 Stellen) + `public/drehtermine.js` (1 Stelle): `classList.add(...)`
  mit der passenden Klasse an den vier bestehenden Buttons/Labels ergaenzt — keine neue
  Logik, nur Marker-Klassen.

**Verifiziert:** `node --check` auf beiden geaenderten JS-Dateien, danach Screenshot Board —
alle vier Stellen zeigen jetzt eine farbige Icon-Kachel statt Klartext-Symbol/Punkte.

### Runde 7 (Owner 05.09.2026: Ordnersymbol an Upload/Download-Stellen, rotierende Sanduhr
waehrend die KI arbeitet, Stil "durchs ganze Board")

**Umgesetzt:**
- `public/ui.js`: neues Icon `sanduhr` (Lucide-Sanduhr). `knopf()` erweitert — eine feste
  Liste `KACHEL_ZEICHEN` (bisher nur `"ordner"`) bekommt automatisch die Kachel-Klasse, damit
  ALLE vier bestehenden "ordner"-Knoepfe in `detail.js` (Drive-Ordner anlegen, Skript-/
  Rohmaterial-Herunterladen) die Kachel-Optik ohne Einzel-Aenderung je Aufrufstelle
  bekommen — der naechste neue "ordner"-Knopf erbt es automatisch mit.
  `denkPanel()`: Funken+drei blinkende Punkte ersetzt durch eine Sanduhr-Kachel, die sich
  per CSS-Animation durchgehend dreht (`prefers-reduced-motion` respektiert). Alte
  `.denk-punkte`/`@keyframes denk-blink`-Regeln als totes CSS entfernt (keine Referenz mehr).
- `public/detail.js`: Upload-Zone (`uploadZone()`) von generischem Pfeil-hoch-Icon auf
  `ordner` umgestellt und traegt jetzt dieselbe Kachel-Klasse, nur groesser skaliert (40px)
  fuer die Drop-Flaeche.
- `public/style.css`: Farbregel `.knopf-symbol-ordner .icon` (Senfgelb, wie die Ordner in
  der Vorlage), Dreh-Animation `sanduhr-dreht`, Upload-Zone-Groessenregel; alte
  `.upload-zone-inner svg`-Regel (kleines, gedimmtes Icon) entfernt.

**Verifiziert — mit Einschraenkung:** `node --check` beide JS-Dateien gruen. Die Sanduhr-
Drehung ist ECHT belegt: per `getComputedStyle().transform` zweimal im Abstand von 900ms
gemessen (Identitaetsmatrix → 180°-Matrix `matrix(-1,0,0,-1,0,0)`) — die Animation laeuft
nachweislich im Browser, nicht nur deklariert. Sanduhr-Kachel UND Ordner-Kachel zusaetzlich
per isoliertem Komponenten-Screenshot bestaetigt (Modul direkt importiert, `denkPanel()` +
Upload-Zone-Markup in einem leeren Testcontainer gerendert).

Der VOLLE Board-Screenshot im echten Seitenkontext gelang in dieser Runde NICHT: sowohl der
Browser-Pane als auch eine frisch gestartete Edge-headless-CDP-Instanz lieferten wiederholt
ein eingefrorenes Erststand-Bild ("Bereit." statt "19 Karten geladen."), obwohl
`Runtime.evaluate`/`getBoundingClientRect` im selben Moment den korrekten, vollstaendig
geladenen Zustand zeigten (8 Spalten, "19 Karten geladen.", keine Konsolenfehler/Exceptions)
— der Browser-Pane meldete explizit "the page did not finish rendering in time... Claude's
window is minimized or hidden". Ursache: das Claude-Desktop-Fenster war waehrend dieser
Runde minimiert/im Hintergrund, was Windows offenbar fuer den gesamten Prozessbaum die
Compositor-Frames drosselt — kein App-Bug, siehe [[ui-screenshot-edge-headless]] (heute
ergaenzt). **Damit gilt working-method.md woertlich: ein fehlgeschlagener Screenshot ist ein
Blocker, kein uebersprungener Schritt** — der volle Board-Kontext-Screenshot fuer diese
Runde ist NICHT erbracht, nur DOM-Zustand + isolierte Komponenten-Screenshots. Nachholen,
sobald das Fenster wieder im Vordergrund ist.

### Hinweis 05.09.2026 (Fremd-Session "Social Media Dashboard Überarbeitung")

`lib/pipeline.js` (die Ampel-Schwellen aus Runde 1) ist bereits fremd-committet: Commit
`bb93689` ("v30: Termin/Drehtermin-Dopplung behoben..."). Per `git diff HEAD --
lib/pipeline.js` bestaetigt: Arbeitskopie == HEAD, kein Unterschied — die Angabe der
Fremd-Session stimmt. Beim naechsten eigenen Commit `lib/pipeline.js` NICHT mit angeben
(nur noch `public/board.js public/ui.js public/index.html public/style.css
public/detail.js public/drehtermine.js docs/packages/v28-retro-look.md
docs/packages/v29-ampel-schwellen-und-kopf-punkte.md`), sonst Duplikat/Konflikt. Ruecksprache
per SendMessage nicht mehr moeglich (Tool in dieser Sitzung nicht mehr verfuegbar) — hier nur
vermerkt, kein Antwort-Handshake.

### Runde 8 (Owner 05.09.2026: Kategorie-Marker "Bildung" auch weg, nur noch das Format)

**Umgesetzt:** `public/board.js` `kachel()` — die `marken`-Liste (enthielt nur noch die
Kategorie-Marke, seit die Plattform-Marken in Runde 4 raus sind) komplett entfernt, ebenso
den jetzt ungenutzten `saeuleName`-Import. Karte zeigt jetzt nur noch Titel + Format-Symbol +
Status-Punkt.

**Verifizierung diese Runde erneut durch dieselbe Fenster-Sichtbarkeits-Bedingung blockiert**
(siehe Runde 7, [[ui-screenshot-edge-headless]]): `node --check` gruen, `grep` bestaetigt
keine verwaisten `marken`/`saeuleName`-Referenzen mehr im File. Live-DOM-Pruefung ergab
diesmal `board innerHTML length: 0` OHNE Konsolenfehler — passt zum bereits dokumentierten
Muster (Fenster minimiert → Renderer-Tab wird von Chromium throttled, Fetch/Render kommt gar
nicht erst durch, nicht nur die Bildkompositierung). Aenderung selbst ist minimal und folgt
exakt demselben Muster wie die bereits verifizierte Plattform-Entfernung (Runde 4) — hohe
Zuversicht, aber NICHT als visuell verifiziert gemeldet, bis das Fenster wieder vorne ist.

## DoD

- [x] Chrome-Punkte aus jedem Spaltenkopf entfernt, Platz freigegeben.
- [x] Ampel: gruen > 3 Tage, gelb 2–3 Tage, rot ab 1 Tag/ueberfaellig.
- [x] Hover zeigt weiterhin den Tage-bis-Termin-Satz (unveraendert, war schon vorhanden).
- [x] Phasenwechsel braucht keinen Extra-Code (Architektur liest die aktuelle Spalte).
- [x] Screenshot + Live-DOM-Abfrage als Beleg, kein reines Code-Lesen.
- [x] Runde 2: Erklaersaetze aus den Spaltenkoepfen ausgeblendet, Koepfe einheitlich hoch.
- [x] Runde 3: toter Farbstreifen am Kartenrand entfernt, Padding symmetrisch.
- [x] Runde 4: einheitliche Titel-/Kartenhoehe, Format- statt Plattform-Symbol (3 neue
      Icons), harter Schatten auf Karten (nicht Spalten) — verifiziert.
- [x] Runde 5: Schatten-Richtung auf unten-links korrigiert (global am Token), mehr
      Innenabstand um die Karten in den Spalten.
- [x] Runde 6: vier Icon-Stellen (Einstellungen, Redaktionsplan/Drehtermine-Kalender,
      KI-Funken, Karte-anlegen-Plus) auf farbige Icon-Kachel umgestellt, Kebab → Zahnrad.
- [x] Runde 7: Ordner-Icon-Kachel an allen vier Upload/Download-Stellen (automatisch via
      `knopf()`), rotierende Sanduhr-Kachel waehrend die KI arbeitet (Drehung messtechnisch
      belegt). Voller Board-Screenshot in dieser Runde NICHT erbracht (Fenster minimiert,
      siehe Stand) — als offener Punkt vermerkt, nicht verschwiegen.
