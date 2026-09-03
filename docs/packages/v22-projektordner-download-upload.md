# v22 — Projektordner-Download + Video-Upload im Kartendetail

## PIG

**Problem:** Rohmaterial, Skript und fertiges Video liegen im Drive-Projektordner, aber das
Board hat keinen direkten Griff darauf. Wer in der Leiste „Videoschnitt"/`schnitt` an einer
Karte arbeitet, muss haendisch in Drive navigieren, den Ordner suchen, runterladen — und das
fertige Video wieder haendisch hochladen und die Karte von Hand weiterschieben.

**Intent:** Den Drive-Ordner einer Karte direkt aus dem Board bedienbar machen — ein Klick
zum Runterladen des Projektordners (Rohmaterial + Skript, **nur Dateien fuer Menschen**),
ein Drag&Drop-Feld zum Hochladen des fertigen Videos, das die Karte automatisch in die
naechste Phase schiebt. [Owner, 02.09.2026]

**Goal:** Im Seitenmenue einer Karte (mind. Phase `schnitt`) liegt ein **Download-Button**,
der den Projektordner als ZIP liefert (gefiltert auf Menschen-Dateien), und ein
**Drag&Drop-Upload-Feld**, in das das fertige Video gezogen wird: es landet in Drive und die
Karte wandert in die naechste Phase. Alles laeuft in-Dashboard ueber rclone — kein Umweg
ueber die Drive-Website. UI-Abnahme per Screenshot besteht.

---

## Bestand (geprueft 02.09.2026)

- Drive-Anbindung = **rclone-CLI**, lokal, eigene client_id (Remote `[gdrive]`). Der Server
  ruft rclone ueber `lib/drive.js` → `rclone(args)` (Zeile 227). **Nicht** die Google-Drive-
  Desktop-App, **nicht** ein gemountetes Laufwerk.
- Vorhandene Helfer (`lib/drive.js`): `existiert, mkdir, writeFile(rcat), readFile(cat),
  list, count, link, moveDir, purge, deleteFile, erreichbar`.
- **Luecke Binaer:** `readFile`/`writeFile` gehen ueber die string-sammelnde `rclone()`-Hilfe
  (`out += d`, Zeile 270) → korrumpiert Video. Braucht eigene Kopier-Helfer, die NICHT ueber
  den String-Puffer laufen.
- **Luecke Multipart:** kein `multer`/`busboy`/`formidable` im Projekt (grep leer).
- Server-Endpunkte gegen Drive heute: nur `drive.list`/`drive.readFile` (server.js:167/174)
  und `drive.erreichbar` (416). Kein Download/Upload-Endpunkt.

---

## Feasibility (beantwortet: JA, in-Dashboard)

- **Download:** `rclone copy gdrive:<projektpfad> <tempdir> --files-from/-filter` → Node zippt
  `<tempdir>` → Stream an den Browser (`Content-Disposition: attachment`). Kein Drive-Link.
- **Upload:** Browser Drag&Drop → multipart POST → Node schreibt Temp-Datei →
  `rclone copyto <temp> gdrive:<projektpfad>/<name>` → danach Karte in naechste Phase.
- Beides braucht **keinen** Drive-Website-Umweg und **keine** Drive-Desktop-App.

---

## Design-Entscheidungen (Owner, 02.09.2026 — bestaetigt)

Projektordner-Struktur (Vertrag `lib/pipeline.js:512` `UNTERORDNER` + `AI_ORDNER`):
`projekt.json` · `Skript und Caption/` · `Rohmaterial/` · `Fertiges Video/` · `System (AI only)/`.

- **„Nur Dateien fuer Menschen" = zwei benannte Unterordner, GETRENNT herunterladbar:**
  `Skript und Caption/` und `Rohmaterial/`. NICHT herunterladbar: `System (AI only)/`,
  `projekt.json`, `Fertiges Video/` (das ist das Upload-Ziel, kein Download).
- **Download getrennt:** zwei Buttons/zwei ZIPs — „Skript" (`Skript und Caption/`) und
  „Rohmaterial" (`Rohmaterial/`). Kein Ganzordner-ZIP.
- **Leisten:** Feature erscheint ab **Videodreh** UND **Schnitt** (spalten.json `videodreh`/
  `schnitt`). Download in beiden. **Video-Upload + Weiterschieben nur in `schnitt`.**
- **Upload-Ziel + Phasenwechsel:** fertiges Video → `Fertiges Video/`. Das erfuellt die
  Erkennungsregel „`Fertiges Video/` enthaelt Video = Schnitt fertig" (drive-convention.md:74);
  danach Karte/Projektordner in die **naechste Phase laut `PHASEN`** (nach `schnitt` = `caption`)
  — Phasenwechsel = Ordner-Move (`drive.moveDir`), wie im Vertrag.
- **Upload-Transport (revidiert beim Bau):** KEIN Multipart, KEINE Dependency. `package.json`
  hat null dependencies — der Browser sendet die Datei als **rohen Body** (`fetch(url, {body:
  file})`), der Server streamt `req` mit `stream/promises pipeline` direkt in eine Temp-Datei,
  dann `rclone copyto`. So bleibt das Projekt abhaengigkeitsfrei und RAM-sicher.
- **ZIP (Download):** eigener stored-ZIP-Schreiber `lib/zip.js` (kein Dep) — streamt Koerper
  mit Data-Descriptor, memory-safe bei GB-Rohvideo. Gegen `Expand-Archive` verifiziert.

