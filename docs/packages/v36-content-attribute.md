# v36 — Content-Attribute: die Auswahllisten des Boards werden konfigurierbar

## PIG

**Problem:** Jede Auswahl, die eine Karte beschreibt, steht fest im Code. Gemessen in
`lib/pipeline.js`:

| Liste | Zeile | Eintraege | Was daran haengt |
|---|---|---|---|
| `ZIELE` | 258 | 4 | `tiefe` steuert den Laengen-Korridor (`korridor()`, Zeile 756); `kennzahl` steuert die Auswertung |
| `INHALTSKATEGORIEN` | 453 | 5 | Anzeige, Verteilung (`saeulenVerteilung`, Zeile 1018), Rotation im Redaktionsplan |
| `CONTENTTYPEN` | 441 | 6 | `format` geht in den Video-Dateinamen; `ZEITFENSTER` im Scheduler haengt an der Id |
| `SAEULEN` | 248 | 5 | **nirgends benutzt** — `saeuleName()` zeigt auf `INHALTSKATEGORIEN` (Zeile 325/461). Tote Liste. |
| `PLATTFORMEN` | 291 | 5 | Hashtag-Limits, Korridore, OAuth-Anbindung |

Wer eine Kategorie „Projekt-Einblick" oder ein Ziel „Vertrauen aufbauen" braucht, muss den Code
aendern. Und jedes dieser Attribute traegt heute nur einen Anzeigesatz — kein Wissen darueber,
WIE ein Text dieser Art geschrieben werden soll. Die KI erfaehrt „Kategorie: Bildung" und muss
sich den Rest denken.

**Intent:** Die Auswahllisten des Boards gehoeren dem Nutzer, nicht dem Code. Und jedes Attribut
soll sagen koennen, was es fuer den Text bedeutet — als kurzer Prompt-Baustein, der beim
Generieren mitwirkt.

**Goal:** Ein Tab „Content-Attribute" in den Einstellungen, in dem man
1. **Kategorien** anlegt (Ziel, Inhalt, Format, und beliebige eigene),
2. je Kategorie **Attribute** anlegt (Bildung, Projekt-Einblick, …),
3. hinter jedes Attribut einen **kurzen Prompt** schreibt, der beim Generieren mitgeht,
4. und diese Kategorien ziehen sich durch das ganze Board: Auswahlfelder an der Karte,
   Verteilung im Redaktionsplan mit **einstellbaren Intervallen** je Attribut.

---

## Der zentrale Konflikt — und wie er aufgeloest wird

Frei konfigurierbare Listen und fest verdrahtete Logik vertragen sich nicht. Drei Beispiele aus
dem Bestand:

- `korridor(plattform, ziel)` liefert Sekunden, weil `ziel.tiefe` ein `true`/`false` traegt.
  Ein selbst angelegtes Ziel haette dieses Bit nicht — der Korridor waere undefiniert.
- Der Video-Dateiname nutzt `contenttyp.format`. Ein neuer Typ ohne `format` bricht die
  Namenskonvention.
- Der Redaktionsplan platziert Slots ueber `ZEITFENSTER[typ]` (`lib/scheduler.js`, Zeile 31).
  Ein neuer Typ ohne Zeitfenster kann nicht platziert werden.

**Aufloesung: Ein Attribut kann Logik-Merkmale MITTRAGEN.** Neben Name, Satz und Prompt hat ein
Attribut optionale Felder, die genau diese drei Stellen bedienen: `tiefe` (Ziel), `format`
(Content-Typ), `zeitfenster` (Content-Typ). Das UI zeigt sie nur dort, wo die Kategorie sie
braucht. Fehlt ein Merkmal, greift ein benannter Standard — und das UI sagt, welcher.

**Zweite Aufloesung: System-Kategorien.** Die drei Kategorien `ziel`, `kategorie` und
`contenttyp` behalten ihre feste Id, weil der Code sie beim Namen kennt (Karten-Felder `goal`,
`kategorie`, `contenttyp`; Tore; KPI; Dateiname). Sie sind **nicht loeschbar und nicht
umbenennbar in der Id** — ihre Attribute dagegen sind frei. Selbst angelegte Kategorien sind
reine Beschreibungs- und Prompt-Dimensionen ohne Logik.

