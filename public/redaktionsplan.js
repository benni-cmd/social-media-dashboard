// Redaktionsplan: Parameter-Einstellungen und deterministischer Kalender-Vorschau.

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

const TYP_FARBE = {
  reel:      "#f97316",
  slider:    "#3b82f6",
  beitrag:   "#8b5cf6",
  story:     "#10b981",
  highlight: "#f59e0b",
};

let aktivesPanel = null;
let currentPlan   = null;

// ── Plan I/O ──────────────────────────────────────────────────────────────

async function ladePlan() {
  try {
    const r = await fetch("/api/plan");
    if (r.ok) return await r.json();
  } catch {}
  return defaultPlan();
}

async function speicherePlan(plan) {
  const r = await fetch("/api/plan", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (!r.ok) throw new Error("Speichern fehlgeschlagen (" + r.status + ")");
}

function defaultPlan() {
  return {
    kadenz: { postsProWoche: 3 },
    typenmix: [
      { typ: "reel",      anteil: 60 },
      { typ: "slider",    anteil: 25 },
      { typ: "beitrag",   anteil: 10 },
      { typ: "story",     anteil:  5 },
      { typ: "highlight", anteil:  0 },
    ],
    kategorienFokus: INHALTSKATEGORIEN.map((k, i) => ({
      id: k.id,
      aktiv: ["bildung", "spendenaufruf", "umfrage"].includes(k.id),
      prioritaet: i + 1,
    })),
    zielgewichte: [
      { id: "reach_new", gewicht: 40 },
      { id: "deepen",    gewicht: 20 },
      { id: "community", gewicht: 30 },
      { id: "donations", gewicht: 10 },
    ],
    kampagnen: [],
  };
}

// ── Panel ─────────────────────────────────────────────────────────────────

export async function zeigeRedaktionsplan(anker) {
  if (aktivesPanel && aktivesPanel.parentElement === anker) {
    aktivesPanel.remove(); aktivesPanel = null; return;
  }
  if (aktivesPanel) aktivesPanel.remove();
  currentPlan = await ladePlan();
  aktivesPanel = bauePanel(currentPlan, anker);
  anker.insertBefore(aktivesPanel, anker.firstChild);
}

function bauePanel(plan, _anker) {
  const el = document.createElement("div");
  el.className = "gruppe";
  el.style.marginBottom = "12px";

  // Kopf
  const kopf = document.createElement("div");
  kopf.className = "gruppe-kopf";
  const titel = document.createElement("span");
  titel.className = "gruppe-titel";
  titel.textContent = "Redaktionsplan";
  kopf.appendChild(titel);
  const xBtn = knopf("×", { titel: "Schliessen", klick: () => { el.remove(); aktivesPanel = null; } });
  xBtn.style.marginLeft = "auto";
  kopf.appendChild(xBtn);
  el.appendChild(kopf);

  const koerper = document.createElement("div");
  koerper.style.padding = "0 12px 16px";

  // baueEinstellungen gibt einen Getter zurück, der den aktuellen Formularstand liest
  const lesePlan = baueEinstellungen(plan, koerper, () => {
    // nach Speichern Kalender neu rendern
    if (typeof kalenderRendere === "function") kalenderRendere();
  });

  const hr = document.createElement("hr");
  hr.style.cssText = "margin:16px 0;border:none;border-top:1px solid var(--border)";
  koerper.appendChild(hr);

  // baueKalender gibt seine rendere-Funktion zurück
  let kalenderRendere = baueKalender(koerper);

  el.appendChild(koerper);
  return el;
}

// ── Einstellungen ─────────────────────────────────────────────────────────

function baueEinstellungen(plan, koerper, nachSpeichern) {
  // ── Posts pro Woche (Stepper) ──────────────────────────────────────────
  sektionKopf("Posts pro Woche", koerper);
  let ppw = plan.kadenz.postsProWoche;
  const { wrap: stepperEl, getValue: getPPW } = stepper(ppw, 1, 14, (v) => { ppw = v; });
  koerper.appendChild(stepperEl);

  // ── Content-Mix (Slider) ───────────────────────────────────────────────
  sektionKopf("Content-Mix", koerper, "14px 0 6px");
  const mixSumEl = sumAnzeige();
  const mixSlider = {};
  for (const t of CONTENTTYPEN) {
    const eintrag = plan.typenmix.find((m) => m.typ === t.id) || { anteil: 0 };
    const { zeile, getValue } = sliderZeile(
      t.name,
      TYP_FARBE[t.id] || "#888",
      eintrag.anteil,
      () => aktualisiereSum(mixSumEl, Object.values(mixSlider).map((f) => f())),
    );
    mixSlider[t.id] = getValue;
    koerper.appendChild(zeile);
  }
  koerper.appendChild(mixSumEl);
  aktualisiereSum(mixSumEl, Object.values(mixSlider).map((f) => f()));

  // ── Inhaltskategorien ──────────────────────────────────────────────────
  sektionKopf("Inhaltskategorien", koerper, "14px 0 6px");
  const katStatus = {};
  const katPrio   = {};
  for (const k of INHALTSKATEGORIEN) {
    const kf = plan.kategorienFokus.find((f) => f.id === k.id) || { aktiv: false, prioritaet: 99 };
    const { zeile, getAktiv, getPrio } = kategorieZeile(k, kf);
    katStatus[k.id] = getAktiv;
    katPrio[k.id]   = getPrio;
    koerper.appendChild(zeile);
  }

  // ── Zielgewichte (Slider) ──────────────────────────────────────────────
  sektionKopf("Zielgewichte", koerper, "14px 0 6px");
  const zielSumEl = sumAnzeige();
  const zielSlider = {};
  for (const z of ZIELE) {
    const zw = plan.zielgewichte.find((w) => w.id === z.id) || { gewicht: 25 };
    const { zeile, getValue } = sliderZeile(
      z.name,
      "#64748b",
      zw.gewicht,
      () => aktualisiereSum(zielSumEl, Object.values(zielSlider).map((f) => f())),
    );
    zielSlider[z.id] = getValue;
    koerper.appendChild(zeile);
  }
  koerper.appendChild(zielSumEl);
  aktualisiereSum(zielSumEl, Object.values(zielSlider).map((f) => f()));

  // ── Kampagnen ──────────────────────────────────────────────────────────
  sektionKopf("Kampagnen & Serien", koerper, "14px 0 6px");
  let kampagnen = [...(plan.kampagnen || [])];
  const kampContainer = document.createElement("div");
  koerper.appendChild(kampContainer);
  const addKampBtn = knopf("+ Kampagne", { klick: () => { kampagnen.push({ id: "k" + Date.now(), name: "", aktiv: true }); renderKamp(); } });
  addKampBtn.style.marginTop = "4px";
  koerper.appendChild(addKampBtn);

  function renderKamp() {
    kampContainer.innerHTML = "";
    if (!kampagnen.length) {
      const p = document.createElement("p");
      p.className = "feld-hinweis";
      p.textContent = "Keine Kampagnen eingetragen.";
      kampContainer.appendChild(p);
      return;
    }
    kampagnen.forEach((kamp, i) => {
      const z = document.createElement("div");
      z.style.cssText = "display:flex;gap:6px;align-items:center;padding:2px 0";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = kamp.name;
      inp.placeholder = "Kampagnenname";
      inp.style.cssText = "flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg1);color:var(--fg1);font-size:13px";
      inp.addEventListener("input", () => { kampagnen[i].name = inp.value; });
      const del = knopf("×", { titel: "Entfernen", klick: () => { kampagnen.splice(i, 1); renderKamp(); } });
      z.appendChild(inp);
      z.appendChild(del);
      kampContainer.appendChild(z);
    });
  }
  renderKamp();

  // ── Fehleranzeige + Speichern ──────────────────────────────────────────
  const fehlerEl = document.createElement("p");
  fehlerEl.style.cssText = "color:#ef4444;font-size:12px;margin:10px 0 0;display:none";
  koerper.appendChild(fehlerEl);

  const speichernBtn = knopf("Einstellungen speichern", { art: "haupt" });
  speichernBtn.style.marginTop = "12px";
  speichernBtn.style.width = "100%";
  speichernBtn.addEventListener("click", async () => {
    // Validierung
    const mixSumme  = Object.values(mixSlider).reduce((s, f) => s + f(), 0);
    const zielSumme = Object.values(zielSlider).reduce((s, f) => s + f(), 0);
    if (mixSumme !== 100) {
      fehlerEl.textContent = `Content-Mix ergibt ${mixSumme} % — muss genau 100 % sein.`;
      fehlerEl.style.display = "";
      return;
    }
    if (zielSumme !== 100) {
      fehlerEl.textContent = `Zielgewichte ergeben ${zielSumme} % — muss genau 100 % sein.`;
      fehlerEl.style.display = "";
      return;
    }
    fehlerEl.style.display = "none";

    speichernBtn.disabled = true;
    try {
      const aktuell = await ladePlan();
      const neuerPlan = {
        ...aktuell,
        kadenz: { postsProWoche: getPPW() },
        typenmix: CONTENTTYPEN.map((t) => ({ typ: t.id, anteil: mixSlider[t.id]() })),
        kategorienFokus: INHALTSKATEGORIEN.map((k) => ({
          id: k.id,
          aktiv: katStatus[k.id](),
          prioritaet: katPrio[k.id](),
        })),
        zielgewichte: ZIELE.map((z) => ({ id: z.id, gewicht: zielSlider[z.id]() })),
        kampagnen: kampagnen.filter((k) => k.name.trim()),
      };
      await speicherePlan(neuerPlan);
      currentPlan = neuerPlan;
      nachSpeichern();
      setStand("Redaktionsplan gespeichert.");
    } catch (e) {
      await melde("befund", e.message);
    } finally {
      speichernBtn.disabled = false;
    }
  });
  koerper.appendChild(speichernBtn);
}

// ── Kalender ──────────────────────────────────────────────────────────────

let tooltipEl = null;

function zeigeTooltip(e, slot) {
  verbergeTooltip();
  tooltipEl = document.createElement("div");
  const farbe = TYP_FARBE[slot.typ] || "#888";
  tooltipEl.style.cssText = "position:fixed;z-index:9999;background:var(--bg0);border:1px solid var(--border);border-radius:8px;padding:10px 13px;font-size:12px;line-height:1.6;box-shadow:0 4px 20px rgba(0,0,0,0.18);pointer-events:none;max-width:230px";
  tooltipEl.innerHTML =
    `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">` +
    `<span style="width:10px;height:10px;border-radius:50%;background:${farbe};flex-shrink:0"></span>` +
    `<strong style="font-size:13px">${escape(contenttypName(slot.typ))}</strong></div>` +
    `<div style="color:var(--fg2)">${escape(kategorieName(slot.kategorie))}</div>` +
    `<div>${escape(zielInfo(slot.ziel).name)}</div>` +
    `<div style="color:var(--fg2);margin-top:4px;font-size:11px">${slot.uhrzeit} · ${escape(slot.plattform)}</div>`;
  document.body.appendChild(tooltipEl);

  const r = e.target.getBoundingClientRect();
  const t = tooltipEl.getBoundingClientRect();
  let left = r.left + r.width / 2 - t.width / 2;
  let top  = r.top - t.height - 8;
  if (top < 4) top = r.bottom + 8;
  if (left < 4) left = 4;
  if (left + t.width > window.innerWidth - 4) left = window.innerWidth - t.width - 4;
  tooltipEl.style.left = left + "px";
  tooltipEl.style.top  = top  + "px";
}

function verbergeTooltip() {
  if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
}

// Gibt seine rendere-Funktion zurück, damit der Aufrufer sie nach Plan-Änderungen auslösen kann.
function baueKalender(koerper) {
  sektionKopf("Kalender-Vorschau", koerper, "0 0 6px");

  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.style.marginBottom = "10px";
  hinweis.textContent = "Algorithmus-Ausgabe — nicht editierbar. Parameter speichern → Vorschau aktualisiert sich.";
  koerper.appendChild(hinweis);

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

    const year  = angezeigterMonat.getFullYear();
    const month = angezeigterMonat.getMonth();

    // Navigation
    const nav = document.createElement("div");
    nav.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px";
    const prevBtn = knopf("‹", { titel: "Vorheriger Monat", klick: () => { angezeigterMonat.setMonth(month - 1); rendere(); } });
    const monatsTitel = document.createElement("span");
    monatsTitel.style.cssText = "flex:1;text-align:center;font-weight:600;font-size:14px";
    monatsTitel.textContent = angezeigterMonat.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const nextBtn = knopf("›", { titel: "Naechster Monat", klick: () => { angezeigterMonat.setMonth(month + 1); rendere(); } });
    nav.appendChild(prevBtn);
    nav.appendChild(monatsTitel);
    nav.appendChild(nextBtn);
    kalenderEl.appendChild(nav);

    // Slots
    const slots = slotsForMonth(plan, year, month);
    const byDay = {};
    for (const s of slots) {
      const d = parseInt(s.datum.slice(-2), 10);
      (byDay[d] || (byDay[d] = [])).push(s);
    }

    // Grid
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:2px";

    for (const n of ["Mo","Di","Mi","Do","Fr","Sa","So"]) {
      const th = document.createElement("div");
      th.style.cssText = "text-align:center;font-size:11px;font-weight:600;color:var(--fg2);padding:3px 0";
      th.textContent = n;
      grid.appendChild(th);
    }

    const ersterWochentag = new Date(year, month, 1).getDay();
    const leerVor = (ersterWochentag - 1 + 7) % 7;
    for (let i = 0; i < leerVor; i++) grid.appendChild(document.createElement("div"));

    const heuteStr = `${heute.getFullYear()}-${String(heute.getMonth()+1).padStart(2,"0")}-${String(heute.getDate()).padStart(2,"0")}`;
    const letzterTag = new Date(year, month + 1, 0).getDate();

    for (let tag = 1; tag <= letzterTag; tag++) {
      const tagStr = `${year}-${String(month+1).padStart(2,"0")}-${String(tag).padStart(2,"0")}`;
      const istHeute = tagStr === heuteStr;
      const zelle = document.createElement("div");
      zelle.style.cssText = [
        "min-height:52px",
        "padding:4px",
        "border:1px solid var(--border)",
        "border-radius:4px",
        "background:var(--bg1)",
        istHeute ? "outline:2px solid var(--akzent,#3b82f6);outline-offset:-1px" : "",
      ].filter(Boolean).join(";");

      const nr = document.createElement("div");
      nr.style.cssText = `font-size:11px;color:${istHeute ? "var(--akzent,#3b82f6)" : "var(--fg2)"};font-weight:${istHeute ? "700" : "400"};margin-bottom:3px`;
      nr.textContent = tag;
      zelle.appendChild(nr);

      const tageSlots = byDay[tag] || [];
      if (tageSlots.length) {
        const punkte = document.createElement("div");
        punkte.style.cssText = "display:flex;flex-wrap:wrap;gap:2px";
        for (const slot of tageSlots) {
          const farbe = TYP_FARBE[slot.typ] || "#888";
          const p = document.createElement("span");
          p.style.cssText = `width:10px;height:10px;border-radius:50%;background:${farbe};flex-shrink:0;display:inline-block;cursor:default`;
          p.addEventListener("mouseenter", (e) => zeigeTooltip(e, slot));
          p.addEventListener("mouseleave", verbergeTooltip);
          punkte.appendChild(p);
        }
        zelle.appendChild(punkte);
      }
      grid.appendChild(zelle);
    }
    kalenderEl.appendChild(grid);
  }

  rendere();
  return rendere; // Aufrufer kann rendere() nach Plan-Änderungen aufrufen
}

