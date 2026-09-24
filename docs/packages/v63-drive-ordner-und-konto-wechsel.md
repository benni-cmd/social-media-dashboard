# v63 — Google Drive: Ordner und Konto wechseln, sauberer Startstand

> 24.09.2026. Plan nach Rueckfragen freigegeben, gebaut und live getestet.

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

## Owner-Antworten (24.09.2026)

1. Board bei Ordnerwechsel: **sichern und leeren** (je Drive-Ordner eine Sicherung, Zurueckwechseln
   stellt sie wieder her).
2. Ordner-Auswahl: **Drive-Link oder ID einfuegen**.
3. Leer-Pruefung: **leer ODER schon Board-Struktur** (= "System (AI only)" liegt darin).
4. Kontowechsel: **App startet den Login** (rclone-Browser-Anmeldung).
Zusaetzlich: kurze Anleitung in "Externe Dienste > Google Drive"; Serverstart darf dauern, danach
aber sofort der aktuelle Stand.

## Umsetzung

- `lib/drive.js`: Arbeitsordner zur Laufzeit setzbar (`setzeRoot`, persistiert in
  `data/drive-root.json`, Vorrang vor `.env` und Standard), `rcloneMitRoot` (Pruefung eines
  fremden Ordners), `ladeZugangNeu` (nach Neu-Anmeldung).
- `lib/drivesetup.js` (neu): `parseOrdnerId` (Link/ID), `pruefeOrdner` (leer/board/fremd/
  unerreichbar), `legeStrukturAn` (je Spalte ein `.phase`-Marker legt den Ordner mit an +
  `spalten.json`), `konto` (Besitzer der Board-Dateien per `rclone lsjson --metadata` — ohne
  hinterlegte Fremd-Zugangsdaten), `starteKontoWechsel` (`rclone config reconnect gdrive:`).
- `server.js`: `POST /api/drive/ordner/pruefen`, `POST /api/drive/ordner/setzen` (sichert
  Board je Root nach `data/board-sicherungen/`, leert Caches `spalten.json`/`plan.json`, hebt die
  Board-Version an, damit offene Tabs neu laden), `POST/GET /api/drive/konto/wechseln`.
  `/api/verbindungen/status` liefert jetzt Drive-Ordner + Konto, laeuft PARALLEL statt
  nacheinander (Serverstart ~20 s -> ~6,5 s gemessen), Drive-Konto wird beim Start
  vorgewaermt, Instagram-Name wird live nachgetragen (`worldedenera`).
- `public/ui.js`: eigene Drive-Zeile (Konto, Arbeitsordner mit Link, "Ordner wechseln",
  "Konto wechseln", 4-Schritt-Anleitung, Pruefen/Wechseln, Bestaetigung, danach Neuladen).

## Verify (live, 24.09.2026)

- Ordner-Pruefung: aktueller Ordner -> "board", Quatsch -> Fehlertext, unbekannte ID ->
  "nicht erreichbar" (Google 404).
- Kompletter Rundlauf gegen einen leeren Test-Unterordner: Board (24 Karten) gesichert, Board
  leer, Struktur angelegt (In Bearbeitung/{Idee,Skript,Videodreh,Schnitt,Caption,Upload},
  Verworfen, Videoauswertung, System (AI only)); Zurueckwechseln stellte 24 Karten wieder her.
- Struktur-Anlage: erst 200 s (viele Einzelaufrufe), dann 184 s (je Spalte ein Marker), jetzt ein
  einziger Baum-Upload (`rclone copy` eines lokalen Baums): **54 s** (jeder rclone-Start kostet
  hier viele Sekunden).
- Oberflaeche live: Drive-Zeile zeigt Konto (bennibi03@gmail.com), Arbeitsordner mit Link,
  Anleitung; Pruefen -> "enthaelt bereits eine Board-Struktur"; Wechseln (mit Bestaetigung) ->
  Board gesichert, Ordner gewechselt, Seite laedt neu, 24 Karten wieder da. Testordner
  (`_v63-test-*`) danach aus Drive geloescht, Root steht wieder auf dem urspruenglichen Ordner.
- Konto-Wechsel (Browser-Login) NICHT gegen das echte Konto ausgefuehrt — wuerde den
  laufenden Zugang veraendern; nur Aufruf/Flags geprueft.

## Stand

- [x] Bestand + Konto-Diagnose, Owner-Antworten, Umsetzung, Rundlauf-Test
- [x] UI-Abnahme im Browser
- [x] Commit + Push
- OFFEN: Konto-Wechsel per rclone-Browser-Login nur vorbereitet, nicht gegen dein echtes Konto
  ausgefuehrt; Google-Kalender-Zugang seit 09.09. abgelaufen (Neu-Verbinden + OAuth-App auf
  Production); rclones eingebaute Client-ID laeuft 2026 aus.
