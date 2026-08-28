// Die Detailspalte: alles zu EINER Karte.
//
// Reihenfolge folgt dem Arbeitsweg, nicht der Datenstruktur: Was ist das · Wann ist es
// faellig · Was ist noch offen · Die Arbeit dieser Phase · Drive · Archiv.

import {
  PHASEN,
  TERMINE,
  SAEULEN,
  ZIELE,
  PLATTFORMEN,
  FORMATE,
  MASSE,
  DATEINAMEN,
  phase,
  naechstePhase,
  faelligkeit,
  tore,
  sperren,
  rueckwaertsplan,
  sprechzeit,
  saeuleName,
  plattformName,
  zielInfo,
  projektName,
} from "/lib/pipeline.js";
import {
  S,
  karte,
  aktiveKarte,
  speichere,
  zeichne,
  loescheKarte,
  driveScan,
  driveAnlegen,
  driveSpeichern,
  ki,
  melde,
  setStand,
} from "./store.js";
import {
  icon,
  statusChip,
  escape,
  knopf,
  feld,
  eingabe,
  textfeld,
  auswahl,
  gruppe,
  befundZeile,
  eigenschaft,
  fortschritt,
} from "./ui.js";

let schiebe = async () => {};
export const beiSchieben = (f) => (schiebe = f);

const KI_NAMEN = {
  recherche: "Recherche, Fokus und Hooks",
  skript: "Skript und Teleprompter",
  regieplan: "Regieplan und Metadaten",
  caption: "Captions je Plattform",
  ideen: "Ideen-Nachschub",
};

// Welche KI-Aktionen gehoeren in welche Phase?
const PHASEN_KI = {
  idee: ["recherche"],
  skript: ["skript", "regieplan"],
  caption: ["caption"],
};

export function zeichneDetail(el) {
  const k = aktiveKarte();
  if (!k) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  const p = phase(k.column);
  const stand = S.driveStand.get(k.id);
  const toreListe = tore(k, stand);

  el.innerHTML = "";

  // --- Kopf ---
  const kopf = document.createElement("div");
  kopf.className = "detail-kopf";
  kopf.innerHTML = `<span class="detail-phase">${escape(p.name)}</span>`;
  const zu = document.createElement("button");
  zu.className = "detail-schliessen";
  zu.setAttribute("aria-label", "Karte schliessen");
  zu.innerHTML = icon("schliessen");
  zu.addEventListener("click", () => {
    S.aktiv = null;
    zeichne();
  });
  kopf.appendChild(zu);
  el.appendChild(kopf);

  const koerper = document.createElement("div");
  koerper.className = "detail-koerper";
  el.appendChild(koerper);

  const merke = (pfad, wert, neuZeichnen = false) => {
    setzeTief(k, pfad, wert);
    speichere();
    if (neuZeichnen) zeichne();
  };

  // --- Worum geht es ---
  koerper.appendChild(blockStamm(k, merke));

  // --- Termine ---
  koerper.appendChild(blockTermine(k, merke));

  // --- Was ist offen ---
  koerper.appendChild(blockTore(k, toreListe, stand));

  // --- Die Arbeit dieser Phase ---
  const arbeit = blockPhase(k, toreListe, stand);
  if (arbeit) koerper.appendChild(arbeit);

  // --- Drive ---
  koerper.appendChild(blockDrive(k, stand));

  // --- Archiv ---
  if (k.ai && Object.keys(k.ai).length) koerper.appendChild(blockArchiv(k));

  // --- Weiter und Loeschen ---
  koerper.appendChild(blockAbschluss(k, toreListe));

  // Drive-Stand nachladen, falls noch nicht geschehen.
  if (!stand && k.title) {
    driveScan(k)
      .then(() => {
        if (S.aktiv === k.id) zeichne();
      })
      .catch(() => {});
  }
}

// --- Bloecke --------------------------------------------------------------

