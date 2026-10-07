// Die Detailspalte: alles zu EINER Karte.
//
// Reihenfolge folgt dem Arbeitsweg, nicht der Datenstruktur: Was ist das · Wann ist es
// faellig · Was ist noch offen · Die Arbeit dieser Phase · Drive · Archiv.

import {
  PHASEN,
  TERMINE,
  CONTENTTYPEN,
  INHALTSKATEGORIEN,
  ZIELE,
  PLATTFORMEN,
  MASSE,
  DATEINAMEN,
  phase,
  phaseIndex,
  naechstePhase,
  tore,
  sperren,
  // rueckwaertsplan laeuft ab v26 ueber store.terminplan() — Workflow-Schalter
  einfacherPlan,
  drehFenster,
  drehImFenster,
  vorschlagUploadDatum,
  isoDatum,
  sprechzeit,
  saeuleName,
  plattformName,
  contenttypName,
  contenttypFormat,
  zielInfo,
  projektName,
  deutschesDatum,
  POSTZEITEN,
  projektPfad,
  parseJsonNachsichtig,
  FORMAT_DATEINAMEN,
} from "/lib/pipeline.js";
import { fensterFuerTyp } from "/lib/scheduler.js";
import { naechsterFreierUpload } from "/lib/uploadslots.js";
import {
  S,
  karte,
  aktiveKarte,
  speichere,
  zeichne,
  loescheKarte,
  driveScan,
  driveAnlegen,
  optimistisch,
  driveSpeichern,
  ki,
  kiStream,
  melde,
  setStand,
  spalteLive,
  speichereDefaults,
  ladePlan,
  drehtermin,
  drehterminAnlegen,
  drehterminAendern,
  karteZuTermin,
  karteVonTermin,
  downloadUrl,
  videoHochladen,
  dateiHochladen,
  an,
  stellschraube,
  terminplan,
  schwebendeNeuBerechnen,
  ladeBoard,
  zeitAmpel,
  drehZuSpaet,
} from "./store.js";
import { modalDrehtermin } from "./drehtermine.js";
import {
  icon,
  statusChip,
  STATUS,
  escape,
  knopf,
  feld,
  feldMitInfo,
  eingabe,
  textfeld,
  gruppe,
  befundZeile,
  eigenschaft,
  kennzahlReihe,
  fortschritt,
  terminalAn,
  knopfLaeuft,
  sanduhr,
  modalKalender,
  infoTipp,
  meldung,
  bestaetigen,
  driveOrt,
  pillenReihe,
  pillenSchalter,
  mehrMenu,
  cacheMarke,
} from "./ui.js";
import { springeZuMaximum, istMaximal, verlasseMaximumFallsAktiv } from "./detail-breite.js";

let schiebe = async () => {};
export const beiSchieben = (f) => (schiebe = f);

const KI_NAMEN = {
  recherche: "Recherche und Fokus",
  hooks_verbal: "Verbale Hooks",
  hooks_visuell: "Visuelle Hooks",
  skript: "Skript schreiben",
  caption: "Captions je Plattform",
  ideen: "Ideen-Nachschub",
  // v79 C2: format-spezifische Tasks
  slider_aufbau: "Slider aufbauen",
  slider_visual: "Visual je Slide",
  beitrag_visual: "Text-Beitrag bauen",
  story_frames: "Story-Frames bauen",
  langform_konzept: "Storytelling-Konzept",
};

// v79 C2: Tasks, deren JSON-Ergebnis unter k.formate[task] landet und format-eigen editiert wird.
const FORMAT_TASKS = new Set([
  "slider_aufbau",
  "slider_visual",
  "beitrag_visual",
  "story_frames",
  "langform_konzept",
]);

// Nur Phasen mit einer generischen Knopfreihe. Idee und Skript haben eigene, gefuehrte Abläufe.
const PHASEN_KI = {
  caption: ["caption"],
};

// v85: Projektpfad aus dem Drive-Stand der Spalten (S.spalten, z. B. "In Bearbeitung/1 Idee"),
// nicht aus den festen Standard-Ordnern — sonst zeigt „In Drive öffnen" nach einer Umbenennung
// oder der Nummerierung ins Leere.
function drivePfadKarte(k) {
  const sp = (S.spalten || []).find((s) => s.id === k.column);
  return sp && sp.ordner ? `${sp.ordner}/${projektName(k)}` : projektPfad(k);
}

export function zeichneDetail(el) {
  const k = aktiveKarte();
  if (!k) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  repariereRohAntworten(k); // v104: alte, nur formal kaputte KI-Antworten zu Feldern machen
  const p = phase(k.column);
  const stand = S.driveStand.get(k.id);
  const toreListe = tore(k, stand);

  el.innerHTML = "";

  // --- Kopf ---
  const kopf = document.createElement("div");
  kopf.className = "detail-kopf";
  kopf.innerHTML = `<span class="detail-phase">${escape(p.name)}</span>` +
    (k.driveName ? driveOrt(drivePfadKarte(k), "In Drive öffnen", "Ordner dieser Karte in Google Drive öffnen: " + k.driveName) : "");

  // Breiten-Shortcut (v57, vorher Fokus-Ansicht P27 F4): zieht die Detailspalte auf maximale
  // Breite (80vw) statt Board auszublenden — dieselbe Variable wie manuelles Ziehen am Griff.
  const fokusKnopf = document.createElement("button");
  fokusKnopf.className = "detail-fokus knopf-symbol knopf-symbol-maximieren" + (istMaximal() ? " an" : "");
  fokusKnopf.setAttribute("aria-label", istMaximal() ? "Auf vorherige Breite zurueck" : "Detailspalte auf maximale Breite ziehen");
  fokusKnopf.title = istMaximal() ? "Zurueck zur vorherigen Breite" : "Detailspalte auf 80% der Bildschirmbreite ziehen";
  fokusKnopf.innerHTML = icon("maximieren");
  fokusKnopf.addEventListener("click", () => {
    springeZuMaximum();
    zeichne();
  });
  kopf.appendChild(fokusKnopf);

  // v75 (Owner 28.09.2026): Befunde stehen jetzt rechtsbuendig hier im Kopf statt in einer
  // eigenen Zeile darunter — die Fortschritt-Zeile samt Phasenband entfaellt komplett. Der
  // Indikator traegt den auto-margin, damit er sich (und alles danach, hier nur noch X) an
  // den rechten Rand schiebt; .detail-fokus/.detail-phase bleiben links stehen.
  kopf.appendChild(befundIndikator(toreListe));

  const zu = document.createElement("button");
  zu.className = "detail-schliessen";
  zu.setAttribute("aria-label", "Karte schliessen");
  zu.innerHTML = icon("schliessen");
  zu.addEventListener("click", () => {
    S.aktiv = null;
    verlasseMaximumFallsAktiv(); // Breite verlaesst sich mit der Karte automatisch, wie vorher
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

  const istIdee = k.column === "idee";
  const stammFertig = stammKomplett(k);

  // --- Termine (in Idee erst nach Stamm-Daten) ---
  if (!istIdee || stammFertig) koerper.appendChild(blockTermine(k, merke));

  // --- Drehtermin (nur bei fertigem Skript: ab Schritt „Drehtermin festlegen") ---
  if (!["idee", "fertig", "verworfen"].includes(k.column)) koerper.appendChild(blockDrehtermin(k));

  // --- Die Arbeit dieser Phase (in Idee erst nach Termin) ---
  const terminFertig = !!(k.dates && k.dates.upload);
  const arbeit = blockPhase(k, toreListe, stand);
  if (arbeit && (!istIdee || (stammFertig && terminFertig))) koerper.appendChild(arbeit);

  // --- Veroeffentlicht (v97): zugeordnete Posts und offene Vorschlaege ---
  if (["upload", "fertig"].includes(k.column) || Object.keys(k.published || {}).length || (k.zuordnungVorschlag || []).length)
    koerper.appendChild(blockVeroeffentlicht(k));

  // --- Drive ---
  koerper.appendChild(blockDrive(k, stand));

  // --- Archiv ---
  if (k.ai && Object.keys(k.ai).length) koerper.appendChild(blockArchiv(k));

  // --- Weiter und Loeschen ---
  koerper.appendChild(blockAbschluss(k, toreListe));

  // v81: Solange das Board den Cache zeigt, tragen Kopf und jeder Abschnitt, dessen Inhalt aus
  // den Kartenfeldern kommt, das Cache-Zeichen. Der Drive-Abschnitt nicht: er liest die Ordner
  // der Karte selbst frisch aus Drive (Sanduhr, solange er liest).
  if (!spalteLive(k.column)) {
    kopf.insertBefore(cacheMarke("Cache"), kopf.querySelector(".detail-fokus"));
    for (const g of koerper.querySelectorAll(":scope > .gruppe:not(.gruppe-drive)")) {
      const kopfZeile = g.querySelector(":scope > summary.gruppe-kopf");
      if (kopfZeile) kopfZeile.appendChild(cacheMarke(""));
    }
  }

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

// Befund-Indikator im Kopf (v75, Owner 28.09.2026, ersetzt die fruehere Fortschritt-Zeile samt
// Phasenband): EIN Zeichen in der Farbe des schwersten offenen Punkts, rechtsbuendig neben dem
// Schliessen-Knopf. Hover/Fokus oeffnet ein Popup darunter mit allen Punkten, nach Status
// gruppiert (befund/fehlt/hinweis/unlesbar) — "ok"/"entfaellt" zaehlen nicht als offen.
const BEFUND_REIHENFOLGE = ["befund", "fehlt", "hinweis", "unlesbar"];
const BEFUND_GRUPPENNAME = { befund: "Befund", fehlt: "Fehlt", hinweis: "Hinweis", unlesbar: "Unlesbar" };

function befundIndikator(toreListe) {
  const offen = toreListe.filter((t) => t.status !== "ok" && t.status !== "entfaellt");
  const schwerste = BEFUND_REIHENFOLGE.find((s) => offen.some((t) => t.status === s)) || "ok";

  const wrap = document.createElement("span");
  wrap.className = `befund-indikator chip-${schwerste}`;
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "button");
  wrap.setAttribute("aria-label", offen.length ? `${offen.length} Punkte offen — Details anzeigen` : "Nichts haelt die Karte auf");
  wrap.innerHTML = icon((STATUS[schwerste] || STATUS.ok).icon) + (offen.length ? `<span class="befund-indikator-anzahl">${offen.length}</span>` : "");

  const popup = document.createElement("div");
  popup.className = "befund-popup";
  if (!offen.length) {
    popup.innerHTML = `<p class="feld-hinweis">Nichts haelt die Karte auf.</p>`;
  } else {
    for (const status of BEFUND_REIHENFOLGE) {
      const gruppe = offen.filter((t) => t.status === status);
      if (!gruppe.length) continue;
      const g = document.createElement("div");
      g.className = "befund-popup-gruppe";
      g.innerHTML = `<div class="befund-popup-kopf">${BEFUND_GRUPPENNAME[status]} (${gruppe.length})</div>`;
      const liste = document.createElement("ul");
      liste.className = "befundliste";
      for (const t of gruppe) liste.appendChild(befundZeile(t.status, t.satz, t.quelle));
      g.appendChild(liste);
      popup.appendChild(g);
    }
  }
  wrap.appendChild(popup);

  // Touch/Klick zusaetzlich zu Hover/Fokus (CSS traegt :hover/:focus-within). Schliessen bei
  // Aussenklick laeuft ueber EINEN global delegierten Listener (siehe unten) statt je Indikator
  // einen eigenen zu registrieren — die Detailspalte zeichnet bei jeder Aenderung neu, ein
  // Listener pro Aufruf haette sich sonst bei jedem Redraw angehaeuft.
  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.classList.toggle("offen");
  });

  return wrap;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".befund-indikator")) {
      document.querySelectorAll(".befund-indikator.offen").forEach((w) => w.classList.remove("offen"));
    }
  });
}

// P27 F2: Karten-IDs, deren Stamm-Felder trotz vollstaendiger Wahl gerade zum Bearbeiten
// aufgeklappt sind. Rein im Speicher — nach einem Neuladen startet jede Karte eingeklappt.
const stammOffenIds = new Set();

