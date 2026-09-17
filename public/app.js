// Verdrahtung: Kopfzeile, Ansichten, Zeichnen. Die Arbeit selbst steckt in den Modulen.

import { S, beiAenderung, zeichne, ladeBoard, verdrahteKopf, melde, setStand, driveAbgleich, abgleichLaeuft, driveStatus, gcalStatus, ladeDefaults, ladeWorkflows, speichere } from "./store.js";
import { zeichneBoard, schiebe, beiOeffnen as boardOeffnet } from "./board.js";
import { beiOeffnen as drehOeffnet } from "./drehtermine.js";
import { beiOeffnen as kalenderOeffnet } from "./kalender.js";
import { zeichneAuswertung, beiOeffnen as auswertungOeffnet } from "./auswertung.js";
import { zeichneDetail, beiSchieben } from "./detail.js";
import { fortschritt, statusChip, escape, einstellungenModal, meldung, hinweisToast, sanduhr } from "./ui.js";
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

// Kopf-Stand mit drehender Sanduhr (v32 E4): waehrend Aktualisieren/Drive-Abgleich laufen,
// zeigt der Kopf die Sanduhr statt nur Text — „da passiert gerade was". setStand(text) danach
// setzt wieder reinen Text und raeumt die Sanduhr weg.
function standLaedt(text) {
  const s = el("stand");
  if (!s) return;
  s.innerHTML = "";
  s.appendChild(sanduhr(text));
}

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

verdrahteKopf(el("stand"));

