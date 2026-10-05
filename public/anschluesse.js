// Die Anschluss-Leiste im Kopf (v58).
//
// Vorher trug die Kopfzeile EINEN Sammel-Marker ("Google + Drive verbunden, live
// abgeglichen"). Daraus war weder ablesbar, welcher Dienst gerade arbeitet, noch was er tut.
// Jetzt: eine Sektion je Anschluss-Art, mit eigenem Marker, eigenem Abgleich-Knopf und einem
// aufklappbaren Terminal, in dem jeder externe Aufruf live mitlesbar ist.
//
// Die Ereignisse kommen aus dem Server (lib/ereignisse.js) ueber GET /api/ereignisse/stream.
// Eigenes Modul, damit app.js nicht weiter waechst und die Leiste an EINER Stelle lebt.

import { S, driveAbgleich, instagramZahlen, linkedinZahlen, gcalStatus, gcalSync, melde, rolleKonfig } from "./store.js";
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
    titel: "Ollama, Claude und ChatGPT",
    dienste: ["ollama", "claude", "chatgpt"],
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

// --- Anbindungs-Pruefung (v86 Teil 2) ----------------------------------------
//
// Owner 01.10.2026: Der Kopf zeigte „KI" gruen, obwohl Claude abgemeldet war — die Marker lasen nur, wie der
// letzte Aufruf ausging. Jetzt prueft das Board die Anbindungen selbst: 20 s nach dem Start (nicht im
// Start-Pfad, v98), danach alle 30 min und beim Oeffnen eines Logs. Je Sektion gilt der schlechtere Wert aus
// letztem Aufruf und Pruefung; der Grund steht im Log-Kopf und im Tooltip der Kachel.
const pruefung = { api: null, drive: null, weitere: null, ki: null }; // { code, grund, zeit }
let pruefLaeuft = null;

async function pruefeAnbindungen() {
  if (pruefLaeuft) return pruefLaeuft;
  pruefLaeuft = (async () => {
    try {
      const [st, ollama] = await Promise.all([
        fetch("/api/verbindungen/status").then((r) => r.json()),
        fetch("/api/ai/ollama").then((r) => r.json()).catch(() => ({ laeuft: false })),
      ]);
      const zeit = Date.now();
      const d = st.drive || {};
      pruefung.drive = d.verbunden ? { code: "ok", grund: `verbunden${d.name ? ` · Ordner „${d.name}“` : ""}`, zeit }
        : { code: "befund", grund: "Drive nicht erreichbar — Einstellungen → Google", zeit, tab: "Google" };
      const g = st.google || {};
      pruefung.weitere = g.zustand === "live" ? { code: "ok", grund: `Google verbunden${g.email ? ` (${g.email})` : ""}`, zeit }
        : g.zustand === "gestoert" ? { code: "hinweis", grund: `Google gestört: ${g.grund || "keine Antwort"}`, zeit }
        : { code: /noch nicht verbunden/i.test(g.grund || g.hinweis || "") ? "fehlt" : "befund", grund: `Google: ${String(g.grund || g.hinweis || "nicht verbunden").replace(/\.$/, "")} — Einstellungen → Google`, zeit, tab: "Google" };
      // KI: nur, was die Rollen dieses Boards wirklich nutzen.
      const genutzt = new Set(["userkomm", "recherche", "kontext"].map((r) => rolleKonfig(r).provider));
      const fehlt = [];
      if (genutzt.has("claude") && !(st.claude && st.claude.verbunden)) fehlt.push("Claude nicht angemeldet");
      if (genutzt.has("codex") && !(st.chatgpt && st.chatgpt.verbunden)) fehlt.push(st.chatgpt && st.chatgpt.installiert === false ? "Codex-CLI (ChatGPT) nicht installiert" : "ChatGPT nicht angemeldet");
      if (genutzt.has("ollama") && !ollama.laeuft) fehlt.push("Ollama läuft nicht");
      pruefung.ki = fehlt.length ? { code: "befund", grund: `${fehlt.join(" · ")} — Einstellungen → KI-Rollen`, zeit }
        : { code: "ok", grund: "alle genutzten KI-Anbindungen bereit", zeit };
      if (pruefung.ki.code !== "ok") pruefung.ki.tab = "KI-Rollen";
    } catch {
      /* Server nicht erreichbar: der Ereignis-Strom meldet das schon selbst */
    } finally {
      pruefLaeuft = null;
      zeichneAnschluesse();
    }
  })();
  return pruefLaeuft;
}

