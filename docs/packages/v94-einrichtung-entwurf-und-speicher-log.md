# v94 — Einrichtung: erst Entwurf, am Ende ein Speicher-Durchgang mit Log

> Owner 01.10.2026: „Immer wenn ich im Einrichtungsassistenten auf Weiter klicke, verblasst der Button nur und
> es lädt eine Weile. Die Einstellungen sollen erst im Cache gespeichert und am Ende der Einrichtung einmal ins
> Drive geschrieben werden — mit einem kleinen Log im Assistenten, sodass man den richtigen Fortschritt sieht,
> welche Teile nacheinander gespeichert wurden, bis man anfängt zu arbeiten."

## PIG

**Problem:** Jedes „Weiter" (v93) schrieb sofort nach Drive (Prompts, Defaults, Kontext — je ein rclone-Aufruf,
mehrere Sekunden) und las danach den GANZEN Stand neu (Drive-Prüfung, Verbindungen, Kontext, Prompts aus Drive).
Sichtbar war nur ein verblassender Knopf.
**Intent:** Durch die Einrichtung klicken ohne Warten; Speichern ist ein eigener, sichtbarer Schritt.
**Goal:** Eingabe-Schritte (Name, Rollen, Firmenkontext, Prompts, Plan) schalten sofort weiter und legen in einen
Entwurf (Browser-Zwischenspeicher). Live-Schritte (Drive, Claude, Ollama, Google) prüfen nur sich selbst, mit
„Prüfe …" am Knopf. Am Ende „Speichern und loslegen": ein Durchgang nach Drive, Log je Teil mit Dauer;
Fehlgeschlagenes bleibt im Entwurf und lässt sich erneut speichern.

## Bau

1. `lib/promptstore.js`: `setze` getrennt in `anwenden` + Schreiben; neu `setzeMehrere` — alle Prompts mit EINEM Drive-Schreibvorgang.
2. `server.js`: `POST /api/einrichtung/speichern` — Name (Drive-Ordner umbenennen) → Firmenkontext → Prompts →
   Einstellungen (Rollen, Bestätigungen, `einrichtungFertig`), je Teil NDJSON `{teil, status, text, ms}`.
   `GET /api/auth/claude/status` für die schnelle Einzelprüfung.
3. `public/einrichtung.js`: Entwurf `cm-einrichtung-entwurf`; „wirksamer" Stand = gespeichert + Entwurf;
   Fußzeile „Im Entwurf: …"; `nachpruefen` je Live-Schritt; Abschluss mit Speicher-Log.
   Prompts landen nur im Entwurf, wenn sie sich vom Gespeicherten unterscheiden.
4. Schließen behält den Entwurf; beim nächsten Start öffnet der Assistent, solange ein Entwurf ungespeichert ist.

## Stand

01.10.2026 — gebaut und auf der Kopie (:4399) belegt.
- 19 Klicks auf „Weiter" durch Name, Rollen, Firmenkontext, 15 Prompts, Plan: je rund 22 ms (Messraster), **0 Netzwerkaufrufe**
  (vorher je Klick ein Drive-Schreibvorgang plus kompletter Neu-Lesevorgang).
- Fehlerweg (Kopie ohne Drive-Ordner): Log zeigt je Teil ✗ „lokal gesichert, Drive nicht erreicht (…)"; der Entwurf bleibt vollständig,
  Knopf „Fehlgeschlagenes erneut speichern".
- Erfolgsweg (Server-Antwort im Browser vorgegeben): Log füllt sich live (✓ + Dauer je Teil), Entwurf danach leer, KI-Rollen im
  Browser gesetzt, Log bleibt nach dem Neuzeichnen stehen (Screenshot).

**Zusatzbefund und Fix:** Der Firmenkontext lag NUR lokal (`data/kontext.json`), nicht in Drive — ein Umzug oder „Board
zurücksetzen" (v93) hätte ihn verloren. `lib/kontextstore.js` ist jetzt Drive-gestützt (`System (AI only)/kontext.json`,
Migration des lokalen Stands beim ersten Lesen). Außerdem meldeten alle drei Speicher (Defaults, Prompts, Kontext) einen
Drive-Fehler bisher nur ins Server-Log — im Speicher-Durchgang (`streng`) wird er jetzt gemeldet, damit das Log kein falsches ✓ zeigt.

Offen: echter Erfolgsweg gegen Drive erst mit gewähltem Ordner (beim Umzug); der Redaktionsplan-Dialog speichert weiterhin
sofort selbst (eigener Dialog), der Assistent merkt sich nur die Bestätigung.

## DoD

- [x] „Weiter" bei Eingabe-Schritten ohne Netzwerkaufruf (gemessen)
- [x] Abschluss: Log zeigt jeden Teil mit ✓/✗ und Dauer; Fehlgeschlagenes bleibt im Entwurf
- [x] Nach erfolgreichem Speichern: Entwurf leer, Stand aus Drive bestätigt
