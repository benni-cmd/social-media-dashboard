# Datei- & Ordner-Konvention (der Vertrag)

> Kernprinzip [Owner, 27.08.2026]: Die Inhalte leben als **menschenlesbare Dateien** in einer
> Ordnerstruktur. Die Software erkennt und setzt sie **deterministisch an Dateiname und Pfad**
> ein — **ohne Token, ohne KI-Abfrage**. Erst lokal unter `projects/`, spaeter identisch in
> Google Drive (nur die Wurzel wird getauscht). So kann jedes Teammitglied lokal mit KI
> arbeiten, und der gesamte Board-Zustand ist nichts als eine Spiegelung der Drive-Struktur.

## Struktur: Pipeline-Spalten SIND Ordner, Projekte wandern

Der Stand eines Projekts = in welchem Spalten-Ordner es liegt. Beim Spaltenwechsel im Dashboard
wird der Projektordner physisch verschoben. So liest das Dashboard den Stand direkt aus Drive,
und Menschen sehen ihn im Drive sofort.

```
<Drive-Wurzel>/
  In Bearbeitung/
    Idee/  Skript/  Videodreh/  Schnitt/  Caption/  Upload/     (Pipeline-Spalten)
      <Serie_EPnn_Thema>/                 Projektordner liegt in GENAU einer Spalte
        projekt.json                      Maschinen-Index (Spalte, Titel, Upload-Datum)
        Skript und Caption/               10_skript.md, 30_caption.md
        Rohmaterial/                      Rohclips -> Automation
        Fertiges Video/                   fertiges Video -> Automation
  Videoauswertung/                        = Spalte "Fertig"; hochgeladene Projekte + KPIs
    <Serie_EPnn_Thema>/
  Kontext/
    _global/                              markeweite Infos fuer Prompts
    <Serie>/                              reihen-spezifische Infos + "schon behandelt"
```

- Projektname: `<Serie>_EP<NN>_<Thema>` (ohne WEE-Praefix, Owner-Entscheidung).
- Verschieben = Zustandswechsel. Da rclone beim Verschieben neue Ordner-IDs erzeugt, holt das
  Dashboard Ordner-Links immer LIVE (nicht gespeichert).
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
