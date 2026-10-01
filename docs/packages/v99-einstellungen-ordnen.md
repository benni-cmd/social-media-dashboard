# v99 — Einstellungen logisch ordnen

> Owner 01.10.2026: „Alles, was da drin ist, ist richtig, aber die Zuordnung links an die Tabs ist sinnlos. Was sich hinter
> ‚Ansicht' verbirgt, hat nichts mit Ansicht zu tun. Hinweise und Warnungen könnte man als Mitteilungen zusammenfassen.
> Logisch ordnen, aufräumen und an sinnvollen Stellen übersichtlicher gestalten."

## PIG

**Problem:** Neun Tabs in gewachsener Reihenfolge ohne Gruppen. „Ansicht" enthält Fristen (Deadline-Vorlauf, Ampel-Regeln);
„Externe Dienste" mischt Google-Konten, die Claude-Anmeldung, den Einrichtungs-Assistenten und „Board zurücksetzen";
„Board & Redaktionsplan" enthält nur Kategorien und Ziele. Technisch hängen Tab und Seite an Positionsnummern
(`public/ui.js`, „alle folgenden Index-Prüfungen verschoben" — drei Umbauten).
**Intent:** Wer etwas einstellen will, findet es unter dem Namen, den es tatsächlich trägt.
**Goal:** Vier Gruppen mit sprechenden Tab-Namen; Inhalte unverändert, nur am richtigen Ort; Verknüpfung über eine Tab-Liste statt Nummern.

## Neue Ordnung

| Gruppe | Tab | Inhalt |
|---|---|---|
| Board | Termine & Fristen | Deadline-Vorlauf, Ampel-Regeln (bisher „Ansicht") |
| Board | Mitteilungen | Warnungen und Hinweise an der Karte (bisher „Hinweise & Warnungen") |
| Board | Kategorien & Ziele | bisher „Board & Redaktionsplan" |
| Inhalte & KI | Unternehmenskontext | unverändert |
| Inhalte & KI | Prompts | bisher „System Prompts" |
| Inhalte & KI | KI-Rollen | Modelle je Rolle + Claude-Anmeldung (bisher unter „Externe Dienste") |
| Verbindungen | Google | Drive, Kalender + Tasks |
| Verbindungen | Social Media | Instagram, LinkedIn, Datenquelle der Auswertung |
| System | Darstellung | Farbschema, Cursor |
| System | Einrichtung | Assistent starten, Board zurücksetzen |

## Plan

1. [x] `public/ui.js`: Tab-Liste `{gruppe, name, seite, beimOeffnen}`; Navigation mit Gruppen-Überschriften daraus bauen.
2. [x] Seiten-Titel und Texte, die auf alte Tab-Namen verweisen (Code, README, INSTALL), nachziehen.
3. [x] Claude-Zeile in „KI-Rollen" (oben), Einrichtung + Zurücksetzen auf eigene Seite.
4. [x] Verify: Screenshot jedes Tabs auf der Kopie, Konsole fehlerfrei.

## Stand

01.10.2026 — gebaut und belegt (Kopie :4399). Navigation: [Board] Termine & Fristen · Mitteilungen · Kategorien & Ziele ·
[Inhalte & KI] Unternehmenskontext · Prompts · KI-Rollen · [Verbindungen] Google · Social Media · [System] Darstellung · Einrichtung.
Alle zehn Tabs per Klick geöffnet: je genau eine Seite aktiv, Inhalte wie vorher (Claude-Zeile oben in KI-Rollen, Einrichtung +
Zurücksetzen auf eigener Seite). Übersicht: unter „Termine & Fristen" steht der einstellbare Deadline-Vorlauf jetzt vor den festen
Ampel-Regeln (Screenshot). Alte Tab-Namen in Board-Texten, README und INSTALL ersetzt (grep: 0 Treffer).

## DoD

- [x] Alle zehn Tabs öffnen ihre Seite, Inhalte vollständig wie vorher
- [x] Keine Positionsnummern mehr in der Tab-Verknüpfung
- [x] Kein Verweis auf alte Tab-Namen im Board-Text
