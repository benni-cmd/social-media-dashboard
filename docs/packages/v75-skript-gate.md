# v75 — Skript-Datei-Gate: „Drehtermin" erst mit echter Skript-Datei in Drive

> Diagnose + Fix-Plan. Owner-Beobachtung 26.09.2026: Karten stehen in „Drehtermin festlegen",
> obwohl im Drive kein echtes Skript-Dokument liegt.

## PIG

**Problem:** Karten stehen in Phase **`skript`** („Drehtermin festlegen") — teils sogar in `videodreh` —
ohne dass im Drive-Ordner **„Skript und Caption"** eine echte Skript-Datei liegt. Der **Drive-Abgleich
arbeitet KORREKT** (nicht die Ursache): `projects.scan()` liefert `skriptDateien` = Dateien in
„Skript und Caption" (projects.js:145,161). Live belegt (26.09.2026, laufender Server):
- „Mischkultur in drei Schritten" (skript): `skriptDateien: ["10_skript.md"]` ✓
- „Hühnernahrung mit Maden" (skript): `skriptDateien: []` — keine Datei
- „Boden wie ein Schwamm" (videodreh): `skriptDateien: []`, `rohmaterial: 1`

Die **Gate-Logik erzwingt die Datei nicht**: In `lib/pipeline.js` `tore()` sperrt der Übergang
idee→skript nur an `thema/kategorie/ziel/fokus` (Zeilen 942–961). „Skript im Drive" ist nur ein
**weicher, nicht-sperrender Hinweis** am Karten-Flag `card.skriptGespeichert` (pipeline.js:1021),
NICHT am Scan-Feld `d.skriptDateien`. Sperrende Drive-Datei-Tore gibt es nur für `videodreh`
(`d.rohmaterial>0`, Z. 1026) und `schnitt` (`d.final>0`, Z. 1046). Tore sind aktiv
(`upload-fertig-weiter.toreBeachten=true`, live geprüft) — es fehlt schlicht das Skript-Datei-Tor.

**Intent (Owner 26.09.2026):** Eine Karte darf **erst dann** von „Skript schreiben" (idee) nach
„Drehtermin festlegen" (skript) rutschen, wenn im Drive-Ordner „Skript und Caption" eine **echte
Skript-Datei** liegt — analog zu Rohmaterial/Fertiges Video.

**Goal:** Sperrendes Tor in Phase `idee`: `d.skriptDateien?.length > 0` → sonst blockiert idee→skript.
Nutzt den bestehenden, korrekt arbeitenden Scan. Statuswort `fehlt` wenn keine Datei, `ok` wenn ≥1.

## Befund (belegt, kein One-Shot)
- Scan korrekt: `POST /api/drive/scan` je Karte liefert `skriptDateien` exakt (siehe oben).
- Gate-Lücke: `pipeline.js:942–961` (idee-Tore ohne Skript), `:1021` (nur weicher Hinweis), `:1026/1046` (Datei-Tore nur roh/final).
- Tore aktiv: `upload-fertig-weiter an=true, toreBeachten=true` (live).
- Datenlage: 13 Karten in skript/videodreh; mehrere mit `skriptFinal:false` UND leerem `skriptDateien`.

## OFFENE OWNER-FRAGEN (vor dem Bau)
1. Nur **vorwärts** sperren (künftige Übergänge), oder auch die **bereits falsch** in Drehtermin/Videodreh
   stehenden Karten markieren/zurückholen?
2. Zählt JEDE Datei in „Skript und Caption" als Skript, oder nur bestimmte (z. B. `*skript*`/`.md`)?
   (Mischkultur hat `10_skript.md`.)
3. Soll zusätzlich der bisherige weiche Hinweis `gespeichert` durch das echte Scan-Tor ersetzt werden?

## Plan (nach Owner-Antwort + Peer-Abstimmung)
1. In `lib/pipeline.js` `tore()` im `if (p === "idee")`-Block ein sperrendes Tor ergänzen:
   `tor("skript-datei", d.skriptDateien?.length ? "ok" : "fehlt", …, true)`.
2. Sicherstellen, dass der Scan `d` im idee-Pfad wirklich anliegt (board.js/detail.js Aufrufkette).
3. Verify: Karte ohne Datei → idee→skript blockiert; Datei anlegen → Übergang frei. Browser + `node --check`.

## Koordination
`lib/pipeline.js` ist die Datei der Session „Ampel-Logik" (Peer, v70/v70b). Edit mit ihr abstimmen —
diese Session diagnostiziert, Bau erst nach Owner-Entscheid + Abstimmung, um Kollision zu vermeiden.

## Stand
- [x] Drive-Abgleich verifiziert: Scan meldet skriptDateien korrekt (26.09.2026)
- [x] Ursache lokalisiert: fehlendes sperrendes Skript-Datei-Tor (pipeline.js)
- [ ] Owner-Fragen geklärt
- [ ] Bau + Verify (nach Peer-Abstimmung)

## DoD
- idee→skript blockiert, solange „Skript und Caption" keine (passende) Datei enthält; frei, sobald eine liegt.
- Bestehende korrekt-belegte Karten unberührt; Verify im Browser.
