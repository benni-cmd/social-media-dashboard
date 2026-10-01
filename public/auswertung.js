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

import { zielInfo, plattformName, isoDatum } from "/lib/pipeline.js";
import { wocheGegenPlan, montagVon, plusTage } from "/lib/uploadslots.js";
import { S, instagramZahlen, linkedinZahlen, zeichne } from "./store.js";
import { zeichneKalender } from "./kalender.js";
import { icon, statusChip, escape, knopf, leer, gruppe, sanduhr } from "./ui.js";

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

  // v32 E: Beim Holen der Zahlen die drehende Sanduhr zeigen (nicht mehr nur einen Balken) —
  // derselbe „hier passiert gerade was"-Indikator wie ueberall sonst.
  const ladeMarke = (text) => {
    const w = document.createElement("div");
    w.style.cssText = "padding:18px 11px";
    w.appendChild(sanduhr(text));
    el.appendChild(w);
    return () => w.remove();
  };
  // v55 C3: IG- und LI-Zahlen PARALLEL holen statt nacheinander — beide Sanduhren
  // erscheinen gleichzeitig, beide Abrufe starten zusammen. Fehler bleiben je Plattform
  // einzeln sichtbar: jeder Abruf faengt seinen eigenen Fehler in sein eigenes S-Feld,
  // deshalb kann ein IG-Fehler den LI-Abruf nicht verschlucken. Reines Zeitverhalten.
  const holen = [];
  if (S.zahlen === null) {
    const weg = ladeMarke("Hole die Zahlen von Instagram …");
    holen.push(
      instagramZahlen()
        .then((z) => { S.zahlen = z; })
        .catch((e) => { S.zahlen = { verbunden: false, fehler: e.message }; })
        .finally(weg)
    );
  }
  if (S.zahlenLi === null) {
    const weg = ladeMarke("Hole die Zahlen von LinkedIn …");
    holen.push(
      linkedinZahlen()
        .then((z) => { S.zahlenLi = z; })
        .catch((e) => { S.zahlenLi = { verbunden: false, fehler: e.message }; })
        .finally(weg)
    );
  }
  if (holen.length) await Promise.all(holen);

  const ig = S.zahlen || {};
  const li = S.zahlenLi || {};
  const igOn = !!ig.verbunden && !ig.fehler;
  const liOn = !!li.verbunden && !li.fehler;

  if (ig.fehler) el.appendChild(fehlerZeile(ig.hinweis || ig.fehler, "instagram", "Instagram"));
  if (li.fehler) el.appendChild(fehlerZeile(li.hinweis || li.fehler, "linkedin", "LinkedIn"));

  // --- Das Wichtigste, immer sichtbar ---
  el.appendChild(kpiReihe(ig, li, igOn, liOn));
  el.appendChild(wochenStatistikBlock(ig, li, igOn, liOn));
  el.appendChild(letzteBeitraegeBlock(ig, li, igOn, liOn));
  el.appendChild(plattformVergleichBlock(ig, li, igOn, liOn));
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

// --- Plattform-Vergleich: welche performt besser? --------------------------

// Aggregiert eine Postliste zu Aufrufen/Interaktionen/Kommentaren (Mittel + Rate).
// Raten auf Summen: Sigma Interaktionen / Sigma Aufrufe — robuster als Mittel der Einzelraten.
function aggregat(posts) {
  const n = posts.length;
  if (!n) return null;
  const sum = (f) => posts.reduce((s, p) => s + (Number(p[f]) || 0), 0);
  const aufrufe = sum("views");
  const inter = sum("interaktionen");
  const komm = sum("kommentare");
  return {
    n,
    aufrufeAvg: aufrufe ? Math.round(aufrufe / n) : null,
    interAvg: Math.round(inter / n),
    kommAvg: Math.round(komm / n),
    interRate: aufrufe ? (inter / aufrufe) * 100 : null,
    kommRate: aufrufe ? (komm / aufrufe) * 100 : null,
  };
}

