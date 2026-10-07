// Kontextmenue an der Board-Karte (v54).
//
// Rechtsklick auf eine `.eintrag`-Kachel oeffnet ein kleines Menue mit den haeufigen
// Karten-Aktionen — ohne Umweg ueber die Detailspalte. Diese Datei ist self-contained:
// sie baut das Menue, positioniert es, schliesst es, traegt die Tastatur-/A11y-Logik und
// bringt ihr eigenes CSS mit (ueber die bestehenden Design-Tokens, damit Light/Dark und der
// Retro-Look automatisch stimmen). Board.js ergaenzt nur einen contextmenu-Listener.
//
// Wichtig: KEINE neue Funktionalitaet ausser der Menue-Huelle. Jeder Eintrag ruft eine
// bereits vorhandene Funktion — `schiebe` (board.js), `loescheKarte`/`karteZuTermin`/
// `schwebendeNeuBerechnen`/`ladePlan` (store.js), `bestaetigen`/`meldung` (ui.js), und die
// Slot-Logik der v52-Termin-Kachel (detail.js) 1:1 nachgezogen.

import {
  PHASEN,
  phase,
  naechstePhase,
  einfacherPlan,
  isoDatum,
  deutschesDatum,
  tore,
  sperren,
} from "/lib/pipeline.js";
import { naechsterFreierUpload } from "/lib/uploadslots.js";
import {
  S,
  speichere,
  zeichne,
  loescheKarte,
  karteZuTermin,
  schwebendeNeuBerechnen,
  ladePlan,
  melde,
  driveScan,
  drehZuSpaet,
} from "./store.js";
import { icon, bestaetigen, meldung } from "./ui.js";
import { schiebe } from "./board.js";

// --- Styles einmalig injizieren ------------------------------------------

