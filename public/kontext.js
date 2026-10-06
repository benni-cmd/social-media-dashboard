// Tab „Unternehmenskontext" (v33).
//
// Was die KI ueber die Firma wissen soll — ein Freitextfeld fuer Firma/Brand, beliebig viele
// Projekte mit eigenem Feld, und je Block Quellen: lokale Datei, lokaler Ordner, Drive-Datei,
// Drive-Ordner. Jede Quelle zeigt, was aus ihr tatsaechlich gelesen wird; eine Quelle, die
// nichts liefert, muss als solche zu sehen sein, sonst glaubt man, die KI kenne etwas, das sie
// nie bekommen hat.
//
// Der Inhalt steht bewusst in dieser eigenen Datei — ui.js bekommt nur den Einhaengepunkt.

import { icon, escape } from "./ui.js";

const ARTEN = [
  { id: "lokal-datei", name: "Lokale Datei", platz: "C:\\Users\\…\\marke.md" },
  { id: "lokal-ordner", name: "Lokaler Ordner", platz: "C:\\Users\\…\\Markenwissen" },
  { id: "drive-datei", name: "Drive-Datei", platz: "Kontext/_global/marke.md" },
  { id: "drive-ordner", name: "Drive-Ordner", platz: "Kontext/_global" },
];

const artName = (id) => (ARTEN.find((a) => a.id === id) || { name: id }).name;

async function hole(pfad, optionen) {
  const res = await fetch(pfad, optionen);
  const text = await res.text();
  let d = {};
  try { d = text ? JSON.parse(text) : {}; } catch { throw new Error(`Unerwartete Antwort (${res.status}).`); }
  if (!res.ok) throw new Error(d.error || `Der Server antwortete mit ${res.status}.`);
  return d;
}

