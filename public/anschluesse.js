// Die Anschluss-Leiste im Kopf (v58).
//
// Vorher trug die Kopfzeile EINEN Sammel-Marker ("Google + Drive verbunden, live
// abgeglichen"). Daraus war weder ablesbar, welcher Dienst gerade arbeitet, noch was er tut.
// Jetzt: eine Sektion je Anschluss-Art, mit eigenem Marker, eigenem Abgleich-Knopf und einem
// aufklappbaren Terminal, in dem jeder externe Aufruf live mitlesbar ist.
//
// Die Ereignisse kommen aus dem Server (lib/ereignisse.js) ueber GET /api/ereignisse/stream.
// Eigenes Modul, damit app.js nicht weiter waechst und die Leiste an EINER Stelle lebt.

import { S, driveAbgleich, instagramZahlen, linkedinZahlen, gcalStatus, gcalSync, melde } from "./store.js";
import { icon, statusChip, escape, sanduhr } from "./ui.js";

// Das Register. Eine neue Plattform (YouTube, TikTok) ist hier eine Zeile in `dienste`
// plus ihr Abruf in `abgleich` — nichts anderes muss angefasst werden.
const SEKTIONEN = [
  {
    id: "api",
    name: "API",
    titel: "Zahlen der Social-Plattformen",
    dienste: ["instagram", "linkedin"], // spaeter: youtube, tiktok
    abgleich: {
      text: "Zahlen neu abrufen",
      // Beide parallel: sie haengen an verschiedenen Diensten, nacheinander waere nur langsamer.
      lauf: () => Promise.allSettled([instagramZahlen(), linkedinZahlen()]).then(pruefeAlle),
    },
  },
  {
    id: "drive",
    name: "Drive",
    titel: "Google Drive (ueber rclone)",
    dienste: ["rclone"],
    abgleich: { text: "Board mit Drive abgleichen", lauf: () => driveAbgleich() },
  },
  {
    id: "weitere",
    name: "Weitere",
    titel: "Google Kalender und Tasks, Web-Suche",
    dienste: ["google", "tavily", "duckduckgo"],
    abgleich: { text: "Verbindung pruefen und Drehtermine nachziehen", lauf: () => weitereAbgleichen() },
  },
  {
    id: "ki",
    name: "KI",
    titel: "Ollama und Claude",
    dienste: ["ollama", "claude"],
    // Bewusst ohne Abgleich-Knopf (Owner 23.09.2026): ein KI-Lauf geht von einer Karte aus,
    // nicht von der Kopfzeile. Hier wird nur mitgelesen.
    abgleich: null,
  },
];

// Ein `Promise.allSettled` verschluckt Fehler — hier werden sie wieder sichtbar, sonst
// meldete der Knopf Erfolg, obwohl eine Plattform nicht geantwortet hat.
function pruefeAlle(ergebnisse) {
  const kaputt = ergebnisse.filter((r) => r.status === "rejected");
  if (kaputt.length) throw new Error(kaputt.map((r) => r.reason?.message || String(r.reason)).join(" · "));
  return ergebnisse.map((r) => r.value);
}

// Owner-Entscheidung 23.09.2026: Der Knopf der Sektion „Weitere" prueft die Verbindung UND
// zieht alle Drehtermine nach, die noch kein Google-Event tragen — sonst waere es ein Knopf,
// der nur eine Ampel umschaltet. Die Web-Suche hat keinen Zustand zum Auffrischen.
async function weitereAbgleichen() {
  const stand = await gcalStatus();
  if (!stand || !stand.verbunden) return stand;
  const offen = (S.drehtermine || []).filter((t) => !t.gcalEventId);
  for (const t of offen) await gcalSync(t.id);
  return { ...stand, nachgezogen: offen.length };
}

// --- Zustand --------------------------------------------------------------

const aktiv = { api: false, drive: false, weitere: false, ki: false };
const verlauf = { api: [], drive: [], weitere: [], ki: [] };
const HOECHSTENS = 200; // was die Anzeige haelt; die volle Tiefe liegt im Server
let offeneSektion = null;
let leiste = null;

// Wie es um den Ereignis-Strom steht. Wichtig fuer den Leerzustand: „nichts passiert" und
// „ich kann es nicht wissen" sind ZWEI Zustaende. Die erste Fassung zeigte fuer beide denselben
// Satz — und behauptete damit Ruhe, waehrend in Wahrheit die Verbindung fehlte.
let feed = { stand: "verbindet", satz: "" };