// v77 (Owner 28.09.2026): Auf-/Zuklappen der Abschnitte haelt jetzt ueber einen Redraw hinweg —
// vorher baute zeichneDetail() bei jeder Aenderung alles neu aus den JS-Defaults, ein von Hand
// zugeklappter Abschnitt sprang beim naechsten Tippen sofort wieder auf. Rein im Speicher (wie
// stammOffenIds oben) — nach einem Neuladen der Seite gelten wieder die Defaults.
const klappZustand = new Map(); // Schluessel `${karteId}:${abschnitt}` -> boolean
const offenFuer = (k, abschnitt, standard) => {
  const key = `${k.id}:${abschnitt}`;
  return klappZustand.has(key) ? klappZustand.get(key) : standard;
};
const merkeKlapp = (k, abschnitt) => (offen) => klappZustand.set(`${k.id}:${abschnitt}`, offen);

// Farbige Kopfzeile je Abschnitt (v77, Owner: "staerker an den Board-Look angleichen") — eine
// FESTE Zuordnung je Abschnitts-BEDEUTUNG statt nach DOM-Position gezaehlt: welche Abschnitte
// bei einer Karte ueberhaupt erscheinen, haengt vom Kartenstand ab (z. B. "Termin" fehlt bei
// einer frischen Idee) — nach Position gezaehlt haette derselbe Abschnitt je nach Karte eine
// andere Farbe getragen.
const ABSCHNITT_FARBE = { stamm: 1, termin: 2, dreh: 3, phase: 4, drive: 1, archiv: 2, veroeffentlicht: 3 };
const gruppeMitFarbe = (abschnitt, ...args) => {
  const g = gruppe(...args);
  g.classList.add(`gruppe-c${ABSCHNITT_FARBE[abschnitt]}`);
  return g;
};

// v88 (Owner 01.10.2026: „immer alles Step by Step"): EINE Regel, wann „Worum geht es" fertig
// ist — Thema, Typ, Kategorie, Ziel und mindestens eine Plattform. Sie entscheidet, ob die
// Wahlreihen zuklappen UND ob in „Skript schreiben" der naechste Schritt (Termin) erscheint.
// Vorher pruefte die Termin-Freigabe nur Thema+Kategorie+Ziel: der Termin kam, bevor Typ und
// Plattform gewaehlt waren.
function stammKomplett(k) {
  return !!(k.title && k.contenttyp && k.kategorie && k.goal && (k.platforms || []).length);
}

function blockStamm(k, merke) {
  const g = gruppeMitFarbe("stamm", "Worum geht es", null, offenFuer(k, "stamm", true), merkeKlapp(k, "stamm"));
  const box = document.createElement("div");

  const titel = eingabe(k.title, { platzhalter: "Thema in einem Halbsatz" });
  titel.addEventListener("input", () => merke("title", titel.value));
  titel.addEventListener("change", () => zeichne());
  box.appendChild(feld("Thema", titel));

  // P27 F2: Sind Typ+Kategorie+Ziel+Plattform alle gesetzt, verschwinden die vier offenen
  // Wahlreihen zugunsten einer kompakten Zeile — sie haben ihre Entscheidung schon getroffen,
  // permanente Buttons dafuer sind nur noch Ablenkung. Solange nicht alle vier stehen, bleibt
  // die volle Ansicht (Erstausfuellen darf nicht erschwert werden).
  const stammVollstaendig = stammKomplett(k);
  const offen = !stammVollstaendig || stammOffenIds.has(k.id);

  if (!offen) {
    box.appendChild(stammZusammenfassung(k));
  } else {
    // Content-Typ: Single-Select Toggle-Buttons
    box.appendChild(feld("Typ", einzelwahlReihe(CONTENTTYPEN, k.contenttyp || "", (id) => merke("contenttyp", id, true))));

    // Kategorie (ex Content-Saeule): Single-Select Toggle-Buttons. v78: nur aktive (boardparameter) —
    // eine deaktivierte bleibt sichtbar, solange die Karte sie traegt (Zuordnung geht nicht verloren).
    box.appendChild(feld("Kategorie", einzelwahlReihe(INHALTSKATEGORIEN.filter((x) => x.aktiv !== false || x.id === k.kategorie), k.kategorie || "", (id) => merke("kategorie", id, true))));

    // Ziel: Single-Select Toggle-Buttons
    box.appendChild(feldMitInfo("Ziel", einzelwahlReihe(ZIELE.filter((x) => x.aktiv !== false || x.id === k.goal), k.goal || "", (id) => merke("goal", id, true)), k.goal ? `Gemessen wird an: ${zielInfo(k.goal).kennzahl}.` : ""));

    // Plattformen: Multi-Select Toggle-Buttons
    const plattformen = pillenReihe(PLATTFORMEN, k.platforms || [], {
      mehrfach: true,
      beiWahl: (liste) => merke("platforms", liste, true),
    });
    const plWrap = feld("Plattformen", plattformen);

    const defaultPl = new Set(S.defaults.plattformen || []);
    const aktuellPl = new Set(k.platforms || []);
    const weichtAb = aktuellPl.size !== defaultPl.size || [...aktuellPl].some((p) => !defaultPl.has(p));
    if (weichtAb && k.platforms && k.platforms.length) {
      const stdBtn = knopf("Neuen Standard speichern", {
        klick: async (e) => {
          try {
            await speichereDefaults({ plattformen: [...k.platforms] });
            e.currentTarget.remove();
            meldung("Plattform-Standard gespeichert.", "erfolg");
          } catch {
            meldung("Standard konnte nicht gespeichert werden.", "fehler");
          }
        },
      });
      stdBtn.classList.add("standard-speichern");
      plWrap.appendChild(stdBtn);
    }
    box.appendChild(plWrap);

    if (stammVollstaendig) {
      const fertig = knopf("Fertig — einklappen", {
        zeichen: "check",
        klick: () => {
          stammOffenIds.delete(k.id);
          zeichne();
        },
      });
      fertig.classList.add("knopf-inline");
      box.appendChild(fertig);
    }
  }
  g.appendChild(box);

  const { d, box: mehr } = klappe("Weitere Angaben", offenFuer(k, "stamm-mehr", false), merkeKlapp(k, "stamm-mehr"));
  const reihe = document.createElement("div");
  reihe.className = "feld-reihe";
  const serie = eingabe(k.serie, { platzhalter: "z. B. Name der Reihe" }); // v113 (N8): neutral
  serie.addEventListener("change", () => merke("serie", serie.value, true));
  const episode = eingabe(k.episode, { platzhalter: "01" });
  episode.addEventListener("change", () => merke("episode", episode.value, true));
  reihe.appendChild(feld("Reihe", serie));
  const epFeld = feld("Episode", episode);
  epFeld.classList.add("feld-schmal");
  reihe.appendChild(epFeld);
  mehr.appendChild(reihe);

  const wer = eingabe(k.owner, { platzhalter: "Wer macht das?" });
  wer.addEventListener("change", () => merke("owner", wer.value));
  mehr.appendChild(feld("Verantwortlich", wer));

  const notizen = textfeld(k.notes, 3, "Was gehoert noch dazu?");
  notizen.addEventListener("change", () => merke("notes", notizen.value));
  mehr.appendChild(feld("Notizen", notizen));

  g.appendChild(d);
  return g;
}

// Single-Select Toggle-Buttons: klick waehlt, nochmal klick deselektiert.
const einzelwahlReihe = (optionen, aktuell, beiWahl) => pillenReihe(optionen, aktuell, { beiWahl });

// P27 F2: die eingeklappte Zeile fuer vollstaendig gesetzte Stamm-Felder.
// v80 (Owner 28.09.2026): war ein Fliesstext, der mit "…" mitten im Wort abgeschnitten wurde —
// jetzt ein Chip je Wert, umbricht bei Bedarf in eine zweite Zeile statt etwas zu verschlucken.
function stammZusammenfassung(k) {
  const wrap = document.createElement("div");
  wrap.className = "stamm-zusammenfassung";
  const chips = document.createElement("div");
  chips.className = "stamm-chips";
  const werte = [
    contenttypName(k.contenttyp),
    saeuleName(k.kategorie),
    zielInfo(k.goal).name,
    ...(k.platforms || []).map(plattformName),
  ].filter(Boolean);
  for (const text of werte) {
    const c = document.createElement("span");
    c.className = "stamm-chip";
    c.textContent = text;
    chips.appendChild(c);
  }
  wrap.appendChild(chips);
  const bearbeiten = knopf("bearbeiten", {
    klick: () => {
      stammOffenIds.add(k.id);
      zeichne();
    },
  });
  bearbeiten.classList.add("knopf-inline");
  wrap.appendChild(bearbeiten);
  return wrap;
}

// v97: Welcher echte Post gehoert zu dieser Karte? Eindeutige Treffer traegt das Board selbst ein (hoechstens
// 3 Std. neben dem geplanten Upload, Format passt); im Zweifel fragt es hier nach. Ab der Zuordnung laufen die
// KPI-Messungen ab der echten Post-Zeit. Paket: docs/packages/v97-upload-fest-und-kpi-zuordnung.md
const NICHT_VERBUNDEN = "Weder Instagram noch LinkedIn ist verbunden — erst unter Einstellungen → Social Media verbinden, dann findet das Board die Posts.";

