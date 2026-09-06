// Bausteine der Oberflaeche. Wer eine Seite baut, nimmt diese — nicht neue.
//
// Geprueft gegen docs/ui-standard.md der Werkbank:
//   Punkt 3  Sechs Status-Woerter, nie Farbe allein — immer ueber statusChip(code).
//   Punkt 5  Kein Unicode-Symbol statt Icon. Alle Zeichen sind Lucide-SVGs aus ICONS.

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
  schliessen: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  uhr: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  extern:
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  funken:
    '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  ziel: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  weiter: '<path d="m9 18 6-6-6-6"/>',
  zurueck: '<path d="m15 18-6-6 6-6"/>',
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
  zahnrad:
    '<circle cx="12" cy="12" r="3"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="m4.22 4.22 1.42 1.42"/><path d="m18.36 18.36 1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="m4.22 19.78 1.42-1.42"/><path d="m18.36 5.64 1.42-1.42"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  mehr: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  // Format-Symbole der Kachel (v29): ersetzen die Plattform-Text-Marken — auf den ersten
  // Blick zaehlt das Format (Reel/Bild/Story/Longform), nicht die Plattform.
  clip: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  bild: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  story:
    '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
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
export function gruppe(titel, anzahl, offen = true) {
  const el = document.createElement("details");
  el.className = "gruppe";
  el.open = offen;
  el.innerHTML =
    `<summary class="gruppe-kopf"><span class="gruppe-titel">${escape(titel)}</span>` +
    (anzahl != null ? `<span class="gruppe-anzahl">${anzahl}</span>` : "") +
    `</summary>`;
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

// Eigenschaft in der schmalen Spalte: festes Label, Wert daneben.
export function eigenschaft(label, wertHtml) {
  return (
    `<div class="eigenschaft"><span class="eigenschaft-label">${escape(label)}</span>` +
    `<span class="eigenschaft-wert">${wertHtml}</span></div>`
  );
}

// Icon-Zeichen, die als farbige Kachel erscheinen (v29, Owner-Grafikstil) statt als
// blosses Strich-Icon — bewusst eine kleine, feste Liste statt aller `zeichen`-Werte:
// Navigations-/Bestaetigungs-Icons (schliessen, weiter, zurueck, check ...) sollen klein
// und unauffaellig bleiben, nur "Datei-Ort"-Symbole tragen die Kachel.
const KACHEL_ZEICHEN = new Set(["ordner"]);

export function knopf(text, { art = "still", zeichen = null, klick = null, titel = "" } = {}) {
  const b = document.createElement("button");
  b.className = `knopf knopf-${art}` + (KACHEL_ZEICHEN.has(zeichen) ? ` knopf-symbol knopf-symbol-${zeichen}` : "");
  b.innerHTML = (zeichen ? icon(zeichen) : "") + `<span>${escape(text)}</span>`;
  if (titel) b.title = titel;
  if (klick) b.addEventListener("click", klick);
  return b;
}

// Live-Panel fuer KI-Laeufe: zeigt den Text, wie die KI ihn schreibt — Beleg, dass gearbeitet wird.
// Rueckgabe: { delta(text), status(text), weg() }.
export function denkPanel(container, titel = "Die KI arbeitet …") {
  const el = document.createElement("div");
  el.className = "denk";
  el.innerHTML =
    `<div class="denk-kopf"><span class="denk-symbol knopf-symbol knopf-symbol-sanduhr">${icon("sanduhr")}</span>` +
    `<span class="denk-titel">${escape(titel)}</span></div>` +
    `<pre class="denk-text"></pre>`;
  container.appendChild(el);
  const textEl = el.querySelector(".denk-text");
  const titelEl = el.querySelector(".denk-titel");
  return {
    el,
    delta(t) {
      textEl.textContent += t;
      textEl.scrollTop = textEl.scrollHeight;
    },
    status(s) {
      if (s) titelEl.textContent = s;
    },
    weg() {
      el.remove();
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
    const heuteISO = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < 42; i++) {
      const tag = new Date(start);
      tag.setDate(start.getDate() + i);
      const iso = tag.toISOString().slice(0, 10);
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

export function auswahl(optionen, wert, { leerText = null } = {}) {
  const s = document.createElement("select");
  s.className = "eingabe";
  if (leerText) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = leerText;
    s.appendChild(o);
  }
  for (const opt of optionen) {
    const o = document.createElement("option");
    o.value = opt.id ?? opt;
    o.textContent = opt.name ?? opt;
    s.appendChild(o);
  }
  s.value = wert ?? "";
  return s;
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
  return () => box.remove();
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

// Einstellungs-Modal: zentriertes Popup, Liste links, Inhalt rechts.
export function einstellungenModal(onThemeChange) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal einstellungen-modal";

  // --- Navigation (links) ---
  const links = document.createElement("nav");
  links.className = "einst-nav";
  const navItems = [];
  for (const name of ["Darstellung", "Verbindungen", "Externe Dienste", "Social Media Kanäle", "Unternehmenskontext", "System Prompts", "Workflows"]) {
    const btn = document.createElement("button");
    btn.className = "einst-nav-item" + (name === "Darstellung" ? " aktiv" : "");
    btn.textContent = name;
    links.appendChild(btn);
    navItems.push(btn);
  }

  // --- Inhalt (rechts) ---
  const rechts = document.createElement("div");
  rechts.className = "einst-inhalt";

  // Seite 1: Darstellung
  const seite1 = document.createElement("div");
  seite1.className = "einst-seite aktiv";
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
  seite1.appendChild(themeReihe);

  // Seite 2: Verbindungen
  const seite2 = document.createElement("div");
  seite2.className = "einst-seite";
  const titel2 = document.createElement("div");
  titel2.className = "einst-titel";
  titel2.textContent = "Verbindungen";
  seite2.appendChild(titel2);

  const kiAbschnitt = document.createElement("div");
  kiAbschnitt.className = "einst-abschnitt";
  const kiLabel = document.createElement("div");
  kiLabel.className = "einst-label";
  kiLabel.textContent = "KI-Anbieter";
  kiAbschnitt.appendChild(kiLabel);

  // Standard ist Ollama: lokal und ohne Token-Verbrauch (v26).
  let aktuellerProvider;
  try { aktuellerProvider = localStorage.getItem("cm-ai-provider") || "ollama"; } catch { aktuellerProvider = "ollama"; }
  let aktuellesModell;
  try { aktuellesModell = localStorage.getItem("cm-ollama-model") || "llama3.2"; } catch { aktuellesModell = "llama3.2"; }
  let aktuellesClaudeModell;
  try { aktuellesClaudeModell = localStorage.getItem("cm-claude-modell") || "haiku"; } catch { aktuellesClaudeModell = "haiku"; }

  const providerOptionen = [
    {
      id: "ollama",
      label: "Ollama (lokal · kostenlos)",
      sub: "Standard · kein Token-Verbrauch · läuft auf deinem Rechner · install: winget install Ollama.Ollama",
    },
    {
      id: "claude",
      label: "Claude (via CLI)",
      sub: "Läuft über dein Claude-Abo · keine separate Installation",
    },
  ];
  const providerReihe = document.createElement("div");
  providerReihe.className = "einst-provider-reihe";
  let ollamaKonfig;
  let claudeKonfig;

  for (const opt of providerOptionen) {
    const label = document.createElement("label");
    label.className = "einst-provider-option" + (aktuellerProvider === opt.id ? " aktiv" : "");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "ki-provider";
    radio.value = opt.id;
    radio.checked = aktuellerProvider === opt.id;
    const textWrap = document.createElement("div");
    const lbl = document.createElement("div");
    lbl.className = "einst-provider-label";
    lbl.textContent = opt.label;
    const sub = document.createElement("div");
    sub.className = "einst-provider-sub";
    sub.textContent = opt.sub;
    textWrap.appendChild(lbl);
    textWrap.appendChild(sub);
    label.appendChild(radio);
    label.appendChild(textWrap);
    radio.addEventListener("change", () => {
      providerReihe.querySelectorAll(".einst-provider-option").forEach((l) => l.classList.remove("aktiv"));
      label.classList.add("aktiv");
      try { localStorage.setItem("cm-ai-provider", opt.id); } catch {}
      if (ollamaKonfig) ollamaKonfig.style.display = opt.id === "ollama" ? "flex" : "none";
      if (claudeKonfig) claudeKonfig.style.display = opt.id === "claude" ? "flex" : "none";
      if (opt.id === "ollama") ladeModelle();
    });
    providerReihe.appendChild(label);
  }
  kiAbschnitt.appendChild(providerReihe);

  // Ollama-Konfiguration (nur sichtbar wenn Ollama gewählt)
  ollamaKonfig = document.createElement("div");
  ollamaKonfig.className = "einst-ollama-konfig";
  ollamaKonfig.style.display = aktuellerProvider === "ollama" ? "flex" : "none";

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

  // Ist nichts installiert (oder Ollama laeuft nicht), zeigt das Board die Befehle, die es
  // in Gang bringen — statt den Nutzer raten zu lassen (v26, Owner-Auftrag 04.09.2026).
  const hilfe = document.createElement("div");
  hilfe.className = "einst-ollama-hilfe";
  hilfe.hidden = true;
  hilfe.innerHTML =
    `<div class="einst-label">So bekommst du ein Modell</div>` +
    `<p class="einst-provider-sub">Nacheinander im Terminal ausfuehren. Das 14b-Modell reicht ` +
    `fuer Hooks und Captions und laeuft auf schwaecherer Hardware; 32b schreibt merklich besser, ` +
    `braucht aber mehr Speicher.</p>` +
    `<pre class="einst-befehl">winget install Ollama.Ollama</pre>` +
    `<pre class="einst-befehl">ollama pull qwen2.5:14b</pre>` +
    `<pre class="einst-befehl">ollama pull qwen2.5:32b</pre>`;

  const modellWahl = document.createElement("select");
  modellWahl.className = "einst-modell-select";
  modellWahl.style.display = "none";
  const standardOpt = document.createElement("option");
  standardOpt.value = aktuellesModell;
  standardOpt.textContent = aktuellesModell;
  modellWahl.appendChild(standardOpt);
  modellWahl.addEventListener("change", () => {
    try { localStorage.setItem("cm-ollama-model", modellWahl.value); } catch {}
  });

  async function ladeModelle() {
    ladeBtn.disabled = true;
    ladeStatus.textContent = "Suche installierte Modelle …";
    modellWahl.style.display = "none";
    hilfe.hidden = true;
    try {
      const res = await fetch("/api/ai/ping-ollama", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: aktuellesModell }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (!d.ok) {
        ladeStatus.textContent = "❌ Ollama laeuft nicht — starte es ueber das Taskleisten-Icon oder mit „ollama serve“.";
        hilfe.hidden = false;
      } else if (!d.modelle || d.modelle.length === 0) {
        ladeStatus.textContent = "⚠️ Ollama laeuft, aber es ist kein Modell installiert.";
        hilfe.hidden = false;
      } else {
        const gespeichert = (() => { try { return localStorage.getItem("cm-ollama-model") || ""; } catch { return ""; } })();
        modellWahl.innerHTML = "";
        for (const m of d.modelle) {
          const o = document.createElement("option");
          o.value = m;
          o.textContent = m;
          if (m === gespeichert || m === gespeichert + ":latest") o.selected = true;
          modellWahl.appendChild(o);
        }
        if (!modellWahl.value && d.modelle.length) modellWahl.value = d.modelle[0];
        try { localStorage.setItem("cm-ollama-model", modellWahl.value); } catch {}
        modellWahl.style.display = "block";
        ladeStatus.textContent = `✅ ${d.modelle.length} Modell${d.modelle.length !== 1 ? "e" : ""} gefunden`;
      }
    } catch {
      ladeStatus.textContent = "❌ Verbindung fehlgeschlagen — laeuft der Server noch?";
      hilfe.hidden = false;
    } finally {
      ladeBtn.disabled = false;
    }
  }

  ladeBtn.addEventListener("click", ladeModelle);

  ollamaKonfig.appendChild(ladeZeile);
  ollamaKonfig.appendChild(modellWahl);
  ollamaKonfig.appendChild(hilfe);
  kiAbschnitt.appendChild(ollamaKonfig);

  // Claude-Modell (v26): dieselbe Auswahl-Logik wie bei Ollama, nur mit fester Liste.
  // Standard ist Haiku — schnellste Antwort und der kleinste Verbrauch.
  claudeKonfig = document.createElement("div");
  claudeKonfig.className = "einst-ollama-konfig";
  claudeKonfig.style.display = aktuellerProvider === "claude" ? "flex" : "none";
  {
    const hinweis = document.createElement("div");
    hinweis.className = "einst-ping-status";
    hinweis.textContent = "Welches Claude-Modell die Knoepfe benutzen:";
    const wahl = document.createElement("select");
    wahl.className = "einst-modell-select";
    wahl.addEventListener("change", () => {
      try { localStorage.setItem("cm-claude-modell", wahl.value); } catch {}
    });
    // Die Liste steht in lib/ai.js und kommt von dort — nicht hier zweitgeschrieben.
    fetch("/api/ai/modelle")
      .then((r) => r.json())
      .then((d) => {
        wahl.innerHTML = "";
        for (const m of d.claude || []) {
          const o = document.createElement("option");
          o.value = m.id;
          o.textContent = `${m.name} — ${m.sub}`;
          if (m.id === aktuellesClaudeModell) o.selected = true;
          wahl.appendChild(o);
        }
        if (!wahl.value && (d.claude || []).length) wahl.value = d.standard || d.claude[0].id;
      })
      .catch(() => {
        hinweis.textContent = "Die Modell-Liste liess sich nicht laden — laeuft der Server?";
      });
    claudeKonfig.appendChild(hinweis);
    claudeKonfig.appendChild(wahl);
  }
  kiAbschnitt.appendChild(claudeKonfig);
  seite2.appendChild(kiAbschnitt);

  // --- Seite 3: Externe Dienste (v24) ---
  const seite3 = document.createElement("div");
  seite3.className = "einst-seite";
  const titel3 = document.createElement("div");
  titel3.className = "einst-titel";
  titel3.textContent = "Externe Dienste";
  seite3.appendChild(titel3);
  const hint3 = document.createElement("p");
  hint3.className = "einst-provider-sub";
  hint3.textContent = "Alle Zugaenge bleiben lokal in .env — nichts davon landet auf GitHub.";
  seite3.appendChild(hint3);

  const dienstRender = [];
  async function ladeVerbStatus() {
    let s = {};
    try { s = await (await fetch("/api/verbindungen/status")).json(); } catch { s = {}; }
    for (const r of dienstRender) r(s);
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
  function setzeChip(c, verbunden, bereit) {
    c.textContent = verbunden ? "verbunden" : bereit ? "bereit zum Verbinden" : "nicht konfiguriert";
    c.className = "chip " + (verbunden ? "chip-ok" : bereit ? "chip-hinweis" : "chip-fehlt");
  }

  // Google Kalender + Tasks
  {
    const ab = document.createElement("div");
    ab.className = "einst-abschnitt";
    const label = document.createElement("div");
    label.className = "einst-label";
    label.textContent = "Google Kalender + Tasks";
    const chip = statusChipEl();
    label.appendChild(chip);
    ab.appendChild(label);

    const anleitung = document.createElement("p");
    anleitung.className = "einst-provider-sub";
    anleitung.innerHTML =
      "1. <b>console.cloud.google.com</b> → Credentials → OAuth client ID (Web application). " +
      "2. Redirect URI: <code>https://localhost:4321/api/auth/google/callback</code>. " +
      "3. Client-ID + Secret unten eintragen, Speichern, dann Verbinden. Scopes: Kalender + Tasks.";
    ab.appendChild(anleitung);

    const idFeld = eingabe("", { platzhalter: "Client-ID (…apps.googleusercontent.com)" });
    const secretFeld = eingabe("", { typ: "password", platzhalter: "Client-Secret" });
    ab.appendChild(feld("Client-ID", idFeld));
    ab.appendChild(feld("Client-Secret", secretFeld));

    const reihe = document.createElement("div");
    reihe.className = "einst-ping-zeile";
    const info = document.createElement("div");
    info.className = "einst-ping-status";
    const speichern = knopf("Speichern", {
      klick: async () => {
        info.textContent = "Speichere …";
        try {
          await putEnv("GOOGLE_OAUTH_CLIENT_ID", idFeld.value.trim());
          await putEnv("GOOGLE_OAUTH_CLIENT_SECRET", secretFeld.value.trim());
          idFeld.value = ""; secretFeld.value = "";
          info.textContent = "Gespeichert in .env. Jetzt Verbinden.";
          ladeVerbStatus();
        } catch { info.textContent = "Speichern fehlgeschlagen."; }
      },
    });
    const verbinden = knopf("Verbinden", { art: "haupt", klick: () => { window.location.href = "/api/auth/google"; } });
    reihe.appendChild(speichern);
    reihe.appendChild(verbinden);
    reihe.appendChild(info);
    ab.appendChild(reihe);
    seite3.appendChild(ab);

    dienstRender.push((s) => {
      const g = s.google || {};
      setzeChip(chip, g.verbunden, g.clientKonfiguriert);
      verbinden.disabled = !g.clientKonfiguriert;
    });
  }

  // Google Drive (rclone) — Status + Hinweis; volle Einrichtung folgt in v24
  {
    const ab = document.createElement("div");
    ab.className = "einst-abschnitt";
    const label = document.createElement("div");
    label.className = "einst-label";
    label.textContent = "Google Drive";
    const chip = statusChipEl();
    label.appendChild(chip);
    ab.appendChild(label);
    const t = document.createElement("p");
    t.className = "einst-provider-sub";
    t.textContent = "Drive laeuft ueber das rclone-Remote 'gdrive'. Ist es verbunden, findet das Board die Projektordner.";
    ab.appendChild(t);
    seite3.appendChild(ab);
    dienstRender.push((s) => setzeChip(chip, (s.drive || {}).verbunden, false));
  }

  // Claude (KI-Texte) — laeuft ueber die Claude-CLI / dein Abo
  {
    const ab = document.createElement("div");
    ab.className = "einst-abschnitt";
    const label = document.createElement("div");
    label.className = "einst-label";
    label.textContent = "Claude (KI-Texte)";
    const chip = statusChipEl();
    label.appendChild(chip);
    ab.appendChild(label);
    const t = document.createElement("p");
    t.className = "einst-provider-sub";
    t.innerHTML =
      "Die KI-Texte laufen ueber deine <b>Claude-CLI</b> (dein Abo, keine API-Kosten). " +
      "Nicht verbunden? Einmal im Terminal <code>claude</code> starten und einloggen, dann das Board neu starten.";
    ab.appendChild(t);
    seite3.appendChild(ab);
    dienstRender.push((s) => setzeChip(chip, (s.claude || {}).verbunden, false));
  }

  // --- Seite 4: Social Media Kanaele (v24-2) ---
  // Generischer Dienst mit ID/Secret-Feldern -> .env, Verbinden-Redirect, Status-Chip.
  function baueApiDienst(container, opt) {
    const ab = document.createElement("div");
    ab.className = "einst-abschnitt";
    const label = document.createElement("div");
    label.className = "einst-label";
    label.textContent = opt.name;
    const chip = statusChipEl();
    label.appendChild(chip);
    ab.appendChild(label);
    const anl = document.createElement("p");
    anl.className = "einst-provider-sub";
    anl.innerHTML = opt.anleitung;
    ab.appendChild(anl);
    const idFeld = eingabe("", { platzhalter: opt.idPlatz });
    const secretFeld = eingabe("", { typ: "password", platzhalter: opt.secretPlatz });
    ab.appendChild(feld(opt.idLabel, idFeld));
    ab.appendChild(feld(opt.secretLabel, secretFeld));
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
    ab.appendChild(reihe);
    container.appendChild(ab);
    dienstRender.push((s) => {
      const d = s[opt.statusKey] || {};
      setzeChip(chip, d.verbunden, d.clientKonfiguriert);
      verbinden.disabled = !d.clientKonfiguriert;
    });
  }

  const seite4 = document.createElement("div");
  seite4.className = "einst-seite";
  const titel4 = document.createElement("div");
  titel4.className = "einst-titel";
  titel4.textContent = "Social Media Kanäle";
  seite4.appendChild(titel4);
  const hint4 = document.createElement("p");
  hint4.className = "einst-provider-sub";
  hint4.textContent = "APIs der Kanaele verbinden — App-ID/Secret bleiben lokal in .env.";
  seite4.appendChild(hint4);

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
    let aktQuelle;
    try { aktQuelle = localStorage.getItem("cm-auswertung-quelle") || "api"; } catch { aktQuelle = "api"; }
    const reihe = document.createElement("div");
    reihe.className = "einst-theme-reihe";
    for (const opt of [{ id: "api", name: "Live von den APIs (Standard)" }, { id: "drive", name: "Aus Google Drive" }]) {
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
      l.appendChild(s);
      reihe.appendChild(l);
    }
    ab.appendChild(reihe);
    seite4.appendChild(ab);
  }

  baueApiDienst(seite4, {
    name: "Instagram",
    idKey: "INSTAGRAM_APP_ID", secretKey: "INSTAGRAM_APP_SECRET",
    connectPfad: "/api/auth/instagram", statusKey: "instagram",
    idLabel: "App-ID", secretLabel: "App-Secret",
    idPlatz: "Instagram App-ID", secretPlatz: "App-Secret",
    anleitung:
      "1. <b>developers.facebook.com</b> → App (Typ Business) → Produkt <b>Instagram</b> hinzufuegen. " +
      "2. Redirect: <code>https://localhost:4321/api/auth/instagram/callback</code>. " +
      "3. App-ID + Secret unten eintragen. Dein IG-Konto muss als Tester eingeladen und akzeptiert sein.",
  });
  baueApiDienst(seite4, {
    name: "LinkedIn",
    idKey: "LINKEDIN_CLIENT_ID", secretKey: "LINKEDIN_CLIENT_SECRET",
    connectPfad: "/api/auth/linkedin", statusKey: "linkedin",
    idLabel: "Client-ID", secretLabel: "Client-Secret",
    idPlatz: "LinkedIn Client-ID", secretPlatz: "Client-Secret",
    anleitung:
      "1. <b>linkedin.com/developers</b> → App anlegen (mit deiner Unternehmensseite). " +
      "2. Redirect: <code>https://localhost:4321/api/auth/linkedin/callback</code>. " +
      "3. Client-ID + Secret unten eintragen. Produkte: Community Management / Organization Social.",
  });

  // Seite 5: System Prompts — was hinter jedem KI-Knopf steht (v26).
  const seite5 = document.createElement("div");
  seite5.className = "einst-seite";
  const titel5 = document.createElement("div");
  titel5.className = "einst-titel";
  titel5.textContent = "System Prompts";
  seite5.appendChild(titel5);
  const hint5 = document.createElement("p");
  hint5.className = "einst-provider-sub";
  hint5.textContent =
    "Der Vorspann geht in jeden Aufruf, darunter steht je Knopf der Prompt, den er ausloest. " +
    "Text in {{doppelten Klammern}} setzt das Board beim Aufruf ein — die Legende darunter sagt, was.";
  seite5.appendChild(hint5);
  const promptListe = document.createElement("div");
  promptListe.className = "einst-prompt-liste";
  promptListe.textContent = "Lade …";
  seite5.appendChild(promptListe);

  // Seite 6: Workflows — alle Automationen des Boards (v26).
  const seite6 = document.createElement("div");
  seite6.className = "einst-seite";
  const titel6 = document.createElement("div");
  titel6.className = "einst-titel";
  titel6.textContent = "Workflows";
  seite6.appendChild(titel6);
  const hint6 = document.createElement("p");
  hint6.className = "einst-provider-sub";
  hint6.textContent =
    "Alles, was das Board von selbst tut — eingebaut oder selbst gebaut, in einer Form: " +
    "Wenn · Und · Dann. Jede Kachel sagt, ob sie wirklich laeuft oder fest im Code haengt.";
  seite6.appendChild(hint6);
  const wfListe = document.createElement("div");
  wfListe.className = "einst-wf-liste";
  wfListe.textContent = "Lade …";
  seite6.appendChild(wfListe);

  // Seite 7: Unternehmenskontext (v33) — Firmen-/Markenwissen und Projektwissen, das in
  // jeden KI-Prompt gehen kann. Der Inhalt steckt in public/kontext.js.
  const seite7 = document.createElement("div");
  seite7.className = "einst-seite";
  const titel7 = document.createElement("div");
  titel7.className = "einst-titel";
  titel7.textContent = "Unternehmenskontext";
  seite7.appendChild(titel7);
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

  rechts.appendChild(seite1);
  rechts.appendChild(seite2);
  rechts.appendChild(seite3);
  rechts.appendChild(seite4);
  rechts.appendChild(seite7);
  rechts.appendChild(seite5);
  rechts.appendChild(seite6);

  // --- Tab-Switching ---
  const seiten = [seite1, seite2, seite3, seite4, seite7, seite5, seite6];
  let kontextGeladen = false;
  let promptsGeladen = false;
  let wfGeladen = false;
  navItems.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      navItems.forEach((b) => b.classList.remove("aktiv"));
      seiten.forEach((s) => s.classList.remove("aktiv"));
      btn.classList.add("aktiv");
      seiten[i].classList.add("aktiv");
      // v29: Das Fenster hat fuer jeden Tab dieselbe Groesse (public/einstellungen.css).
      // Frueher wurde hier auf „breit" umgeschaltet — das liess das Fenster bei jedem Klick
      // springen und half den vier schmalen Tabs nicht, die dadurch abgeschnitten waren.
      // Verbindungen-Tab: Modelle sofort laden wenn Ollama bereits gesetzt
      // Verbindungen-Tab: das Board sucht die Ollama-Modelle immer selbst (v26).
      if (i === 1) ladeModelle();
      // Externe Dienste / Social Media Kanaele: Verbindungsstatus frisch holen
      if (i === 2 || i === 3) ladeVerbStatus();
      if (i === 4 && !kontextGeladen) {
        kontextGeladen = true;
        import("./kontext.js").then((m) => m.zeichneKontext(kontextListe));
      }
      if (i === 5 && !promptsGeladen) { promptsGeladen = true; zeichnePrompts(promptListe); }
      if (i === 6 && !wfGeladen) { wfGeladen = true; zeichneWorkflows(wfListe); }
    });
  });

  // Das Board sucht die installierten Modelle immer selbst — der Nutzer soll nicht erst
  // einen Knopf finden muessen (v26, Owner-Auftrag 04.09.2026).
  setTimeout(() => ladeModelle(), 50);

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

