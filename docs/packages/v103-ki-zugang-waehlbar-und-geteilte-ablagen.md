# v103 — KI-Zugang wählbar (Claude · ChatGPT · nur lokal) und Board in geteilten Ablagen (Plan)

> Owner 02.10.2026: „Es soll die Möglichkeit geben, statt Claude auch ChatGPT zu verbinden oder das komplett zu skippen und nur
> lokal zu arbeiten, oder auch anders herum." — Frage: „Der offizielle Social-Media-Ordner ist ein Unterordner in einem geteilten
> Workspace. Kann ich mit der Drive-Anbindung auf geteilte Workspaces zugreifen, mit allen Rechten, die mein Account hat?"

## Teil A — KI-Zugang wählbar

**Problem:** Die Einrichtung setzt die Claude-CLI voraus (Schritt „Claude anmelden" gilt als offen, bis Claude angemeldet ist);
lokale KI (Ollama) wird ebenfalls verlangt, sobald eine Rolle sie nutzt. Wer nur lokal oder nur mit ChatGPT arbeiten will, kommt
nicht durch die Einrichtung.
**Intent:** Jedes Board wählt seinen KI-Weg selbst; die Einrichtung fragt nur, was dieser Weg braucht.
**Goal:** Neuer erster KI-Schritt „Wie soll die KI laufen?" mit vier Wegen; Rollen-Vorschlag und Pflicht-Schritte folgen daraus.

| Weg | braucht | Rollen-Vorschlag |
|---|---|---|
| Claude-Abo + lokal (heute) | Claude-CLI, Ollama | Texte Claude Haiku · Recherche DeepSeek · Abgleich Qwen |
| ChatGPT-Abo + lokal | Codex-CLI, Ollama | Texte ChatGPT · Recherche DeepSeek · Abgleich Qwen |
| nur Cloud (Claude oder ChatGPT) | eine CLI, kein Ollama | alle drei Rollen über die Cloud |
| nur lokal | Ollama | Texte Qwen 2.5 · Recherche DeepSeek · Abgleich Qwen (kostenlos, langsamer, schwächere Texte) |

**ChatGPT technisch** (Quellen: OpenAI-Doku „Non-interactive mode", learn.chatgpt.com/docs/non-interactive-mode; Codex-CLI-Doku
learn.chatgpt.com/docs/codex/cli): `codex exec "<prompt>"` läuft ohne Oberfläche, gibt nur die Antwort auf stdout aus, nutzt die
gespeicherte Anmeldung (`codex login` mit ChatGPT-Konto), Standard ist nur-lesend. Installation `npm i -g @openai/codex`
(auf Bens Rechner noch nicht installiert, `which codex` 02.10.2026). **Einschränkung laut OpenAI:** ein ChatGPT-Plan ist für die
interaktive Nutzung durch eine Person lizenziert; für Automatisierung empfiehlt OpenAI einen eigenen API-Schlüssel (`CODEX_API_KEY`,
nach Verbrauch bezahlt). Das Board ruft die CLI nur auf Knopfdruck des Menschen auf — vergleichbar mit der Claude-CLI —, die
Bewertung, ob das unter den Plan fällt, liegt beim Owner.

**Bau (nach Owner-Entscheidung):** `lib/ai.js` Anbieter `codex` neben `claude`/`ollama`; KI-Rollen-Auswahl um ChatGPT ergänzen;
Einrichtung: Weg-Wahl + Schritt „ChatGPT anmelden" (Installationshinweis, `codex login` im Browser); Pflicht-Schritte je Weg.

## Teil B — Board-Ordner in einer geteilten Ablage (Shared Drive)

**Antwort (zwei Quellen):**
- rclone greift auf geteilte Ablagen zu, braucht dafür aber die Einstellung `team_drive` (ID der geteilten Ablage) zusätzlich zum
  Ordner (rclone.org/drive — „Shared drives" / `--drive-team-drive`). Die heutige Verbindung zeigt auf „Meine Ablage".
- Gearbeitet wird mit den Rechten des angemeldeten Kontos — nicht mehr, nicht weniger. Für das Board zählt die **Rolle in der geteilten
  Ablage** (Google Workspace Hilfe „Shared drive access levels"; Drive-API „Roles and permissions"):
  - Verschieben innerhalb der Ablage (Karte wechselt die Spalte = Ordner wandert): **Content-Manager oder Manager**
  - Ordner anlegen, Dateien schreiben: ab **Mitwirkender**
  - Endgültig löschen: **Manager** (das Board verschiebt in „Papierkorb"/„Verworfen", löscht selten)
  - Mit „Mitwirkender" kann das Board also Karten anlegen, aber **nicht zwischen Spalten verschieben**.

**Bau (nach Owner-Angaben):** Beim Ordner-Wählen erkennt das Board per Drive-API (`files.get … fields=driveId`), ob der Ordner in einer
geteilten Ablage liegt, setzt `team_drive` für rclone automatisch und prüft die eigene Rolle (`capabilities.canMoveItemWithinDrive`) —
fehlt sie, sagt die Einrichtung das im Klartext, bevor das Board loslegt.

## Offene Fragen an den Owner

- **Q1 ChatGPT:** Codex-CLI mit ChatGPT-Anmeldung (Abo, Hinweis oben) oder mit eigenem API-Schlüssel (nach Verbrauch) — oder beides anbieten?
- **Q2 Geteilte Ablage:** Link des offiziellen Social-Media-Ordners + deine Rolle dort (Manager / Content-Manager / Mitwirkender),
  damit ich die Erkennung gegen den echten Ordner (nur lesend) teste.

## Stand

02.10.2026 — Plan angelegt, Recherche belegt, noch nichts gebaut.

## DoD

- [ ] Einrichtung mit Weg „nur lokal" durchlaufbar ohne Claude; mit „nur Cloud" ohne Ollama
- [ ] ChatGPT als Anbieter je Rolle wählbar, KI-Knopf liefert Text über `codex exec`
- [ ] Ordner in geteilter Ablage: automatisch erkannt, Rolle geprüft, Karten verschiebbar (live belegt)
