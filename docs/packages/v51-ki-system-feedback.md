# Work package: v51 — Einheitliches KI-/System-Fortschritts-Feedback (Terminal)

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 17.09.2026,
> BEVOR gebaut wird. Stand: Audit abgeschlossen, Bau noch nicht begonnen.

**Problem:** KI wird an vielen Stellen ausgeloest (Knoepfe wie Idee/Recherche/Skript/Captions
und im Hintergrund verkettete Aufrufe). Waehrend ein Aufruf laeuft — besonders waehrend ein
Ollama-Modell erst startet/laedt — gibt es kein verlaessliches Signal; der Nutzer weiss nicht,
ob etwas passiert oder ob es haengt. Dasselbe bei Drive-Abgleich und Ladezeiten.

**Intent:** Man soll IMMER sehen, was die KI bzw. das System gerade tut — ohne je zu denken
„da laeuft nichts / das ist kaputt" — aber ohne unnoetig zu blockieren.

**Goal:** Ein einheitliches, terminal-artiges Fortschritts-Feedback im vorhandenen Design:
ein kleines Terminal-Fenster erscheint kontextuell an der Stelle, an der die KI-Arbeit laeuft
(am ausloesenden Knopf / an der Karte / im Modal), zeigt die echten Phasen live
(„Ollama startet → Modell laedt → generiert → 6 Web-Treffer → fertig"), ist aufklappbar zum
vollen Log und verschwindet nach Abschluss von selbst. Zusaetzlich zeigt der ausloesende Knopf
einen Inline-Zustand („startet …"). Gleiches Feedback-Prinzip fuer Drive-Abgleich und
Ladezeiten. Nicht-blockierend, wo nicht noetig.

---

## Randbedingungen (Owner 17.09.2026)

- KEINE neue Funktion ausser dem Feedback, KEINE Funktion entfernen, KEINE zusaetzliche
  Bedien-Komplexitaet.
- Nicht anfassen: `data/prompts.json` (bewusste Owner-Aenderungen bleiben).
  `data/board.json` / `data/plan.json` sind untracked Caches (v41/v48) — nicht committen.
- Design: `docs/ui-standard.md` der Werkbank (Status-Woerter Regel 3, kein Unicode-Symbol
  statt Icon Regel 5) + die bestehende Retro-Optik (v23 visueller Umbau / v28 Retro-Look).
- **Praemissen-Korrektur:** `docs/ui-standard.md` ist gegen die Werkbank-Kommandobruecke
  geschrieben (`HD.statusChip`, `HD.icon`, `render/icons.js`) — dieses Board hat die
  Entsprechungen unter eigenen Namen (`statusChip`, `icon` in `public/ui.js`). Regel 3 und
  Regel 5 gelten also ueber diese Board-Bausteine.

---

## Inventar der Ausloeser (AUDIT — Teilpaket 1, abgeschlossen 17.09.2026)

> Erhoben in vier parallelen Pruefungen (KI-Knoepfe · Hintergrund-/verkettete KI ·
> Drive-/Ladepunkte · Backend-Pfad). Jede Zeile mit Datei:Zeile belegt.

### A. KI-Ausloeser im Frontend (11 Stellen, davon 1 tot)

Alle laufen ueber EINEN Client-Einstieg: `kiStream(task, nutzlast, onEreignis)`
(`public/store.js:426`) → `POST /api/ai/stream` (`server.js:515`) → `laufePipeline()`
(`server.js:178`). Das nicht-streamende `ki()` (`store.js:416`) hat **keinen Aufrufer** —
toter Pfad, `detail.js:47` importiert es ins Leere.

| Nr | Datei:Zeile | Ausloeser | Rolle / Kette | heutiges Feedback |
|---|---|---|---|---|
| A1 | `detail.js:925` | Knopf „Captions je Plattform" | `caption` → userkomm, 1 Schritt | Knoepfe der Box disabled + `denkPanel`; Toast am Ende |
| A2 | `detail.js:983` | Knopf „Recherchieren und Definieren" | `recherche` → **3 Schritte** (`lib/ai.js:538`): userkomm → recherche (mit Websuche) → userkomm | wie A1 — aber nur Schritt 3 streamt Text |
| A3 | `detail.js:1017` | **kein Knopf** — Klick auf eine Fokus-Auswahlzeile startet sofort KI | `hooks_verbal` → userkomm, 1 | nur `denkPanel`, keine Ankuendigung |
| A4 | `detail.js:1030` | Knopf „Verbale Hooks holen" | `hooks_verbal` → userkomm, 1 | wie A1 |
| A5 | `detail.js:1044` | **kein Knopf** — Klick auf eine Verbal-Hook-Zeile startet sofort KI | `hooks_visuell` → userkomm, 1 | nur `denkPanel` |
| A6 | `detail.js:1082` | Knopf „Visuelle Hooks holen" | `hooks_visuell` → userkomm, 1 | wie A1 |
| A7 | `detail.js:1200` | Knopf „Skript schreiben" / „Skript neu schreiben" | `skript` → userkomm, 1 | wie A1 |
| A8 | `nachschub.js:114` (via `:204`) | **kein Knopf** — das Oeffnen des Ideen-Modals startet sofort KI | `ideen` → userkomm, 1 | `denkPanel` im Modal, `laeuft`-Flag sperrt Tasten |
| A9 | `nachschub.js:169` | Knopf „Andere Idee" / Pfeil links | `ideen` → userkomm, 1 je Klick | wie A8 |
| A10 | `board.js:215` | Knopf „Idee von der KI" im Fuss der Spalte „Idee" | `ideen` (indirekt ueber `holeIdee()`) | beide Fuss-Knoepfe disabled; Feedback liegt sonst ganz im Modal |
| A11 | `nachschub.js:327` | **TOTER CODE** — `holePlan()` nicht exportiert, kein Aufrufer (Kommentar `:317`) | `plan` | — |

Einziger KI-Einstieg in der Detailspalte: `rufeKi(task, k, knopfEl, box)` (`detail.js:1810`),
sieben Aufrufer (A1–A7). Der Parameter `knopfEl` ist **tot** — disabled wird ueber
`box.querySelectorAll(".knopf")` gesetzt. Der Auto-Kontextabgleich aus v40 liegt seit v41
(`93a20f0`) nicht mehr im Client, sondern als Schritt 3 der Recherche-Kette auf dem Server
(`lib/ai.js:565-571`); Rest-Kommentar `detail.js:1819-1820`. Wer den gefuehrten Idee-Loop
(`detail.js:974`) durchlaeuft, loest **fuenf** KI-Aufrufe aus, von denen nur der erste an
einem beschrifteten Knopf haengt.

Keine KI in: `auswertung.js`, `kalender.js`, `drehtermine.js`, `app.js`, `redaktionsplan.js`,
`lib/scheduler.js`, `lib/workflows.js` (keiner der neun Workflows ruft KI),
`lib/pipeline.js` (trotz Namen: Board-Modell, kein `lib/ai.js`-Import).

### B. Drei Stellen, an denen es heute wirklich stumm wird

1. **Die Innenschritte der Recherche-Kette.** Nur der letzte Schritt streamt
   (`server.js:220`); waehrend Schritt 1 und 2 bleibt das Konsolenfenster leer, nur die
   Ueberschrift wechselt. Der Nutzer sieht minutenlang ein leeres Terminal.
2. **Der Kopf sagt die Unwahrheit.** `rufeKi` setzt weder `setStand()` noch `melde()`; das
   mitlaufende `speichere()` (`store.js:179/187`) schreibt „Speichere …" → „Stand
   gespeichert." in denselben Platz, waehrend drei Modelle noch arbeiten.
3. **Das Panel ueberlebt den Lauf nicht.** Ein `zeichne()` von aussen (z. B. der nachladende
   Drive-Scan `detail.js:191-197`) baut die Detailspalte neu auf und entfernt das Panel; im
   Ideen-Modal schliesst ein Klick neben das Overlay (`nachschub.js:75`) ohne `laeuft`-Pruefung.
   Der `kiStream`-Aufruf laeuft danach unsichtbar weiter.

### C. Backend — was der Stream heute kann und was fehlt

- **Transport: NDJSON**, nicht SSE — `content-type: application/x-ndjson` (`server.js:523`),
  eine Zeile = ein JSON-Objekt.
- **Vier Ereignistypen, sonst nichts** (`server.js:533-539`): `{t:"status",text}` ·
  `{t:"delta",text}` · `{t:"done",text,data}` · `{t:"error",error,hint}`. Client-Gegenprobe
  `store.js:455-458`; unbekannte Typen werden still verschluckt (kein `else`) — ein neuer
  Ereignistyp bricht also keinen alten Client.
- `status` ist ein **deutscher Freitext-String**, kein maschinenlesbarer Code:
  `"Schritt 2/3 · Recherche · 6 Web-Treffer (duckduckgo) · llama3.2 (lokal)"`.
  Schritt-Index, Rolle, Modellname und **Trefferzahl existieren bereits als Variablen**
  (`server.js:190-196`, `treffer.length` in `:208`) — sie werden nur zu einem String verklebt.
- **Ollama laeuft ueber die OpenAI-Schicht**: `OLLAMA_URL = "http://localhost:11434/v1/chat/completions"`
  (`lib/ai.js:764`), `runOllama` `:766`, `runOllamaStream` `:795`. Deshalb kommen die nativen
  Felder `load_duration`/`total_duration`/`done_reason` nirgends an — repo-weit null Treffer.
- **Keine Kaltstart-Erkennung.** `/api/ps` wird genau einmal benutzt, und zwar zum **Entladen
  beim Shutdown** (`server.js:1322-1336`); `/api/tags` nur in `pingOllama` (`lib/ai.js:848`)
  fuer den Einstellungs-Dialog; `/api/show` nirgends.
- Timeout 300 s per `AbortController` (`lib/ai.js:767`, `:796`), **kein Retry, kein
  Modell-Fallback, kein `keep_alive`** im Generierungs-Call, keine Abbruchbehandlung bei
  Client-Disconnect.
- **Namenskollision beachten:** `lib/pipeline.js:15` exportiert `PHASEN` als Board-Spalten
  (`idee`, `skript`, `videodreh`, …). Die neuen KI-Phasen heissen deshalb im Code `stufe`,
  nicht `phase`.
- **Nebenbefund (Bug, klein):** `server.js:509` und `:539` rufen `ki.hinweisZuFehler(e)` ohne
  zweites Argument; der Default ist `provider="claude"` (`lib/ai.js:742`) — ein Ollama-Fehler
  zeigt heute den Claude-Hinweistext.

### D. Eigene Messung des Ollama-Kaltstarts (17.09.2026)

Befehl: `curl -s http://127.0.0.1:11434/api/chat -d '{"model":"deepseek-r1:14b",...,"stream":false}'`
auf ein Modell, das laut `/api/ps` **nicht geladen** war (geladen war `qwen2.5:14b`):

| Feld | Wert |
|---|---|
| Wanduhr gesamt | **26 854 ms** |
| `total_duration` | 26,73 s |
| **`load_duration`** | **25,38 s** |
| `prompt_eval_duration` | 0,47 s |
| `eval_duration` | 0,86 s |

**25 von 27 Sekunden sind reines Modell-Laden.** Genau diese Zeit ist im Board heute komplett
stumm. Gegenprobe auf derselben Maschine: `/v1/chat/completions` (der Weg, den `lib/ai.js:764`
benutzt) liefert die Felder `id, object, created, model, system_fingerprint, choices, usage` —
`load_duration` und `total_duration` sind **nicht** dabei. Die Kaltstart-Zeit ist ueber den
heutigen Weg also nicht messbar, nur ueber `/api/ps` vorher oder ueber den nativen Endpunkt.
Vorhandene Modelle: `deepseek-r1:14b`, `qwen2.5:14b`, `qwen2.5-coder:14b`, `gemma4:26b`
(Befehl: `curl -s http://127.0.0.1:11434/api/tags`). Standard-Rollen `recherche`/`kontext`
zeigen auf `deepseek-r1` (`store.js:383`) — also auf ein Modell, das typischerweise kalt ist.

### E. Drive- und Ladepunkte (28 Stellen; die fuenf stummen zuerst)

| Nr | Datei:Zeile | Ausloeser | gemessene Dauer / Timeout | heutiges Feedback |
|---|---|---|---|---|
| E1 | `app.js:404-411` | **Hintergrund-Abgleich** beim Start + alle 30 Min | v25 gemessen 67–70 s gedrosselt, ~10–15 s auf eigener client_id | **voellig stumm** (`.catch(()=>{})`), Karten springen ohne Vorwarnung um |
| E2 | `detail.js:1606-1628` | Knoepfe „Skript laden (n)" / „Rohmaterial laden (n)" | `rclone copy` + ZIP, **Timeout 900 s** (`drive.js:407`) | **keins** — reiner `<a>`-Klick, nur der Browser-Balken |
| E3 | `redaktionsplan.js:110-158` | Knopf „Redaktionsplan" | `/api/plan` **live mit 34,8 s gemessen** (v47) | statischer Text „Redaktionsplan wird geladen …", **keine Sanduhr** — die laengste Wartezeit der App |
| E4 | `detail.js:621-650` | Termin-Kachel „Naechstes freies Datum" | `/api/plan`, bis 35 s | Text „Wird geladen …" + `cursor:wait` |
| E5 | `store.js:215-228` | Karte loeschen (v46) | `findeOrdner` + `moveDir`, **Timeout 180 s** | **nichts** waehrend des Laufs |

Weitere Punkte mit vorhandenem Feedback (nicht stumm, aber Teil der Vereinheitlichung):
Board-Start `app.js:346` (Sanduhr) · Drive-Abgleich aus dem Kopf-Menue `app.js:164` (Sanduhr +
Balken) · Neu laden `app.js:149` · Speichern `store.js:174` (Statuswort) · Karte oeffnen
`detail.js:192` (Kachel-Sanduhr, gemessen 21 057 ms kalt / 2 376 ms / 2 ms aus Cache) ·
Projektordner anlegen `detail.js:1556` · Video-Upload `detail.js:1344` · Rohmaterial-Upload
`detail.js:1380` (Zaehler n/N) · Skript nach Drive `detail.js:1860` · Plan speichern
`redaktionsplan.js:334` · Einstellungen → Externe Dienste `ui.js:759` (v45 gemessen 14,5 s →
3,6 s) · Auswertung `auswertung.js:55` (Sanduhr).

**Querschnitts-Ursache:** alle rclone-Aufrufe laufen durch EINE globale Promise-Kette
(`lib/drive.js:225-230`) — ein haengender Call blockiert jede andere Drive-Operation der App.

### F. Was wiederverwendet wird (statt neu gebaut)

| Baustein | Ort | Rolle im Umbau |
|---|---|---|
| `denkPanel(container, titel)` | `ui.js:160-181` | **wird zum Phasen-Terminal erweitert** |
| `.denk` / `.denk-kopf` / `.denk-text` | `style.css:1950-1988` | Konsolen-Look steht schon [v32 D] |
| `sanduhr(text, {klein})` | `ui.js:191-199` | der eine „hier passiert was"-Marker [v32 E] |
| `fortschritt(container, text)` | `ui.js:375-384` | Sanduhr + Text + Balken, gibt Entfern-Funktion zurueck |
| `standLaedt(text)` | `app.js:29-34` | Sanduhr im Kopf; jedes `setStand()` raeumt sie weg |
| `S.driveScanLaeuft` (Set) + `queueMicrotask(zeichne)` | `store.js:21`, `:244-265` | erprobtes Muster „Zustand setzen → zeichnen → im `finally` zuruecksetzen" |
| `@keyframes sanduhr-dreht` | `style.css:2926-2928` | eine Keyframe fuer alle drei Einsatzorte, respektiert `prefers-reduced-motion` |

---

## Entscheidungen aus dem Audit (getroffen, nicht offen)

1. **Laufregister statt DOM-gebundenes Panel.** Ein Lauf bekommt eine Kennung und lebt in
   `S.laeufe` (Map). Das Terminal zeichnet sich aus diesem Register — ueberlebt also ein
   `zeichne()` und das Schliessen eines Modals (behebt Befund B3).
2. **Feldname `stufe`, nicht `phase`** — `lib/pipeline.js:15` belegt `PHASEN` bereits mit
   den Board-Spalten.
3. **Stream bleibt NDJSON**, es kommt ein Ereignistyp `{t:"stufe", …}` dazu. Alte Clients
   verschlucken unbekannte Typen still (`store.js:455-458`), der Umbau ist also rueckwaertskompatibel.
4. **Kaltstart ueber `/api/ps`**, nicht ueber einen Endpunkt-Wechsel: vor dem ersten
   Ollama-Aufruf `/api/ps` fragen und pruefen, ob das Rollenmodell geladen ist. Das Muster
   steht schon in `server.js:1324-1326`. Der Endpunkt-Wechsel auf `/api/chat` (der
   `load_duration` mitliefern wuerde) wuerde das Response-Parsing in `lib/ai.js:788/832`
   umbauen — zu grosser Eingriff fuer dieses Paket, als Folgeschritt notiert.

## Plan (Teilpakete)

1. [x] **Audit** — alle Ausloeser vollstaendig belegt (Abschnitte A–F oben).
2. [x] **Terminal-Komponente** — `denkPanel` zum Phasen-Terminal erweitert: Stufen-Zeilen,
       aufklappbares Volllog, Auto-Verschwinden; dazu die schwebende Fassung `terminalAn()`.
3. [x] **Backend-Stufen** — `/api/ai/stream` + `lib/ai.js` senden `{t:"stufe"}`-Ereignisse
       (kontext · ollama-start · modell-laedt · generiert · web-suche · web-treffer · fertig ·
       fehler), Kaltstart per `/api/ps`; `hinweisZuFehler`-Provider-Bug geschlossen.
4. [x] **Verdrahtung der KI-Ausloeser** — A1–A10 bekommen Terminal + Knopf-Inline-Zustand
       ueber die zwei Einstiege `rufeKi` (A1–A7) und das Ideen-Modal (A8–A10).
5. [x] **Drive/Laden** — dieselben Bausteine fuer die fuenf stummen Stellen E1–E5.
6. [x] **Verify** — `node --check` auf jede geaenderte Datei, echte Browser-Screenshots
       gegen `docs/ui-standard.md`, Live-Beleg des Ollama-Kaltstarts — mit den unter
       „Offen" namentlich genannten Ausnahmen.

## Teilpaket 7 — Rest nach Owner-Entscheidung (17.09.2026)

Owner hat die offene Entscheidung beantwortet: **Variante (b)** — nur der Drive-Abgleich
bekommt echten Fortschritt aus dem Server, nicht jeder Drive-Weg. Dazu die beiden
Abnahmen, die den echten Board-Stand anfassen, ausdruecklich freigegeben.

**Problem:** Der Drive-Abgleich laeuft 10–70 s und sagt seit Teilpaket 5 zwar „ich laufe",
aber nicht, WO er steht. Zwei Abnahmen aus v51 fehlen: Karte loeschen (E5) und ein echter
Kaltstart-Durchlauf am Detailspalten-Knopf.

**Intent:** Auch die laengste Nicht-KI-Wartestelle soll erzaehlen, was gerade passiert —
mit demselben Vokabular wie die KI, ohne zweites Bedienkonzept.

**Goal:** `POST /api/drive/reconcile/stream` sendet dieselben `{t:"stufe"}`-Zeilen wie der
KI-Stream (Spalten-Abgleich · Ordner je Phase mit Zaehler · Karten-Abgleich · fertig); das
Google+Drive-Badge zeigt die jeweils aktuelle Stufe statt nur der Sanduhr. E5 und der
Kaltstart-Durchlauf sind per echtem Lauf im Browser belegt.

### Plan

1. [ ] `lib/projects.js` — `abgleich(cards, {onStufe})`: eine Stufe je Phasen-Listing
       (`for (const p of PHASEN)`, `lib/projects.js:282` — die acht seriellen Aufrufe sind
       laut v25-Messung der Flaschenhals) und eine je Karte, die wirklich gelesen wird.
2. [ ] `server.js` — Routen-Rumpf in eine Funktion ziehen, damit `/api/drive/reconcile`
       (unveraendert, JSON) und `/api/drive/reconcile/stream` (NDJSON) EINEN Weg teilen.
3. [ ] `public/store.js` — `driveAbgleich()` nimmt den Stream-Weg und legt die Stufe in
       `S.abgleichStufe`; neue Mini-Anmeldung `beiAbgleichStufe(f)`, damit nur das Badge
       neu zeichnet und nicht das ganze Board (ein `zeichne()` je Sekunde waere zu teuer).
4. [ ] `public/app.js` — Badge zeigt `S.abgleichStufe`; der Kopf-Menue-Abgleich ebenso.
       Beide Ausloeser teilen sich das laufende Promise (v32 C3), also gilt es fuer beide.
5. [x] Verify — `node --check`, Screenshot des Badges mit laufender Stufe, plus die
       offenen Abnahmen (E5 siehe Einschraenkung unten).

### Teilpaket 7 umgesetzt + verifiziert (22.09.2026)

Gebaut wie geplant. `fortschritt()` hat zusaetzlich `.text(satz)` bekommen, ohne die
bisherige Rueckgabe zu brechen (es bleibt die Entfern-Funktion, sie traegt jetzt nur eine
Eigenschaft mehr) — damit fuehrt auch der Balken im Kopf-Menue die Stufe nach.
`beiAbgleichStufe()` gibt eine Abmelde-Funktion zurueck, sonst haengte bei jedem Klick auf
„Mit Drive abgleichen" ein Hoerer mehr an einem laengst entfernten Balken.

**Live-Beleg Stufen-Strom** (`curl -sk --no-buffer -X POST https://localhost:4399/api/drive/reconcile/stream`,
71,1 s Gesamtlaufzeit, 11 Zeilen):

```
{"t":"stufe","stufe":"drive-spalten"}
{"t":"stufe","stufe":"drive-ordner","schritt":1,"von":8,"was":"Skript schreiben"}
… Schritte 2-7 …
{"t":"stufe","stufe":"drive-ordner","schritt":8,"von":8,"was":"Verworfen"}
{"t":"stufe","stufe":"fertig"}
{"t":"done","cards":[…]}
```

Gegenprobe: die unveraenderte JSON-Route `POST /api/drive/reconcile` liefert dasselbe
Ergebnis und brauchte im selben Zeitraum 113,6 s — beide Wege laufen also ueber
`fuehreAbgleichAus()`, ohne dass der Stream etwas auslaesst. `drive-karte`-Stufen kamen in
diesem Lauf nicht vor: der v25-Schnellpfad ueberspringt Karten, die schon am richtigen Ort
liegen — genau so gewollt, die Anzeige zaehlt keine Arbeit mit, die nicht anfaellt.

**Optische Abnahme:** Screenshot des Kopfes mit „Gleicht die Spalten mit Drive ab …" und
drehender Sanduhr im Google+Drive-Badge (vorher stand dort nur der fertige Zustand).

### Die offene Abnahme aus v51 ist nachgeholt (22.09.2026)

Das schwebende Terminal ist jetzt im ECHTEN Lauf belegt, nicht mehr mit eingespeisten
Stufen: Karte „Wasserhyazinten", Knopf „Recherchieren und Definieren" (A2, die
3-Schritt-Kette). Terminal erschien unter dem Knopf mit „Recherche und Fokus — die KI
schreibt …" und der Zeile „Kontext wird gesammelt …", der Knopf selbst zeigte „startet …"
und war gesperrt. Im Screenshot ist zu sehen, dass die Detailspalte zwischendurch neu
gezeichnet wurde (der Knopf trug wieder seine Beschriftung) — **und das Terminal stand
weiter da**. Genau dafuer ist die schwebende Fassung gebaut.

Der Lauf wurde vor dem Speichern per Seiten-Neuladen abgebrochen, damit die echte Karte
unveraendert bleibt; gegengeprueft ueber `/api/board`: „Wasserhyazinten" hat weiterhin
keine `recherche`. Die zum Test angelegte Karte wurde ueber den echten UI-Weg wieder
geloescht, das Board steht wieder bei 25 Karten.

## Stand

**17.09.2026** — Paket angelegt, Audit abgeschlossen, **kein Code geaendert**.
Vier parallele Pruefungen: 11 KI-Ausloeser (1 tot), 28 Drive-/Ladepunkte (5 davon stumm),
Backend-Pfad vollstaendig kartiert. Eigene Kaltstart-Messung: `load_duration` 25,38 s von
26,73 s gesamt (`curl` auf `/api/chat`, `deepseek-r1:14b` ungeladen) — das ist die Zeitspanne,
die das Paket sichtbar machen muss.

Koordination: Session „Social Media Dashboard Layout" laeuft parallel im selben Repo und wurde
ueber die geplanten Datei-Beruehrungen informiert. `git status` zeigt fremde Aenderungen nur in
`data/prompts.json` (nicht anfassen) und `docs/packages/v29-ampel-schwellen-und-kopf-punkte.md`
(fremder Stand, nicht anfassen). Ihr v52 (`c44104c`, `5d340ae`) ist committet und gezogen — es
aendert `melde()` und `verdrahteKopf()` in `store.js` und bringt `hinweisToast()` in `ui.js`;
Teilpaket 2 baut darauf auf, nicht dagegen.

### Teilpaket 3 umgesetzt + verifiziert (17.09.2026)

`server.js` — `laufePipeline()` bekommt `onStufe`; die Angaben, die bisher nur zum String `marke`
verklebt wurden, gehen zusaetzlich als Felder raus (`schritt`, `von`, `rolle`, `rolleName`,
`modell`). Neuer NDJSON-Typ `{t:"stufe", …}` in `/api/ai/stream`. Ein Sekunden-Ticker
(`stufenTicker`) meldet waehrend des Modell-Ladens jede Sekunde erneut, damit die Anzeige laeuft
statt still zu stehen. `schreib()` prueft jetzt `res.writableEnded/destroyed` — sonst schriebe der
Ticker in eine abgebrochene Verbindung. `lib/ai.js` — neu `modellStand(model)` (fragt `/api/ps`,
Muster aus `server.js:1324`) und `onErsterToken` in `runOllamaStream`, das genau beim ersten Token
feuert: der exakte Uebergang „laedt" → „generiert". Beide Routen reichen `e.provider` an
`hinweisZuFehler` durch (Bug aus Abschnitt C geschlossen).

**Live-Beleg, Kaltstart** (eigener Testserver `PORT=4399`, alle Modelle vorher per
`keep_alive:0` entladen — `curl /api/ps` gab `{"models":[]}`; dann
`curl -sk --no-buffer -X POST https://localhost:4399/api/ai/stream` mit Aufgabe `skript` auf
`deepseek-r1:14b`), 356 Zeilen mitgeschnitten:

```
[73ms]    stufe=kontext
[1248ms]  status "Schritt 1/1 · Userkommunikation · deepseek-r1:14b (lokal)"
[1270ms]  stufe=modell-laedt sekunden=0   (Schritt 1/1)
   … 48 weitere modell-laedt-Zeilen, je eine pro Sekunde …
[50808ms] stufe=modell-laedt sekunden=50  (Schritt 1/1)
[51219ms] stufe=generiert    (Schritt 1/1)
[88909ms] stufe=fertig       (Schritt 1/1)
[88934ms] done — 929 Zeichen Text
```

**50 Sekunden Modell-Laden, die bis v51 komplett stumm waren, sind jetzt sekundenweise belegt.**
Nebenbefund aus derselben Messung: im ersten Durchgang vergingen 12,4 s zwischen Anfrage und
erster Status-Zeile (Prompts lesen + `unternehmen.sammle()`, das ueber Drive gehen kann) — dafuer
gibt es jetzt die Stufe `kontext`, die nach 73 ms steht. `node --check server.js`,
`node --check lib/ai.js` sauber.

### Teilpakete 2 + 4 umgesetzt + verifiziert (17.09.2026)

`public/ui.js` — `denkPanel()` ist jetzt das Phasen-Terminal: Kopf (Sanduhr · Titel ·
Knopf „Verlauf"), darunter eine Liste der Stufen-Zeilen, darunter der volle Textstrom, per
Vorgabe eingeklappt. Je Stufen-Art und Schritt EINE Zeile — die tickende Ladeanzeige
aktualisiert ihre eigene Zeile, statt fuenfzig gleiche zu stapeln. Die Wortlaute stehen in
EINER Tabelle (`STUFEN_SATZ`), der Server schickt nur den Code. Abschluss-Zeile ueber
`statusChip("ok")`, Fehlerzeile ueber `statusChip("befund")` — Regel 3 des UI-Standards, kein
eigenes Wort und kein eigenes Symbol erfunden. Das Terminal blendet sich bei der Stufe
„fertig" selbst aus (1,4 s), ausser der Verlauf ist aufgeklappt: dann liest jemand mit.
Die alten drei Methoden `delta`/`status`/`weg` sind unveraendert.

Neu daneben `terminalAn(anker, titel)`: dieselbe Komponente, aber schwebend in einer eigenen
Schicht am `body`, kontextuell neben ihrem Ausloeser. Grund ist Befund B3 des Audits — ein
Panel IN der Detailspalte riss bei jedem `zeichne()` mitten im Lauf weg, und der Aufruf lief
danach unsichtbar weiter. Die Schicht ist `pointer-events:none`, das Board bleibt bedienbar
(nicht-blockierend). Kein Platz unter dem Ausloeser (Spaltenfuss) → das Terminal setzt sich
darueber; ein `ResizeObserver` fuehrt die Stelle nach, waehrend es waechst.

`knopfLaeuft(knopf, text)` gibt dem ausloesenden Knopf denselben Zustand inline
(„startet …" → „Modell laedt … 12 s" → „schreibt …") und stellt ihn danach wieder her.

Verdrahtet: `detail.js` `rufeKi()` (der eine Einstieg fuer A1–A7, inklusive der beiden
knopflosen Auswahl-Klicks A3/A5 — dort ist die Box der Anker), `nachschub.js` (A8/A9,
Stufen im Modal-Panel), `board.js` (A10, Knopf-Inline-Zustand), `store.js` `kiStream()`
reicht den neuen Ereignistyp als `{stufe}` durch.

**Optische Abnahme** (echter Browser, eigener Server `PORT=4399`, Viewport 1440×900,
Ollama-Modelle vorher entladen): Screenshot 1 — Ideen-Modal, Terminal mit
„Kontext wird gesammelt …" und „Modell laedt … 22 s — der erste Aufruf eines Modells laedt es
einmalig in den Speicher", Knopf „Idee von der KI" im Inline-Zustand. Screenshot 2 — derselbe
Lauf nach Klick auf „Verlauf": drei Stufen-Zeilen (zwei abgeschlossen, eine laufend) plus der
live stroemende Textstrom darunter. Der Uebergang ist live gemessen: die Ladezeile blieb bei
99 s stehen, dann erschien „Das Modell schreibt — deepseek-r1:14b (lokal) …" und der Log
fuellte sich. Screenshot 3 — schwebendes Terminal am Spaltenfuss-Knopf, oberhalb gesetzt,
mit allen sechs Zeilen bis „ok Fertig.". Selbsttest Auto-Verschwinden: Panel nach der
Stufe „fertig" innerhalb von 2,2 s aus dem DOM; der Chip ist
`<span class="chip chip-ok">` mit Lucide-SVG (Regel 5 eingehalten).
`node --check` sauber auf ui.js, detail.js, board.js, nachschub.js, store.js.

**Ehrlich dazu:** die Screenshots 1 und 2 zeigen einen echten KI-Lauf ueber den ganzen Weg
(Klick → Stream → Anzeige). Screenshot 3 zeigt die schwebende Fassung mit von Hand
eingespeisten Stufen-Objekten derselben Form — die Verdrahtung dahinter
(`rufeKi` → `terminalAn`) ist geprueft, aber nicht per Kaltstart durchgespielt, weil dafuer
eine Karte ohne Recherche angelegt werden muesste und das den echten Board-Stand veraendert.

### Teilpaket 5 umgesetzt + verifiziert (17.09.2026)

Die fuenf stummen Stellen aus Abschnitt E, jede mit dem Baustein, der dort hingehoert —
kein neues Vokabular:

- **E1 Hintergrund-Abgleich** (`app.js`): Das Google+Drive-Badge aus v52 zeigt waehrend des
  Laufs `sanduhr("Gleicht gerade mit Drive ab …")`. Damit das Badge den Lauf ueberhaupt
  sieht, wird jetzt erst `driveAbgleich()` gestartet (das setzt die Laeuft-Marke synchron,
  `store.js:298`) und danach gezeichnet. **Live belegt:** direkt nach dem Laden zeigte das
  Badge „Gleicht gerade mit Drive ab …" mit drehender Sanduhr — vorher lief das voellig
  stumm, und Karten sprangen scheinbar grundlos um.
- **E2 Downloads** (`detail.js`): „Skript laden" / „Rohmaterial laden" bekommen Knopf-Zustand
  und ein schwebendes Terminal. Ehrlich bleibt: bei einem `<a>`-Download kann die Seite den
  Abschluss nicht erfahren — das Terminal sagt deshalb „Der Download startet im Browser,
  sobald das Paket fertig ist." mit dem Statuswort **hinweis**, nicht mit „befund" und nicht
  mit einem erfundenen Fertig-Signal.
- **E3 Redaktionsplan** (`redaktionsplan.js`): statischer Text → `sanduhr("Redaktionsplan
  wird aus Drive gelesen — das dauert einen Moment …")`. **Screenshot belegt.**
- **E4 Naechstes freies Datum** (`detail.js`): „Wird geladen …" → dieselbe Sanduhr
  („Wird aus dem Redaktionsplan gelesen …"). **Screenshot belegt** an der Karte
  „Erdworms und Pflanzenfreundinnen".
- **E5 Karte loeschen** (`store.js`): `setStand("Verschiebe den Drive-Ordner in den
  Papierkorb …")` vor dem Aufruf, der bis zu 180 s dauern kann. Code-Aenderung, nicht
  optisch abgenommen — dafuer muesste eine echte Karte geloescht werden.

Fuer Laeufe ohne Stufen-Ereignisse hat die Terminal-Komponente zwei neue Methoden bekommen:
`arbeit(schluessel, satz)` (laufende Zeile mit eigenem Wortlaut) und `hinweis(satz)`
(Statuswort „hinweis"). Damit braucht kein Drive-Pfad einen Sonderweg.

**Bewusste Ungenauigkeit:** bei den NICHT-letzten Schritten einer Kette (die laufen ueber
`runOllama` ohne Stream) gibt es kein „erstes Token" — dort laeuft der Ticker bis zum Ende des
Schritts durch. Ehrlicher waere ein Wechsel auf den nativen `/api/chat` mit `load_duration`;
das baut aber das Response-Parsing um (`lib/ai.js:788/832`) und bleibt Folgeschritt.

## Definition of Done

Geprueft gegen: vollstaendiges Ausloeser-Inventar (jeder Eintrag mit Datei:Zeile) ·
`node --check` auf jede geaenderte Datei · echter Browser-Screenshot je Ausloeser-Art
(Terminal erscheint, Stufen live, aufklappbar, Knopf-Inline-Zustand, Auto-Verschwinden) ·
Live-Beleg Ollama-Kaltstart im Board (kaltes Modell, Stufe „Modell laedt" sichtbar) ·
`docs/ui-standard.md` Regeln 3 und 5.

### Vollstaendigkeits-Audit (Skill `completeness`, 17.09.2026)

Geprueft gegen den Owner-Auftrag vom 17.09.2026, Anspruch fuer Anspruch. Zwei Zusagen sind
NICHT voll eingeloest, beide unten unter „Offen" benannt statt stillschweigend erledigt:

1. **„Drive-Operationen ebenso mit Fortschritt"** — eingeloest ist die Sichtbarkeit im
   Browser (laeuft / laeuft nicht), NICHT der Fortschritt aus dem Server. Drive-Aufrufe
   antworten weiterhin erst am Ende; es gibt keinen Stufen-Strom fuer Reconcile, Scan,
   Upload oder Papierkorb. Das waere ein zweiter Streaming-Weg neben `/api/ai/stream`.
2. **Knopf-Inline-Zustand** — an allen KI-Knoepfen und den beiden Download-Knoepfen, NICHT
   an „Redaktionsplan" (E3), „Drive erneut lesen" und „Naechstes freies Datum" (E4); dort
   traegt die Sanduhr am Ziel die Anzeige allein.

**Bewusste Achsen-Trennung** (Gegenprobe G2): das aufklappbare Terminal ist fuer Laeufe mit
mehreren Stufen gebaut (KI, Downloads). Eine einzelne Wartestelle ohne Stufen bekommt die
Sanduhr, nicht ein Terminal mit einer Zeile — sonst waere es zusaetzliche Bedien-Komplexitaet,
die der Auftrag ausdruecklich ausschliesst. „Gleiches Feedback-Prinzip" heisst dasselbe
Vokabular, nicht dasselbe Kaestchen an jeder Stelle.

**Folgepflicht** (Gegenprobe G3): `STUFEN_SATZ` in `public/ui.js` muss mitwachsen, wenn der
Server eine neue Stufe schickt — eine unbekannte Stufe wird still uebersprungen
(`if (!satzBau) return;`). Das faellt sicher aus (keine kaputte Anzeige), aber still.

Offen:
- **E5 (Karte loeschen) bleibt code-seitig belegt, nicht optisch — mit Grund:** das neue
  Statuswort steht im Zweig `if (k.driveName)`. Eine frisch angelegte Testkarte hat keinen
  Drive-Ordner, laeuft also gar nicht durch diesen Zweig; eine Karte, die einen hat, wuerde
  echten Inhalt in den Papierkorb schieben. Der Loeschweg selbst ist ueber den echten
  UI-Knopf durchlaufen (Testkarte entfernt, Board wieder bei 25 Karten) — nur die eine
  Statuszeile hat dabei nicht gefeuert.
- **Drive-Operationen ausserhalb des Abgleichs** senden weiterhin keinen Fortschritt aus dem
  Server (Scan, Upload, Papierkorb) — so von Owner entschieden (Variante b, nur der
  Abgleich).
- Zwei gleichzeitige schwebende Terminals am selben Anker wuerden sich ueberdecken; heute
  verhindert das nur das Sperren der Knoepfe waehrend eines Laufs.
- Bricht der Nutzer mitten im Lauf ab (Modal schliessen, Karte wechseln), laeuft der
  Server-Aufruf zu Ende; der Stream-Handler schreibt dann nur nicht mehr in die tote
  Verbindung. Ein echter Abbruch braeuchte ein `AbortSignal` bis in `lib/ai.js`.
- Innenschritte einer Kette melden „Modell laedt" bis zum Schrittende statt bis zum ersten
  Token (siehe „Bewusste Ungenauigkeit" oben). Folgeschritt: Wechsel auf Ollamas nativen
  `/api/chat` mit `load_duration`.
