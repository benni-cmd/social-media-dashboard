# Arbeitspaket v18 — Auswertung-Seite: plattformübergreifender Überblick

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 02.09.2026.

**Problem:** Die Auswertung-Seite (`public/auswertung.js`) zeigt Bestperformer nur für
Instagram und stapelt alle Blöcke gleichrangig untereinander. Der Owner will die **letzten
Posts plattformübergreifend immer im Blick** haben — einen Gesamtüberblick über das
Wichtigste — und Detail-/Nebendaten nur bei Bedarf ausklappen.

**Intent:** Die Seite so umbauen, dass oben das Wichtigste ohne Scrollen steht (Kernzahlen
+ die neuesten Beiträge von Instagram UND LinkedIn zusammen, chronologisch), und weniger
Wichtiges (Bestperformer-Ränge, Kanäle-Schnappschuss, Redaktionskalender) in einklappbaren
Gruppen darunter liegt.

**Goal:**
- Ein „Letzte Beiträge"-Block ganz oben: IG- und LI-Posts gemischt, nach Datum sortiert,
  je Zeile Plattform-Marke + Kernzahlen (Views/Reichweite/Weiterleitungen/Likes), Klick
  öffnet die Karte (wo zuordenbar).
- KPI-Kernreihe bleibt oben sichtbar.
- Bestperformer, Kanäle-Schnappschuss, Redaktionskalender wandern in `gruppe(..., offen=false)`.
- Bestehendes Dark-Theme und der `ui.js`-Baukasten werden genutzt, keine neuen Muster.
- Datenehrlichkeit bleibt: leer/„—" statt erfundener Zahlen; LinkedIn ohne Views/Reichweite
  (liefert social.js nicht) zeigt dort „—".

---

## Plan

1. [x] CSS-Tokens/Klassen gesichtet (kpi, abschnitt, kanaele, gruppe, marke).
2. [x] `letzteBeitraege(ig, li)` — IG `medien` + LI `posts` normalisiert, nach Datum sortiert.
3. [x] `auswertung.js` umgebaut: Kopf · Fehler · KPI · Letzte Beiträge · Median-Hinweis ·
       ausklappbare Gruppen (Bestperformer/Kanäle/Kalender in `gruppe(..., false)`).
4. [x] CSS für `.letzte-*` ergänzt (Dark-Theme-Tokens, mobil umbrechend).
5. [x] Visual-Verify via Edge headless/CDP (`shot-ausw.mjs`): Screenshot erstellt,
       Konsole ohne Fehler.
6. [ ] Commit + Push.

---

## Stand

02.09.2026 — Angelegt. `ui.js` geprüft: `gruppe(titel, anzahl, offen)` liefert `<details>`.
Daten im Browser: `S.zahlen` (IG: konto, medien[], median), `S.zahlenLi` (LI: konto, posts[]).

02.09.2026 — Umbau gebaut und optisch abgenommen. Echter Screenshot (Edge headless, Dark):
4 KPI-Kacheln + „Letzte Beiträge" (6 sichtbar, 14 in „Weitere Beiträge" eingeklappt), je
Zeile Marke·Titel·Datum + Views/Reichweite/Weiterl./Likes; Bestperformer/Kanäle/Kalender
eingeklappt. Render-Status `{kpi:4, zeilen:20, gruppen:4, fort:0}`, **keine Konsolen-Fehler**.
Aktuell nur Instagram-Zeilen (LinkedIn noch in Freigabe) — die plattformübergreifende
Mischung greift automatisch, sobald LI verbunden ist.

---

## Definition of Done

Geprueft gegen: echter Edge-headless-Screenshot der umgebauten Seite (Dark-Theme, Letzte
Beiträge oben, Gruppen eingeklappt), `shot-ausw.mjs` Render-Status + Konsole ohne Fehler.
Offen: Commit/Push. Später: LI-Zeilen sobald verbunden; optional Kernzahl je Plattform.
