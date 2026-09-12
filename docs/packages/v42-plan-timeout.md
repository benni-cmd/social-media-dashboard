# v42 — Redaktionsplan: rclone-Timeout maßvoll anheben (8 s → 20 s)

## PIG

**Problem:** Im Betrieb erscheint sporadisch der Fehler-Toast „Redaktionsplan: Drive-Zugriff
fehlgeschlagen (?): rclone antwortet seit 8 Sekunden nicht." Ursache: Der Plan-Abgleich liest/
schreibt seine Drive-Dateien mit `PLAN_TIMEOUT_MS = 8000` (`planstore.js:64`). Jeder Aufruf
startet einen frischen `rclone`-Prozess mit Netzwerk-Runde zu Google Drive (`drive.js:253–268`);
dauert die länger als 8 s (Cold-Start, Token-Refresh, kurz langsame Verbindung), wird der Prozess
gekillt und der Fehler geworfen. Der Server fällt sauber auf den lokalen Cache zurück
(`server.js:383`) — kein Datenverlust, aber ein alarmierender roter Toast (`store.js:515`).

**Warum 8 s überhaupt:** Bewusste Fail-Fast-Wahl (Owner 10.09.2026, `planstore.js:58–63`): Ein
hängender rclone-Call blockiert über die globale Serialisierungs-Kette (`drive.js`, `rclone()`)
ALLE Drive-Aufrufe der App. Eine kleine Konfig-JSON soll darum nie 90 s blockieren.

**Intent:** Den bewussten Schutz vor App-weiter Blockade erhalten, aber die häufigen
Falsch-Timeouts bei normalen Cold-Starts vermeiden.

**Goal:** `PLAN_TIMEOUT_MS` auf einen Wert, der einen langsamen-aber-erfolgreichen rclone-Lauf
abfängt und trotzdem klar begrenzt bleibt (deutlich unter dem 90-s-Default). Gewählt: **20 s**.

## Bestandsaufnahme (gemessen 12.09.2026)

- `PLAN_TIMEOUT_MS = 8000` ist im ganzen Code der kürzeste Timeout; andere Drive-Ops:
  30 s (`lsf`-Health `drive.js:443`), 90 s (Default `:253`), 180 s (`:421`), 900 s (copy `:407,414`).
- `data/drive-error.log` leer → kein Config-Race (der würde still wiederholt, `drive.js:237–248`),
  sondern echter Zeitüberschritt.
- Fehler-Pfad: `planstore.leseConfigVonDrive` (`:68`) → `drive.readFile` Timeout → `server.js:383`
  (Cache-Fallback + `planAbgleich.fehler`) → `store.js:515` (`melde("befund", …)`).

## Warum 20 s (nicht 30 s)

- 30 s ist der Health-Check-Wert (`lsf`), aber der Plan-Read wurde am 10.09. als *hängend*
  beobachtet — ein echter Hang frisst den vollen Timeout und blockiert solange die ganze App.
  20 s absorbiert einen langsamen Cold-Start/Token-Refresh (die wahrscheinliche reale Ursache
  eines gelegentlichen >8 s), hält die Blockade aber kürzer als der Health-Check.
- Der exakte Wert ist eine begründete Abwägung, keine Messung: Die echte rclone-Laufzeit ließe
  sich nur durch Reproduktion messen. Tritt der Fehler mit 20 s weiter auf, ist die Ursache
  tiefer (Netzwerk/Token) → eigener Mess-Schritt, keine weitere Wert-Erhöhung ins Blaue.

## Plan

1. `planstore.js`: `PLAN_TIMEOUT_MS` 8000 → 20000, Kommentar auf die neue Begründung anpassen.
2. Commit + Push (nur `planstore.js` + dieses Paket — kollisionsfrei zur aktiven v40-Session).

## Stand

- [x] Ursache belegt (kurzer Timeout, Fail-Fast-Rationale, Fehler-Pfad) — 12.09.2026
- [x] `PLAN_TIMEOUT_MS` 8000 → 20000 + Kommentar
- [x] Commit + Push

## DoD

- `PLAN_TIMEOUT_MS === 20000`; Fehlermeldung zeigt entsprechend „20 Sekunden", falls sie
  überhaupt noch auftritt.
- Fail-Fast-Schutz bleibt dokumentiert erhalten (Wert weiterhin << 90 s Default).

## Offener Folge-Punkt (nicht in diesem Paket, `store.js` = v40-Session-Datei)

- Der Cache-Fallback ist by-design; der rote `befund`-Toast (`store.js:515`) übertreibt das.
  Kandidat: auf einen ruhigen `hinweis` herunterstufen und den freundlichen Text aus
  `server.js:383` nutzen. Berührt `store.js` → mit der v40-Session abstimmen, separat.
