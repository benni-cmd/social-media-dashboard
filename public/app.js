// Frontend des Content-Pipeline-Boards.
// Bildet Bens Arbeitsweise ab: Marken-Regeln stecken im Server-Vorspann, die Pipeline-Spalten
// setzen die Zwei-Phasen-Logik durch. Pro Stufe genau die Aktion(en), die dort gebraucht werden.

let board = { columns: [], cards: [] };
let aktiveKarteId = null;
let letztesKiErgebnis = "";

const MARKE = "WEE"; // Praefix fuer den Dateinamen-Vorschlag.

// Was jede Spalte anbietet: KI-Aktionen (kis) und/oder ein Haken, der die Karte weiterschiebt.
const STUFEN = {
  idee: {
    name: "Idee — Phase 1: Jam",
    kis: [{ task: "recherche", label: "Phase 1: Recherche, Fokus & Hooks" }],
  },
  skript: {
    name: "Skript — Phase 2: Produktion",
    kis: [
      { task: "skript", label: "Skript & Teleprompter schreiben" },
      { task: "regieplan", label: "Regieplan & Metadaten erstellen" },
    ],
  },
  videodreh: { name: "Videodreh", haken: { key: "dreh", label: "Dreh ist durch", nach: "schnitt" } },
  schnitt: { name: "Schnitt", haken: { key: "schnitt", label: "Schnitt ist fertig", nach: "caption" } },
  caption: {
    name: "Caption — Phase 2",
    kis: [{ task: "caption", label: "Captions (2 Varianten + 5 Hashtags)" }],
  },
  upload: { name: "Upload", haken: { key: "upload", label: "Ist veroeffentlicht", nach: "fertig" } },
  fertig: { name: "Fertig", archiv: true },
};

const KI_TITEL = {
  recherche: "Recherche, Fokus & Hooks",
  skript: "Skript / Teleprompter",
  regieplan: "Regieplan & Metadaten",
  caption: "Captions",
};

const boardEl = document.getElementById("board");
const detailEl = document.getElementById("detail");
const standEl = document.getElementById("speicher-stand");
const stufeEl = document.getElementById("detail-stufe");
const titelEl = document.getElementById("detail-titel");
const serieEl = document.getElementById("detail-serie");
const episodeEl = document.getElementById("detail-episode");
const formatEl = document.getElementById("detail-format");
const dateinameEl = document.getElementById("dateiname");
const datumEl = document.getElementById("detail-datum");
const datumHinweisEl = document.getElementById("datum-hinweis");
const notizenEl = document.getElementById("detail-notizen");
const stufeBlockEl = document.getElementById("stufe-block");
const archivEl = document.getElementById("ki-archiv");
const scanEl = document.getElementById("projekt-scan");
const driveBlockEl = document.getElementById("drive-block");
const ergebnisEl = document.getElementById("ki-ergebnis");
const ergebnisTextEl = document.getElementById("ki-ergebnis-text");
const ergebnisTitelEl = document.getElementById("ki-ergebnis-titel");

function neueId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function ladeBoard() {
  const r = await fetch("/api/board");
  board = await r.json();
  if (!board.columns) board = { columns: [], cards: [] };
  render();
}

async function speichere() {
  standEl.textContent = "Speichere …";
  try {
    await fetch("/api/board", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(board),
    });
    standEl.textContent = "Stand gespeichert.";
  } catch {
    standEl.textContent = "Speichern fehlgeschlagen — Server erreichbar?";
  }
}

function karteById(id) {
  return board.cards.find((c) => c.id === id);
}

// Titel zu einem dateinamen-tauglichen Stueck machen.
function slug(s) {
  return (s || "Thema")
    .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 24) || "Thema";
}

function dateinameFuer(card) {
  const reihe = slug(card.serie) || "Reihe";
  const ep = (card.episode || "00").toString().padStart(2, "0");
  return `${MARKE}_${reihe}_EP${ep}_${slug(card.title)}_${card.format || "Reel"}.mp4`;
}

