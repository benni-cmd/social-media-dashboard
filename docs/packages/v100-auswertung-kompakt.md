# v100 — Auswertung kompakt, mit bewährten Übersichten und Board-Logik

> Owner 01.10.2026 (Screenshot Wochenstatistik): „In der Funktion gut, muss aber wesentlich besser nutzbar werden — weiter in
> die Vergangenheit, leichter ersichtlich, was geplant war, was eingehalten wurde, was bedient wurde und was die Ergebnisse waren.
> Views und Likes nicht in der Woche, in der sie passiert sind, sondern bei dem Post, zu dem sie gehören — mit dessen Titel.
> Ein Toggle für die bisherige Logik (Zahlen in der Woche, in der sie passiert sind)." — Nachtrag: „Die Auswertungsseite nochmal
> kompakter bauen, bewährte Übersichten reinbauen und mit der Boardlogik verknüpfen."

## PIG

**Problem:** Neun Blöcke untereinander (`public/auswertung.js`): fünf große Kennzahl-Kacheln, Wochenstatistik (fest 8 Wochen,
Konto-Werte je Kalenderwoche, „veröffentlicht" immer 0, weil die Post-Liste nur die letzten 20 Beiträge kennt), letzte Beiträge,
Plattform-Vergleich, Median-Hinweis, Bestperformer, Kanäle, Kalender. Dieselben Beiträge erscheinen dreimal; die Board-Daten
(Format, Kategorie, Ziel, geplanter Termin, Kartentitel) fließen nirgends ein.
**Intent:** Auf einer Seite ohne Scrollen erkennen: Halten wir den Plan? Was hat jeder Beitrag gebracht? Was trägt — welches
Format, welche Kategorie, welches Ziel, welche Uhrzeit?
**Goal:** Eine kompakte Seite mit vier Übersichten, verknüpft über die Post-Zuordnung (v97) mit den Karten; blätterbar in die Vergangenheit.

## Aufbau (oben nach unten)

1. **Kopf:** Zeitraum (8 Wochen, blätterbar „‹ älter · neuer ›") · Umschalter **„je Beitrag" / „je Kalenderwoche"** · Zahlen neu holen.
2. **Kennzahlen-Leiste** (eine schmale Zeile): Reichweite · Views · Interaktionen · Engagement-Rate · Follower · **Plan-Treue**
   (veröffentlicht / geplant im Zeitraum) — je mit Vergleich zum vorigen Zeitraum.
3. **Wochen** (Hauptübersicht, eine Zeile je Woche, aufklappbar):
   Woche · Plan (Soll je Format, ✓/⚠) · Beiträge (Titel der Karte, sonst Caption-Anfang) · Views · Reichweite · Interaktionen · ER.
   - „je Beitrag": die Zahlen eines Beitrags zählen in der Woche, in der er **veröffentlicht** wurde (Lebenszeit-Werte des Posts).
   - „je Kalenderwoche": Konto-Werte der Woche, egal welcher Beitrag (bisherige Logik).
   - Aufgeklappt: je Beitrag eine Zeile mit Format, Zeitpunkt (geplant vs. tatsächlich), Kennzahlen, Link; geplante Karten ohne Post als „offen".
4. **Was trägt** (Board-Logik): Median-Views und ER je **Format**, **Kategorie**, **Ziel** — aus den Karten der zugeordneten Posts.
5. **Sendezeit:** Median-Views je Wochentag + Zeitfenster (z. B. „Mi 11:30" vs. „Mi 18:30" aus der Variation in v95).
6. Eingeklappt darunter: Kanäle-Schnappschuss, Redaktionskalender.
Entfällt (in den Übersichten aufgegangen): große KPI-Kacheln, „Letzte Beiträge", Plattform-Vergleich, Bestperformer, Median-Hinweis
(Hinweis wandert als Fußnote unter „Was trägt").

## Bau

1. `lib/social.js`: `instagramZeitraum(ig, von, bis)` — Posts im Zeitraum mit Insights (seitenweise über `me/media`, Insights je Post
   30 min zwischengespeichert); `instagramWochen` mit Versatz für ältere Wochen.
2. `server.js`: `GET /api/stats/zeitraum?wochen=8&vor=0` → `{wochen, posts}` (Instagram + LinkedIn).
3. `public/auswertung.js`: neue Seite aus den vier Übersichten; Post ↔ Karte über `card.published` (v97).
4. Verify: echte Daten (21 Instagram-Posts), Blättern bis August, Umschalter, Screenshots hell.

## Stand

01.10.2026 — gebaut und mit echten Instagram-Daten belegt (Kopie :4399, 1440×900 — ganze Seite ohne Scrollen, Screenshot).
- Endpunkt `/api/stats/zeitraum`: vor=0 → 16 Wochen Konto-Werte + 7 Posts; vor=8 → 14 Posts mit Kennzahlen (z. B. 04.08. Reel 454 Views, 16 Likes).
- Seite KW 25–32: Kennzahlen 2.807 Views (−6 % zum Vorzeitraum), 2.163 Reichweite, 174 Interaktionen, ER 8 %, Follower 99, Plan-Treue 7/8.
  Wochenzeilen mit Titel je Beitrag (zugeordnete Karte: Kartentitel + „geplant 4.8. 13:00" neben „Di 4.8. 13:25"), KW 31 ⚠ 0/1.
- Umschalter „je Kalenderwoche": dieselben Wochen mit Konto-Werten (KW 31 zeigt dann 22 Views ohne Beitrag — Nachwirkung älterer Posts).
- Aktueller Zeitraum KW 33–40 ehrlich leer (letzter Post 04.08.): Plan-Treue 0/8, „geplant, nicht erschienen" je Woche.
- Entfallen: große KPI-Kacheln, Letzte Beiträge, Plattform-Vergleich, Bestperformer (aufgegangen in Wochen/Was trägt).

Offen: „Was trägt" zeigt Kategorie/Ziel erst, wenn Posts ihren Karten zugeordnet sind (bei Ben: ab dem nächsten Upload, v97);
die Einstellung „Datenquelle der Auswertung: Drive-CSVs" wirkt auf diese Seite nicht mehr (sie nutzt immer die Live-Abfrage).

## DoD

- [x] Eine Seite, vier Übersichten, ohne doppelte Beitragslisten
- [x] Blättern in die Vergangenheit; Zahlen je Beitrag in dessen Veröffentlichungswoche; Umschalter auf Konto-Werte je Woche
- [x] Titel der Karte am Beitrag; Format/Kategorie/Ziel aus dem Board in „Was trägt"
