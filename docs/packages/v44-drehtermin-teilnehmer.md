# v44 — Drehtermin-Teilnehmer (Google-Kalender-Einladungen)

## PIG

**Problem:** Drehtermine landen im Google-Kalender, aber man kann niemanden dazu einladen.
Die Teilnehmer-Mechanik liegt in `lib/gcal.js` brach (`eventKoerper` mappt `teilnehmer→attendees`,
alle Calls nutzen `?sendUpdates=all`), wird aber nirgends gefuellt — `server.js` setzt fix
`teilnehmer: []`, das Datenmodell hat kein Teilnehmer-Feld, das UI kein Eingabefeld.

**Intent:** Pro Drehtermin Leute per Mail einladen — beim Anlegen UND per Klick auf den Termin.
Google verschickt die Einladung; wenn Projekte zu-/abgehen, aktualisieren sich die Kalender der
Eingeladenen. Ohne Mail-Spam bei jeder Kleinigkeit. [Owner, 15.09.2026]

**Goal:** Klick auf einen Drehtermin (oder Anlege-Modal) → Teilnehmer per Mail hinzufuegen/
entfernen (frei getippt oder aus einer gespeicherten Personen-Liste), gespeichert am Termin.
Google mailt Erst-Einladung, neue Teilnehmer und Absagen; Karten-/Detail-Aenderungen
aktualisieren die Kalender der Eingeladenen **still** (kein Mail-Spam). UI-Abnahme per Screenshot.

---

## Design-Entscheidungen [Owner, 15.09.2026]

- **Personen-Liste** (Name + Mail) gespeichert in `defaults.json` (via vorhandenes `/api/defaults`);
  im Teilnehmer-Feld anklickbar, freie Mail-Eingabe bleibt moeglich.
- **Default-Anzeige = Mail des verbundenen Google-Kontos** (aus `calendars/primary`.id) als
  Organisator-Zeile, damit sichtbar ist, wo der Termin sowieso landet. Read-only, kein echter Extra-Attendee.
- **`sendUpdates` differenziert** ("sanfte Updates"):
  - Erst-Einladung (Termin anlegen), **neuer Teilnehmer**, Absage/Loeschen → `all` (Google mailt).
  - Karte zu/ab, Datum/Ort/Titel geaendert → `none` (Kalender der Eingeladenen aktualisiert sich
    still, keine Mail). Google propagiert PATCH-Aenderungen auch bei `none` in die Teilnehmer-Kalender.
- **Sicherheit:** Einladungen sind vom Nutzer initiiert (er tippt die Mail + speichert). Der
  Assistent traegt nie selbst fremde Mails ein. Verify nur per Selbst-Einladung (Konto-Mail).

## Datenmodell
- `leereDrehtermin()` += `teilnehmer: []` (Mails); Migration wie `drehterminId` (via normalisiere).
- `defaults` += `personen: [{ name, email }]`.
- Am Termin bleibt `gcalEventId`; Teilnehmer stehen in `teilnehmer`.

## Backend
- `lib/gcal.js`: `eventAnlegen/eventUpdaten` bekommen `sendUpdates`-Parameter (Default `all`);
  neue `kontoMail()` → `GET calendars/primary` → `.id` (die Konto-Mail).
- `server.js`: `/api/gcal/sync` liest `termin.teilnehmer` (statt `[]`) und `mailen` ("all"|"none")
  → reicht es an `eventKoerper`/`sendUpdates`; neuer `GET /api/gcal/konto` → `{ email }`.

## Store (public/store.js)
- `gcalSync(terminId, { mailen })` → sendet `termin.teilnehmer` + `mailen`.
- Mutations-Verdrahtung: `drehterminAnlegen` → `all`; `teilnehmerHinzufuegen` → `all`;
  `teilnehmerEntfernen`/`karteZuTermin`/`karteVonTermin`/`drehterminAendern` → `none`;
  `drehterminLoeschen` → Absage (`all`).
- Neue Helfer: `teilnehmerHinzufuegen(terminId, mail)`, `teilnehmerEntfernen(terminId, mail)`,
  `personen()`/`personMerken(name,mail)`/`personLoeschen(mail)` (in defaults), `kontoMail()` (cachen in `S.googleKonto`).

