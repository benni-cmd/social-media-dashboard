# v111 — Zielarchitektur: Board als Social-Media-Modul von Rootwork

> Owner-Auftrag 06.10.2026 (Folge von v109). Stand: Plan + Entscheidungen; Bau noch nicht begonnen.

## PIG

**Problem:** `docs/architektur.md` (v109) beschreibt das Board, wie es heute ist (lokal, ein Owner), und
seine Einbettung in die Showcase. Das eigentliche Ziel ist größer: In der fertigen Rootwork-Software
**ersetzt das Board den kompletten Social-Media-Bereich** und wird später ergänzt. Rootwork ist gehostet
und hat mehrere Nutzer. Für diesen Zielzustand gibt es noch keine Architektur.

**Intent:** Leon soll das Board in Rootwork einbauen können, ohne nachzufragen. Drive bleibt dabei die
Ausweichmöglichkeit: Fällt das System aus, wird direkt in Drive weitergearbeitet. Das Onboarding ist
der erste Schritt, denn ohne Onboarding hat das Board keine Daten.

**Goal:** Eine gepushte Zielarchitektur (`docs/zielarchitektur.md`) mit folgenden Teilen:
- Komponenten im gehosteten Betrieb
- Drive-Anbindung je Nutzer
- KI-Wege: API und lokales Hilfsprogramm
- Speicher-Schicht für Drive und Datenbank
- Rechte über Rootwork
- Onboarding
- Migrationsstufen

Jede Aussage ist belegt oder als offen markiert.

## Entscheidungen (Owner, 06.10.2026)

| Frage | Entscheidung |
|---|---|
| Für wen | **Nur World Eden Era**: eine Organisation, keine Mandantentrennung |
| Board-Zahl | **Ein gemeinsames Board**: ein Drive-Ordner, den die Organisation freigibt |
| Drive-Zugang | **Jeder Nutzer verbindet sein eigenes Google-Konto**; der Zugriff folgt den Drive-Freigaben |
| Google-Konten | **Google Workspace** (Konten mit eigener Domain) |
| Rechte | **Rootwork-Rollen übernehmen**, kein eigenes Rollenmodell im Board |
| Claude-KI | Abo-Regeln zuerst prüfen (erledigt, siehe Befunde unten) |
| Lokale KI | **Kleines Hilfsprogramm je PC ist ok**: es verbindet sich von sich aus mit Rootwork und reicht an Ollama weiter |
| Datenbank | **Architektur für beides**: eine Speicher-Schicht mit Drive oder Datenbank je Datenart; Ziel ist, dass in Drive vor allem Skripte und Videos in der wandernden Ordnerstruktur bleiben |
| Erster Schritt | **Onboarding** gehört in die gehostete Version (Einrichtungs-Assistent, heute `public/einrichtung.js`) |

## Befunde (belegt)

1. **Ein Claude-Abo ist serverseitig für mehrere Nutzer nicht zulässig.**
   - Quelle 1, Agent-SDK-Doku (code.claude.com/docs/en/agent-sdk/overview, Hinweis-Kasten): Ohne vorherige Genehmigung dürfen Drittentwickler kein claude.ai-Login und keine Abo-Rate-Limits für ihre Produkte anbieten; vorgesehen sind API-Schlüssel.
   - Quelle 2, Anthropic-Verbraucherbedingungen (anthropic.com/legal/terms): Das eigene Konto darf niemand anderem zugänglich gemacht werden.
   - **Folge:** Die gehostete Claude-Anbindung läuft über einen **API-Schlüssel der Organisation** (Claude Console) und wird pro Token bezahlt. Das „token-frei" von heute entfällt serverseitig.
