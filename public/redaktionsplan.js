// Redaktionsplan: Parameter-Einstellungen und deterministischer Kalender-Vorschau.

import {
  CONTENTTYPEN,
  INHALTSKATEGORIEN,
  ZIELE,
  PLATTFORMEN,
  contenttypName,
  kategorieName,
  zielInfo,
} from "/lib/pipeline.js";
import { slotsForMonth, migriereTypenmix } from "/lib/scheduler.js";
import { melde, setStand } from "./store.js";
import { escape, knopf, sanduhr, modalX } from "./ui.js";

// Anzeigenamen im Plan-UI (abweichend von card-internen IDs)
const PLAN_TYP_NAME = {
  reel:       "Kurzformat-Video",
  slider:     "Slider",
  beitrag:    "Beitrag mit Text",
  story:      "Story / Highlight",
  langformat: "Langformat-Video",
};

// "highlight" erscheint hier nicht — es ist kein eigener Upload-Typ, sondern
// ein gepinnter Story-Post. Im Scheduler gibt es keinen highlight-Slot.
const PLAN_TYPEN = CONTENTTYPEN.filter((t) => t.id !== "highlight");

const TYP_FARBE = {
  reel:       "#f97316",
  slider:     "#3b82f6",
  beitrag:    "#8b5cf6",
  story:      "#10b981",
  langformat: "#ef4444",
};

const ZIEL_FARBE = {
  reach_new: "#f97316",
  deepen:    "#3b82f6",
  community: "#10b981",
  donations: "#8b5cf6",
};

let aktivesOverlay = null;
let currentPlan    = null; // ueberlebt Schliessen/Oeffnen — zweites Oeffnen zeigt sofort den Cache (v47)

// ── Plan I/O ──────────────────────────────────────────────────────────────

async function ladePlan() {
  try {
    const r = await fetch("/api/plan");
    if (r.ok) {
      const p = await r.json();
      // Altes anteil%-Format auf perWoche migrieren
      p.typenmix = migriereTypenmix(p.typenmix, p.kadenz?.postsProWoche);
      return ergaenzePlan(p);
    }
  } catch {}
  return defaultPlan();
}

// Fehlende Typen einfuegen, veraltete entfernen ("highlight" hat keinen eigenen Slot mehr)
function ergaenzePlan(p) {
  p.typenmix = (p.typenmix || []).filter((t) => t.typ !== "highlight");
  const bekannteTypen = new Set(p.typenmix.map((t) => t.typ));
  for (const t of PLAN_TYPEN) {
    if (!bekannteTypen.has(t.id)) p.typenmix.push({ typ: t.id, perWoche: 0 });
  }
  if (!p.plattformen) p.plattformen = ["instagram", "linkedin"];
  return p;
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
    plattformen: ["instagram", "linkedin"],
    kadenz: { postsProWoche: 3 },
    maxAbstandTage: 0,
    typenmix: PLAN_TYPEN.map(({ id }) => ({
      typ: id,
      perWoche: { reel: 2, slider: 0.75, beitrag: 0.25, story: 0, langformat: 0 }[id] ?? 0,
    })),
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

// Oeffnet den Redaktionsplan als Popup ueber dem Board (Muster .modal-overlay/.modal wie
// drehtermine.js). Das Fenster erscheint SOFORT; der Inhalt haengt nicht an der Drive-Latenz
// von /api/plan (bis ~35 s gemessen, v47). Erneuter Klick schliesst (Toggle).
export async function zeigeRedaktionsplan() {
  if (aktivesOverlay) { schliesseOverlay(); return; }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) schliesseOverlay(); });

  const box = document.createElement("div");
  box.className = "modal modal-plan";

  const frage = document.createElement("div");
  frage.className = "modal-frage";
  frage.textContent = "Redaktionsplan";
  frage.appendChild(modalX(schliesseOverlay));
  box.appendChild(frage);

  const koerper = document.createElement("div");
  koerper.className = "modal-plan-koerper";
  box.appendChild(koerper);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  aktivesOverlay = overlay;

  const esc = (e) => { if (e.key === "Escape") schliesseOverlay(); };
  document.addEventListener("keydown", esc);
  overlay._esc = esc;

  if (currentPlan) {
    // Zweites Oeffnen: sofort aus dem Cache — kein Warten auf Drive.
    baueInhalt(currentPlan, koerper);
  } else {
    // v51: Das war statischer Text an der laengsten Wartestelle der App (`/api/plan` live mit
    // 34,8 s gemessen, v47) — die Sanduhr ist der eine Marker fuer „warte, da kommt noch was".
    const laedt = document.createElement("p");
    laedt.className = "feld-hinweis";
    laedt.style.padding = "16px 0";
    laedt.appendChild(sanduhr("Redaktionsplan wird aus Drive gelesen — das dauert einen Moment …"));
    koerper.appendChild(laedt);
    const plan = await ladePlan();
    if (aktivesOverlay !== overlay) return; // zwischenzeitlich geschlossen
    currentPlan = plan;
    koerper.innerHTML = "";
    baueInhalt(currentPlan, koerper);
  }
}

