# v58 — Kopfzeile in Sektionen, je Sektion ein Live-Terminal

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 23.09.2026.
> Status: **PLAN — Bau noch nicht begonnen.** Nummer v58 (hoechste vergebene ist v57,
> zweimal belegt: `v57-detail-resizable-und-cursor-stil.md` und `v57-inhalte-nach-drive.md`).

## PIG

**Problem:** Die Kopfzeile traegt heute EINEN Sammel-Marker (`public/app.js` `zeichneBadge`,
`#google-drive-badge`), der alle externen Anschluesse zu einem Satz zusammenzieht:
„Google + Drive verbunden, live abgeglichen". Daraus ist weder ablesbar, WELCHER Dienst
gerade arbeitet, noch WAS er tut. Wer wissen will, warum das Board 70 Sekunden lang Karten
umsortiert, sieht nur eine Sanduhr. Die technischen Aufrufe dahinter — welcher Drive-Ordner
gerade gelesen wird, was Google antwortet, wie lange es dauert — laufen komplett unsichtbar
im Server.

**Intent:** Jederzeit nachvollziehen koennen, was das System nach aussen tut, und zwar je
Anschluss getrennt: arbeitet er gerade, ist er in Ordnung — und, eine Ebene tiefer, welcher
Aufruf gerade laeuft und was zurueckkommt. Vertrauen durch Mitlesen statt durch Warten.

**Goal:** Die Kopfzeile zeigt VIER Sektionen mit je eigenem Marker (Sanduhr, wenn dort gerade
gearbeitet wird; sonst das Statuswort). Jede Sektion hat ein kleines Icon, das darunter ein
Terminal aufklappt — groesser als das Karten-Terminal aus v51, damit man lesen kann. Darin
laeuft live und mitlesbar, was dieser Anschluss tut: jeder externe Aufruf mit Befehl bzw.
Endpunkt, Dauer und Ergebnis. Beim Oeffnen steht die History der letzten Ereignisse schon da.

---

## Die vier Sektionen (Owner-Entscheidung 23.09.2026)

| Sektion | Dienste | Quelle im Code |
|---|---|---|
| **API-Abgleich** | Instagram, LinkedIn — **spaeter YouTube und TikTok** | `lib/social.js:358`, `lib/kpi.js:311` |
| **Drive-Abgleich** | Google Drive ueber rclone | `lib/drive.js:258` (der EINE `spawn`) |
| **Weitere externe Anschluesse** | Google Kalender + Tasks, Websuche (Tavily/DuckDuckGo) | `lib/gcal.js:80/111`, `lib/websuche.js:40/56` |
| **KI** | Ollama, Claude-CLI | `lib/ai.js` (`runOllama`, `runOllamaStream`, `pingOllama`, Claude-Spawn) |

Owner-Wortlaut zur ersten Sektion: „API = IG, LinkedIn und spaeter auch die anderen wie yt
oder tiktok" — die Sektion wird also **erweiterbar** gebaut (Dienst-Register, nicht drei
fest verdrahtete Namen). Google Kalender+Tasks faellt unter „weitere Anschluesse", weil die
API-Sektion nach Owner-Wortlaut die Social-Plattformen fuehrt.

**KI bekommt eine eigene, vierte Sektion** (Owner-Entscheidung) — zusaetzlich zum
Terminal am ausloesenden Knopf aus v51, das bleibt unveraendert.

## Weitere Owner-Entscheidungen

- **Log-Tiefe: jeder Aufruf technisch.** Nicht nur die fachlichen Stufen aus v51, sondern
  der einzelne externe Aufruf mit Befehl/Endpunkt, Dauer und Ergebnis
  (`rclone lsjson gdrive:In Bearbeitung/Idee → 12 Eintraege, 1,3 s`;
  `GET calendars/primary → 200, 11,2 s`).
- **History: Server-Ringpuffer.** Die letzten ~500 Ereignisse liegen im Speicher des
  Servers, ueberleben ein Neuladen der Seite und sind nach einem Server-Neustart leer.
  Keine Logdatei auf Platte.

## Randbedingung, die ICH setze (Sicherheit, nicht verhandelbar)

Mitschneiden heisst nicht alles mitschneiden. **Keine Zugangsdaten ins Log**: Query-Parameter
`access_token`, `refresh_token`, `client_secret`, `key`, `code` werden vor dem Schreiben durch
`…` ersetzt; Header und Request-Bodies werden grundsaetzlich nicht geloggt. Grund: die
IG-/LinkedIn-Endpunkte tragen den Token in der URL, und der Google-Token-Refresh
(`lib/gcal.js:80`) schickt das Refresh-Token im Body. Ein Terminal, das man aufklappt und
jemandem zeigt, darf keine Schluessel zeigen.

