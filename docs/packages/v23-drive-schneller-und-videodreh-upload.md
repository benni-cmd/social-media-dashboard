# v23 — Drive-Scan beschleunigen + Rohmaterial-Upload in Videodreh

## PIG

**Problem** (Owner-Feedback 03.09.2026, Test von v22):
1. Beim Aufklappen der Google-Drive-Gruppe (egal welche Karte) dauert das Auslesen von Drive
   **richtig lang**.
2. In der Leiste **Videodreh** fehlt die Flaeche zum **Rohmaterial-Hochladen**.
3. In der Leiste **Schnitt** fehlt scheinbar der Download des Videomaterials — vermutlich, weil
   der Ordner leer ist (weil man in Videodreh nicht hochladen konnte → Kette gebrochen).

**Intent:** Die Drive-Ansicht schnell machen und die Upload/Download-Kette schliessen: in
Videodreh Rohmaterial rein, in Schnitt Rohmaterial runter (zum Schneiden) und fertiges Video
rauf. Der Drehprozess soll ohne Drive-Website vollstaendig ueber das Board laufen.

**Goal:** (a) Drive-Scan braucht statt 8 rclone-Aufrufen nur noch 1–2 (~5–10× schneller);
(b) Videodreh-Detail hat eine Drag&Drop-Zone fuer Rohmaterial (mehrere Dateien, kein
Auto-Move); (c) in Schnitt erscheinen die Rohmaterial-/Skript-Downloads sobald der Ordner
Dateien hat. UI-Abnahme per Screenshot.

---

## Bestand + Messung (03.09.2026)

`projekte.scan()` (lib/projects.js:77) im happy path = **8 serielle rclone-Aufrufe**
(rcloneKette serialisiert prozessweit):
1× `existiert` (lsjson --stat) · 3× `list` (Rohmaterial/Fertiges Video/Skript, je `lsf`) ·
**4× `link`** (`rclone link` je Ordner — setzt Freigaben, am langsamsten).

Gemessen (eigene client_id-Sicht des Servers kann abweichen, Groessenordnung gilt):
`rclone link` = **1,79 s**, `rclone lsjson -R` = **1,32 s** pro Aufruf → Scan ~10–14 s.
Der Flaschenhals ist die **Anzahl der Aufrufe** (je ~1,3–1,8 s Startup+Netz), nicht die Datenmenge.

`rclone lsjson` liefert pro Eintrag ein **ID**-Feld (verifiziert: `Eye Able` →
`1PGol7vsGXw0SP_E0zfkXVFi_sL1NLd0W`). Ein Ordner-Link ist damit
`https://drive.google.com/drive/folders/<ID>` — **ohne** `rclone link`. Fuer Bens eigene
Ordner (er ist Owner) oeffnet dieser Link direkt; die „Freigabe-fuer-alle" von `rclone link`
entfaellt bewusst (kein Teilen-Zweck im Board, nur Hinspringen).

---

## Design

### (a) Scan: 8 → 2 Aufrufe
Neue drive.js-Helfer:
- `inhaltRekursiv(pfad)` → EIN `rclone lsjson -R "gdrive:<pfad>"`; liefert alle Eintraege
  (Dirs mit ID, Files mit Path/Size). Fehlt der Ordner (Exit 3/4) → sauber „nicht vorhanden".
