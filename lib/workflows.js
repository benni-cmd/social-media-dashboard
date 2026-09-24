// Register aller Automationen des Boards (v26).
//
// Diese Datei ist reine Beschreibung und laeuft deshalb im Browser genauso wie im Server
// (ausgeliefert unter /lib/workflows.js). Sie legt fest, WAS es gibt; die eingeschaltete
// Fassung liegt in data/workflows.json und wird von lib/workflowstore.js gelesen.
//
// Regel dieses Registers: ein Eintrag hier existiert nur, wenn die genannte Fundstelle den
// Schalter auch wirklich abfragt. Ein Schalter ohne Wirkung waere eine Luege im UI.

export const WORKFLOWS = [
  {
    id: "upload-fertig-weiter",
    name: "Fertiges Video schiebt die Karte weiter",
    ausloeser: "Ein fertiges Video wird in den Ordner „Fertiges Video“ hochgeladen.",
    wirkung:
      "Die Karte rutscht automatisch in die naechste Phase — aber nur, wenn die Qualitaetstore " +
      "(Untertitel, kein Wasserzeichen, Laenge) frei sind. Sonst bleibt sie stehen, mit Ansage.",
    ort: "public/detail.js — videoUploadZone",
    standard: true,
    params: [
      {
        key: "toreBeachten",
        label: "Qualitaetstore beachten",
        typ: "schalter",
        standard: true,
        hinweis: "Aus: die Karte rutscht auch dann weiter, wenn ein Qualitaetstor gesperrt ist.",
      },
    ],
  },
  {
    id: "drehtermin-zuordnen-videodreh",
    name: "Drehtermin schiebt die Karte in den Videodreh",
    ausloeser: "Eine Karte wird einem Drehtermin zugeordnet.",
    wirkung: "Die Karte springt nach „Videodreh“ — der Termin steht, also ist das Skript fertig.",
    ort: "public/detail.js — Drehtermin zuordnen",
    standard: true,
    params: [],
  },
  {
    id: "skript-gespeichert-weiter",
    name: "Gespeichertes Skript schiebt die Karte weiter",
    ausloeser: "Das fertige Skript wird gespeichert.",
    wirkung:
      "Die Karte geht weiter zu „Drehtermin festlegen“. Fehlt das Upload-Datum, fragt das Board " +
      "es vorher ab.",
    ort: "public/detail.js — Skript speichern",
    standard: true,
    params: [],
  },
  {
    id: "auto-drehtermin",
    name: "Automatischer Drehtermin",
    ausloeser: "Im Vorlauf-Fenster steht kein einziger Drehtermin.",
    wirkung: "Das Board setzt selbst den Sonntag der Folgewoche als Termin (als „automatisch“ markiert).",
    ort: "public/store.js — pruefeAutoDreh",
    standard: true,
    params: [
      {
        key: "vorlaufTage",
        label: "Vorlauf-Fenster",
        typ: "zahl",
        standard: 30,
        min: 7,
        max: 120,
        einheit: "Tage",
        hinweis: "So weit schaut das Board nach vorn, bevor es selbst einen Termin setzt.",
      },
    ],
  },
  {
    id: "gcal-autosync",
    name: "Drehtermine in Google Kalender und Tasks spiegeln",
    ausloeser: "Ein Drehtermin wird angelegt, geaendert oder geloescht.",
    wirkung:
      "Kalender-Eintrag und Task werden sofort mitgezogen. Das Board bleibt die eine Wahrheit; " +
      "ein Fehler bei Google blockiert die lokale Aenderung nie.",
    ort: "public/store.js — autoSync",
    standard: true,
    params: [],
  },
  {
    id: "rueckwaertsplan",
    name: "Termine rueckwaerts aus dem Upload-Datum",
    ausloeser: "Ein Upload-Datum wird gesetzt.",
    wirkung: "Schnitt- und Freigabetermin werden daraus automatisch zurueckgerechnet.",
    ort: "lib/pipeline.js — rueckwaertsplan/drehFenster (via store.js setDeadlineKette); UI: public/redaktionsplan.js — Deadlines",
    standard: true,
    params: [
      {
        key: "gapFreigabe",
        label: "Freigabe → Upload",
        typ: "zahl",
        standard: 3,
        min: 0,
        max: 60,
        einheit: "Tage",
        hinweis: "Tage von der Caption-Freigabe bis zur Veroeffentlichung.",
      },
      {
        key: "gapSchnitt",
        label: "Schnitt → Freigabe",
        typ: "zahl",
        standard: 3,
        min: 0,
        max: 60,
        einheit: "Tage",
        hinweis: "Tage vom fertigen Schnitt bis zur Caption-Freigabe.",
      },
      {
        key: "gapDreh",
        label: "Dreh → Schnitt",
        typ: "zahl",
        standard: 14,
        min: 0,
        max: 60,
        einheit: "Tage",
        hinweis: "Fenster: so viele Tage vor dem Schnitt darf fruehestens gedreht werden.",
      },
    ],
  },
  {
    id: "drive-ordner-anlegen",
    name: "Projektordner in Drive anlegen",
    ausloeser: "Der visuelle Hook ist gewaehlt und die Karte hat noch keinen Drive-Ordner.",
    wirkung: "Der Projektordner wird im Drive angelegt, damit Skript und Material einen Platz haben.",
    ort: "public/detail.js — Wahl des visuellen Hooks",
    standard: true,
    params: [],
  },
  {
    id: "drive-ordner-mitziehen",
    name: "Drive-Ordner folgt der Karte",
    ausloeser: "Eine Karte wechselt die Spalte.",
    wirkung: "Der Projektordner wird im Drive in den Ordner der neuen Phase verschoben.",
    warnung:
      "Ausgeschaltet laufen Board und Drive auseinander: die Karte steht in der neuen Phase, " +
      "der Ordner bleibt in der alten.",
    ort: "public/board.js — schiebe",
    standard: true,
    params: [],
  },
  {
    id: "auto-shutdown",
    name: "Server beendet sich bei Leerlauf",
    ausloeser: "Der Server bekommt eine Weile lang keine Anfrage mehr.",
    wirkung: "Er entlaedt die Ollama-Modelle aus dem Speicher und beendet sich.",
    ort: "server.js — Auto-Shutdown",
    standard: true,
    params: [
      {
        key: "leerlaufMinuten",
        label: "Leerlauf bis zum Beenden",
        typ: "zahl",
        standard: 60,
        min: 5,
        max: 1440,
        einheit: "Minuten",
        hinweis: "Wird beim naechsten Start des Servers wirksam.",
      },
    ],
  },
  {
    id: "ampel-schwellen",
    name: "Ampel-Schwellen (Zeit-Farbe der Karten)",
    ausloeser: "Der Zeit-Punkt einer Karte wird eingefaerbt.",
    wirkung: "Bis zu welcher Naehe zur dringlichsten Frist der Punkt rot bzw. gelb wird.",
    ort: "lib/pipeline.js — ampelStatus (via store.js setAmpelSchwellen); UI: Tab „Board Regeln“",
    standard: true,
    params: [
      {
        key: "rotTage",
        label: "Rot ab",
        typ: "zahl",
        standard: 2,
        min: 0,
        max: 60,
        einheit: "Tage",
        hinweis: "Ueberfaellig oder so viele Tage vor der Frist: der Punkt wird rot.",
      },
      {
        key: "gelbTage",
        label: "Gelb ab",
        typ: "zahl",
        standard: 5,
        min: 0,
        max: 60,
        einheit: "Tage",
        hinweis: "Bis so viele Tage vor der Frist gelb, danach gruen. Nicht kleiner als „Rot ab“.",
      },
    ],
  },
];

export function workflow(id) {
  return WORKFLOWS.find((w) => w.id === id) || null;
}

// Laeuft der Workflow? Ohne gespeicherte Angabe gilt der Standard des Registers.
export function istAn(config, id) {
  const w = workflow(id);
  if (!w) return false;
  const e = config && config[id];
  if (!e || typeof e.an !== "boolean") return w.standard;
  return e.an;
}

// Ein Parameter des Workflows. Ohne gespeicherten Wert gilt der Standard des Registers.
export function param(config, id, key) {
  const w = workflow(id);
  if (!w) return undefined;
  const def = (w.params || []).find((p) => p.key === key);
  if (!def) return undefined;
  const wert = config && config[id] && config[id].params ? config[id].params[key] : undefined;
  if (wert === undefined || wert === null || wert === "") return def.standard;
  if (def.typ === "zahl") {
    const z = Number(wert);
    if (!Number.isFinite(z)) return def.standard;
    return Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, z));
  }
  if (def.typ === "schalter") return !!wert;
  return wert;
}
