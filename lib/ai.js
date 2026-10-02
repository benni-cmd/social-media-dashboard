// KI-Aufgaben ueber die lokale Claude-Code-CLI (`claude -p`) — laeuft ueber Bens Abo,
// nicht ueber die kostenpflichtige API.
//
// Der Marken-Vorspann traegt jetzt zusaetzlich die belegten Regeln aus
// docs/best-practices.md. Damit muss die Nachbearbeitung weniger korrigieren, und die
// Qualitaetstore in pipeline.js schlagen seltener an.

import { spawn } from "node:child_process";
import * as ereignisse from "./ereignisse.js"; // v58: KI-Aufrufe mitlesbar
import { tmpdir } from "node:os";
import {
  MASSE,
  plattform,
  plattformName,
  saeuleName,
  zielInfo,
  korridor,
  INHALTSKATEGORIEN,
  contenttypName,
  kategorieName,
  parseJsonNachsichtig,
} from "./pipeline.js";
// --- Prompts als Vorlagen -------------------------------------------------
//
// Jeder Prompt ist eine Vorlage mit {{platzhalter}}: die festen Formulierungen kann Ben in den
// Einstellungen (Tab "System Prompts") bearbeiten, die beweglichen Teile — Karten-Kontext,
// Plattform-Schema, Sekunden-Korridor — setzt der Code ein. Ein unbekannter Platzhalter bleibt
// stehen, statt still zu verschwinden: ein Tippfehler soll sichtbar sein.

export function fuelleVorlage(vorlage, vars = {}) {
  return String(vorlage ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (treffer, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? "") : treffer
  );
}

// --- Fester Marken- und Regelrahmen: geht als Vorspann in JEDEN Aufruf ---------------

export const SYSTEM_VORLAGE =
  // v93 (Owner 01.10.2026): neutral — Marke, Zielgruppe und Themen kommen ausschliesslich aus dem
  // Firmen-/Projektkontext (Einstellungen → Unternehmenskontext), nicht aus diesem Standard.
  `Du bist Social-Media-Redakteur und Video-Producer fuer das Unternehmen, das unten unter ` +
  `"Unternehmens- und Markenkontext" beschrieben ist. Du schreibst fuer dessen Zielgruppe, in dessen ` +
  `Ton und zu dessen Themen. Was du ueber Marke, Zielgruppe und Projekte weisst, steht NUR dort — ` +
  `erfinde nichts dazu (keine Namen, Zahlen, Projekte, Hashtags), und fehlt dort etwas, bleib sachlich ` +
  `und allgemein.\n\n` +
  `SO ARBEITEST DU\n` +
  `- Jede Aufgabe ist ein Schritt einer Kette: Recherche → Fokus → gesprochener Hook → Bild-Hook → ` +
  `Skript → Caption (bzw. die Format-Schritte fuer Slider, Beitrag, Story, Langvideo). Was fruehere ` +
  `Schritte entschieden haben, steht im Karten-Kontext der Aufgabe (Fokus, Hook, Fakten, Skript): ` +
  `darauf aufbauen, nicht davon abweichen, nichts neu erfinden, was schon entschieden ist.\n` +
  `- Halte dich exakt an das verlangte Ausgabeformat. Wird JSON verlangt, kommt nur JSON.\n` +
  `- Antworte auf Deutsch, ausser ein Feld verlangt ausdruecklich Englisch (Bild-Prompts).\n\n` +
  `HAUSREGELN (Grenzwerte stellt das Board ein)\n` +
  `- Ein Videoskript ist hoechstens etwa {{sprechzeitMax}} Sekunden Sprechzeit lang.\n` +
  `- Der gesprochene Einstieg sitzt in {{hookSekunden}} Sekunden, also hoechstens etwa ` +
  `{{hookWoerterMax}} Woerter — an dieser Marke misst Instagram die Abbruchquote.\n` +
  `- Die ersten {{captionLeadMax}} Zeichen einer Caption sind der einzige sicher sichtbare Teil und ` +
  `zugleich der Google-Ausschnitt: dort stehen Kernaussage und Suchbegriff, keine Anmoderation.\n\n` +
  `BELEGTE PRAXIS (Quelle: docs/best-practices.md)\n` +
  `- Vier von fuenf schauen ohne Ton: zu jedem Hook gehoert, was in Sekunde 0 bis 1 zu SEHEN ist; ` +
  `das Bild muss den Einstieg allein tragen.\n` +
  `- Hooks sprechen die Lebensrealitaet der Zielgruppe an ("Was brauchst du fuer …?"), nicht das ` +
  `abstrakte Thema ("Wie funktioniert …?").\n` +
  `- Immer beides benennen: das konkrete Problem UND eine sichtbare, machbare Handlung.\n` +
  `- Genau EIN Handlungsaufruf je Stueck, indirekt formuliert ("Wenn du das auch kennst, schreib ` +
  `mir …") statt befehlend. Niemals um Likes bitten.\n` +
  `- Fachlich praezise, aber alltagssprachlich erklaert: konkrete Bilder statt Fachwoerter.\n` +
  `- Natuerlicher Sprechfluss, laut vorlesbar; keine KI-Floskeln, kein aufgesetzter Slang, keine ` +
  `kuenstliche Dramatik.\n` +
  `- Bei einer Reihe auf die frueheren Folgen aufbauen, nichts doppeln.` +
  // Der Kontext haengt am Ende — mit eigener Ueberschrift aus lib/kontextstore.js.
  `{{firmenkontext}}{{projektkontext}}`;

// Kontext-Platzhalter (v33): stehen in JEDER Vorlage zur Verfuegung — im Vorspann wie in jeder
// Aufgabe. Gefuellt werden sie aus den Einstellungen, Tab „Unternehmenskontext". Ist dort nichts
// hinterlegt, sind beide leer und der Prompt sieht aus wie vorher.
export const KONTEXT_PLATZHALTER = {
  firmenkontext: "Was in den Einstellungen unter Unternehmenskontext steht, samt der Dateien seiner Quellen",
  projektkontext: "Der Text und die Quellen der aktiven Projekte aus den Einstellungen",
};

export const SYSTEM_PLATZHALTER = {
  sprechzeitMax: "Sekunden-Obergrenze fuer die Sprechzeit (Hausregel)",
  hookSekunden: "Sekunden, in denen der Hook sitzen muss",
  hookWoerterMax: "Woerter-Obergrenze fuer den Hook",
  captionLeadMax: "Zeichen-Obergrenze fuer den sichtbaren Caption-Anfang",
  ...KONTEXT_PLATZHALTER,
};

function systemVariablen() {
  return {
    sprechzeitMax: MASSE.sprechzeitMax,
    hookSekunden: MASSE.hookSekunden,
    hookWoerterMax: MASSE.hookWoerterMax,
    captionLeadMax: MASSE.captionLeadMax,
  };
}

// Baut den Vorspann — mit Bens Fassung, wenn er eine gespeichert hat, sonst mit dem Standard.
// `kontext` sind die Kontext-Platzhalter aus den Einstellungen (v33): {firmenkontext,
// projektkontext}. Ohne sie bleiben die Platzhalter leer — nicht stehen, denn ein sichtbares
// {{firmenkontext}} im Prompt waere schlechter als gar keiner.
export function baueSystem(override, kontext = {}) {
  return fuelleVorlage(override || SYSTEM_VORLAGE, { ...systemVariablen(), ...leererKontext(), ...kontext });
}

// Beide Kontext-Platzhalter sind IMMER definiert, damit fuelleVorlage sie ersetzt statt sie
// als unbekannt stehen zu lassen.
function leererKontext() {
  return { firmenkontext: "", projektkontext: "" };
}

// Der gefuellte Standard-Vorspann (Name bleibt, damit bestehende Aufrufer weiterlaufen).
export const MARKE_REGELN = baueSystem();

