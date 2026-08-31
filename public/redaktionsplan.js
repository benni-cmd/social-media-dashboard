// Redaktionsplan: Parameter-Einstellungen und deterministischer Kalender-Vorschau.
// Geoeffnet durch den "Redaktionsplan"-Button im Board.

import {
  CONTENTTYPEN,
  INHALTSKATEGORIEN,
  ZIELE,
  contenttypName,
  kategorieName,
  zielInfo,
} from "/lib/pipeline.js";
import { slotsForMonth } from "/lib/scheduler.js";
import { melde, setStand } from "./store.js";
import { escape, knopf } from "./ui.js";

// Farben je Content-Typ — konsistent mit CSS-Variablen-Schema des Projekts
const TYP_FARBE = {
  reel:      "#f97316",
  slider:    "#3b82f6",
  beitrag:   "#8b5cf6",
  story:     "#10b981",
  highlight: "#f59e0b",
};

let aktivesPanel = null;
let currentPlan = null;
let kalenderRendere = null;

// --- Plan laden / speichern -----------------------------------------------

async function ladePlan() {
  try {
    const res = await fetch("/api/plan");
    if (res.ok) return await res.json();
  } catch {}
  return baueDefaultPlan();
}

async function speicherePlan(plan) {
  await fetch("/api/plan", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(plan),
  });
}

function baueDefaultPlan() {
  return {
    kadenz: { postsProWoche: 3 },
    typenmix: [
      { typ: "reel", anteil: 60 },
      { typ: "slider", anteil: 25 },
      { typ: "beitrag", anteil: 10 },
      { typ: "story", anteil: 5 },
      { typ: "highlight", anteil: 0 },
    ],
    kategorienFokus: INHALTSKATEGORIEN.map((k, i) => ({
      id: k.id,
      aktiv: ["bildung", "spendenaufruf", "umfrage"].includes(k.id),
      prioritaet: i + 1,
    })),
    zielgewichte: [
      { id: "reach_new", gewicht: 40 },
      { id: "deepen", gewicht: 20 },
      { id: "community", gewicht: 30 },
      { id: "donations", gewicht: 10 },
    ],
    kampagnen: [],
  };
}

// --- Panel ----------------------------------------------------------------

export async function zeigeRedaktionsplan(anker) {
  if (aktivesPanel && aktivesPanel.parentElement === anker) {
    aktivesPanel.remove();
    aktivesPanel = null;
    return;
  }
  if (aktivesPanel) aktivesPanel.remove();

  currentPlan = await ladePlan();
  const panel = bauePanel(currentPlan, anker);
  aktivesPanel = panel;
  anker.insertBefore(panel, anker.firstChild);
}

function bauePanel(plan, anker) {
  const el = document.createElement("div");
  el.className = "gruppe";
  el.style.marginBottom = "12px";

  const kopf = document.createElement("div");
  kopf.className = "gruppe-kopf";
  const titelEl = document.createElement("span");
  titelEl.className = "gruppe-titel";
  titelEl.textContent = "Redaktionsplan";
  kopf.appendChild(titelEl);
  const schliessenBtn = knopf("×", {
    titel: "Schliessen",
    klick: () => { el.remove(); aktivesPanel = null; },
  });
  schliessenBtn.style.marginLeft = "auto";
  kopf.appendChild(schliessenBtn);
  el.appendChild(kopf);

  const koerper = document.createElement("div");
  koerper.style.padding = "0 11px 11px";
  baueEinstellungen(plan, koerper);

  const hr = document.createElement("hr");
  hr.style.cssText = "margin:14px 0;border:none;border-top:1px solid var(--border)";
  koerper.appendChild(hr);

  baueKalender(koerper);

  el.appendChild(koerper);
  return el;
}

// --- Einstellungen --------------------------------------------------------