const RANG = { befund: 4, unlesbar: 4, fehlt: 3, hinweis: 2, ok: 1, entfaellt: 0 };
function sektionsCode(sektion) {
  const letzte = (verlauf[sektion] || []).filter((e) => !e.laeuft);
  const ausVerlauf = letzte.length ? letzte[letzte.length - 1].status || "ok" : "entfaellt";
  const p = pruefung[sektion];
  return p && (RANG[p.code] ?? 0) > (RANG[ausVerlauf] ?? 0) ? p.code : ausVerlauf;
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

// v83: Eine noch laufende Aktion zeigt, wie lange sie schon laeuft — vorher stand die Dauer erst
// nach dem Ende da. Der Takt unten aktualisiert nur den Text, baut die Liste nicht neu auf.
function laufDauer(start) {
  return `laeuft seit ${Math.max(0, Math.floor((Date.now() - start) / 1000))} s`;
}
setInterval(() => {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll(".anschluss-dauer-laeuft")) {
    el.textContent = laufDauer(Number(el.dataset.start));
  }
}, 1000);

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
    `<span class="anschluss-ergebnis" title="${escape(e.ergebnis || "")}">${escape(e.ergebnis || "")}</span>` +
    (e.laeuft
      ? `<span class="anschluss-dauer anschluss-dauer-laeuft" data-start="${e.zeit}">${escape(laufDauer(e.zeit))}</span>`
      : `<span class="anschluss-dauer">${escape(dauer(e.dauerMs))}</span>`) +
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
  // „entfaellt", nicht „ok": es gibt schlicht noch keinen Befund. v86: die Anbindungs-Pruefung zaehlt mit.
  el.innerHTML = statusChip(sektionsCode(sektion));
  const p = pruefung[sektion];
  const kachel = el.closest(".anschluss");
  const s = SEKTIONEN.find((x) => x.id === sektion);
  if (kachel && s) kachel.title = `${s.name} — ${s.titel}${p ? `\n${p.grund}` : ""}`;
  const befund = kachel && kachel.querySelector(".anschluss-terminal-befund");
  if (befund) {
    befund.hidden = !p;
    if (p) {
      befund.innerHTML = `<span>Anbindung: ${escape(p.grund)} (geprüft ${uhrzeit(p.zeit)})</span>` +
        (p.tab && p.code !== "ok" ? `<button type="button" class="anschluss-neu-verbinden">Neu verbinden</button>` : "");
      const nv = befund.querySelector(".anschluss-neu-verbinden");
      if (nv) nv.addEventListener("click", () => window.dispatchEvent(new CustomEvent("einstellungen-oeffnen", { detail: p.tab })));
    }
    if (p) befund.dataset.code = p.code;
  }
}

// --- Der Satz in der Kopfzeile -------------------------------------------
//
// Owner 25.09.2026: Solange IRGENDEIN Anschluss arbeitet, steht dort die neueste Aktion aus
// allen vier Bereichen; sobald nichts mehr laeuft, steht dort „Bereit.". Vorher speiste den
// Kopf allein der Drive-Abgleich — API, Weitere und KI kamen dort nie an, und der Kopf
// behauptete Ruhe, waehrend anderswo gearbeitet wurde.
//
// Der Kopf gehoert dem Bus NUR waehrend der Arbeit. Danach schreibt er genau EINMAL
// „Bereit." und laesst los — sonst wuerde er Bestaetigungen wie „Upload am 3.10."
// (detail.js) im Sekundentakt wieder wegwischen.
let standEl = null;
let warAktiv = false;
let driveStufe = ""; // der schoenere Satz aus dem v51-Stufenstrom, wenn Drive gerade laeuft

