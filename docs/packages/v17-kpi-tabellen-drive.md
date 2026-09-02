# Arbeitspaket v17 — KPI-Tabellen in Drive (menschenlesbar, für Mitarbeiter ohne API)

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 02.09.2026 beim Planen,
> nachgeführt bei jedem Schritt-Abschluss.

**Problem:** KPIs liegen heute nur als Maschinen-JSON pro Projekt unter
`Videoauswertung/KPI/<projekt>_kpi.json` (`lib/kpi.js`). Mitarbeiter ohne API-Zugang
(Leon, Bene) kommen an keine Auswertung — sie können das JSON weder öffnen noch
vergleichen. Es gibt keine einheitliche, tiefe Tabellenstruktur, und bei jedem Blick
müssen Zahlen neu abgefragt/eingetragen werden.

**Intent:** Eine feste, dokumentierte Tabellenstruktur in Drive, die (a) menschenlesbar
in Google Sheets/Excel öffenbar ist (token-frei, passt zum Kernprinzip der
Drive-Konvention), (b) maximale Tiefe je Beitrag über die 16 Mess-Intervalle behält und
(c) so einheitlich ist, dass Instagram und LinkedIn nebeneinander vergleichbar bleiben.
Die gespeicherten Felder folgen dem, was die APIs WIRKLICH liefern — nicht geraten.

**Goal:**
- Ein Drive-Unterordner mit klarer Struktur, in dem KPIs als **CSV-Tabellen** liegen
  (öffnet in Sheets/Excel per Doppelklick, kein Token, keine App).
- Das Schema deckt alle belegten IG- und LinkedIn-API-Felder ab, plus die im
  Social-Media-Kontext wichtigen abgeleiteten Raten (Weiterleitungen/Reichweite,
  Likes/Reichweite, Sehdauer — die drei Mosseri-Leitgrößen vom 22.01.2025).
- `lib/kpi.js` schreibt bei jeder Messung zusätzlich zur JSON-Ablage in diese Tabellen.
- Dokumentiert in `docs/drive-convention.md` (Struktur) und einer Feld-Legende, damit
  ein Mensch jede Spalte versteht.

---

## Plan

1. [x] Recherche: IG-Graph-API- + LinkedIn-API-Felder (Stand 2026), je 2 unabhängige
       Quellen — zwei parallele Agenten, abgeschlossen (siehe Design).
2. [x] Schema-Entwurf: einheitlicher Spaltensatz IG/LI, abgeleitete Raten, Leer-vs-0-Regel.
3. [x] Ordner-/Datei-Layout: `Videoauswertung/Auswertung-Tabellen/`, alle drei Tabellen.
4. [x] CSV-Schreiber:
       - [x] `lib/kpi-tabellen.js` (CSV-Engine + Tabelle 1) + Messung in `lib/kpi.js`
             um volle Felder erweitert + an `sammle` angehängt. Lokal verifiziert.
       - [x] Tabelle 2 (kanal-verlauf) + Tabelle 3 (demografie): `lib/social.js` um
             `instagramKonto`/`linkedinKonto`/`linkedinZuwachsReihe` erweitert (belegte
             Endpunkte), `lib/kanal-kpi.js` (Kadenz wöchentl./quartalsw., Backfill 12 Mon.,
             CSV), an `kpi.sammle` angehängt. `edgeType`-Fix (`COMPANY_FOLLOWED_BY_MEMBER`).
             Lokal verifiziert.
5. [x] `docs/drive-convention.md` ergänzt + Feld-Legende als `LIESMICH.txt` im Drive-Ordner
       (`stelleLegendeSicher` in `lib/kpi-tabellen.js`).
6. [ ] Verify live: echte Messung → CSV in Drive öffnen (nur Logik lokal geprüft).
7. [ ] **Auslöser fehlt (blockiert Nutzung):** `/api/kpi/collect` wird nirgends automatisch
       aufgerufen (bestand schon vor v17). Ohne Auslöser läuft keine Sammlung. Entscheidung
       Owner: Button auf der Auswertung-Seite · Auto-Lauf beim Server-Start · Zeitplan.

---

## Stand

02.09.2026 — Bestand geprüft: `lib/kpi.js` (JSON-Ablage, Metriken IG/LI), `lib/drive.js`
(rclone: schreibt beliebige Dateien via `rcat`, keine nativen Sheets → CSV ist der Weg),
`docs/drive-convention.md` (Kernprinzip menschenlesbare Dateien), `lib/pipeline.js`
(16 KPI-Intervalle 24 h…12 Monate, Vergleichsfenster = 20 Beiträge). API-Recherche
abgeschlossen (siehe Design). Schema-Entwurf steht, Owner-Abnahme erfolgt.

