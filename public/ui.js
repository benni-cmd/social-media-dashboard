// Bausteine der Oberflaeche. Wer eine Seite baut, nimmt diese — nicht neue.
//
// Geprueft gegen docs/ui-standard.md der Werkbank:
//   Punkt 3  Sechs Status-Woerter, nie Farbe allein — immer ueber statusChip(code).
//   Punkt 5  Kein Unicode-Symbol statt Icon. Alle Zeichen sind Lucide-SVGs aus ICONS.

// KI-Rollen-Konfig kommt aus store.js (eine Wahrheit): ui.js importiert statisch, store.js
// zieht ui.js nur dynamisch (store.js:130) — deshalb kein Zyklus.
import { ROLLEN, ROLLEN_META, rolleKonfig, setzeRolleKonfig, stellschraube, setzeWorkflow, zeichne } from "./store.js";
import { KATALOG, istAn, setzeAn } from "/lib/kartenhinweise.js";
import { verstaendlicherFehler } from "/lib/fehlertext.js";

// --- Icons (Lucide, 24x24, Strich) ---------------------------------------

export const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  warnung:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  kreis: '<circle cx="12" cy="12" r="10"/>',
  achtung:
    '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  frage:
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  minus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
  kalender:
    '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/>',
  raster:
    '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  saeulen: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  neuladen:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  ordner:
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minusStrich: '<path d="M5 12h14"/>', // v102: Zoom-Knopf
  schliessen: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  uhr: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  extern:
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  funken:
    '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  ziel: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  weiter: '<path d="m9 18 6-6-6-6"/>',
  zurueck: '<path d="m15 18-6-6 6-6"/>',
  // Lucide "arrow-left-from-line" (v57): Strich rechts, Pfeil zieht nach links davon weg —
  // fuer den Detailspalten-Breiten-Shortcut (zieht auf maximale Breite).
  maximieren: '<path d="m9 6-6 6 6 6"/><path d="M3 12h14"/><path d="M21 19V5"/>',
  video: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/>',
  raute: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/>',
  personen:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  papier:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/>',
  muell:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  auge: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  senden: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
  pokal:
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  "pfeil-hoch": '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  "pfeil-runter": '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  // Echtes Zahnrad (Lucide „settings": Zahnkranz + Mittelkreis) — die frühere Fassung
  // (Mittelkreis + 8 gerade Strahlen) las sich als Sonne, nicht als Zahnrad (v40).
  zahnrad:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  // Stilisiertes Drive-Zeichen (v71): Sechseck wie das Drive-Logo mit den drei Balken als Linien.
  drive: '<path d="M8.5 3h7L22 14.5l-3.5 6h-13L2 14.5Z"/><path d="M15.5 3 9 14.5"/><path d="M9 14.5h13"/><path d="m9 14.5-3.5 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  mehr: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  // Format-Symbole der Kachel (v29): ersetzen die Plattform-Text-Marken — auf den ersten
  // Blick zaehlt das Format (Reel/Bild/Story/Longform), nicht die Plattform.
  clip: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  bild: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  story:
    '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
  // Cache-Stand (v81): Uhr mit Rueckwaerts-Pfeil = aelterer, noch nicht mit Drive abgeglichener Stand.
  cache: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  // Sanduhr (v29, Owner-Vorlage: rotierende Sanduhr statt Punkte, solange die KI arbeitet).
  sanduhr:
    '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
};

export function icon(name, klasse = "") {
  const pfad = ICONS[name] || ICONS.kreis;
  return (
    `<svg class="icon ${klasse}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfad}</svg>`
  );
}

// Kleine Drive-Marke (v71): zeigt, dass diese Daten aus einem Drive-Abgleich kommen bzw. dort
// liegen. Nicht auf den Board-Karten, sondern in Einstellungen, Kopf der Detailspalte, Knoepfen.
export function driveMarke(titel = "Kommt aus Google Drive", pfad = null) {
  // Mit `pfad` ist auch das Symbol selbst ein Link auf den Ordner (Klick-Handler unten).
  const link = pfad == null ? "" : ` data-drive-pfad="${escape(pfad)}" role="link" tabindex="0"`;
  return `<span class="drive-marke${pfad == null ? "" : " drive-klick"}"${link} title="${escape(titel)}" aria-label="${escape(titel)}">${icon("drive")}</span>`;
}

// Drive-Ort (v72): Marke + Ordnername als Link direkt dahinter. Ein Klick loest den Ordner-Link
// beim Server auf (/api/drive/ordner-link) und oeffnet ihn in einem neuen Tab. `pfad` relativ zum
// Arbeitsordner, "" = der Arbeitsordner selbst.
export function driveOrt(pfad, label, titel = "In Google Drive oeffnen") {
  return `<a class="drive-ort" href="#" data-drive-pfad="${escape(pfad)}" title="${escape(titel)}">` +
    `<span class="drive-marke">${icon("drive")}</span><span class="drive-ort-name">${escape(label)}</span></a>`;
}

// Eine Zeile "Liegt in: <Drive-Ort>" fuer die Kopfbereiche der Einstellungen.
export function driveOrtZeile(vorher, pfad, label) {
  const p = document.createElement("p");
  p.className = "einst-provider-sub drive-ort-zeile";
  p.innerHTML = `${escape(vorher)} ${driveOrt(pfad, label)}`;
  return p;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", async (e) => {
    const a = e.target.closest && e.target.closest("[data-drive-pfad]");
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    // Fenster sofort oeffnen (Popup-Blocker), Ziel folgt, sobald der Link aufgeloest ist.
    const w = window.open("about:blank", "_blank");
    try {
      const res = await fetch("/api/drive/ordner-link?pfad=" + encodeURIComponent(a.dataset.drivePfad || ""));
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j.error || `HTTP ${res.status}`);
      if (w) w.location.href = j.url; else window.location.href = j.url;
    } catch (err) {
      if (w) w.close();
      meldung(`Drive-Ordner nicht geoeffnet: ${err.message}`, "fehler");
    }
  }, true);
}

// --- Status: sechs Woerter, nie Farbe allein -----------------------------

export const STATUS = {
  ok: { wort: "ok", icon: "check" },
  hinweis: { wort: "hinweis", icon: "warnung" },
  fehlt: { wort: "fehlt", icon: "kreis" },
  befund: { wort: "befund", icon: "achtung" },
  unlesbar: { wort: "unlesbar", icon: "frage" },
  entfaellt: { wort: "entfaellt", icon: "minus" },
};

export function statusChip(code) {
  const s = STATUS[code] || STATUS.unlesbar;
  return `<span class="chip chip-${code}">${icon(s.icon)}<span>${s.wort}</span></span>`;
}

// --- Bloecke --------------------------------------------------------------

// Benannter Block mit Anzahl. Bewusst ohne eigene Ueberschriften-Ebene.
// `onToggle(offen)` (v77): meldet jeden Auf-/Zuklapp-Wechsel zurueck — der Aufrufer (detail.js)
// merkt sich den Zustand je Karte, sonst faellt jeder Abschnitt bei jedem Redraw auf `offen`
// zurueck (Owner 28.09.2026: "aufklappbar" hielt bisher nicht ueber eine Aenderung hinweg).
export function gruppe(titel, anzahl, offen = true, onToggle = null) {
  const el = document.createElement("details");
  el.className = "gruppe";
  el.open = offen;
  el.innerHTML =
    `<summary class="gruppe-kopf"><span class="gruppe-titel">${escape(titel)}</span>` +
    (anzahl != null ? `<span class="gruppe-anzahl">${anzahl}</span>` : "") +
    `</summary>`;
  if (onToggle) el.addEventListener("toggle", () => onToggle(el.open));
  return el;
}

// Leerzustand: Zeichen, Titel, Satz, Handlung.
export function leer({ zeichen = "kreis", titel, satz, handlung } = {}) {
  const el = document.createElement("div");
  el.className = "leerzustand";
  el.innerHTML =
    `<span class="leerzustand-zeichen">${icon(zeichen)}</span>` +
    `<span class="leerzustand-titel">${escape(titel || "")}</span>` +
    `<span class="leerzustand-satz">${escape(satz || "")}</span>`;
  if (handlung) el.appendChild(handlung);
  return el;
}

// Der eine echte Schliessen-Knopf fuer einen ".modal-frage"-Kopf (v76, Owner 28.09.2026): vorher
// gab es dort nur eine dekorative halbtransparente Flaeche (`.modal-frage::after`), die wie ein
// Schliessen-Knopf aussah, aber nirgends einen Klick annahm — ausser im Redaktionsplan-Popup, das
// sich seinen eigenen echten Knopf an dieselbe Stelle gebaut hatte. Jetzt EIN Baustein fuer alle
// Modale mit ".modal-frage"-Kopf, damit „sieht klickbar aus" ueberall auch wirklich klickbar ist.
export function modalX(klick, titel = "Schliessen") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "modal-x";
  b.title = titel;
  b.setAttribute("aria-label", titel);
  b.innerHTML = icon("schliessen");
  b.addEventListener("click", klick);
  return b;
}

// Zeile mit Status und Satz — der Grundbaustein jeder Befundliste.
export function befundZeile(status, satz, quelle) {
  const li = document.createElement("li");
  li.className = "befund";
  li.innerHTML =
    statusChip(status) +
    `<span class="befund-satz">${escape(satz)}</span>` +
    (quelle ? `<span class="befund-quelle">${escape(quelle)}</span>` : "");
  return li;
}

// --- Kleines Klapp-Menue an einem Icon-Knopf --------------------------------
//
// v80 (Owner 28.09.2026): der Abschluss-Bereich einer Karte zeigte "Weiter" (Haupt-Pille),
// "Verwerfen" (graue Flaeche) und "Loeschen" (nackter roter Text) als drei gleich praesente
// Zeilen — Owner-Entscheidung: nur der Hauptweg bleibt prominent, die Nebenwege (verwerfen/
// loeschen) wandern hinter einen kleinen Menue-Knopf. Bewusst ein einfacher eigener Baustein
// statt kontextmenu.js wiederzuverwenden — das ist auf die Rechtsklick-Positionierung an einer
// Board-Kachel zugeschnitten, hier reicht ein Dropdown direkt am Knopf.
export function mehrMenu(eintraege) {
  const wrap = document.createElement("div");
  wrap.className = "mehr-menu";

  const knopfEl = document.createElement("button");
  knopfEl.type = "button";
  knopfEl.className = "mehr-menu-knopf";
  knopfEl.innerHTML = icon("mehr");
  knopfEl.title = "Weitere Aktionen";
  knopfEl.setAttribute("aria-label", "Weitere Aktionen");

  const liste = document.createElement("div");
  liste.className = "mehr-menu-liste";
  liste.hidden = true;
  for (const e of eintraege) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "mehr-menu-item" + (e.gefahr ? " mehr-menu-gefahr" : "");
    item.textContent = e.text;
    if (e.titel) item.title = e.titel;
    item.addEventListener("click", (ev) => {
      ev.stopPropagation();
      schliessen();
      e.klick();
    });
    liste.appendChild(item);
  }

  const aussen = (ev) => {
    if (!wrap.contains(ev.target)) schliessen();
  };
  function schliessen() {
    liste.hidden = true;
    document.removeEventListener("click", aussen);
  }
  knopfEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
    liste.hidden = !liste.hidden;
    if (!liste.hidden) document.addEventListener("click", aussen);
  });

  wrap.appendChild(knopfEl);
  wrap.appendChild(liste);
  return wrap;
}

// --- Pillen (runde Toggle-Buttons) -----------------------------------------
//
// v77 (Owner 28.09.2026): vorher baute detail.js dieselbe Pillen-Optik (.schalterreihe/.schalter)
// vierfach unabhaengig voneinander nach — einmal fuer Single-Select (einzelwahlReihe), einmal
// inline fuer die Plattform-Mehrfachauswahl, einmal fuer einen einzelnen Boolean-Schalter
// (floatSchalter) und einmal fuer mehrere unabhaengige Booleans (schalterFeld). Jetzt EIN
// Baustein (`pille`) dahinter, zwei duenne Fassaden davor je nach Datenform.
function pille(text, an, typ, name, beiAenderung) {
  const l = document.createElement("label");
  l.className = "schalter" + (an ? " an" : "");
  l.innerHTML = `<input type="${typ}" ${name ? `name="${name}"` : ""} ${an ? "checked" : ""}><span>${escape(text)}</span>`;
  l.querySelector("input").addEventListener("change", (e) => beiAenderung(e.target.checked));
  return l;
}

let pillenZaehler = 0;

// EIN gemeinsamer Wert: `wert` ist bei mehrfach=false eine ID (oder ""), bei mehrfach=true ein
// Array von IDs. `beiWahl` bekommt die neue ID ("" beim Abwaehlen) bzw. die neue ID-Liste.
export function pillenReihe(optionen, wert, { mehrfach = false, beiWahl } = {}) {
  const reihe = document.createElement("div");
  reihe.className = "schalterreihe";
  const name = mehrfach ? null : `_pill${++pillenZaehler}`;
  const ausgewaehlt = new Set(mehrfach ? wert || [] : []);
  for (const o of optionen) {
    const an = mehrfach ? ausgewaehlt.has(o.id) : wert === o.id;
    const l = pille(o.name, an, mehrfach ? "checkbox" : "radio", name, (checked) => {
      if (mehrfach) {
        const neu = new Set(ausgewaehlt);
        checked ? neu.add(o.id) : neu.delete(o.id);
        beiWahl([...neu]);
      } else if (checked) {
        beiWahl(o.id);
      }
    });
    if (!mehrfach) l.addEventListener("click", (e) => { if (an) { e.preventDefault(); beiWahl(""); } });
    reihe.appendChild(l);
  }
  return reihe;
}

// Mehrere UNABHAENGIGE Ja/Nein-Pillen, jede mit eigenem Zustand und eigener Aktion (kein
// gemeinsamer Wert wie bei pillenReihe) — z. B. mehrere unabhaengige Video-Eigenschaften.
export function pillenSchalter(eintraege) {
  const reihe = document.createElement("div");
  reihe.className = "schalterreihe";
  for (const e of eintraege) reihe.appendChild(pille(e.text, e.an, "checkbox", null, e.beiAenderung));
  return reihe;
}

// Eigenschaft in der schmalen Spalte: festes Label, Wert daneben.
export function eigenschaft(label, wertHtml) {
  return (
    `<div class="eigenschaft"><span class="eigenschaft-label">${escape(label)}</span>` +
    `<span class="eigenschaft-wert">${wertHtml}</span></div>`
  );
}

// Kleine Icon-Kachel fuer eine Kennzahl (v80, Owner 28.09.2026: die Drive-Zahlen standen als
// rohe "Label: Wert"-Liste, das wirkte wie eine Datenausgabe statt gestaltet — jetzt dieselbe
// Icon-plus-Zahl-Sprache wie die KPI-Kacheln der Auswertung, nur kompakt fuer die Detailspalte).
export function kennzahlKachel(zeichen, wert, label) {
  return (
    `<div class="kennzahl-kachel"><span class="kennzahl-kachel-icon">${icon(zeichen)}</span>` +
    `<span class="kennzahl-kachel-wert">${escape(String(wert))}</span>` +
    `<span class="kennzahl-kachel-label">${escape(label)}</span></div>`
  );
}

// Reihe mehrerer Kennzahl-Kacheln.
export function kennzahlReihe(kacheln) {
  return `<div class="kennzahl-reihe">${kacheln.map((k) => kennzahlKachel(k.zeichen, k.wert, k.label)).join("")}</div>`;
}

// Icon-Zeichen, die als farbige Kachel erscheinen (v29, Owner-Grafikstil) statt als
// blosses Strich-Icon — bewusst eine kleine, feste Liste statt aller `zeichen`-Werte:
// Navigations-/Bestaetigungs-Icons (schliessen, weiter, zurueck, check ...) sollen klein
// und unauffaellig bleiben, nur "Datei-Ort"-Symbole tragen die Kachel.
const KACHEL_ZEICHEN = new Set(["ordner", "drive"]);

export function knopf(text, { art = "still", zeichen = null, klick = null, titel = "" } = {}) {
  const b = document.createElement("button");
  b.className = `knopf knopf-${art}` + (KACHEL_ZEICHEN.has(zeichen) ? ` knopf-symbol knopf-symbol-${zeichen}` : "");
  b.innerHTML = (zeichen ? icon(zeichen) : "") + `<span>${escape(text)}</span>`;
  if (titel) b.title = titel;
  if (klick) b.addEventListener("click", klick);
  return b;
}

