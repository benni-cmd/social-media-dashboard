# Datei- und Ordner-Konvention (der Vertrag)

## Grundsatz — gilt vor jeder anderen Regel [Owner, 30.09.2026]

1. **Drive ist die Wahrheit.** Was in Drive steht, gilt. Das Board ist Anzeige und Werkzeug;
   `data/` ist nur Cache. Bei Widerspruch gewinnt Drive.
2. **Ohne Board arbeitsfähig.** Fällt das Board aus, muss ein Mensch direkt in Google Drive
   weiterarbeiten können: den Stand jedes Projekts erkennen, Projekte weiterschieben, Inhalte
   finden und ablegen — ohne Code, ohne JSON lesen zu müssen.
3. **Prüfsatz für jede Änderung** an Ordnerstruktur, Namen oder Ablage: *Versteht ein Mensch,
   der nur Drive öffnet, was er sieht und was als Nächstes zu tun ist?* Eine Optimierung für
   die Software (schnellere Abfragen, weniger Dateien) ist nur zulässig, wenn die Antwort
   danach ein Ja bleibt. Speed ist nie ein Grund, Stand oder Inhalt aus Drive herauszunehmen.

Kernprinzip [Owner, 27.08.2026]: Die Inhalte leben als **menschenlesbare Dateien** in einer
Ordnerstruktur. Die Software erkennt und setzt sie **deterministisch an Dateiname und Pfad**
ein — ohne Token, ohne KI-Abfrage. Der Board-Zustand ist eine Spiegelung der Drive-Struktur.

## Struktur: Phasen SIND Ordner, Projekte wandern

Der Stand eines Projekts ist der Ordner, in dem es liegt. Beim Phasenwechsel im Dashboard
wandert der Projektordner physisch mit. So sehen Menschen den Stand direkt in Drive, und das
Dashboard kann ihn von dort zurueckholen.

```
<Drive-Wurzel>/                           (Stand gemessen 30.09.2026, `rclone lsf -R`)
  In Bearbeitung/
    1 Idee/  2 Skript/  3 Videodreh/  4 Schnitt/  5 Caption/  6 Upload/
                                          (die sechs Arbeitsphasen; Nummer = Board-Reihenfolge,
                                          seit v85 — Drive sortiert sonst alphabetisch)
      .phase                              Marker: stabile Phasen-ID des Spaltenordners
      <Projektordner>/                    liegt in GENAU einer Phase
        Steckbrief.md                     Klartext fuer Menschen: Phase, Zu tun, Termine (v85,
                                          vom Board geschrieben — Aenderungen hier ueberschrieben)
        (AI only)/projekt.json            Maschinen-Index (Phase, Titel, Termine, Ziel) = Wahrheit
        Skript und Caption/               00_recherche.md · 10_skript.md · 20_regieplan.md · 30_caption.md
        Rohmaterial/                      Rohclips
        Fertiges Video/                   geschnittenes Video
  Videoauswertung/                        = Phase "Fertig" (+ .phase, KPI-Tabellen)
    <Projektordner>/
  Verworfen/                              = Phase "Verworfen" (+ .phase)
  Papierkorb/                             geloeschte Projekte, mit Zeitstempel im Namen
  Kontext/
    _global/                              markenweite Infos, fliessen in jeden KI-Aufruf
    <Reihe>/                              reihenspezifische Infos
  System (AI only)/                       spalten.json, redaktionsplan(.slots).json,
                                          workflows.json, defaults.json, prompts.json,
                                          boardparameter.json
```

Die eine Quelle fuer Phasen und Ordnernamen ist `lib/pipeline.js` (`PHASEN`). Server und
Browser lesen dieselbe Datei — vorher stand die Reihenfolge vierfach im Code.

## Der Ordnername wird EINMAL vergeben und dann eingefroren

Projektname seit v85 im Klartext: `<Reihe> EP<NN> – <Thema>`, bei Einzelvideos nur `<Thema>`
(z. B. „Bienen und ihre Blumenfreunde"; `klartext()` in `lib/pipeline.js`: Leerzeichen und
Umlaute bleiben, nur `\ / : * ? " < > | # %` fallen weg, Kuerzung an Wortgrenze bei 60 Zeichen).
Bis v84: `<Reihe>_EP<NN>_<Thema>` als Slug ohne Leerzeichen, max. 32 Zeichen — bestehende
Ordner behalten diesen Namen.

