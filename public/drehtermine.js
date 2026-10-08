// Drehtermin-Leiste auf dem Board (v16b).
//
// Sie sitzt direkt unter der Wochenleiste und beantwortet: an welchen Tagen wird gedreht,
// und was steht an jedem Termin an. Die Kacheln laufen von links (naechster) nach rechts;
// ganz rechts legt der Plus-Knopf einen neuen Termin an. Die Zuordnung von Karten passiert
// aus der Karte heraus (Schritt „Drehtermin festlegen"), das Termin-Detail zeigt und loest.

import {
  S,
  drehtermin,
  drehterminAnlegen,
  drehterminAendern,
  drehterminLoeschen,
  karteVonTermin,
  karte,
  gcalStatus,
  gcalVerbinden,
  gcalSync,
  teilnehmerHinzufuegen,
  teilnehmerEntfernen,
  personen,
  personMerken,
  kontoMail,
} from "./store.js";
import { knopf, icon, escape, eingabe, feld, bestaetigen, meldung, modalX } from "./ui.js";
import { deutschesDatum, tageBis, isoDatum } from "/lib/pipeline.js";

let oeffneKarte = () => {};
export const beiOeffnen = (f) => (oeffneKarte = f);

// Google-Verbindungsstand, einmal geladen und dann gecacht; null = noch nicht geprueft.
let googleVerbunden = null;
function ladeGoogleStatus(danach) {
  gcalStatus().then((s) => { googleVerbunden = !!s.verbunden; danach && danach(); }).catch(() => { googleVerbunden = false; });
}

const heuteIso = () => isoDatum(new Date());

function wannText(datum) {
  const tage = tageBis(datum);
  if (tage === 0) return "heute";
  if (tage === 1) return "morgen";
  if (tage < 0) return `vor ${Math.abs(tage)} Tagen`;
  return `in ${tage} Tagen`;
}

// Kommende Termine, aufsteigend. Vergangene blenden wir aus — die Leiste blickt nach vorn.
function kommendeTermine() {
  const heute = heuteIso();
  return (S.drehtermine || [])
    .filter((t) => t.datum && t.datum >= heute)
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

export function zeichneDrehleiste() {
  const el = document.getElementById("drehleiste");
  if (!el) return;
  el.innerHTML = "";

  // Google-Status still vorladen (v52): wird nicht mehr als Chip in dieser Zeile gezeigt
  // (Indikator sitzt jetzt in der Kopfzeile), aber der Termin-Detail-Knopf „Zu Google Kalender +
  // Tasks" braucht den Stand sofort, nicht erst beim ersten Klick.
  if (googleVerbunden === null) ladeGoogleStatus();

  // Neuen Drehtermin anlegen: ganz links in der verschmolzenen Leiste (v52, Owner-Vorgabe).
  const neu = knopf("Drehtermin", {
    zeichen: "plus",
    titel: "Neuen Drehtermin mit Datum und Uhrzeit anlegen.",
    klick: () =>
      modalDrehtermin((werte) => {
        const t = drehterminAnlegen(werte.datum, werte.zeit);
        if (werte.ort || werte.titel) drehterminAendern(t.id, { ort: werte.ort, titel: werte.titel });
        detail(t.id); // gleich oeffnen, damit man sofort Teilnehmer einladen kann (v44)
      }),
  });
  neu.classList.add("drehleiste-neu");
  el.appendChild(neu);

  const label = document.createElement("span");
  label.className = "drehleiste-label knopf-symbol knopf-symbol-kalender";
  label.title = "Drehtermine";
  label.setAttribute("aria-label", "Drehtermine");
  label.innerHTML = icon("kalender");
  el.appendChild(label);

  const spur = document.createElement("div");
  spur.className = "drehleiste-spur";
  const kommend = kommendeTermine();
  if (!kommend.length) {
    const leer = document.createElement("span");
    leer.className = "drehleiste-leer";
    leer.textContent = "Kein Drehtermin geplant.";
    spur.appendChild(leer);
  } else {
    for (const t of kommend) spur.appendChild(kachel(t));
  }
  el.appendChild(spur);
}

function kachel(t) {
  const n = (t.karteIds || []).filter((kid) => karte(kid)).length; // v115 (N4): nur Karten, die es noch gibt
  const b = document.createElement("button");
  b.type = "button";
  b.className = "drehkachel" + (t.auto ? " auto" : "");
  b.innerHTML =
    `<span class="drehkachel-kopf">` +
    `<span class="drehkachel-datum">${escape(deutschesDatum(t.datum))}${t.zeit ? " · " + escape(t.zeit) : ""}</span>` +
    `<span class="drehkachel-tage">(${escape(wannText(t.datum))})</span></span>` +
    `<span class="drehkachel-fuss">${escape(t.ort || t.titel || (t.auto ? "automatisch gesetzt" : "kein Ort"))}` +
    ` · ${n === 0 ? "noch keine Karten" : n + " " + (n === 1 ? "Karte" : "Karten")}</span>`;
  b.addEventListener("click", () => detail(t.id));
  return b;
}

// --- Modal: Termin anlegen / bearbeiten -----------------------------------

function modalDrehtermin(onSave, vorgabe = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const zu = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) zu(); });

  const box = document.createElement("div");
  box.className = "modal modal-dreh";
  const frage = document.createElement("div");
  frage.className = "modal-frage";
  frage.textContent = vorgabe.datum ? "Drehtermin bearbeiten" : "Neuer Drehtermin";
  frage.appendChild(modalX(zu));
  box.appendChild(frage);

  const dat = eingabe(vorgabe.datum || "", { typ: "date" });
  dat.min = heuteIso(); // kein Drehtermin in der Vergangenheit
  const zeit = eingabe(vorgabe.zeit || "", { typ: "time" });
  const ort = eingabe(vorgabe.ort || "", { platzhalter: "z. B. Studio, draussen …" });
  const titel = eingabe(vorgabe.titel || "", { platzhalter: "z. B. Batch September" });

  const reiheDaten = document.createElement("div");
  reiheDaten.className = "feld-reihe";
  const zf = feld("Uhrzeit", zeit); zf.classList.add("feld-schmal");
  reiheDaten.appendChild(feld("Datum", dat));
  reiheDaten.appendChild(zf);
  box.appendChild(reiheDaten);
  box.appendChild(feld("Ort", ort));
  box.appendChild(feld("Titel (optional)", titel));

  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  box.appendChild(hinweis);

  const reihe = document.createElement("div");
  reihe.className = "modal-knoepfe";
  reihe.appendChild(knopf("Abbrechen", { klick: zu }));
  reihe.appendChild(
    knopf(vorgabe.datum ? "Speichern" : "Anlegen", {
      art: "haupt",
      klick: () => {
        if (!dat.value) { hinweis.textContent = "Bitte ein Datum waehlen."; dat.focus(); return; }
        if (dat.value < heuteIso()) { hinweis.textContent = "Der Drehtermin darf nicht in der Vergangenheit liegen."; dat.focus(); return; }
        zu();
        onSave({ datum: dat.value, zeit: zeit.value, ort: ort.value, titel: titel.value });
      },
    })
  );
  box.appendChild(reihe);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  dat.focus();
}

