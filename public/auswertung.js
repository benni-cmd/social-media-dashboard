// Auswertungs-Ansicht: die Zahlen nach der Veroeffentlichung — und was sie heissen.
//
// Zwei Regeln aus docs/best-practices.md stecken hier drin:
//   - Verglichen wird gegen den EIGENEN gleitenden Median, nicht gegen Branchenwerte aus
//     Blogs. Die kursierenden Benchmarks sind unbelegt.
//   - Welche Zahl zaehlt, haengt am Ziel der Karte: Weiterleitungen bewegen Nicht-Follower,
//     Likes bewegen den Bestand (Mosseri, 22.01.2025).

import { zielInfo, einordnung } from "/lib/pipeline.js";
import { S, instagramZahlen, linkedinZahlen, zeichne } from "./store.js";
import { icon, statusChip, escape, knopf, leer, fortschritt } from "./ui.js";

let oeffne = () => {};
export const beiOeffnen = (f) => (oeffne = f);

// Findet die Karte, deren veroeffentlichter Beitrag zu diesem Permalink gehoert.
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
        zeichne();
      },
    })
  );
  const zurVerbindung = document.createElement("a");
  zurVerbindung.className = "knopf knopf-still";
  zurVerbindung.href = "/analytics.html";
  zurVerbindung.innerHTML = icon("extern") + `<span>Konten verbinden</span>`;
  kopf.appendChild(zurVerbindung);
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
  const z = S.zahlen || {};

  if (!z.verbunden) {
    el.appendChild(
      leer({
        zeichen: "saeulen",
        titel: "Noch kein Konto verbunden",
        satz:
          "Ohne Verbindung zu Instagram oder LinkedIn gibt es keine Zahlen. Die Verbindung laeuft ueber die Seite „Konten verbinden“.",
      })
    );
    return;
  }

  if (z.fehler) {
    const b = document.createElement("div");
    b.className = "befund";
    b.innerHTML =
      statusChip("befund") + `<span class="befund-satz">${escape(z.hinweis || z.fehler)}</span>`;
    el.appendChild(b);
    return;
  }

  // Kontozahlen
  const konto = z.konto || {};
  const reihe = document.createElement("div");
  reihe.className = "zahlenreihe";
  reihe.innerHTML =
    zahlKachel(konto.followers_count, `Menschen folgen @${konto.username || "dem Konto"} auf Instagram.`) +
    zahlKachel(konto.media_count, "Beitraege liegen insgesamt auf dem Konto.") +
    zahlKachel(
      (z.median || {}).views,
      `Views im Median der letzten ${(z.median || {}).grundlage || 0} Beitraege — das ist die Vergleichslinie.`
    ) +
    zahlKachel(
      (z.median || {}).sendsProReichweite,
      "Prozent Weiterleitungen je Reichweite im Median — die Groesse, die Nicht-Follower bewegt.",
      "%"
    );
  el.appendChild(reihe);

  // Beitraege
  const liste = document.createElement("div");
  liste.style.display = "flex";
  liste.style.flexDirection = "column";
  liste.style.gap = "9px";

  for (const m of z.medien || []) {
    const k = karteZuBeitrag(m.permalink);
    const ziel = k ? zielInfo(k.goal) : zielInfo("reach_new");
    const e = einordnung(m, z.median, ziel.kennzahl);
    const kn = m.kennzahlen || {};

    const zeile = document.createElement("article");
    zeile.className = "eintrag";
    zeile.style.cursor = k ? "pointer" : "default";
    if (k) zeile.dataset.saeule = k.pillar || "";

    const text = (m.caption || "").split("\n")[0].slice(0, 90) || "(ohne Caption)";
    zeile.innerHTML =
      `<div class="eintrag-titel">${escape(k ? k.title : text)}</div>` +
      `<div class="eintrag-untertitel">${escape(
        `${m.media_product_type || m.media_type || "Beitrag"} vom ${
          m.timestamp ? new Date(m.timestamp).toLocaleDateString("de-DE") : "unbekannt"
        }${k ? "" : " — keiner Karte zugeordnet"}`
      )}</div>` +
      `<div class="eintrag-status">${statusChip(e.status)}<span>${escape(e.satz)}</span></div>` +
      `<div class="eintrag-fuss">` +
      `${icon("ziel")}<span>${escape(ziel.kennzahl)}</span>` +
      `<span class="eintrag-fuss-rechts">${escape(
        [
          kn.views != null ? `${kn.views} Views` : null,
          kn.sendsProReichweite != null ? `${kn.sendsProReichweite} % weitergeleitet` : null,
          kn.kommentare != null ? `${kn.kommentare} Kommentare` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      )}</span></div>`;

    if (k) zeile.addEventListener("click", () => oeffne(k.id));
    liste.appendChild(zeile);
  }

  if (!(z.medien || []).length)
    liste.appendChild(
      leer({ zeichen: "saeulen", titel: "Keine Beitraege gefunden", satz: "Das Konto ist verbunden, liefert aber keine Beitraege." })
    );

  el.appendChild(liste);

  const fuss = document.createElement("p");
  fuss.className = "feld-hinweis";
  fuss.style.marginTop = "14px";
  fuss.textContent =
    "Verglichen wird gegen den eigenen gleitenden Median, nicht gegen Branchenwerte — die kursierenden Benchmarks sind unbelegt. " +
    "Trag den Link eines Beitrags in der Karte unter „Upload“ ein, damit er hier seiner Karte zugeordnet wird.";
  el.appendChild(fuss);
}

function zahlKachel(wert, satz, einheit = "") {
  return (
    `<div class="zahl"><div class="zahl-wert">${wert == null ? "—" : escape(String(wert)) + einheit}</div>` +
    `<div class="zahl-satz">${escape(satz)}</div></div>`
  );
}

export { linkedinZahlen };