**Spaltenordner** tragen die Board-Position vorn (`1 Idee`). Der Abgleich zieht die Nummer
selbst nach, wenn sie fehlt oder nicht mehr zur Reihenfolge passt; der Anzeigename im Board
bleibt ohne Nummer. Wer in Drive einen Spaltenordner umbenennt, benennt die Spalte im Board
mit (der `.phase`-Marker haelt die Identitaet).

**Wichtig:** Der Name entsteht beim Anlegen und lebt danach als `card.driveName` weiter. Er
wird **nicht** bei jedem Zugriff neu aus dem Titel abgeleitet.

> Der Grund ist gemessen [27.08.2026]: Vorher berechnete jeder Zugriff den Pfad aus dem
> aktuellen Titel. Wer eine Karte umbenannte, suchte danach einen Ordner, den es nie gab —
> der alte blieb unauffindbar liegen, und der naechste Klick legte ein Duplikat an.

Wer den Ordner in Drive umbenennt, muss `driveName` in `data/board.json` mitziehen — oder den
Abgleich laufen lassen und die Karte neu zuordnen.

## Existenz heisst: der Ordner ist da

Ein Projekt gilt als vorhanden, wenn sein **Ordner** existiert — nicht, wenn Dateien darin
liegen.

> Auch das ist gemessen [27.08.2026]: Vorher galt `Dateien > 0` als Existenzbeweis. Ein frisch
> angelegtes Projekt hat aber leere Unterordner und wurde deshalb als "nicht vorhanden"
> gemeldet: die Drive-Links erschienen nie, und die Oberflaeche bot "Ordner anlegen" fuer einen
> Ordner, den es schon gab.

Geprueft wird mit `rclone lsjson --stat`. Dessen Exit-Code trennt die beiden Faelle sauber:
**3 oder 4 = gibt es nicht**, alles andere ungleich 0 = **Stoerung**. Diese Unterscheidung ist
Pflicht — ein Drive-Ausfall darf nie aussehen wie ein leerer Ordner.

## Pfadstuecke werden geprueft, bevor sie an rclone gehen

