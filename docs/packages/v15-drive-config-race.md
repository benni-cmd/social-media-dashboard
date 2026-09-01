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

## Korrektur (01.09.2026, nach erneutem Auftreten)

Die erste Fassung (nur Retry) behob es NICHT — der Fehler kam erneut (18:44:01, 2 s nach Kaltstart,
mit Retry im Server). Daraufhin die eigene Race-Theorie hart geprüft und **widerlegt**:

- Server-Env identisch zu Terminal (`USERPROFILE=C:\Users\benkn`, kein abweichendes `HOME`/`RCLONE_CONFIG`) — via PEB gelesen.
- Nur **eine** `rclone.conf` (546 B, 1 Sektion), nur **ein** rclone.exe (v1.75, überall dasselbe).
- **Kein** Code schreibt die Config; rclone schreibt sie nur beim Token-Refresh (mtime bleibt bei gültigem Token).
- Reproduktion: 20 parallel (valid) = 20/20 ok; **160 Calls / 20 erzwungene Refreshs / 8× parallel = 0 Fehler**.
  rclone v1.75 ist gegen gleichzeitigen Config-Zugriff robust — Concurrency ist NICHT die Ursache.

## GRUNDURSACHE BESTÄTIGT (01.09.2026, aus `data/drive-error.log`)

Die Instrumentierung fing den Vorfall: **`DATEI FEHLT`** — die Config `AppData\Roaming\rclone\rclone.conf`
**existierte 19:05:19–19:05:37 (~18 s) schlicht nicht**, danach war sie mit **unveränderter mtime (18:56)**
wieder da. Also nicht leer, nicht gesperrt, nicht neu geschrieben: **extern entfernt und unverändert
zurückgelegt** — die Signatur eines Roaming-Profil-Sync/Backup-Dienstes, der `AppData\Roaming` anfasst.
(OneDrive läuft, aber `AppData\Roaming` liegt nicht darunter; der Ordner ist kein Platzhalter.)

Das erklärt lückenlos: nicht reproduzierbar (hängt an einem Fremdprozess auf genau diesem Rechner),
überlebt keinen Retry (18 s ≫ 5,5 s), und kein rclone-/Concurrency-Fix konnte je greifen.

## Fix der Grundursache: stabile Arbeitskopie in AppData\Local

`lib/drive.js` legt beim Start eine **Arbeitskopie der Config in `AppData\Local\social-media-dashboard\rclone.conf`**
an (`stabileConfig()`) und richtet rclone darauf. `Local` wird nie geroamt/gesynct; nur das Board schreibt
dort hinein. Verschwindet die Roaming-Quelle, bleibt die Arbeitskopie bestehen → das Board ist immun.
Ist die Quelle neuer (Re-Auth im Onboarding), wird die Arbeitskopie beim nächsten Start aufgefrischt.

**Verifiziert:** Roaming-Quelle im Test weggenommen (exakt der 19:05-Fall) → `erreichbar()` weiterhin `ok`,
kein Fehler. Ohne Fix schlug genau das fehl.

## Was gebaut wurde (robust + selbst-diagnostizierend)

1. **Instrumentierung** (`configSchnappschuss`): beim „didn't find section" wird der EXAKTE Config-Zustand
   festgehalten (Pfad, existiert?, Größe, Sektionszahl, mtime, erste Bytes) → `data/drive-error.log` (gitignoriert)
   und an die Fehlermeldung angehängt. Der nächste Vorfall zeigt DEFINITIV, ob die Datei leer, weg oder intakt war.
2. **Serialisierung**: alle rclone-Calls laufen nacheinander (Promise-Kette) — nimmt der Concurrency-Klasse den Boden
   und verhindert Spawn-Stürme (40 parallele Spawns blockierten im Test). Kosten: ~500 ms/Call, Board macht wenige.
3. **Längerer Retry**: 300/700/1500/3000 ms (~5,5 s) — deckt auch ein mehrsekündiges Fenster ab; nur die Config-Race.

## Stand
- [x] Paket angelegt
- [x] lib/drive.js: Retry (`rclone`→`rcloneMitRetry`→`rcloneVersuch`), Backoff 300/700/1500/3000 ms
- [x] lib/drive.js: Serialisierung aller rclone-Calls (Promise-Kette)
- [x] lib/drive.js: Config-Schnappschuss-Instrumentierung → data/drive-error.log
- [x] **Grundursache aus Log bestätigt: Roaming-Config verschwindet extern (~18 s)**
- [x] **lib/drive.js: stabile Arbeitskopie in AppData\Local (`stabileConfig()`) — behebt die Ursache**
- [x] Verify: Quelle weggenommen → Board weiterhin `ok` (immun); Normalbetrieb 12/12 ok (~500 ms/Call)
- [x] Commit + Push

## DoD
- [x] Board arbeitet gegen eine stabile Config, die kein Fremdprozess wegnimmt (Arbeitskopie in Local)
- [x] Verschwindet die Roaming-Quelle, läuft das Board weiter (verifiziert)
- [x] Retry + Serialisierung als zusätzliche Absicherung; Vorfälle bleiben im Log beweisbar
- [ ] Bestätigung im Alltag: Board läuft über mehrere Sitzungen ohne den Fehler (Owner beobachtet)
- Root-`drive.js` ist totes Alt-Modul (von nichts importiert) — separate Aufräum-Aufgabe (Chip), nicht Teil dieses Pakets
