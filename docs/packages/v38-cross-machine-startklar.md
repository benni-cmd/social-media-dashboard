# v38 — Cross-Machine startklar: klonen und sofort starten

## PIG

**Problem:** Unklar, ob GitHub den lokalen Stand traegt und ob ein frischer Clone auf einem
ZWEITEN Rechner ohne Handarbeit startet. Konkret gemessen am Arbeitsbaum (08.09.2026):

| Datei | Zustand | Bewertung |
|---|---|---|
| `data/board.json` | modifiziert (getrackt) | Karten-Cache; getrackt seit v17, seedet den Board-Inhalt fuer einen Rechner OHNE Drive |
| `data/spalten.json` | ungetrackt, NICHT ignoriert | reiner lokaler Cache (server.js:167 „Drive ist Wahrheit, data/spalten.json nur Cache"); regeneriert aus `lib/pipeline.js` |
| `docs/packages/v17-kpi-tabellen-drive.md` | modifiziert (getrackt) | Doku-Arbeit |

Zusaetzlich zwei Startweg-Fehler in der `README.md`: unter „Starten" steht `http://localhost:4321`,
der Server laeuft aber **HTTPS** (`server.js:11` `node:https`, `server.js:1207` `createHttpsServer`).
Und es gibt keinen „auf einem anderen Rechner"-Abschnitt (Node-Version, `openssl`-Pflicht fuer die
Zertifikatserzeugung).

**Intent:** Ben will an einem zweiten Rechner klonen und sofort loslegen — GitHub ist die
verlaessliche Quelle, der dokumentierte Startweg stimmt.

**Goal:** (1) GitHub == lokal, sauber gepusht. (2) Ein frischer Clone laesst sich per
dokumentiertem Weg starten — empirisch belegt, nicht erinnert. (3) Der Arbeitsbaum ist geordnet:
echte Caches ignoriert, Doku und Board-Seed committet.

## Bestandsaufnahme (gemessen 08.09.2026)

- **Remote & Sync:** `git rev-list --left-right --count origin/main...HEAD` → `0	0`. HEAD (v37) ist
  bereits auf `origin/main`. Es fehlt kein Commit — offen ist nur der Arbeitsbaum.
- **Keine npm-Abhaengigkeiten:** `package.json` hat keine `dependencies`; `server.js` nutzt nur
  `node:`-Bordmittel (`grep` auf non-node-Imports leer). `npm install` ist unnoetig, `node server.js`
  reicht. README:49 sagt das bereits korrekt.
- **Zertifikat:** `ladeTls()` (server.js:1188) liest `data/localhost.key`/`.crt`, erzeugt sie bei
  Fehlen per `openssl req -x509 …` (server.js:1197). Kein JS-Fallback → **`openssl` ist harte
  Startvoraussetzung**.
- **Empirischer Clone-Test:** `git clone file://…` in den Scratchpad, dann `node server.js`:
  Ausgabe „Erzeuge selbstsigniertes Zertifikat …" → „Content-Maschine laeuft auf
  https://localhost:4321"; `data/localhost.crt`+`.key` danach vorhanden. **Frischer Clone startet.**
  (Diese Umgebung hat `openssl` in Git-Bash; der cmd-PATH eines fremden Rechners ist von hier nicht
  pruefbar — als Rest-Risiko dokumentiert.)

## Design-Entscheidungen

- **`data/spalten.json` → `.gitignore`.** Selbst-deklarierter lokaler Cache, regeneriert aus den
  Defaults; committen braechte nur Churn ohne Nutzen. Reiht sich zu den bestehenden
  `data/.gdrive-*`-Cache-Eintraegen.
- **`data/board.json` bleibt getrackt und wird committet.** Anders als `spalten.json` seedet er
  sichtbaren Board-Inhalt fuer einen Rechner OHNE Drive-Anbindung — ohne ihn startet Rechner 2 mit
  leerem Board. Trade-off bewusst: der Cache dirtiert den Baum bei jeder Board-Aktion (offenes Item).
- **README-Fix minimal:** `http` → `https` unter „Starten"; kurzer Abschnitt „Auf einem anderen
  Rechner" mit Klon-Schritt, Node-20+- und `openssl`-Hinweis. Kein `openssl`-JS-Fallback — das
  widerspraeche der bewussten „keine Abhaengigkeiten"-Linie; dokumentieren statt verdrahten.

## Plan

1. `data/spalten.json` in `.gitignore` eintragen (zu den `data/`-Cache-Eintraegen).
2. `README.md`: `http`→`https` unter „Starten"; Abschnitt „Auf einem anderen Rechner" ergaenzen.
3. Committen (nested repo, pathspec): `.gitignore`, `README.md`, dieses Paket,
   `docs/packages/v17-kpi-tabellen-drive.md`, `data/board.json`.
4. `git push origin main`, danach `origin/main...HEAD` == `0	0` verifizieren.

## Stand

- [x] Bestand gemessen (Remote-Sync, Deps, Zertifikat, Clone-Test)
- [x] `.gitignore` um `data/spalten.json` ergaenzt
- [x] README-Startweg korrigiert (https + Abschnitt „Auf einem anderen Rechner")
- [x] Commit + Push
- [x] Sync verifiziert (`origin/main...HEAD` == `0	0`)

## DoD

- `git status` sauber bis auf laufzeitgenerierte, ignorierte Caches.
- `origin/main` == lokaler `main`.
- README beschreibt den Startweg korrekt (HTTPS) und den Clone-auf-Zweitrechner-Weg.
- Ein frischer Clone startet mit `node server.js` (belegt).

**Rest-Risiko (offen):** `openssl` im cmd-PATH eines fremden Rechners nicht von hier pruefbar;
`data/board.json`-Churn bei jeder Board-Aktion.