// Die Stufen des Servers als deutsche Saetze (v51). Der Server schickt den Code, die Anzeige
// besitzt den Wortlaut — so steht die Sprache an EINER Stelle. `o` ist das Stufen-Ereignis
// aus /api/ai/stream: {stufe, schritt, von, rolle, rolleName, modell, sekunden, treffer, quelle}.
const STUFEN_SATZ = {
  kontext: () => "Kontext wird gesammelt …",
  "ollama-start": () => "Ollama startet …",
  "modell-laedt": (o) =>
    `Modell laedt … ${o.sekunden || 0} s` +
    // Nach ein paar Sekunden dazusagen, WARUM es dauert — gemessen 17.09.2026 braucht
    // deepseek-r1:14b beim ersten Aufruf 25-50 s, und genau da denkt man „das haengt".
    ((o.sekunden || 0) >= 8 ? " — der erste Aufruf eines Modells laedt es einmalig in den Speicher" : ""),
  generiert: (o) => `Das Modell schreibt${o.modell ? " — " + o.modell : ""} …`,
  "web-suche": () => "Sucht im Web …",
  "web-treffer": (o) =>
    o.treffer ? `${o.treffer} Web-Treffer${o.quelle ? " (" + o.quelle + ")" : ""}.` : "Keine Web-Treffer.",
  fertig: () => "Fertig.",
};

// Live-Terminal fuer KI- und System-Laeufe (v32 D als Konsole, v51 um Stufen erweitert):
// zeigt oben die echten Stufen als Zeilen, darunter aufklappbar den vollen Textstrom.
// Rueckgabe: { delta(text), status(text), stufe(ereignis), fehler(satz), fertig(), weg() }.
// `status`/`delta`/`weg` bleiben unveraendert — die drei alten Aufrufstellen laufen weiter.
export function denkPanel(container, titel = "Die KI arbeitet …") {
  const el = document.createElement("div");
  el.className = "denk";
  el.innerHTML =
    `<div class="denk-kopf"><span class="denk-symbol knopf-symbol knopf-symbol-sanduhr">${icon("sanduhr")}</span>` +
    `<span class="denk-titel">${escape(titel)}</span>` +
    `<button type="button" class="denk-mehr" aria-expanded="false" title="Vollen Verlauf zeigen">` +
    `${icon("weiter")}<span>Verlauf</span></button></div>` +
    `<ol class="denk-stufen"></ol>` +
    `<pre class="denk-text" hidden></pre>`;
  container.appendChild(el);
  const textEl = el.querySelector(".denk-text");
  const titelEl = el.querySelector(".denk-titel");
  const stufenEl = el.querySelector(".denk-stufen");
  const mehrEl = el.querySelector(".denk-mehr");

  let offen = false;
  // Wer den Verlauf aufgeklappt hat, liest noch — dann raeumt sich das Terminal nicht
  // unter den Augen weg, auch wenn der Lauf fertig ist.
  mehrEl.addEventListener("click", () => {
    offen = !offen;
    textEl.hidden = !offen;
    mehrEl.setAttribute("aria-expanded", String(offen));
    mehrEl.title = offen ? "Vollen Verlauf verbergen" : "Vollen Verlauf zeigen";
    if (offen) textEl.scrollTop = textEl.scrollHeight;
  });

  // Je Stufen-Art EINE Zeile: eine tickende Ladeanzeige aktualisiert ihre eigene Zeile,
  // statt fuenfzig gleiche Zeilen zu stapeln.
  const zeilen = new Map();
  function zeile(schluessel, inhaltHtml) {
    let li = zeilen.get(schluessel);
    if (!li) {
      li = document.createElement("li");
      li.className = "denk-stufe";
      zeilen.set(schluessel, li);
      stufenEl.appendChild(li);
    }
    li.innerHTML = inhaltHtml;
    return li;
  }
  const laeuftHtml = (satz) =>
    `<span class="denk-stufe-icon">${icon("sanduhr")}</span><span>${escape(satz)}</span>`;

  function endeMarkieren() {
    // Die laufenden Zeilen drehen sonst weiter, obwohl nichts mehr laeuft.
    for (const li of zeilen.values()) li.classList.add("denk-stufe-vorbei");
  }

  // Nach Abschluss raeumt sich das Terminal selbst weg — ausser der Verlauf ist aufgeklappt,
  // dann liest jemand mit und es bleibt stehen. Haengt an der Komponente, nicht an der
  // Aufrufstelle: so verschwindet JEDES Terminal von selbst, egal wer es verdrahtet hat.
  function selbstAusblenden(verzoegerung = 1400) {
    endeMarkieren();
    if (offen) return;
    el.classList.add("denk-faellt");
    setTimeout(() => el.remove(), verzoegerung);
  }

  return {
    el,
    delta(t) {
      textEl.textContent += t;
      if (offen) textEl.scrollTop = textEl.scrollHeight;
    },
    status(s) {
      if (s) titelEl.textContent = s;
    },
    stufe(o) {
      if (!o || !o.stufe) return;
      if (o.stufe === "fehler") return;
      const satzBau = STUFEN_SATZ[o.stufe];
      if (!satzBau) return;
      const satz = satzBau(o);
      // Schluessel je Schritt, damit eine dreistufige Kette drei Generier-Zeilen bekommt
      // statt einer ueberschriebenen.
      const schluessel = `${o.stufe}#${o.schritt || 0}`;
      if (o.stufe === "fertig") {
        zeile(schluessel, statusChip("ok") + `<span>${escape(satz)}</span>`);
        selbstAusblenden();
      } else {
        zeile(schluessel, laeuftHtml(satz));
      }
    },
    // Fuer Laeufe ohne Stufen-Ereignisse (Drive, Laden, Upload): eine laufende Zeile mit
    // eigenem Wortlaut. `schluessel` haelt die Zeile fest, damit ein Zaehler sie aktualisiert,
    // statt jedes Mal eine neue anzuhaengen.
    arbeit(schluessel, satz) {
      zeile(schluessel, laeuftHtml(satz));
    },
    // Sachlicher Hinweis, der kein Fehler ist — Statuswort „hinweis", nicht „befund".
    hinweis(satz) {
      endeMarkieren();
      zeile("hinweis", statusChip("hinweis") + `<span>${escape(satz)}</span>`);
    },
    fehler(satz) {
      endeMarkieren();
      zeile("fehler", statusChip("befund") + `<span>${escape(satz || "Der Lauf ist nicht durchgelaufen.")}</span>`);
      el.classList.add("denk-fehler");
    },
    // Fuer Laeufe ohne Stufen-Ereignisse (Drive, Laden): dasselbe Ausblenden von Hand.
    fertig({ verzoegerung = 1400 } = {}) {
      selbstAusblenden(verzoegerung);
    },
    weg() {
      el.remove();
    },
  };
}

// Schwebende Fassung desselben Terminals (v51). Warum nicht einfach in die Box haengen:
// die Detailspalte wird bei jeder Aenderung neu gezeichnet (`zeichne()`), und ein Panel IN der
// Box verschwindet dann mitten im Lauf — der Aufruf lief danach unsichtbar weiter (Befund des
// v51-Audits). Das schwebende Terminal liegt in einer eigenen Schicht am `body`, steht
// kontextuell neben seinem Ausloeser und ueberlebt jeden Neuzeichen-Lauf.
let _terminalSchicht = null;
function _schicht() {
  if (!_terminalSchicht || !document.body.contains(_terminalSchicht)) {
    _terminalSchicht = document.createElement("div");
    _terminalSchicht.className = "terminal-schicht";
    document.body.appendChild(_terminalSchicht);
  }
  return _terminalSchicht;
}

export function terminalAn(anker, titel = "Die KI arbeitet …") {
  const p = denkPanel(_schicht(), titel);
  p.el.classList.add("denk-schwebend");
  const stelle = () => {
    if (!anker || !anker.isConnected) return; // Anker weggezeichnet: letzte Stelle behalten
    const r = anker.getBoundingClientRect();
    const breite = p.el.offsetWidth || 320;
    const hoehe = p.el.offsetHeight || 140;
    p.el.style.left = Math.max(12, Math.min(r.left, window.innerWidth - breite - 12)) + "px";
    // Unter den Ausloeser — ausser es ist dort kein Platz mehr (Knopf am unteren Rand,
    // z. B. der Spaltenfuss „Idee von der KI"), dann darueber.
    let oben = r.bottom + 8;
    if (oben + hoehe > window.innerHeight - 12) oben = Math.max(12, r.top - hoehe - 8);
    p.el.style.top = oben + "px";
  };
  stelle();
  window.addEventListener("scroll", stelle, true);
  window.addEventListener("resize", stelle);
  // Das Terminal waechst mit jeder Stufe; ohne Nachfuehren rutscht es sonst aus dem Bild,
  // wenn es mangels Platz oberhalb des Ausloesers sitzt.
  const beobachter = typeof ResizeObserver === "function" ? new ResizeObserver(stelle) : null;
  if (beobachter) beobachter.observe(p.el);
  // Das Terminal kann sich auch selbst wegblenden (Stufe „fertig"); die Zuhoerer muessen
  // deshalb am VERSCHWINDEN haengen, nicht an einem bestimmten Aufruf.
  let waechter = null;
  const aufraeumen = () => {
    window.removeEventListener("scroll", stelle, true);
    window.removeEventListener("resize", stelle);
    if (beobachter) beobachter.disconnect();
    if (waechter) waechter.disconnect();
  };
  if (typeof MutationObserver === "function") {
    waechter = new MutationObserver(() => {
      if (!p.el.isConnected) aufraeumen();
    });
    waechter.observe(_schicht(), { childList: true });
  }
  return p;
}

// Inline-Zustand am ausloesenden Knopf (v51): der Knopf selbst sagt, dass es losgeht — man
// muss nicht erst das Terminal suchen. Rueckgabe: { text(t), zurueck() }.
export function knopfLaeuft(b, text = "startet …") {
  if (!b) return { text() {}, zurueck() {} };
  const vorher = b.innerHTML;
  b.disabled = true;
  b.classList.add("knopf-laeuft");
  const setze = (t) =>
    (b.innerHTML = `<span class="denk-stufe-icon">${icon("sanduhr")}</span><span>${escape(t)}</span>`);
  setze(text);
  return {
    text: setze,
    zurueck() {
      b.innerHTML = vorher;
      b.disabled = false;
      b.classList.remove("knopf-laeuft");
    },
  };
}

// Sanduhr-Indikator (v32 E): der EINE, ueberall gleiche „hier passiert gerade etwas"-Marker.
// Ueberall dort einsetzen, wo die KI arbeitet, etwas laedt, ein Drive-Abgleich laeuft oder
// Daten noch fehlen — nie tote Leere/statischer Text, sondern diese drehende Sanduhr, damit
// klar ist: einen Moment warten, da kommt noch was. Dreht sich (respektiert
// prefers-reduced-motion). `klein:true` = nur das drehende Icon (fuer Kacheln/inline, Text als
// Tooltip); sonst Icon + Text als Block.
export function sanduhr(text = "", { klein = false } = {}) {
  const el = document.createElement("span");
  el.className = "lade-sanduhr" + (klein ? " lade-sanduhr-klein" : "");
  el.innerHTML =
    `<span class="lade-sanduhr-icon">${icon("sanduhr")}</span>` +
    (!klein && text ? `<span class="lade-sanduhr-text">${escape(text)}</span>` : "");
  if (text) el.title = text;
  return el;
}

// Kalender-Pop-up: Monatsraster, Slot-Tage hervorgehoben, Klick waehlt.
// fenster: [{tag, uhrzeit}] aus scheduler.fensterFuerTyp — leeres Array = kein Highlighting.
// onConfirm(iso, uhrzeit) — uhrzeit ist die empfohlene Zeit fuer den gewaehlten Wochentag.
export function modalKalender(frage, hinweis, fenster, onConfirm) {
  const MONATE = ["Januar","Februar","Maerz","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const slotTage = new Map();
  for (const f of fenster) {
    if (!slotTage.has(f.tag)) slotTage.set(f.tag, f.uhrzeit);
  }

  let monat = new Date();
  monat.setDate(1);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const zu = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) zu(); });

  function render() {
    const box = document.createElement("div");
    box.className = "modal modal-kalender";
    box.innerHTML = `<div class="modal-frage">${escape(frage)}</div>` +
      (hinweis ? `<p class="feld-hinweis">${escape(hinweis)}</p>` : "");
    box.querySelector(".modal-frage").appendChild(modalX(zu));

    const kopf = document.createElement("div");
    kopf.className = "kal-kopf";
    const zurueck = document.createElement("button");
    zurueck.className = "kal-nav";
    zurueck.innerHTML = icon("zurueck");
    zurueck.addEventListener("click", () => {
      monat = new Date(monat.getFullYear(), monat.getMonth() - 1, 1);
      aktualisiere();
    });
    const weiter = document.createElement("button");
    weiter.className = "kal-nav";
    weiter.innerHTML = icon("weiter");
    weiter.addEventListener("click", () => {
      monat = new Date(monat.getFullYear(), monat.getMonth() + 1, 1);
      aktualisiere();
    });
    const name = document.createElement("span");
    name.className = "kal-monat";
    name.textContent = `${MONATE[monat.getMonth()]} ${monat.getFullYear()}`;
    kopf.appendChild(zurueck);
    kopf.appendChild(name);
    kopf.appendChild(weiter);
    box.appendChild(kopf);

    const raster = document.createElement("div");
    raster.className = "kal-raster";
    for (const wt of ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]) {
      const z = document.createElement("div");
      z.className = "kal-wt";
      z.textContent = wt;
      raster.appendChild(z);
    }

    const erster = new Date(monat.getFullYear(), monat.getMonth(), 1);
    const start = new Date(erster);
    start.setDate(start.getDate() - ((erster.getDay() + 6) % 7));
    // v104 (Owner 01.10.2026: „26. November gewaehlt, eingetragen wird der 25."): Datum aus der
    // ORTSZEIT bilden. toISOString() rechnet in UTC um — deutsche Mitternacht ist dann 22/23 Uhr
    // am Vortag, jeder Klick landete einen Tag zu frueh.
    const ortsISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const heuteISO = ortsISO(new Date());

    for (let i = 0; i < 42; i++) {
      const tag = new Date(start);
      tag.setDate(start.getDate() + i);
      const iso = ortsISO(tag);
      const jsTag = tag.getDay();
      const istSlot = slotTage.has(jsTag);
      const zelle = document.createElement("button");
      zelle.type = "button";
      zelle.className = "kal-tag" +
        (tag.getMonth() !== monat.getMonth() ? " fremd" : "") +
        (iso === heuteISO ? " heute" : "") +
        (istSlot ? " slot" : "");
      zelle.textContent = tag.getDate();
      if (istSlot) {
        zelle.title = `Empfohlen: ${slotTage.get(jsTag)} Uhr`;
      }
      zelle.addEventListener("click", () => {
        zu();
        onConfirm(iso, istSlot ? slotTage.get(jsTag) : "");
      });
      raster.appendChild(zelle);
    }
    box.appendChild(raster);

    if (slotTage.size) {
      const legende = document.createElement("div");
      legende.className = "kal-legende";
      legende.innerHTML = `${icon("funken")}<span>Empfohlene Tage fuer dieses Format</span>`;
      box.appendChild(legende);
    }

    const reihe = document.createElement("div");
    reihe.className = "modal-knoepfe";
    reihe.appendChild(knopf("Abbrechen", { klick: zu }));
    box.appendChild(reihe);
    return box;
  }

  let aktuell = render();
  overlay.appendChild(aktuell);
  function aktualisiere() {
    const neu = render();
    overlay.replaceChild(neu, aktuell);
    aktuell = neu;
  }
  document.body.appendChild(overlay);
}

// Kompatibilitaet: modalDatum fuer Aufrufe ohne Formatkenntnis.
export function modalDatum(frage, hinweis, onConfirm) {
  modalKalender(frage, hinweis, [], (datum) => onConfirm(datum));
}

export function feld(label, el, hinweis = "") {
  const wrap = document.createElement("div");
  wrap.className = "feld";
  const l = document.createElement("label");
  l.className = "feld-label";
  l.textContent = label;
  if (el.id) l.htmlFor = el.id;
  wrap.appendChild(l);
  wrap.appendChild(el);
  if (hinweis) {
    const h = document.createElement("p");
    h.className = "feld-hinweis";
    h.textContent = hinweis;
    wrap.appendChild(h);
  }
  return wrap;
}

export function eingabe(wert, { typ = "text", platzhalter = "", max = null } = {}) {
  const i = document.createElement("input");
  i.className = "eingabe";
  i.type = typ;
  i.value = wert ?? "";
  if (platzhalter) i.placeholder = platzhalter;
  if (max) i.maxLength = max;
  return i;
}

export function textfeld(wert, zeilen = 4, platzhalter = "") {
  const t = document.createElement("textarea");
  t.className = "eingabe eingabe-mehrzeilig";
  t.rows = zeilen;
  t.value = wert ?? "";
  if (platzhalter) t.placeholder = platzhalter;
  return t;
}

