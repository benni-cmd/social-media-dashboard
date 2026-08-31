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

export function knopf(text, { art = "still", zeichen = null, klick = null, titel = "" } = {}) {
  const b = document.createElement("button");
  b.className = `knopf knopf-${art}`;
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
    `<div class="denk-kopf">${icon("funken")}<span class="denk-titel">${escape(titel)}</span>` +
    `<span class="denk-punkte"><span></span><span></span><span></span></span></div>` +
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

// Zentriertes Pop-up, das ein einzelnes Datum abfragt. onConfirm(iso) bei „Setzen".
export function modalDatum(frage, hinweis, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal";
  box.innerHTML =
    `<div class="modal-frage">${escape(frage)}</div>` +
    (hinweis ? `<p class="feld-hinweis">${escape(hinweis)}</p>` : "");
  const input = document.createElement("input");
  input.type = "date";
  input.className = "eingabe";
  box.appendChild(input);
  const reihe = document.createElement("div");
  reihe.className = "modal-knoepfe";
  const zu = () => overlay.remove();
  reihe.appendChild(
    knopf("Datum setzen", {
      art: "haupt",
      zeichen: "kalender",
      klick: () => {
        if (!input.value) { input.focus(); return; }
        zu();
        onConfirm(input.value);
      },
    })
  );
  reihe.appendChild(knopf("Abbrechen", { klick: zu }));
  box.appendChild(reihe);
  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) zu(); });
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 0);
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
export function fortschritt(container, text) {
  const box = document.createElement("div");
  box.className = "fortschritt";
  box.innerHTML =
    `<span class="fortschritt-text">${escape(text || "Einen Moment …")}</span>` +
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

  const links = document.createElement("nav");
  links.className = "einst-nav";
  const eintrag = document.createElement("button");
  eintrag.className = "einst-nav-item aktiv";
  eintrag.textContent = "Darstellung";
  links.appendChild(eintrag);

  const rechts = document.createElement("div");
  rechts.className = "einst-inhalt";

  const titel = document.createElement("div");
  titel.className = "einst-titel";
  titel.textContent = "Darstellung";
  rechts.appendChild(titel);

  const aktuellesTheme = document.documentElement.getAttribute("data-theme") || "light";
  const optionen = [
    { id: "light", name: "Light Mode" },
    { id: "dark", name: "Dark Mode" },
  ];
  const reihe = document.createElement("div");
  reihe.className = "einst-theme-reihe";
  for (const opt of optionen) {
    const label = document.createElement("label");
    label.className = "einst-theme-option" + (aktuellesTheme === opt.id ? " aktiv" : "");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "theme";
    radio.value = opt.id;
    radio.checked = aktuellesTheme === opt.id;
    radio.addEventListener("change", () => {
      reihe.querySelectorAll(".einst-theme-option").forEach((l) => l.classList.remove("aktiv"));
      label.classList.add("aktiv");
      onThemeChange(opt.id);
    });
    label.appendChild(radio);
    const span = document.createElement("span");
    span.textContent = opt.name;
    label.appendChild(span);
    reihe.appendChild(label);
  }
  rechts.appendChild(reihe);

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
