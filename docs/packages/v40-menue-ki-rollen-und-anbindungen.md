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

1. **Recherche „die im Internet sucht"** → **echte Web-Suche jetzt**, Quelle **DDG-Standard +
   Tavily optional** (Owner, 12.09.2026; korrigiert die frühere SearXNG-Empfehlung). Grund:
   Ziel ist „clone → läuft, keine Extra-Installs". SearXNG lokal = Docker + Redis/Valkey + JSON
   extra freischalten (geprüft: cloudzun/perlod-Guides) → zu viel Setup für andere. Stattdessen
   ein Such-Adapter IM Node-Server, zwei Backends: **DuckDuckGo schlüssellos** (Default, läuft
   sofort; drosselt aber bei Last — link.sc/serpdive) und **Tavily** (optionaler Gratis-Key,
   1.000 Suchen/Monat ohne Karte — parallel.ai). Brave verworfen (kein Free-Tier mehr seit
   Feb 2026 — firecrawl). DeepSeek R1 verdichtet die Treffer.
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

**Design (gemessen 12.09.2026):** Alle KI-Aufrufe laufen über genau zwei Sendestellen —
`ki(task, …)` und `kiStream(task, …)` in `store.js:395/405`, beide bauen den Body aus
`kiKonfig()` (`store.js:385`). Der Server (`/api/ai`, `/api/ai/stream`, `server.js:397/433`)
nimmt `provider`/`ollamaModel`/`claudeModell` schon aus dem Body — **also keine Server-Änderung
für das Routing**: der Client wählt je Rolle das Modell und schickt es wie bisher.

- **Task→Rolle** (`store.js`, neue Konstante `TASK_ROLLE`):
  `recherche` → `recherche` · (späterer `kontextabgleich`) → `kontext` · alles andere
  (`hooks_verbal`,`hooks_visuell`,`skript`,`regieplan`,`caption`,`ideen`,`plan`,`analyse`)
  → `userkomm`. Unbekannt → `userkomm`.
- **localStorage-Schema** je Rolle: `cm-rolle-userkomm` / `-recherche` / `-kontext` =
  JSON `{provider, ollamaModel, claudeModell}`. Defaults: userkomm =
  `{claude, –, haiku}`; recherche + kontext = `{ollama, deepseek-r1, –}`. Fehlt der Key,
  wird der Default gesetzt (Migration: alte `cm-ai-provider`/… als Seed für userkomm zulässig).
- **`kiKonfig(task)`** schlägt die Rolle nach, liest deren Konfig, liefert die Body-Felder;
  `ki`/`kiStream` rufen `kiKonfig(task)`. Rückwärtskompatibel (ohne task → userkomm-Default).
- **Einstellungen „Verbindungen"** (`ui.js:465–675`): eine Auswahl → drei Rollen-Blöcke
  (Userkommunikation · Recherche · Kontextabgleich), je Provider-Radio + Ollama-Modellliste
  (`/api/ai/ping-ollama`) + Claude-Modellliste (`/api/ai/modelle`). Ein wiederverwendbarer
  Renderer `baueRollenKonfig(rolle, defaults)` ersetzt den heutigen Einzelblock.
- Web-Suche (SearXNG lokal) für die Recherche-Rolle: eigener Schritt NACH dem Routing.

### T3 — Verbinden/Trennen

**Design (gemessen 12.09.2026):** Tokens liegen in `data/tokens.json` als `{google, instagram,
linkedin}` (gesetzt via `speichereToken`, server.js:143). „Trennen" spiegelt „Verbinden": nur die
Dienste, die ein Verbinden haben, bekommen ein Trennen — Google (Kalender/Tasks), Instagram,
LinkedIn (Token entfernen) und Claude (`claude logout`). Drive bleibt Status-only (kein Verbinden-
Button, läuft über rclone) — kein Trennen ohne Verbinden.

- **Server-Endpoints** (POST): `/api/auth/google/trennen` (Token weg + best-effort Google-revoke),
  `/api/auth/instagram/trennen`, `/api/auth/linkedin/trennen` (Token weg), `/api/auth/claude/trennen`
  (`claude logout`, best-effort). Neuer Helfer `entferneToken(plattform)` löscht den Schlüssel und
  schreibt `tokens.json`.
- **UI** (`ui.js` seite3 + Claude-Abschnitt): je Dienst ein „Trennen"-Knopf neben „Verbinden",
  sichtbar nur wenn `verbunden`; nach Klick Status neu laden → Chip wechselt auf „bereit".
- **Nicht test-auslösen**: `claude logout` würde Bens CLI-Login ziehen — Endpoint bauen, aber nur
  Google/Instagram/LinkedIn-Trennen live proben (verbinden-abhängig), Claude nur codeseitig prüfen.

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
- [x] Sub-Entscheidung: Web-Suche = DDG-Standard + Tavily optional (Owner, 12.09.2026;
      SearXNG lokal nach Prüfung verworfen — zu viel Setup für andere)
