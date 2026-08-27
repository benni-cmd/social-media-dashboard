# Work package: v7 — UX: Benennung, Progress-Bar, Multiple-Choice

> Owner-Feedback 27.08.2026 nach Test. Fokus: Bedienbarkeit.

**Problem:** (1) Projektname setzt eine Reihe voraus — Einzelvideos haben keine. (2) Bei
KI-Buttons sieht man nicht, ob noch gearbeitet wird. (3) Fokus-/Hook-Alternativen kommen als
Prosa; Auswahl per Copy&Paste ist umstaendlich.

**Intent:** Das Dashboard soll sich leicht bedienen: klare Benennung auch ohne Reihe, sichtbarer
Arbeitsfortschritt, und Auswahl von Alternativen per Multiple-Choice — die Auswahl fliesst direkt
in den naechsten Schritt; am Ende ein editierbarer Gesamttext vor dem Speichern.

**Goal:** Einzelvideos bekommen einen sauberen Namen; jeder Async-Button zeigt eine Progress-Bar;
Phase 1 liefert strukturierte Optionen, die als anklickbare Auswahl (1 Fokus + 1 Hook)
erscheinen und in Phase 2 einfliessen; Captions ebenfalls als Auswahl. Muster ueberall gleich.

## Loesungen

1. **Benennung:** Reihe gesetzt -> `<Serie>_EP<NN>_<Thema>`. Keine Reihe -> `<Thema>` (Einzelvideo).
   Video-Dateiname analog: `WEE_<Serie>_EP<NN>_<Thema>_<Format>.mp4` bzw. `WEE_<Thema>_<Format>.mp4`.
2. **Progress-Bar:** unbestimmte (indeterminate) Leiste, sichtbar solange ein Button-Request laeuft
   (KI, Drive). Einheitlicher Helfer.
3. **Multiple-Choice:** `recherche` und `caption` antworten als striktes JSON. Frontend rendert
   Auswahl (Radio). Fokus+Hook-Auswahl -> Freigabe fuer Skript; Caption-Auswahl -> Speichern.
   Fallback: kein valides JSON -> Rohtext + manuelles Feld.

## Plan

1. [x] Benennung Serie/Einzel (Server `projektName`, Frontend Dateiname). Einzelvideo = nur `<Thema>`.
2. [x] Progress-Bar-Helfer (`fortschrittAn`) an KI-/Drive-Buttons.
3. [x] `recherche` -> JSON (Zusammenfassung, 3 Fokus, 3 Hooks) + robustes `parseJson` im Server.
4. [x] Idee-Stufe: Multiple-Choice Fokus + Hook, Auswahl -> Freigabe fuer Skript.
5. [x] `caption` -> JSON (2 Varianten + 5 Hashtags) als Auswahl; Gesamttext editierbar -> Drive.

## Status

2026-08-27 — Alles gebaut und live verifiziert: recherche/caption liefern valides JSON (3/3 bzw.
2 Varianten + exakt 5 Hashtags); MC-UI rendert Fokus+Hook als Radios; Auswahl+"Uebernehmen"
setzte `freigabe` korrekt; Progress-Bar sichtbar waehrend Request; Einzelvideo-Name
`WEE_HuehnernahrungmitMaden_Reel.mp4` ohne Reihe. Keine JS-Fehler.

## Definition of Done

Geprueft gegen: Einzelvideo-Name ok · Progress-Bar sichtbar · Fokus/Hook-Auswahl -> Freigabe ·
Caption-JSON 2+5 · keine JS-Fehler · Server `HTTP 200`.
Offen: Caption-Save-to-Drive im Browser noch nicht durchgeklickt (Backend-Pfad steht) · MC-Muster
auf weitere Stellen ausweiten bei Bedarf.
