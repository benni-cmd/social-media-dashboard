# v34 — Die zwei Kontext-Wege zusammenlegen

## PIG

**Problem:** Es gibt zwei Wege, wie Firmenwissen in einen KI-Prompt kommt, und sie wissen
nichts voneinander.

1. **Der alte, unsichtbare:** `server.js` `leseKontext(serie)` liest bei jedem KI-Aufruf
   `Kontext/_global` und `Kontext/<reihe>` aus Drive und haengt sie als Block vor den Prompt.
   Niemand sieht das im UI. Wer eine Datei in `Kontext/_global` legt, aendert damit jeden
   erzeugten Text — ohne Spur im Board.
2. **Der neue, sichtbare:** der Tab „Unternehmenskontext" (v33).

Daraus folgen drei Fallen, gemessen am Code:
- **Unsichtbarkeit** (die schwerste): Der Tab behauptet zu zeigen, was die KI bekommt
  (`/api/kontext/probe`) — der Drive-Weg fehlt dort. Die Anzeige ist damit unvollstaendig.
- **Doppelung:** Wer dieselben Dateien zusaetzlich als Drive-Quelle im Tab eintraegt, hat sie
  zweimal im Prompt.
- **Unterschiedliche Regeln:** Der alte Weg greift nur bei gesetzter Reihe und nur bei den
  Aufgaben `recherche`, `skript`, `regieplan` (`server.js`, `/api/ai`) bzw. zusaetzlich den
  beiden Hook-Aufgaben (`/api/ai/stream`) — zwei Endpunkte, zwei Listen. Der neue gilt immer.

**Intent:** Ein Weg. Was in den Prompt geht, steht an einer Stelle und ist an einer Stelle
sichtbar — auch das, was aus Drive kommt.

**Goal:** `Kontext/_global` und `Kontext/<reihe>` erscheinen im Tab als **eingebaute Quellen**
mit ihrem Zustand, abschaltbar, aber nicht loeschbar. `leseKontext()` in `server.js` entfaellt;
beide KI-Endpunkte holen alles ueber `kontextstore.sammle()`. Derselbe Text kann nicht mehr
zweimal im Prompt landen. Die Probe-Anzeige zeigt vollstaendig, was die KI bekommt.

---

## Design-Entscheidungen [06.09.2026]

- **Eingebaute Quellen statt Sonderweg.** `Kontext/_global` haengt am Firmenblock (gilt immer),
  `Kontext/<reihe>` ist reihenbezogen und greift nur, wenn die Karte eine Reihe gesetzt hat.
  Beide stehen im Tab wie jede andere Quelle, tragen die Marke „eingebaut" und lassen sich per
  Haekchen abschalten. Loeschen geht nicht — sie sind Teil der Drive-Konvention
  (`docs/drive-convention.md`), nicht Bens Eingabe.
- **Doppelung wird am Inhalt erkannt, nicht am Pfad.** Zwei Quellen koennen denselben Ordner
  ueber verschiedene Schreibweisen meinen. Verglichen wird der getrimmte Dateiinhalt; wer
  zweimal kommt, zaehlt einmal.
- **Die Aufgaben-Listen entfallen.** Bisher entschieden zwei verschiedene Listen in zwei
  Endpunkten, bei welchen Aufgaben der Drive-Kontext ueberhaupt mitkommt. Das war nirgends
  begruendet und an zwei Stellen gepflegt. Neu gilt der Kontext fuer jede Aufgabe — wer das
  nicht will, schaltet die Quelle ab. Bewusste Verhaltensaenderung.
- **Der tote Endpunkt `/api/drive/kontext` bleibt, laeuft aber ueber den neuen Weg.** Kein
  Frontend ruft ihn (`grep -rn "drive/kontext" public/*.js` = 0 Treffer); loeschen waere
  sauberer, aber er kostet nichts und ist jetzt wenigstens konsistent.

## Plan