- [x] T2-Routing: `store.js` (ROLLEN/TASK_ROLLE/rolleKonfig/`kiKonfig(task)`) + `ui.js`
      (3 Rollen-Blöcke) — Screenshot + Live-Funktionsprobe: recherche→ollama/deepseek-r1:14b,
      ideen/hooks/plan→claude/haiku, kontextabgleich→ollama/deepseek-r1:14b (12.09.2026)
- [x] T2-Web-Suche (Kern): `lib/websuche.js` (DDG schlüssellos Default + Tavily via Key, Fehler→[])
      in beide `/api/ai`-Handler vorgeschaltet für `task==="recherche"`. E2E verifiziert am
      Stream-Endpunkt: „Sucht im Internet …" → „6 Web-Treffer (duckduckgo)"; DDG-Parser live gegen
      echtes HTML geprüft (Umweltbundesamt/destatis). Tavily-Pfad codeseitig da, key-gated (12.09.2026)
- [x] T2-Rest a) Tavily-Key-Feld in den Einstellungen (Recherche-Rolle): server.js Whitelist
      + `/api/verbindungen/status` meldet `tavily.konfiguriert`; ui.js Feld + Chip. Screenshot +
      Speichern-Probe (leer → „DuckDuckGo (Standard)") abgenommen (12.09.2026)
- [x] T2-Rest b) `kontextabgleich`-Task: lib/ai.js (gleiches Schema, nimmt Roh-Recherche als
      Variable, JSON-Aufgabe) + Auto-Verkettung in detail.js nach der Recherche (nicht-blockierend,
      Rohfassung bleibt bei Fehler, in `k.rechercheRoh`). E2E verifiziert: Task akzeptiert, zu
      ollama/deepseek-r1:14b (Kontext-Rolle) geroutet, korrektes Schema (12.09.2026). **T2 komplett.**
- [x] T3 Verbinden/Trennen: server.js `entferneToken` + 4 Endpoints (google/instagram/linkedin
      Token weg + Google-revoke best-effort; claude `auth logout`); Claude-Status via `claude auth
      status` (echter Login). ui.js: `trenneDienst`-Helfer + Trennen-Knöpfe (Google/Instagram/
      LinkedIn/Claude), sichtbar wenn verbunden. Bugfix: `.knopf` überschreibt `[hidden]` → Umschalten
      über `style.display`. Verifiziert: Screenshots (Google/Instagram/Claude = Trennen) + No-op-Curl
      linkedin (google/instagram/claude unangetastet). Drive bleibt Status-only (kein Verbinden). (12.09.2026)
- [x] T1-Rest: Menü gruppiert (Daten | System, Divider), Icons je Eintrag (Ordner/Refresh/Zahnrad,
      Board-Stil), A11y (role=menu/menuitem, Pfeiltasten, Home/End, Escape schließt + Fokus zurück
      auf Knopf, ArrowDown öffnet aus dem Knopf). index.html + app.js + style.css. Verifiziert:
      Screenshot (Menü offen, Icons/Divider, Fokus-Ring) + Live-Events (ArrowDown abgleichen→neuladen,
      Escape schließt+fokussiert Knopf). (12.09.2026)
- [ ] T1 „Mehr Aktionen aufnehmen": offen — welche seltenen Aktionen ins Menü sollen, nennt der Owner
      (kein Feature geraten).

## DoD

- Menü-Knopf und `ICONS.zahnrad` zeigen ein als Zahnrad erkennbares Icon (Screenshot belegt).
- Je Rolle ein wählbares Modell mit den genannten Defaults; ein KI-Aufruf nutzt nachweislich das
  Rollen-Modell (Funktionsprobe).
- Jeder Dienst MIT Verbinden (Google Kalender/Tasks, Instagram, LinkedIn, Claude) lässt sich
  trennen; Status-Chip schlägt um. Ausnahme: Google Drive ist Status-only (Verbindung über rclone,
  kein In-App-Verbinden → auch kein Trennen). Claude-Verbinden bleibt der Terminal-Login
  `claude auth login` (interaktiv, nicht als Button möglich) — nur Trennen ist ein Button.

## Offen (bewusst, nicht vergessen)

- T1 „Mehr Aktionen aufnehmen": welche Aktionen ins Menü — Owner nennt sie (kein Feature geraten).
- In-Menü-Zustand (Spinner am laufenden Eintrag) NICHT gebaut: das Menü schließt beim Klick,
  Rückmeldung läuft über Kopf-„Stand" + Fortschrittsleiste + Ergebnis-Meldung (bestehend). Bei
  Bedarf: Menü offen halten + `aria-busy` am Eintrag — dann eigener kleiner Schritt.
- Claude-Verbinden als In-App-Fluss (Device-Code) wäre denkbar, aber Mehraufwand — heute Terminal.
