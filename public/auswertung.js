// Auswertungs-Ansicht: die Zahlen nach der Veroeffentlichung — und was sie heissen.
//
// Zwei Regeln aus docs/best-practices.md stecken hier drin:
//   - Verglichen wird gegen den EIGENEN gleitenden Median, nicht gegen Branchenwerte aus
//     Blogs. Die kursierenden Benchmarks sind unbelegt.
//   - Welche Zahl zaehlt, haengt am Ziel der Karte: Weiterleitungen bewegen Nicht-Follower,
//     Likes bewegen den Bestand (Mosseri, 22.01.2025).
//
// Die Verbindung zu den Konten laeuft seit v9 inline hier, nicht mehr auf einer eigenen
// Seite: ein Klick fuehrt in den OAuth-Fluss (/api/auth/<plattform>), der Rueckweg landet
// wieder in dieser Ansicht (app.js liest die Rueckkehr-Parameter).

import { zielInfo, einordnung } from "/lib/pipeline.js";
import { S, instagramZahlen, linkedinZahlen, zeichne } from "./store.js";
import { icon, statusChip, escape, knopf, leer, gruppe, fortschritt } from "./ui.js";

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
        S.zahlenLi = null;
        zeichne();
      },
    })
  );
  el.appendChild(kopf);

  // --- Instagram ---
  if (S.zahlen === null) {
    const weg = fortschritt(el, "Hole die Zahlen von Instagram …");
    try {
      S.zahlen = await instagramZahlen();
    } catch (e) {
      S.zahlen = { verbunden: false, fehler: e.message };
    }
    weg();
  }
  el.appendChild(instagramBlock(S.zahlen || {}));

  // --- LinkedIn ---
  if (S.zahlenLi === null) {
    const weg = fortschritt(el, "Hole die Zahlen von LinkedIn …");
    try {
      S.zahlenLi = await linkedinZahlen();
    } catch (e) {
      S.zahlenLi = { verbunden: false, fehler: e.message };
    }
    weg();
  }
  el.appendChild(linkedinBlock(S.zahlenLi || {}));
}

// --- Verbinden -------------------------------------------------------------

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

// --- Instagram-Block -------------------------------------------------------

function instagramBlock(z) {
  const g = gruppe("Instagram", null, true);

  if (!z.verbunden) {
    g.appendChild(
      leer({
        zeichen: "saeulen",
        titel: "Instagram ist nicht verbunden",
        satz: "Ohne Verbindung gibt es keine Zahlen. Der Weg fuehrt einmal durch das Anmeldefenster von Instagram.",
        handlung: verbindenKnopf("instagram", "Instagram"),
      })
    );
    return g;
  }

  if (z.fehler) {
    g.appendChild(befund(z.hinweis || z.fehler));
    g.appendChild(verbindenKnopf("instagram", "Instagram"));
    return g;
  }

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
  g.appendChild(reihe);

  const liste = spalte();
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
  g.appendChild(liste);

  const fuss = document.createElement("p");
  fuss.className = "feld-hinweis";
  fuss.style.marginTop = "14px";
  fuss.textContent =
    "Verglichen wird gegen den eigenen gleitenden Median, nicht gegen Branchenwerte — die kursierenden Benchmarks sind unbelegt. " +
    "Trag den Link eines Beitrags in der Karte unter „Upload“ ein, damit er hier seiner Karte zugeordnet wird.";
  g.appendChild(fuss);
  return g;
}

// --- LinkedIn-Block --------------------------------------------------------

function linkedinBlock(z) {
  const g = gruppe("LinkedIn", null, true);

  if (!z.verbunden) {
    g.appendChild(
      leer({
        zeichen: "saeulen",
        titel: "LinkedIn ist nicht verbunden",
        satz: "Ohne Verbindung gibt es keine Zahlen. Der Weg fuehrt einmal durch das Anmeldefenster von LinkedIn.",
        handlung: verbindenKnopf("linkedin", "LinkedIn"),
      })
    );
    return g;
  }

  if (z.fehler) {
    g.appendChild(befund(z.hinweis || z.fehler));
    g.appendChild(verbindenKnopf("linkedin", "LinkedIn"));
    return g;
  }

  const konto = z.konto || {};
  const reihe = document.createElement("div");
  reihe.className = "zahlenreihe";
  reihe.innerHTML = zahlKachel(konto.follower, `Menschen folgen ${konto.name || "dem Konto"} auf LinkedIn.`);
  g.appendChild(reihe);

  const liste = spalte();
  for (const p of z.posts || []) {
    const zeile = document.createElement("article");
    zeile.className = "eintrag";
    const text = (p.text || "").split("\n")[0].slice(0, 90) || "(ohne Text)";
    zeile.innerHTML =
      `<div class="eintrag-titel">${escape(text)}</div>` +
      `<div class="eintrag-untertitel">${escape(
        p.erstellt ? `Veroeffentlicht am ${new Date(p.erstellt).toLocaleDateString("de-DE")}` : "Datum unbekannt"
      )}</div>` +
      `<div class="eintrag-fuss"><span class="eintrag-fuss-rechts">${escape(
        [p.likes != null ? `${p.likes} Likes` : null, p.kommentare != null ? `${p.kommentare} Kommentare` : null]
          .filter(Boolean)
          .join(" · ")
      )}</span></div>`;
    liste.appendChild(zeile);
  }

  if (!(z.posts || []).length)
    liste.appendChild(
      leer({ zeichen: "saeulen", titel: "Keine Beitraege gefunden", satz: "Das Konto ist verbunden, liefert aber keine Beitraege." })
    );
  g.appendChild(liste);
  return g;
}

// --- Hilfen ----------------------------------------------------------------

function spalte() {
  const d = document.createElement("div");
  d.style.display = "flex";
  d.style.flexDirection = "column";
  d.style.gap = "9px";
  return d;
}

function befund(satz) {
  const b = document.createElement("div");
  b.className = "befund";
  b.innerHTML = statusChip("befund") + `<span class="befund-satz">${escape(satz)}</span>`;
  return b;
}

function zahlKachel(wert, satz, einheit = "") {
  return (
    `<div class="zahl"><div class="zahl-wert">${wert == null ? "—" : escape(String(wert)) + einheit}</div>` +
    `<div class="zahl-satz">${escape(satz)}</div></div>`
  );
}

export { linkedinZahlen };