const STYLE_ID = "kmenu-style";
function stellStyleSicher() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
.kmenu {
  position: fixed;
  z-index: 8000;
  min-width: 218px;
  padding: 5px;
  background: var(--flaeche);
  border: 1px solid var(--linie-hell);
  border-radius: var(--rund);
  box-shadow: var(--schatten);
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 14px;
  color: var(--text);
  user-select: none;
}
.kmenu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: var(--rund-klein);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.kmenu-item > span { flex: 1 1 auto; }
.kmenu-item .icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--text-still); }
.kmenu-item:hover,
.kmenu-item:focus-visible,
.kmenu-item.kmenu-auf {
  background: var(--akzent-tief);
  border-color: var(--akzent);
  outline: none;
}
.kmenu-item:hover .icon,
.kmenu-item:focus-visible .icon { color: var(--text); }
.kmenu-gefahr { color: var(--befund); }
.kmenu-gefahr .icon { color: var(--befund); }
.kmenu-gefahr:hover,
.kmenu-gefahr:focus-visible,
.kmenu-gefahr.kmenu-auf { background: none; border-color: var(--befund); }
.kmenu-pfeil { flex: 0 0 auto; }
.kmenu-pfeil .icon { width: 14px; height: 14px; }
.kmenu-trenner {
  height: 1px;
  margin: 4px 6px;
  background: var(--linie-hell);
  opacity: 0.6;
}
`;
  document.head.appendChild(s);
}

// --- Aktueller Menue-Zustand ---------------------------------------------

// Ein Menue zur Zeit. `panels` ist der Stapel (Hauptmenue + offene Untermenues);
// `zuletztFokus` traegt den Fokus nach dem Schliessen zurueck auf die Karte.
let aktiv = null;

export function schliesseKontextmenu(fokusZurueck = true) {
  if (!aktiv) return;
  for (const p of aktiv.panels) p.remove();
  document.removeEventListener("mousedown", aufKlickAussen, true);
  document.removeEventListener("keydown", aufTaste, true);
  window.removeEventListener("scroll", aufScroll, true);
  window.removeEventListener("blur", schliesseStill);
  window.removeEventListener("resize", schliesseStill);
  const ziel = aktiv.karteEl;
  aktiv = null;
  if (fokusZurueck && ziel && typeof ziel.focus === "function") ziel.focus();
}
const schliesseStill = () => schliesseKontextmenu(false);
const aufScroll = () => schliesseKontextmenu(false);

function aufKlickAussen(e) {
  if (!aktiv) return;
  if (aktiv.panels.some((p) => p.contains(e.target))) return;
  schliesseKontextmenu(false);
}

// --- Oeffnen --------------------------------------------------------------

export function zeigeKontextmenu(k, ev, karteEl, oeffne) {
  ev.preventDefault();
  ev.stopPropagation();
  stellStyleSicher();
  schliesseKontextmenu(false);

  const eintraege = baueEintraege(k, oeffne);
  const panel = bauePanel(eintraege);
  aktiv = { panels: [panel], karteEl };

  platziere(panel, ev.clientX, ev.clientY);

  document.addEventListener("mousedown", aufKlickAussen, true);
  document.addEventListener("keydown", aufTaste, true);
  window.addEventListener("scroll", aufScroll, true);
  window.addEventListener("blur", schliesseStill);
  window.addEventListener("resize", schliesseStill);

  // Ersten Eintrag fokussieren — Tastatur-Bedienung ab Zug eins moeglich.
  const erst = panel._items[0];
  if (erst) erst.focus();
}

// Kontextabhaengige Eintragsliste. Jeder Eintrag: { icon, label, tun?, gefahr?, sub? } oder
// { trenner:true }. `sub` ist wiederum eine Eintragsliste (Untermenue).
function baueEintraege(k, oeffne) {
  const liste = [];
  liste.push({ icon: "auge", label: "Oeffnen", tun: () => oeffne(k.id) });

  // Weiter in die naechste Phase — nur solange es eine gibt (nicht bei fertig/verworfen).
  if (k.column !== "fertig" && k.column !== "verworfen") {
    const ziel = naechstePhase(k.column);
    // v113 (M2, Owner 07.10.2026): „Weiter zu …" prueft dieselben Tore wie der gleichnamige Knopf der
    // Detailspalte (vorher war das v75-Skript-Tor per Rechtsklick umgehbar). Ziehen und „Verschieben in"
    // bleiben bewusst ungeprueft. Fehlt der Drive-Stand, wird er erst gelesen.
    if (ziel)
      liste.push({
        icon: "weiter",
        label: `Weiter zu ${phase(ziel).name}`,
        tun: async () => {
          const stand = await driveScan(k).catch(() => null);
          const blockiert = sperren(tore(k, stand));
          if (blockiert.length) {
            await melde("befund", `„${k.title}“ kann noch nicht weiter: ${blockiert.map((b) => b.satz).join(" ")}`);
            return;
          }
          await schiebe(k, ziel);
        },
      });
  }

  // Verschieben in — alle Spalten ausser der aktuellen.
  const spalten = (S.spalten && S.spalten.length ? S.spalten : PHASEN).filter((s) => s.id !== k.column);
  if (spalten.length) {
    liste.push({
      icon: "raster",
      label: "Verschieben in",
      sub: spalten.map((s) => ({ label: s.name, tun: () => schiebe(k, s.id) })),
    });
  }

  // Naechsten freien Upload-Termin zuweisen (v52-Slot-Logik).
  liste.push({ icon: "kalender", label: "Naechsten freien Upload-Termin", tun: () => terminZuweisen(k) });

  // Drehtermin zuordnen — nur wenn es kommende Termine gibt.
  const heute = isoDatum(new Date());
  const kommend = (S.drehtermine || [])
    .filter((t) => t.datum && t.datum >= heute)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (kommend.length) {
    liste.push({
      icon: "video",
      label: "Drehtermin zuordnen",
      sub: kommend.map((t) => ({
        // v113 (N13): zu spaete Termine schon im Menue kennzeichnen (Klick zeigt wie bisher den Grund).
        label: `${deutschesDatum(t.datum)}${t.zeit ? " · " + t.zeit : ""}${t.ort ? " · " + t.ort : ""}${drehZuSpaet(k, t) ? " · zu spät" : ""}`,
        tun: () => drehZuordnen(k, t.id),
      })),
    });
  }

  liste.push({ trenner: true });

  // Verworfene Karte: zurueckholen statt verwerfen (wie der Abschluss-Block im Detail).
  if (k.column === "verworfen") {
    liste.push({ icon: "zurueck", label: "Zurueck zu Idee holen", tun: () => schiebe(k, "idee") });
  } else {
    liste.push({ icon: "muell", label: "Verwerfen", tun: () => schiebe(k, "verworfen") });
  }

  liste.push({ icon: "muell", label: "Loeschen", gefahr: true, tun: () => loeschen(k) });
  return liste;
}

// --- Aktionen (alle: bestehende Funktionen) -------------------------------

// Slot-Logik 1:1 aus detail.js (v52): 12 Monate Vorausblick, Belegung ueber die Upload-Daten
// der anderen Karten, naechster freier Slot -> als explizites Upload-Datum setzen.
async function terminZuweisen(k) {
  try {
    const plan = await ladePlan();
    // v89: dieselbe Regel wie die Kachel in detail.js (Format + machbarer Vorlauf).
    const { slot: naechster, grund } = naechsterFreierUpload({
      plan, card: k, cards: S.cards, drehtermine: S.drehtermine,
    });
    if (!naechster) {
      melde("hinweis", grund);
      return;
    }
    k.dates = einfacherPlan(naechster.datum);
    if (naechster.uhrzeit) k.uploadTime = naechster.uhrzeit;
    await speichere();
    await schwebendeNeuBerechnen(); // Karte belegt den Termin ueber ihr Upload-Datum (v30/v52)
    zeichne();
    meldung(`Upload am ${deutschesDatum(naechster.datum)} geplant.`, "erfolg");
  } catch {
    melde("hinweis", "Der Redaktionsplan liess sich nicht laden.");
  }
}

function drehZuordnen(k, terminId) {
  const r = karteZuTermin(k.id, terminId); // speichert + zeichnet selbst
  if (r && !r.ok && r.grund) { melde("befund", r.grund); return; } // v70: zu spaeter Drehtermin, blockiert
  if (r && r.warnung) melde("hinweis", r.warnung);
}

// Identisch zum Loesch-Knopf der Detailspalte (detail.js loeschenKnopf).
function loeschen(k) {
  bestaetigen(
    `"${k.title}" loeschen? Der Drive-Ordner wandert in den Papierkorb (wiederherstellbar).`,
    "Ja, loeschen",
    async () => {
      try {
        const r = await loescheKarte(k.id);
        meldung(r && r.getrasht ? "Karte geloescht — der Drive-Ordner liegt im Papierkorb." : "Karte geloescht.", "erfolg");
      } catch (e) {
        meldung(`Loeschen fehlgeschlagen, die Karte bleibt: ${e.message}`, "fehler");
      }
    }
  );
}

// --- Panel-Bau ------------------------------------------------------------

function bauePanel(eintraege) {
  const panel = document.createElement("div");
  panel.className = "kmenu";
  panel.setAttribute("role", "menu");
  const items = [];

  for (const e of eintraege) {
    if (e.trenner) {
      const tr = document.createElement("div");
      tr.className = "kmenu-trenner";
      panel.appendChild(tr);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kmenu-item" + (e.gefahr ? " kmenu-gefahr" : "");
    b.setAttribute("role", "menuitem");
    b.tabIndex = -1;
    b.innerHTML = (e.icon ? icon(e.icon) : "") + `<span>${escapeText(e.label)}</span>`;

    if (e.sub) {
      b.setAttribute("aria-haspopup", "menu");
      b.setAttribute("aria-expanded", "false");
      const pfeil = document.createElement("span");
      pfeil.className = "kmenu-pfeil";
      pfeil.innerHTML = icon("weiter");
      b.appendChild(pfeil);
      b._sub = e.sub;
      b.addEventListener("mouseenter", () => oeffneSub(b));
      b.addEventListener("click", () => oeffneSub(b, true));
    } else if (e.tun) {
      b.addEventListener("mouseenter", () => schliesseSubsAb(panel));
      b.addEventListener("click", () => {
        schliesseKontextmenu(false);
        e.tun();
      });
    }
    panel.appendChild(b);
    items.push(b);
  }
  panel._items = items;
  return panel;
}

// Untermenue eines Eintrags oeffnen (baut es beim ersten Mal). `fokus`: ersten Sub-Eintrag fokussieren.
function oeffneSub(parentItem, fokus = false) {
  const parentPanel = parentItem.closest(".kmenu");
  schliesseSubsAb(parentPanel); // Geschwister-Untermenues zu

  let sub = parentItem._subPanel;
  if (!sub) {
    sub = bauePanel(parentItem._sub);
    sub._parentItem = parentItem;
    sub._parentPanel = parentPanel;
    parentItem._subPanel = sub;
  }
  if (!aktiv.panels.includes(sub)) aktiv.panels.push(sub);
  parentItem.setAttribute("aria-expanded", "true");
  parentItem.classList.add("kmenu-auf");
  platziereSub(sub, parentItem);
  if (fokus && sub._items[0]) sub._items[0].focus();
}

// Alle Untermenues schliessen, die tiefer als `panel` liegen (bzw. Geschwister davon).
function schliesseSubsAb(panel) {
  if (!aktiv) return;
  const idx = aktiv.panels.indexOf(panel);
  if (idx < 0) return;
  const weg = aktiv.panels.splice(idx + 1);
  for (const p of weg) {
    if (p._parentItem) {
      p._parentItem.setAttribute("aria-expanded", "false");
      p._parentItem.classList.remove("kmenu-auf");
    }
    p.remove();
  }
}

// --- Positionierung -------------------------------------------------------

function platziere(panel, x, y) {
  document.body.appendChild(panel);
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  let nx = x;
  let ny = y;
  if (nx + w > window.innerWidth - 6) nx = Math.max(6, window.innerWidth - w - 6);
  if (ny + h > window.innerHeight - 6) ny = Math.max(6, window.innerHeight - h - 6);
  panel.style.left = nx + "px";
  panel.style.top = ny + "px";
}

// Untermenue neben seinen Eltern-Eintrag — rechts, oder links, wenn rechts kein Platz ist.
function platziereSub(sub, itemEl) {
  sub.style.visibility = "hidden";
  document.body.appendChild(sub);
  const r = itemEl.getBoundingClientRect();
  const w = sub.offsetWidth;
  const h = sub.offsetHeight;
  let x = r.right - 3;
  if (x + w > window.innerWidth - 6) x = r.left - w + 3; // klappt nach links
  if (x < 6) x = 6;
  let y = r.top - 5;
  if (y + h > window.innerHeight - 6) y = Math.max(6, window.innerHeight - h - 6);
  if (y < 6) y = 6;
  sub.style.left = x + "px";
  sub.style.top = y + "px";
  sub.style.visibility = "visible";
}

// --- Tastatur -------------------------------------------------------------

function aktivesPanel() {
  return aktiv ? aktiv.panels[aktiv.panels.length - 1] : null;
}

function aufTaste(e) {
  if (!aktiv) return;
  const panel = aktivesPanel();
  const items = panel._items;
  const fokus = document.activeElement;
  let i = items.indexOf(fokus);

  switch (e.key) {
    case "Escape":
      e.preventDefault();
      if (aktiv.panels.length > 1) {
        const sub = aktiv.panels[aktiv.panels.length - 1];
        const parent = sub._parentItem;
        schliesseSubsAb(sub._parentPanel);
        if (parent) parent.focus();
      } else {
        schliesseKontextmenu(true);
      }
      break;
    case "ArrowDown":
      e.preventDefault();
      items[(i + 1 + items.length) % items.length].focus();
      break;
    case "ArrowUp":
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
      break;
    case "Home":
      e.preventDefault();
      items[0].focus();
      break;
    case "End":
      e.preventDefault();
      items[items.length - 1].focus();
      break;
    case "ArrowRight":
      if (fokus && fokus._sub) {
        e.preventDefault();
        oeffneSub(fokus, true);
      }
      break;
    case "ArrowLeft":
      if (aktiv.panels.length > 1) {
        e.preventDefault();
        const sub = aktiv.panels[aktiv.panels.length - 1];
        const parent = sub._parentItem;
        schliesseSubsAb(sub._parentPanel);
        if (parent) parent.focus();
      }
      break;
    case "Enter":
    case " ":
      if (fokus && items.includes(fokus)) {
        e.preventDefault();
        fokus.click();
      }
      break;
  }
}

// --- Klein-Hilfe ----------------------------------------------------------

function escapeText(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