## UI (public/drehtermine.js)
- `detail(id)` UND `modalDrehtermin` bekommen eine **Teilnehmer-Sektion**: Organisator-Zeile
  (Konto-Mail, read-only) · Chips der Teilnehmer mit ×-Entfernen · Eingabe (Mail, Format-Check)
  + Quick-Picks aus der Personen-Liste + „als Person merken".
- Hinzufuegen/Entfernen ruft die Store-Helfer → Auto-Sync mit passendem `mailen`.

## Plan
1. [ ] `lib/pipeline.js` — `teilnehmer: []` in `leereDrehtermin`; Migration greift via normalisiere.
2. [ ] `lib/gcal.js` — `sendUpdates`-Param an eventAnlegen/eventUpdaten; `kontoMail()`.
3. [ ] `server.js` — sync nimmt `teilnehmer` + `mailen`; `GET /api/gcal/konto`.
4. [ ] `public/store.js` — `gcalSync(mailen)`, Teilnehmer-/Personen-Helfer, Konto-Cache, Mutations-Verdrahtung.
5. [ ] `public/drehtermine.js` — Teilnehmer-Sektion in Detail + Anlege-Modal.
6. [ ] Verify: CDP-Screenshot (Teilnehmer-Sektion) + kontrollierter Selbst-Einladungs-Roundtrip
   (Attendee = Konto-Mail, Event lesen → attendees gesetzt → loeschen; keine fremde Mail).

## Koordination
Beruehrt geteilte Dateien (pipeline.js, server.js, store.js, drehtermine.js, defaults) — vor dem
Bau die aktiven Sessions per tell-session warnen und das Fenster kurz halten.

## Stand
- [x] Bestand geprueft (15.09.2026): gcal.js hat attendees+sendUpdates=all; server.js `teilnehmer:[]`
      fix; leereDrehtermin ohne teilnehmer; detail()/modalDrehtermin vorhanden; `/api/defaults` da;
      Auto-Sync via Workflow-Flag `gcal-autosync` (v26).
- [x] Weichen mit Owner (15.09.2026): Personen-Liste + frei; Default = Konto-Mail; sanfte Updates.
- [x] **Gebaut (15.09.2026):** pipeline (`teilnehmer:[]`); gcal (`sendUpdates`-Param an
      eventAnlegen/eventUpdaten, `kontoMail()`); server (sync liest `teilnehmer`+`mailen`,
      `GET /api/gcal/konto`); store (`gcalSync(mailen)`, `teilnehmerHinzufuegen/Entfernen`,
      `personen/personMerken/personLoeschen`, `kontoMail`-Cache, Defaults um `personen`,
      Mutations-`mailen`: anlegen=all, Karten/Detail=none, Teilnehmer +/- = all, loeschen=Absage);
      drehtermine.js (Teilnehmer-Sektion in `detail`, Anlegen oeffnet Detail sofort); style.css (Chips).
- [x] **UI verifiziert (15.09.2026):** CDP-Screenshot Detail — „Teilnehmer einladen" mit
      Organisator-Zeile, Chips, Mail-Eingabe + Einladen + merken; graceful ohne Google-Konto.
      `node --check` aller Dateien gruen.
- [ ] **BLOCKER Live-Test:** Google-Refresh-Token ist abgelaufen ("Token has been expired or
      revoked") — OAuth-Consent-Screen steht auf **Testing** (Refresh-Token laufen nach 7 Tagen ab,
      verbunden 03.09.). Owner: neu verbinden UND OAuth-App auf **Production** veroeffentlichen
      (stoppt den 7-Tage-Ablauf). Erst danach Selbst-Einladungs-Roundtrip.
- [ ] Nachtrag `status`: meldet „verbunden" nur anhand vorhandenem Refresh-Token, nicht ob er gilt
      (irrefuehrend) — spaeter echten Ping erwaegen.

## DoD
- [ ] Teilnehmer im Detail UND beim Anlegen per Mail/Personen-Liste setzbar; Konto-Mail als Default sichtbar.
- [ ] Anlegen + neuer Teilnehmer + Loeschen mailen; Karten-/Detail-Aenderung aktualisiert still.
- [ ] Teilnehmer persistieren am Termin; Personen-Liste persistiert in defaults.
- [ ] Verify: Screenshot + Selbst-Einladungs-Roundtrip (attendees gesetzt, dann geloescht).