// Unbestimmte Fortschritts-Leiste. Gibt die Entfern-Funktion zurueck.
// v32 E: traegt jetzt die drehende Sanduhr vor dem Text — damit JEDE Fortschritt-Stelle
// (Abgleich, Upload, Ordner anlegen, Drive-Speichern) denselben „hier passiert gerade was"-
// Indikator zeigt wie der Rest der App.
export function fortschritt(container, text) {
  const box = document.createElement("div");
  box.className = "fortschritt";
  box.innerHTML =
    `<span class="fortschritt-kopf"><span class="lade-sanduhr-icon">${icon("sanduhr")}</span>` +
    `<span class="fortschritt-text">${escape(text || "Einen Moment …")}</span></span>` +
    `<span class="fortschritt-schiene"><span class="fortschritt-balken"></span></span>`;
  container.appendChild(box);
  // Rueckgabe ist die Entfern-Funktion wie bisher (`const weg = fortschritt(...); weg();`),
  // traegt aber zusaetzlich `weg.text(satz)` — damit ein laufender Vorgang seine Zeile
  // nachfuehren kann, statt bis zum Ende denselben Satz zu zeigen (v51 T7).
  const weg = () => box.remove();
  weg.text = (satz) => {
    const el = box.querySelector(".fortschritt-text");
    if (el && satz) el.textContent = satz;
  };
  return weg;
}

// Info-Tooltip: kleiner "i"-Kreis, Hover zeigt Erklaerung.
export function infoTipp(text) {
  const wrap = document.createElement("span");
  wrap.className = "info-tipp";
  wrap.innerHTML = icon("info");
  wrap.setAttribute("tabindex", "0");
  wrap.setAttribute("aria-label", text);
  const blase = document.createElement("span");
  blase.className = "info-tipp-blase";
  blase.textContent = text;
  wrap.appendChild(blase);
  return wrap;
}

// Feld-Label mit optionalem Info-Tooltip rechts.
export function feldMitInfo(label, el, tipp = "") {
  const wrap = document.createElement("div");
  wrap.className = "feld";
  const kopf = document.createElement("span");
  kopf.className = "feld-label feld-label-mit-info";
  kopf.textContent = label;
  if (tipp) kopf.appendChild(infoTipp(tipp));
  wrap.appendChild(kopf);
  wrap.appendChild(el);
  return wrap;
}

// --- Cursor-Modus (v67, Tab "Darstellung")-------------------------------------
//
// Standard: eigener Haus-Cursor ueberall (v57). Ausgeschaltet: System-Cursor ueberall — eine
// Klasse auf <html> hebt die eigenen cursor:-Regeln auf (siehe style.css, --cursor-*-Variablen).
// Wahrheit ist der Drive-gestuetzte Defaults-Store (v60, /api/defaults); der lokale Cache ist
// nur ein Vorschuss, damit der eigene Cursor beim Start nicht kurz aufblitzt, bevor der Server
// geantwortet hat (selbes Muster wie das Theme in app.js). Bewusst EIGENE fetch-Aufrufe statt
// store.js/S.defaults zu erweitern: store.js ist waehrend dieses Auftrags Baustelle einer
// parallelen Sitzung (Kollisionsvermeidung, siehe docs/packages/v67-…md).
const CURSOR_CACHE_KEY = "cm-system-cursor";

export function wendeCursorModusAn(systemCursor) {
  document.documentElement.classList.toggle("system-cursor", !!systemCursor);
  try { localStorage.setItem(CURSOR_CACHE_KEY, systemCursor ? "1" : "0"); } catch {}
}

export function gecachterCursorModus() {
  try {
    const v = localStorage.getItem(CURSOR_CACHE_KEY);
    return v == null ? null : v === "1";
  } catch {
    return null;
  }
}