function blockStamm(k, merke) {
  const g = gruppe("Worum geht es", null, true);
  const box = document.createElement("div");

  const titel = eingabe(k.title, { platzhalter: "Thema in einem Halbsatz" });
  titel.addEventListener("input", () => merke("title", titel.value));
  titel.addEventListener("change", () => zeichne());
  box.appendChild(feld("Thema", titel));

  const reihe = document.createElement("div");
  reihe.className = "feld-reihe";
  const serie = eingabe(k.serie, { platzhalter: "z. B. ProjectOasis" });
  serie.addEventListener("change", () => merke("serie", serie.value, true));
  const episode = eingabe(k.episode, { platzhalter: "01" });
  episode.addEventListener("change", () => merke("episode", episode.value, true));
  const format = auswahl(FORMATE, k.format);
  format.addEventListener("change", () => merke("format", format.value, true));
  reihe.appendChild(feld("Reihe", serie));
  const epFeld = feld("Episode", episode);
  epFeld.classList.add("feld-schmal");
  reihe.appendChild(epFeld);
  reihe.appendChild(feld("Format", format));
  box.appendChild(reihe);

  const saeule = auswahl(SAEULEN, k.pillar, { leerText: "— keine Saeule gewaehlt —" });
  saeule.addEventListener("change", () => merke("pillar", saeule.value, true));
  box.appendChild(
    feld(
      "Content-Saeule",
      saeule,
      k.pillar ? (SAEULEN.find((s) => s.id === k.pillar) || {}).satz : "Ohne Saeule laesst sich nicht messen, welche Richtung traegt."
    )
  );

  const ziel = auswahl(ZIELE, k.goal);
  ziel.addEventListener("change", () => merke("goal", ziel.value, true));
  box.appendChild(
    feld("Ziel dieses Videos", ziel, `Gemessen wird an: ${zielInfo(k.goal).kennzahl}. ${zielInfo(k.goal).satz}`)
  );

  const plattformen = document.createElement("div");
  plattformen.className = "schalterreihe";
  for (const pl of PLATTFORMEN) {
    const an = (k.platforms || []).includes(pl.id);
    const l = document.createElement("label");
    l.className = "schalter" + (an ? " an" : "");
    l.innerHTML = `<input type="checkbox" ${an ? "checked" : ""}><span>${escape(pl.name)}</span>`;
    l.querySelector("input").addEventListener("change", (e) => {
      const liste = new Set(k.platforms || []);
      e.target.checked ? liste.add(pl.id) : liste.delete(pl.id);
      merke("platforms", [...liste], true);
    });
    plattformen.appendChild(l);
  }
  box.appendChild(feld("Plattformen", plattformen, "Hashtag- und Laengen-Regeln unterscheiden sich je Plattform."));

  const wer = eingabe(k.owner, { platzhalter: "Wer macht das?" });
  wer.addEventListener("change", () => merke("owner", wer.value));
  box.appendChild(feld("Verantwortlich", wer));

  const notizen = textfeld(k.notes, 4, "Was gehoert noch dazu?");
  notizen.addEventListener("change", () => merke("notes", notizen.value));
  box.appendChild(feld("Notizen", notizen));

  g.appendChild(box);
  return g;
}

function blockTermine(k, merke) {
  const f = faelligkeit(k);
  const g = gruppe("Termine", null, true);
  const box = document.createElement("div");

  const satz = document.createElement("div");
  satz.className = "befund";
  satz.innerHTML = statusChip(f.status) + `<span class="befund-satz">${escape(f.satz)}</span>`;
  box.appendChild(satz);

  for (const t of TERMINE) {
    const zeile = document.createElement("div");
    zeile.className = "feld-reihe";
    const datum = eingabe((k.dates || {})[t.key] || "", { typ: "date" });
    datum.addEventListener("change", () => {
      const neu = { ...(k.dates || {}) };
      if (datum.value) neu[t.key] = datum.value;
      else delete neu[t.key];
      merke("dates", neu, true);
    });
    zeile.appendChild(feld(t.name, datum));
    if (t.key === "upload") {
      const zeit = eingabe(k.uploadTime || "", { typ: "time" });
      zeit.addEventListener("change", () => merke("uploadTime", zeit.value, true));
      const zf = feld("Uhrzeit", zeit);
      zf.classList.add("feld-schmal");
      zeile.appendChild(zf);
    }
    box.appendChild(zeile);
  }

  const plan = knopf("Rueckwaertsplan aus dem Upload-Datum", {
    zeichen: "kalender",
    titel: "Setzt Idee, Skript, Dreh, Schnitt und Freigabe rueckwaerts vom Veroeffentlichungsdatum.",
    klick: () => {
      const upload = (k.dates || {}).upload;
      if (!upload) {
        melde("hinweis", "Setz zuerst das Veroeffentlichungsdatum — daraus rechnet der Plan rueckwaerts.");
        return;
      }
      merke("dates", { ...rueckwaertsplan(upload), ...{ upload } }, true);
      setStand("Die uebrigen Termine stehen jetzt rueckwaerts vom Upload-Datum.");
    },
  });
  plan.classList.add("knopf-breit");
  box.appendChild(plan);

  g.appendChild(box);
  return g;
}

