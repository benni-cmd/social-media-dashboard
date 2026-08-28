# Work package: v9 — Aus dem Board wird eine Content-Maschine

> Owner-Auftrag 27.08.2026: das Dashboard komplett überarbeiten, die Google-Drive-Regeln richtig
> machen, die Logik dahinter prüfen, Best Practices recherchieren und einbauen, die Kacheln
> schöner und aussagekräftiger machen, Datumsfelder ergänzen, Google Kalender und Google Tasks
> planen — "mach das zu einem Programm, zu einer Content-Maschine".

**Problem:** Das Board ist ein Kanban mit KI-Knöpfen, aber keine Maschine. Zwölf Defekte sind
gemessen (Tabelle unten), der Zustand lebt doppelt (`board.json` UND Drive) und driftet
auseinander, es gibt genau EIN Datumsfeld, die Kacheln tragen kaum Information, und die
Analytics-Seite ist vom Board entkoppelt — die Schleife "was lief warum gut" schliesst sich nie.

**Intent:** Ein Werkzeug, das den Weg von der Idee zum veröffentlichten Video trägt, ohne dass
Ben den Zustand im Kopf halten muss: Drive ist die Wahrheit, jede Phase hat ein Datum und ein
Qualitätstor, jede Kachel sagt in Sätzen was ansteht, und die Zahlen nach dem Upload landen
zurück an der Karte, aus der das Video kam.

**Goal:** Ein Projekt läuft Idee → Fertig durch, wobei (1) der Drive-Ordner jederzeit gefunden
und verlinkt wird, auch nach Umbenennung, (2) jede Phase ein eigenes Datum und einen sichtbaren
Termindruck hat, (3) die Kachel ohne Öffnen zeigt, was als Nächstes fällig ist, (4) belegte
Best-Practice-Regeln als automatische Prüfung vor dem Weiterschalten laufen, (5) eine
Kalender-Ansicht neben dem Board steht, (6) die Kalender- und Tasks-Anbindung als
entscheidungsreifer Plan vorliegt.

## Befunde aus dem Audit (gemessen, 27.08.2026)

