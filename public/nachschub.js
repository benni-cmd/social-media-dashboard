// Nachschub: Ideen und Redaktionsplan von der KI.
//
// Der Unterschied zwischen einem Board und einer Maschine ist, dass die Maschine auch
// dann etwas zu tun hat, wenn gerade niemand eine Idee hatte. Zwei Handlungen:
//   Ideen   — neue Karten fuer eine Saeule, ohne zu wiederholen, was schon da ist.
//   Plan    — Termine fuer die naechsten Wochen, mindestens drei je Woche.

import {
  SAEULEN, leereKarte, saeuleName, isoDatum, rueckwaertsplan, saeulenVerteilung, MASSE,
  contenttypName, kategorieName, contenttypFormat,
} from "/lib/pipeline.js";
import { zielInfo } from "/lib/pipeline.js";
import { S, kiStream, speichere, zeichne, melde, setStand } from "./store.js";
import { icon, statusChip, escape, knopf, denkPanel } from "./ui.js";

// --- Ideen ----------------------------------------------------------------

async function ladeOffeneSlots() {
  try {
    const res = await fetch("/api/plan");
    if (res.ok) {
      const plan = await res.json();
      return (plan.slots || []).filter((s) => !s.karteId);
    }
  } catch {}
  return [];
}

export async function holeIdeen(anker) {
  const panel = denkPanel(anker, "Die KI sucht Ideen, die noch nicht da sind …");
  try {
    const offeneSlots = await ladeOffeneSlots();
    const verteilung = saeulenVerteilung(S.cards.filter((c) => c.pillar))
      .map((s) => `${s.name}: ${s.anzahl}`)
      .join(", ");
    const antwort = await kiStream(
      "ideen",
      {
        anzahl: 6,
        vorhandene: S.cards.filter((c) => c.column !== "verworfen").map((c) => c.title).filter(Boolean),
        verworfen: S.cards.filter((c) => c.column === "verworfen").map((c) => c.title).filter(Boolean),
        verteilung,
        pillar: "",
        offeneSlots: offeneSlots.slice(0, 12),
      },
      (e) => {
        if (e.delta) panel.delta(e.delta);
        if (e.status) panel.status(e.status);
      }
    );
    panel.weg();
    const ideen = (antwort.data && antwort.data.ideen) || [];
    if (!ideen.length) {
      await melde("hinweis", "Die KI hat keine verwertbare Liste geliefert. Versuch es noch einmal.");
      return;
    }
    zeigeIdeen(ideen, anker, offeneSlots);
  } catch (e) {
    panel.weg();
    await melde("befund", (e.daten && e.daten.hint) || e.message);
  }
}

// Vorschlaege erst zeigen, dann uebernehmen — nicht ungefragt sechs Karten anlegen.
function zeigeIdeen(ideen, anker, offeneSlots = []) {
  const box = document.createElement("div");
  box.className = "gruppe";
  box.style.marginTop = "9px";
  box.innerHTML = `<div class="gruppe-kopf"><span class="gruppe-titel">Vorschlaege</span><span class="gruppe-anzahl">${ideen.length}</span></div>`;

  const gewaehlt = new Set(ideen.map((_, i) => i));
  const liste = document.createElement("div");
  liste.className = "wahl";
  ideen.forEach((idee, i) => {
    const l = document.createElement("label");
    l.className = "wahl-option gewaehlt";

    // Slot-Empfehlung der KI anzeigen
    const slot = idee.slotIndex != null ? offeneSlots[idee.slotIndex] : null;
    const slotHinweis = slot
      ? `<span style="font-size:11px;color:var(--fg2);display:block;margin-top:3px">` +
        `${new Date(slot.datum + "T00:00:00").toLocaleDateString("de-DE")} ${slot.uhrzeit || ""} · ` +
        `${contenttypName(slot.typ)} · ${kategorieName(slot.kategorie)}</span>`
      : "";

    l.innerHTML =
      `<span class="wahl-text"><span class="wahl-titel">${escape(idee.titel || "(ohne Titel)")}</span>` +
      `${escape(idee.warum || "")}<br><em>Hook: ${escape(idee.hook || "—")}</em>${slotHinweis}</span>`;
    l.addEventListener("click", (e) => {
      e.preventDefault();
      if (gewaehlt.has(i)) gewaehlt.delete(i);
      else gewaehlt.add(i);
      l.classList.toggle("gewaehlt", gewaehlt.has(i));
    });
    liste.appendChild(l);
  });
  box.appendChild(liste);

  const reihe = document.createElement("div");
  reihe.className = "knopfreihe";
  reihe.style.padding = "0 11px 11px";
  reihe.appendChild(
    knopf("Ausgewaehlte als Karten anlegen", {
      art: "haupt",
      zeichen: "plus",
      klick: async () => {
        let n = 0;
        const slotUpdates = [];
        for (const i of gewaehlt) {
          const idee = ideen[i];
          const k = leereKarte("idee");
          k.title = idee.titel || "Neue Idee";
          k.pillar = SAEULEN.some((s) => s.id === idee.saeule) ? idee.saeule : "";
          k.hook = { text: idee.hook || "", visual: idee.visuell || "" };
          k.notes = idee.warum || "";

          // Slot-Daten vorbelegen wenn vorhanden
          const slot = idee.slotIndex != null ? offeneSlots[idee.slotIndex] : null;
          if (slot) {
            k.dates = { ...rueckwaertsplan(slot.datum), upload: slot.datum };
            k.uploadTime = slot.uhrzeit || "";
            k.format = contenttypFormat(slot.typ);
            if (slot.ziel) k.goal = slot.ziel;
            slotUpdates.push({ slotId: slot.id, karteId: k.id });
          }

          S.cards.push(k);
          n++;
        }
        speichere();
        zeichne();

        // Slots als belegt markieren
        if (slotUpdates.length) {
          try {
            const planRes = await fetch("/api/plan");
            if (planRes.ok) {
              const plan = await planRes.json();
              for (const upd of slotUpdates) {
                const s = plan.slots.find((sl) => sl.id === upd.slotId);
                if (s) s.karteId = upd.karteId;
              }
              await fetch("/api/plan", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(plan),
              });
            }
          } catch { /* Slot-Update ist Beiwerk */ }
        }

        setStand(
          `${n} Ideen als Karten angelegt` +
          (slotUpdates.length ? `, ${slotUpdates.length} Slot${slotUpdates.length > 1 ? "s" : ""} belegt` : "") +
          "."
        );
      },
    })
  );
  reihe.appendChild(knopf("Verwerfen", { klick: () => box.remove() }));
  box.appendChild(reihe);
  anker.appendChild(box);
}

