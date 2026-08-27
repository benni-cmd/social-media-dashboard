# Work package: v5 — Google-Drive-Phase (Testordner)

> Grundlage: Owner-Spezifikation 27.08.2026 + Testordner
> `drive.google.com/drive/folders/1jjQoeBpIzOdvAawyoSAuMWL2NGiN0mvt`.
> Token-freier Zugang: **rclone** (`gdrive:`-Remote, im Onboarding verbunden), gerootet per
> `RCLONE_DRIVE_ROOT_FOLDER_ID`. Lese-/Schreibzugriff verifiziert (mkdir+purge). Testphase mit
> dem hinterlegten Google-Konto; das echte Konto kommt spaeter.

**Problem:** Das Board haelt Inhalte lokal. Sie sollen als menschenlesbare Dateien in Google
Drive leben, deterministisch per Name/Pfad erkannt, und den Board-Zustand treiben — geteilt im
Team, token-frei.

**Intent:** Drive = Single Point of Truth. Das Dashboard schreibt/liest ueber rclone, verlinkt
die Ordner, und fuehrt einen Skript-Workflow MIT Freigabeschritten (kein One-Shot) samt finalem
Textfeld vor dem Speichern.

**Goal:** Drive-Struktur steht; ein Projekt durchlaeuft Idee->Skript mit Freigaben und landet
final editiert in `Skript und Caption/`; Ordner sind im Dashboard verlinkt; Befuellen von
`Rohmaterial/` bzw. `Fertiges Video/` treibt die Karte weiter. KPI-Teil als eigene spaetere Phase.

## Drive-Struktur (erste Ebene: drei Ordner)

```
<Testordner>/
  In Bearbeitung/            Projekte in Produktion
    <Projektname>/
      Skript und Caption/    -> Automation: Skript/Caption fertig
      Rohmaterial/           -> Automation: befuellt => Karte nach Schnitt
      Fertiges Video/        -> Automation: befuellt => Karte nach Caption/Upload
  Videoauswertung/           hochgeladene Projekte; hierher wandert ein Projekt nach Upload
    <Projektname>/           KPI-Dokumentation ueber IG/LinkedIn-API (spaetere Phase)
  Kontext/                   Info-Sammlung fuer die Prompts (fixe Projektinfos + kurze Dokus,
                             was schon behandelt wurde -> weniger Doppelung, besseres Spreading)
```

Die drei Unterordner eines Projekts werden im Dashboard an der jeweiligen Stelle **verlinkt**
(direkter Drive-Link pro Karte/Spalte).

## Skript-Workflow mit Freigaben (kein One-Shot)

1. **Recherche & Vorschlaege** (Button, Phase 1): Hard Facts, Hauptfokus + 2 Alternativen,
   Haupt-Hook + 2 Alternativen. Zieht `Kontext/` als Zusatzinfo in den Prompt.
2. **Freigabe Fokus & Hook** (editierbares Feld): Ben waehlt/schreibt den finalen Fokus + Hook.
   Erst danach geht es weiter — nichts wird uebersprungen.
3. **Skript-Entwurf** (Button, Phase 2): Teleprompter aus dem freigegebenen Fokus/Hook + Kontext.
4. **Finales Skript-Textfeld**: der Entwurf erscheint editierbar; Ben passt final an.
5. **Speichern**: schreibt `Skript und Caption/10_skript.md` nach Drive, Board aktualisiert
   (Scan erkennt die Datei). Caption analog als eigener Schritt.

## KPI-Dokumentation (spaetere, gated Phase — IG/LinkedIn-API)

- Projekt in `Videoauswertung/` wird im ersten Monat nach Upload gemessen, mit laenger werdenden
  Intervallen (Vorschlag Tage nach Upload: 1, 2, 3, 5, 7, 11, 16, 23, 30).
- Ausloesung: sobald bei IRGENDEINEM Nutzer das Programm offen ist und die letzte Messung
  ueberfaellig ist, laeuft die API-Abfrage einmal und traegt den KPI-Stand ein.
