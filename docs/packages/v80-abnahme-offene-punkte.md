# v80 — Abnahme: alle offenen Punkte bis „fertig"

> Owner-Auftrag 01.10.2026: „Das Board soll in wenigen Stunden fertig sein." Bestandsaufnahme,
> ein echter Funktions-Rundgang und die Recherche „formatspezifische Workflow-Bilder".
> Session: Opus 5.5, nur lesen/testen; ein kleiner Fix (Toast-Umbruch).

## PIG

**Problem:** Offene Punkte stehen verstreut in 30 Paketen (v60–v88), teils veraltet; ob das
Board als Ganzes funktioniert, hat seit v79 niemand am Stück geprüft.
**Intent:** Eine einzige, priorisierte Liste, mit der Ben in wenigen Stunden auf „fertig" kommt —
Funktionslücken zuerst, Google-Konto-Schritte ganz am Schluss.
**Goal:** Jeder offene Punkt steht hier mit Beleg, Schwere und Besitzer; der Rundgang ist belegt;
die Bild-Frage ist beantwortet.

## Wie geprüft (01.10.2026)

- Bens Board (:4321) nur lesend: `curl -k` auf alle GET-Endpunkte, ein KI-Aufruf (schreibt nichts).
- Klick-Rundgang auf isolierter Kopie (Scratchpad, :4399, Drive-Root ungültig, kein Token) —
  Regel aus Memory „Board-Tests isoliert" (Test auf :4321 hatte am 01.10. Bens Text gekostet).
- Pakete: `grep -nE '^\s*[-*] \[ \]|Offen:' docs/packages/v6*..v8*`.

## Ergebnis Recherche „formatspezifische Workflow-Bilder"

**Echte Bilder sind nirgends vorgesehen.** Vorgesehen UND gebaut sind Bild-*Beschreibungen* als Text:

| Wo | Was |
|---|---|
| `v79-format-workflows.md:24-25` (Goal) | Slider „Visual je Slide", Beitrag „Visual-Konzept", Story „Text + Visual (Bild/Video)" |
| `lib/ai.js:516` / `:540` | Task `slider_aufbau` liefert je Slide ein Feld `visual`; `slider_visual` liefert `bildprompt` (englischer Bild-Prompt) |
| `public/detail.js:1459` | Slider-Editor zeigt das Feld „Bild-Prompt" je Slide |
| `v29-ampel-schwellen-und-kopf-punkte.md:111` | einzige echte Grafik je Format: Format-Icons auf der Karte (gebaut) |

Keine Bildgenerierung, keine Vorschau-/Mockup-Bilder, keine Bild-Vorlagen je Format — weder im Plan
noch in Commits (`git log -i --grep="bild\|image\|visual\|vorschau"`). Bilder aus den Bild-Prompts
zu erzeugen wäre ein **neues Feature** (eigenes Paket, eigene Session; braucht Entscheidung lokal
vs. Dienst).

## Priorisierte Liste

### A — Funktion kaputt (zuerst)

| # | Befund | Beleg | Besitzer |
|---|---|---|---|
| A1 | **Alle KI-Knöpfe scheitern.** Claude-CLI ist ausgeloggt. | Live :4321 `POST /api/ai/stream` → `claude endete mit Code 1`; CLI direkt: „OAuth session expired and could not be refreshed" | DEINE HANDLUNG: Terminal → `claude` → `/login`, danach Board neu starten |
| A2 | Board läuft mit altem Server-Code: v87/v88-Serverteil (Abgleich auf neuesten Stand) wirkt nicht. | Server-Prozess Start 12:09, Commit v88 12:22 | DEINE HANDLUNG: `Start-Board.cmd` neu |
| A3 | Kopfzeile warnt „2 statt der angestrebten 3" — die 3 ist fest im Code, der Redaktionsplan sagt 1 Post/Woche. Dauer-Fehlwarnung. | `lib/pipeline.js:1277-1288` (`MASSE.postsProWocheMin`) vs. Redaktionsplan „Gesamt: 1 Posts / Woche" | ICH (Plan-Frequenz in `wochenlast` einspeisen) |
| A4 | Status lügt: Google und Claude stehen auf „verbunden", obwohl beide tot sind. | `/api/verbindungen/status` → `google.verbunden:true, email:""`, `claude.verbunden:true`; v86 belegt `invalid_grant` | ICH, sobald v86 freigegeben (v86: Rollen-Bezeichnungen + Go fehlen) |

### B — Fehlende Funktionen / Einstellungen

| # | Befund | Beleg | Besitzer |
|---|---|---|---|
| B1 | Kategorien/Ziele aus dem Tab „Board & Redaktionsplan" wirken noch nicht auf Board/KI/KPI; Redaktionsplan zeigt noch „Prio" statt Kategorie-%. | v78 Phase B + D offen; Rundgang Redaktionsplan: „Bildung · Prio …" | DEINE ENTSCHEIDUNG: Scheduler-Quelle (A) Sync in den Plan oder (B) boardparameter allein — Empfehlung (B) |
| B2 | KI schreibt ohne Firmenwissen: Firmenkontext ist leer. | `/api/kontext/probe` → `firmenkontext:""`; `Kontext/_global` 0 Dateien | DEINE HANDLUNG: Einstellungen → Unternehmenskontext Text eintragen (oder Dateien nach Drive `Kontext/_global`) |
| B3 | Langformat behält Kurzform-Tore (50-s-Sprechzeit, One-Screen-Hook). | v79-D „Offen/bewusst" | DEINE ENTSCHEIDUNG: eigene Langform-Regeln oder Tore für Langform aus |
| B4 | Drehtermin zuordnen schiebt die Karte auch ohne Kategorie in „Videodreh"; der Hinweistext sagt „dann ‚Weiter'". | Rundgang: „Mischkultur" (ohne Kategorie) sprang nach Videodreh; `public/detail.js:602` ruft `schiebe` ohne `sperren()` | DEINE ENTSCHEIDUNG: gewollt wie Ziehen (v54) oder Sperre prüfen |
| B5 | Lokales Standard-Modell `llama3.2` ist nicht installiert — Umschalten einer Rolle auf „Lokal" scheitert. | `/api/ai/stream` ohne Konfig → `model 'llama3.2' not found`; installiert: qwen2.5:14b, deepseek-r1:14b, gemma4:26b | ICH (Standard auf ein installiertes Modell) |
| B6 | v79 Abschluss-Prüfung fehlt; Format-Editoren nie mit echter KI gelaufen (wegen A1). | v79 `- [ ] Completeness + Fulfillment` | ICH, nach A1 |

