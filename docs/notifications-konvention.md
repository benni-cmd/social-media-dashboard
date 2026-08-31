# Notifications-Konvention — Social Media Dashboard

> Eingeführt 31.08.2026. Gilt für alle Folge-Schritte (Skript, Videodreh, Upload,
> Google Kalender, KPI-Sync, …).

## Regel

Jede Aktion, die der User ausgelöst hat und die einen externen Effekt hat (Drive,
KI, API, Speichern), bekommt einen Toast. Internes State-Management und UI-Neubau
brauchen keinen Toast.

## Funktion

```js
import { meldung, bestaetigen } from "./ui.js";

meldung("Text.", "erfolg"); // grüner Toast, 10 Sek Auto-Close
meldung("Text.", "fehler"); // roter Toast, 10 Sek Auto-Close

bestaetigen("Sicher?", "Ja, löschen", () => { /* Aktion */ });
// Bestätigungs-Toast mit zwei Buttons; ersetzt confirm()
```

## Wann was

| Situation | Typ | Beispieltext |
|---|---|---|
| Drive-Ordner angelegt | erfolg | "Projektordner im Drive angelegt." |
| Drive-Datei gespeichert | erfolg | "Datei in Drive gespeichert." |
| Drive-Aktion fehlgeschlagen | fehler | "Drive-Ordner konnte nicht angelegt werden." |
| KI-Ergebnis gespeichert | erfolg | "KI-Ergebnis gespeichert." |
| Slot belegt | erfolg | Teil der Ideen-Bestätigung |
| Slot-Belegung fehlgeschlagen | fehler | "Slot konnte nicht belegt werden." |
| Termine in Google Kalender eingetragen | erfolg | "Termine im Google Kalender eingetragen." |
| Destruktive Aktion (löschen, zurücksetzen) | bestaetigen | Fragetext + "Ja, löschen" |
| Netzwerkfehler beim Start | fehler | "… beim Start nicht erreichbar." |
| Einstellungen gespeichert | erfolg | "… gespeichert." |

## Was keinen Toast bekommt

- Board-interne Verschiebungen (nutzen `setStand()` im Kopf)
- Fehler, die schon via `melde()` im Meldungs-Banner abgefangen werden
- Hintergrund-Polling und automatische Sync-Checks ohne User-Auslöser
- `zeichne()` / UI-Neubau

## Folge-Schritte (Vorschau)

| Schritt | geplante Notifications |
|---|---|
| Google Kalender Sync | erfolg "Termine im Google Kalender eingetragen." / fehler |
| KPI-Sync (Instagram/LinkedIn) | erfolg "KPI-Daten aktualisiert." / fehler |
| Upload-Reminder | erfolg / fehler |