function blockTore(k, toreListe, stand) {
  const offen = toreListe.filter((t) => t.status !== "ok").length;
  const g = gruppe("Was noch offen ist", offen, offen > 0);
  const box = document.createElement("div");

  if (!toreListe.length) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = "In dieser Phase gibt es nichts automatisch zu pruefen.";
    box.appendChild(p);
  } else {
    const liste = document.createElement("ul");
    liste.className = "befundliste";
    for (const t of toreListe) liste.appendChild(befundZeile(t.status, t.satz, t.quelle));
    box.appendChild(liste);
  }

  if (stand && !stand.driveOk) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = stand.satz;
    box.appendChild(p);
  }

  g.appendChild(box);
  return g;
}

// Die Arbeit der aktuellen Phase: KI-Aktionen, Auswahl, Felder.
function blockPhase(k, toreListe, stand) {
  const p = phase(k.column);
  const g = gruppe(`Arbeit in "${p.name}"`, null, true);
  const box = document.createElement("div");

  const merke = (pfad, wert, neu = false) => {
    setzeTief(k, pfad, wert);
    speichere();
    if (neu) zeichne();
  };

  // KI-Aktionen dieser Phase
  const aufgaben = PHASEN_KI[k.column] || [];
  if (aufgaben.length) {
    const hinweis = document.createElement("p");
    hinweis.className = "feld-hinweis";
    hinweis.textContent =
      "Die KI laeuft lokal ueber deine Claude-CLI — dein Abo, keine API-Kosten. Die Marken- und Praxis-Regeln stecken im Vorspann.";
    box.appendChild(hinweis);

    const reihe = document.createElement("div");
    reihe.className = "knopfreihe";
    for (const task of aufgaben) {
      reihe.appendChild(
        knopf(KI_NAMEN[task] || task, {
          art: "haupt",
          zeichen: "funken",
          klick: (e) => rufeKi(task, k, e.currentTarget, box),
        })
      );
    }
    box.appendChild(reihe);
  }

  if (k.column === "idee") auswahlFokusHook(k, box, merke);
  if (k.column === "skript") felderSkript(k, box, merke);
  if (k.column === "videodreh") felderDreh(k, box, merke);
  if (k.column === "schnitt") felderSchnitt(k, box, merke);
  if (k.column === "caption") felderCaption(k, box, merke);
  if (k.column === "upload") felderUpload(k, box, merke);
  if (k.column === "fertig") {
    const p2 = document.createElement("p");
    p2.className = "feld-hinweis";
    p2.textContent = "Diese Karte ist veroeffentlicht. Die Zahlen dazu stehen unter „Auswertung“.";
    box.appendChild(p2);
  }

  g.appendChild(box);
  return g;
}

// --- Phasen-Felder --------------------------------------------------------

