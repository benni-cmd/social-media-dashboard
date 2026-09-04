// Baustein-Katalog des Workflow-Builders (v27).
//
// Diese Datei ist reine Beschreibung und laeuft deshalb im Browser genauso wie im Server
// (ausgeliefert unter /lib/workflowblocks.js). Sie legt fest, AUS WAS ein Workflow gebaut wird:
// ein Ausloeser, beliebig viele Bedingungen, beliebig viele Aktionen.
//
// Regel dieses Katalogs (dieselbe wie im Register lib/workflows.js): ein Baustein steht hier nur,
// wenn ihn entweder die Engine wirklich ausfuehrt (`ausfuehrbar: true`) oder ein eingebauter
// Workflow ihn beschreibt (`nurEingebaut: true`). Ein Baustein, der beides nicht ist, waere eine
// Luege im UI.
//
// `ausfuehrbar: true`  -> public/workflowengine.js fuehrt ihn aus; der Builder bietet ihn an.
// `nurEingebaut: true` -> steht fest im Code (Fundstelle im Register), hier nur beschrieben;
//                         der Builder bietet ihn NICHT an.

import { PHASEN, PLATTFORMEN } from "./pipeline.js";

// --- Felder einer Karte, die Bedingungen lesen und Aktionen setzen duerfen ---------------
//
// Bewusst eine kuratierte Liste statt „jeder Pfad": was hier nicht steht, laesst sich nicht
// versehentlich ueberschreiben (id, schema, metrics, published bleiben tabu).

export const KARTEN_FELDER = [
  { key: "title", name: "Titel", typ: "text" },
  { key: "notes", name: "Notizen", typ: "text" },
  { key: "serie", name: "Serie", typ: "text" },
  { key: "episode", name: "Episode", typ: "text" },
  { key: "contenttyp", name: "Contenttyp", typ: "text" },
  { key: "kategorie", name: "Kategorie", typ: "text" },
  { key: "goal", name: "Ziel", typ: "text" },
  { key: "owner", name: "Verantwortlich", typ: "text" },
  { key: "column", name: "Spalte", typ: "text", nurLesen: true },
  { key: "hook.text", name: "Verbaler Hook", typ: "text" },
  { key: "hook.visual", name: "Visueller Hook", typ: "text" },
  { key: "cta.text", name: "Call to Action", typ: "text" },
  { key: "frame.problem", name: "Frame — Problem", typ: "text" },
  { key: "frame.solution", name: "Frame — Loesung", typ: "text" },
  { key: "video.seconds", name: "Videolaenge (Sekunden)", typ: "zahl" },
  { key: "video.hasCaptions", name: "Untertitel vorhanden", typ: "schalter" },
  { key: "video.watermarkFree", name: "Ohne Wasserzeichen", typ: "schalter" },
  { key: "dates.upload", name: "Upload-Datum", typ: "datum" },
  { key: "dates.dreh", name: "Drehtermin", typ: "datum" },
  { key: "dates.schnitt", name: "Schnitt-Termin", typ: "datum" },
  { key: "dates.freigabe", name: "Freigabe-Termin", typ: "datum" },
  { key: "uploadTime", name: "Upload-Uhrzeit", typ: "text" },
  { key: "driveName", name: "Drive-Ordner", typ: "text", nurLesen: true },
];

export const feldDef = (key) => KARTEN_FELDER.find((f) => f.key === key) || null;

// Nur diese Felder darf die Aktion „Feld setzen" schreiben.
export const SETZBARE_FELDER = KARTEN_FELDER.filter((f) => !f.nurLesen);

export const VERGLEICHE = [
  { key: "ist", name: "ist genau" },
  { key: "ist-nicht", name: "ist nicht" },
  { key: "enthaelt", name: "enthaelt" },
  { key: "gefuellt", name: "ist gefuellt", ohneWert: true },
  { key: "leer", name: "ist leer", ohneWert: true },
  { key: "groesser", name: "ist groesser als" },
  { key: "kleiner", name: "ist kleiner als" },
];

const spaltenWahl = () => PHASEN.map((p) => ({ wert: p.id, name: p.name }));
const plattformWahl = () => PLATTFORMEN.map((p) => ({ wert: p.id, name: p.name }));

