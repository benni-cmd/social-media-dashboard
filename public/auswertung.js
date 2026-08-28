// Auswertungs-Ansicht: die Zahlen nach der Veroeffentlichung — und was sie heissen.
//
// Aufbau nach Owner-Screenshot (28.08.2026), aber im Dark-Theme der bestehenden Tokens:
//   KPI-Reihe · Bestperformer · Kanaele-Schnappschuss · Redaktionskalender (Widget).
// Zwei Regeln aus docs/best-practices.md stecken drin: verglichen wird gegen den EIGENEN
// gleitenden Median, nicht gegen Branchenwerte; welche Zahl zaehlt, haengt am Ziel der Karte.
//
// Datenehrlichkeit: gezeigt wird nur, was aus echten Feldern kommt. Kein Konto verbunden =
// Leerzustand und "—", keine erfundenen Trends. Der Vergleich "ggue. Median" ist echt, weil
// der Median aus den eigenen letzten Beitraegen stammt.

import { zielInfo, plattformName } from "/lib/pipeline.js";
import { S, instagramZahlen, linkedinZahlen, zeichne } from "./store.js";
import { zeichneKalender } from "./kalender.js";
import { icon, statusChip, escape, knopf, leer, gruppe, fortschritt } from "./ui.js";

let oeffne = () => {};
export const beiOeffnen = (f) => (oeffne = f);

function karteZuBeitrag(permalink) {
  if (!permalink) return null;
  return S.cards.find((k) =>
    Object.values(k.published || {}).some((p) => p && p.permalink && permalink.includes(p.permalink.split("?")[0].replace(/\/$/, "")))
  );
}

export async function zeichneAuswertung(el) {
  el.innerHTML = "";

  const kopf = document.createElement("div");
  kopf.className = "kalender-kopf";
  kopf.innerHTML = `<span class="kalender-monat">Was die Zahlen sagen</span>`;
  kopf.appendChild(
    knopf("Zahlen neu holen", {
      zeichen: "neuladen",
      klick: () => {
        S.zahlen = null;
        S.zahlenLi = null;
        zeichne();
      },
    })
  );
  el.appendChild(kopf);

  if (S.zahlen === null) {
    const weg = fortschritt(el, "Hole die Zahlen von Instagram …");
    try {
      S.zahlen = await instagramZahlen();
    } catch (e) {
      S.zahlen = { verbunden: false, fehler: e.message };
    }
    weg();
  }
  if (S.zahlenLi === null) {
    const weg = fortschritt(el, "Hole die Zahlen von LinkedIn …");
    try {
      S.zahlenLi = await linkedinZahlen();
    } catch (e) {
      S.zahlenLi = { verbunden: false, fehler: e.message };
    }
    weg();
  }

  const ig = S.zahlen || {};
  const li = S.zahlenLi || {};
  const igOn = !!ig.verbunden && !ig.fehler;
  const liOn = !!li.verbunden && !li.fehler;

  if (ig.fehler) el.appendChild(fehlerZeile(ig.hinweis || ig.fehler, "instagram", "Instagram"));
  if (li.fehler) el.appendChild(fehlerZeile(li.hinweis || li.fehler, "linkedin", "LinkedIn"));

  el.appendChild(kpiReihe(ig, li, igOn, liOn));
  el.appendChild(bestperformerBlock(ig, igOn));
  el.appendChild(kanaeleBlock(ig, li, igOn, liOn));

  const fuss = document.createElement("p");
  fuss.className = "feld-hinweis";
  fuss.style.margin = "2px 0 18px";
  fuss.textContent =
    "Verglichen wird gegen den eigenen gleitenden Median, nicht gegen Branchenwerte — die kursierenden Benchmarks sind unbelegt.";
  el.appendChild(fuss);

  el.appendChild(kalenderWidget());
}

// --- KPI-Reihe ------------------------------------------------------------

