# v101 — Start-Tor: Einrichtungsstand zuerst lesen, Board erst danach bedienbar

> Owner 01.10.2026: „Einige Sekunden nach dem Start kommt der Assistent, aber schon davor könnte ich auf dem Board rumklicken —
> das ist falsch. Es soll erst möglich sein, wenn die Einrichtung abgeschlossen ist. Die muss nur einmal pro Board-Ordner passieren:
> eine Einrichtungsdatei, die als Erstes gelesen wird. Ist das Onboarding abgeschlossen, kann es direkt losgehen. Wenn nicht, soll
> alles laden, bis der Assistent kommt, ohne dass man zwischendurch klickt. Die nutzerbezogenen Daten (Anbindungen) liegen nur lokal —
> das muss beim Start ebenfalls als Erstes geprüft werden."

## PIG

**Problem:** Der Start-Check (v93–v96) liest den kompletten Stand (Drive-Prüfung, Verbindungen, Kontext, Prompts, Plan) — mehrere
Sekunden, in denen das Board schon bedienbar ist; danach springt der Assistent auf. Ein abgeschlossener Stand ist nirgends vermerkt,
also wird bei jedem Start alles neu geprüft.
**Intent:** Ein eingerichtetes Board startet ohne Umweg; ein unfertiges ist gesperrt, bis der Assistent da ist.
**Goal:** Zwei kleine Status-Dateien werden als Erstes gelesen — bis dahin liegt eine Sperre über dem Board.

## Zwei Dateien, zwei Geltungsbereiche

| Datei | Ort | gilt für | Schritte |
|---|---|---|---|
| `einrichtung.json` | Drive `System (AI only)/` | den Board-Ordner (alle Rechner) | Name, KI-Rollen, Firmenkontext, Prompts, Redaktionsplan |
| `einrichtung-lokal.json` | `data/` (nur dieser Rechner) | die Anbindungen dieses Rechners | Drive-Verbindung, Ordner, KI-Zugang, lokale KI, Google |

Form: `{ fertig, offen: [Schritt-IDs], aktualisiert, ordner }` — `ordner` = Drive-Ordner-ID, damit ein Ordnerwechsel die lokale Datei ungültig macht.

## Ablauf beim Start

1. Sperre über dem Board („Board wird vorbereitet …"), dann `GET /api/einrichtung/stand` (lokale Datei + Board-Datei über den Spiegel, v98).
2. Beide `fertig` (und lokale Datei passt zum Ordner) → Sperre weg, Board läuft; der Assistent kommt nicht, die lange Prüfung entfällt.
3. Sonst: Sperre bleibt, voller Stand wird gelesen, der Assistent öffnet sich; die Sperre geht erst, wenn er offen ist.
4. Ergibt die volle Prüfung, dass nichts fehlt (z. B. erstes Mal mit v101), werden die Dateien geschrieben und das Board startet.
5. Am Ende des Assistenten (Abschluss, nach dem Speichern) schreibt das Board beide Dateien mit dem echten Stand.
6. „Board zurücksetzen" löscht die lokale Datei; die Board-Datei im alten Ordner bleibt (das Board dort ist ja eingerichtet).

## Stand

01.10.2026 — gebaut und auf der Kopie (:4399) belegt.
- Ohne Status-Dateien: Sperre ab 0 ms; erste Karten nach 48 ms bereits UNTER der Sperre; 0 Momente mit sichtbaren Karten ohne
  Sperre oder Assistent (Probe alle 10 ms); Assistent nach rund 0,5 s, danach Sperre weg.
- Mit Status „fertig" (Antwort vorgegeben, die Kopie hat keinen Drive-Ordner): Tor nach 0 ms offen, genau EIN Aufruf
  (`/api/einrichtung/stand`), kein Assistent, kein voller Prüflauf.
- `POST /api/einrichtung/stand` schreibt `data/einrichtung-lokal.json` (mit Ordner-ID), GET liest sie zurück.
- Assistent schreibt beide Dateien am Abschluss (sobald nichts mehr im Entwurf liegt); „Board zurücksetzen" löscht die lokale.

Offen: Board-Datei in Drive (`System (AI only)/einrichtung.json`) erst mit echtem Ordner live prüfbar — beim nächsten Start auf
Bens Board entsteht sie, wenn die volle Prüfung nichts Offenes findet oder der Assistent abschließt.

## DoD

- [x] Vor der Entscheidung ist das Board nicht klickbar (Sperre)
- [x] Eingerichtetes Board: kein Assistent, kein voller Prüflauf beim Start
- [x] Uneingerichtetes Board: Sperre bis der Assistent offen ist