---

## Bestand (belegt, 23.09.2026) — warum das billig zu bauen ist

Alle externen Aufrufe laufen durch **acht Engstellen**, nicht verstreut:

| Engstelle | Datei:Zeile | deckt ab |
|---|---|---|
| rclone-Subprozess | `lib/drive.js:258` | **jeden** Drive-Aufruf (eine globale Promise-Kette) |
| Google-Token-Refresh | `lib/gcal.js:80` | OAuth-Erneuerung |
| Google-API-Wrapper | `lib/gcal.js:111` | Kalender + Tasks |
| Instagram/Graph | `lib/social.js:358` | IG-Aufrufe |
| KPI-Abruf | `lib/kpi.js:311` | Zahlen-Abrufe |
| Tavily | `lib/websuche.js:40` | Web-Suche (Schluessel gesetzt) |
| DuckDuckGo | `lib/websuche.js:56` | Web-Suche (Fallback) |
| Ollama + Claude | `lib/ai.js` | KI-Laeufe |

Befehl: `grep -n "fetch(\|spawn(" lib/*.js`. Bereits vorhanden und wiederzuverwenden:
`statusChip()` (sechs Status-Woerter), `sanduhr()`, das `.denk`-Terminal aus v51
(`public/ui.js`, `public/style.css:1950 ff.`) samt aufklappbarem Verlauf, und die
NDJSON-Stroeme aus v51 (`/api/ai/stream`, `/api/drive/reconcile/stream`) als Hausmuster.
Ein Ereignis-/Log-Modul gibt es NICHT (`ls lib/`), ebenso wenig SSE (`grep -rn "EventSource"`)
— beides kommt neu dazu.

## Plan (Teilpakete)

1. [ ] **Ereignis-Bus im Server** — neues `lib/ereignisse.js`: Ringpuffer (500),
       `melde({sektion, dienst, text, dauerMs, ergebnis})`, Abonnenten-Liste,
       Schluessel-Schwaerzung. Kein Fremd-Modul, keine Datei auf Platte.
2. [ ] **Die acht Engstellen anzapfen** — je Engstelle eine Zeile vor und eine nach dem
       Aufruf; die Aufrufe selbst bleiben unveraendert. Kein neues Verhalten, nur Mitschnitt.
3. [ ] **Live-Feed** — `GET /api/ereignisse/stream` als Server-Sent Events (nicht NDJSON wie
       v51: der Feed steht DAUERHAFT offen, und `EventSource` bringt den Wiederverbinden-
       Mechanismus von selbst mit) plus `GET /api/ereignisse` fuer die History beim Oeffnen.
4. [ ] **Kopfzeile in vier Sektionen** — `public/index.html` + `public/app.js`: das eine
       `#google-drive-badge` wird zu vier Sektionen, je mit Marker und Aufklapp-Icon.
       Dienst-Register statt fester Namen, damit YouTube/TikTok spaeter nur eine Zeile sind.
5. [ ] **Terminal je Sektion** — die `.denk`-Komponente aus v51 wiederverwenden, in der
       groesseren Fassung unter der Sektion verankert, gefuellt aus History + Live-Feed.
6. [ ] **Verify** — `node --check`, echter Browser-Screenshot je Sektion gegen
       `docs/ui-standard.md` (Regel 3 Status-Woerter, Regel 5 keine Unicode-Symbole), plus
       ein Live-Beleg: laufender Drive-Abgleich, im Terminal die einzelnen rclone-Aufrufe
       mitlesbar; Gegenprobe, dass keine Zugangsdaten im Log stehen.

## Stand

**23.09.2026** — Paket angelegt, vier Rueckfragen vom Owner beantwortet, Bestand geprueft.
Kein Code geaendert. Koordination: die Session „Wir arbeiten am Social Media Board" lief
zuletzt 23.09.2026 10:48 im selben Repo; `git status` ist bis auf den fremden Stand von
`docs/packages/v29-…md` sauber, v57 ist gelandet (`eacc394`, `4723c53`).

## Definition of Done

Geprueft gegen: vier Sektionen im Kopf mit je eigenem Marker · je Sektion ein aufklappbares
Terminal mit History und Live-Zeilen · jeder der acht Engstellen-Aufrufe erscheint mit
Befehl/Endpunkt, Dauer und Ergebnis · Ringpuffer haelt 500 Ereignisse und ueberlebt ein
Neuladen der Seite · keine Zugangsdaten im Log (Gegenprobe mit gesetztem IG-Token) ·
`node --check` auf jede geaenderte Datei · echter Browser-Screenshot gegen
`docs/ui-standard.md`.

Offen: alles — Bau noch nicht begonnen.