- Braucht IG-Graph-/LinkedIn-API-Freigaben -> eigene Phase, blockiert den Rest nicht.

## Plan (phasiert)

1. [x] rclone-Zugang verifiziert (lesen+schreiben im Testordner).
2. [x] Drive-Grundgeruest angelegt: In Bearbeitung / Videoauswertung / Kontext (+ Kontext/_global).
3. [x] Server: rclone-Anbindung `drive.js` (mkdir, rcat, cat, lsf, link, move).
4. [x] Projekt anlegen erzeugt `In Bearbeitung/<Serie_EPnn_Thema>/` + 3 Unterordner + Links.
5. [x] Skript-Workflow: Freigabe-Feld -> KI-Entwurf -> finales editierbares Textfeld -> Drive.
6. [x] Ordner-Links im Dashboard je Karte (Skript und Caption / Rohmaterial / Fertiges Video).
7. [ ] Auto-Uebergaenge an DRIVE-Scan haengen (aktuell lokaler Scan) + Polling.
8. [ ] Lifecycle: nach Upload Projekt nach `Videoauswertung/` verschieben (Endpoint da: drive.moveDir).
9. [ ] Kontext-Inhalte pflegen (aktuell Ordner leer -> Anreicherung greift, sobald Dateien da sind).
10. [ ] Ben-Rechner: rclone + gdrive-Remote einrichten (fuer eigene lokale Nutzung; Dev laeuft in Agent-Umgebung).
11. [ ] KPI-Phase (IG/LinkedIn-API) — spaeter.

## Nachtrag 1 (Bau 2026-08-27)

Backend end-to-end verifiziert: create/save/scan in Drive. Frontend rendert Links + Workflow.

## Nachtrag 2 — Spalten SIND Ordner, Projekte wandern (2026-08-27)

Umgebaut: `In Bearbeitung/<Spalte>/<Projekt>/`, Spalte = Ordner. Neue Endpunkte: `/api/drive/move`
(verschiebt beim Spaltenwechsel, schreibt `projekt.json` neu) und `/api/drive/board` (liest den
Board-Stand DIREKT aus den Spalten-Ordnern). Frontend verschiebt bei Drag&Drop/Haken/Auto-Sprung
den Drive-Ordner mit; Erkennung + Links kommen live aus `/api/drive/scan`.

Verifiziert: 2 Testprojekte angelegt und mit dem Dashboard gematcht —
`In Bearbeitung/Skript/ProjectOasis_EP01_DigitalerSandkasten` (+ 10_skript.md) und
`In Bearbeitung/Videodreh/WorldEden_EP03_BodenwieeinSchwamm` (+ Rohmaterial). `/api/drive/board`
gab beide mit korrekter Spalte zurueck; Move skript->schnitt->skript sauber gelesen. Board zeigt
beide Karten in den richtigen Spalten, keine JS-Fehler.

**Wichtig fuer Bens eigene Nutzung:** rclone-Config liegt in `AppData\Roaming` (nicht mit der
Agent-Umgebung geteilt) -> Bens Rechner braucht rclone + `gdrive`-Remote fuer die Drive-Funktionen
(Setup-Drive.cmd offen). Board + KI (claude) laufen bei ihm ohne das.

## Offene Punkte fuer Ben (nicht blockierend)

- Projektname-Konvention im Drive: mit `WEE_<Serie>_EP<NN>_<Thema>` oder nur `<Thema>`?
- Wandert das Projekt bei Upload physisch nach `Videoauswertung/`, oder wird es kopiert?
- Kontext/: pro Serie ein Unterordner, oder ein flacher Pool? Welche fixen Infos zuerst rein?

## Definition of Done

Geprueft gegen: rclone lesen+schreiben (ok) · Drive-Struktur sichtbar · Projekt-Anlage erzeugt
Ordner · Skript-Workflow schreibt final editierte `10_skript.md` nach Drive · Board-Scan erkennt
sie · Ordner-Links oeffnen Drive.
Offen: alles ausser Schritt 1 (Bau folgt).
