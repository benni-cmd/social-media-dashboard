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
} from "./store.js";
import { knopf, icon, escape, eingabe, feld, bestaetigen, meldung } from "./ui.js";
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

  const label = document.createElement("span");
  label.className = "drehleiste-label knopf-symbol knopf-symbol-kalender";
  label.innerHTML = icon("kalender") + "<span>Drehtermine</span>";
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

  const neu = knopf("Drehtermin", {
    zeichen: "plus",
    titel: "Neuen Drehtermin mit Datum und Uhrzeit anlegen.",
    klick: () =>
      modalDrehtermin((werte) => {
        const t = drehterminAnlegen(werte.datum, werte.zeit);
        if (werte.ort || werte.titel) drehterminAendern(t.id, { ort: werte.ort, titel: werte.titel });
      }),
  });
  neu.classList.add("drehleiste-neu");
  el.appendChild(neu);

  // Google-Verbindung: Knopf, solange nicht verbunden; sonst ein dezentes Haekchen.
  if (googleVerbunden === null) {
    ladeGoogleStatus(() => { if (document.getElementById("drehleiste")) zeichneDrehleiste(); });
  }
  const g = document.createElement("span");
  g.className = "drehleiste-google";
  g.style.cssText = "margin-left:8px;display:inline-flex;align-items:center;gap:6px;color:var(--text-still);font-size:12px;white-space:nowrap";
  if (googleVerbunden) {
    g.innerHTML = icon("check") + "<span>Google verbunden</span>";
    g.title = "Google Kalender + Tasks sind verbunden.";
  } else {
    g.appendChild(knopf("Mit Google verbinden", { klick: () => gcalVerbinden() }));
  }
  el.appendChild(g);
}

function kachel(t) {
  const n = (t.karteIds || []).length;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "drehkachel" + (t.auto ? " auto" : "");
  b.innerHTML =
    `<span class="drehkachel-kopf">` +
    `<span class="drehkachel-datum">${escape(deutschesDatum(t.datum))}${t.zeit ? " · " + escape(t.zeit) : ""}</span>` +
    `<span class="drehkachel-tage">(${escape(wannText(t.datum))})</span></span>` +
    `<span class="drehkachel-fuss">${escape(t.ort || t.titel || (t.auto ? "automatisch gesetzt" : "kein Ort"))}` +
    ` · ${n} ${n === 1 ? "Karte" : "Karten"}</span>`;
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