function promptBlock(eintrag, offen) {
  const box = document.createElement("details");
  box.className = "einst-prompt";
  box.open = !!offen;

  const kopf = document.createElement("summary");
  kopf.className = "einst-prompt-kopf";
  const titel = eintrag.knopf ? `Knopf „${eintrag.knopf}"` : eintrag.name;
  kopf.innerHTML =
    `<span class="einst-prompt-titel">${escape(titel)}</span>` +
    `<span class="einst-prompt-ort">${escape(eintrag.ort || "")}</span>` +
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
  feld.rows = 14;
  feld.spellcheck = false;
  feld.value = eintrag.eigen || eintrag.vorlage;
  box.appendChild(feld);

  const schluessel = Object.keys(eintrag.platzhalter || {});
  if (schluessel.length) {
    const legende = document.createElement("div");
    legende.className = "einst-prompt-legende";
    legende.innerHTML =
      `<div class="einst-label">Platzhalter</div>` +
      schluessel
        .map(
          (k) =>
            `<div class="einst-prompt-platzhalter"><code>{{${escape(k)}}}</code>` +
            `<span>${escape(eintrag.platzhalter[k])}</span></div>`
        )
        .join("");
    box.appendChild(legende);
  }

  const zeile = document.createElement("div");
  zeile.className = "einst-ping-zeile";
  const speichern = document.createElement("button");
  speichern.className = "chip";
  speichern.textContent = "Speichern";
  const zuruecksetzen = document.createElement("button");
  zuruecksetzen.className = "chip";
  zuruecksetzen.textContent = "Auf Standard zuruecksetzen";
  const status = document.createElement("div");
  status.className = "einst-ping-status";
  zeile.appendChild(speichern);
  zeile.appendChild(zuruecksetzen);
  zeile.appendChild(status);
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
        body: JSON.stringify({ id: eintrag.id, text }),
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
  zuruecksetzen.addEventListener("click", () => schicke(""));
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

  ziel.appendChild(promptBlock(d.system, true));

  const mitKnopf = (d.aufgaben || []).filter((a) => a.knopf);
  const ohneKnopf = (d.aufgaben || []).filter((a) => !a.knopf);

  const t1 = document.createElement("div");
  t1.className = "einst-label";
  t1.textContent = `Knoepfe mit KI-Funktion (${mitKnopf.length})`;
  ziel.appendChild(t1);
  for (const a of mitKnopf) ziel.appendChild(promptBlock(a, false));

  if (ohneKnopf.length) {
    const t2 = document.createElement("div");
    t2.className = "einst-label";
    t2.textContent = `Prompts ohne Knopf (${ohneKnopf.length})`;
    ziel.appendChild(t2);
    const h = document.createElement("p");
    h.className = "einst-provider-sub";
    h.textContent = "Diese Prompts sind fertig, es gibt im UI aber noch keinen Knopf dafuer.";
    ziel.appendChild(h);
    for (const a of ohneKnopf) ziel.appendChild(promptBlock(a, false));
  }
}

