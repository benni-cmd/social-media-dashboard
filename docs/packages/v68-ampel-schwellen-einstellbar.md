# v68 — Ampel-Schwellen einstellbar (Mechanismus) + Tab „Board Regeln" (an Peer uebergeben)

> Owner 24.09.2026 (Kehrtwende gegen v66-Abschluss): „die einstellungen fuer die ampel fehlen
> komplett, die sollen auch bitte in ein extra neuen Tab im Menue namens ‚Board Regeln'." Also:
> die Rot/Gelb-Grenzen doch editierbar, und in einem NEUEN Menue-Tab „Board Regeln".

## PIG

**Problem:** Die Ampel-Rot/Gelb-Grenzen sind fest (`AMPEL = {rotTage:2, gelbTage:5}`); der v67-Tab
„Ansicht" (Peer) zeigt sie nur als Text „Fest hinterlegt, hier nicht aenderbar". Owner will sie
einstellen — in einem eigenen Tab „Board Regeln".

**Intent:** Die Zeit-Farbe der Karten an den realen Rhythmus anpassen koennen, an einem klar
benannten Ort fuer Board-Regeln.

**Goal:**
1. Rot/Gelb-Grenzen editierbar und persistent (rot ab X Tagen, gelb ab Y Tagen bis zur Frist).
2. Neuer Menue-Tab „Board Regeln" fuer diese Einstellung.
3. Standard = bisheriges Verhalten (2/5), kein Bruch.

## Arbeitsteilung (Kollision vermeiden)

`public/ui.js` traegt das Einstellungs-Menue (Tab-Namen Z.668, Seiten-Array Z.1530, jede Seite inline)
und ist gerade der **aktive, dirty File der Layout-Session (Peer)** — der Menue-Tab MUSS dort hinein.
Schnitt entlang der Datei-Ownership:
- **DIESE Session (Logik/Persistenz):** `lib/pipeline.js`, `lib/workflows.js`, `public/store.js` —
  macht die Schwellen konfigurierbar und persistent. KEIN `ui.js`.
- **Peer (Layout):** der Tab „Board Regeln" in `ui.js` (Menue-Eintrag + Panel), liest/schreibt ueber
  die hier bereitgestellte API. Uebergabe per Session-Nachricht.

## Ist-Analyse (belegt)

- `lib/pipeline.js`: `AMPEL` nur intern genutzt (Grep: board.js importiert die FUNKTION `ampel`, nicht
  die Konstante; `ui.js` referenziert `AMPEL` NICHT — der v67-Text ist hartcodiert). Also gefahrlos
  konfigurierbar.
- Persistenz-Muster steht (v66): Register `lib/workflows.js` + `workflowstore.setze()` (merged, clampt)
  + `store.js uebernimm()`/`stellschraube()`. Server nutzt `ampelStatus`/`ampel` NICHT (nur Browser
  faerbt) → modul-lokaler Setter sicher.

## Umsetzung (diese Session)

- `lib/pipeline.js`: `AMPEL_STANDARD = {rotTage:2, gelbTage:5}` + modul-lokale `ampelSchwellen` +
  `setAmpelSchwellen()` (mit Sicherung `gelbTage = max(rotTage, gelbTage)`) + `ampelSchwellenJetzt()`.
  `ampelStatus`/`ampel` defaulten auf die konfigurierten Schwellen.
- `lib/workflows.js`: Register-Eintrag `ampel-schwellen` mit Zahl-Params `rotTage` (Std 2) und
  `gelbTage` (Std 5), min 0 / max 60.
- `public/store.js`: `setAmpelSchwellen` importiert; `syncAmpelSchwellen()` in `uebernimm()` (greift bei
  ladeWorkflows UND setzeWorkflow), parallel zu `syncDeadlineKette()`.

## API fuer den Peer (Tab „Board Regeln")

- Lesen: `stellschraube("ampel-schwellen","rotTage")` / `"gelbTage"` (liefert Std, falls ungesetzt).
- Schreiben: `setzeWorkflow("ampel-schwellen", { params: { rotTage, gelbTage } })` → persistiert,
  `uebernimm()` synchronisiert pipeline automatisch; danach `zeichne()` fuers Board.
- Standard/Grenzen: aus dem Register (`rotTage` Std 2, `gelbTage` Std 5, min 0/max 60). Validierung:
  gelb nicht kleiner als rot (die Logik clampt zusaetzlich sicherheitshalber).
- Empfehlung: Deadlines (v66, aktuell in redaktionsplan.js) koennten hier mit hineinziehen — mit Owner
  klaeren; nicht Teil dieses Pakets.

## Verify (Beleg, 24.09.2026, heute = 2026-09-24)

- `node --check` pipeline.js / workflows.js / store.js → OK.
- Node-Probe gegen echtes `lib/pipeline.js`: Default 2/5 (2→befund,3→hinweis,5→hinweis,6→ok);
  5/10 (5→befund,6→hinweis,10→hinweis,11→ok); Gelb<Rot (8/3) → geclampt auf 8/8 (8→befund,9→ok);
  ungueltig (x/null) → Standard 2/5; `ampel()` folgt live.
- Server (:4399, neuer Code): `/api/workflows` liefert `ampel-schwellen` mit rotTage/gelbTage.
- Live/DOM: `store.setzeWorkflow("ampel-schwellen",{params:{rotTage:4,gelbTage:9}})` → `data/workflows.json`
  = {4,9}; nach `ladeWorkflows` `stellschraube`/`pipeline.ampelSchwellenJetzt()` = {4,9};
  `ampel()` 4T→befund, 9T→hinweis, 10T→ok. Danach auf 2/5 zurueckgesetzt (PUT 200).

## Stand

- [x] Ist-Analyse (AMPEL nur intern, ui.js referenziert es nicht, Server faerbt nicht)
- [x] pipeline.js: konfigurierbare Schwellen (Setter + Sicherung), Default = altes Verhalten
- [x] workflows.js: Register-Eintrag ampel-schwellen
- [x] store.js: syncAmpelSchwellen() in uebernimm()
- [x] Verify (node --check, Node-Probe, Server-Register, Live/DOM-Roundtrip)
- [x] Commit + Push (Logik-Teil)
- [ ] Tab „Board Regeln" in ui.js — beim Peer (uebergeben per Session-Nachricht)

## DoD

Geprueft gegen: `node --check` (pipeline/workflows/store) · Node-Probe gegen `lib/pipeline.js` ·
Server-Register `/api/workflows` · Live/DOM-Roundtrip (4/9 in Datei, pipeline/ampel folgen), danach 2/5.
Offen: der sichtbare Tab „Board Regeln" liegt beim Peer (ui.js) — bis der steht, sind die Schwellen zwar
konfigurierbar+persistent, aber ohne Bedienoberflaeche. Deadlines-Umzug in den Tab: mit Owner zu klaeren.