// Karten-Kontext fuer den Prompt.
function kontext(card) {
  const geschwister =
    card.seriesSiblings && card.seriesSiblings.length ? card.seriesSiblings.join(" | ") : "keine";
  const ziel = zielInfo(card.goal);
  const plattformen = (card.platforms || []).map(plattformName).join(", ") || "Instagram";
  const zeilen = [
    `Thema: ${card.title || "(ohne Titel)"}`,
    `Notizen und bisheriger Stand: ${card.notes || "(keine)"}`,
    `Reihe: ${card.serie || "-"} (bisherige Videos dieser Reihe: ${geschwister})`,
    `Content-Kategorie: ${card.kategorie ? saeuleName(card.kategorie) : "(nicht gesetzt)"}`,
    `Ziel: ${ziel.name} — gemessen wird an "${ziel.kennzahl}". ${ziel.satz}`,
    `Plattformen: ${plattformen}`,
  ];
  if (card.frame && (card.frame.problem || card.frame.solution))
    zeilen.push(`Problem: ${card.frame.problem || "-"} / Handlung: ${card.frame.solution || "-"}`);
  // Der gewaehlte Fokus zieht sich durch: sobald er steht, bauen Hooks und Skript darauf auf.
  if (card.fokus) zeilen.push(`Gewaehlter Fokus (darauf aufbauen, nicht davon abweichen): ${card.fokus}`);
  if (card.hook && card.hook.text) zeilen.push(`Gewaehlter Hook (gesprochen): ${card.hook.text}`);
  if (card.hook && card.hook.visual) zeilen.push(`Gewaehlter Hook (Bild, Sekunde 0-1): ${card.hook.visual}`);
  // v93: Ergebnisse frueherer Schritte gehen mit — vorher sah z. B. die Caption das Skript nicht und
  // „Visual je Slide" die Slides nicht. Gekappt, damit lange Texte den Prompt nicht sprengen.
  const kappe = (t, n) => (String(t).length > n ? String(t).slice(0, n) + " …(gekuerzt)" : String(t));
  if (card.rechercheFakten) zeilen.push(`Recherchierte Fakten (Grundlage, nichts dazuerfinden):\n${kappe(card.rechercheFakten, 2500)}`);
  if (card.keywords && card.keywords.length) zeilen.push(`Suchbegriffe der Zielgruppe: ${card.keywords.join(", ")}`);
  if (card.skript) zeilen.push(`Aktuelles Skript (Sprechertext):\n${kappe(card.skript, 3000)}`);
  if (card.formatErgebnisse && Object.keys(card.formatErgebnisse).length)
    zeilen.push(`Bisherige Format-Ergebnisse (JSON, darauf aufbauen):\n${kappe(JSON.stringify(card.formatErgebnisse), 4000)}`);
  return "\n\nKARTEN-KONTEXT\n" + zeilen.join("\n");
}

const NUR_JSON =
  `Antworte AUSSCHLIESSLICH mit gueltigem JSON, keine Markdown-Zaeune, kein Text davor oder danach.`;

// Platzhalter, die in fast jeder Aufgaben-Vorlage vorkommen.
const GEMEINSAM = {
  nurJson: "Der Satz, der eine reine JSON-Antwort erzwingt",
  kontext: "Alle Angaben der Karte: Thema, Notizen, Reihe, Kategorie, Ziel, Plattformen, Fokus, Hook",
};

// --- Die Aufgaben ---------------------------------------------------------
//
// Je Aufgabe: Name, der Knopf der sie ausloest, wo er sitzt, die Vorlage, die Platzhalter-Legende
// fuer das UI und die Funktion, die die Platzhalter mit den Werten der Karte fuellt.

