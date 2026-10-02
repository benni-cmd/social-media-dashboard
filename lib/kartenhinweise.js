// Welche Hinweise und Warnungen eine Karte zeigt (v68) — einstellbar unter
// Einstellungen > "Hinweise & Warnungen".
//
// Rein und ohne Node-Importe: dieselbe Datei laeuft im Browser (Karte + Einstellungen).
//
// Einteilung nach Schwere (Owner-Antwort 25.09.2026):
//   Warnung = roter Befund der Pruefungen (tore() in pipeline.js, Status "befund") plus
//             "Drehtermin ausserhalb des Fensters".
//   Hinweis = alles Uebrige, was nicht "ok" ist (Status "fehlt" oder "hinweis").
// Pflichtangaben, die eine Spalte sperren (tor.sperrt), erscheinen als Hinweis erst, wenn die
// Frist der Karte gelb oder rot ist — sonst haette jede frische Karte dauerhaft einen Hinweis.

export const KATALOG = [
  // --- Warnungen ---
  { key: "dreh-ausserhalb", art: "warnung", spalte: "Alle", label: "Drehtermin liegt außerhalb des empfohlenen Fensters" },
  { key: "skript-datei", art: "warnung", spalte: "Idee, Skript, Videodreh", label: "Kein Skript-Dokument im Drive-Ordner" },
  { key: "skript-zu-lang", art: "warnung", spalte: "Skript", label: "Sprechertext ist länger als die Hausregel" },
  { key: "lead-zu-lang", art: "warnung", spalte: "Caption", label: "Caption-Vorspann ist zu lang" },
  { key: "hashtags-limit", art: "warnung", spalte: "Caption", label: "Mehr Hashtags als die Plattform erlaubt" },
  { key: "likebitte", art: "warnung", spalte: "Caption", label: "Text bittet um Likes" },
  { key: "cta-mehrfach", art: "warnung", spalte: "Caption", label: "Mehrere Aufrufe zum Handeln im Text" },

  // --- Hinweise: Pflichtangaben (erst bei naher Frist, siehe oben) ---
  { key: "thema", art: "hinweis", spalte: "Idee", label: "Thema fehlt", pflicht: true },
  { key: "saeule", art: "hinweis", spalte: "Idee, Skript", label: "Kategorie fehlt", pflicht: true },
  { key: "ziel", art: "hinweis", spalte: "Idee", label: "Ziel fehlt", pflicht: true },
  { key: "fokus", art: "hinweis", spalte: "Idee", label: "Fokus und Hook nicht gewählt", pflicht: true },
  { key: "skript", art: "hinweis", spalte: "Skript", label: "Sprechertext fehlt", pflicht: true },
  { key: "hook", art: "hinweis", spalte: "Skript", label: "Gesprochener Einstieg fehlt", pflicht: true },
  { key: "hook-bild", art: "hinweis", spalte: "Skript", label: "Einstieg ist nicht als Bild beschrieben", pflicht: true },
  { key: "rohmaterial", art: "hinweis", spalte: "Videodreh", label: "Kein Rohmaterial im Drive-Ordner", pflicht: true },
  { key: "final", art: "hinweis", spalte: "Schnitt", label: "Kein fertiges Video im Drive-Ordner", pflicht: true },
  { key: "untertitel", art: "hinweis", spalte: "Schnitt", label: "Video hat keine Untertitel", pflicht: true },
  { key: "wasserzeichen", art: "hinweis", spalte: "Schnitt", label: "Wasserzeichen-Freiheit nicht bestätigt (Instagram)", pflicht: true },
  { key: "lead", art: "hinweis", spalte: "Caption", label: "Caption-Vorspann fehlt", pflicht: true },
  { key: "cta", art: "hinweis", spalte: "Caption", label: "Aufruf zum Handeln fehlt", pflicht: true },
  { key: "plattform", art: "hinweis", spalte: "Upload", label: "Keine Plattform ausgewählt", pflicht: true },

  // --- Hinweise: Empfehlungen (nicht sperrend) ---
  { key: "skript-kurz", art: "hinweis", spalte: "Skript", label: "Sprechertext ist sehr kurz" },
  { key: "korridor", art: "hinweis", spalte: "Skript", label: "Länge passt nicht zum Korridor der Plattform" },
  { key: "hook-lang", art: "hinweis", spalte: "Skript", label: "Einstieg hat zu viele Wörter" },
  { key: "frame", art: "hinweis", spalte: "Skript", label: "Problem und Handlung nicht beide benannt" },
  { key: "blick", art: "hinweis", spalte: "Videodreh", label: "Keine Einstellung mit Blick in die Kamera" },
  { key: "sprecher", art: "hinweis", spalte: "Videodreh", label: "Niemand spricht vor der Kamera" },
  { key: "keywords", art: "hinweis", spalte: "Caption", label: "Weniger als drei Suchbegriffe" },
  { key: "hashtags-instagram", art: "hinweis", spalte: "Caption", label: "Mehr Hashtags als für Instagram empfohlen" },
  { key: "hashtags-tiktok", art: "hinweis", spalte: "Caption", label: "Kein Hashtag für TikTok" },
  { key: "frage", art: "hinweis", spalte: "Caption", label: "Keine Frage im Text" },
  { key: "termin", art: "hinweis", spalte: "Upload", label: "Kein Veröffentlichungsdatum gesetzt" },
  { key: "verknuepft", art: "hinweis", spalte: "Upload", label: "Kein veröffentlichter Beitrag verknüpft" },
];

