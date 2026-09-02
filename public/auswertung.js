// Auswertungs-Ansicht: die Zahlen nach der Veroeffentlichung — und was sie heissen.
//
// Aufbau (v18, Owner 02.09.2026): Das Wichtigste steht oben und ohne Klick sichtbar —
// die Kernzahlen (KPI-Reihe) und die LETZTEN BEITRAEGE plattformuebergreifend (Instagram
// und LinkedIn gemischt, chronologisch). Nebendaten (Bestperformer-Raenge, Kanaele-
// Schnappschuss, Redaktionskalender) liegen darunter in einklappbaren Gruppen.
//
// Zwei Regeln aus docs/best-practices.md stecken drin: verglichen wird gegen den EIGENEN
// gleitenden Median, nicht gegen Branchenwerte; welche Zahl zaehlt, haengt am Ziel der Karte.
//
// Datenehrlichkeit: gezeigt wird nur, was aus echten Feldern kommt. Kein Konto verbunden =
// Leerzustand und "—", keine erfundenen Trends. LinkedIn liefert ueber social.js (noch) keine
// Views/Reichweite/Weiterleitungen je Post — dort steht ehrlich "—", keine Naeherung.

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

function karteZuLinkedin(id) {
  if (!id) return null;
  return S.cards.find((k) => {
    const p = (k.published || {}).linkedin;
    const pid = typeof p === "string" ? p : p && (p.id || p.url);
    return pid && (pid === id || String(id).includes(pid));
  });
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

  // --- Das Wichtigste, immer sichtbar ---
  el.appendChild(kpiReihe(ig, li, igOn, liOn));
  el.appendChild(letzteBeitraegeBlock(ig, li, igOn, liOn));
  el.appendChild(medianHinweis());

  // --- Nebendaten, ausklappbar ---
  const best = bestperformerInhalt(ig, igOn);
  el.appendChild(ausklapp("Bestperformer", best.inhalt, best.anzahl, "pokal"));

  const kan = kanaeleInhalt(ig, li, igOn, liOn);
  el.appendChild(ausklapp("Kanaele-Schnappschuss", kan.inhalt, kan.anzahl));

  el.appendChild(kalenderWidget());
}

// --- Ausklapp-Gruppe: Titel + optionale Anzahl, eingeklappt ----------------

function ausklapp(titel, inhalt, anzahl = null, zeichen = null) {
  const g = gruppe(titel, anzahl, false);
  if (zeichen) {
    const titelEl = g.querySelector(".gruppe-titel");
    if (titelEl) titelEl.insertAdjacentHTML("beforebegin", icon(zeichen, "gruppe-zeichen"));
  }
  g.appendChild(inhalt);
  return g;
}

// --- Letzte Beitraege plattformuebergreifend -------------------------------

const SICHTBAR = 6; // so viele Beitraege stehen offen, der Rest liegt eingeklappt darunter

function letzteBeitraege(ig, li, igOn, liOn) {
  const eintraege = [];
  if (igOn) {
    for (const m of ig.medien || []) {
      const kn = m.kennzahlen || {};
      const ins = m.insights || {};
      eintraege.push({
        plattform: "instagram",
        titel: (m.caption || "").split("\n")[0].slice(0, 90) || "(ohne Titel)",
        datum: m.timestamp,
        views: kn.views ?? ins.views ?? null,
        reichweite: kn.reach ?? ins.reach ?? null,
        weiterleitungen: ins.shares ?? null,
        likes: m.like_count ?? null,
        karte: karteZuBeitrag(m.permalink),
      });
    }
  }
  if (liOn) {
    for (const p of li.posts || []) {
      eintraege.push({
        plattform: "linkedin",
        titel: (p.text || "").split("\n")[0].slice(0, 90) || "(ohne Titel)",
        datum: p.erstellt,
        views: null,
        reichweite: null,
        weiterleitungen: null,
        likes: p.likes ?? null,
        karte: karteZuLinkedin(p.id),
      });
    }
  }
  eintraege.sort((a, b) => zeit(b.datum) - zeit(a.datum));
  return eintraege;
}

function letzteBeitraegeBlock(ig, li, igOn, liOn) {
  const wrap = document.createElement("div");
  wrap.className = "abschnitt";
  wrap.innerHTML =
    `<div class="abschnitt-kopf">${icon("auge")}<span class="abschnitt-titel">Letzte Beitraege</span>` +
    `<span class="abschnitt-unter">— Instagram und LinkedIn zusammen, das Neueste zuerst</span></div>`;

  if (!igOn && !liOn) {
    wrap.appendChild(
      leer({
        zeichen: "auge",
        titel: "Noch keine Beitraege",
        satz: "Sobald ein Konto verbunden ist, stehen hier die letzten Beitraege beider Plattformen nebeneinander.",
      })
    );
    return wrap;
  }

  const alle = letzteBeitraege(ig, li, igOn, liOn);
  if (!alle.length) {
    wrap.appendChild(
      leer({ zeichen: "auge", titel: "Noch keine Beitraege", satz: "Die verbundenen Konten haben noch keine ausgelieferten Beitraege." })
    );
    return wrap;
  }

  const liste = document.createElement("div");
  liste.className = "letzte-liste";
  alle.slice(0, SICHTBAR).forEach((e) => liste.appendChild(beitragZeile(e)));
  wrap.appendChild(liste);

  const rest = alle.slice(SICHTBAR);
  if (rest.length) {
    const g = gruppe(`Weitere Beitraege`, rest.length, false);
    const restListe = document.createElement("div");
    restListe.className = "letzte-liste";
    rest.forEach((e) => restListe.appendChild(beitragZeile(e)));
    g.appendChild(restListe);
    wrap.appendChild(g);
  }

  return wrap;
}

