# Work package: v23 — Visueller Umbau (schlicht, simpel, uebersichtlich)

**Problem:** Kopfzeile, Wochenleiste und Drehtermin-Leiste zeigen staendig viel Text und viele
Knoepfe gleichzeitig; die Board-Kachel traegt Untertitel, Kategorie-Marke, Statussatz und
Drive-Fuss-Zeile auf einmal, obwohl die Detailspalte dieselben Infos beim Oeffnen ohnehin zeigt.

**Intent:** Weniger gleichzeitig sichtbare Elemente, mehr Weissraum, kuerzere Klickwege — ohne
Informationsverlust: Seltenes wandert hinter ein Menue, Kachel-Text wandert in die Detailspalte.

**Goal:** Kachel zeigt nur Titel + Plattform-Marken + Status-Punkt. Kopfzeile zeigt nur Ansichten
+ Stand staendig sichtbar, "Mit Drive abgleichen"/"Aktualisieren"/"Einstellungen" hinter einem
Menue-Knopf. Wochenleiste/Drehleiste optisch verdichtet. Sechs-Status-Woerter-System unveraendert
(nur die Kachel-Darstellung wird zum Punkt statt Chip+Satz; Tooltip/aria-label traegt weiterhin
das Wort).

## Plan

- `public/board.js` `kachel()`: Untertitel- und Fuss-Zeile (Drive) von der Kachel entfernen,
  Status-Chip+Satz durch einen farbigen Punkt mit `title`/`aria-label` = Status-Wort ersetzen.
- `public/style.css`: `.eintrag-punkt` (neu, farbig nach Status), `.eintrag` Padding verkleinert;
  `.wochenlast`/`.drehleiste` kompakter (Padding/Font); Kopf-Menue-Dropdown (`.kopf-menu*`).
- `public/index.html`: "Mit Drive abgleichen", "Aktualisieren", "Einstellungen" in ein
  Dropdown-Menue hinter einem Kebab-Knopf verschieben; Ansichten + Stand bleiben direkt sichtbar.
- `public/app.js`: Dropdown-Toggle-Logik (auf/zu, Aussenklick schliesst).
- `public/ui.js`: neues Icon `mehr` (Kebab-Punkte) fuer den Menue-Knopf.
- Detailspalte (`public/detail.js`) zeigt Untertitel (Serie/Episode/Typ unter "Weitere Angaben"),
  Kategorie (im Stamm-Block editierbar), Status+Satz (Termin-Block), Drive-Ordner (Drive-Block)
  bereits vollstaendig — keine Aenderung noetig, nur geprueft.

## Stand

- Umgesetzt: Kachel-Reduktion, Kopf-Menue, Wochenleiste/Drehleiste-Verdichtung.
- Verifiziert: Server gestartet, Screenshots Board/Auswertung/Detailspalte vor und nach dem Umbau.
- Ausgegrenzt aus Zeitgruenden: Auswertung nur leicht verdichtet (Tokensystem unveraendert,
  keine grosse Textkuerzung ueber die Kachel/Kopf/Leisten-Aenderungen hinaus).

## DoD

- [x] Kachel zeigt nur Titel + Marken + Punkt.
- [x] Kopfzeile: nur Ansichten + Stand staendig sichtbar, Rest im Menue.
- [x] Wochenleiste/Drehleiste optisch verdichtet.
- [x] Sechs Status-Woerter unveraendert, Punkt hat title/aria-label.
- [x] Screenshots vorher/nachher gemacht und verglichen.