// --- Tab „Workflows": der Builder (v27) -----------------------------------
//
// EINE Form fuer alles. Ob eingebaut oder selbst gebaut — jeder Workflow erscheint als dieselbe
// Kette: Wenn (ein Ausloeser) · Und (beliebig viele Bedingungen) · Dann (beliebig viele Aktionen).
//
// Der Unterschied steht an jeder Kachel, nicht im Kleingedruckten:
//   „laeuft"          -> public/workflowengine.js fuehrt diesen Baustein wirklich aus
//   „fest verdrahtet" -> der Baustein steht im Code (Fundstelle im Fuss), hier nur beschrieben
// Der Builder bietet deshalb ausschliesslich ausfuehrbare Bausteine an: einen Workflow, der bloss
// behauptet zu laufen, kann man hier gar nicht erst bauen.

// Der Builder bringt seine eigene Stilseite mit, statt style.css anzufassen — so bleibt diese
// Ergaenzung unabhaengig von paralleler Arbeit an der grossen Stilseite.
function stilLaden() {
  if (document.getElementById("wfb-stil")) return;
  const l = document.createElement("link");
  l.id = "wfb-stil";
  l.rel = "stylesheet";
  l.href = "/workflowbuilder.css";
  document.head.appendChild(l);
}

const wahlOptionen = (f) => (typeof f.wahl === "function" ? f.wahl() : f.wahl || []);

