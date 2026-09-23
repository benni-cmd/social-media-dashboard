# v62 — Einstellungen: Umbenennung + einheitliches Verbindungs-Layout

> PLAN-Paket, angelegt 23.09.2026. Noch NICHT gebaut — Owner: "sauber planen, Rueckfragen
> stellen, NIEMALS raten, dann erst umsetzen."

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

## Offene Fragen — bitte beantworten, ich rate nicht

Gestellt per AskUserQuestion (siehe Chat).

## Plan (nach Antworten, noch nicht gebaut)

1. Tab-Umbenennung "Verbindungen" → "KI-Rollen" (`ui.js:615`), ggf. Nav-Reihenfolge je nach
   Antwort zur "einheitlicheren Anordnung".
2. Eine gemeinsame "Verbindungs-Zeile"-Komponente (Name/Icon, Status-Chip, Konto-Zeile,
   Trennen-Knopf) bauen, die "Externe Dienste" UND "Social Media Kanaele" beide nutzen — statt
   der vier handgebauten Einzel-Sektionen.
3. Konto-Anzeige ergaenzen, wo technisch moeglich (Google: `kontoMail()`/`/api/gcal/konto`
   wiederverwenden; Instagram/LinkedIn: pruefen, ob der Server eine Konto-Kennung liefert;
   Drive/Claude: je nach Antwort Sonderfall oder gleiches Muster).
4. Unternehmenskontext/System Prompts: konkrete Umbauten je nach Owner-Antwort zu den
   Schmerzpunkten.
5. Verify: Screenshot jedes betroffenen Tabs vor/nach, Funktionstest Verbinden/Trennen bleibt
   intakt.
6. Commit + Push.

## Stand

- [x] Bestand geprueft (Explore-Agent: alle sechs Tabs, CSS-Geometrie, bestehende Muster) — 23.09.2026
- [ ] Owner-Antworten
- [ ] Umsetzung
- [ ] Verify
- [ ] Commit + Push

## DoD

- "KI-Rollen" ersetzt "Verbindungen" als Tab-Name.
- "Externe Dienste" und "Social Media Kanaele" nutzen dasselbe, uebersichtliche Zeilen-Muster
  (Status, Konto wo moeglich, Trennen).
- Unternehmenskontext/System Prompts adressieren die konkret genannten Schmerzpunkte.
- Modal-Groesse bleibt stabil (kein Springen zwischen Tabs).
