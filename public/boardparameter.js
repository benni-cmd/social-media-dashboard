// Einstellungs-Tab „Kategorien & Ziele" (v78, Name seit v99): Inhaltskategorien und Ziele verwalten.
//
// Wahrheit ist der Drive-Store (server: GET/PUT /api/boardparameter, lib/boardparamstore.js).
// Hier nur die Verwaltung der LISTEN (Name/Beschreibung/Aktiv/Prioritaet bzw. Kennzahl); die
// prozentuale Verteilung bleibt im Redaktionsplan. „Entfernen" = deaktivieren (aktiv=false):
// der Eintrag bleibt erhalten, damit bestehende Karten ihre Zuordnung behalten (Owner 28.09.2026).

import { setzeBoardparameter } from "/lib/pipeline.js";
import { S, zeichne } from "./store.js";

const nid = (p) => p + Math.random().toString(36).slice(2, 8);

async function ladeParameter() {
  const r = await fetch("/api/boardparameter");
  if (!r.ok) throw new Error("Board-Parameter laden fehlgeschlagen (" + r.status + ")");
  return r.json();
}

async function speichereParameter(stand) {
  const r = await fetch("/api/boardparameter", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(stand),
  });
  if (!r.ok) throw new Error("Speichern fehlgeschlagen (" + r.status + ")");
  return r.json();
}