// Eine Baustein-Kachel: der Satz plus die Marke, ob sie laeuft oder nur beschrieben ist.
function bausteinKachel(art, baustein) {
  const def = WFB.bausteinDef(art, baustein && baustein.typ);
  const el = document.createElement("span");
  el.className = "wfb-kachel" + (def && def.ausfuehrbar ? "" : " wfb-kachel-fest");
  const text = document.createElement("span");
  text.className = "wfb-kachel-text";
  text.textContent = WFB.beschreibe(art, baustein);
  el.appendChild(text);
  const marke = document.createElement("span");
  marke.className = "wfb-marke " + (def && def.ausfuehrbar ? "wfb-marke-laeuft" : "wfb-marke-fest");
  marke.textContent = def && def.ausfuehrbar ? "laeuft" : "fest verdrahtet";
  el.appendChild(marke);
  if (def && def.satz) el.title = def.satz;
  return el;
}

// Die Kette Wenn/Und/Dann — dieselbe Zeichnung fuer eingebaute und eigene Workflows.
function ketteAnsicht(wf) {
  const kette = document.createElement("div");
  kette.className = "wfb-kette";

  const stufe = (label, kacheln, leerText) => {
    const z = document.createElement("div");
    z.className = "wfb-stufe";
    const l = document.createElement("span");
    l.className = "wfb-stufe-label";
    l.textContent = label;
    z.appendChild(l);
    const inhalt = document.createElement("div");
    inhalt.className = "wfb-stufe-inhalt";
    if (!kacheln.length) {
      const leer = document.createElement("span");
      leer.className = "wfb-leer";
      leer.textContent = leerText;
      inhalt.appendChild(leer);
    } else for (const k of kacheln) inhalt.appendChild(k);
    z.appendChild(inhalt);
    kette.appendChild(z);
  };

  stufe("Wenn", wf.ausloeser ? [bausteinKachel("ausloeser", wf.ausloeser)] : [], "kein Ausloeser gesetzt");
  stufe("Und", (wf.bedingungen || []).map((b) => bausteinKachel("bedingung", b)), "ohne Bedingung — laeuft immer");
  stufe("Dann", (wf.aktionen || []).map((a) => bausteinKachel("aktion", a)), "keine Aktion — der Workflow tut nichts");
  return kette;
}