function blockVeroeffentlicht(k) {
  const g = gruppeMitFarbe("veroeffentlicht", "Veröffentlicht", null, offenFuer(k, "veroeffentlicht", true), merkeKlapp(k, "veroeffentlicht"));
  const box = document.createElement("div");
  box.className = "veroeff";
  const zeit = (iso) => new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  const name = (pl) => ({ instagram: "Instagram", linkedin: "LinkedIn" }[pl] || pl);
  const ART = { auto: "automatisch zugeordnet", bestaetigt: "von dir bestätigt", manuell: "von Hand" };

  const eintraege = Object.entries(k.published || {}).filter(([, v]) => v && v.id);
  for (const [pl, v] of eintraege) {
    const messungen = ((k.kpiMessungen || {})[pl] || []).length;
    const z = document.createElement("div");
    z.className = "veroeff-zeile";
    z.innerHTML =
      `${icon("check")} <b>${escape(name(pl))}</b> · ${escape(zeit(v.zeit))}` +
      (v.url ? ` · <a href="${escape(v.url)}" target="_blank" rel="noopener">Post öffnen</a>` : "") +
      `<span class="veroeff-art">${escape(ART[v.zuordnung] || v.zuordnung || "")}` +
      (v.abweichungStunden != null ? `, ${String(v.abweichungStunden).replace(".", ",")} Std. neben dem Plan` : "") +
      ` · Messungen ${messungen}</span>`;
    box.appendChild(z);
  }

  for (const v of k.zuordnungVorschlag || []) {
    const z = document.createElement("div");
    z.className = "veroeff-vorschlag";
    z.innerHTML =
      `<div><b>Ist das dieser Post?</b> ${escape(name(v.plattform))} · ${escape(zeit(v.post.zeit))}` +
      (v.post.url ? ` · <a href="${escape(v.post.url)}" target="_blank" rel="noopener">ansehen</a>` : "") +
      `<br><span class="veroeff-art">${escape(v.grund || "")}</span></div>`;
    const entscheide = (ja) => async (e) => {
      e.currentTarget.disabled = true;
      await fetch("/api/zuordnung/entscheiden", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: k.id, plattform: v.plattform, postId: v.post.id, ja }),
      });
      await ladeBoard();
      zeichne();
    };
    const reihe = document.createElement("div");
    reihe.className = "veroeff-knoepfe";
    reihe.appendChild(knopf("Ja, das ist er", { art: "haupt", klick: entscheide(true) }));
    reihe.appendChild(knopf("Nein", { klick: entscheide(false) }));
    z.appendChild(reihe);
    box.appendChild(z);
  }

  if (!eintraege.length && !(k.zuordnungVorschlag || []).length) {
    const leerSatz = document.createElement("p");
    leerSatz.className = "veroeff-art";
    leerSatz.textContent = "Noch kein Post zugeordnet. Das Board sucht beim Start und beim Zahlen-Holen selbst danach.";
    box.appendChild(leerSatz);
  }
  const jetzt = knopf("Jetzt nach Posts suchen", {
    zeichen: "neuladen",
    klick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      b.textContent = "Sucht …";
      const r = await (await fetch("/api/zuordnung/pruefen", { method: "POST" })).json().catch(() => ({}));
      // v113 (M9): ohne verbundene Plattform gibt es nichts zu suchen — das sagen statt „0 Posts geprüft".
      if (!r.error && Array.isArray(r.verbunden) && !r.verbunden.length) {
        await melde("hinweis", NICHT_VERBUNDEN);
        b.disabled = false;
        b.textContent = "Jetzt nach Posts suchen";
        return;
      }
      meldung(r.error ? `Suche fehlgeschlagen: ${r.error}` : `${r.posts || 0} Posts geprüft: ${r.auto || 0} zugeordnet, ${r.vorschlaege || 0} zum Bestätigen.`, r.error ? "fehler" : "erfolg");
      await ladeBoard();
      zeichne();
    },
  });
  jetzt.classList.add("knopf-inline");
  box.appendChild(jetzt);

  // v97 Nachtrag: Post von Hand waehlen — fuer Posts, die zeitlich zu keiner Karte passen (Automatik: 3 Std.).
  const handBox = document.createElement("div");
  handBox.className = "veroeff-hand";
  const hand = knopf("Post von Hand wählen", {
    zeichen: "plus",
    klick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      handBox.textContent = "Lade Posts …";
      const r = await (await fetch(`/api/zuordnung/posts?cardId=${encodeURIComponent(k.id)}`)).json().catch((err) => ({ error: err.message }));
      b.disabled = false;
      handBox.innerHTML = "";
      if (r.error || !(r.posts || []).length) {
        handBox.textContent = r.error ? `Posts nicht ladbar: ${r.error}`
          : Array.isArray(r.verbunden) && !r.verbunden.length ? NICHT_VERBUNDEN // v113 (M9)
          : "Keine freien Posts gefunden (alle sind schon Karten zugeordnet).";
        return;
      }
      const hinweis = document.createElement("p");
      hinweis.className = "veroeff-art";
      hinweis.textContent = (k.dates && k.dates.upload) ? "Freie Posts, nächste zum geplanten Upload zuerst. Ein Klick ordnet zu." : "Freie Posts, neueste zuerst. Ein Klick ordnet zu; die Karte übernimmt Datum und Uhrzeit des Posts.";
      handBox.appendChild(hinweis);
      for (const p of r.posts) {
        const zeile = document.createElement("button");
        zeile.type = "button";
        zeile.className = "veroeff-post" + (p.passt ? "" : " veroeff-post-anders");
        zeile.innerHTML = `<b>${escape(name(p.plattform))}</b> · ${escape(zeit(p.zeit))}` +
          (p.passt ? "" : ` · <span class="veroeff-art">anderes Format</span>`) +
          `<br><span class="veroeff-art">${escape(p.text || "(ohne Text)")}</span>`;
        zeile.addEventListener("click", async () => {
          zeile.disabled = true;
          const a = await fetch("/api/zuordnung/hand", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ cardId: k.id, plattform: p.plattform, postId: p.id }),
          });
          const j = await a.json().catch(() => ({}));
          if (!a.ok) { meldung(j.error || "Zuordnung fehlgeschlagen.", "fehler"); zeile.disabled = false; return; }
          meldung(`Post vom ${zeit(p.zeit)} zugeordnet.`, "erfolg");
          await ladeBoard();
          zeichne();
        });
        handBox.appendChild(zeile);
      }
    },
  });
  hand.classList.add("knopf-inline");
  box.appendChild(hand);
  box.appendChild(handBox);
  g.appendChild(box);
  return g;
}

function blockTermine(k, merke) {
  const istIdee = k.column === "idee";

  if (istIdee) return blockTermineIdee(k, merke);

  // v113 (M1, Owner 07.10.2026): dieselbe dringlichste Frist wie der Punkt auf der Kachel. Bis v112 stand hier
  // faelligkeit() — alter Zwischenspeicher card.dates[termin] und eigene Farbschwellen; bei 4 von 6 echten Karten in
  // Dreh-Phasen hiess es „kein Datum gesetzt", obwohl ein Drehtermin zugeordnet war und der Punkt rot stand.
  const f = zeitAmpel(k);
  const g = gruppeMitFarbe("termin", "Termin", null, offenFuer(k, "termin", true), merkeKlapp(k, "termin"));
  const box = document.createElement("div");

  const satz = document.createElement("div");
  satz.className = "befund";
  satz.innerHTML = statusChip(f.status) + `<span class="befund-satz">${escape(f.satz)}</span>`;
  box.appendChild(satz);

  // v80 (Owner 28.09.2026): Schalter und Datumszeile standen als zwei lose Elemente
  // untereinander, wirkten wie zwei unabhaengige Bedienteile — jetzt EIN umrandeter Block.
  const schaltBlock = document.createElement("div");
  schaltBlock.className = "termin-schalter-block";
  schaltBlock.appendChild(floatSchalter(k, merke));

  if (k.floatUpload) {
    schaltBlock.appendChild(schwebendAnzeige(k));
  } else {
    const hatUpload = (k.dates || {}).upload;
    if (hatUpload) {
      const zeile = document.createElement("div");
      zeile.className = "termin-kompakt";
      zeile.innerHTML = `<span>Uploaddatum: <strong>${deutschesDatum(hatUpload)}</strong>${k.uploadTime ? ` · ${k.uploadTime}` : ""}</span>`;
      zeile.appendChild(bearbeitenUploadKnopf(k, merke));
      schaltBlock.appendChild(zeile);
    } else {
      const uZeile = document.createElement("div");
      uZeile.className = "feld-reihe";
      const uDatum = eingabe("", { typ: "date" });
      uDatum.addEventListener("change", () => setzeTermin(k, "upload", uDatum.value, merke));
      uZeile.appendChild(feld("Veroeffentlichung", uDatum));
      const uZeit = eingabe(k.uploadTime || "", { typ: "time" });
      uZeit.addEventListener("change", () => merke("uploadTime", uZeit.value, true));
      const zf = feld("Uhrzeit", uZeit);
      zf.classList.add("feld-schmal");
      uZeile.appendChild(zf);
      schaltBlock.appendChild(uZeile);
    }
  }
  box.appendChild(schaltBlock);

  g.appendChild(box);

  const { d, box: details } = klappe("Termine verwalten", offenFuer(k, "termin-verwalten", false), merkeKlapp(k, "termin-verwalten"));
  details.appendChild(miniKalender(k));

  const plan = knopf("Restliche Termine rueckwaerts planen", {
    zeichen: "kalender",
    titel: "Setzt Idee, Skript, Dreh, Schnitt und Freigabe rueckwaerts vom Veroeffentlichungsdatum.",
    klick: () => {
      const upload = (k.dates || {}).upload;
      if (!upload) {
        melde("hinweis", "Setz zuerst das Veroeffentlichungsdatum — daraus rechnet der Plan rueckwaerts.");
        return;
      }
      merke("dates", { ...terminplan(upload), upload }, true);
      setStand("Die uebrigen Termine stehen jetzt rueckwaerts vom Upload-Datum.");
    },
  });
  plan.classList.add("knopf-breit");
  details.appendChild(plan);

  for (const t of TERMINE) {
    if (t.key === "dreh") {
      // B1 (v30): kein zweites, roh editierbares Dreh-Datum mehr — das kann den zugeordneten
      // Drehtermin unbemerkt ueberschreiben, ohne ihn zu loesen oder zu syncen. Zugeordnet:
      // das Datum steht schon oben im Block "Drehtermin", hier keine eigene Zeile. Sonst ein
      // Hinweis statt eines Feldes — genau EINE Stelle im UI kann ein Dreh-Datum erzeugen.
      // v83 (Owner 30.09.2026): Der Hinweis „Kein Drehtermin zugeordnet" stand hier UND am
      // Weiter-Knopf. Er steht jetzt nur noch am Knopf, wo er die Handlung erklaert.
      continue;
    }
    const zeile = document.createElement("div");
    zeile.className = "feld-reihe";
    const datum = eingabe((k.dates || {})[t.key] || "", { typ: "date" });
    datum.addEventListener("change", () => setzeTermin(k, t.key, datum.value, merke));
    zeile.appendChild(feld(t.name, datum));
    details.appendChild(zeile);
  }
  g.appendChild(d);
  return g;
}

// Vereinfachter Terminblock fuer die Idee-Phase: Vorschlag + Akzeptieren oder manuell.
// Drehtermin-Zuordnung in der Karte. Erscheint nur bei fertigem Skript (ab Schritt
// „Drehtermin festlegen"). Zugeordnet: Anzeige + Loesen; sonst: vorhandenen waehlen oder neuen anlegen.
function blockDrehtermin(k) {
  const g = gruppeMitFarbe("dreh", "Drehtermin", null, offenFuer(k, "dreh", true), merkeKlapp(k, "dreh"));
  const box = document.createElement("div");
  const heute = isoDatum(new Date());
  const kommend = (S.drehtermine || [])
    .filter((t) => t.datum && t.datum >= heute)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const t = k.drehterminId ? drehtermin(k.drehterminId) : null;

  if (t) {
    const zeile = document.createElement("div");
    zeile.className = "termin-kompakt";
    zeile.innerHTML =
      `<span>Zugeordnet: <strong>${deutschesDatum(t.datum)}</strong>${t.zeit ? " · " + escape(t.zeit) : ""}${t.ort ? " · " + escape(t.ort) : ""}</span>`;
    const loesen = knopf("loesen", { klick: () => karteVonTermin(k.id, t.id) });
    loesen.classList.add("knopf-inline");
    zeile.appendChild(loesen);
    box.appendChild(zeile);

    if (!drehImFenster(t.datum, (k.dates || {}).upload)) {
      const f = drehFenster((k.dates || {}).upload);
      const w = document.createElement("p");
      w.className = "feld-hinweis";
      w.textContent = f
        ? `Achtung: liegt ausserhalb des empfohlenen Fensters (${deutschesDatum(f.frueh)} – ${deutschesDatum(f.spaet)}).`
        : "";
      box.appendChild(w);
    }
  } else {
    // Zuordnen + Karte gleich in den Videodreh schieben (Termin steht -> Skript ist fertig).
    const zuordnen = async (terminId) => {
      const r = karteZuTermin(k.id, terminId);
      if (r && !r.ok && r.grund) { melde("befund", r.grund); return; } // v70: zu spaeter Drehtermin, blockiert
      if (r && r.warnung) melde("hinweis", r.warnung);
      // Workflow "drehtermin-zuordnen-videodreh" (v26)
      if (r && r.ok && an("drehtermin-zuordnen-videodreh") && phaseIndex(k.column) < phaseIndex("videodreh"))
        await schiebe(k, "videodreh");
    };

    if (kommend.length) {
      const label = document.createElement("div");
      label.className = "feld-label";
      label.textContent = "Naechster Drehtermin — direkt zuordnen";
      box.appendChild(label);
      const wahl = document.createElement("div");
      wahl.className = "dreh-wahl";
      for (const x of kommend) {
        const zuSpaet = drehZuSpaet(k, x); // v113 (N13): vor dem Klick sichtbar
        const b = knopf(
          `${deutschesDatum(x.datum)}${x.zeit ? " · " + x.zeit : ""}${x.ort ? " · " + x.ort : ""} (${(x.karteIds || []).length})${zuSpaet ? " · zu spät" : ""}`,
          { zeichen: "kalender", klick: () => zuordnen(x.id) }
        );
        if (zuSpaet) b.title = zuSpaet;
        b.classList.add("knopf-breit");
        wahl.appendChild(b);
      }
      box.appendChild(wahl);
    } else {
      const leer = document.createElement("p");
      leer.className = "feld-hinweis";
      leer.textContent = "Noch kein Drehtermin geplant. Leg unten einen an.";
      box.appendChild(leer);
    }

    const neu = knopf("Neuer Drehtermin", {
      zeichen: "plus",
      klick: () =>
        modalDrehtermin(async (werte) => {
          const nt = drehterminAnlegen(werte.datum, werte.zeit);
          if (werte.ort || werte.titel) drehterminAendern(nt.id, { ort: werte.ort, titel: werte.titel });
          await zuordnen(nt.id);
        }),
    });
    neu.classList.add("knopf-breit", "dreh-neu");
    box.appendChild(neu);
  }

  g.appendChild(box);
  return g;
}