// Eine editierbare Zeile. `felder` beschreibt die Text-/Zahlenfelder; jede Zeile hat Aktiv-Toggle
// und „entfernen"=deaktivieren. Rueckgabe: { el, lies() } — lies() liefert das aktuelle Objekt.
function baueZeile(felder, daten) {
  const zeile = document.createElement("div");
  zeile.className = "bp-zeile";
  zeile.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px;border:1px solid var(--rand,#3a3a3a);" +
    "border-radius:8px;margin-bottom:8px;background:var(--flaeche2,rgba(255,255,255,.02))";

  const getter = {};
  for (const f of felder) {
    const inp = document.createElement("input");
    inp.type = f.typ === "zahl" ? "number" : "text";
    if (f.typ === "zahl") { inp.min = "0"; inp.step = "1"; }
    inp.placeholder = f.platz || f.label;
    inp.value = daten[f.key] != null ? String(daten[f.key]) : "";
    inp.title = f.label;
    inp.style.cssText = `padding:5px 7px;font-size:13px;flex:${f.flex || 1};min-width:${f.min || 90}px`;
    zeile.appendChild(inp);
    getter[f.key] = () => (f.typ === "zahl" ? Number(inp.value) || 0 : inp.value.trim());
  }

  const aktivLabel = document.createElement("label");
  aktivLabel.style.cssText = "display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;user-select:none";
  const aktivBox = document.createElement("input");
  aktivBox.type = "checkbox";
  aktivBox.checked = daten.aktiv !== false;
  aktivBox.style.cssText = "width:15px;height:15px;cursor:pointer;accent-color:var(--akzent,#3b82f6)";
  aktivLabel.appendChild(aktivBox);
  aktivLabel.appendChild(document.createTextNode("Aktiv"));
  zeile.appendChild(aktivLabel);

  const markiere = () => { zeile.style.opacity = aktivBox.checked ? "1" : "0.5"; };
  aktivBox.addEventListener("change", markiere);
  markiere();

  const entf = document.createElement("button");
  entf.type = "button";
  entf.textContent = "entfernen";
  entf.title = "Deaktivieren — der Eintrag bleibt erhalten, bestehende Karten behalten ihre Zuordnung";
  entf.style.cssText = "padding:5px 9px;font-size:12px;cursor:pointer";
  entf.addEventListener("click", () => {
    if (zeile.dataset.neu === "1") { zeile.remove(); return; } // nie gespeichert -> ganz weg
    aktivBox.checked = false;
    markiere();
  });
  zeile.appendChild(entf);

  return {
    el: zeile,
    lies: () => {
      const o = { id: daten.id, aktiv: aktivBox.checked };
      for (const f of felder) o[f.key] = getter[f.key]();
      return o;
    },
  };
}

function baueBlock(container, titelText, felder, eintraege, neuText, neuVorlage) {
  const titel = document.createElement("div");
  titel.className = "einst-titel";
  titel.style.cssText = "margin-top:14px";
  titel.textContent = titelText;
  container.appendChild(titel);

  const liste = document.createElement("div");
  container.appendChild(liste);

  const zeilen = [];
  const anhaengen = (daten, neu) => {
    const z = baueZeile(felder, daten);
    if (neu) z.el.dataset.neu = "1";
    liste.appendChild(z.el);
    zeilen.push(z);
    return z;
  };
  for (const e of eintraege) anhaengen(e, false);

  const neuBtn = document.createElement("button");
  neuBtn.type = "button";
  neuBtn.textContent = neuText;
  neuBtn.style.cssText = "padding:6px 12px;font-size:13px;cursor:pointer;margin-top:2px";
  neuBtn.addEventListener("click", () => anhaengen(neuVorlage(), true));
  container.appendChild(neuBtn);

  return () => zeilen.filter((z) => z.el.isConnected).map((z) => z.lies()).filter((o) => o.name);
}

export async function zeichneBoardparameter(container) {
  container.textContent = "";

  const titel = document.createElement("div");
  titel.className = "einst-titel";
  titel.textContent = "Kategorien & Ziele";
  container.appendChild(titel);

  const hint = document.createElement("p");
  hint.className = "einst-provider-sub";
  hint.textContent =
    "Inhaltskategorien und Ziele verwalten. Die prozentuale Verteilung bleibt im Redaktionsplan. " +
    "Entfernen deaktiviert nur — bestehende Karten behalten ihre Zuordnung.";
  container.appendChild(hint);

  const stand = document.createElement("p");
  stand.className = "einst-provider-sub";
  stand.style.minHeight = "16px";
  const setStand = (t) => { stand.textContent = t; };

  let daten;
  try {
    daten = await ladeParameter();
  } catch (e) {
    container.appendChild(Object.assign(document.createElement("p"), { textContent: e.message, style: "color:#e66" }));
    return;
  }

  const katFelder = [
    { key: "name", label: "Name", platz: "Kategorie-Name", flex: 2, min: 120 },
    { key: "satz", label: "Beschreibung", platz: "kurze Beschreibung", flex: 3, min: 160 },
    { key: "prioritaet", label: "Priorität", platz: "Prio", typ: "zahl", flex: 0, min: 70 },
  ];
  const zielFelder = [
    { key: "name", label: "Name", platz: "Ziel-Name", flex: 2, min: 120 },
    { key: "kennzahl", label: "Kennzahl", platz: "Kennzahl", flex: 2, min: 120 },
    { key: "satz", label: "Beschreibung", platz: "optional", flex: 3, min: 160 },
  ];

  const liesKat = baueBlock(
    container, "Inhaltskategorien", katFelder, daten.kategorien || [],
    "+ Kategorie", () => ({ id: nid("k_"), name: "", satz: "", aktiv: true, prioritaet: (daten.kategorien || []).length + 1 }),
  );
  const liesZiele = baueBlock(
    container, "Ziele", zielFelder, daten.ziele || [],
    "+ Ziel", () => ({ id: nid("z_"), name: "", kennzahl: "", satz: "", aktiv: true }),
  );

  const speichern = document.createElement("button");
  speichern.type = "button";
  speichern.textContent = "Speichern";
  speichern.style.cssText = "padding:7px 16px;font-size:13px;cursor:pointer;margin-top:14px;font-weight:600";
  speichern.addEventListener("click", async () => {
    // id kommt aus der Zeile selbst (baueZeile), Reihenfolge egal; Fallback nur bei fehlender id.
    const kategorien = liesKat().map((k) => ({ ...k, id: k.id || nid("k_") }));
    const ziele = liesZiele().map((z) => ({ ...z, id: z.id || nid("z_") }));
    speichern.disabled = true;
    setStand("Speichere …");
    try {
      const neu = await speichereParameter({ kategorien, ziele });
      // v78 Phase B: ab sofort Wahrheit fuer Board, Redaktionsplan und Karten-Auswahl.
      setzeBoardparameter(neu);
      S.boardparameter = neu;
      zeichne();
      setStand("Gespeichert.");
    } catch (e) {
      setStand(e.message);
    } finally {
      speichern.disabled = false;
    }
  });
  container.appendChild(speichern);
  container.appendChild(stand);
}
