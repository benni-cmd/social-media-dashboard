// Auswertungs-Ansicht (v100, neu gefasst): kompakt, verknuepft mit dem Board.
//
// Owner 01.10.2026: „kompakter bauen, bewaehrte Uebersichten rein, mit der Boardlogik verknuepfen" — und zur
// Wochenstatistik: weiter in die Vergangenheit, leichter ersichtlich was geplant / eingehalten / bedient wurde und was
// es brachte; Zahlen beim Beitrag statt in der Woche des Geschehens, mit Titel; Umschalter auf die bisherige Logik.
// Plan + Begruendung: docs/packages/v100-auswertung-kompakt.md
//
// Aufbau: Kopf (Zeitraum blaetterbar, Umschalter) · Kennzahlen-Leiste (mit Vergleich zum Vorzeitraum) · Wochen
// (aufklappbar je Beitrag) · Was traegt (Format/Kategorie/Ziel aus den Karten) · Sendezeit · Redaktionskalender.
// Datenehrlichkeit wie bisher: gezeigt wird nur, was aus echten Feldern kommt; Vergleich gegen die EIGENEN Werte
// (Branchen-Benchmarks sind unbelegt, docs/best-practices.md).

import { zielInfo, kategorieName, contenttypName } from "/lib/pipeline.js";
import { wocheGegenPlan, montagVon, plusTage, slotTyp } from "/lib/uploadslots.js";
import { S, linkedinZahlen } from "./store.js";
import { zeichneKalender } from "./kalender.js";
import { icon, escape, knopf, gruppe, sanduhr } from "./ui.js";

let oeffne = () => {};
export const beiOeffnen = (f) => (oeffne = f);

const WOCHEN = 8;
let vor = 0; // so viele Wochen zurueck beginnt die Seite (Blaettern)
const daten = new Map(); // vor -> Antwort von /api/stats/zeitraum
let laedt = null;
const MODUS_KEY = "cm-auswertung-modus";
const modus = () => { try { return localStorage.getItem(MODUS_KEY) || "beitrag"; } catch { return "beitrag"; } };
const setzeModus = (m) => { try { localStorage.setItem(MODUS_KEY, m); } catch {} };

// Post -> Karte: ueber die Zuordnung (v97, card.published[plattform].id), sonst ueber den Link.
function karteZuPost(p) {
  return S.cards.find((k) =>
    Object.values(k.published || {}).some((v) => v && (v.id === p.id || (v.url && p.url && p.url.startsWith(v.url.split("?")[0])))),
  ) || null;
}

