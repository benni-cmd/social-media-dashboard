# v40 — Menü-Zahnrad, KI-Rollen (3-fach) und Verbinden/Trennen

## PIG

**Problem:** Drei Baustellen an Kopf-Menü und Einstellungen.
1. Der Knopf, der das Kopf-Menü öffnet (`public/index.html:29`), trägt ein Icon aus
   Mittelkreis + 8 geraden Strahlen — das ist `ICONS.zahnrad` (`public/ui.js:53`), liest sich
   aber als **Sonne**, nicht als Zahnrad. Dasselbe Icon steht auch am „Bearbeiten"-Knopf der
   Workflows (`ui.js:1642`).
2. Die KI läuft mit **einem** globalen Anbieter + Modell (`store.js:383–392`,
   `cm-ai-provider`/`cm-ollama-model`/`cm-claude-modell`; Routing in `server.js:397,433`).
   Für Userkommunikation, Recherche und Kontextabgleich lässt sich kein eigenes Modell wählen.
3. Externe Dienste (Google Kalender/Tasks, Drive, Social-Media-APIs, Claude) kennen nur
   **„Verbinden"** (OAuth-Redirect, `ui.js:755,842`). Ein **„Trennen"** existiert nirgends —
   weder UI noch Server-Endpoint.

**Intent:** Das Kopf-Menü soll als Zahnrad erkennbar sein und feingliedriger geordnet
Rückmeldung geben; die drei KI-Rollen sollen getrennt konfigurierbar sein (lokal vs. Abo je
nach Zweck); Anbindungen sollen sich so leicht trennen wie verbinden lassen.

