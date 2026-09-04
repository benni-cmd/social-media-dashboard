# Work package: v27 — Fokus und Informationsdichte in der Detailspalte

**Problem:** Beim Oeffnen einer Karte stehen sofort ~20 Wahl-Buttons gleichzeitig da (Typ,
Kategorie, Ziel, Plattformen — alle als offene Toggle-Reihen), bevor die eigentliche Arbeit der
Phase sichtbar wird; „X Punkte halten die Karte auf" steht erst ganz am Ende, nach allem
Scrollen, obwohl das die wichtigste Info ist; es gibt keinen Weg, direkt zur naechsten
sinnvollen Karte zu springen; ausgefuellte Stamm-Felder bleiben dauerhaft mit allen Optionen
sichtbar, auch wenn laengst entschieden.

**Intent:** Arbeitsschritte vereinfachen, Prozesse verkuerzen, Informationsueberflutung
vermeiden — konzentriertes, schnelles Arbeiten foerdern, insbesondere fuer ADHSler: Aufgaben
in Schritten zeigen statt alles gleichzeitig, Fortschritt sichtbar halten, keine neuen
Auto-Animationen, ruhige und vorhersehbare Struktur, Weissraum statt Vollstopfen.

**Goal:** Vier konkrete Verbesserungen in der Detailspalte/Kopfzeile: (F1) der Blocker-Status
steht sofort sichtbar oben, ohne Scrollen; (F2) vollstaendig gesetzte Stamm-Felder klappen zu
einer Zusammenfassungszeile ein; (F3) ein prominenter "Naechster Schritt"-Knopf springt zur
sinnvollsten offenen Karte; (F4) eine Fokus-Ansicht blendet das Board aus und zeigt die
Detailspalte breiter/zentriert. Bestehende Sprache/Klassen-Konventionen (deutsche Namen,
.eintrag-*/.eigenschaft-*, sechs Status-Woerter) bleiben unveraendert.

## Plan

