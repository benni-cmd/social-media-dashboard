# v97 — Upload-Daten fest an der Karte, Posts automatisch der richtigen Karte zuordnen (Plan, vorgemerkt)

> Owner 01.10.2026: „Die Upload-Daten sollen fest im Board hinterlegt sein, sodass, wenn die API-Abfrage später neue
> KPIs von den Plattformen zieht, die zeitlich automatisch den richtigen Videos zugeordnet werden können. Ich weiß nicht,
> ob die Funktion schon steht, aber sie muss rein. Plane sie jetzt, mindestens vormerken, damit sie beim Redaktionsplan
> und weiteren Schritten berücksichtigt wird."

## PIG

**Problem (gelesen 01.10.2026):**
1. Die KPI-Messung existiert (`lib/kpi.js` `pruefeKarten`, Intervalle 24 h … 2 Monate, Ablage `Videoauswertung/KPI/`),
   misst aber nur Karten mit `card.published[plattform] = Post-ID` — und **nichts im Board füllt dieses Feld**
   (`grep "published" public lib server.js`: nur Lesestellen). Ergebnis: 0 von 18 Karten haben `published`, es wird nie gemessen.
2. Schwebende Karten („nächster freier Upload-Termin") rücken weiter, solange nichts sie festhält — auch kurz vor oder nach
   dem Upload. Ein Datum, das sich nachträglich verschiebt, taugt nicht zur Zuordnung.
3. Geplantes Datum ≠ tatsächliche Veröffentlichung (früher, später, andere Uhrzeit) — die Zuordnung braucht Toleranz.

**Intent:** Jede veröffentlichte Karte kennt ihren Post auf jeder Plattform, ohne dass jemand IDs kopiert; danach laufen
die Messungen und die Wochenstatistik je Karte von allein.

**Goal:** (a) Upload-Datum wird fest, sobald die Karte in „Upload"/„Fertig" steht oder das Datum erreicht ist. (b) Neue Posts
werden der Karte zugeordnet: eindeutig → automatisch, unklar → Vorschlag zum Bestätigen, sonst manuell per Liste. (c) Die
vorhandene KPI-Messung startet ab der echten Post-Zeit.

## Plan

1. **Festschreiben** (`public/store.js` `schwebendeNeuBerechnen`, `lib/pipeline.js`): Karten ab Spalte „Upload" oder mit
   Datum ≤ heute schweben nicht mehr (`floatUpload = false`); das geplante Datum bleibt als `dates.upload`, dazu
   `geplant: {datum, uhrzeit, slot}` — unveränderlich, Referenz für Auswertung „Plan vs. tatsächlich".
2. **Post-Liste holen** (`lib/social.js`): Instagram `me/media` (id, timestamp, media_type, media_product_type, caption,
   permalink) und LinkedIn-Posts (id, createdAt/firstPublishedAt, Text) der letzten 60 Tage — beides wird heute schon
   für die Auswertung geholt, nur nicht zugeordnet.
3. **Zuordnen** (`lib/zuordnung.js`, neu, rein): je Post die Kandidaten-Karten (nicht verworfen, Upload-Datum gesetzt, auf
   dieser Plattform noch ohne Post, Plattform in `platforms`). Passung:
   - Format: Reel ↔ REELS/VIDEO · Slider ↔ CAROUSEL_ALBUM · Beitrag ↔ IMAGE · Story ↔ STORY (nur Live-API, 24 h)
   - Zeit: Abstand Post-Zeit ↔ geplantes Datum+Uhrzeit, höchstens 36 h (Vorschlag, siehe Q1)
   - Text (Bonus): gemeinsame Wörter zwischen Caption und Kartentitel/Caption-Lead
   Eindeutig (genau ein Kandidat oder klarer Vorsprung) → `published[pl] = {id, url, zeit, zuordnung: "auto", abweichungStunden}`.
   Mehrdeutig → `zuordnungVorschlag` an der Karte. Je Post höchstens eine Karte.
4. **Wann:** bei jedem KPI-Sammeln (`/api/kpi/collect`) und beim Öffnen der Auswertung; Ergebnis über das Board speichern.
5. **Oberfläche:** Karte zeigt „veröffentlicht am … auf Instagram (automatisch zugeordnet) · Messungen 3/7"; bei Vorschlag
   „Ist das dieser Post? [Vorschau] Ja / Nein"; Kontextmenü „Post zuordnen …" mit der Liste nicht zugeordneter Posts;
   Zuordnung lösen.
6. **KPI-Messung:** Intervalle ab `published[pl].zeit` statt ab dem geplanten Datum (`lib/kpi.js` `pruefeKarten`).
7. **Redaktionsplan:** Wochenstatistik (v90) zählt „veröffentlicht" je Karte statt nur je Post; Auswertung „Plan vs. tatsächlich"
   (pünktlich, verschoben, ausgefallen).
8. **Verify:** echte Daten — Bens Instagram hat 21 Posts (letzter 04.08.2026); Testkarte mit Datum eines echten Posts → automatische
   Zuordnung; zwei Karten am selben Tag → Vorschlag statt Automatik.

## Entscheidungen (Owner 01.10.2026)

- **Q1 Toleranz:** „nur wenige Stunden" → **3 Stunden**; das Format muss passen, damit Reel und Story am selben Tag unterscheidbar sind.
- **Q2 Automatik:** eindeutige Treffer automatisch; „im Zweifel soll das Board nach Bestätigung der Zuordnung fragen".
- **Redaktionsplan:** feste beste Tage und Uhrzeit; „darf variiert werden, um langfristig Daten zu sammeln und zu vergleichen" →
  Wochentage fest, Uhrzeit wechselt wöchentlich zwischen den beiden belegten Fenstern der Hauptplattform (`lib/scheduler.js`).

## Berücksichtigt in

- v95 Redaktionsplan: Slots tragen `hauptplattform` — die Zuordnung prüft zuerst die Hauptplattform.
- v90 Wochenstatistik, v89 Upload-Regel: das feste Datum aus Schritt 1 ist ihre Grundlage.

## Stand

01.10.2026 — gebaut und belegt.
- `lib/zuordnung.js` (rein): Probe mit 25 echten Instagram-Posts — Reel-Karte 04.08. 13:00 ↔ Post 13:25 → automatisch (0,4 Std.);
  Story-Karte am selben Tag bekommt den Reel-Post nicht (Format); zwei Reel-Karten 08:00/08:30 am 23.07. → beide Vorschlag;
  Karte ohne Uhrzeit → Vorschlag; 3,5 Std. daneben → Vorschlag.
- Server: `zuordnungPruefen()` (Start nach 60 s, vor dem KPI-Lauf; `/api/kpi/collect`; Knopf an der Karte), `/api/zuordnung/entscheiden`;
  geänderte Karten auch in ihre `projekt.json`. Kopie :4399 mit Testkarten: `{"auto":1,"vorschlaege":1,"posts":21}`; „Ja, das ist er" → „von dir bestätigt".
- Festschreiben: schwebende Karten ab Spalte „Upload" oder erreichtem Datum werden fest (`floatUpload=false`); zugeordnete ebenso.
- KPI: `pruefeKarten` misst ab der echten Post-Zeit — Testkarten fällig 24h…1m bzw. 24h…2m (2-Monats-Messung beim 04.08. korrekt noch nicht fällig).
- Belegt-Regel: ein Termin ist belegt nach Datum + Format (nicht Uhrzeit), damit die Uhrzeit-Variation keine Doppelbelegung erzeugt.

Offen: Zuordnung von Hand aus einer Postliste (für Posts, die zeitlich zu keiner Karte passen); Wochenstatistik zählt „veröffentlicht"
noch je Post statt je Karte; Bens echte Karten liegen alle nach dem letzten Instagram-Post (04.08.) — erste echte Zuordnung beim nächsten Upload.

## DoD

- [x] Karten ab „Upload" schweben nicht mehr; geplantes Datum unveränderlich gespeichert
- [x] Echte Instagram-Posts werden passenden Karten automatisch zugeordnet; Mehrdeutiges als Vorschlag
- [~] KPI-Messung läuft für zugeordnete Karten (erste Messung belegt)