function beitragZeile(e) {
  const el = document.createElement("div");
  el.className = "letzte-zeile";
  if (e.karte) {
    el.classList.add("klickbar");
    el.addEventListener("click", () => oeffne(e.karte.id));
  }
  el.innerHTML =
    `<span class="letzte-marke marke-${e.plattform}" title="${escape(plattformName(e.plattform))}"></span>` +
    `<div class="letzte-koerper">` +
    `<div class="letzte-titel">${escape(e.titel)}</div>` +
    `<div class="letzte-meta">${escape(plattformName(e.plattform))} · ${escape(kurzDatum(e.datum))}</div>` +
    `</div>` +
    `<div class="letzte-zahlen">` +
    zelle(fmt(e.views), "Views") +
    zelle(fmt(e.reichweite), "Reichweite") +
    zelle(fmt(e.weiterleitungen), "Weiterl.") +
    zelle(fmt(e.likes), "Likes") +
    `</div>`;
  return el;
}

function zelle(wert, label) {
  return `<span class="letzte-zahl"><b>${escape(wert)}</b><i>${escape(label)}</i></span>`;
}

function medianHinweis() {
  const p = document.createElement("p");
  p.className = "feld-hinweis";
  p.style.margin = "-8px 0 22px";
  p.textContent =
    "Verglichen wird gegen den eigenen gleitenden Median, nicht gegen Branchenwerte — die kursierenden Benchmarks sind unbelegt.";
  return p;
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

  // Reichweite letzte 30 Tage vs. die 30 davor — mit Trend-Pfeil.
  const r30 = ig.reichweite30 || {};
  const rj = (r30.jetzt || {}).reichweite;
  const rd = (r30.davor || {}).reichweite;
  const rTrend =
    igOn && rj != null && rd != null && rd > 0
      ? { richtung: rj >= rd ? "hoch" : "runter", text: `${rj >= rd ? "+" : ""}${Math.round(((rj - rd) / rd) * 100)} % ggue. 30 T. davor` }
      : null;

  wrap.innerHTML =
    kpiKarte("saeulen", "Reichweite · 30 Tage", igOn && rj != null ? fmt(rj) : "—",
      "Erreichte Konten der letzten 30 Tage.", rTrend) +
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

// --- Bestperformer (Inhalt fuer die Ausklapp-Gruppe) -----------------------

function bestperformerInhalt(ig, igOn) {
  const medien = (igOn ? ig.medien : []) || [];
  if (!medien.length) {
    return {
      anzahl: null,
      inhalt: leer({
        zeichen: "pokal",
        titel: "Noch kein Bestperformer",
        satz: "Sobald ein Konto verbunden ist und Beitraege liefert, steht hier der staerkste dieser Periode.",
      }),
    };
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

  return { anzahl: medien.length, inhalt: grid };
}

function besterKarte(m, medianViews) {
  const k = karteZuBeitrag(m.permalink);
  const kn = m.kennzahlen || {};
  const titel = k ? k.title : (m.caption || "").split("\n")[0].slice(0, 80) || "(ohne Titel)";
  const pl = plattformName(m.plattform || "instagram");
  const vergleich = medianViews ? Math.round(((viewsVon(kn) - medianViews) / medianViews) * 100) : null;

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
  const topViews = viewsVon(top.kennzahlen || {}) || 1;
  const anteil = Math.max(5, Math.round((viewsVon(kn) / topViews) * 100));
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

// --- Kanaele-Schnappschuss (Inhalt fuer die Ausklapp-Gruppe) ----------------

function kanaeleInhalt(ig, li, igOn, liOn) {
  const reihe = document.createElement("div");
  reihe.className = "kanaele";
  reihe.appendChild(kanalKarte("instagram", "Instagram", igOn, igOn ? (ig.konto || {}).followers_count : null));
  reihe.appendChild(kanalKarte("linkedin", "LinkedIn", liOn, liOn ? (li.konto || {}).follower : null));
  return { anzahl: (igOn ? 1 : 0) + (liOn ? 1 : 0) || null, inhalt: reihe };
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
  const g = gruppe("Redaktionskalender", null, false);
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

const viewsVon = (kn) => (kn && kn.views) || 0;
const proz = (n) => `${String(n).replace(".", ",")} %`;

function zeit(d) {
  if (d == null) return 0;
  const t = new Date(typeof d === "number" ? d : d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function kurzDatum(d) {
  const t = zeit(d);
  if (!t) return "—";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(t));
}

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("de-DE").format(n);
}

export { linkedinZahlen };