function auswahlFokusHook(k, box, merke) {
  const r = k.recherche;
  if (!r) return;
  if (r.raw || !Array.isArray(r.fokus) || !Array.isArray(r.hooks)) {
    const pre = document.createElement("pre");
    pre.className = "textblock";
    pre.textContent = r.raw || JSON.stringify(r, null, 2);
    box.appendChild(pre);
    return;
  }

  if (r.zusammenfassung) {
    const d = document.createElement("details");
    d.className = "gruppe";
    d.innerHTML = `<summary class="gruppe-kopf"><span class="gruppe-titel">Recherche und Hard Facts</span></summary>`;
    const pre = document.createElement("pre");
    pre.className = "textblock";
    pre.textContent = r.zusammenfassung;
    d.appendChild(pre);
    box.appendChild(d);
  }

  box.appendChild(
    wahlgruppe(
      "Fokus",
      r.fokus.map((f, i) => ({ i, titel: f.titel, text: f.text })),
      k.chosenFokus,
      (i) => merke("chosenFokus", i, true)
    )
  );

  box.appendChild(
    wahlgruppe(
      "Hook — gesprochen und sichtbar",
      r.hooks.map((h, i) => ({
        i,
        titel: h.label,
        text: `Gesprochen: ${h.verbal}\nSichtbar: ${h.visuell}`,
      })),
      k.chosenHook,
      (i) => {
        const h = r.hooks[i];
        setzeTief(k, "chosenHook", i);
        setzeTief(k, "hook", { text: h.verbal || "", visual: h.visuell || "" });
        speichere();
        zeichne();
      }
    )
  );

  if (r.frame && (r.frame.problem || r.frame.solution) && !(k.frame && k.frame.problem)) {
    box.appendChild(
      knopf("Problem und Handlung aus der Recherche uebernehmen", {
        zeichen: "check",
        klick: () => merke("frame", { problem: r.frame.problem || "", solution: r.frame.solution || "" }, true),
      })
    );
  }
  if (Array.isArray(r.keywords) && r.keywords.length && !(k.caption.keywords || []).length) {
    box.appendChild(
      knopf(`${r.keywords.length} Suchbegriffe uebernehmen`, {
        zeichen: "check",
        klick: () => merke("caption.keywords", r.keywords, true),
      })
    );
  }
}

function felderSkript(k, box, merke) {
  const hookText = eingabe((k.hook && k.hook.text) || "", { platzhalter: "Der gesprochene Einstieg" });
  hookText.addEventListener("change", () => merke("hook.text", hookText.value, true));
  box.appendChild(
    feld(
      "Hook, gesprochen",
      hookText,
      `Hoechstens etwa ${MASSE.hookWoerterMax} Woerter — Instagram misst die Abbruchquote bei ${MASSE.hookSekunden} Sekunden.`
    )
  );

  const hookBild = eingabe((k.hook && k.hook.visual) || "", { platzhalter: "Was sieht man in Sekunde 0 bis 1?" });
  hookBild.addEventListener("change", () => merke("hook.visual", hookBild.value, true));
  box.appendChild(feld("Hook, sichtbar", hookBild, "Vier von fuenf schauen ohne Ton — das Bild muss den Hook allein tragen."));

  const problem = textfeld((k.frame && k.frame.problem) || "", 2, "Was ist konkret kaputt?");
  problem.addEventListener("change", () => merke("frame.problem", problem.value, true));
  box.appendChild(feld("Problem", problem));

  const loesung = textfeld((k.frame && k.frame.solution) || "", 2, "Was kann jemand konkret tun oder sehen?");
  loesung.addEventListener("change", () => merke("frame.solution", loesung.value, true));
  box.appendChild(
    feld("Handlung", loesung, "Beides zusammen ist der belegte Kompromiss: Problem bringt Reichweite, Handlung bringt Vertrauen.")
  );

  const text = k.skriptFinal || (k.ai && k.ai.skript) || "";
  const skript = textfeld(text, 10, "Der Sprechertext, wie er vorgelesen wird");
  const zaehler = document.createElement("p");
  zaehler.className = "zaehler";
  const zaehle = () => {
    const s = sprechzeit(skript.value);
    zaehler.textContent = `Etwa ${s} Sekunden Sprechzeit — die Hausregel liegt bei ${MASSE.sprechzeitMax}.`;
    zaehler.classList.toggle("zuviel", s > MASSE.sprechzeitMax);
  };
  zaehle();
  skript.addEventListener("input", zaehle);
  skript.addEventListener("change", () => merke("skriptFinal", skript.value, true));
  box.appendChild(feld("Finales Skript", skript));
  box.appendChild(zaehler);

  const reihe = document.createElement("div");
  reihe.className = "knopfreihe";
  if (k.ai && k.ai.skript)
    reihe.appendChild(
      knopf("Entwurf der KI uebernehmen", {
        klick: () => {
          skript.value = k.ai.skript;
          zaehle();
          merke("skriptFinal", skript.value, true);
        },
      })
    );
  reihe.appendChild(
    knopf("Skript nach Drive speichern", {
      zeichen: "ordner",
      klick: async (e) => {
        await nachDrive(k, DATEINAMEN.skript, skript.value, e.currentTarget, box);
        setzeTief(k, "skriptGespeichert", true);
        speichere();
        zeichne();
      },
    })
  );
  box.appendChild(reihe);
}

