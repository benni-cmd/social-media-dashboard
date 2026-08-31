# Work package: v10 — Idee-Seitenleiste verfeinern + Light Mode

> Owner-Auftrag 31.08.2026: Seitenleisten nacheinander verfeinern, angefangen bei Idee.
> Erklaertexte raus, Info-Tooltips nur wo noetig, Plattform-Defaults, intelligenter
> Terminvorschlag, progressive Aufdeckung (Sektionen erst nach vorheriger), gefuehrter
> Loop ohne Restanzeige vorheriger Schritte, Auto-Drive bei Skript-Uebergang.
> Separat: Light Mode als Default + Einstellungs-Dialog (Zahnrad oben rechts).

**Problem:** Die Idee-Seitenleiste zeigt zu viel Text, zu viele Felder auf einmal
und erfordert redundante Klicks (Plattformen jedes Mal waehlen, Datum manuell suchen).
Der gefuehrte Loop zeigt vorherige Schritte nach der Auswahl weiter an, was verwirrt.
Es gibt keinen Light Mode und keine Einstellungen.

**Intent:** Schneller durch den Idee-Prozess kommen, weniger lesen, weniger klicken.
Der User soll nicht verwirrt sein von Optionen, die gerade nicht relevant sind.
Light Mode als zeitgemaesser Standard.

**Goal:** (1) Erklaertexte weg, nur Info-Tooltips bei nicht selbsterklaerenden Feldern.
(2) Plattform-Defaults (Instagram+LinkedIn) mit "neuen Standard speichern"-Button.
(3) Intelligenter Upload-Terminvorschlag (≥3 Wochen, Wochentag, beste Posting-Zeiten),
Akzeptieren oder manuell. Dreh = Upload − 14 Tage. (4) Sektionen in Idee erscheinen
erst wenn die vorherige ausgefuellt ist. (5) Im Loop verschwindet jeder Schritt nach
der Auswahl, der Denkprozess bleibt sichtbar, dann die 3 Varianten. (6) Bei Skript-
Uebergang Auto-Drive-Ordner. (7) Light Mode als Default, Zahnrad → Modal mit
Darstellung. (8) Alles laeuft ohne Konsolenfehler.

## Plan

**P14-A: Info-Tooltip-Komponente**
- `ui.js`: `infoTipp(text)` — kleiner "i"-Kreis, Hover zeigt Erklaerung.
- `style.css`: `.info-tipp` Positionierung und Stil.

**P14-B: blockStamm entschlacken + Plattform-Defaults**
- Erklaertexte bei Content-Saeule, Ziel, Plattformen entfernen.
- Info-Tooltip nur bei Feldern, die nicht offensichtlich sind (Ziel bekommt Tooltip
  mit Kennzahl-Erklaerung, Content-Saeule NICHT).
- `pipeline.js`: `STANDARD_PLATTFORMEN` exportieren (default `["instagram","linkedin"]`).
- `store.js`/`server.js`: `/api/defaults` GET/PUT — speichert User-Defaults in
  `data/defaults.json`. Bei Aenderung der Plattform-Auswahl erscheint Button
  "Neuen Standard speichern", schreibt die aktuelle Auswahl als neuen Default.
- `leereKarte()` liest den Default statt hart `["instagram"]`.

**P14-C: Intelligenter Terminvorschlag**
- `pipeline.js`: `vorschlagUploadDatum(plattformen)` — berechnet das naechste Datum
  ≥21 Tage ab heute, das ein Wochentag ist und auf einen der belegten besten Tage
  fuer die gewaehlten Plattformen faellt (Di/Mi/Do fuer Instagram+LinkedIn).
- `pipeline.js`: `VORLAUF_TAGE` vereinfachen — nur `dreh: 14, upload: 0`; die
  restlichen Termine (idee, skript, schnitt, freigabe) bleiben intern fuer den
  Mini-Kalender, werden aber in der Idee-Phase nicht angezeigt.
- `detail.js`: In der Idee-Phase statt des vollen Termin-Blocks: vorgeschlagenes
  Datum + "Diesen Termin uebernehmen" + darunter "Anderes Datum waehlen" → Kalender.

**P14-D: Progressive Aufdeckung in der Idee-Seitenleiste**
- `detail.js`: `zeichneDetail` bei column==="idee" zeigt Sektionen schrittweise:
  1. "Worum geht es" immer sichtbar (Thema, Saeule, Ziel, Plattformen).
  2. "Termine" erst wenn Thema + Saeule + Ziel gesetzt.
  3. "Arbeit in Idee" erst wenn Termine gesetzt oder akzeptiert.
- Button heisst "Recherchieren und Definieren" statt "Recherche und Fokus".
- Im guidedIdee-Loop: nach jeder Auswahl verschwindet der vorherige Schritt komplett
  (keine Fokus-Anzeige, keine Wahlgruppe mehr), nur die "gewaehlt"-Zusammenfassung
  als kompakter Einzeiler bleibt. Der Denkprozess (Panel) bleibt waehrend des Laufs
  sichtbar und verschwindet danach.
- Nach visueller Hook-Auswahl: `schiebe` nach Skript + Auto-Drive-Ordner anlegen.

**P15: Light Mode + Einstellungs-Dialog**
- `style.css`: Vollstaendiges Light-Farbschema unter `:root` als Default,
  Dark-Schema unter `[data-theme="dark"]`.
- `index.html`: Zahnrad-Button rechts in der Kopfzeile.
- `app.js`/`ui.js`: `einstellungenModal()` — zentriertes Popup, Liste links
  ("Darstellung"), Inhalt rechts (Toggle Light/Dark). Setzt `data-theme` auf
  `<html>` und speichert in `localStorage`.
- `ui.js`: Zahnrad-Icon in ICONS.

## Stand — 31.08.2026

| Schritt | Status |
|---|---|
| P14-A Info-Tooltip-Komponente | fertig |
| P14-B blockStamm + Plattform-Defaults | fertig |
| P14-C Intelligenter Terminvorschlag | fertig |
| P14-D Progressive Aufdeckung + Auto-Drive | fertig |
| P15 Light Mode + Einstellungs-Dialog | fertig |
| Optische Abnahme (Light + Dark, Sidebar) | fertig |

Alle DoD-Punkte im Browser verifiziert (Screenshot-Abnahme 31.08.2026).

## Definition of Done

- [x] Keine Erklaertexte in der Idee-Seitenleiste, nur Info-Tooltips wo noetig.
- [x] Plattform-Defaults Instagram+LinkedIn, "neuen Standard speichern" funktioniert.
- [x] Upload-Vorschlag ≥3 Wochen, Wochentag, passend zu Plattformen. Akzeptieren/manuell.
- [x] Sektionen erscheinen schrittweise. Loop-Schritte verschwinden nach Auswahl.
- [x] Auto-Drive bei Skript-Uebergang.
- [x] Light Mode als Default, Dark Mode ueber Einstellungen erreichbar.
- [x] Keine Konsolenfehler in beiden Modi (nach Server-Neustart alle Requests 200 OK).