// --- Termin-Detail: zugeordnete Karten zeigen, loesen, Termin bearbeiten/loeschen ----

// Teilnehmer-Sektion (v44): Organisator-Zeile, Chips mit Entfernen, Mail-Eingabe + Team-Quick-Picks.
// refresh() zeichnet die Detailansicht neu, damit Chips/Picks aktuell sind.
function teilnehmerSektion(t, refresh) {
  const wrap = document.createElement("div");
  wrap.className = "dreh-teilnehmer";

  const label = document.createElement("div");
  label.className = "feld-label";
  label.textContent = "Teilnehmer einladen";
  wrap.appendChild(label);

  const org = document.createElement("p");
  org.className = "feld-hinweis";
  org.textContent = "Kalender: wird geladen …";
  kontoMail()
    .then((m) => { org.textContent = m ? `Kalender von: ${m}` : "Kein Google-Konto verbunden — unter Einstellungen → Google verbinden."; })
    .catch(() => { org.textContent = ""; });
  wrap.appendChild(org);

  const chips = document.createElement("div");
  chips.className = "dreh-chips";
  const teil = t.teilnehmer || [];
  if (!teil.length) {
    const leer = document.createElement("span");
    leer.className = "feld-hinweis";
    leer.textContent = "Noch niemand eingeladen.";
    chips.appendChild(leer);
  } else {
    for (const m of teil) {
      const chip = document.createElement("span");
      chip.className = "dreh-chip";
      chip.textContent = m;
      const x = document.createElement("button");
      x.type = "button";
      x.className = "dreh-chip-x";
      x.textContent = "×";
      x.title = "Entfernen — Google schickt der Person eine Absage";
      x.addEventListener("click", () => { teilnehmerEntfernen(t.id, m); refresh(); });
      chip.appendChild(x);
      chips.appendChild(chip);
    }
  }
  wrap.appendChild(chips);

  const zeile = document.createElement("div");
  zeile.className = "einst-ping-zeile";
  const feldMail = eingabe("", { typ: "email", platzhalter: "name@mail.de" });
  feldMail.style.flex = "1 1 auto";
  const gueltig = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);
  const einladen = () => {
    const m = (feldMail.value || "").trim();
    if (!gueltig(m)) { meldung("Bitte eine gueltige Mailadresse eingeben.", "fehler"); return; }
    if (teilnehmerHinzufuegen(t.id, m)) refresh();
  };
  feldMail.addEventListener("keydown", (e) => { if (e.key === "Enter") einladen(); });
  const add = knopf("Einladen", { art: "haupt", klick: einladen });
  const merken = knopf("+ merken", {
    titel: "Diese Mail in die Team-Liste aufnehmen",
    klick: async () => {
      const m = (feldMail.value || "").trim();
      if (!gueltig(m)) { meldung("Bitte eine gueltige Mailadresse eingeben.", "fehler"); return; }
      await personMerken("", m);
      meldung("Zur Personen-Liste hinzugefuegt.", "erfolg");
      refresh();
    },
  });
  merken.classList.add("knopf-inline");
  zeile.appendChild(feldMail);
  zeile.appendChild(add);
  zeile.appendChild(merken);
  wrap.appendChild(zeile);

  const picks = personen().filter((p) => p.email && !teil.includes(String(p.email).toLowerCase()));
  if (picks.length) {
    const pl = document.createElement("div");
    pl.className = "dreh-picks";
    for (const p of picks) {
      const b = knopf(p.name || p.email, {
        zeichen: "plus",
        titel: p.email,
        klick: () => { if (teilnehmerHinzufuegen(t.id, p.email)) refresh(); },
      });
      b.classList.add("knopf-inline");
      pl.appendChild(b);
    }
    wrap.appendChild(pl);
  }
  return wrap;
}