| # | Befund | Beleg |
|---|---|---|
| B1 | `/api/drive/scan` meldet einen EXISTIERENDEN Projektordner als `vorhanden:false`, solange dessen Unterordner leer sind — also genau im Zustand direkt nach dem Anlegen. Folge: Drive-Links erscheinen nie, und die Oberfläche bietet "Ordner anlegen" für einen Ordner, der längst da ist. | `curl ".../api/drive/scan?title=Huehnernahrung%20mit%20Maden&column=skript"` → `vorhanden:false`. Gegenprobe `rclone lsf "gdrive:In Bearbeitung/Skript/HuehnernahrungmitMaden" -R` → Ordner, `projekt.json` und drei Unterordner existieren. Ursache: `vorhanden = skriptDateien.length + roh + final > 0` zählt nur Dateien. |
| B2 | Das Umbenennen einer Karte verwaist den Drive-Ordner. Der Pfad wird bei JEDEM Zugriff neu aus dem aktuellen Titel abgeleitet (`projektName(card)`), statt einmal gespeichert zu werden. | `.../api/drive/scan?title=Maden%20als%20Huehnerfutter` → sucht `MadenalsHuehnerfutter`, findet nichts; der alte Ordner bleibt unauffindbar liegen. |
| B3 | `filename` in `/api/drive/save` ist ungeprüft. `../../X.md` legt in Drive echte Ordner namens `．．` an — rclone kodiert `..` als Vollbreite-Zeichen, also kein Ausbruch aus der Wurzel, aber dauerhafter Müll im Projektordner. | POST mit `filename:"../../TRAVERSAL_PROBE.md"` → Antwort `ok:true`, danach zeigt `rclone lsf -R`: `Skript und Caption/．．/．．/TRAVERSAL_PROBE.md`. Per `rclone purge` wieder aufgeräumt. |
| B4 | `/api/drive/board` und `/api/project` sind tot — im Frontend ruft sie niemand auf. Damit ist der Kernsatz der `drive-convention.md` ("der gesamte Board-Zustand ist nichts als eine Spiegelung der Drive-Struktur") nicht umgesetzt: führend ist weiterhin `board.json`. | `grep -rn "drive/board\|api/project" public/` → keine Treffer. |
| B5 | `projekt.json` wird geschrieben, aber nirgends gelesen. Ein Wiederaufbau des Boards aus Drive ist damit unmöglich. | `grep -rn "projekt.json" server.js public/` → ausschliesslich Schreibstellen. |
| B6 | Lokale und Drive-Struktur widersprechen einander, obwohl die Konvention "identisch, nur die Wurzel wird getauscht" verspricht: lokal `projects/<Serie>/EP<NN>__<Thema>/rohmaterial|final`, in Drive `<Spalte>/<Serie>_EP<NN>_<Thema>/Rohmaterial|Fertiges Video`. | `docs/drive-convention.md` gegen `projektDir()` und `driveBase()` in `server.js`. |
| B7 | Die Spalten-Reihenfolge steht vierfach im Code. Eine neue Phase erfordert vier Änderungen an vier Stellen. | `server.js` `SPALTE_ORDNER`, `public/app.js` `STUFEN`, `public/app.js` `NEXT_COLUMN`, `data/board.json`. |
| B8 | Fehler sind unsichtbar: `drive.list()` fängt jeden Fehler zu einem leeren String. Ein Drive-Ausfall sieht in der Oberfläche exakt aus wie "Ordner ist leer". | `drive.js`, `list()`: `.catch(() => "")`. |
| B9 | Die Instagram-Auswertung fragt `impressions` und `plays` ab. Beide sind seit 21.04.2025 abgeschafft, Ersatz ist `views`. Der Aufruf liefert heute einen Fehler statt Zahlen. | `server.js` `/api/stats/instagram`; Meta Graph API v22.0 Changelog. |
| B10 | LinkedIn wird über den stillgelegten Pfad `api.linkedin.com/v2/ugcPosts` angesprochen, ohne die heute verpflichtenden Header `LinkedIn-Version` und `X-Restli-Protocol-Version`. | `server.js` `/api/stats/linkedin`; LinkedIn-Versioning-Doku (unversionierte `/v2/`-Marketing-Pfade sind sunset). |
| B11 | rclone nutzt die geteilte Standard-`client_id`, die 2026 abgeschaltet wird. Danach steht die gesamte Drive-Anbindung. | rclone-Startmeldung bei jedem Aufruf: "This remote uses rclone's shared Google Drive client_id, which is being retired and will stop working during 2026." Lokal bestätigt: `rclone config show gdrive:` enthält kein `client_id`-Feld. |
| B12 | `board.json` wird als Ganzes überschrieben, ohne Schema-Prüfung und ohne Sperre. Zwei offene Tabs überschreiben sich gegenseitig. | `server.js`, `PUT /api/board`. |

## Plan

**P1 — Drive-Regeln reparieren (Fundament)**

1. [ ] Stabiler `driveName` je Karte, beim Anlegen gesetzt und mitgeführt — Umbenennen bricht nichts mehr (B2).
2. [ ] Existenz heisst: existiert der PROJEKTORDNER — nicht "liegen Dateien darin". Links werden geholt, sobald er existiert (B1).
3. [ ] Alle Pfadsegmente und Dateinamen streng validieren: kein `/`, kein `..`, kein Leerstring (B3).
4. [ ] `projekt.json` wird gelesen; `/api/drive/reconcile` gleicht Board gegen Drive ab und heilt Abweichungen, mit Knopf in der Oberfläche (B4, B5).
5. [ ] rclone-Fehler sichtbar machen: "Drive nicht erreichbar" ist ein eigener Zustand, nicht "leer" (B8).
6. [ ] Eine einzige Quelle für Phasen, Ordner und Übergänge: `lib/pipeline.js`, von Server UND Browser importiert (B7).
7. [ ] Die widersprüchliche lokale `projects/`-Struktur an die Drive-Konvention angleichen oder ersatzlos entfernen (B6).
8. [ ] Eigene rclone-`client_id` dokumentieren; die Einrichtung selbst ist Bens Handlung (B11).

**P2 — Datenmodell und Datumsfelder**

9. [ ] Karten-Schema erweitern: Content-Säule, Plattformen, Verantwortlicher, Hook, CTA, Termine je Phase (Idee, Dreh, Schnitt, Freigabe, Veröffentlichung mit Uhrzeit), Verweise auf den veröffentlichten Post.
10. [ ] Verlustfreie Migration bestehender Karten beim ersten Start.
11. [ ] Terminlogik: die Ampel zeigt den NÄCHSTEN fälligen Schritt der aktuellen Phase, nicht nur den Upload. Schreibzugriffe über einen Versionsstempel absichern (B12).

