// Breite der Detailspalte (v57, Owner 23.09.2026): per Ziehen am .detail-griff veraenderbar,
// 380px bis 80% der Fensterbreite, ueber Sitzungen hinweg gemerkt (wie das Theme). Der
// Fokus-Knopf (detail.js) ist ein Shortcut auf dieselbe Variable — KEIN zweiter, paralleler
// Breiten-Mechanismus mehr (das war die alte .hauptflaeche.fokus-Loesung, siehe style.css).
//
// Eigenes, kleines Modul statt ein Feld in store.js' S — reine UI-Sicht wie fokus.js vorher,
// aber jetzt der einzige Ort, der die Breite kennt (detail.js und app.js importieren beide
// von hier, kein Zyklus).

const SCHLUESSEL = "cm-detail-breite";
// v78 (Owner 28.09.2026): war 380 (v57) — bei diesem Wert brach der laengste Spaltenname
// ("Drehtermin festlegen") im Kopf mitten im Wort um und machte den Kopf hoeher, sobald ein
// Drive-Ordner-Knopf und der Befund-Indikator dazukamen. Nachgemessen (Browser, worst case:
// laengster Phasenname + Drive-Knopf + Befund-Indikator): passt ab 444px in eine Zeile; 460
// mit etwas Luft (z. B. ein zweistelliger Befund-Zaehler).
const MIN = 460;

const maxBreite = () => Math.round(window.innerWidth * 0.8);

function gespeicherteBreite() {
  try {
    const w = Number(localStorage.getItem(SCHLUESSEL));
    return Number.isFinite(w) && w > 0 ? w : MIN;
  } catch {
    return MIN;
  }
}

// Klemmt zwischen MIN und dem aktuellen Maximum — faellt das Maximum (schmales Fenster) unter
// MIN, gewinnt das Maximum: eine unmoegliche Untergrenze darf das Layout nicht sprengen.
function klemme(px) {
  return Math.min(Math.max(px, MIN), maxBreite());
}

let breite = gespeicherteBreite();
let vorMaximum = null; // letzte Breite vor dem Sprung auf Maximum, fuers Zurueckspringen

let detailEl = null;
let griffEl = null;

function anwenden() {
  breite = klemme(breite);
  if (detailEl) detailEl.style.flexBasis = breite + "px";
}

export function setzeBreite(px, { speichern = true } = {}) {
  breite = klemme(px);
  anwenden();
  if (speichern) {
    try {
      localStorage.setItem(SCHLUESSEL, String(breite));
    } catch {}
  }
}

export function istMaximal() {
  return breite >= maxBreite() - 1;
}

// Fokus-Knopf-Shortcut: erster Klick zieht auf Maximum (merkt sich die vorherige Breite),
// zweiter Klick (oder Kartenschluss, siehe detail.js) geht zurueck.
export function springeZuMaximum() {
  if (istMaximal()) {
    setzeBreite(vorMaximum ?? MIN);
    vorMaximum = null;
  } else {
    vorMaximum = breite;
    setzeBreite(maxBreite());
  }
}

export function verlasseMaximumFallsAktiv() {
  if (istMaximal()) springeZuMaximum();
}

export function verdrahteDetailBreite(detail, griff) {
  detailEl = detail;
  griffEl = griff;
  anwenden();

  let ziehtGerade = false;
  let startX = 0;
  let startBreite = 0;

  const bewegt = (e) => {
    const dx = startX - e.clientX; // Detailspalte sitzt rechts: nach links ziehen = breiter
    setzeBreite(startBreite + dx, { speichern: false });
  };
  const losgelassen = () => {
    if (!ziehtGerade) return;
    ziehtGerade = false;
    griffEl.classList.remove("zieht");
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", bewegt);
    document.removeEventListener("mouseup", losgelassen);
    setzeBreite(breite); // jetzt erst speichern — waehrend des Ziehens nicht bei jedem Pixel
  };

  griffEl.addEventListener("mousedown", (e) => {
    e.preventDefault();
    ziehtGerade = true;
    startX = e.clientX;
    startBreite = breite;
    griffEl.classList.add("zieht");
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", bewegt);
    document.addEventListener("mouseup", losgelassen);
  });

  // Fenster wird schmaler (oder breiter) als beim letzten Ziehen — Breite neu klemmen, damit
  // sie nie ueber 80% des jetzigen Fensters hinaussteht.
  window.addEventListener("resize", anwenden);
}
