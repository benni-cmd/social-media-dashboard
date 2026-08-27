# Work package: v3 — Bens Arbeitsweise ins Dashboard adaptieren

> Autonome Runde, waehrend Ben unterwegs ist. Grundlage: Bens realer Social-Media-Prompt
> (World Eden Era / Project Oasis). NICHT 1:1 uebernommen, sondern die Methode dahinter
> strukturiert und ins Board eingebaut.

**Problem:** Die KI-Buttons waren generisch. Ben arbeitet aber nach festen Marken-Regeln und
einer strikten Zwei-Phasen-Logik (Phase 1 iterativer Jam: Recherche/Fokus/Hooks · Phase 2
Produktion: Teleprompter, Regieplan, Captions). Das Board bildete das noch nicht ab, und es
fehlten Felder (Reihe, Episode, Format, Dateiname).

**Intent:** Das Board soll SO arbeiten wie Ben: jeder KI-Aufruf traegt automatisch den festen
Marken-/Regel-Rahmen (max ~50 s, wissenschaftlich-aber-umgangssprachlich, positiv, echter
Sprechfluss, persoenliche Hooks, CTA mit offener Frage + Follow, Reihen-Kontinuitaet), und die
Pipeline-Spalten setzen die Zwei-Phasen-Trennung durch.

**Goal:** Pro Stufe die passende Phase-Aktion; Marken-Regeln als System-Vorspann bei jedem
Aufruf; Karten-Felder fuer Reihe/Episode/Format + automatisch vorgeschlagener Dateiname;
Reihen-Kontext (andere Videos derselben Reihe) fliesst in die KI ein.

## Abbildung Prompt -> Pipeline

- **Idee = Phase 1 (Jam):** Button "Recherche, Fokus & Hooks" -> Zusammenfassung/Hard Facts,
  Hauptfokus + 2 Alternativen, Haupt-Hook (verbal & visuell) + 2 Alternativen. Iterativ.
- **Skript = Phase 2a:** Button "Skript & Teleprompter" -> One-Screen-Teleprompter in [CHUNK n],
  max ~50 s, CTA-Regel. Button "Regieplan & Metadaten" -> Shotlist-Tabelle (Zeit/Typ/Visuell/
  Audio+SFX/Schnitt, Wechsel alle 3-6 s), Dateiname-Konvention, Musik-Prompt, Schnitt-Rhythmus.
- **Caption = Phase 2b:** Button "Captions" -> 2 Varianten (IG/TikTok vs LinkedIn) + exakt 5
  Hashtags (#WorldEdenEra, #ProjectOasis + 3).

## Plan

1. [x] Marken-/Regel-Rahmen als System-Vorspann in `server.js` (`MARKE_REGELN`).
2. [x] KI-Aufgaben auf Bens Methode umgebaut: recherche · skript · regieplan · caption.
3. [x] Reihen-Kontext: Titel anderer Karten derselben Reihe gehen als Kontext in den Prompt.
4. [x] Karten-Felder: Reihe, Episode, Format (+ Upload-Datum, Notizen). Dateiname automatisch
       vorgeschlagen: `WEE_<Reihe>_EP<Episode>_<Thema>_<Format>.mp4`.
5. [x] Stufen-spezifische Buttons + Anzeige/Uebernahme der KI-Ergebnisse je Karte.
6. [ ] Optische Abnahme (Ben, per Start-Board.cmd) + offene Fragen am Ende klaeren.

## Status

2026-08-27 — Autonome Runde gebaut und verifiziert. `POST /api/ai` mit task=recherche lieferte
strukturkonformen Phase-1-Text (Hard Facts, Hauptfokus, Hooks) — Marken-Regeln greifen. Neue
Felder (Reihe/Episode/Format/Dateiname) rendern, keine JS-Fehler in der Konsole. Server laeuft.
Offene Fragen fuer Ben unten gesammelt.

## Offene Fragen fuer Ben (am Ende klaeren, nicht blockierend)

- Marke/Serie: ist "WEE" das richtige Kuerzel? Welche festen Reihen gibt es schon?
- Sollen die Marken-Regeln pro Karte abschaltbar/anpassbar sein (z. B. andere Zielgruppe)?
- Regieplan als reiner Text ok, oder brauchst du den (wie im Prompt) als PDF-Export?
- Reihen-Kontext: reicht "Titel der anderen Reihen-Videos", oder auch deren Skript-Inhalt?

## Nachtrag (autonome Runde, 2026-08-27)

- Ergebnis-Archiv pro Karte gebaut (aufklappbar je Aufgabe, Kopieren, Sprechzeit-Schaetzung),
  end-to-end im Browser verifiziert (Button -> KI -> gespeichert -> Archiv-Block).
- `recherche` und `skript` live getestet: Struktur + 50-s/CTA-Regel + Reihen-Kontinuitaet sitzen.
- Bug gefunden+behoben: `claude` las die Werkbank-CLAUDE.md und haengte Arbeitsregeln
  ("Geprueft gegen:") an die Texte -> KI-Aufrufe laufen jetzt im neutralen Temp-cwd.

## Definition of Done

Geprueft gegen: `POST /api/ai` (recherche + skript) liefert Ben-konformen Text ohne Fremd-
Artefakte · Archiv rendert im Browser · neue Felder rendern/speichern · Dateiname stimmt ·
Reihen-Kontext im Prompt · Server laeuft (`HTTP 200`).
Offen: optische Abnahme (Ben) · offene Fragen oben · PDF-Export (evtl.) · Google-Phasen (v2).
