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

## Offene Design-Entscheidungen (Owner)

- [ ] **„Nur Dateien fuer Menschen"** — was genau ausschliessen? Kandidaten: unsere KI-/System-
      Arbeitsdateien (z. B. Metadaten-JSON, `.keep`), Sidecar-/OS-Junk (`.DS_Store`,
      `Thumbs.db`), oder Whitelist nach Endung (Video/Audio/Doc/PDF/Skript behalten)?
- [ ] **Leiste + „naechste Phase"** — „Videoschnitt" = Phase `schnitt` (spalten.json order 3)?
      Naechste Phase nach Video-Upload = welche (fertig/upload)? Auch in `videodreh` anbieten?
- [ ] **Download-Umfang** — ganzer Projektordner als ein ZIP, oder Rohmaterial und Skript
      getrennt?
- [ ] **Multipart** — kleine Dependenz `busboy` (leicht, Streaming) vs. manuelles Parsen
      (kein Dep, mehr Code). Grosse Videos: Groessenlimit? Direkt zu Temp streamen, nicht in RAM.

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
- [ ] Design-Entscheidungen offen (siehe oben) — Owner.
- [ ] Bau blockiert bis v16d der Parallel-Session in `server.js`/`store.js` committet ist.

## DoD
- [ ] Download-Button liefert den Projektordner als ZIP mit **nur** Menschen-Dateien.
- [ ] Drag&Drop laedt das fertige Video nach Drive hoch (kein RAM-Ueberlauf bei grossen Dateien).
- [ ] Nach erfolgreichem Upload wandert die Karte automatisch in die naechste Phase.
- [ ] Fehlt der Drive-Zugang, meldet die UI das sauber statt abzustuerzen.
- [ ] UI-Abnahme per Screenshot bestanden.
