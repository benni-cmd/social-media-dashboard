// Nachschub: Ideen und Redaktionsplan von der KI.
//
// Der Unterschied zwischen einem Board und einer Maschine ist, dass die Maschine auch
// dann etwas zu tun hat, wenn gerade niemand eine Idee hatte. Zwei Handlungen:
//   Ideen   — neue Karten fuer eine Saeule, ohne zu wiederholen, was schon da ist.
//   Plan    — Termine fuer die naechsten Wochen, mindestens drei je Woche.

import {
  INHALTSKATEGORIEN, leereKarte, saeuleName, isoDatum, saeulenVerteilung, MASSE,
  contenttypName, kategorieName, contenttypFormat, zielInfo,
} from "/lib/pipeline.js";
import { naechsterFreierUpload, planSlots, slotTyp, fruehesterUploadFuer } from "/lib/uploadslots.js";
import { S, kiStream, speichere, zeichne, melde, setStand, driveAnlegen, optimistisch, terminplan, schwebendeNeuBerechnen, vorbelegeKarte } from "./store.js";
import { icon, statusChip, escape, knopf, denkPanel, meldung, sanduhr } from "./ui.js";

// --- Ideen ----------------------------------------------------------------

// v89: der naechste freie, machbare Slot beliebigen Formats (die Idee uebernimmt das Format des
// Slots) — dieselbe Regel wie Kachel, Kontextmenue und schwebende Karten (lib/uploadslots.js).
async function naechsterOffenerSlot() {
  try {
    const res = await fetch("/api/plan");
    if (!res.ok) return null;
    const plan = await res.json();
    return naechsterFreierUpload({ plan, cards: S.cards, drehtermine: S.drehtermine, monate: 2 }).slot;
  } catch {}
  return null;
}

// v107: Termin-Vorlage fuer ein Anlass-Projekt. Upload ist der Anlass-Tag selbst (Owner 05.10.2026:
// rechtzeitig produzieren, am Tag hochladen); Uhrzeit und Plattformen kommen vom Plan-Slot desselben
// Formats (am selben Tag, sonst der naechste), das Ziel aus der Kampagnen-Tabelle, sonst vom Slot.
function anlassSlot(a) {
  const typ = a.format || "reel";
  const slots = S.plan ? planSlots(S.plan, 3).filter((s) => s.typ === slotTyp(typ)) : [];
  const v = slots.find((s) => s.datum === a.datum) || slots[0] || null;
  return {
    datum: a.datum, typ, uhrzeit: (v && v.uhrzeit) || "", plattformen: (v && v.plattformen) || [],
    ziel: a.ziel || (v && v.ziel) || "", kategorie: (v && v.kategorie) || "",
  };
}
const deDatum = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("de-DE");