// Instagram-Medien auf das gemeinsame Feldschema bringen.
function igAlsPosts(ig) {
  return (ig.medien || []).map((m) => {
    const ins = m.insights || {};
    const kn = m.kennzahlen || {};
    return {
      views: ins.views ?? kn.views ?? null,
      interaktionen: ins.total_interactions ?? null,
      kommentare: m.comments_count ?? null,
    };
  });
}

function plattformVergleichBlock(ig, li, igOn, liOn) {
  const wrap = document.createElement("div");
  wrap.className = "abschnitt";
  wrap.innerHTML =
    `<div class="abschnitt-kopf">${icon("saeulen")}<span class="abschnitt-titel">Plattform-Vergleich</span>` +
    `<span class="abschnitt-unter">— wo Inhalte staerker zuenden (je Beitrag)</span></div>`;

  const igAgg = igOn ? aggregat(igAlsPosts(ig)) : null;
  const liAgg = liOn ? aggregat(li.posts || []) : null;

  // Staerkere Plattform nach Interaktionsrate (nur wenn beide eine Rate haben).
  let sieger = null;
  if (igAgg?.interRate != null && liAgg?.interRate != null) {
    sieger = igAgg.interRate >= liAgg.interRate ? "instagram" : "linkedin";
  }

  const reihe = document.createElement("div");
  reihe.className = "vergleich";
  reihe.appendChild(vergleichKarte("instagram", "Instagram", igOn, igAgg, sieger === "instagram"));
  reihe.appendChild(vergleichKarte("linkedin", "LinkedIn", liOn, liAgg, sieger === "linkedin"));
  wrap.appendChild(reihe);
  return wrap;
}

function vergleichKarte(id, name, verbunden, agg, sieger) {
  const el = document.createElement("div");
  el.className = "vergleich-karte" + (sieger ? " sieger" : "");
  let kopf =
    `<div class="vergleich-kopf"><span class="kanal-marke marke-${id}"></span>` +
    `<span class="kanal-name">${escape(name)}</span>` +
    (sieger ? `<span class="vergleich-badge">staerker</span>` : "") +
    (verbunden && agg ? `<span class="vergleich-basis">${agg.n} Beitraege</span>` : "") +
    `</div>`;

  if (!verbunden) {
    el.innerHTML = kopf + `<div class="vergleich-leer">Nicht verbunden</div>`;
    return el;
  }
  if (!agg) {
    el.innerHTML = kopf + `<div class="vergleich-leer">Noch keine Beitraege</div>`;
    return el;
  }

  el.innerHTML =
    kopf +
    vergleichZeile("Aufrufe", fmt(agg.aufrufeAvg), "Ø je Beitrag") +
    vergleichZeile("Interaktionen", fmt(agg.interAvg), agg.interRate != null ? proz1(agg.interRate) + " der Aufrufe" : "Aufrufe fehlen") +
    vergleichZeile("Kommentare", fmt(agg.kommAvg), agg.kommRate != null ? proz1(agg.kommRate) + " der Aufrufe" : "Aufrufe fehlen");
  return el;
}