### Rest-Offen (bei Bau bestaetigen)
- [ ] In **Videodreh** ist Rohmaterial-Hochladen die natuerliche Handlung (Dreh → Rohclips rein).
      Bens Wahl legte Upload+Move auf `schnitt`. Frage: in `videodreh` ein **Rohmaterial-Upload**
      (ohne Phasen-Move, oder Move `videodreh`→`schnitt`)? Sonst bleibt Videodreh nur Download.

---

## Plan (nach v16d-Commit der Parallel-Session — Kollision server.js/store.js!)

1. [ ] `lib/drive.js` — `downloadDir(pfad, zielTemp)` (`rclone copy`, Filter Menschen-Dateien),
       `uploadFile(localPath, drivePfad)` (`rclone copyto`). Binaer, nicht ueber String-Puffer.
2. [ ] `server.js` — `GET /api/projekt/download?karteId=` (copy→zip→stream) und
       `POST /api/projekt/upload` (multipart→temp→rclone up→Antwort). Zugang fehlt → sauberer
       Hinweis statt Absturz.
3. [ ] `public/store.js` — nach erfolgreichem Upload Karte in naechste Phase (bestehende
       Move-Logik + Drive-Ordner-Move via `moveDir`).
4. [ ] `public/detail.js` (+ ggf. eigene JS/CSS) — Download-Button + Drag&Drop-Feld im
       Kartendetail, gated auf die richtige Phase; Fortschritts-/Fehleranzeige.
5. [ ] Verify: Edge-headless-Screenshot Kartendetail; echter Roundtrip (kleiner Test-Upload →
       in Drive sichtbar → Karte verschoben; Download-ZIP enthaelt nur Menschen-Dateien).

---

## Stand
- [x] Bestand geprueft: rclone-Anbindung, `drive.js`-Helfer, Binaer-/Multipart-Luecke,
      vorhandene Drive-Endpunkte (02.09.2026).
- [x] Feasibility beantwortet: laeuft in-Dashboard ueber rclone, kein Website-Umweg (02.09.2026).
- [x] Design-Entscheidungen mit Owner geklaert (getrennte Skript-/Rohmaterial-Downloads,
      Upload nach Fertiges Video/, Leisten Videodreh+Schnitt) — 02.09.2026.
- [x] Entblockt: v16d der Parallel-Session committet (`0fcf43c`), server.js/store.js frei.
- [x] **v22 gebaut (03.09.2026, commit `204dadf`):** `lib/zip.js` (stored-ZIP, streamend),
      `lib/drive.js` (`kopiereOrdnerRunter`/`kopiereDateiRauf`), `server.js`
      (`GET /api/projekt/download` mit Whitelist, `POST /api/projekt/upload` roher Body),
      `store.js` (`downloadUrl`, `videoHochladen`), `detail.js` (Download-Knoepfe in
      Videodreh+Schnitt, Drag&Drop-Zone im Schnitt, Auto-Move nur bei freien Sperren),
      `style.css` (`.upload-zone`). `node --check` aller sechs Dateien gruen.
- [x] **ZIP-Schreiber verifiziert:** `Expand-Archive` (Fremd-Entpacker) entpackt Text +
      300-KB-Binaer + UTF-8-Name **hash-identisch** (CRC/Data-Descriptor korrekt).
- [x] **Download live verifiziert (echte Karte `test-oasis-01`):** 200 `application/zip`,
      korrekte Content-Disposition, `Expand-Archive` liest die echte `10_skript.md` (89 B).
      Leerer Ordner → sauberes 404 „Ordner ist leer".
- [x] **Upload-Ablehnungen live verifiziert:** Nicht-Video → 400, boeser Name (Slash) → 400,
      unbekannte Karte → 404; Name/Endung werden VOR jedem Drive-Zugriff geprueft.
- [x] **UI-Abnahme per echtem Screenshot (Browser-Pane, 03.09.2026):** Videodreh-Detail zeigt
      „Skript laden (0)" (ausgegraut) + „Rohmaterial laden (1)" (aktiv); Schnitt-Detail zeigt
      die gestrichelte Drag&Drop-Zone „Fertiges Video hierher ziehen". Testkarte danach geloescht.
- [ ] **Offen — Live-Upload-Schreibtest:** ein echtes Video in Fertiges Video/ hochladen und
      den Auto-Move sehen. Schreibt in Bens echtes Drive (kein Loesch-Endpunkt) → mit Owner an
      einer Testkarte fahren, dann abhaken.

## DoD
- [x] Download-Knopf liefert den Ordner als ZIP mit **nur** Menschen-Dateien (Whitelist Skript
      und Caption/Rohmaterial; System (AI only)/projekt.json/Fertiges Video ausgenommen) — live
      gegen echte Karte verifiziert.
- [~] Drag&Drop laedt das fertige Video nach Drive (roher Body, RAM-sicher): Zone + Endpunkt
      gebaut, Ablehnungen live geprueft. **Offen: Live-Schreibtest** (Owner-Testkarte).
- [~] Nach erfolgreichem Upload wandert die Karte in die naechste Phase — Logik gebaut
      (Auto-Move nur bei freien Qualitaetssperren, sonst Ansage). **Offen: mit Live-Upload sehen.**
- [x] Fehlt Zugang/Ordner, meldet der Server sauber (404/502 mit Satz), die UI faengt es ab —
      fuer die Ablehnungszweige live geprueft.
- [x] UI-Abnahme per Screenshot bestanden (Download-Knoepfe + Upload-Zone).