export const PROMPTS = {
  // PHASE 1, Stufe 1: Recherche, Fokus, Framing. NOCH KEINE Hooks — die kommen erst,
  // wenn der Fokus gewaehlt ist, und werden dann genau darauf zugeschnitten.
  recherche: {
    name: "Recherche und Fokus",
    knopf: "Recherche und Fokus",
    ort: "Karte, Schritt „Skript schreiben“",
    vorlage:
      `AUFGABE: Recherche und Fokus fuer ein neues Content-Stueck (Schritt 1 der Kette). Du legst die Faktenbasis ` +
      `und schlaegst drei Blickwinkel vor; der Nutzer waehlt danach einen, auf dem alle weiteren Schritte aufbauen.\n` +
      `DU BEKOMMST: den Karten-Kontext unten (Thema, Notizen, Kategorie, Ziel, Plattformen, Reihe).\n` +
      `REGELN:\n` +
      `- Nur belegbare Fakten (Zahlen, Studien, konkrete Beispiele); was du nicht weisst, laesst du weg.\n` +
      `- Drei Fokus-Eintraege, die sich DEUTLICH unterscheiden (z. B. Problem-Sicht, Anleitung, ueberraschende Zahl) — die Wahl muss etwas aendern.\n` +
      `- Jeder Fokus passt zum Ziel der Karte und zur Zielgruppe aus dem Unternehmenskontext.\n` +
      `- Noch KEINE Hooks und KEIN Skript.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "zusammenfassung": "die belastbaren Fakten in mehreren Saetzen, sachlich, ohne Schoenfaerberei",\n` +
      `  "fokus": [\n` +
      `    {"titel": "Hauptfokus", "text": "staerkster Schwerpunkt, ein bis zwei Saetze"},\n` +
      `    {"titel": "Alternative A", "text": "deutlich anderer Schwerpunkt"},\n` +
      `    {"titel": "Alternative B", "text": "noch ein anderer Schwerpunkt"}\n` +
      `  ],\n` +
      `  "frame": {"problem": "was konkret im Alltag der Zielgruppe nicht stimmt", "solution": "was jemand konkret tun oder sehen kann"},\n` +
      `  "keywords": ["drei bis sechs Suchbegriffe, so wie die Zielgruppe wirklich sucht"]\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM },
    variablen: (card) => ({ nurJson: NUR_JSON, kontext: kontext(card) }),
  },

  // PHASE 1, Stufe 2: NUR verbale Hooks, genau zum gewaehlten Fokus.
  hooks_verbal: {
    name: "Verbale Hooks",
    knopf: "Verbale Hooks holen",
    ort: "Karte, Schritt „Skript schreiben“ (nach der Fokus-Wahl)",
    vorlage:
      `AUFGABE: Drei gesprochene Einstiege (Hooks) fuer das Video — Schritt 2 der Kette, nach der Fokus-Wahl.\n` +
      `DU BEKOMMST: den gewaehlten Fokus, die recherchierten Fakten und das Ziel im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- Jeder Hook hoechstens {{hookWoerterMax}} Woerter.\n` +
      `- Genau auf den gewaehlten Fokus zugeschnitten — keiner, der auch zu einem anderen Fokus passen wuerde.\n` +
      `- Drei verschiedene Mechaniken: z. B. Frage an die Lebensrealitaet, ueberraschende Zahl aus den Fakten, Widerspruch zu einer verbreiteten Annahme.\n` +
      `- Nur der gesprochene Text: kein Bild, kein Skript, keine Emojis.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "hooks": [\n` +
      `    {"label": "Haupt-Hook", "verbal": "hoechstens {{hookWoerterMax}} Woerter"},\n` +
      `    {"label": "Alternative 1", "verbal": "..."},\n` +
      `    {"label": "Alternative 2", "verbal": "..."}\n` +
      `  ]\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM, hookWoerterMax: "Woerter-Obergrenze fuer den Hook" },
    variablen: (card) => ({
      nurJson: NUR_JSON,
      hookWoerterMax: MASSE.hookWoerterMax,
      kontext: kontext(card),
    }),
  },

  // PHASE 1, Stufe 3: NUR visuelle Hooks, passend zum gewaehlten verbalen Hook.
  hooks_visuell: {
    name: "Visuelle Hooks",
    knopf: "Visuelle Hooks holen",
    ort: "Karte, Schritt „Skript schreiben“ (nach der Wahl des gesprochenen Hooks)",
    vorlage:
      `AUFGABE: Drei Bild-Einstiege fuer Sekunde 0 bis 1 — Schritt 3 der Kette, nach der Wahl des gesprochenen Hooks.\n` +
      `DU BEKOMMST: Fokus und gewaehlten gesprochenen Hook im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- Vier von fuenf schauen ohne Ton: das Bild muss den gewaehlten Hook ALLEIN verstaendlich machen.\n` +
      `- Konkret und drehbar: was ist im Bild, was bewegt sich, wo steht die Kamera — mit Handy und ohne Studio umsetzbar.\n` +
      `- Drei verschiedene Ideen (z. B. Aktion mitten im Geschehen, starker Kontrast oder Vorher-Nachher, Gesicht direkt in die Kamera mit Gegenstand).\n` +
      `- Kein reines Text-Overlay, kein Skript.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "hooks": [\n` +
      `    {"label": "Haupt-Bild", "visuell": "was in Sekunde 0 bis 1 zu SEHEN ist"},\n` +
      `    {"label": "Alternative 1", "visuell": "..."},\n` +
      `    {"label": "Alternative 2", "visuell": "..."}\n` +
      `  ]\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM },
    variablen: (card) => ({ nurJson: NUR_JSON, kontext: kontext(card) }),
  },

  // PHASE 2a: One-Screen-Teleprompter.
  skript: {
    name: "Skript schreiben",
    knopf: "Skript schreiben",
    ort: "Karte, Schritt „Skript schreiben“ (Skript-Schleife)",
    vorlage:
      `AUFGABE: Den Sprechertext des Videos schreiben (Schritt 4 der Kette) — als One-Screen-Teleprompter.\n` +
      `DU BEKOMMST: Fokus, recherchierte Fakten, gewaehlten gesprochenen und Bild-Hook im Karten-Kontext unten. ` +
      `Steht dort schon ein Skript, schreibst du eine neue, bessere Fassung.\n` +
      `REGELN:\n` +
      `- Hoechstens etwa {{sprechzeitMax}} Sekunden Sprechzeit (bindend). Fuer {{plattform}} mit dem Ziel "{{ziel}}" ` +
      `liegt der belegte Korridor bei {{korridorMin}} bis {{korridorMax}} Sekunden — so nah wie moeglich daran, ohne die Grenze zu brechen.\n` +
      `- [CHUNK 1] ist der gewaehlte Hook, woertlich oder minimal geglaettet, hoechstens {{hookWoerterMax}} Woerter.\n` +
      `- Danach: das Problem in einem Satz, die Fakten als konkrete Bilder, dann die machbare Handlung.\n` +
      `- Kurze, laut gut sprechbare Saetze; je Chunk ein Gedanke. Keine Regieanweisungen im Text.\n` +
      `- Schluss: eine offene Frage an die Community, dann genau EIN indirekt formulierter Aufruf. Nie um Likes bitten.\n` +
      `AUSGABE: nur der Sprechertext, gegliedert als [CHUNK 1], [CHUNK 2] usw. — kein JSON, keine Ueberschrift, kein Kommentar.` +
      `{{kontext}}`,
    platzhalter: {
      ...GEMEINSAM,
      sprechzeitMax: "Sekunden-Obergrenze fuer die Sprechzeit",
      plattform: "Erste Plattform der Karte, ausgeschrieben",
      ziel: "Name des gewaehlten Ziels",
      korridorMin: "Untergrenze des belegten Laengen-Korridors in Sekunden",
      korridorMax: "Obergrenze des belegten Laengen-Korridors in Sekunden",
      hookWoerterMax: "Woerter-Obergrenze fuer den Hook",
    },
    variablen: (card) => {
      const pl = (card.platforms || ["instagram"])[0];
      const [min, max] = korridor(pl, card.goal);
      return {
        sprechzeitMax: MASSE.sprechzeitMax,
        plattform: plattformName(pl),
        ziel: zielInfo(card.goal).name,
        korridorMin: min,
        korridorMax: max,
        hookWoerterMax: MASSE.hookWoerterMax,
        kontext: kontext(card),
      };
    },
  },

  // PHASE 2a: Produktions-Unterlage.
  regieplan: {
    name: "Regieplan",
    knopf: "",
    ort: "kein Knopf im UI — der Prompt liegt bereit",
    vorlage:
      `AUFGABE: Aus dem fertigen Skript die Produktions-Unterlage fuer Dreh und Schnitt machen.\n` +
      `DU BEKOMMST: das aktuelle Skript, die gewaehlten Hooks und das Format ({{contenttyp}}) im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- Der Sprechertext wird WOERTLICH aus dem Skript uebernommen, nicht umgeschrieben.\n` +
      `- Sekunde 0 bis 1 zeigt den gewaehlten Bild-Hook.\n` +
      `- Alle drei bis sechs Sekunden ein Wechsel (A-Roll/B-Roll oder Perspektive); mindestens eine Einstellung mit direktem Blick in die Kamera.\n` +
      `- Untertitel sind Pflicht; der Export traegt kein Wasserzeichen einer anderen Plattform.\n` +
      `AUSGABE als Text in zwei Teilen:\n` +
      `A) METADATEN: Format und Laenge, Dateiname <Reihe>_EP<Folge>_<Thema>_<Format>.mp4, Musik-Stimmung als Prompt fuer eine Musik-KI, Schnitt-Rhythmus.\n` +
      `B) REGIEPLAN als Tabelle: Zeit (sekundengenau) | Einstellung (A-Roll/B-Roll, Ort) | Bild (Handlung am Set oder englischer Bild-/Video-Prompt) | Ton (Sprechertext + Geraeusche) | Schnitt/Effekt.` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM, contenttyp: "Format der Karte (Reel, Slider, Beitrag …)" },
    variablen: (card) => ({
      contenttyp: contenttypName(card.contenttyp || "reel"),
      kontext: kontext(card),
    }),
  },

  // PHASE 2b: Caption je Plattform, mit getrenntem Vorspann und plattformeigenen Hashtags.
  caption: {
    name: "Captions je Plattform",
    knopf: "Captions je Plattform",
    ort: "Karte, Phase „Caption“",
    vorlage:
      `AUFGABE: Die Caption je Plattform schreiben — der letzte Text-Schritt vor dem Upload.\n` +
      `DU BEKOMMST: Skript bzw. Format-Ergebnis, Fokus, Fakten und Suchbegriffe im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- Die Caption ERGAENZT den Beitrag (Hintergrund, Kontext, eine Frage) und wiederholt das Skript nicht.\n` +
      `- "lead" hoechstens {{captionLeadMax}} Zeichen: Kernaussage plus ein Suchbegriff — der einzige sicher sichtbare Teil.\n` +
      `- "body" in kurzen Absaetzen; jede Plattform in ihrem Ton (LinkedIn sachlicher und laenger, Instagram knapper).\n` +
      `- Genau EIN indirekt formulierter Aufruf. Nie um Likes bitten.\n` +
      `- Hashtags: zuerst Marken-Hashtags, falls der Unternehmenskontext welche nennt; sonst thematisch enge. Je Plattform:\n{{hashtagRegeln}}\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "varianten": [\n` +
      `{{schemaVarianten}}` +
      `\n  ],\n` +
      `  "keywords": ["drei bis sechs Suchbegriffe"],\n` +
      `  "hashtags": {\n` +
      `{{schemaHashtags}}` +
      `\n  },\n` +
      `  "cta": {"text": "genau EIN indirekt formulierter Aufruf", "directness": "indirekt"}\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: {
      ...GEMEINSAM,
      schemaVarianten: "JSON-Zeilen je gewaehlter Plattform (lead + body)",
      schemaHashtags: "JSON-Zeilen fuer die Hashtag-Listen je Plattform",
      hashtagRegeln: "Die Hashtag-Regel jeder gewaehlten Plattform, je eine Zeile",
      captionLeadMax: "Zeichen-Obergrenze fuer den sichtbaren Caption-Anfang",
    },
    variablen: (card) => {
      const pls = card.platforms && card.platforms.length ? card.platforms : ["instagram"];
      const regeln = pls
        .map((id) => {
          const p = plattform(id);
          if (id === "instagram")
            return `- Instagram: hoechstens ${p.hashtagsMax} Hashtags (hartes Plattform-Limit), ` +
              `empfohlen sind hoechstens ${p.hashtagsEmpfohlen} — auf Instagram korreliert mehr mit weniger Reichweite.`;
          if (id === "tiktok")
            return `- TikTok: mindestens ein Hashtag, hoechstens ${p.hashtagsMax} — dort wirken sie ` +
              `GEGENLAEUFIG zu Instagram und bringen mehr Views.`;
          if (id === "linkedin")
            return `- LinkedIn: Hashtags ordnen nur ein, es gibt keine belegte optimale Zahl. ` +
              `Nimm wenige, thematisch enge, keine generischen — im Zweifel sparsam.`;
          return `- ${p.name}: hoechstens ${p.hashtagsMax} Hashtags.`;
        })
        .join("\n");
      return {
        nurJson: NUR_JSON,
        schemaVarianten: pls
          .map(
            (id) =>
              `    {"plattform": "${id}", "lead": "hoechstens ${MASSE.captionLeadMax} Zeichen, Kernaussage plus Suchbegriff", "body": "der Rest der Caption"}`
          )
          .join(",\n"),
        schemaHashtags: pls.map((id) => `    "${id}": ["..."]`).join(",\n"),
        hashtagRegeln: regeln,
        captionLeadMax: MASSE.captionLeadMax,
        kontext: kontext(card),
      };
    },
  },

  // Nachschub: neue Ideen, orientiert an offenen Upload-Slots.
  ideen: {
    name: "Ideen-Nachschub",
    knopf: "Ideen holen",
    ort: "Nachschub-Fenster",
    vorlage:
      `AUFGABE: Neue Content-Ideen vorschlagen (Nachschub, Anfang der Kette). Jede Idee wird spaeter eine Karte.\n` +
      `DU BEKOMMST: was es schon gibt, was verworfen wurde, die gewuenschte Kategorie, die bisherige Verteilung und freie Upload-Slots (unten).\n` +
      `REGELN:\n` +
      `- Genau {{anzahl}} Ideen, jede deutlich anders als alles Vorhandene; nichts, was den verworfenen Themen aehnelt.\n` +
      `- Jede Idee trifft die Lebensrealitaet der Zielgruppe aus dem Unternehmenskontext und passt zu dessen Themen.\n` +
      `- Unterrepraesentierte Kategorien bevorzugen (siehe Verteilung).\n` +
      `- Passt eine Idee zu einem freien Slot (Format, Kategorie, Ziel), trag dessen Index ein, sonst null.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{"ideen": [{"titel": "kurzer Arbeitstitel", "warum": "warum das die Zielgruppe angeht, ein Satz", ` +
      `"hook": "hoechstens {{hookWoerterMax}} Woerter", "visuell": "was man in Sekunde 0 bis 1 sieht", ` +
      `"saeule": "eine von: {{saeulen}}", ` +
      `"slotIndex": <Zahl oder null>}]}\n\n` +
      `Bereits behandelt (nicht wiederholen): {{vorhandene}}\n` +
      `Verworfen (auch nichts Aehnliches): {{verworfen}}\n` +
      `Gewuenschte Kategorie: {{kategorie}}\n` +
      `Verteilung der Kategorien bisher: {{verteilung}}` +
      `{{slots}}`,
    platzhalter: {
      nurJson: GEMEINSAM.nurJson,
      hookWoerterMax: "Woerter-Obergrenze fuer den Hook",
      saeulen: "Erlaubte Saeulen-Kennungen",
      anzahl: "Wie viele Ideen gewuenscht sind",
      vorhandene: "Bereits behandelte Themen",
      verworfen: "Ausdruecklich verworfene Themen",
      kategorie: "Gewuenschte Inhaltskategorie",
      verteilung: "Bisherige Verteilung der Saeulen",
      slots: "Liste der offenen Upload-Slots (leer, wenn keine offen sind)",
    },
    variablen: (card) => ({
      nurJson: NUR_JSON,
      hookWoerterMax: MASSE.hookWoerterMax,
      saeulen: INHALTSKATEGORIEN.map((s) => s.id).join(", "),
      anzahl: card.anzahl || 6,
      vorhandene: (card.vorhandene || []).join(" | ") || "noch nichts",
      verworfen: (card.verworfen || []).join(" | ") || "nichts",
      kategorie: card.kategorie ? saeuleName(card.kategorie) : "gemischt ueber alle Kategorien",
      verteilung: card.verteilung || "unbekannt",
      slots:
        card.offeneSlots && card.offeneSlots.length
          ? `\nOFFENE UPLOAD-SLOTS (fuer "slotIndex": Zahl 0..${card.offeneSlots.length - 1} ` +
            `wenn eine Idee zu diesem Slot passt, sonst null):\n` +
            card.offeneSlots
              .map(
                (s, i) =>
                  `${i}: ${s.datum} ${s.uhrzeit || ""} | ${contenttypName(s.typ)} | ` +
                  `${kategorieName(s.kategorie)} | Ziel: ${zielInfo(s.ziel).name}`
              )
              .join("\n")
          : "",
    }),
  },

  // Redaktionsplan: Upload-Slots mit Typ, Kategorie, Ziel — keine Thementitel.
  plan: {
    name: "Redaktionsplan erzeugen",
    knopf: "Plan erzeugen",
    ort: "Redaktionsplan-Fenster",
    vorlage:
      `AUFGABE: Upload-Slots fuer den Redaktionsplan erzeugen — Termine mit Format, Kategorie und Ziel, noch ohne Themen.\n` +
      `DU BEKOMMST: Zeitraum, Frequenz, Content-Mix, aktive Kategorien, Zielgewichte und schon Geplantes (unten).\n` +
      `REGELN:\n` +
      `- Genau die verlangte Frequenz je Woche; Formate gemaess Mix.\n` +
      `- Kategorien nach Prioritaet verteilen, Ziele innerhalb jeder Woche abwechseln.\n` +
      `- Bewaehrte Zeitfenster: Instagram Di bis Do 11-13 oder 18-21 Uhr, LinkedIn Di bis Do 15-18 Uhr.\n` +
      `- Nichts doppeln, was schon geplant ist.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{"slots": [{"datum": "YYYY-MM-DD", "uhrzeit": "HH:MM", ` +
      `"typ": "reel|slider|beitrag|story|highlight", ` +
      `"kategorie": "bildung|spendenaufruf|projektbegleitung|partnerpost|umfrage", ` +
      `"ziel": "reach_new|deepen|community|donations", ` +
      `"plattform": "instagram|linkedin"}], "hinweis": "ein Satz zur Planungslogik"}\n\n` +
      `Zeitraum: {{wochen}} Wochen ab {{ab}}.\n` +
      `Posts pro Woche: {{postsProWoche}}.\n` +
      `Content-Mix: {{mix}}.\n` +
      `Aktive Kategorien (Prioritaet): {{kategorien}}.\n` +
      `Zielgewichte: {{zielgewichte}}.\n` +
      `Schon geplant: {{geplant}}.`,
    platzhalter: {
      nurJson: GEMEINSAM.nurJson,
      wochen: "Zeitraum in Wochen",
      ab: "Startdatum des Plans",
      postsProWoche: "Posts pro Woche",
      mix: "Gewaehlter Content-Mix (Format und Anteil)",
      kategorien: "Aktive Inhaltskategorien in Prioritaetsreihenfolge",
      zielgewichte: "Gewichtung der Ziele in Prozent",
      geplant: "Bereits geplante Themen",
    },
    variablen: (card) => ({
      nurJson: NUR_JSON,
      wochen: card.wochen || 4,
      ab: card.ab,
      postsProWoche: card.postsProWoche || MASSE.postsProWocheMin,
      mix:
        (card.typenmix || [])
          .filter((t) => t.anteil > 0)
          .map((t) => `${contenttypName(t.typ)} ${t.anteil}%`)
          .join(", ") || "gemischt",
      kategorien:
        (card.kategorien || [])
          .filter((k) => k.aktiv)
          .sort((a, b) => a.prioritaet - b.prioritaet)
          .map((k) => `${kategorieName(k.id)} (Prio ${k.prioritaet})`)
          .join(", ") || "alle Kategorien",
      zielgewichte:
        (card.zielgewichte || [])
          .map((z) => `${zielInfo(z.id).name} ${z.gewicht}%`)
          .join(", ") || "ausgewogen",
      geplant: (card.geplant || []).join(" | ") || "nichts",
    }),
  },

  // Auswertung: warum lief das so? Braucht Zahlen, sonst raet es nur.
  analyse: {
    name: "Auswertung eines Videos",
    knopf: "",
    ort: "kein Knopf im UI — der Prompt liegt bereit",
    vorlage:
      `AUFGABE: Einen veroeffentlichten Beitrag auswerten und sagen, was der naechste anders machen soll.\n` +
      `DU BEKOMMST: Zahlen dieses Beitrags, den eigenen Median der letzten Beitraege, Hook und Laenge (unten) und den Karten-Kontext.\n` +
      `REGELN:\n` +
      `- Vergleiche nur mit dem eigenen Median, nicht mit Branchenwerten.\n` +
      `- Erklaere mit genau einer konkreten Eigenschaft des Beitrags (Hook, Bild-Einstieg, Laenge, Framing, Aufruf, Kategorie).\n` +
      `- Reicht die Datenlage nicht, sag das ausdruecklich. Nicht raten.\n` +
      `AUSGABE: kurzer Text, hoechstens zehn Saetze, in drei Teilen: (1) Was die Zahlen sagen. (2) Woran es am ehesten liegt. (3) Was das naechste Stueck konkret anders macht.\n\n` +
      `Zahlen: {{zahlen}}\n` +
      `Eigener Median: {{median}}\n` +
      `Hook: {{hook}} / Bild: {{hookVisuell}}\n` +
      `Laenge: {{laenge}} Sekunden` +
      `{{kontext}}`,
    platzhalter: {
      kontext: GEMEINSAM.kontext,
      zahlen: "Kennzahlen dieses Videos als JSON",
      median: "Eigener Median der letzten Beitraege als JSON",
      hook: "Gesprochener Hook der Karte",
      hookVisuell: "Visueller Hook der Karte",
      laenge: "Laenge des Videos in Sekunden",
    },
    variablen: (card) => ({
      zahlen: JSON.stringify(card.metrics || {}),
      median: JSON.stringify(card.median || {}),
      hook: (card.hook && card.hook.text) || "-",
      hookVisuell: (card.hook && card.hook.visual) || "-",
      laenge: (card.video && card.video.seconds) || "-",
      kontext: kontext(card),
    }),
  },

  // --- v79: Format-spezifische Tasks (W4). Default-Rolle userkomm (1 Schritt); Ben kann je Format
  // ueber den Editor (perFormat) eine eigene Kette bauen. Parameter belegt in Strom A der v79-Recherche.

  // Slider/Carousel: Struktur zuerst (Slide-Anzahl aus dem Inhalt), Botschaft je Slide.
  slider_aufbau: {
    name: "Slider aufbauen",
    knopf: "Slider aufbauen",
    ort: "Karte, Format Slider/Carousel",
    vorlage:
      `AUFGABE: Einen Slider (Carousel) aufbauen — Schritt 1 des Slider-Formats: Text je Slide. Die Bilder folgen im naechsten Schritt.\n` +
      `DU BEKOMMST: Thema, Fakten, Fokus und Ziel im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- Slide-Anzahl aus dem Inhalt ableiten: LinkedIn (Dokument-Post) 8 bis 15, Instagram 8 bis 10, nie unter 5.\n` +
      `- Slide 1 oeffnet eine Neugierluecke (kein "5 Tipps …"); je Slide genau EINE Botschaft, kein Fliesstext.\n` +
      `- Die letzte Slide traegt den einen Aufruf; die Caption erweitert den Slider, statt ihn zu wiederholen.\n` +
      `- "visual" je Slide nur als kurze Bild-Idee — die Ausarbeitung macht der naechste Schritt.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "slides": [\n` +
      `    {"nr": 1, "rolle": "Cover/Hook", "text": "Neugierluecke, hoechstens 8 Zeilen", "visual": "kurze Bild-Idee"},\n` +
      `    {"nr": 2, "rolle": "Inhalt", "text": "eine Botschaft, 6 bis 8 Zeilen", "visual": "kurze Bild-Idee"}\n` +
      `  ],\n` +
      `  "cta": "die eine naechste Aktion auf der letzten Slide",\n` +
      `  "caption": "ergaenzt den Slider (Hintergrund, Frage), wiederholt ihn nicht"\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM },
    variablen: (card) => ({ nurJson: NUR_JSON, kontext: kontext(card) }),
  },

  // Slider: konkretes Visual je Slide als EIN Design-System.
  slider_visual: {
    name: "Visual je Slide",
    knopf: "Visual je Slide",
    ort: "Karte, Format Slider/Carousel (nach dem Aufbau)",
    vorlage:
      `AUFGABE: Zu jeder Slide des bereits aufgebauten Sliders das Bild ausarbeiten — Schritt 2 des Slider-Formats.\n` +
      `DU BEKOMMST: die Slides aus "slider_aufbau" (Text und Bild-Idee je Slide) unter "Bisherige Format-Ergebnisse" im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- Genau so viele Eintraege wie Slides, gleiche Nummern; jedes Bild traegt die Botschaft SEINER Slide.\n` +
      `- EIN Design-System fuer alle Slides (Palette, Typografie, Raster); Markenfarben aus dem Unternehmenskontext, falls genannt.\n` +
      `- Mobil lesbar (Fliesstext ab 24 pt); Format 4:5 (1080x1350) fuer Instagram, 1:1 oder 4:5 fuer LinkedIn.\n` +
      `- "bildprompt" auf Englisch, direkt in einer Bild-KI nutzbar; Text auf der Slide gehoert in "elemente", nicht in den Bildprompt.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "designsystem": {"palette": "...", "typo": "...", "layout": "durchgaengiges Raster"},\n` +
      `  "slides": [\n` +
      `    {"nr": 1, "bildprompt": "englischer Bild-/Grafik-Prompt", "elemente": "Text-Position, Icons, Diagramm"}\n` +
      `  ]\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM },
    variablen: (card) => ({ nurJson: NUR_JSON, kontext: kontext(card) }),
  },

  // Einzel-Beitrag: Text plus EIN Visual, primaer LinkedIn.
  beitrag_visual: {
    name: "Text-Beitrag mit Visual",
    knopf: "Text-Beitrag bauen",
    ort: "Karte, Format Beitrag mit Text",
    vorlage:
      `AUFGABE: Einen Einzel-Beitrag aus Text und EINEM Bild bauen (Format "Beitrag mit Text"), primaer LinkedIn, sekundaer Instagram.\n` +
      `DU BEKOMMST: Thema, Fakten, Fokus und Ziel im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- Die erste Zeile entscheidet, ob jemand weiterliest: LinkedIn hoechstens 140, Instagram hoechstens 125 Zeichen vor dem Abschneiden.\n` +
      `- Body in kurzen Bloecken (ein Gedanke je Absatz, viel Weissraum); LinkedIn-Ideallaenge 1200 bis 1600 Zeichen.\n` +
      `- Schluss: eine offene Frage ODER genau ein Aufruf — auf LinkedIn zaehlen Kommentare deutlich mehr als Likes.\n` +
      `- Das Bild ist Information, keine Deko: Daten-Grafik, Zitat-Karte oder einfaches Schema.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "hook": "erste Zeile",\n` +
      `  "body": "der Text in kurzen Bloecken",\n` +
      `  "cta": "Frage oder genau ein Aufruf",\n` +
      `  "visual": "EIN Bild-Konzept: was zu sehen ist, welche Zahl oder welches Zitat",\n` +
      `  "hashtags": ["3 bis 5, zuerst Marken-Hashtags falls im Unternehmenskontext genannt"]\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM },
    variablen: (card) => ({ nurJson: NUR_JSON, kontext: kontext(card) }),
  },

  // Story/Highlight: nur Instagram (LinkedIn hat kein Story-Format), 9:16, ein Gedanke je Frame.
  story_frames: {
    name: "Story-Frames",
    knopf: "Story-Frames bauen",
    ort: "Karte, Format Story/Highlight (Instagram)",
    vorlage:
      `AUFGABE: Eine Instagram-Story-Sequenz bauen (Format Story/Highlight, 9:16). LinkedIn hat kein Story-Format.\n` +
      `DU BEKOMMST: Thema, Fakten, Fokus und Ziel im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- 3 bis 7 Frames als Mini-Bogen: Einstieg → Inhalt → Aufruf.\n` +
      `- Ein Gedanke je Frame, sparsamer Text (oberes und unteres Sechstel freilassen), genau EIN interaktives Element je Frame.\n` +
      `- Foto-Frame etwa 7 Sekunden, Video-Segment hoechstens 15 Sekunden; Bild fuer Aussagen, Video fuer Zeigen und Naehe.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "frames": [\n` +
      `    {"nr": 1, "medium": "bild|video", "text": "kurzer Overlay-Text", "sticker": "poll|quiz|frage|slider|countdown|add_yours", "warum": "warum dieses Medium und dieser Sticker"}\n` +
      `  ]\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM },
    variablen: (card) => ({ nurJson: NUR_JSON, kontext: kontext(card) }),
  },

  // Langform-Video: stichpunktartiges Storytelling-KONZEPT, kein Wort-fuer-Wort-Skript.
  langform_konzept: {
    name: "Storytelling-Konzept (Langform)",
    knopf: "Storytelling-Konzept",
    ort: "Karte, Format Langformat-Video",
    vorlage:
      `AUFGABE: Ein Storytelling-Konzept fuer ein Langvideo (10 bis 15 Minuten) — Stichpunkte je Kapitel, KEIN Wort-fuer-Wort-Skript.\n` +
      `DU BEKOMMST: Thema, Fakten, Fokus und Ziel im Karten-Kontext unten.\n` +
      `REGELN:\n` +
      `- Einen Erzaehlbogen waehlen und begruenden (z. B. Curiosity Loop, Transformation, Problem Stack, Expertenkontrast, Ticking Clock, Reveal Ladder).\n` +
      `- Die ersten rund 30 Sekunden versprechen einen klaren Nutzen oder teasern die Wendung.\n` +
      `- 6 bis 8 Kapitel, jedes wie ein eigener Mini-Clip mit eigenem kleinen Hook; etwa alle 2 bis 4 Minuten ein eingeloestes Versprechen. Dichte vor Dauer.\n` +
      `- Am Ende genau ein Aufruf.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "struktur": "gewaehlter Erzaehlbogen mit einem Satz Begruendung",\n` +
      `  "hook": "Einstieg der ersten rund 30 Sekunden",\n` +
      `  "kapitel": [\n` +
      `    {"nr": 1, "titel": "Kapitel-Titel", "beats": ["Stichpunkt", "Stichpunkt"], "payoff": "eingeloestes Versprechen"}\n` +
      `  ],\n` +
      `  "kapitelmarker": ["YouTube-Kapitelmarken, kurz und klickbar"],\n` +
      `  "schluss": "Aufloesung plus genau ein Aufruf"\n` +
      `}` +
      `{{kontext}}`,
    platzhalter: { ...GEMEINSAM },
    variablen: (card) => ({ nurJson: NUR_JSON, kontext: kontext(card) }),
  },
};

