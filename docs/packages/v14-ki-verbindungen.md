# v14 – KI-Verbindungen in Einstellungen

## PIG

**Problem:** Alle KI-Aktionen laufen zwingend über Claude CLI und damit über Bens Abo-Tokens –
auch einfache Aufgaben (Text schreiben, Recherche) bei denen ein lokales Modell reicht.

**Intent:** Die Einstellungen bekommen eine zweite Seite „Verbindungen", auf der der KI-Anbieter
gewählt werden kann: Claude CLI (wie bisher) oder Ollama (lokal, kostenlos, kein Token-Verbrauch).

**Goal:** Nach Wahl von Ollama und Eingabe eines Modellnamens laufen alle KI-Buttons über die
lokale Ollama-API. Claude CLI bleibt Standard. Der eingestellte Provider wird in localStorage
gespeichert und gilt sofort ohne Neustart.

## Plan

1. `docs/packages/v14-ki-verbindungen.md` anlegen (dieser Plan)
2. `lib/ai.js` — `runOllama()` und `runOllamaStream()` ergänzen
3. `server.js` — `/api/ai` und `/api/ai/stream` lesen `provider` + `ollamaModel` aus Body,
   routen entsprechend; neues `GET /api/ai/ping-ollama` für Verbindungstest
4. `public/store.js` — `ki()` und `kiStream()` lesen Provider aus localStorage, schicken ihn mit
5. `public/ui.js` — `einstellungenModal()` bekommt zweiten Nav-Punkt „Verbindungen"
6. Manuell testen: Ollama installiert / nicht installiert, Claude-Fallback
7. Commit + Push

## Stand

- [ ] Paket angelegt
- [ ] lib/ai.js: Ollama-Funktionen
- [ ] server.js: Routing + Ping-Endpoint
- [ ] store.js: Provider mitschicken
- [ ] ui.js: Verbindungen-Tab
- [ ] Manueller Test
- [ ] Commit + Push

## DoD

- Settings-Modal zeigt zwei Tabs: „Darstellung" und „Verbindungen"
- Provider-Wahl + Modellname werden in localStorage gespeichert
- Verbindungstest schlägt klar fehl, wenn Ollama nicht läuft
- Alle bestehenden KI-Buttons funktionieren mit beiden Providern