// Titel anderer Karten derselben Reihe (fuer Reihen-Kontinuitaet in der KI).
function reihenGeschwister(card) {
  if (!card.serie) return [];
  return board.cards
    .filter((c) => c.id !== card.id && c.serie && c.serie === card.serie)
    .map((c) => c.title || "(ohne Titel)");
}

// --- Upload-Datum: Tage bis dahin und Ampel-Farbe ---
function tageBis(iso) {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const ziel = new Date(iso + "T00:00:00");
  return Math.round((ziel - heute) / 86400000);
}

function ampel(card) {
  if (!card.uploadDate) return { klasse: "ampel-grau", text: "Kein Upload-Datum" };
  const tage = tageBis(card.uploadDate);
  const datumText = new Date(card.uploadDate + "T00:00:00").toLocaleDateString("de-DE");
  const rest =
    tage < 0 ? "ueberfaellig" : tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
  const text = `Upload ${datumText} (${rest})`;
  if (card.column === "fertig") return { klasse: "ampel-grau", text };
  if (card.column === "upload") return { klasse: "ampel-gruen", text };
  let klasse = "ampel-gruen";
  if (tage <= 5) klasse = "ampel-rot";
  else if (tage <= 10) klasse = "ampel-gelb";
  return { klasse, text };
}

function render() {
  boardEl.innerHTML = "";
  for (const col of board.columns) {
    const karten = board.cards.filter((c) => c.column === col.id);
    const spalte = document.createElement("section");
    spalte.className = "spalte";

    const kopf = document.createElement("div");
    kopf.className = "spalte-kopf";
    kopf.innerHTML = `<span>${escape(col.title)}</span><span class="spalte-anzahl">${
      karten.length
    } Karte${karten.length === 1 ? "" : "n"}</span>`;
    spalte.appendChild(kopf);

    const liste = document.createElement("div");
    liste.className = "spalte-liste";
    liste.dataset.col = col.id;
    liste.addEventListener("dragover", (e) => {
      e.preventDefault();
      liste.classList.add("zielt");
    });
    liste.addEventListener("dragleave", () => liste.classList.remove("zielt"));
    liste.addEventListener("drop", (e) => {
      e.preventDefault();
      liste.classList.remove("zielt");
      const id = e.dataTransfer.getData("text/plain");
      const karte = karteById(id);
      if (karte && karte.column !== col.id) {
        const alt = karte.column;
        karte.column = col.id;
        driveMove(karte, alt, col.id);
        render();
        speichere();
      }
    });

    if (karten.length === 0) {
      const leer = document.createElement("div");
      leer.className = "spalte-leer";
      leer.textContent = "Noch keine Karte hier. Zieh eine her oder leg unten eine an.";
      liste.appendChild(leer);
    }

    for (const karte of karten) liste.appendChild(karteEl(karte));
    spalte.appendChild(liste);

    const neu = document.createElement("button");
    neu.className = "karte-neu";
    neu.textContent = "+ Karte hinzufuegen";
    neu.addEventListener("click", () => {
      const karte = {
        id: neueId(),
        column: col.id,
        title: "Neue Idee",
        notes: "",
        serie: "",
        episode: "",
        format: "Reel",
        uploadDate: null,
        checks: {},
        ai: {},
      };
      board.cards.push(karte);
      render();
      speichere();
      oeffneDetail(karte.id);
      titelEl.select();
    });
    spalte.appendChild(neu);

    boardEl.appendChild(spalte);
  }
}

