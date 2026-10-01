# v91 — Einrichtung (Install-Flow) und Board-Name = Drive-Hauptordner

> Owner 01.10.2026: „Wenn der Rest soweit ist, wechseln wir den Projektordner, sodass im neuen Ordner
> die ganze Struktur vom Board selbst angelegt wird und erstmal leer ist. Wir brauchen einen richtigen
> Install-Flow, sobald ein neuer Ordner ausgewählt wird: dem Board einen Namen geben (der des
> Hauptordners — diese Verknüpfung brauchen wir; der Name oben links soll der des Hauptordners von Drive
> sein). Dann in einer Art Onboarding Tasks und Kalender verbinden, die KI-Rollen verteilen (ggf. Ollama
> mit passenden Modellen installieren, bei den passenden Rollen DeepSeek oder Qwen empfehlen), die
> Claude-CLI verbinden und vor allem strukturiert, mit Erklärung und logisch zusammenhängend alle
> System-Prompts ausfüllen."

## PIG

**Problem:** Ein neuer, leerer Drive-Ordner bekommt heute nur die Ordnerstruktur. Danach steht der
Nutzer vor einem leeren Board mit Standard-Prompts ohne Firmenwissen, ungeprüften Anbindungen und
KI-Rollen, die nur im Browser gespeichert sind (zieht das Board um, sind sie weg). Oben links steht
fest „WEE Social Media Suit". Zusätzlich verwiesen die lokalen Standard-Modelle auf nicht installierte
Namen (`llama3.2`, `deepseek-r1` ohne Größe) → jeder lokale KI-Schritt scheiterte.
**Intent:** Ein neues Board ist nach einem geführten Durchlauf arbeitsfähig — ohne Terminal, ohne
Vorwissen — und trägt den Namen seines Drive-Ordners.
**Goal:** Nach dem Wechsel in einen leeren Ordner öffnet sich die Einrichtung (Schritt für Schritt,
jederzeit überspringbar, aus den Einstellungen erneut startbar). Am Ende sind Name, Google, Claude,
lokale KI, Rollen, Firmenkontext und alle System-Prompts gesetzt und in Drive gespeichert.

## Schritte der Einrichtung (je ein Bildschirm)

1. **Name** — Feld mit dem Namen des Drive-Ordners. Ändern benennt den Drive-Ordner um (eine Wahrheit).
   Oben links und im Browser-Tab steht danach dieser Name.
2. **Google Kalender + Tasks** — Zustand, Konto, Datenfluss; „Verbinden" (kehrt nach der Google-Anmeldung
   in die Einrichtung zurück) oder „Später".
3. **Claude** — „Anmelden" (Link → Code), wie in Einstellungen → Externe Dienste.
4. **Lokale KI (Ollama)** — läuft Ollama? Welche Modelle sind da? Empfehlung je Rolle mit „Laden"-Knopf
   (Download mit Fortschritt). Ohne Ollama: Installationshinweis (`winget install Ollama.Ollama`).
5. **KI-Rollen** — Vorschlag: Userkommunikation = Claude (Haiku); Recherche = DeepSeek R1 (denkt
   gründlich, braucht Zeit — passt zu Recherche); Kontextabgleich = Qwen 2.5 (schnell, genau beim
   Abgleichen). Gespeichert in Drive (`defaults.json` → `kiRollen`), Browser nur als Zwischenspeicher.
6. **Firmenkontext** — geführte Fragen (Wer seid ihr · Wofür steht ihr · Zielgruppe · Tonalität ·
   No-Gos · Handlungsaufruf) → ein Text in Unternehmenskontext.
7. **System-Prompts** — erst der System-Vorspann (gilt für jeden Text), dann jede Aufgabe in der
   Reihenfolge des Board-Ablaufs (Idee → Recherche → Hooks → Skript → Regieplan → Caption → Analyse,
   danach die Format-Aufgaben Slider/Beitrag/Story/Langform): je Aufgabe „Was sie tut · wo der Knopf
   sitzt · welche Platzhalter sie bekommt" + Textfeld mit dem Standard. „Übernehmen" oder anpassen.
8. **Redaktionsplan** — Posts pro Woche je Format (öffnet den vorhandenen Dialog).
9. **Fertig** — Zusammenfassung, was gesetzt ist und was übersprungen wurde.

## Plan (Bau)

1. [x] Lokale Modellnamen auflösen (`lib/ai.js` `loeseOllamaModell`: `deepseek-r1` → `deepseek-r1:14b`),
   Fallback `llama3.2` → `qwen2.5`.
2. [x] Board-Name: `GET /api/board/name`, `PUT` benennt den Drive-Ordner um; Kopf + Tab-Titel.
3. [x] KI-Rollen nach Drive (`defaults.kiRollen`), Laden beim Start, Schreiben bei Änderung.
4. [x] Ollama: `GET /api/ai/ollama` (läuft? Modelle), `POST /api/ai/ollama/pull` (Fortschritt als Stream).
5. [x] `public/einrichtung.js`: Assistent mit den 9 Schritten; Start nach Wechsel in einen leeren Ordner
   (`einrichtungFertig` fehlt in `defaults`) und über Einstellungen.
6. [x] Verify auf der Kopie (:4399, leerer Testordner-Zustand), Screenshots je Schritt.
7. [ ] README-Abschnitt „Einrichtung" (Paket v92).

## Stand

01.10.2026 — gebaut und auf der Kopie (:4399, leeres Board) belegt:
- Assistent öffnet sich von selbst bei leerem, nie eingerichtetem Board; alle 9 Schritte durchgeklickt
  (Name · Google „Anmeldung abgelaufen" + Verbinden · Claude „Anmeldung starten" · Ollama läuft, 4 Modelle,
  Empfehlungen deepseek-r1:14b/qwen2.5:14b „vorhanden" · Rollen-Auswahl · 6 Firmenfragen · 15 Prompts in
  Ablauf-Reihenfolge mit Platzhalter-Legende · Redaktionsplan · Abschluss).
- Abschluss-Seite prüft den echten Stand (nicht „Weiter gedrückt"): z. B. „○ Claude: nicht angemeldet".
- „Einrichtung abschließen" → `defaults.einrichtungFertig: true`, `defaults.kiRollen` gespeichert; danach kein Auto-Start mehr.
- Rückkehr an die letzte Stelle nach Neuladen (Merker) belegt; Board-Name im Kopf + Tab per Ereignis belegt.
- Name lesen live belegt („Social Media Dashbaord Test"); Umbenennen in Drive NICHT live getestet (hätte Bens Ordner umbenannt).

Offen: Umbenennen live prüfen beim Ordnerwechsel; der Standard-System-Vorspann ist WEE-spezifisch geschrieben
(für ein anderes Board im Assistenten anpassen oder einen neutralen Standard anlegen).

## DoD

- [x] Wechsel in leeren Ordner → Einrichtung öffnet sich; alle 9 Schritte durchlaufbar und überspringbar
- [ ] Name oben links = Drive-Ordnername; Umbenennen im Board benennt den Drive-Ordner um
- [x] KI-Rollen, Firmenkontext, Prompts liegen nach der Einrichtung in Drive