02.09.2026 — Tabelle 1 gebaut: `lib/kpi-tabellen.js` (CSV-Engine UTF-8-BOM/Semikolon/
Dezimalkomma, tidy/long, Entdopplung Post×Plattform×Intervall). `lib/kpi.js` erweitert:
IG erfasst jetzt `likes` + `ig_reels_video_view_total_time` + `permalink`, LinkedIn
`likeCount`/`shareCount`/`clickCount`/`commentCount` getrennt; `sammle()` hängt die
Zeilen nach der JSON-Ablage an `Videoauswertung/Auswertung-Tabellen/beitraege-kpi.csv`.
Ein Tabellen-Fehler entwertet die erfassten Messungen nicht (nur Bericht). Verify lokal
mit synthetischen IG/LI-Messungen: 30 Spalten, Semikolon im Titel gequotet, ms→s + Raten
mit Dezimalkomma, Leer-vs-0-Regel, Format/Säule/Ziel aufgelöst — alle Prüfungen bestanden
(`node --check` beide Module OK).

02.09.2026 — Tabellen 2 + 3 gebaut: `lib/social.js` um `instagramKonto`, `linkedinKonto`,
`linkedinZuwachsReihe` erweitert (belegte Endpunkte: IG User-Insights + follower_demographics;
LI networkSizes + organizationalEntityFollowerStatistics), `edgeType` auf
`COMPANY_FOLLOWED_BY_MEMBER` korrigiert. `lib/kanal-kpi.js`: Kadenz (Verlauf wöchentlich,
Demografie quartalsweise), 12-Monats-Zuwachs-Backfill beim Erstlauf, an `kpi.sammle`
angehängt (läuft auch ohne fällige Post-Messung). Legende als `LIESMICH.txt` im Drive-Ordner.
Verify lokal (`test-kanal-kpi.mjs`): Verlauf-/Demografie-/Backfill-Zeilen, Leer-vs-0,
Datum-Kadenz, Plattform-Namen — alle bestanden; Tabelle-1-Regression grün. Befund: kein
Auslöser für `/api/kpi/collect` vorhanden (Schritt 7). Live-Verify offen.

---

## Design (Schema-Entwurf, 02.09.2026)

### Belegte API-Felder (Quellen im Recherche-Anhang unten)

**Instagram** (Meta Media-/User-Insights, Stand 2026): `views` (ersetzt `impressions`/
`plays`/`video_views`, alle April 2025 entfernt), `reach`, `likes`, `comments`, `shares`,
`saved`, `total_interactions`, `profile_visits`, `follows`; Reel-spezifisch
`ig_reels_avg_watch_time` (ms), `ig_reels_video_view_total_time`, `reels_skip_rate`
(Schätzwert); Konto `followers_count`, `media_count`, Demografie ab 100 Followern.

**LinkedIn** (MS-Learn li-lms-2026-08): `totalShareStatistics` → `impressionCount`,
`uniqueImpressionsCount`, `clickCount`, `likeCount`, `commentCount`, `shareCount`,
`engagement` (fertige Rate). Video **eigener** Endpunkt `videoAnalytics`: `VIDEO_VIEW`,
`VIEWER`, `TIME_WATCHED` (ms), `TIME_WATCHED_FOR_VIDEO_VIEWS` — **6-Monats-Verfall**.
Follower über `networkSizes` (Gesamt) + `organizationalEntityFollowerStatistics`
(Zuwachs organisch/paid, Demografie Top 100). Kein `saved`, keine Skip-Rate.

### Datenmodell: tidy/long — eine Zeile = ein Post × eine Plattform × ein Intervall

Grund: Die Tiefe steckt in den 16 Intervallen je Post. Long-Format hält IG und LinkedIn
im selben Spaltensatz vergleichbar, ist in Sheets filter-/sortier-/pivotierbar, und neue
Messungen werden nur angehängt (append), nie überschrieben.

**Leerregel:** leeres Feld = Plattform liefert die Zahl nicht / nicht anwendbar;
`0` = echt gemessene Null. (Dieselbe Trennung wie `—` in der Auswertung-Ansicht.)
**Zeit-Einheit:** Watch-Time einheitlich in **Sekunden** (API liefert ms).

#### Tabelle 1 — `beitraege-kpi.csv` (der Kern)

