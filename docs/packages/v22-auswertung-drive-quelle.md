# Arbeitspaket v22 — Auswertung wahlweise aus Drive (statt live API)

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 03.09.2026.
> Docking-Paket zu v24-2 (Verbindungs-Center) der Parallel-Session.

**Problem:** Die Auswertung liest heute ausschließlich live über `/api/stats/*` (Plattform-API).
Das v24-2-Verbindungs-Center will einen Toggle „Auswertung aus Drive vs. API+Drive". Dafür
braucht es eine zweite Quelle: die bereits in Drive archivierten KPI-Tabellen — ohne API,
für Mitarbeiter/Zeiten ohne Token.

**Intent:** `/api/stats/instagram` und `/api/stats/linkedin` bekommen einen Schalter
`?quelle=api|drive` (Default `api` = unverändert). Bei `drive` liefert der Server dieselbe
Antwort-FORM wie die API, aber rekonstruiert aus den CSVs (`Auswertung-Tabellen/`). So bleibt
`public/auswertung.js` unverändert (rendert nur die Form) und die Parallel-Session dockt nur
Toggle-UI + `store.js`-Param an.

**Goal:**
- `lib/kpi-drive-lesen.js`: liest `beitraege-kpi.csv` + `kanal-verlauf.csv` und baut die
  Form `{ verbunden, konto, medien|posts, median, reichweite30 }` (identisch zu `social.js`).
- `server.js` `/api/stats/*`: bei `?quelle=drive` diesen Leser statt `social.*Zahlen`.
- Fehlt Drive-Datenbestand → `verbunden:false` (Leerzustand), kein Fehler.
- `auswertung.js`/`kpi.js` bleiben unangetastet.

**Contract für die Parallel-Session:** Query-Name `quelle`, Werte `api` (Default) | `drive`,
auf beiden Endpunkten. `store.js` hängt `?quelle=<wert>` an, sonst nichts.

---

## Plan

1. [ ] `lib/kpi-drive-lesen.js` mit reinen Parse-/Form-Funktionen + `instagramAusDrive`/`linkedinAusDrive`.
2. [ ] `server.js` `/api/stats/*` um `?quelle`-Zweig ergänzen (minimal, localized).
3. [ ] Unit-Test: synthetische CSVs → korrekte Form (views/median/reichweite30/posts).
4. [ ] Commit + Push; Contract an die v24-Session.

---

## Stand

03.09.2026 — Angelegt. Contract mit der Drehtermin/v24-Session abgestimmt (sie: Toggle+store.js;
ich: Leser+Route). CSV-Schema: `lib/kpi-tabellen.js` (SPALTEN) + `lib/kanal-kpi.js` (VERLAUF_SPALTEN).

---

03.09.2026 — Abgeschlossen. Route gebaut + unit-getestet (commit 372c66d). Die v24-Session hat
den Toggle angedockt (store.js hängt `?quelle=<localStorage cm-auswertung-quelle>` an, UI im Tab
„Social Media Kanaele", commit da91590) und die Route beidseitig getestet: `quelle=api`→live,
`quelle=drive`→CSV-Form, beide HTTP 200. `kpi.js`/`auswertung.js` blieben unberührt.

## Definition of Done

Geprueft gegen: Unit-Test der CSV→Form-Rekonstruktion (medien mit kennzahlen, median via
social.median, reichweite30, LI posts) · `node --check` · Integrationstest der v24-Session
(beide Quellen HTTP 200, commit da91590).
Offen: nichts — Paket geschlossen. (Optischer Doppel-Screenshot API↔Drive bei Gelegenheit,
sobald echte Drive-Tabellen mit mehreren Posts vorliegen — kein Blocker.)