// Direkter, eigener Zugriff auf den generischen Defaults-Store (lib/defaultsstore.js via
// server.js /api/defaults, feldweise verschmolzen — verlangt kein Schema, kein Eingriff dort).
async function holeCursorDefault() {
  const res = await fetch("/api/defaults");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return !!d.systemCursor;
}
async function schreibeCursorDefault(systemCursor) {
  const res = await fetch("/api/defaults", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ systemCursor }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// App-Start (v67): den wahren Stand vom Server holen und anwenden — der Cache (oben) hat bis
// dahin schon den letzten bekannten Stand gezeigt, damit nichts aufblitzt.
export async function ladeCursorModusVomServer() {
  try {
    wendeCursorModusAn(await holeCursorDefault());
  } catch {
    /* Defaults sind Beiwerk — der Cache-Stand (falls vorhanden) bleibt einfach aktiv. */
  }
}

// Tab -> Drive-Ordner, in dem seine Daten liegen (die Marke im Menue oeffnet ihn per Klick).
const DRIVE_TABS = new Map([
  ["Mitteilungen", "System (AI only)"],
  ["Vorbelegungen", "System (AI only)"], // v113: defaults.json
  ["Unternehmenskontext", "Kontext"],
  ["Prompts", "System (AI only)"],
]);

// Einstellungs-Modal: zentriertes Popup, Liste links, Inhalt rechts.
// v86 Teil 2: `startTab` (Name eines Tabs) oeffnet direkt dort — fuer „Neu verbinden" aus der Kopfzeile.
export function einstellungenModal(onThemeChange, startTab = null) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal einstellungen-modal";

  // --- Navigation (links) ---
  const links = document.createElement("nav");
  links.className = "einst-nav";
  // v99: Die Tabs entstehen am Ende aus TABS (Gruppe, Name, Seite) — siehe „Tab-Switching".

  // --- Inhalt (rechts) ---
  const rechts = document.createElement("div");
  rechts.className = "einst-inhalt";

  // Seite 1: Darstellung
  const seite1 = document.createElement("div");
  seite1.className = "einst-seite";
  const titel1 = document.createElement("div");
  titel1.className = "einst-titel";
  titel1.textContent = "Darstellung";
  seite1.appendChild(titel1);
  const aktuellesTheme = document.documentElement.getAttribute("data-theme") || "light";
  const themeOptionen = [
    { id: "light", name: "Light Mode" },
    { id: "dark", name: "Dark Mode" },
  ];
  const themeReihe = document.createElement("div");
  themeReihe.className = "einst-theme-reihe";
  for (const opt of themeOptionen) {
    const label = document.createElement("label");
    label.className = "einst-theme-option" + (aktuellesTheme === opt.id ? " aktiv" : "");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "theme";
    radio.value = opt.id;
    radio.checked = aktuellesTheme === opt.id;
    radio.addEventListener("change", () => {
      themeReihe.querySelectorAll(".einst-theme-option").forEach((l) => l.classList.remove("aktiv"));
      label.classList.add("aktiv");
      onThemeChange(opt.id);
    });
    label.appendChild(radio);
    const span = document.createElement("span");
    span.textContent = opt.name;
    label.appendChild(span);
    themeReihe.appendChild(label);
  }
  // Beide Bloecke als Kachel (.einst-rolle), wie die Rollen- und Verbindungs-Zeilen der anderen Tabs.
  const themeKachel = document.createElement("div");
  themeKachel.className = "einst-rolle";
  const themeLabel = document.createElement("div");
  themeLabel.className = "einst-label";
  themeLabel.textContent = "Farbschema";
  themeKachel.appendChild(themeLabel);
  // v83: kein Erklaersatz — Ueberschrift „Farbschema" und die zwei Optionen sagen dasselbe.
  themeKachel.appendChild(themeReihe);
  seite1.appendChild(themeKachel);

  // Seite Ansicht (v67, Owner-Auftrag 24.09.2026): Cursor-Stil + Ampel-Regeln erklaeren — rein
  // Vorlieben/Erklaerung, keine Verbindung, kein OAuth.
  const seiteAnsicht = document.createElement("div");
  seiteAnsicht.className = "einst-seite";
  const titelAnsicht = document.createElement("div");
  titelAnsicht.className = "einst-titel";
  titelAnsicht.textContent = "Termine & Fristen";
  seiteAnsicht.appendChild(titelAnsicht);

  const cursorAbschnitt = document.createElement("div");
  cursorAbschnitt.className = "einst-rolle";
  const cursorLabel = document.createElement("div");
  cursorLabel.className = "einst-label";
  cursorLabel.textContent = "Cursor";
  cursorAbschnitt.appendChild(cursorLabel);
  const cursorHinweis = document.createElement("p");
  cursorHinweis.className = "einst-provider-sub einst-kachel-sub";
  cursorHinweis.textContent =
    "Eigener Pfeil im Haus-Stil statt System-Cursor. Aus = System-Cursor."; // v83 gekuerzt
  cursorAbschnitt.appendChild(cursorHinweis);
  cursorAbschnitt.appendChild(driveOrtZeile("Gespeichert in", "System (AI only)", "System (AI only)"));

  const cursorReihe = document.createElement("div");
  cursorReihe.className = "schalterreihe";
  const cursorSchalter = document.createElement("label");
  // Anfangszustand aus der DOM-Klasse lesen, nicht aus einem eigenen Zustandsobjekt: app.js hat
  // sie beim Start schon aus /api/defaults gesetzt (ladeCursorModusVomServer) — eine zweite
  // Wahrheit waere hier nur eine Fehlerquelle mehr.
  const eigenerCursorAn = !document.documentElement.classList.contains("system-cursor");
  cursorSchalter.className = "schalter" + (eigenerCursorAn ? " an" : "");
  cursorSchalter.innerHTML = `<input type="checkbox" ${eigenerCursorAn ? "checked" : ""}><span>Eigener Cursor</span>`;
  const cursorInput = cursorSchalter.querySelector("input");
  cursorInput.addEventListener("change", async () => {
    const neuEigen = cursorInput.checked;
    cursorSchalter.classList.toggle("an", neuEigen);
    wendeCursorModusAn(!neuEigen);
    cursorInput.disabled = true;
    try {
      await schreibeCursorDefault(!neuEigen);
    } catch {
      // Speichern fehlgeschlagen: zurueck auf den vorherigen Stand (Muster wie kontext.js).
      cursorInput.checked = !neuEigen;
      cursorSchalter.classList.toggle("an", !neuEigen);
      wendeCursorModusAn(neuEigen);
    } finally {
      cursorInput.disabled = false;
    }
  });
  cursorReihe.appendChild(cursorSchalter);
  cursorAbschnitt.appendChild(cursorReihe);
  seite1.appendChild(cursorAbschnitt);

  // Ampel-Regeln (v65): nur erklaert, nicht editierbar — die Schwellen sind Haus-Standard;
  // editierbar-oder-fest klaert der Owner separat (v67-Auftrag, bewusst keine Eingabefelder hier).
  const ampelAbschnitt = document.createElement("div");
  ampelAbschnitt.className = "einst-abschnitt";
  const ampelLabel = document.createElement("div");
  ampelLabel.className = "einst-label";
  ampelLabel.textContent = "Ampel-Regeln";
  ampelAbschnitt.appendChild(ampelLabel);
  const ampelText = document.createElement("p");
  ampelText.className = "einst-provider-sub";
  ampelText.textContent =
    "Der Zeit-Punkt an jeder Karte richtet sich nach der dringlichsten Frist: ueberfaellig oder " +
    "noch hoechstens 2 Tage entfernt faerbt rot, 3 bis 5 Tage faerbt gelb, ab 6 Tagen faerbt " +
    "gruen. Fest hinterlegt, hier nicht aenderbar.";
  ampelAbschnitt.appendChild(ampelText);
  seiteAnsicht.appendChild(ampelAbschnitt);

  // Deadline-Vorlauf (v70b): die EINE Stelle, an der der Owner die Offsets aendert — jetzt als KETTE.
  // Das geplante Upload-Datum ist der Anker (zentrale Deadline); Freigabe liegt davor, Schnitt vor
  // Freigabe, Dreh vor Schnitt. Alle drei Glieder teilen sich den Workflow "rueckwaertsplan" — beim
  // Speichern IMMER alle drei mitgeben (sonst faellt ein Glied auf seinen Standard zurueck).
  const offsetKachel = document.createElement("div");
  offsetKachel.className = "einst-rolle";
  const offsetLabel = document.createElement("div");
  offsetLabel.className = "einst-label";
  offsetLabel.textContent = "Deadline-Vorlauf";
  offsetKachel.appendChild(offsetLabel);
  const offsetSub = document.createElement("p");
  offsetSub.className = "einst-provider-sub einst-kachel-sub";
  offsetSub.textContent =
    "Die Deadlines haengen als Kette am geplanten Upload-Datum: Freigabe liegt vor dem Upload, " +
    "Schnitt vor der Freigabe, Dreh vor dem Schnitt. Jede Zahl sind Tage vor der jeweils naechsten Stufe.";
  offsetKachel.appendChild(offsetSub);

  // Basiszeile: das Upload-Datum ist der Anker, von dem die Kette rueckwaerts rechnet.
  const offsetBasis = document.createElement("p");
  offsetBasis.className = "einst-provider-sub einst-kachel-sub";
  offsetBasis.style.fontWeight = "600";
  offsetBasis.style.marginBottom = "2px";
  offsetBasis.textContent = "Upload (geplantes Datum) — zentrale Deadline";
  offsetKachel.appendChild(offsetBasis);

  // Drei Kettenglieder, vertikal untereinander (Owner-Wunsch v70b).
  const KETTE = [
    { key: "freigabeVorUpload", label: "Freigabe — Tage vor Upload" },
    { key: "schnittVorFreigabe", label: "Schnitt — Tage vor Freigabe" },
    { key: "drehVorSchnitt", label: "Dreh — Tage vor Schnitt" },
  ];
  const offsetInputs = {};
  const offsetSpalte = document.createElement("div");
  offsetSpalte.style.display = "flex";
  offsetSpalte.style.flexDirection = "column";
  offsetSpalte.style.gap = "10px";
  for (const { key, label } of KETTE) {
    const feld = document.createElement("label");
    feld.className = "einst-provider-sub";
    feld.style.display = "flex";
    feld.style.alignItems = "center";
    feld.style.justifyContent = "space-between";
    feld.style.gap = "12px";
    const t = document.createElement("span");
    t.textContent = label;
    const input = eingabe(String(stellschraube("rueckwaertsplan", key)), { typ: "number" });
    input.min = "0";
    input.step = "1";
    input.style.maxWidth = "90px";
    input.dataset.offsetKey = key;
    feld.appendChild(t);
    feld.appendChild(input);
    offsetSpalte.appendChild(feld);
    offsetInputs[key] = input;
  }
  offsetKachel.appendChild(offsetSpalte);

  // Ganze Tage, nicht negativ. Beim Speichern ALLE drei aktuellen Werte zusammen schreiben.
  const leseGanzeTage = (input) => {
    const z = Math.round(Number(input.value));
    return Number.isFinite(z) ? Math.max(0, z) : 0;
  };
  const speichereOffsets = async () => {
    const werte = {};
    for (const { key } of KETTE) werte[key] = leseGanzeTage(offsetInputs[key]);
    for (const { key } of KETTE) {
      offsetInputs[key].value = String(werte[key]);
      offsetInputs[key].disabled = true;
    }
    try {
      await setzeWorkflow("rueckwaertsplan", { params: werte });
      zeichne();
    } catch {
      // Speichern fehlgeschlagen: zurueck auf die zuletzt gueltigen (gespeicherten) Werte.
      for (const { key } of KETTE) offsetInputs[key].value = String(stellschraube("rueckwaertsplan", key));
    } finally {
      for (const { key } of KETTE) offsetInputs[key].disabled = false;
    }
  };
  for (const { key } of KETTE) offsetInputs[key].addEventListener("change", speichereOffsets);

  // Gruen-Hinweis speziell am Dreh-Glied: genug Vorlauf vor dem Schnitt = gruener Start in den Schnitt.
  const offsetPuffer = document.createElement("p");
  offsetPuffer.className = "einst-provider-sub einst-kachel-sub";
  offsetPuffer.textContent =
    "Mehr Vorlauf heisst frueher faellig — also mehr Puffer. Beim Dreh gilt: liegt der Drehtag genug " +
    "vor dem Schnitt (ab 6 Tagen), rutscht die Karte mit gruenem Punkt in den Schnitt; ein spaeter " +
    "liegender Drehtermin ist nicht zuweisbar.";
  offsetKachel.appendChild(offsetPuffer);
  seiteAnsicht.appendChild(offsetKachel);
  seiteAnsicht.appendChild(ampelAbschnitt); // v99: Einstellbares (Vorlauf) zuerst, feste Ampel-Regeln darunter

  // Seite Hinweise & Warnungen (v68): zwei Kacheln mit Checkbox-Listen; jeder Haken speichert
  // sofort (kein "Speichern"-Knopf) und die Karten zeichnen sich neu.
  const seiteMeldungen = document.createElement("div");
  seiteMeldungen.className = "einst-seite";
  const titelMeldungen = document.createElement("div");
  titelMeldungen.className = "einst-titel";
  titelMeldungen.textContent = "Mitteilungen";
  seiteMeldungen.appendChild(titelMeldungen);
  seiteMeldungen.appendChild(driveOrtZeile("Gespeichert in", "System (AI only)", "System (AI only)"));

  const meldungsKachel = (art, titel, text) => {
    const kachel = document.createElement("div");
    kachel.className = "einst-rolle";
    const l = document.createElement("div");
    l.className = "einst-label";
    l.textContent = titel;
    kachel.appendChild(l);
    const s = document.createElement("p");
    s.className = "einst-provider-sub einst-kachel-sub";
    s.textContent = text;
    kachel.appendChild(s);
    const status = document.createElement("div");
    status.className = "einst-ping-status meldung-status";
    kachel.appendChild(status);

    let gruppe = null;
    let letzteSpalte = null;
    for (const e of KATALOG.filter((x) => x.art === art)) {
      if (e.spalte !== letzteSpalte) {
        letzteSpalte = e.spalte;
        gruppe = document.createElement("div");
        gruppe.className = "meldung-gruppe";
        const gk = document.createElement("div");
        gk.className = "meldung-gruppenkopf";
        gk.textContent = e.spalte;
        gruppe.appendChild(gk);
        kachel.appendChild(gruppe);
      }
      const zeile = document.createElement("label");
      zeile.className = "meldung-zeile";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = istAn(e.key);
      const txt = document.createElement("span");
      txt.textContent = e.label;
      zeile.append(cb, txt);
      if (e.pflicht) {
        const tag = document.createElement("span");
        tag.className = "meldung-tag";
        tag.textContent = "erst bei naher Frist";
        zeile.appendChild(tag);
      }
      cb.addEventListener("change", async () => {
        cb.disabled = true;
        status.textContent = "";
        try {
          await setzeAn(e.key, cb.checked);
        } catch {
          cb.checked = istAn(e.key);
          status.textContent = "Speichern fehlgeschlagen — der Haken wurde zurückgesetzt.";
        } finally {
          cb.disabled = false;
        }
      });
      gruppe.appendChild(zeile);
    }
    return kachel;
  };
  seiteMeldungen.appendChild(meldungsKachel(
    "warnung", "Warnungen",
    "Rotes Ausrufezeichen auf der Karte: etwas ist falsch oder verstößt gegen eine Regel."));
  seiteMeldungen.appendChild(meldungsKachel(
    "hinweis", "Hinweise",
    "Gelber Info-Kreis auf der Karte: etwas fehlt oder eine Empfehlung greift. Angaben, die die Spalte sperren, melden sich erst, wenn die Frist der Karte gelb oder rot ist."));

  // Seite 2: KI-Rollen (v62, vorher irrefuehrend "Verbindungen" genannt — der Tab enthaelt
  // ausschliesslich KI-Modell-Auswahl je Rolle, keinerlei Verbindungs-/OAuth-UI).
  const seite2 = document.createElement("div");
  seite2.className = "einst-seite";
  const titel2 = document.createElement("div");
  titel2.className = "einst-titel";
  titel2.textContent = "KI-Rollen";
  seite2.appendChild(titel2);

  // --- KI-Modelle je Rolle (v40) ---
  // Drei Rollen mit je eigenem Modell: Userkommunikation laeuft per Default ueber Claude/Abo,
  // Recherche und Kontextabgleich lokal ueber DeepSeek R1. Ein Renderer je Rolle, jede Wahl
  // (Provider + Modell) getrennt in cm-rolle-<rolle> gespeichert (siehe store.js).
  const kiAbschnitt = document.createElement("div");
  kiAbschnitt.className = "einst-abschnitt";
  const kiLabel = document.createElement("div");
  kiLabel.className = "einst-label";
  kiLabel.textContent = "KI-Modelle je Rolle";
  kiAbschnitt.appendChild(kiLabel);
  const kiIntro = document.createElement("p");
  kiIntro.className = "einst-provider-sub";
  kiIntro.textContent =
    "Jede KI-Aufgabe laeuft ueber das Modell ihrer Rolle — je Rolle lokal (kostenlos), ueber Claude oder " +
    "ueber ChatGPT. Standard: Texte an dich ueber Claude, Recherche und Kontextabgleich lokal.";
  kiAbschnitt.appendChild(kiIntro);

  function baueRollenKonfig(rolle) {
    const meta = ROLLEN_META[rolle] || { name: rolle, sub: "" };
    const konfig = rolleKonfig(rolle);

    const wrap = document.createElement("div");
    wrap.className = "einst-rolle";
    const kopf = document.createElement("div");
    kopf.className = "einst-label";
    kopf.textContent = meta.name;
    wrap.appendChild(kopf);
    const sub = document.createElement("p");
    sub.className = "einst-provider-sub";
    sub.textContent = meta.sub;
    wrap.appendChild(sub);

    let ollamaKonfig;
    let claudeKonfig;
    let codexKonfig;

    // Provider-Wahl (lokal vs. Claude) — Radios je Rolle mit eindeutigem name.
    const providerReihe = document.createElement("div");
    providerReihe.className = "einst-provider-reihe";
    const providerOptionen = [
      { id: "ollama", label: "Lokal (Ollama)", sub: "kostenlos · kein Token-Verbrauch · laeuft auf deinem Rechner · Modell unten waehlbar" },
      { id: "claude", label: "Claude (via CLI · dein Abo)", sub: "beste Qualitaet fuer Nutzer-Texte · braucht die eingeloggte Claude-CLI" },
      // v103: ChatGPT ueber die Codex-CLI (Konto oder API-Schluessel)
      { id: "codex", label: "ChatGPT (via Codex-CLI)", sub: "dein ChatGPT-Konto oder ein API-Schluessel · braucht die angemeldete Codex-CLI" },
    ];
    for (const opt of providerOptionen) {
      const label = document.createElement("label");
      label.className = "einst-provider-option" + (konfig.provider === opt.id ? " aktiv" : "");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "ki-provider-" + rolle;
      radio.value = opt.id;
      radio.checked = konfig.provider === opt.id;
      const textWrap = document.createElement("div");
      const lbl = document.createElement("div");
      lbl.className = "einst-provider-label";
      lbl.textContent = opt.label;
      const s = document.createElement("div");
      s.className = "einst-provider-sub";
      s.textContent = opt.sub;
      textWrap.appendChild(lbl);
      textWrap.appendChild(s);
      label.appendChild(radio);
      label.appendChild(textWrap);
      radio.addEventListener("change", () => {
        providerReihe.querySelectorAll(".einst-provider-option").forEach((l) => l.classList.remove("aktiv"));
        label.classList.add("aktiv");
        setzeRolleKonfig(rolle, { provider: opt.id });
        if (ollamaKonfig) ollamaKonfig.style.display = opt.id === "ollama" ? "flex" : "none";
        if (claudeKonfig) claudeKonfig.style.display = opt.id === "claude" ? "flex" : "none";
        if (codexKonfig) codexKonfig.style.display = opt.id === "codex" ? "flex" : "none";
        if (opt.id === "codex") zeigeCodex();
        if (opt.id === "ollama") ladeModelle();
      });
      providerReihe.appendChild(label);
    }
    wrap.appendChild(providerReihe);

    // Ollama-Konfig (nur sichtbar wenn lokal gewaehlt)
    ollamaKonfig = document.createElement("div");
    ollamaKonfig.className = "einst-ollama-konfig";
    ollamaKonfig.style.display = konfig.provider === "ollama" ? "flex" : "none";
    const ladeZeile = document.createElement("div");
    ladeZeile.className = "einst-ping-zeile";
    const ladeBtn = document.createElement("button");
    ladeBtn.className = "chip";
    ladeBtn.textContent = "Neu suchen";
    const ladeStatus = document.createElement("div");
    ladeStatus.className = "einst-ping-status";
    ladeStatus.textContent = "Suche installierte Modelle …";
    ladeZeile.appendChild(ladeBtn);
    ladeZeile.appendChild(ladeStatus);

    const hilfe = document.createElement("details");
    hilfe.className = "einst-ollama-hilfe";
    hilfe.innerHTML =
      `<summary class="einst-label">So installierst du Ollama und ein Modell</summary>` +
      `<p class="einst-provider-sub">Nacheinander im Terminal. Schritt 1 installiert Ollama, ` +
      `Schritt 2 laedt ein Modell: <b>DeepSeek R1</b> passt fuer Recherche und Kontextabgleich, ` +
      `<b>qwen2.5</b> fuer Nutzer-Texte. Danach oben das gewuenschte Modell waehlen.</p>` +
      `<pre class="einst-befehl">winget install Ollama.Ollama</pre>` +
      `<pre class="einst-befehl">ollama pull deepseek-r1</pre>` +
      `<pre class="einst-befehl">ollama pull qwen2.5:14b</pre>`;

    const modellWahl = document.createElement("select");
    modellWahl.className = "einst-modell-select";
    modellWahl.style.display = "none";
    modellWahl.addEventListener("change", () => setzeRolleKonfig(rolle, { ollamaModel: modellWahl.value }));

    async function ladeModelle() {
      ladeBtn.disabled = true;
      ladeStatus.textContent = "Suche installierte Modelle …";
      modellWahl.style.display = "none";
      hilfe.open = false;
      const gewuenscht = rolleKonfig(rolle).ollamaModel;
      try {
        const res = await fetch("/api/ai/ping-ollama", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: gewuenscht }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const d = await res.json();
        if (!d.ok) {
          ladeStatus.textContent = "❌ Ollama laeuft nicht — starte es ueber das Taskleisten-Icon oder mit „ollama serve“.";
          hilfe.open = true;
        } else if (!d.modelle || d.modelle.length === 0) {
          ladeStatus.textContent = "⚠️ Ollama laeuft, aber es ist kein Modell installiert.";
          hilfe.open = true;
        } else {
          modellWahl.innerHTML = "";
          for (const m of d.modelle) {
            const o = document.createElement("option");
            o.value = m;
            o.textContent = m;
            if (m === gewuenscht || m === gewuenscht + ":latest") o.selected = true;
            modellWahl.appendChild(o);
          }
          if (!modellWahl.value && d.modelle.length) modellWahl.value = d.modelle[0];
          setzeRolleKonfig(rolle, { ollamaModel: modellWahl.value });
          modellWahl.style.display = "block";
          ladeStatus.textContent = `✅ ${d.modelle.length} Modell${d.modelle.length !== 1 ? "e" : ""} gefunden`;
        }
      } catch {
        ladeStatus.textContent = "❌ Verbindung fehlgeschlagen — laeuft der Server noch?";
        hilfe.open = true;
      } finally {
        ladeBtn.disabled = false;
      }
    }
    ladeBtn.addEventListener("click", ladeModelle);
    ollamaKonfig.appendChild(ladeZeile);
    ollamaKonfig.appendChild(modellWahl);
    ollamaKonfig.appendChild(hilfe);
    wrap.appendChild(ollamaKonfig);

    // Claude-Konfig (nur sichtbar wenn Claude gewaehlt) — feste Modell-Liste aus lib/ai.js.
    claudeKonfig = document.createElement("div");
    claudeKonfig.className = "einst-ollama-konfig";
    claudeKonfig.style.display = konfig.provider === "claude" ? "flex" : "none";
    {
      const hinweis = document.createElement("div");
      hinweis.className = "einst-ping-status";
      hinweis.textContent = "Welches Claude-Modell diese Rolle benutzt:";
      const wahl = document.createElement("select");
      wahl.className = "einst-modell-select";
      wahl.addEventListener("change", () => setzeRolleKonfig(rolle, { claudeModell: wahl.value }));
      fetch("/api/ai/modelle")
        .then((r) => r.json())
        .then((d) => {
          wahl.innerHTML = "";
          for (const m of d.claude || []) {
            const o = document.createElement("option");
            o.value = m.id;
            o.textContent = `${m.name} — ${m.sub}`;
            if (m.id === konfig.claudeModell) o.selected = true;
            wahl.appendChild(o);
          }
          if (!wahl.value && (d.claude || []).length) wahl.value = d.standard || d.claude[0].id;
        })
        .catch(() => {
          hinweis.textContent = "Die Modell-Liste liess sich nicht laden — laeuft der Server?";
        });
      const claudeHilfe = document.createElement("details");
      claudeHilfe.className = "einst-ollama-hilfe";
      claudeHilfe.innerHTML =
        `<summary class="einst-label">So richtest du die Claude-CLI ein</summary>` +
        `<p class="einst-provider-sub">Einmalig im Terminal. Schritt 1 installiert die CLI, ` +
        `Schritt 2 startet sie fuer den Login mit dem <b>eigenen</b> Claude-Abo (nicht „API key“).</p>` +
        `<pre class="einst-befehl">npm i -g @anthropic-ai/claude-code</pre>` +
        `<pre class="einst-befehl">claude</pre>`;
      claudeKonfig.appendChild(hinweis);
      claudeKonfig.appendChild(wahl);
      claudeKonfig.appendChild(claudeHilfe);
    }
    wrap.appendChild(claudeKonfig);

    // v103: ChatGPT-Konfig — Stand der Codex-CLI, Anmeldung mit Konto oder Schluessel (geht nur an die CLI).
    codexKonfig = document.createElement("div");
    codexKonfig.className = "einst-ollama-konfig";
    codexKonfig.style.display = konfig.provider === "codex" ? "flex" : "none";
    const codexStand = document.createElement("div");
    codexStand.className = "einst-ping-status";
    const codexZeile = document.createElement("div");
    codexZeile.className = "einst-ping-zeile";
    const codexLogin = document.createElement("button");
    codexLogin.className = "chip";
    codexLogin.textContent = "Mit ChatGPT anmelden";
    const codexKey = eingabe("", { typ: "password", platzhalter: "oder OpenAI-API-Schluessel (sk-…)" });
    const codexKeyBtn = document.createElement("button");
    codexKeyBtn.className = "chip";
    codexKeyBtn.textContent = "Mit Schluessel anmelden";
    const codexInfo = document.createElement("div");
    codexInfo.className = "einst-provider-sub";
    codexInfo.textContent = "Der Schluessel geht nur an die Codex-CLI auf diesem Rechner — nicht in Drive, nicht auf GitHub. " +
      "OpenAI: ChatGPT-Plan = persoenliche Nutzung; fuer Automatisierung empfiehlt OpenAI einen API-Schluessel.";
    const codexHilfe = document.createElement("details");
    codexHilfe.className = "einst-ollama-hilfe";
    codexHilfe.innerHTML =
      `<summary class="einst-label">So richtest du die Codex-CLI ein</summary>` +
      `<p class="einst-provider-sub">Einmalig im Terminal installieren, danach oben anmelden.</p>` +
      `<pre class="einst-befehl">npm i -g @openai/codex</pre>`;
    async function zeigeCodex() {
      codexStand.textContent = "Pruefe die Codex-CLI …";
      try {
        const c = await (await fetch("/api/auth/chatgpt/status")).json();
        codexStand.textContent = c.loggedIn
          ? `✅ angemeldet (${c.art === "apikey" ? "API-Schluessel" : "ChatGPT-Konto"})`
          : c.installiert ? "⚠️ nicht angemeldet" : "❌ Codex-CLI nicht installiert";
        codexHilfe.open = !c.installiert;
      } catch {
        codexStand.textContent = "❌ Stand nicht lesbar — laeuft der Server noch?";
      }
    }
    codexLogin.addEventListener("click", async () => {
      codexLogin.disabled = true;
      codexStand.textContent = "Anmeldung laeuft — im Browser oeffnet sich OpenAI …";
      try {
        const r = await (await fetch("/api/auth/chatgpt/start", { method: "POST" })).json();
        if (r.error) codexStand.textContent = "❌ " + r.error;
        else if (r.url) window.open(r.url, "_blank", "noopener");
      } finally {
        codexLogin.disabled = false;
        setTimeout(zeigeCodex, 15000);
      }
    });
    codexKeyBtn.addEventListener("click", async () => {
      if (!codexKey.value.trim()) return;
      codexStand.textContent = "Melde an …";
      const r = await fetch("/api/auth/chatgpt/schluessel", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ schluessel: codexKey.value }),
      }).then((x) => x.json()).catch(() => ({}));
      codexKey.value = "";
      if (r.ok) zeigeCodex(); else codexStand.textContent = "❌ " + (r.grund || r.error || "Anmeldung fehlgeschlagen");
    });
    codexZeile.appendChild(codexLogin);
    codexZeile.appendChild(codexStand);
    codexKonfig.appendChild(codexZeile);
    const codexKeyZeile = document.createElement("div");
    codexKeyZeile.className = "einst-ping-zeile";
    codexKey.style.flex = "1";
    codexKeyZeile.appendChild(codexKey);
    codexKeyZeile.appendChild(codexKeyBtn);
    codexKonfig.appendChild(codexKeyZeile);
    codexKonfig.appendChild(codexInfo);
    codexKonfig.appendChild(codexHilfe);
    wrap.appendChild(codexKonfig);
    if (konfig.provider === "codex") zeigeCodex();

    // Web-Suche der Recherche-Rolle (v40): schluessellos ueber DuckDuckGo (Standard, kein Key).
    // Optional ein Gratis-Tavily-Key fuer stabilere Treffer — bleibt lokal in .env, nie im Repo.
    if (rolle === "recherche") {
      const web = document.createElement("div");
      // v62: eigene Klasse fuer den klar abgesetzten Zusatz-Rahmen (siehe style.css) — bleibt
      // zusaetzlich zu .einst-ollama-konfig fuer den bestehenden Flex-Abstand.
      web.className = "einst-ollama-konfig einst-rolle-zusatz";
      web.style.display = "flex";

      const wLabel = document.createElement("div");
      wLabel.className = "einst-label";
      wLabel.textContent = "Web-Suche";
      const wChip = document.createElement("span");
      wChip.className = "chip chip-fehlt";
      wChip.style.marginLeft = "8px";
      wChip.textContent = "…";
      wLabel.appendChild(wChip);
      web.appendChild(wLabel);

      const wSub = document.createElement("p");
      wSub.className = "einst-provider-sub";
      wSub.textContent =
        "Leer = DuckDuckGo (Standard, kein Key noetig, laeuft sofort). Fuer stabilere Treffer " +
        "optional ein Gratis-Tavily-Key: tavily.com — 1000 Suchen/Monat, keine Karte.";
      web.appendChild(wSub);

      const keyFeld = eingabe("", { typ: "password", platzhalter: "Tavily API-Key (optional)" });
      web.appendChild(keyFeld);

      const reihe = document.createElement("div");
      reihe.className = "einst-ping-zeile";
      const speichern = document.createElement("button");
      speichern.className = "chip";
      speichern.textContent = "Speichern";
      const info = document.createElement("div");
      info.className = "einst-ping-status";
      reihe.appendChild(speichern);
      reihe.appendChild(info);
      web.appendChild(reihe);

      const statusZeigen = async () => {
        try {
          const s = await (await fetch("/api/verbindungen/status")).json();
          const an = !!(s.tavily && s.tavily.konfiguriert);
          wChip.textContent = an ? "Tavily aktiv" : "DuckDuckGo (Standard)";
          wChip.className = "chip " + (an ? "chip-ok" : "chip-hinweis");
        } catch {
          wChip.textContent = "unbekannt";
          wChip.className = "chip chip-fehlt";
        }
      };
      speichern.addEventListener("click", async () => {
        info.textContent = "Speichere …";
        try {
          await fetch("/api/config/env", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key: "TAVILY_API_KEY", value: keyFeld.value.trim() }),
          });
          keyFeld.value = "";
          info.textContent = "Gespeichert in .env.";
          statusZeigen();
        } catch {
          info.textContent = "Speichern fehlgeschlagen.";
        }
      });
      statusZeigen();
      wrap.appendChild(web);
    }

    // v110: optionaler Stil-Zusatz je Rolle (Freitext). Die gemeinsamen Stilregeln stehen unter
    // „Unternehmenskontext"; hier nur, was NUR fuer diese Rolle gilt. Speichert beim Verlassen.
    const stilWrap = document.createElement("div");
    stilWrap.className = "einst-rolle-stil";
    const stilLbl = document.createElement("label");
    stilLbl.className = "einst-provider-sub";
    stilLbl.textContent = "Stil-Zusatz fuer diese Rolle (optional) — ergaenzt „Stil & KI-Verhalten“ im Unternehmenskontext.";
    const stilFeld = document.createElement("textarea");
    stilFeld.className = "kontext-feld";
    stilFeld.rows = 2;
    stilFeld.value = konfig.stilZusatz || "";
    stilFeld.placeholder = "Zum Beispiel: Antworte knapp in Stichpunkten.";
    stilFeld.setAttribute("aria-label", `Stil-Zusatz ${meta.name}`);
    const stilStatus = document.createElement("div");
    stilStatus.className = "einst-ping-status";
    stilFeld.addEventListener("blur", () => {
      if ((rolleKonfig(rolle).stilZusatz || "") === stilFeld.value) return;
      setzeRolleKonfig(rolle, { stilZusatz: stilFeld.value });
      stilStatus.textContent = "✅ gespeichert";
    });
    stilWrap.appendChild(stilLbl);
    stilWrap.appendChild(stilFeld);
    stilWrap.appendChild(stilStatus);
    wrap.appendChild(stilWrap);

    if (konfig.provider === "ollama") ladeModelle();
    return wrap;
  }

  for (const rolle of ROLLEN) kiAbschnitt.appendChild(baueRollenKonfig(rolle));
  seite2.appendChild(kiAbschnitt);

  // --- Seite 3: Externe Dienste (v24) ---
  const seite3 = document.createElement("div");
  seite3.className = "einst-seite";
  const titel3 = document.createElement("div");
  titel3.className = "einst-titel";
  titel3.textContent = "Google";
  seite3.appendChild(titel3);
  const hint3 = document.createElement("p");
  hint3.className = "einst-provider-sub";
  hint3.textContent = "Alle Zugaenge bleiben lokal in .env — nichts davon landet auf GitHub.";
  seite3.appendChild(hint3);
  // v99: Einrichtung + Zuruecksetzen haben eine eigene Seite (Gruppe „System") statt unter den Google-Diensten.
  const seiteSystem = document.createElement("div");
  seiteSystem.className = "einst-seite";
  {
    const t = document.createElement("div");
    t.className = "einst-titel";
    t.textContent = "Einrichtung";
    seiteSystem.appendChild(t);
    const p = document.createElement("p");
    p.className = "einst-provider-sub";
    p.textContent = "Der Assistent führt durch alles, was noch fehlt — er öffnet sich auch beim Start von selbst, solange etwas offen ist.";
    seiteSystem.appendChild(p);
    // v113 (M4, Owner 07.10.2026): was auf diesem Rechner bewusst auf später gelegt ist, bleibt hier sichtbar.
    const spaeterZeile = document.createElement("p");
    spaeterZeile.className = "einst-provider-sub";
    spaeterZeile.hidden = true;
    seiteSystem.appendChild(spaeterZeile);
    const SCHRITT_NAMEN = { google: "Google Kalender + Tasks verbinden" };
    fetch("/api/einrichtung/stand").then((r) => r.json()).then((st) => {
      const aus = (st.lokal && st.lokal.ausgelassen) || [];
      if (!aus.length) return;
      spaeterZeile.textContent = `Bewusst auf später gelegt (der Assistent fragt deswegen nicht mehr von selbst): ${aus.map((id) => SCHRITT_NAMEN[id] || id).join(", ")}. „Einrichtung Schritt für Schritt starten" bietet es wieder an.`;
      spaeterZeile.hidden = false;
    }).catch(() => {});
  }
  // v91: der gefuehrte Durchlauf (Name, Google, Claude, lokale KI, Rollen, Kontext, Prompts, Plan).
  const einrKnopf = knopf("Einrichtung Schritt für Schritt starten", {
    zeichen: "weiter",
    klick: () => {
      overlay.remove();
      import("./einrichtung.js").then((m) => m.starteEinrichtung());
    },
  });
  einrKnopf.classList.add("knopf-inline");
  seiteSystem.appendChild(einrKnopf);

  // v93: Board zuruecksetzen (Owner 01.10.2026) — fuer ein neues Projekt oder um die Einrichtung
  // sauber zu pruefen. Loest das Board vom Ordner; der Drive-Ordner selbst bleibt unberuehrt.
  {
    const ab = document.createElement("div");
    ab.className = "einst-abschnitt einst-zuruecksetzen";
    ab.innerHTML =
      `<div class="einst-label">Board zurücksetzen</div>` +
      `<p class="einst-provider-sub">Löst das Board vom aktuellen Drive-Ordner und leert alle lokalen Zwischenspeicher. ` +
      `Danach startet die Einrichtung von vorn (Ordner wählen …). <b>Die Daten im Drive-Ordner bleiben unverändert</b> ` +
      `— wählst du ihn später wieder, ist alles da. Die Drive-Verbindung bleibt bestehen.</p>`;
    const mitAnm = document.createElement("label");
    mitAnm.className = "einst-check";
    mitAnm.innerHTML = `<input type="checkbox"> Auch Anmeldungen trennen (Google Kalender + Tasks, Instagram, LinkedIn, Claude)`;
    ab.appendChild(mitAnm);
    const k = knopf("Board zurücksetzen", {
      klick: () => {
        const anmeldungen = mitAnm.querySelector("input").checked;
        bestaetigen(
          `Board vom Ordner lösen${anmeldungen ? " und alle Anmeldungen trennen" : ""}? Der Drive-Ordner bleibt unverändert.`,
          "Zurücksetzen",
          async () => {
            const r = await fetch("/api/board/zuruecksetzen", {
              method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ anmeldungen }),
            });
            if (!r.ok) { meldung("Zurücksetzen fehlgeschlagen.", "fehler"); return; }
            try {
              // Board-bezogenes weg; Darstellung (Theme, Cursor, Spaltenbreite) bleibt — gehoert zum Browser.
              for (const key of Object.keys(localStorage))
                if (/^cm-(board-name|rolle-|einrichtung-|auswertung-)/.test(key)) localStorage.removeItem(key);
              sessionStorage.clear();
            } catch {}
            location.reload();
          }
        );
      },
    });
    k.classList.add("knopf-inline", "knopf-gefahr");
    ab.appendChild(k);
    seiteSystem.appendChild(ab);
  }

  const dienstRender = [];
  async function ladeVerbStatus() {
    let s = {};
    try { s = await (await fetch("/api/verbindungen/status")).json(); } catch { s = {}; }
    for (const r of dienstRender) r(s);
  }
  // v40: Trennen — POST an den Trennen-Endpoint, dann Status neu laden (Chip schlaegt um).
  async function trenneDienst(pfad, knopfEl) {
    if (knopfEl) knopfEl.disabled = true;
    try { await fetch(pfad, { method: "POST" }); } catch { /* Netzfehler: Status bleibt */ }
    await ladeVerbStatus();
    if (knopfEl) knopfEl.disabled = false;
  }
  async function putEnv(key, value) {
    if (!value) return;
    await fetch("/api/config/env", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }
  function statusChipEl() {
    const c = document.createElement("span");
    c.className = "chip chip-fehlt";
    c.textContent = "…";
    c.style.marginLeft = "8px";
    return c;
  }
  // v86 (Owner 01.10.2026: „ich sehe nicht, womit ich angemeldet bin, woher die Daten kommen und
  // wohin sie gehen"): drei feste Zeilen unter jeder Anbindung — Datenfluss, Anbindung, Zustand.
  function fuelleVerbInfo(el, d) {
    const zeilen = [];
    if (d.fluss) zeilen.push(`<span class="verb-info-label">Datenfluss</span><span>${escape(d.fluss)}</span>`);
    if (d.anbindung)
      zeilen.push(`<span class="verb-info-label">Anbindung</span><span>${escape(d.anbindung)}` +
        (d.rechte && d.rechte.length ? ` · Rechte: ${escape(d.rechte.join(", "))}` : "") + `</span>`);
    const zeit = (iso) => (iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "");
    const stand = [];
    if (d.grund) stand.push(escape(d.grund));
    if (d.letzterErfolg) stand.push(`zuletzt erfolgreich ${zeit(d.letzterErfolg)}`);
    if (d.verbundenAm) stand.push(`verbunden seit ${zeit(d.verbundenAm)}`);
    if (stand.length) zeilen.push(`<span class="verb-info-label">Zustand</span><span>${stand.join(" · ")}</span>`);
    el.innerHTML = zeilen.map((z) => `<div class="verb-info-zeile">${z}</div>`).join("");
    el.hidden = !zeilen.length;
  }

  // v86: Claude-CLI im Board anmelden. Schritt 1 holt die Anmelde-Adresse von der CLI (Server
  // startet `claude auth login`), Schritt 2 gibt den Code von claude.com an die CLI zurueck.
  function baueClaudeAnmeldung(danach) {
    const el = document.createElement("div");
    el.className = "verb-detail einst-ollama-konfig";
    el.hidden = true;
    const satz = document.createElement("p");
    satz.className = "einst-provider-sub";
    const schritt1 = document.createElement("div");
    const codeFeld = eingabe("", { platzhalter: "Code von claude.com hier einfügen" });
    const info = document.createElement("div");
    info.className = "einst-ping-status";
    const abschliessen = knopf("Anmeldung abschließen", {
      art: "haupt",
      klick: async () => {
        const code = codeFeld.value.trim();
        if (!code) { info.textContent = "Bitte zuerst den Code einfügen."; return; }
        abschliessen.disabled = true;
        info.textContent = "Melde an …";
        try {
          const r = await (await fetch("/api/auth/claude/code", {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }),
          })).json();
          if (r.ok) {
            info.textContent = `Angemeldet${r.email ? ` als ${r.email}` : ""}.`;
            codeFeld.value = "";
            setTimeout(() => { el.hidden = true; danach(); }, 1200);
          } else info.textContent = r.grund || r.error || "Anmeldung fehlgeschlagen.";
        } catch { info.textContent = "Anmeldung fehlgeschlagen."; }
        abschliessen.disabled = false;
      },
    });
    const reihe = document.createElement("div");
    reihe.className = "einst-ping-zeile";
    reihe.appendChild(abschliessen);
    reihe.appendChild(info);
    el.append(satz, schritt1, feld("Code", codeFeld), reihe);

    async function oeffne() {
      el.hidden = false;
      satz.textContent = "Starte die Anmeldung …";
      schritt1.innerHTML = "";
      info.textContent = "";
      try {
        const r = await (await fetch("/api/auth/claude/start", { method: "POST" })).json();
        if (!r.url) throw new Error(r.error || "keine Adresse");
        satz.innerHTML =
          "1. Öffne den Link und melde dich mit deinem Claude-Abo an.<br>" +
          "2. claude.com zeigt danach einen Code — kopiere ihn und füge ihn unten ein.";
        const a = document.createElement("a");
        a.href = r.url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = "Bei Claude anmelden ↗";
        a.className = "verb-link";
        schritt1.appendChild(a); // die CLI oeffnet den Browser meist selbst; der Link ist der Ersatzweg
      } catch (e) {
        satz.textContent = `Die Anmeldung ließ sich nicht starten: ${e.message}. Ist die Claude-CLI installiert (npm i -g @anthropic-ai/claude-code)?`;
      }
    }
    return { el, oeffne };
  }

  function setzeChip(c, verbunden, bereit, hinweisText, zustand) {
    if (zustand === "gestoert") {
      c.textContent = "gestört";
      c.className = "chip chip-hinweis";
      return;
    }
    // v45: liegt ein Hinweis an (z. B. Token abgelaufen), ihn im Chip zeigen — Ton wie
    // „bereit zum Verbinden" (chip-hinweis), kein roter Alarm.
    if (!verbunden && hinweisText) {
      c.textContent = hinweisText;
      c.className = "chip chip-hinweis";
      return;
    }
    c.textContent = verbunden ? "verbunden" : bereit ? "bereit zum Verbinden" : "nicht konfiguriert";
    c.className = "chip " + (verbunden ? "chip-ok" : bereit ? "chip-hinweis" : "chip-fehlt");
  }

  // Verbindungs-Zeile (v62): EIN gemeinsamer Baustein fuer "Externe Dienste" UND "Social
  // Media Kanaele" statt vier von Hand nachgebauter Einzel-Sektionen. Kopf-Zeile (Name,
  // Status, Konto, Trennen) ist IMMER sichtbar; die Einrichtung (Anleitung + ID/Secret-
  // Felder) klappt sich weg, sobald verbunden — sonst waere die "uebersichtliche Liste" ein
  // Dauer-Formular. opt.idKey fehlt => Dienst ohne eigenes Setup (aktuell nur Drive: rclone
  // wird ausserhalb der App konfiguriert). opt.kontoFeld benennt das Statusfeld mit der
  // Konto-Kennung (z. B. "email" bei Google/Claude, "konto" bei Instagram/LinkedIn).
  function baueVerbindungsZeile(container, opt) {
    const zeile = document.createElement("div");
    zeile.className = "verb-zeile";

    const kopf = document.createElement("div");
    kopf.className = "verb-kopf";
    const name = document.createElement("span");
    name.className = "verb-name";
    name.textContent = opt.name;
    kopf.appendChild(name);
    const chip = statusChipEl();
    chip.style.marginLeft = "0";
    kopf.appendChild(chip);
    const konto = document.createElement("span");
    konto.className = "verb-konto";
    konto.hidden = true;
    kopf.appendChild(konto);

    const knoepfe = document.createElement("div");
    knoepfe.className = "verb-knoepfe";
    let detail = null;
    let einrichtenKnopf = null;
    if (opt.idKey) {
      einrichtenKnopf = knopf("Einrichten", { klick: () => { detail.hidden = !detail.hidden; } });
      einrichtenKnopf.classList.add("knopf-inline");
      einrichtenKnopf.style.display = "none";
      knoepfe.appendChild(einrichtenKnopf);
    }
    let trennen = null;
    if (opt.trennenPfad) {
      trennen = knopf("Trennen", { klick: (e) => trenneDienst(opt.trennenPfad, e.currentTarget) });
      trennen.classList.add("knopf-inline");
      trennen.style.display = "none";
      knoepfe.appendChild(trennen);
    }
    // v86: Claude-CLI direkt hier anmelden (vorher nur Terminal-Hinweis).
    let anmeldenKnopf = null;
    let anmeldeBox = null;
    if (opt.claudeAnmelden) {
      anmeldeBox = baueClaudeAnmeldung(() => ladeVerbStatus());
      anmeldenKnopf = knopf("Anmelden", { art: "haupt", klick: () => anmeldeBox.oeffne() });
      anmeldenKnopf.classList.add("knopf-inline");
      anmeldenKnopf.style.display = "none";
      knoepfe.appendChild(anmeldenKnopf);
    }
    kopf.appendChild(knoepfe);
    zeile.appendChild(kopf);

    const info = document.createElement("div");
    info.className = "verb-info";
    info.hidden = true;
    zeile.appendChild(info);
    if (anmeldeBox) zeile.appendChild(anmeldeBox.el);
    dienstRender.push((s) => {
      const d = s[opt.statusKey] || {};
      fuelleVerbInfo(info, d);
      if (anmeldenKnopf) anmeldenKnopf.style.display = d.verbunden ? "none" : "";
    });

    if (opt.text) {
      const t = document.createElement("p");
      t.className = "einst-provider-sub verb-text";
      t.innerHTML = opt.text;
      zeile.appendChild(t);
    }

    if (opt.idKey) {
      detail = document.createElement("div");
      // einst-ollama-konfig liefert die Eingabefeld-Optik (Rand/Hintergrund) wieder, statt sie
      // fuer .verb-detail zu duplizieren.
      detail.className = "verb-detail einst-ollama-konfig";
      const anl = document.createElement("p");
      anl.className = "einst-provider-sub";
      anl.innerHTML = opt.anleitung;
      detail.appendChild(anl);
      const idFeld = eingabe("", { platzhalter: opt.idPlatz });
      const secretFeld = eingabe("", { typ: "password", platzhalter: opt.secretPlatz });
      detail.appendChild(feld(opt.idLabel, idFeld));
      detail.appendChild(feld(opt.secretLabel, secretFeld));
      const reihe = document.createElement("div");
      reihe.className = "einst-ping-zeile";
      const info = document.createElement("div");
      info.className = "einst-ping-status";
      const speichern = knopf("Speichern", {
        klick: async () => {
          info.textContent = "Speichere …";
          try {
            await putEnv(opt.idKey, idFeld.value.trim());
            await putEnv(opt.secretKey, secretFeld.value.trim());
            idFeld.value = ""; secretFeld.value = "";
            info.textContent = "Gespeichert in .env. Jetzt Verbinden.";
            ladeVerbStatus();
          } catch { info.textContent = "Speichern fehlgeschlagen."; }
        },
      });
      const verbinden = knopf("Verbinden", { art: "haupt", klick: () => { window.location.href = opt.connectPfad; } });
      reihe.appendChild(speichern);
      reihe.appendChild(verbinden);
      reihe.appendChild(info);
      detail.appendChild(reihe);
      zeile.appendChild(detail);

      dienstRender.push((s) => {
        const d = s[opt.statusKey] || {};
        setzeChip(chip, d.verbunden, d.clientKonfiguriert, d.hinweis, d.zustand);
        verbinden.disabled = !d.clientKonfiguriert;
        verbinden.style.display = d.verbunden ? "none" : "";
        if (trennen) trennen.style.display = d.verbunden ? "" : "none";
        const kontoWert = opt.kontoFeld ? d[opt.kontoFeld] : "";
        konto.hidden = !kontoWert;
        konto.textContent = kontoWert ? `${opt.kontoLabel || "Konto"}: ${kontoWert}` : "";
        // Verbunden -> Zeile bleibt kurz (Liste statt Dauer-Formular); "Einrichten" holt die
        // Felder bei Bedarf zurueck (z. B. um Zugangsdaten zu wechseln).
        detail.hidden = !!d.verbunden;
        einrichtenKnopf.style.display = d.clientKonfiguriert || d.verbunden ? "" : "none";
      });
    } else {
      dienstRender.push((s) => {
        const d = s[opt.statusKey] || {};
        setzeChip(chip, d.verbunden, false, d.hinweis, d.zustand);
        if (trennen) trennen.style.display = d.verbunden ? "" : "none";
        const kontoWert = opt.kontoFeld ? d[opt.kontoFeld] : "";
        konto.hidden = !kontoWert;
        konto.textContent = kontoWert ? `${opt.kontoLabel || "Konto"}: ${kontoWert}` : "";
      });
    }

    container.appendChild(zeile);
  }

  // Google Drive (v63): eigene Zeile, weil hier statt Zugangsdaten-Feldern ZWEI Wechsel-Wege
  // gebraucht werden — Arbeitsordner (Link einfuegen, pruefen, wechseln) und Google-Konto
  // (rclone-Browser-Anmeldung). Sieht aus wie die anderen Verbindungs-Zeilen.
  function baueDriveZeile(container) {
    const zeile = document.createElement("div");
    zeile.className = "verb-zeile";
    const kopf = document.createElement("div");
    kopf.className = "verb-kopf";
    const name = document.createElement("span");
    name.className = "verb-name";
    name.innerHTML = driveMarke("Arbeitsordner in Google Drive öffnen", "") + " Google Drive";
    // Arbeitsordner-Zeile unten hat schon den Link "in Drive oeffnen"
    kopf.appendChild(name);
    const chip = statusChipEl();
    chip.style.marginLeft = "0";
    kopf.appendChild(chip);
    const konto = document.createElement("span");
    konto.className = "verb-konto";
    konto.hidden = true;
    kopf.appendChild(konto);
    const knoepfe = document.createElement("div");
    knoepfe.className = "verb-knoepfe";
    const ordnerKnopf = knopf("Ordner wechseln", { klick: () => { panel.hidden = !panel.hidden; } });
    ordnerKnopf.classList.add("knopf-inline");
    const kontoKnopf = knopf("Konto wechseln", { klick: () => starteKontoWechsel() });
    kontoKnopf.classList.add("knopf-inline");
    knoepfe.appendChild(ordnerKnopf);
    knoepfe.appendChild(kontoKnopf);
    kopf.appendChild(knoepfe);
    zeile.appendChild(kopf);

    const ordnerZeile = document.createElement("p");
    ordnerZeile.className = "einst-provider-sub verb-text";
    zeile.appendChild(ordnerZeile);
    const driveInfo = document.createElement("div"); // v86: Datenfluss + Anbindung
    driveInfo.className = "verb-info";
    zeile.appendChild(driveInfo);
    dienstRender.push((s) => fuelleVerbInfo(driveInfo, s.drive || {}));
    const kontoInfo = document.createElement("p");
    kontoInfo.className = "einst-provider-sub verb-text";
    kontoInfo.hidden = true;
    zeile.appendChild(kontoInfo);

    const panel = document.createElement("div");
    panel.className = "verb-detail einst-ollama-konfig";
    panel.hidden = true;
    const anl = document.createElement("ol");
    anl.className = "einst-provider-sub verb-anleitung";
    anl.innerHTML =
      "<li>In Google Drive (im gewuenschten Konto) einen <b>neuen, leeren Ordner</b> anlegen.</li>" +
      "<li>Ordner-Link kopieren: Rechtsklick auf den Ordner → <i>Link kopieren</i>.</li>" +
      "<li>Link unten einfuegen und <b>Pruefen</b>.</li>" +
      "<li><b>Wechseln</b>: das Board sichert seinen aktuellen Stand, legt alle Spalten-Ordner im " +
      "neuen Ordner selbst an und laedt neu. Ein frueher genutzter Ordner bringt sein Board zurueck.</li>";
    panel.appendChild(anl);
    const linkFeld = eingabe("", { platzhalter: "https://drive.google.com/drive/folders/…" });
    panel.appendChild(feld("Ordner-Link oder ID", linkFeld));
    const reihe = document.createElement("div");
    reihe.className = "einst-ping-zeile";
    const pruefen = knopf("Pruefen", { klick: () => pruefe() });
    const wechseln = knopf("Wechseln", { art: "haupt", klick: () => wechsle() });
    wechseln.disabled = true;
    const info = document.createElement("div");
    info.className = "einst-ping-status";
    reihe.appendChild(pruefen);
    reihe.appendChild(wechseln);
    reihe.appendChild(info);
    panel.appendChild(reihe);
    zeile.appendChild(panel);
    linkFeld.addEventListener("input", () => { wechseln.disabled = true; info.textContent = ""; });

    async function post(pfad, body) {
      const r = await fetch(pfad, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
      let j = {};
      try { j = await r.json(); } catch { /* keine JSON-Antwort */ }
      return { ok: r.ok, j };
    }
    async function pruefe() {
      info.textContent = "Pruefe den Ordner …";
      wechseln.disabled = true;
      pruefen.disabled = true;
      try {
        const { j } = await post("/api/drive/ordner/pruefen", { eingabe: linkFeld.value });
        info.textContent = (j.ok ? "✅ " : "❌ ") + (j.satz || j.error || "Unbekannter Fehler.");
        wechseln.disabled = !j.ok;
      } catch {
        info.textContent = "❌ Pruefen fehlgeschlagen — laeuft der Server?";
      } finally {
        pruefen.disabled = false;
      }
    }
    function wechsle() {
      bestaetigen(
        "Das Board sichert seinen aktuellen Stand und wechselt in den neuen Ordner. Fortfahren?",
        "Wechseln",
        async () => {
          info.textContent = "Wechsle den Ordner und lege die Struktur an … (kann eine Minute dauern)";
          wechseln.disabled = true;
          pruefen.disabled = true;
          const { ok, j } = await post("/api/drive/ordner/setzen", { eingabe: linkFeld.value });
          if (!ok) {
            info.textContent = "❌ " + (j.satz || j.error || "Wechsel fehlgeschlagen.");
            pruefen.disabled = false;
            return;
          }
          info.textContent = "✅ Fertig — das Board laedt mit dem neuen Stand neu …";
          setTimeout(() => location.reload(), 900);
        }
      );
    }

    let kontoTimer = null;
    async function starteKontoWechsel() {
      kontoKnopf.disabled = true;
      kontoInfo.hidden = false;
      kontoInfo.textContent = "Starte die Anmeldung … im Browser oeffnet sich der Google-Login.";
      try { await post("/api/drive/konto/wechseln"); } catch { /* Abfrage unten zeigt den Stand */ }
      clearInterval(kontoTimer);
      kontoTimer = setInterval(async () => {
        try {
          const st = await (await fetch("/api/drive/konto/wechseln")).json();
          kontoInfo.textContent = st.satz || "";
          if (!st.laeuft) {
            clearInterval(kontoTimer);
            kontoKnopf.disabled = false;
            if (st.ergebnis === "ok") { ladeVerbStatus(); panel.hidden = false; }
          }
        } catch { /* naechster Versuch */ }
      }, 2000);
    }

    dienstRender.push((s) => {
      const d = s.drive || {};
      setzeChip(chip, d.verbunden, false);
      konto.hidden = !d.email;
      konto.textContent = d.email ? `Konto: ${d.email}` : "";
      const link = d.root ? `https://drive.google.com/drive/folders/${d.root}` : "";
      // v86: Name statt ID (die ID steht im Tooltip, falls jemand sie braucht).
      ordnerZeile.innerHTML = d.root
        ? `Arbeitsordner: <b title="ID ${escape(d.root)}">${escape(d.name || d.root)}</b> · <a href="${link}" target="_blank" rel="noopener">in Drive oeffnen</a>` +
          (d.verbunden ? "" : " · <b>nicht erreichbar</b> — Konto oder Ordner pruefen")
        : "Kein Arbeitsordner festgelegt.";
    });

    container.appendChild(zeile);
  }

  // Reihenfolge wie im Owner-Auftrag genannt: Drive, Kalender+Tasks, Claude.
  baueDriveZeile(seite3);
  baueVerbindungsZeile(seite3, {
    name: "Google Kalender + Tasks",
    statusKey: "google", kontoFeld: "email", kontoLabel: "Konto",
    idKey: "GOOGLE_OAUTH_CLIENT_ID", secretKey: "GOOGLE_OAUTH_CLIENT_SECRET",
    connectPfad: "/api/auth/google", trennenPfad: "/api/auth/google/trennen",
    idLabel: "Client-ID", secretLabel: "Client-Secret",
    idPlatz: "Client-ID (…apps.googleusercontent.com)", secretPlatz: "Client-Secret",
    anleitung:
      "1. <b>console.cloud.google.com</b> → Credentials → OAuth client ID (Web application). " +
      "2. Redirect URI: <code>https://localhost:" + location.port + "/api/auth/google/callback</code>. " +
      "3. Client-ID + Secret unten eintragen, Speichern, dann Verbinden. Scopes: Kalender + Tasks.",
  });
  // v99: Claude-Anmeldung gehoert zu den KI-Rollen (oben), nicht zu den Google-Diensten.
  const claudeHalter = document.createElement("div");
  claudeHalter.className = "einst-abschnitt";
  seite2.insertBefore(claudeHalter, titel2.nextSibling);
  baueVerbindungsZeile(claudeHalter, {
    name: "Claude (KI-Texte)",
    statusKey: "claude", kontoFeld: "email", kontoLabel: "Konto",
    trennenPfad: "/api/auth/claude/trennen",
    claudeAnmelden: true,
  });

  const seite4 = document.createElement("div");
  seite4.className = "einst-seite";
  const titel4 = document.createElement("div");
  titel4.className = "einst-titel";
  titel4.textContent = "Social Media";
  seite4.appendChild(titel4);
  // v83: kein Einleitungssatz — „bleiben lokal in .env" steht schon auf der Seite „Externe Dienste".

  // Datenquelle der Auswertung (v24-2): live von den APIs oder aus den Drive-CSVs.
  {
    const ab = document.createElement("div");
    ab.className = "einst-abschnitt";
    const label = document.createElement("div");
    label.className = "einst-label";
    label.textContent = "Datenquelle der Auswertung";
    ab.appendChild(label);
    const hinweis = document.createElement("p");
    hinweis.className = "einst-provider-sub";
    hinweis.textContent = "Woher die Zahlen kommen: frisch von den Plattform-APIs, oder aus den in Google Drive gespeicherten CSVs.";
    ab.appendChild(hinweis);
    ab.appendChild(driveOrtZeile("CSVs liegen in", "Videoauswertung/Auswertung-Tabellen", "Auswertung-Tabellen"));
    let aktQuelle;
    try { aktQuelle = localStorage.getItem("cm-auswertung-quelle") || "api"; } catch { aktQuelle = "api"; }
    const reihe = document.createElement("div");
    reihe.className = "einst-theme-reihe";
    for (const opt of [{ id: "api", name: "Live von den APIs (Standard)" }, { id: "drive", name: "Aus Google Drive", drive: true }]) {
      const l = document.createElement("label");
      l.className = "einst-theme-option" + (aktQuelle === opt.id ? " aktiv" : "");
      const r = document.createElement("input");
      r.type = "radio"; r.name = "ausw-quelle"; r.value = opt.id; r.checked = aktQuelle === opt.id;
      r.addEventListener("change", () => {
        reihe.querySelectorAll(".einst-theme-option").forEach((x) => x.classList.remove("aktiv"));
        l.classList.add("aktiv");
        try { localStorage.setItem("cm-auswertung-quelle", opt.id); } catch {}
      });
      l.appendChild(r);
      const s = document.createElement("span");
      s.textContent = opt.name;
      if (opt.drive) s.insertAdjacentHTML("afterbegin", driveMarke("CSV-Ordner in Google Drive öffnen", "Videoauswertung/Auswertung-Tabellen") + " ");
      l.appendChild(s);
      reihe.appendChild(l);
    }
    ab.appendChild(reihe);
    seite4.appendChild(ab);
  }

  baueVerbindungsZeile(seite4, {
    name: "Instagram",
    statusKey: "instagram", kontoFeld: "konto", kontoLabel: "Konto",
    idKey: "INSTAGRAM_APP_ID", secretKey: "INSTAGRAM_APP_SECRET",
    connectPfad: "/api/auth/instagram", trennenPfad: "/api/auth/instagram/trennen",
    idLabel: "App-ID", secretLabel: "App-Secret",
    idPlatz: "Instagram App-ID", secretPlatz: "App-Secret",
    anleitung:
      "1. <b>developers.facebook.com</b> → App (Typ Business) → Produkt <b>Instagram</b> hinzufuegen. " +
      "2. Redirect: <code>https://localhost:" + location.port + "/api/auth/instagram/callback</code>. " +
      "3. App-ID + Secret unten eintragen. Dein IG-Konto muss als Tester eingeladen und akzeptiert sein.",
  });
  baueVerbindungsZeile(seite4, {
    name: "LinkedIn",
    // v62: LinkedIn haengt an einer Unternehmensseite, nicht an einer Person (orgName,
    // server.js:1318) — Label bewusst "Seite" statt "Konto", nicht erfunden gleichgesetzt.
    statusKey: "linkedin", kontoFeld: "konto", kontoLabel: "Seite",
    idKey: "LINKEDIN_CLIENT_ID", secretKey: "LINKEDIN_CLIENT_SECRET",
    connectPfad: "/api/auth/linkedin", trennenPfad: "/api/auth/linkedin/trennen",
    idLabel: "Client-ID", secretLabel: "Client-Secret",
    idPlatz: "LinkedIn Client-ID", secretPlatz: "Client-Secret",
    anleitung:
      "1. <b>linkedin.com/developers</b> → App anlegen (mit deiner Unternehmensseite). " +
      "2. Redirect: <code>https://localhost:" + location.port + "/api/auth/linkedin/callback</code>. " +
      "3. Client-ID + Secret unten eintragen. Produkte: Community Management / Organization Social.",
  });

  // Seite 5: System Prompts — was hinter jedem KI-Knopf steht (v26).
  const seite5 = document.createElement("div");
  seite5.className = "einst-seite";
  const titel5 = document.createElement("div");
  titel5.className = "einst-titel";
  titel5.textContent = "Prompts";
  seite5.appendChild(titel5);
  seite5.appendChild(driveOrtZeile("Gespeichert in", "System (AI only)", "System (AI only)"));
  const hint5 = document.createElement("p");
  hint5.className = "einst-provider-sub";
  hint5.textContent =
    "Der Vorspann geht in jeden Userkommunikations-Schritt. Darunter ist jeder Knopf eine Kette aus " +
    "Schritten — je Schritt eine Rolle (Modell) und ein Prompt; die Schritte laufen nacheinander. " +
    "Text in {{doppelten Klammern}} setzt das Board beim Aufruf ein — die Legende sagt, was.";
  seite5.appendChild(hint5);
  const promptListe = document.createElement("div");
  promptListe.className = "einst-prompt-liste";
  promptListe.textContent = "Lade …";
  seite5.appendChild(promptListe);

  // Seite 7: Unternehmenskontext (v33) — Firmen-/Markenwissen und Projektwissen, das in
  // jeden KI-Prompt gehen kann. Der Inhalt steckt in public/kontext.js.
  const seite7 = document.createElement("div");
  seite7.className = "einst-seite";
  const titel7 = document.createElement("div");
  titel7.className = "einst-titel";
  titel7.textContent = "Unternehmenskontext";
  seite7.appendChild(titel7);
  seite7.appendChild(driveOrtZeile("Dateien liegen in", "Kontext", "Kontext"));
  const hint7 = document.createElement("p");
  hint7.className = "einst-provider-sub";
  hint7.textContent =
    "Was die KI ueber die Firma wissen soll, fuer die geschrieben wird — als Text und als " +
    "Verweis auf Dateien, lokal oder in Drive. Geht ueber zwei Platzhalter in jeden Prompt.";
  seite7.appendChild(hint7);
  const kontextListe = document.createElement("div");
  kontextListe.className = "kontext-liste";
  kontextListe.textContent = "Lade …";
  seite7.appendChild(kontextListe);

  // Seite 8: Board & Redaktionsplan (v78) — Kategorien/Ziele verwalten; Inhalt in public/boardparameter.js.
  const seiteBoard = document.createElement("div");
  seiteBoard.className = "einst-seite";
  seiteBoard.textContent = "Lade …";

  // v113 (N2, Owner 07.10.2026): Vorbelegungen fuer neue Karten; Inhalt in public/vorbelegung.js.
  const seiteVorbelegung = document.createElement("div");
  seiteVorbelegung.className = "einst-seite";
  seiteVorbelegung.textContent = "Lade …";

  // --- Tabs (v99) ---
  // Owner 01.10.2026: „die Zuordnung links an die Tabs ist sinnlos". Gruppiert nach Thema, benannt nach Inhalt.
  // Vorher hingen Tab und Seite an Positionsnummern (drei Umbauten verschoben „alle folgenden Index-Pruefungen").
  let kontextGeladen = false;
  let promptsGeladen = false;
  let boardparamGeladen = false;
  const TABS = [
    { gruppe: "Board", name: "Termine & Fristen", seite: seiteAnsicht },
    { gruppe: "Board", name: "Mitteilungen", seite: seiteMeldungen },
    {
      gruppe: "Board", name: "Kategorien & Ziele", seite: seiteBoard,
      beimOeffnen: () => {
        if (boardparamGeladen) return;
        boardparamGeladen = true;
        import("./boardparameter.js").then((m) => m.zeichneBoardparameter(seiteBoard));
      },
    },
    {
      gruppe: "Board", name: "Vorbelegungen", seite: seiteVorbelegung,
      // jedes Oeffnen frisch zeichnen — aktive Kategorien/Ziele koennen sich im Nachbar-Tab geaendert haben
      beimOeffnen: () => import("./vorbelegung.js").then((m) => m.zeichneVorbelegung(seiteVorbelegung)),
    },
    {
      gruppe: "Inhalte & KI", name: "Unternehmenskontext", seite: seite7,
      beimOeffnen: () => {
        if (kontextGeladen) return;
        kontextGeladen = true;
        import("./kontext.js").then((m) => m.zeichneKontext(kontextListe));
      },
    },
    {
      gruppe: "Inhalte & KI", name: "Prompts", seite: seite5,
      beimOeffnen: () => { if (!promptsGeladen) { promptsGeladen = true; zeichnePrompts(promptListe); } },
    },
    { gruppe: "Inhalte & KI", name: "KI-Rollen", seite: seite2, beimOeffnen: () => ladeVerbStatus() },
    { gruppe: "Verbindungen", name: "Google", seite: seite3, beimOeffnen: () => ladeVerbStatus() },
    { gruppe: "Verbindungen", name: "Social Media", seite: seite4, beimOeffnen: () => ladeVerbStatus() },
    { gruppe: "System", name: "Darstellung", seite: seite1 },
    { gruppe: "System", name: "Einrichtung", seite: seiteSystem },
  ];
  const navItems = [];
  let gruppeVorher = null;
  for (const tab of TABS) {
    if (tab.gruppe !== gruppeVorher) {
      const kopf = document.createElement("div");
      kopf.className = "einst-nav-gruppe";
      kopf.textContent = tab.gruppe;
      links.appendChild(kopf);
      gruppeVorher = tab.gruppe;
    }
    const btn = document.createElement("button");
    btn.className = "einst-nav-item";
    btn.textContent = tab.name;
    // Tabs, deren Inhalt in Drive liegt (Kontext, Prompts, Kartenmeldungen in defaults.json)
    if (DRIVE_TABS.has(tab.name)) btn.insertAdjacentHTML("beforeend", driveMarke(`Ordner „${DRIVE_TABS.get(tab.name)}" in Google Drive öffnen`, DRIVE_TABS.get(tab.name)));
    links.appendChild(btn);
    navItems.push(btn);
    btn.addEventListener("click", () => zeigeTab(tab, btn));
  }
  function zeigeTab(tab, btn) {
    navItems.forEach((b) => b.classList.remove("aktiv"));
    TABS.forEach((t) => t.seite.classList.remove("aktiv"));
    btn.classList.add("aktiv");
    tab.seite.classList.add("aktiv");
    // v29: Das Fenster hat fuer jeden Tab dieselbe Groesse (public/einstellungen.css).
    if (tab.beimOeffnen) tab.beimOeffnen();
  }
  for (const tab of TABS) rechts.appendChild(tab.seite);
  const startIdx = Math.max(0, TABS.findIndex((t) => t.name === startTab));
  zeigeTab(TABS[startIdx], navItems[startIdx]);

  box.appendChild(links);
  box.appendChild(rechts);

  const schliessen = document.createElement("button");
  schliessen.className = "detail-schliessen einst-schliessen";
  schliessen.setAttribute("aria-label", "Einstellungen schliessen");
  schliessen.innerHTML = icon("schliessen");
  const zu = () => overlay.remove();
  schliessen.addEventListener("click", zu);
  box.appendChild(schliessen);

  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) zu(); });
  document.body.appendChild(overlay);
}

