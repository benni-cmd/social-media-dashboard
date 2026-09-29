# v78 — Einstellungs-Tab „Board & Redaktionsplan": Kategorien & Ziele editierbar

> Owner-Auftrag 28.09.2026, per 5 AskUserQuestion-Antworten präzisiert. Architektur-schwer,
> mehrere Dateien/Sessions — Plan zuerst, Bau nach Umsetzungs-Freigabe.

## PIG

**Problem:** Die Inhaltskategorien (`INHALTSKATEGORIEN`: bildung, spendenaufruf, projektbegleitung,
partnerpost, umfrage) und Ziele (`ZIELE`: reach_new, deepen, community, donations) sind **hartcodierte
Konstanten** in `lib/pipeline.js` — nicht hinzufügbar/entfernbar. Priorität+Aktiv (`plan.kategorienFokus`)
und Ziel-Gewicht-% (`plan.zielgewichte`) sind nur im Redaktionsplan einstellbar.

**Intent (Owner 28.09.2026):** Ein eigener Einstellungs-Tab für Board-/Redaktionsplan-Parameter, wo man
Kategorien und Ziele **verwalten** (hinzufügen/entfernen, Kategorie-Priorität, Aktiv) kann; die
**prozentuale Verteilung** bleibt im Redaktionsplan; von dort **Rücksprung-Links** in die Einstellungen.

**Goal:** Kategorien/Ziele werden editierbar + **Drive-gestützt als Wahrheit** (v60-Muster); neuer
Einstellungs-Tab; Redaktionsplan zeigt nur noch die %-Verteilung + Links.

## Owner-Entscheide (5 Fragen, 28.09.2026)
1. **Aufteilung:** Einstellungen = Liste (add/remove) + Priorität + Aktiv; Redaktionsplan = nur %.
2. **Entfernen = deaktivieren** (aktiv=false), nie hart löschen wenn genutzt — nichts verlieren.
3. **Ziel-Felder beim Hinzufügen:** Name + Kennzahl + optional Beschreibung.
4. **Umfang v1:** nur Kategorien + Ziele. Formate/Typenmix + Kadenz bleiben im Redaktionsplan;
   „weitere Formate wird es nicht geben" → Format-Liste NICHT editierbar machen.
5. **Kategorie-%:** JA — neue %-Verteilung pro aktiver Kategorie im Plan (Summe 100, analog Zielgewichte).

## Design
- **Neuer Drive-Store `lib/boardparamstore.js`** (1:1 planstore/workflowstore-Muster, v60):
  `{ kategorien:[{id,name,satz,aktiv,prioritaet}], ziele:[{id,name,kennzahl,satz,tiefe,aktiv}] }`.
  Wahrheit `System (AI only)/boardparameter.json`; Seed aus den pipeline.js-Konstanten beim Erstlauf
  (Migration: bestehende `plan.kategorienFokus` aktiv/prioritaet übernehmen). 20s-Timeout, Cache-Fallback.
- **server.js:** `GET/PUT /api/boardparameter` an den Store.
- **`lib/pipeline.js` (Konstanten bleiben als DEFAULT/Seed):** `kategorieName`/`zielInfo`/Listen müssen die
  editierte Liste sehen. Weg: Store liefert die Liste; Client hält sie in `S`; Lookups nutzen die
  S-Liste mit Fallback auf die Konstante. Server-seitige Nutzer (`ai.js`, `kpi-tabellen.js`) bekommen die
  Store-Liste eingespeist. Konstanten NICHT löschen (bleiben Seed/Fallback).
- **`public/ui.js` — neuer Tab** „Board & Redaktionsplan": zwei Verwaltungs-Blöcke.
  Kategorien: Zeilen mit Name(+Beschreibung), Aktiv-Toggle, Priorität (Reihenfolge/Zahl), „+ Kategorie",
  „entfernen"=deaktivieren. Ziele: Zeilen mit Name/Kennzahl/Beschreibung, Aktiv, „+ Ziel", „entfernen"=deakt.
  Persistiert über `/api/boardparameter`, danach `zeichne()`.
- **`public/redaktionsplan.js`:** Kategorie-Sektion → Priorität/Aktiv RAUS (jetzt Einstellungen), stattdessen
  **%-Anteil** je aktiver Kategorie (neu, Summe 100) + Link „⚙ In Einstellungen verwalten". Ziel-Sektion →
  Gewicht-% bleibt + gleicher Link. `defaultPlan()` bekommt `kategorienAnteil:[{id,anteil}]`.
- **Deaktivieren-Semantik:** „entfernen" setzt aktiv=false (Eintrag bleibt, Karten behalten Zuordnung,
  aus Board/Plan/KI ausgeblendet). Hartes Löschen nur optional, wenn 0 Karten + kein Plan-Bezug.

