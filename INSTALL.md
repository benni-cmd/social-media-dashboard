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

## 3. Einrichtung im Board (der Assistent)

Beim **ersten Start und bei jedem weiteren Start, solange etwas fehlt**, öffnet sich der Assistent und führt
nur durch die offenen Schritte. Die Reihenfolge folgt den Abhängigkeiten; was eine Voraussetzung braucht, ist
bis dahin gesperrt (mit Grund). „Später" überspringt für diese Sitzung, das ✕ schließt bis zum nächsten Start.

| # | Schritt | braucht | was passiert |
|---|---|---|---|
| 1 | Google Drive verbinden | rclone | eigene Google-Cloud-App (Google Drive API, OAuth „Desktop app"), Client-ID + Secret eintragen → Google-Login im Browser; bestehende Verbindung: „neu anmelden" |
| 2 | Projektordner wählen | 1 | Link eines Drive-Ordners: leer → Struktur wird angelegt; mit Board → wird geladen; sonst abgelehnt mit Grund |
| 3 | Board-Name | 2 | Name = Name des Drive-Ordners; Ändern benennt den Ordner um |
| 4 | Claude anmelden | – | „Anmeldung starten" → bei Claude anmelden → Code einfügen |
| 5 | Lokale KI (Ollama) | – | prüft Ollama; lädt `deepseek-r1:14b` (Recherche) und `qwen2.5:14b` (Kontextabgleich) |
| 6 | KI-Rollen | 2 | Vorschlag: Userkommunikation Claude Haiku, Recherche DeepSeek, Kontextabgleich Qwen |
| 7 | Firmenkontext | 2 | sechs Fragen (Wer · Wofür · Zielgruppe · Ton · No-Gos · Handlungsaufruf + Marken-Hashtags) — **kein Vorschlag**, Pflicht |
| 8 | System-Prompts | 2 | alle 15 in Ablauf-Reihenfolge; je Prompt der **Vorschlag** zum Übernehmen oder Anpassen; eine eigene Fassung bleibt vorausgewählt |
| 9 | Redaktionsplan | 2 | Posts pro Woche je Format |
| 10 | Google Kalender + Tasks | 2 | Google-Cloud-App (Calendar API + Tasks API, OAuth „Web application", Redirect `https://localhost:4321/api/auth/google/callback`); für Dauerbetrieb „In production" (sonst läuft die Anmeldung nach 7 Tagen ab) |

Erneut starten: Einstellungen → Externe Dienste → „Einrichtung Schritt für Schritt starten".

**Board zurücksetzen** (Einstellungen → Externe Dienste, ganz unten): löst das Board vom Drive-Ordner und leert
die lokalen Zwischenspeicher; der Assistent beginnt danach bei „Projektordner wählen". Die Daten im Drive-Ordner
bleiben unverändert. Optional werden auch Google Kalender/Tasks, Instagram, LinkedIn und Claude getrennt; die
Drive-Verbindung bleibt.

## 4. Optional: Instagram und LinkedIn (Auswertung)

Zugänge in `.env` (Anleitung steht als Kommentar in [`.env.example`](.env.example)), dann Einstellungen →
Social Media Kanäle → „Verbinden". Redirect-URIs:
`https://localhost:4321/api/auth/instagram/callback` und `https://localhost:4321/api/auth/linkedin/callback`.

## 5. Umzug auf einen anderen Rechner oder in einen anderen Ordner

- **Anderer Rechner, gleicher Ordner:** Abschnitte 1–3, dann denselben Ordner wählen — Karten,
  Einstellungen, Prompts und KI-Rollen kommen aus Drive. Neu anmelden musst du Google Kalender/Tasks,
  Claude und Instagram/LinkedIn (Zugänge liegen bewusst nur lokal).
- **Neuer, leerer Ordner:** Board zurücksetzen oder Ordner wechseln → Einrichtung. Das alte Board bleibt in seinem Ordner
  unverändert; das Board sichert seinen Stand vor jedem Wechsel.

## 6. Fehlerbehebung

| Zeichen | Ursache | Lösung |
|---|---|---|
| KI-Knopf: „claude endete mit Code 1" | Claude-CLI abgemeldet | Einstellungen → Externe Dienste → Claude → „Anmelden" |
| Kalender: „Anmeldung abgelaufen" | Google hat die Anmeldung abgelehnt (Testing-App: 7 Tage) | „Verbinden" erneut; App auf „In production" stellen |
| „model … not found" | Ollama-Modell fehlt | Einrichtung Schritt 4 „Laden" oder `ollama pull qwen2.5:14b` |
| Drive „nicht erreichbar" | rclone-Anmeldung abgelaufen oder falscher Ordner | `rclone config reconnect gdrive:`; Ordner prüfen |
| Start bricht ab (Zertifikat) | `openssl` fehlt im PATH | Git für Windows installieren, neues Terminal |

`Diagnose.cmd` schreibt die Umgebung (Pfade, Versionen) nach `diagnose-ergebnis.txt` — hilfreich bei Supportfragen.
