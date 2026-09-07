# v37 — Feinschliff: Karten-Anlage, Popups, Terminfrist, Hook-Editor

## PIG

**Problem:** Sechs vom Owner beobachtete Rauhkanten im Karten-Durchlauf „Skript → Fertig"
(Beleg: Owner-Liste + Screenshot vom 07.09.2026):

1. „Karte anlegen" steht in JEDER Spalte, obwohl Karten nur am Kettenanfang entstehen sollen.
2. Das „Neue Idee"-Popup traegt Fremdtexte/Doppelungen und passt gestalterisch nicht ins System.
3. Das „Lege „…" an und erstelle den Drive-Ordner"-Popup zeigt KEINE drehende Sanduhr.
4. Das automatisch vergebene Upload-Datum haelt die Mindestfristen fuer Schnitt und Dreh nicht
   ein → automatische Drehtermine liegen in der Vergangenheit → Fehlermeldung.
5. Buttons im Seiten-/Leistenmenue (Detail-Panel) kleben vertikal ohne Abstand aneinander.
6. Nach gewaehltem visuellem Hook bleibt die Auswahl im Leistenmenue sichtbar (Entscheidung ist
   schon getroffen), und die editierbaren Skript-Felder sind teils nicht scrollbar/schwer zu
   bearbeiten.

**Intent:** Der eine Karten-Durchlauf soll sich sauber anfuehlen — Karten entstehen nur, wo sie
sollen; Popups fuehren ruhig; automatische Termine sind terminlich gueltig; der Hook-Schritt
kollabiert nach der Wahl und das Skript laesst sich bequem bearbeiten.