2. **Offen und nicht belegt:** Ob ein Nutzer sein **eigenes** Claude-Abo über das lokale Hilfsprogramm auf dem eigenen PC nutzen darf (so arbeitet das Board heute). Das Hilfsprogramm wird ein Teil von Rootwork, also eines Produkts. Ich nehme es nicht an, bevor es geklärt ist.
3. **Google Workspace und interne App:** Eine OAuth-App vom Typ „intern" braucht keine Google-Verifizierung (developers.google.com, OAuth production readiness; support.google.com/cloud/answer/13463817). Für Drive-Scopes muss der Workspace-Admin die App eventuell freigeben (Admin-Konsole, Regeln für App-Zugriff).
4. **Rootwork:**
   - Vite/React-SPA mit **Supabase** (35 Tabellen im Bundle, u. a. `users`, `teams`, `team_members`) und Hash-Routing.
   - Der Social-Media-Bereich ist heute eine Seite mit Demo-Kennzahlen und einem generischen Kanban (gemessen 06.10.2026).
   - Das Rootwork-Repo ist von Bens GitHub-Zugang aus nicht sichtbar (`gh repo list coastcoder439` zeigt es nicht).

## Plan (Inhalt von docs/zielarchitektur.md)

1. **Zielbild und Grenze:** was gehostet in Rootwork läuft, was auf dem PC des Nutzers (Hilfsprogramm), was in Drive bleibt; Rückfallweg „ohne System in Drive weiterarbeiten".
2. **Onboarding gehostet:**
   - Rootwork-Anmeldung → Google verbinden (je Nutzer) → gemeinsamen Board-Ordner prüfen bzw. anlegen
   - Firmenkontext erfassen → Redaktionsplan einstellen
   - KI wählen (API-Schlüssel der Organisation oder lokales Hilfsprogramm)
   - Abbildung auf die heutigen Schritte in `einrichtung.js`
3. **Drive-Schicht:** rclone wird durch die Drive-API mit Nutzer-Token ersetzt (Speicherort der Token in Rootwork, Erneuerung, Widerruf); Ordnervertrag aus `docs/drive-convention.md` bleibt unverändert.
4. **Speicher-Schicht:** Schnittstelle je Datenart (Karten-Index, Plan, Prompts, Workflows, Kontext, KPI, Dateien); Drive-Ausführung = heutiger Vertrag; Datenbank-Ausführung = Supabase-Tabellen; Regel, was immer in Drive bleibt (Skripte, Videos, Ordner je Phase, `Steckbrief.md`).
5. **KI-Schicht:**
   - Anbieter-Schnittstelle (heute `laufePipeline` in `server.js`)
   - Cloud: Claude-API mit Schlüssel der Organisation
   - Lokal: Hilfsprogramm mit Kopplung, Authentifizierung, ausgehender Verbindung und Grenzen dessen, was es ausführen darf
6. **Rechte:** Board-Funktionen (Abschnitt 4 der v109-Doku) werden auf Rootwork-Rollen abgebildet; Lücken benennen.
7. **Server-Teil:** Was nicht in Vercel-Funktionen passt (Abgleich 10–70 s, Streams, Video-Uploads, KPI-Lauf) und wohin es kommt (z. B. Supabase Edge Functions, Hintergrund-Jobs, Direkt-Upload Browser → Drive). Jede Plattform-Grenze wird vor der Aussage belegt.
8. **Migrationsstufen** vom lokalen Board zum Rootwork-Modul, je Stufe mit Rückfallweg.

## Stand
- [x] Entscheidungen eingeholt, Abo-Regel mit zwei Quellen belegt (06.10.2026)
- [ ] Angaben von Leon (siehe Offen)
- [ ] docs/zielarchitektur.md gebaut
- [ ] committet + gepusht

## Offen
1. **Leon:** Rootwork-Repo, Supabase-Projekt und das bestehende Rollenmodell (welche Rollen, wie sie in Supabase abgebildet sind, z. B. RLS-Regeln).
2. **Klärung bei Anthropic:** Darf ein Nutzer das eigene Claude-Abo über das lokale Hilfsprogramm nutzen? Bis dahin gilt: Cloud = API-Schlüssel, lokal = Ollama.
3. **Workspace-Admin:** Darf eine interne App Drive-Vollzugriff bekommen?

## DoD
- `docs/zielarchitektur.md` deckt die acht Planpunkte ab; jede Aussage ist belegt (Fundstelle oder Quelle) oder steht unter „Offen".
- Leons Angaben (Repo, Supabase, Rollen) sind eingearbeitet, oder ihr Fehlen ist als Blocker benannt.
- Committet und gepusht.