// --- Die eingebauten Neun in derselben Form -------------------------------
//
// Bausteine nur lesen (sie stehen im Code), Schalter und Parameter wie bisher bedienbar. Am
// Verhalten der Neun aendert dieser Tab damit nichts — er zeigt es nur zum ersten Mal ganz.

function eingebauteKarte(w, nachAenderung) {
  const plan = WFB.alsBauplan(w);
  const box = document.createElement("div");
  box.className = "wfb-karte wfb-karte-eingebaut";

  const kopf = document.createElement("div");
  kopf.className = "wfb-kopf";
  const schalterLabel = document.createElement("label");
  schalterLabel.className = "wfb-schalter";
  const schalter = document.createElement("input");
  schalter.type = "checkbox";
  schalter.checked = !!w.an;
  schalterLabel.appendChild(schalter);
  const name = document.createElement("span");
  name.className = "wfb-name";
  name.textContent = w.name;
  schalterLabel.appendChild(name);
  kopf.appendChild(schalterLabel);
  const herkunft = document.createElement("span");
  herkunft.className = "wfb-herkunft";
  herkunft.textContent = "eingebaut";
  kopf.appendChild(herkunft);
  const status = document.createElement("span");
  status.className = "wfb-status";
  status.textContent = w.an ? "laeuft" : "aus";
  kopf.appendChild(status);
  box.appendChild(kopf);

  box.appendChild(ketteAnsicht(plan));

  const saetze = document.createElement("p");
  saetze.className = "wfb-satz";
  saetze.innerHTML = `<b>Wenn:</b> ${escape(w.ausloeser)}<br><b>Dann:</b> ${escape(w.wirkung)}`;
  box.appendChild(saetze);

  if (w.warnung) {
    const warn = document.createElement("p");
    warn.className = "wfb-warnung";
    warn.textContent = w.warnung;
    box.appendChild(warn);
  }

  for (const p of w.params || []) {
    const zeile = document.createElement("div");
    zeile.className = "wfb-param";
    const lbl = document.createElement("span");
    lbl.textContent = p.label + (p.einheit ? ` (${p.einheit})` : "");
    zeile.appendChild(lbl);
    const eingabeEl = document.createElement("input");
    if (p.typ === "schalter") {
      eingabeEl.type = "checkbox";
      eingabeEl.checked = !!p.wert;
    } else {
      eingabeEl.type = "number";
      eingabeEl.value = p.wert;
      if (p.min !== undefined) eingabeEl.min = p.min;
      if (p.max !== undefined) eingabeEl.max = p.max;
    }
    eingabeEl.className = "wfb-eingabe";
    eingabeEl.addEventListener("change", async () => {
      const wert = p.typ === "schalter" ? eingabeEl.checked : Number(eingabeEl.value);
      status.textContent = "Speichere …";
      const ok = await nachAenderung(w.id, { params: { [p.key]: wert } });
      status.textContent = ok ? "gespeichert" : "nicht gespeichert";
    });
    zeile.appendChild(eingabeEl);
    if (p.hinweis) {
      const h = document.createElement("span");
      h.className = "wfb-hinweis";
      h.textContent = p.hinweis;
      zeile.appendChild(h);
    }
    box.appendChild(zeile);
  }

  const fuss = document.createElement("div");
  fuss.className = "wfb-fuss";
  fuss.innerHTML = `<code>${escape(w.ort)}</code>`;
  box.appendChild(fuss);

  schalter.addEventListener("change", async () => {
    status.textContent = "Speichere …";
    const ok = await nachAenderung(w.id, { an: schalter.checked });
    status.textContent = ok ? (schalter.checked ? "laeuft" : "aus") : "nicht gespeichert";
    if (!ok) schalter.checked = !schalter.checked;
  });

  return box;
}

