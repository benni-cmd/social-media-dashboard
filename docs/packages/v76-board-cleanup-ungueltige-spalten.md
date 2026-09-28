# v76 — Board-Cleanup: Karten in Spalten, in denen sie nach den Drive-Regeln nicht sein dürfen

> Owner-Auftrag 28.09.2026. Einmalige Bereinigung der Altlasten (v75 blockt ab jetzt neue Übergänge,
> zog aber die bereits falsch platzierten Karten nicht zurück).

## PIG

**Problem:** Karten stehen in Phasen, deren Drive-Voraussetzung fehlt:
- `skript` („Drehtermin festlegen") ohne Skript-Datei in „Skript und Caption" (Name enthält „skript").
- `videodreh` ohne zugewiesenen Drehtermin.
- `schnitt` ohne Rohmaterial (kein gedrehtes Video im Drive).
Überfällig/rot ist KEIN Grund (Owner: „Punkte dürfen rot sein") — nur die fehlende Drive-Voraussetzung.

**Intent (Owner 28.09.2026):** Board sauber halten — eine Karte darf nur in einer Spalte stehen, deren
Voraussetzung real im Drive liegt. Altlasten „clearen".

**Goal:** Die unten gelisteten Karten aus ihrer ungültigen Spalte entfernen — Löschart per Owner-Entscheid
(löschen vs. in die korrekte Spalte zurückschieben).

## Befund (live 28.09.2026, `POST /api/drive/scan` je Karte gegen :4321)
Regel je Spalte: skript→Skript-Datei · videodreh→Drehtermin · schnitt→Rohmaterial>0.

**Ungültig (9):**
| Karte | Spalte | fehlt | vorhanden |
|---|---|---|---|
| Hühnernahrung mit Maden | skript | Skript-Datei | dreh |
| MachuPicchu | skript | Skript-Datei | — |
| Kompost-Tee aus Küchenresten | skript | Skript-Datei | — |
| Warum wir Unkraut stehen lassen | skript | Skript-Datei | — |
| Nicht jeder Regenwurm hilft… | skript | Skript-Datei | — |
| Biointensive Landwirtschaft | skript | Skript-Datei | dreh |
| Neue Idee | skript | Skript-Datei | dreh |
| Lehmboden | schnitt | Rohmaterial | skript, dreh |
| Oberflächenspannung von Wasser | schnitt | Rohmaterial | dreh |

**Gültig (bleiben):** Boden wie ein Schwamm (videodreh: roh+dreh), Mischkultur (skript: 10_skript.md),
Test Idee 1, Was pflegst du…, Jungbodenschutz, Waldvierecke (skript: 10_skript.txt).

## OFFENE OWNER-ENTSCHEIDUNG (destruktiv — vor dem Bau)
Löschart: (a) **in die korrekte Spalte zurückschieben** (nicht-destruktiv: skript-ohne-Skript → „Skript
schreiben"; schnitt-ohne-Roh → „Videodreh" bzw. „Skript schreiben") — Idee bleibt erhalten; oder
(b) **Karte löschen** (App-Delete, Drive-Ordner wird wiederherstellbar in den Papierkorb/Verworfen
verschoben) — nur sinnvoll für echte Wegwerf-/Test-Karten.

## Plan (nach Entscheid)
1. Je Karte die Zielaktion über die App-API ausführen (`/api/…move` bzw. Delete) — dieselbe Schicht wie
   die Board-Bedienung, damit Drive mitzieht. Direkt in DIESER Session (destruktiv → unter direkter Kontrolle,
   kein Subagent).
2. Nach jeder Aktion neu scannen/prüfen; Ergebnis-Liste ausgeben.

## Stand
- [x] Befund live erstellt (9 ungültige Karten, 28.09.2026)
- [x] Owner-Entscheid: **löschen** (App-Delete, Drive-Ordner wiederherstellbar in Papierkorb) — 28.09.2026
- [x] Ausführung: 9 Drive-Ordner getrasht (`/api/karte/loeschen`) + aus board.json entfernt (`PUT /api/board`,
      v410→411, 24→15 Karten). Hinweis: erster PUT lief in einen Versionskonflikt (409) → Ordner waren getrasht,
      board.json noch nicht aktualisiert; mit frischer Version + Retry sauber nachgezogen (Halb-Zustand geschlossen).
- [x] Verify: Re-Scan der verbleibenden skript/videodreh/schnitt-Karten → **0 ungültig**.

## Gelöschte Karten (Audit, 28.09.2026)
skript / keine Skript-Datei: Hühnernahrung mit Maden · MachuPicchu · Kompost-Tee aus Küchenresten ·
Warum wir Unkraut stehen lassen · Nicht jeder Regenwurm hilft… · Biointensive Landwirtschaft · Neue Idee.
schnitt / kein Rohmaterial: Lehmboden · Oberflächenspannung von Wasser.
Drive-Ordner liegen wiederherstellbar im Papierkorb/Verworfen.

## DoD
- [x] Keine Karte mehr in skript/videodreh/schnitt ohne ihre Drive-Voraussetzung (Re-Scan = 0).
- [x] „löschen"-Variante: Drive-Ordner wiederherstellbar (nicht permanent gelöscht).