function felderDreh(k, box, merke) {
  box.appendChild(
    schalterFeld(k, box, merke, [
      ["video.speakerOnCamera", "Jemand spricht vor der Kamera"],
      ["video.directGaze", "Es gibt eine Einstellung mit Blick in die Kamera"],
    ])
  );
  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.textContent =
    "Beides ist bei NGO-Inhalten belegt wirksam: Blick in die Kamera hebt die Interaktion, Fachleute schlagen den institutionellen Absender.";
  box.appendChild(hinweis);
}

function felderSchnitt(k, box, merke) {
  const sek = eingabe((k.video && k.video.seconds) || "", { typ: "number" });
  sek.addEventListener("change", () => merke("video.seconds", Number(sek.value) || 0, true));
  box.appendChild(feld("Laenge in Sekunden", sek));

  box.appendChild(
    schalterFeld(k, box, merke, [
      ["video.hasCaptions", "Das Video hat Untertitel"],
      ["video.watermarkFree", "Der Export traegt kein fremdes Wasserzeichen"],
    ])
  );
  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.textContent =
    "Beides sperrt: ohne Untertitel geht die Haelfte der Wirkung verloren, und ein TikTok- oder CapCut-Wasserzeichen kostet auf Instagram die gesamte Reichweite bei Nicht-Followern.";
  box.appendChild(hinweis);
}

function felderCaption(k, box, merke) {
  const c = k.caption || {};

  if (k.captionVorschlag && Array.isArray(k.captionVorschlag.varianten)) {
    box.appendChild(
      wahlgruppe(
        "Caption-Varianten",
        k.captionVorschlag.varianten.map((v, i) => ({
          i,
          titel: plattformName(v.plattform),
          text: `${v.lead || ""}\n\n${v.body || ""}`.trim(),
        })),
        k.chosenCaption,
        (i) => {
          const v = k.captionVorschlag.varianten[i];
          setzeTief(k, "chosenCaption", i);
          setzeTief(k, "caption.lead", (v.lead || "").slice(0, MASSE.captionLeadMax));
          setzeTief(k, "caption.body", v.body || "");
          if (k.captionVorschlag.keywords) setzeTief(k, "caption.keywords", k.captionVorschlag.keywords);
          if (k.captionVorschlag.hashtags) setzeTief(k, "caption.hashtags", k.captionVorschlag.hashtags);
          if (k.captionVorschlag.cta) setzeTief(k, "cta", k.captionVorschlag.cta);
          speichere();
          zeichne();
        }
      )
    );
  }

  const lead = textfeld(c.lead || "", 3, "Kernaussage plus Suchbegriff");
  const zaehler = document.createElement("p");
  zaehler.className = "zaehler";
  const zaehle = () => {
    const n = lead.value.length;
    zaehler.textContent = `${n} von ${MASSE.captionLeadMax} Zeichen.`;
    const zuviel = n > MASSE.captionLeadMax;
    zaehler.classList.toggle("zuviel", zuviel);
    lead.classList.toggle("zuviel", zuviel);
  };
  zaehle();
  lead.addEventListener("input", zaehle);
  lead.addEventListener("change", () => merke("caption.lead", lead.value, true));
  box.appendChild(
    feld(
      "Vorspann",
      lead,
      "Der einzige garantiert sichtbare Teil — und seit Juli 2025 der Ausschnitt, den Google zeigt."
    )
  );
  box.appendChild(zaehler);

  const body = textfeld(c.body || "", 6, "Der Rest der Caption");
  body.addEventListener("change", () => merke("caption.body", body.value, true));
  box.appendChild(feld("Caption-Text", body));

  const cta = eingabe((k.cta && k.cta.text) || "", { platzhalter: "Genau ein Aufruf, indirekt formuliert" });
  cta.addEventListener("change", () => merke("cta.text", cta.value, true));
  box.appendChild(
    feld("Aufruf zum Handeln", cta, "Genau einer. Indirekt wirkt bei NGO-Inhalten belegt besser als direkt. Nie um Likes bitten.")
  );

  const keys = eingabe((c.keywords || []).join(", "), { platzhalter: "drei bis sechs Begriffe, kommagetrennt" });
  keys.addEventListener("change", () =>
    merke("caption.keywords", keys.value.split(",").map((s) => s.trim()).filter(Boolean), true)
  );
  box.appendChild(feld("Suchbegriffe", keys, "Sie ersetzen die Auffindbarkeit, die Hashtags nie hatten."));

  for (const pl of k.platforms || []) {
    const tags = ((c.hashtags || {})[pl] || []).join(" ");
    const e = eingabe(tags, { platzhalter: "#WorldEdenEra #ProjectOasis" });
    e.addEventListener("change", () => {
      const neu = { ...(k.caption.hashtags || {}) };
      neu[pl] = e.value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
      merke("caption.hashtags", neu, true);
    });
    const info =
      pl === "instagram"
        ? "Hoechstens fuenf sind erlaubt, hoechstens zwei sind empfohlen."
        : pl === "tiktok"
        ? "Hier wirken Hashtags gegenlaeufig zu Instagram: mindestens einer."
        : "";
    box.appendChild(feld(`Hashtags fuer ${plattformName(pl)}`, e, info));
  }

  box.appendChild(
    knopf("Caption nach Drive speichern", {
      zeichen: "ordner",
      klick: (e) =>
        nachDrive(
          k,
          DATEINAMEN.caption,
          `${c.lead || ""}\n\n${c.body || ""}\n\n${(k.cta && k.cta.text) || ""}\n\n` +
            Object.entries(c.hashtags || {})
              .map(([p, t]) => `${plattformName(p)}: ${(t || []).join(" ")}`)
              .join("\n"),
          e.currentTarget,
          box
        ),
    })
  );
}

