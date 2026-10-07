# v115 — Fixes aus dem harten Nachtest v114

> Owner-Auftrag 07.10.2026 (Antworten auf die fünf Fragen aus v114): ZIP64 bauen · **alle** Befunde
> beheben (B, H, M, N) · Hüllen mit nur interner `projekt.json` automatisch entfernen, wenn die andere
> Kopie neuer ist · die harten Testskripte als `tools/hart/` ins Repo · unerfüllbarer „max. Abstand":
> **Speichern sperren**. Befunde und Belege: `v114-harter-nachtest.md`. Stand vorher: Code `9f37ae3`.

## PIG

**Problem:** v114 fand 22 Brüche, darunter einen Server-Absturz beim Rohmaterial-Download über 4 GB,
Abgleich-/Board-Ausfälle durch eine einzige falsch bearbeitete `projekt.json`, stilles Überschreiben,
Doppel-Ordner durch Wettläufe und doppelte Kalendertermine an Monatsgrenzen.

**Intent:** Das Board soll im Alltag mit echten Videodaten weder abstürzen noch Daten verlieren oder
doppeln — und jeder Fix soll gegen denselben harten Test wiederholbar prüfbar sein.

**Goal:** Alle 22 Befunde aus v114 sind behoben oder mit Grund als „kein Umbau" entschieden; `tools/hart/`
baut eine isolierte Umgebung mit Schein-Drive selbst auf und zeigt für jeden Befund „ok"; UI-Änderungen
sind per Bildschirmfoto abgenommen.

## Entscheidungen (Owner, 07.10.2026)

| Frage | Antwort |
|---|---|
| ZIP über 4 GB | ZIP64 bauen |
| Umfang | Alles inkl. M und N |
| Hüllen nach Abgleich-Wettlauf | automatisch entfernen, wenn die andere Kopie neuer ist (in den Papierkorb, also wiederherstellbar) |
| Testskripte | ins Repo als `tools/hart/`, mit eigenem Schein-Drive-Aufbau |
| Unerfüllbarer max. Abstand | Speichern sperren, mit Satz, welcher Wert mindestens nötig ist |

## Plan

1. [ ] **Testwerkzeug zuerst** — `tools/hart/`: `umgebung.mjs` kopiert den Code (ohne `data/`, `.env`, `.git`) in ein Temp-Verzeichnis, legt einen Schein-Drive (rclone-Alias) an, startet den Server auf eigenem Port, richtet den Ordner über die echte API ein und räumt am Ende alles weg. Testgruppen als Soll-Prüfungen (ok/BEF, Exit-Code): `logik.mjs` (rein), `api.mjs`, `wettlauf.mjs`, `drive-hand.mjs`, `zip.mjs`, `ki.mjs` (nur mit laufendem Ollama). Vorher-Lauf belegt die Brüche.
2. [ ] **B1 Absturz + ZIP64** — zentraler `catch` in `server.js`: bei gesendeten Kopfzeilen Verbindung schließen statt erneut antworten; `unhandledRejection` loggen statt Prozessende. `lib/zip.js`: ZIP64-Felder (Extra 0x0001, 64-Bit-Deskriptor, EOCD64 + Locator) ab 4 GB je Datei oder Gesamt-Offset. Abnahme: 2 × 2,2 GB über den Server, ZIP mit zwei unabhängigen Entpackern geprüft (Windows `tar`, .NET `ZipFile`), Server lebt.
3. [ ] **H1 Typ-Härte** — `normalisiere()` bringt jedes Feld aus `leereKarte()` auf seinen Typ (auch eine Ebene tief) und prüft ISO-Daten; der Abgleich sichert eine `projekt.json` mit Typfehlern vorher als `projekt.kaputt-<Zeit>.json` und meldet es. `public/board.js`: eine Karte, die beim Zeichnen wirft, erscheint als „Karte beschädigt" statt das Board zu leeren. Deckt N7 mit ab.
4. [ ] **H2 unlesbare `projekt.json`** — „fehlt" und „unlesbar" getrennt; unlesbar → Sicherung `projekt.kaputt-<Zeit>.json`, Befund mit Dateiname, Meldung sagt die Wahrheit.
5. [ ] **H3 + M2 Sperre je Karte** — Verschieben, Löschen, Anlegen, Speichern und Abgleich derselben Karte laufen nacheinander; der Abgleich überspringt Karten mit laufendem Vorgang und schreibt nie in einen verschwundenen Ordner; gelöschte Karten-IDs lehnen Verschieben/Anlegen mit 409 ab; Browser verschiebt keine gelöschte Karte. Hüllen (nur `(AI only)/projekt.json` und/oder `Steckbrief.md`) wandern in den Papierkorb, wenn die andere Kopie neuer ist.
6. [ ] **H4 + M5 Planer** — eine Kette ab festem Anker (Woche 0 = 01.01.2024) für Kalender, Upload-Vorschläge, Wochen-Soll und Drive-Datei; Zwischenspeicher je Plan. Unerfüllbarer max. Abstand: Regel durch Messung bestimmen, dann Speichern sperren (Oberfläche + Server 400) mit Satz.
7. [ ] **M1 Board-Schreiben** — alle Schreibwege von `board.json` über eine Warteschlange, Versionsprüfung darin, Temp-Datei mit Zufallsnamen.
8. [ ] **M3/M4/N3 Eingang** — Herkunftsprüfung (Origin, Sec-Fetch-Site, Content-Type) für schreibende Endpunkte; ein `leseJson()` für alle Bodies: kaputt → 400 mit Satz, kein Objekt → 400, über 20 MB → 413; Pflichtfelder für Plan, Boardparameter, Defaults.
9. [ ] **M6 KI-Abbruch** — Verbindungsende bricht die KI-Pipeline ab (Claude/Codex: Prozess beenden, Ollama: Anfrage abbrechen).
10. [ ] **M7 Kopfzeile** — unter ~1 100 px zweizeilig, Zoom-Knöpfe überdecken keine Spalten-Knöpfe.
11. [ ] **N1, N2, N4, N5, N6, N8, N9, N10** — Fehlertexte übersetzen (rclone-Logzeilen, Drive-Gründe); `Object.hasOwn` für Prompt-Kennungen; Drehtermin trägt gelöschte Karten aus und zählt nur vorhandene; leere Format-Datei wird nicht gespeichert; ungültige Kampagnen-Daten als Befund; Umbenennen-Meldung; Config-Fehler 30 s schnell melden; Shell-Aufrufe ohne Argument-Liste (DEP0190).
12. [ ] **Abnahme** — `tools/hart` komplett ok, `tools/tore-selbsttest.mjs`, `tools/kampagnen-selbsttest.mjs`, Bildschirmfotos (Kopfzeile 960/1 440 px, beschädigte Karte, Abstand-Sperre, Format-Speichern, Drehtermin-Zähler); `docs/architektur.md`, `README.md`, v114-Bericht nachgezogen; Commit per Pfad, Push.

## Stand

07.10.2026 — Plan angelegt, Entscheidungen eingetragen. Bau beginnt mit Schritt 1.

## Definition of Done

- [ ] Jeder der 22 v114-Befunde: behoben mit Beleg aus `tools/hart` oder Bildschirmfoto
- [ ] `tools/hart` läuft ohne echte Daten und ohne echtes Drive und räumt hinter sich auf
- [ ] Selbsttests grün, Doku synchron, Commit per Pfad + Push

Geprueft gegen: (folgt) · Offen: (folgt)