**Abgrenzung: `PLATTFORMEN` bleibt fest.** Daran haengen echte Aussenwelt-Grenzen — Hashtag-
Limits, OAuth-Anbindung, KPI-Abruf. Eine selbst angelegte Plattform waere ein Feld, das nirgends
hinfuehrt. Wer eine neue Plattform braucht, braucht Code, nicht ein Formular.

**`SAEULEN` wird geloescht.** Fuenf Eintraege, die niemand liest — beim Umbau faellt die tote
Liste weg statt in den Katalog zu wandern.

---

## Datenmodell

`data/attribute.json`:

```
{
  "kategorien": [
    {
      "id": "ziel",                 // System-Kategorie: feste Id, nicht loeschbar
      "name": "Ziel",
      "system": true,
      "mehrfach": false,            // eine Auswahl je Karte (bei Plattformen waere es true)
      "logik": "ziel",              // welche Logik-Merkmale die Attribute tragen duerfen
      "attribute": [
        {
          "id": "reach_new",
          "name": "Neue Leute erreichen",
          "satz": "Weiterleitungen sind das Signal fuer Nicht-Follower.",
          "prompt": "Schreib fuer Menschen, die uns noch nicht kennen: keine Insider-Begriffe, …",
          "kennzahl": "Weiterleitungen je Reichweite",
          "tiefe": false
        }
      ]
    }
  ]
}
```

Gespeichert wird der **volle Katalog**, nicht die Abweichung — anders als bei
`data/workflows.json`. Begruendung: Attribute sind Bens Inhalt, kein Standard, von dem er
abweicht. Beim allerersten Start wird der Katalog aus den heutigen Listen erzeugt (Migration),
danach ist er die Wahrheit.

---

## Wie der Prompt davon erfaehrt

Genau wie der Unternehmenskontext (v33/v34): ein Platzhalter. Neu ist `{{attributkontext}}` —
er sammelt die Prompt-Bausteine der auf der Karte gewaehlten Attribute:

```
Eigenschaften dieses Beitrags:
- Ziel „Neue Leute erreichen": Schreib fuer Menschen, die uns noch nicht kennen …
- Inhalt „Bildung": Erklaer eine Sache vollstaendig, statt mehrere anzureissen …
```

Der Platzhalter steht in der Legende jeder Aufgabe und haengt im Standard-Vorspann hinter
`{{projektkontext}}`. Attribute ohne Prompt-Text tauchen nicht auf — ein leerer Aufzaehlungs-
punkt waere schlechter als keiner.

---

## Wie der Redaktionsplan davon erfaehrt

Heute stehen die Stellschrauben je Kategorie fest in `public/redaktionsplan.js`: `typenmix`
(`perWoche` je Content-Typ), `kategorienFokus` (`aktiv` + `prioritaet`), `zielgewichte`
(`gewicht` in Prozent) — drei verschiedene Formen fuer drei Listen.

Neu: **eine Form fuer jede Kategorie.** Je Attribut ein Intervall, in derselben Darstellung:

- **Formate** behalten `perWoche` (2 Reels, 0,75 Slider …) — daraus entstehen die Slots.
- **Alle uebrigen Kategorien** bekommen ein **Gewicht**, nach dem der Scheduler rotiert.

Der Scheduler (`lib/scheduler.js`) bekommt statt der drei festen Achsen eine Schleife ueber die
Kategorien des Katalogs. Seine bewaehrte Rotationslogik (`waehleKategorie`, `waehleZiel`, Zeile
154–202) bleibt — sie wird nur nicht mehr dreimal getippt.

**Zeitfenster:** Sie haengen am Content-Typ und stehen kuenftig als Merkmal am Attribut. Legt
Ben einen neuen Typ ohne Zeitfenster an, sagt der Plan das — statt den Typ still nie zu planen.

---

## Plan (Phasen, in dieser Reihenfolge)

