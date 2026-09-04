// Verdrahtung: Kopfzeile, Ansichten, Zeichnen. Die Arbeit selbst steckt in den Modulen.

import { PHASEN } from "/lib/pipeline.js";
import { S, beiAenderung, zeichne, ladeBoard, verdrahteKopf, melde, setStand, driveAbgleich, driveStatus, ladeDefaults, ladeWorkflows } from "./store.js";
import { zeichneBoard, schiebe, beiOeffnen as boardOeffnet } from "./board.js";
import { beiOeffnen as drehOeffnet } from "./drehtermine.js";
import { beiOeffnen as kalenderOeffnet } from "./kalender.js";
import { zeichneAuswertung, beiOeffnen as auswertungOeffnet } from "./auswertung.js";
import { zeichneDetail, beiSchieben } from "./detail.js";
import { fortschritt, statusChip, escape, einstellungenModal, meldung } from "./ui.js";
// P27: eigene, kleine Imports statt die bestehende store.js/pipeline.js-Importzeile
// anzufassen — haelt diese Ergaenzung unabhaengig von paralleler Arbeit an store.js.
import { phaseIndex, faelligkeit } from "/lib/pipeline.js";
import { FOKUS } from "./fokus.js";

// --- Theme ---
function setzeTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  try { localStorage.setItem("cm-theme", name); } catch {}
}
const gespeichertesTheme = (() => { try { return localStorage.getItem("cm-theme"); } catch { return null; } })();
if (gespeichertesTheme) setzeTheme(gespeichertesTheme);
// Kein gespeichertes Theme = Light (Default, steht in CSS).

const el = (id) => document.getElementById(id);

const boardEl = el("board");
const lastEl = el("wochenlast");
const auswertungEl = el("ansicht-auswertung");
const detailEl = el("detail");
const hauptflaecheEl = el("hauptflaeche");

const ansichten = {
  board: el("ansicht-board"),
  auswertung: auswertungEl,
};
const knoepfe = {
  board: el("zu-board"),
  auswertung: el("zu-auswertung"),
};

verdrahteKopf(el("stand"), el("meldung"));
el("kopf-pfad").textContent = PHASEN.map((p) => p.name).join(" › ");

// --- Karte oeffnen --------------------------------------------------------

function oeffne(id) {
  S.aktiv = id;
  zeichne();
}
boardOeffnet(oeffne);
drehOeffnet(oeffne);
kalenderOeffnet(oeffne);
auswertungOeffnet(oeffne);
beiSchieben(schiebe);

// --- Naechster Schritt (P27 F3) --------------------------------------------
//
// Springt automatisch zur sinnvollsten offenen Karte, statt dass man das Board selbst nach
// ihr absuchen muss. Heuristik bewusst einfach gehalten: erst nach Phasen-Reihenfolge
// (phaseIndex — "Skript schreiben" vor "Videodreh" vor ...), innerhalb derselben Phase nach
// Dringlichkeit der Faelligkeit (ueberfaellig zuerst, dann je naeher am Termin). Karten ohne
// gesetztes Datum zaehlen als mittel dringend, nicht als dringlichste — siehe Paket-Doc.
function dringlichkeit(k) {
  const f = faelligkeit(k);
  if (f.tage == null) return 0;
  return f.tage < 0 ? -100000 + f.tage : f.tage;
}
function naechsteSinnvolleKarte() {
  const offen = S.cards.filter((k) => k.column !== "fertig" && k.column !== "verworfen");
  if (!offen.length) return null;
  return [...offen].sort((a, b) => {
    const diff = phaseIndex(a.column) - phaseIndex(b.column);
    return diff !== 0 ? diff : dringlichkeit(a) - dringlichkeit(b);
  })[0];
}
el("naechster-schritt").addEventListener("click", () => {
  const k = naechsteSinnvolleKarte();
  if (!k) {
    meldung("Keine offene Karte gefunden — alles ist fertig oder verworfen.", "erfolg");
    return;
  }
  oeffne(k.id);
});

// --- Ansichten ------------------------------------------------------------

function wechsle(name) {
  S.ansicht = name;
  for (const [k, knopf] of Object.entries(knoepfe)) knopf.setAttribute("aria-pressed", String(k === name));
  for (const [k, flaeche] of Object.entries(ansichten)) flaeche.hidden = k !== name;
  zeichne();
}
for (const [name, knopf] of Object.entries(knoepfe)) knopf.addEventListener("click", () => wechsle(name));

// --- Zeichnen -------------------------------------------------------------
//
// Jede Ansicht zeichnet in ihrem EIGENEN try/catch: ein Fehler in einer Ansicht darf die
// anderen nicht mitreissen und — wichtiger — nie aus `zeichne()` herausschlagen. Frueher
// brach ein Zeichenfehler beim Start die ganze Start-Schleife ab (Board blieb leer, der
// weiter unten verdrahtete Beenden-Slider wurde nie erreicht). Der Slider haengt jetzt nicht
// mehr am Zeichnen (siehe verdrahteShutdownSlider), und ein transienter Zeichenfehler heilt
// sich selbst durch einen kurzen erneuten Zeichenlauf — kein Ansichtswechsel von Hand noetig.

