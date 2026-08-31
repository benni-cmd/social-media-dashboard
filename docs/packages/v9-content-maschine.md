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

## Anschluss-Recherche 28.08.2026: CLI vs MCP vs API je Dienst

Owner-Vorgabe: weiter CLI-first, aber API oder MCP nehmen, wo CLI schwach ist; Fokus Google,
Meta, LinkedIn. Architektur-Grundsatz: **MCP verbindet Claude mit einem Dienst, nicht das
eigenständige Node-Dashboard.** Das Dashboard bindet per CLI-Shell-Aufruf (rclone, claude) oder
HTTP-API an — MCP ist für Bens interaktive Claude-Workflows, nicht für den Stats-Abruf im Server.

| Dienst | Bester Weg fürs Dashboard | Beleg / Hürde |
|---|---|---|
| Google Drive | **rclone-CLI** (läuft), eigene `client_id` nötig | Geteilte `client_id` wird 2026 abgeschaltet, Google verlangt dann Geld; eigener Client Pflicht (rclone #9580, Forum) |
| Google Kalender | **`.ics`-Feed** (reines Node, kein API/Login) zuerst; optional später offizielle Google-Calendar-MCP/-API (zwei-Wege) | Google-MCP existiert offiziell (Gmail/Drive/Calendar), braucht aber denselben Cloud-Client; ICS braucht gar keinen (Google „Per URL abonnieren") |
| Google Tasks | **streichen** — Board ist die Aufgabenliste | Kein CLI, nicht in Googles offizieller MCP, nur API |
| Meta / Instagram | **Graph-API mit Standard Access** (self-serve, eigenes Konto) | Für das EIGENE Konto kein App Review nötig (nur Tester-Rolle auf eigener Meta-App); App Review/Business-Verifizierung erst beim Bedienen fremder Konten. Kein offizielles organic-MCP (nur Meta-Ads-Connector), Community-MCPs sind Graph-API-Wrapper |
| LinkedIn | **vorerst zurückstellen** | API ist seit 2015 partner-gated: Antrag als Firma, Wochen Review, Kategorie-Zwang; kein offizielles MCP, Community entweder gated-Wrapper oder ToS-Bruch (Session-Cookie). World Eden Era gUG qualifiziert, aber es ist ein eigenes Projekt |

**Konsequenz für Punkt 4/7:** Der eine unvermeidbare Google-Cloud-Client entsteht ohnehin für
rclone (B11) und deckt später Calendar mit ab. Kalender-Ausgabe geht sofort über ICS ohne jedes
Setup. Instagram ist **leichter erreichbar als in der v9-Notiz angenommen** (Standard Access,
kein Review fürs eigene Konto). LinkedIn ist der echte Engpass — nicht gegen die API bauen, bevor
der Partner-Zugang steht.

Quellen: Google Workspace MCP (developers.google.com/workspace/guides/configure-mcp-servers) ·
rclone-Retirement (github.com/rclone/rclone #9580, rclone-Forum) · Instagram Graph API Access
(Meta-Doku, unabhängig aufbereitet Phyllo/Singh) · LinkedIn-Gating (Scalekit, usecarly, LinkedIn
Developer-Katalog) · Google-Kalender ICS-Abo (Google-Feature, OneCal/Simon Willison). Zwei
unabhängige Quellen je Aussage.

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

1. **Optische Abnahme — erledigt 28.08.2026.** Der Browser-Pane wird auf Bens Rechner weiterhin
   nicht komponiert (`computer{screenshot}` → „the Browser pane is not displayed"), ein Chrome
   ist nicht verbunden. Umgangen über **Edge headless mit Remote-Debugging, gefahren durch einen
   reinen-Node-CDP-Treiber** (`scratchpad/shot.mjs`: `Page.navigate` → View-Knöpfe klicken →
   Karte öffnen → `Page.captureScreenshot`; Node 26 bringt globales `WebSocket` mit, keine
   Abhängigkeit). Vier echte PNGs (Board, Kalender, Auswertung, Detailspalte) einzeln gegen die
   sieben Punkte in `../../docs/ui-standard.md` geprüft — alle sieben erfüllt (Sätze statt
   Fragmente, getrenntes Klassen-Vokabular, Status als Wort+Zeichen, wiederverwendete Bausteine,
   Lucide-SVGs statt Unicode-Icons, keine verbotenen Wörter). Zwei Nits ohne Blocker-Rang:
   7-Phasen-Board scrollt horizontal (normal); UI-Text mischt echte Umlaute mit ASCII-Digraphen
   („Veroeffentlichung" neben „Hühnernahrung"). **Dauerhafte Folge:** der Screenshot-Weg über
   Edge headless steht jetzt als Verify-Werkzeug bereit, unabhängig vom Pane.
2. **KI-Aufrufe live — erledigt 28.08.2026.** `claude -p` (v2.1.247, Bens Abo) lief über den
   Endpunkt `/api/ai` durch, den die Oberfläche aufruft. Vier Aufgaben gemessen: `ideen` (33 s,
   JSON `{ideen:[3× titel,warum,hook,visuell,saeule]}`, gültige Säulen-IDs), `caption` (29 s,
   JSON `{varianten,keywords,hashtags,cta}` — beide Leads ≤125 Zeichen, Hashtags gegenläufig je
   Plattform: Instagram 2, TikTok 7, CTA indirekt und einzeln), `recherche` (38 s, JSON
   `{zusammenfassung,fokus[3],hooks[3× label/verbal/visuell],frame,keywords[6]}`), `skript`
   (43 s, Text, `data:null` korrekt, `[CHUNK 1..5]`, hält die 50-Sekunden-Hausregel). Der
   Fünf-Minuten-Zeitgeber ist `runClaude`'s `timeoutMs=300000` (`lib/ai.js:242,254`) — im Code
   belegt und genutzt; die realen Läufe blieben bei 29–43 s weit darunter. Zusätzlich ein echter
   UI-Klick über Edge headless: „Ideen von der KI holen" → 6 Vorschläge live gerendert
   (`scratchpad/shot-ki.mjs`, Screenshot). **Ein offener Nit:** der `skript`-Prompt erzeugt einen
   Vorspann vor `[CHUNK 1]` („Hier ist der Sprechertext… Geschätzte Sprechzeit…"), der
   unverändert ins Skript-Feld läuft und den Sprechzeit-Zähler verfälscht — Prompt sollte „ohne
   Vorspann, direkt mit [CHUNK 1] beginnen" erzwingen.
3. **LinkedIn-Recherche — erledigt 28.08.2026.** Nachrecherchiert mit zwei unabhängigen
   Quellen. **Längen-Korridor: belegt und korrigiert.** LinkedIn selbst (Klasse A, B2B-Video-Blog:
   15–30 s Awareness, tiefere Formate „under 2 min", nie über 3 min) und Socialinsider (Klasse B:
   Engagement-Peak ~2 min, Views-Peak ~3 min) tragen gemeinsam. Neu in `pipeline.js`: `kurz [15,30]`,
   `lang [120,180]` statt der geschätzten `[30,60]/[60,120]`, dokumentiert in `best-practices.md`
   Abschnitt 7a mit der ehrlichen Spannung (LinkedIn-Anzeigen „unter 2 min" vs. Socialinsider-Peak).
   **Hashtag-Grenze 3: entfernt.** Für die optimale Hashtag-Zahl gibt es nur widersprüchliche
   Marketing-Blogs (Klasse D), kein Plattform-Wort, keinen Anbieter-Datensatz — die „3" war sogar
   ein **blockierendes** Tor. `hashtagsMax` für LinkedIn ist raus (das Tor gegen fehlendes Feld
   abgesichert, `pipeline.js:569`), die Caption-Anweisung in `ai.js` behandelt LinkedIn-Hashtags
   neutral, Ausschluss in `best-practices.md` (Abschnitt 7a + Tabelle). Node-Gegenprobe: Korridor
   neu, `hashtagsMax` undefined, Prompt ohne `undefined`, 10 LinkedIn-Hashtags erzeugen kein Tor.
4. **Google Kalender und Tasks sind entschieden, aber nicht gebaut.** Weg: direkte HTTP-API für
   beide, ein gemeinsames OAuth-Modul mit Loopback und PKCE, reines Node. Bens Handlungen
   (Cloud-Projekt, drei APIs, Zustimmungsbildschirm auf External + PUBLISH, zwei Desktop-Clients)
   stehen oben im Rechercheteil und müssen vor dem Bau erledigt sein.
5. **`analytics.html`/`.js` — erledigt 28.08.2026, in die Auswertung gezogen.** Beide Dateien
   gelöscht. Die Auswertungs-Ansicht (`auswertung.js`) rendert jetzt Instagram UND LinkedIn als
   je einen `gruppe`-Block auf `ui.js`-Bausteinen, mit Inline-Verbinden-Knopf pro Plattform
   (`/api/auth/<p>`); die alten Unicode-Glyphen (♥ 💬 ▶) und die toten `impressions`/`plays` sind
   damit weg. Der OAuth-Redirect in `server.js` kehrt zu `/?verbunden=…` bzw. `/?fehler=…` zurück,
   `app.js` liest das, zeigt eine Meldung, springt in die Auswertung und säubert die URL. Verify:
   Screenshot der neuen Ansicht gegen ui-standard (zwei Blöcke, Lucide-Icons, Sätze, kein Unicode,
   keine Konsolenfehler) · Rückkehr-Test `/?verbunden=instagram` → Meldung, Sprung, URL auf `/`.
   Offen bleibt nur der verbundene Zustand (echte Zahlen/Posts) — ungetestet mangels Konto, wie
   B9/B10.

Kleinere offene Punkte: die alten Dateien unter `projects/` liegen noch auf der Platte (nicht
im Repo, `.gitignore` deckt sie) und können weg; `Diagnose.cmd`, `Setup-Claude.cmd` und
`Start-Board.cmd` erwähnen noch das „Content-Pipeline-Board".

## P5-Nachtrag: analytics.html in die Auswertung ziehen (28.08.2026)

**PIG.** Problem: `analytics.html`/`analytics.js` sind eine verwaiste Seite mit eigenen
Inline-Styles, altem Titel und Unicode-Glyphen (♥ 💬 ▶, ui-standard Punkt 5 verletzt) und tragen
sogar noch die toten `impressions`/`plays` (B9). Intent: eine Fläche, ein System — die
Verbindung und die Zahlen gehören dorthin, wo man sie liest. Goal: `analytics.html`/`.js` sind
gelöscht; die Auswertungs-Ansicht verbindet Instagram UND LinkedIn inline (auf `ui.js`) und zeigt
beide Zahlen; der OAuth-Redirect kehrt zu `/` zurück und die App springt in die Auswertung.

**Plan.** (1) `server.js`: die sechs `/analytics.html?…`-Redirects auf `/?…` umstellen.
(2) `app.js`: nach Start `?verbunden`/`?fehler` lesen, `melde()` + Sprung in die Auswertung, URL
säubern. (3) `store.js`: `zahlenLi` in `S`. (4) `auswertung.js`: je Plattform ein `gruppe`-Block
mit Inline-Verbinden-Knopf (`/api/auth/<p>`), Instagram-Median-Logik erhalten, LinkedIn-Anzeige
ergänzt. (5) `analytics.html`/`analytics.js` löschen. Verify: Screenshot der Auswertung gegen
ui-standard (Owner-Regel).

## P9: Zwei Tabs, Kalender-Widget, Auswertung im Dashboard-Stil (28.08.2026)

**PIG.** Problem: Drei gleichrangige Tabs (Board/Kalender/Auswertung), und die Auswertung ist
eine schlichte Kachelliste statt eines lesbaren Analyse-Dashboards. Intent: eine ruhige
Oberfläche mit klarer Hierarchie — planen (Board) und auswerten (Auswertung), der Kalender als
Teil des Auswertens. Goal: (1) nur zwei Haupt-Tabs, Board und Auswertung; (2) der Kalender lebt
als Widget in der Auswertung; (3) die Auswertung trägt den Stil des Owner-Screenshots
(KPI-Kacheln mit Icon/Label/Wert, Bestperformer-Block, Kanäle-Schnappschuss) — aber im Dark Mode
der bestehenden Tokens; (4) keine erfundenen Zahlen: echte Felder wo vorhanden, Leerzustände
sonst, Trends nur bei echtem Vergleichszeitraum.

**Plan.** (1) `index.html`/`app.js`: Kalender-Tab und -Ansicht entfernen, zwei Knöpfe. (2)
`auswertung.js`: neue Struktur — KPI-Reihe (Follower, Posts, Views-Median, Weiterleitungen aus
echten IG-Feldern), Bestperformer (bester echter Beitrag + Rangliste), Kanäle-Schnappschuss
(IG + LinkedIn, real oder „nicht verbunden"), darunter der Kalender über `zeichneKalender`. (3)
`style.css`: Klassen `.kpi*`, `.bestperformer*`, `.rang*`, `.kanal*` in den vorhandenen Tokens.
Verify: Dark-Screenshot gegen ui-standard + Screenshot-Stil; für die Fülle Mock nur im
Screenshot injiziert, nicht im Code. Datenehrlichkeit: kein fabrizierter Trend/Reichweite.

**Stand: erledigt 28.08.2026.** `index.html`/`app.js` tragen nur noch zwei Tabs; `auswertung.js`
neu mit KPI-Reihe, Bestperformer (bester Beitrag nach echten Views + Rangliste, Vergleich „ggue.
Median" real), Kanäle-Schnappschuss (IG/LinkedIn real oder Inline-Verbinden) und dem Kalender als
Widget über `zeichneKalender`; `ui.js` um Auge/Senden/Pokal/Trend-Pfeile/Chat ergänzt;
`style.css` um `.kpi*`/`.bestperformer*`/`.rang*`/`.kanal*` in den Dark-Tokens. Verify: zwei
Edge-headless-Screenshots (Leerzustand echt + Mock nur im Screenshot per fetch-Stub), Tab-Zahl 2,
keine Konsolenfehler, KPI-Aggregate rechnerisch geprüft (Follower 43.200 = 24.800+18.400). Offener
Nit: „ggue." liest sich holprig — Umlaut-Vereinheitlichung app-weit offen.

## P10: Detailspalte verschlanken, Fristen als Mini-Kalender (28.08.2026)

**PIG.** Problem: Die Seitenleiste beim Öffnen einer Karte trägt zu viele Felder auf einmal
(Stamm mit sieben Feldern, sechs gestapelte Datumsfelder für die Fristen) — lange Klickwege,
unübersichtlich. Intent: schneller erfassen und schneller planen. Goal: (1) deutlich weniger
sichtbare Felder — Sekundäres unter eine Klappe; (2) alle sechs Fristen als **ein kleiner
Monats-Kalender mit farbigen Markern** je Meilenstein statt sechs Eingaben; (3) kürzere
Klickwege für den Normalfall (Upload-Datum setzen → rückwärts planen).

**Plan.** `detail.js`: (a) Stamm teilen — sichtbar nur Thema, Content-Säule, Ziel, Plattformen;
Reihe/Episode/Format, Verantwortlich, Notizen unter „Weitere Angaben" (`details`). (b) Termine
neu — Fälligkeitssatz + **Mini-Kalender** (Monatsraster mit Meilenstein-Punkten + kompakte
Legende) + Upload-Datum/Uhrzeit als Anker + „Rückwärts planen"-Knopf; die sechs Einzelfelder
unter „Termine einzeln setzen" (`details`) zum Überschreiben/Löschen. (c) Drive-Block standardmäßig
eingeklappt. `style.css`: `.mini-kalender`-Klassen, Punktfarben wie die Termin-Streifen. Verify:
Screenshot der geöffneten Karte (Dark) gegen ui-standard, Feldzahl sichtbar reduziert, keine
Konsolenfehler.

**Stand: erledigt 28.08.2026.** `detail.js`: Stamm geteilt (sichtbar Thema/Säule/Ziel/Plattformen,
Rest unter „Weitere Angaben"), Termine als Mini-Kalender (`miniKalender`, ein Punkt je Meilenstein
in den Termin-Farben) + Upload-Anker + Rückwärtsplan, Einzelfelder unter „Termine einzeln setzen",
Drive-Block eingeklappt; neuer `klappe()`-Helfer. `ui.js` um `zurueck`-Chevron ergänzt. `style.css`
um `.mini-kalender`/`.unterklappe`. Verify (Edge headless, Board per Stub für eine Karte mit
gesetzten Fristen, echte board.json unangetastet): sichtbare Felder 7 statt ~13, 6 Marker im
Kalender + 6 in der Legende, alle Klappen korrekt zu, keine Konsolenfehler.

## P11: KI-Denkprozess sichtbar + zweistufiger Fokus→Hook-Zyklus (28.08.2026)

**PIG.** Problem: (1) Die KI-Knöpfe zeigen nur einen Spinner — man weiß nicht, ob wirklich
gearbeitet wird. (2) Recherche liefert Fokus UND Hooks in einem Rutsch, die passen nur paarweise
lose zusammen; es fehlt der aufeinander aufbauende Weg. Intent: Vertrauen durch Sichtbarkeit, und
ein Zyklus, in dem jede Stufe auf der vorherigen Wahl aufbaut. Goal: (1) beim KI-Aufruf läuft der
Text der KI live sichtbar mit; (2) Recherche → Fokus wählen → **erst dann** drei Hooks GENAU zu
diesem Fokus → Hook wählen → Skript baut auf Fokus+Hook auf.

**Belegte Technik (empirisch geprüft 28.08.2026):** `claude -p --output-format stream-json
--verbose --include-partial-messages` liefert `{"type":"stream_event","event":{"type":
"content_block_delta","delta":{"type":"text_delta","text":"…"}}}` (Token-Deltas) und am Ende
`{"type":"result","result":"…"}` (finaler Text). Läuft über Bens Abo (`apiKeySource:none`).

**Plan.** (a) `lib/ai.js`: `runClaudeStream(prompt,onDelta)`; `recherche`-Prompt ohne Hooks; neue
Aufgabe `hooks(card)` mit dem gewählten Fokus; Fokus in `kontext()`, damit Skript darauf aufbaut.
(b) `server.js`: `/api/ai/stream` (POST, NDJSON) — `delta`-Zeilen live, am Ende `done` mit
`{text,data}`. (c) `store.js`: `kiStream(task,card,onEreignis)` liest den Stream per
`getReader()`. (d) `detail.js`: Live-„Denkprozess"-Panel bei jedem KI-Lauf; `auswahlFokusHook`
zweistufig (Fokus → „Hooks holen" → Hooks). (e) `nachschub.js`: Ideen/Plan ebenfalls mit
Live-Panel. (f) `style.css`: Panel-Stil. Verify: echter gestreamter Lauf (Delta sichtbar) +
UI-Screenshots der zwei Stufen, keine Konsolenfehler.

**Stand: erledigt 28.08.2026.** Gebaut: `lib/ai.js` `runClaudeStream` + `hooks`-Aufgabe + Fokus/
Hook im `kontext`, Recherche ohne Hooks; `server.js` `/api/ai/stream` (NDJSON); `store.js`
`kiStream`; `ui.js` `denkPanel`; `detail.js` `rufeKi` streamt ins Panel, `auswahlFokusHook`
zweistufig; `nachschub.js` Ideen/Plan mit Panel; `style.css` `.denk*`. Verify (Edge headless,
echte KI über `/api/ai/stream`): (1) Stream liefert Token-`delta` + `status` + `done` — Panel
füllt sich live (Auszug „{ \"zusammenfassung\": …", Ideen-Panel-Bild); (2) nach Recherche 3
Fokus-Optionen + Hinweis „zuerst Fokus", nach Fokuswahl erscheint Hooks-Knopf, nach Hooks 6
Optionen (3 Fokus + 3 zum Fokus gebaute Hooks); keine Konsolenfehler. Der gewählte Fokus wandert
über `kontext()` in Hooks UND Skript — die Stufen bauen aufeinander auf.

## P12: Geführter Skript-Loop, Verworfen-Spalte, Termin-Logik, Karten entschlacken (29.08.2026)

**PIG.** Problem: Der Skript-Weg ist wieder zu verzweigt (zu viele KI-Knöpfe/Felder), die
Termin-Logik zu granular, die Karten tragen Überflüssiges, und die Kalender-Anbindung fehlt ganz.
Intent: ein Anstoß führt von Idee bis Fertig durch, so wenig Bedienung wie möglich, Automatiken
greifen an den richtigen Stellen. Goal siehe Bausteine unten.

### Ziel-Arbeitslogik (ein Loop, Idee → Fertig)
1. **Idee, Schritt 1 — Kontext & Recherche:** die KI liest den Wiki-Kontext aus Drive
   (`Kontext/_global` + `Kontext/<Reihe>`), zieht die Website **www.World-Eden-Era.org** hinzu und
   **erweitert den Wiki** (schreibt Rechercheertrag nach `Kontext/`), damit künftige Recherche
   billiger wird. Ergebnis: **3 Fokus-Alternativen**.
2. **Schritt 2 — verbale Hooks:** nach Fokuswahl 3 rein **verbale** Hook-Alternativen.
3. **Schritt 3 — visuelle Hooks:** nach verbaler Wahl 3 **visuelle** Hook-Alternativen zum selben Fokus+Hook.
4. **Schritt 4 — Skript als Fließtext:** nach der visuellen Wahl erscheint das Skript als
   editierbarer Fließtext (rüberlesen, ändern), dann „Nach Drive speichern" → Automatiken laufen.
   Keine weiteren KI-Knöpfe, keine überzähligen Felder — nur das Wichtige.

### Bausteine
- **A. Drei-Stufen-Loop** (Fokus → verbaler Hook → visueller Hook → Skript-Fließtext). Baut den
  jetzigen zweistufigen Fluss (P11) zu dreistufig aus; `ai.js` bekommt `hooks_verbal` und
  `hooks_visuell` statt eines kombinierten `hooks`. **Baubar jetzt.**
- **B. Wiki-Erweiterung + Website:** Recherche-Schritt liest `www.World-Eden-Era.org` (server-seitig
  `fetch`) und schreibt Ertrag nach `Kontext/` in Drive (rclone). **Baubar jetzt** (Drive läuft).
- **C. Spalte „Verworfen"** ganz am Ende: geparkte Ideen; ihre Titel gehen als „nicht erneut
  vorschlagen" in die `ideen`-KI. `PHASEN` + Board + `ideen`-Prompt. **Baubar jetzt.**
- **D. Termin-Modell auf 3 Daten:** nur **Drehtag**, **Schnitt-fertig** (= Upload − 3 Tage, auto),
  **Upload** (nur Tag). Upload ist **Pflicht beim Übergang Skript → Videodreh**. Dreh braucht ≥ 7
  Tage Vorlauf vor Schnitt-fertig. Dreh bekommt **einen Zeitraum, kein exaktes Datum**; die Karte
  zeigt in Videodreh das Dreh-Datum bzw. den Zeitraum. Mini-Kalender/Einzelfelder entsprechend
  eindampfen. **Datum-Logik jetzt baubar; die Kalender-Kopplung nicht (siehe E).**
- **E. Google-Kalender-Automatik — BLOCKIERT:** Termine anlegen, den Cutter beim Schritt in den
  Schnitt einladen, und in ein Kalender-Event „Videodreh" (das erste im Dreh-Zeitraum) Titel +
  Drive-Skript-Link schreiben. **Nicht baubar, bevor das Google-Cloud-Projekt + OAuth-Kalendermodul
  stehen** (P8, nie gebaut; grep bestätigt: nur Meta/LinkedIn-OAuth im Code). Bens Handlung nötig.
- **F. Posting-Zeiten:** hart hinterlegt — **erledigt 29.08.2026** (`POSTZEITEN` in `pipeline.js`,
  best-practices.md Abschnitt 16, Klasse B Buffer+Sprout).
- **G. Karten entschlacken:** Phasenband und Phasenname-Fuß raus — **erledigt 29.08.2026**
  (`board.js`). Später zeigt der Fuß in Videodreh das Dreh-Datum/den Zeitraum (Teil von D).

### Reihenfolge (Vorschlag) & Abhängigkeiten
G ✓ · F ✓ → **C (Verworfen)** → **A+B (Drei-Stufen-Loop inkl. Wiki/Website)** → **D (Termin-Modell,
Datum-Teil)** → **E (Kalender) erst nach Bens Google-Cloud-Setup**. E ist der einzige echte Blocker;
alles andere läuft ohne externen Zugang.

**Stand 29.08.2026 — gebaut und verifiziert (Edge headless, Struktur-Test + Live-KI):**
- **A Drei-Stufen-Loop erledigt.** `ai.js` `hooks_verbal`+`hooks_visuell` (je live geprüft: verbal-only
  bzw. visuell-only, aufeinander aufbauend). `detail.js` `guidedIdee`: Recherche → Fokus → verbaler
  Hook → visueller Hook, Wahl verschwindet je Stufe, „Schritt X von 3", „Einen Schritt zurück", danach
  `schiebe` nach Skript. `skriptLoop`: drei editierbare Felder + EIN Knopf → Skript-Fließtext editierbar
  → „Nach Drive speichern und Upload planen" → **Modal** fragt Upload-Datum → setzt Termine → `schiebe`
  nach Videodreh. „Was noch offen ist" entfernt. Skript speichert als **`.txt`** (Handy-lesbar).
- **C Verworfen erledigt.** Phase in `PHASEN`, per-Karte „Diese Idee verwerfen" (+ „Zurück zu Idee holen"),
  `ideen`-Prompt schließt Verworfenes aus (verifiziert: Klick parkt Karte in Verworfen).
- **Offen:** **B** (Website `world-eden-era.org` lesen + Wiki in `Kontext/` erweitern) · **D** (Termine auf
  3 Daten reduzieren: Dreh/Schnitt=Upload−3/Upload, Upload-Pflicht bei Skript→Videodreh, ≥7 Tage
  Dreh→Schnitt, Dreh als Zeitraum, Dreh-Datum auf der Karte in Videodreh) — der Modal setzt aktuell noch
  den alten 6-Termin-Rückwärtsplan · **E** (Kalender, blockiert).

## P13: KPI-Tracking pro Video in Drive (31.08.2026)

**PIG.** Problem: Video-KPIs werden nur live abgefragt — historische Verläufe gehen verloren,
kein Vergleich über Zeit möglich. Intent: jede Messung einmal erfassen und dauerhaft archivieren,
damit Muster sichtbar werden (Evergreen vs. Einmal-Spike). Goal: Drive-Ordner
`Videoauswertung/KPI/` mit JSON-Tabelle pro Projekt. Metriken (Views, Kommentare, Interaktionen,
Watchtime falls API verfügbar) in 16 Intervallen (24h, 3d, 5d, 2W, 1M, dann monatlich bis 12M)
je Plattform je Post. Server prüft beim Start automatisch fällige Messungen.

**Gebaut:**
- `pipeline.js`: `KPI_INTERVALLE` (16 Stufen), `naechsteMessung()`, `faelligeMessungen()`,
  `kpiMessungen` im Karten-Schema.
- `lib/kpi.js` (neu): Sammelmodul — `pruefeKarten()` (welche Posts fällig sind),
  `messeInstagramPost()` (views/reach/shares/saved/interactions + `ig_reels_avg_watch_time`),
  `messeLinkedinPost()` (impressions/clicks/likes/comments — Watchtime nicht via API),
  `sammle()` (Batch), `status()` (Übersicht), Drive-Archivierung pro Projekt als JSON.
- `server.js`: `GET /api/kpi/status` (fällige + erledigte Messungen), `POST /api/kpi/collect`
  (Batch-Erfassung), Auto-Check beim Serverstart.
- Drive: Ordner `Videoauswertung/KPI/` angelegt.

**Verify:** Server antwortet auf `/api/kpi/status` (16 Intervalle, 0 Projekte — korrekt, noch
keine Posts mit `published`); `/api/kpi/collect` gibt `{gesammelt:0,bericht:[]}` (nichts fällig);
Drive-Ordner existiert (`rclone lsf` → `KPI/`). Kein Konsolenfehler. API-Messung nicht live
getestet (kein verbundenes Konto mit veröffentlichten Posts).

**Offen:** Live-Test mit echtem veröffentlichtem Post · UI-Anzeige der KPI-Historie in der
Karten-Detailansicht (noch kein Design entschieden).

## Definition of Done

Geprueft gegen: die zwölf Befunde einzeln nachgemessen (Tabelle oben, acht davon behoben und
belegt, zwei im Code behoben ohne verbundenes Konto, einer bei Ben) · Board, Kalender und
Detailspalte im Browser ohne Konsolenfehler · Migration aller Bestandskarten auf Schema 2 ·
Abgleich heilt eine absichtlich erzeugte Abweichung in beide Richtungen.
Offen: Kalender- und Tasks-Anbindung (Ben) · rclone-client_id (Ben). — Am 28.08.2026 erbracht:
optische Abnahme (Edge headless, vier PNGs gegen die sieben ui-standard-Punkte) · KI-Aufrufe
live (ideen/caption/recherche/skript über `/api/ai`, JSON-Schemata und Grenzwerte geprüft, ein
UI-Klick per Screenshot) · LinkedIn-Recherche (Korridor belegt und korrigiert, Hashtag-Grenze
entfernt, in best-practices.md verankert) · `analytics.html` in die Auswertung gezogen (Inline-
Verbinden für IG+LinkedIn, OAuth-Rückkehr auf `/`, Screenshot- und Rückkehr-Test). Offene Nits:
`skript`-Prompt-Vorspann · verbundener Stats-Zustand ungetestet mangels Konto.
