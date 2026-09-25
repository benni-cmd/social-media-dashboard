# v69 — Deferred-Reste: Sanduhr-Dauerdreher + Karten-Titelzeile

> Umbenannt v68→v69 (24.09.2026): „v68" war parallel von der Ampel-Schwellen-Arbeit belegt.

> Zwei zurueckgestellte Kleinigkeiten aus dem Ampel-/Layout-Umbau, jetzt nachgezogen (Owner-Freigabe 24.09.2026).

## PIG

**Problem 1 (Sanduhr):** Der Spalten-Kopf-Indikator der Verworfen-Spalte (oben rechts) dreht die
Sanduhr dauerhaft, obwohl der Scan laut Konsole durch ist. Ursache-Kandidat: `spalteDriveStatus`
(`public/board.js:44-48`) meldet "laedt", solange **irgendeine** Karten-ID in `S.driveScanLaeuft`
steht; `driveScan` (`public/store.js:317-347`) entfernt die ID zwar im `finally`, aber wenn der
`POST /api/drive/scan` fuer eine Verworfen-Karte haengt und nie resolved/rejectet (rclone-Timeout
greift nicht), bleibt die ID ewig im Set → Dauer-Sanduhr. **Muss live bestaetigt werden** (Netzwerk-
Tab: haengende /api/drive/scan-Anfrage? Konsole: `S.driveScanLaeuft` nach Scan-Ende), nicht raten.

**Problem 2 (Titelzeile):** Die obere Zeile fuer den Karten-Titel ist etwas zu knapp — Owner will sie
etwas hoeher/laenger (mehr Platz fuer den Titel). Reine CSS-Sache in `public/style.css` (`.eintrag`-Titel).

**Intent (Owner 24.09.2026):** Board fertigstellen — die letzten zwei sichtbaren Ecken glaetten, damit
kein Dauer-Spinner Arbeit vortaeuscht und der Titel lesbar Platz hat.

**Goal:**
- Verworfen-Spalten-Indikator zeigt "live" (oder nichts), sobald der Scan durch ist — kein Dauerdreher.
- Karten-Titel-Zeile hat sichtbar mehr Hoehe/Platz, ohne das Kachel-Layout zu brechen.

## PRUEFE ZUERST (kein One-Shot)
- Server starten (`preview_start`), Board oeffnen, Verworfen-Spalte ansehen: dreht die Sanduhr? Netzwerk-Tab
  auf haengende `/api/drive/scan`; Konsole: `[...S.driveScanLaeuft]` nach vermeintlichem Scan-Ende.
- Bestaetigen, ob die ID haengt (Promise haengt) ODER der Scan wiederholt neu getriggert wird (Re-Draw-Schleife).
- `git status --short public/` — style.css muss SAUBER sein, bevor du sie anfasst (Parallel-Session).

## Plan
1. **Sanduhr:** Ursache live pinnen. Fix je nach Befund: (a) haengender Scan → Timeout/AbortController auf
   `/api/drive/scan`, sodass der `finally` sicher greift; oder (b) Re-Trigger-Schleife → Verworfen-Karten vom
   automatischen Scan ausnehmen bzw. Dedup schaerfen. Minimal-invasiv in `board.js`/`store.js`.
2. **Titelzeile:** `.eintrag`-Titelzeile in `style.css` etwas hoeher (line-height/min-height/clamp). ERST wenn
   `git status` style.css sauber zeigt; sonst diesen Teil als blockiert melden und nur Teil 1 liefern.
3. Verify je Teil im Browser (echter Screenshot/Netzwerk), dann committen (`git -C` Projekt-Repo).

## Kollision
`style.css` ist der Ampel-Session vorbehalten, solange dort uncommitted (git diff). `board.js`/`store.js`
aktuell sauber. Nicht committen, was du nicht selbst geaendert hast (kein Fremd-Diff mit hochnehmen).

## Live-Befund (25.09.2026, laufendes Board :4321)
Der Dauerdreher ist NICHT die Karten-Sanduhr (`spalteDriveStatus`/`driveScan`), sondern der
**globale Reconcile-Fortschritt oben rechts im Kopf**: Anzeige haengt auf „Liest Drive-Ordner 8/8:
Verworfen …" mit drehendem Indikator. Also die Abgleich-Stufen-Kette (`app.js` `beiAbgleichStufe`/
`standLaedt` ↔ `store.js` `driveAbgleich`): die letzte Stufe (Ordner 8/8 „Verworfen") wird gesetzt,
aber der Abschluss-`setStand("Bereit.")` (der die Sanduhr wegraeumt) feuert nie. ZUERST via Konsole/
Netzwerk pruefen, ob der Abgleich real durchlaeuft (dann reine Anzeige) oder an „Verworfen" haengt.

## Stand
- [x] Sanduhr-Ursache live eingegrenzt: globaler Reconcile-Indikator haengt bei Ordner 8/8 „Verworfen" (25.09.2026)
- [ ] Sanduhr-Ursache im Code bestaetigt (app.js/store.js Abgleich-Abschluss)
- [ ] Sanduhr-Fix + Verify
- [ ] Titelzeile-Fix + Verify (nur bei sauberer style.css)
- [ ] Commit(s) + Paket nachgefuehrt

## DoD
- Verworfen-Indikator dreht nicht mehr dauerhaft (live gegengeprueft).
- Titelzeile hat mehr Platz, Kachel-Layout intakt (Screenshot).
- `node --check` gruen; nur selbst geaenderte Dateien committet.