// Baut den Prompt einer Aufgabe — mit Bens Fassung, wenn er eine gespeichert hat.
export function baueAufgabe(task, card = {}, override, kontext = {}) {
  const eintrag = PROMPTS[task];
  if (!eintrag) return null;
  // Die Kontext-Platzhalter stehen auch in jeder Aufgaben-Vorlage zur Verfuegung — Ben soll
  // {{firmenkontext}} an genau die Stelle schreiben koennen, an der er ihn haben will.
  return fuelleVorlage(override || eintrag.vorlage, {
    ...leererKontext(),
    ...eintrag.variablen(card || {}),
    ...kontext,
  });
}

// Rueckwaertskompatibel: AUFGABEN[task](card) liefert wie bisher den fertigen Standard-Prompt.
export const AUFGABEN = Object.fromEntries(
  Object.keys(PROMPTS).map((id) => [id, (card) => baueAufgabe(id, card)])
);

// Aufgaben, deren Antwort strukturiert ist.
export const JSON_AUFGABEN = new Set([
  "recherche", "hooks_verbal", "hooks_visuell", "caption", "ideen", "plan",
  // v79: format-spezifische Tasks liefern strukturiertes JSON.
  "slider_aufbau", "slider_visual", "beitrag_visual", "story_frames", "langform_konzept",
]);

