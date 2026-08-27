// Frontend des Content-Pipeline-Boards (Phase 1: lokal, ohne Google).
// Board-Stand im Speicher, Rendern der Spalten + Karten, Drag&Drop, Detail-Panel.
// Pro Pipeline-Stufe gibt es genau die Aktion, die dort gebraucht wird:
// KI-Button (Idee/Skript/Caption) oder Haken (Videodreh/Schnitt/Upload), der die
// Karte eine Spalte weiterschiebt. Upload-Datum steuert die Ampel-Farbe der Karte.

let board = { columns: [], cards: [] };
let aktiveKarteId = null;
let letztesKiErgebnis = "";

// Was jede Spalte im Detail-Panel anbietet.
const STUFEN = {
  idee: { name: "Idee", ki: { task: "fokus", label: "Fokus schaerfen" } },
  skript: { name: "Skript", ki: { task: "skript", label: "Skript schreiben" } },
  videodreh: { name: "Videodreh", haken: { key: "dreh", label: "Dreh ist durch", nach: "schnitt" } },
  schnitt: { name: "Schnitt", haken: { key: "schnitt", label: "Schnitt ist fertig", nach: "caption" } },
  caption: { name: "Caption", ki: { task: "caption", label: "Caption schreiben" } },
  upload: { name: "Upload", haken: { key: "upload", label: "Ist veroeffentlicht", nach: "fertig" } },
  fertig: { name: "Fertig", archiv: true },
};

const KI_TITEL = { fokus: "Fokus", skript: "Skript", caption: "Caption" };

const boardEl = document.getElementById("board");
const detailEl = document.getElementById("detail");
const standEl = document.getElementById("speicher-stand");
const stufeEl = document.getElementById("detail-stufe");
const titelEl = document.getElementById("detail-titel");
const datumEl = document.getElementById("detail-datum");
const datumHinweisEl = document.getElementById("datum-hinweis");
const notizenEl = document.getElementById("detail-notizen");
const stufeBlockEl = document.getElementById("stufe-block");
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

// --- Upload-Datum: Tage bis dahin und Ampel-Farbe ---
function tageBis(iso) {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const ziel = new Date(iso + "T00:00:00");
  return Math.round((ziel - heute) / 86400000);
}

// Ampel: >10 Tage gruen, ab 10 gelb, ab 5 rot. In Spalte Upload immer gruen,
// in Fertig neutral. Ohne Datum neutral.
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
        karte.column = col.id;
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
  el.innerHTML =
    `<div class="karte-titel">${escape(karte.title || "(ohne Titel)")}</div>` +
    `<div class="karte-datum ${a.klasse}">${escape(a.text)}</div>` +
    (hatKi
      ? `<div class="karte-hat-ki">KI-Ergebnis: ${Object.keys(karte.ai)
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
  datumEl.value = karte.uploadDate || "";
  notizenEl.value = karte.notes || "";
  zeichneDatumHinweis(karte);
  zeichneStufenBlock(karte);
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

// Baut den stufen-spezifischen Block: KI-Button ODER Haken ODER Archiv-Hinweis.
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

  if (stufe.ki) {
    const erklaer = document.createElement("p");
    erklaer.className = "ki-erklaer";
    erklaer.textContent =
      "Die KI-Aktion laeuft lokal ueber deine Claude-Code-CLI und kostet keine API-Tokens.";
    stufeBlockEl.appendChild(erklaer);

    const knopf = document.createElement("button");
    knopf.className = "ki-knopf";
    knopf.textContent = stufe.ki.label;
    knopf.addEventListener("click", () => ladeKi(stufe.ki.task, knopf));
    stufeBlockEl.appendChild(knopf);
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
        // Haken gesetzt -> Karte rueckt eine Spalte weiter.
        karte.column = stufe.haken.nach;
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

async function ladeKi(task, knopf) {
  const karte = karteById(aktiveKarteId);
  if (!karte) return;
  knopf.disabled = true;
  ergebnisEl.hidden = false;
  ergebnisEl.classList.remove("fehler");
  ergebnisTitelEl.textContent = (KI_TITEL[task] || "Ergebnis") + " — die KI arbeitet …";
  ergebnisTextEl.textContent = "";
  try {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, card: { title: karte.title, notes: karte.notes } }),
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
      render();
      speichere();
    }
  } catch (e) {
    ergebnisEl.classList.add("fehler");
    ergebnisTitelEl.textContent = "Das hat nicht geklappt";
    ergebnisTextEl.textContent = "Server nicht erreichbar: " + e.message;
  } finally {
    knopf.disabled = false;
  }
}

// --- Detail-Felder binden ---
titelEl.addEventListener("input", () => {
  const k = karteById(aktiveKarteId);
  if (k) {
    k.title = titelEl.value;
    render();
  }
});
titelEl.addEventListener("change", speichere);
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