function detail(id) {
  const t = drehtermin(id);
  if (!t) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const zu = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) zu(); });

  const box = document.createElement("div");
  box.className = "modal modal-dreh";

  const kopf = document.createElement("div");
  kopf.className = "modal-frage";
  kopf.textContent = `Drehtermin ${deutschesDatum(t.datum)}${t.zeit ? " · " + t.zeit : ""}`;
  kopf.appendChild(modalX(zu));
  box.appendChild(kopf);

  const unter = document.createElement("p");
  unter.className = "feld-hinweis";
  unter.textContent =
    [t.ort, t.titel].filter(Boolean).join(" · ") + (t.auto ? "  (automatisch gesetzt)" : "");
  box.appendChild(unter);

  const liste = document.createElement("div");
  liste.className = "dreh-kartenliste";
  const karten = (t.karteIds || []).map((kid) => karte(kid)).filter(Boolean);
  if (!karten.length) {
    const leer = document.createElement("p");
    leer.className = "feld-hinweis";
    leer.textContent = "Noch keine Karten zugeordnet. Ordne fertige Skripte im Schritt „Drehtermin festlegen“ zu.";
    liste.appendChild(leer);
  } else {
    for (const k of karten) {
      const zeile = document.createElement("div");
      zeile.className = "dreh-kartenzeile";
      const titel = document.createElement("button");
      titel.type = "button";
      titel.className = "dreh-kartentitel";
      titel.textContent = k.title || "(ohne Titel)";
      titel.addEventListener("click", () => { zu(); oeffneKarte(k.id); });
      const weg = knopf("entfernen", {
        klick: () => { karteVonTermin(k.id, t.id); zu(); detail(t.id); },
      });
      weg.classList.add("knopf-inline");
      zeile.appendChild(titel);
      zeile.appendChild(weg);
      liste.appendChild(zeile);
    }
  }
  box.appendChild(liste);

  // Teilnehmer einladen (v44) — Aenderungen aktualisieren das Event neu geoeffnet.
  box.appendChild(teilnehmerSektion(t, () => { zu(); detail(t.id); }));

  const reihe = document.createElement("div");
  reihe.className = "modal-knoepfe";
  reihe.appendChild(knopf("Schliessen", { klick: zu }));
  reihe.appendChild(
    knopf("Zu Google Kalender + Tasks", {
      art: "haupt",
      zeichen: "kalender",
      klick: async (e) => {
        if (!googleVerbunden) { gcalVerbinden(); return; }
        const b = e.currentTarget;
        b.disabled = true;
        try {
          await gcalSync(t.id);
          meldung("In Google Kalender und Tasks eingetragen.", "erfolg");
          zu();
        } catch (err) {
          meldung("Google-Sync fehlgeschlagen: " + err.message, "fehler");
          b.disabled = false;
        }
      },
    })
  );
  reihe.appendChild(
    knopf("Bearbeiten", {
      klick: () => {
        zu();
        modalDrehtermin((werte) => drehterminAendern(t.id, werte), t);
      },
    })
  );
  const loeschen = knopf("Loeschen", {
    klick: () =>
      bestaetigen(
        karten.length
          ? `Diesen Drehtermin loeschen? ${karten.length} Karte${karten.length === 1 ? "" : "n"} werden geloest (ihr Dreh-Datum bleibt).`
          : "Diesen Drehtermin loeschen?",
        "Loeschen",
        () => { drehterminLoeschen(t.id); zu(); }
      ),
  });
  loeschen.classList.add("knopf-gefahr");
  reihe.appendChild(loeschen);
  box.appendChild(reihe);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// Fuer die Karten-Seite (detail.js): das Zuordnungs-Modal wiederverwenden.
export { modalDrehtermin };