function felderUpload(k, box, merke) {
  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.textContent =
    "Nach dem Veroeffentlichen den Link des Beitrags hier eintragen — nur so kommen die Zahlen spaeter an diese Karte zurueck.";
  box.appendChild(hinweis);

  for (const pl of k.platforms || []) {
    const wert = ((k.published || {})[pl] || {}).permalink || "";
    const e = eingabe(wert, { platzhalter: `Link des Beitrags auf ${plattformName(pl)}` });
    e.addEventListener("change", () => {
      const neu = { ...(k.published || {}) };
      if (e.value) neu[pl] = { ...(neu[pl] || {}), permalink: e.value };
      else delete neu[pl];
      merke("published", neu, true);
    });
    box.appendChild(feld(`Beitrag auf ${plattformName(pl)}`, e));
  }
}

// --- Drive ----------------------------------------------------------------

function blockDrive(k, stand) {
  const g = gruppe("Google Drive", null, true);
  const box = document.createElement("div");

  if (!k.title) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = "Setz zuerst ein Thema — daraus entsteht der Ordnername.";
    box.appendChild(p);
    g.appendChild(box);
    return g;
  }

  box.innerHTML = eigenschaft("Ordnername", escape(projektName(k)));

  if (!stand) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = "Drive wird gelesen …";
    box.appendChild(p);
  } else if (!stand.driveOk) {
    const z = document.createElement("div");
    z.className = "befund";
    z.innerHTML = statusChip("unlesbar") + `<span class="befund-satz">${escape(stand.satz)}</span>`;
    box.appendChild(z);
  } else if (!stand.vorhanden) {
    const z = document.createElement("div");
    z.className = "befund";
    z.innerHTML = statusChip("fehlt") + `<span class="befund-satz">${escape(stand.satz)}</span>`;
    box.appendChild(z);
    box.appendChild(
      knopf("Projektordner in Drive anlegen", {
        art: "haupt",
        zeichen: "ordner",
        klick: async (e) => {
          const weg = fortschritt(box, "Lege den Projektordner an …");
          e.currentTarget.disabled = true;
          try {
            await driveAnlegen(k);
            await driveScan(k, true);
            zeichne();
          } catch (fehler) {
            await melde("befund", `Der Ordner liess sich nicht anlegen: ${fehler.message}`);
          } finally {
            weg();
          }
        },
      })
    );
  } else {
    const z = document.createElement("div");
    z.className = "befund";
    z.innerHTML = statusChip(stand.verschoben ? "hinweis" : "ok") + `<span class="befund-satz">${escape(stand.satz)}</span>`;
    box.appendChild(z);

    const zahlen = document.createElement("div");
    zahlen.innerHTML =
      eigenschaft("Rohmaterial", `${stand.rohmaterial} Dateien`) +
      eigenschaft("Fertiges Video", `${stand.final} Videos`) +
      eigenschaft("Skript und Caption", `${(stand.skriptDateien || []).length} Dateien`);
    box.appendChild(zahlen);

    const links = document.createElement("div");
    links.className = "drive-links";
    for (const [name, url] of Object.entries(stand.links || {})) {
      if (!url) continue;
      const a = document.createElement("a");
      a.className = "drive-link";
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = icon("extern") + `<span>${escape(name === "_projekt" ? "Projektordner" : name)}</span>`;
      links.appendChild(a);
    }
    if (links.children.length) box.appendChild(links);
  }

  box.appendChild(
    knopf("Drive erneut lesen", {
      zeichen: "neuladen",
      klick: async () => {
        await driveScan(k, true).catch(() => {});
        zeichne();
      },
    })
  );

  g.appendChild(box);
  return g;
}

