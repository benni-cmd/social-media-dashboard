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
(16 KPI-Intervalle 24 h…12 Monate, Vergleichsfenster = 20 Beiträge). Zwei
Recherche-Agenten für die echten API-Felder gestartet. Schema-Entwurf folgt nach Rücklauf.

---

## Definition of Done

Geprueft gegen: echte Testmessung landet als CSV in Drive und öffnet in Sheets · jede
Spalte in der Feld-Legende erklärt · IG- und LI-Felder gegen die belegten API-Quellen
abgeglichen (2 Quellen je Plattform) · `drive-convention.md` beschreibt die Struktur.
Offen: Schema, Ordner-Layout, CSV-Schreiber, Legende, Verify — alles noch offen.
