# v96 — Einrichtung erscheint nur, wenn wirklich etwas fehlt

> Owner 01.10.2026 (Screenshot „Du hast diesen Prompt schon angepasst — Meine bisherige Fassung / Vorschlag übernehmen"):
> „So etwas hat im Einrichtungsassistenten nichts zu suchen. Solange der Default einmal bestätigt wurde oder schon
> eine manuelle Eingabe erfolgt ist, kann es übersprungen werden. Ziel ist, dass man nach einer sauberen Einrichtung
> nicht jedes Mal den Assistenten sieht beim Öffnen."

## PIG

**Problem:** v93/v94 zählten nur „im Assistenten bestätigt" als erledigt. Eigene Eingaben aus den Einstellungen
(angepasster Prompt, eigener Redaktionsplan, gewählte KI-Rollen, Ordnername) lösten den Assistenten trotzdem aus;
für angepasste Prompts zeigte er sogar eine Auswahl zwischen eigener Fassung und Vorschlag.
**Intent:** Der Assistent fragt nur nach Daten, die wirklich fehlen.
**Goal:** Ein Schritt ist erledigt, wenn sein Vorschlag einmal bestätigt wurde ODER eine eigene Eingabe vorliegt.

## Regel je Schritt

| Schritt | erledigt, wenn … |
|---|---|
| Name | einmal bestätigt ODER der Drive-Ordner hat einen Namen |
| KI-Rollen | im Board gespeichert ODER schon in Einstellungen → KI-Rollen gewählt |
| Firmenkontext | Text vorhanden (kein Vorschlag möglich) |
| Prompt (je einzeln) | Vorschlag bestätigt ODER eigene Fassung gespeichert — eigene Fassungen erscheinen nicht mehr |
| Redaktionsplan | bestätigt ODER im Dialog gespeichert ODER vom Standard abweichend (`/api/plan` → `istStandard`) |
| Drive, Ordner, Claude, Ollama, Google | Live-Zustand (unverändert) |

## Stand

01.10.2026 — gebaut. Kopie :4399: eigene Skript-Fassung → Prompt-Schritt zeigt 14 statt 15, „skript" nicht dabei;
eigener Plan (1 Reel/Woche, `istStandard: false`) → Plan-Schritt erledigt. Auswahl „eigene Fassung / Vorschlag" entfernt.
Speichern im Redaktionsplan-Dialog setzt `planBestaetigt` serverseitig.

## DoD

- [x] Eigene Eingaben zählen als erledigt (Prompts, Plan, Rollen, Name)
- [x] Keine Auswahl „eigene Fassung / Vorschlag" mehr im Assistenten
- [ ] Bens Board nach Neustart: Assistent fragt nur noch Firmenkontext, unbestätigte Standard-Prompts und Google (live prüfen)
