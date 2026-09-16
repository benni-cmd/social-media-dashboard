# Arbeitspaket v23 — Wochentag-Muster-Widget (Auswertung)

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 16.09.2026.
> Status: PLAN zur Abnahme — noch kein Bau. Zweck: die Essenz der Owner-Idee festhalten
> und die wenigen echten Entscheidungen sichtbar machen, bevor gebaut wird.

**Problem:** Die Auswertung zeigt Zahlen je Beitrag und je Plattform, aber nicht das
**zeitliche Muster**: An welchen Wochentagen wurde was veröffentlicht, und wie lief es?
Der Owner will erkennen, welcher Wochentag für welche Post-Art am besten trägt.

**Intent:** Ein Widget, das die Wochentage als Spalten nebeneinanderstellt und je Wochentag
zeigt: wie viele Posts welcher Art dort schon veröffentlicht wurden, wie viel Aufrufe und
Interaktionen die Arten dort erzielt haben, plus einen Gesamtdurchschnitt je Wochentag —
damit „wann welches Format posten" auf Daten statt Bauchgefühl beruht.

**Goal:** Ein neuer Abschnitt auf der Auswertung-Seite (Dark-Theme, `ui.js`-Bausteine),
der ohne neue Datenquelle aus `S.cards` + `S.zahlen`/`S.zahlenLi` rechnet (respektiert den
api|drive-Toggle automatisch) und datenehrlich leere Zellen als „—" zeigt.

---

## So verstehe ich die Essenz (bitte gegenprüfen)

Eine **Matrix**: Spalten = die 7 Wochentage (Mo–So). Zeilen = die Post-Arten
(Reel, Slider, Beitrag, Story, Highlight, Langformat — aus `contenttyp`). Jede Zelle
(Wochentag × Art) zeigt für die dort schon veröffentlichten Posts:
- **Anzahl** Posts dieser Art an dem Wochentag,
- **Aufrufe** und **Interaktionen** (als Kennzahl der Art an dem Tag).

Unter jeder Wochentag-Spalte eine **Gesamtzeile**: Anzahl aller Posts + **Gesamtdurchschnitt**
(Aufrufe/Interaktionen je Post) für diesen Wochentag über alle Arten.

Ableitung je Post:
- **Wochentag** = Wochentag des echten Veröffentlichungsdatums (IG `medium.timestamp`,
  LI `erstellt`; Fallback `card.dates.upload`).
- **Art** = `card.contenttyp` (Klarname via `contenttypName`).
- **Aufrufe/Interaktionen** = aus dem zugeordneten Beitrag (`karteZuBeitrag`/`karteZuLinkedin`),
  wie schon im Plattform-Vergleich (`igAlsPosts` / `li.posts`).
- Nur **veröffentlichte** Posts mit bekanntem Datum zählen; Geplantes/Entwürfe nicht.

---

## Entscheidungen (getroffen, Owner 16.09.2026)

1. **Zellenwert = Ø je Post** (Durchschnitt), Anzahl separat daneben. Gesamtzeile je
   Wochentag = Ø über alle Posts des Tages.
2. **Plattformen zusammengefasst** (IG+LI addiert). Hinweis im Widget: LI-Aufrufe erst mit
   API-Freigabe/Drive vollständig — bis dahin zählen dort v. a. IG-Aufrufe.
3. **„Art" = `contenttyp`** (Reel/Slider/Beitrag/Story/Highlight/Langformat), Klarname via
   `contenttypName`.
4. **Interaktionen** = `total_interactions` (IG) bzw. Likes+Kommentare+Shares+Klicks (LI) —
   konsistent zum Plattform-Vergleich (v20).
5. **Form:** einklappbare Gruppe „Wochentag-Muster"; 7 Spalten, auf Handy quer scrollbar.

---

## Plan (nach Abnahme der Entscheidungen)

1. [ ] `wochentagDaten(ig, li, igOn, liOn)` — Posts sammeln, je {wochentag, art, aufrufe,
       interaktionen}; nach Wochentag × Art aggregieren (Anzahl, Ø/Σ je Entscheidung 1).
2. [ ] `wochentagWidget()` — Matrix rendern (Spalten Mo–So, Zeilen Arten, Gesamtzeile),
       Leerzellen „—", Dark-Theme-Tokens.
3. [ ] In `zeichneAuswertung` einhängen (Abschnitt/Gruppe), CSS `.wochentag-*`.
4. [ ] Verify: echter Edge-headless-Screenshot (Matrix, Zahlen plausibel, Leerzustände),
       Konsole ohne Fehler.
5. [ ] Commit + Push; Paket nachführen.

---

## Stand

16.09.2026 — Plan angelegt, Bestand geprüft (Daten vollständig ohne neue Quelle). Essenz +
Entscheidungen 1–5 mit Owner abgenommen (Ø je Post, Plattformen zusammengefasst, contenttyp,
total_interactions, einklappbare Gruppe). **Bau-bereit** — wartet nur noch auf „los".

---

## Definition of Done

Geprueft gegen: echter Screenshot der Matrix (Wochentage als Spalten, Arten als Zeilen,
Anzahl+Aufrufe+Interaktionen je Zelle, Gesamtdurchschnitt je Wochentag) · Konsole ohne Fehler
· Leerzustände datenehrlich.
Offen: alles — Plan zur Abnahme; Entscheidungen 1–5 noch offen.