Kein `/`, kein `\`, kein reiner Punkt-Name, hoechstens 120 Zeichen (`pfadstueckOk` in
`lib/pipeline.js`).

> Ohne die Pruefung erzeugte ein Dateiname wie `../../X.md` in Drive echte Ordner namens
> `．．` — rclone kodiert `..` als Vollbreite-Zeichen. Kein Ausbruch aus der Wurzel, aber
> dauerhafter Muell im Projektordner. Nachgemessen und wieder aufgeraeumt am 27.08.2026.

## Erkennungsregeln (rein Dateiname und Pfad, keine Token)

| Beobachtung im Ordner | Bedeutung |
|---|---|
| `Rohmaterial/` enthaelt mindestens eine Datei | Der Dreh ist durch |
| `Fertiges Video/` enthaelt eine Videodatei | Der Schnitt ist fertig |
| `Skript und Caption/10_skript.md` liegt vor | Das Skript ist gesichert |
| `Skript und Caption/30_caption.md` liegt vor | Die Caption ist gesichert |

Diese Beobachtungen fliessen in die Qualitaetstore (`tore()` in `lib/pipeline.js`) und
entscheiden mit, ob eine Karte weiterrueckt.

## Der Abgleich

`POST /api/drive/reconcile` liest **alle** Phasenordner und stellt sie den Karten gegenueber:

- Liegt ein Projekt in Drive in einer anderen Phase als im Board, **gewinnt Drive** — dort
  sieht ein Mensch, was er tut. Das Board folgt und sagt in einem Satz, was es geaendert hat.
- Liegt ein Ordner in Drive ohne Karte, wird die Karte aus `projekt.json` aufgebaut.
- Fehlt zu einer Karte mit vergebenem `driveName` der Ordner, ist das ein Befund — nicht
  stillschweigend geheilt, sondern gemeldet.

Der Abgleich korrigiert nie stumm: jede Aenderung erscheint als Satz in der Oberflaeche.

## Was wo lebt

- **Inhalt** (Texte, Videos): Dateien — die Wahrheit, menschen- und maschinenlesbar.
- **Zustand ohne Datei** (Phase, Termine, Ziel, Saeule): `projekt.json` je Projekt UND
  `data/board.json` als Index. Bei Widerspruch entscheidet der Abgleich zugunsten von Drive.

## KPI-Auswertung: menschenlesbare Tabellen unter `Videoauswertung/Auswertung-Tabellen/`

Zusaetzlich zum Maschinen-JSON (`Videoauswertung/KPI/<projekt>_kpi.json`) schreibt das Board
die Zahlen als CSV, die Mitarbeiter ohne API-Zugang in Sheets/Excel oeffnen koennen. Entwurf
und API-Belege: `docs/packages/v17-kpi-tabellen-drive.md`. Eine `LIESMICH.txt` im Ordner
erklaert die Spalten vor Ort.

- `beitraege-kpi.csv` — eine Zeile je Beitrag × Plattform × Mess-Intervall (24 h … 12 Monate).
  Geschrieben von `lib/kpi-tabellen.js` beim KPI-Sammeln (`kpi.sammle`).
- `kanal-verlauf.csv` — Konto-Verlauf (Follower gesamt/Zuwachs; Reichweite und Views als
  30-Tage-Fenster: letzte 30 Tage vs. die 30 davor + Delta in Prozent), woechentlicher
  Schnappschuss. Geschrieben von `lib/kanal-kpi.js`.
- `follower-demografie.csv` — Follower nach Land/Alter/Geschlecht (IG) bzw.
  Land/Branche/Funktion/Senioritaet (LI), quartalsweiser Schnappschuss.

CSV-Dialekt: UTF-8 mit BOM, Semikolon-Trenner, Dezimalkomma. Leere Zelle = Plattform
liefert nicht; `0` = echt gemessene Null. Belegte Feldherkunft je Plattform steht im Paket.
Follower-Gesamtstand und Demografie sind API-seitig **nicht** rueckwirkend holbar (nur der
LinkedIn-Zuwachs, einmalig 12 Monate) — die Kurven wachsen ab dem ersten Lauf.

## Zugang: eigene rclone-client_id ist Pflicht geworden

> **Erneut eingerichtet 30.09.2026** (Paket v84): Die Config trug wieder KEINE eigene
> client_id — Google drosselte die geteilte ID mit `403 Quota exceeded` (bis 20 s je Aufruf).
> Ben hat die client_id neu eingetragen und die OAuth-App **veröffentlicht** (im Modus „Test"
> laufen Anmeldungen nach 7 Tagen ab, rclone.org/drive). Danach 0/12 Drosselungen.

> **Erledigt 02.09.2026:** Eigene client_id eingerichtet (Google-Cloud-Projekt
> `1041532493098`, Drive-API aktiviert, OAuth-App als *Test* mit Testnutzer — Veröffentlichung
> mit Branding erst vor dem Go-Live). `rclone lsd gdrive:` listet ohne die shared-client_id-
> Warnung. Kalender- und Tasks-API im selben Projekt schon mitaktiviert (Nutzung separat).
> Schutz gegen Config-Beschädigung: Selbstheilung in `lib/rclone-config.js` (Paket v21).
> Merke: Datei-Reads unter AppData aus dieser Werkbank-Session sind ein veralteter
> Schnappschuss — Zustand über die Nutzer-Shell prüfen.

rclone warnt bei jedem Aufruf:

> This shared client_id is being retired and will stop working during 2026.

Ein genaues Datum nennt die Doku nicht. Solange Bens Remote keine eigene `client_id` traegt,
steht die Drive-Anbindung irgendwann 2026 still. Der Weg (Bens Handlung, interaktiver Login):

```
copy %APPDATA%\rclone\rclone.conf %APPDATA%\rclone\rclone.conf.bak
rclone config update gdrive client_id=DEINE_ID.apps.googleusercontent.com client_secret=DEIN_SECRET config_refresh_token=false
rclone config reconnect gdrive:
rclone lsd gdrive:
```

`config_refresh_token=false` verhindert, dass `update` den OAuth-Ablauf ungefragt anstoesst;
`reconnect` holt danach bewusst ein neues Token. Zugaenge als Umgebungsvariablen, nie in
Dateien.