function schliesseOverlay() {
  if (!aktivesOverlay) return;
  if (aktivesOverlay._esc) document.removeEventListener("keydown", aktivesOverlay._esc);
  aktivesOverlay.remove();
  aktivesOverlay = null;
}

function baueInhalt(plan, koerper) {
  let kalenderRendere = null;
  baueEinstellungen(plan, koerper, () => { if (kalenderRendere) kalenderRendere(); });

  const hr = document.createElement("hr");
  hr.style.cssText = "margin:16px 0;border:none;border-top:1px solid var(--border)";
  koerper.appendChild(hr);

  kalenderRendere = baueKalender(koerper);
}

// ── Einstellungen ─────────────────────────────────────────────────────────

function baueEinstellungen(plan, koerper, nachSpeichern) {

  // ── Aktive Plattformen ─────────────────────────────────────────────────
  sektionKopf("Aktive Plattformen", koerper);
  const plHinweis = document.createElement("p");
  plHinweis.className = "feld-hinweis";
  plHinweis.style.marginBottom = "10px";
  plHinweis.textContent = "Welche Plattformen werden aktuell bespielt? Legt fest, auf welche Zeitfenster der Algorithmus optimiert.";
  koerper.appendChild(plHinweis);

  const plCheckboxen = {};
  const plReihe = document.createElement("div");
  plReihe.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px";
  for (const pl of PLATTFORMEN) {
    const aktiv = (plan.plattformen || ["instagram", "linkedin"]).includes(pl.id);
    const label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;user-select:none";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = aktiv;
    cb.style.cssText = "width:15px;height:15px;cursor:pointer;accent-color:var(--akzent,#3b82f6)";
    label.appendChild(cb);
    label.appendChild(document.createTextNode(pl.name));
    plReihe.appendChild(label);
    plCheckboxen[pl.id] = cb;
  }
  koerper.appendChild(plReihe);

  // ── Posting-Frequenz je Typ ────────────────────────────────────────────
  sektionKopf("Posting-Frequenz", koerper);

  const freqHinweis = document.createElement("p");
  freqHinweis.className = "feld-hinweis";
  freqHinweis.style.marginBottom = "10px";
  freqHinweis.textContent = "Posts pro Woche je Format — 0,25 = einmal alle 4 Wochen.";
  koerper.appendChild(freqHinweis);

  const freqGesamt = document.createElement("div");
  freqGesamt.style.cssText = "font-size:12px;color:var(--fg2);margin-bottom:10px;font-weight:500";

  const freqGetters = {};
  for (const t of PLAN_TYPEN) {
    const eintrag = plan.typenmix.find((m) => m.typ === t.id) || { perWoche: 0 };
    const { zeile, getValue } = frequenzZeile(
      PLAN_TYP_NAME[t.id] || t.name,
      TYP_FARBE[t.id] || "#888",
      eintrag.perWoche,
      () => aktualisiereGesamt(freqGesamt, Object.values(freqGetters).map((f) => f())),
    );
    freqGetters[t.id] = getValue;
    koerper.appendChild(zeile);
  }
  koerper.appendChild(freqGesamt);
  aktualisiereGesamt(freqGesamt, Object.values(freqGetters).map((f) => f()));

  // ── Max. Abstand zwischen 2 Posts (v79) ───────────────────────────────
  const abstandZeile = document.createElement("div");
  abstandZeile.style.cssText = "display:flex;align-items:center;gap:10px;margin:8px 0 4px";
  const abstandLabel = document.createElement("label");
  abstandLabel.style.cssText = "font-size:13px;flex:1";
  abstandLabel.textContent = "Max. Abstand zwischen 2 Posts (Tage)";
  const abstandInput = document.createElement("input");
  abstandInput.type = "number";
  abstandInput.min = "0";
  abstandInput.step = "1";
  abstandInput.value = String(plan.maxAbstandTage ?? 0);
  abstandInput.style.cssText = "width:70px;padding:4px 6px;font-size:13px;text-align:right";
  abstandLabel.setAttribute("for", "");
  abstandZeile.appendChild(abstandLabel);
  abstandZeile.appendChild(abstandInput);
  koerper.appendChild(abstandZeile);
  const abstandHinweis = document.createElement("p");
  abstandHinweis.className = "feld-hinweis";
  abstandHinweis.style.marginBottom = "10px";
  abstandHinweis.textContent = "0 = keine Grenze. Sonst wird kein Upload weiter als N Tage vom vorherigen entfernt geplant.";
  koerper.appendChild(abstandHinweis);
  const getMaxAbstand = () => Math.max(0, Math.floor(Number(abstandInput.value) || 0));

  // ── Inhaltskategorien ──────────────────────────────────────────────────
  sektionKopf("Inhaltskategorien", koerper, "14px 0 8px");
  const katStatus = {};
  const katPrio   = {};
  for (const k of INHALTSKATEGORIEN) {
    const kf = plan.kategorienFokus.find((f) => f.id === k.id) || { aktiv: false, prioritaet: 99 };
    const { zeile, getAktiv, getPrio } = kategorieZeile(k, kf);
    katStatus[k.id] = getAktiv;
    katPrio[k.id]   = getPrio;
    koerper.appendChild(zeile);
  }

  // ── Zielgewichte ──────────────────────────────────────────────────────
  sektionKopf("Zielgewichte", koerper, "14px 0 8px");
  const zielSumEl = sumAnzeige();
  const zielGetters = {};
  for (const z of ZIELE) {
    const zw = plan.zielgewichte.find((w) => w.id === z.id) || { gewicht: 25 };
    const { zeile, getValue } = sliderZeile(
      z.name,
      ZIEL_FARBE[z.id] || "#64748b",
      zw.gewicht,
      0, 100,
      () => aktualisiereSum(zielSumEl, Object.values(zielGetters).map((f) => f())),
    );
    zielGetters[z.id] = getValue;
    koerper.appendChild(zeile);
  }
  koerper.appendChild(zielSumEl);
  aktualisiereSum(zielSumEl, Object.values(zielGetters).map((f) => f()));

  // ── Kampagnen ──────────────────────────────────────────────────────────
  sektionKopf("Kampagnen & Serien", koerper, "14px 0 8px");
  let kampagnen = [...(plan.kampagnen || [])];
  const kampContainer = document.createElement("div");
  koerper.appendChild(kampContainer);
  const addKampBtn = knopf("+ Kampagne", {
    klick: () => { kampagnen.push({ id: "k" + Date.now(), name: "", aktiv: true }); renderKamp(); },
  });
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

  // ── Fehler + Speichern ─────────────────────────────────────────────────
  const fehlerEl = document.createElement("p");
  fehlerEl.style.cssText = "color:#ef4444;font-size:12px;margin:10px 0 0;display:none";
  koerper.appendChild(fehlerEl);

  const speichernBtn = knopf("Einstellungen speichern", { art: "haupt" });
  speichernBtn.style.cssText += ";margin-top:12px;width:100%";
  speichernBtn.addEventListener("click", () => {
    const zielSumme = Object.values(zielGetters).reduce((s, f) => s + f(), 0);
    if (zielSumme !== 100) {
      fehlerEl.textContent = `Zielgewichte ergeben ${zielSumme} % — muss genau 100 % sein.`;
      fehlerEl.style.display = "";
      return;
    }
    fehlerEl.style.display = "none";

    // Aus dem bereits geladenen Plan zusammensetzen — KEIN erneuter Drive-Read (v47). Frueher
    // haengte die Vorschau bis ~35 s an `await ladePlan()`; deshalb aktualisierte sie sich erst
    // nach Schliessen+Neuoeffnen. Jetzt: erst neu zeichnen, dann im Hintergrund nach Drive.
    const neuerPlan = {
      ...(currentPlan || {}),
      plattformen: PLATTFORMEN.map((pl) => pl.id).filter((id) => plCheckboxen[id]?.checked),
      typenmix: PLAN_TYPEN.map((t) => ({ typ: t.id, perWoche: freqGetters[t.id]() })),
      maxAbstandTage: getMaxAbstand(),
      kategorienFokus: INHALTSKATEGORIEN.map((k) => ({
        id: k.id, aktiv: katStatus[k.id](), prioritaet: katPrio[k.id](),
      })),
      zielgewichte: ZIELE.map((z) => ({ id: z.id, gewicht: zielGetters[z.id]() })),
      kampagnen: kampagnen.filter((k) => k.name.trim()),
    };

    // 1) Sofort: Vorschau mit den neuen Werten neu zeichnen.
    currentPlan = neuerPlan;
    nachSpeichern();
    setStand("Redaktionsplan gespeichert.");

    // 2) Im Hintergrund persistieren — die UI wartet nicht auf Drive.
    speichernBtn.disabled = true;
    speicherePlan(neuerPlan)
      .catch((e) => melde("befund", e.message))
      .finally(() => { speichernBtn.disabled = false; });
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
    `<div style="color:var(--fg2);margin-top:4px;font-size:11px">${slot.uhrzeit} · ${escape((slot.plattformen || []).join(", "))}</div>`;
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

function baueKalender(koerper) {
  sektionKopf("Kalender-Vorschau", koerper, "0 0 8px");

  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.style.marginBottom = "10px";
  hinweis.textContent = "Algorithmus-Ausgabe — nicht editierbar. Speichern aktualisiert die Vorschau.";
  koerper.appendChild(hinweis);

  const legende = document.createElement("div");
  legende.style.cssText = "display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;font-size:11px;color:var(--fg1)";
  for (const [typ, farbe] of Object.entries(TYP_FARBE)) {
    const item = document.createElement("span");
    item.style.cssText = "display:flex;align-items:center;gap:5px";
    const dot = document.createElement("span");
    dot.style.cssText = `width:9px;height:9px;border-radius:50%;background:${farbe};flex-shrink:0`;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(PLAN_TYP_NAME[typ] || contenttypName(typ)));
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

    const slots = slotsForMonth(plan, year, month);
    const byDay = {};
    for (const s of slots) {
      const d = parseInt(s.datum.slice(-2), 10);
      (byDay[d] || (byDay[d] = [])).push(s);
    }

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:2px";

    for (const n of ["Mo","Di","Mi","Do","Fr","Sa","So"]) {
      const th = document.createElement("div");
      th.style.cssText = "text-align:center;font-size:11px;font-weight:600;color:var(--fg2);padding:3px 0";
      th.textContent = n;
      grid.appendChild(th);
    }

    const leerVor = (new Date(year, month, 1).getDay() - 1 + 7) % 7;
    for (let i = 0; i < leerVor; i++) grid.appendChild(document.createElement("div"));

    const heuteStr = `${heute.getFullYear()}-${String(heute.getMonth()+1).padStart(2,"0")}-${String(heute.getDate()).padStart(2,"0")}`;
    const letzterTag = new Date(year, month + 1, 0).getDate();

    for (let tag = 1; tag <= letzterTag; tag++) {
      const tagStr = `${year}-${String(month+1).padStart(2,"0")}-${String(tag).padStart(2,"0")}`;
      const istHeute = tagStr === heuteStr;
      const zelle = document.createElement("div");
      zelle.style.cssText = [
        "min-height:52px;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg1)",
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
          const p = document.createElement("span");
          p.style.cssText = `width:10px;height:10px;border-radius:50%;background:${TYP_FARBE[slot.typ]||"#888"};flex-shrink:0;display:inline-block;cursor:default`;
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
  return rendere;
}

// ── UI-Bausteine ──────────────────────────────────────────────────────────

function sektionKopf(titel, container, margin = "12px 0 8px") {
  const h = document.createElement("h4");
  h.style.cssText = `font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--fg2);margin:${margin}`;
  h.textContent = titel;
  container.appendChild(h);
}

// Frequenz-Zeile: Slider 0–5/Woche (Schritt 0,25) + Zahlenfeld
function frequenzZeile(label, farbe, initWert, onInput) {
  let value = initWert;
  const zeile = document.createElement("div");
  zeile.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:7px";

  const dot = document.createElement("span");
  dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${farbe};flex-shrink:0`;

  const nameEl = document.createElement("span");
  nameEl.style.cssText = "width:130px;flex-shrink:0;font-size:13px;color:var(--fg1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
  nameEl.textContent = label;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "5";
  slider.step = "0.25";
  slider.value = value;
  slider.style.cssText = `width:160px;flex-shrink:0;cursor:pointer;accent-color:${farbe}`;

  const zahlInp = document.createElement("input");
  zahlInp.type = "number";
  zahlInp.min = "0";
  zahlInp.max = "7";
  zahlInp.step = "0.25";
  zahlInp.value = value;
  zahlInp.style.cssText = "width:56px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg1);color:var(--fg1);font-size:13px;text-align:center;flex-shrink:0";

  const einheit = document.createElement("span");
  einheit.style.cssText = "font-size:12px;color:var(--fg2);white-space:nowrap;flex-shrink:0";
  einheit.textContent = "/ Wo";

  slider.addEventListener("input", () => {
    value = parseFloat(slider.value);
    zahlInp.value = value;
    onInput(value);
  });
  zahlInp.addEventListener("input", () => {
    value = Math.max(0, Math.min(7, parseFloat(zahlInp.value) || 0));
    slider.value = Math.min(5, value);
    onInput(value);
  });

  zeile.appendChild(dot);
  zeile.appendChild(nameEl);
  zeile.appendChild(slider);
  zeile.appendChild(zahlInp);
  zeile.appendChild(einheit);
  return { zeile, getValue: () => value };
}

function aktualisiereGesamt(el, werte) {
  const summe = werte.reduce((s, v) => s + v, 0);
  const gerundet = Math.round(summe * 100) / 100;
  el.textContent = `Gesamt: ${gerundet} Posts / Woche`;
}

// Prozent-Slider (fuer Zielgewichte)
function sliderZeile(label, farbe, initWert, min, max, onInput) {
  let value = initWert;
  const zeile = document.createElement("div");
  zeile.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:7px";

  const dot = document.createElement("span");
  dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${farbe};flex-shrink:0`;

  const nameEl = document.createElement("span");
  nameEl.style.cssText = "width:160px;flex-shrink:0;font-size:13px;color:var(--fg1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
  nameEl.textContent = label;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = "1";
  slider.value = value;
  slider.style.cssText = `width:160px;flex-shrink:0;cursor:pointer;accent-color:${farbe}`;

  const zahlInp = document.createElement("input");
  zahlInp.type = "number";
  zahlInp.min = String(min);
  zahlInp.max = String(max);
  zahlInp.step = "1";
  zahlInp.value = value;
  zahlInp.style.cssText = "width:52px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg1);color:var(--fg1);font-size:13px;text-align:center;flex-shrink:0";

  const einheit = document.createElement("span");
  einheit.style.cssText = "font-size:12px;color:var(--fg2);flex-shrink:0";
  einheit.textContent = "%";

  slider.addEventListener("input", () => {
    value = parseInt(slider.value, 10);
    zahlInp.value = value;
    onInput(value);
  });
  zahlInp.addEventListener("input", () => {
    value = Math.max(min, Math.min(max, parseInt(zahlInp.value, 10) || 0));
    slider.value = value;
    onInput(value);
  });

  zeile.appendChild(dot);
  zeile.appendChild(nameEl);
  zeile.appendChild(slider);
  zeile.appendChild(zahlInp);
  zeile.appendChild(einheit);
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

  const toggleWrap = document.createElement("label");
  toggleWrap.style.cssText = "position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;cursor:pointer";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = aktiv;
  cb.style.cssText = "opacity:0;width:0;height:0;position:absolute";
  const track = document.createElement("span");
  const thumb = document.createElement("span");
  thumb.className = "thumb";
  thumb.style.cssText = "position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform 0.15s;box-shadow:0 1px 3px rgba(0,0,0,0.25)";
  track.appendChild(thumb);

  function updateTrack() {
    track.style.cssText = `position:absolute;top:0;left:0;right:0;bottom:0;border-radius:20px;transition:background 0.15s;background:${aktiv ? "var(--akzent,#3b82f6)" : "var(--border)"}`;
    thumb.style.transform = `translateX(${aktiv ? 16 : 0}px)`;
  }
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
