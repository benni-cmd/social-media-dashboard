# v98 — Schneller Start: System-Dateien aus dem Spiegel, Hintergrundarbeit danach

> Owner 01.10.2026: „Immer wenn ich das Board starte, läuft oben alles durch — die Abgleiche, dass er alles im Drive speichert,
> Redaktionsplan abgleicht … Es soll schneller befüllt werden: nicht jede Datei öffnen und neu reinschreiben, sondern aus dem
> Cache nehmen und nur schauen, ob die Datei in Drive verändert wurde, und erst dann explizit reinlesen."

## PIG

**Problem (gemessen, Ereignis-Log des laufenden Boards, Start 16:13–16:15):** `defaults.json` 4× geladen, `redaktionsplan.json` 3×,
`redaktionsplan.slots.json` 3×, `workflows.json` 2× — je 2–3,4 s; `kontext.json` 14,7 s, `prompts.json` 8,6 s; dazu KPI-Tabellen
(2,8 s + 15,3 s) und Steckbrief-Abgleich (13 s + 5 s). Alle rclone-Aufrufe laufen **nacheinander** (`lib/drive.js` Warteschlange) —
jeder überflüssige Download hält alles andere auf.
**Intent:** Das Board steht beim Start schnell und stimmt trotzdem mit Drive überein.
**Goal:** Unveränderte System-Dateien werden nicht geladen; Hintergrundarbeit läuft erst, wenn das Board steht.

## Bau

1. `lib/drive.js`: Spiegel für Dateien direkt in `System (AI only)` — ein Listing mit md5 (`lsjson --hash`, 20 s gültig, gleichzeitige
   Anfragen teilen es); Datei wird nur geladen, wenn ihre md5 in Drive vom lokalen Spiegel (`data/drive-spiegel/<Ordner-ID>/`)
   abweicht. Eigene Schreibvorgänge aktualisieren Spiegel und Listing sofort. Listing gestört → wie bisher direkt laden.
   Wirkt für alle Speicher (Defaults, Prompts, Kontext, Plan, Slots, Workflows, Board-Parameter), ohne sie umzubauen.
2. `server.js`: KPI-Lauf, Ordner-Links und Konto-Abfrage beim Start erst nach 60 s; Steckbrief-Abgleich 30 s nach einem Drive-Abgleich.

## Stand

01.10.2026 — gebaut. Messung gegen Bens Drive (nur lesend, aus der Kopie mit eigenen Zugangsdateien):

| Lauf | 5 System-Dateien |
|---|---|
| alt: je komplett laden | 16,2 s |
| neu, erster Start (Spiegel leer) | 15,0 s |
| neu, nächster Start (Spiegel gefüllt) | **0,8 s** |
| neu, erneut innerhalb 20 s | **0,0 s** |

## DoD

- [x] Unveränderte System-Dateien kosten keinen Download (gemessen)
- [x] Hintergrundarbeit nach hinten verschoben
- [ ] Live-Start auf Bens Board: Ereignis-Log zeigt „unverändert — aus dem Spiegel" statt `cat` (nach Neustart prüfen)