// --- Ausloeser ---------------------------------------------------------------------------
//
// Die fuenf ausfuehrbaren sind echte Ereignisse des Boards: sie werden an ihrer Fundstelle
// gefeuert (siehe `ort`). Die uebrigen beschreiben nur, woran ein eingebauter Workflow haengt.

export const AUSLOESER = [
  {
    typ: "karte-angelegt",
    name: "Eine Karte wird angelegt",
    satz: "Sobald eine neue Karte im Board entsteht.",
    ausfuehrbar: true,
    ort: "public/store.js — neueKarte",
    felder: [],
  },
  {
    typ: "karte-spalte-gewechselt",
    name: "Eine Karte wechselt die Spalte",
    satz: "Sobald eine Karte in eine andere Phase rutscht — von Hand oder automatisch.",
    ausfuehrbar: true,
    ort: "public/board.js — schiebe",
    felder: [],
  },

  // Diese drei feuern seit dem 04.09.2026 aus public/detail.js. Sie standen vorher nur als
  // Beschreibung hier, weil eine parallele Sitzung an detail.js arbeitete; seit die Datei frei
  // ist, haengen sie an ihren Fundstellen und stehen dem Builder offen.
  {
    typ: "skript-gespeichert",
    name: "Ein Skript wird gespeichert",
    satz: "Sobald das fertige Skript nach Drive geschrieben ist.",
    ausfuehrbar: true,
    ort: "public/detail.js — Skript speichern",
    felder: [],
  },
  {
    typ: "video-hochgeladen",
    name: "Ein fertiges Video wird hochgeladen",
    satz: "Sobald eine Datei in „Fertiges Video/“ angekommen ist.",
    ausfuehrbar: true,
    ort: "public/detail.js — videoUploadZone",
    felder: [],
  },
  {
    typ: "drehtermin-zugeordnet",
    name: "Eine Karte wird einem Drehtermin zugeordnet",
    satz: "Sobald die Karte an einem Drehtermin haengt.",
    ausfuehrbar: true,
    ort: "public/detail.js — Drehtermin zuordnen",
    felder: [],
  },

  // Ab hier nur eingebaut — beschreiben, was fest im Code haengt. Solange nichts sie feuert,
  // duerfen sie im Builder nicht angeboten werden: ein Ausloeser, der nie ausloest, waere
  // eine Luege im UI.
  {
    typ: "upload-datum-gesetzt",
    name: "Ein Upload-Datum wird gesetzt",
    satz: "Wird an mehreren Stellen gesetzt (Detail, Redaktionsplan, Nachschub).",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "kein-drehtermin-im-fenster",
    name: "Im Vorlauf-Fenster steht kein Drehtermin",
    satz: "Wird beim Laden des Boards geprueft.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "drehtermin-geaendert",
    name: "Ein Drehtermin wird angelegt, geaendert oder geloescht",
    satz: "Jede Aenderung an der Terminliste.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "hook-visuell-gewaehlt",
    name: "Der visuelle Hook wird gewaehlt",
    satz: "Der Moment, in dem das Projekt seinen Platz in Drive braucht.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "server-leerlauf",
    name: "Der Server bekommt eine Weile keine Anfrage",
    satz: "Laeuft im Server, nicht im Browser.",
    nurEingebaut: true,
    felder: [],
  },
];

// --- Bedingungen -------------------------------------------------------------------------