// --- Archiv ---------------------------------------------------------------

function blockArchiv(k) {
  const eintraege = Object.keys(k.ai);
  const g = gruppe("Gespeicherte KI-Ergebnisse", eintraege.length, false);
  const box = document.createElement("div");
  for (const task of eintraege) {
    const text = k.ai[task] || "";
    const d = document.createElement("details");
    d.className = "gruppe";
    let name = KI_NAMEN[task] || task;
    if (task === "skript") name += ` — etwa ${sprechzeit(text)} Sekunden`;
    d.innerHTML = `<summary class="gruppe-kopf"><span class="gruppe-titel">${escape(name)}</span></summary>`;
    const pre = document.createElement("pre");
    pre.className = "textblock";
    pre.textContent = text;
    d.appendChild(pre);
    const reihe = document.createElement("div");
    reihe.className = "knopfreihe";
    reihe.appendChild(
      knopf("Kopieren", {
        klick: async (e) => {
          try {
            await navigator.clipboard.writeText(text);
            e.currentTarget.querySelector("span").textContent = "Kopiert";
            setTimeout(() => (e.currentTarget.querySelector("span").textContent = "Kopieren"), 1400);
          } catch {
            melde("hinweis", "Der Browser hat das Kopieren nicht erlaubt.");
          }
        },
      })
    );
    d.appendChild(reihe);
    box.appendChild(d);
  }
  g.appendChild(box);
  return g;
}

// --- Abschluss ------------------------------------------------------------

function blockAbschluss(k, toreListe) {
  const box = document.createElement("div");
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.gap = "10px";

  const ziel = naechstePhase(k.column);
  if (ziel) {
    const blockiert = sperren(toreListe);
    const weiter = knopf(`Weiter zu ${phase(ziel).name}`, {
      art: "haupt",
      zeichen: "weiter",
      klick: async () => {
        if (blockiert.length) {
          await melde(
            "befund",
            `Die Karte kann noch nicht weiter: ${blockiert.map((b) => b.satz).join(" ")}`
          );
          return;
        }
        await schiebe(k, ziel);
      },
    });
    weiter.classList.add("knopf-breit");
    if (blockiert.length) {
      weiter.disabled = true;
      weiter.title = blockiert.map((b) => b.satz).join(" ");
    }
    box.appendChild(weiter);
    if (blockiert.length) {
      const p = document.createElement("p");
      p.className = "feld-hinweis";
      p.textContent = `${blockiert.length} Punkt${blockiert.length === 1 ? "" : "e"} halten die Karte auf — sie stehen oben unter „Was noch offen ist“.`;
      box.appendChild(p);
    }
  }

  box.appendChild(
    knopf("Diese Karte loeschen", {
      art: "gefahr",
      zeichen: "muell",
      klick: () => {
        if (confirm(`"${k.title}" wirklich loeschen? Der Drive-Ordner bleibt bestehen.`)) loescheKarte(k.id);
      },
    })
  );
  return box;
}