function blockTermineIdee(k, merke) {
  const g = gruppeMitFarbe("termin", "Termin", null, offenFuer(k, "termin", true), merkeKlapp(k, "termin"));
  const box = document.createElement("div");

  // v80: Schalter und der Rest (Anzeige/Datumszeile/Kacheln) als EIN umrandeter Block, siehe
  // dieselbe Begruendung in blockTermine().
  const schaltBlock = document.createElement("div");
  schaltBlock.className = "termin-schalter-block";
  schaltBlock.appendChild(floatSchalter(k, merke));
  box.appendChild(schaltBlock);

  if (k.floatUpload) {
    schaltBlock.appendChild(schwebendAnzeige(k));
    g.appendChild(box);
    return g;
  }

  const hatDatum = (k.dates || {}).upload;

  if (hatDatum) {
    // Kompakte Ansicht: eine Zeile + Bearbeiten-Button.
    const zeile = document.createElement("div");
    zeile.className = "termin-kompakt";
    zeile.innerHTML = `<span>Uploaddatum: <strong>${deutschesDatum(hatDatum)}</strong></span>`;
    zeile.appendChild(bearbeitenUploadKnopf(k, merke));
    schaltBlock.appendChild(zeile);
  } else {
    // 2 Kacheln: oben nächstes freies Datum, unten manuell.
    const kacheln = document.createElement("div");
    kacheln.className = "termin-kacheln";

    // Obere Kachel: nächstes freies Datum aus Redaktionsplan (async befüllt).
    const slotKachel = document.createElement("div");
    slotKachel.className = "termin-kachel termin-kachel-slot";
    // v51: derselbe `/api/plan`-Weg wie im Redaktionsplan (bis 35 s) — deshalb dieselbe Sanduhr
    // statt eines stillen „Wird geladen …".
    slotKachel.innerHTML = `<span class="termin-kachel-label">Naechstes freies Datum</span>`;
    const slotDatum = document.createElement("span");
    slotDatum.className = "termin-kachel-datum";
    slotDatum.appendChild(sanduhr("Wird aus dem Redaktionsplan gelesen …"));
    slotKachel.appendChild(slotDatum);
    slotKachel.style.cursor = "wait";
    kacheln.appendChild(slotKachel);

    // v113 (H3): den schon geladenen Plan nehmen — jedes Zeichnen lud ihn sonst neu (samt Kampagnen-Tabellen),
    // und das anschliessende Neuzeichnen startete den naechsten Lauf (Endlosschleife, v112).
    (S.plan ? Promise.resolve(S.plan) : ladePlan()).then((plan) => {
      // v89: eine Regel fuer alle Stellen — Format der Karte + machbarer Vorlauf (lib/uploadslots.js).
      const { slot: naechster, grund } = naechsterFreierUpload({
        plan, card: k, cards: S.cards, drehtermine: S.drehtermine,
      });
      if (naechster) {
        slotKachel.querySelector(".termin-kachel-datum").textContent = deutschesDatum(naechster.datum);
        slotKachel.style.cursor = "pointer";
        // v88 (Owner 01.10.2026: „kein Feedback, dann viele Meldungen auf einmal"): SOFORT
        // setzen, zeichnen und melden — die Kachel verschwindet damit, ein zweiter Klick ist nicht
        // moeglich. Speichern und das Neuverteilen schwebender Karten (liest den Redaktionsplan
        // aus Drive, mehrere Sekunden) laufen danach im Hintergrund.
        let gewaehlt = false;
        slotKachel.addEventListener("click", () => {
          if (gewaehlt) return;
          gewaehlt = true;
          merke("dates", einfacherPlan(naechster.datum), false);
          if (naechster.uhrzeit) merke("uploadTime", naechster.uhrzeit, false);
          zeichne();
          meldung(`Upload am ${deutschesDatum(naechster.datum)} geplant.`, "erfolg");
          Promise.resolve(speichere())
            .then(() => schwebendeNeuBerechnen()) // Karte belegt den Termin ueber ihr Upload-Datum (v30/v52)
            .then(() => zeichne())
            .catch(() => {});
        });
      } else {
        slotKachel.querySelector(".termin-kachel-label").textContent = "Kein passender Termin";
        slotKachel.querySelector(".termin-kachel-datum").textContent = grund;
        slotKachel.style.cursor = "default";
        slotKachel.classList.add("termin-kachel-leer");
      }
    }).catch(() => {
      slotKachel.querySelector(".termin-kachel-datum").textContent = "Nicht verfuegbar.";
      slotKachel.style.cursor = "default";
    });

    // Untere Kachel: manuell.
    const manuellKachel = document.createElement("div");
    manuellKachel.className = "termin-kachel termin-kachel-manuell";
    manuellKachel.innerHTML = `<span class="termin-kachel-label">Anderes Datum waehlen</span>`;
    manuellKachel.addEventListener("click", () => {
      modalKalender(
        "Wann soll das Video veroeffentlicht werden?",
        "Dreh wird automatisch 2 Wochen vorher gesetzt.",
        fensterFuerTyp(k.contenttyp || ""),
        uploadDatumCallback(merke)
      );
    });
    kacheln.appendChild(manuellKachel);
    box.appendChild(kacheln);
  }

  g.appendChild(box);
  return g;
}

// Upload-Datum aendern/setzen: derselbe Callback stand bisher dreifach fast wortgleich an drei
// Stellen (Termin-Block, Idee-Terminblock, manuelle Kachel) — jetzt einmal (v77).
function uploadDatumCallback(merke) {
  return async (datum, zeit) => {
    merke("dates", einfacherPlan(datum), false);
    if (zeit) merke("uploadTime", zeit, false);
    setStand(`Upload am ${deutschesDatum(datum)}.`);
    await schwebendeNeuBerechnen(); // kann eine schwebende Karte verdraengt haben (v30)
    zeichne();
  };
}

function bearbeitenUploadKnopf(k, merke) {
  const bearbeiten = knopf("bearbeiten", {
    zeichen: "kalender",
    klick: () => {
      modalKalender(
        "Upload-Datum aendern",
        "Dreh wird automatisch 2 Wochen vorher gesetzt.",
        fensterFuerTyp(k.contenttyp || ""),
        uploadDatumCallback(merke)
      );
    },
  });
  bearbeiten.classList.add("knopf-inline");
  return bearbeiten;
}

// Ein Fristfeld setzen oder loeschen, ohne die anderen anzutasten.
function setzeTermin(k, key, wert, merke) {
  const neu = { ...(k.dates || {}) };
  if (wert) neu[key] = wert;
  else delete neu[key];
  merke("dates", neu, key === "upload" ? false : true);
  // Ein explizit gesetztes Upload-Datum kann eine schwebende Karte verdraengt haben (v30).
  if (key === "upload") schwebendeNeuBerechnen().then(zeichne);
}

// v30: Checkbox "Naechsten freien Upload-Termin" — an: die Karte traegt kein getipptes
// Datum mehr, sondern zeigt den live berechneten Slot (schwebendAnzeige). Aus: das zuletzt
// berechnete Datum bleibt als expliziter Wert stehen (k.dates.upload wurde bereits beim
// letzten Lauf von schwebendeNeuBerechnen() geschrieben) — die Karte steht nie ohne Datum da.
function floatSchalter(k, merke) {
  return pillenSchalter([{
    text: "Naechsten freien Upload-Termin",
    an: !!k.floatUpload,
    // v88: sofort umschalten und zeichnen (Sanduhr in der Anzeige), DANN rechnen — vorher kam die
    // Reaktion erst nach dem Lesen des Redaktionsplans aus Drive (mehrere Sekunden), und jeder
    // Klick in der Zeit wurde nachgeholt.
    beiAenderung: async (checked) => {
      merke("floatUpload", checked, false);
      if (!checked) { zeichne(); return; }
      schwebendRechnet.add(k.id);
      zeichne();
      try { await schwebendeNeuBerechnen(); } finally { schwebendRechnet.delete(k.id); zeichne(); }
    },
  }]);
}

// v30: Read-only-Zeile fuer eine schwebende Karte — kein Datumsfeld, sondern der live
// berechnete Stand (statusChip + Satz, kein nackter Wert ohne Kontext).
const schwebendRechnet = new Set(); // v88: Karten-ids, deren schwebender Termin gerade berechnet wird

function schwebendAnzeige(k) {
  const wrap = document.createElement("div");
  wrap.className = "befund";
  if (schwebendRechnet.has(k.id)) {
    wrap.appendChild(sanduhr("Sucht den nächsten freien Termin im Redaktionsplan …"));
    return wrap;
  }
  const datum = (k.dates || {}).upload;
  if (datum) {
    wrap.innerHTML =
      statusChip("hinweis") +
      `<span class="befund-satz">Wuerde jetzt gepostet am ${escape(deutschesDatum(datum))}` +
      `${k.uploadTime ? ` um ${escape(k.uploadTime)} Uhr` : ""} — rutscht automatisch weiter, ` +
      `sobald eine andere Karte den Termin belegt.</span>`;
  } else {
    wrap.innerHTML =
      statusChip("fehlt") +
      `<span class="befund-satz">Kein freier Redaktionsplan-Slot in den naechsten zwei Monaten gefunden.</span>`;
  }
  return wrap;
}

// Aufklappbarer Unterblock — Sekundaeres ausblenden, ohne es zu verlieren. `offen`/`onToggle`
// (v77) wie bei gruppe() — Default zu, wie bisher ueberall verwendet.
function klappe(titel, offen = false, onToggle = null) {
  const d = document.createElement("details");
  d.className = "gruppe unterklappe";
  d.open = offen;
  d.innerHTML = `<summary class="gruppe-kopf"><span class="gruppe-titel">${escape(titel)}</span></summary>`;
  if (onToggle) d.addEventListener("toggle", () => onToggle(d.open));
  const box = document.createElement("div");
  d.appendChild(box);
  return { d, box };
}

// --- Mini-Kalender der Fristen -------------------------------------------

const MINI_MONATE = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
let miniMonat = null;
let miniKarteId = null;