// --- v41: Knopf-Pipelines -------------------------------------------------
// Jeder Knopf ist eine Kette aus Schritten {rolle, prompt}. Die Rolle bestimmt das Modell (v40) und
// ob eine Web-Suche vorangestellt wird (nur rolle "recherche"). Die Ausgabe eines Schritts geht als
// {{vorschritt}} in den naechsten; das Ergebnis des LETZTEN Schritts ist das Knopf-Ergebnis. Der
// System-Vorspann geht nur in userkomm-Schritte (Owner 15.09.2026).

// Rolle, auf die eine Aufgabe faellt, wenn nichts anderes gesagt ist (Ein-Schritt-Default und
// Migration alter Ein-Prompt-Fassungen).
export function standardRolle(task) {
  return task === "recherche" ? "recherche" : "userkomm";
}

// Die 3-Schritt-Standardkette hinter "Recherche und Fokus" (Owner 15.09.2026): (1) Userkommunikation
// zieht aus Auftrag+Kontext die Recherche-Fragen, (2) Recherche-Rolle sammelt mit Web-Suche belegte
// Fakten, (3) Userkommunikation giesst die Fakten ins JSON-Schema.
const RECHERCHE_PIPELINE = [
  // v93: gleiche Gliederung wie alle Aufgaben; Schritt 3 liefert exakt das Schema von PROMPTS.recherche.
  {
    rolle: "userkomm",
    prompt:
      `AUFGABE: Die Web-Recherche fuer ein neues Content-Stueck vorbereiten (Schritt 1 von 3).\n` +
      `DU BEKOMMST: den Karten-Kontext unten und den Unternehmenskontext im Vorspann.\n` +
      `REGELN: 1 bis 3 Suchanfragen, kurze treffsichere Suchbegriffe (keine ganzen Saetze), die belegbare ` +
      `Fakten zum Thema UND zur Lebensrealitaet der Zielgruppe finden. Deutsch oder Englisch, je nachdem, wo ` +
      `die besseren Quellen zu erwarten sind.\n` +
      `AUSGABE: nur die Suchanfragen, eine je Zeile, sonst nichts.{{kontext}}`,
  },
  {
    rolle: "recherche",
    prompt:
      `AUFGABE: Aus den Web-Treffern oben die belastbaren Fakten ziehen (Schritt 2 von 3).\n` +
      `DU BEKOMMST: die Web-Treffer oben und die Suchanfragen unten.\n` +
      `REGELN: nur, was in den Treffern steht oder allgemein gesichert ist — Zahlen, Studien, konkrete ` +
      `Beispiele, je mit Quelle (Seite oder Organisation). Widersprechen sich Quellen, nenne beide. Nichts erfinden.\n` +
      `AUSGABE: eine Stichpunktliste der Fakten mit Quelle.\n\nSuchanfragen:\n{{vorschritt}}`,
  },
  {
    rolle: "userkomm",
    prompt:
      `AUFGABE: Aus den recherchierten Fakten "Recherche und Fokus" machen (Schritt 3 von 3). Der Nutzer ` +
      `waehlt danach einen Fokus, auf dem alle weiteren Schritte aufbauen.\n` +
      `DU BEKOMMST: die Faktenliste unten und den Karten-Kontext.\n` +
      `REGELN:\n` +
      `- Nur Fakten aus der Liste verwenden.\n` +
      `- Drei Fokus-Eintraege, die sich DEUTLICH unterscheiden (z. B. Problem-Sicht, Anleitung, ueberraschende Zahl), passend zu Ziel und Zielgruppe.\n` +
      `- Noch KEINE Hooks und KEIN Skript.\n` +
      `AUSGABE: {{nurJson}} Schema:\n` +
      `{\n` +
      `  "zusammenfassung": "die belastbaren Fakten in mehreren Saetzen, sachlich, ohne Schoenfaerberei",\n` +
      `  "fokus": [\n` +
      `    {"titel": "Hauptfokus", "text": "staerkster Schwerpunkt, ein bis zwei Saetze"},\n` +
      `    {"titel": "Alternative A", "text": "deutlich anderer Schwerpunkt"},\n` +
      `    {"titel": "Alternative B", "text": "noch ein anderer Schwerpunkt"}\n` +
      `  ],\n` +
      `  "frame": {"problem": "was konkret im Alltag der Zielgruppe nicht stimmt", "solution": "was jemand konkret tun oder sehen kann"},\n` +
      `  "keywords": ["drei bis sechs Suchbegriffe, so wie die Zielgruppe wirklich sucht"]\n` +
      `}\n\nFakten:\n{{vorschritt}}{{kontext}}`,
  },
];

