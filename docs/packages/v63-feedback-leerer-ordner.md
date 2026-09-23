# v63 — Fehlender Drive-Ordner im Feedback-Terminal neutral statt als Fehler

> Umgesetzt 23.09.2026.

## PIG

**Problem:** Owner-Fund — im Drive-Feedback-Terminal des Boards erscheint die Zeile
„rclone lsf gdrive:Verworfen — nicht gefunden (Code 3)", die alarmierend wie ein Fehler
wirkt. Tatsaechlich ist das der Normalzustand: der Ordner „Verworfen" existiert nur nicht,
weil noch nie eine Karte verworfen wurde. Der Code behandelt einen fehlenden Ordner bereits
korrekt als LEER (`lib/drive.js` `list()` ~:355–369: „Ein fehlender Ordner liefert eine leere
Liste"; `NICHT_GEFUNDEN = Set([3,4])`, `DriveFehler.fehlend`). Kein Funktionsfehler — nur die
ANZEIGE stellte ein erwartetes „nicht gefunden" wie eine Stoerung dar.

**Intent:** Ein erwartet-fehlender Ordner soll im Feedback-Terminal beruhigen, nicht
aufschrecken. Echte Stoerungen (Netzfehler, andere Exit-Codes) muessen weiter als Fehler
sichtbar bleiben. Reine Anzeige-/Klassifizierungs-Aenderung, kein Eingriff ins Drive-Verhalten.

**Goal:**
1. Ein fehlender Ordner/Datei (Exit 3/4) erscheint im Terminal mit neutralem Text
   „leer / noch nicht angelegt" statt „nicht gefunden (Code 3)".
2. Das Statuswort bleibt das bereits neutrale „fehlt" (muted `--fehlt: #8f7f5c`, nicht das
   rote `--befund`).
3. Echte Stoerungen (jeder andere Exit-Code, Timeout, ENOENT) bleiben unveraendert „befund".
4. Der Exit-Code bleibt fuer echte Diagnose am `DriveFehler`-Objekt erhalten (`.code`/`.fehlend`).

## Bestand geprueft (kein One-Shot)

- Aufruf-/Klassifizierungs-Stelle: `lib/drive.js` `rcloneVersuch()` — der EINZIGE Ort, an dem
  das Board rclone startet und ins Ereignis-System (`lib/ereignisse.js`, v58) meldet. Bei
  `close`-Code 3/4 (`NICHT_GEFUNDEN`) rief er `vorgang.fertig("nicht gefunden (Code ${code})",
  "fehlt")` (:311) — Status schon neutral, aber der TEXT alarmierend.
- `grep` nach „nicht gefunden (Code" / „Code ${code}" bestaetigt: die Terminal-Textzeile
  entsteht ausschliesslich an dieser einen Stelle (:311). `:312`/`:314` betreffen echte Fehler
  bzw. die intern gefangene `DriveFehler`-Message.
- Renderer: `public/anschluesse.js` `zeileHtml()` zeichnet jede Zeile mit
  `statusChip(e.status||"ok")` + `escape(e.text)`; `statusChip` (`public/ui.js`) fuehrt
  „fehlt" als eigenes, neutrales Statuswort (Icon `kreis`). Keine Aenderung am Renderer noetig —
  die neutrale Klasse existiert bereits, nur der uebergebene Text war alarmierend.

## Umsetzung

- `lib/drive.js` (:311): Anzeigetext des fehlend-Falls von `nicht gefunden (Code ${code})` auf
  `leer / noch nicht angelegt` geaendert; Statuswort „fehlt" unveraendert. Kommentar erweitert
  (Owner-Fund, Exit-Code bleibt am Objekt). Sonst nichts angefasst — echter Fehlerpfad (:312)
  und `DriveFehler`-Konstruktion (:314, `fehlend`/`code`) bleiben wie sie waren.

## Verify (23.09.2026)

- `node --check lib/drive.js` → OK.
- JS-Beleg gegen den echten rclone-Pfad (Ordner-Standard erlaubt DOM/JS-Beleg): `drive.list()`
  auf einen garantiert nicht existierenden Ordner (`ZZZ_nicht_existent_<ts>`) → rclone endet
  real mit Exit 3 (fehlend-Zweig greift, `list()` liefert `[]`). Das daraufhin im Ereignis-Bus
  abgelegte Drive-Ereignis:
  `{"text":"leer / noch nicht angelegt","status":"fehlt","dienst":"rclone"}`.
  Damit rendert `zeileHtml` → `statusChip("fehlt")` (Wort „fehlt", `--fehlt`-Farbe, kein Rot) +
  Text „leer / noch nicht angelegt". Vorher: Text „nicht gefunden (Code 3)".
  Befehl: `node <scratchpad>/prove.mjs` (importiert `lib/drive.js` + `lib/ereignisse.js`).

## Stand

- [x] Bestand geprueft (Aufrufstelle, grep, Renderer/Statuswort) — 23.09.2026
- [x] Umsetzung (lib/drive.js:311)
- [x] Verify (node --check + JS-Beleg des Ereignis-Texts ueber echten Exit-3-Pfad)
- [x] Commit + Push (653ce71)

## DoD

- Fehlender Ordner/Datei (Exit 3/4) zeigt im Terminal „leer / noch nicht angelegt", Statuswort
  „fehlt" (neutral, kein Rot).
- Echte Stoerungen bleiben „befund".
- Kein Eingriff ins Drive-Verhalten; Exit-Code weiter am `DriveFehler`-Objekt verfuegbar.
