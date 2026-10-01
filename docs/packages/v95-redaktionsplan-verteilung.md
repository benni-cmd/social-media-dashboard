# v95 — Redaktionsplan: Uploads sinnvoll verteilen

> Owner 01.10.2026: „Der eine Post pro Woche wird manchmal auf den Samstag gelegt. Prüf die ganze Logik, wie
> die Sachen verteilt werden, wann die Uploads geplant werden — dass das immer möglichst sinnvoll ist."

## PIG

**Problem (gemessen in `lib/scheduler.js`):**
1. Die Reel-Fenster enthalten Fr 20:00 und Sa 20:00 „TikTok, wenn aktiv" — gefiltert wird aber nie; die Formel
   `(wi*13 + ti*7 + i*3) % 8` rotiert jede Woche auf ein anderes Fenster, also auch auf Samstag, obwohl nur
   Instagram + LinkedIn aktiv sind (`data/plan.json`).
2. Jede Woche ein anderer Wochentag — keine Regelmäßigkeit.
3. Die Fenster weichen von den Belegen ab (Reel „Do 10:00" liegt außerhalb des Instagram-Fensters 11–13 Uhr).
4. Max-Abstand (v79) schiebt einen Slot auf „Vorgänger + N Tage", egal welcher Wochentag.
5. Formate kollidieren am selben Tag ohne Ausweichen.

**Intent:** Ein Upload-Termin ist immer einer, den die Belege tragen, für die Plattform, auf die es ankommt —
und das Board plant regelmäßig.

**Goal:** Slots nur an belegten Tagen und Zeiten der Hauptplattform des Formats; feste Wochentage; Formate
verteilen sich über die Woche; Wochenende nur, wenn die Hauptplattform es belegt; Max-Abstand nie aufs Wochenende.

## Regeln (Belege: `docs/best-practices.md` §16 — Buffer 2026 + Sprout Social 2026, Klasse B, gleiche Richtung)

| Plattform | Tage (Vorrang) | Zeiten |
|---|---|---|
| Instagram | Mi, Di, Do | 11:30 · 18:30 |
| LinkedIn | Mi, Di, Do | 15:30 · 17:00 |
| YouTube | Mi, Di | 15:00 · 17:00 |
| TikTok | Sa, So, Mo | 19:30 · 07:30 |

- **Hauptplattform je Format** = erste aktive aus: Reel → Instagram, TikTok, YouTube, LinkedIn · Slider → LinkedIn,
  Instagram · Beitrag → LinkedIn, Instagram · Langvideo → YouTube, LinkedIn · Story → Instagram.
- **Tage je Woche:** 1 → Mitte (Mi); 2 → Di + Do; 3 → Di, Mi, Do; mehr → zusätzlich Mo, Fr (Werktage).
- **Stories:** Mo–Fr 08:00 / 19:00 (Instagram-Story, zeitlich unkritischer), ab 6 je Woche auch Sa/So.
- **Mehrere Formate:** zuerst die Tage mit den wenigsten Posts; teilt sich ein Tag, nimmt das nächste Format die
  zweite Uhrzeit.
- **Max-Abstand:** landet der vorgezogene Slot auf Sa/So, rückt er auf den Freitag davor.

## Plan

1. [x] `lib/scheduler.js`: Fenster aus der Plattform-Tabelle ableiten; `generiereWoche` verteilt alle Formate gemeinsam.
2. [x] `deckleAbstand`: kein Wochenende.
3. [x] Node-Probe: 12 Wochen mit Bens Plan (1 Reel, IG + LI) → nur Mi 11:30; gemischter Plan → keine Kollision, kein Sa/So.
4. [x] README §4 nachziehen.

## Stand

01.10.2026 — gebaut und belegt (Node-Probe über 52 Wochen, KW 143–194 ab Epoche):
- Bens Plan (1 Reel, Instagram + LinkedIn): 52 Slots, alle Mi 11:30, 0 am Wochenende.
- Reel 2 + Slider 1 + Beitrag 1: Reel Di/Do 11:30, Slider Mi 15:30, Beitrag Mi 17:00 (zweite Uhrzeit, weil der Tag geteilt ist).
- Reel 3 + Story 3, nur Instagram, TikTok aktiv (Reel bleibt bei Instagram als Hauptplattform), 0,25/Woche: 0 Wochenend-Slots,
  jeder Slot im belegten Fenster seiner Hauptplattform.
- Max-Abstand 4 Tage, Oktober 2026: Fr 02., Di 06., Fr 09., Di 13. … — kein Sa/So.

## DoD

- [x] Kein Wochenend-Slot ohne aktive TikTok-Hauptplattform (Probe über 52 Wochen)
- [x] Jeder Slot liegt in einem belegten Fenster seiner Hauptplattform
- [x] Gleiche Wochentage jede Woche