export const BEDINGUNGEN = [
  {
    typ: "karte-in-spalte",
    name: "Die Karte steht in einer bestimmten Spalte",
    satz: "Prueft die aktuelle Phase der Karte.",
    ausfuehrbar: true,
    felder: [{ key: "spalte", label: "Spalte", typ: "wahl", wahl: spaltenWahl, standard: "idee" }],
  },
  {
    typ: "spaltenwechsel",
    name: "Der Wechsel geht von/nach einer Spalte",
    satz: "Nur beim Ausloeser „Eine Karte wechselt die Spalte“ sinnvoll. Leer heisst „egal“.",
    ausfuehrbar: true,
    felder: [
      { key: "von", label: "Von", typ: "wahl", wahl: spaltenWahl, standard: "", leerText: "egal" },
      { key: "nach", label: "Nach", typ: "wahl", wahl: spaltenWahl, standard: "", leerText: "egal" },
    ],
  },
  {
    typ: "feld-vergleich",
    name: "Ein Feld der Karte hat einen bestimmten Wert",
    satz: "Vergleicht ein Feld der Karte mit einem Wert.",
    ausfuehrbar: true,
    felder: [
      {
        key: "feld",
        label: "Feld",
        typ: "wahl",
        wahl: () => KARTEN_FELDER.map((f) => ({ wert: f.key, name: f.name })),
        standard: "kategorie",
      },
      {
        key: "vergleich",
        label: "Vergleich",
        typ: "wahl",
        wahl: () => VERGLEICHE.map((v) => ({ wert: v.key, name: v.name })),
        standard: "ist",
      },
      { key: "wert", label: "Wert", typ: "text", standard: "" },
    ],
  },
  {
    typ: "plattform-gewaehlt",
    name: "Die Karte laeuft auf einer bestimmten Plattform",
    satz: "Prueft die Plattform-Auswahl der Karte.",
    ausfuehrbar: true,
    felder: [
      { key: "plattform", label: "Plattform", typ: "wahl", wahl: plattformWahl, standard: "instagram" },
    ],
  },

  // Nur eingebaut.
  {
    typ: "qualitaetstore-frei",
    name: "Die Qualitaetstore sind frei",
    satz: "Untertitel, kein Wasserzeichen, Laenge im Korridor — geprueft gegen den Drive-Stand.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "karte-vor-videodreh",
    name: "Die Karte steht noch vor dem Videodreh",
    satz: "Verhindert, dass eine schon weitere Karte zurueckspringt.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "kein-drive-ordner",
    name: "Die Karte hat noch keinen Drive-Ordner",
    satz: "Verhindert das doppelte Anlegen.",
    nurEingebaut: true,
    felder: [],
  },
];

// --- Aktionen ----------------------------------------------------------------------------

export const AKTIONEN = [
  {
    typ: "karte-verschieben",
    name: "Karte in eine Spalte schieben",
    satz: "Verschiebt die Karte (und zieht — falls eingeschaltet — den Drive-Ordner mit).",
    ausfuehrbar: true,
    felder: [{ key: "ziel", label: "Zielspalte", typ: "wahl", wahl: spaltenWahl, standard: "skript" }],
  },
  {
    typ: "feld-setzen",
    name: "Ein Feld der Karte setzen",
    satz: "Schreibt einen festen Wert in ein Feld der Karte und speichert.",
    ausfuehrbar: true,
    felder: [
      {
        key: "feld",
        label: "Feld",
        typ: "wahl",
        wahl: () => SETZBARE_FELDER.map((f) => ({ wert: f.key, name: f.name })),
        standard: "owner",
      },
      { key: "wert", label: "Wert", typ: "text", standard: "" },
    ],
  },
  {
    typ: "meldung-zeigen",
    name: "Eine Meldung zeigen",
    satz: "Blendet oben rechts einen Hinweis ein.",
    ausfuehrbar: true,
    felder: [
      { key: "text", label: "Text", typ: "text", standard: "" },
      {
        key: "art",
        label: "Art",
        typ: "wahl",
        wahl: () => [
          { wert: "erfolg", name: "Erfolg (gruen)" },
          { wert: "fehler", name: "Achtung (rot)" },
        ],
        standard: "erfolg",
      },
    ],
  },
  {
    typ: "drive-ordner-anlegen",
    name: "Projektordner in Drive anlegen",
    satz: "Legt den Projektordner an, falls die Karte noch keinen hat.",
    ausfuehrbar: true,
    felder: [],
  },

  // Nur eingebaut.
  {
    typ: "karte-naechste-phase",
    name: "Karte in die naechste Phase schieben",
    satz: "Die naechste Phase kommt aus der Phasen-Kette.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "termine-rueckwaerts-rechnen",
    name: "Schnitt- und Freigabetermin rueckwaerts rechnen",
    satz: "Aus dem Upload-Datum, mit den Vorlauf-Zeiten der Pipeline.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "gcal-spiegeln",
    name: "Google Kalender und Tasks mitziehen",
    satz: "Das Board bleibt die Wahrheit; ein Google-Fehler blockiert nie.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "drive-ordner-mitziehen",
    name: "Drive-Ordner in den Ordner der neuen Phase verschieben",
    satz: "Haelt Board und Drive zusammen.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "drehtermin-automatisch-setzen",
    name: "Sonntag der Folgewoche als Drehtermin setzen",
    satz: "Wird als „automatisch“ markiert.",
    nurEingebaut: true,
    felder: [],
  },
  {
    typ: "server-beenden",
    name: "Ollama entladen und den Server beenden",
    satz: "Laeuft im Server, nicht im Browser.",
    nurEingebaut: true,
    felder: [],
  },
];