let zeichnetGerade = false;
let zeichenFehlerRetries = 0;

beiAenderung(() => {
  if (zeichnetGerade) return;
  zeichnetGerade = true;
  let fehler = null;
  try {
    try {
      if (S.ansicht === "board") zeichneBoard(boardEl, lastEl);
      else if (S.ansicht === "auswertung") zeichneAuswertung(auswertungEl);
    } catch (e) { fehler = fehler || e; }
    try { zeichneDetail(detailEl); } catch (e) { fehler = fehler || e; }
    try {
      // Fokus-Ansicht (P27 F4) nur wirksam, solange auch eine Karte offen ist — schliesst sich
      // die Karte, verlaesst die Fokus-Ansicht sich damit von selbst, ohne S.fokus zu verwalten.
      hauptflaecheEl.classList.toggle("fokus", FOKUS.an && !!S.aktiv);
    } catch (e) { fehler = fehler || e; }
  } finally {
    zeichnetGerade = false;
  }
  if (fehler) {
    console.error(`Zeichenfehler (Versuch ${zeichenFehlerRetries + 1}):`, fehler);
    // Begrenzt neu versuchen: die haeufigste Ursache ist ein noch nicht fertig geladener
    // Zustand, der sich in Millisekunden legt. Ein echter Dauerfehler loopt dank Zaehler nicht.
    if (zeichenFehlerRetries < 5) {
      zeichenFehlerRetries += 1;
      setTimeout(() => zeichne(), 200);
    }
  } else {
    zeichenFehlerRetries = 0;
  }
});

// --- Kopfzeilen-Handlungen ------------------------------------------------

el("neuladen").addEventListener("click", async (e) => {
  e.currentTarget.disabled = true;
  setStand("Lade den Stand neu …");
  S.driveStand.clear();
  S.zahlen = null;
  try {
    await ladeBoard();
    setStand("Stand ist aktuell.");
  } catch (fehler) {
    await melde("befund", `Der Stand liess sich nicht laden: ${fehler.message}`);
  } finally {
    e.currentTarget.disabled = false;
  }
});

el("abgleichen").addEventListener("click", async (e) => {
  e.currentTarget.disabled = true;
  const weg = fortschritt(lastEl, "Lese alle Phasenordner in Drive und vergleiche sie mit dem Board …");
  try {
    const ergebnis = await driveAbgleich();
    const meldungEl = el("meldung");
    meldungEl.hidden = false;
    meldungEl.innerHTML =
      `<div style="display:flex;flex-direction:column;gap:6px;flex:1 1 auto">` +
      ergebnis.befunde
        .map((b) => `<div class="befund">${statusChip(b.status)}<span class="befund-satz">${escape(b.satz)}</span></div>`)
        .join("") +
      `</div>` +
      `<button class="meldung-schliessen" aria-label="Meldung schliessen">×</button>`;
    meldungEl.querySelector(".meldung-schliessen").addEventListener("click", () => (meldungEl.hidden = true));
    setStand(ergebnis.geaendert ? "Board an Drive angeglichen." : "Board und Drive waren schon gleich.");
  } catch (fehler) {
    await melde("befund", `Der Abgleich lief nicht durch: ${fehler.message}`);
  } finally {
    weg();
    e.currentTarget.disabled = false;
  }
});

// --- Einstellungen --------------------------------------------------------

el("einstellungen").addEventListener("click", () => {
  einstellungenModal((theme) => setzeTheme(theme));
});

// --- Kopf-Menue: Seltenes hinter einem Knopf, statt staendig sichtbar -----

{
  const knopfEl = el("kopf-menu-knopf");
  const listeEl = el("kopf-menu-liste");
  const schliesse = () => {
    listeEl.hidden = true;
    knopfEl.setAttribute("aria-expanded", "false");
  };
  knopfEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const offen = !listeEl.hidden;
    listeEl.hidden = offen;
    knopfEl.setAttribute("aria-expanded", String(!offen));
  });
  listeEl.addEventListener("click", (e) => {
    if (e.target.closest(".kopf-menu-item")) schliesse();
  });
  document.addEventListener("click", (e) => {
    if (!listeEl.hidden && !e.target.closest(".kopf-menu")) schliesse();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") schliesse();
  });
}