## Dateikarte + Besitz (Koordination!)
- `lib/boardparamstore.js` (NEU) — Infra, diese Session.
- `server.js` (+GET/PUT /api/boardparameter) — geteilt.
- `lib/pipeline.js` (Lookups store-fähig, Konstanten als Seed) — **Peer-Datei** → abstimmen.
- `public/store.js` (Laden in S, Lookups) — heiße Datei → abstimmen.
- `public/ui.js` (neuer Tab) — diese Session.
- `public/redaktionsplan.js` (Kategorie-%, Links, Priorität/Aktiv raus) — **andere Session (v66/v74)** → abstimmen.
- `lib/ai.js`, `lib/kpi-tabellen.js` (nutzen kategorieName/zielInfo) — prüfen, dass sie die editierte Liste sehen.

## Stand (28.09.2026, Opus 4.8)
- [x] Bestand + Modell verstanden (SAEULEN=Legacy; INHALTSKATEGORIEN/ZIELE live; Fokus/Gewichte im Plan)
- [x] Owner-Spec (5 Fragen) geklärt
- [x] **Store gebaut** `lib/boardparamstore.js` (Phase A, Teil 1): planstore/workflowstore-Muster,
      Wahrheit `System (AI only)/boardparameter.json`, Seed aus Konstanten, `seed(plan)` migriert
      `kategorienFokus` (aktiv/prioritaet) verlustfrei, 20s-Timeout, Cache-Fallback, `seedFallsLeer`.
      node-Test: 5 Kat/4 Ziele, Migration korrekt. Commit 8f86eac, gepusht.
- [x] **Server-Endpunkte (Phase A Teil 2), Commit be2f211:** GET/PUT `/api/boardparameter` am Store;
      GET seedet fehlende Datei + migriert `plan.kategorienFokus` aus dem Plan-Cache. Import + Cache-Pfad
      (`data/boardparameter.json`) verdrahtet. Live (PORT=4399) belegt: GET liefert 5 Kat/4 Ziele, aktiv-Muster
      = Owner-Plan (bildung/spendenaufruf/umfrage=true); PUT persistiert (TESTKAT ueber PUT->GET), Baseline
      danach wiederhergestellt.
- [x] **Einstellungs-Tab (Phase C), Commit 069c6af:** `public/boardparameter.js` (neu) + Nav-Tab in ui.js
      (Index 8, lazy import). Live belegt: Tab rendert im echten Modal-Pfad (5 Kat/4 Ziele, 9 Aktiv-Boxen,
      22 Felder, +Kategorie/+Ziel/Speichern); Edit persistiert ueber PUT->GET.
- [ ] **OFFEN — Phase B (Lookups store-fähig) + Phase D (Redaktionsplan %+Links) haengen an EINER
      Architektur-Entscheidung, die der Plan offenliess ("Genaue Strategie beim Bau festlegen"):**
      Woher nimmt der SCHEDULER (`generiereWoche`, waehleKategorie) aktiv/prioritaet, wenn Phase D sie aus
      dem Redaktionsplan entfernt? Heute liest er `plan.kategorienFokus`. Optionen:
      (A) Tab schreibt boardparameter UND synct aktiv/prioritaet in `plan.kategorienFokus` -> Scheduler
          unveraendert, geringstes Risiko; dafuer zwei Ablageorte fuer aktiv/prio.
      (B) boardparameter ist alleinige Wahrheit; Scheduler + server-seitige Nutzer (ai.js, kpi-tabellen.js,
          planstore) bekommen die Liste injiziert (setzeBoardparameter-Override, Konstanten als Fallback).
          Sauberer, aber cross-cutting und aendert Board-Scheduling -> braucht Board-Verify.
      Empfehlung: (B), weil der Plan boardparameter ausdruecklich als "Wahrheit" definiert. Vor Bau abklaeren,
      weil es sichtbares Board-Verhalten aendert.
- [ ] Phase B: kategorieName/zielInfo/Listen store-fähig (Override + Fallback); store.js laedt in S; ai.js/kpi einspeisen.
- [ ] Phase D: redaktionsplan.js — Priorität/Aktiv RAUS, kategorienAnteil % (Summe 100) REIN, Ziel-% bleibt, Rücksprung-Links.
- [ ] Verify (Board zeigt Edits) + Migration verlustfrei (bestehende Karten behalten Zuordnung).

## DoD
- Kategorien/Ziele im Einstellungs-Tab add/entfernen(=deaktivieren)/Priorität/Aktiv; persistent in Drive.
- Redaktionsplan: Kategorie-% (Summe 100) + Ziel-% + Rücksprung-Links; Priorität/Aktiv dort entfernt.
- Edits wirken auf Board/KI/KPI (Lookups store-fähig). Bestehende Karten behalten Zuordnung; nichts verloren.
- Browser-Verify (Tab rendert, Edit persistiert über Reload, Redaktionsplan-Link springt).