// Effektive Standard-Pipeline einer Aufgabe: recherche = die 3er-Kette, sonst 1 Schritt mit der
// bestehenden Vorlage auf der Standard-Rolle.
export function standardPipeline(task) {
  // v79: Jeder Schritt traegt `websuche` explizit — der Editor zeigt den Zustand, und der Server
  // muss ihn nicht mehr an der Rolle raten. Default: nur Recherche-Schritte suchen im Web.
  if (task === "recherche") return RECHERCHE_PIPELINE.map((s) => ({ ...s, websuche: s.rolle === "recherche" }));
  const p = PROMPTS[task];
  if (!p) return [];
  const rolle = standardRolle(task);
  return [{ rolle, prompt: p.vorlage, websuche: rolle === "recherche" }];
}

// v41: Baut den fertigen Prompt EINES Pipeline-Schritts. Fuellt die Platzhalter: {{kontext}}
// (Karten-Angaben), {{nurJson}}, {{vorschritt}} (Ausgabe des Vorschritts) sowie — ueber `zusatz` —
// {{firmenkontext}}/{{projektkontext}} vom Server. Unbekannte Platzhalter bleiben stehen.
// v93: `task` reicht die aufgabeneigenen Werte durch ({{hookWoerterMax}}, {{schemaVarianten}},
// {{slots}} …). Ohne sie gingen diese Platzhalter seit v41 ROH an die KI (gemessen 01.10.2026:
// caption 4, skript 6, ideen 8, hooks_verbal 1 offene Platzhalter).
export function baueSchritt(promptText, card = {}, zusatz = {}, task = null) {
  const eintrag = task ? PROMPTS[task] : null;
  return fuelleVorlage(promptText, {
    ...leererKontext(),
    nurJson: NUR_JSON,
    kontext: kontext(card),
    vorschritt: "",
    ...(eintrag ? eintrag.variablen(card || {}) : {}),
    ...zusatz,
  });
}