function kpiReihe(ig, li, igOn, liOn) {
  const wrap = document.createElement("div");
  wrap.className = "kpi-reihe";
  const konto = ig.konto || {};
  const median = ig.median || {};
  const lk = li.konto || {};
  const followerAn = igOn || liOn;
  const follower = (igOn ? konto.followers_count || 0 : 0) + (liOn ? lk.follower || 0 : 0);
  const posts = (igOn ? konto.media_count || 0 : 0) + (liOn ? (li.posts || []).length : 0);

  wrap.innerHTML =
    kpiKarte("auge", "Views im Median", igOn ? fmt(median.views) : "—",
      igOn ? `Vergleichslinie aus den letzten ${median.grundlage || 0} Beitraegen.` : "Sobald ein Konto verbunden ist.") +
    kpiKarte("ziel", "Weiterleitungen", igOn && median.sendsProReichweite != null ? proz(median.sendsProReichweite) : "—",
      "Je Reichweite im Median — die Groesse, die Nicht-Follower bewegt.") +
    kpiKarte("personen", "Follower", followerAn ? fmt(follower) : "—",
      "Ueber die verbundenen Konten zusammengezaehlt.") +
    kpiKarte("senden", "Veroeffentlichte Posts", followerAn ? fmt(posts) : "—",
      "Liegen insgesamt auf den verbundenen Konten.");
  return wrap;
}

function kpiKarte(zeichen, label, wert, satz, trend) {
  const trendHtml = trend
    ? `<div class="kpi-trend ${trend.richtung}">${icon(trend.richtung === "hoch" ? "pfeil-hoch" : "pfeil-runter")}<span>${escape(trend.text)}</span></div>`
    : "";
  return (
    `<div class="kpi">` +
    `<span class="kpi-icon">${icon(zeichen)}</span>` +
    `<div class="kpi-label">${escape(label)}</div>` +
    `<div class="kpi-wert">${escape(wert)}</div>` +
    (satz ? `<div class="kpi-satz">${escape(satz)}</div>` : "") +
    trendHtml +
    `</div>`
  );
}

// --- Bestperformer --------------------------------------------------------

function bestperformerBlock(ig, igOn) {
  const wrap = document.createElement("div");
  wrap.className = "abschnitt";
  wrap.innerHTML =
    `<div class="abschnitt-kopf">${icon("pokal")}<span class="abschnitt-titel">Bestperformer</span>` +
    `<span class="abschnitt-unter">— was diese Periode am besten funktioniert hat</span></div>`;

  const medien = (igOn ? ig.medien : []) || [];
  if (!medien.length) {
    wrap.appendChild(
      leer({
        zeichen: "pokal",
        titel: "Noch kein Bestperformer",
        satz: "Sobald ein Konto verbunden ist und Beitraege liefert, steht hier der staerkste dieser Periode.",
      })
    );
    return wrap;
  }

  const views = (m) => (m.kennzahlen && m.kennzahlen.views) || 0;
  const sortiert = [...medien].sort((a, b) => views(b) - views(a));
  const medianViews = (ig.median || {}).views || 0;

  const grid = document.createElement("div");
  grid.className = "bestperformer";
  grid.appendChild(besterKarte(sortiert[0], medianViews));

  const rangListe = document.createElement("div");
  rangListe.className = "rang-liste";
  sortiert.slice(1, 3).forEach((m, i) => rangListe.appendChild(rangKarte(m, i + 2, sortiert[0])));
  if (rangListe.children.length) grid.appendChild(rangListe);

  wrap.appendChild(grid);
  return wrap;
}

function besterKarte(m, medianViews) {
  const k = karteZuBeitrag(m.permalink);
  const kn = m.kennzahlen || {};
  const titel = k ? k.title : (m.caption || "").split("\n")[0].slice(0, 80) || "(ohne Titel)";
  const pl = plattformName(m.plattform || "instagram");
  const vergleich = medianViews ? Math.round(((views(kn) - medianViews) / medianViews) * 100) : null;

  const el = document.createElement("div");
  el.className = "bester";
  if (k) {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => oeffne(k.id));
  }
  el.innerHTML =
    `<div class="bester-kopf"><span class="bester-marke">${icon("video")}<span>Bester Beitrag · ${escape(pl)}</span></span></div>` +
    `<div class="bester-titel">${escape(titel)}</div>` +
    `<div class="bester-gross">` +
    `<div class="bester-wert">${fmt(kn.views)}</div>` +
    `<div class="bester-wert-label">Views im Beitrag</div>` +
    (vergleich != null
      ? `<div class="kpi-trend ${vergleich >= 0 ? "hoch" : "runter"}">${icon(vergleich >= 0 ? "pfeil-hoch" : "pfeil-runter")}` +
        `<span>${vergleich >= 0 ? "+" : ""}${String(vergleich).replace(".", ",")} % ggue. Median</span></div>`
      : "") +
    `</div>` +
    `<div class="bester-metriken">` +
    besterMetrik(fmt(kn.views), "Views") +
    besterMetrik(fmt(kn.reaktionen), "Reaktionen") +
    besterMetrik(fmt(kn.kommentare), "Kommentare") +
    besterMetrik(kn.sendsProReichweite != null ? proz(kn.sendsProReichweite) : "—", "Weitergeleitet") +
    `</div>`;
  return el;
}