// --- Der Editor fuer selbstgebaute Workflows ------------------------------

// Ein Eingabefeld nach Baustein-Definition. `wahl` wird zum Auswahlfeld, alles andere zum Textfeld.
function bausteinFeld(fDef, baustein, beiAenderung) {
  const wrap = document.createElement("label");
  wrap.className = "wfb-feld";
  const lbl = document.createElement("span");
  lbl.className = "wfb-feld-label";
  lbl.textContent = fDef.label;
  wrap.appendChild(lbl);

  let el;
  if (fDef.typ === "wahl") {
    el = document.createElement("select");
    el.className = "wfb-eingabe wfb-eingabe-wahl";
    if (fDef.leerText !== undefined) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = fDef.leerText;
      el.appendChild(o);
    }
    for (const opt of wahlOptionen(fDef)) {
      const o = document.createElement("option");
      o.value = opt.wert;
      o.textContent = opt.name;
      el.appendChild(o);
    }
    el.value = baustein[fDef.key] ?? fDef.standard ?? "";
  } else {
    el = document.createElement("input");
    el.type = "text";
    el.className = "wfb-eingabe wfb-eingabe-text";
    el.value = baustein[fDef.key] ?? fDef.standard ?? "";
  }
  el.addEventListener("change", () => {
    baustein[fDef.key] = el.value;
    beiAenderung();
  });
  el.addEventListener("input", () => {
    baustein[fDef.key] = el.value;
  });
  wrap.appendChild(el);
  return wrap;
}

// Eine Zeile im Editor: Baustein-Typ waehlen, seine Felder ausfuellen, Zeile entfernen.
function bausteinZeile(art, katalog, baustein, { entfernbar, beiAenderung }) {
  const zeile = document.createElement("div");
  zeile.className = "wfb-zeile";
  // Zwei Ebenen: oben die Bedienelemente in EINER Reihe, darunter der Erklaersatz. Sonst
  // schiebt der Satz den Entfernen-Knopf in eine eigene Zeile.
  const oben = document.createElement("div");
  oben.className = "wfb-zeile-oben";
  zeile.appendChild(oben);
  const satzEl = document.createElement("p");
  satzEl.className = "wfb-zeile-satz";
  zeile.appendChild(satzEl);

  const wahl = document.createElement("select");
  wahl.className = "wfb-eingabe wfb-eingabe-typ";
  for (const def of katalog) {
    const o = document.createElement("option");
    o.value = def.typ;
    o.textContent = def.name;
    wahl.appendChild(o);
  }
  wahl.value = baustein.typ;
  oben.appendChild(wahl);

  const felderBox = document.createElement("div");
  felderBox.className = "wfb-zeile-felder";
  oben.appendChild(felderBox);

  const zeichneFelder = () => {
    felderBox.innerHTML = "";
    const def = katalog.find((d) => d.typ === baustein.typ);
    satzEl.textContent = (def && def.satz) || "";
    if (!def) return;
    for (const f of def.felder || []) {
      if (baustein[f.key] === undefined) baustein[f.key] = f.standard ?? "";
      felderBox.appendChild(bausteinFeld(f, baustein, beiAenderung));
    }
  };
  zeichneFelder();

  wahl.addEventListener("change", () => {
    const def = katalog.find((d) => d.typ === wahl.value);
    for (const k of Object.keys(baustein)) delete baustein[k];
    baustein.typ = wahl.value;
    for (const f of (def && def.felder) || []) baustein[f.key] = f.standard ?? "";
    zeichneFelder();
    beiAenderung();
  });

  if (entfernbar) {
    const weg = document.createElement("button");
    weg.className = "wfb-weg";
    weg.type = "button";
    weg.setAttribute("aria-label", "Zeile entfernen");
    weg.innerHTML = icon("schliessen");
    weg.addEventListener("click", () => entfernbar());
    oben.appendChild(weg);
  }

  return zeile;
}