// Zieht JSON aus einer Antwort, auch wenn Zaeune drumstehen. v104: nachsichtig (u. a. ueberzaehlige
// Kommas lokaler Modelle) — die Regel lebt in pipeline.js, damit der Browser alte Roh-Antworten
// genauso lesen kann.
export function parseJson(text) {
  return parseJsonNachsichtig(text);
}

// Ruft die lokale Claude-Code-CLI im Headless-Modus auf.
// --- Claude-Modelle -------------------------------------------------------
//
// Auswahl in den Einstellungen. Standard ist Haiku: schnellste Antwort, kleinster Verbrauch —
// fuer Recherche, Hooks und Captions reicht das. Die CLI nimmt Alias-Namen ("haiku", "sonnet",
// "opus"); belegt mit `claude --help`, Zeile "--model <model>".

export const CLAUDE_MODELLE = [
  { id: "haiku", name: "Haiku 4.5", sub: "Standard — schnell, kleinster Verbrauch" },
  { id: "sonnet", name: "Sonnet 5", sub: "Ausgewogen zwischen Tempo und Tiefe" },
  { id: "opus", name: "Opus 5", sub: "Staerkste Texte, dafuer langsamer" },
];

export const CLAUDE_MODELL_STANDARD = "haiku";

// Leerer oder unbekannter Wert: kein --model, dann nimmt die CLI ihre eigene Voreinstellung.
function modellArg(modell) {
  const id = String(modell || "").trim();
  if (!id || !CLAUDE_MODELLE.some((m) => m.id === id)) return [];
  return ["--model", id];
}

// v58: duenne Huelle um den unveraenderten Aufruf — so liest die KI-Sektion auch die
// Claude-Laeufe mit, ohne dass die Subprozess-Logik angefasst werden muss. Der Prompt geht
// bewusst NICHT ins Log.
export function runClaude(prompt, optionen = {}) {
  const vorgang = ereignisse.starte({
    sektion: "ki",
    dienst: "claude",
    text: `${optionen.modell || "Standardmodell"} — Anfrage ohne Stream`,
  });
  return runClaudeRoh(prompt, optionen).then(
    (t) => { vorgang.fertig(`${(t || "").length} Zeichen`); return t; },
    (e) => { vorgang.fehler(e.message); throw e; }
  );
}