- **v36-1 — Katalog und Migration.** `lib/attributstore.js`: Datenmodell, Lesen/Schreiben,
  Erstbefuellung aus den heutigen Listen, Beweis: der erzeugte Katalog enthaelt alle 15
  Attribute (4 Ziele + 5 Kategorien + 6 Typen) mit identischen Ids.
- **v36-2 — Eine Quelle statt fuenf Listen.** `lib/pipeline.js` liest die Listen aus dem
  Katalog; `zielInfo`, `kategorieName`, `contenttypName` bleiben als Namen erhalten (sie werden
  17, 14 und 16 Mal benutzt) und bekommen nur eine neue Datenquelle. `SAEULEN` faellt weg.
  Beweis: alle bestehenden Karten zeigen unveraenderte Namen.
- **v36-3 — Server + Prompts.** `GET/PUT /api/attribute`; `{{attributkontext}}` in `lib/ai.js`
  und `lib/promptstore.js`, gesammelt aus der Karte.
- **v36-4 — Tab „Content-Attribute".** Kategorien anlegen/umbenennen/loeschen (System-Kategorien
  geschuetzt), Attribute je Kategorie mit Name, Satz, Prompt und den Logik-Merkmalen.
- **v36-5 — Board zieht mit.** `public/detail.js` baut die Auswahlfelder aus dem Katalog statt
  aus den Importen.
- **v36-6 — Redaktionsplan.** `public/redaktionsplan.js` und `lib/scheduler.js` auf die eine
  Form umstellen; Intervalle je Attribut einstellbar.
- **v36-7 — Verify.** Neues Attribut mit Prompt anlegen, an einer Karte waehlen, echter KI-Lauf,
  der den Prompt-Baustein nachweislich befolgt; Redaktionsplan mit dem neuen Attribut rechnen.

## Risiken, benannt

- **Der groesste Eingriff bisher.** `lib/pipeline.js` ist die eine Wahrheit des Boards und wird
  von 8 Dateien importiert. Deshalb die Reihenfolge: erst Katalog (v36-1), dann Umschalten der
  Quelle bei gleichbleibenden Namen (v36-2) — jede Phase fuer sich pruefbar.
- **Parallele Sitzungen.** `public/detail.js`, `public/redaktionsplan.js` und `public/store.js`
  werden auch von anderen Sitzungen angefasst. Vor v36-5 und v36-6 pruefe ich `git status` und
  stimme mich ab, statt fremde Arbeit mitzucommitten.
- **Ein Attribut loeschen, das Karten benutzen.** Der Katalog muss beim Loeschen sagen, wie
  viele Karten daran haengen, und die Karten auf „nicht gesetzt" zuruecksetzen — nicht auf eine
  Id zeigen lassen, die es nicht mehr gibt.
- **Prompt-Laenge.** Jedes Attribut bringt Text mit. Bei drei Kategorien à einem Absatz waechst
  jeder Prompt spuerbar. Gegenmittel wie bei v33: Obergrenze, und im Tab steht, wie viele
  Zeichen der Attribut-Block gerade beitraegt.

## Stand

- (wird beim Abschluss nachgefuehrt)

## DoD

- [ ] Migration: der erzeugte Katalog enthaelt alle heutigen Ids; kein Kartenfeld aendert
      seinen angezeigten Namen (Beweis: Vergleich vorher/nachher ueber alle 17 Karten)
- [ ] Eigene Kategorie mit eigenem Attribut anlegbar; erscheint an der Karte zur Auswahl
- [ ] `{{attributkontext}}` in der Legende, gefuellt aus der Karte, belegt an einem echten
      KI-Lauf, der den hinterlegten Attribut-Prompt nachweislich befolgt
- [ ] Redaktionsplan zeigt jede Kategorie mit ihren Attributen und einstellbarem Intervall;
      ein neu angelegtes Attribut wird eingeplant
- [ ] Attribut loeschen meldet betroffene Karten und laesst keine toten Ids zurueck
- [ ] `node --check` gruen, Screenshots von Tab, Karte und Redaktionsplan