// --- Hilfen ---------------------------------------------------------------

function wahlgruppe(name, optionen, gewaehlt, beiWahl) {
  const wrap = document.createElement("div");
  wrap.className = "feld";
  const l = document.createElement("span");
  l.className = "feld-label";
  l.textContent = name;
  wrap.appendChild(l);

  const box = document.createElement("div");
  box.className = "wahl";
  for (const o of optionen) {
    const label = document.createElement("label");
    label.className = "wahl-option" + (gewaehlt === o.i ? " gewaehlt" : "");
    label.innerHTML =
      `<span class="wahl-text"><span class="wahl-titel">${escape(o.titel || "")}</span>${escape(o.text || "")}</span>`;
    label.addEventListener("click", (e) => {
      e.preventDefault();
      beiWahl(o.i);
    });
    box.appendChild(label);
  }
  wrap.appendChild(box);
  return wrap;
}

function schalterFeld(k, box, merke, paare) {
  const reihe = document.createElement("div");
  reihe.className = "schalterreihe";
  for (const [pfad, text] of paare) {
    const an = !!leseTief(k, pfad);
    const l = document.createElement("label");
    l.className = "schalter" + (an ? " an" : "");
    l.innerHTML = `<input type="checkbox" ${an ? "checked" : ""}><span>${escape(text)}</span>`;
    l.querySelector("input").addEventListener("change", (e) => merke(pfad, e.target.checked, true));
    reihe.appendChild(l);
  }
  return reihe;
}

async function rufeKi(task, k, knopfEl, box) {
  const alle = box.querySelectorAll(".knopf");
  alle.forEach((b) => (b.disabled = true));
  const weg = fortschritt(box, `${KI_NAMEN[task] || task} wird erstellt — das dauert eine Weile.`);
  try {
    const antwort = await ki(task, {
      title: k.title,
      notes: k.notes,
      serie: k.serie,
      episode: k.episode,
      format: k.format,
      pillar: k.pillar,
      goal: k.goal,
      platforms: k.platforms,
      frame: k.frame,
      hook: k.hook,
      seriesSiblings: S.cards
        .filter((c) => c.id !== k.id && c.serie && c.serie === k.serie)
        .map((c) => c.title || "(ohne Titel)"),
    });
    if (task === "recherche") setzeTief(k, "recherche", antwort.data || { raw: antwort.text || "" });
    else if (task === "caption") setzeTief(k, "captionVorschlag", antwort.data || { raw: antwort.text || "" });
    else {
      k.ai = k.ai || {};
      k.ai[task] = antwort.text || "";
      if (task === "skript" && !k.skriptFinal) k.skriptFinal = antwort.text || "";
    }
    await speichere();
    zeichne();
  } catch (e) {
    await melde("befund", (e.daten && e.daten.hint) || e.message);
  } finally {
    weg();
    alle.forEach((b) => (b.disabled = false));
  }
}

async function nachDrive(k, dateiname, inhalt, knopfEl, box) {
  const weg = fortschritt(box, "Speichere nach Drive …");
  if (knopfEl) knopfEl.disabled = true;
  try {
    const r = await driveSpeichern(k, dateiname, inhalt);
    setStand(`Gespeichert: ${r.pfad}`);
    await driveScan(k, true).catch(() => {});
    zeichne();
  } catch (e) {
    await melde("befund", `Speichern nach Drive ging nicht: ${e.message}`);
  } finally {
    weg();
    if (knopfEl) knopfEl.disabled = false;
  }
}

// Setzt und liest verschachtelte Felder ueber einen Pfad wie "caption.lead".
function setzeTief(objekt, pfad, wert) {
  const teile = pfad.split(".");
  let ziel = objekt;
  for (const t of teile.slice(0, -1)) {
    if (!ziel[t] || typeof ziel[t] !== "object") ziel[t] = {};
    ziel = ziel[t];
  }
  ziel[teile[teile.length - 1]] = wert;
}

function leseTief(objekt, pfad) {
  return pfad.split(".").reduce((o, t) => (o == null ? o : o[t]), objekt);
}