| Gruppe | Spalten | IG-Quelle | LI-Quelle |
|---|---|---|---|
| Identität | projekt · titel · plattform · format · ziel · saeule · upload_datum · post_id · permalink | Karte + Media-Basis | Karte + ugcPost-URN |
| Messpunkt | intervall · tage_nach_upload · mess_datum | — | — |
| Reichweite | views · reichweite · video_views · video_zuschauer | views · reach · view_count · — | impressionCount · uniqueImpressionsCount · VIDEO_VIEW · VIEWER |
| Interaktion | likes · kommentare · weiterleitungen · gespeichert · klicks · interaktionen_gesamt | likes · comments · shares · saved · — · total_interactions | likeCount · commentCount · shareCount · — · clickCount · (Summe) |
| Video-Zeit | watchtime_schnitt_s · watchtime_gesamt_s · skip_rate | ig_reels_avg_watch_time · ig_reels_video_view_total_time · reels_skip_rate | TIME_WATCHED_FOR_VIDEO_VIEWS/VIDEO_VIEW · TIME_WATCHED · — |
| Raten (vorgerechnet) | weiterleitungen_pro_reichweite · likes_pro_reichweite · gespeichert_pro_reichweite · interaktionen_pro_reichweite · klickrate | shares/reach · likes/reach · saved/reach · total_interactions/reach · — | shareCount/uniqueImpr · likeCount/uniqueImpr · — · engagement · clickCount/impressionCount |

Die drei Mosseri-Leitgrößen stehen damit als eigene, vorgerechnete Spalten drin
(Sehdauer = watchtime_schnitt_s, Likes/Reichweite, Weiterleitungen/Reichweite).

#### Tabelle 2 — `kanal-verlauf.csv` (Konto-Ebene, nicht je Post)

Eine Zeile = Plattform × Stichtag: plattform · datum · follower_gesamt ·
follower_zuwachs_organisch · follower_zuwachs_bezahlt · reichweite_konto · views_konto ·
interaktionen_konto · accounts_engaged (IG). Quelle IG: User-Insights + `followers_count`;
LI: `networkSizes` + Follower-Statistik.

#### Tabelle 3 — `follower-demografie.csv` (optional, quartalsweise)

Tidy: plattform · datum · facette (land/funktion/branche/alter/geschlecht) · auspraegung ·
anzahl. Beide Plattformen liefern Demografie (IG ab 100 Followern; LI Top 100 je Facette).

### Format-Entscheidung (technisch, von mir gesetzt, reversibel)

CSV mit **UTF-8-BOM + Semikolon-Trenner + Dezimalkomma** — so öffnet die Datei in
deutschem Excel und in Google Sheets per Doppelklick korrekt, ohne Import-Dialog.

### Owner-Entscheidung (02.09.2026, getroffen)

- **Umfang:** alle drei Tabellen. Tabelle 1 hängt an den bestehenden Post-Intervallen;
  Tabellen 2 + 3 sind konto-bezogen, unabhängig von den Videos, und werden regelmäßig
  abgefragt.
- **Ordner:** `Videoauswertung/Auswertung-Tabellen/`.

### Backfill-Realität (belegt aus der API-Recherche) — steuert die Kadenz

| Ebene | Rückwirkend holbar? | Folge |
|---|---|---|
| Post-Metriken (Tab. 1) | LI Share-Stats ~12 Mon., IG Media solange Post lebt; **LI-Video-Watch-Time nur 6 Mon.** | Intervall-Messung + sofort archivieren (bestehend) |
| Follower-**Gesamt** (Tab. 2) | **Nein** — API liefert nur Jetzt-Wert (IG `followers_count`, LI `networkSizes`) | ab jetzt regelmäßig Schnappschuss |
| Follower-**Zuwachs** (Tab. 2) | **Ja, ~12 Mon.** (LI organisch/paid; IG neue Follower/Tag) | einmalig backfillbar |
| Demografie (Tab. 3) | **Nein** — API liefert nur aktuelle Verteilung, keine Historie | ab jetzt quartalsweise Schnappschuss |

Deshalb: **je früher der Konto-Sammler läuft, desto mehr Historie** — nur der Zuwachs
ist einmalig nachholbar. Kadenz-Vorschlag: Tabelle 2 wöchentlich, Tabelle 3 quartalsweise;
genaue Auslösung nach Prüfung der Server-Verdrahtung.

---

## Definition of Done

Geprueft gegen: lokale Verify-Skripte für Tabelle 1 (beitraege) und Tabellen 2+3
(kanal-verlauf, demografie, backfill) — alle Prüfungen bestanden; `node --check` aller
Module OK · IG-/LI-Felder gegen die belegten API-Quellen (2 je Plattform) · Legende +
`drive-convention.md`.
Offen: (1) **Auslöser** für `/api/kpi/collect` — ohne ihn läuft nichts (Owner-Entscheidung).
(2) **Live-Verify**: echte Tokens → echte Messung → CSV in Drive öffnen; besonders die
Antwort-Formen von IG `follower_demographics` und LI-Demografie (URN-Auflösung) sind noch
nicht gegen Live-Daten geprüft.
Erledigt: Schema, Ordner-Layout, alle drei Tabellen-Schreiber + Legende (lokal verifiziert),
`edgeType`-Fix.