// --- Redaktionsplan (jetzt in redaktionsplan.js) --------------------------
// holePlan ist ersetzt durch zeigeRedaktionsplan aus redaktionsplan.js.

async function holePlan(anker) {
  const panel = denkPanel(anker, "Die KI baut einen Redaktionsplan fuer die naechsten Wochen …");
  try {
    const geplant = S.cards
      .filter((c) => (c.dates || {}).upload)
      .map((c) => `${c.title} am ${c.dates.upload}`);
    const vorrat = S.cards.filter((c) => c.column === "idee" && !(c.dates || {}).upload).map((c) => c.title);
    const antwort = await kiStream(
      "plan",
      { wochen: 4, ab: isoDatum(new Date()), geplant, vorrat },
      (e) => {
        if (e.delta) panel.delta(e.delta);
        if (e.status) panel.status(e.status);
      }
    );
    panel.weg();
    const plan = (antwort.data && antwort.data.vorschlag) || [];
    if (!plan.length) {
      await melde("hinweis", "Die KI hat keinen verwertbaren Plan geliefert. Versuch es noch einmal.");
      return;
    }
    zeigePlan(plan, antwort.data.hinweis || "", anker);
  } catch (e) {
    panel.weg();
    await melde("befund", (e.daten && e.daten.hint) || e.message);
  }
}

function zeigePlan(plan, hinweis, anker) {
  const box = document.createElement("div");
  box.className = "gruppe";
  box.style.marginTop = "9px";
  box.innerHTML =
    `<div class="gruppe-kopf"><span class="gruppe-titel">Redaktionsplan-Vorschlag</span>` +
    `<span class="gruppe-anzahl">${plan.length}</span></div>`;

  if (hinweis) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.style.padding = "0 11px";
    p.textContent = hinweis;
    box.appendChild(p);
  }

  const liste = document.createElement("ul");
  liste.className = "befundliste";
  liste.style.padding = "0 11px";
  for (const e of plan) {
    const vorhanden = S.cards.find((c) => c.title === e.titel);
    const li = document.createElement("li");
    li.className = "befund";
    li.innerHTML =
      statusChip(vorhanden ? "ok" : "hinweis") +
      `<span class="befund-satz">${escape(
        `${new Date(e.datum + "T00:00:00").toLocaleDateString("de-DE")}: "${e.titel}" — ${
          e.begruendung || saeuleName(e.saeule || "")
        }${vorhanden ? "" : " (Karte gibt es noch nicht, sie wird angelegt)"}`
      )}</span>`;
    liste.appendChild(li);
  }
  box.appendChild(liste);

  const reihe = document.createElement("div");
  reihe.className = "knopfreihe";
  reihe.style.padding = "11px";
  reihe.appendChild(
    knopf("Plan uebernehmen", {
      art: "haupt",
      zeichen: "kalender",
      klick: () => {
        let neu = 0;
        let gesetzt = 0;
        for (const e of plan) {
          if (!e.datum) continue;
          let k = S.cards.find((c) => c.title === e.titel);
          if (!k) {
            k = leereKarte("idee");
            k.title = e.titel || "Neue Idee";
            k.pillar = SAEULEN.some((s) => s.id === e.saeule) ? e.saeule : "";
            if (e.ziel) k.goal = e.ziel;
            S.cards.push(k);
            neu++;
          }
          // Der Rueckwaertsplan setzt die uebrigen Termine gleich mit.
          k.dates = { ...rueckwaertsplan(e.datum), upload: e.datum };
          gesetzt++;
        }
        speichere();
        zeichne();
        setStand(
          `${gesetzt} Veroeffentlichungen terminiert, davon ${neu} als neue Karten. Mindestens ${MASSE.postsProWocheMin} je Woche sind das Ziel.`
        );
      },
    })
  );
  reihe.appendChild(knopf("Verwerfen", { klick: () => box.remove() }));
  box.appendChild(reihe);
  anker.appendChild(box);
}

export { icon };
