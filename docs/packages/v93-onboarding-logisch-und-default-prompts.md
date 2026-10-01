# v93 — Onboarding in logischer Reihenfolge, bei jedem Start bis alles da ist; neue Standard-Prompts

> Owner 01.10.2026: „Der Assistent soll sich nach Start des Boards immer in einem Pop-up öffnen, um die
> Einrichtung abzuschließen, wenn Daten fehlen — z. B. der Unternehmenskontext wie jetzt — und Schritt für
> Schritt durchleiten, bis alle Daten ordentlich da sind. Es soll immer ein Default-Prompt vorgeschlagen
> werden, den man übernehmen oder nur anpassen kann, und diese Default-Prompts sollst du an jeder einzelnen
> Stelle nochmal anpassen und auf ihre Funktion im ganzen Konstrukt optimieren, auch die Kommunikation der
> Schritte untereinander. Bei Firmen- oder Projektkontext kann es kein Default geben, der Rest ist reine
> Social-Media-Funktionalität." — Nachtrag: „Wichtig ist eine logische Abfolge, weil der Projektordner erst
> ausgewählt werden kann, nachdem z. B. Drive verbunden ist."

## PIG

**Problem:**
1. Der Assistent (v91) startet nur bei leerem, nie eingerichtetem Board und zeigt alle Schritte; Bens
   laufendes Board mit leerem Firmenkontext bekommt ihn nie zu sehen.
2. Die Reihenfolge ignoriert Abhängigkeiten: Drive-Verbindung und Ordnerwahl fehlen ganz, obwohl Name,
   Firmenkontext, Prompts und Plan in diesem Ordner gespeichert werden.
3. Die Standard-Prompts sind auf World Eden Era geschrieben (Zielgruppe, Hashtags, Dateinamen) — für ein
   anderes Board falsch.
4. Die Schritte geben ihre Ergebnisse nicht weiter (gemessen in `public/detail.js` `kiNutzlast`): Caption
   und Regieplan bekommen das Skript nicht, „Visual je Slide" bekommt die Slides nicht, nach der Recherche
   sieht kein Schritt die Fakten.

**Intent:** Ein Board ist erst „eingerichtet", wenn alles da ist — und der Weg dorthin folgt der Logik:
was etwas anderes voraussetzt, kommt vorher. Jeder KI-Schritt baut auf dem vorigen auf.

**Goal:**
- Bei jedem Start prüft das Board den Stand; fehlt etwas, öffnet sich der Assistent und zeigt nur die
  fehlenden Schritte, in Abhängigkeitsreihenfolge; Schritte, deren Voraussetzung fehlt, sind gesperrt mit Grund.
- Jeder Prompt hat einen neutralen, funktions-optimierten Vorschlag; „Vorschlag übernehmen" oder anpassen;
  eine eigene Fassung bleibt wählbar. Firmen-/Projektkontext ohne Standard.
- Jeder KI-Schritt bekommt die Ergebnisse der Schritte davor.

## Reihenfolge (Abhängigkeiten)

| # | Schritt | braucht | fehlt, wenn |
|---|---|---|---|
| 1 | Google Drive verbinden | rclone installiert | Drive nicht erreichbar |
| 2 | Projektordner wählen | 1 | kein Ordner gesetzt / nicht erreichbar |
| 3 | Board-Name | 2 | Name nie bestätigt |
| 4 | Claude anmelden | — | CLI nicht angemeldet |
| 5 | Lokale KI (Ollama) | — | eine lokal belegte Rolle hat kein installiertes Modell |
| 6 | KI-Rollen | 4/5 sinnvoll | Rollen nie im Board gespeichert |
| 7 | Firmenkontext (kein Standard) | 2 | Text leer |
| 8 | System-Prompts (15) | 2, 7 | ein Prompt nie bestätigt |
| 9 | Redaktionsplan | 2 | keine Posts pro Woche geplant |
| 10 | Google Kalender + Tasks | 2 | Anmeldung fehlt/abgelaufen (Owner: Google am Schluss) |