function karteEl(karte) {
  const el = document.createElement("article");
  el.className = "karte" + (karte.id === aktiveKarteId ? " aktiv" : "");
  el.draggable = true;
  const a = ampel(karte);
  const hatKi = karte.ai && Object.keys(karte.ai).length > 0;
  const reihenMarke =
    karte.serie || karte.episode
      ? `<span class="karte-reihe">${escape(karte.serie || "Reihe")}${
          karte.episode ? " · EP" + escape(karte.episode) : ""
        } · ${escape(karte.format || "Reel")}</span>`
      : "";
  el.innerHTML =
    `<div class="karte-titel">${escape(karte.title || "(ohne Titel)")}</div>` +
    reihenMarke +
    `<div class="karte-datum ${a.klasse}">${escape(a.text)}</div>` +
    (hatKi
      ? `<div class="karte-hat-ki">KI fertig: ${Object.keys(karte.ai)
          .map((k) => KI_TITEL[k] || k)
          .join(", ")}</div>`
      : "");
  el.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", karte.id));
  el.addEventListener("click", () => oeffneDetail(karte.id));
  return el;
}

function oeffneDetail(id) {
  aktiveKarteId = id;
  const karte = karteById(id);
  if (!karte) return;
  stufeEl.textContent = (STUFEN[karte.column] || {}).name || karte.column;
  titelEl.value = karte.title || "";
  serieEl.value = karte.serie || "";
  episodeEl.value = karte.episode || "";
  formatEl.value = karte.format || "Reel";
  datumEl.value = karte.uploadDate || "";
  notizenEl.value = karte.notes || "";
  dateinameEl.textContent = "Dateiname: " + dateinameFuer(karte);
  zeichneDatumHinweis(karte);
  zeichneStufenBlock(karte);
  zeichneArchiv(karte);
  ladeDrive(karte);
  ergebnisEl.hidden = true;
  ergebnisEl.classList.remove("fehler");
  letztesKiErgebnis = "";
  detailEl.hidden = false;
  render();
}

function schliesseDetail() {
  aktiveKarteId = null;
  detailEl.hidden = true;
  render();
}

function zeichneDatumHinweis(karte) {
  const a = ampel(karte);
  datumHinweisEl.textContent = a.text;
  datumHinweisEl.className = "datum-hinweis " + a.klasse;
}

// Baut den stufen-spezifischen Block: KI-Buttons und/oder Haken und/oder Archiv-Hinweis.
function zeichneStufenBlock(karte) {
  const stufe = STUFEN[karte.column] || {};
  stufeBlockEl.innerHTML = "";

  if (stufe.archiv) {
    const p = document.createElement("p");
    p.className = "stufe-hinweis";
    p.textContent = "Diese Karte ist veroeffentlicht und archiviert.";
    stufeBlockEl.appendChild(p);
    return;
  }

  if (stufe.kis && stufe.kis.length) {
    const erklaer = document.createElement("p");
    erklaer.className = "ki-erklaer";
    erklaer.textContent =
      "Die KI-Aktionen laufen lokal ueber deine Claude-CLI (dein Abo, keine API-Tokens) und " +
      "folgen automatisch den World-Eden-Regeln.";
    stufeBlockEl.appendChild(erklaer);
    for (const k of stufe.kis) {
      const knopf = document.createElement("button");
      knopf.className = "ki-knopf";
      knopf.textContent = k.label;
      knopf.addEventListener("click", () => ladeKi(k.task, knopf));
      stufeBlockEl.appendChild(knopf);
    }
  }

  if (stufe.haken) {
    const zeile = document.createElement("label");
    zeile.className = "haken-zeile";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = !!(karte.checks && karte.checks[stufe.haken.key]);
    box.addEventListener("change", () => {
      karte.checks = karte.checks || {};
      karte.checks[stufe.haken.key] = box.checked;
      if (box.checked) {
        const alt = karte.column;
        karte.column = stufe.haken.nach;
        driveMove(karte, alt, stufe.haken.nach);
        speichere();
        schliesseDetail();
      } else {
        speichere();
      }
    });
    zeile.appendChild(box);
    zeile.appendChild(document.createTextNode(" " + stufe.haken.label + " — Karte rueckt weiter"));
    stufeBlockEl.appendChild(zeile);
  }
}