// Standard: alle Warnungen und die Pflichtangaben an, Empfehlungen aus.
export const standardAn = (eintrag) => eintrag.art === "warnung" || !!eintrag.pflicht;

let ueberschreibung = {}; // { [key]: boolean } — nur die vom Owner geaenderten Haken
let beiAenderung = () => {};
export const beiHinweisAenderung = (f) => (beiAenderung = f);

export function istAn(key) {
  if (Object.prototype.hasOwnProperty.call(ueberschreibung, key)) return !!ueberschreibung[key];
  const e = KATALOG.find((x) => x.key === key);
  return e ? standardAn(e) : false;
}

// Speicherort: der Drive-gestuetzte Defaults-Store (/api/defaults, Feld `kartenHinweise`).
export async function ladeKartenHinweise() {
  try {
    const res = await fetch("/api/defaults");
    if (!res.ok) return;
    const d = await res.json();
    if (d && d.kartenHinweise && typeof d.kartenHinweise === "object") ueberschreibung = { ...d.kartenHinweise };
  } catch {
    /* Beiwerk — ohne Antwort gelten die Standardwerte */
  }
}

// Setzt einen Haken: sofort wirksam (Karten neu zeichnen), dann speichern. Scheitert das
// Speichern, geht der Haken zurueck und der Fehler wird geworfen.
export async function setzeAn(key, an) {
  const vorher = Object.prototype.hasOwnProperty.call(ueberschreibung, key) ? ueberschreibung[key] : undefined;
  ueberschreibung = { ...ueberschreibung, [key]: !!an };
  beiAenderung();
  try {
    const res = await fetch("/api/defaults", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kartenHinweise: ueberschreibung }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    const zurueck = { ...ueberschreibung };
    if (vorher === undefined) delete zurueck[key];
    else zurueck[key] = vorher;
    ueberschreibung = zurueck;
    beiAenderung();
    throw e;
  }
}

// --- Zuordnung einer Pruefung zu einem Katalog-Eintrag ---------------------------

const BEFUND_KEY = { skript: "skript-zu-lang", lead: "lead-zu-lang", likebitte: "likebitte", cta: "cta-mehrfach" };

function schluesselVon(t) {
  if (t.status === "befund") return t.id.startsWith("hashtags-") ? "hashtags-limit" : BEFUND_KEY[t.id] || null;
  if (t.id.startsWith("korridor-")) return "korridor";
  if (t.id === "skript" && t.status === "hinweis") return "skript-kurz";
  if (t.id === "hook" && t.status === "hinweis") return "hook-lang";
  return t.id;
}

// Was die Karte zeigt. `pruefungen` = tore(card, driveStand) (bereits ohne Drive-Tore, wenn der
// Drive-Stand fehlt), `drehAusserhalb` = Bool, `fristDringend` = Zeit-Ampel gelb oder rot.
// Gibt { warnungen: [Satz], hinweise: [Satz] } zurueck.
export function kartenMeldungen(pruefungen, drehAusserhalb, fristDringend) {
  const warnungen = [];
  const hinweise = [];
  if (drehAusserhalb && istAn("dreh-ausserhalb")) warnungen.push("Drehtermin liegt außerhalb des empfohlenen Fensters.");
  for (const t of pruefungen) {
    if (t.status === "ok" || t.status === "entfaellt") continue;
    const key = schluesselVon(t);
    const eintrag = key && KATALOG.find((x) => x.key === key);
    if (!eintrag || !istAn(key)) continue;
    // v104 (Owner 01.10.2026): Was die Karte zum Verlassen IHRER Spalte noch braucht (t.sperrt),
    // ist die Arbeit dieser Spalte — kein rotes „!". Es erscheint wie die anderen Pflichtangaben
    // nur als Hinweis, sobald die Frist gelb/rot ist. Beispiel: „Skript-Dokument fehlt" in
    // „Skript schreiben".
    if (eintrag.art === "warnung" && !t.sperrt) warnungen.push(t.satz);
    else if (!(t.sperrt && !fristDringend)) hinweise.push(t.satz);
  }
  return { warnungen, hinweise };
}
