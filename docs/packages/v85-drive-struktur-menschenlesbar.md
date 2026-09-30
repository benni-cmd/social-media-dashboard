# v85 — Drive-Struktur: für Menschen lesbarer, für die Abfrage einfacher

> Owner-Auftrag 30.09.2026: „Lässt sich die Ordnerstruktur im Drive nochmal besser oder
> logischer aufbauen, um die Abfrage simpler zu gestalten? Dabei soll immer beibehalten werden,
> dass Drive der Point of Truth ist und man als Mensch auch aus dem Drive arbeiten kann, wenn
> das Board ausfallen sollte. Dieses Ziel fest verankern."
> Verankert: `docs/drive-convention.md`, Abschnitt „Grundsatz" (+ Verweis im README).

**Problem:** Gemessen 30.09.2026 (`rclone lsf -R --fast-list --max-depth 5`, 216 Einträge):
1. Drive sortiert die Spaltenordner alphabetisch — Caption, Idee, Schnitt, Skript, Upload,
   Videodreh — nicht in Arbeitsreihenfolge. Wer ohne Board arbeitet, sieht die Pipeline durcheinander.
2. Projektordner heißen zusammengeschrieben und nach 32 Zeichen abgeschnitten
   (`JungbodenschutzmitnatuerlichenMi`, `BodentestimGlasErkennedeineBoden`).
3. Termine, Uploaddatum, Kategorie und Ziel stehen nur in `(AI only)/projekt.json` — ein
   Mensch ohne Board sieht nicht, wann was fällig ist.
4. Die Abfrage selbst ist nach v84 schon schlank: Abgleich 8,8–9,8 s live
   (`curl -X POST /api/drive/reconcile`), 5 rclone-Aufrufe.
**Intent:** Grundsatz aus `docs/drive-convention.md` erfüllen — ohne Board arbeitsfähig — und
die Abfrage dabei nicht komplizierter, sondern einfacher machen.
**Goal:** Ein Mensch, der nur Drive öffnet, sieht die Phasen in Arbeitsreihenfolge, liest die
Projektnamen im Klartext und findet Termine/Stand je Projekt in einer lesbaren Datei; der
Abgleich bleibt ≤ 10 s.

## Optionen (Owner-Entscheidung offen)

| # | Änderung | Nutzen Mensch | Nutzen Abfrage | Risiko |
|---|---|---|---|---|
| A | Spaltenordner nummerieren: `1 Idee` … `6 Upload` (Board zeigt Namen ohne Nummer) | hoch: Reihenfolge stimmt | keiner | niedrig: 6 Ordner umbenennen; `.phase`-Marker erkennen die Umbenennung schon heute |
| B | `Steckbrief.md` je Projekt (Phase, Termine, Kategorie, Ziel, nächster Schritt), vom Board bei jedem Speichern mitgeschrieben | hoch: Stand ohne Board lesbar | keiner | niedrig: nur eine Datei mehr; Wahrheit bleibt projekt.json |
| C | Klartext-Projektnamen mit Leerzeichen für NEUE Projekte (`Bienen und ihre Blumenfreunde`) | mittel–hoch | keiner | mittel: Pfadprüfung/Slug anpassen; alte Ordner bleiben oder werden einmalig migriert |
| D | Abgleich in EINEM rclone-Aufruf (`lsjson -R --hash` ab Wurzel: Projektordner + Marker zusammen) | keiner | ~3–4 s schneller | niedrig: nur Code, Struktur bleibt |
| E | Alle Phasen unter einen Ordner (Videoauswertung/Verworfen umziehen) | gering | 1–2 Aufrufe weniger | hoch: KPI-Tabellen, Links, Gewohnheiten — **nicht empfohlen** |

Empfehlung: A + B + D. C nur für neue Projekte, falls gewünscht. E nicht.

## Entscheidung (Owner, 30.09.2026)

A, B und C. D nicht, E nicht. C nur für NEUE Projekte; bestehende Ordner bleiben.

## Plan

1. [x] **A Nummerierung** (`lib/spalten.js`): Spaltenordner unter „In Bearbeitung" heißen
   `<Nr> <bisheriger Ordnername>` in Board-Reihenfolge (1 Idee … 6 Upload). Der Abgleich zieht
   fehlende/falsche Nummern selbst nach (`moveDir`, Inhalt wandert mit, Marker bleibt) und meldet
   es als Satz; im Ruhezustand kein Zusatz-Aufruf (Marker am Soll-Ort gefunden = fertig).
   Umbenennung im Board behält die Nummer; Hand-Umbenennung in Drive: Anzeigename ohne Nummer.
   Wurzel-Phasen (Videoauswertung, Verworfen) bleiben ohne Nummer.
