# v110 — „Stil & KI-Verhalten": steuerbare Stilregeln + Vermeidungsliste (Negativ-Prompt)

> Owner-Auftrag 06.10.2026. Spec per 4 AskUserQuestion-Antworten fix; Owner-Go 06.10.2026, gebaut 06.10.2026.

## PIG

**Problem:** Die KI-Stil-/Markenregeln stecken fest in `lib/ai.js` (`SYSTEM_VORLAGE`/`MARKE_REGELN`).
Es gibt KEIN editierbares Feld, um typische KI-Schreibweisen (Gedankenstriche „—", Floskeln, Emoji-
Bullets) zu vermeiden oder den Stil zu steuern. Angehängt an jeden Prompt wird heute nur Firmen-/
Projektkontext (`{{firmenkontext}}{{projektkontext}}`, aus `kontextstore`).

**Intent (Owner 06.10.2026):** Ein editierbares Feld „Stil & KI-Verhalten" — **kombiniert** (positive
Stilregeln + kuratierte Vermeidungs-Checkliste + Freitext), **global** als Standard im Tab
„Unternehmenskontext", **optional pro Rolle** im Tab „KI-Rollen"; mit **vorausgefüllter Default-Liste**.

**Goal:** Ein global wirkendes, Drive-gestütztes Stil-/Vermeidungs-Feld, das in JEDEN KI-Prompt einfließt;
plus optionale pro-Rolle-Ergänzung. Default-Liste vorbefüllt.

## Owner-Entscheide (4 Fragen, 06.10.2026)
1. **Wirkungsbereich:** Global-Standard + optional pro Rolle.
2. **Form:** kuratierte Default-Checkliste (Haken) + Freitext.
3. **Framing:** kombiniert — positive Stilregeln + Vermeidungsliste (nicht nur Negativ).
4. **Ort:** global im „Unternehmenskontext"-Tab, optional im „KI-Rollen"-Tab.

## Empfehlung / Hinweis
Reine Negativlisten wirken oft schwächer (Modelle fixieren sich aufs Verbotene) → daher die Kombi aus
positiven Regeln + Vermeidungsliste (Owner bestätigt). Global EINMAL pflegen statt Don'ts je Rolle
wiederholen; pro Rolle nur ein optionaler Zusatz.

## Design
- **Speicher (kein neuer Store nötig):**
  - Global → `kontextstore` (Unternehmenskontext, Drive-Wahrheit): neuer Abschnitt
    `stilregeln = { positivHaken:[{id,text,an}], vermeidenHaken:[{id,text,an}], freitext:"" }`.
  - Pro Rolle → `rolleKonfig` (persistiert via `defaults.kiRollen` → Drive, v91): Feld `stilZusatz:""`
    (optionaler Freitext je Rolle; Checkliste bleibt global).
- **Injektion:** in `lib/ai.js` den zusammengesetzten Stil-Block an den System-Prompt anhängen (wie
  `{{firmenkontext}}` — neuer Platzhalter, z. B. `{{stilregeln}}`), positiv und „vermeide:" getrennt
  formuliert; pro-Rolle-Zusatz dort anhängen, wo der Rollen-Prompt gebaut wird.
- **UI:** Unternehmenskontext-Tab → Checkliste (vorab sinnvoll angehakt) + Freitext. KI-Rollen-Tab → je
  Rolle ein optionales „Stil-Zusatz"-Textfeld.
- **Default-Liste (Entwurf, editierbar):**
  - *Positiv:* kurze, konkrete Sätze; aktive Sprache; normale Satzzeichen; ehrliche, bodenständige
    NGO-Stimme; eine klare Aussage pro Beitrag.
  - *Vermeiden:* Gedankenstriche „—" als Stilmittel; Floskeln („In der heutigen schnelllebigen Welt",
    „Es ist wichtig zu beachten", „Tauche ein in", „Im Zeitalter von"); Emoji-Bullets / übertriebene
    Emojis; aufgeblähte Aufzählungen; anbiedernde Schluss-Fragen; Superlativ-Marketing;
    „nicht nur …, sondern auch".

