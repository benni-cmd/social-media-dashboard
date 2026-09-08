# v39 — KI-Anbindungen: Setup-Befehle sichtbar, Claude-Hinweis korrigiert

## PIG

**Problem:** In den Einstellungen unter „KI-Anbieter" (`public/ui.js`) stehen die Ollama-Setup-
Befehle bereits (`ui.js:562–564`: `winget install Ollama.Ollama`, `ollama pull qwen2.5:14b`,
`ollama pull qwen2.5:32b`) — aber der Block ist `hilfe.hidden = true` (`ui.js:556`) und erscheint
NUR, wenn Ollama nicht laeuft oder kein Modell da ist. Auf einem Rechner mit laufendem Ollama sieht
man sie nie, obwohl gerade ein neuer Nutzer sie zum Kopieren braucht. Zweitens behauptet die
Claude-Option „Läuft über dein Claude-Abo · keine separate Installation" (`ui.js:497`) — das ist
fuer einen fremden Rechner falsch: `lib/ai.js:566` ruft `spawn("claude", ["-p", …])` auf, haengt
also an der lokal installierten UND eingeloggten `claude`-CLI. Bens Login reist nicht mit dem Repo.

**Intent:** Wer die App auf einem anderen Rechner klont, soll in den Einstellungen direkt sehen,
mit welchen Befehlen er (1) Ollama, (2) das Modell und (3) die Claude-CLI in Gang bringt — ohne dass
erst etwas kaputt sein muss.

**Goal:** Unter KI-Anbieter ist je Anbieter ein **immer sichtbarer, eingeklappter** Setup-Block mit
den Shell-Befehlen; der Ollama-Block geht bei erkanntem Problem automatisch auf. Die Claude-
Beschreibung nennt ehrlich Installation + eigenen Login.

## Bestandsaufnahme (gemessen 08.09.2026)

- `lib/ai.js:1` Kommentar „laeuft ueber Bens Abo" — der Aufruf `spawn("claude", …)` (`:566`) nutzt
  aber IMMER das auf DIESEM Rechner eingeloggte Claude-Konto, nicht Bens. Login liegt im
  Benutzerprofil/Keychain, nicht im Repo.
- `lib/ai.js:677–684` meldet den fehlenden CLI-Fall bereits sauber („nicht installiert. Einmalig
  `npm i -g @anthropic-ai/claude-code`, dann `claude` starten und einloggen").
- Default-Anbieter ist Ollama (`store.js:388`) — ein fremder Nutzer landet ohnehin zuerst dort.
- `.einst-befehl` (`style.css:2282`) hat `user-select: all` — ein Klick markiert den ganzen Befehl.

## Design-Entscheidungen

- **Ollama-Hilfe → `<details>` statt versteckter `<div>`.** Immer im DOM, standardmaessig
  eingeklappt (kein Laerm), Auto-Aufklappen (`open = true`) im Fehlerfall statt Ein/Ausblenden
  (`hidden`). Gleiche Befehle, gleiche CSS-Klassen.
- **Claude bekommt einen eigenen `<details>`-Setup-Block** mit `npm i -g @anthropic-ai/claude-code`
  und `claude` (einmal starten, mit eigenem Abo einloggen) plus dem Satz, dass das jeweils
  eingeloggte Konto DIESES Rechners zaehlt.
- **Sub-Text der Claude-Option korrigiert** von „keine separate Installation" zu „einmal
  installieren und mit dem eigenen Claude-Abo einloggen".

## Plan

1. `ui.js`: Ollama-`hilfe` in `<details>` umbauen; `hidden`-Toggles → `open`-Toggles.
2. `ui.js`: Claude-Sub korrigieren; Claude-Setup-`<details>` in `claudeKonfig` ergaenzen.
3. Screenshot beider Anbieter-Bloecke (Browser) gegen `docs/ui-standard.md`.
4. Commit + Push.

## Stand

- [x] Bestand gemessen (ai.js-Aufruf, bestehende Hilfe, Default-Provider)
- [x] Ollama-Block immer sichtbar (details) — Screenshot: Befehle sichtbar bei laufendem Ollama
- [x] Claude-Setup-Block + Sub-Korrektur — Screenshot: `npm i -g …` + `claude`, Login-Hinweis
- [x] Optische Abnahme per Screenshot (beide Anbieter, aufgeklappt)
- [x] Commit + Push

## DoD

- Bei gewaehltem Ollama: Setup-Befehle (Ollama + qwen2.5:14b) sichtbar, ohne dass etwas kaputt ist.
- Bei gewaehltem Claude: Installations- + Login-Befehle sichtbar; Sub-Text ehrlich.
- Screenshot belegt beide Bloecke im Layout.
