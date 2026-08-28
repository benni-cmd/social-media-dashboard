// Verdrahtung: Kopfzeile, Ansichten, Zeichnen. Die Arbeit selbst steckt in den Modulen.

import { PHASEN } from "/lib/pipeline.js";
import { S, beiAenderung, zeichne, ladeBoard, verdrahteKopf, melde, setStand, driveAbgleich, driveStatus } from "./store.js";
import { zeichneBoard, schiebe, beiOeffnen as boardOeffnet } from "./board.js";
import { zeichneKalender, beiOeffnen as kalenderOeffnet } from "./kalender.js";
import { zeichneAuswertung, beiOeffnen as auswertungOeffnet } from "./auswertung.js";
import { zeichneDetail, beiSchieben } from "./detail.js";
import { fortschritt, statusChip, escape } from "./ui.js";

const el = (id) => document.getElementById(id);

const boardEl = el("board");
const lastEl = el("wochenlast");
const kalenderEl = el("ansicht-kalender");
const auswertungEl = el("ansicht-auswertung");
const detailEl = el("detail");

const ansichten = {
  board: el("ansicht-board"),
  kalender: kalenderEl,
  auswertung: auswertungEl,
};
const knoepfe = {
  board: el("zu-board"),
  kalender: el("zu-kalender"),
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
kalenderOeffnet(oeffne);
auswertungOeffnet(oeffne);
beiSchieben(schiebe);

// --- Ansichten ------------------------------------------------------------

function wechsle(name) {
  S.ansicht = name;
  for (const [k, knopf] of Object.entries(knoepfe)) knopf.setAttribute("aria-pressed", String(k === name));
  for (const [k, flaeche] of Object.entries(ansichten)) flaeche.hidden = k !== name;
  zeichne();
}
for (const [name, knopf] of Object.entries(knoepfe)) knopf.addEventListener("click", () => wechsle(name));

// --- Zeichnen -------------------------------------------------------------

let zeichnetGerade = false;

beiAenderung(() => {
  if (zeichnetGerade) return;
  zeichnetGerade = true;
  try {
    if (S.ansicht === "board") zeichneBoard(boardEl, lastEl);
    else if (S.ansicht === "kalender") zeichneKalender(kalenderEl);
    else if (S.ansicht === "auswertung") zeichneAuswertung(auswertungEl);
    zeichneDetail(detailEl);
  } finally {
    zeichnetGerade = false;
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

// --- Start ----------------------------------------------------------------

(async () => {
  try {
    await ladeBoard();
    setStand(`${S.cards.length} Karten geladen.`);
  } catch (e) {
    await melde("befund", `Das Board liess sich nicht laden: ${e.message}`);
  }

  // Rueckkehr aus dem OAuth-Verbindungsfluss: Meldung zeigen und in die Auswertung springen.
  const rueck = new URLSearchParams(location.search);
  let ziel = "board";
  if (rueck.has("verbunden")) {
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
    .catch(() => {});
})();