## Dateikarte + Besitz (Koordination)
- `lib/ai.js` (Injektion) — Peer/Infra → abstimmen.
- `lib/kontextstore.js` + `public/kontext.js` (globaler Block, Unternehmenskontext-Tab).
- `public/store.js` (`rolleKonfig` + `stilZusatz`) + `public/ui.js` (KI-Rollen-Tab) — berührt denselben
  Einstellungs-Bereich wie v78 → Reihenfolge/Freeze mit v78 abstimmen.

## OFFEN für den Bau (klein, beim Bau entscheiden)
- Positiv/Vermeiden als zwei getrennte Checklisten oder eine mit Typ-Markierung.
- Pro Rolle nur Freitext (Vorschlag) oder auch eigene Haken.

## Stand
- [x] Bestand geprüft: kein Stil-/Negativ-Feld vorhanden; Injektionspunkt `ai.js baueSystem`/`SYSTEM_VORLAGE`;
      Rollen-Konfig Drive-gestützt (`defaults.kiRollen`, v91); Kontext Drive-gestützt.
- [x] Spec (4 Owner-Entscheide) festgehalten.
- [x] Owner-Go 06.10.2026 (zusammen mit v78 B+D).
- **Bau-Entscheide (Opus 5.5, 06.10.2026):** zwei getrennte Checklisten (Positiv / Vermeiden) + Freitext;
  pro Rolle nur Freitext (`stilZusatz`). Injektion: globaler Block `{{stilregeln}}` am Ende des
  System-Vorspanns (fehlt der Platzhalter in Bens eigener Fassung, wird der Block angehaengt) — damit in
  jedem Userkommunikations-Schritt; Schritte der Rollen Recherche/Kontextabgleich (ohne Vorspann) bekommen
  den Block an ihren Prompt gehaengt. Rollen-Zusatz haengt am Prompt jedes Schritts dieser Rolle.
- **Bauplan:** `lib/kontextstore.js` (STIL_STANDARD, lies/sammle/uebersicht, setzeStil) · `server.js`
  (PUT /api/kontext `was:"stil"`, laufePipeline) · `lib/ai.js` (Platzhalter) · `public/kontext.js` (UI global)
  · `public/store.js` + `public/ui.js` (stilZusatz je Rolle).
- [x] **Bau (06.10.2026, Opus 5.5):** wie Bauplan. Default-Liste = 5 positive + 7 Vermeidungs-Regeln (alle angehakt).
- [x] **Verify isoliert (Klon Port 4399, Fake-Ollama auf 11434 schneidet die echten Prompts mit):**
      „Superlativ-Marketing" abgehakt + Freitext gesetzt + Zusatz Userkommunikation/Recherche → nach Reload alles da
      (Server `defaults.kiRollen` traegt die Zusaetze). KI-Lauf „Recherche" (3 Schritte): Vorspann der
      userkomm-Schritte enthaelt Stil-Block (Gedankenstrich-Regel ja, Superlativ nein, Freitext ja, kein offener
      `{{stilregeln}}`), deren Prompt den Userkomm-Zusatz; Recherche-Schritt (ohne Vorspann) bekommt Stil-Block +
      Recherche-Zusatz am Prompt, keinen fremden Zusatz. 0 Konsolenfehler; Screenshots optisch geprueft.
- [ ] Im echten Board/Drive und mit echtem Modell nicht geprueft (Owner-Daten); ob das Modell die Regeln BEFOLGT,
      zeigt erst der Alltag.

## DoD (für später)
- Globaler Stil-Block (Checkliste + Freitext) im Unternehmenskontext-Tab, Drive-persistent, fließt in jeden KI-Prompt.
- Optionaler Stil-Zusatz je Rolle im KI-Rollen-Tab, Drive-persistent.
- Default-Liste vorbefüllt; Browser-Verify (Edit wirkt im KI-Prompt, überlebt Reload).