// ── UI-Bausteine ──────────────────────────────────────────────────────────

function sektionKopf(titel, container, margin = "12px 0 8px") {
  const h = document.createElement("h4");
  h.style.cssText = `font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--fg2);margin:${margin}`;
  h.textContent = titel;
  container.appendChild(h);
}

function stepper(initWert, min, max, onChange) {
  let value = Math.max(min, Math.min(max, initWert));
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:8px;overflow:hidden;height:36px";

  const btnStyle = "width:36px;height:36px;border:none;background:var(--bg1);color:var(--fg1);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  minus.style.cssText = btnStyle;

  const display = document.createElement("span");
  display.style.cssText = "min-width:42px;text-align:center;font-size:17px;font-weight:600;color:var(--fg1);padding:0 4px;border-left:1px solid var(--border);border-right:1px solid var(--border)";
  display.textContent = value;

  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";
  plus.style.cssText = btnStyle;

  minus.addEventListener("click", () => { if (value > min) { value--; display.textContent = value; onChange(value); } });
  plus.addEventListener("click",  () => { if (value < max) { value++; display.textContent = value; onChange(value); } });

  wrap.appendChild(minus);
  wrap.appendChild(display);
  wrap.appendChild(plus);
  return { wrap, getValue: () => value };
}

function sliderZeile(label, farbe, initWert, onInput) {
  let value = initWert;
  const zeile = document.createElement("div");
  zeile.style.cssText = "display:grid;grid-template-columns:12px 130px 1fr 38px;gap:8px;align-items:center;margin-bottom:7px";

  const dot = document.createElement("span");
  dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${farbe};flex-shrink:0`;

  const nameEl = document.createElement("span");
  nameEl.style.cssText = "font-size:13px;color:var(--fg1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
  nameEl.textContent = label;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.value = value;
  // accent-color setzt Thumb-Farbe im modernen Browser
  slider.style.cssText = `width:100%;cursor:pointer;accent-color:${farbe};height:4px`;

  const prozEl = document.createElement("span");
  prozEl.style.cssText = "font-size:13px;font-variant-numeric:tabular-nums;color:var(--fg1);text-align:right";
  prozEl.textContent = value + " %";

  slider.addEventListener("input", () => {
    value = parseInt(slider.value, 10);
    prozEl.textContent = value + " %";
    onInput(value);
  });

  zeile.appendChild(dot);
  zeile.appendChild(nameEl);
  zeile.appendChild(slider);
  zeile.appendChild(prozEl);
  return { zeile, getValue: () => value };
}

function sumAnzeige() {
  const el = document.createElement("div");
  el.style.cssText = "font-size:12px;text-align:right;margin:2px 0 8px;font-weight:500";
  return el;
}

function aktualisiereSum(el, werte) {
  const summe = werte.reduce((s, v) => s + v, 0);
  const ok = summe === 100;
  el.style.color = ok ? "var(--fg2)" : "#ef4444";
  el.textContent = `Summe: ${summe} %${ok ? " ✓" : " — muss 100 % ergeben"}`;
}

function kategorieZeile(k, kf) {
  let aktiv = kf.aktiv;
  let prio  = kf.prioritaet;

  const zeile = document.createElement("div");
  zeile.style.cssText = "display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border)";

  // Toggle-Switch
  const toggleWrap = document.createElement("label");
  toggleWrap.style.cssText = "position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;cursor:pointer";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = aktiv;
  cb.style.cssText = "opacity:0;width:0;height:0;position:absolute";
  const track = document.createElement("span");
  function updateTrack() {
    track.style.cssText = [
      "position:absolute;top:0;left:0;right:0;bottom:0;border-radius:20px;transition:background 0.15s",
      `background:${aktiv ? "var(--akzent,#3b82f6)" : "var(--border)"}`,
    ].join(";");
    const thumb = track.querySelector(".thumb");
    if (thumb) thumb.style.transform = `translateX(${aktiv ? 16 : 0}px)`;
  }
  const thumb = document.createElement("span");
  thumb.className = "thumb";
  thumb.style.cssText = "position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform 0.15s;box-shadow:0 1px 3px rgba(0,0,0,0.25)";
  track.appendChild(thumb);
  updateTrack();
  cb.addEventListener("change", () => { aktiv = cb.checked; updateTrack(); });
  toggleWrap.appendChild(cb);
  toggleWrap.appendChild(track);

  const nameEl = document.createElement("span");
  nameEl.style.cssText = "flex:1;font-size:13px;color:var(--fg1)";
  nameEl.textContent = k.name;

  const prioLabel = document.createElement("span");
  prioLabel.style.cssText = "font-size:11px;color:var(--fg2);white-space:nowrap";
  prioLabel.textContent = "Prio";

  const prioInp = document.createElement("input");
  prioInp.type = "number";
  prioInp.min = "1";
  prioInp.max = "9";
  prioInp.value = prio;
  prioInp.title = "Prioritaet 1 = hoechste";
  prioInp.style.cssText = "width:40px;padding:3px 5px;border:1px solid var(--border);border-radius:5px;background:var(--bg1);color:var(--fg1);text-align:center;font-size:12px";
  prioInp.addEventListener("input", () => { prio = parseInt(prioInp.value, 10) || 1; });

  zeile.appendChild(toggleWrap);
  zeile.appendChild(nameEl);
  zeile.appendChild(prioLabel);
  zeile.appendChild(prioInp);
  return {
    zeile,
    getAktiv: () => cb.checked,
    getPrio:  () => parseInt(prioInp.value, 10) || 1,
  };
}