2. [x] **A Folgefehler beheben:** zwei Stellen bauen den Projektpfad aus den FESTEN
   Standard-Ordnern statt aus dem Drive-Stand (`server.js` Kalender-Link-Liste,
   `public/detail.js` „In Drive öffnen") — nach A zeigten sie ins Leere. Auf den
   Spalten-Stand umstellen.
3. [x] **B Steckbrief** (`lib/projects.js`): `Steckbrief.md` im Projektordner, geschrieben
   überall dort, wo `projekt.json` geschrieben wird (Anlegen, Verschieben, Speichern, Abgleich),
   nur wenn sich der Inhalt geändert hat. Inhalt: Titel, Phase + was zu tun ist, Format,
   Kategorie, Ziel, Plattformen, Termine. Kopfzeile: Datei wird vom Board geschrieben; Phase
   ändern = Ordner verschieben.
4. [x] **C Klartext-Namen** (`lib/pipeline.js` `projektNameNeu`): Leerzeichen und Umlaute
   bleiben, nur in Windows/Drive unzulässige Zeichen fallen weg, Kürzung an Wortgrenze
   (≤ 60 Zeichen); mit Reihe: `<Reihe> EP<NN> – <Thema>`.
5. [ ] Verify: Drive-Baum per `rclone lsf` vorher/nachher, Abgleich-Zeit live, Board-Screenshot
   (Spaltennamen ohne Nummer, „In Drive öffnen" trifft), Steckbrief einer Karte gelesen.
6. [x] `docs/drive-convention.md` Strukturbild + Namensregel nachführen.

## Status

30.09.2026 — Bestand gemessen, Grundsatz verankert, Optionen aufgestellt.

30.09.2026 — A gebaut (`lib/spalten.js` `sollOrdner`/`ohneNummer`, Nummerierung im Abgleich,
`benenneUm` behält die Nummer; `server.js` + `public/detail.js` bauen Pfade aus dem
Spalten-Stand, `projects.js` exportiert `projektPfadDyn`).
- Vorab gemessen an einem Wegwerf-Ordner (`Papierkorb/_v85test umbenannt`, bleibt dort liegen):
  `rclone move` benennt den ganzen Ordner in EINEM Schritt um (2,9 s), Unterordner und Dateien
  wandern mit, der alte Ordner ist danach weg.
- Logik-Test mit nachgebautem Drive (`node --experimental-test-module-mocks --test`, Skript im
  Session-Scratchpad `spalten-mock.test.mjs`): **5/5** — Erstlauf nummeriert 1–6 und behält die
  Anzeigenamen; Zweitlauf nur 1 Drive-Aufruf (Marker lesen), nichts geschrieben; Nummer von Hand
  entfernt → kommt zurück, Anzeigename bleibt; Ordner von Hand umbenannt → Board folgt, Nummer
  bleibt; Umbenennen im Board → `6 Veroeffentlichen`.
- Bewusst NICHT gegen das echte Drive ausgeführt: Bens laufender Server kennt die alten Pfade und
  würde beim Speichern die alten Ordner neu anlegen. Die Umbenennung macht Bens Server beim
  ersten Abgleich nach dem Neustart selbst.

30.09.2026 — B gebaut (`lib/projects.js` `steckbrief()`, `schreibeSteckbrief()`,
`steckbriefeAbgleichen()`; `server.js` startet den Steckbrief-Abgleich nach jedem Drive-Abgleich
im Hintergrund). Geschrieben wird nur bei geändertem Inhalt (MD5 gegen Drive bzw. letzten
Schreibstand); kein Zeitstempel in der Datei. Probe mit echter Karte aus `data/board.json`
(„Oberflächenspannung von Wasser", Phase Schnitt) erzeugt: Phase + Ordner, Zu tun, Danach,
Format, Kategorie, Ziel, Plattformen, vier Termine.
Erstlauf nach Neustart: 17 Steckbriefe à ~2,5 s ≈ 40 s im Hintergrund (einmalig); danach nur
3 md5sum-Aufrufe je Abgleich.

30.09.2026 — C gebaut (`lib/pipeline.js` `klartext()`, `projektNameNeu`; Alt-Migration in
`migriere()` nutzt die alte Regel `projektNameAlt`). Probe `node -e`: „Bienen und ihre
Blumenfreunde", „World Eden EP03 – Boden wie ein Schwamm", Sonderzeichen-Titel →
„Was Warum Kompost Tee 1 100", leerer Titel → „Ohne Titel", langer Titel an Wortgrenze auf 55
Zeichen; alle `pfadstueckOk`; Karte mit driveName behält ihn.

## Definition of Done

Geprueft gegen: `rclone lsf -R` Vorher/Nachher, Abgleich-Zeit live, Board-Screenshot
Offen:
1. Board neu starten (Ben) — der erste Abgleich nummeriert die Spaltenordner, danach schreibt
   der Hintergrund-Abgleich die Steckbriefe
2. Live-Prüfung danach (Agent): `rclone lsf` Drive-Baum, Steckbrief lesen, Abgleich-Zeit,
   Board-Screenshot (Spaltennamen ohne Nummer, „In Drive öffnen")
