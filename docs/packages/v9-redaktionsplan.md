# Work package: v9 — Redaktionsplan (Content-Planung)

> Work artifact per `working-method.md` — lebt im Repo dieses Projekts.

**Problem:** Es gibt keine strategische Planungsschicht. Der "Redaktionsplan Vorschlagen"-Button
ruft die KI blind auf — ohne dass Ben festgelegt hat, welche Content-Typen (Reels, Slider, Beitrag,
Story, Highlight), Inhaltskategorien (Bildung, Spendenaufruf, Projektbegleitung, Partnerpost,
Umfrage/Austausch), Ziele (Informieren, Community, Spenden, Unterstützung) oder Kadenz gelten.
Die Ideen-Generierung kennt weder Lücken noch geplante Upload-Typen.

**Intent:** Eine persistente Konfiguration (Kadenz, Typ-Mix, Kategorien, Zielgewichte, Kampagnen)
gibt der KI den Rahmen. Sie generiert daraus terminierte Upload-Slots (Datum + Uhrzeit + Typ +
Kategorie + Ziel), die in `data/plan.json` bleiben. Wenn Ideen generiert werden, sehen KI und
Nutzer, welche Slots noch offen sind — die erzeugten Karten bekommen Datum und Format des passenden
Slots vorbelegt.

**Goal:** (1) Button "Redaktionsplan" öffnet Panel mit Einstellungsformular + Slot-Liste. (2)
Einstellungen persistieren in `data/plan.json` via `/api/plan`. (3) "Slots generieren" erzeugt
Upload-Slots mit Typ/Kategorie/Ziel (KI, einstellungs-gesteuert). (4) "Ideen generieren" sieht
offene Slots und schlägt passende Ideen vor — slotIndex steuert Vorschlag. (5) Neue Karte aus Idee
mit Slot-Zuordnung bekommt Upload-Datum, Uhrzeit und Format vorbelegt, Slot gilt als belegt.

## Plan

1. [x] `lib/pipeline.js`: CONTENTTYPEN, INHALTSKATEGORIEN, contenttypName, kategorieName,
       neueSlotId, defaultPlan hinzufügen.
2. [x] `server.js`: PLAN_FILE + `/api/plan` GET/PUT.
3. [x] `lib/ai.js`: `plan`-Task auf Slots umstellen (Datum + Typ + Kategorie + Ziel, kein Titel).
       `ideen`-Task bekommt offene Slots als Kontext + slotIndex im Rückgabe-Schema.
4. [x] `public/redaktionsplan.js` (neu): Panel mit Einstellungsformular + Slot-Liste.
5. [x] `public/nachschub.js`: `holeIdeen` liest offene Slots; `zeigeIdeen` zeigt Slot-Empfehlung
       und belegt Slot beim Karten-Anlegen. `holePlan` entfernt.
6. [x] `public/board.js`: Import auf `zeigeRedaktionsplan`, Button umbenannt.

## Status

2026-08-31 — Gebaut.

## Definition of Done

Geprueft gegen: Panel öffnet · Einstellungen speichern · Slots generieren · Ideen kennen Slots ·
Karte aus Idee bekommt Datum/Format vorbelegt · Slot wird belegt.
Offen: Ideenregeln (welche Slot-Kategorie welche KI-Inhalte steuert) — TODO für separate Session
(Owner-Auftrag 2026-08-31).
