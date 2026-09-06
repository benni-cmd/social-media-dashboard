# v33 — Unternehmenskontext in den Einstellungen

## PIG

**Problem:** Die KI-Knoepfe wissen nichts ueber die Firma, fuer die geschrieben wird. Was sie
kennt, steht fest im Marken-Vorspann (`lib/ai.js`, `SYSTEM_VORLAGE`: World Eden Era, Zielgruppe,
Tonfall) — wer das Board fuer einen anderen Betrieb nutzt, muesste den Vorspann umschreiben. Es
gibt zwar einen Kontext-Weg aus Drive (`server.js`, `leseKontext()` liest `Kontext/_global` und
`Kontext/<reihe>`), aber der ist unsichtbar: kein Feld im UI, keine Anzeige, was gelesen wird,
und er greift nur, wenn die Karte eine Reihe gesetzt hat. Ben kann Firmenwissen heute nirgends
im Board hinterlegen.

**Intent:** Eine sichtbare Stelle in den Einstellungen, an der Firmen- und Projektwissen liegt —
als Freitext und als Verweis auf vorhandene Dateien, lokal oder in Drive. Die KI-Prompts sollen
darauf zugreifen koennen, ohne dass Ben den Vorspann anfasst.

**Goal:** Ein Tab „Unternehmenskontext" mit
1. einem Textfeld fuer **Firma/Brand** (genau eines),
2. beliebig vielen **Projekten**, je mit Name und eigenem Textfeld („Neues Projekt hinzufuegen"),
3. je Block **Quellen**: lokale Datei, lokaler Ordner, Drive-Datei, Drive-Ordner — mit Anzeige,
   was davon tatsaechlich gelesen werden kann,
4. und zwei Platzhaltern `{{firmenkontext}}` / `{{projektkontext}}`, die in jedem Prompt und im
   System-Vorspann stehen duerfen und beim Aufruf mit dem gesammelten Text gefuellt werden.

Ausdruecklich NICHT in diesem Paket [Owner, 05.09.2026]: eine Verknuepfung der Projekte mit
Karten, Spalten oder Menues. Das kommt spaeter.

---

## Bestandsaufnahme (gemessen)

- `lib/drive.js` bringt alles Noetige mit: `list(pfad, {filesOnly})`, `readFile(pfad)`,
  `existiert(pfad)`, `erreichbar()` (`grep -n "^export .*function" lib/drive.js`).
- `server.js:197` `leseKontext(serie)` liest heute schon `Kontext/_global` und `Kontext/<reihe>`
  aus Drive und haengt das Ergebnis als Block vor den Prompt (`server.js:414-421`, `456-462`).
  Dieser Weg bleibt unangetastet — er ist reihenbezogen, der neue ist firmenbezogen.
- Prompts sind seit v26 Vorlagen mit `{{platzhalter}}`; gefuellt wird in `lib/ai.js`
  (`fuelleVorlage`, `baueSystem`, `baueAufgabe`), die gespeicherten Fassungen liegen in
  `lib/promptstore.js`. Genau dort haengt der neue Kontext ein.
- Das Einstellungs-Modal hat sechs Tabs (`public/ui.js:414`), Seiten `seite1..seite6`
  (`public/ui.js:943-969`).

## Design-Entscheidungen [05.09.2026]

- **Eine Ablage `data/kontext.json`**, Form:
  `{ firma: {text, quellen[]}, projekte: [{id, name, text, quellen[], aktiv}] }`.
  Eine Quelle ist `{id, art: "lokal-datei"|"lokal-ordner"|"drive-datei"|"drive-ordner", pfad}`.
- **Gelesen wird nur Text.** `.md`, `.txt`, `.markdown` — dieselbe Regel wie `leseKontext()`.
  Ordner werden eine Ebene tief gelesen, nicht rekursiv. Obergrenze 60 000 Zeichen je Block;
  was darueber liegt, wird abgeschnitten und im UI als solches gemeldet. Sonst blaest ein
  versehentlich gewaehlter Ordner jeden Prompt auf.
- **Der Tab zeigt, was wirklich gelesen wird** — je Quelle: gefunden ja/nein, Anzahl Dateien,
  Zeichen. Eine Quelle, die nichts liefert, muss als solche zu sehen sein; sonst glaubt Ben,
  die KI kenne etwas, das sie nie bekommen hat.
- **Platzhalter statt fester Einbau.** `{{firmenkontext}}` und `{{projektkontext}}` stehen in der
  Legende beider Prompt-Arten und koennen in jeden Prompt geschrieben werden. Zusaetzlich haengt
  der Standard-Vorspann sie am Ende an, damit es ohne Zutun wirkt. Ist nichts hinterlegt, sind
  beide leer — der Prompt sieht dann aus wie vorher.
- **Kein Anbau an `public/style.css`** (fremde Sitzung arbeitet daran, Stand `git status`):
  die Stile gehen in `public/einstellungen.css`, die seit v29 mir gehoert.
- **`public/ui.js` wird angefasst** (Tab-Liste + Seite) — das ist unvermeidlich, der Einhaenge-
  punkt liegt dort. Der Inhalt des Tabs steckt in der neuen `public/kontext.js`.

## Plan

- **v33-1** — `lib/kontextstore.js`: Ablage, Quellen lesen (lokal + Drive), `sammle()`.
- **v33-2** — `server.js`: `GET/PUT /api/kontext`, Quellen pruefen; `lib/ai.js` und
  `lib/promptstore.js` um die zwei Platzhalter erweitern.
- **v33-3** — `public/kontext.js` + Einhaengung in `public/ui.js` + Stile in `einstellungen.css`.
- **v33-4** — Verify: Screenshot des Tabs, Rundlauf ueber die API, und ein echter KI-Aufruf,
  bei dem der hinterlegte Kontext nachweislich im Prompt landet.

## Stand — gebaut und geprueft, 06.09.2026

| Phase | Ergebnis |
|---|---|
| v33-1 Ablage | `lib/kontextstore.js`: `data/kontext.json`, Quellen aus lokalen Dateien/Ordnern und aus Drive, `sammle()`, `uebersicht()` mit Quellen-Zustand, Schreibwege fuer Firma und Projekte. |
| v33-2 Server + Prompts | `GET/PUT /api/kontext`, `GET /api/kontext/probe`; `lib/ai.js` mit `KONTEXT_PLATZHALTER`, `baueSystem(override, kontext)`, `baueAufgabe(…, kontext)`; `lib/promptstore.js` reicht den Kontext durch und mischt die Platzhalter in JEDE Aufgaben-Legende; beide KI-Endpunkte in `server.js` sammeln den Kontext vor dem Aufruf. |
| v33-3 Oberflaeche | `public/kontext.js` (Tab-Inhalt), Einhaengung in `public/ui.js` an Position 5, Stile in `public/einstellungen.css`. |
| v33-4 Verify | siehe DoD. |

Der Tab sitzt zwischen „Social Media Kanäle" und „System Prompts" — Kontext gehoert vor die
Prompts, die ihn benutzen. Die Tab-Reihenfolge ist jetzt: Darstellung · Verbindungen · Externe
Dienste · Social Media Kanäle · **Unternehmenskontext** · System Prompts · Workflows.

## DoD

- [x] Tab „Unternehmenskontext" da: Firmen-Textfeld, Projekte anlegen/aendern/loeschen, Quellen
      je Block hinzufuegen und entfernen — ueber die Oberfläche durchgespielt: Text gespeichert,
      Projekt angelegt, Ordner-Quelle hinzugefuegt (Anzeige „2 Dateien · 99 Zeichen")
- [x] Quellen zeigen ihren Zustand — Ordner mit zwei Textdateien wurde als solcher gemeldet, die
      `.png` darin ignoriert, ein nicht vorhandener Pfad als Fehler gemeldet
- [x] `{{firmenkontext}}` und `{{projektkontext}}` stehen in der Legende beider Prompt-Arten und
      werden gefuellt — **echter KI-Lauf**: Firmenkontext „World Eden Era, NGO fuer
      Agraroekologie", Probe-Prompt „Antworte mit genau einem Wort: der Organisation aus dem
      Kontext oben", Ollama qwen2.5:32b antwortete `World Eden Era` (31 s)
- [x] Ohne hinterlegten Kontext ist der Prompt wie vorher: beide Platzhalter sind leer, der
      Vorspann endet auf `"n.\nAntworte auf Deutsch."`, kein `{{` bleibt im Prompt stehen
- [x] `node --check` gruen fuer `server.js`, `lib/ai.js`, `lib/promptstore.js`,
      `lib/kontextstore.js`, `public/ui.js`, `public/kontext.js`; Screenshots des Tabs (leer und
      gefuellt, inklusive der Probe-Anzeige)
- [x] Testdaten wieder entfernt: `data/kontext.json` steht auf leer, `data/prompts.json` ebenso

## Offen

- Die Verknuepfung mit Karten und Spalten (welches Projekt gilt fuer welche Karte) ist
  ausdruecklich NICHT Teil dieses Pakets [Owner, 05.09.2026]. Heute gehen alle aktiven Projekte
  zusammen in den Prompt; `sammle(projektId)` kann bereits ein einzelnes waehlen, es fehlt nur
  die Stelle, die das entscheidet.
- Der aeltere Drive-Weg `leseKontext()` in `server.js:197` (`Kontext/_global`, `Kontext/<reihe>`)
  laeuft unveraendert weiter und kann sich mit einer Drive-Quelle im neuen Tab ueberschneiden —
  dann steht derselbe Text zweimal im Prompt. Zusammenlegen waere ein eigenes kleines Paket.