function standardMonat(k) {
  const gesetzt = Object.values(k.dates || {}).filter(Boolean).sort();
  const anker = gesetzt[0] || isoDatum(new Date());
  const d = new Date(anker + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function miniNav(zeichen, klick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "mini-nav";
  b.innerHTML = icon(zeichen);
  b.addEventListener("click", klick);
  return b;
}

function miniKalender(k) {
  if (miniKarteId !== k.id) {
    miniKarteId = k.id;
    miniMonat = null;
  }
  const monat = miniMonat || standardMonat(k);

  const wrap = document.createElement("div");
  wrap.className = "mini-kalender";

  const kopf = document.createElement("div");
  kopf.className = "mini-kopf";
  kopf.appendChild(miniNav("zurueck", () => {
    miniMonat = new Date(monat.getFullYear(), monat.getMonth() - 1, 1);
    zeichne();
  }));
  const name = document.createElement("span");
  name.className = "mini-monat";
  name.textContent = `${MINI_MONATE[monat.getMonth()]} ${monat.getFullYear()}`;
  kopf.appendChild(name);
  kopf.appendChild(miniNav("weiter", () => {
    miniMonat = new Date(monat.getFullYear(), monat.getMonth() + 1, 1);
    zeichne();
  }));
  wrap.appendChild(kopf);

  const raster = document.createElement("div");
  raster.className = "mini-raster";
  for (const wt of ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]) {
    const z = document.createElement("div");
    z.className = "mini-wt";
    z.textContent = wt;
    raster.appendChild(z);
  }

  const proTag = new Map();
  for (const t of TERMINE) {
    const d = (k.dates || {})[t.key];
    if (!d) continue;
    if (!proTag.has(d)) proTag.set(d, []);
    proTag.get(d).push(t);
  }

  const erster = new Date(monat.getFullYear(), monat.getMonth(), 1);
  const start = new Date(erster);
  start.setDate(start.getDate() - ((erster.getDay() + 6) % 7));
  const heute = isoDatum(new Date());

  for (let i = 0; i < 42; i++) {
    const tag = new Date(start);
    tag.setDate(start.getDate() + i);
    const iso = isoDatum(tag);
    const zelle = document.createElement("div");
    zelle.className =
      "mini-tag" +
      (tag.getMonth() !== monat.getMonth() ? " fremd" : "") +
      (iso === heute ? " heute" : "");
    const zahl = document.createElement("span");
    zahl.className = "mini-tag-zahl";
    zahl.textContent = tag.getDate();
    zelle.appendChild(zahl);

    const treffer = proTag.get(iso);
    if (treffer) {
      const punkte = document.createElement("span");
      punkte.className = "mini-punkte";
      for (const t of treffer) {
        const p = document.createElement("span");
        p.className = `mini-punkt marke-${t.key}`;
        p.title = `${t.name} am ${new Date(iso + "T00:00:00").toLocaleDateString("de-DE")}`;
        punkte.appendChild(p);
      }
      zelle.appendChild(punkte);
    }
    raster.appendChild(zelle);
  }
  wrap.appendChild(raster);

  const gesetzt = TERMINE.filter((t) => (k.dates || {})[t.key]);
  const leg = document.createElement("div");
  leg.className = "mini-legende";
  if (gesetzt.length) {
    leg.innerHTML = gesetzt
      .map(
        (t) =>
          `<span class="mini-legende-item"><span class="mini-punkt marke-${t.key}"></span>${escape(t.kurz)} ` +
          `${new Date((k.dates)[t.key] + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>`
      )
      .join("");
  } else {
    leg.innerHTML = `<span class="mini-legende-leer">Noch keine Fristen gesetzt — Datum unten, dann rueckwaerts planen.</span>`;
  }
  wrap.appendChild(leg);
  return wrap;
}

// Die Arbeit der aktuellen Phase: KI-Aktionen, Auswahl, Felder.
function blockPhase(k, toreListe, stand) {
  const p = phase(k.column);
  const g = gruppeMitFarbe("phase", `Arbeit in "${p.name}"`, null, offenFuer(k, "phase", true), merkeKlapp(k, "phase"));
  const box = document.createElement("div");
  // P5 (v37): vertikaler Abstand zwischen den gestapelten Elementen (Buttons, Felder,
  // Ergebniszeilen) — ohne Gap klebten sie aneinander.
  box.className = "phasen-arbeit";

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

  // Schritt 1 „Skript schreiben" (idee): Recherche-/Hook-Loop und — sobald die Hooks stehen —
  // der Skript-Loop im selben Schritt (v16c). Kein Auto-Sprung mehr.
  if (k.column === "idee") {
    // v79 C2: Kurzvideo (reel/leer) laeuft den Video-Skript-Flow; alle anderen Formate ihren
    // eigenen KI-Flow (Slider/Beitrag/Story/Langform) mit bespoke Ergebnis-Editoren.
    const kurzvideo = !k.contenttyp || k.contenttyp === "reel";
    if (kurzvideo) {
      guidedIdee(k, box);
      const ideeFertig =
        k.recherche && k.chosenFokus != null && k.chosenVerbal != null && k.chosenVisuell != null;
      if (ideeFertig) skriptLoop(k, box);
    } else {
      guidedFormat(k, box);
    }
  }
  // Schritt 2 „Drehtermin festlegen" (skript): keine Skript-Werkzeuge mehr — die Zuordnung
  // steht im eigenen Drehtermin-Block darueber.
  if (k.column === "skript") {
    const hin = document.createElement("p");
    hin.className = "feld-hinweis";
    hin.textContent = "Ordne die Karte oben einem Drehtermin zu, dann „Weiter“ in den Videodreh.";
    box.appendChild(hin);
  }
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
  if (k.column === "verworfen") {
    const p2 = document.createElement("p");
    p2.className = "feld-hinweis";
    p2.textContent = "Verworfen und geparkt. Die KI schlaegt diese Idee bei der Ideensuche nicht mehr vor. Zurueckholen unten.";
    box.appendChild(p2);
  }

  g.appendChild(box);
  return g;
}

// --- Phasen-Felder --------------------------------------------------------

// Der gefuehrte Idee-Loop: ein Anstoss, dann Schritt fuer Schritt. Jede getroffene Wahl
// verschwindet, die naechste Stufe erscheint — und baut auf der vorigen auf.
//   Recherche -> Fokus -> verbaler Hook -> visueller Hook -> rutscht ins Skript.
function guidedIdee(k, box) {
  const r = k.recherche;

  // Start: noch nichts recherchiert.
  if (!r) {
    box.appendChild(
      knopf("Recherchieren und Definieren", {
        art: "haupt",
        zeichen: "funken",
        klick: (e) => rufeKi("recherche", k, e.currentTarget, box),
      })
    );
    return;
  }
  if (r.raw || !Array.isArray(r.fokus)) {
    box.appendChild(rohBlock(r.raw ? r : { raw: JSON.stringify(r) }, (e) => rufeKi("recherche", k, e.currentTarget, box)));
    return;
  }

  const stufe = k.chosenFokus == null ? 1 : k.chosenVerbal == null ? 2 : 3;
  box.appendChild(schrittKopf(stufe));

  // Stufe 1: Fokus.
  if (stufe === 1) {
    if (r.zusammenfassung) box.appendChild(rechercheKlappe(r.zusammenfassung));
    box.appendChild(
      wahlgruppe(
        "Fokus — worum es im Kern geht",
        r.fokus.map((f, i) => ({ i, titel: f.titel, text: f.text })),
        null,
        (i) => {
          setzeTief(k, "chosenFokus", i);
          // Problem/Handlung und Suchbegriffe wandern still mit — keine Extra-Knoepfe.
          if (r.frame) setzeTief(k, "frame", { problem: r.frame.problem || "", solution: r.frame.solution || "" });
          if (Array.isArray(r.keywords)) setzeTief(k, "caption.keywords", r.keywords);
          delete k.hooksVerbal;
          delete k.chosenVerbal;
          delete k.hooksVisuell;
          delete k.chosenVisuell;
          speichere();
          rufeKi("hooks_verbal", k, null, box);
        }
      )
    );
    return;
  }

  // Stufe 2: verbaler Hook.
  if (stufe === 2) {
    box.appendChild(gewaehltZeile("Fokus", r.fokus[k.chosenFokus].titel));
    const hv = k.hooksVerbal;
    if (!hv || !Array.isArray(hv.hooks)) {
      box.appendChild(
        knopf("Verbale Hooks holen", { art: "haupt", zeichen: "funken", klick: (e) => rufeKi("hooks_verbal", k, e.currentTarget, box) })
      );
    } else {
      box.appendChild(
        wahlgruppe(
          "Verbaler Hook — der gesprochene Einstieg",
          hv.hooks.map((h, i) => ({ i, titel: h.label, text: h.verbal })),
          null,
          (i) => {
            setzeTief(k, "chosenVerbal", i);
            setzeTief(k, "hook.text", hv.hooks[i].verbal || "");
            delete k.hooksVisuell;
            delete k.chosenVisuell;
            speichere();
            rufeKi("hooks_visuell", k, null, box);
          }
        )
      );
    }
    box.appendChild(
      zurueckKnopf(() => {
        delete k.chosenFokus;
        delete k.hooksVerbal;
        delete k.chosenVerbal;
        speichere();
        zeichne();
      })
    );
    return;
  }

  // Stufe 3: visueller Hook -> danach ins Skript.
  box.appendChild(gewaehltZeile("Fokus", r.fokus[k.chosenFokus].titel));
  box.appendChild(gewaehltZeile("Verbaler Hook", (k.hook && k.hook.text) || ""));
  const hvis = k.hooksVisuell;
  // P6a (v37): Ist der sichtbare Hook gewaehlt, ist die Entscheidung getroffen — dann keine
  // Auswahlpunkte mehr, sondern die Ergebniszeile (wie Fokus/Verbaler Hook darueber). Der
  // Skript-Loop erscheint darunter (ideeFertig). „Zurueck" oeffnet die Auswahl wieder.
  if (k.chosenVisuell != null) {
    box.appendChild(gewaehltZeile("Sichtbarer Hook", (k.hook && k.hook.visual) || ""));
    box.appendChild(
      zurueckKnopf(() => {
        delete k.chosenVisuell;
        if (k.hook) delete k.hook.visual;
        speichere();
        zeichne();
      })
    );
    return;
  }
  if (!hvis || !Array.isArray(hvis.hooks)) {
    box.appendChild(
      knopf("Visuelle Hooks holen", { art: "haupt", zeichen: "funken", klick: (e) => rufeKi("hooks_visuell", k, e.currentTarget, box) })
    );
  } else {
    box.appendChild(
      wahlgruppe(
        "Sichtbarer Hook — was man in Sekunde 0 bis 1 sieht",
        hvis.hooks.map((h, i) => ({ i, titel: h.label, text: h.visuell })),
        null,
        async (i) => {
          setzeTief(k, "chosenVisuell", i);
          setzeTief(k, "hook.visual", hvis.hooks[i].visuell || "");
          await speichere();
          // Drive-Ordner automatisch anlegen — Workflow "drive-ordner-anlegen" (v26). Optimistisch
          // im Hintergrund; ein Fehlschlag ist sichtbar + wiederholbar (v55).
          if (an("drive-ordner-anlegen") && k.title && !k.driveName) {
            optimistisch({
              extern: () => driveAnlegen(k),
              sichern: null,
              was: "Projektordner anlegen",
              beiErfolg: () => meldung("Projektordner im Drive angelegt.", "erfolg"),
            });
          }
          // v16c: Karte bleibt in „Skript schreiben"; der Skript-Loop erscheint jetzt darunter.
          zeichne();
        }
      )
    );
  }
  box.appendChild(
    zurueckKnopf(() => {
      delete k.chosenVerbal;
      delete k.hooksVisuell;
      delete k.chosenVisuell;
      if (k.hook) delete k.hook.text;
      speichere();
      zeichne();
    })
  );
}

function schrittKopf(n) {
  const p = document.createElement("p");
  p.className = "schritt-kopf";
  const namen = ["Fokus", "Verbaler Hook", "Sichtbarer Hook"];
  p.textContent = `Schritt ${n} von 3 · ${namen[n - 1]}`;
  return p;
}

function gewaehltZeile(label, text) {
  const d = document.createElement("div");
  d.className = "gewaehlt-zeile";
  d.innerHTML = icon("check") + `<span><strong>${escape(label)}:</strong> ${escape(text || "")}</span>`;
  return d;
}

function zurueckKnopf(klick) {
  const b = knopf("Einen Schritt zurueck", { zeichen: "zurueck", klick });
  b.classList.add("schritt-zurueck");
  return b;
}

// P6b (v37): ein Textfeld waechst mit seinem Inhalt bis maxPx, danach scrollt es. Die erste
// Messung braucht das Element im DOM — die Karte wird erst nach dem Bau eingehaengt, deshalb
// requestAnimationFrame statt sofortiger Messung (scrollHeight waere sonst 0).
function wachsePassend(el, maxPx = 260) {
  const anpassen = () => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxPx) + "px";
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  };
  el.addEventListener("input", anpassen);
  requestAnimationFrame(anpassen);
}

function rechercheKlappe(text) {
  const d = document.createElement("details");
  d.className = "gruppe";
  d.innerHTML = `<summary class="gruppe-kopf"><span class="gruppe-titel">Recherche und Hard Facts</span></summary>`;
  const pre = document.createElement("pre");
  pre.className = "textblock";
  pre.textContent = text;
  d.appendChild(pre);
  return d;
}