**P3 — Kacheln und Board-Optik**

12. [ ] Kachel neu: Säule, Plattformen, nächste Fälligkeit als Satz, Fortschritt über die Phasen, Drive-Verweis, Blockade-Hinweis — geprüft gegen `docs/ui-standard.md` der Werkbank.
13. [ ] Keine Unicode-Zeichen als Icons, Status als Wort plus Zeichen, Sätze statt Fragmente.

**P4 — Kalender-Ansicht**

14. [ ] Umschalter Board ↔ Kalender; Monats- und Wochenansicht mit Dreh-, Schnitt- und Veröffentlichungsterminen.

**P5 — Qualitätstore aus der Recherche**

15. [ ] Belegte Best-Practice-Regeln als automatische Prüfung vor dem Weiterschalten (Sprechzeit, Hook-Länge, Caption-Aufbau, CTA vorhanden, Hashtag-Praxis).

**P6 — KI-Ausbau**

16. [ ] Ideen-Nachschub je Content-Säule, Serien-Kontinuität aus den Geschwisterkarten, Redaktionsplan-Vorschlag für die kommenden Wochen.

**P7 — Analytics zurück an die Karte**

17. [ ] Instagram auf `views` umstellen (B9), LinkedIn auf `rest/posts` mit Versions-Headern (B10).
18. [ ] Veröffentlichte Karte mit dem Post verknüpfen; die Zahlen erscheinen an der Karte, aus der das Video kam.

**P8 — Google Kalender und Google Tasks**

19. [ ] Weg entscheiden und als Plan hinterlegen; Umsetzung erst nach Owner-Entscheid. Rechercheergebnis siehe unten.

## Rechercheergebnis: Kalender- und Tasks-Anbindung (27.08.2026)

Die Hausregel "CLI vor MCP vor Browser" wurde geprüft und trägt hier ausnahmsweise nicht bis
zum Ende. Der Grund, warum eine CLI sonst gewinnt — sie schenkt den Login — entfällt:

- **rclone kann es nicht.** 70 Backends, Google nur Drive, Photos, Cloud Storage. Kalender und
  Tasks sind keine Dateisysteme (`rclone help backends`, rclone.org/docs).
- **`gcalcli`** (Community, MIT, letzter Commit 25.10.2025, letzter Release v4.5.1 vom
  04.10.2024) verlangt laut eigener README ausdrücklich einen eigenen Calendar-API-Key.
  Ausserdem ist auf diesem Rechner kein Python installiert — es käme eine zweite Laufzeit mit
  zehn Paketen als Dauerlast dazu.
- **`gcloud`** deckt Calendar gar nicht ab; die Gruppe `gcloud tasks` verwaltet Cloud-Tasks-
  Warteschlangen, nicht Google Tasks.
- **Für Google Tasks existiert keine brauchbare CLI.** Bester Kandidat `rchore` (Rust): letzter
  Release v0.1.0 von 2021, letzter Commit Februar 2024.
- **MCP:** Google betreibt offizielle Workspace-MCP-Server, Calendar ist dabei
  (`calendarmcp.googleapis.com`), **Tasks nicht**. Auch dort ist ein eigener OAuth-Client Pflicht.

**Empfehlung: für beides die direkte HTTP-API** — Calendar API v3 und Tasks API v1, ein
gemeinsames OAuth-Modul, ein Token-Speicher, zwei dünne Clients. Node 20 bringt alles mit
(`fetch`, `node:crypto` für PKCE, `node:http` für den Loopback-Empfang), die Regel "reines
Node, keine Abhängigkeiten" bleibt unverletzt.

Der ausschlaggebende Punkt: **das Google-Cloud-Projekt muss wegen B11 ohnehin angelegt werden.**
Ein Projekt, drei APIs, ein Zustimmungsbildschirm — der Grenzaufwand für Kalender und Tasks ist
danach klein.

Wichtig für den Dauerbetrieb: der Zustimmungsbildschirm muss auf **External + "PUBLISH APP"**
stehen. Im "Testing"-Modus sterben Refresh-Tokens nach sieben Tagen; veröffentlicht und
unverifiziert (unter 100 Nutzern verlangt Google keine Prüfung) halten sie dauerhaft. Preis ist
einmalig der Warnbildschirm beim ersten Login.