export const ausloeserDef = (typ) => AUSLOESER.find((a) => a.typ === typ) || null;
export const bedingungDef = (typ) => BEDINGUNGEN.find((b) => b.typ === typ) || null;
export const aktionDef = (typ) => AKTIONEN.find((a) => a.typ === typ) || null;

export const bausteinDef = (art, typ) =>
  art === "ausloeser" ? ausloeserDef(typ) : art === "bedingung" ? bedingungDef(typ) : aktionDef(typ);

// Was der Builder anbieten darf: nur, was die Engine auch ausfuehrt.
export const baubar = (liste) => liste.filter((b) => b.ausfuehrbar);

// --- Bauplaene der eingebauten Neun -------------------------------------------------------
//
// Uebersetzung, KEIN Ersatz: das Verhalten steht weiterhin an den Fundstellen im Code, hier steht
// nur, wie dieses Verhalten in der gemeinsamen Bausteinform aussieht. Deshalb aendert diese Tabelle
// nichts an `istAn()` / `param()` — der Schalter und die Parameter der Neun bleiben unberuehrt.

export const EINGEBAUTE_BAUPLAENE = {
  "upload-fertig-weiter": {
    ausloeser: { typ: "video-hochgeladen" },
    bedingungen: [{ typ: "qualitaetstore-frei" }],
    aktionen: [{ typ: "karte-naechste-phase" }],
  },
  "drehtermin-zuordnen-videodreh": {
    ausloeser: { typ: "drehtermin-zugeordnet" },
    bedingungen: [{ typ: "karte-vor-videodreh" }],
    aktionen: [{ typ: "karte-verschieben", ziel: "videodreh" }],
  },
  "skript-gespeichert-weiter": {
    ausloeser: { typ: "skript-gespeichert" },
    bedingungen: [],
    aktionen: [{ typ: "karte-verschieben", ziel: "skript" }],
  },
  "auto-drehtermin": {
    ausloeser: { typ: "kein-drehtermin-im-fenster" },
    bedingungen: [],
    aktionen: [{ typ: "drehtermin-automatisch-setzen" }],
  },
  "gcal-autosync": {
    ausloeser: { typ: "drehtermin-geaendert" },
    bedingungen: [],
    aktionen: [{ typ: "gcal-spiegeln" }],
  },
  rueckwaertsplan: {
    ausloeser: { typ: "upload-datum-gesetzt" },
    bedingungen: [],
    aktionen: [{ typ: "termine-rueckwaerts-rechnen" }],
  },
  "drive-ordner-anlegen": {
    ausloeser: { typ: "hook-visuell-gewaehlt" },
    bedingungen: [{ typ: "kein-drive-ordner" }],
    aktionen: [{ typ: "drive-ordner-anlegen" }],
  },
  "drive-ordner-mitziehen": {
    ausloeser: { typ: "karte-spalte-gewechselt" },
    bedingungen: [],
    aktionen: [{ typ: "drive-ordner-mitziehen" }],
  },
  "auto-shutdown": {
    ausloeser: { typ: "server-leerlauf" },
    bedingungen: [],
    aktionen: [{ typ: "server-beenden" }],
  },
};

// --- Gemeinsame Form ----------------------------------------------------------------------
//
// Beide Sorten — die eingebauten Neun und die selbstgebauten — kommen als DIESE eine Form beim
// Builder an. `eingebaut: true` heisst: Bausteine nur lesen, Schalter und Parameter bedienbar.

