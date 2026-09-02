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

1. [ ] Recherche: IG-Graph-API- + LinkedIn-API-Felder (Stand 2026), je 2 unabhängige
       Quellen — läuft als zwei parallele Agenten.
2. [ ] Schema-Entwurf: Spaltensatz (einheitlich IG/LI), Umgang mit plattform-spezifischen
       Feldern, abgeleitete Raten, Umgang mit „nicht verfügbar" (leer vs. 0).
3. [ ] Ordner-/Datei-Layout in Drive festlegen (wo unter `Videoauswertung/`, ein Blatt
       je Projekt vs. ein Gesamt-Register vs. beides) — Entscheidung mit Owner.
4. [ ] `lib/kpi.js`: CSV-Schreiber ergänzen (zusätzlich zur JSON-Ablage), deterministisch.
5. [ ] `docs/drive-convention.md` + Feld-Legende nachziehen.
6. [ ] Verify: echte Messung → Tabelle in Drive öffnen, Spalten gegen Legende prüfen.

---

## Stand

02.09.2026 — Bestand geprüft: `lib/kpi.js` (JSON-Ablage, Metriken IG/LI), `lib/drive.js`
(rclone: schreibt beliebige Dateien via `rcat`, keine nativen Sheets → CSV ist der Weg),
`docs/drive-convention.md` (Kernprinzip menschenlesbare Dateien), `lib/pipeline.js`
(16 KPI-Intervalle 24 h…12 Monate, Vergleichsfenster = 20 Beiträge). API-Recherche
abgeschlossen (siehe Design). Schema-Entwurf steht, wartet auf Owner-Abnahme.

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

### Offene Owner-Entscheidung

Umfang: nur Register (Tabelle 1+2) · zusätzlich pro-Projekt-Kopie je Video ·
zusätzlich Demografie (Tabelle 3). Ordnername des Unterordners.

---

## Definition of Done

Geprueft gegen: echte Testmessung landet als CSV in Drive und öffnet in Sheets · jede
Spalte in der Feld-Legende erklärt · IG- und LI-Felder gegen die belegten API-Quellen
abgeglichen (2 Quellen je Plattform) · `drive-convention.md` beschreibt die Struktur.
Offen: Schema, Ordner-Layout, CSV-Schreiber, Legende, Verify — alles noch offen.