function merke(e) {
  const liste = verlauf[e.sektion];
  if (!liste) return;
  // Ein Abschluss ersetzt seine eigene Anfangszeile, statt eine zweite daneben zu stellen —
  // im Terminal soll EINE Zeile je Aufruf stehen, die sich vom Laufen auf Fertig umstellt.
  if (e.zuId) {
    const i = liste.findIndex((x) => x.id === e.zuId);
    if (i >= 0) {
      // Der Befehl bleibt stehen, das Ergebnis kommt daneben. Wuerde das Ergebnis den Text
      // ersetzen, stuende nach dem Abschluss nur noch „12 Zeilen zurueck" da — und genau die
      // Frage „welcher Ordner war das?" waere wieder unbeantwortet.
      liste[i] = { ...e, text: liste[i].text, ergebnis: e.text };
      return;
    }
  }
  liste.push(e);
  if (liste.length > HOECHSTENS) liste.splice(0, liste.length - HOECHSTENS);
}

// --- Zeichnen -------------------------------------------------------------

function uhrzeit(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function dauer(ms) {
  if (ms == null) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function zeileHtml(e) {
  const links = e.laeuft
    ? `<span class="anschluss-zeile-icon">${icon("sanduhr")}</span>`
    : statusChip(e.status || "ok");
  return (
    `<li class="anschluss-zeile${e.laeuft ? " anschluss-zeile-laeuft" : ""}">` +
    `<span class="anschluss-zeit">${uhrzeit(e.zeit)}</span>` +
    links +
    `<span class="anschluss-dienst">${escape(e.dienst || "")}</span>` +
    `<span class="anschluss-text">${escape(e.text || "")}</span>` +
    `<span class="anschluss-ergebnis">${escape(e.ergebnis || "")}</span>` +
    `<span class="anschluss-dauer">${escape(dauer(e.dauerMs))}</span>` +
    `</li>`
  );
}

function zeichneTerminal(sektion) {
  const el = leiste.querySelector(`.anschluss[data-sektion="${sektion}"] .anschluss-terminal-liste`);
  if (!el) return;
  const liste = verlauf[sektion] || [];
  if (!liste.length) {
    // Nur wenn der Strom wirklich steht, ist „nichts passiert" die Wahrheit.
    const satz =
      feed.stand === "offen"
        ? "Noch nichts passiert, seit der Server laeuft."
        : feed.satz || "Der Ereignis-Strom ist noch nicht verbunden.";
    const code = feed.stand === "offen" ? "entfaellt" : "unlesbar";
    el.innerHTML = `<li class="anschluss-zeile anschluss-leer">${statusChip(code)}<span>${escape(satz)}</span></li>`;
    return;
  }
  // Neueste unten, wie in einem Terminal; die Ansicht springt ans Ende mit.
  el.innerHTML = liste.map(zeileHtml).join("");
  const kasten = el.parentElement;
  if (kasten) kasten.scrollTop = kasten.scrollHeight;
}

function zeichneMarker(sektion) {
  const el = leiste.querySelector(`.anschluss[data-sektion="${sektion}"] .anschluss-marker`);
  if (!el) return;
  el.innerHTML = "";
  if (aktiv[sektion]) {
    el.appendChild(sanduhr("arbeitet gerade …", { klein: true }));
    return;
  }
  // Ohne laufende Arbeit zaehlt, wie der letzte Aufruf ausging — nichts gelaufen heisst
  // „entfaellt", nicht „ok": es gibt schlicht noch keinen Befund.
  const letzte = (verlauf[sektion] || []).filter((e) => !e.laeuft);
  const code = letzte.length ? letzte[letzte.length - 1].status || "ok" : "entfaellt";
  el.innerHTML = statusChip(code);
}

export function zeichneAnschluesse() {
  if (!leiste) return;
  for (const s of SEKTIONEN) {
    zeichneMarker(s.id);
    if (offeneSektion === s.id) zeichneTerminal(s.id);
  }
}

// --- Aufbau ---------------------------------------------------------------

function baueSektion(s) {
  const el = document.createElement("div");
  el.className = "anschluss";
  el.dataset.sektion = s.id;
  el.innerHTML =
    `<span class="anschluss-marker"></span>` +
    `<span class="anschluss-name" title="${escape(s.titel)}">${escape(s.name)}</span>` +
    `<button type="button" class="anschluss-knopf anschluss-oeffnen" aria-expanded="false" ` +
    `title="Zeigen, was ${escape(s.name)} gerade tut">${icon("auge")}</button>` +
    (s.abgleich
      ? `<button type="button" class="anschluss-knopf anschluss-abgleich" title="${escape(s.abgleich.text)}">${icon("neuladen")}</button>`
      : "") +
    `<div class="anschluss-terminal" hidden>` +
    `<div class="anschluss-terminal-kopf">${escape(s.titel)}</div>` +
    `<div class="anschluss-terminal-koerper"><ul class="anschluss-terminal-liste"></ul></div>` +
    `</div>`;

  el.querySelector(".anschluss-oeffnen").addEventListener("click", () => schalteTerminal(s.id));
  const ab = el.querySelector(".anschluss-abgleich");
  if (ab) ab.addEventListener("click", () => starteAbgleich(s, ab));
  return el;
}

function schalteTerminal(sektion) {
  const auf = offeneSektion !== sektion;
  offeneSektion = auf ? sektion : null;
  for (const s of SEKTIONEN) {
    const el = leiste.querySelector(`.anschluss[data-sektion="${s.id}"]`);
    const term = el.querySelector(".anschluss-terminal");
    const knopf = el.querySelector(".anschluss-oeffnen");
    const offen = offeneSektion === s.id;
    term.hidden = !offen;
    knopf.setAttribute("aria-expanded", String(offen));
  }
  if (offeneSektion) zeichneTerminal(offeneSektion);
}

export async function starteAbgleich(s, knopfEl) {
  if (!s.abgleich) return;
  if (knopfEl) knopfEl.disabled = true;
  try {
    await s.abgleich.lauf();
  } catch (e) {
    await melde("befund", `${s.name}: ${e.message}`);
  } finally {
    if (knopfEl) knopfEl.disabled = false;
    zeichneAnschluesse();
  }
}

// Der Kopf-Menue-Eintrag ruft das hier (v58): alle Anschluesse nacheinander, KI ausgenommen.
// Nacheinander statt parallel, weil Drive ohnehin durch eine einzige rclone-Kette laeuft —
// parallel waere nicht schneller, nur unuebersichtlicher im Terminal.
export async function alleAbgleichen() {
  for (const s of SEKTIONEN) {
    if (!s.abgleich) continue;
    try {
      await s.abgleich.lauf();
    } catch (e) {
      await melde("befund", `${s.name}: ${e.message}`);
    }
  }
  zeichneAnschluesse();
}

// --- Live-Feed ------------------------------------------------------------

function verbindeFeed() {
  const quelle = new EventSource("/api/ereignisse/stream");
  quelle.onopen = () => {
    feed = { stand: "offen", satz: "" };
    zeichneAnschluesse();
  };
  quelle.onmessage = (nachricht) => {
    let o;
    try { o = JSON.parse(nachricht.data); } catch { return; }
    feed = { stand: "offen", satz: "" };
    if (o.aktiv) Object.assign(aktiv, o.aktiv);
    if (o.art === "ereignis" && o.ereignis) merke(o.ereignis);
    zeichneAnschluesse();
  };
  // EventSource verbindet von selbst neu. Hier steht nur, dass die Marker in der Zwischenzeit
  // nicht faelschlich „arbeitet" zeigen und der Leerzustand nicht Ruhe behauptet.
  quelle.onerror = () => {
    for (const k of Object.keys(aktiv)) aktiv[k] = false;
    if (feed.stand !== "veraltet") {
      feed = { stand: "getrennt", satz: "Der Ereignis-Strom ist abgerissen — es wird neu verbunden." };
    }
    zeichneAnschluesse();
  };
}

export async function verdrahteAnschluesse(el) {
  leiste = el;
  if (!leiste) return;
  leiste.innerHTML = "";
  for (const s of SEKTIONEN) leiste.appendChild(baueSektion(s));

  // Was vor dem Laden der Seite passiert ist, steht schon im Server-Ringpuffer — ohne das
  // waere das Terminal nach jedem Neuladen leer, obwohl der Server durchgearbeitet hat.
  try {
    const antwort = await fetch("/api/ereignisse");
    if (antwort.status === 404) {
      // Genau der Fall, der beim ersten Einsatz auftrat: das Frontend kommt frisch von der
      // Platte, der Serverprozess laeuft aber noch mit einer aelteren Fassung und kennt die
      // Route nicht. Ohne diesen Satz sieht es aus, als passiere nichts.
      feed = {
        stand: "veraltet",
        satz: "Dieser Server kennt den Ereignis-Strom noch nicht — er laeuft mit einer aelteren Fassung. Einmal neu starten.",
      };
    } else {
      const r = await antwort.json();
      for (const e of r.verlauf || []) merke(e);
      if (r.aktiv) Object.assign(aktiv, r.aktiv);
    }
  } catch (e) {
    feed = { stand: "getrennt", satz: `Der Verlauf liess sich nicht laden: ${e.message}` };
  }

  zeichneAnschluesse();
  if (feed.stand !== "veraltet") verbindeFeed();
}