### C — Aufräumen / kleine Entscheidungen

| # | Befund | Besitzer |
|---|---|---|
| C1 | Testkarten in Bens Board: „_selbsttest_moved_178830994335", „Test Idee 1", „KPI", „Auswertung-Tabellen" (ohne Typ), „Neue Idee" (`cmupegmhm44r8`) | DEINE ENTSCHEIDUNG: welche löschen |
| C2 | Kopf-Satz hat keinen Platz, solange die Cache-Plakette steht (v82) | DEINE ENTSCHEIDUNG |
| C3 | LinkedIn nicht verbunden — Auswertung zeigt nur Instagram (IG live ok: 99 Follower, 21 Posts) | DEINE HANDLUNG: Einstellungen → Social Media Kanäle → LinkedIn „Verbinden" |
| C4 | v87 Live-Abnahme (Abgleich-Zeit, Screenshot falsche Struktur) nach Neustart | ICH, nach A2 |

### D — Google, ganz am Schluss

| # | Schritt | Besitzer |
|---|---|---|
| D1 | Google neu verbinden (Token tot seit 09.09.2026) — Kalender + Tasks schreiben bis dahin nicht | DEINE HANDLUNG: Einstellungen → Externe Dienste → Google „Verbinden" |
| D2 | Eigene Google-client_id (v83/v84 Schritt 4) | DEINE HANDLUNG |
| D3 | v44: Firmenaccount + OAuth-App auf „Production" | DEINE HANDLUNG |

### Geschlossen durch diesen Rundgang

- v81/v82 „Fehlerfall-Darstellung ungeprüft": geprüft — Drive-/KI-Fehler kommen als Toast mit Grund
  und „Wiederholen"; Verschieben rollt bei Drive-Fehler sauber zurück.
- Toast-Überlauf: lange Meldungen ohne Leerzeichen (URLs) liefen 2920 px breit aus dem Bild →
  `public/style.css` `.meldung-text` bricht jetzt um (gemessen danach 244 px).
- v68 „Tab Board Regeln beim Peer": überholt — Ampel-Schwellen sind fest (Owner 24.09.), Tab „Ansicht" zeigt sie read-only.
- v60 Historie-Bereinigung: Owner-Entscheid „bleibt unbereinigt" (Memory Board offene Threads).

## Rundgang — was läuft (Kopie :4399)

- Board lädt (18 Karten), Karte anlegen, Kontextmenü (7 Einträge), Löschen mit Rückfrage → „Karte geloescht."
- Detailspalte: Termin-Block erscheint erst nach vollständigem „Worum geht es" (v88 wirkt);
  Slider-Karte zeigt nur „Slider aufbauen" (Schritt für Schritt).
- Redaktionsplan: Plattformen, Frequenz je Format, Max-Abstand (v79), Kategorien, Zielgewichte (Summe 100 %), Kalender-Vorschau mit Punkten.
- Einstellungen: alle 9 Tabs rendern (Darstellung, Ansicht inkl. Deadline-Vorlauf, Hinweise & Warnungen,
  KI-Rollen, Externe Dienste, Social Media Kanäle, Unternehmenskontext, System Prompts, Board & Redaktionsplan).
- Auswertung rendert; Konsole ohne Fehler.

## Nachtrag 01.10.2026 (zweite Runde, Owner-Meldungen)

- A3 (feste 3 in der Kopfzeile) → **erledigt in v90** (Woche gegen Redaktionsplan + Wochenstatistik).
- A4 (Status lügt) → **Teil 1 erledigt in v86** (Google „Anmeldung abgelaufen", Claude „nicht angemeldet", Datenfluss/Anbindung/Zustand je Dienst, Claude im Board anmelden); Kopfzeilen-Marker offen.
- B5 (llama3.2 fehlt) → **erledigt in v91** (Modellnamen aufgelöst, Fallback qwen2.5).
- Neu erledigt: v89 Upload-Termin nach einer Regel (Format + Vorlauf); v91 Einrichtung + Board-Name; v92 README/INSTALL.

## Stand

01.10.2026 — Rundgang + Recherche erledigt, Liste steht, Toast-Fix committet. Nächster Schritt: A1 (Ben).

## DoD

- [x] Recherche Workflow-Bilder mit zwei Quellen (Paket + Code) beantwortet
- [x] Alle offenen Paket-Punkte v60–v88 gesichtet und hier eingeordnet
- [x] Rundgang Board, Detail, Redaktionsplan, Einstellungen, Auswertung, KI belegt
- [ ] A1–A4 behoben und live nachgeprüft
- [ ] B1–B6 entschieden bzw. gebaut
- [ ] D1–D3 (Google) erledigt