export function alsBauplan(w) {
  const plan = EINGEBAUTE_BAUPLAENE[w.id] || { ausloeser: null, bedingungen: [], aktionen: [] };
  return {
    id: w.id,
    name: w.name,
    eingebaut: true,
    an: !!w.an,
    ausloeser: plan.ausloeser,
    bedingungen: plan.bedingungen || [],
    aktionen: plan.aktionen || [],
    beschreibung: { wenn: w.ausloeser, dann: w.wirkung },
    warnung: w.warnung || "",
    ort: w.ort || "",
    params: w.params || [],
  };
}

let zaehler = 0;
export function neueEigeneId() {
  zaehler += 1;
  return `eigen-${Date.now().toString(36)}-${zaehler.toString(36)}`;
}

// Bringt einen selbstgebauten Workflow in eine sichere Form: unbekannte Bausteine fliegen raus,
// unbekannte Felder ebenfalls. Was hier durchkommt, kann die Engine ohne weitere Pruefung fahren.
export function normalisiere(roh) {
  const w = roh && typeof roh === "object" ? roh : {};
  const felderVon = (def, quelle) => {
    const out = { typ: def.typ };
    for (const f of def.felder || []) {
      const wert = quelle && quelle[f.key];
      out[f.key] = wert === undefined || wert === null ? f.standard ?? "" : String(wert);
    }
    return out;
  };

  const aDef = ausloeserDef(w.ausloeser && w.ausloeser.typ);
  const bedingungen = [];
  for (const b of Array.isArray(w.bedingungen) ? w.bedingungen : []) {
    const def = bedingungDef(b && b.typ);
    if (def && def.ausfuehrbar) bedingungen.push(felderVon(def, b));
  }
  const aktionen = [];
  for (const a of Array.isArray(w.aktionen) ? w.aktionen : []) {
    const def = aktionDef(a && a.typ);
    if (def && def.ausfuehrbar) aktionen.push(felderVon(def, a));
  }

  return {
    id: typeof w.id === "string" && w.id ? w.id : neueEigeneId(),
    name: String(w.name || "").trim() || "Neuer Workflow",
    eingebaut: false,
    an: w.an === undefined ? true : !!w.an,
    ausloeser: aDef && aDef.ausfuehrbar ? felderVon(aDef, w.ausloeser) : null,
    bedingungen,
    aktionen,
  };
}

// Sagt, was einem Workflow zum Laufen fehlt. Leere Liste = er laeuft.
export function pruefe(w) {
  const fehlt = [];
  if (!w || !w.name || !String(w.name).trim()) fehlt.push("Der Workflow braucht einen Namen.");
  if (!w || !w.ausloeser || !ausloeserDef(w.ausloeser.typ))
    fehlt.push("Es fehlt der Ausloeser — ohne ihn passiert nie etwas.");
  if (!w || !Array.isArray(w.aktionen) || w.aktionen.length === 0)
    fehlt.push("Es fehlt mindestens eine Aktion — sonst tut der Workflow nichts.");
  for (const a of (w && w.aktionen) || []) {
    if (a.typ === "meldung-zeigen" && !String(a.text || "").trim())
      fehlt.push("Die Meldung braucht einen Text.");
    if (a.typ === "feld-setzen" && !a.feld) fehlt.push("Bei „Feld setzen“ fehlt das Feld.");
  }
  return fehlt;
}

// Ein Satz je Baustein — fuer die Kachel im Builder und die Wenn/Dann-Zeile.
export function beschreibe(art, baustein) {
  const def = bausteinDef(art, baustein && baustein.typ);
  if (!def) return "Unbekannter Baustein";
  const teile = [];
  for (const f of def.felder || []) {
    const wert = baustein[f.key];
    if (wert === undefined || wert === null || wert === "") continue;
    let anzeige = String(wert);
    if (f.typ === "wahl") {
      const opt = (typeof f.wahl === "function" ? f.wahl() : f.wahl || []).find((o) => o.wert === wert);
      if (opt) anzeige = opt.name;
    }
    teile.push(`${f.label}: ${anzeige}`);
  }
  return teile.length ? `${def.name} — ${teile.join(", ")}` : def.name;
}
