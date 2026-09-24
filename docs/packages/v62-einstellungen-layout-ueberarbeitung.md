# v62 — Einstellungen: Umbenennung + einheitliches Verbindungs-Layout

> Plan steht nach zwei Rueckfrage-Runden + Feasibility-Check, 23.09.2026. Wird jetzt gebaut.

## PIG

**Problem:** Owner-Auftrag 23.09.2026 (mehrere Teile):
1. Tab "Verbindung" soll "KI-Rollen" heissen, die "abzudeckenden Bereiche" einheitlicher
   angeordnet.
2. "Externe Dienste" komplett neu layouten: uebersichtliche Liste mit Drive, Kalender, Tasks,
   Claude — je Zeile Verbindungsstatus, verknuepftes Konto, Konto-entfernen-Option.
3. Dasselbe Muster fuer "Social Media APIs"/"Social Media Kanaele".
4. "Unternehmenskontext" und "System Prompts" uebersichtlicher.

**Bestand (nachgeprueft per Explore-Agent, nicht geraten — `public/ui.js:605-1311`,
`public/einstellungen.css`, `public/kontext.js`):**

- Der Tab heisst im Code **"Verbindungen"** (Plural), nicht "Verbindung" — Inhalt ist
  ausschliesslich KI-Modell-Auswahl je Rolle (userkomm/recherche/kontext,
  `store.js:515-521`). KEINERLEI Verbindungs-/OAuth-UI darin — die Umbenennung zu "KI-Rollen"
  ist also keine Kosmetik, sondern behebt einen echten Namens-Fehlgriff (wer hier eine
  Verbindung sucht, findet Modell-Dropdowns).
- Tab-Reihenfolge aktuell: Darstellung → Verbindungen → Externe Dienste → Social Media
  Kanaele → Unternehmenskontext → System Prompts.