// --- Google/Drive-Badge im Kopf (v52) --------------------------------------
//
// Fasst zwei bisher getrennte Zustaende in einem Indikator zusammen: ist Google (Kalender+
// Tasks) verbunden, ist Drive erreichbar, und war der letzte Hintergrund-Abgleich mit Drive
// erfolgreich. Alle drei speisen sich aus ohnehin vorhandenen Aufrufen (kein neuer Endpunkt).
const badgeEl = el("google-drive-badge");
let googleOk = null;
let driveOk = null;
let syncOk = null;
function zeichneBadge() {
  if (!badgeEl) return;
  // v51: Der Hintergrund-Abgleich lief bisher voellig stumm (gemessen 10-70 s, waehrenddessen
  // springen Karten scheinbar grundlos um). Solange er laeuft, sagt das Badge es.
  if (abgleichLaeuft()) {
    badgeEl.innerHTML = "";
    badgeEl.appendChild(sanduhr("Gleicht gerade mit Drive ab …"));
    badgeEl.title = "Gleicht gerade mit Drive ab — Karten koennen sich dabei aktualisieren.";
    return;
  }
  if (googleOk === null || driveOk === null) {
    badgeEl.innerHTML = statusChip("unlesbar") + `<span>Google/Drive: wird geprueft …</span>`;
    return;
  }
  const luecken = [];
  if (!googleOk) luecken.push("Google Kalender nicht verbunden");
  if (!driveOk) luecken.push("Drive nicht erreichbar");
  if (syncOk === false) luecken.push("letzter Live-Abgleich fehlgeschlagen");
  const code = luecken.length ? "befund" : "ok";
  const satz = luecken.length ? luecken.join(" · ") : "Google + Drive verbunden, live abgeglichen";
  badgeEl.innerHTML = statusChip(code) + `<span>${escape(satz)}</span>`;
  badgeEl.title = satz;
}
zeichneBadge();
gcalStatus()
  .then((s) => { googleOk = !!s.verbunden; zeichneBadge(); })
  .catch(() => { googleOk = false; zeichneBadge(); });

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
  standLaedt("Lade den Stand neu …");
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
  standLaedt("Gleiche mit Drive ab …");
  const weg = fortschritt(lastEl, "Lese alle Phasenordner in Drive und vergleiche sie mit dem Board …");
  try {
    const ergebnis = await driveAbgleich();
    for (const b of ergebnis.befunde) hinweisToast(b.status, b.satz);
    driveOk = true;
    syncOk = true;
    zeichneBadge();
    setStand(ergebnis.geaendert ? "Board an Drive angeglichen." : "Board und Drive waren schon gleich.");
  } catch (fehler) {
    syncOk = false;
    zeichneBadge();
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
  const items = () => Array.from(listeEl.querySelectorAll(".kopf-menu-item"));
  const fokussiere = (i) => {
    const es = items();
    if (!es.length) return;
    const n = (i + es.length) % es.length;
    es[n].focus();
  };
  const oeffne = () => {
    listeEl.hidden = false;
    knopfEl.setAttribute("aria-expanded", "true");
    fokussiere(0); // Tastatur landet direkt im ersten Eintrag
  };
  const schliesse = ({ fokusKnopf = false } = {}) => {
    if (listeEl.hidden) return;
    listeEl.hidden = true;
    knopfEl.setAttribute("aria-expanded", "false");
    if (fokusKnopf) knopfEl.focus();
  };
  knopfEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (listeEl.hidden) oeffne();
    else schliesse();
  });
  // Pfeil-runter oeffnet das Menue aus dem Knopf heraus (Standard-Menue-Verhalten).
  knopfEl.addEventListener("keydown", (e) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && listeEl.hidden) {
      e.preventDefault();
      oeffne();
      if (e.key === "ArrowUp") fokussiere(-1);
    }
  });
  listeEl.addEventListener("click", (e) => {
    // Einstellungen oeffnet ein Modal -> schliessen; die Daten-Aktionen schliessen ebenso
    // (ihr Fortschritt steht im Kopf-"Stand"). Fokus zurueck auf den Knopf.
    if (e.target.closest(".kopf-menu-item")) schliesse({ fokusKnopf: false });
  });
  // Tastatur INNERHALB des Menues: Pfeile, Home/End, Escape/Tab schliessen.
  listeEl.addEventListener("keydown", (e) => {
    const es = items();
    const i = es.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); fokussiere(i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); fokussiere(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); fokussiere(0); }
    else if (e.key === "End") { e.preventDefault(); fokussiere(-1); }
    else if (e.key === "Escape") { e.preventDefault(); schliesse({ fokusKnopf: true }); }
    else if (e.key === "Tab") { schliesse(); }
  });
  document.addEventListener("click", (e) => {
    if (!listeEl.hidden && !e.target.closest(".kopf-menu")) schliesse();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !listeEl.hidden) schliesse({ fokusKnopf: true });
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
      track.querySelector(".shutdown-label").textContent = "sichert & beendet …";
      track.querySelector(".shutdown-label").style.opacity = "1";
      // v32 C3 (Flush): erst den lokalen Stand durchschreiben (offene, debouncte Speicherung),
      // dann beenden — der Server bringt danach die letzte Drive-Spiegelung zu Ende. So steht
      // der letzte Stand sicher in board.json UND in Drive, bevor der Prozess endet.
      Promise.resolve(speichere())
        .catch(() => {})
        .then(() => fetch("/api/shutdown", { method: "POST" }))
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
  // Ladezustand (v32 E1): nie ein totes leeres Board zeigen, solange /api/board laedt — eine
  // drehende Sanduhr signalisiert „da kommt gleich was". Der erste Zeichenlauf ersetzt sie.
  try {
    const ladeMarke = document.createElement("div");
    ladeMarke.style.cssText = "padding:40px;display:flex;justify-content:center;width:100%";
    ladeMarke.appendChild(sanduhr("Board wird geladen …"));
    boardEl.innerHTML = "";
    boardEl.appendChild(ladeMarke);
  } catch {}
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
      driveOk = !!s.ok;
      zeichneBadge();
      if (!s.ok) melde("unlesbar", s.satz);
    })
    .catch(() => {
      driveOk = false;
      zeichneBadge();
      meldung("Drive-Verbindung beim Start nicht erreichbar.", "fehler");
    });

  // --- Hintergrund-Abgleich (v32 C3) ---------------------------------------
  //
  // Das Board steht sofort aus dem schnellen Cache; ein Voll-Abgleich mit Drive holt
  // Hand-Aenderungen (in Drive verschobene/umbenannte Ordner) still nach — NICHT blockierend,
  // damit der Start nie wieder haengt/leer aussieht. Beim Start einmal und danach alle 30 Min,
  // aber nur wenn das Fenster im Vordergrund ist (kein Sinn, im Hintergrund rclone zu treiben).
  // `driveAbgleich` teilt einen laufenden Abgleich, ein Fehler bleibt still (Board fuehrt).
  function hintergrundAbgleich() {
    if (abgleichLaeuft()) return;
    // Erst starten (das setzt die Laeuft-Marke synchron), dann zeichnen — sonst sieht das
    // Badge den laufenden Abgleich nie.
    const lauf = driveAbgleich();
    zeichneBadge();
    lauf.then(
      () => { driveOk = true; syncOk = true; zeichneBadge(); },
      () => { syncOk = false; zeichneBadge(); }
    );
  }
  hintergrundAbgleich();
  setInterval(() => {
    if (document.visibilityState === "visible") hintergrundAbgleich();
  }, 30 * 60 * 1000);
})();