function baueEinstellungen(plan, koerper) {
  // Kadenz
  const kadenzBlock = abschnitt("Posts pro Woche");
  const kadenzInput = document.createElement("input");
  kadenzInput.type = "number";
  kadenzInput.min = "1";
  kadenzInput.max = "14";
  kadenzInput.value = plan.kadenz.postsProWoche;
  kadenzInput.style.cssText = "width:60px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg1);color:var(--fg1)";
  kadenzBlock.appendChild(kadenzInput);
  koerper.appendChild(kadenzBlock);

  // Content-Mix
  const mixBlock = abschnitt("Content-Mix (%)");
  const mixReihe = document.createElement("div");
  mixReihe.style.cssText = "display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end";
  const mixInputs = {};
  for (const t of CONTENTTYPEN) {
    const eintrag = plan.typenmix.find((m) => m.typ === t.id) || { typ: t.id, anteil: 0 };
    const dot = document.createElement("span");
    dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${TYP_FARBE[t.id] || "#888"};margin-bottom:2px`;
    const wrapper = document.createElement("label");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px";
    wrapper.appendChild(dot);
    wrapper.appendChild(document.createTextNode(t.name));
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.max = "100";
    inp.value = eintrag.anteil;
    inp.style.cssText = "width:52px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg1);color:var(--fg1);text-align:center";
    mixInputs[t.id] = inp;
    wrapper.appendChild(inp);
    mixReihe.appendChild(wrapper);
  }
  mixBlock.appendChild(mixReihe);
  koerper.appendChild(mixBlock);

  // Kategorien
  const katBlock = abschnitt("Aktive Inhaltskategorien");
  const katCheckboxes = {};
  const katPrioInputs = {};
  for (const k of INHALTSKATEGORIEN) {
    const kf = plan.kategorienFokus.find((f) => f.id === k.id) || { id: k.id, aktiv: false, prioritaet: 99 };
    const zeile = document.createElement("div");
    zeile.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = kf.aktiv;
    katCheckboxes[k.id] = cb;
    const nameEl = document.createElement("span");
    nameEl.textContent = k.name;
    nameEl.style.flex = "1";
    const prioLabel = document.createElement("span");
    prioLabel.textContent = "Prio";
    prioLabel.style.cssText = "font-size:11px;color:var(--fg2)";
    const prio = document.createElement("input");
    prio.type = "number";
    prio.min = "1";
    prio.max = "9";
    prio.value = kf.prioritaet;
    prio.title = "Prioritaet (1 = hoechste)";
    prio.style.cssText = "width:40px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--bg1);color:var(--fg1);text-align:center";
    katPrioInputs[k.id] = prio;
    zeile.appendChild(cb);
    zeile.appendChild(nameEl);
    zeile.appendChild(prioLabel);
    zeile.appendChild(prio);
    katBlock.appendChild(zeile);
  }
  koerper.appendChild(katBlock);

  // Zielgewichte
  const zielBlock = abschnitt("Zielgewichte (%)");
  const zielReihe = document.createElement("div");
  zielReihe.style.cssText = "display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end";
  const zielInputs = {};
  for (const z of ZIELE) {
    const zw = plan.zielgewichte.find((w) => w.id === z.id) || { id: z.id, gewicht: 25 };
    const wrapper = document.createElement("label");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px";
    wrapper.textContent = z.name;
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.max = "100";
    inp.value = zw.gewicht;
    inp.style.cssText = "width:52px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg1);color:var(--fg1);text-align:center";
    zielInputs[z.id] = inp;
    wrapper.appendChild(inp);
    zielReihe.appendChild(wrapper);
  }
  zielBlock.appendChild(zielReihe);
  koerper.appendChild(zielBlock);

  // Kampagnen
  const kampBlock = abschnitt("Kampagnen & Serien");
  let kampagnenliste = [...(plan.kampagnen || [])];
  const kampContainer = document.createElement("div");
  kampBlock.appendChild(kampContainer);

  function renderKampagnen() {
    kampContainer.innerHTML = "";
    if (!kampagnenliste.length) {
      const p = document.createElement("p");
      p.className = "feld-hinweis";
      p.textContent = "Keine Kampagnen eingetragen.";
      kampContainer.appendChild(p);
    }
    kampagnenliste.forEach((kamp, i) => {
      const zeile = document.createElement("div");
      zeile.style.cssText = "display:flex;gap:6px;align-items:center;padding:2px 0";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = kamp.name;
      inp.placeholder = "Kampagnenname";
      inp.style.cssText = "flex:1;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg1);color:var(--fg1)";
      inp.addEventListener("input", () => { kampagnenliste[i].name = inp.value; });
      const del = knopf("−", {
        titel: "Entfernen",
        klick: () => { kampagnenliste.splice(i, 1); renderKampagnen(); },
      });
      zeile.appendChild(inp);
      zeile.appendChild(del);
      kampContainer.appendChild(zeile);
    });
  }
  renderKampagnen();

  const addKamp = knopf("+ Kampagne hinzufügen", {
    klick: () => {
      kampagnenliste.push({ id: "k" + Date.now(), name: "", aktiv: true });
      renderKampagnen();
    },
  });
  addKamp.style.marginTop = "6px";
  kampBlock.appendChild(addKamp);
  koerper.appendChild(kampBlock);

  // Speichern
  const speichernBtn = knopf("Einstellungen speichern", { art: "haupt" });
  speichernBtn.addEventListener("click", async () => {
    speichernBtn.disabled = true;
    try {
      const aktuell = await ladePlan();
      const neuerPlan = {
        ...aktuell,
        kadenz: { postsProWoche: Math.max(1, parseInt(kadenzInput.value) || 3) },
        typenmix: CONTENTTYPEN.map((t) => ({ typ: t.id, anteil: parseInt(mixInputs[t.id].value) || 0 })),
        kategorienFokus: INHALTSKATEGORIEN.map((k) => ({
          id: k.id,
          aktiv: katCheckboxes[k.id].checked,
          prioritaet: parseInt(katPrioInputs[k.id].value) || 99,
        })),
        zielgewichte: ZIELE.map((z) => ({ id: z.id, gewicht: parseInt(zielInputs[z.id].value) || 0 })),
        kampagnen: kampagnenliste.filter((k) => k.name.trim()),
      };
      await speicherePlan(neuerPlan);
      currentPlan = neuerPlan;
      if (kalenderRendere) kalenderRendere();
      setStand("Redaktionsplan gespeichert.");
    } catch (e) {
      await melde("befund", e.message);
    } finally {
      speichernBtn.disabled = false;
    }
  });
  koerper.appendChild(speichernBtn);
}

// --- Kalender-Vorschau ----------------------------------------------------

let tooltipEl = null;

function zeigeTooltip(e, slot) {
  verbergeTooltip();
  tooltipEl = document.createElement("div");
  tooltipEl.style.cssText = [
    "position:fixed",
    "z-index:9999",
    "background:var(--bg0)",
    "border:1px solid var(--border)",
    "border-radius:6px",
    "padding:8px 11px",
    "font-size:12px",
    "line-height:1.6",
    "box-shadow:0 4px 16px rgba(0,0,0,0.18)",
    "pointer-events:none",
    "max-width:220px",
  ].join(";");

  const farbe = TYP_FARBE[slot.typ] || "#888";
  tooltipEl.innerHTML =
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">` +
    `<span style="width:10px;height:10px;border-radius:50%;background:${farbe};flex-shrink:0"></span>` +
    `<strong>${escape(contenttypName(slot.typ))}</strong></div>` +
    `<div style="color:var(--fg2);font-size:11px">${escape(kategorieName(slot.kategorie))}</div>` +
    `<div>${escape(zielInfo(slot.ziel).name)}</div>` +
    `<div style="color:var(--fg2);font-size:11px;margin-top:3px">${slot.uhrzeit} · ${escape(slot.plattform)}</div>`;

  document.body.appendChild(tooltipEl);

  const rect = e.target.getBoundingClientRect();
  const tt = tooltipEl.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tt.width / 2;
  let top = rect.top - tt.height - 8;
  if (top < 4) top = rect.bottom + 8;
  if (left < 4) left = 4;
  if (left + tt.width > window.innerWidth - 4) left = window.innerWidth - tt.width - 4;
  tooltipEl.style.left = left + "px";
  tooltipEl.style.top = top + "px";
}

function verbergeTooltip() {
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
}

function baueKalender(koerper) {
  const ueberschrift = abschnitt("Kalender-Vorschau");
  const hinweisEl = document.createElement("p");
  hinweisEl.className = "feld-hinweis";
  hinweisEl.style.marginBottom = "10px";
  hinweisEl.textContent = "Algorithmisch erzeugt — nicht editierbar. Aendere die Parameter und speichere, um den Kalender zu aktualisieren.";
  ueberschrift.appendChild(hinweisEl);
  koerper.appendChild(ueberschrift);

  // Legende
  const legende = document.createElement("div");
  legende.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;font-size:11px;color:var(--fg1)";
  for (const [typ, farbe] of Object.entries(TYP_FARBE)) {
    const item = document.createElement("span");
    item.style.cssText = "display:flex;align-items:center;gap:5px";
    const dot = document.createElement("span");
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${farbe};flex-shrink:0`;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(contenttypName(typ)));
    legende.appendChild(item);
  }
  koerper.appendChild(legende);

  const kalenderEl = document.createElement("div");
  koerper.appendChild(kalenderEl);

  const heute = new Date();
  let angezeigterMonat = new Date(heute.getFullYear(), heute.getMonth(), 1);

  function rendere() {
    kalenderEl.innerHTML = "";
    const plan = currentPlan;
    if (!plan) return;

    const year = angezeigterMonat.getFullYear();
    const month = angezeigterMonat.getMonth();

    // Monats-Navigation
    const nav = document.createElement("div");
    nav.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px";

    const prevBtn = knopf("‹", {
      titel: "Vorheriger Monat",
      klick: () => {
        angezeigterMonat.setMonth(angezeigterMonat.getMonth() - 1);
        rendere();
      },
    });
    const monatsTitel = document.createElement("span");
    monatsTitel.style.cssText = "flex:1;text-align:center;font-weight:600;font-size:14px";
    monatsTitel.textContent = angezeigterMonat.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const nextBtn = knopf("›", {
      titel: "Naechster Monat",
      klick: () => {
        angezeigterMonat.setMonth(angezeigterMonat.getMonth() + 1);
        rendere();
      },
    });
    nav.appendChild(prevBtn);
    nav.appendChild(monatsTitel);
    nav.appendChild(nextBtn);
    kalenderEl.appendChild(nav);

    // Slots generieren
    const slots = slotsForMonth(plan, year, month);

    // Nach Tag gruppieren
    const slotsByDay = {};
    for (const s of slots) {
      const day = parseInt(s.datum.slice(-2), 10);
      if (!slotsByDay[day]) slotsByDay[day] = [];
      slotsByDay[day].push(s);
    }

    // Grid: 7 Spalten Mo–So
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:2px";

    const tagNamen = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    for (const n of tagNamen) {
      const th = document.createElement("div");
      th.style.cssText = "text-align:center;font-size:11px;font-weight:600;color:var(--fg2);padding:3px 0;";
      th.textContent = n;
      grid.appendChild(th);
    }

    // Leerfelder vor dem 1. des Monats (Mo=1→0, Di=2→1, ..., So=0→6)
    const ersterWochentag = new Date(year, month, 1).getDay();
    const leerVor = (ersterWochentag - 1 + 7) % 7;
    for (let i = 0; i < leerVor; i++) grid.appendChild(document.createElement("div"));

    const letzterTag = new Date(year, month + 1, 0).getDate();
    const heuteISO = `${heute.getFullYear()}-${String(heute.getMonth()+1).padStart(2,"0")}-${String(heute.getDate()).padStart(2,"0")}`;

    for (let tag = 1; tag <= letzterTag; tag++) {
      const tagISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
      const istHeute = tagISO === heuteISO;

      const zelle = document.createElement("div");
      zelle.style.cssText = [
        "min-height:52px",
        "padding:4px",
        "border:1px solid var(--border)",
        "border-radius:4px",
        `background:${istHeute ? "var(--bg2, var(--bg1))" : "var(--bg1)"}`,
        "position:relative",
        istHeute ? "outline:1px solid var(--akzent, #3b82f6)" : "",
      ].join(";");

      const tagNr = document.createElement("div");
      tagNr.style.cssText = `font-size:11px;color:${istHeute ? "var(--akzent,#3b82f6)" : "var(--fg2)"};font-weight:${istHeute ? "700" : "400"};margin-bottom:3px`;
      tagNr.textContent = tag;
      zelle.appendChild(tagNr);

      const tageSlots = slotsByDay[tag] || [];
      if (tageSlots.length) {
        const punkte = document.createElement("div");
        punkte.style.cssText = "display:flex;flex-wrap:wrap;gap:2px";
        for (const slot of tageSlots) {
          const farbe = TYP_FARBE[slot.typ] || "#888";
          const punkt = document.createElement("span");
          punkt.style.cssText = `width:10px;height:10px;border-radius:50%;background:${farbe};cursor:default;flex-shrink:0;display:inline-block`;
          punkt.addEventListener("mouseenter", (e) => zeigeTooltip(e, slot));
          punkt.addEventListener("mouseleave", verbergeTooltip);
          punkte.appendChild(punkt);
        }
        zelle.appendChild(punkte);
      }

      grid.appendChild(zelle);
    }

    kalenderEl.appendChild(grid);
  }

  kalenderRendere = rendere;
  rendere();
}

// --- Hilfsfunktionen ------------------------------------------------------

function abschnitt(titel) {
  const el = document.createElement("div");
  el.style.marginBottom = "14px";
  const h = document.createElement("h4");
  h.style.cssText = "font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--fg2);margin:0 0 7px";
  h.textContent = titel;
  el.appendChild(h);
  return el;
}