- **"Externe Dienste"** (`ui.js:938-1104`) zeigt heute DREI Zeilen, alle unterschiedlich
  gebaut:
  - Google Kalender + Tasks (EINE gemeinsame OAuth-Verbindung, nicht getrennt!): Client-ID/
    -Secret-Felder, Speichern/Verbinden/Trennen-Knoepfe, Status-Chip. KEIN Konto-Name gezeigt.
  - Google Drive: NUR Label + Status-Chip + ein Satz ("laeuft ueber das rclone-Remote
    'gdrive'") — kein Verbinden/Trennen ueberhaupt, weil rclone ausserhalb der App
    konfiguriert wird, nicht als App-eigene OAuth-Sitzung.
  - Claude: Label + Chip + Satz, NUR "Trennen" (kein "Verbinden" — laeuft ueber
    `claude auth login` im Terminal, nicht im Browser).
  - Kein Konto-Name irgendwo in diesem Tab. Das einzige Vorbild im ganzen Code fuer "welches
    Konto ist verknuepft" ist `drehtermine.js:182-188` (`kontoMail()` -> "Kalender von:
    <email>"), das aber NICHT im Einstellungen-Fenster selbst auftaucht.
- **"Social Media Kanaele"**: im Code bereits so benannt (nicht mehr "APIs") — keine
  Umbenennung noetig, nur bestaetigen. Enthaelt aktuell Instagram + LinkedIn (`baueApiDienst()`,
  strukturell identisch zum Google-Kalender-Muster oben) — TikTok/YouTube Shorts existieren
  NICHT als eigene Verbindungs-Zeilen (nur als Inhalts-Tags an der Karte selbst).
- **Unternehmenskontext** (`kontext.js`): verschachtelt — 1 Firmen-Textfeld + Quellen-Liste,
  dann eine beliebig lange Projekte-Liste, JEDES Projekt mit eigenem Text + eigener
  Quellen-Liste + Aktiv-Haken + Loeschen. Kein flaches Formular.
- **System Prompts**: 1 System-Vorspann-Textfeld + pro KI-Knopf ein aufklappbares
  `<details>` mit einer sortierbaren Schritte-Liste (Rolle + Prompt-Text je Schritt, hoch/
  runter/entfernen). Ebenfalls verschachtelt, nicht flach.
- Es gibt AKTUELL KEINE wiederverwendbare "Verbindungs-Zeile"-Komponente — jede der vier
  Verbindungs-Sektionen (Google Kalender, Drive, Claude, Instagram, LinkedIn) ist von Hand
  im selben Muster nachgebaut, nicht als ein gemeinsamer Baustein.
- Modal-Geometrie ist bewusst fest (920px × 78vh, `einstellungen.css:22`, Kommentar: verhindert
  Groessenspruenge zwischen Tabs) — eine neue Verbindungs-Liste muesste sich darin einpassen,
  nicht die Fenstergroesse je Tab aendern.

## Owner-Antworten (23.09.2026, zwei Runden)

1. **Kalender+Tasks**: EINE gemeinsame Zeile "Google Kalender + Tasks" (nicht aufgeteilt).
2. **Drive/Claude volles Muster**: zunaechst "ja, beide voll" — nach Feasibility-Check
   (siehe unten) korrigiert: **Claude voll, Drive bleibt Sonderfall** (siehe Beleg).
3. **Kontext/Prompts-Schmerzpunkte** (alle drei): zu viel Scrollen/schlechte Gliederung +
   uneinheitlich zum Rest + zu wenig Struktur beim Bearbeiten (Projekte/Schritte sollen sich
   falten lassen statt alles offen zu zeigen).
4. **KI-Rollen-Anordnung**: die DREI Rollen-Bloecke (userkomm/recherche/kontext) sollen
   untereinander einheitlicher aussehen — das Tavily-Feld (nur bei "recherche") macht die
   Bloecke aktuell unterschiedlich hoch/aufgebaut.

## Feasibility-Check Konto-Anzeige (nachgemessen, nicht geraten)

- **Claude**: `claude auth status --json` liefert direkt `email` mit (getestet:
  `benknaute@gmx.de`). `/api/verbindungen/status` (`server.js:1161`) ruft diesen Befehl
  BEREITS auf (fuer `loggedIn`) — `email` mitzunehmen ist eine Zeile, kein neuer Aufruf.
- **Google (Kalender+Tasks)**: `gcal.kontoMail()` existiert schon (`lib/gcal.js:188`,
  genutzt von `/api/gcal/konto`) — im selben Statusaufruf mit ausliefern.
- **Instagram**: `tokens.instagram.username` wird BEREITS beim Verbinden gespeichert
  (`server.js:1019`) — nur bisher nicht in `/api/verbindungen/status` mit ausgeliefert.
- **LinkedIn**: `tokens.linkedin.orgName` wird BEREITS gespeichert (`server.js:1318`) — es
  ist ein SEITEN-/Organisationsname, keine persoenliche Mail (LinkedIn haengt hier an einer
  Unternehmensseite, nicht an einer Person) — Anzeige-Label entsprechend "Seite: …", nicht
  "Konto: …".
- **Drive/rclone**: KEIN eingebauter Befehl liefert die Konto-Mail (nur Speicherplatz-Zahlen
  via `rclone about`). Eine Mail zu zeigen braeuchte einen neuen Aufruf an die Google-Drive-
  API (`about?fields=user`) mit dem rclone-intern verwalteten Token — Owner-Entscheidung:
  bleibt Sonderfall (Status-Chip + erklaerender Satz, kein Konto, kein Trennen — Drive hat
  heute ohnehin keinen Trennen-Knopf, das war nie Teil des Auftrags).

## Plan (konkret, wird jetzt umgesetzt)

1. **`server.js`** `/api/verbindungen/status`: `email` bei `claude` und `google` ergaenzen
   (bestehende Aufrufe erweitern), `konto`/`seite` bei `instagram`/`linkedin` aus den bereits
   gespeicherten Tokens ergaenzen. Kein neuer Endpunkt, keine neue Bibliothek.
2. **`ui.js:615`**: Tab "Verbindungen" → "KI-Rollen".
3. **Neue Verbindungs-Zeile-Komponente** in `ui.js` (ersetzt die vier handgebauten
   `.einst-abschnitt`-Sektionen + `baueApiDienst()`): Name, Status-Chip, Konto-/Seiten-Zeile
   (wenn vorhanden), Knopf-Reihe (Speichern+Verbinden ODER Trennen, wie bisher). Wird von
   "Externe Dienste" UND "Social Media Kanaele" genutzt.
4. **"Externe Dienste"**: Reihenfolge Drive → Google Kalender + Tasks → Claude (Owner-
   Reihenfolge aus dem Auftrag). Drive ohne Konto-Zeile (Sonderfall), Claude MIT Konto-Zeile.
5. **"Social Media Kanaele"**: Instagram + LinkedIn im selben Zeilen-Muster, mit Konto-/
   Seiten-Zeile.
6. **"KI-Rollen"**: die drei Rollen-Bloecke bekommen eine einheitliche Grundstruktur (fester
   Slot fuer Provider/Modell, ein optionaler "Extra"-Slot fuer das Tavily-Feld bei
   "recherche" statt formlosem Anhaengsel) — gleiche Hoehe/gleicher Aufbau, wo inhaltlich
   moeglich.
7. **Unternehmenskontext + System Prompts**: Projekte bzw. Schritt-Gruppen standardmaessig
   gefaltet (nur Titel/Kurzinfo sichtbar, aufklappbar), visuelle Angleichung an das neue
   Zeilen-/Abschnitts-Muster der anderen Tabs (Abstaende, Labels, Trenner).
8. Verify: Screenshot jedes Tabs vor/nach, Funktionstest Verbinden/Trennen bleibt intakt,
   Konto-Zeilen zeigen echte Werte (nicht erfunden).
9. Commit + Push.

## Stand

- [x] Bestand geprueft (Explore-Agent: alle sechs Tabs, CSS-Geometrie, bestehende Muster) — 23.09.2026
- [x] Owner-Antworten (zwei Rueckfrage-Runden)
- [x] Feasibility-Check Konto-Anzeige (claude auth status, rclone-Befehle getestet)
- [x] Umsetzung Teil 1: Server-Konto-Felder, Tab-Umbenennung KI-Rollen, Rollen-Kacheln, Verbindungs-Zeile fuer Externe Dienste + Social Media Kanaele
- [x] Verify Teil 1 (Browser: Externe Dienste, Social Media Kanaele, KI-Rollen)
- [ ] Umsetzung Teil 2: Unternehmenskontext + System Prompts (falten, angleichen) — OFFEN
- [ ] Commit + Push Teil 2

## DoD

- "KI-Rollen" ersetzt "Verbindungen" als Tab-Name.
- "Externe Dienste" und "Social Media Kanaele" nutzen dasselbe, uebersichtliche Zeilen-Muster
  (Status, Konto wo moeglich, Trennen).
- Unternehmenskontext/System Prompts adressieren die konkret genannten Schmerzpunkte.
- Modal-Groesse bleibt stabil (kein Springen zwischen Tabs).

## Stand Teil 1 (24.09.2026)

- Live gemessen: `/api/verbindungen/status` liefert `claude.email` = echte Mail. `google.email`
  und `instagram.konto` sind bei Ben LEER (Kalender-Mail-Abruf liefert nichts, Instagram-Token
  hat keinen gespeicherten Username) — die Konto-Zeile blendet sich dann aus statt etwas zu
  erfinden. Ursache fuer Google/Instagram noch nicht untersucht.
- Drive: nur Status-Chip + Erklaersatz, KEIN Trennen-Knopf (es gibt keinen Drive-Trennen-
  Endpunkt; die Rueckfrage-Option "Status + Trennen" war ungenau formuliert — nicht gebaut).
- Verbunden -> Einrichtung klappt weg (Einrichten-Knopf holt sie zurueck); nicht verbunden ->
  Formular offen.
