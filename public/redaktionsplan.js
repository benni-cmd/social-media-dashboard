// Redaktionsplan: Strategie-Einstellungen und Upload-Slots.
// Geoeffnet durch den "Redaktionsplan"-Button im Board.

import {
  CONTENTTYPEN,
  INHALTSKATEGORIEN,
  ZIELE,
  MASSE,
  contenttypName,
  kategorieName,
  isoDatum,
  neueSlotId,
  zielInfo,
} from "/lib/pipeline.js";
import { kiStream, melde, setStand } from "./store.js";
import { escape, knopf, denkPanel } from "./ui.js";

let aktivesPanel = null;

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
    slots: [],
  };
}

// Oeffnet oder schliesst das Planungs-Panel an anker.
export async function zeigeRedaktionsplan(anker) {
  if (aktivesPanel && aktivesPanel.parentElement === anker) {
    aktivesPanel.remove();
    aktivesPanel = null;
    return;
  }
  if (aktivesPanel) aktivesPanel.remove();

  const plan = await ladePlan();
  const panel = bauePanel(plan, anker);
  aktivesPanel = panel;
  anker.insertBefore(panel, anker.firstChild);
}

function bauePanel(plan, anker) {
  const el = document.createElement("div");
  el.className = "gruppe";
  el.style.marginBottom = "12px";

  // Kopf
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

  baueEinstellungen(plan, koerper, anker);

  el.appendChild(koerper);
  return el;
}

function baueEinstellungen(plan, koerper, anker) {
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
    const wrapper = document.createElement("label");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px";
    wrapper.textContent = t.name;
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
    setStand("Redaktionsplan gespeichert.");
    speichernBtn.disabled = false;
  });
  koerper.appendChild(speichernBtn);

  // Trennlinie
  const hr = document.createElement("hr");
  hr.style.cssText = "margin:14px 0;border:none;border-top:1px solid var(--border)";
  koerper.appendChild(hr);

  // Slot-Abschnitt
  baueSlotAbschnitt(plan, koerper);
}

function baueSlotAbschnitt(plan, koerper) {
  const slotsEl = document.createElement("div");

  const slotsKopf = abschnitt("Upload-Slots");

  const erzeugBtn = knopf("Slots generieren (4 Wochen)", { art: "haupt", zeichen: "kalender" });
  erzeugBtn.addEventListener("click", async () => {
    erzeugBtn.disabled = true;
    const panel = denkPanel(slotsEl, "Die KI plant Upload-Slots fuer die naechsten 4 Wochen …");
    try {
      const aktuell = await ladePlan();
      const bereitsGeplant = (aktuell.slots || []).map((s) => `${s.datum} ${s.typ}`);
      const antwort = await kiStream(
        "plan",
        {
          wochen: 4,
          ab: isoDatum(new Date()),
          postsProWoche: aktuell.kadenz.postsProWoche,
          typenmix: aktuell.typenmix,
          kategorien: aktuell.kategorienFokus,
          zielgewichte: aktuell.zielgewichte,
          kampagnen: aktuell.kampagnen,
          geplant: bereitsGeplant,
        },
        (e) => { if (e.status) panel.status(e.status); }
      );
      panel.weg();

      const neueSlots = ((antwort.data && antwort.data.slots) || []).map((s) => ({
        ...s,
        id: neueSlotId(),
        karteId: null,
      }));
      if (!neueSlots.length) {
        await melde("hinweis", "Die KI hat keine Slots geliefert. Versuch es erneut.");
        return;
      }

      const neu = await ladePlan();
      const vorhandeneKeys = new Set((neu.slots || []).map((s) => `${s.datum}_${s.typ}`));
      const zugefuegt = neueSlots.filter((s) => !vorhandeneKeys.has(`${s.datum}_${s.typ}`));
      neu.slots = [...(neu.slots || []), ...zugefuegt].sort((a, b) => a.datum.localeCompare(b.datum));
      await speicherePlan(neu);
      setStand(`${zugefuegt.length} neue Upload-Slots geplant.`);
      renderSlotliste(neu.slots, slotsEl, slotlisteEl);
    } catch (e) {
      panel.weg();
      await melde("befund", e.message);
    } finally {
      erzeugBtn.disabled = false;
    }
  });
  slotsKopf.appendChild(erzeugBtn);
  slotsEl.appendChild(slotsKopf);

  const slotlisteEl = document.createElement("div");
  slotsEl.appendChild(slotlisteEl);
  renderSlotliste(plan.slots || [], slotsEl, slotlisteEl);

  koerper.appendChild(slotsEl);
}

function renderSlotliste(slots, container, listeEl) {
  listeEl.innerHTML = "";
  const offen = slots.filter((s) => !s.karteId);
  const belegt = slots.filter((s) => s.karteId);

  if (!slots.length) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = 'Noch keine Slots — klick "Slots generieren" um einen Zeitplan zu erstellen.';
    listeEl.appendChild(p);
    return;
  }

  const satz = document.createElement("p");
  satz.className = "feld-hinweis";
  satz.style.marginBottom = "8px";
  satz.textContent = `${offen.length} offen · ${belegt.length} belegt · ${slots.length} gesamt`;
  listeEl.appendChild(satz);

  for (const slot of slots) {
    const zeile = document.createElement("div");
    zeile.style.cssText = "display:flex;align-items:center;gap:6px;padding:3px 0;flex-wrap:wrap";

    const datum = new Date(slot.datum + "T00:00:00").toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    });
    const statusMarke = document.createElement("span");
    statusMarke.className = `chip chip-${slot.karteId ? "ok" : "hinweis"}`;
    statusMarke.style.cssText = "width:22px;justify-content:center;flex-shrink:0";
    statusMarke.textContent = slot.karteId ? "✓" : "○";
    zeile.appendChild(statusMarke);

    const datumEl = document.createElement("span");
    datumEl.style.cssText = "min-width:100px;font-size:13px";
    datumEl.textContent = `${datum} ${slot.uhrzeit || ""}`;
    zeile.appendChild(datumEl);

    const typMarke = document.createElement("span");
    typMarke.className = "marke";
    typMarke.textContent = contenttypName(slot.typ);
    zeile.appendChild(typMarke);

    const katMarke = document.createElement("span");
    katMarke.className = "marke";
    katMarke.textContent = kategorieName(slot.kategorie);
    zeile.appendChild(katMarke);

    const zielEl = document.createElement("span");
    zielEl.style.cssText = "font-size:11px;color:var(--fg2)";
    zielEl.textContent = zielInfo(slot.ziel).name || slot.ziel || "";
    zeile.appendChild(zielEl);

    if (!slot.karteId) {
      const del = knopf("×", { titel: "Slot entfernen" });
      del.style.marginLeft = "auto";
      del.addEventListener("click", async () => {
        const p = await ladePlan();
        p.slots = p.slots.filter((s) => s.id !== slot.id);
        await speicherePlan(p);
        renderSlotliste(p.slots, container, listeEl);
      });
      zeile.appendChild(del);
    }

    listeEl.appendChild(zeile);
  }
}

function abschnitt(titel) {
  const el = document.createElement("div");
  el.style.marginBottom = "14px";
  const h = document.createElement("h4");
  h.style.cssText = "font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--fg2);margin:0 0 7px";
  h.textContent = titel;
  el.appendChild(h);
  return el;
}
