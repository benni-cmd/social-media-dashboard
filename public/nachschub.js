// Nachschub: Ideen und Redaktionsplan von der KI.
//
// Der Unterschied zwischen einem Board und einer Maschine ist, dass die Maschine auch
// dann etwas zu tun hat, wenn gerade niemand eine Idee hatte. Zwei Handlungen:
//   Ideen   — neue Karten fuer eine Saeule, ohne zu wiederholen, was schon da ist.
//   Plan    — Termine fuer die naechsten Wochen, mindestens drei je Woche.

import {
  INHALTSKATEGORIEN, leereKarte, saeuleName, isoDatum, rueckwaertsplan, saeulenVerteilung, MASSE,
  contenttypName, kategorieName, contenttypFormat, zielInfo,
} from "/lib/pipeline.js";
import { slotsForMonth } from "/lib/scheduler.js";
import { S, kiStream, speichere, zeichne, melde, setStand } from "./store.js";
import { icon, statusChip, escape, knopf, denkPanel, meldung } from "./ui.js";

// --- Ideen ----------------------------------------------------------------

async function ladeOffeneSlots() {
  try {
    const res = await fetch("/api/plan");
    if (!res.ok) return [];
    const plan = await res.json();
    // Algorithmisch erzeugte Slots der naechsten zwei Monate
    const heute = new Date();
    const heuteISO = isoDatum(heute);
    const slots = [];
    for (let delta = 0; delta < 2; delta++) {
      const year = heute.getFullYear() + Math.floor((heute.getMonth() + delta) / 12);
      const month = (heute.getMonth() + delta) % 12;
      slots.push(...slotsForMonth(plan, year, month));
    }
    return slots.filter((s) => s.datum >= heuteISO);
  } catch {}
  return [];
}

// Einzelidee: genau eine Karte fuer den naechsten freien Slot.
export async function holeIdee(anker) {
  const panel = denkPanel(anker, "Die KI recherchiert eine Idee fuer den naechsten freien Slot …");
  panel.el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  try {
    const alleSlots = await ladeOffeneSlots();
    const belegteUploads = new Set(
      S.cards
        .filter((c) => c.column !== "verworfen" && (c.dates || {}).upload)
        .map((c) => c.dates.upload + "|" + (c.uploadTime || "")),
    );
    const slot = alleSlots.find((s) => !belegteUploads.has(s.datum + "|" + (s.uhrzeit || "")));
    if (!slot) {
      panel.weg();
      await melde("hinweis", "Kein offener Upload-Slot gefunden. Pruefe den Redaktionsplan.");
      return null;
    }

    const verteilung = saeulenVerteilung(S.cards.filter((c) => c.kategorie))
      .map((s) => `${s.name}: ${s.anzahl}`)
      .join(", ");
    const antwort = await kiStream(
      "ideen",
      {
        anzahl: 1,
        vorhandene: S.cards.filter((c) => c.column !== "verworfen").map((c) => c.title).filter(Boolean),
        verworfen: S.cards.filter((c) => c.column === "verworfen").map((c) => c.title).filter(Boolean),
        verteilung,
        kategorie: slot.kategorie || "",
        offeneSlots: [slot],
      },
      (e) => {
        if (e.delta) panel.delta(e.delta);
        if (e.status) panel.status(e.status);
      },
    );
    panel.weg();
    const ideen = (antwort.data && antwort.data.ideen) || [];
    if (!ideen.length) {
      await melde("hinweis", "Die KI hat keine verwertbare Idee geliefert. Versuch es noch einmal.");
      return null;
    }
    const idee = ideen[0];
    const k = leereKarte("idee");
    k.title = idee.titel || "Neue Idee";
    k.kategorie = INHALTSKATEGORIEN.some((s) => s.id === idee.saeule) ? idee.saeule : "";
    k.hook = { text: idee.hook || "", visual: idee.visuell || "" };
    k.notes = idee.warum || "";
    k.dates = { ...rueckwaertsplan(slot.datum), upload: slot.datum };
    k.uploadTime = slot.uhrzeit || "";
    k.contenttyp = slot.typ || "reel";
    if (slot.kategorie) k.kategorie = slot.kategorie;
    if (slot.ziel) k.goal = slot.ziel;
    if (slot.plattformen?.length) k.platforms = [...slot.plattformen];
    S.cards.push(k);
    speichere();
    zeichne();
    meldung(`Idee "${k.title}" als Karte angelegt.`, "erfolg");
    return k.id;
  } catch (e) {
    panel.weg();
    await melde("befund", (e.daten && e.daten.hint) || e.message);
    return null;
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
          k.kategorie = INHALTSKATEGORIEN.some((s) => s.id === idee.saeule) ? idee.saeule : "";
          k.hook = { text: idee.hook || "", visual: idee.visuell || "" };
          k.notes = idee.warum || "";

          // Slot-Daten vorbelegen wenn vorhanden
          const slot = idee.slotIndex != null ? offeneSlots[idee.slotIndex] : null;
          if (slot) {
            k.dates = { ...rueckwaertsplan(slot.datum), upload: slot.datum };
            k.uploadTime = slot.uhrzeit || "";
            k.contenttyp = slot.typ || "reel";
            if (slot.kategorie) k.kategorie = slot.kategorie;
            if (slot.ziel) k.goal = slot.ziel;
            if (slot.plattformen?.length) k.platforms = [...slot.plattformen];
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
          } catch {
            meldung("Slot konnte nicht belegt werden.", "fehler");
          }
        }

        meldung(
          `${n} ${n === 1 ? "Idee" : "Ideen"} als Karten angelegt` +
          (slotUpdates.length ? `, ${slotUpdates.length} Slot${slotUpdates.length > 1 ? "s" : ""} belegt` : "") +
          ".",
          "erfolg"
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
            k.kategorie = INHALTSKATEGORIEN.some((s) => s.id === e.saeule) ? e.saeule : "";
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
