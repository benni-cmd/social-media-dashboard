// Nachschub: Ideen und Redaktionsplan von der KI.
//
// Der Unterschied zwischen einem Board und einer Maschine ist, dass die Maschine auch
// dann etwas zu tun hat, wenn gerade niemand eine Idee hatte. Zwei Handlungen:
//   Ideen   — neue Karten fuer eine Saeule, ohne zu wiederholen, was schon da ist.
//   Plan    — Termine fuer die naechsten Wochen, mindestens drei je Woche.

import {
  INHALTSKATEGORIEN, leereKarte, saeuleName, isoDatum, saeulenVerteilung, MASSE,
  contenttypName, kategorieName, contenttypFormat, zielInfo, naechsteFreieSlots, fruehesterUpload,
} from "/lib/pipeline.js";
import { slotsForMonth } from "/lib/scheduler.js";
import { S, kiStream, speichere, zeichne, melde, setStand, driveAnlegen, terminplan, schwebendeNeuBerechnen } from "./store.js";
import { icon, statusChip, escape, knopf, denkPanel, meldung, sanduhr } from "./ui.js";

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
    // P4 (v37): nie ein Upload-Datum vor „naechster Drehtermin + 8 Tage" anbieten, sonst
    // landen Schnitt/Dreh in der Vergangenheit.
    const frueh = fruehesterUpload(S.drehtermine, heuteISO);
    return slots.filter((s) => s.datum >= frueh);
  } catch {}
  return [];
}

