# Datei- und Ordner-Konvention (der Vertrag)

> Kernprinzip [Owner, 27.08.2026]: Die Inhalte leben als **menschenlesbare Dateien** in einer
> Ordnerstruktur. Die Software erkennt und setzt sie **deterministisch an Dateiname und Pfad**
> ein — ohne Token, ohne KI-Abfrage. Der Board-Zustand ist eine Spiegelung der Drive-Struktur.

## Struktur: Phasen SIND Ordner, Projekte wandern

Der Stand eines Projekts ist der Ordner, in dem es liegt. Beim Phasenwechsel im Dashboard
wandert der Projektordner physisch mit. So sehen Menschen den Stand direkt in Drive, und das
Dashboard kann ihn von dort zurueckholen.

```
<Drive-Wurzel>/
  In Bearbeitung/
    Idee/  Skript/  Videodreh/  Schnitt/  Caption/  Upload/     (die sechs Arbeitsphasen)
      <Projektordner>/                    liegt in GENAU einer Phase
        projekt.json                      Maschinen-Index (Phase, Titel, Termine, Ziel)
        Skript und Caption/               00_recherche.md · 10_skript.md · 20_regieplan.md · 30_caption.md
        Rohmaterial/                      Rohclips
        Fertiges Video/                   geschnittenes Video
  Videoauswertung/                        = Phase "Fertig"
    <Projektordner>/
  Kontext/
    _global/                              markenweite Infos, fliessen in jeden KI-Aufruf
    <Reihe>/                              reihenspezifische Infos
```

Die eine Quelle fuer Phasen und Ordnernamen ist `lib/pipeline.js` (`PHASEN`). Server und
Browser lesen dieselbe Datei — vorher stand die Reihenfolge vierfach im Code.

## Der Ordnername wird EINMAL vergeben und dann eingefroren

Projektname: `<Reihe>_EP<NN>_<Thema>`, bei Einzelvideos nur `<Thema>`.

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

## Zugang: eigene rclone-client_id ist Pflicht geworden

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