Minimale Scopes: `calendar.app.created` (nur der Kalender, den die App selbst anlegt) oder
`calendar.events.owned`; für Tasks existiert kein engerer Schreib-Scope als `tasks`.

**Bens Handlungen** (interaktive Logins, kann die Software nicht übernehmen): Cloud-Projekt
anlegen · Drive-, Calendar- und Tasks-API aktivieren · Zustimmungsbildschirm External +
PUBLISH · zwei Desktop-Clients anlegen (einer für rclone, einer für das Dashboard) · rclone
umstellen mit `rclone config update gdrive client_id=… client_secret=… config_refresh_token=false`,
danach `rclone config reconnect gdrive:` · einmalig den Browser-Login des Dashboards durchlaufen.
Zugänge als Umgebungsvariablen, nie in Dateien.

## Status

**2026-08-27 abends** — Audit abgeschlossen, zwölf Befunde gemessen, Plan geschrieben,
Kalender/Tasks-Weg recherchiert und entschieden, Content-Best-Practices recherchiert und als
`docs/best-practices.md` verankert. P1 bis P7 gebaut, P8 als Plan hinterlegt.

### Was gebaut ist

Der Umbau schneidet das Programm in Module: `lib/pipeline.js` ist die eine Quelle für Phasen,
Termine, Karten-Schema und Qualitätstore und läuft unverändert im Server UND im Browser;
`lib/drive.js`, `lib/projects.js`, `lib/ai.js`, `lib/social.js` tragen je ein Thema; `server.js`
ist nur noch Wegweisung. Die Oberfläche besteht aus `store.js` (Zustand), `ui.js` (Bausteine),
`board.js`, `kalender.js`, `auswertung.js`, `detail.js`, `nachschub.js`.

Neu im Kern: sechs Termin-Meilensteine je Karte statt eines Upload-Datums samt
Rückwärtsplan-Knopf · Content-Säulen, Ziel und Plattformen je Karte · Hook zweigeteilt
(gesprochen und sichtbar) · Problem und Handlung als eigene Felder · Caption mit eigenem
125-Zeichen-Vorspann, Suchbegriffen und Hashtags JE PLATTFORM · automatische Qualitätstore, die
das Weiterschalten sperren, wenn etwas belegt Schaden anrichtet · Kalender-Ansicht ·
Auswertung, die gegen den eigenen gleitenden Median vergleicht statt gegen Blog-Benchmarks ·
Ideen-Nachschub und Redaktionsplan von der KI.

### Was gemessen ist (mit dem Befehl, der die Zahl erzeugt hat)

| Befund | Stand | Beleg |
|---|---|---|
| B1 Ordner mit leeren Unterordnern gilt als fehlend | behoben | `POST /api/drive/scan` mit `driveName:"HuehnernahrungmitMaden"` → `vorhanden:true`, vier Live-Links. Vorher `vorhanden:false`. |
| B2 Umbenennen verwaist den Ordner | behoben | Scan mit geändertem Titel, aber gesetztem `driveName` → findet `In Bearbeitung/Skript/HuehnernahrungmitMaden`. |
| B3 Dateiname ungeprüft | behoben | `POST /api/drive/save` mit `filename:"../../BOESE.md"` → 400, `"Unzulaessiger Dateiname."` Vorher `ok:true` plus Müllordner in Drive. |
| B4/B5 Drive wird nie gelesen | behoben | Ordner von Hand nach `Schnitt` verschoben → `POST /api/drive/reconcile` meldet den Satz und zieht die Karte nach; danach zurückverschoben und erneut geheilt. |
| B6 Lokale Struktur widerspricht Drive | behoben | Der lokale `projects/`-Pfad ist ersatzlos entfallen; `/api/project` und `scanProjekt` gibt es nicht mehr. |
| B7 Spaltenordnung vierfach im Code | behoben | Nur noch `PHASEN` in `lib/pipeline.js`; Browser lädt dieselbe Datei über `/lib/pipeline.js` (HTTP 200). |
| B8 Fehler sehen aus wie „leer“ | behoben | `rclone lsjson --stat` auf fehlenden Pfad → Exit 3; `drive.js` trennt 3/4 („gibt es nicht“) von allem anderen („Störung“). |
| B12 Board.json ohne Sperre | behoben | `PUT /api/board` prüft die Versionsnummer und antwortet bei Abweichung mit 409 statt zu überschreiben. |
| B9 Instagram `impressions`/`plays` | im Code behoben, **nicht gemessen** | Umgestellt auf `views,reach,saved,shares,total_interactions`. Es ist kein Konto verbunden. |
| B10 LinkedIn `/v2/ugcPosts` | im Code behoben, **nicht gemessen** | Umgestellt auf `/rest/posts` mit `LinkedIn-Version` und `X-Restli-Protocol-Version`. Kein Konto verbunden. |
| B11 rclone-client_id läuft 2026 aus | dokumentiert, **Bens Handlung** | Weg steht in `docs/drive-convention.md`. |