// Ideen-Swipe (v17c): ein mittiges Popup zeigt EINE KI-Idee als Karte (Titel + 2–3 Saetze).
// Links = andere Idee (die abgelehnte fliesst in den Prompt, damit die KI nicht wiederholt),
// rechts = uebernehmen: erst DANN entsteht eine Karte UND der Drive-Ordner. Nichts landet
// ungefragt in Drive. Gibt die id der uebernommenen Karte zurueck (oder null bei Abbruch),
// damit der Aufrufer sie oeffnen kann — dieselbe Signatur wie vorher.
export async function holeIdee() {
  const alleSlots = await ladeOffeneSlots();
  const belegteUploads = new Set(
    S.cards
      .filter((c) => c.column !== "verworfen" && (c.dates || {}).upload)
      .map((c) => c.dates.upload + "|" + (c.uploadTime || "")),
  );
  // Ein freier Redaktionsplan-Slot ist ein Bonus (belegt das Upload-Datum vor), aber KEINE
  // Voraussetzung: ohne Slot entsteht eine reine Idee-Karte ohne Termin (spaeter planbar).
  const slot = naechsteFreieSlots(alleSlots, belegteUploads, 1)[0] || null;

  return new Promise((resolve) => {
    const abgelehnt = []; // sitzungslokale Ablehnliste — verhindert Wiederholungen im Prompt
    let aktuelleIdee = null;
    let laeuft = false;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const box = document.createElement("div");
    box.className = "modal";
    box.style.maxWidth = "440px";
    box.style.width = "90%";
    box.style.textAlign = "center";
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const schliesse = (id = null) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(id);
    };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) schliesse(null); });
    function onKey(e) {
      if (laeuft) return;
      if (e.key === "Escape") schliesse(null);
      else if (e.key === "ArrowLeft") dislike();
      else if (e.key === "ArrowRight") like();
    }
    document.addEventListener("keydown", onKey);

    // P3 (v37): der Ladezustand traegt die drehende Sanduhr — derselbe Indikator wie ueberall
    // sonst, statt eines statischen Textes, der sich anfuehlt, als passiere nichts.
    const zeigeLaden = (text) => {
      box.innerHTML = "";
      const s = sanduhr(text);
      s.style.padding = "28px 10px";
      box.appendChild(s);
    };

    function zeigeFehler(satz) {
      box.innerHTML = `<div style="padding:28px 10px;color:var(--fg2)">${escape(satz)}</div>`;
      const r = document.createElement("div");
      r.className = "modal-knoepfe";
      r.appendChild(knopf("Nochmal", { art: "haupt", klick: () => naechste() }));
      r.appendChild(knopf("Schliessen", { klick: () => schliesse(null) }));
      box.appendChild(r);
    }

    async function naechste() {
      laeuft = true;
      // Live-Denk-Konsole (v32 D): drehende Sanduhr + der echte Textstrom der KI, statt eines
      // statischen „… recherchiert" das sich anfuehlt, als passiere nichts. denkPanel bringt die
      // Sanduhr im Kopf und streamt die Deltas in ein konsolenartiges Fenster.
      box.innerHTML = "";
      const panel = denkPanel(box, "Die KI recherchiert eine Idee …");
      const verteilung = saeulenVerteilung(S.cards.filter((c) => c.kategorie))
        .map((s) => `${s.name}: ${s.anzahl}`)
        .join(", ");
      try {
        const antwort = await kiStream(
          "ideen",
          {
            anzahl: 1,
            vorhandene: S.cards.filter((c) => c.column !== "verworfen").map((c) => c.title).filter(Boolean),
            verworfen: [
              ...S.cards.filter((c) => c.column === "verworfen").map((c) => c.title).filter(Boolean),
              ...abgelehnt,
            ],
            verteilung,
            kategorie: (slot && slot.kategorie) || "",
            offeneSlots: slot ? [slot] : [],
          },
          (e) => {
            if (e.delta) panel.delta(e.delta);
            if (e.status) panel.status(e.status);
            if (e.stufe) panel.stufe(e.stufe); // v51: echte Stufen statt nur Ueberschrift
          },
        );
        panel.weg();
        laeuft = false;
        const ideen = (antwort.data && antwort.data.ideen) || [];
        if (!ideen.length) { zeigeFehler("Die KI hat keine verwertbare Idee geliefert."); return; }
        aktuelleIdee = ideen[0];
        zeigeIdee(aktuelleIdee);
      } catch (e) {
        laeuft = false;
        zeigeFehler((e.daten && e.daten.hint) || e.message);
      }
    }

    function zeigeIdee(idee) {
      const katId = INHALTSKATEGORIEN.some((s) => s.id === idee.saeule) ? idee.saeule : (slot && slot.kategorie);
      const typName = contenttypName((slot && slot.typ) || "reel");
      const marke = katId ? `${kategorieName(katId)} · ${typName}` : typName;
      // P2 (v37): system-eigene Tokens (--linie-hell/--flaeche-hoch) statt erfundener
      // --rand/--flaeche2 (die immer auf dunkle Fallbacks fielen, im Hellmodus falsch) und
      // ohne die redundante „← andere Idee · übernehmen →"-Zeile — die Knoepfe sagen das schon.
      box.innerHTML =
        `<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);margin-bottom:10px">Neue Idee</div>` +
        `<div style="border:1px solid var(--linie-hell);border-radius:12px;padding:18px 16px;text-align:left;background:var(--flaeche-hoch)">` +
          `<div style="font-size:20px;font-weight:700;line-height:1.25;margin-bottom:6px">${escape(idee.titel || "(ohne Titel)")}</div>` +
          `<div style="font-size:12px;color:var(--fg2);margin-bottom:10px">${escape(marke)}</div>` +
          `<p style="margin:0;line-height:1.5">${escape(idee.warum || "")}</p>` +
          (idee.hook ? `<p style="margin:10px 0 0;color:var(--fg2);font-size:13px"><em>Hook: ${escape(idee.hook)}</em></p>` : "") +
        `</div>`;
      const r = document.createElement("div");
      r.className = "modal-knoepfe";
      r.appendChild(knopf("Andere Idee", { zeichen: "schliessen", klick: () => dislike() }));
      r.appendChild(knopf("Als Karte anlegen", { art: "haupt", zeichen: "plus", klick: () => like() }));
      box.appendChild(r);
    }

    function dislike() {
      if (laeuft || !aktuelleIdee) return;
      if (aktuelleIdee.titel) abgelehnt.push(aktuelleIdee.titel);
      naechste();
    }

    async function like() {
      if (laeuft || !aktuelleIdee) return;
      laeuft = true;
      const idee = aktuelleIdee;
      const k = leereKarte("idee");
      k.title = idee.titel || "Neue Idee";
      k.hook = { text: idee.hook || "", visual: idee.visuell || "" };
      k.notes = idee.warum || "";
      k.contenttyp = (slot && slot.typ) || "reel";
      k.kategorie = INHALTSKATEGORIEN.some((s) => s.id === idee.saeule) ? idee.saeule : (slot && slot.kategorie) || "";
      if (slot) {
        k.dates = { ...terminplan(slot.datum), upload: slot.datum };
        k.uploadTime = slot.uhrzeit || "";
        if (slot.ziel) k.goal = slot.ziel;
        if (slot.plattformen?.length) k.platforms = [...slot.plattformen];
      }
      S.cards.push(k);
      zeichne();
      zeigeLaden(`Lege „${k.title}" an und erstelle den Drive-Ordner …`);
      try {
        await speichere();
        // Der neue Slot kann eine schwebende Karte verdraengt haben (v30) — neu rechnen.
        if (slot) { await schwebendeNeuBerechnen(); zeichne(); }
        await driveAnlegen(k); // erst beim Uebernehmen: Drive-Ordner + (AI only)/projekt.json
        meldung(`Idee „${k.title}" als Karte und Drive-Ordner angelegt.`, "erfolg");
      } catch (e) {
        // board.json ist Cache: die Karte bleibt, nur der Drive-Ordner fehlt — der Abgleich heilt.
        meldung(`Karte angelegt, aber Drive-Ordner nicht: ${e.message}`, "fehler");
      }
      schliesse(k.id);
    }

    naechste();
  });
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
            k.dates = { ...terminplan(slot.datum), upload: slot.datum };
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
          // Die neu belegten Slots koennen schwebende Karten verdraengt haben (v30).
          await schwebendeNeuBerechnen();
          zeichne();
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
      klick: async () => {
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
          k.dates = { ...terminplan(e.datum), upload: e.datum };
          gesetzt++;
        }
        speichere();
        // Die frisch gesetzten Termine koennen schwebende Karten verdraengt haben (v30).
        if (gesetzt) await schwebendeNeuBerechnen();
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