**Goal:**
- Kopf-Menü-Knopf und `ICONS.zahnrad` zeigen ein **echtes Zahnrad** (Board-Stroke-Stil);
  Menü gruppiert, mit Zustand (z. B. „Abgleich läuft").
- In den Einstellungen wählt man je Rolle ein Modell: **Userkommunikation** (Default Claude/Abo),
  **Recherche** (Default DeepSeek R1 lokal), **Kontextabgleich** (Default DeepSeek R1 lokal).
  Jeder KI-Aufruf nutzt das Modell seiner Rolle.
- Jeder verbundene Dienst (Claude + alle Google-Dienste/APIs) hat neben „Verbinden" ein
  „Trennen", das den Zugang sauber löst.

## Bestandsaufnahme (gemessen 10.09.2026)

- Menü-Markup: `index.html:27–38` (Knopf `kopf-menu-knopf` + Liste `kopf-menu-liste` mit
  3 Items: Mit Drive abgleichen · Aktualisieren · Einstellungen). Toggle-Logik `app.js:197–219`.
  Keine Pfeiltasten-Navigation, keine Gruppierung, kein Live-Zustand.
- `ICONS.zahnrad` (`ui.js:53`) == das inline-SVG im Menü-Knopf (Sonne-Form). `icon()` `ui.js:68`.
- KI-Konfig: einzelner Provider/Modell (`store.js:388–390`). Server-Routing `/api/ai` +
  `/api/ai/stream` nimmt `provider`/`ollamaModel`/`claudeModell` aus dem Body (`server.js:397–477`).
- Aufgaben-Typen existieren schon in `lib/ai.js` (`AUFGABEN`, `JSON_AUFGABEN`:516/521) — u. a.
  `recherche`. „Recherche" ist also als Task da, aber ohne echte Internet-Suche.
- Verbinden-UI: Google `ui.js:715–767`, generische API-Dienste `baueApiDienst` `ui.js:809–853`.
  Status über `/api/verbindungen/status` (`server.js:971`). Kein Trennen.
- OAuth-Callbacks: Google `server.js:882–969`, Instagram `:813`, LinkedIn `:1025`.

## Entscheidungen (Owner, 12.09.2026)

1. **Recherche „die im Internet sucht"** → **echte Web-Suche jetzt**: T2 bekommt eine echte
   Such-Quelle, deren Treffer das lokale DeepSeek R1 zusammenfasst. Offene Sub-Entscheidung:
   welche Quelle (lokal/kostenlos wie SearXNG · scraping-basiert wie DuckDuckGo · API-Key wie
   Brave/Tavily). Empfehlung SearXNG/lokal — passt zu „100% lokal/kostenlos".
2. **Parallel-Working-Tree** → **als Wahrheit übernommen**. Erledigt durch die Realität: die
   Parallel-Session hat den Vereinfachungs-Umbau am 12.09. committet (`44538f4 v29 Runde 9`,
   `bffefcb`) — und mein Zahnrad-Icon dabei mitgenommen. Es steckt bereits in HEAD.
   **Achtung:** die Session arbeitet aktiv an denselben Dateien (index.html/app.js/board.js) —
   T1-Rest (Menü) daher NACH T2 (server.js/store.js/ui.js-Settings, geringere Kollision).

## Teilpakete

### T1 — Menü-Feinschliff (Icon · Gruppierung · Zustand)
- Echtes Zahnrad: `ICONS.zahnrad` auf ein Cog mit Zahnkranz + Mittelkreis ändern (Lucide-`settings`),
  Menü-Knopf in `index.html` auf dasselbe Cog. Synchron, damit auch Workflows profitieren.
- Menü gruppieren (Trenner/Reihenfolge), Live-Zustand (Abgleich läuft → Eintrag disabled/Spinner,
  letzter Stand sichtbar), Tastatur/A11y (role=menu, Pfeiltasten, Fokus zurück auf Knopf).
- Mehr Aktionen: Kandidaten nach Bestätigung (offen, welche fehlen).

### T2 — KI-Rollen 3-fach
- localStorage-Schema: `cm-ai-rolle-<rolle>` → `{provider, model}` für `userkomm`/`recherche`/`kontext`.
- Server: `/api/ai` + `/api/ai/stream` nehmen optional eine Rolle/explizites Modell; Default-Fallback
  bleibt rückwärtskompatibel.
- Einstellungen: „Verbindungen" von 1 Auswahl auf 3 Rollen-Auswahlen umbauen; Defaults setzen.
- Aufrufer (`store.js` KI-Buttons) senden die Rolle ihrer Aktion.

### T3 — Verbinden/Trennen
- Server: Disconnect-Endpoints (Token/Env sauber löschen/entwerten) für Claude-Status + Google
  (Kalender/Tasks, Drive) + Social-APIs.
- UI: „Trennen"-Knopf je Abschnitt, sichtbar wenn `verbunden`; Status-Chip aktualisiert sich.

## Plan (Reihenfolge)

1. T1 Icon zuerst (klein, self-contained, sichtbarer Fortschritt) → Screenshot gegen `docs/ui-standard.md`.
2. Blocker 1 + 2 mit Owner klären.
3. T1 Rest (Gruppierung/Zustand/A11y) → Screenshot.
4. T2 (Schema → Server → UI → Aufrufer) → Screenshot + Funktionsprobe je Rolle.
5. T3 (Server-Disconnect → UI-Trennen) → Probe verbinden/trennen je Dienst.
6. Je Teilpaket: Verify (Screenshot/Probe) → Commit + Push.

## Stand

- [x] Bestand gemessen (Menü, Icon, KI-Routing, Verbinden-UI) — 10.09.2026
- [x] T1 Zahnrad-Icon (ICONS.zahnrad + Kopf-Knopf) — Screenshot abgenommen; in HEAD via `bffefcb`
- [x] Weichen geklärt: Web-Suche = echt · Parallel-Tree = übernommen (12.09.2026)
- [ ] Sub-Entscheidung: Web-Such-Quelle (Empfehlung SearXNG/lokal)
- [ ] T2 KI-Rollen 3-fach (Reihenfolge: Routing zuerst, Web-Suche danach)
- [ ] T1-Rest Gruppierung/Zustand/A11y (nach T2, wegen aktiver Parallel-Session)
- [ ] T3 Verbinden/Trennen

## DoD

- Menü-Knopf und `ICONS.zahnrad` zeigen ein als Zahnrad erkennbares Icon (Screenshot belegt).
- Je Rolle ein wählbares Modell mit den genannten Defaults; ein KI-Aufruf nutzt nachweislich das
  Rollen-Modell (Funktionsprobe).
- Jeder verbundene Dienst lässt sich trennen; Status-Chip wechselt auf „bereit zum Verbinden".