// Der Editor selbst. `wf` ist ein Arbeitsstand, der beim Speichern zum Server geht.
function eigenerEditor(wf, { speichern, loeschen, abbrechen }) {
  const box = document.createElement("div");
  box.className = "wfb-karte wfb-karte-editor";

  const kopf = document.createElement("div");
  kopf.className = "wfb-kopf";
  const nameFeld = document.createElement("input");
  nameFeld.type = "text";
  nameFeld.className = "wfb-eingabe wfb-name-feld";
  nameFeld.placeholder = "Name des Workflows";
  nameFeld.value = wf.name || "";
  nameFeld.addEventListener("input", () => {
    wf.name = nameFeld.value;
    pruefeNach();
  });
  kopf.appendChild(nameFeld);
  const schalterLabel = document.createElement("label");
  schalterLabel.className = "wfb-schalter";
  const schalter = document.createElement("input");
  schalter.type = "checkbox";
  schalter.checked = wf.an !== false;
  schalter.addEventListener("change", () => {
    wf.an = schalter.checked;
  });
  schalterLabel.appendChild(schalter);
  const sTxt = document.createElement("span");
  sTxt.textContent = "eingeschaltet";
  schalterLabel.appendChild(sTxt);
  kopf.appendChild(schalterLabel);
  box.appendChild(kopf);

  const koerper = document.createElement("div");
  koerper.className = "wfb-editor-koerper";
  box.appendChild(koerper);

  const befund = document.createElement("div");
  befund.className = "wfb-befund";

  const zeichneKoerper = () => {
    koerper.innerHTML = "";

    // Wenn — genau ein Ausloeser.
    const wennBlock = document.createElement("div");
    wennBlock.className = "wfb-block";
    const wennTitel = document.createElement("div");
    wennTitel.className = "wfb-block-titel";
    wennTitel.textContent = "Wenn";
    wennBlock.appendChild(wennTitel);
    if (!wf.ausloeser) wf.ausloeser = { typ: WFB.baubar(WFB.AUSLOESER)[0].typ };
    wennBlock.appendChild(
      bausteinZeile("ausloeser", WFB.baubar(WFB.AUSLOESER), wf.ausloeser, { beiAenderung: pruefeNach })
    );
    koerper.appendChild(wennBlock);

    // Und — beliebig viele Bedingungen.
    const undBlock = document.createElement("div");
    undBlock.className = "wfb-block";
    const undTitel = document.createElement("div");
    undTitel.className = "wfb-block-titel";
    undTitel.textContent = "Und (Bedingungen)";
    undBlock.appendChild(undTitel);
    if (!wf.bedingungen.length) {
      const leer = document.createElement("p");
      leer.className = "wfb-leer";
      leer.textContent = "Ohne Bedingung laeuft der Workflow bei jedem Ausloeser.";
      undBlock.appendChild(leer);
    }
    wf.bedingungen.forEach((b, i) => {
      undBlock.appendChild(
        bausteinZeile("bedingung", WFB.baubar(WFB.BEDINGUNGEN), b, {
          beiAenderung: pruefeNach,
          entfernbar: () => {
            wf.bedingungen.splice(i, 1);
            zeichneKoerper();
            pruefeNach();
          },
        })
      );
    });
    undBlock.appendChild(
      knopf("Bedingung hinzufuegen", {
        zeichen: "plus",
        klick: () => {
          const def = WFB.baubar(WFB.BEDINGUNGEN)[0];
          const neu = { typ: def.typ };
          for (const f of def.felder || []) neu[f.key] = f.standard ?? "";
          wf.bedingungen.push(neu);
          zeichneKoerper();
          pruefeNach();
        },
      })
    );
    koerper.appendChild(undBlock);

    // Dann — beliebig viele Aktionen.
    const dannBlock = document.createElement("div");
    dannBlock.className = "wfb-block";
    const dannTitel = document.createElement("div");
    dannTitel.className = "wfb-block-titel";
    dannTitel.textContent = "Dann (Aktionen)";
    dannBlock.appendChild(dannTitel);
    wf.aktionen.forEach((a, i) => {
      dannBlock.appendChild(
        bausteinZeile("aktion", WFB.baubar(WFB.AKTIONEN), a, {
          beiAenderung: pruefeNach,
          entfernbar: () => {
            wf.aktionen.splice(i, 1);
            zeichneKoerper();
            pruefeNach();
          },
        })
      );
    });
    dannBlock.appendChild(
      knopf("Aktion hinzufuegen", {
        zeichen: "plus",
        klick: () => {
          const def = WFB.baubar(WFB.AKTIONEN)[0];
          const neu = { typ: def.typ };
          for (const f of def.felder || []) neu[f.key] = f.standard ?? "";
          wf.aktionen.push(neu);
          zeichneKoerper();
          pruefeNach();
        },
      })
    );
    koerper.appendChild(dannBlock);
  };

  function pruefeNach() {
    const fehlt = WFB.pruefe(wf);
    befund.innerHTML = "";
    if (!fehlt.length) {
      befund.appendChild(
        (() => {
          const s = document.createElement("span");
          s.className = "wfb-befund-ok";
          s.textContent = "Vollstaendig — dieser Workflow laeuft, sobald er gespeichert ist.";
          return s;
        })()
      );
      return;
    }
    for (const f of fehlt) befund.appendChild(befundZeile("hinweis", f));
  }

  zeichneKoerper();
  pruefeNach();
  box.appendChild(befund);

  const fuss = document.createElement("div");
  fuss.className = "wfb-editor-fuss";
  fuss.appendChild(knopf("Speichern", { art: "haupt", zeichen: "check", klick: () => speichern(wf) }));
  fuss.appendChild(knopf("Abbrechen", { klick: () => abbrechen() }));
  if (loeschen)
    fuss.appendChild(
      knopf("Loeschen", {
        art: "gefahr",
        zeichen: "muell",
        klick: () => bestaetigen(`„${wf.name}“ wirklich loeschen?`, "Loeschen", () => loeschen(wf)),
      })
    );
  box.appendChild(fuss);

  return box;
}

