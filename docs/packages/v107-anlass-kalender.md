# Arbeitspaket v107: Anlass-Kalender (Feiertage + Aktionstage → Ideen auf dem Silbertablett)

> Stand: PLAN + RECHERCHE, noch nichts gebaut (Owner 05.10.2026: „erstmal Plan und Recherche, baue noch nichts").
> Paketnummer v107, weil v106 bereits vergeben ist (`v106-pop-shop-hintergrund.md`).

**Problem:** Das Board kennt keine Feiertage und Aktionstage (Weltrecyclingtag, Earth Day, World Cleanup Day …). Passende Videos entstehen nur, wenn jemand rechtzeitig selbst daran denkt — und das Board plant Upload-Termine, ohne zu wissen, dass ein Anlass vor der Tür steht.
**Intent:** Anlässe sollen rechtzeitig (Standard 4 Wochen, bei großen Anlässen 8 Wochen) von selbst auftauchen, per Knopfdruck zeitaktuelle Themenvorschläge liefern und als fertig vorbereitete Karten in „Skript schreiben" landen — mit einem Upload-Termin, der zum Anlass UND zum Redaktionsplan passt.
**Goal:** (1) Eine von Hand in Drive pflegbare Anlass-Liste plus lokal berechnete gesetzliche Feiertage; (2) ein Hinweis im Board, sobald ein Anlass ins Vorlauf-Fenster rückt; (3) ein Knopf „Ideen zum Anlass", der mit Websuche 3–5 Vorschläge liefert; (4) eine übernommene Idee wird eine Karte in „Skript schreiben" mit Anlass-Marke und einem Upload-Termin am oder vor dem Anlass-Datum; (5) Prüfsatz der Drive-Konvention besteht: Wer nur Drive öffnet, sieht Liste und Karten und versteht sie.

## Befund Bestand (Code, 05.10.2026)

| Thema | Befund | Beleg |
|---|---|---|
| Feiertage | Nicht vorhanden; nur Wochenend-Meidung | `lib/pipeline.js:544`, `lib/scheduler.js:187,224` |
| Spaltennamen | Board-Spalte **„Skript schreiben" = id `idee`** (Drive `In Bearbeitung/1 Idee`); „Drehtermin festlegen" = id `skript` (`2 Skript`). Neue Karten starten immer in `idee`. | `lib/pipeline.js:15-30` |
| Redaktionsplan | Plan in Drive `System (AI only)/redaktionsplan.json`, Slots deterministisch berechnet (feste Tage der Hauptplattform, kein Wochenende) | `lib/planstore.js`, `lib/scheduler.js:170,244` |
| Feld `kampagnen` | Im Plan speicher- und editierbar, aber vom Scheduler nie gelesen — toter Anknüpfungspunkt | `public/redaktionsplan.js:291`, kein Treffer in `lib/scheduler.js` |
| Upload-Regel | `naechsterFreierUpload()` — Format muss passen, frühestens Drehtermin + 8 Tage | `lib/uploadslots.js:18,51` |
| KI-Ideen | Aufgabe `ideen` liefert `{titel,warum,hook,visuell,saeule,slotIndex}` zu offenen Slots; Popup „Andere Idee / Als Karte anlegen" bzw. Mehrfachliste | `lib/ai.js:382-437`, `public/nachschub.js:35,195` |
| Zeitaktualität | `claude -p` hat selbst keinen Webzugriff; der SERVER sucht vorab (DuckDuckGo, Tavily optional) bei Schritten mit `websuche: true` — heute nur `recherche` | `lib/ai.js:757`, `server.js:380-396`, `lib/websuche.js` |
| Hinweis-Kanäle | Board-Leiste (Wochenlast-Satz `{status,satz}`), Karten-„!"/„i" (`lib/kartenhinweise.js`), Toast mit Aktion (`hinweisToastAktion`), Kalender-Ansicht `public/kalender.js` | `public/board.js`, `public/ui.js:2597` |
| Toast-Regel | Hintergrund-Prüfungen erzeugen KEINEN Toast | `docs/notifications-konvention.md` |
| Google Kalender | Schreibt nur Drehtermine; OAuth-App noch nicht „Production" | `lib/gcal.js` |

## Befund Recherche (Web, je zwei Quellen)

1. **Gesetzliche Feiertage lokal berechnen** (ohne Abhängigkeit, offline): Gauß-Osterformel + Versätze (Karfreitag −2, Ostermontag +1, Himmelfahrt +39, Pfingstmontag +50, Fronleichnam +60), Buß- und Bettag = Mittwoch vor dem 23.11., feste Tage pro Bundesland als kleine Tabelle. Quellen: spektrum.de (Gaußsche Osterformel), computerwoche.de (Feiertage berechnen). Alternative: npm `date-holidays` 3.37.0 (offline, gepflegt, aber 4 Abhängigkeiten + CC-BY-SA-Nennung). Online-APIs (Nager.Date — Domain gerade auf nagerholidays.com umgezogen; feiertage-api.de — keine Lizenzangabe) nur zum einmaligen Gegenprüfen.
2. **Aktionstage: keine brauchbare Maschinen-Quelle.** UN-Liste (un.org/en/observances) ohne ICS/JSON und mit Nutzungsbedingungen gegen Weiterverbreitung; kleiner-kalender.de iCal unbestätigt (nur eine Quelle). Einzelne Daten sind Fakten, aber das Datenbank-Herstellerrecht (§ 87a/b UrhG) verbietet die Übernahme wesentlicher Teile fremder Listen → **eigene kuratierte Liste mit 30–60 Tagen, je Eintrag Primärquelle**.
3. **Wandernde Termine:** Earth Overshoot Day nicht berechenbar (2026: 30.07., verkündet 05.06.2026 von Global Footprint Network) → Eintrag „manuell" mit jährlicher Nachschlage-Erinnerung. Regelbasiert berechenbar: Black Friday (Freitag nach 4. Donnerstag Nov.), Kauf-nix-Tag DE (letzter Samstag Nov.), Muttertag (2. Sonntag Mai).
4. **Vorlauf:** Konzept 6–12 Wochen vor großen Anlässen, Inhalte 2–4 Wochen vorher fertig (socialk.it, cloudcampaign.com). → 4 Wochen reichen für kurze Reels; für größere Produktionen 8 Wochen + zweiter Hinweis bei 4 Wochen. Vorlauf pro Eintrag einstellbar.

## Entwurf (Empfehlungen, zur Entscheidung)

### A. Datenquelle — wo die Anlässe leben
- **Gesetzliche Feiertage:** im Code berechnet (`lib/anlaesse.js`), Bundesland als Einstellung. Keine Datei nötig.
- **Aktionstage:** eine Markdown-Tabelle in Drive, für Menschen sichtbar (nicht unter `System (AI only)`), z. B. `Redaktion/Anlässe.md`. Spalten: `Name | Regel | Vorlauf (Tage) | Themen-Stichworte | Quelle | geprüft am | aktiv`. Regel-Vokabular: `fest:03-18`, `n-ter:2:so:05`, `letzter:sa:11`, `ostern:+39`, `manuell:2026-07-30`.
- Startliste schreibe ICH (≈30 Einträge, Schwerpunkt Umwelt/Recycling/Bildung/Ehrenamt, je Primärquelle) — Ben streicht/ergänzt.
- Zeile nicht lesbar → Board zeigt sie als Befund („Regel unverständlich"), statt still zu überspringen.

### B. Benachrichtigung — wo der Hinweis erscheint
1. **Board-Leiste** (neben dem Wochenlast-Satz), gleiches `{status,satz}`-Muster: „Weltrecyclingtag am 18.03. — in 26 Tagen, noch keine Karte dazu." + Knopf „Ideen holen". **Empfohlen als Hauptkanal.**
2. **Kalender-Marken** im Redaktionsplan-Monat und in `kalender.js` (Anlass als Tagesmarke).
3. **Oben in der Spalte „Skript schreiben"** eine schmale Anlass-Zeile (siehe E).
4. Toast nur, wenn der Nutzer selbst „Ideen holen" klickt (Toast-Regel: Hintergrund erzeugt keinen Toast).
5. Später, nach Google-OAuth-Freigabe: optional Ganztages-Termin im Google Kalender. Nicht Teil von v107.
- Hinweis verschwindet, sobald mindestens eine Karte mit dieser Anlass-Marke existiert oder der Anlass per „Diesmal auslassen" abgehakt ist (gespeichert in Drive, damit alle Rechner dasselbe sehen).

### C. KI-Knopf „Ideen zum Anlass"
- Erweiterung der bestehenden Aufgabe `ideen` um einen Anlass-Block (Name, Datum, Themen-Stichworte) — kein neues System.
- `websuche: true` für diesen Schritt: Server sucht z. B. „<Anlass> <Jahr> Deutschland aktuell" und legt die Treffer vor den Prompt → zeitaktuelle Bezüge (neue Zahlen, Gesetze, Kampagnen).
- Ergebnis: 3–5 Vorschläge `{titel, warum, hook, format, aktueller Bezug + Quelle}` im vorhandenen Mehrfach-Popup (`zeigeIdeen`).
- Prompt-Vorlage liegt wie alle anderen in `prompts.json` und ist im Prompt-Editor änderbar.

### D. Upload-Termin und Redaktionsplan
- Übernommene Anlass-Karte bekommt einen **festen** Upload (nicht schwebend): bevorzugt der letzte Plan-Slot passenden Formats **am oder vor** dem Anlass-Datum, höchstens 3 Tage vorher; Posten AM Tag ist Ideal.
- Kein passender Slot → Angebot „Zusatztermin am Anlass-Tag" mit Bestätigung (bewusste Abweichung vom Plan, sichtbar markiert).
- **Machbarkeit:** liegt der frühestmögliche Upload (Drehtermin + 8 Tage) NACH dem Anlass → Hinweis „zu knapp für Video — als Bild/Karussell?" statt stiller Fehlplanung.
- Anlass-Karten zählen normal ins Wochenziel; die Rückwärtsplanung (Dreh, Schnitt) läuft unverändert ab dem Upload-Datum.
- Das tote Feld `kampagnen` NICHT wiederbeleben (andere Bedeutung, unklarer Zweck) — Anlässe bekommen eine eigene, klar benannte Struktur.

### E. Sichtbarkeit in „Skript schreiben"
- **Empfehlung E1:** Nur angenommene Ideen werden echte Karten (Drive-Ordner in `1 Idee`) mit Marke „Anlass: Weltrecyclingtag 18.03." und vorausgefülltem Steckbrief (Hook, Warum, aktueller Bezug). Darüber eine Anlass-Zeile in der Spalte als Einstieg. Besteht den Drive-Prüfsatz ohne neuen Kartenzustand.
- **Alternative E2:** Unangenommene Vorschläge als gestrichelte „Vorschlags-Karten" oben in der Spalte, gespeichert in einer Drive-Datei `Redaktion/Vorschläge.md`. Mehr „Silbertablett", aber ein neuer Kartenzustand und eine zweite Wahrheit neben den Projektordnern.

## Offene Entscheidungen (Ben)

1. **Bundesland** für gesetzliche Feiertage (Sitz WEE?) — oder nur bundesweite Feiertage?
2. **Feiertage auch als Sperrtage** im Redaktionsplan (z. B. kein Upload an Weihnachten/Ostern)? Erweitert den Umfang.
3. **Vorschläge vor der Annahme sichtbar** (E2) oder nur angenommene Karten (E1, empfohlen)?
4. **Vorlauf:** Standard 28 Tage, große Anlässe 56 Tage mit zweitem Hinweis bei 28 — passt das?
5. **Ort der Liste in Drive:** `Redaktion/Anlässe.md` oder anderer Ordner?

## Owner-Entscheidungen 05.10.2026 (ersetzen den Entwurf oben, wo sie abweichen)

1. Bundesland irrelevant. Gesetzliche Feiertage nur, wenn thematisch relevant; dazu Aktionstage der Öko-Nische (Weltrecyclingtag u. ä.).
2. Integration als **Kampagnen des Redaktionsplans** (das vorhandene Feld `kampagnen`). Zwei Kampagnen anlegen: „Gesetzliche Feiertage" und „Aktionstage" — editierbar und löschbar, keine fest verdrahteten System-Kampagnen.
3. **Jede Kampagne hat genau eine Tabelle in Drive** mit allen Daten.
4. **Knopf je fälligem Anlass in der ersten Spalte („Skript schreiben")**: für alle aktiven Kampagnen, sobald ein Anlass in den nächsten 60 Tagen liegt und noch kein Projekt dazu existiert. Beschriftung = Anlass. Klick = wie „Idee von der KI": Themenvorschläge/Titel, Karte mit Ziel, Zielgruppe, Format und Upload-Termin.
5. **Keine Sperrtage.** Feiertage blockieren keinen Upload; Ziel ist, rechtzeitig zu produzieren, damit am Anlass-Tag hochgeladen werden kann.

## Bauentwurf (aus den Entscheidungen)

- **Begriff:** „Aktionstage" (auch Gedenk- oder Welttage) — Tage, die Organisationen ausrufen, um auf ein Thema aufmerksam zu machen; keine gesetzlichen Feiertage.
- **Ablage:** Kampagnen-Liste bleibt in `System (AI only)/redaktionsplan.json` (`kampagnen: [{id, name, aktiv, tabelle}]`). Die Tabellen liegen menschenlesbar in `Kampagnen/<Name>.csv` (Wurzel; fremde Wurzelordner erlaubt laut `pruefeStruktur`), Dialekt wie die KPI-Tabellen (UTF-8 mit BOM, Semikolon) — öffnet per Doppelklick in Sheets/Excel. `Kampagnen/LIESMICH.md` erklärt die Spalten und Datumsformen.
- **Spalten:** `Anlass;Datum;Themen;Ziel;Zielgruppe;Format;Quelle`. Datum in Menschenform: `18.03.` (jährlich), `30.07.2026` (einmalig), `Ostern+39`, `2. Sonntag im Mai`, `letzter Samstag im November`, `4. Donnerstag im November+1`.
- **Anlegen der zwei Kampagnen:** einmalig durch den Board-Server selbst (Merker `kampagnenVorlage` im Plan) — läuft auf Bens Rechner beim nächsten Start und auch im künftigen neuen Drive-Ordner. Gelöschte Kampagnen kommen nicht wieder.
- **Upload-Termin:** der Anlass-Tag selbst, fest (nicht schwebend); Uhrzeit und Plattformen vom Plan-Slot desselben Formats. Ist der frühestmögliche Upload später, zeigt der Vorschlag das als Hinweis.
- **Verknüpfung Karte ↔ Anlass:** Feld `card.anlass` (landet mit der Karte in `projekt.json`) + Zeile im `Steckbrief.md` — wer nur Drive öffnet, sieht den Anlass.

## Plan (Bau freigegeben 05.10.2026)

1. [x] Entscheidungen eingeholt (oben).
2. [ ] `lib/kampagnen.js`: Datumsregeln (inkl. Osterformel), CSV lesen/schreiben, „anstehend in 60 Tagen", Vorlagen der zwei Kampagnen; Selbsttest gegen bekannte Daten.
3. [ ] Server: `GET /api/kampagnen/anstehend` (legt die Vorlagen einmalig an, liest die Tabellen), Tabelle beim Speichern neuer Kampagnen anlegen.
4. [ ] KI-Aufgabe `anlass_ideen` (mit Websuche), Popup wie „Idee von der KI", Karte mit Anlass, Ziel, Format, Upload am Anlass-Tag.
5. [ ] Knöpfe in „Skript schreiben"; Kampagnen-Bereich im Redaktionsplan (Name, aktiv, Tabelle, löschen); Steckbrief-Zeile.
6. [ ] Verify: Selbsttest, isolierte Board-Kopie, Screenshot gegen `docs/ui-standard.md`.

## Stand

05.10.2026 — Plan + Recherche angelegt. Code-Bestand per Explore-Agent gelesen, zwei Kernaussagen selbst nachgeprüft (`lib/pipeline.js:15-30` Spaltennamen; `grep kampagnen` ohne Treffer in `lib/scheduler.js`). Web-Recherche mit je zwei Quellen (URLs im Recherche-Bericht dieser Sitzung; Kernquellen oben genannt). Nichts gebaut.

05.10.2026 (abends) — Bau Schritte 2–5 im Code: `lib/kampagnen.js` (Selbsttest `node tools/kampagnen-selbsttest.mjs` 40/40), `GET /api/kampagnen/anstehend` + Vorlagen-Anlage in `GET /api/plan`, KI-Aufgabe `anlass_ideen` (Websuche an, keine offenen Platzhalter), Anlass-Knöpfe in „Skript schreiben", Kampagnen-Bereich im Redaktionsplan, Steckbrief-Zeile. Syntax aller Dateien geprüft (`node --check`). NICHT geprüft: Lauf im Board (isolierte Kopie, Drive-Anlage, KI-Aufruf) und Screenshot — Nutzungslimit erreicht.

## Definition of Done

Geprueft gegen: Selbsttest `lib/anlaesse.js` (Datums-Fälle 2026/2027), Board-Kopie Port 4399 (Hinweis, Knopf, Karten-Anlage, Upload-Slot), Screenshot gegen `docs/ui-standard.md`, Drive-Prüfsatz.
Offen: Entscheidungen 1–5 (Ben); gesamter Bau.
