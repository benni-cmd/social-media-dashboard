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

## OWNER-ENTSCHEID (26.09.2026, AskUserQuestion)
1. **Vorwärts sperren + Altlasten markieren:** künftige Übergänge idee→skript blockieren, UND bereits
   ohne Skript-Datei in Drehtermin/Videodreh stehende Karten sichtbar mit rotem „!" markieren. KEIN
   automatisches Zurückschieben.
2. **Nur Dateien mit „skript" im Namen** zählen (Namensfilter, case-insensitive) — vermeidet, dass eine
   reine Caption-Datei im selben Ordner „Skript und Caption" die Sperre fälschlich öffnet.

## Plan — exakte 3-Datei-Spec (nach Peer-Abstimmung, pipeline.js ist Peer-Datei)
Helfer: `hatSkript(d) = (d?.skriptDateien || []).some(n => n.toLowerCase().includes("skript"))`.
1. **`lib/pipeline.js` `tore()`** (Peer):
   - `if (p === "idee")`: sperrendes Tor `tor("skript-datei", hatSkript(d) ? "ok" : "fehlt", <satz>, true)` → blockiert idee→skript ohne Skript-Datei.
   - `if (p === "skript")` und `if (p === "videodreh")`: dasselbe Tor OHNE sperrt (nur Markierung) — surft über KATALOG (art „warnung") als rotes „!".
   - Den bisherigen weichen Flag-Hinweis `gespeichert` (pipeline.js:1021, an `card.skriptGespeichert`) durch dieses scan-basierte Tor **ersetzen** (keine Doppelmeldung).
2. **`public/board.js`**: `BRAUCHT_DRIVE = new Set(["rohmaterial", "final", "skript-datei"])` — Tor nur nach Scan werten.
3. **`lib/kartenhinweise.js` KATALOG** (v68-Datei): Eintrag `{ key: "skript-datei", art: "warnung", spalte: "Idee, Skript, Videodreh", label: "Kein Skript-Dokument im Drive-Ordner" }`; alten `gespeichert`-Eintrag (Z. 43) entfernen. Prüfen, dass `schluesselVon` die Tor-id „skript-datei" auf denselben Key mappt.
4. **Verify:** Karte ohne „skript"-Datei → idee→skript blockiert + „!"; „…skript.md" in „Skript und Caption" anlegen → Tor „ok", Sperre/„!" weg. Browser-Screenshot + `node --check`.

## Koordination — 3 fremde/geteilte Dateien
pipeline.js = Peer (v70/v70b), kartenhinweise.js = Session „Hinweise & Warnungen" (v68), board.js = geteilt.
Am saubersten baut EINE Session alle drei in EINEM Commit (atomar: Tor ohne KATALOG-Eintrag = unsichtbar).
Empfehlung: Peer führt (owned pipeline.js), diese Session verifiziert live.

## Koordination
`lib/pipeline.js` ist die Datei der Session „Ampel-Logik" (Peer, v70/v70b). Edit mit ihr abstimmen —
diese Session diagnostiziert, Bau erst nach Owner-Entscheid + Abstimmung, um Kollision zu vermeiden.

## Stand
- [x] Drive-Abgleich verifiziert: Scan meldet skriptDateien korrekt (26.09.2026)
- [x] Ursache lokalisiert: fehlendes sperrendes Skript-Datei-Tor (pipeline.js)
- [x] Owner-Entscheid (26.09.2026): vorwärts sperren + Altlasten „!"; nur „skript"-Dateien zählen
- [x] Exakte 3-Datei-Spec erstellt (pipeline.js / board.js / kartenhinweise.js)
- [ ] Bau (Peer-geführt) + Live-Verify (diese Session)

## DoD
- idee→skript blockiert, solange „Skript und Caption" keine (passende) Datei enthält; frei, sobald eine liegt.
- Bestehende korrekt-belegte Karten unberührt; Verify im Browser.