// Ein fertiger eigener Workflow in der Leseansicht — dieselbe Kette wie bei den Eingebauten.
function eigeneKarte(wf, { bearbeiten, schalten }) {
  const box = document.createElement("div");
  box.className = "wfb-karte";

  const kopf = document.createElement("div");
  kopf.className = "wfb-kopf";
  const schalterLabel = document.createElement("label");
  schalterLabel.className = "wfb-schalter";
  const schalter = document.createElement("input");
  schalter.type = "checkbox";
  schalter.checked = wf.an !== false;
  schalterLabel.appendChild(schalter);
  const name = document.createElement("span");
  name.className = "wfb-name";
  name.textContent = wf.name;
  schalterLabel.appendChild(name);
  kopf.appendChild(schalterLabel);
  const herkunft = document.createElement("span");
  herkunft.className = "wfb-herkunft wfb-herkunft-eigen";
  herkunft.textContent = "selbst gebaut";
  kopf.appendChild(herkunft);
  const status = document.createElement("span");
  status.className = "wfb-status";
  status.textContent = (wf.fehlt || []).length ? "Entwurf — laeuft nicht" : wf.an === false ? "aus" : "laeuft";
  kopf.appendChild(status);
  kopf.appendChild(knopf("Bearbeiten", { zeichen: "zahnrad", klick: () => bearbeiten(wf) }));
  box.appendChild(kopf);

  box.appendChild(ketteAnsicht(wf));

  for (const f of wf.fehlt || []) box.appendChild(befundZeile("hinweis", f));

  schalter.addEventListener("change", async () => {
    status.textContent = "Speichere …";
    const ok = await schalten(wf, schalter.checked);
    if (!ok) schalter.checked = !schalter.checked;
    status.textContent = ok
      ? (wf.fehlt || []).length
        ? "Entwurf — laeuft nicht"
        : schalter.checked
          ? "laeuft"
          : "aus"
      : "nicht gespeichert";
  });

  return box;
}

// --- Der Tab ---------------------------------------------------------------

let WFB = null; // der Baustein-Katalog, einmal geladen

async function zeichneWorkflows(ziel) {
  stilLaden();
  ziel.textContent = "Lade …";
  if (!WFB) {
    try {
      WFB = await import("/lib/workflowblocks.js");
    } catch (e) {
      ziel.textContent = `Der Baustein-Katalog liess sich nicht laden: ${e.message}`;
      return;
    }
  }

  let eingebaute = [];
  let eigene = [];
  try {
    const res = await fetch("/api/workflows");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    eingebaute = d.workflows || [];
    eigene = d.eigene || [];
  } catch {
    ziel.textContent = "Die Workflows liessen sich nicht laden — laeuft der Server?";
    return;
  }

  const store = await import("./store.js");

  // Schalter/Parameter eines eingebauten Workflows speichern und den laufenden Stand nachziehen.
  const speichereEingebauten = async (id, aenderung) => {
    try {
      await store.setzeWorkflow(id, aenderung);
      return true;
    } catch {
      return false;
    }
  };

  const neuZeichnen = () => zeichneWorkflows(ziel);

  const speichereEigenen = async (wf) => {
    try {
      await store.setzeEigenenWorkflow(wf);
      meldung(`Workflow „${wf.name}“ gespeichert.`, "erfolg");
      neuZeichnen();
    } catch (e) {
      meldung(`Speichern ging nicht: ${e.message}`, "fehler");
    }
  };

  const loescheEigenen = async (wf) => {
    try {
      await store.loescheEigenenWorkflow(wf.id);
      meldung(`Workflow „${wf.name}“ geloescht.`, "erfolg");
      neuZeichnen();
    } catch (e) {
      meldung(`Loeschen ging nicht: ${e.message}`, "fehler");
    }
  };

  const schalteEigenen = async (wf, an) => {
    try {
      await store.setzeEigenenWorkflow({ ...wf, an });
      return true;
    } catch {
      return false;
    }
  };

  ziel.innerHTML = "";

  // --- Eigene Workflows -----------------------------------------------------
  const eigenKopf = document.createElement("div");
  eigenKopf.className = "wfb-abschnitt-kopf";
  const eigenTitel = document.createElement("div");
  eigenTitel.className = "einst-label";
  eigenTitel.textContent = "Eigene Workflows";
  eigenKopf.appendChild(eigenTitel);
  const editorPlatz = document.createElement("div");
  editorPlatz.className = "wfb-editor-platz";
  const neuKnopf = knopf("Neuen Workflow bauen", {
    art: "haupt",
    zeichen: "plus",
    klick: () => {
      editorPlatz.innerHTML = "";
      const def = WFB.baubar(WFB.AUSLOESER)[0];
      const entwurf = {
        id: WFB.neueEigeneId(),
        name: "",
        an: true,
        ausloeser: { typ: def.typ },
        bedingungen: [],
        aktionen: [],
      };
      editorPlatz.appendChild(
        eigenerEditor(entwurf, {
          speichern: speichereEigenen,
          abbrechen: () => (editorPlatz.innerHTML = ""),
        })
      );
      editorPlatz.scrollIntoView({ block: "nearest" });
    },
  });
  eigenKopf.appendChild(neuKnopf);
  ziel.appendChild(eigenKopf);

  const eigenHinweis = document.createElement("p");
  eigenHinweis.className = "einst-provider-sub";
  eigenHinweis.textContent =
    "Selbstgebaute Workflows laufen im Board, waehrend es offen ist — nicht als Hintergrunddienst. " +
    "Angeboten wird nur, was die Engine wirklich ausfuehrt.";
  ziel.appendChild(eigenHinweis);

  ziel.appendChild(editorPlatz);

  if (!eigene.length) {
    const leer = document.createElement("p");
    leer.className = "wfb-leer";
    leer.textContent = "Noch keiner gebaut. „Neuen Workflow bauen“ setzt den ersten zusammen.";
    ziel.appendChild(leer);
  }
  for (const wf of eigene) {
    ziel.appendChild(
      eigeneKarte(wf, {
        schalten: schalteEigenen,
        bearbeiten: (w) => {
          editorPlatz.innerHTML = "";
          editorPlatz.appendChild(
            eigenerEditor(JSON.parse(JSON.stringify(w)), {
              speichern: speichereEigenen,
              loeschen: loescheEigenen,
              abbrechen: () => (editorPlatz.innerHTML = ""),
            })
          );
          editorPlatz.scrollIntoView({ block: "nearest" });
        },
      })
    );
  }

  // --- Eingebaute Workflows -------------------------------------------------
  const einTitel = document.createElement("div");
  einTitel.className = "einst-label wfb-abschnitt-trenner";
  einTitel.textContent = "Eingebaute Workflows";
  ziel.appendChild(einTitel);
  const einHinweis = document.createElement("p");
  einHinweis.className = "einst-provider-sub";
  einHinweis.textContent =
    "Dieselbe Form, aber die Bausteine stehen im Code — der Fuss jeder Karte nennt die Fundstelle. " +
    "Schalter und Stellschrauben sind hier bedienbar.";
  ziel.appendChild(einHinweis);
  for (const w of eingebaute) ziel.appendChild(eingebauteKarte(w, speichereEingebauten));
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
  }
  return _stapel;
}

function _schliesseMeldung(el) {
  clearTimeout(Number(el.dataset.timer));
  el.classList.add("meldung-weg");
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

// Zeigt einen Toast oben rechts. typ: "erfolg" (gruen) | "fehler" (rot).
export function meldung(text, typ = "erfolg") {
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
