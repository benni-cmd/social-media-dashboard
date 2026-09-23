# v57 — Detailspalte resizable (bis 80vw) + eigener Resize-/Standard-Cursor im Haus-Stil

> PLAN-Paket, angelegt 23.09.2026. Noch NICHT gebaut — Owner: "verstehe erstmal was ich
> meine, frag Fragen, rate an keiner Stelle, bau erst nach Freigabe."

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

## Offene Fragen — bitte beantworten, ich rate nicht

Gestellt per AskUserQuestion (siehe Chat): Mindestbreite der Detailspalte, Breite ueber
Sitzungen hinweg merken oder nicht, Aussehen des Resize-Cursors, Reichweite des "normalen
Cursors" (nur Cursor-Farbe/-Form allgemein, oder wirklich JEDER Standard-Pfeil im ganzen
Programm ersetzt).

Zusaetzlich, nicht per AskUserQuestion (Detailfragen, hier dokumentiert):

1. **Fokus-Modus-Kollision:** Im Fokus-Modus (Karte offen + Fokus an) wird `.detail` bereits
   automatisch breit (bis 760px, `flex:1 1 auto`). Soll die manuell gezogene Breite dort
   GELTEN (Fokus-Modus uebernimmt die manuelle Breite, gedeckelt auf sein eigenes 760px-Limit),
   oder bleibt der Fokus-Modus unangetastet (eigener Mechanismus, Resize wirkt nur ausserhalb)?
2. **Unterhalb 1100px:** Aktuell schrumpft `.detail` bei schmalen Fenstern automatisch auf
   320px (Media Query). Soll das Resize-Feature diese Anpassung ersetzen (Nutzer zieht selbst,
   keine automatische Verkleinerung mehr), oder soll die 1100px-Grenze weiterhin als zusaetzliche
   Deckelung gelten?
3. **80% wovon genau:** 80% der Browser-Fensterbreite (`100vw`) oder 80% der Board-Flaeche
   (`.hauptflaeche`, die volle Fensterbreite abzueglich nichts, da die Kopfzeile eigene Zeile
   ist — in der Praxis identisch)? Ich gehe von `100vw` aus, sofern nicht widersprochen.

## Plan (nach Antworten, noch nicht gebaut)

1. Resize-Griff: schmaler Bereich an der linken Kante von `.detail` (z. B. 6px breiter
   Hover-Streifen, visuell dezent), Pointer-Events fuer Drag (mousedown/mousemove/mouseup,
   analog zum bestehenden `verdrahteShutdownSlider`-Muster in `app.js`).
2. Breite als Custom Property/State statt festem `flex:0 0 380px` — waehrend des Ziehens live
   aktualisiert, gedeckelt zwischen Mindestbreite (Antwort ausstehend) und `80vw`.
3. Cursor an der Kante: eigenes SVG (Haus-Linienstil, `--linie`/`--akzent`), als
   `cursor: url(...) x y, ew-resize` — Fallback `ew-resize` fuer Browser ohne Custom-Cursor-
   Support oder falls das Bild nicht laedt.
4. Normaler Cursor: je nach Reichweite-Antwort — eigenes SVG auf `body`/`*`, Fallback `auto`.
5. Persistenz je nach Antwort: `localStorage` (Muster: `cm-theme` in `app.js`) oder keine.
6. Fokus-Modus-Verhalten je nach Antwort 1 oben.
7. Verify: Browser — Ziehen testen (min/max), Cursor-Aussehen in beiden Themes (hell/dunkel),
   Board-Spalten bleiben unveraendert waehrend des Ziehens, Screenshot vor/nach.
8. Commit + Push.

## Stand

- [x] Bestand geprueft (`.detail`-CSS, Fokus-Modus, fehlende Cursor-Infrastruktur) — 23.09.2026
- [ ] Owner-Antworten (AskUserQuestion + drei Detailfragen oben)
- [ ] Umsetzung
- [ ] Verify
- [ ] Commit + Push

## DoD

- Detailspalte per Ziehen an der linken Kante in der Breite veraenderbar, min–80vw.
- Board-Spalten (Groesse/Reihenfolge) bleiben beim Ziehen unveraendert, nur der Scroll-Bereich
  aendert sich.
- Eigener Resize-Cursor an der Kante im Haus-Stil.
- Normaler Cursor im Haus-Stil, Reichweite laut Owner-Antwort.
