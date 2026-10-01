# Installation, Einrichtung, Umzug

Ziel: ein arbeitsfähiges Board auf einem Windows-Rechner — mit leerem oder bestehendem Drive-Ordner.
Wie das Board danach funktioniert: [`README.md`](README.md).

## 1. Voraussetzungen (einmal je Rechner)

| Was | Wozu | Installieren | Prüfen |
|---|---|---|---|
| Node.js ≥ 20 | Server | `winget install OpenJS.NodeJS.LTS` | `node -v` |
| Git für Windows | Code holen, bringt `openssl` mit (Zertifikat) | `winget install Git.Git` | `openssl version` |
| rclone | Google Drive | `winget install Rclone.Rclone` | `rclone version` |
| Claude-CLI | KI-Texte über dein Claude-Abo | `npm i -g @anthropic-ai/claude-code` (oder `Setup-Claude.cmd`) | `claude --version` |
| Ollama (empfohlen) | lokale KI für Recherche + Abgleich | `winget install Ollama.Ollama` | `ollama list` |

Die Modelle (`deepseek-r1:14b`, `qwen2.5:14b`, je ~9 GB) lädt die Einrichtung im Board auf Knopfdruck.

## 2. Code holen und starten

```
git clone https://github.com/benni-cmd/social-media-dashboard.git
cd social-media-dashboard
copy .env.example .env
```

Start: Doppelklick auf **`Start-Board.cmd`** (startet Ollama mit, öffnet den Browser) oder `npm start`.
Adresse: **https://localhost:4321** — das Zertifikat ist selbstsigniert, der Browser fragt einmal nach.
Beim ersten Start erzeugt der Server `data/localhost.key`/`.crt` (braucht `openssl` im PATH).

## 3. Google Drive verbinden (rclone)

1. Eigene Google-Cloud-App für rclone ist Pflicht (die geteilte client_id von rclone wird 2026
   abgeschaltet): console.cloud.google.com → Projekt → **Google Drive API** aktivieren → Credentials →
   OAuth client ID (Desktop app). Details: [`docs/drive-convention.md`](docs/drive-convention.md) Abschnitt „Zugang".
2. `rclone config` → neuer Remote **`gdrive`**, Typ `drive`, client_id/secret eintragen, Scope `drive`,
   im Browser mit dem Google-Konto anmelden, dem der Board-Ordner gehört.
3. Prüfen: `rclone lsd gdrive:` listet deine Drive-Ordner.

## 4. Board-Ordner wählen

Im Board: **Einstellungen → Externe Dienste → Google Drive → „Ordner wechseln"**, Link des Drive-Ordners einfügen.

- **Leerer Ordner** → das Board legt die feste Struktur an und startet die **Einrichtung** (Abschnitt 5).
- **Ordner mit vollständiger Board-Struktur** → wird geladen (Umzug eines bestehenden Boards).
- **Anderer Inhalt / kaputte Struktur** → wird abgelehnt, mit Grund.

Der Name des Ordners ist ab dann der Name des Boards (oben links).

## 5. Einrichtung im Board (Schritt für Schritt)

Öffnet sich von selbst bei einem neuen, leeren Board; sonst Einstellungen → Externe Dienste →
„Einrichtung Schritt für Schritt starten". Jeder Schritt lässt sich mit „Später" überspringen.

1. **Name** — Name des Drive-Ordners; Ändern benennt den Ordner um.
2. **Google Kalender + Tasks** — einmalig eigene Google-Cloud-App (APIs *Google Calendar* und
   *Google Tasks* aktivieren, OAuth client ID „Web application", Redirect URI
   `https://localhost:4321/api/auth/google/callback`), Client-ID + Secret eintragen, „Verbinden".
   Solange die App im Google-Modus „Testing" ist, läuft die Anmeldung nach 7 Tagen ab — für Dauerbetrieb
   die App auf **„In production"** stellen.
3. **Claude** — „Anmeldung starten" → bei Claude anmelden → angezeigten Code einfügen.
4. **Lokale KI** — prüft Ollama, lädt die empfohlenen Modelle.
5. **KI-Rollen** — Vorschlag: Userkommunikation = Claude Haiku, Recherche = `deepseek-r1:14b`,
   Kontextabgleich = `qwen2.5:14b`. Gespeichert im Board (Drive).
6. **Firmenkontext** — sechs Fragen (Wer · Wofür · Zielgruppe · Ton · No-Gos · Handlungsaufruf).
7. **System-Prompts** — alle 15 in der Reihenfolge des Board-Ablaufs, je mit Erklärung, Ort des Knopfs
   und Platzhalter-Legende. **Hinweis:** Der mitgelieferte System-Vorspann ist für World Eden Era
   geschrieben — für ein anderes Unternehmen hier anpassen.
8. **Redaktionsplan** — Posts pro Woche je Format.
9. **Abschluss** — prüft den echten Stand und listet, was noch offen ist.

## 6. Optional: Instagram und LinkedIn (Auswertung)

Zugänge in `.env` (Anleitung steht als Kommentar in [`.env.example`](.env.example)), dann Einstellungen →
Social Media Kanäle → „Verbinden". Redirect-URIs:
`https://localhost:4321/api/auth/instagram/callback` und `https://localhost:4321/api/auth/linkedin/callback`.

## 7. Umzug auf einen anderen Rechner oder in einen anderen Ordner

- **Anderer Rechner, gleicher Ordner:** Abschnitte 1–3, dann denselben Ordner wählen — Karten,
  Einstellungen, Prompts und KI-Rollen kommen aus Drive. Neu anmelden musst du Google Kalender/Tasks,
  Claude und Instagram/LinkedIn (Zugänge liegen bewusst nur lokal).
- **Neuer, leerer Ordner:** Ordner wechseln → Einrichtung. Das alte Board bleibt in seinem Ordner
  unverändert; das Board sichert seinen Stand vor jedem Wechsel.

## 8. Fehlerbehebung

| Zeichen | Ursache | Lösung |
|---|---|---|
| KI-Knopf: „claude endete mit Code 1" | Claude-CLI abgemeldet | Einstellungen → Externe Dienste → Claude → „Anmelden" |
| Kalender: „Anmeldung abgelaufen" | Google hat die Anmeldung abgelehnt (Testing-App: 7 Tage) | „Verbinden" erneut; App auf „In production" stellen |
| „model … not found" | Ollama-Modell fehlt | Einrichtung Schritt 4 „Laden" oder `ollama pull qwen2.5:14b` |
| Drive „nicht erreichbar" | rclone-Anmeldung abgelaufen oder falscher Ordner | `rclone config reconnect gdrive:`; Ordner prüfen |
| Start bricht ab (Zertifikat) | `openssl` fehlt im PATH | Git für Windows installieren, neues Terminal |

`Diagnose.cmd` schreibt die Umgebung (Pfade, Versionen) nach `diagnose-ergebnis.txt` — hilfreich bei Supportfragen.
