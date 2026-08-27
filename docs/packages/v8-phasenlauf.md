# Work package: v8 — Phasenlauf schliessen + Aktualisieren-Button

> Owner-Bug 27.08.2026: "Idee auswaehlen + speichern sagt, es geht in die naechste Phase, aber
> passiert nicht — auch im Drive nicht." Plus: Aktualisieren-Button oben. Ziel: ein Projekt kann
> einmal ALLE Phasen durchlaufen. Danach Social-Media-APIs.

**Problem:** Der Abschluss einer Phase (v. a. Idee: Fokus & Hook uebernehmen) schiebt die Karte
nicht weiter und spiegelt den Wechsel nicht in Drive. Kein manueller Refresh vorhanden.

**Intent:** Jede Phase hat eine klare "weiter"-Aktion, die die Karte in die naechste Spalte
schiebt UND den Drive-Ordner mitzieht (bzw. beim ersten Mal anlegt). Ein Aktualisieren-Button
laedt den Board-Stand neu.

**Goal:** Ein Projekt laeuft Idee -> Skript -> Videodreh -> Schnitt -> Caption -> Upload -> Fertig
komplett durch; Drive-Ordner wandert jeweils mit; Aktualisieren-Button oben funktioniert.

## Plan

1. [x] `phaseWeiter(karte, ziel)`: Spalte setzen + Drive anlegen/verschieben + Detail neu.
2. [x] Idee "Fokus & Hook uebernehmen -> weiter zu Skript" (Bug behoben).
3. [x] Skript: "Weiter zu Videodreh". Caption: "Weiter zu Upload".
4. [x] Haken (Videodreh/Schnitt/Upload) laufen ueber `phaseWeiter` (Drive anlegen wenn noetig).
5. [x] Aktualisieren-Button im Kopf ("Board neu laden").
6. [x] Ein Projekt komplett durchgelaufen, in Drive verifiziert.

## Status

2026-08-27 — Gebaut und verifiziert. Idee-Uebernehmen schob "Hühnernahrung mit Maden" nach Skript
UND legte `In Bearbeitung/Skript/HuehnernahrungmitMaden` an. "Digitaler Sandkasten" lief
skript->videodreh->schnitt->caption->upload->fertig komplett durch; `/api/drive/board` zeigt es in
`Videoauswertung`. Bug-Fix: `driveCreated` wird jetzt persistiert (sonst Duplikat statt Move).
Hinweis: Umlaut-Titel funktionieren aus dem Browser (UTF-8); ein Bash-`curl`-Test verstuemmelte
das "ü" (Windows-Codepage) — reines Testartefakt.

## Definition of Done

Geprueft gegen: Idee-Uebernehmen -> Skript + Drive-Ordner · Volllauf bis Videoauswertung
(`/api/drive/board`) · Aktualisieren-Button · keine JS-Fehler.
Offen: Social-Media-APIs (naechste Phase) · rclone auf Bens Rechner (Setup-Drive.cmd).
