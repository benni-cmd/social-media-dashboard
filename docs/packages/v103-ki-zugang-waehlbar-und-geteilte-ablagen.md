# v103 — KI-Zugang wählbar (Claude · ChatGPT · nur lokal) und Board in geteilten Ablagen

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

## Owner-Fragen — wie entschieden

- **Q1 ChatGPT: Konto oder API-Schlüssel?** Owner 05.10.2026: „mach alles, was du tun musst, um deine Pakete ordentlich
  abzuschließen" → gebaut wird **beides**; die Wahl trifft der Mensch in der Einrichtung bzw. den Einstellungen. Der Hinweis
  von OpenAI (Plan = persönliche, interaktive Nutzung; für Automatisierung API-Schlüssel) steht an beiden Stellen im Klartext.
- **Q2 Geteilte Ablage:** Erkennung und Rollen-Prüfung sind gebaut und gegen alle drei Rollen-Fälle geprüft. Der Live-Beleg
  gegen den echten Ordner fehlt noch. Dafür braucht es den Link des offiziellen Ordners (nur lesend geprüft, kein Ordnerwechsel).

## Stand

02.10.2026: Plan angelegt, Recherche belegt.

05.10.2026: gebaut und in der Testkopie (:4399, ohne Drive) geprüft.

- **KI-Weg:** neuer Einrichtungs-Schritt 4 „Wie soll die KI laufen?" mit vier Karten. Er ersetzt „KI-Rollen verteilen".
  - Der Weg setzt die drei Rollen vor; darunter lassen sie sich einzeln ändern.
  - Die Schritte „Claude anmelden", „ChatGPT anmelden" und „Lokale KI" erscheinen nur, wenn eine Rolle den Anbieter nutzt.
  - Gemessen mit `offeneSchritte()` bei abgemeldetem Claude/ChatGPT und fehlendem Ollama:

    | Weg | offene Schritte |
    |---|---|
    | ChatGPT + lokal | `chatgpt, ollama` |
    | Claude + lokal | `claude, ollama` |
    | nur lokal | `ollama` |
    | nur Cloud | `claude` |

  - Wer schon Rollen gespeichert hat (Bens Board), sieht den Schritt nicht.
- **ChatGPT als Anbieter** (`provider: "codex"`):
  - Der Aufruf `lib/ai.js` `runCodex` läuft als `codex exec --skip-git-repo-check --sandbox read-only --ephemeral -`. Der Prompt geht über stdin, die Antwort kommt von stdout; Fortschritt auf stderr wird ignoriert.
  - Beleg mit einer Codex-Attrappe im PATH der Kopie: Die Caption-Kette lief durch. Die Attrappe bekam 3.836 Zeichen Prompt und genau diese Argumente; die Antwort kam als Ergebnis zurück.
  - Fehlerhinweise je Fall: nicht installiert, nicht angemeldet, Zeitüberschreitung.
- **Anmeldung:**
  - `lib/codexauth.js` mit den Endpunkten `/api/auth/chatgpt/status|start|schluessel|trennen`:
    - Konto: `codex login`, der Browser öffnet sich.
    - Schlüssel: `codex login --with-api-key`. Der Schlüssel geht nur über stdin an die CLI, nie in eine Board-Datei. `sk-…` wird in Meldungen geschwärzt.
  - `/api/verbindungen/status` liefert jetzt `chatgpt` mit Datenfluss und Anbindung.
- **Einstellungen → KI-Rollen:** Dritte Wahl je Rolle „ChatGPT (via Codex-CLI)" mit Stand, Anmelde-Knopf, Schlüsselfeld und Installationshilfe. Screenshots hell und dunkel angesehen.
- **Geteilte Ablage:**
  - `lib/drivesetup.js` `ablageInfo(id)` liest `driveId`, den Namen der Ablage und `capabilities` über die Drive-API mit dem rclone-Zugang.
  - `pruefeOrdner` listet mit der richtigen Ablage. Die Ordnerwahl hängt einen Satz an:
    - Rechte reichen.
    - Mitwirkender: anlegen ja, verschieben nein, mit Bitte um Content-Manager.
    - Kein Anlegen.
  - Beim Wechsel speichert das Board `teamDrive` in `data/drive-root.json`; jeder rclone-Aufruf bekommt `--drive-team-drive` (Flag in rclone 1.75 belegt: `rclone help flags drive`).
  - Konto-Anzeige: Dateien in geteilten Ablagen haben keinen Besitzer, deshalb fragt das Board dort `about.user`.
- **Nebenbei gefunden und behoben:** Seit v93 lehnte die Einrichtung jede echte Google-Client-ID ab. Grund: Die Prüfregel in `server.js` hatte ihre Backslashes verloren (`[w.-]` statt `[\w.-]`). Bisher fiel das nicht auf, weil bestehende Boards den Schritt nie sahen.

## DoD

- [x] Einrichtung mit Weg „nur lokal" durchlaufbar ohne Claude; mit „nur Cloud" ohne Ollama (gemessen, siehe oben)
- [x] ChatGPT als Anbieter je Rolle wählbar, KI-Knopf liefert Text über `codex exec` (Attrappe; echter Lauf braucht installierte, angemeldete Codex-CLI)
- [ ] Ordner in geteilter Ablage: automatisch erkannt, Rolle geprüft (gebaut, Rollen-Sätze geprüft), Karten verschiebbar **live belegt** — wartet auf den Ordner-Link
- [ ] Echter ChatGPT-Lauf mit installierter Codex-CLI — wartet auf Installation und Anmeldung durch den Owner, nur falls der Weg genutzt wird