export function merkeDriveStufe(satz) {
  driveStufe = satz || "";
  zeichneKopf();
}

function neuesteAktion() {
  // Die zuletzt begonnene, noch laufende Zeile ueber alle Sektionen — NUR die Zeit
  // entscheidet, keine Sektion hat Vorrang.
  //
  // Die erste Fassung liess Drive immer gewinnen, sobald der Stufenstrom lief. Gemessen
  // 25.09.2026: ein Klick auf „Zahlen neu abrufen" erzeugte 24 Instagram-Aufrufe, und der
  // Kopf zeigte die ganze Zeit „Gleicht die Spalten mit Drive ab …" — genau die Aktion, die
  // NICHT die neueste war.
  let beste = null;
  for (const s of SEKTIONEN) {
    for (const e of verlauf[s.id] || []) {
      if (!e.laeuft) continue;
      if (!beste || e.zeit >= beste.e.zeit) beste = { e, name: s.name, id: s.id };
    }
  }
  if (!beste) return driveStufe || "Arbeitet …";
  // Ist die neueste Aktion eine von Drive und der Stufenstrom hat einen fertigen Satz, gewinnt
  // der: „Liest Drive-Ordner 4/8: Schnitt" liest sich besser als der nackte rclone-Befehl.
  if (beste.id === "drive" && driveStufe) return driveStufe;
  if (beste.id === "drive") return klartextRclone(beste.e.text);
  return `${beste.name} · ${beste.e.text}`;
}

// v82: In der Kopfzeile steht nie ein roher rclone-Befehl („cat gdrive:System (AI only)/…json"),
// sondern was er tut. Das Terminal der Sektion zeigt den Befehl weiter unveraendert.
const DATEI_NAMEN = {
  redaktionsplan: "Redaktionsplan",
  workflows: "Workflows",
  board: "Board",
  boardparameter: "Board-Einstellungen",
  defaults: "Vorgaben",
};
function letzterTeil(pfad) {
  const teil = String(pfad || "").replace(/^gdrive:/, "").split("/").filter(Boolean).pop() || "";
  return teil.replace(/\.json$/i, "");
}
export function klartextRclone(text) {
  const [verb, ...rest] = String(text || "").trim().split(/\s+/);
  const ziel = rest.filter((a) => !a.startsWith("-")).join(" ");
  const name = letzterTeil(ziel);
  const datei = DATEI_NAMEN[name] || name;
  switch (verb) {
    case "cat": return datei ? `Liest ${datei} aus Drive …` : "Liest aus Drive …";
    case "lsjson":
    case "lsf":
    case "ls": return datei ? `Liest Ordner ${datei} …` : "Liest einen Drive-Ordner …";
    case "copy":
    case "copyto":
    case "rcat": return datei ? `Speichert ${datei} in Drive …` : "Speichert in Drive …";
    case "move":
    case "moveto": return datei ? `Verschiebt ${datei} in Drive …` : "Verschiebt in Drive …";
    case "mkdir": return datei ? `Legt Ordner ${datei} an …` : "Legt einen Ordner an …";
    case "delete":
    case "deletefile":
    case "purge":
    case "rmdir": return datei ? `Löscht ${datei} in Drive …` : "Löscht in Drive …";
    default: return "Arbeitet mit Drive …";
  }
}