// --- Google-Drive-Block: Projektordner, Links und Skript-Freigabe-Workflow ---
const DRIVE_SUBS = ["Skript und Caption", "Rohmaterial", "Fertiges Video"];

// Verschiebt den Drive-Projektordner beim Spaltenwechsel mit (nur wenn ein Projekt existiert).
async function driveMove(karte, from, to) {
  if (!karte.driveCreated || from === to) return;
  try {
    await fetch("/api/drive/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serie: karte.serie,
        episode: karte.episode,
        title: karte.title,
        format: karte.format,
        uploadDate: karte.uploadDate,
        from,
        to,
      }),
    });
  } catch {
    /* Verschieben ist Beiwerk; das Board bleibt fuehrend. */
  }
}

async function driveProjektAnlegen(karte, statusEl) {
  statusEl.textContent = "Lege Drive-Projekt an …";
  try {
    const r = await fetch("/api/drive/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serie: karte.serie,
        episode: karte.episode,
        title: karte.title,
        format: karte.format,
        column: karte.column,
        uploadDate: karte.uploadDate,
      }),
    });
    await r.json();
    karte.driveCreated = true;
    speichere();
    ladeDrive(karte);
  } catch (e) {
    statusEl.textContent = "Anlegen fehlgeschlagen: " + e.message;
  }
}

async function skriptNachDrive(karte, text, statusEl) {
  statusEl.textContent = "Speichere nach Drive …";
  try {
    const r = await fetch("/api/drive/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serie: karte.serie,
        episode: karte.episode,
        title: karte.title,
        column: karte.column,
        filename: "10_skript.md",
        content: text,
      }),
    });
    const data = await r.json();
    if (data.ok) {
      karte.skriptFinal = text;
      karte.skriptGespeichert = true;
      karte.driveCreated = true;
      speichere();
      statusEl.textContent = "Gespeichert: " + data.pfad;
      ladeDrive(karte);
    } else {
      statusEl.textContent = "Speichern fehlgeschlagen.";
    }
  } catch (e) {
    statusEl.textContent = "Speichern fehlgeschlagen: " + e.message;
  }
}

function zeichneDriveBlock(karte, s) {
  const status = document.createElement("p");
  status.className = "drive-status";

  const hatLinks = s && s.links && Object.values(s.links).some(Boolean);
  if (hatLinks) {
    const links = document.createElement("div");
    links.className = "drive-links";
    for (const sub of DRIVE_SUBS) {
      const url = s.links[sub];
      if (!url) continue;
      const a = document.createElement("a");
      a.className = "drive-link";
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "↗ " + sub;
      links.appendChild(a);
    }
    driveBlockEl.appendChild(links);
  } else {
    const knopf = document.createElement("button");
    knopf.className = "ki-knopf";
    knopf.textContent = "Drive-Projektordner anlegen";
    knopf.addEventListener("click", () => driveProjektAnlegen(karte, status));
    driveBlockEl.appendChild(knopf);
  }
  driveBlockEl.appendChild(status);

  // Skript-Stufe: Freigabe-Workflow + finales, editierbares Skript-Textfeld + Speichern.
  if (karte.column === "skript") {
    const trenner = document.createElement("div");
    trenner.className = "archiv-kopf";
    trenner.textContent = "Skript-Workflow";
    driveBlockEl.appendChild(trenner);

    const fLabel = document.createElement("label");
    fLabel.className = "feld-label";
    fLabel.textContent = "Freigabe: finaler Fokus & Hook (fliesst ins Skript)";
    const freigabe = document.createElement("textarea");
    freigabe.className = "feld-eingabe";
    freigabe.rows = 3;
    freigabe.value = karte.freigabe || "";
    freigabe.addEventListener("change", () => {
      karte.freigabe = freigabe.value;
      speichere();
    });
    driveBlockEl.appendChild(fLabel);
    driveBlockEl.appendChild(freigabe);

    const sLabel = document.createElement("label");
    sLabel.className = "feld-label";
    sLabel.textContent = "Finales Skript (aus Entwurf anpassen, dann nach Drive speichern)";
    const skript = document.createElement("textarea");
    skript.className = "feld-eingabe";
    skript.rows = 8;
    skript.value = karte.skriptFinal || (karte.ai && karte.ai.skript) || "";
    skript.addEventListener("change", () => {
      karte.skriptFinal = skript.value;
      speichere();
    });
    driveBlockEl.appendChild(sLabel);
    driveBlockEl.appendChild(skript);

    const uebernehmen = document.createElement("button");
    uebernehmen.className = "archiv-knopf";
    uebernehmen.textContent = "Entwurf aus KI uebernehmen";
    uebernehmen.addEventListener("click", () => {
      if (karte.ai && karte.ai.skript) {
        skript.value = karte.ai.skript;
        karte.skriptFinal = skript.value;
        speichere();
      }
    });
    const speichern = document.createElement("button");
    speichern.className = "ki-knopf";
    speichern.textContent = "Skript nach Drive speichern (10_skript.md)";
    speichern.addEventListener("click", () => skriptNachDrive(karte, skript.value, status));

    const reihe = document.createElement("div");
    reihe.className = "drive-workflow-knoepfe";
    reihe.appendChild(uebernehmen);
    reihe.appendChild(speichern);
    driveBlockEl.appendChild(reihe);
  }
}