- **v34-1** — `lib/kontextstore.js`: eingebaute Drive-Quellen, Schalter dafuer, Dedup nach
  Inhalt, `sammle({serie})`.
- **v34-2** — `server.js`: `leseKontext()` raus, beide KI-Stellen auf `sammle({serie})`.
- **v34-3** — `public/kontext.js`: eingebaute Quellen anzeigen (Marke, Schalter, kein Loeschen).
- **v34-4** — Verify: Probe zeigt den Drive-Anteil, Doppelung erzeugt nur einen Eintrag,
  Screenshot, echter KI-Lauf.

## Stand — gebaut und geprueft, 06.09.2026

| Phase | Ergebnis |
|---|---|
| v34-1 Ablage | `lib/kontextstore.js`: `EINGEBAUT_GLOBAL` (`Kontext/_global`) und die reihenbezogene Quelle `Kontext/<reihe>`, Schalter `eingebaut.global`/`eingebaut.reihe`, `firmenQuellen(stand, serie)`, Dedup ueber ein `gesehen`-Set aller Bloecke, `sammle({serie, projektId})`. |
| v34-2 Server | `leseKontext()` entfernt, `kontextBlock` entfallen, beide KI-Endpunkte reichen `serie` an `sammle()`; `PUT /api/kontext` kennt `eingebaut-schalten`; `/api/drive/kontext` laeuft ueber denselben Weg. |
| v34-3 Oberflaeche | Eingebaute Quellen mit Marke „eingebaut", Zustand und Haekchen statt Loeschen-Knopf; Satz zur reihenbezogenen Quelle; Stile in `public/einstellungen.css`. |

**Verhaltensaenderung, bewusst:** Frueher kam der Drive-Kontext nur, wenn die Karte eine Reihe
hatte, und nur bei bestimmten Aufgaben — `["recherche", "skript", "regieplan"]` bei `/api/ai`,
zusaetzlich die beiden Hook-Aufgaben bei `/api/ai/stream`. Zwei Listen, zwei Endpunkte, nirgends
begruendet. Jetzt gilt: `Kontext/_global` immer, `Kontext/<reihe>` sobald die Karte eine Reihe
hat, beides fuer JEDE Aufgabe. Wer das nicht will, schaltet die Quelle im Tab ab.

**Preis dafuer:** `sammle()` fragt bei jedem KI-Aufruf einmal Drive (`rclone lsf`). Neben einem
Lauf von 30 bis 60 Sekunden faellt das kaum ins Gewicht; wem es zu viel ist, schaltet die
eingebaute Quelle ab — dann wird sie gar nicht erst gelesen.

## DoD

- [x] `grep -c "leseKontext" server.js` = 1, und das ist der Kommentar, der die Entfernung
      erklaert (Zeile 199) — kein Aufruf mehr
- [x] Tab zeigt `Kontext/_global` als eingebaute Quelle mit Marke, Zustand („keine lesbare
      Textdatei gefunden") und Haekchen; Abschalten wirkt und die Quelle bleibt in der Liste,
      damit man sie wieder einschalten kann — Screenshot 06.09.2026
- [x] Dieselbe Datei ueber zwei Wege (Ordner + Einzeldatei) ergibt EINEN Eintrag: „Waldgruen"
      erscheint genau einmal im gesammelten Text
- [x] Ohne hinterlegten Kontext und ohne Drive-Inhalt sind beide Platzhalter leer
- [x] `node --check` gruen fuer `server.js`, `lib/kontextstore.js`, `public/kontext.js`
- [x] **Echter KI-Lauf** mit der Aufgabe `caption` — die frueher KEINEN Drive-Kontext bekam:
      Firmentext „Die Firma heisst Talwerk Kollektiv.", Probe-Prompt nach dem Firmennamen,
      Ollama qwen2.5:32b antwortete `Talwerk Kollektiv` (62 s). Testdaten danach entfernt.
