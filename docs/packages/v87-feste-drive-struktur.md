# v87 — Feste Drive-Struktur: Board prüft statt sich anzupassen

> Owner-Auftrag 30.09.2026: „Dass die Ordner im Drive nummeriert sind und in der
> Spaltenbezeichnung nicht, ist richtig so. Die Anzahl und Funktion der Spalten steht fest und
> soll sich nicht dynamisch an Drive anpassen, sondern wie an anderer Stelle schon eingebaut soll
> das Board diese Struktur selbst erstellen, wenn ein leerer Ordner im Drive ausgewählt wird, die
> Struktur ins Board laden, wenn sie korrekt erkannt wird, und falls der Ordner eine falsche
> Struktur hat, mit einem Fehlerlog kurz sagen, warum das Board nichts laden kann."

**Problem:** (Bestand gelesen 30.09.2026)
1. Das Board passt seine Spalten an Drive an: `lib/spalten.js` `reconcile()` übernimmt
   Umbenennungen aus Drive als neue Spaltennamen (v17b), `System (AI only)/spalten.json` führt
   Namen/Ordner/Reihenfolge, und der v85-Abgleich benennt Ordner um (Nummer nachziehen).
2. Doppelklick auf einen Spaltennamen benennt den Drive-Ordner um (`board.js` `starteUmbenennen`
   → `/api/spalten/rename`) — damit bricht ein Mensch im Board die feste Struktur.
3. Beim Ordnerwechsel (`lib/drivesetup.js` `pruefeOrdner`) gilt jeder Ordner mit
   „System (AI only)" als Board-Ordner und wird übernommen — ohne zu prüfen, ob die Spalten da
   sind. Fehlt etwas, merkt es niemand; Karten laufen ins Leere.
**Intent:** Eine feste, bekannte Struktur, die ein Mensch in Drive versteht (Grundsatz in
`docs/drive-convention.md`) — das Board erzeugt oder erkennt sie, verändert sie aber nie.
**Goal:**
1. Die Struktur steht fest im Code (eine Quelle, `PHASEN` in `lib/pipeline.js`):
   `In Bearbeitung/1 Idee … 6 Upload`, `Videoauswertung`, `Verworfen`, `System (AI only)`.
2. Ordnerwahl: leer → Struktur anlegen; Struktur vollständig → laden; sonst ablehnen mit
   kurzer Liste, was fehlt oder falsch ist.