// Laedt den Drive-Stand einer Karte und zeichnet Erkennung + Links + Workflow.
async function ladeDrive(karte) {
  scanEl.innerHTML = "";
  driveBlockEl.innerHTML = "";
  const kopf = document.createElement("div");
  kopf.className = "archiv-kopf";
  kopf.textContent = "Google Drive";
  driveBlockEl.appendChild(kopf);

  if (!karte.serie || !karte.title) {
    const p = document.createElement("p");
    p.className = "stufe-hinweis";
    p.textContent = "Reihe und Titel setzen, dann laesst sich der Drive-Projektordner anlegen.";
    driveBlockEl.appendChild(p);
    return;
  }

  let s = { rohmaterial: 0, final: 0, skriptDateien: [], links: {}, vorhanden: false };
  const laden = document.createElement("p");
  laden.className = "drive-status";
  laden.textContent = "Lese Drive …";
  driveBlockEl.appendChild(laden);
  try {
    const q = new URLSearchParams({
      serie: karte.serie || "",
      episode: karte.episode || "",
      title: karte.title || "",
      column: karte.column || "",
    });
    const r = await fetch("/api/drive/scan?" + q.toString());
    s = await r.json();
  } catch {
    /* Drive nicht erreichbar — Board bleibt nutzbar. */
  }
  laden.remove();
  if (s.vorhanden) karte.driveCreated = true;
  zeichneErkennung(karte, s);
  zeichneDriveBlock(karte, s);
}

// Was liegt im Drive-Projektordner (deterministisch, ohne Token)?
function zeichneErkennung(karte, s) {
  scanEl.innerHTML = "";
  const kopf = document.createElement("div");
  kopf.className = "scan-kopf";
  kopf.textContent = "Aus Drive erkannt (ohne Token)";
  scanEl.appendChild(kopf);
  const liste = document.createElement("ul");
  liste.className = "scan-liste";
  const zeile = (da, text) => {
    const li = document.createElement("li");
    li.className = da ? "scan-da" : "scan-fehlt";
    li.textContent = (da ? "✓ " : "· ") + text;
    liste.appendChild(li);
  };
  const n = (s.skriptDateien || []).length;
  zeile(n > 0, `Skript und Caption/ (${n} Dateien)`);
  zeile(s.rohmaterial > 0, `Rohmaterial/ (${s.rohmaterial || 0} Dateien)`);
  zeile(s.final > 0, `Fertiges Video/ (${s.final || 0} Videos)`);
  scanEl.appendChild(liste);
  const hint = uebergangsHinweis(karte, s);
  if (hint) scanEl.appendChild(hint);
}

