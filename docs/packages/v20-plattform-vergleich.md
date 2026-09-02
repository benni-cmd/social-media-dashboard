# Arbeitspaket v20 — Plattform-Vergleich (welche performt besser?)

> Sichtbares Arbeitsartefakt nach `working-method.md`. Angelegt 02.09.2026.

**Problem:** Die Auswertung zeigt Instagram und LinkedIn nebeneinander in der Beitragsliste,
aber nicht, **welche Plattform besser performt**. Es fehlt der direkte Kennzahl-Vergleich.

**Intent:** Für die Videos die vom Owner benannten Zahlen je Plattform gegenüberstellen:
1. Aufrufe, 2. Interaktionen (absolut UND als % der Aufrufe), 3. Kommentare (absolut UND
als % der Aufrufe) — damit auf einen Blick sichtbar ist, wo Inhalte stärker zünden.

**Goal:**
- Neuer Block „Plattform-Vergleich" auf der Auswertung: zwei Karten (Instagram / LinkedIn),
  je Aufrufe (Ø), Interaktionen (Ø abs + Rate %), Kommentare (Ø abs + Rate %), Anzahl Beiträge.
- Raten auf Summen gerechnet (Σ Interaktionen / Σ Aufrufe), nicht Mittel der Einzelraten.
- Die stärkere Plattform (höhere Interaktionsrate) wird markiert.
- `social.js` `linkedinZahlen`: pro Post Aufrufe (Impressions) + Interaktionen ergänzt
  (Share-Statistik) — bisher nur Likes/Kommentare.
- Ehrlichkeit: nicht verbundene/fehlende Plattform → „—", kein erfundener Vergleich.

---

## Plan

1. [x] `social.js` `linkedinZahlen`: `views`/`interaktionen` je Post aus Share-Statistik.
2. [x] `auswertung.js`: `plattformVergleichBlock` + `aggregat`/`igAlsPosts`, Block eingehängt.
3. [x] CSS `.vergleich-*` (Dark-Theme, mobil einspaltig).
4. [x] Verify: echter Screenshot — IG-Aggregat rechnerisch konsistent, LI „nicht verbunden".
5. [ ] Commit + Push.

---

## Stand

02.09.2026 — Angelegt. Datenquelle Seite: `ig.medien` (views/total_interactions/comments_count),
`li.posts` (nach v20-Erweiterung: views/interaktionen/kommentare). LinkedIn noch im API-Review
→ LI-Seite zeigt „—", die Struktur steht aber bereit.

---

02.09.2026 — Gebaut und live abgenommen. Screenshot (Edge headless, Dark): Block
„Plattform-Vergleich" mit Instagram (20 Beiträge: Aufrufe Ø 467, Interaktionen 31 = 6,7 %,
Kommentare 1 = 0,2 %) und LinkedIn „Nicht verbunden". Raten rechnerisch konsistent
(6,7 %×467≈31, 0,2 %×467≈1). Kein „stärker"-Badge, weil nur IG Daten hat. Keine
Konsolen-Fehler. `linkedinZahlen` liefert jetzt views/interaktionen je Post (Share-Statistik),
greift automatisch sobald LI verbunden ist.

## Definition of Done

Geprueft gegen: `node --check` (social.js, auswertung.js) · echter Edge-headless-Screenshot
des Vergleichs-Blocks · Raten-Konsistenz gegen die sichtbaren Post-Zahlen · Konsole ohne Fehler.
Offen: LinkedIn-Live-Werte sobald API frei (Struktur steht). Optional: Vergleich je einzelnes
Video, wenn ein Video auf beiden Plattformen liegt.
