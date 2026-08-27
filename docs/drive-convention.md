# Datei- & Ordner-Konvention (der Vertrag)

> Kernprinzip [Owner, 27.08.2026]: Die Inhalte leben als **menschenlesbare Dateien** in einer
> Ordnerstruktur. Die Software erkennt und setzt sie **deterministisch an Dateiname und Pfad**
> ein — **ohne Token, ohne KI-Abfrage**. Erst lokal unter `projects/`, spaeter identisch in
> Google Drive (nur die Wurzel wird getauscht). So kann jedes Teammitglied lokal mit KI
> arbeiten, und der gesamte Board-Zustand ist nichts als eine Spiegelung der Drive-Struktur.

## Ordnerstruktur pro Projekt

```
projects/                             (= Drive-Wurzel, spaeter)
  <Serie>/                            z. B. ProjectOasis
    EP<NN>__<ThemaSlug>/              z. B. EP02__AquaponikFuerDenGarten
      00_recherche.md                 Phase 1: Recherche, Fokus & Hooks
      10_skript.md                    Phase 2: Teleprompter ([CHUNK n])
      20_regieplan.md                 Phase 2: Regieplan & Metadaten
      30_caption.md                   Phase 2: Captions (2 Varianten + 5 Hashtags)
      projekt.json                    Maschinen-Index (Spalte, Upload-Datum, Haken)
      rohmaterial/                    Rohclips (vom Dreh)
      final/                          fertiges Video: WEE_<Serie>_EP<NN>_<Thema>_<Format>.mp4
```

- **Zahlen-Praefixe** (00/10/20/30) halten die Dateien fuer Menschen in Drive sortiert und geben
  der Software stabile Anker.
- **Markdown** ist gleichzeitig menschenlesbar (Drive-Vorschau) und ohne KI parsebar.

## Erkennungsregeln (rein Dateiname/Pfad, keine Token)

| Beobachtung im Ordner | Bedeutung | Auto-Uebergang |
|---|---|---|
| `00_recherche.md` vorhanden | Phase 1 erledigt | Idee -> Skript moeglich |
| `10_skript.md` vorhanden | Teleprompter da | — |
| `rohmaterial/` enthaelt >=1 Datei | Dreh ist durch | Videodreh -> Schnitt |
| `final/` enthaelt ein Video | Schnitt fertig | Schnitt -> Caption |
| `30_caption.md` vorhanden | Caption fertig | — |

Der Upload->Fertig-Sprung bleibt vorerst manueller Haken (spaeter IG/LinkedIn-API).

## Was wo lebt

- **Inhalt** (Texte, Videos): Dateien — die Wahrheit, menschen- UND maschinenlesbar.
- **Reiner Zustand ohne Datei** (Spalte, Upload-Datum, Haken): `projekt.json` je Projekt.
  Das Board wird aus dem Scan der Ordner + `projekt.json` gerendert, nicht aus einem zentralen
  `board.json` (dieses bleibt uebergangsweise als Index, bis der Scan alles traegt).

## Umsetzungsstand

- [x] KI-Ergebnisse werden zusaetzlich als `NN_<task>.md` in den Projektordner geschrieben.
- [x] Scan-Endpoint erkennt vorhandene Dateien + Ordner-Inhalte (rohmaterial/final).
- [ ] Board rendert Zustand vollstaendig aus dem Scan (statt board.json) — mit Drive-Phase.
- [ ] Auto-Uebergaenge per Polling — mit Drive-Phase.
