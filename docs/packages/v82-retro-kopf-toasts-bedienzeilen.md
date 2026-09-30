# v82 — Retro-Look für Kopf, Bedienzeilen, Toasts und Detailansichten

> Owner-Auftrag 30.09.2026 (Antwort auf die gebündelte Frage): Vorlage = der bestehende
> Retro-Look (v28/v77: Creme-Fenster, vier Chrome-Farben, dicke Tinten-Kanten, harte Schatten).
> Zu ändern: Titelzeile, roher Drive-Befehl im Kopf, Fehler-Toasts, Kopfzeile insgesamt —
> „weitere Elemente in Kopf und Bedienzeilen und in Detailansichten. Alles soll im Retro-Look
> sein und nicht mehr dieser Standard-KI-Look."

**Problem:** Rundgang 30.09.2026 (1440x900): Die Kopfzeile läuft über (1507 px Inhalt bei 1440 px
Fenster) und schiebt den Beenden-Schieber aus dem Bild; der Titel „WEE Social Media Suit" bricht
auf drei Zeilen und wird oben abgeschnitten; im Kopf steht der rohe rclone-Befehl
(„cat gdrive:System (AI only)/…json"); Fehler-Toasts sind technisch formuliert
(„rclone antwortet seit 20 Sekunden nicht"), stehen oben rechts über den Kopf-Knöpfen und
stapeln sich dreifach für dieselbe Ursache; Kopf, Bedienzeilen und Detailansichten tragen an
Stellen noch den neutralen Standard-Look statt des Retro-Looks.
**Intent:** Ein durchgehend erkennbarer Retro-Look (Owner-Vorlage), ohne Information zu
verlieren — „simpel" heißt wenig Information und kurze Klickwege, nicht wenig Farbe.
**Goal:** Bei 1440x900 (hell + dunkel) passt der Kopf in eine Zeile ohne Überlauf, der Titel
steht einzeilig, der Kopf zeigt nie einen rohen Befehl, Toasts sind verständlich, verdecken
keine Kopf-Knöpfe und doppeln sich nicht, und Kopf, Bedienzeilen und Detailansichten tragen
dieselbe Retro-Formsprache wie Spalten und Karten. Ampel-Farben und Schwellen bleiben unverändert.

## Plan (je Element: bauen → Screenshot hell + dunkel → committen)

1. [x] Titel: einzeilig, nicht abgeschnitten.
2. [x] Kopf-Satz: rohe Drive-Befehle als Klartext („Liest Redaktionsplan …"), Breite begrenzt, voller Text im Tooltip.
3. [x] Kopfzeile insgesamt: kein Überlauf bei 1440 px, Beenden-Schieber sichtbar, Retro-Formen (dicke Kante, harter Schatten).
4. [x] Toasts: Retro-Karte, Klartext statt technischer Meldung, gleiche Meldungen zusammenfassen, Ort so, dass der Kopf frei bleibt.
5. [ ] Bedienzeilen (Board-Leiste, Drehtermin-Leiste, Wochenlast, Knöpfe): Rundgang, dann auf Retro ziehen.
6. [ ] Detailansichten: Rundgang, verbleibende Standard-Elemente auf Retro ziehen.

## Status

30.09.2026 — Paket angelegt nach Bestandslektüre (`docs/ui-standard.md`, v28, v77,
`style.css`-Tokens). Ursachen gelesen: Roher Befehl kommt aus `public/anschluesse.js`
`neuesteAktion()` (Text = `args.join(" ")` aus `lib/drive.js:278`); Toast-Text aus
`public/store.js:668` (`f.message` unverändert), Toast-Stil `style.css` „Toast-Notifications".

30.09.2026 — Elemente 1–3 gebaut und im Browser geprüft (1440x900, hell + dunkel): Kopf-Inhalt 1440 px = Fensterbreite (`.kopf` scrollWidth 1440, vorher 1507), Beenden-Schieber rechts bei 1426 px sichtbar, Titel einzeilig (20 px hoch), „Weitere" ungekürzt. Rohe Befehle: `klartextRclone()` in `public/anschluesse.js`, geprüft mit vier Beispielbefehlen; im Kopf erscheint „Liest Redaktionsplan aus Drive …". Retro-Formen (2-px-Tintenkante, harter 2-px-Schatten) an Ansichten-Umschalter, Anschluss-Sektionen, Knöpfen, Schieber, Plakette. Plakette gekürzt („Cache 29.09. 12:11 · noch nicht live").
Bekannt: Solange die Cache-Plakette steht, bleibt für den Kopf-Satz kein Platz (Breite 0); die Sanduhr in den Anschluss-Sektionen zeigt die Aktivität weiter, der Satz kommt zurück, sobald die Plakette verschwindet.

30.09.2026 — Element 4 (Toasts) gebaut und geprüft (hell + dunkel, echte Toasts per `hinweisToast`/`meldung` ausgelöst): unten rechts statt oben (Kopf-Knöpfe frei), Retro-Fenster mit Statusstreifen oben, dicke Kante, harter Schatten; gleiche Meldung erscheint einmal mit Zähler „×3" statt dreifach; `verstaendlich()` in `public/ui.js` macht aus „Redaktionsplan: Drive-Zugriff fehlgeschlagen (?): rclone antwortet seit 20 Sekunden nicht." den Satz „Redaktionsplan: Drive antwortet nicht (nach 20 Sekunden). Das Board arbeitet mit dem lokalen Stand weiter." Fund beim Verify: Erfolgs-Toast war leer (weißer Text auf Creme) → Füllung nach `.meldung` neu gesetzt.

## Definition of Done

Geprueft gegen: Screenshots je Element hell + dunkel bei 1440x900, `node --check`
Offen: alles (Bau steht aus)