const titelVon = (p, k) => (k ? k.title : (p.text || "").split("\n")[0].slice(0, 60) || "(ohne Text)");
const median = (a) => {
  const w = a.filter((x) => typeof x === "number").sort((x, y) => x - y);
  if (!w.length) return null;
  const m = Math.floor(w.length / 2);
  return w.length % 2 ? w[m] : (w[m - 1] + w[m]) / 2;
};
const summe = (a) => (a.some((x) => typeof x === "number") ? a.reduce((s, x) => s + (typeof x === "number" ? x : 0), 0) : null);
const er = (inter, reach) => (inter != null && reach ? (inter / reach) * 100 : null);
const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? "—" : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n));
const fmtProz = (n) => (n == null ? "—" : `${(Math.round(n * 10) / 10).toString().replace(".", ",")} %`);
const kurzTag = (iso) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
const TAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const zeitpunkt = (iso) => {
  const d = new Date(iso);
  return `${TAG[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
function kalenderwoche(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
const lokalesDatum = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// --- Seite --------------------------------------------------------------------

export async function zeichneAuswertung(el) {
  el.innerHTML = "";
  el.classList.add("ausw");
  const d = daten.get(vor);
  el.appendChild(kopf(el, d));

  if (!d) {
    const w = document.createElement("div");
    w.className = "ausw-laedt";
    w.appendChild(sanduhr("Hole Beiträge und Zahlen …"));
    el.appendChild(w);
    if (!laedt) {
      const meinVor = vor;
      laedt = fetch(`/api/stats/zeitraum?wochen=${WOCHEN}&vor=${meinVor}`)
        .then((r) => r.json())
        .then((j) => daten.set(meinVor, j))
        .catch((e) => daten.set(meinVor, { wochen: [], posts: [], error: e.message }))
        .finally(() => { laedt = null; zeichneAuswertung(el); });
    }
    return;
  }
  if (d.error) el.appendChild(hinweis(`Zahlen nicht vollständig: ${d.error}`));
  if (!d.instagram && !d.linkedin) {
    el.appendChild(hinweis("Kein Social-Media-Konto verbunden — Einstellungen → Social Media."));
    el.appendChild(verbindenKnopf("instagram", "Instagram"));
    return;
  }

  const z = zeitraum(d);
  el.appendChild(kennzahlen(z, d));
  el.appendChild(wochenUebersicht(z));
  const unten = document.createElement("div");
  unten.className = "ausw-zweispaltig";
  unten.appendChild(wasTraegt(d.posts));
  unten.appendChild(sendezeit(d.posts));
  el.appendChild(unten);
  const fuss = document.createElement("p");
  fuss.className = "ausw-fuss";
  fuss.textContent = "Verglichen wird gegen die eigenen Werte (Median, Vorzeitraum) — Branchenwerte sind unbelegt und bewusst nicht eingebaut. " +
    "Reichweite und Views je Beitrag sind Lebenszeit-Werte des Posts.";
  el.appendChild(fuss);
  const kal = gruppe("Redaktionskalender", null, false);
  const box = document.createElement("div");
  box.className = "kalender-widget";
  zeichneKalender(box);
  kal.appendChild(box);
  el.appendChild(kal);
}

function kopf(el, d) {
  const k = document.createElement("div");
  k.className = "ausw-kopf";
  const ersterMontag = montagVon(lokalesDatum(new Date().toISOString()));
  const neuester = plusTage(ersterMontag, -7 * vor);
  const aeltester = plusTage(neuester, -7 * (WOCHEN - 1));
  k.innerHTML = `<span class="ausw-titel">Auswertung</span>` +
    `<span class="ausw-zeitraum">KW ${kalenderwoche(aeltester)}–${kalenderwoche(neuester)} · ${kurzTag(aeltester)}–${kurzTag(plusTage(neuester, 6))}</span>`;
  const blaettern = document.createElement("div");
  blaettern.className = "ausw-blaettern";
  const aelter = knopf("‹ älter", { titel: `${WOCHEN} Wochen zurück`, klick: () => { vor += WOCHEN; zeichneAuswertung(el); } });
  const neuer = knopf("neuer ›", { titel: `${WOCHEN} Wochen vor`, klick: () => { vor = Math.max(0, vor - WOCHEN); zeichneAuswertung(el); } });
  neuer.disabled = vor === 0;
  blaettern.append(aelter, neuer);
  k.appendChild(blaettern);

  const umschalter = document.createElement("div");
  umschalter.className = "ausw-umschalter";
  for (const [id, text, tipp] of [
    ["beitrag", "je Beitrag", "Zahlen eines Beitrags zählen in der Woche, in der er veröffentlicht wurde"],
    ["woche", "je Kalenderwoche", "Konto-Zahlen der Woche, egal zu welchem Beitrag"],
  ]) {
    const b = document.createElement("button");
    b.className = "ausw-umschalt" + (modus() === id ? " aktiv" : "");
    b.textContent = text;
    b.title = tipp;
    b.addEventListener("click", () => { setzeModus(id); zeichneAuswertung(el); });
    umschalter.appendChild(b);
  }
  k.appendChild(umschalter);
  k.appendChild(knopf("Neu holen", {
    zeichen: "neuladen",
    klick: () => { daten.clear(); zeichneAuswertung(el); },
  }));
  return k;
}

// Aktueller Zeitraum vs. Vergleichszeitraum (die Antwort enthaelt 2 × WOCHEN Wochen, neueste zuerst).
function zeitraum(d) {
  const kontoWochen = d.wochen || [];
  const ersterMontag = montagVon(lokalesDatum(new Date().toISOString()));
  const wochen = Array.from({ length: 2 * WOCHEN }, (_, i) => {
    const von = plusTage(ersterMontag, -7 * (vor + i));
    const bis = plusTage(von, 6);
    const konto = kontoWochen.find((w) => w.von === von) || {};
    const posts = (d.posts || []).filter((p) => { const t = lokalesDatum(p.zeit); return t >= von && t <= bis; })
      .sort((a, b) => a.zeit.localeCompare(b.zeit))
      .map((p) => ({ ...p, karte: karteZuPost(p) }));
    const plan = S.plan ? wocheGegenPlan(S.plan, S.cards, von) : null;
    const offen = S.cards.filter((k) => {
      const u = (k.dates || {}).upload;
      return u && u >= von && u <= bis && k.column !== "verworfen" && !posts.some((p) => p.karte === k);
    });
    return { von, bis, laeuft: vor === 0 && i === 0, konto, posts, plan, offen };
  });
  return { aktuell: wochen.slice(0, WOCHEN), vorher: wochen.slice(WOCHEN) };
}

// Kennzahlen einer Wochenliste im gewaehlten Modus.
function werte(wochen) {
  if (modus() === "woche")
    return {
      views: summe(wochen.map((w) => w.konto.views)),
      reach: summe(wochen.map((w) => w.konto.reichweite)),
      inter: summe(wochen.map((w) => w.konto.interaktionen)),
    };
  const posts = wochen.flatMap((w) => w.posts);
  return { views: summe(posts.map((p) => p.views)), reach: summe(posts.map((p) => p.reach)), inter: summe(posts.map((p) => p.interaktionen)) };
}

function kennzahlen(z, d) {
  const a = werte(z.aktuell);
  const b = werte(z.vorher);
  const geplant = summe(z.aktuell.map((w) => (w.plan ? w.plan.sollGesamt : null)));
  const veroeffentlicht = z.aktuell.reduce((s, w) => s + w.posts.length, 0);
  const trend = (x, y) => (x == null || !y ? "" : `<span class="ausw-trend ${x >= y ? "hoch" : "runter"}">${x >= y ? "+" : ""}${Math.round(((x - y) / y) * 100)} %</span>`);
  const kachel = (label, wert, t = "") => `<div class="ausw-kz"><span class="ausw-kz-label">${escape(label)}</span><span class="ausw-kz-wert">${wert}</span>${t}</div>`;
  const leiste = document.createElement("div");
  leiste.className = "ausw-kennzahlen";
  leiste.innerHTML =
    kachel("Views", fmt(a.views), trend(a.views, b.views)) +
    kachel("Reichweite", fmt(a.reach), trend(a.reach, b.reach)) +
    kachel("Interaktionen", fmt(a.inter), trend(a.inter, b.inter)) +
    kachel("Engagement-Rate", fmtProz(er(a.inter, a.reach))) +
    kachel("Follower", fmt(d.follower)) +
    kachel("Plan-Treue", geplant ? `${veroeffentlicht} / ${geplant}` : "—",
      geplant ? `<span class="ausw-trend ${veroeffentlicht >= geplant ? "hoch" : "runter"}">${Math.round((veroeffentlicht / geplant) * 100)} %</span>` : "");
  return leiste;
}

// --- Wochen ---------------------------------------------------------------------

function wochenUebersicht(z) {
  const wrap = document.createElement("div");
  wrap.className = "ausw-block";
  wrap.innerHTML = `<div class="ausw-block-kopf">Wochen <span class="ausw-block-unter">${modus() === "woche"
    ? "Konto-Zahlen der Kalenderwoche" : "Zahlen der Beiträge, die in der Woche erschienen sind"} · Zeile anklicken für die Beiträge</span></div>`;
  const tab = document.createElement("table");
  tab.className = "ausw-tabelle";
  tab.innerHTML = `<thead><tr><th>Woche</th><th>Plan</th><th>Beiträge</th><th class="ausw-zahl">Views</th><th class="ausw-zahl">Reichweite</th><th class="ausw-zahl">Interakt.</th><th class="ausw-zahl">ER</th></tr></thead>`;
  const body = document.createElement("tbody");
  for (const w of z.aktuell) {
    const m = modus() === "woche"
      ? { views: w.konto.views, reach: w.konto.reichweite, inter: w.konto.interaktionen }
      : { views: summe(w.posts.map((p) => p.views)), reach: summe(w.posts.map((p) => p.reach)), inter: summe(w.posts.map((p) => p.interaktionen)) };
    const tr = document.createElement("tr");
    tr.className = "ausw-woche" + (w.laeuft ? " laeuft" : "");
    tr.innerHTML =
      `<td><b>KW ${kalenderwoche(w.von)}</b> <span class="leise">${kurzTag(w.von)}–${kurzTag(w.bis)}${w.laeuft ? " · läuft" : ""}</span></td>` +
      `<td>${planZelle(w)}</td>` +
      `<td class="ausw-chips">${w.posts.map((p) => `<span class="ausw-chip" title="${escape(titelVon(p, p.karte))}">${escape(kurz(titelVon(p, p.karte), 26))}</span>`).join("") ||
        (w.offen.length ? `<span class="leise">${w.offen.length} geplant, nicht erschienen</span>` : `<span class="leise">—</span>`)}</td>` +
      `<td class="ausw-zahl">${fmt(m.views)}</td><td class="ausw-zahl">${fmt(m.reach)}</td><td class="ausw-zahl">${fmt(m.inter)}</td><td class="ausw-zahl">${fmtProz(er(m.inter, m.reach))}</td>`;
    const detail = document.createElement("tr");
    detail.className = "ausw-detail";
    detail.hidden = true;
    const td = document.createElement("td");
    td.colSpan = 7;
    td.appendChild(wochenDetail(w));
    detail.appendChild(td);
    tr.addEventListener("click", () => { detail.hidden = !detail.hidden; tr.classList.toggle("offen", !detail.hidden); });
    body.append(tr, detail);
  }
  tab.appendChild(body);
  const scroll = document.createElement("div");
  scroll.className = "ausw-scroll";
  scroll.appendChild(tab);
  wrap.appendChild(scroll);
  return wrap;
}

const kurz = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

// Plan der Woche: Soll je Format aus dem Redaktionsplan gegen die ERSCHIENENEN Beitraege je Format.
function planZelle(w) {
  if (!w.plan || !w.plan.sollGesamt) return `<span class="leise">nichts geplant</span>`;
  const ist = {};
  for (const p of w.posts) { const t = slotTyp((p.karte && p.karte.contenttyp) || p.format || "reel"); ist[t] = (ist[t] || 0) + 1; }
  const fehlt = Object.entries(w.plan.soll).filter(([t, n]) => (ist[t] || 0) < n).map(([t, n]) => `${n - (ist[t] || 0)}× ${contenttypName(t)}`);
  const n = w.posts.length;
  if (w.laeuft && fehlt.length) return `<span class="leise">${n} / ${w.plan.sollGesamt} · läuft</span>`;
  return fehlt.length
    ? `<span class="ausw-luecke" title="fehlt: ${escape(fehlt.join(", "))}">${icon("warnung")} ${n} / ${w.plan.sollGesamt}</span>`
    : `<span class="ausw-ok">${icon("check")} ${n} / ${w.plan.sollGesamt}</span>`;
}

function wochenDetail(w) {
  const box = document.createElement("div");
  box.className = "ausw-wochendetail";
  if (!w.posts.length && !w.offen.length) { box.innerHTML = `<span class="leise">In dieser Woche ist nichts erschienen und nichts geplant.</span>`; return box; }
  for (const p of w.posts) {
    const k = p.karte;
    const geplant = k && (k.dates || {}).upload ? `geplant ${kurzTag(k.dates.upload)} ${k.uploadTime || ""}`.trim() : "";
    const z = document.createElement("div");
    z.className = "ausw-post";
    z.innerHTML =
      `<span class="ausw-post-titel">${escape(titelVon(p, k))}${k ? "" : ` <span class="leise">(ohne Karte)</span>`}</span>` +
      `<span class="leise">${escape([p.plattform === "linkedin" ? "LinkedIn" : "Instagram", contenttypName((k && k.contenttyp) || p.format || "reel"),
        zeitpunkt(p.zeit), geplant, k && k.kategorie ? kategorieName(k.kategorie) : "", k && k.goal ? zielInfo(k.goal).name : ""].filter(Boolean).join(" · "))}</span>` +
      `<span class="ausw-post-zahlen">${[["Views", p.views], ["Reichw.", p.reach], ["Likes", p.likes], ["Komm.", p.kommentare], ["Geteilt", p.geteilt], ["Gespeichert", p.gespeichert]]
        .map(([l, v]) => `<span><b>${fmt(v)}</b> ${l}</span>`).join("")}<span><b>${fmtProz(er(p.interaktionen, p.reach))}</b> ER</span></span>` +
      (p.url ? `<a href="${escape(p.url)}" target="_blank" rel="noopener">Post ↗</a>` : "");
    if (k) {
      z.classList.add("klickbar");
      z.title = "Karte öffnen";
      z.addEventListener("click", (e) => { if (e.target.tagName !== "A") oeffne(k.id); });
    }
    box.appendChild(z);
  }
  for (const k of w.offen) {
    const z = document.createElement("div");
    z.className = "ausw-post ausw-post-offen klickbar";
    z.innerHTML = `<span class="ausw-post-titel">${escape(k.title)}</span><span class="leise">geplant ${kurzTag(k.dates.upload)} ${k.uploadTime || ""} · ` +
      `${escape(contenttypName(k.contenttyp || "reel"))} · kein Post zugeordnet</span>`;
    z.addEventListener("click", () => oeffne(k.id));
    box.appendChild(z);
  }
  return box;
}

// --- Was traegt (Board-Logik) ----------------------------------------------------

function wasTraegt(posts) {
  const p = (posts || []).map((x) => ({ ...x, karte: karteZuPost(x) }));
  const wrap = document.createElement("div");
  wrap.className = "ausw-block";
  wrap.innerHTML = `<div class="ausw-block-kopf">Was trägt <span class="ausw-block-unter">Median je Beitrag, ${2 * WOCHEN} Wochen</span></div>`;
  const gruppiert = (fn) => {
    const m = new Map();
    for (const x of p) { const g = fn(x); if (!m.has(g)) m.set(g, []); m.get(g).push(x); }
    return [...m.entries()].map(([g, l]) => ({ g, n: l.length, views: median(l.map((x) => x.views)), er: median(l.map((x) => er(x.interaktionen, x.reach))) }))
      .sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  };
  const tabelle = (titel, zeilen) =>
    `<div class="ausw-mini"><div class="ausw-mini-titel">${escape(titel)}</div>` +
    zeilen.map((r) => `<div class="ausw-mini-zeile"><span>${escape(r.g)} <span class="leise">${r.n}</span></span><span>${fmt(r.views)}</span><span>${fmtProz(r.er)}</span></div>`).join("") +
    `</div>`;
  if (!p.length) { wrap.insertAdjacentHTML("beforeend", `<p class="leise">Keine Beiträge in diesem Zeitraum.</p>`); return wrap; }
  const ohne = "ohne Karte";
  wrap.insertAdjacentHTML("beforeend",
    `<div class="ausw-mini-kopf"><span></span><span>Views</span><span>ER</span></div>` +
    tabelle("Format", gruppiert((x) => contenttypName((x.karte && x.karte.contenttyp) || x.format || "reel"))) +
    tabelle("Kategorie", gruppiert((x) => (x.karte && x.karte.kategorie ? kategorieName(x.karte.kategorie) : ohne))) +
    tabelle("Ziel", gruppiert((x) => (x.karte && x.karte.goal ? zielInfo(x.karte.goal).name : ohne))));
  if (p.every((x) => !x.karte))
    wrap.insertAdjacentHTML("beforeend", `<p class="leise">Noch keinem Beitrag ist eine Karte zugeordnet — Kategorie und Ziel erscheinen, sobald Posts ihren Karten zugeordnet sind.</p>`);
  return wrap;
}

// --- Sendezeit ---------------------------------------------------------------------

function sendezeit(posts) {
  const wrap = document.createElement("div");
  wrap.className = "ausw-block";
  wrap.innerHTML = `<div class="ausw-block-kopf">Sendezeit <span class="ausw-block-unter">Median-Views je Tag und Zeitfenster</span></div>`;
  const fenster = (h) => (h < 11 ? "morgens" : h < 14 ? "mittags" : h < 18 ? "nachmittags" : "abends");
  const m = new Map();
  for (const p of posts || []) {
    const d = new Date(p.zeit);
    const g = `${TAG[d.getDay()]} ${fenster(d.getHours())}`;
    if (!m.has(g)) m.set(g, []);
    m.get(g).push(p.views);
  }
  const zeilen = [...m.entries()].map(([g, v]) => ({ g, n: v.length, views: median(v) })).sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  if (!zeilen.length) { wrap.insertAdjacentHTML("beforeend", `<p class="leise">Keine Beiträge in diesem Zeitraum.</p>`); return wrap; }
  const max = Math.max(...zeilen.map((z) => z.views || 0)) || 1;
  wrap.insertAdjacentHTML("beforeend", zeilen.map((z) =>
    `<div class="ausw-balken-zeile"><span>${escape(z.g)} <span class="leise">${z.n}</span></span>` +
    `<span class="ausw-balken"><span style="width:${Math.round(((z.views || 0) / max) * 100)}%"></span></span><span class="ausw-zahl">${fmt(z.views)}</span></div>`).join(""));
  wrap.insertAdjacentHTML("beforeend", `<p class="leise">Der Redaktionsplan wechselt die Uhrzeit wöchentlich (v95) — so entstehen Vergleichswerte.</p>`);
  return wrap;
}

// --- Hilfen -----------------------------------------------------------------------

function hinweis(satz) {
  const p = document.createElement("p");
  p.className = "ausw-hinweis";
  p.textContent = satz;
  return p;
}

function verbindenKnopf(plattform, name) {
  return knopf(`Mit ${name} verbinden`, { art: "haupt", zeichen: "extern", klick: () => { location.href = `/api/auth/${plattform}`; } });
}

export { linkedinZahlen };