// Loop 2: die drei Bausteine aus Loop 1 editierbar, EIN Knopf schreibt alles, danach das
// fertige Skript als Fliesstext editierbar, Speichern -> .txt in Drive -> Upload-Datum -> Videodreh.
function skriptLoop(k, box) {
  const merke = (pfad, wert) => {
    setzeTief(k, pfad, wert);
    speichere();
  };

  const fokusStart =
    k.fokusText != null
      ? k.fokusText
      : k.recherche && k.chosenFokus != null && k.recherche.fokus && k.recherche.fokus[k.chosenFokus]
      ? `${k.recherche.fokus[k.chosenFokus].titel}: ${k.recherche.fokus[k.chosenFokus].text}`
      : "";
  // P6b (v37): alle drei Felder mehrzeilig (textfeld) statt einzeiliger Eingaben — langer Text
  // war in <input> weder ganz sichtbar noch bequem editierbar. Textareas scrollen von selbst;
  // wachsePassend() vergroessert sie zusaetzlich bis zu einer Deckelung mit dem Inhalt.
  const fokusEl = textfeld(fokusStart, 3, "Der gewaehlte Fokus");
  fokusEl.addEventListener("change", () => merke("fokusText", fokusEl.value));
  box.appendChild(feld("Fokus", fokusEl));
  wachsePassend(fokusEl);

  const vEl = textfeld((k.hook && k.hook.text) || "", 2, "Der gesprochene Einstieg");
  vEl.addEventListener("change", () => merke("hook.text", vEl.value));
  box.appendChild(feld("Verbaler Hook", vEl, `Hoechstens etwa ${MASSE.hookWoerterMax} Woerter.`));
  wachsePassend(vEl);

  const viEl = textfeld((k.hook && k.hook.visual) || "", 2, "Was man in Sekunde 0 bis 1 sieht");
  viEl.addEventListener("change", () => merke("hook.visual", viEl.value));
  box.appendChild(feld("Sichtbarer Hook", viEl, "Vier von fuenf schauen ohne Ton — das Bild muss den Hook tragen."));
  wachsePassend(viEl);

  // Ein Knopf, der alles schreibt.
  box.appendChild(
    knopf(k.skriptFinal || (k.ai && k.ai.skript) ? "Skript neu schreiben" : "Skript schreiben", {
      art: "haupt",
      zeichen: "funken",
      klick: (e) => rufeKi("skript", k, e.currentTarget, box),
    })
  );

  // Nach der Generierung: der fertige Text zum Rueberlesen und Aendern.
  const text = k.skriptFinal || (k.ai && k.ai.skript) || "";
  if (!text) return;

  const skript = textfeld(text, 12, "Der fertige Sprechertext");
  const zaehler = document.createElement("p");
  zaehler.className = "zaehler";
  const zaehle = () => {
    const s = sprechzeit(skript.value);
    zaehler.textContent = `Etwa ${s} Sekunden Sprechzeit — die Hausregel liegt bei ${MASSE.sprechzeitMax}.`;
    zaehler.classList.toggle("zuviel", s > MASSE.sprechzeitMax);
  };
  zaehle();
  skript.addEventListener("input", zaehle);
  skript.addEventListener("change", () => merke("skriptFinal", skript.value));
  box.appendChild(feld("Fertiges Skript", skript));
  box.appendChild(zaehler);

  box.appendChild(
    knopf("Skript speichern und weiter zu „Drehtermin festlegen“", {
      art: "haupt",
      zeichen: "ordner",
      klick: async (e) => {
        setzeTief(k, "skriptFinal", skript.value);
        await nachDrive(k, DATEINAMEN.skript, skript.value, e.currentTarget, box);
        setzeTief(k, "skriptGespeichert", true);
        await speichere();
        // Workflow "skript-gespeichert-weiter" (v26): aus bleibt die Karte stehen.
        if (!an("skript-gespeichert-weiter")) {
          meldung("Skript gespeichert. Die Karte bleibt stehen (Workflow ist aus).", "erfolg");
          zeichne();
          return;
        }
        // v16c: Upload wurde in Schritt 1 schon aus dem Redaktionsplan gesetzt — direkt weiter
        // zu „Drehtermin festlegen". Fehlt es doch, wird es hier als Fallback nachgeholt.
        if ((k.dates || {}).upload) {
          await schiebe(k, "skript");
        } else {
          modalKalender(
            "Wann soll das Video veroeffentlicht werden?",
            "Aus dem Upload-Datum setzt das Board Schnitt- und Freigabetermine automatisch.",
            fensterFuerTyp(k.contenttyp || ""),
            async (datum, zeit) => {
              setzeTief(k, "dates", { ...terminplan(datum), upload: datum });
              if (zeit) setzeTief(k, "uploadTime", zeit);
              await speichere();
              await schiebe(k, "skript");
            }
          );
        }
      },
    })
  );
}

// --- v79 C2: Format-spezifische KI-Flows (volle Paritaet) --------------------
// Nicht-Kurzvideo-Formate durchlaufen in der Erstell-Phase ihren eigenen Flow: Format-Knopf →
// rufeKi → strukturiertes Ergebnis (k.formate[task]) → bespoke, editierbarer Editor → nach Drive.

// v113: die Tabelle lebt in lib/pipeline.js — das Tor „Format-Datei" prueft genau diese Namen.
const FORMAT_DATEINAME = FORMAT_DATEINAMEN;

const fmtDaten = (k, task) => (k.formate || {})[task] || null;

// Editierbares Textfeld, an einen Pfad in der Karte gebunden (speichert bei Aenderung, ohne
// die Box neu zu zeichnen — sonst verliert das Feld den Fokus mitten im Tippen).
function fmtFeld(k, pfad, wert, rows, ph) {
  const ta = textfeld(wert || "", rows || 2, ph || "");
  ta.addEventListener("change", () => {
    setzeTief(k, pfad, ta.value);
    speichere();
  });
  return ta;
}