- `statMitId(pfad)` → EIN `rclone lsjson --stat "gdrive:<pfad>"` fuer die ID des Projektordners
  selbst (fuer den „Projektordner"-Link).
`scan()` baut daraus: Existenz, Zaehlung je Unterordner (Path-Praefix `Rohmaterial/` etc.),
Links aus IDs (`ordnerLink(id)`). Kein `list`/`link`/`count` mehr im Scan.
- **Findet-in-anderer-Phase** (`findeOrdner`, bis 7 `existiert`-Aufrufe) bleibt vorerst — greift
  nur, wenn ein Ordner von Hand verschoben wurde. Als Folgeschritt notiert.
- Optional-Folgeschritt: Hintergrund-Vorwaermen des Caches nach Board-Load.

### (b) Rohmaterial-Upload in Videodreh
- Upload-Endpunkt `POST /api/projekt/upload` bekommt Param `ziel=rohmaterial|fertig`
  (Default `fertig` = bisheriges Verhalten). `rohmaterial` → Zielordner `Rohmaterial/`,
  Endungspruefung gelockert (Rohclips, auch Bild/Audio erlaubt); `fertig` → `Fertiges Video/`,
  Video-Endung Pflicht (wie v22).
- `felderDreh` (detail.js:1018) bekommt eine Upload-Zone (mehrere Dateien nacheinander),
  **kein Auto-Move** — Rohmaterial waechst ueber die Zeit, ein Clip ist kein Phasen-Ende.
- store.js `videoHochladen` → verallgemeinern zu `dateiHochladen(k, datei, ziel)`.

### (c) Schnitt-Download
Bereits gebaut (v22, gated auf `videodreh`/`schnitt` + Ordner vorhanden). Erscheint, sobald
Rohmaterial im Ordner liegt — was (b) ermoeglicht. Nur verifizieren (Screenshot mit echtem
gefuelltem Schnitt-Ordner). Kein Neubau erwartet.

---

## Plan

1. [ ] drive.js: `inhaltRekursiv`, `statMitId`, `ordnerLink(id)`.
2. [ ] projects.js: `scan()` auf die zwei Aufrufe umstellen; Links aus IDs; Verhalten identisch
       (vorhanden/roh/final/skriptDateien/links/satz).
3. [ ] server.js: `/api/projekt/upload` Param `ziel` (rohmaterial|fertig), Endungslogik je Ziel.
4. [ ] store.js: `dateiHochladen(k, datei, ziel)` (videoHochladen bleibt als duenner Aufruf).
5. [ ] detail.js: Rohmaterial-Zone in `felderDreh` (multi, kein Move); Schnitt-Zone unveraendert.
6. [ ] Verify: Scan-Zeit vorher/nachher messen (Server-Log/Timing); Screenshots Videodreh-Zone
       + Schnitt-Download mit gefuelltem Ordner; node --check.

---

## Stand
- [x] Bestand + Messung: Scan = 8 Aufrufe (~12 s); `link` 1,79 s vs `lsjson -R` 1,32 s;
      lsjson liefert ID (verifiziert 03.09.2026).
- [x] **Gebaut (03.09.2026):** drive.js (`inhaltRekursiv`, `ordnerId`, `ordnerLink`;
      `statMitId` verworfen — `lsjson --stat` liefert KEINE ID, nachgemessen); projects.js
      (`scan` + `linksVon` auf 2 Aufrufe, Links aus IDs); server.js (`/api/projekt/upload`
      Param `ziel`); store.js (`dateiHochladen`); detail.js (generische `uploadZone`,
      `rohmaterialZone` in Videodreh, kein Auto-Move). `node --check` aller Dateien gruen.
- [x] **Scan-Zeit gemessen:** sauberer Lauf **2,6 s** (2 Aufrufe) statt ~8–12 s (8 Aufrufe) —
      Struktur-Reduktion belegt. Absolute Zeiten schwanken (2,6–52 s), weil MEINE Session ueber
      die shared-client_id laeuft (Google-Drossel); der Server nutzt eine eigene Config-Kopie
      (`lib/drive.js` Arbeitskopie) mit Bens client_id → dort ohne Drossel.
- [x] **Links verifiziert:** alle vier (`_projekt` + 3 Unterordner) tragen gueltige
      `drive.google.com/drive/folders/<ID>`-Links (Scan-Response geprueft).
- [x] **ziel-Routing verifiziert (ohne Drive-Schreibzugriff):** `rohmaterial`+`.txt` → 404 erst
      an der Karte (Endung durchgelassen); `fertig`+`.txt` → 400; unbekanntes Ziel → 400.
- [x] **UI-Abnahme per Screenshot:** Videodreh-Detail zeigt die Rohmaterial-Zone
      („Rohmaterial hierher ziehen (mehrere moeglich)"); Schnitt-Detail (Lehmboden) zeigt
      „Skript laden (1)" (aktiv) + „Rohmaterial laden (0)" (aus) + Projektordner-Link.
- [ ] **Offen — Live-Schreibtest:** echtes Rohmaterial (Videodreh) und fertiges Video (Schnitt)
      hochladen und in Drive/Auto-Move sehen. Schreibt in Bens Drive, kein Loesch-Endpunkt →
      mit Owner an einer Testkarte, dann abhaken.

## DoD
- [x] Scan strukturell von 8 auf 2 rclone-Aufrufe; sauberer Lauf 2,6 s statt ~8–12 s (gemessen).
- [x] Videodreh: Rohmaterial-Zone gebaut (mehrere Dateien, kein Auto-Move) — Screenshot + Routing.
      **Offen: Live-Schreibtest.**
- [x] Schnitt: Download-Knoepfe erscheinen bei gefuelltem Ordner (Screenshot Lehmboden:
      Skript laden aktiv, Rohmaterial laden aus weil leer) — Punkt-3-Ursache geklaert.
- [x] Links oeffnen den richtigen Ordner (alle vier ID-Links in der Scan-Response geprueft).
- [x] UI-Abnahme per Screenshot bestanden; `node --check` gruen.