function runClaudeRoh(prompt, { timeoutMs = 300000, modell = "" } = {}) {
  return new Promise((resolve, reject) => {
    // Auf Windows ist `claude` eine .cmd, deshalb shell:true. Der Prompt steht NICHT in den
    // Argumenten (er kommt ueber stdin), darum ist das hier unkritisch.
    // cwd bewusst auf ein neutrales Verzeichnis: sonst liest `claude` die CLAUDE.md der
    // Werkbank mit und deren Arbeitsregeln sickern in die Texte.
    const child = spawn("claude", ["-p", "--output-format", "text", ...modellArg(modell)], {
      shell: true,
      cwd: tmpdir(),
    });
    let out = "";
    let err = "";
    let erledigt = false;

    // Vorher lief der Aufruf ohne Zeitgrenze — eine haengende CLI blockierte die Anfrage endlos.
    const uhr = setTimeout(() => {
      if (erledigt) return;
      erledigt = true;
      child.kill();
      reject(new Error(`Die KI hat nach ${Math.round(timeoutMs / 60000)} Minuten nicht geantwortet.`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
      reject(e);
    });
    child.on("close", (code) => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `claude endete mit Code ${code}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// Wie runClaude, aber die Token kommen live: onDelta(text) fuer jedes Stueck, onDelta("", status)
// fuer die Zwischen-Zusammenfassung der CLI. Aufgeloest wird mit dem finalen Text.
// Format empirisch geprueft (28.08.2026): stream-json --verbose --include-partial-messages liefert
// {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"…"}}}
// und am Ende {"type":"result","result":"…"}.
export function runClaudeStream(prompt, onDelta, optionen = {}) {
  const vorgang = ereignisse.starte({
    sektion: "ki",
    dienst: "claude",
    text: `${optionen.modell || "Standardmodell"} — Anfrage mit Stream`,
  });
  return runClaudeStreamRoh(prompt, onDelta, optionen).then(
    (t) => { vorgang.fertig(`${(t || "").length} Zeichen gestreamt`); return t; },
    (e) => { vorgang.fehler(e.message); throw e; }
  );
}

function runClaudeStreamRoh(prompt, onDelta, { timeoutMs = 300000, modell = "" } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages", ...modellArg(modell)],
      { shell: true, cwd: tmpdir() }
    );
    let puffer = "";
    let voll = "";
    let final = "";
    let err = "";
    let erledigt = false;

    const uhr = setTimeout(() => {
      if (erledigt) return;
      erledigt = true;
      child.kill();
      reject(new Error(`Die KI hat nach ${Math.round(timeoutMs / 60000)} Minuten nicht geantwortet.`));
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      puffer += d.toString();
      let nl;
      while ((nl = puffer.indexOf("\n")) >= 0) {
        const zeile = puffer.slice(0, nl).trim();
        puffer = puffer.slice(nl + 1);
        if (!zeile) continue;
        let o;
        try {
          o = JSON.parse(zeile);
        } catch {
          continue;
        }
        if (o.type === "stream_event" && o.event && o.event.type === "content_block_delta" && o.event.delta && o.event.delta.type === "text_delta") {
          voll += o.event.delta.text;
          try { onDelta(o.event.delta.text); } catch {}
        } else if (o.type === "result" && typeof o.result === "string") {
          final = o.result;
        } else if (o.type === "system" && o.subtype === "post_turn_summary" && o.status_detail) {
          try { onDelta("", o.status_detail); } catch {}
        }
      }
    });
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
      reject(e);
    });
    child.on("close", (code) => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(uhr);
      if (code === 0) resolve(final || voll);
      else reject(new Error(err.trim() || `claude endete mit Code ${code}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export function hinweisZuFehler(e, provider = "claude") {
  if (provider === "ollama") {
    if (/ECONNREFUSED|fetch failed|network/i.test(e.message))
      return "Ollama läuft nicht. Starte es mit `ollama serve` oder installiere es unter https://ollama.ai.";
    if (/404|not found/i.test(e.message))
      return "Das gewählte Ollama-Modell ist nicht geladen. Lade es mit `ollama pull <modell>`.";
    return "Die Ollama-Verbindung ist fehlgeschlagen. Läuft Ollama? Ist das Modell geladen?";
  }
  if (e.code === "ENOENT" || /not recognized|not found|nicht gefunden/i.test(e.message))
    return (
      "Die Claude-Code-CLI ist nicht installiert. Einmalig: `npm i -g @anthropic-ai/claude-code`, " +
      "dann `claude` starten und einloggen."
    );
  if (/nicht geantwortet/.test(e.message))
    return "Die KI hat zu lange gebraucht. Starte den Versuch erneut oder kuerze die Notizen.";
  return "Die KI-Aktion lief nicht durch. Ist `claude` installiert und eingeloggt (einmal interaktiv `claude` starten)?";
}

// --- Ollama (lokal, kostenlos) -------------------------------------------
// Ollama lauscht auf http://localhost:11434 und bietet eine OpenAI-kompatible
// API. Das System-Prompt landet als "system"-Nachricht, der Task als "user".

const OLLAMA_URL = "http://localhost:11434/v1/chat/completions";

// v91: Modellname ohne Groesse („deepseek-r1") auf das installierte Modell derselben Familie
// aufloesen („deepseek-r1:14b"). Ollama selbst liest „deepseek-r1" als „deepseek-r1:latest" — das
// gibt es selten, deshalb scheiterte jede lokale Rolle mit dem Standard-Eintrag (gemessen 01.10.2026:
// installiert waren nur :14b-Varianten). Exakter Treffer gewinnt; sonst der erste Tag der Familie.
let tagsCache = null; // { zeit, namen }
export async function loeseOllamaModell(model) {
  if (!model || model.includes(":")) return model;
  try {
    if (!tagsCache || Date.now() - tagsCache.zeit > 60000) {
      const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      tagsCache = { zeit: Date.now(), namen: (data.models || []).map((m) => m.name) };
    }
    const n = tagsCache.namen;
    return n.find((x) => x === model + ":latest") || n.find((x) => x.startsWith(model + ":")) || model;
  } catch {
    return model;
  }
}

export async function runOllama(systemMsg, userMsg, model = "llama3.2", { timeoutMs = 300000 } = {}) {
  model = await loeseOllamaModell(model);
  const ctrl = new AbortController();
  const uhr = setTimeout(() => ctrl.abort(), timeoutMs);
  // v58: Die KI-Sektion der Kopfzeile liest jeden Modell-Aufruf mit. Prompts gehen NICHT ins
  // Log — nur Modell und Ergebnis; der Prompt-Inhalt steht ohnehin im Karten-Terminal (v51).
  const vorgang = ereignisse.starte({ sektion: "ki", dienst: "ollama", text: `${model} — Anfrage ohne Stream` });
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      vorgang.fehler(`HTTP ${res.status}`);
      throw new Error(`Ollama ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const inhalt = data.choices[0].message.content;
    vorgang.fertig(`${(inhalt || "").length} Zeichen`);
    return inhalt;
  } catch (e) {
    vorgang.fehler(e.name === "AbortError" ? `Zeitueberschreitung nach ${Math.round(timeoutMs / 1000)} s` : e.message);
    throw e;
  } finally {
    clearTimeout(uhr);
  }
}

// Stufen-Erkennung (v51): Laeuft Ollama, und liegt das Modell schon im Speicher?
// Der Generierungs-Weg oben nutzt die OpenAI-Schicht (/v1/chat/completions), und die liefert
// KEINE Ollama-Metriken — eigene Messung 17.09.2026, die Antwort traegt nur
// id/object/created/model/system_fingerprint/choices/usage, kein `load_duration`.
// Der Kaltstart ist deshalb nur VORHER erkennbar, ueber die native Prozessliste /api/ps
// (dasselbe Muster, das ollamaEntladen() in server.js beim Herunterfahren benutzt).
// Warum das zaehlt: gemessen am 17.09.2026 braucht deepseek-r1:14b kalt 25,38 s reines
// Laden von 26,73 s Gesamtdauer — diese Spanne war im Board bis v51 vollkommen stumm.
export async function modellStand(model = "llama3.2") {
  model = await loeseOllamaModell(model);
  try {
    const res = await fetch("http://localhost:11434/api/ps", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ollamaLaeuft: false, geladen: false };
    const data = await res.json();
    const geladen = (data.models || []).some((m) => m.name === model || m.name === model + ":latest");
    return { ollamaLaeuft: true, geladen };
  } catch {
    // Nicht erreichbar = Ollama laeuft (noch) nicht. Kein Fehler: der eigentliche Aufruf
    // meldet ihn gleich sauber, hier geht es nur um die Stufen-Anzeige.
    return { ollamaLaeuft: false, geladen: false };
  }
}

// Streaming-Variante: onDelta(text) fuer jeden Token, resolved mit finalem Text.
// onErsterToken() (v51) feuert genau einmal, beim ersten eintreffenden Token — das ist der
// exakte Moment, in dem das Laden vorbei ist und die Generierung beginnt.
export async function runOllamaStream(systemMsg, userMsg, model = "llama3.2", onDelta, { timeoutMs = 300000, onErsterToken } = {}) {
  model = await loeseOllamaModell(model);
  const ctrl = new AbortController();
  const uhr = setTimeout(() => ctrl.abort(), timeoutMs);
  let voll = "";
  const vorgang = ereignisse.starte({ sektion: "ki", dienst: "ollama", text: `${model} — Anfrage mit Stream` });
  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        stream: true,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      vorgang.fehler(`HTTP ${res.status}`);
      throw new Error(`Ollama ${res.status}: ${t.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let puffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      puffer += dec.decode(value, { stream: true });
      let nl;
      while ((nl = puffer.indexOf("\n")) >= 0) {
        const zeile = puffer.slice(0, nl).trim();
        puffer = puffer.slice(nl + 1);
        if (!zeile || zeile === "data: [DONE]") continue;
        const json = zeile.startsWith("data: ") ? zeile.slice(6) : zeile;
        let o;
        try { o = JSON.parse(json); } catch { continue; }
        const delta = o?.choices?.[0]?.delta?.content;
        if (delta) {
          if (!voll && onErsterToken) { try { onErsterToken(); } catch {} }
          voll += delta;
          try { onDelta(delta); } catch {}
        }
      }
    }
    vorgang.fertig(`${voll.length} Zeichen gestreamt`);
    return voll;
  } catch (e) {
    vorgang.fehler(e.name === "AbortError" ? `Zeitueberschreitung nach ${Math.round(timeoutMs / 1000)} s` : e.message);
    throw e;
  } finally {
    clearTimeout(uhr);
  }
}

// Prueft ob Ollama erreichbar ist. Gibt {ok, model, error} zurueck.
export async function pingOllama(model = "llama3.2") {
  const vorgang = ereignisse.starte({ sektion: "ki", dienst: "ollama", text: "GET /api/tags (Modelle abfragen)" });
  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      vorgang.fehler(`HTTP ${res.status}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const vorhanden = (data.models || []).some((m) => m.name === model || m.name === model + ":latest");
    vorgang.fertig(`${(data.models || []).length} Modelle, ${model} ${vorhanden ? "vorhanden" : "fehlt"}`, vorhanden ? "ok" : "fehlt");
    return { ok: true, vorhanden, modelle: (data.models || []).map((m) => m.name) };
  } catch (e) {
    vorgang.fehler(e.message);
    return { ok: false, error: e.message };
  }
}