function besterMetrik(wert, label) {
  return `<div class="bester-metrik"><div class="bester-metrik-wert">${escape(wert)}</div><div class="bester-metrik-label">${escape(label)}</div></div>`;
}

function rangKarte(m, rang, top) {
  const k = karteZuBeitrag(m.permalink);
  const kn = m.kennzahlen || {};
  const titel = k ? k.title : (m.caption || "").split("\n")[0].slice(0, 64) || "(ohne Titel)";
  const topViews = views(top.kennzahlen || {}) || 1;
  const anteil = Math.max(5, Math.round((views(kn) / topViews) * 100));
  const pl = plattformName(m.plattform || "instagram");

  const el = document.createElement("div");
  el.className = "rang";
  if (k) {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => oeffne(k.id));
  }
  el.innerHTML =
    `<div class="rang-nr">${rang}</div>` +
    `<div class="rang-koerper">` +
    `<div class="rang-titel">${icon("chat")}<span>${escape(titel)}</span></div>` +
    `<div class="rang-schiene"><span class="rang-balken" style="width:${anteil}%"></span></div>` +
    `<div class="rang-fuss">${escape(pl)} · ${fmt(kn.views)} Views</div>` +
    `</div>`;
  return el;
}

// --- Kanaele-Schnappschuss ------------------------------------------------

function kanaeleBlock(ig, li, igOn, liOn) {
  const wrap = document.createElement("div");
  wrap.className = "abschnitt";
  wrap.innerHTML = `<div class="abschnitt-kopf"><span class="abschnitt-titel">Kanaele-Schnappschuss</span></div>`;
  const reihe = document.createElement("div");
  reihe.className = "kanaele";
  reihe.appendChild(kanalKarte("instagram", "Instagram", igOn, igOn ? (ig.konto || {}).followers_count : null));
  reihe.appendChild(kanalKarte("linkedin", "LinkedIn", liOn, liOn ? (li.konto || {}).follower : null));
  wrap.appendChild(reihe);
  return wrap;
}

function kanalKarte(id, name, verbunden, wert) {
  const el = document.createElement("div");
  el.className = "kanal";
  const kopf = `<div class="kanal-kopf"><span class="kanal-marke marke-${id}"></span><span class="kanal-name">${escape(name)}</span></div>`;
  if (verbunden) {
    el.innerHTML = kopf + `<div class="kanal-wert">${fmt(wert)}</div><div class="kanal-fuss">Follower</div>`;
  } else {
    el.innerHTML = kopf + `<div class="kanal-fuss">Nicht verbunden</div>`;
    el.appendChild(verbindenKnopf(id, name));
  }
  return el;
}

function verbindenKnopf(plattform, name) {
  return knopf(`Mit ${name} verbinden`, {
    art: "haupt",
    zeichen: "extern",
    titel: `Fuehrt zum Anmelde- und Zustimmungsfenster von ${name}.`,
    klick: () => {
      location.href = `/api/auth/${plattform}`;
    },
  });
}

// --- Kalender-Widget ------------------------------------------------------

function kalenderWidget() {
  const g = gruppe("Redaktionskalender", null, true);
  const box = document.createElement("div");
  box.className = "kalender-widget";
  zeichneKalender(box);
  g.appendChild(box);
  return g;
}

// --- Hilfen ---------------------------------------------------------------

function fehlerZeile(satz, id, name) {
  const b = document.createElement("div");
  b.className = "befund";
  b.style.marginBottom = "12px";
  b.innerHTML = statusChip("befund") + `<span class="befund-satz">${escape(`${name}: ${satz}`)}</span>`;
  return b;
}

const views = (kn) => (kn && kn.views) || 0;
const proz = (n) => `${String(n).replace(".", ",")} %`;
function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("de-DE").format(n);
}

export { linkedinZahlen };
