# v15 — Drive-Move scheitert sporadisch: Config-Race beim Token-Refresh

## PIG

**Problem:** Beim Verschieben einer Karte (und anderen Drive-Aktionen) erscheint sporadisch
`CRITICAL: Failed to create file system for "gdrive:…": didn't find section in config file ("gdrive")`,
die Karte bleibt in ihrer Phase. Fünf frühere Fix-Versuche am Config-**Pfad** blieben wirkungslos,
weil der Pfad nie das Problem war.

**Diagnose (gemessen 01.09.2026):**
- Der On-Disk-Code ist korrekt: `drive.erreichbar()` über `lib/drive.js` liefert `{ ok: true }`,
  `rclone --config <pfad> lsf gdrive:` listet die Phasenordner. Config hat `[gdrive]`, `type=drive`, gültigen Token.
- Der Fehler ist **intermittent**: gleicher Code + gleiche Config, mal Fehler (18:32), mal ok.
- Ursache: Google-OAuth-Tokens leben 1 Stunde (`expiry` in der Config, z.B. `2026-09-01T19:36:19`).
  rclone **refresht den Token automatisch und schreibt dabei `rclone.conf` neu**. Beim Board-Start/Betrieb
  laufen mehrere rclone-Prozesse **parallel** (Move, Status, Scan, Abgleich) — es gibt **keine Serialisierung**
  (grep: kein Lock/Queue/Mutex). Kurz vor Token-Ablauf refreshen mehrere gleichzeitig und überschreiben die
  Config; ein parallel **lesender** rclone erwischt die Datei im leeren Zwischenzustand → Parser findet **null**
  Sektionen → „didn't find section in config file". Nur im Refresh-Fenster (~1×/Stunde) → „mal geht's, mal nicht".

**Intent:** Die Drive-Aktionen sollen den kurzen Config-Neuschreib-Moment **überleben**, statt hart zu scheitern —
ein Timing-Race darf keine Karte blockieren.

**Goal:** `lib/drive.js` erkennt die transiente Config-Race an der rclone-Fehlermeldung und wiederholt den Aufruf
mit kurzem Backoff (wenige 100 ms). Nur diese Fehlerklasse wird wiederholt — „nicht gefunden" (Exit 3/4) und echte
Störungen bleiben sofortige Fehler. Normale Aufrufe verlieren keine Zeit.

## Plan

1. `docs/packages/v15-drive-config-race.md` anlegen (dieser Plan)
2. `lib/drive.js` — `rclone()` in einen einzelnen Versuch (`rcloneVersuch`) + Retry-Schleife aufteilen;
   transiente Erkennung `/didn't find section in config file|couldn't find section in config file|failed to load config file/i`
3. Verify: (a) `erreichbar`/`list` funktionieren weiter; (b) Retry-Pfad feuert nachweislich, wenn die Config
   leer ist (Simulation via temporäre leere `--config`-Datei) und gibt nach N Versuchen klar auf
4. Commit + Push

## Stand
- [x] Paket angelegt
- [x] lib/drive.js: Retry auf transiente Config-Race (`rclone`→`rcloneVersuch`, Backoff 200/400/800 ms)
- [x] Verify a: Normalbetrieb unverändert (`erreichbar()` = ok, 514 ms)
- [x] Verify b: Retry-Pfad nachgewiesen (leere Config → erkennt Race, wiederholt, gibt sauber auf)
- [x] Commit + Push

## DoD
- Drive-Aktion überlebt einen gleichzeitigen Config-Neuschreib-Moment (Retry statt Absturz)
- Nur die Config-Race wird wiederholt; Exit 3/4 und echte Fehler bleiben sofort
- Kein Zeitverlust im Normalfall (Retry nur nach Fehler)
- Root-`drive.js` ist totes Alt-Modul (von nichts importiert) — als separate Aufräum-Aufgabe vermerkt, nicht Teil dieses Pakets
