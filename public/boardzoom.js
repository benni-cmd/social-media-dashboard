// Ansichts-Zoom (v102, Owner 01.10.2026; Auswertung 05.10.2026): macht NUR den Inhalt einer Ansicht (Board: Spalten und
// Nachschub; Auswertung: ihre Bloecke) groesser oder
// kleiner, unabhaengig von Kopfzeile und Browser-Zoom. Zwei Knoepfe unten rechts auf der Board-Ebene,
// je Klick 5 Prozentpunkte; die Mitte zeigt den Wert und setzt per Klick auf 100 % zurueck.
// Der Wert bleibt im Browser erhalten (localStorage ist nur eine Bequemlichkeit, die Ansicht
// funktioniert auch ohne).
import { icon } from "./ui.js";

const MIN = 50, MAX = 150, SCHRITT = 5, STANDARD = 100;
function lies(SCHLUESSEL) {
  try {
    const v = Number(localStorage.getItem(SCHLUESSEL));
    if (Number.isFinite(v) && v >= MIN && v <= MAX) return Math.round(v / SCHRITT) * SCHRITT;
  } catch {}
  return STANDARD;
}
function merke(SCHLUESSEL, v) {
  try { localStorage.setItem(SCHLUESSEL, String(v)); } catch {}
}

// Je Ansicht ein eigener Wert (Schluessel) und eine eigene CSS-Variable; `name` steht in den Beschriftungen.
export function verdrahteBoardZoom(el, { schluessel = "cm-board-zoom", variable = "--board-zoom", name = "Board" } = {}) {
  if (!el) return;
  let wert = lies(schluessel);
  el.innerHTML =
    `<button type="button" class="board-zoom-knopf" data-richtung="-1" aria-label="${name} verkleinern" title="${name} verkleinern (5 %)">${icon("minusStrich")}</button>` +
    `<button type="button" class="board-zoom-wert" aria-label="${name}-Groesse auf 100 Prozent setzen" title="Auf 100 % zuruecksetzen"></button>` +
    `<button type="button" class="board-zoom-knopf" data-richtung="1" aria-label="${name} vergroessern" title="${name} vergroessern (5 %)">${icon("plus")}</button>`;
  const [minus, anzeige, plus] = el.querySelectorAll("button");

  function anwenden() {
    document.documentElement.style.setProperty(variable, String(wert / 100));
    anzeige.textContent = `${wert} %`;
    minus.disabled = wert <= MIN;
    plus.disabled = wert >= MAX;
    anzeige.classList.toggle("board-zoom-geaendert", wert !== STANDARD);
  }
  function setze(neu) {
    wert = Math.max(MIN, Math.min(MAX, neu));
    merke(schluessel, wert);
    anwenden();
  }
  minus.addEventListener("click", () => setze(wert - SCHRITT));
  plus.addEventListener("click", () => setze(wert + SCHRITT));
  anzeige.addEventListener("click", () => setze(STANDARD));
  anwenden();
}
