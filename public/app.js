// Frontend des Content-Pipeline-Boards.
// Haelt den Board-Stand im Speicher, rendert Spalten + Karten, erlaubt Drag&Drop
// zwischen den Spalten und oeffnet je Karte ein Detail-Panel mit den KI-Aktionen.
// Jede Aenderung wird per PUT /api/board zurueckgeschrieben.

let board = { columns: [], cards: [] };
let aktiveKarteId = null;
let letztesKiErgebnis = "";

const boardEl = document.getElementById("board");
const detailEl = document.getElementById("detail");
const standEl = document.getElementById("speicher-stand");
const titelEl = document.getElementById("detail-titel");
const notizenEl = document.getElementById("detail-notizen");
const ergebnisEl = document.getElementById("ki-ergebnis");
const ergebnisTextEl = document.getElementById("ki-ergebnis-text");
const ergebnisTitelEl = document.getElementById("ki-ergebnis-titel");

const KI_TITEL = {
  skript: "Skript-Entwurf",
  caption: "Caption",
  hooks: "Hook-Ideen",
};

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

    // Drop-Ziel
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
      const karte = { id: neueId(), column: col.id, title: "Neue Idee", notes: "", ai: {} };
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
  const hatKi = karte.ai && Object.keys(karte.ai).length > 0;
  el.innerHTML =
    `<div class="karte-titel">${escape(karte.title || "(ohne Titel)")}</div>` +
    (hatKi
      ? `<div class="karte-hat-ki">KI-Ergebnis vorhanden: ${Object.keys(karte.ai)
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
  titelEl.value = karte.title || "";
  notizenEl.value = karte.notes || "";
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

// --- Detail-Felder an die Karte binden ---
titelEl.addEventListener("input", () => {
  const k = karteById(aktiveKarteId);
  if (k) {
    k.title = titelEl.value;
    render();
  }
});
titelEl.addEventListener("change", speichere);
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

// --- KI-Aktionen ---
for (const knopf of document.querySelectorAll(".ki-knopf")) {
  knopf.addEventListener("click", async () => {
    const karte = karteById(aktiveKarteId);
    if (!karte) return;
    const task = knopf.dataset.task;
    const alleKnoepfe = document.querySelectorAll(".ki-knopf");
    alleKnoepfe.forEach((b) => (b.disabled = true));
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
        ergebnisTextEl.textContent = (data.hint || data.error || "Unbekannter Fehler.") + "";
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
      alleKnoepfe.forEach((b) => (b.disabled = false));
    }
  });
}

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