Schließen = für diese Sitzung; beim nächsten Start kommt der Assistent wieder, solange etwas fehlt.

## Plan (Bau)

1. [x] Prompts neu (`lib/ai.js`): System-Vorspann neutral + Kontext-Block; jede Aufgabe gleich gegliedert
   (Aufgabe · Was du bekommst · Regeln · Ausgabe). JSON-Schemas unverändert (die Editoren lesen sie).
2. [x] Kommunikation: `kiNutzlast` gibt Recherche-Fakten, Keywords, Skript und Format-Ergebnisse mit;
   `kontext()` stellt sie in den Prompt.
3. [x] Prompt-Bestätigung: `defaults.promptsBestaetigt`; `/api/prompts` liefert auch den Standard des Vorspanns.
4. [x] Drive-Einrichtung: Status (rclone da? Verbindung da? erreichbar?), neue Verbindung mit eigener client_id.
5. [x] Assistent: Prüfung je Schritt, nur Fehlendes, gesperrt mit Grund, Start bei jedem Laden.
6. [x] Verify auf der Kopie; README/INSTALL nachziehen.

## Stand

01.10.2026 — gebaut und belegt (Kopie :4399).
- **Platzhalter-Fehler seit v41 behoben:** Kettenschritte bekamen nur nurJson/kontext/vorschritt; gemessen gingen roh an
  die KI: caption 4, skript 6, ideen 8, hooks_verbal 1 Platzhalter. Jetzt 0 bei allen 14 Aufgaben (Node-Probe).
- Prompts: Vorspann + 14 Aufgaben + 3 Recherche-Schritte neu, neutral (0 Treffer „World Eden|WorldEdenEra|Oasis|WEE_"),
  JSON-Schemas unverändert. Live-Probe qwen2.5:14b, Hooks mit Test-Firmenkontext: gültiges JSON, Wortgrenze eingehalten, 14 s.
- Weitergabe: slider_visual sieht die Slides, caption sieht Skript + Fakten, regieplan sieht das Skript (Node-Probe true/true/true).
- Ordner: kein eingebauter Standard-Ordner mehr (zeigte auf Bens Ordner); „kein Ordner" = eigener Zustand, rclone wird ohne Ordner nicht aufgerufen.
- Zurücksetzen: `POST /api/board/zuruecksetzen` → root null, 7 Zwischenspeicher gelöscht, Board leer, Tokens unberührt (belegt per Dateiliste).
- Assistent: nach Zurücksetzen Start bei „Projektordner wählen", 7 Schritte gesperrt mit Grund; mit erreichbarem Ordner
  (Statusabfrage im Browser vorgetäuscht, Rest echt) Name → Rollen → Firmenkontext (leer blockiert) → 15 Prompts →
  Plan → Google („Später") → Zusammenfassung „9 ✓, Google offen". Eigene Skript-Fassung: Auswahl erscheint, „Vorschlag"
  setzt die eigene Fassung zurück (`eigen: false`), Bestätigungen in `defaults.promptsBestaetigt`.

Offen: Drive-Neuverbindung mit client_id (rclone config create) nicht live durchgespielt — hätte Bens rclone-Konfig
überschrieben; Ordnerwahl mit echtem leeren Ordner beim Umzug prüfen; Kopfzeile zeigt ohne Ordner den Standard-Plan.

## DoD

- [x] Start mit fehlendem Firmenkontext → Assistent öffnet sich, zeigt nur Fehlendes
- [x] Ohne Drive: Ordner-, Name-, Kontext-, Prompt-, Plan-Schritt gesperrt mit Grund
- [x] Jeder Prompt: Vorschlag sichtbar, übernehmen/anpassen/eigene behalten
- [x] Caption/Regieplan/Visual-je-Slide bekommen nachweislich die Vorgänger-Ergebnisse