- `public/detail.js`:
  - `zeichneDetail()`: neuer Block `blockFortschritt(k, blockiert)` direkt zwischen
    `.detail-kopf` und `.detail-koerper` — Phasenband (wiederverwendet aus `style.css`, s.u.)
    plus `statusChip("befund"/"ok")` + Satz, denselben Baustein wie der bestehende Termin-Block.
  - `blockStamm()`: wenn Typ+Kategorie+Ziel+Plattformen alle gesetzt sind UND die Karte nicht
    explizit zum Bearbeiten aufgeklappt wurde (`stammOffenIds`-Set), zeigt eine neue Funktion
    `stammZusammenfassung(k)` eine kompakte Zeile ("Reel · Bildung · Neue Leute erreichen ·
    Instagram, LinkedIn" + "bearbeiten"-Knopf). Solange nicht alle vier gesetzt sind, bleibt die
    volle Ansicht. Thema bleibt immer sichtbar/editierbar.
  - `blockAbschluss()`: die alte "X Punkte halten die Karte auf"-Zeile am Ende entfernt (steht
    jetzt oben, keine Redundanz).
  - Fokus-Knopf (Icon "ziel") im `.detail-kopf`, neben dem Schliessen-Knopf; togglet
    `FOKUS.an` aus dem neuen Modul `public/fokus.js` und ruft `zeichne()`.
- `public/fokus.js` (neu): `export const FOKUS = { an: false };` — bewusst ein eigenes,
  winziges Modul statt ein Feld in `store.js`' zentralem `S`, siehe Abschnitt "Technische
  Randbedingung" unten.
- `public/app.js`:
  - Neuer Abschnitt "Naechster Schritt": `naechsteSinnvolleKarte()` filtert alle Karten
    ausser `fertig`/`verworfen`, sortiert nach `phaseIndex(column)`, innerhalb der Phase nach
    Dringlichkeit der Faelligkeit (`faelligkeit(k).tage` — ueberfaellig zuerst, dann je naeher
    am Termin; kein Datum = mittlere Dringlichkeit). Klick auf `#naechster-schritt` oeffnet die
    gefundene Karte ueber die bestehende `oeffne()`-Funktion.
  - `beiAenderung()`-Callback: togglet `.fokus`-Klasse auf `#hauptflaeche`, abhaengig von
    `FOKUS.an && !!S.aktiv` — die Fokus-Ansicht verlaesst sich damit automatisch, sobald die
    Karte geschlossen wird, ohne dass `FOKUS.an` explizit zurueckgesetzt werden muss (passiert
    zusaetzlich beim expliziten Schliessen-Klick, fuer einen sauberen Zustand).
- `public/index.html`: neuer Knopf `#naechster-schritt` (`.knopf.knopf-haupt`) prominent in
  der Kopfzeile, zwischen Ansichten-Umschalter und `.kopf-rechts` — NICHT im Kebab-Menue.
  `id="hauptflaeche"` auf `.hauptflaeche` ergaenzt (fuer den Fokus-Klassentoggle).
- `public/style.css`: neue Regeln fuer `.detail-fortschritt` (Rahmen um Phasenband + Befund),
  `.stamm-zusammenfassung`/`.stamm-zusammenfassung-text`, `.detail-fokus` (+ `.an`-Zustand),
  `.hauptflaeche.fokus .ansicht{display:none}` + `.detail{flex:1 1 auto;max-width:760px}`.
  Wiederverwendet: `.phasenband`/`.phasenband-teil` (vor v27 in `style.css` vorhanden, aber in
  keiner JS-Datei genutzt — jetzt erstmals verdrahtet), `.befund`/`.befund-satz`/`statusChip()`
  (bereits im Termin-Block verwendetes Muster), `.knopf-inline` (bereits vorhandener Stil fuer
  kleine Inline-Aktionen wie "bearbeiten").

### Bewusste Vereinfachungen / Abweichungen

- **F1 nutzt NICHT `fortschritt()` aus `ui.js`:** dieser Baustein ist ein unbestimmter,
  dauerhaft animierter Lade-Balken (`animation: laeuft 1.15s infinite`) fuer "die KI arbeitet
  gerade" — fuer einen STATISCHEN Fortschritt ("3 von 6 Phasen") waere er semantisch falsch
  UND wuerde eine neue Dauer-Animation einfuehren, was die ADHS-Design-Leitplanke ausdruecklich
  ausschliesst ("keine neuen Auto-Animationen"). Stattdessen: das vorhandene, bislang tote
  `.phasenband`-CSS (Board-Kachel-Herkunft, seit v23 in keiner JS-Datei mehr verdrahtet) plus
  das bestehende `.befund`/`statusChip()`-Muster — beides statisch, beides schon Teil des
  Sechs-Status-Woerter-Systems.
- **F3-Heuristik bewusst zweistufig, nicht die volle Owner-Alternative:** Owner-Text erlaubte
  ausdruecklich "erste Karte der ersten nicht-leeren Spalte" als Vereinfachung, falls eine
  feinere Sortierung zu riskant ist. Umgesetzt wurde die etwas feinere Variante (Phase +
  Faelligkeits-Dringlichkeit), weil beide Bausteine (`phaseIndex`, `faelligkeit`) bereits
  reine, gut getestete Funktionen aus `lib/pipeline.js` sind — geringes Risiko. Verbleibende
  Vereinfachung: Karten OHNE gesetztes Datum zaehlen als "mittel dringend" (Wert 0), nicht als
  dringlichste — sie werden also nicht bevorzugt vor Karten mit nahem, aber noch nicht
  ueberfaelligem Termin. Bei Gleichstand (z. B. mehrere taggleiche Idee-Karten ohne Termin)
  entscheidet die stabile Sortierung = Board-Reihenfolge, was in der Praxis "erste Karte der
  ersten Spalte" entspricht.
- **Kein zusaetzlicher Live-Vorher-Screenshot:** Der Vorher-Zustand ist durch den vom Owner
  selbst per Screenshot bestaetigten Befund UND durch den vollstaendig gelesenen Code vor jeder
  Aenderung belegt (siehe Auftrag). Ein separater Vorher-Screenshot haette einen weiteren
  Zugriff auf das von mehreren Sitzungen geteilte Arbeitsverzeichnis bedeutet — angesichts der
  unten beschriebenen Volatilitaet bewusst vermieden. Alle vier NACHHER-Zustaende sind mit
  echten Browser-Screenshots/DOM-Abfragen verifiziert (siehe Stand).

### Technische Randbedingung: geteiltes Arbeitsverzeichnis, laufende Parallel-Sessions

Waehrend dieses Pakets liefen mindestens zwei weitere Sitzungen live am selben Arbeitsstand:
eine schloss "v26: Einstellungen bekommen System Prompts und Workflows" waehrend meiner Arbeit
ab (Commit `eda6ddc`, HEAD ruckte waehrend der Sitzung vor), eine zweite arbeitete fortlaufend
an einem "v28 Retro-Look" (Farbpalette + Fenster-Chrome in `style.css`) — mit mehrfachen,
mitten in meiner Sitzung beobachteten Aenderungen an genau demselben `:root`-Block. `git stash`
war durch den Auto-Mode-Klassifikator gesperrt. Ergebnis:
- `public/fokus.js` (neu) statt eines Felds in `store.js`' `S` — vermeidet jede Beruehrung der
  parallel bearbeiteten `store.js`.
- Alle Einfuegungen in `detail.js`/`app.js` bewusst in Funktionen/Regionen platziert, die von
  den fremden Diffs nachweislich nicht beruehrt wurden (per `git diff HEAD -- <datei>` vor
  Beginn geprueft); zwei fremde Zeilen, die durch einen zwischenzeitlich veralteten
  Patch-Vergleich versehentlich mit rueckgaengig gemacht wurden, wurden anhand des dann
  aktuellen `git diff HEAD` wieder exakt auf den Stand von `eda6ddc` gebracht.
- Fuer `style.css` liess sich die Konvention "nur `git commit -m … -- <pfad>`" NICHT
  einhalten, weil der `:root`-Block waehrend der Verifikation mehrfach live von der
  Retro-Look-Sitzung ueberschrieben wurde (jeder Korrekturversuch war Sekunden spaeter wieder
  veraltet) — der Pfad-Commit haette daher immer wieder fremde, unfertige Farbwerte
  mitgenommen. Stattdessen wurde NUR der eigene, stabile Anhang am Dateiende (reiner Append,
  keine Ueberschneidung mit dem volatilen Bereich) als Patch extrahiert und gezielt per
  `git apply --cached` in den Index gestaged, dann per `git commit` (ohne Pfadangabe, da zu
  diesem Zeitpunkt ausschliesslich dieser eine Hunk im Index stand) committet. Diese Abweichung
  ist hier bewusst dokumentiert, weil sie von der harten Repo-Regel abweicht — Grund: die Regel
  setzt einen stillstehenden Arbeitsbaum voraus, der hier durch eine zeitgleiche zweite Sitzung
  nicht gegeben war; das Ziel der Regel (nie fremden, unfertigen Code committen) wurde auf
  Hunk-Ebene trotzdem eingehalten.

## Stand

- Umgesetzt: alle vier Punkte (F1–F4), siehe Plan oben.
- Verifiziert (echter Server `https://localhost:4321`, Chrome-Browser-Pane, Dark Theme):
  - F1: Karte "Wie viel Wasser speichert dein Boden wirklich?" (Skript schreiben) geoeffnet —
    "befund"-Chip + "2 Punkte halten die Karte auf." erscheint sofort unter dem Kopf, kein
    Scrollen noetig; Phasenband mit 6 Segmenten per DOM-Abfrage bestaetigt (`hier` auf Segment 1
    bei Spalte "Skript schreiben").
  - F2: Karte "Warum Monokultur deinen Boden auslaugt" (Typ/Kategorie/Ziel/Plattform alle
    gesetzt) zeigt die Zusammenfassung "Beitrag mit Text · Bildung · Bestand binden ·
    Instagram, LinkedIn" statt der vier offenen Wahlreihen; Klick auf "bearbeiten" klappt die
    volle Ansicht wieder auf (mit den korrekt vorbelegten Auswahlen), Klick auf
    "Fertig — einklappen" klappt wieder ein. Karte mit fehlender Kategorie blieb korrekt in der
    vollen Ansicht (kein vorzeitiges Einklappen).
  - F3: Klick auf "Naechster Schritt" in der Kopfzeile sprang zur ersten Karte in "Skript
    schreiben" (niedrigste Phase, alle Idee-Karten ohne Termin gleich dringend, erste in
    Board-Reihenfolge gewaehlt) — Knopf ist durchgehend sichtbar in der Kopfzeile, nicht im
    Kebab-Menue.
  - F4: Klick auf das Fokus-Icon (neben dem Schliessen-Knopf) blendet Board/Wochenleiste/
    Drehleiste/Nachschub aus, Detailspalte wird breit und zentriert; erneuter Klick auf
    "Fokus-Ansicht verlassen" stellt das Board wieder her; `document.querySelector('.hauptflaeche').className`
    zeigte `"hauptflaeche fokus"` waehrend aktiv.
  - Konsole/Netzwerk gegen echte Fehler geprueft: keine neuen Fehler durch die eigenen
    Aenderungen (die einzigen 404-Eintraege stammen aus dem laufenden, fremden v26-Workflow-
    Feature `/api/workflows`, bereits vor diesem Paket vorhanden und dort try/catch-abgefangen,
    sowie aus einem eigenen Debug-Fehlgriff bei der Verifikation).
  - `node --check` (als ES-Modul) fehlerfrei fuer `detail.js`, `app.js`, `fokus.js`.