// v104 (Owner 01.10.2026: „keine Klammern und Code-Anhang"): Laesst sich eine KI-Antwort auch
// nachsichtig nicht lesen, steht sie als normaler Text da — mit dem Hinweis, wie man sie neu
// erzeugt — statt als Code-Block.
function rohBlock(d, nochmal = null) {
  const wrap = document.createElement("div");
  wrap.className = "ki-rohtext";
  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.textContent = "Die KI-Antwort kam nicht im erwarteten Aufbau. Lass sie neu erzeugen — der Text unten ist nur zur Ansicht.";
  wrap.appendChild(hinweis);
  if (nochmal) wrap.appendChild(knopf("Erneut versuchen", { art: "haupt", zeichen: "funken", klick: nochmal }));
  const text = document.createElement("p");
  text.className = "ki-rohtext-inhalt";
  text.textContent = String(d.raw || "").replace(/[{}\[\]"]/g, "").replace(/^\s*[\w-]+:\s*/gm, "").trim();
  wrap.appendChild(text);
  return wrap;
}

// v104: Alte Roh-Antworten beim Anzeigen reparieren — was sich nachsichtig lesen laesst, wird
// zum strukturierten Ergebnis (und gespeichert), damit Felder statt Code erscheinen.
const KI_FELDER = ["recherche", "hooksVerbal", "hooksVisuell", "captionVorschlag"];
function repariereRohAntworten(k) {
  let geaendert = false;
  const heile = (obj, setze) => {
    if (!obj || !obj.raw) return;
    const o = parseJsonNachsichtig(obj.raw);
    if (o && typeof o === "object") { setze(o); geaendert = true; }
  };
  for (const f of KI_FELDER) heile(k[f], (o) => { k[f] = o; });
  for (const t of Object.keys(k.formate || {})) heile(k.formate[t], (o) => { k.formate[t] = o; });
  if (geaendert) speichere();
}

function guidedFormat(k, box) {
  const fmt = contenttypFormat(k.contenttyp || "reel");
  const hinweis = document.createElement("p");
  hinweis.className = "feld-hinweis";
  hinweis.textContent =
    `Die KI laeuft lokal ueber deine Claude-CLI. Dieser Flow ist auf „${contenttypName(k.contenttyp)}“ zugeschnitten.`;
  box.appendChild(hinweis);

  const flows = {
    Carousel: { tasks: [["slider_aufbau", "Slider aufbauen"], ["slider_visual", "Visual je Slide"]], render: rendereSlider },
    Bildpost: { tasks: [["beitrag_visual", "Text-Beitrag bauen"]], render: rendereBeitrag },
    Story: { tasks: [["story_frames", "Story-Frames bauen"]], render: rendereStory },
    Video: { tasks: [["langform_konzept", "Storytelling-Konzept"]], render: rendereLangform },
  };
  const flow = flows[fmt];
  if (!flow) {
    const p = document.createElement("p");
    p.className = "feld-hinweis";
    p.textContent = "Fuer dieses Format gibt es noch keinen eigenen KI-Flow.";
    box.appendChild(p);
    return;
  }

  const reihe = document.createElement("div");
  reihe.className = "knopfreihe";
  // v88 (Owner 01.10.2026: Schritt fuer Schritt): ein Schritt erscheint erst, wenn der vorige ein
  // Ergebnis hat — z. B. „Visual je Slide" erst nach „Slider aufbauen", damit sich die Visuals am
  // geschriebenen Text orientieren.
  for (const [i, [task, name]] of flow.tasks.entries()) {
    if (i > 0 && !fmtDaten(k, flow.tasks[i - 1][0])) break;
    const fertig = !!fmtDaten(k, task);
    reihe.appendChild(
      knopf(fertig ? `${name} — neu` : name, {
        art: "haupt",
        zeichen: "funken",
        klick: (e) => rufeKi(task, k, e.currentTarget, box),
      })
    );
  }
  box.appendChild(reihe);

  flow.render(k, box);

  if (flow.tasks.some(([task]) => fmtDaten(k, task))) {
    box.appendChild(
      knopf("Inhalt nach Drive speichern", {
        art: "haupt",
        zeichen: "ordner",
        klick: (e) => nachDrive(k, FORMAT_DATEINAME[fmt] || "10_inhalt.md", formatAlsText(k, fmt), e.currentTarget, box),
      })
    );
  }
}

function rendereSlider(k, box) {
  const d = fmtDaten(k, "slider_aufbau");
  if (!d) return;
  if (d.raw || !Array.isArray(d.slides)) return void box.appendChild(rohBlock(d));
  const vis = fmtDaten(k, "slider_visual");
  const visSlides = vis && Array.isArray(vis.slides) ? vis.slides : [];
  d.slides.forEach((s, i) => {
    const karte = document.createElement("div");
    karte.className = "format-slide";
    const titel = document.createElement("div");
    titel.className = "format-slide-nr";
    titel.textContent = `Slide ${s.nr || i + 1}${s.rolle ? " · " + s.rolle : ""}`;
    karte.appendChild(titel);
    karte.appendChild(feld("Text", fmtFeld(k, `formate.slider_aufbau.slides.${i}.text`, s.text, 3)));
    karte.appendChild(feld("Visual", fmtFeld(k, `formate.slider_aufbau.slides.${i}.visual`, s.visual, 2)));
    const v = visSlides[i];
    if (v && v.bildprompt) karte.appendChild(feld("Bild-Prompt", fmtFeld(k, `formate.slider_visual.slides.${i}.bildprompt`, v.bildprompt, 2)));
    box.appendChild(karte);
  });
  if (d.cta != null) box.appendChild(feld("CTA (letzte Slide)", fmtFeld(k, "formate.slider_aufbau.cta", d.cta, 2)));
  if (d.caption != null) box.appendChild(feld("Caption", fmtFeld(k, "formate.slider_aufbau.caption", d.caption, 3)));
}

function rendereBeitrag(k, box) {
  const d = fmtDaten(k, "beitrag_visual");
  if (!d) return;
  if (d.raw) return void box.appendChild(rohBlock(d));
  if (d.hook != null) box.appendChild(feld("Hook", fmtFeld(k, "formate.beitrag_visual.hook", d.hook, 2)));
  if (d.body != null) box.appendChild(feld("Body", fmtFeld(k, "formate.beitrag_visual.body", d.body, 6)));
  if (d.cta != null) box.appendChild(feld("CTA / Frage", fmtFeld(k, "formate.beitrag_visual.cta", d.cta, 2)));
  if (d.visual != null) box.appendChild(feld("Visual-Konzept", fmtFeld(k, "formate.beitrag_visual.visual", d.visual, 2)));
  const tags = d.hashtags_text != null ? d.hashtags_text : Array.isArray(d.hashtags) ? d.hashtags.join(" ") : "";
  box.appendChild(feld("Hashtags", fmtFeld(k, "formate.beitrag_visual.hashtags_text", tags, 1)));
}

function rendereStory(k, box) {
  const d = fmtDaten(k, "story_frames");
  if (!d) return;
  if (d.raw || !Array.isArray(d.frames)) return void box.appendChild(rohBlock(d));
  d.frames.forEach((f, i) => {
    const karte = document.createElement("div");
    karte.className = "format-slide";
    const titel = document.createElement("div");
    titel.className = "format-slide-nr";
    titel.textContent = `Frame ${f.nr || i + 1}${f.medium ? " · " + f.medium : ""}${f.sticker ? " · " + f.sticker : ""}`;
    karte.appendChild(titel);
    karte.appendChild(feld("Text", fmtFeld(k, `formate.story_frames.frames.${i}.text`, f.text, 2)));
    if (f.warum != null) karte.appendChild(feld("Bild oder Video?", fmtFeld(k, `formate.story_frames.frames.${i}.warum`, f.warum, 1)));
    box.appendChild(karte);
  });
}

function rendereLangform(k, box) {
  const d = fmtDaten(k, "langform_konzept");
  if (!d) return;
  if (d.raw || !Array.isArray(d.kapitel)) return void box.appendChild(rohBlock(d));
  if (d.struktur != null) box.appendChild(feld("Struktur (roter Faden)", fmtFeld(k, "formate.langform_konzept.struktur", d.struktur, 2)));
  if (d.hook != null) box.appendChild(feld("Hook-Beat (erste ~30 s)", fmtFeld(k, "formate.langform_konzept.hook", d.hook, 2)));
  d.kapitel.forEach((kap, i) => {
    const karte = document.createElement("div");
    karte.className = "format-slide";
    const titel = document.createElement("div");
    titel.className = "format-slide-nr";
    titel.textContent = `Kapitel ${kap.nr || i + 1}`;
    karte.appendChild(titel);
    karte.appendChild(feld("Titel", fmtFeld(k, `formate.langform_konzept.kapitel.${i}.titel`, kap.titel, 1)));
    const beats = kap.beats_text != null ? kap.beats_text : Array.isArray(kap.beats) ? kap.beats.join("\n") : kap.beats || "";
    karte.appendChild(feld("Beats (Stichpunkte)", fmtFeld(k, `formate.langform_konzept.kapitel.${i}.beats_text`, beats, 3)));
    if (kap.payoff != null) karte.appendChild(feld("Payoff", fmtFeld(k, `formate.langform_konzept.kapitel.${i}.payoff`, kap.payoff, 1)));
    box.appendChild(karte);
  });
  if (d.schluss != null) box.appendChild(feld("Schluss + CTA", fmtFeld(k, "formate.langform_konzept.schluss", d.schluss, 2)));
}

// Kompiliert das aktuelle Format-Ergebnis zu einer menschenlesbaren Markdown-Datei fuer Drive.
function formatAlsText(k, fmt) {
  const z = [];
  if (fmt === "Carousel") {
    const d = fmtDaten(k, "slider_aufbau") || {};
    const vis = fmtDaten(k, "slider_visual") || {};
    z.push(`# Slider: ${k.title || ""}`);
    (d.slides || []).forEach((s, i) => {
      z.push(`\n## Slide ${s.nr || i + 1}${s.rolle ? " (" + s.rolle + ")" : ""}`);
      if (s.text) z.push(s.text);
      if (s.visual) z.push(`Visual: ${s.visual}`);
      const v = (vis.slides || [])[i];
      if (v && v.bildprompt) z.push(`Bild-Prompt: ${v.bildprompt}`);
    });
    if (d.cta) z.push(`\n**CTA:** ${d.cta}`);
    if (d.caption) z.push(`\n**Caption:** ${d.caption}`);
  } else if (fmt === "Bildpost") {
    const d = fmtDaten(k, "beitrag_visual") || {};
    z.push(`# Beitrag: ${k.title || ""}`);
    if (d.hook) z.push(`**Hook:** ${d.hook}`);
    if (d.body) z.push(`\n${d.body}`);
    if (d.cta) z.push(`\n**CTA:** ${d.cta}`);
    if (d.visual) z.push(`\n**Visual:** ${d.visual}`);
    const tags = d.hashtags_text || (Array.isArray(d.hashtags) ? d.hashtags.join(" ") : "");
    if (tags) z.push(`\n${tags}`);
  } else if (fmt === "Story") {
    const d = fmtDaten(k, "story_frames") || {};
    z.push(`# Story: ${k.title || ""}`);
    (d.frames || []).forEach((f, i) => {
      z.push(`\n## Frame ${f.nr || i + 1}${f.medium ? " (" + f.medium + ")" : ""}`);
      if (f.text) z.push(f.text);
      if (f.sticker) z.push(`Sticker: ${f.sticker}`);
    });
  } else if (fmt === "Video") {
    const d = fmtDaten(k, "langform_konzept") || {};
    z.push(`# Langform-Konzept: ${k.title || ""}`);
    if (d.struktur) z.push(`**Struktur:** ${d.struktur}`);
    if (d.hook) z.push(`**Hook:** ${d.hook}`);
    (d.kapitel || []).forEach((kap, i) => {
      z.push(`\n## Kapitel ${kap.nr || i + 1}: ${kap.titel || ""}`);
      const beats = kap.beats_text || (Array.isArray(kap.beats) ? kap.beats.map((b) => "- " + b).join("\n") : "");
      if (beats) z.push(beats);
      if (kap.payoff) z.push(`Payoff: ${kap.payoff}`);
    });
    if (d.schluss) z.push(`\n**Schluss:** ${d.schluss}`);
  }
  return z.join("\n");
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

  box.appendChild(rohmaterialZone(k));
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

  box.appendChild(videoUploadZone(k));
}

// v22/v23: Drag&Drop-Upload-Zone, generisch. `opt` = { titel, accept, mehrere, verarbeite }.
// `verarbeite(dateien, zone)` traegt die eigentliche Logik (Ziel, Auto-Move, Meldung).
function uploadZone(k, opt) {
  const zone = document.createElement("div");
  zone.className = "upload-zone";
  zone.innerHTML =
    `<div class="upload-zone-inner knopf-symbol knopf-symbol-ordner">${icon("ordner")}` +
    `<p><strong>${escape(opt.titel)}</strong><br>oder klicken zum Auswaehlen</p></div>`;

  const feldEingabe = document.createElement("input");
  feldEingabe.type = "file";
  feldEingabe.accept = opt.accept;
  if (opt.mehrere) feldEingabe.multiple = true;
  feldEingabe.hidden = true;
  zone.appendChild(feldEingabe);

  const handhabe = async (dateiliste) => {
    const dateien = [...(dateiliste || [])].filter(Boolean);
    if (!dateien.length) return;
    zone.classList.add("laedt");
    try {
      await opt.verarbeite(dateien, zone);
    } catch (fehler) {
      meldung(`Upload fehlgeschlagen: ${fehler.message}`, "fehler");
    } finally {
      zone.classList.remove("laedt");
    }
  };

  zone.addEventListener("click", () => feldEingabe.click());
  feldEingabe.addEventListener("change", () => handhabe(feldEingabe.files));
  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add("ueber");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.remove("ueber");
    })
  );
  zone.addEventListener("drop", (e) => handhabe(e.dataTransfer && e.dataTransfer.files));
  return zone;
}

// Schnitt: fertiges Video -> Fertiges Video/, danach Karte weiter, wenn die Qualitaetssperren
// (Untertitel, Wasserzeichen, Laenge) frei sind — sonst bleibt sie in Schnitt, mit Ansage.
function videoUploadZone(k) {
  return uploadZone(k, {
    titel: "Fertiges Video hierher ziehen",
    accept: "video/*",
    mehrere: false,
    verarbeite: async (dateien, zone) => {
      const datei = dateien[0];
      const weg = fortschritt(zone, `Lade „${datei.name}" nach Drive — das kann bei grossen Dateien dauern …`);
      try {
        const r = await videoHochladen(k, datei);
        // Workflow "upload-fertig-weiter" (v26): aus bleibt die Karte stehen, egal wie die Tore stehen.
        if (!an("upload-fertig-weiter")) {
          meldung(r.satz || "Video hochgeladen.", "erfolg");
          zeichne();
          return;
        }
        const frisch = await driveScan(k, true).catch(() => null);
        const offen = stellschraube("upload-fertig-weiter", "toreBeachten") ? sperren(tore(k, frisch)) : [];
        if (offen.length) {
          await melde("hinweis", `${r.satz || "Video hochgeladen."} Die Karte bleibt in Schnitt: ${offen.map((b) => b.satz).join(" ")}`);
          zeichne();
        } else {
          const ziel = naechstePhase(k.column);
          meldung(r.satz || "Video hochgeladen.", "erfolg");
          if (ziel) await schiebe(k, ziel);
          else zeichne();
        }
      } finally {
        weg();
      }
    },
  });
}

