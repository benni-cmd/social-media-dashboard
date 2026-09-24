# v63 — Google Drive: Ordner und Konto wechseln, sauberer Startstand

> PLAN-Paket, 24.09.2026. Noch NICHT gebaut — Owner: Rueckfragen stellen, nicht raten.

## PIG

**Problem:** In "Externe Dienste" laesst sich Google Drive weder trennen noch verbinden. Der
Owner will vom Test-Ordner in den echten Social-Media-Ordner wechseln (und ggf. das Google-
Konto tauschen) — genau dafuer fehlt heute jeder Weg in der App.

**Intent:** Ordner- und Kontowechsel ohne Terminal und ohne Dateien von Hand editieren; ein
frisch gewaehlter, leerer Ordner bekommt die komplette Board-Struktur automatisch.

**Goal:** In "Externe Dienste > Google Drive": Konto anzeigen/wechseln, Arbeitsordner
festlegen (leer -> Struktur wird angelegt), kurze Anleitung. Nach dem Serverstart zeigt die
Oberflaeche sofort den echten aktuellen Stand statt "…"/veralteter Werte.

## Bestand (nachgemessen, 24.09.2026)

- **Wie Drive angebunden ist:** ueber die CLI `rclone`, Remote `gdrive:` (`lib/drive.js`).
  Zugang = OAuth-Token in `rclone.conf`, per Umgebungsvariablen `RCLONE_CONFIG_GDRIVE_*`
  an rclone gereicht (Cache `data/.gdrive-env.json`). rclone meldet zudem: "shared Google Drive
  client_id is being retired and will stop working during 2026" — die Drive-Anbindung braucht
  mittelfristig ohnehin eine EIGENE Client-ID.
- **Arbeitsordner = `DRIVE_ROOT_FOLDER_ID`** (`lib/drive.js:22`), sonst ein fest eingebauter
  Standardwert; wird bei jedem rclone-Aufruf als `--drive-root-folder-id` mitgegeben. Gelesen
  wird sie EINMAL beim Modulstart aus der Umgebung -> ein Wechsel braucht heute einen
  Neustart und editieren der `.env`. In der `.env` steht der Schluessel derzeit nicht.
- **Konto wechseln** heisst technisch: rclone-Remote neu autorisieren (`rclone config
  reconnect gdrive:`, oeffnet Browser-Login). Die App hat dafuer keinen Knopf und keinen
  Endpunkt. rclone kennt KEINEN Befehl fuer die Konto-Mail (nur Speicherplatz).
- **Ordnerstruktur:** `projects.anlegen()` legt je Karte Unterordner an (`lib/projects.js:48`).
  Die Spalten-Ordner werden aus Drive gelesen (`setSpalten`, v17b) — WER sie beim allerersten
  Mal anlegt, ist noch nicht nachgewiesen (Punkt fuer Schritt 0 unten).
- **Board-Daten haengen am Drive-Ordner:** Karten in `data/board.json` verweisen auf Ordner
  im bisherigen Root. Nach einem Root-Wechsel zeigen sie ins Leere.

## Nachgemessen: die leeren Konto-Zeilen (Antwort auf "wird der Name nicht rausgegeben?")

- **Instagram: Name wird sehr wohl herausgegeben.** Live abgefragt: `username =
  worldedenera`. Er wurde beim Verbinden nur nie gespeichert (Feld leer). Loesung ohne neue
  Pflichtfelder: live abfragen bzw. beim Verbinden speichern + einmal nachtragen.
- **Google: der Zugang ist abgelaufen.** Der Kalender-Zugriff liefert HTTP 401, das
  gespeicherte Token lief am 09.09.2026 ab. Das Board zeigt trotzdem "verbunden" (Bestandsschutz
  bei unklarer Pruefung). Vermutete Ursache: OAuth-App steht auf "Testing" -> Tokens verfallen
  nach ~7 Tage (bekannter Punkt, v44). Konto-Mail bekommt man erst nach neuem Verbinden.
- Pflichtfelder braucht es dafuer nicht: die Namen kommen von den Anbietern selbst, sobald der
  Zugang gueltig ist.

## Plan (nach Antworten)

0. Klaeren: wer legt die Spalten-Ordner der Struktur beim ersten Mal an (Code lesen/testen).
1. **Root-Ordner dynamisch:** `ROOT` aus Modul-Konstante zu lesbarem/setzbarem Wert
   (persistiert in Konfig, Wirkung sofort ohne Neustart).
2. **Endpunkte:** Ordner setzen (Link/ID pruefen -> leer? -> Struktur anlegen), Konto
   wechseln (rclone-Neu-Autorisierung starten), Status inkl. aktueller Ordnername.
3. **UI Google Drive:** Zeile mit Konto/Ordner, Knoepfe "Ordner wechseln", "Konto wechseln",
   kurze Anleitung (3 Schritte).
4. **Startstand:** Status-Abrufe parallel und beim Serverstart vorwaermen, Oberflaeche
   zeigt keinen alten/leeren Zwischenstand.
5. Instagram-Name live ausliefern; Google-Reconnect-Hinweis bei abgelaufenem Token.
6. Verify (echter Wechsel Test-Ordner -> leerer Ordner, Struktur entsteht), Commit + Push.

## Stand

- [x] Bestand + Konto-Diagnose nachgemessen
- [ ] Owner-Antworten
- [ ] Umsetzung / Verify / Commit