function zeichneKopf() {
  if (!standEl) return;
  const laeuftWas = Object.values(aktiv).some(Boolean);
  if (laeuftWas) {
    warAktiv = true;
    standEl.innerHTML = "";
    const satz = neuesteAktion();
    standEl.appendChild(sanduhr(satz));
    standEl.title = satz;
  } else if (warAktiv) {
    warAktiv = false;
    standEl.textContent = "Bereit.";
  }
}

export function zeichneAnschluesse() {
  zeichneKopf();
  if (!leiste) return;
  for (const s of SEKTIONEN) {
    zeichneMarker(s.id);
    if (offeneSektion === s.id) zeichneTerminal(s.id);
  }
  leiste.dataset.zustand = gesamtZustand();
}

// v105: Gesamtampel der Gruppe „Verbindungen" — der schlechteste Zustand aller vier Sektionen
// (laeuft gerade etwas: „arbeitet"; sonst Ergebnis des letzten abgeschlossenen Aufrufs je Sektion).
function gesamtZustand() {
  let schlimmster = "entfaellt";
  for (const s of SEKTIONEN) {
    const code = sektionsCode(s.id); // v86: inkl. Anbindungs-Pruefung
    if ((RANG[code] ?? 0) > (RANG[schlimmster] ?? 0)) schlimmster = code;
  }
  return Object.values(aktiv).some(Boolean) && (RANG[schlimmster] ?? 0) < 2 ? "arbeitet" : schlimmster;
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
    `<div class="anschluss-terminal-kopf"><span>${escape(s.titel)}</span>` +
    (s.abgleich ? `<button type="button" class="anschluss-terminal-abgleich">${escape(s.abgleich.text)}</button>` : "") +
    `</div>` +
    `<div class="anschluss-terminal-befund" hidden></div>` +
    `<div class="anschluss-terminal-koerper"><ul class="anschluss-terminal-liste"></ul></div>` +
    `</div>`;

  el.querySelector(".anschluss-oeffnen").addEventListener("click", () => schalteTerminal(s.id));
  const ab = el.querySelector(".anschluss-abgleich");
  if (ab) ab.addEventListener("click", () => starteAbgleich(s, ab));
  // v105: Die Sektion ist im Kopf eine kleine Kachel in der Gruppe „Verbindungen" — ein Klick auf
  // die ganze Kachel klappt das Log auf/zu; der Abgleich-Knopf sitzt im Log-Kopf.
  el.title = `${s.name} — ${s.titel}`;
  el.addEventListener("click", (e) => {
    if (e.target.closest(".anschluss-terminal") || e.target.closest(".anschluss-knopf")) return;
    schalteTerminal(s.id);
  });
  const logAb = el.querySelector(".anschluss-terminal-abgleich");
  if (logAb) logAb.addEventListener("click", () => starteAbgleich(s, logAb));
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
  if (offeneSektion) {
    zeichneTerminal(offeneSektion);
    pruefeAnbindungen(); // v86: Log oeffnen = jetzt pruefen
  }
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

export async function verdrahteAnschluesse(el, stand) {
  leiste = el;
  standEl = stand || null;
  if (!leiste) return;
  leiste.innerHTML = "";
  for (const s of SEKTIONEN) leiste.appendChild(baueSektion(s));

  // v83: Ein geoeffnetes Log klappt wieder zu, sobald man irgendwo anders hinklickt (Owner
  // 30.09.2026). Klicks innerhalb der eigenen Sektion (Terminal, Knoepfe) zaehlen nicht.
  document.addEventListener("pointerdown", (e) => {
    if (!offeneSektion) return;
    const sektion = leiste.querySelector(`.anschluss[data-sektion="${offeneSektion}"]`);
    if (sektion && !sektion.contains(e.target)) schalteTerminal(offeneSektion);
  });

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
  // v86 Teil 2: Anbindungen pruefen — nicht im Start-Pfad, danach alle 30 min.
  setTimeout(pruefeAnbindungen, 20000);
  setInterval(pruefeAnbindungen, 30 * 60 * 1000);
}