Board, Kalender und Detailspalte laufen im Browser ohne Konsolenfehler; die Migration hob alle
drei Bestandskarten verlustfrei auf Schema 2 und rettete dabei Hook-Text und Hook-Bild aus dem
alten Freitextfeld `freigabe`.

## Offen — Einstieg für die nächste Sitzung

1. **Optische Abnahme steht aus, und das ist ein Blocker, kein übersprungener Schritt.**
   Der Browser-Bereich wird auf Bens Rechner nicht angezeigt, deshalb schlug jeder Screenshot
   fehl („the Browser pane is not displayed"); ein verbundener Chrome existiert auch nicht
   (`list_connected_browsers` → leer). Geprüft ist bisher nur DOM und Konsole. **Zuerst in der
   nächsten Sitzung:** Browser-Bereich einblenden, Screenshot von Board, Kalender, Auswertung
   und Detailspalte, gegen die sieben Punkte in `../../docs/ui-standard.md` der Werkbank prüfen.
2. **Kein einziger KI-Aufruf ist live durchgelaufen.** Recherche, Skript, Regieplan, Caption,
   Ideen und Redaktionsplan sind gebaut und die Prompts stehen, aber `claude -p` wurde über die
   neue Oberfläche nie ausgeführt. Besonders zu prüfen: liefern `caption` und `ideen` wirklich
   das erwartete JSON-Schema, und greift der neue Fünf-Minuten-Zeitgeber.
3. **Die Recherche zu LinkedIn und Redaktionsplanung ist nie zurückgekommen.** Der Agent lief
   noch, als die Sitzung endete. Die LinkedIn-Regeln in `lib/pipeline.js` (Hashtag-Grenze 3,
   Längen-Korridor) sind deshalb **geschätzt, nicht belegt** — sie stehen bewusst noch nicht in
   `docs/best-practices.md`. Entweder neu recherchieren oder die Werte entfernen.
4. **Google Kalender und Tasks sind entschieden, aber nicht gebaut.** Weg: direkte HTTP-API für
   beide, ein gemeinsames OAuth-Modul mit Loopback und PKCE, reines Node. Bens Handlungen
   (Cloud-Projekt, drei APIs, Zustimmungsbildschirm auf External + PUBLISH, zwei Desktop-Clients)
   stehen oben im Rechercheteil und müssen vor dem Bau erledigt sein.
5. **`public/analytics.html` und `public/analytics.js` sind unangetastet** — sie tragen noch die
   alte Gestaltung und das alte Vokabular. Die Verbindungsseite gehört auf die neuen Bausteine
   aus `ui.js` umgestellt, oder ganz in die Auswertungs-Ansicht hineingezogen.

Kleinere offene Punkte: die alten Dateien unter `projects/` liegen noch auf der Platte (nicht
im Repo, `.gitignore` deckt sie) und können weg; `Diagnose.cmd`, `Setup-Claude.cmd` und
`Start-Board.cmd` erwähnen noch das „Content-Pipeline-Board".

## Definition of Done

Geprueft gegen: die zwölf Befunde einzeln nachgemessen (Tabelle oben, acht davon behoben und
belegt, zwei im Code behoben ohne verbundenes Konto, einer bei Ben) · Board, Kalender und
Detailspalte im Browser ohne Konsolenfehler · Migration aller Bestandskarten auf Schema 2 ·
Abgleich heilt eine absichtlich erzeugte Abweichung in beide Richtungen.
Offen: optische Abnahme per Screenshot · KI-Aufrufe live · LinkedIn-Recherche · Kalender- und
Tasks-Anbindung · `analytics.html` · rclone-client_id (Ben).
