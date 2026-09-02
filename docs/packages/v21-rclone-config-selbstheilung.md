# Arbeitspaket v21 — rclone-Config-Selbstheilung (kein „couldn't find type field" mehr)

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 02.09.2026.

**Problem:** Beim Einrichten der eigenen client_id scheiterte jeder rclone-Aufruf mit
„couldn't find type field in config". Ursache (reproduziert 02.09.2026): die `[gdrive]`-
Sektion verlor beim Token-Refresh ihren `type` (und `scope`) — eine unvollständig
geschriebene/gelesene `rclone.conf`. rclone kann den Remote dann nicht mehr laden.

**Intent:** Dieser Defekt darf den Betrieb nie wieder blockieren. Das Dashboard soll die
Config beim Start selbst reparieren, bevor irgendetwas sie liest — den Token nie anfassen,
kein zusätzliches Geheimnis auf Platte legen.

**Goal:**
- `lib/rclone-config.js`: erkennt „[gdrive] hat Token, aber keinen type" und ergänzt
  `type`/`scope`/`client_id` atomar wieder (aus Struktur-Cache oder Defaults `drive`/`drive`).
- Beim Start (`drive.js`-Init) läuft die Heilung, bevor die Config gelesen wird.
- Bei gesunder Config wird ein Struktur-Snapshot (type/scope/client_id/team_drive/
  root_folder_id — **ohne Token/Secret**) nach `data/.gdrive-struktur.json` gesichert.
- `.gitignore`: der Struktur-Cache raus aus Git.

**Non-Goal:** Verlorener Token/Secret → dann ist ein `rclone config reconnect` nötig (selten);
das meldet die Heilung, repariert es aber nicht (kein Secret-Duplikat auf Platte).

---

## Plan

1. [ ] `lib/rclone-config.js`: `braucheHeilung`, `heile`, `strukturSnapshot`, `heileGdriveConfig`.
2. [ ] `drive.js`-Init: Heilung vor dem Config-Lesen aufrufen.
3. [ ] `.gitignore`: `data/.gdrive-struktur.json`.
4. [ ] Unit-Test (defekt→geheilt, gesund→Snapshot, Token bleibt).
5. [ ] Commit + Push.

---

## Stand

02.09.2026 — Angelegt. Ursache reproduziert und behoben (eigene client_id via `config create`
+ Testnutzer-Login erfolgreich). Diese Selbstheilung verhindert die Wiederkehr des Defekts.

---

## Definition of Done

Geprueft gegen: Unit-Test der Heil-/Snapshot-Funktionen (defekte Sektion → `type` zurück,
Token unverändert; gesunde Sektion → unverändert + Snapshot) · `node --check`.
Offen: Wirkung im echten Startlauf beim nächsten Dashboard-Start (heilt still, loggt bei Bedarf).
