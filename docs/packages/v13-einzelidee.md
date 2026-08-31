# v13 — Einzelidee statt Sechserpack

## Problem
Der KI-Button erzeugt 6 Ideen auf einmal mit Auswahl-Dialog. Das ueberflutet das Board
und verzögert den Einstieg in den Workflow.

## Intent
Eine Idee pro Klick, passend zum naechsten freien Slot, sofort als Karte mit offener
Seitenleiste — schneller Entscheid: behalten oder verwerfen und naechste holen.

## Goal
Button erzeugt genau eine Karte (Slot-Parameter vorbelegt), oeffnet die Seitenleiste,
verworfene Ideen fliessen als Negativ-Signal in die naechste KI-Anfrage.

## Plan

1. **nachschub.js** — neuer Export `holeIdee(anker)`:
   - Naechsten offenen Slot ermitteln (erster zukuenftiger Slot ohne bereits zugewiesene Karte)
   - denkPanel anzeigen mit Streaming
   - `kiStream("ideen", { anzahl: 1, slot-spezifisch })` — eine Idee fuer diesen Slot
   - Karte sofort anlegen mit Slot-Daten
   - Karten-ID zurueckgeben

2. **board.js** — Button-Umbau:
   - Text: "Idee von der KI" (statt "Ideen von der KI holen")
   - Nach `holeIdee` → `oeffne(karteId)` zum Seitenleiste-Oeffnen

3. **ai.js** — keine Aenderung noetig (`anzahl: 1` wird bereits unterstuetzt)

4. **Verworfene-Tracking** — funktioniert bereits: `verworfen`-Spalte wird an KI uebergeben

## Stand
- [ ] nachschub.js: holeIdee
- [ ] board.js: Button-Umbau + Sidebar oeffnen
- [ ] Optische Abnahme
- [ ] Commit + Push

## DoD
- Button erzeugt genau 1 Karte
- Seitenleiste oeffnet sich automatisch
- KI-Denkprozess ist sichtbar
- Verworfen → naechster Aufruf meidet das Thema