**Goal:**
1. Karten-Anlage-Option (`Karte anlegen`) nur in der ersten Spalte (Logik-ID `idee`,
   Anzeigename „Skript schreiben"); alle weiteren Spalten ohne diese Option.
2. „Neue Idee"-Popup: schlichtes, system-konformes Layout ohne unnoetige Texte.
3. Sanduhr im „Lege … an"-Ladezustand des Popups.
4. Automatisches Upload-Datum haelt einen Mindestvorlauf ein, sodass Schnitt- und Dreh-Termine
   nie in der Vergangenheit liegen — keine Fehlermeldung mehr bei Auto-Drehterminen.
5. Vertikaler Abstand (Padding/Gap) zwischen den gestapelten Buttons im Detail-Panel.
6a. Nach gesetztem visuellem Hook wird die Auswahl zur Ergebniszeile kollabiert (Auswahlpunkte
    verschwinden), analog Fokus/Verbaler Hook.
6b. Die Skript-Felder Fokus / Verbaler Hook / Sichtbarer Hook sind komfortabel editierbar
    (wachsende bzw. scrollbare Textfelder statt einzeiliger Eingaben).

---

## Bestandsaufnahme (gemessen 07.09.2026)

- **P1** `public/board.js:187–197`: `neuKnopf` („Karte anlegen") wird an JEDE Spalte gehaengt
  (`fuss.appendChild(neuKnopf)`). Der KI-Ideen-Knopf steht dagegen schon nur bei `p.id === "idee"`
  (`board.js:201`). Erste Spalte = `lib/pipeline.js:15–23` (`id: "idee"`, Name „Skript schreiben").
  Spalten koennen aus Drive umbenannt werden, aber die Logik-ID `idee` bleibt stabil.
- **P2** `public/nachschub.js:135–153` (`zeigeIdee`): „Neue Idee"-Karte mit vielen Inline-Styles;
  Zeile `„← andere Idee · übernehmen →"` (`:147`) doppelt semantisch die beiden Buttons darunter
  (`Andere Idee` / `Als Karte anlegen`, `:150–151`).
- **P3** `public/nachschub.js:82–83` (`zeigeLaden`): setzt nur `box.innerHTML = "<div>…text…</div>"`,
  keine Sanduhr. Der wiederverwendbare Indikator `sanduhr(text, {klein})` existiert bereits
  (`public/ui.js:185–190`, dreht via CSS, respektiert `prefers-reduced-motion`).
- **P4** Slot-Herkunft: `public/nachschub.js:32` filtert `slots.filter(s => s.datum >= heuteISO)` —
  OHNE Vorlauf. `naechsteFreieSlots(...,1)` (`nachschub.js:51`, `lib/pipeline.js:498`) nimmt daher
  den fruehesten Slot, auch wenn er in wenigen Tagen liegt. Rueckwaertsplan:
  `VORLAUF_TAGE = { schnitt: 6, freigabe: 3 }` (`pipeline.js:162`), Dreh-Fenster
  `[upload−20, upload−6]` (`drehFenster`, `pipeline.js:185–192`). Auto-Drehtermin:
  `store.js:182–192` mit `autoDrehNoetig(...)`. Liegt Upload < heute+6, ist der spaeteste gueltige
  Dreh (`upload−6`) schon in der Vergangenheit → Fehler. Gleiche Slot-Quelle nutzen auch die
  „Naechster freier Upload-Termin"-Checkbox (`detail.js:696–706`) und schwebende Karten
  (`store.js` `schwebendeNeuBerechnen`).
- **P5** Detail-Panel = `aside.detail` (`public/index.html`). Buttons/Felder werden dort ueber
  `feld(...)`/`knopf(...)` gestapelt an `box` gehaengt; der vertikale Abstand fehlt an den
  Stapel-Stellen. Exakter Selektor wird in der Bau-Phase am Live-Screenshot festgenagelt.
- **P6a** `public/detail.js:1060–1089` (`guidedIdee`, Stufe 3): rendert die visuelle
  Hook-Wahlgruppe, solange `k.hooksVisuell` existiert — OHNE Pruefung auf `k.chosenVisuell`.
  Ist der Hook gewaehlt, bleibt `stufe === 3` (`detail.js:995`), also wird die Wahlgruppe
  weiter gezeigt; gleichzeitig ist `ideeFertig` true (`detail.js:935–937`) und `skriptLoop`
  laeuft darunter — genau der Doppelzustand im Screenshot.
- **P6b** `public/detail.js:1148–1158` (`skriptLoop`): Fokus = `textfeld(...,2,...)` (2 Zeilen),
  Verbaler & Sichtbarer Hook = `eingabe(...)` (einzeiliges `<input>`). Langer Text ist einzeilig
  weder ganz sichtbar noch bequem editierbar.

## Design-Entscheidungen

- **P1:** Kleinster Eingriff — `neuKnopf` nur anhaengen, wenn `p.id === "idee"`. Keine neue
  Konfiguration; die Kette hat einen definierten Anfang, spaetere Spalten bekommen Karten nur
  per Zug oder Weiter-Schritt.
- **P4:** Ein Mindestvorlauf `MIN_UPLOAD_VORLAUF_TAGE`, abgeleitet aus dem Rueckwaertsplan, damit
  die Regel EINE Quelle hat und nicht dreifach driftet. Untergrenze so, dass Dreh und Schnitt in
  der Zukunft liegen: `upload ≥ heute + VORLAUF_TAGE.schnitt + Dreh-Puffer`. Der Puffer wird beim
  Bau festgelegt (Vorschlag: kleiner Dreh-Vorlauf, z. B. 2 Tage → Mindestvorlauf 8 Tage) und im
  Paket begruendet. Der Filter wandert von `nachschub.js:32` in eine gemeinsame Helferfunktion in
  `lib/pipeline.js`, damit Popup, Detail-Checkbox und schwebende Karten dieselbe Grenze nutzen.
- **P6a:** Symmetrie zu Fokus/Verbal — bei gesetztem `chosenVisuell` eine `gewaehltZeile`
  („Sichtbarer Hook: …") statt der Wahlgruppe, mit demselben „Einen Schritt zurueck".
- **P6b:** Alle drei Skript-Felder auf ein mehrzeiliges, mitwachsendes/scrollbares Textfeld
  vereinheitlichen (gemeinsamer Helfer), statt zweier `<input>`.
- **Optische Abnahme:** `docs/ui-standard.md` existiert hier nicht — Massstab ist
  `docs/best-practices.md` + der bestehende Retro-Look (v28). Jede Phase endet mit echtem
  Browser-Screenshot gegen diesen Look.

## Plan (phasenweise)

- **v37-1 — Board/Karten-Anlage (P1):** `public/board.js` — `neuKnopf` nur bei `p.id === "idee"`.
  *Verify:* Screenshot Board; „Karte anlegen" nur in Spalte 1, spaetere Spalten ohne den Knopf.
- **v37-2 — Popups (P2, P3):** `public/nachschub.js` — `zeigeIdee` gestalterisch beruhigen
  (Fremdtext/Doppelung raus, System-Klassen statt Inline-Styles wo moeglich); `zeigeLaden` auf
  `sanduhr()` umstellen. *Verify:* Screenshot „Neue Idee" + Screenshot Ladezustand mit drehender
  Sanduhr.
- **v37-3 — Terminfrist (P4):** Mindestvorlauf-Helfer in `lib/pipeline.js`, angewandt in
  `public/nachschub.js` (Slot-Filter), `public/detail.js` (freier-Upload-Termin) und der
  schwebenden-Karten-Rechnung (`public/store.js`). *Verify:* Auto-Idee/-Termin anlegen; erzeugte
  Dreh-/Schnitt-Termine liegen in der Zukunft, keine Fehlermeldung (belegt mit den erzeugten
  Datumswerten + `node --check`).
- **v37-4 — Hook-Editor (P5, P6a, P6b):** `public/detail.js` — Wahlgruppe bei gesetztem
  `chosenVisuell` zur `gewaehltZeile` kollabieren; die drei Skript-Felder auf mehrzeilige,
  scroll-/wachsbare Textfelder vereinheitlichen; `public/style.css` — vertikaler Abstand der
  gestapelten Detail-Panel-Buttons. *Verify:* Screenshot nach Hook-Wahl (keine Auswahlpunkte mehr,
  Felder gut editierbar, Buttons mit Luecke).

## Stand

- 07.09.2026: Bestand gemessen, Plan angelegt. Bau noch nicht begonnen.

## DoD

- [ ] P1: „Karte anlegen" nur in der ersten Spalte; spaetere Spalten ohne Anlage-Option
- [ ] P2: „Neue Idee"-Popup ohne Fremdtext/Doppelung, system-konform (Screenshot)
- [ ] P3: „Lege … an"-Ladezustand zeigt die drehende Sanduhr (Screenshot)
- [ ] P4: Auto-Upload-Datum haelt Mindestvorlauf; erzeugte Dreh-/Schnitt-Termine nie in der
      Vergangenheit; kein Fehler bei Auto-Drehterminen (belegt mit Datumswerten)
- [ ] P5: Detail-Panel-Buttons mit sichtbarem vertikalem Abstand (Screenshot)
- [ ] P6a: Nach Hook-Wahl keine Auswahlpunkte mehr, nur Ergebniszeile (Screenshot)
- [ ] P6b: Fokus/Verbaler/Sichtbarer Hook komfortabel editierbar (mehrzeilig/scrollbar)
- [ ] `node --check` gruen fuer alle geaenderten Dateien