// Erkannter Auto-Uebergang (lokal per Knopf; spaeter automatisch per Drive-Polling).
function uebergangsHinweis(karte, s) {
  let ziel = null;
  let grund = null;
  if (karte.column === "videodreh" && s.rohmaterial > 0) {
    ziel = "schnitt";
    grund = "Rohmaterial liegt im Ordner";
  } else if (karte.column === "schnitt" && s.final > 0) {
    ziel = "caption";
    grund = "Fertiges Video liegt im Ordner";
  }
  if (!ziel) return null;
  const box = document.createElement("div");
  box.className = "scan-hint";
  const text = document.createElement("span");
  text.textContent = `${grund} — Karte kann weiter nach "${(STUFEN[ziel] || {}).name || ziel}".`;
  const knopf = document.createElement("button");
  knopf.className = "archiv-knopf";
  knopf.textContent = "Jetzt verschieben";
  knopf.addEventListener("click", () => {
    const k = karteById(aktiveKarteId);
    if (!k) return;
    const alt = k.column;
    k.column = ziel;
    driveMove(k, alt, ziel);
    speichere();
    schliesseDetail();
  });
  box.appendChild(text);
  box.appendChild(knopf);
  return box;
}

// Grobe Sprechzeit-Schaetzung (fuer die 50-Sekunden-Regel beim Skript).
function sprechzeit(text) {
  const woerter = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.round(woerter / 2.3); // ~2,3 Woerter pro Sekunde
}

// Zeigt alle gespeicherten KI-Ergebnisse dieser Karte als aufklappbare Bloecke.
function zeichneArchiv(karte) {
  archivEl.innerHTML = "";
  const tasks = karte.ai ? Object.keys(karte.ai) : [];
  if (!tasks.length) return;

  const kopf = document.createElement("div");
  kopf.className = "archiv-kopf";
  kopf.textContent = "Gespeicherte KI-Ergebnisse";
  archivEl.appendChild(kopf);

  for (const task of tasks) {
    const text = karte.ai[task] || "";
    const box = document.createElement("details");
    box.className = "archiv-eintrag";

    const titel = document.createElement("summary");
    let label = KI_TITEL[task] || task;
    if (task === "skript") {
      const s = sprechzeit(text);
      label += ` — ~${s}s Sprechzeit` + (s > 50 ? " (zu lang!)" : "");
    }
    titel.textContent = label;
    box.appendChild(titel);

    const pre = document.createElement("pre");
    pre.className = "archiv-text";
    pre.textContent = text;
    box.appendChild(pre);

    const reihe = document.createElement("div");
    reihe.className = "archiv-knoepfe";
    const kopieren = document.createElement("button");
    kopieren.className = "archiv-knopf";
    kopieren.textContent = "Kopieren";
    kopieren.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(text);
        kopieren.textContent = "Kopiert ✓";
        setTimeout(() => (kopieren.textContent = "Kopieren"), 1500);
      } catch {
        kopieren.textContent = "Ging nicht";
      }
    });
    const uebernehmen = document.createElement("button");
    uebernehmen.className = "archiv-knopf";
    uebernehmen.textContent = "In Notizen uebernehmen";
    uebernehmen.addEventListener("click", (e) => {
      e.preventDefault();
      const k = karteById(aktiveKarteId);
      if (!k) return;
      const trenner = notizenEl.value.trim() ? "\n\n" : "";
      notizenEl.value = notizenEl.value + trenner + text;
      k.notes = notizenEl.value;
      speichere();
    });
    reihe.appendChild(kopieren);
    reihe.appendChild(uebernehmen);
    box.appendChild(reihe);

    archivEl.appendChild(box);
  }
}

