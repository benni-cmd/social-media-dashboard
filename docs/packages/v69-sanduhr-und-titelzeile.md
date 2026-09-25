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
- [x] Sanduhr-Ursache im Code bestaetigt (25.09.2026): NICHT der Server. `/api/drive/reconcile/stream`
  kam live mit **200 OK durch** (Netzwerk-Tab, kein haengender Request), Konsole fehlerfrei. Reine
  Anzeige: `driveAbgleich()` ruft im `finally` `setzeAbgleichStufe("")` (store.js:445), aber der
  Dauer-Hoerer in `app.js:73` hatte ein `if (satz)`-Guard und verwarf den leeren Abschluss-Satz —
  die Sanduhr blieb auf der letzten Stufe stehen. Der Knopf-Pfad („Alles abgleichen") hatte sein
  eigenes `setStand` im `finally` und raeumte auf; der automatische Start-/Intervall-Abgleich nicht.
- [x] Sanduhr-Fix + Verify (25.09.2026): `app.js:73` raeumt bei leerem Satz per `setStand("Bereit.")`
  auf. Live: nach Reload lief der Auto-Abgleich (`reconcile/stream` 200 OK) durch, Kopf zeigt wieder
  „Bereit." statt Dauer-Sanduhr (Screenshot). Minimal-invasiv, nur die eine Hoerer-Zeile.
- [x] Titelzeile-Fix + Verify (25.09.2026): `.eintrag-titel` `line-height` 1.35 → 1.5, Zwei-Zeilen-
  Reservierung (`min-height`) und der Status-Punkt-Float (`::before height`) ziehen mit. Live:
  Karten-Titel haben sichtbar mehr Luft, Kachel-Layout intakt (Screenshot). `node --check` n/a (CSS).
- [x] **Code-Fixes committet + gepusht (25.09.2026) — via Kollisions-Aufloesung:** Waehrend dieser
  Sitzung hat die parallele **v68-Session** („Hinweise & Warnungen") dieselben zwei Zieldateien
  (`public/app.js`, `public/style.css`) uncommitted mitbenutzt (Import `/lib/kartenhinweise.js`,
  `meldung-*`-Klassen). Ein eigener Pathspec-Commit haette v68s halbfertige Arbeit mit-hochgenommen
  (kurzzeitig auch die noch untracked `lib/kartenhinweise.js`), also NICHT selbst committet. Dann hat
  v68 seine Dateien selbst per Pathspec committet (**`a76c1ed`**, bereits auf `origin/main` gepusht) —
  und weil ein Pathspec-Commit den ganzen Datei-Stand nimmt, sind MEINE v69-Hunks darin mitgelandet:
  `git show a76c1ed:public/app.js` fuehrt `… else setStand("Bereit.")` (Zeile 83), `…style.css` das
  `min-height: calc(1.5em * 2)` (Zeile 967). Gepruefte Realitaet des geteilten Arbeitsbaums:
  Datei-Eigentum ist Pathspec-scharf, nicht Hunk-scharf. Code-Stand ist somit gesichert; dieses
  Paket-Artefakt kommt als eigener v69-Doc-Commit hinterher.

## DoD
- [x] Verworfen-/Reconcile-Indikator dreht nicht mehr dauerhaft (live gegengeprueft, Kopf = „Bereit.").
- [x] Titelzeile hat mehr Platz, Kachel-Layout intakt (Screenshot).
- [x] `node --check public/app.js` gruen.
- [x] Code-Fixes in `origin/main` (`a76c1ed`, von v68s Pathspec-Commit mitgetragen); v69-Doc separat committet.
