// Board-Zoom (v102, Owner 01.10.2026): macht NUR den Board-Inhalt (Spalten, Nachschub) groesser oder
// kleiner, unabhaengig von Kopfzeile und Browser-Zoom. Zwei Knoepfe unten rechts auf der Board-Ebene,
// je Klick 5 Prozentpunkte; die Mitte zeigt den Wert und setzt per Klick auf 100 % zurueck.
// Der Wert bleibt im Browser erhalten (localStorage ist nur eine Bequemlichkeit, die Ansicht
// funktioniert auch ohne).
import { icon } from "./ui.js";

const MIN = 50, MAX = 150, SCHRITT = 5, STANDARD = 100;
const SCHLUESSEL = "cm-board-zoom";

function lies() {
  try {
    const v = Number(localStorage.getItem(SCHLUESSEL));
    if (Number.isFinite(v) && v >= MIN && v <= MAX) return Math.round(v / SCHRITT) * SCHRITT;
  } catch {}
  return STANDARD;
}
function merke(v) {
  try { localStorage.setItem(SCHLUESSEL, String(v)); } catch {}
}

export function verdrahteBoardZoom(el) {
  if (!el) return;
  let wert = lies();
  el.innerHTML =
    `<button type="button" class="board-zoom-knopf" data-richtung="-1" aria-label="Board verkleinern" title="Board verkleinern (5 %)">${icon("minusStrich")}</button>` +
    `<button type="button" class="board-zoom-wert" aria-label="Board-Groesse auf 100 Prozent setzen" title="Auf 100 % zuruecksetzen"></button>` +
    `<button type="button" class="board-zoom-knopf" data-richtung="1" aria-label="Board vergroessern" title="Board vergroessern (5 %)">${icon("plus")}</button>`;
  const [minus, anzeige, plus] = el.querySelectorAll("button");

  function anwenden() {
    document.documentElement.style.setProperty("--board-zoom", String(wert / 100));
    anzeige.textContent = `${wert} %`;
    minus.disabled = wert <= MIN;
    plus.disabled = wert >= MAX;
    anzeige.classList.toggle("board-zoom-geaendert", wert !== STANDARD);
  }
  function setze(neu) {
    wert = Math.max(MIN, Math.min(MAX, neu));
    merke(wert);
    anwenden();
  }
  minus.addEventListener("click", () => setze(wert - SCHRITT));
  plus.addEventListener("click", () => setze(wert + SCHRITT));
  anzeige.addEventListener("click", () => setze(STANDARD));
  anwenden();
}