function vergleichZeile(label, wert, unter) {
  return (
    `<div class="vergleich-zeile">` +
    `<span class="vergleich-label">${escape(label)}</span>` +
    `<span class="vergleich-wert">${escape(wert)}</span>` +
    `<span class="vergleich-unter">${escape(unter)}</span>` +
    `</div>`
  );
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
      ? { richtung: rj >= rd ? "hoch" : "runter", text: `${rj >= rd ? "+" : ""}${Math.round(((rj - rd) / rd) * 100)} % gegenüber den 30 Tagen davor` }
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

// --- Wochenstatistik (v90) ----------------------------------------------------
//
// Owner 01.10.2026: immer eine Wochenstatistik Montag–Sonntag, unabhaengig von den Uploads.
// Je Kalenderwoche: Redaktionsplan (Soll aus dem Plan, terminiert aus den Karten), tatsaechlich
// veroeffentlicht (Instagram + LinkedIn nach Zeitstempel) und die Konto-Werte von Instagram.
// Neueste Woche oben; die laufende Woche ist markiert und zaehlt bis jetzt.
function wochenStatistikBlock(ig, li, igOn, liOn) {
  const wrap = document.createElement("div");
  wrap.className = "abschnitt";
  wrap.innerHTML =
    `<div class="abschnitt-kopf">${icon("kalender")}<span class="abschnitt-titel">Wochenstatistik</span>` +
    `<span class="abschnitt-unter">— Montag bis Sonntag, neueste oben</span></div>`;

  const wochen = igOn && (ig.wochen || []).length ? ig.wochen : letzteWochenLeer(8);
  const imZeitraum = (t, w) => {
    if (!t) return false;
    const tag = new Date(t).toISOString().slice(0, 10);
    return tag >= w.von && tag <= w.bis;
  };
  const igPosts = igOn ? ig.medien || [] : [];
  const liPosts = liOn ? li.posts || [] : [];

  const tab = document.createElement("table");
  tab.className = "wochen-tabelle";
  tab.innerHTML =
    `<thead><tr><th>Woche</th><th>Redaktionsplan</th><th>Veroeffentlicht</th>` +
    `<th>Reichweite</th><th>Views</th><th>Interaktionen</th></tr></thead>`;
  const body = document.createElement("tbody");
  for (const w of wochen) {
    const p = S.plan ? wocheGegenPlan(S.plan, S.cards, w.von) : null;
    const planZelle = !p
      ? `<span class="leise">Plan laedt …</span>`
      : !p.sollGesamt
        ? `<span class="leise">nichts geplant</span>`
        : `${p.fehlt.length ? icon("warnung") : icon("check")} ${p.istGesamt} / ${p.sollGesamt}`;
    const igN = igPosts.filter((m) => imZeitraum(m.timestamp, w)).length;
    const liN = liPosts.filter((x) => imZeitraum(x.erstellt, w)).length;
    const tr = document.createElement("tr");
    if (w.laeuft) tr.className = "laeuft";
    if (p && p.sollGesamt && p.fehlt.length) tr.classList.add("plan-luecke");
    tr.innerHTML =
      `<td><strong>KW ${kalenderwoche(w.von)}</strong> <span class="leise">${kurzTag(w.von)}–${kurzTag(w.bis)}${w.laeuft ? " · laeuft" : ""}</span></td>` +
      `<td title="terminiert / laut Plan">${planZelle}</td>` +
      `<td>${igOn || liOn ? `${igN + liN}${liOn ? ` <span class="leise">(IG ${igN} · LI ${liN})</span>` : ""}` : "—"}</td>` +
      `<td>${w.reichweite == null ? "—" : fmt(w.reichweite)}</td>` +
      `<td>${w.views == null ? "—" : fmt(w.views)}</td>` +
      `<td>${w.interaktionen == null ? "—" : fmt(w.interaktionen)}</td>`;
    body.appendChild(tr);
  }
  tab.appendChild(body);
  const scroll = document.createElement("div");
  scroll.className = "wochen-scroll";
  scroll.appendChild(tab);
  wrap.appendChild(scroll);
  if (!igOn) {
    const h = document.createElement("div");
    h.className = "abschnitt-unter";
    h.textContent = "Reichweite, Views und Interaktionen erscheinen, sobald Instagram verbunden ist.";
    wrap.appendChild(h);
  }
  return wrap;
}

// Ohne Instagram: dieselben Wochen-Zeilen (Mo–So) ohne Konto-Werte.
function letzteWochenLeer(anzahl) {
  const heute = isoDatum(new Date());
  const m0 = montagVon(heute);
  return Array.from({ length: anzahl }, (_, i) => {
    const von = plusTage(m0, -7 * i);
    return { von, bis: plusTage(von, 6), laeuft: i === 0, reichweite: null, views: null, interaktionen: null };
  });
}

// ISO-Kalenderwoche (Donnerstag-Regel).
function kalenderwoche(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

const kurzTag = (iso) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;

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
        `<span>${vergleich >= 0 ? "+" : ""}${String(vergleich).replace(".", ",")} % gegenüber dem Median</span></div>`
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
const proz1 = (n) => `${(Math.round(Number(n) * 10) / 10).toString().replace(".", ",")} %`;

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