async function ladeKi(task, knopf) {
  const karte = karteById(aktiveKarteId);
  if (!karte) return;
  const alle = stufeBlockEl.querySelectorAll(".ki-knopf");
  alle.forEach((b) => (b.disabled = true));
  ergebnisEl.hidden = false;
  ergebnisEl.classList.remove("fehler");
  ergebnisTitelEl.textContent = (KI_TITEL[task] || "Ergebnis") + " — die KI arbeitet …";
  ergebnisTextEl.textContent = "";
  try {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task,
        card: {
          title: karte.title,
          // Beim Skript fliesst die Freigabe (finaler Fokus & Hook) mit in den Kontext.
          notes:
            task === "skript" && karte.freigabe
              ? `${karte.notes || ""}\n\nFreigegebener Fokus & Hook:\n${karte.freigabe}`
              : karte.notes,
          serie: karte.serie,
          episode: karte.episode,
          format: karte.format,
          seriesSiblings: reihenGeschwister(karte),
        },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      ergebnisEl.classList.add("fehler");
      ergebnisTitelEl.textContent = "Das hat nicht geklappt";
      ergebnisTextEl.textContent = data.hint || data.error || "Unbekannter Fehler.";
    } else {
      letztesKiErgebnis = data.text || "";
      ergebnisTitelEl.textContent = KI_TITEL[task] || "Ergebnis";
      ergebnisTextEl.textContent = letztesKiErgebnis;
      karte.ai = karte.ai || {};
      karte.ai[task] = letztesKiErgebnis;
      zeichneArchiv(karte);
      ladeDrive(karte);
      render();
      speichere();
    }
  } catch (e) {
    ergebnisEl.classList.add("fehler");
    ergebnisTitelEl.textContent = "Das hat nicht geklappt";
    ergebnisTextEl.textContent = "Server nicht erreichbar: " + e.message;
  } finally {
    alle.forEach((b) => (b.disabled = false));
  }
}

// --- Detail-Felder binden ---
function feldGeaendert(prop, el, mitRender) {
  const k = karteById(aktiveKarteId);
  if (!k) return;
  k[prop] = el.value;
  dateinameEl.textContent = "Dateiname: " + dateinameFuer(k);
  if (mitRender) render();
}
titelEl.addEventListener("input", () => feldGeaendert("title", titelEl, true));
titelEl.addEventListener("change", speichere);
serieEl.addEventListener("input", () => feldGeaendert("serie", serieEl, true));
serieEl.addEventListener("change", speichere);
episodeEl.addEventListener("input", () => feldGeaendert("episode", episodeEl, false));
episodeEl.addEventListener("change", speichere);
formatEl.addEventListener("change", () => {
  feldGeaendert("format", formatEl, true);
  speichere();
});
datumEl.addEventListener("change", () => {
  const k = karteById(aktiveKarteId);
  if (k) {
    k.uploadDate = datumEl.value || null;
    zeichneDatumHinweis(k);
    render();
    speichere();
  }
});
notizenEl.addEventListener("change", () => {
  const k = karteById(aktiveKarteId);
  if (k) {
    k.notes = notizenEl.value;
    speichere();
  }
});

document.getElementById("detail-schliessen").addEventListener("click", schliesseDetail);
document.getElementById("karte-loeschen").addEventListener("click", () => {
  if (!aktiveKarteId) return;
  board.cards = board.cards.filter((c) => c.id !== aktiveKarteId);
  schliesseDetail();
  speichere();
});
document.getElementById("ki-uebernehmen").addEventListener("click", () => {
  const karte = karteById(aktiveKarteId);
  if (!karte || !letztesKiErgebnis) return;
  const trenner = notizenEl.value.trim() ? "\n\n" : "";
  notizenEl.value = notizenEl.value + trenner + letztesKiErgebnis;
  karte.notes = notizenEl.value;
  speichere();
});

function escape(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

ladeBoard();