// --- Beenden-Slider -------------------------------------------------------
//
// Bewusst SYNCHRON beim Modulstart verdrahtet und unabhaengig vom Board-Laden/Zeichnen: der
// Slider-DOM steht schon im HTML (das Script liegt am Body-Ende). Frueher lief diese
// Verdrahtung am Ende der async Start-Schleife — brach dort davor etwas ab (z. B. ein
// Zeichenfehler), wurde der Slider nie verdrahtet und blieb tot. Eigenes try/catch, damit ein
// Fehler hier umgekehrt den Start nicht kippt.
function verdrahteShutdownSlider() {
  const track = el("shutdown-slider");
  const handle = el("shutdown-handle");
  if (!track || !handle) return;
  const SCHWELLE = 0.82;
  let ziehen = false;
  let startX = 0;
  let maxX = 0;

  function berechneMaxX() {
    return track.offsetWidth - handle.offsetWidth - 6;
  }

  function setzeX(x) {
    const begrenzt = Math.max(0, Math.min(x, maxX));
    handle.style.transform = `translateX(${begrenzt}px)`;
    const fortschritt = begrenzt / maxX;
    track.querySelector(".shutdown-label").style.opacity = String(1 - fortschritt * 1.6);
    return begrenzt / maxX;
  }

  function losgelassen(x) {
    const ratio = setzeX(x);
    if (ratio >= SCHWELLE) {
      track.classList.add("ausgeloest");
      handle.style.transform = `translateX(${maxX}px)`;
      track.querySelector(".shutdown-label").textContent = "wird beendet …";
      track.querySelector(".shutdown-label").style.opacity = "1";
      fetch("/api/shutdown", { method: "POST" })
        .then(() => { setTimeout(() => window.close(), 600); })
        .catch(() => { meldung("Server antwortet nicht – CMD-Fenster manuell schließen.", "fehler"); });
    } else {
      handle.style.transition = "transform 0.25s cubic-bezier(.4,0,.2,1)";
      handle.style.transform = "translateX(0)";
      track.querySelector(".shutdown-label").style.opacity = "1";
      setTimeout(() => { handle.style.transition = ""; }, 260);
    }
    ziehen = false;
  }

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    ziehen = true;
    startX = e.clientX;
    maxX = berechneMaxX();
  });
  handle.addEventListener("touchstart", (e) => {
    ziehen = true;
    startX = e.touches[0].clientX;
    maxX = berechneMaxX();
  }, { passive: true });

  document.addEventListener("mousemove", (e) => {
    if (!ziehen) return;
    setzeX(e.clientX - startX);
  });
  document.addEventListener("touchmove", (e) => {
    if (!ziehen) return;
    setzeX(e.touches[0].clientX - startX);
  }, { passive: true });

  document.addEventListener("mouseup", (e) => {
    if (!ziehen) return;
    losgelassen(e.clientX - startX);
  });
  document.addEventListener("touchend", (e) => {
    if (!ziehen) return;
    losgelassen(e.changedTouches[0].clientX - startX);
  });
}

try {
  verdrahteShutdownSlider();
} catch (e) {
  console.error("Beenden-Slider konnte nicht verdrahtet werden:", e);
}

// --- Start ----------------------------------------------------------------

(async () => {
  try {
    // Der Workflow-Stand muss VOR dem Board stehen: das Laden setzt ggf. selbst einen
    // Drehtermin, und dieser Griff ist einer der abschaltbaren Workflows (v26).
    await ladeWorkflows();
    await Promise.all([ladeBoard(), ladeDefaults()]);
    setStand(`${S.cards.length} Karten geladen.`);
  } catch (e) {
    await melde("befund", `Das Board liess sich nicht laden: ${e.message}`);
  }

  // Rueckkehr aus dem OAuth-Verbindungsfluss: Meldung zeigen und in die Auswertung springen.
  const rueck = new URLSearchParams(location.search);
  let ziel = "board";
  if (rueck.get("verbunden") === "google") {
    await melde("ok", "Google ist verbunden. Drehtermine kannst du jetzt in Kalender und Tasks eintragen.");
    history.replaceState({}, "", "/");
    ziel = "board";
  } else if (rueck.has("verbunden")) {
    const name = rueck.get("verbunden") === "linkedin" ? "LinkedIn" : "Instagram";
    S.zahlen = null;
    S.zahlenLi = null;
    await melde("ok", `${name} ist verbunden. Die Zahlen stehen jetzt unter „Auswertung“.`);
    history.replaceState({}, "", "/");
    ziel = "auswertung";
  } else if (rueck.has("fehler")) {
    await melde("befund", `Die Verbindung ist fehlgeschlagen: ${rueck.get("fehler")}`);
    history.replaceState({}, "", "/");
    ziel = "auswertung";
  }
  wechsle(ziel);

  // Drive einmal beim Start pruefen — damit ein Ausfall sofort sichtbar ist und nicht
  // erst dann, wenn eine Karte faelschlich als "kein Ordner" erscheint.
  driveStatus()
    .then((s) => {
      if (!s.ok) melde("unlesbar", s.satz);
    })
    .catch(() => {
      meldung("Drive-Verbindung beim Start nicht erreichbar.", "fehler");
    });
})();
