# v77 — Deadline-Vorlauf-Offsets in Drive als Wahrheit (Verifikation)

> Ergebnis: **verifiziert, kein Codebedarf.** Die editierbaren Offsets liegen bereits in
> Drive und werden beim Laden von dort abgeglichen. Kein Code geaendert — nur dieses Paket.

## PIG

**Problem (zu pruefen):** Die editierbaren Deadline-Vorlauf-Offsets des Workflows
`rueckwaertsplan` (Params `freigabeVorUpload` / `schnittVorFreigabe` / `drehVorSchnitt`,
UI: Ansicht-Tab „Deadline-Vorlauf", v70b) muessen im **Google Drive als Wahrheitsquelle**
hinterlegt sein und bei jedem Laden von dort abgeglichen werden — nicht nur im lokalen
`data/workflows.json`-Cache.

**Intent (Owner 28.09.2026):** Dieselbe Haerte wie beim v60-Muster fuer alle
firmen-/projektbezogenen Inhalte: Wahrheit in Drive, lokal nur Cache, Abgleich beim Laden,
kein Datenverlust.

**Goal:** Beweisen, dass ein Offset-Edit in der Drive-Datei landet und nach Loeschen der
lokalen Cache-Datei aus Drive wiederhergestellt wird. Falls Luecke: minimal-invasiv nach
`planstore.js`-Muster in `lib/workflowstore.js` haerten.

## Befund (kein One-Shot — alles am laufenden System geprueft)

**Die Offsets lagen bereits in Drive.** `lib/workflowstore.js` folgt seit v60 exakt dem
`planstore.js`-Muster (Wahrheit Drive, Cache lokal, 20s-Timeout, Cache-Fallback,
Migration ohne Verlust). Keine Luecke gefunden.

Code-Beleg (`lib/workflowstore.js`):
- `DRIVE_PFAD = "System (AI only)/workflows.json"` (Z. 25) — wie prompts/defaults v60.
- `schreib()` (Z. 101–109): schreibt **zuerst lokal** (`schreibCacheRoh` → kein Datenverlust),
  **dann Drive** (`schreibDriveRoh`); Drive-Fehler wird geloggt, blockiert nicht.
- `liesRoh()` (Z. 62–88): liest lokal + Drive; **Drive gewinnt** (`if (ausDrive != null) return ausDrive`),
  frischt bei Abweichung den Cache auf; Drive-Stoerung → Cache-Fallback; Datei fehlt in Drive →
  lokalen Stand einmalig hochschreiben (Migration).
- `setze()` (Z. 122–147) schreibt jeden Offset-Edit ueber `schreib()`.
- Verdrahtung `server.js`: `PUT /api/workflows` → `workflows.setze(id,{an,params})` (Z. 845–848);
  `workflows.setzePfad(DATA_DIR/workflows.json)` (Z. 68). Unveraendert korrekt.

Vergleich Referenz: `planstore.js` = Drive-Wahrheit mit Fingerprint-Reconcile (identisches
Timeout/Fallback-Muster). `kontextstore.js` nutzt Drive nur als **Quellen-Leser** fuer Kontext,
seine eigene Config (`data/kontext.json`) ist lokal — daher ist `planstore.js` das passende
Vorbild, und `workflowstore.js` deckt sich damit 1:1.

## Belege (laufendes System, :4321 + lib/drive.js, 28.09.2026)

1. **Ausgangsstand** — `curl -sk GET /api/workflows` und `drive.readFile("System (AI only)/workflows.json")`
   liefern **beide** die Offsets, byte-gleich (freigabeVorUpload=3, schnittVorFreigabe=3,
   drehVorSchnitt=7 — Vorstand vor Restore). → Offsets liegen in Drive.
2. **Edit landet in Drive** — `curl -sk -X PUT /api/workflows -d '{"id":"rueckwaertsplan","params":{"drehVorSchnitt":9}}'`
   → Server-Antwort `wert=9`; direkt danach `drive.readFile(...)` → `drehVorSchnitt=9` in der **Drive**-Datei.
3. **Reconcile aus Drive nach Cache-Loeschung** — `rm data/workflows.json` (Datei weg bestaetigt),
   dann `curl -sk GET /api/workflows` → `drehVorSchnitt=9` (aus Drive), und `data/workflows.json`
   ist neu angelegt und enthaelt wieder `drehVorSchnitt=9`. Nichts ging verloren.
4. **Owner-Standard wiederhergestellt** — `PUT` mit `{freigabeVorUpload:3,schnittVorFreigabe:3,drehVorSchnitt:6}`
   → Server-Antwort `3 3 6`; `drive.readFile(...)` → `3 3 6` in Drive. Endstand = Owner-Standard 3/3/6.

## Stand

- [x] `lib/workflowstore.js` ganz gelesen; 1:1-Abgleich gegen `planstore.js`/`kontextstore.js` — deckt sich mit planstore.
- [x] Beleg 1: Offsets liegen in Drive (`System (AI only)/workflows.json`).
- [x] Beleg 2: Offset-Edit via `PUT /api/workflows` landet in Drive.
- [x] Beleg 3: Nach Loeschen des lokalen Cache wird der Offset aus Drive wiederhergestellt (Reconcile beim `lies()`), Cache neu angelegt.
- [x] Beleg 4: Owner-Standardwerte 3/3/6 wiederhergestellt (lokal + Drive).
- [x] Kein Code geaendert (keine Luecke) — nur dieses Paket committet.

## DoD

- Offset-Edit landet in Drive und uebersteht das Loeschen der lokalen Datei (aus Drive wiederhergestellt). ✓
- `lib/workflowstore.js` liest Drive als Wahrheit mit Cache-Fallback, schreibt lokal-dann-Drive. ✓
- Endstand = Owner-Standard 3/3/6, lokal und in Drive. ✓

## Nicht verifiziert / offen

- Keine echte Drive-Stoerung (Timeout/offline) provoziert; der Cache-Fallback ist nur aus dem
  Code belegt, in dieser Sitzung nicht ausgeloest.
- Nur `rueckwaertsplan.drehVorSchnitt` als Edit-Sonde benutzt; die beiden anderen Offsets teilen
  denselben `setze()`/`schreib()`-Pfad, wurden aber nur mitgeschrieben, nicht einzeln geloescht/wiederhergestellt.

Geprueft gegen: `lib/workflowstore.js` (v60-Muster), `lib/planstore.js` (Referenz), `server.js`
(Verdrahtung), laufendes System :4321 + `lib/drive.js` (Belege 1–4) · Offen: nichts (Ziel erfuellt).
