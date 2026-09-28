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

## Stand
- [x] Bestand + Modell verstanden (SAEULEN=Legacy; INHALTSKATEGORIEN/ZIELE live; Fokus/Gewichte im Plan)
- [x] Owner-Spec (5 Fragen) geklärt
- [ ] Umsetzungsreihenfolge/Besitz mit Owner + Sessions abgestimmt
- [ ] Store + Endpoints (Phase A)
- [ ] pipeline.js/store.js Lookups store-fähig (Phase B, Peer)
- [ ] ui.js Tab (Phase A/C, diese Session)
- [ ] redaktionsplan.js %+Links (Phase C, andere Session)
- [ ] Verify (Browser) + Migration verlustfrei

## DoD
- Kategorien/Ziele im Einstellungs-Tab add/entfernen(=deaktivieren)/Priorität/Aktiv; persistent in Drive.
- Redaktionsplan: Kategorie-% (Summe 100) + Ziel-% + Rücksprung-Links; Priorität/Aktiv dort entfernt.
- Edits wirken auf Board/KI/KPI (Lookups store-fähig). Bestehende Karten behalten Zuordnung; nichts verloren.
- Browser-Verify (Tab rendert, Edit persistiert über Reload, Redaktionsplan-Link springt).
