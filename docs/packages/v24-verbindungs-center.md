# v24 — Verbindungs-Center (Blueprint-Onboarding in den Einstellungen)

## PIG

**Problem:** Zugänge (Google OAuth für Kalender/Tasks, Drive/rclone, Instagram/LinkedIn,
Claude-Abo) müssen heute von Hand in `.env` bzw. per CLI eingerichtet werden. Es gibt keinen
geführten Weg im UI; ein neuer Nutzer, der das Repo als Blueprint klont, scheitert am Setup.

**Intent:** Ein **Verbindungs-Center** im Einstellungsfenster: je Dienst Status, Verbinden-Knopf,
die nötigen Felder UND eine Kurz-Anleitung. Zugänge liegen NUR lokal (`.env`, gitignoriert) —
das Repo bleibt ein Blueprint ohne Geheimnisse. [Owner, 03.09.2026]

**Goal:** Einstellungen → Verbindungen hat „Externe Dienste" (Drive, Google Kalender/Tasks) und
„Social Media Kanäle" (Instagram/LinkedIn + Auswertungsquelle-Toggle) sowie eine einfache
Claude-Abo-Anbindung. ID/Secret trägt man im UI ein (landet in `.env`), der Status wird
angezeigt, „Verbinden" startet den OAuth-Flow. Neue Nutzer können alles selbst aufsetzen.

---

## Design-Entscheidungen [Owner, 03.09.2026]

- **Speicher: `.env`** (gitignoriert, Env-Var-Stil — entspricht CLAUDE.md „keine Zugänge in
  Dateien / Umgebungsvariablen"). Ein gesicherter Endpunkt schreibt NUR Whitelist-Keys und lädt
  `process.env` live nach.
- **Ich baue alles** — inkl. Auswertungsquelle-Toggle, der Auswertung/KPI-Code (`lib/kpi.js`,
  `public/auswertung.js`) berührt → mit der Auswertung-Session eng abstimmen (geteilter Baum).
- **Gesichertes Schreiben:** `PUT /api/config/env {key,value}` — nur erlaubte Keys
  (GOOGLE_OAUTH_CLIENT_ID/SECRET, INSTAGRAM_APP_ID/SECRET, LINKEDIN_CLIENT_ID/SECRET…), Wert ohne
  Zeilenumbrüche, Länge begrenzt; aktualisiert Datei UND `process.env`.
- **Status:** `GET /api/verbindungen/status` aggregiert Drive, Google, IG, LinkedIn, Claude-CLI.
- **Anleitung:** je Dienst knappe Schritt-Texte im UI + Link zur jeweiligen Console.
- **Sicherheit:** Secrets gibt IMMER der Nutzer selbst ein; ich (Assistent) trage nie Zugänge ein.
  Klartext in `.env` ist bewusst der lokale Blueprint-Weg.

## Phasen

- **v24-1 — Externe Dienste (Google + Drive):** `PUT /api/config/env`, `GET
  /api/verbindungen/status`; Einstellungen-Modal „Externe Dienste"-Sektion: Google Kalender/Tasks
  (ID/Secret-Felder → .env, Verbinden, Status), Drive-Status + Kurz-Anleitung.
- **v24-2 — Social Media Kanäle:** Instagram/LinkedIn (Felder + Verbinden + Anleitung) +
  Auswertungsquelle-Toggle (Drive-only ↔ API+Drive) — mit der Auswertung-Session abgestimmt.
- **v24-3 — Claude-Abo:** Status (`claude` CLI eingeloggt?) + geführte Anbindung.

---

## Stand
- [x] Weichen (Owner 03.09.2026): Speicher = .env; Umfang = alles (Toggle abgestimmt).
- [ ] v24-1 gebaut + verifiziert.
- [ ] v24-2 (Social Media + Toggle, mit Auswertung-Session).
- [ ] v24-3 (Claude-Abo).

## DoD
- [ ] ID/Secret im UI eintragbar → landet in `.env`, Verbinden startet OAuth, Status stimmt.
- [ ] Nur Whitelist-Keys schreibbar; Wert sanitisiert; kein Secret im Repo.
- [ ] Jeder Dienst hat sichtbare Kurz-Anleitung; neue Nutzer kommen ohne Vorwissen durch.
- [ ] UI-Abnahme per Screenshot (Einstellungen → Verbindungen).
