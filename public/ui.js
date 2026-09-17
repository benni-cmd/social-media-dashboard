// Bausteine der Oberflaeche. Wer eine Seite baut, nimmt diese — nicht neue.
//
// Geprueft gegen docs/ui-standard.md der Werkbank:
//   Punkt 3  Sechs Status-Woerter, nie Farbe allein — immer ueber statusChip(code).
//   Punkt 5  Kein Unicode-Symbol statt Icon. Alle Zeichen sind Lucide-SVGs aus ICONS.

// KI-Rollen-Konfig kommt aus store.js (eine Wahrheit): ui.js importiert statisch, store.js
// zieht ui.js nur dynamisch (store.js:130) — deshalb kein Zyklus.
import { ROLLEN, ROLLEN_META, rolleKonfig, setzeRolleKonfig } from "./store.js";

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
  // Echtes Zahnrad (Lucide „settings": Zahnkranz + Mittelkreis) — die frühere Fassung
  // (Mittelkreis + 8 gerade Strahlen) las sich als Sonne, nicht als Zahnrad (v40).
  zahnrad:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
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
  for (const name of ["Darstellung", "Verbindungen", "Externe Dienste", "Social Media Kanäle", "Unternehmenskontext", "System Prompts"]) {
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
    "Jede KI-Aufgabe laeuft ueber das Modell ihrer Rolle: die Ausgabe an dich ueber Claude, " +
    "Recherche und Kontextabgleich lokal ueber DeepSeek R1 (kostenlos, kein Token-Verbrauch).";
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

    // Provider-Wahl (lokal vs. Claude) — Radios je Rolle mit eindeutigem name.
    const providerReihe = document.createElement("div");
    providerReihe.className = "einst-provider-reihe";
    const providerOptionen = [
      { id: "ollama", label: "Lokal (Ollama)", sub: "kostenlos · kein Token-Verbrauch · laeuft auf deinem Rechner · Modell unten waehlbar" },
      { id: "claude", label: "Claude (via CLI · dein Abo)", sub: "beste Qualitaet fuer Nutzer-Texte · braucht die eingeloggte Claude-CLI" },
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

    // Web-Suche der Recherche-Rolle (v40): schluessellos ueber DuckDuckGo (Standard, kein Key).
    // Optional ein Gratis-Tavily-Key fuer stabilere Treffer — bleibt lokal in .env, nie im Repo.
    if (rolle === "recherche") {
      const web = document.createElement("div");
      web.className = "einst-ollama-konfig";
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
  function setzeChip(c, verbunden, bereit, hinweisText) {
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
    const trennen = knopf("Trennen", { klick: (e) => trenneDienst("/api/auth/google/trennen", e.currentTarget) });
    // .knopf setzt per CSS display, das ein [hidden]-Attribut ueberschreibt — daher style.display.
    trennen.style.display = "none";
    reihe.appendChild(speichern);
    reihe.appendChild(verbinden);
    reihe.appendChild(trennen);
    reihe.appendChild(info);
    ab.appendChild(reihe);
    seite3.appendChild(ab);

    dienstRender.push((s) => {
      const g = s.google || {};
      setzeChip(chip, g.verbunden, g.clientKonfiguriert, g.hinweis);
      verbinden.disabled = !g.clientKonfiguriert;
      verbinden.style.display = g.verbunden ? "none" : "";
      trennen.style.display = g.verbunden ? "" : "none";
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
      "Die KI-Texte der Userkommunikation laufen ueber deine <b>Claude-CLI</b> (dein Abo, keine API-Kosten). " +
      "Verbinden: einmal im Terminal <code>claude auth login</code> und mit dem eigenen Abo einloggen.";
    ab.appendChild(t);
    const cReihe = document.createElement("div");
    cReihe.className = "einst-ping-zeile";
    const cInfo = document.createElement("div");
    cInfo.className = "einst-ping-status";
    const cTrennen = knopf("Trennen", {
      klick: async (e) => {
        cInfo.textContent = "Melde ab …";
        await trenneDienst("/api/auth/claude/trennen", e.currentTarget);
        cInfo.textContent = "Abgemeldet. Neu verbinden: claude auth login im Terminal.";
      },
    });
    cTrennen.style.display = "none";
    cReihe.appendChild(cTrennen);
    cReihe.appendChild(cInfo);
    ab.appendChild(cReihe);
    seite3.appendChild(ab);
    dienstRender.push((s) => {
      const c = s.claude || {};
      setzeChip(chip, c.verbunden, false);
      cTrennen.style.display = c.verbunden ? "" : "none";
    });
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
    const trennen = knopf("Trennen", { klick: (e) => trenneDienst(opt.trennenPfad, e.currentTarget) });
    trennen.style.display = "none";
    reihe.appendChild(speichern);
    reihe.appendChild(verbinden);
    reihe.appendChild(trennen);
    reihe.appendChild(info);
    ab.appendChild(reihe);
    container.appendChild(ab);
    dienstRender.push((s) => {
      const d = s[opt.statusKey] || {};
      setzeChip(chip, d.verbunden, d.clientKonfiguriert);
      verbinden.disabled = !d.clientKonfiguriert;
      verbinden.style.display = d.verbunden ? "none" : "";
      trennen.style.display = d.verbunden ? "" : "none";
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
    connectPfad: "/api/auth/instagram", trennenPfad: "/api/auth/instagram/trennen", statusKey: "instagram",
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
    connectPfad: "/api/auth/linkedin", trennenPfad: "/api/auth/linkedin/trennen", statusKey: "linkedin",
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

  // --- Tab-Switching ---
  const seiten = [seite1, seite2, seite3, seite4, seite7, seite5];
  let kontextGeladen = false;
  let promptsGeladen = false;
  navItems.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      navItems.forEach((b) => b.classList.remove("aktiv"));
      seiten.forEach((s) => s.classList.remove("aktiv"));
      btn.classList.add("aktiv");
      seiten[i].classList.add("aktiv");
      // v29: Das Fenster hat fuer jeden Tab dieselbe Groesse (public/einstellungen.css).
      // v41: Die Ollama-Modelle laedt jeder Rollen-Block selbst (baueRollenKonfig) — kein
      // modal-weites ladeModelle mehr.
      // Externe Dienste / Social Media Kanaele: Verbindungsstatus frisch holen
      if (i === 2 || i === 3) ladeVerbStatus();
      if (i === 4 && !kontextGeladen) {
        kontextGeladen = true;
        import("./kontext.js").then((m) => m.zeichneKontext(kontextListe));
      }
      if (i === 5 && !promptsGeladen) { promptsGeladen = true; zeichnePrompts(promptListe); }
    });
  });

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
  zuruecksetzen.addEventListener("click", () => schicke(""));
  return box;
}

// Ein KI-Knopf als Schritt-Editor: Liste aus Schritten {rolle, prompt}, jede Rolle waehlbar,
// Schritte hinzufuegen/entfernen/ordnen. Recherche-Schritte suchen automatisch im Web.
function aufgabeBlock(eintrag, rollen) {
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

  // Arbeitskopie der Schritte.
  let schritte = (eintrag.schritte || []).map((s) => ({ rolle: s.rolle, prompt: s.prompt }));

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

  const gleichStandard = () => {
    const st = eintrag.standard || [];
    return (
      schritte.length === st.length &&
      schritte.every((s, i) => s.rolle === st[i].rolle && s.prompt === st[i].prompt)
    );
  };
  const zeigeStand = () => {
    const geaendert = !gleichStandard();
    marke.textContent = geaendert ? "geaendert" : "Standard";
    marke.classList.toggle("aktiv", geaendert);
    zuruecksetzen.disabled = !geaendert;
  };

  function schrittZeile(s, i) {
    const wrap = document.createElement("div");
    wrap.className = "einst-schritt";
    const kopfZ = document.createElement("div");
    kopfZ.className = "einst-schritt-kopf";
    const nr = document.createElement("span");
    nr.className = "einst-schritt-nr";
    nr.textContent = `Schritt ${i + 1}`;
    const sel = document.createElement("select");
    sel.className = "einst-modell-select einst-schritt-rolle";
    for (const r of rollen) {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.name;
      if (r.id === s.rolle) o.selected = true;
      sel.appendChild(o);
    }
    const web = document.createElement("span");
    web.className = "einst-schritt-web";
    web.textContent = "sucht automatisch im Web";
    web.hidden = s.rolle !== "recherche";
    sel.addEventListener("change", () => {
      s.rolle = sel.value;
      web.hidden = s.rolle !== "recherche";
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
    feld.addEventListener("input", () => {
      s.prompt = feld.value;
      zeigeStand();
    });
    wrap.appendChild(feld);
    return wrap;
  }

  function zeichneSchritte() {
    liste.innerHTML = "";
    schritte.forEach((s, i) => liste.appendChild(schrittZeile(s, i)));
    zeigeStand();
  }

  plus.addEventListener("click", () => {
    schritte.push({ rolle: "userkomm", prompt: "" });
    zeichneSchritte();
  });

  async function schicke(nutz) {
    speichern.disabled = true;
    zuruecksetzen.disabled = true;
    status.textContent = "Speichere …";
    try {
      const res = await fetch("/api/prompts", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: eintrag.id, schritte: nutz }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const neu = (d.aufgaben || []).find((a) => a.id === eintrag.id);
      if (neu) {
        eintrag.schritte = neu.schritte;
        eintrag.standard = neu.standard;
        eintrag.eigen = neu.eigen;
      }
      schritte = (eintrag.schritte || []).map((s) => ({ rolle: s.rolle, prompt: s.prompt }));
      zeichneSchritte();
      status.textContent = nutz.length ? "✅ Gespeichert — gilt ab dem naechsten Aufruf." : "✅ Zurueck auf den Standard.";
    } catch {
      status.textContent = "❌ Speichern fehlgeschlagen — laeuft der Server?";
    } finally {
      speichern.disabled = false;
      zeigeStand();
    }
  }
  speichern.addEventListener("click", () => schicke(schritte));
  zuruecksetzen.addEventListener("click", () => schicke([]));

  zeichneSchritte();
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
  for (const a of mitKnopf) ziel.appendChild(aufgabeBlock(a, rollen));

  if (ohneKnopf.length) {
    const t2 = document.createElement("div");
    t2.className = "einst-label";
    t2.textContent = `Prompts ohne Knopf (${ohneKnopf.length})`;
    ziel.appendChild(t2);
    const h = document.createElement("p");
    h.className = "einst-provider-sub";
    h.textContent = "Diese Prompts sind fertig, es gibt im UI aber noch keinen Knopf dafuer.";
    ziel.appendChild(h);
    for (const a of ohneKnopf) ziel.appendChild(aufgabeBlock(a, rollen));
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

// Persistenter Hinweis-Toast (v52): wie meldung(), aber mit statusChip() (die sechs
// Status-Woerter) statt nur gruen/rot, und OHNE Auto-Timeout — verschwindet erst durch
// aktives Wegklicken. Fuer Hinweise/Fehlermeldungen, die vorher in der festen Kopf-Zeile
// standen und dort leicht uebersehen wurden oder von der naechsten Meldung ueberschrieben.
export function hinweisToast(status, satz) {
  const st = _bekommStapel();
  const el = document.createElement("div");
  el.className = "meldung meldung-hinweis";
  el.innerHTML =
    statusChip(status) +
    `<span class="meldung-text">${escape(satz)}</span>` +
    `<button class="meldung-schliessen" aria-label="Schliessen">${icon("schliessen")}</button>`;
  el.querySelector(".meldung-schliessen").addEventListener("click", () => _schliesseMeldung(el));
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
