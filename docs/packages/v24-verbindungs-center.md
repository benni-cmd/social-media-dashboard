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
  **Schnitt (Auswertung-Session, 03.09.2026):** Auswertung ist source-agnostic (nur Render, liest
  heute live API; Drive-CSVs sind schreib-only). Toggle NICHT in `auswertung.js`, sondern an der
  Fetch-Schicht: **sie liefert** den Drive→API-Form-Leser + `?quelle=api|drive`-Route auf
  `/api/stats/*`; **ich baue** Toggle-UI (Social-Media-Sektion) + `store.js` sendet `?quelle`.
  Ich fasse `kpi.js`/`auswertung.js` NICHT an. Start: wenn Owner „weiter" sagt → ich pinge sie.
- **v24-3 — Claude-Abo:** Status (`claude` CLI eingeloggt?) + geführte Anbindung.

---

## Stand
- [x] Weichen (Owner 03.09.2026): Speicher = .env; Umfang = alles (Toggle abgestimmt).
- [x] **v24-1 gebaut + UI-verifiziert (03.09.2026):** `server.js` `PUT /api/config/env`
      (Whitelist GOOGLE/INSTAGRAM/LINKEDIN, Wert sanitisiert, `process.env` live) + `envSchreiben`;
      `GET /api/verbindungen/status` (google/drive/instagram/linkedin/claude); `store.js`
      `envSetzen`/`verbindungenStatus`; `ui.js` neuer Einstellungen-Tab „Externe Dienste"
      (Google: ID/Secret-Felder→.env, Speichern, Verbinden, Status-Chip, Anleitung; Drive-Status).
      Verify: Smoke-Test (status liefert 5 Dienste, bad-key→400, envSchreiben append+replace ok);
      CDP-Screenshot des Tabs. `.env` NICHT im Test verändert (isolierte Temp-.env).
- [ ] v24-2 (Social Media + Toggle, mit Auswertung-Session).
- [ ] v24-3 (Claude-Abo).

## DoD
- [ ] ID/Secret im UI eintragbar → landet in `.env`, Verbinden startet OAuth, Status stimmt.
- [ ] Nur Whitelist-Keys schreibbar; Wert sanitisiert; kein Secret im Repo.
- [ ] Jeder Dienst hat sichtbare Kurz-Anleitung; neue Nutzer kommen ohne Vorwissen durch.
- [ ] UI-Abnahme per Screenshot (Einstellungen → Verbindungen).