// --- Tab „System Prompts" (v26) -------------------------------------------
//
// Ein Block je KI-Knopf: der Prompt im Textfeld, die Platzhalter-Legende darunter, Speichern
// und Zuruecksetzen. Leerer Text heisst „wieder die Vorlage" — deshalb loescht Zuruecksetzen
// den Eintrag, statt den Standard hineinzukopieren.

// --- Tab „System Prompts" (v41): System-Vorspann + je Knopf ein Schritt-Editor ---------------

// kleine Helfer
function chipKnopf(text) {
  const b = document.createElement("button");
  b.className = "chip";
  b.textContent = text;
  return b;
}
function platzhalterLegende(platzhalter) {
  const legende = document.createElement("div");
  legende.className = "einst-prompt-legende";
  const schluessel = Object.keys(platzhalter || {});
  if (!schluessel.length) return legende;
  legende.innerHTML =
    `<div class="einst-label">Platzhalter</div>` +
    schluessel
      .map(
        (k) =>
          `<div class="einst-prompt-platzhalter"><code>{{${escape(k)}}}</code>` +
          `<span>${escape(platzhalter[k])}</span></div>`
      )
      .join("");
  return legende;
}

// System-Vorspann: EIN Textfeld, unveraendert. Geht in jeden Userkommunikations-Schritt.
function systemBlock(eintrag) {
  const box = document.createElement("details");
  box.className = "einst-prompt";
  box.open = true;
  const kopf = document.createElement("summary");
  kopf.className = "einst-prompt-kopf";
  kopf.innerHTML =
    `<span class="einst-prompt-titel">${escape(eintrag.name)}</span>` +
    `<span class="einst-prompt-marke"></span>`;
  box.appendChild(kopf);
  const marke = kopf.querySelector(".einst-prompt-marke");
  if (eintrag.hinweis) {
    const h = document.createElement("p");
    h.className = "einst-provider-sub";
    h.textContent = eintrag.hinweis;
    box.appendChild(h);
  }
  const feld = document.createElement("textarea");
  feld.className = "einst-prompt-feld";
  feld.rows = 12;
  feld.spellcheck = false;
  feld.value = eintrag.eigen || eintrag.vorlage;
  box.appendChild(feld);
  box.appendChild(platzhalterLegende(eintrag.platzhalter));

  const zeile = document.createElement("div");
  zeile.className = "einst-ping-zeile";
  const speichern = chipKnopf("Speichern");
  const zuruecksetzen = chipKnopf("Auf Standard zuruecksetzen");
  const status = document.createElement("div");
  status.className = "einst-ping-status";
  zeile.append(speichern, zuruecksetzen, status);
  box.appendChild(zeile);

  const zeigeStand = () => {
    const geaendert = feld.value !== eintrag.vorlage;
    marke.textContent = geaendert ? "geaendert" : "Standard";
    marke.classList.toggle("aktiv", geaendert);
    zuruecksetzen.disabled = !geaendert;
  };
  zeigeStand();
  feld.addEventListener("input", zeigeStand);

  async function schicke(text) {
    speichern.disabled = true;
    zuruecksetzen.disabled = true;
    status.textContent = "Speichere …";
    try {
      const res = await fetch("/api/prompts", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "system", text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      eintrag.eigen = text;
      feld.value = text || eintrag.vorlage;
      status.textContent = text ? "✅ Gespeichert — gilt ab dem naechsten Aufruf." : "✅ Zurueck auf die Vorlage.";
    } catch {
      status.textContent = "❌ Speichern fehlgeschlagen — laeuft der Server?";
    } finally {
      speichern.disabled = false;
      zeigeStand();
    }
  }
  speichern.addEventListener("click", () => schicke(feld.value === eintrag.vorlage ? "" : feld.value));
  // v113 (M10): die eigene Fassung war nach einem Klick ohne Rueckfrage weg.
  zuruecksetzen.addEventListener("click", () =>
    bestaetigen("System-Vorspann auf den Standard zurücksetzen? Deine eigene Fassung geht dabei verloren.", "Ja, zurücksetzen", () => schicke("")));
  return box;
}

// Ein KI-Knopf als Schritt-Editor: Liste aus Schritten {rolle, prompt}, jede Rolle waehlbar,
// Schritte hinzufuegen/entfernen/ordnen. Recherche-Schritte suchen automatisch im Web.
function aufgabeBlock(eintrag, rollen, formate = []) {
  const box = document.createElement("details");
  box.className = "einst-prompt";
  const kopf = document.createElement("summary");
  kopf.className = "einst-prompt-kopf";
  const titel = eintrag.knopf ? `Knopf „${eintrag.knopf}"` : eintrag.name;
  kopf.innerHTML =
    `<span class="einst-prompt-titel">${escape(titel)}</span>` +
    `<span class="einst-prompt-ort">${escape(eintrag.ort || "")}</span>` +
    `<span class="einst-prompt-marke"></span>`;
  box.appendChild(kopf);
  const marke = kopf.querySelector(".einst-prompt-marke");

  const hinweis = document.createElement("p");
  hinweis.className = "einst-provider-sub";
  hinweis.textContent =
    "Die Schritte laufen nacheinander, jeder auf dem Modell seiner Rolle. Die Ausgabe eines Schritts " +
    "steht im naechsten als {{vorschritt}}. Der letzte Schritt ist das Ergebnis des Knopfes.";
  box.appendChild(hinweis);

  // v79: Fassungen — "Standard" (Task-Default) plus je Content-Format eine eigene Fassung.
  // Die aktive Fassung bestimmt, welche Schritt-Liste bearbeitet und gespeichert wird.
  let aktivesFormat = null; // null = Standard/Task-Default
  let schritte = [];

  const tabs = document.createElement("div");
  tabs.className = "einst-format-tabs";
  box.appendChild(tabs);

  const liste = document.createElement("div");
  liste.className = "einst-schritt-liste";
  box.appendChild(liste);

  const plus = chipKnopf("+ Schritt");
  plus.classList.add("einst-schritt-plus");
  box.appendChild(plus);
  box.appendChild(platzhalterLegende(eintrag.platzhalter));

  const zeile = document.createElement("div");
  zeile.className = "einst-ping-zeile";
  const speichern = chipKnopf("Speichern");
  const zuruecksetzen = chipKnopf("Auf Standard zuruecksetzen");
  const status = document.createElement("div");
  status.className = "einst-ping-status";
  zeile.append(speichern, zuruecksetzen, status);
  box.appendChild(zeile);

  // Die effektiv aufgeloesten Schritte einer Fassung (Standard = Task-Default, sonst perFormat).
  const quelleFuer = (fmt) => {
    if (fmt == null) return eintrag.schritte || [];
    const pf = (eintrag.perFormat || {})[fmt];
    return (pf && pf.schritte) || [];
  };
  const hatOverride = (fmt) =>
    fmt == null ? !!eintrag.eigen : !!(((eintrag.perFormat || {})[fmt]) || {}).eigen;

  const zeigeStand = () => {
    if (aktivesFormat == null) {
      const st = eintrag.standard || [];
      const gleich =
        schritte.length === st.length &&
        schritte.every((s, i) => s.rolle === st[i].rolle && s.prompt === st[i].prompt && !!s.websuche === !!st[i].websuche);
      marke.textContent = gleich ? "Standard" : "geaendert";
      marke.classList.toggle("aktiv", !gleich);
      zuruecksetzen.disabled = gleich;
      zuruecksetzen.textContent = "Auf Standard zuruecksetzen";
    } else {
      const eigen = hatOverride(aktivesFormat);
      marke.textContent = eigen ? "eigene Fassung" : "erbt Standard";
      marke.classList.toggle("aktiv", eigen);
      zuruecksetzen.disabled = !eigen;
      zuruecksetzen.textContent = "Format-Fassung entfernen";
    }
  };

  function schrittZeile(s, i) {
    const wrap = document.createElement("div");
    wrap.className = "einst-schritt rolle-" + s.rolle;
    const kopfZ = document.createElement("div");
    kopfZ.className = "einst-schritt-kopf";
    const letzter = i === schritte.length - 1;
    const nr = document.createElement("span");
    nr.className = "einst-schritt-nr";
    nr.textContent = letzter ? `Schritt ${i + 1} · Ergebnis` : `Schritt ${i + 1}`;
    const sel = document.createElement("select");
    sel.className = "einst-modell-select einst-schritt-rolle";
    for (const r of rollen) {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.name;
      if (r.id === s.rolle) o.selected = true;
      sel.appendChild(o);
    }
    // v79: Web-Suche je Schritt schaltbar (statt fest an die Recherche-Rolle gebunden).
    const web = document.createElement("label");
    web.className = "einst-schritt-web";
    const webBox = document.createElement("input");
    webBox.type = "checkbox";
    webBox.checked = !!s.websuche;
    const webTxt = document.createElement("span");
    webTxt.textContent = "im Web suchen";
    web.append(webBox, webTxt);
    webBox.addEventListener("change", () => {
      s.websuche = webBox.checked;
      zeigeStand();
    });
    sel.addEventListener("change", () => {
      s.rolle = sel.value;
      wrap.className = "einst-schritt rolle-" + s.rolle;
      zeigeStand();
    });
    const knoepfe = document.createElement("span");
    knoepfe.className = "einst-schritt-knoepfe";
    const hoch = chipKnopf("↑");
    hoch.disabled = i === 0;
    const runter = chipKnopf("↓");
    runter.disabled = i === schritte.length - 1;
    const weg = chipKnopf("✕");
    hoch.addEventListener("click", () => {
      [schritte[i - 1], schritte[i]] = [schritte[i], schritte[i - 1]];
      zeichneSchritte();
    });
    runter.addEventListener("click", () => {
      [schritte[i + 1], schritte[i]] = [schritte[i], schritte[i + 1]];
      zeichneSchritte();
    });
    weg.addEventListener("click", () => {
      schritte.splice(i, 1);
      zeichneSchritte();
    });
    knoepfe.append(hoch, runter, weg);
    kopfZ.append(nr, sel, web, knoepfe);
    wrap.appendChild(kopfZ);
    const feld = document.createElement("textarea");
    feld.className = "einst-prompt-feld";
    feld.rows = 6;
    feld.spellcheck = false;
    feld.value = s.prompt;
    wrap.appendChild(feld);
    // v79: „{{nurJson}}" gehoert nur in den letzten Schritt — dessen Ausgabe wird als JSON gelesen.
    // In einem Zwischenschritt bricht es die Kette (der Schritt liefert JSON statt Text).
    const warn = document.createElement("p");
    warn.className = "einst-provider-sub";
    warn.style.color = "var(--befund, #c0392b)";
    const pruefeWarn = () => {
      const problem = !letzter && /\{\{\s*nurJson\s*\}\}/.test(s.prompt || "");
      warn.hidden = !problem;
      warn.textContent = problem
        ? "„{{nurJson}}“ steht in einem Zwischenschritt — nur der letzte Schritt sollte JSON liefern."
        : "";
    };
    pruefeWarn();
    wrap.appendChild(warn);
    feld.addEventListener("input", () => {
      s.prompt = feld.value;
      pruefeWarn();
      zeigeStand();
    });
    return wrap;
  }

  // v79: Datenfluss-Verbinder zwischen den Schritt-Karten — macht die Kette sichtbar.
  function verbinder() {
    const c = document.createElement("div");
    c.className = "einst-schritt-verbinder";
    c.textContent = "↓ {{vorschritt}}";
    return c;
  }

  function zeichneSchritte() {
    liste.innerHTML = "";
    schritte.forEach((s, i) => {
      if (i > 0) liste.appendChild(verbinder());
      liste.appendChild(schrittZeile(s, i));
    });
    zeigeStand();
  }

  const tabEls = [];
  function ladeFassung(fmt) {
    aktivesFormat = fmt;
    schritte = quelleFuer(fmt).map((s) => ({ rolle: s.rolle, prompt: s.prompt, websuche: !!s.websuche }));
    tabEls.forEach((t) => t.el.classList.toggle("an", t.id === fmt));
    zeichneSchritte();
  }

  for (const def of [{ id: null, name: "Standard" }, ...(formate || [])]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "einst-format-tab";
    b.textContent = def.name;
    b.addEventListener("click", () => {
      status.textContent = "";
      ladeFassung(def.id);
    });
    tabs.appendChild(b);
    tabEls.push({ id: def.id, el: b });
  }

  plus.addEventListener("click", () => {
    schritte.push({ rolle: "userkomm", prompt: "", websuche: false });
    zeichneSchritte();
  });

  async function schicke(nutz) {
    speichern.disabled = true;
    zuruecksetzen.disabled = true;
    status.textContent = "Speichere …";
    try {
      const body = { id: eintrag.id, schritte: nutz };
      if (aktivesFormat != null) body.format = aktivesFormat;
      const res = await fetch("/api/prompts", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const neu = (d.aufgaben || []).find((a) => a.id === eintrag.id);
      if (neu) {
        eintrag.schritte = neu.schritte;
        eintrag.standard = neu.standard;
        eintrag.eigen = neu.eigen;
        eintrag.perFormat = neu.perFormat || eintrag.perFormat;
      }
      ladeFassung(aktivesFormat);
      status.textContent = nutz.length ? "✅ Gespeichert — gilt ab dem naechsten Aufruf." : "✅ Zurueckgesetzt.";
    } catch {
      status.textContent = "❌ Speichern fehlgeschlagen — laeuft der Server?";
    } finally {
      speichern.disabled = false;
      zeigeStand();
    }
  }
  speichern.addEventListener("click", () => schicke(schritte));
  // v113 (M10): Rueckfrage, bevor eine eigene Fassung (Standard oder Format) verworfen wird.
  zuruecksetzen.addEventListener("click", () =>
    bestaetigen(
      aktivesFormat == null
        ? `„${eintrag.name || eintrag.id}" auf den Standard zurücksetzen? Deine eigene Fassung geht dabei verloren.`
        : `Format-Fassung von „${eintrag.name || eintrag.id}" entfernen? Danach gilt wieder der Standard.`,
      "Ja, zurücksetzen",
      () => schicke([])
    ));

  ladeFassung(null);
  return box;
}

async function zeichnePrompts(ziel) {
  ziel.textContent = "Lade …";
  let d;
  try {
    const res = await fetch("/api/prompts");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    d = await res.json();
  } catch {
    ziel.textContent = "Die Prompts liessen sich nicht laden — laeuft der Server?";
    return;
  }
  ziel.innerHTML = "";
  ziel.appendChild(systemBlock(d.system));
  const rollen = d.rollen || [];
  const mitKnopf = (d.aufgaben || []).filter((a) => a.knopf);
  const ohneKnopf = (d.aufgaben || []).filter((a) => !a.knopf);

  const t1 = document.createElement("div");
  t1.className = "einst-label";
  t1.textContent = `Knoepfe mit KI-Funktion (${mitKnopf.length})`;
  ziel.appendChild(t1);
  for (const a of mitKnopf) ziel.appendChild(aufgabeBlock(a, rollen, d.formate));

  if (ohneKnopf.length) {
    const t2 = document.createElement("div");
    t2.className = "einst-label";
    t2.textContent = `Prompts ohne Knopf (${ohneKnopf.length})`;
    ziel.appendChild(t2);
    const h = document.createElement("p");
    h.className = "einst-provider-sub";
    h.textContent = "Diese Prompts sind fertig, es gibt im UI aber noch keinen Knopf dafuer.";
    ziel.appendChild(h);
    for (const a of ohneKnopf) ziel.appendChild(aufgabeBlock(a, rollen, d.formate));
  }
}

export function escape(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// --- Toast-Notifications ---------------------------------------------------

let _stapel = null;
function _bekommStapel() {
  if (!_stapel || !document.body.contains(_stapel)) {
    _stapel = document.createElement("div");
    _stapel.className = "meldung-stapel";
    document.body.appendChild(_stapel);
    // v113 (M7): der Stapel folgt der Detailspalte — er sitzt immer links von ihr.
    window.addEventListener("resize", _platziereStapel);
    const detail = document.getElementById("detail");
    if (detail && typeof ResizeObserver === "function") new ResizeObserver(_platziereStapel).observe(detail);
  }
  _platziereStapel();
  return _stapel;
}

// v113 (M7, Owner 07.10.2026): unten rechts ueber der Zoom-Anzeige, aber nie ueber der Detailspalte — der rechte
// Abstand ist die Breite von Detailspalte samt Zieh-Griff (wenn offen) plus derselbe Rand wie der Zoom (22 px).
function _platziereStapel() {
  if (!_stapel) return;
  const kante = ["detail-griff", "detail"].map((id) => document.getElementById(id)).find((e) => e && e.offsetParent !== null);
  const rechts = kante ? Math.max(0, window.innerWidth - kante.getBoundingClientRect().left) : 0;
  _stapel.style.setProperty("--meldung-rechts", `${Math.round(rechts + 22)}px`);
}

function _schliesseMeldung(el) {
  clearTimeout(Number(el.dataset.timer));
  el.classList.add("meldung-weg");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  // v113 (M7): Im Hintergrundfenster laeuft die Ausblend-Animation nicht zu Ende — `animationend` kam nie, die
  // Meldung blieb halbtransparent stehen und stapelte sich (v112). Nach der Animationsdauer (0,18 s) auf jeden Fall weg.
  setTimeout(() => el.remove(), 400);
}

// Zeigt einen Toast oben rechts. typ: "erfolg" (gruen) | "fehler" (rot).
export function meldung(text, typ = "erfolg") {
  if (typ !== "erfolg") text = verstaendlich(text); // v113 (M6)
  const st = _bekommStapel();
  const el = document.createElement("div");
  el.className = `meldung meldung-${typ}`;
  const iName = typ === "erfolg" ? "check" : "achtung";
  el.innerHTML =
    icon(iName) +
    `<span class="meldung-text">${escape(text)}</span>` +
    `<button class="meldung-schliessen" aria-label="Schliessen">${icon("schliessen")}</button>`;
  el.querySelector(".meldung-schliessen").addEventListener("click", () => _schliesseMeldung(el));
  st.appendChild(el);
  el.dataset.timer = String(setTimeout(() => _schliesseMeldung(el), 10000));
}

// v82: Meldungen an Menschen schreiben, nicht an Entwickler — der rohe Dienst-Text
// („rclone antwortet seit 20 Sekunden nicht.", „(?)" als fehlender Fehlercode) wird ein Satz.
export function verstaendlich(satz) {
  // v82/v113: Anmelde- und Config-Fehler, v115 (v114 N1): rclone-Logzeilen, Google-API-Gruende und JS-Laufzeitfehler —
  // EINE Uebersetzung fuer Server und Browser (lib/fehlertext.js).
  const roh = verstaendlicherFehler(String(satz ?? ""));
  return roh
    .replace(/\s*\[config-schnappschuss:[^\]]*\]/g, "")
    .replace(/\s*\(\?\)/g, "")
    .replace(/https?:\/\/[^\s"']*\?[^\s"']*/g, "…")
    .replace(/rclone antwortet seit (\d+) Sekunden nicht\.?/g, "Drive antwortet nicht (nach $1 Sekunden). Das Board arbeitet mit dem lokalen Stand weiter.")
    .replace(/Drive-Zugriff fehlgeschlagen:\s*(?=Drive antwortet)/g, "")
    .replace(/Zeitueberschreitung nach (\d+) s/g, "Keine Antwort nach $1 Sekunden")
    .replace(/Drive-Zugriff fehlgeschlagen/g, "Drive ist nicht erreichbar");
}

// Persistenter Hinweis-Toast (v52): wie meldung(), aber mit statusChip() (die sechs
// Status-Woerter) statt nur gruen/rot, und OHNE Auto-Timeout — verschwindet erst durch
// aktives Wegklicken. Fuer Hinweise/Fehlermeldungen, die vorher in der festen Kopf-Zeile
// standen und dort leicht uebersehen wurden oder von der naechsten Meldung ueberschrieben.
export function hinweisToast(status, satz) {
  satz = verstaendlich(satz);
  const st = _bekommStapel();
  // v82: Dieselbe Meldung nicht mehrfach stapeln (drei gleiche Drive-Fehler = eine Ursache) —
  // stattdessen zaehlt ein Zaehler am vorhandenen Toast hoch.
  const vorhanden = [...st.querySelectorAll(".meldung-hinweis")].find((m) => m.dataset.satz === satz && !m.classList.contains("meldung-weg"));
  if (vorhanden) {
    const n = Number(vorhanden.dataset.anzahl || 1) + 1;
    vorhanden.dataset.anzahl = String(n);
    let z = vorhanden.querySelector(".meldung-zaehler");
    if (!z) {
      z = document.createElement("span");
      z.className = "meldung-zaehler";
      vorhanden.querySelector(".meldung-text").after(z);
    }
    z.textContent = `×${n}`;
    z.title = `Diese Meldung kam ${n}-mal.`;
    return;
  }
  const el = document.createElement("div");
  el.className = `meldung meldung-hinweis meldung-s-${status}`;
  el.dataset.satz = satz;
  el.innerHTML =
    statusChip(status) +
    `<span class="meldung-text">${escape(satz)}</span>` +
    `<button class="meldung-schliessen" aria-label="Schliessen">${icon("schliessen")}</button>`;
  el.querySelector(".meldung-schliessen").addEventListener("click", () => _schliesseMeldung(el));
  st.appendChild(el);
}

// Wie hinweisToast, aber mit EINER Aktion (v55, 2. Abschnitt): ein fehlgeschlagener Hintergrund-
// Abgleich zeigt so einen „Wiederholen"-Knopf direkt am Hinweis. Klick fuehrt die Aktion aus und
// schliesst den Toast; das X schliesst nur.
export function hinweisToastAktion(status, satz, aktionLabel, onAktion) {
  satz = verstaendlich(satz); // v113 (M6): wie hinweisToast — kein roher Dienst-Text
  const st = _bekommStapel();
  const el = document.createElement("div");
  el.className = "meldung meldung-hinweis";
  el.innerHTML =
    statusChip(status) +
    `<span class="meldung-text">${escape(satz)}</span>`;
  const aktion = knopf(aktionLabel, {
    klick: () => { _schliesseMeldung(el); try { onAktion(); } catch {} },
  });
  aktion.classList.add("meldung-aktion");
  el.appendChild(aktion);
  const zu = document.createElement("button");
  zu.className = "meldung-schliessen";
  zu.setAttribute("aria-label", "Schliessen");
  zu.innerHTML = icon("schliessen");
  zu.addEventListener("click", () => _schliesseMeldung(el));
  el.appendChild(zu);
  st.appendChild(el);
}

// Zeigt einen Bestaetigungs-Toast (ersetzt confirm()). Ruft onJa() bei Bestaetigung.
export function bestaetigen(text, jaText, onJa) {
  const st = _bekommStapel();
  const el = document.createElement("div");
  el.className = "meldung meldung-bestaetigen";

  const kopf = document.createElement("div");
  kopf.className = "meldung-bestaetigen-kopf";
  kopf.innerHTML = icon("achtung") + `<span class="meldung-text">${escape(text)}</span>`;
  el.appendChild(kopf);

  const reihe = document.createElement("div");
  reihe.className = "meldung-bestaetigen-knoepfe";
  const jaBtn = knopf(jaText, {
    art: "gefahr",
    klick: () => { el.remove(); onJa(); },
  });
  const neinBtn = knopf("Abbrechen", { klick: () => el.remove() });
  reihe.appendChild(jaBtn);
  reihe.appendChild(neinBtn);
  el.appendChild(reihe);

  st.appendChild(el);
}

// --- Cache-Kennzeichnung (v81) ----------------------------------------------
//
// Bis der Drive-Abgleich durch ist, zeigt das Board den lokalen Cache. Ein Zeichen, eine Farbe
// (--cache) auf allen Ebenen: Kopf-Plakette, Spaltenkopf, Kachel-Rand, Detail-Abschnitte.
export const CACHE_SATZ = "Cache-Stand — noch nicht mit Drive abgeglichen";

export function cacheZeit(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function cacheMarke(text = "Cache", titel = CACHE_SATZ) {
  const el = document.createElement("span");
  el.className = "cache-marke";
  el.title = titel;
  el.setAttribute("aria-label", titel);
  el.innerHTML = icon("cache") + (text ? `<span>${escape(text)}</span>` : "");
  return el;
}
