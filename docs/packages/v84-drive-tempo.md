# v84 — Drive-Tempo: Abgleich und Redaktionsplan brauchen zu lange

> Owner-Auftrag 30.09.2026: „lässt sich der Drive-Abgleich ggf. beschleunigen?" → Empfehlung
> freigegeben („Jo bitte nach deiner Empfehlung umsetzen"), dazu: „das Board hat aktuell
> Probleme, den Redaktionsplan aus dem Drive abzugleichen".

**Problem:** Der Drive-Abgleich braucht gefühlt sehr lange; der Redaktionsplan meldet
„rclone antwortet seit 20 Sekunden nicht". Gemessen 30.09.2026:
- Direkt mit rclone: Spalte auflisten 0,7–1,1 s; `cat redaktionsplan.json` 2,2–2,6 s.
- Über den Board-Server: Workflows 13,4 s, Einstellungen 11,5 s, Redaktionsplan 49,6 s,
  Abgleich > 200 s (abgebrochen; Server war parallel von einer anderen Session belastet).
- **Hauptursache belegt** (`rclone cat … -vv`, 8 Läufe): Der Remote hat KEINE eigene
  client_id (`data/.gdrive-env.json` nur TYPE/SCOPE/TOKEN). Google antwortet der geteilten
  rclone-client_id mit `Error 403: Quota exceeded … Requests per minute`; rclone wartet und
  wiederholt → Lauf 1 dauerte 20,1 s (= genau das Plan-Timeout), Läufe 2–8 je 2,2–2,6 s.
  rclone meldet zusätzlich: „uses rclone's shared Google Drive client_id, which is being
  retired and will stop working during 2026".
- Nebenursachen im Code: alle rclone-Aufrufe laufen durch EINE serielle Warteschlange
  (`lib/drive.js` `rcloneKette`) — jeder Aufruf wartet auf alle vorherigen; der Abgleich
  listet 8 Spaltenordner einzeln (`lib/projects.js` `abgleich()`); gleichzeitige
  Abgleich-Anfragen laufen doppelt (`server.js` `fuehreAbgleichAus`).

**Intent:** Drive-Stand schnell und verlässlich im Board — und Drive bleibt erreichbar, wenn
Google die geteilte client_id abschaltet.

**Goal:** Abgleich im Ruhezustand ≤ 10 s gemessen; Redaktionsplan lädt ohne Timeout-Meldung;
jeder rclone-Aufruf zeigt im Drive-Terminal Wartezeit und Laufzeit getrennt.

## Plan

1. [x] Messpunkt: jeder rclone-Aufruf meldet im Drive-Terminal „wartete X s · lief Y s".
2. [x] Abgleich: die Spaltenordner in einem rekursiven Aufruf je Hauptordner lesen
   (`lsf -R --dirs-only --fast-list`) statt 8 Einzelaufrufen.
3. [x] Server: gleichzeitige Abgleich-Anfragen teilen sich einen Lauf.
4. [ ] Eigene client_id: Anleitung für Ben (Google-Cloud-Projekt, Drive API, OAuth-Client
   „Desktop"), Board liest `client_id`/`client_secret` aus Umgebungsvariablen, einmal neu
   anmelden. **DEINE HANDLUNG (Ben)** — Zugänge nie in Dateien im Repo.
5. [ ] Warteschlange auf 2–3 parallele Aufrufe öffnen — ERST nach Schritt 4 und Messung,
   weil mehr Parallelität mit der geteilten client_id mehr 403-Drosselung erzeugt.
6. [ ] Verify: Abgleich- und Plan-Zeiten vorher/nachher mit Befehl im Paket; `node --check`.

## Status

30.09.2026 — Ursache gemessen (siehe Problem), Paket angelegt.

30.09.2026 — Schritte 1–3 gebaut:
- `lib/drive.js`: `rclone()` merkt den Einreih-Zeitpunkt; das Drive-Terminal zeigt je Aufruf
  „(wartete X s · lief Y s)". Neu `ordnerBaum(pfad, maxTiefe)` = `lsf -R --dirs-only --fast-list`.
- `lib/projects.js` `abgleich()`: ein Aufruf je Hauptordner (In Bearbeitung, Videoauswertung,
  Verworfen) statt 8; die v83-Meldung `drive-ordner-fertig` je Spalte bleibt erhalten.
- `server.js`: `fuehreAbgleichAus()` teilt einen laufenden Abgleich (`abgleichLauf`).
- **Beleg** (Skript im Session-Scratchpad `vergleich.mjs`, alte gegen neue Ordnerliste auf
  echtem Drive, zweimal): beide finden dieselben 16 Karten-Ordner in denselben Spalten
  (`identisch: true`); alt 8,1 s bzw. 42,3 s (gedrosselt), neu 4,4 s bzw. 4,5 s.
- `node --check` auf drive.js, projects.js, server.js ohne Fehler.
- NICHT live im Board geprüft: Port 4321 hält der Server einer parallelen Session; er muss
  neu starten, damit der neue Server-Code läuft.

Schritt 4 (eigene client_id) — zweite Quelle: rclone.org/drive „Making your own client_id"
bestätigt die Abschaltung der geteilten ID 2026 und: im Modus „Testing" laufen Anmeldungen
nach einer Woche ab → App auf „Publish" stellen (keine Google-Prüfung nötig unter 100 Nutzern).
Das Board liest `client_id`/`client_secret` schon heute aus der `[gdrive]`-Sektion der
rclone.conf (`drive.js` `parseConfig`) — kein Code nötig, nur die Einrichtung durch Ben.

## Definition of Done

Geprueft gegen: Zeitmessung Abgleich/Plan vorher-nachher, Drive-Terminal-Zeiten, `node --check`
Offen: alles (Bau steht aus)