// Ideen-Swipe (v17c): ein mittiges Popup zeigt EINE KI-Idee als Karte (Titel + 2–3 Saetze).
// Links = andere Idee (die abgelehnte fliesst in den Prompt, damit die KI nicht wiederholt),
// rechts = uebernehmen: erst DANN entsteht eine Karte UND der Drive-Ordner. Nichts landet
// ungefragt in Drive. Gibt die id der uebernommenen Karte zurueck (oder null bei Abbruch),
// damit der Aufrufer sie oeffnen kann — dieselbe Signatur wie vorher.
// v107: `opts.anlass` (aus /api/kampagnen/anstehend) macht daraus die Anlass-Variante: KI-Aufgabe
// anlass_ideen (mit Websuche, drei Vorschlaege je Aufruf), Upload fest am Anlass-Tag, Karte mit Anlass.
export async function holeIdee(opts = {}) {
  const anlass = opts.anlass || null;
  // Ein freier Redaktionsplan-Slot ist ein Bonus (belegt das Upload-Datum vor), aber KEINE
  // Voraussetzung: ohne Slot entsteht eine reine Idee-Karte ohne Termin (spaeter planbar).
  const slot = anlass ? anlassSlot(anlass) : await naechsterOffenerSlot();
  // Anlass: frueheste machbare Fertigstellung — liegt sie nach dem Anlass, sagt der Vorschlag es.
  const zuKnapp = anlass && fruehesterUploadFuer(slotTyp(slot.typ), S.drehtermine || []) > anlass.datum
    ? fruehesterUploadFuer(slotTyp(slot.typ), S.drehtermine || []) : null;
  const vorrat = []; // Anlass: die KI liefert drei Ideen auf einmal, "Andere Idee" zeigt die naechste

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
      if (vorrat.length) { aktuelleIdee = vorrat.shift(); zeigeIdee(aktuelleIdee); return; }
      laeuft = true;
      // Live-Denk-Konsole (v32 D): drehende Sanduhr + der echte Textstrom der KI, statt eines
      // statischen „… recherchiert" das sich anfuehlt, als passiere nichts. denkPanel bringt die
      // Sanduhr im Kopf und streamt die Deltas in ein konsolenartiges Fenster.
      box.innerHTML = "";
      const panel = denkPanel(box, anlass ? `Die KI sucht aktuelle Ideen zum ${anlass.anlass} …` : "Die KI recherchiert eine Idee …");
      const verteilung = saeulenVerteilung(S.cards.filter((c) => c.kategorie))
        .map((s) => `${s.name}: ${s.anzahl}`)
        .join(", ");
      try {
        const vorhandene = S.cards.filter((c) => c.column !== "verworfen").map((c) => c.title).filter(Boolean);
        const verworfen = [
          ...S.cards.filter((c) => c.column === "verworfen").map((c) => c.title).filter(Boolean),
          ...abgelehnt,
        ];
        const antwort = await kiStream(
          anlass ? "anlass_ideen" : "ideen",
          anlass ? {
            // title = Suchanfrage der Websuche (Server: Titel + Reihe)
            title: `${anlass.anlass} ${anlass.datum.slice(0, 4)}`,
            anzahl: 3, anlass: anlass.anlass, datum: anlass.datum, kampagne: anlass.kampagne,
            themen: anlass.themen, ziel: slot.ziel, zielgruppe: anlass.zielgruppe, format: slot.typ,
            vorhandene, verworfen,
          } : {
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
        vorrat.push(...ideen.slice(1));
        zeigeIdee(aktuelleIdee);
      } catch (e) {
        laeuft = false;
        zeigeFehler((e.daten && e.daten.hint) || e.message);
      }
    }

    function zeigeIdee(idee) {
      const katId = INHALTSKATEGORIEN.some((s) => s.id === idee.saeule) ? idee.saeule : (slot && slot.kategorie);
      const typName = contenttypName((slot && slot.typ) || "reel");
      const marke = (katId ? `${kategorieName(katId)} · ${typName}` : typName) +
        (anlass ? ` · Upload am ${deDatum(anlass.datum)}` : "");
      const kopf = anlass ? `Idee zum ${anlass.anlass} am ${deDatum(anlass.datum)}` : "Neue Idee";
      // P2 (v37): system-eigene Tokens (--linie-hell/--flaeche-hoch) statt erfundener
      // --rand/--flaeche2 (die immer auf dunkle Fallbacks fielen, im Hellmodus falsch) und
      // ohne die redundante „← andere Idee · übernehmen →"-Zeile — die Knoepfe sagen das schon.
      box.innerHTML =
        `<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);margin-bottom:10px">${escape(kopf)}</div>` +
        `<div style="border:1px solid var(--linie-hell);border-radius:12px;padding:18px 16px;text-align:left;background:var(--flaeche-hoch)">` +
          `<div style="font-size:20px;font-weight:700;line-height:1.25;margin-bottom:6px">${escape(idee.titel || "(ohne Titel)")}</div>` +
          `<div style="font-size:12px;color:var(--fg2);margin-bottom:10px">${escape(marke)}</div>` +
          `<p style="margin:0;line-height:1.5">${escape(idee.warum || "")}</p>` +
          (idee.hook ? `<p style="margin:10px 0 0;color:var(--fg2);font-size:13px"><em>Hook: ${escape(idee.hook)}</em></p>` : "") +
          (anlass && idee.bezug ? `<p style="margin:10px 0 0;font-size:13px">Aktueller Bezug: ${escape(idee.bezug)}</p>` : "") +
          (anlass && idee.zielgruppe ? `<p style="margin:6px 0 0;color:var(--fg2);font-size:13px">Zielgruppe: ${escape(idee.zielgruppe)}</p>` : "") +
        `</div>` +
        (zuKnapp ? `<p class="feld-hinweis" style="text-align:left;margin:10px 0 0">${statusChip("hinweis")} Knapp: Ein ${escape(typName)} ist frühestens am ${deDatum(zuKnapp)} fertig, der Anlass ist am ${deDatum(anlass.datum)}. Ein anderes Format (z. B. Slider) geht schneller.</p>` : "");
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
      k.notes = anlass
        ? [idee.warum, idee.bezug && `Aktueller Bezug: ${idee.bezug}`, (idee.zielgruppe || anlass.zielgruppe) && `Zielgruppe: ${idee.zielgruppe || anlass.zielgruppe}`]
            .filter(Boolean).join("\n\n")
        : idee.warum || "";
      if (anlass) k.anlass = { schluessel: anlass.schluessel, name: anlass.anlass, datum: anlass.datum, kampagne: anlass.kampagne };
      k.contenttyp = (slot && slot.typ) || "reel";
      k.kategorie = INHALTSKATEGORIEN.some((s) => s.id === idee.saeule) ? idee.saeule : (slot && slot.kategorie) || "";
      if (slot) {
        k.dates = { ...terminplan(slot.datum), upload: slot.datum };
        k.uploadTime = slot.uhrzeit || "";
        if (slot.ziel) k.goal = slot.ziel;
        // v113 (N2, Owner 07.10.2026): Anlass-Karten nehmen die Plattformen aus der Kampagnen-Tabelle (Spalte
        // „Plattformen"), leer = Vorbelegung — nicht den Plan-Slot. Andere Ideen behalten die Slot-Plattformen.
        if (!anlass && slot.plattformen?.length) k.platforms = [...slot.plattformen];
      }
      vorbelegeKarte(k, { plattformen: anlass ? anlass.plattformen : null }); // fuellt nur, was noch leer ist
      S.cards.push(k);
      zeichne();
      await speichere();
      // Der neue Slot kann eine schwebende Karte verdraengt haben (v30) — neu rechnen.
      if (slot) { await schwebendeNeuBerechnen(); zeichne(); }
      // Optimistisch (v55): die Karte ist da, der Dialog geht SOFORT zu — der Drive-Ordner entsteht
      // im Hintergrund (erst beim Uebernehmen: Ordner + (AI only)/projekt.json). Fehlschlag ist
      // sichtbar + wiederholbar; board.json fuehrt, der Abgleich heilt einen fehlenden Ordner.
      schliesse(k.id);
      if (k.title) optimistisch({
        extern: () => driveAnlegen(k),
        sichern: null,
        was: `Projektordner fuer „${k.title}"`,
        beiErfolg: () => meldung(`Drive-Ordner fuer „${k.title}" angelegt.`, "erfolg"),
      });
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
          vorbelegeKarte(k); // v113 (N2): fuellt nur, was der Slot offen liess

          S.cards.push(k);
          n++;
        }
        speichere();
        zeichne();

        // v113 (N6): Ein Slot gilt als belegt, sobald eine Karte sein Datum als Upload traegt (uploadslots.js
        // belegteTermine). Das fruehere „Slots als belegt markieren" suchte Slots in der Plan-Konfiguration, wo seit
        // v52 keine mehr liegen, fand nichts und schrieb trotzdem den ganzen Plan zurueck — entfernt.
        if (slotUpdates.length) {
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
            vorbelegeKarte(k); // v113 (N2)
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