// Videodreh: Rohmaterial -> Rohmaterial/. Mehrere Clips nacheinander, KEIN Auto-Move —
// Rohmaterial waechst ueber die Zeit, ein einzelner Clip beendet die Phase nicht.
function rohmaterialZone(k) {
  return uploadZone(k, {
    titel: "Rohmaterial hierher ziehen (mehrere moeglich)",
    accept: "video/*,image/*,audio/*",
    mehrere: true,
    verarbeite: async (dateien, zone) => {
      let n = 0;
      for (const datei of dateien) {
        const weg = fortschritt(zone, `Lade „${datei.name}" (${n + 1}/${dateien.length}) nach Drive …`);
        try {
          await dateiHochladen(k, datei, "rohmaterial");
          n += 1;
        } finally {
          weg();
        }
      }
      await driveScan(k, true).catch(() => {});
      meldung(`${n} ${n === 1 ? "Datei" : "Dateien"} als Rohmaterial hochgeladen.`, "erfolg");
      zeichne();
    },
  });
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
    const e = eingabe(tags, { platzhalter: "#Marke #Thema" }); // v113 (N8): neutral statt WEE-Hashtags
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
    knopf("Caption nach Drive speichern", { zeichen: "drive",
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
  const g = gruppeMitFarbe("drive", "Google Drive", null, offenFuer(k, "drive", false), merkeKlapp(k, "drive"));
  g.classList.add("gruppe-drive"); // v81: liest selbst frisch aus Drive; v83: markiert sich nur, solange nicht gelesen
  if (k.title && !stand) {
    const kopfZeile = g.querySelector(":scope > summary.gruppe-kopf");
    if (kopfZeile) kopfZeile.appendChild(cacheMarke("noch nicht gelesen", "Der Drive-Ordner dieser Karte wurde noch nicht gelesen."));
  }
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
    p.appendChild(sanduhr("Drive wird gelesen …"));
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
        klick: (e) => {
          // Optimistisch (v55): Fortschritt sichtbar, aber nicht blockierend; der Ordner entsteht
          // im Hintergrund, danach frischer Scan. Fehlschlag ist sichtbar + wiederholbar.
          const weg = fortschritt(box, "Lege den Projektordner an …");
          const btn = e.currentTarget;
          btn.disabled = true;
          optimistisch({
            extern: () => driveAnlegen(k).then(() => driveScan(k, true)),
            sichern: null,
            was: "Projektordner anlegen",
            beiErfolg: () => meldung("Projektordner im Drive angelegt.", "erfolg"),
          }).finally(() => { weg(); btn.disabled = false; });
        },
      })
    );
  } else {
    const z = document.createElement("div");
    z.className = "befund";
    z.innerHTML = statusChip(stand.verschoben ? "hinweis" : "ok") + `<span class="befund-satz">${escape(stand.satz)}</span>`;
    box.appendChild(z);

    const zahlen = document.createElement("div");
    zahlen.innerHTML = kennzahlReihe([
      { zeichen: "clip", wert: stand.rohmaterial, label: "Rohmaterial" },
      { zeichen: "video", wert: stand.final, label: "Fertiges Video" },
      { zeichen: "papier", wert: (stand.skriptDateien || []).length, label: "Skript/Caption" },
    ]);
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

    // v22: Skript- und Rohmaterial-Ordner direkt herunterladen (nur fuer Menschen —
    // System (AI only)/ und projekt.json sind ausgenommen). Nur in Videodreh und Schnitt.
    if (["videodreh", "schnitt"].includes(k.column)) {
      const runter = (was, label, anzahl) => {
        const b = knopf(`${label} (${anzahl})`, {
          zeichen: "ordner",
          klick: (e) => {
            const a = document.createElement("a");
            a.href = downloadUrl(k, was);
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
            // v51: Bisher passierte hier sichtbar gar nichts — der Server holt die Dateien
            // erst aus Drive und packt sie (Timeout 900 s), der Browser-Balken erscheint also
            // deutlich spaeter. Ehrlich gesagt, was laeuft: den Abschluss kann die Seite bei
            // einem <a>-Download nicht erfahren, deshalb sagt das Terminal genau das.
            const t = terminalAn(e.currentTarget, `${label} — Drive packt die Dateien …`);
            t.arbeit("drive", "Holt die Dateien aus Drive und packt sie …");
            const zustand = knopfLaeuft(e.currentTarget, "holt aus Drive …");
            setTimeout(() => {
              t.hinweis("Der Download startet im Browser, sobald das Paket fertig ist.");
              t.fertig({ verzoegerung: 6000 });
              zustand.zurueck();
            }, 2500);
          },
        });
        if (!anzahl) {
          b.disabled = true;
          b.title = "Dieser Ordner ist leer.";
        }
        return b;
      };
      const reihe = document.createElement("div");
      reihe.className = "knopfreihe";
      reihe.appendChild(runter("skript", "Skript laden", (stand.skriptDateien || []).length));
      reihe.appendChild(runter("rohmaterial", "Rohmaterial laden", stand.rohmaterial || 0));
      box.appendChild(reihe);
    }
  }

  box.appendChild(
    knopf("Drive erneut lesen", {
      zeichen: "neuladen",
      klick: async () => {
        await driveScan(k, true).catch(() => {
          meldung("Drive-Scan fehlgeschlagen.", "fehler");
        });
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
  const g = gruppeMitFarbe("archiv", "Gespeicherte KI-Ergebnisse", eintraege.length, offenFuer(k, "archiv", false), merkeKlapp(k, "archiv"));
  const box = document.createElement("div");
  for (const task of eintraege) {
    const text = k.ai[task] || "";
    let name = KI_NAMEN[task] || task;
    if (task === "skript") name += ` — etwa ${sprechzeit(text)} Sekunden`;
    // v77: leichter verschachtelter Unterblock (wie "Weitere Angaben") statt einer zweiten
    // vollgewichtigen .gruppe ineinander — zwei gleich schwere Rahmen sahen wie ein Fehler aus.
    const { d, box: inhalt } = klappe(name, offenFuer(k, `archiv:${task}`, false), merkeKlapp(k, `archiv:${task}`));
    const pre = document.createElement("pre");
    pre.className = "textblock";
    pre.textContent = text;
    inhalt.appendChild(pre);
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
    inhalt.appendChild(reihe);
    box.appendChild(d);
  }
  g.appendChild(box);
  return g;
}

// --- Abschluss ------------------------------------------------------------

// v80 (Owner 28.09.2026): "Weiter" ist der einzige Weg, den die meisten Karten gehen — Verwerfen
// und Loeschen sind seltene Nebenwege, standen bisher aber als drei gleich gewichtete Zeilen
// untereinander (Pille/Flaeche/nackter Text, drei verschiedene Stile). Jetzt: EIN Hauptknopf
// plus ein kleiner Menue-Knopf fuer die Nebenwege (mehrMenu(), ui.js).
function blockAbschluss(k, toreListe) {
  const box = document.createElement("div");
  box.className = "abschluss-reihe";

  // Verworfene Karten: nur zurueckholen oder loeschen.
  if (k.column === "verworfen") {
    const zurueck = knopf("Zurueck zu Idee holen", { art: "haupt", zeichen: "zurueck", klick: async () => await schiebe(k, "idee") });
    zurueck.classList.add("knopf-breit");
    box.appendChild(zurueck);
    box.appendChild(mehrMenu([loeschenEintrag(k)]));
    return box;
  }

  const ziel = naechstePhase(k.column);
  let grund = null;
  if (ziel) {
    const blockiert = sperren(toreListe);
    const weiter = knopf(`Weiter zu ${phase(ziel).name}`, {
      art: "haupt",
      zeichen: "weiter",
      klick: async () => {
        if (blockiert.length) {
          await melde("befund", `Die Karte kann noch nicht weiter: ${blockiert.map((b) => b.satz).join(" ")}`);
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
    // v104 (Owner 01.10.2026: „kann nicht auf Weiter klicken, warum weiß ich nicht"): Der Grund
    // stand nur im Tooltip. Jetzt sichtbar unter dem Knopf.
    if (blockiert.length) {
      grund = document.createElement("p");
      grund.className = "feld-hinweis abschluss-grund";
      grund.textContent = "Noch zu tun, bevor es weitergeht: " + blockiert.map((b) => b.satz).join(" ");
    }
  }

  box.appendChild(
    mehrMenu([
      {
        text: "Diese Idee verwerfen",
        titel: "Parkt die Karte in „Verworfen“ — sie taucht in der Ideensuche nicht mehr auf.",
        klick: async () => await schiebe(k, "verworfen"),
      },
      loeschenEintrag(k),
    ])
  );
  if (!grund) return box;
  const wrap = document.createElement("div");
  wrap.appendChild(box);
  wrap.appendChild(grund);
  return wrap;
}

// Menue-Eintrag statt eigenem Knopf (v80) — derselbe Bestaetigen-Dialog wie bisher.
function loeschenEintrag(k) {
  return {
    text: "Diese Karte loeschen",
    gefahr: true,
    klick: () => {
      bestaetigen(
        `"${k.title}" loeschen? Der Drive-Ordner wandert in den Papierkorb (wiederherstellbar).`,
        "Ja, loeschen",
        async () => {
          try {
            const r = await loescheKarte(k.id);
            meldung(r && r.getrasht ? "Karte geloescht — der Drive-Ordner liegt im Papierkorb." : "Karte geloescht.", "erfolg");
          } catch (e) {
            meldung(`Loeschen fehlgeschlagen, die Karte bleibt: ${e.message}`, "fehler");
          }
        }
      );
    },
  };
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
      wrap.remove();
      beiWahl(o.i);
    });
    box.appendChild(label);
  }
  wrap.appendChild(box);
  return wrap;
}

function schalterFeld(k, box, merke, paare) {
  return pillenSchalter(
    paare.map(([pfad, text]) => ({
      text,
      an: !!leseTief(k, pfad),
      beiAenderung: (checked) => merke(pfad, checked, true),
    }))
  );
}

async function rufeKi(task, k, knopfEl, box) {
  const alle = box.querySelectorAll(".knopf");
  alle.forEach((b) => (b.disabled = true));
  // v51: Das Terminal schwebt neben dem Ausloeser statt in der Box zu liegen — die Box wird
  // bei jeder Aenderung neu gezeichnet und riss das Panel bisher mitten im Lauf weg.
  // Ohne Knopf (Auswahl-Klick, A3/A5 des Audits) ist die Box selbst der Anker.
  const panel = terminalAn(knopfEl || box, `${KI_NAMEN[task] || task} — die KI schreibt …`);
  const knopfZustand = knopfLaeuft(knopfEl, "startet …");
  try {
    const antwort = await kiStream(task, kiNutzlast(k), (e) => {
      if (e.delta) panel.delta(e.delta);
      if (e.status) panel.status(e.status);
      if (e.stufe) {
        panel.stufe(e.stufe);
        // Derselbe Zustand noch einmal am Knopf, kurz: „laedt 12 s" / „schreibt".
        if (e.stufe.stufe === "modell-laedt") knopfZustand.text(`Modell laedt … ${e.stufe.sekunden || 0} s`);
        else if (e.stufe.stufe === "generiert") knopfZustand.text("schreibt …");
        else if (e.stufe.stufe === "web-suche") knopfZustand.text("sucht im Web …");
      }
    });
    // v41: Der Kontextabgleich steckt jetzt IN der Recherche-Pipeline (Schritt 3) — keine separate
    // Zweitrunde mehr; wir speichern einfach das Ergebnis des letzten Schritts.
    if (task === "recherche") setzeTief(k, "recherche", antwort.data || { raw: antwort.text || "" });
    else if (task === "hooks_verbal") setzeTief(k, "hooksVerbal", antwort.data || { raw: antwort.text || "" });
    else if (task === "hooks_visuell") setzeTief(k, "hooksVisuell", antwort.data || { raw: antwort.text || "" });
    else if (task === "caption") setzeTief(k, "captionVorschlag", antwort.data || { raw: antwort.text || "" });
    else if (FORMAT_TASKS.has(task)) {
      // v79 C2: strukturiertes Format-Ergebnis (JSON) fuer den format-eigenen Editor.
      setzeTief(k, "formate." + task, antwort.data || { raw: antwort.text || "" });
    } else {
      k.ai = k.ai || {};
      k.ai[task] = antwort.text || "";
      if (task === "skript" && !k.skriptFinal) k.skriptFinal = antwort.text || "";
    }
    await speichere();
    meldung("KI-Ergebnis gespeichert.", "erfolg");
    // Das Terminal blendet sich selbst aus (die „Fertig."-Zeile bleibt kurz lesbar) und
    // ueberlebt das Neuzeichnen, weil es nicht in der Box haengt.
    panel.fertig();
    knopfZustand.zurueck();
    zeichne();
  } catch (e) {
    const satz = (e.daten && e.daten.hint) || e.message;
    panel.fehler(satz);
    panel.fertig({ verzoegerung: 4000 });
    knopfZustand.zurueck();
    alle.forEach((b) => (b.disabled = false));
    // Der Hinweis-Toast bleibt stehen, bis er weggeklickt wird (v52) — das Terminal darf gehen.
    await melde("befund", satz);
  }
}

// Nutzlast fuer den KI-Aufruf. Der gewaehlte Fokus wandert mit, damit Hooks und Skript
// darauf aufbauen — die Stufen bauen aufeinander auf.
function kiNutzlast(k) {
  const n = {
    title: k.title,
    notes: k.notes,
    serie: k.serie,
    episode: k.episode,
    contenttyp: k.contenttyp,
    kategorie: k.kategorie,
    goal: k.goal,
    platforms: k.platforms,
    frame: k.frame,
    hook: k.hook,
    seriesSiblings: S.cards
      .filter((c) => c.id !== k.id && c.serie && c.serie === k.serie)
      .map((c) => c.title || "(ohne Titel)"),
  };
  if (k.recherche && Array.isArray(k.recherche.fokus) && k.chosenFokus != null) {
    const f = k.recherche.fokus[k.chosenFokus];
    if (f) n.fokus = `${f.titel}: ${f.text}`;
  }
  // v93: Ergebnisse frueherer Schritte weitergeben (lib/ai.js kontext() stellt sie in den Prompt).
  if (k.recherche && k.recherche.zusammenfassung) n.rechercheFakten = k.recherche.zusammenfassung;
  if (k.recherche && Array.isArray(k.recherche.keywords)) n.keywords = k.recherche.keywords;
  const skript = k.skriptFinal || (k.ai && k.ai.skript);
  if (skript) n.skript = skript;
  if (k.formate && Object.keys(k.formate).length) n.formatErgebnisse = k.formate;
  return n;
}

async function nachDrive(k, dateiname, inhalt, knopfEl, box) {
  const weg = fortschritt(box, "Speichere nach Drive …");
  if (knopfEl) knopfEl.disabled = true;
  try {
    const r = await driveSpeichern(k, dateiname, inhalt);
    // v113 (H6): ohne eigenen Ordner legt der Server ihn jetzt regulaer an (freier Name) — den Namen festhalten.
    if (r.name && k.driveName !== r.name) {
      k.driveName = r.name;
      await speichere();
    }
    setStand(`Gespeichert: ${r.pfad}`);
    meldung("Datei in Drive gespeichert.", "erfolg");
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