const aendere = (body) =>
  hole("/api/kontext", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// --- Bausteine ---------------------------------------------------------------------------

// Ein Textfeld, das beim Verlassen speichert. Kein Speichern-Knopf: ein Feld, das man
// zumachen kann, ohne dass etwas passiert, verliert Text.
function textfeld(wert, platzhalter, beimSpeichern) {
  const feld = document.createElement("textarea");
  feld.className = "kontext-feld";
  feld.rows = 7;
  feld.value = wert || "";
  feld.placeholder = platzhalter;
  const status = document.createElement("div");
  status.className = "einst-ping-status";
  let gespeichert = feld.value;
  feld.addEventListener("blur", async () => {
    if (feld.value === gespeichert) return;
    status.textContent = "Speichere …";
    try {
      await beimSpeichern(feld.value);
      gespeichert = feld.value;
      status.textContent = "✅ gespeichert";
    } catch (e) {
      status.textContent = `❌ ${e.message}`;
    }
  });
  return { feld, status };
}

// v110: „Stil & KI-Verhalten" — zwei abhakbare Listen (So schreibst du / Vermeide) + Freitext.
// Gespeichert wird sofort beim Haken und beim Verlassen eines Textfelds (wie textfeld()); ohne
// Neuzeichnen, damit der Cursor bleibt, wo er ist. Wirkt in jedem KI-Prompt (lib/ai.js {{stilregeln}}).
function stilAbschnitt(stil) {
  const st = {
    positivHaken: (stil?.positivHaken || []).map((h) => ({ ...h })),
    vermeidenHaken: (stil?.vermeidenHaken || []).map((h) => ({ ...h })),
    freitext: stil?.freitext || "",
  };
  const box = document.createElement("div");
  box.className = "einst-abschnitt kontext-block stil-block";
  const titel = document.createElement("div");
  titel.className = "einst-label";
  titel.textContent = "Stil & KI-Verhalten";
  box.appendChild(titel);
  const hinweis = document.createElement("p");
  hinweis.className = "einst-provider-sub";
  hinweis.textContent =
    "Wie die KI schreiben soll und welche typischen KI-Schreibweisen sie vermeidet. Gilt fuer jeden " +
    "KI-Text; je Rolle laesst sich unter „KI-Rollen“ etwas ergaenzen.";
  box.appendChild(hinweis);
  const status = document.createElement("div");
  status.className = "einst-ping-status";

  async function sichern() {
    status.textContent = "Speichere …";
    try {
      await aendere({ was: "stil", stil: st });
      status.textContent = "✅ gespeichert";
    } catch (e) {
      status.textContent = `❌ ${e.message}`;
    }
  }

  function liste(schluessel, ueberschrift, praefix) {
    const wrap = document.createElement("div");
    wrap.className = "stil-liste";
    const kopf = document.createElement("div");
    kopf.className = "stil-liste-kopf";
    kopf.textContent = ueberschrift;
    wrap.appendChild(kopf);
    const zeilen = document.createElement("div");
    wrap.appendChild(zeilen);
    function zeichneZeilen() {
      zeilen.innerHTML = "";
      st[schluessel].forEach((h, i) => {
        const z = document.createElement("div");
        z.className = "stil-zeile";
        z.style.cssText = "display:flex;gap:6px;align-items:center;padding:2px 0";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = h.an !== false;
        cb.setAttribute("aria-label", `${ueberschrift}: ${h.text}`);
        cb.addEventListener("change", () => { h.an = cb.checked; sichern(); });
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = h.text;
        inp.style.cssText = "flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg1);color:var(--fg1);font-size:13px";
        inp.addEventListener("blur", () => {
          const t = inp.value.trim();
          if (t === h.text) return;
          if (!t) { st[schluessel].splice(i, 1); zeichneZeilen(); } else h.text = t;
          sichern();
        });
        const weg = document.createElement("button");
        weg.type = "button";
        weg.className = "chip";
        weg.textContent = "✕";
        weg.title = "Regel entfernen";
        weg.addEventListener("click", () => { st[schluessel].splice(i, 1); zeichneZeilen(); sichern(); });
        z.appendChild(cb);
        z.appendChild(inp);
        z.appendChild(weg);
        zeilen.appendChild(z);
      });
    }
    zeichneZeilen();
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "chip";
    plus.innerHTML = `${icon("plus")}<span>Regel hinzufuegen</span>`;
    plus.addEventListener("click", () => {
      st[schluessel].push({ id: praefix + Math.random().toString(36).slice(2, 8), text: "", an: true });
      zeichneZeilen();
      const felder = zeilen.querySelectorAll("input[type=text]");
      felder[felder.length - 1]?.focus();
    });
    wrap.appendChild(plus);
    return wrap;
  }

  box.appendChild(liste("positivHaken", "So schreibst du", "p-"));
  box.appendChild(liste("vermeidenHaken", "Vermeide", "v-"));
  const fKopf = document.createElement("div");
  fKopf.className = "stil-liste-kopf";
  fKopf.textContent = "Eigene Hinweise (Freitext)";
  box.appendChild(fKopf);
  const frei = textfeld(st.freitext, "Zum Beispiel: Wir duzen. Fachbegriffe immer kurz erklaeren …", async (text) => {
    st.freitext = text;
    await aendere({ was: "stil", stil: st });
  });
  frei.feld.rows = 3;
  box.appendChild(frei.feld);
  box.appendChild(frei.status);
  box.appendChild(status);
  return box;
}

// Die Quellenliste eines Blocks: was da ist, was sie liefert, und wie man eine anlegt.
function quellenBlock(ziel, quellen, neuZeichnen) {
  const box = document.createElement("div");
  box.className = "kontext-quellen";

  const kopf = document.createElement("div");
  kopf.className = "einst-label";
  kopf.textContent = `Quellen (${quellen.length})`;
  box.appendChild(kopf);

  // Die reihenbezogene Drive-Quelle steht hier bewusst nicht: sie haengt an der Karte
  // (Kontext/<reihe>) und entsteht erst beim Aufruf. Der Satz sagt das, statt sie zu verschweigen.
  if (ziel === "firma") {
    const reihe = document.createElement("p");
    reihe.className = "einst-provider-sub";
    reihe.textContent =
      "Dazu kommt je Karte der Drive-Ordner „Kontext/<Reihe>“, sofern die Karte eine Reihe hat. " +
      "Er steht hier nicht in der Liste, weil er von der Karte abhaengt.";
    box.appendChild(reihe);
  }

  if (!quellen.length) {
    const leer = document.createElement("p");
    leer.className = "einst-provider-sub";
    leer.textContent =
      "Noch keine Quelle. Ohne Quelle zaehlt nur der Text oben — das reicht oft auch.";
    box.appendChild(leer);
  }

  for (const q of quellen) {
    const zeile = document.createElement("div");
    zeile.className = "kontext-quelle" + (q.fehler ? " fehler" : "") + (q.eingebaut ? " eingebaut" : "");

    const links = document.createElement("div");
    links.className = "kontext-quelle-text";
    const stand = q.an === false
      ? "abgeschaltet — geht nicht in die Prompts"
      : q.fehler
        ? `konnte nicht gelesen werden: ${q.fehler}`
        : q.anzahl
          ? `${q.anzahl} Datei${q.anzahl === 1 ? "" : "en"} · ${q.zeichen.toLocaleString("de-DE")} Zeichen`
          : "keine lesbare Textdatei gefunden (.md, .txt)";
    links.innerHTML =
      `<span class="kontext-quelle-art">${escape(artName(q.art))}</span>` +
      (q.eingebaut ? `<span class="kontext-marke">eingebaut</span>` : "") +
      `<code>${escape(q.pfad)}</code>` +
      `<span class="kontext-quelle-stand">${escape(stand)}</span>` +
      (q.satz ? `<span class="kontext-quelle-satz">${escape(q.satz)}</span>` : "");

    zeile.appendChild(links);

    // v34: Eingebaute Drive-Quellen gehoeren zur Konvention, nicht zu Bens Eingabe — sie lassen
    // sich abschalten, aber nicht loeschen. Ein Loeschen-Knopf, der nichts darf, waere schlimmer
    // als keiner.
    if (q.eingebaut) {
      const schalter = document.createElement("input");
      schalter.type = "checkbox";
      schalter.checked = q.an !== false;
      schalter.title = "An: geht in die Prompts";
      schalter.addEventListener("change", async () => {
        schalter.disabled = true;
        try {
          neuZeichnen(await aendere({ was: "eingebaut-schalten", welche: "global", an: schalter.checked }));
        } catch {
          schalter.checked = !schalter.checked;
          schalter.disabled = false;
        }
      });
      zeile.appendChild(schalter);
    } else {
      const weg = document.createElement("button");
      weg.className = "chip";
      weg.textContent = "Entfernen";
      weg.addEventListener("click", async () => {
        weg.disabled = true;
        try {
          neuZeichnen(await aendere({ was: "quelle-entfernen", ziel, quelleId: q.id }));
        } catch {
          weg.disabled = false;
        }
      });
      zeile.appendChild(weg);
    }
    box.appendChild(zeile);
  }

  // Neue Quelle anlegen: Art waehlen, Pfad eintippen, hinzufuegen.
  const neu = document.createElement("div");
  neu.className = "kontext-quelle-neu";
  const wahl = document.createElement("select");
  wahl.className = "einst-modell-select kontext-artwahl";
  for (const a of ARTEN) {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = a.name;
    wahl.appendChild(o);
  }
  const pfadFeld = document.createElement("input");
  pfadFeld.type = "text";
  pfadFeld.className = "kontext-pfad";
  const setzePlatz = () => {
    pfadFeld.placeholder = (ARTEN.find((a) => a.id === wahl.value) || {}).platz || "";
  };
  setzePlatz();
  wahl.addEventListener("change", setzePlatz);

  const dazu = document.createElement("button");
  dazu.className = "chip";
  dazu.textContent = "Hinzufuegen";
  const fehlerZeile = document.createElement("div");
  fehlerZeile.className = "einst-ping-status";

  const anlegen = async () => {
    const pfad = pfadFeld.value.trim();
    if (!pfad) { fehlerZeile.textContent = "Erst einen Pfad eintragen."; return; }
    dazu.disabled = true;
    fehlerZeile.textContent = "Pruefe die Quelle …";
    try {
      const stand = await aendere({ was: "quelle-hinzufuegen", ziel, art: wahl.value, pfad });
      pfadFeld.value = "";
      neuZeichnen(stand);
    } catch (e) {
      fehlerZeile.textContent = `❌ ${e.message}`;
      dazu.disabled = false;
    }
  };
  dazu.addEventListener("click", anlegen);
  pfadFeld.addEventListener("keydown", (e) => { if (e.key === "Enter") anlegen(); });

  neu.appendChild(wahl);
  neu.appendChild(pfadFeld);
  neu.appendChild(dazu);
  box.appendChild(neu);
  box.appendChild(fehlerZeile);
  return box;
}

// --- Der Tab ------------------------------------------------------------------------------

export async function zeichneKontext(ziel) {
  ziel.textContent = "Lade …";
  let d;
  try {
    d = await hole("/api/kontext");
  } catch {
    ziel.textContent = "Der Unternehmenskontext liess sich nicht laden — laeuft der Server?";
    return;
  }
  const neu = (stand) => malen(ziel, stand);
  malen(ziel, d);

  function malen(wurzel, stand) {
    wurzel.innerHTML = "";

    // --- Firma / Brand ---
    const firma = document.createElement("div");
    firma.className = "einst-abschnitt kontext-block";
    const fTitel = document.createElement("div");
    fTitel.className = "einst-label";
    fTitel.textContent = "Firma und Marke";
    firma.appendChild(fTitel);
    const fHinweis = document.createElement("p");
    fHinweis.className = "einst-provider-sub";
    fHinweis.textContent =
      "Wer die Firma ist, wofuer sie steht, wie sie klingt, wen sie erreichen will. Gilt fuer " +
      "alles, was die KI schreibt.";
    firma.appendChild(fHinweis);
    const fFeld = textfeld(
      stand.firma.text,
      "Zum Beispiel: Wer wir sind, unsere Mission, unsere Zielgruppe, unser Tonfall, Begriffe die wir nie benutzen …",
      (text) => aendere({ was: "firma-text", text })
    );
    firma.appendChild(fFeld.feld);
    firma.appendChild(fFeld.status);
    firma.appendChild(quellenBlock("firma", stand.firma.quellen, neu));
    wurzel.appendChild(firma);
    wurzel.appendChild(stilAbschnitt(stand.stilregeln)); // v110

    // --- Projekte ---
    const pKopf = document.createElement("div");
    pKopf.className = "kontext-projekte-kopf";
    const pTitel = document.createElement("div");
    pTitel.className = "einst-label";
    pTitel.textContent = `Projekte (${stand.projekte.length})`;
    const anlegen = document.createElement("button");
    anlegen.className = "chip";
    anlegen.innerHTML = `${icon("plus")}<span>Neues Projekt hinzufuegen</span>`;
    anlegen.addEventListener("click", async () => {
      anlegen.disabled = true;
      try {
        neu(await aendere({ was: "projekt-anlegen", name: "Neues Projekt" }));
      } finally {
        anlegen.disabled = false;
      }
    });
    pKopf.appendChild(pTitel);
    pKopf.appendChild(anlegen);
    wurzel.appendChild(pKopf);

    const pHinweis = document.createElement("p");
    pHinweis.className = "einst-provider-sub";
    pHinweis.textContent =
      "Ein Projekt ist ein eigener Zusammenhang innerhalb der Firma — eine Kampagne, eine Reihe, " +
      "ein Standort. Aktive Projekte gehen zusammen mit dem Firmenkontext in die Prompts.";
    wurzel.appendChild(pHinweis);

    if (!stand.projekte.length) {
      const leer = document.createElement("p");
      leer.className = "einst-provider-sub";
      leer.textContent = "Noch keins angelegt. Fuer den Anfang reicht der Firmenkontext oben.";
      wurzel.appendChild(leer);
    }

    // v67: jedes Projekt eine gefaltete Zeile (Kopf immer sichtbar: Aktiv-Haken, Name,
    // Kurzinfo), das Bearbeiten-Formular klappt per Knopf auf — dasselbe Zeilen-/Detail-Muster
    // wie die Verbindungs-Zeilen (baueVerbindungsZeile in ui.js), statt alles auf einmal zu zeigen.
    for (const p of stand.projekte) {
      const box = document.createElement("div");
      box.className = "verb-zeile kontext-projekt-zeile";

      let detail; // Vorwaertsdeklaration: der Bearbeiten-Knopf im Kopf klappt sie erst spaeter auf.

      const kopf = document.createElement("div");
      kopf.className = "verb-kopf";

      const schalter = document.createElement("input");
      schalter.type = "checkbox";
      schalter.checked = p.aktiv !== false;
      schalter.title = "Aktiv: geht mit in die Prompts";
      schalter.addEventListener("change", async () => {
        try {
          await aendere({ was: "projekt-aendern", id: p.id, aktiv: schalter.checked });
        } catch {
          schalter.checked = !schalter.checked;
        }
      });
      kopf.appendChild(schalter);

      const name = document.createElement("span");
      name.className = "verb-name";
      name.textContent = p.name || "Unbenanntes Projekt";
      kopf.appendChild(name);

      const kurz = document.createElement("span");
      kurz.className = "kontext-projekt-kurz";
      const vorschauText = (p.text || "").trim();
      const quellenSatz = `${p.quellen.length} Quelle${p.quellen.length === 1 ? "" : "n"}`;
      kurz.textContent = vorschauText ? `${quellenSatz} · ${vorschauText}` : `${quellenSatz} · noch kein Text hinterlegt`;
      kopf.appendChild(kurz);

      const knoepfe = document.createElement("div");
      knoepfe.className = "verb-knoepfe";
      const bearbeiten = document.createElement("button");
      bearbeiten.className = "chip";
      bearbeiten.textContent = "Bearbeiten";
      bearbeiten.addEventListener("click", () => { detail.hidden = !detail.hidden; });
      knoepfe.appendChild(bearbeiten);
      kopf.appendChild(knoepfe);

      box.appendChild(kopf);

      detail = document.createElement("div");
      detail.className = "verb-detail kontext-projekt-detail";
      detail.hidden = true;

      const nameFeld = document.createElement("input");
      nameFeld.type = "text";
      nameFeld.className = "kontext-projektname";
      nameFeld.value = p.name;
      nameFeld.addEventListener("blur", async () => {
        if (nameFeld.value.trim() && nameFeld.value !== p.name) {
          try { neu(await aendere({ was: "projekt-aendern", id: p.id, name: nameFeld.value })); } catch {}
        }
      });
      detail.appendChild(nameFeld);

      const feld = textfeld(
        p.text,
        "Worum es in diesem Projekt geht, was hier anders ist als sonst …",
        (text) => aendere({ was: "projekt-aendern", id: p.id, text })
      );
      detail.appendChild(feld.feld);
      detail.appendChild(feld.status);
      detail.appendChild(quellenBlock(p.id, p.quellen, neu));

      const weg = document.createElement("button");
      weg.className = "chip";
      weg.textContent = "Projekt loeschen";
      weg.addEventListener("click", async () => {
        weg.disabled = true;
        try { neu(await aendere({ was: "projekt-loeschen", id: p.id })); } catch { weg.disabled = false; }
      });
      detail.appendChild(weg);

      box.appendChild(detail);
      wurzel.appendChild(box);
    }

    // --- Was davon in den Prompt geht ---
    const fuss = document.createElement("div");
    fuss.className = "einst-abschnitt";
    const fTitel2 = document.createElement("div");
    fTitel2.className = "einst-label";
    fTitel2.textContent = "In den Prompts";
    fuss.appendChild(fTitel2);
    const erklaerung = document.createElement("p");
    erklaerung.className = "einst-provider-sub";
    erklaerung.innerHTML =
      "Zwei Platzhalter stehen in jedem Prompt zur Verfuegung: <code>{{firmenkontext}}</code> und " +
      "<code>{{projektkontext}}</code>. Beide haengen ohne Zutun am Ende des System-Vorspanns; " +
      "wer sie woanders haben will, schreibt sie im Tab „Prompts“ an die gewuenschte " +
      `Stelle. Hoechstens ${(stand.zeichenMax || 0).toLocaleString("de-DE")} Zeichen je Block.`;
    fuss.appendChild(erklaerung);

    const zeigen = document.createElement("button");
    zeigen.className = "chip";
    zeigen.textContent = "Zeigen, was die KI bekommt";
    const probe = document.createElement("pre");
    probe.className = "kontext-probe";
    probe.hidden = true;
    zeigen.addEventListener("click", async () => {
      if (!probe.hidden) { probe.hidden = true; return; }
      zeigen.disabled = true;
      try {
        const p = await hole("/api/kontext/probe");
        const text = (p.firmenkontext + p.projektkontext).trim();
        probe.textContent = text || "Nichts hinterlegt — die Prompts laufen wie ohne Kontext.";
        probe.hidden = false;
      } catch (e) {
        probe.textContent = `Konnte nicht geladen werden: ${e.message}`;
        probe.hidden = false;
      } finally {
        zeigen.disabled = false;
      }
    });
    fuss.appendChild(zeigen);
    fuss.appendChild(probe);
    wurzel.appendChild(fuss);
  }
}