3. Laufender Abgleich: passt die Struktur nicht (Ordner fehlt/umbenannt), lädt das Board nichts
   aus Drive, behält den Cache (v81-Kennzeichnung „Cache-Stand") und nennt den Grund im
   Drive-Log und als Meldung. Keine Umbenennung, kein Nachziehen mehr durch das Board.

## Plan

1. [x] `lib/pipeline.js`: `PHASEN[].ordner` auf die nummerierten Namen; neue Funktion
   `pruefeStruktur(liste)` (rein): erwartete Ordner fehlen / unerwartete Ordner unter
   „In Bearbeitung" → Sätze.
2. [x] `lib/drivesetup.js` `pruefeOrdner`: Arten `leer` / `board` (Struktur vollständig) /
   `falsch` (mit Sätzen) / `fremd`; `/api/drive/ordner/pruefen` + `setzen` lehnen `falsch` ab.
3. [x] Abgleich (`server.js` `abgleichEinmal`): statt `spalten.reconcile` EIN Listing der
   Struktur + `pruefeStruktur`; bei Fehlern Abbruch mit Grund (Drive-Log + Befund), Board bleibt
   beim Cache. Spalten-Resolver fest aus `PHASEN`.
4. [x] Spalten-Umbenennen entfernen (UI-Doppelklick, `/api/spalten/rename`, `benenneUm`) —
   je nach Owner-Entscheidung (s. u.).
5. [x] `spalten.json` wird nicht mehr gelesen/geschrieben (bleibt in Drive liegen, schadet nicht).
6. [x] Verify: Strukturprüfung mit nachgebautem Drive (vollständig / Ordner fehlt / umbenannt /
   leer); live: aktueller Drive-Ordner wird als korrekt erkannt, Abgleich-Zeit; Screenshot
   der Fehlermeldung.
7. [x] `docs/drive-convention.md` nachführen (feste Struktur statt v17b-Umbenennung).

## Owner-Entscheidungen (30.09.2026)

- Spalten umbenennen: **ganz entfernen**.
- Doppelte Projektordner: **aufräumen** (erledigt, s. v85 Status) — künftig meldet der Abgleich
  doppelte Projektordner als Befund.

## Status

30.09.2026 — Bestand gelesen, Plan angelegt.

30.09.2026 — Gebaut:
- `lib/pipeline.js`: `PHASEN[].ordner` fest nummeriert; `strukturOrdner()`, `pruefeStruktur()`
  (Sätze: „Der Ordner … fehlt." / „… muss … heißen." / „Unbekannter Ordner …").
- `lib/drivesetup.js`: `pruefeOrdner` mit den Arten leer/board/falsch/fremd (`lsf -R
  --max-depth 2`), `pruefSatz`; `legeStrukturAn` legt die feste Struktur + `LIESMICH.md` an
  (keine `.phase`-Marker, kein `spalten.json` mehr).
- `server.js`: Abgleich prüft die Struktur zuerst (`drive.ordnerBaum("", 2)`); Fehler → Abbruch
  mit Satz + Eintrag im Drive-Protokoll; `/api/board` liefert feste Spalten; Ordnerwahl lehnt
  „falsch" ab; `/api/spalten/rename` und der Spalten-Cache entfernt.
- `lib/projects.js`: Ordner fest aus `PHASEN`; doppelte Projektordner → Befund.
- `lib/spalten.js` gelöscht; `public/board.js`/`store.js`: Doppelklick-Umbenennen entfernt;
  `store.js` zeigt einen Strukturfehler zusätzlich als Meldung.
- Tests: Strukturprüfung 7 Fälle per `node -e` (vollständig / fehlt / umbenannt / Zusatzordner /
  alte Namen / ohne System / leer) — jeweils der erwartete Satz. `v87.test.mjs`
  (`node --experimental-test-module-mocks --test`): **5/5** — leer → Struktur angelegt und
  besteht die eigene Prüfung; vollständig → board; umbenannte Spalte → falsch mit Satz; fremd;
  **echtes Drive (nur lesend) besteht die Prüfung**. `node --check` auf allen JS-Dateien.

05.10.2026 — Abschluss-Prüfung:
- Fehlermeldung bei falscher Struktur, isolierte Testkopie (Scratchpad `board-test-3`, Port 4399, ohne echtes Drive; Strukturliste per Umgebungsvariable vorgegeben: „In Bearbeitung/Schnitt" statt „4 Schnitt"): `POST /api/drive/reconcile` antwortet
  „Das Board lädt nichts aus Drive, weil die Ordnerstruktur nicht stimmt: Der Ordner „In
  Bearbeitung/Schnitt" muss „In Bearbeitung/4 Schnitt" heißen." — im Board als Meldung und in der
  Kopf-Plakette (Screenshot).
- Spaltenköpfe (DOM): 8 Spalten „Skript schreiben … Verworfen", keine Nummer im Namen, kein
  Umbenennen-Hinweis.
- Echtes Drive besteht die Strukturprüfung (nur lesend, 30.09.2026, `v87.test.mjs` 5/5).
- Nicht live gemessen: Abgleich-Zeit mit dem v87-Code auf Bens Board (Board lief am 05.10.2026
  nicht; aus der Sandbox darf der echte Server nicht gestartet werden, s. Memory
  board-test-isoliert). Letzte Live-Messung vor v87: 8,8–9,8 s; v87 ersetzt zwei Drive-Aufrufe
  (spalten.json + Marker) durch einen.

05.10.2026 19:5x — Live-Messung auf Bens Board (Server gestartet 19:52:52, Code-Stand 274e345, client_id aktiv): `curl -sk -X POST -w "%{time_total}" https://localhost:4321/api/drive/reconcile` → 6,2 s und 7,4 s (vorher 8,8–9,8 s); 20 Karten, „Board und Drive stimmen ueberein". Ein dritter Lauf (0,8 s) hing sich an den Start-Abgleich an und zaehlt nicht.

05.10.2026 — Auf Owner-Ja die Reste der alten Umbenennen-Technik in den Drive-Papierkorb gelegt (9 Dateien: 8× `.phase`, `System (AI only)/spalten.json`; Skript `reste-entfernen.mjs`, danach 0 gefunden). Der Code liest sie nicht mehr (grep). Abgleich danach: 7,7 s, 20 Karten, „Board und Drive stimmen ueberein".

## Definition of Done

Geprueft gegen: Strukturprüfung-Tests 7 Fälle + 5/5, Screenshot Fehlermeldung (Testkopie), DOM Spaltenköpfe, Live-Abgleich 6,2/7,4 s
Offen: nichts
