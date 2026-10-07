// Einstellungs-Tab „Vorbelegungen" (v113, Owner 07.10.2026): womit eine NEUE Karte startet.
//
// Plattformen (Standard Instagram + LinkedIn, sichtbar angehakt), Format, Kategorie und Ziel. Ohne Wahl bleiben
// Format/Kategorie/Ziel leer wie bisher. Wahrheit ist der Drive-gestuetzte Defaults-Store (/api/defaults, Felder
// `plattformen` — derselbe Plattform-Standard, den „Neuen Standard speichern" an der Karte setzt — und
// `vorbelegung: { contenttyp, kategorie, goal }`). Angewendet in store.vorbelegeKarte(). Kampagnen-Anlaesse
// koennen je Zeile eigene Plattformen tragen (Spalte „Plattformen" der Kampagnen-Tabelle).

import { PLATTFORMEN, CONTENTTYPEN, aktiveKategorien, aktiveZiele, STANDARD_PLATTFORMEN } from "/lib/pipeline.js";
import { S, speichereDefaults } from "./store.js";

function auswahl(optionen, wert) {
  const sel = document.createElement("select");
  sel.style.cssText = "padding:5px 7px;font-size:13px;min-width:220px";
  for (const [id, name] of [["", "keine Vorbelegung"], ...optionen]) {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = name;
    if (id === (wert || "")) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

function zeile(label, hinweis, el) {
  const abschnitt = document.createElement("div");
  abschnitt.className = "einst-abschnitt";
  const l = document.createElement("div");
  l.className = "einst-label";
  l.textContent = label;
  abschnitt.appendChild(l);
  if (hinweis) {
    const p = document.createElement("p");
    p.className = "einst-provider-sub";
    p.textContent = hinweis;
    abschnitt.appendChild(p);
  }
  abschnitt.appendChild(el);
  return abschnitt;
}

export function zeichneVorbelegung(seite) {
  seite.innerHTML = "";
  const titel = document.createElement("div");
  titel.className = "einst-titel";
  titel.textContent = "Vorbelegungen";
  seite.appendChild(titel);
  const satz = document.createElement("p");
  satz.className = "einst-provider-sub";
  satz.textContent =
    "Womit eine neue Karte startet. Gilt für „Karte anlegen“ und für Ideen der KI, soweit Redaktionsplan oder Kampagne nichts anderes vorgeben. Bestehende Karten bleiben unverändert.";
  seite.appendChild(satz);

  // Plattformen: Schalter wie in der Karte
  const plAktiv = new Set(S.defaults.plattformen && S.defaults.plattformen.length ? S.defaults.plattformen : STANDARD_PLATTFORMEN);
  const plReihe = document.createElement("div");
  plReihe.className = "schalterreihe";
  const plInputs = [];
  for (const p of PLATTFORMEN) {
    const lab = document.createElement("label");
    lab.className = "schalter" + (plAktiv.has(p.id) ? " an" : "");
    lab.innerHTML = `<input type="checkbox" ${plAktiv.has(p.id) ? "checked" : ""}><span></span>`;
    lab.querySelector("span").textContent = p.name;
    const inp = lab.querySelector("input");
    inp.addEventListener("change", () => lab.classList.toggle("an", inp.checked));
    plInputs.push([p.id, inp]);
    plReihe.appendChild(lab);
  }
  seite.appendChild(zeile("Plattformen", "Mindestens eine. Kampagnen-Anlässe nehmen die Plattformen ihrer Tabellen-Zeile, wenn dort welche stehen.", plReihe));

  const v = S.defaults.vorbelegung || {};
  const typSel = auswahl(CONTENTTYPEN.map((t) => [t.id, t.name]), v.contenttyp);
  seite.appendChild(zeile("Format", "", typSel));
  const katSel = auswahl(aktiveKategorien().map((k) => [k.id, k.name]), v.kategorie);
  seite.appendChild(zeile("Kategorie", "Nur aktive Kategorien (Einstellungen → Kategorien & Ziele).", katSel));
  const zielSel = auswahl(aktiveZiele().map((z) => [z.id, z.name]), v.goal);
  seite.appendChild(zeile("Ziel", "Nur aktive Ziele.", zielSel));

  const fuss = document.createElement("div");
  fuss.className = "einst-ping-zeile";
  const speichern = document.createElement("button");
  speichern.className = "chip";
  speichern.textContent = "Speichern";
  const status = document.createElement("div");
  status.className = "einst-ping-status";
  fuss.append(speichern, status);
  seite.appendChild(fuss);

  speichern.addEventListener("click", async () => {
    const plattformen = plInputs.filter(([, i]) => i.checked).map(([id]) => id);
    if (!plattformen.length) {
      status.textContent = "❌ Mindestens eine Plattform wählen.";
      return;
    }
    speichern.disabled = true;
    status.textContent = "Speichere …";
    try {
      await speichereDefaults({ plattformen, vorbelegung: { contenttyp: typSel.value, kategorie: katSel.value, goal: zielSel.value } });
      status.textContent = "✅ Gespeichert — gilt für die nächste neue Karte.";
    } catch (e) {
      status.textContent = `❌ Speichern fehlgeschlagen: ${e.message}`;
    } finally {
      speichern.disabled = false;
    }
  });
}