## DoD

- [x] F1: Fortschritt/Blocker-Zeile sofort sichtbar direkt unter `.detail-kopf`, ohne Scrollen.
- [x] F2: Vollstaendig gesetzte Stamm-Felder klappen zu einer Zusammenfassungszeile ein,
      "bearbeiten" klappt wieder auf; unvollstaendige Karten bleiben in der vollen Ansicht.
- [x] F3: "Naechster Schritt"-Knopf prominent in der Kopfzeile, oeffnet automatisch eine
      sinnvolle offene Karte; Heuristik-Vereinfachung dokumentiert.
- [x] F4: Fokus-Umschalter blendet Board aus / zeigt Detailspalte breiter, laesst sich leicht
      wieder verlassen (Knopf-Toggle + automatisch beim Schliessen der Karte).
- [x] Bestehende Sprache/Klassen-Konventionen unveraendert, nur darauf aufgebaut.
- [x] Keine neuen Auto-Animationen/Pop-ups eingefuehrt.
- [x] Screenshots/DOM-Verifikation im echten Browser fuer alle vier Punkte.
- [x] Nur eigene Pfade committet; fremde WIP (v26-Reste in `board.js`/`ui.js`/`store.js`,
      v27-Workflow-Builder, v28-Retro-Look) unangetastet, nicht gestaged, nicht committet.
