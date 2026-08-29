// KI-Aufgaben ueber die lokale Claude-Code-CLI (`claude -p`) — laeuft ueber Bens Abo,
// nicht ueber die kostenpflichtige API.
//
// Der Marken-Vorspann traegt jetzt zusaetzlich die belegten Regeln aus
// docs/best-practices.md. Damit muss die Nachbearbeitung weniger korrigieren, und die
// Qualitaetstore in pipeline.js schlagen seltener an.

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import {
  MASSE,
  plattform,
  plattformName,
  saeuleName,
  zielInfo,
  korridor,
  SAEULEN,
} from "./pipeline.js";

// --- Fester Marken- und Regelrahmen: geht als Vorspann in JEDEN Aufruf ---------------

export const MARKE_REGELN =
  `Du bist erfahrener Social-Media-Content-Creator und Video-Producer fuer die NGO World Eden ` +
  `Era (Projekte "World Eden" und "Project Oasis"): Naturschutz, Umweltschutz, Agraroekologie, ` +
  `Systemoekologie. Zielgruppe: Menschen mit eigener Farm, eigenem Garten oder Kleintierhaltung, ` +
  `Selbstversorger-Denken — dazu Foerderer und Partner. Ziel jedes Stuecks: hohe Conversion ` +
  `(Follows, Kommentare, DMs, Spenden) und wissenschaftliche Autoritaet auf Augenhoehe.\n\n` +
  `Immer geltende Regeln der Marke:\n` +
  `- Ein Videoskript ist NIE laenger als etwa ${MASSE.sprechzeitMax} Sekunden Sprechzeit.\n` +
  `- Wissenschaftlich praezise, aber umgangssprachlich uebersetzt: erklaer es wie einem Kumpel, ` +
  `mit Alltags-Metaphern ("Schwamm" statt "Wasserspeicherkapazitaet").\n` +
  `- Positiv und konstruktiv: keine kuenstliche Dramatik, keine Weltuntergangs-Bilder.\n` +
  `- Natuerlicher Sprechfluss: keine KI-Floskeln, kein aufgesetzter Slang; muss sich stolperfrei ` +
  `laut vorlesen lassen.\n` +
  `- Hooks sprechen die persoenliche Lebensrealitaet an ("Was brauchst DU fuer deine Farm?" ` +
  `statt "Wie funktioniert Aquaponik?").\n` +
  `- Bei einer Videoreihe inhaltlich auf die vorherigen Videos aufbauen, keine Dopplungen.\n\n` +
  `Belegte Praxis-Regeln (Herkunft: docs/best-practices.md — halte dich daran):\n` +
  `- Der gesprochene Einstieg muss in ${MASSE.hookSekunden} Sekunden sitzen, also hoechstens ` +
  `etwa ${MASSE.hookWoerterMax} Woerter. Instagram misst die Abbruchquote bei genau dieser Marke.\n` +
  `- Vier von fuenf schauen OHNE Ton. Zu jedem Hook gehoert deshalb, was in der ersten Sekunde ` +
  `zu SEHEN ist — das Bild muss den Hook allein tragen koennen.\n` +
  `- Genau EIN Aufruf zum Handeln, nicht mehrere. Mehrere heben sich gegenseitig auf.\n` +
  `- Der Aufruf ist INDIREKT formuliert ("Wenn du auch damit anfaengst, schreib mir") statt ` +
  `direkt ("Kommentiere jetzt!"). Bei NGO-Inhalten ist das belegt wirksamer.\n` +
  `- NIEMALS um Likes bitten. Das senkt die Interaktionen um 60 Prozent.\n` +
  `- Immer BEIDES benennen: das konkrete Problem UND die sichtbare, machbare Handlung. ` +
  `Nur Problem bringt Reichweite bei negativer Resonanz, nur Loesung bringt Zustimmung bei ` +
  `weniger Reichweite.\n` +
  `- Die ersten ${MASSE.captionLeadMax} Zeichen der Caption sind der einzige garantiert ` +
  `sichtbare Teil und seit Juli 2025 zugleich der Google-Ausschnitt. Dort steht die Kernaussage ` +
  `samt Suchbegriff, nicht die Anmoderation.\n` +
  `Antworte auf Deutsch.`;

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
    `Content-Saeule: ${card.pillar ? saeuleName(card.pillar) : "(nicht gesetzt)"}`,
    `Ziel: ${ziel.name} — gemessen wird an "${ziel.kennzahl}". ${ziel.satz}`,
    `Plattformen: ${plattformen}`,
  ];
  if (card.frame && (card.frame.problem || card.frame.solution))
    zeilen.push(`Problem: ${card.frame.problem || "-"} / Handlung: ${card.frame.solution || "-"}`);
  // Der gewaehlte Fokus zieht sich durch: sobald er steht, bauen Hooks und Skript darauf auf.
  if (card.fokus) zeilen.push(`Gewaehlter Fokus (darauf aufbauen, nicht davon abweichen): ${card.fokus}`);
  if (card.hook && card.hook.text) zeilen.push(`Gewaehlter Hook: ${card.hook.text}`);
  return "\n\n" + zeilen.join("\n");
}

const NUR_JSON =
  `Antworte AUSSCHLIESSLICH mit gueltigem JSON, keine Markdown-Zaeune, kein Text davor oder danach.`;

// --- Die Aufgaben ---------------------------------------------------------

export const AUFGABEN = {
  // PHASE 1, Stufe 1: Recherche, Fokus, Framing. NOCH KEINE Hooks — die kommen erst,
  // wenn der Fokus gewaehlt ist, und werden dann genau darauf zugeschnitten.
  recherche: (card) =>
    `Wir sind in PHASE 1 (Idee und Recherche), STUFE 1. ${NUR_JSON} Schema:\n` +
    `{\n` +
    `  "zusammenfassung": "fundierte Hard Facts, mehrere Saetze, keine Oeko-Romantik",\n` +
    `  "fokus": [\n` +
    `    {"titel": "Hauptfokus", "text": "staerkster inhaltlicher Schwerpunkt, ein bis zwei Saetze"},\n` +
    `    {"titel": "Alternative A", "text": "deutlich anderer Schwerpunkt"},\n` +
    `    {"titel": "Alternative B", "text": "noch ein anderer Schwerpunkt"}\n` +
    `  ],\n` +
    `  "frame": {"problem": "was konkret kaputt ist, lokal und greifbar", "solution": "was jemand konkret tun oder sehen kann"},\n` +
    `  "keywords": ["drei bis sechs Suchbegriffe, nach denen die Zielgruppe wirklich sucht"]\n` +
    `}\n` +
    `Genau drei DEUTLICH verschiedene Fokus-Eintraege, damit die Wahl echt etwas aendert. ` +
    `KEINE Hooks und KEIN Skript — die kommen erst, wenn ein Fokus gewaehlt ist.` +
    kontext(card),

  // PHASE 1, Stufe 2: NUR verbale Hooks, genau zum gewaehlten Fokus.
  hooks_verbal: (card) =>
    `Wir sind in PHASE 1, STUFE 2. Der Fokus ist gewaehlt (siehe unten). ${NUR_JSON} Schema:\n` +
    `{\n` +
    `  "hooks": [\n` +
    `    {"label": "Haupt-Hook", "verbal": "hoechstens ${MASSE.hookWoerterMax} Woerter"},\n` +
    `    {"label": "Alternative 1", "verbal": "..."},\n` +
    `    {"label": "Alternative 2", "verbal": "..."}\n` +
    `  ]\n` +
    `}\n` +
    `Genau drei GESPROCHENE Einstiege, alle praezise auf den gewaehlten Fokus zugeschnitten — ` +
    `keine, die auch zu einem anderen Fokus passen wuerden. Nur der gesprochene Text, KEIN Bild, ` +
    `kein Skript.` +
    kontext(card),

  // PHASE 1, Stufe 3: NUR visuelle Hooks, passend zum gewaehlten verbalen Hook.
  hooks_visuell: (card) =>
    `Wir sind in PHASE 1, STUFE 3. Fokus UND gesprochener Hook sind gewaehlt (siehe unten). ` +
    `${NUR_JSON} Schema:\n` +
    `{\n` +
    `  "hooks": [\n` +
    `    {"label": "Haupt-Bild", "visuell": "was in Sekunde 0 bis 1 zu SEHEN ist"},\n` +
    `    {"label": "Alternative 1", "visuell": "..."},\n` +
    `    {"label": "Alternative 2", "visuell": "..."}\n` +
    `  ]\n` +
    `}\n` +
    `Genau drei SICHTBARE Einstiege, die den bereits gewaehlten gesprochenen Hook im Bild tragen ` +
    `— vier von fuenf schauen ohne Ton, das Bild muss den Hook allein stemmen. Kein Text, kein Skript.` +
    kontext(card),

  // PHASE 2a: One-Screen-Teleprompter.
  skript: (card) => {
    const pl = (card.platforms || ["instagram"])[0];
    const [min, max] = korridor(pl, card.goal);
    return (
      `Wir sind in PHASE 2 (Produktion). Schreibe den reinen Sprechertext als ` +
      `One-Screen-Teleprompter:\n` +
      `- hoechstens etwa ${MASSE.sprechzeitMax} Sekunden Sprechzeit (Hausregel, bindend),\n` +
      `- fuer ${plattformName(pl)} mit dem Ziel "${zielInfo(card.goal).name}" liegt der belegte ` +
      `Korridor bei ${min} bis ${max} Sekunden — bleib so nah wie moeglich daran, ohne die ` +
      `Hausregel zu brechen,\n` +
      `- in sehr kurze, gut ablesbare Absaetze unterteilt, jeweils markiert als [CHUNK 1], [CHUNK 2] usw.,\n` +
      `- der ERSTE Chunk ist der Hook und hat hoechstens ${MASSE.hookWoerterMax} Woerter,\n` +
      `- KEINE Regieanweisungen im Text,\n` +
      `- benenne im Verlauf das Problem UND die machbare Handlung,\n` +
      `- Schluss: genau EIN indirekt formulierter Aufruf, davor eine offene Frage an die Community. ` +
      `Bitte nicht um Likes.` +
      kontext(card)
    );
  },

  // PHASE 2a: Produktions-Unterlage.
  regieplan: (card) =>
    `Wir sind in PHASE 2 (Produktion). Erstelle die Produktions-Unterlage als Text:\n` +
    `A) VIDEO-METADATEN: Format und Laenge, Dateiname nach Konvention ` +
    `WEE_<Reihe>_EP<Episode>_<Thema>_<Format>.mp4, Musik-Prompt fuer Suno oder Udio, ` +
    `Schnitt-Rhythmus (extrem dynamisch), und ausdruecklich: Untertitel sind Pflicht, ` +
    `der Export darf KEIN Wasserzeichen anderer Plattformen tragen.\n` +
    `B) REGIEPLAN als Tabelle mit Spalten: Zeit (sekundengenau) | Typ und Location (A-Roll, ` +
    `B-Roll) | Visuell (Action am Set ODER englische Bild- und Video-Prompts) | Audio (exakter ` +
    `Sprechertext plus Geraeusche wie Whoosh, Plopp, Klick, Glitch) | Schnitt und Effekte. ` +
    `Alle drei bis sechs Sekunden ein Wechsel zwischen A-Roll und B-Roll oder der Perspektive, ` +
    `dynamische Uebergaenge (Zoom Crash, Whip Pan, Slide).\n` +
    `Plane mindestens eine Einstellung, in der die sprechende Person direkt in die Kamera ` +
    `blickt — bei NGO-Inhalten ist das belegt wirksam.\n` +
    `Format: ${card.format || "Reel"}.` +
    kontext(card),

  // PHASE 2b: Caption je Plattform, mit getrenntem Vorspann und plattformeigenen Hashtags.
  caption: (card) => {
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
    return (
      `Wir sind in PHASE 2 (Produktion). ${NUR_JSON} Schema:\n` +
      `{\n` +
      `  "varianten": [\n` +
      pls
        .map(
          (id) =>
            `    {"plattform": "${id}", "lead": "hoechstens ${MASSE.captionLeadMax} Zeichen, Kernaussage plus Suchbegriff", "body": "der Rest der Caption"}`
        )
        .join(",\n") +
      `\n  ],\n` +
      `  "keywords": ["drei bis sechs Suchbegriffe"],\n` +
      `  "hashtags": {\n` +
      pls.map((id) => `    "${id}": ["..."]`).join(",\n") +
      `\n  },\n` +
      `  "cta": {"text": "genau EIN indirekt formulierter Aufruf", "directness": "indirekt"}\n` +
      `}\n` +
      `Hashtag-Regeln je Plattform:\n${regeln}\n` +
      `Die ersten beiden Hashtags sind immer #WorldEdenEra und #ProjectOasis. Der "lead" darf ` +
      `${MASSE.captionLeadMax} Zeichen NICHT ueberschreiten — er ist der einzige garantiert ` +
      `sichtbare Teil und zugleich der Google-Ausschnitt. Bitte nicht um Likes, und setze genau ` +
      `EINEN Aufruf, nicht mehrere.` +
      kontext(card)
    );
  },

  // Nachschub: neue Ideen fuer eine Saeule, ohne das zu wiederholen, was schon da ist.
  ideen: (card) =>
    `Wir brauchen NACHSCHUB an Video-Ideen. ${NUR_JSON} Schema:\n` +
    `{"ideen": [{"titel": "kurzer Arbeitstitel", "warum": "warum das die Zielgruppe angeht", ` +
    `"hook": "hoechstens ${MASSE.hookWoerterMax} Woerter", "visuell": "was man sieht", ` +
    `"saeule": "eine von: ${SAEULEN.map((s) => s.id).join(", ")}"}]}\n` +
    `Genau ${card.anzahl || 6} Ideen. Jede muss sich von den bereits behandelten Themen deutlich ` +
    `unterscheiden.\n` +
    `Bereits behandelt (nicht wiederholen): ${
      (card.vorhandene || []).join(" | ") || "noch nichts"
    }\n` +
    `AUSDRUECKLICH VERWORFEN (auf keinen Fall vorschlagen, auch nichts Aehnliches): ${
      (card.verworfen || []).join(" | ") || "nichts"
    }\n` +
    `Gewuenschte Saeule: ${card.pillar ? saeuleName(card.pillar) : "gemischt ueber alle Saeulen"}\n` +
    `Verteilung der Saeulen bisher: ${card.verteilung || "unbekannt"}`,

  // Redaktionsplan: was in den naechsten Wochen wann laufen sollte.
  plan: (card) =>
    `Erstelle einen Redaktionsplan. ${NUR_JSON} Schema:\n` +
    `{"vorschlag": [{"datum": "YYYY-MM-DD", "titel": "...", "saeule": "...", "ziel": ` +
    `"reach_new|deepen|community|donations", "begruendung": "ein Satz"}], "hinweis": "ein Satz ` +
    `zur Gesamtlogik des Plans"}\n` +
    `Zeitraum: die naechsten ${card.wochen || 4} Wochen ab ${card.ab}. Mindestens ` +
    `${MASSE.postsProWocheMin} Veroeffentlichungen je Woche — Wochen ohne Beitrag kosten belegt ` +
    `Wachstum. Verteile die Saeulen ausgewogen und wechsle die Ziele ab: nicht jede Woche nur ` +
    `Reichweite, sondern auch Bindung und Gespraech.\n` +
    `Schon geplant (nicht doppeln): ${(card.geplant || []).join(" | ") || "nichts"}\n` +
    `Ideen, die auf Halde liegen: ${(card.vorrat || []).join(" | ") || "keine"}`,

  // Auswertung: warum lief das so? Braucht Zahlen, sonst raet es nur.
  analyse: (card) =>
    `Ein veroeffentlichtes Video soll ausgewertet werden. Antworte als kurzer Text, hoechstens ` +
    `zehn Saetze, ohne Floskeln.\n` +
    `Beantworte drei Fragen: (1) Was sagen die Zahlen im Vergleich zum eigenen Median? ` +
    `(2) Welche konkrete Eigenschaft dieses Videos erklaert das am ehesten — Hook, Laenge, ` +
    `Framing, Aufruf, Saeule? (3) Was genau sollte das naechste Video anders machen?\n` +
    `Sag ausdruecklich, wenn die Datenlage fuer eine Aussage nicht reicht. Rate nicht.\n\n` +
    `Zahlen dieses Videos: ${JSON.stringify(card.metrics || {})}\n` +
    `Eigener Median der letzten Beitraege: ${JSON.stringify(card.median || {})}\n` +
    `Hook: ${(card.hook && card.hook.text) || "-"} / visuell: ${(card.hook && card.hook.visual) || "-"}\n` +
    `Laenge: ${(card.video && card.video.seconds) || "-"} Sekunden` +
    kontext(card),
};

// Aufgaben, deren Antwort strukturiert ist.
export const JSON_AUFGABEN = new Set(["recherche", "hooks_verbal", "hooks_visuell", "caption", "ideen", "plan"]);

// Zieht JSON aus einer Antwort, auch wenn Zaeune drumstehen.
export function parseJson(text) {
  let t = (text || "").trim();
  const zaun = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (zaun) t = zaun[1].trim();
  const a = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (a >= 0 && e > a) t = t.slice(a, e + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// Ruft die lokale Claude-Code-CLI im Headless-Modus auf.
export function runClaude(prompt, { timeoutMs = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    // Auf Windows ist `claude` eine .cmd, deshalb shell:true. Der Prompt steht NICHT in den
    // Argumenten (er kommt ueber stdin), darum ist das hier unkritisch.
    // cwd bewusst auf ein neutrales Verzeichnis: sonst liest `claude` die CLAUDE.md der
    // Werkbank mit und deren Arbeitsregeln sickern in die Texte.
    const child = spawn("claude", ["-p", "--output-format", "text"], { shell: true, cwd: tmpdir() });
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
export function runClaudeStream(prompt, onDelta, { timeoutMs = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"],
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

export function hinweisZuFehler(e) {
  if (e.code === "ENOENT" || /not recognized|not found|nicht gefunden/i.test(e.message))
    return (
      "Die Claude-Code-CLI ist nicht installiert. Einmalig: `npm i -g @anthropic-ai/claude-code`, " +
      "dann `claude` starten und einloggen."
    );
  if (/nicht geantwortet/.test(e.message))
    return "Die KI hat zu lange gebraucht. Starte den Versuch erneut oder kuerze die Notizen.";
  return "Die KI-Aktion lief nicht durch. Ist `claude` installiert und eingeloggt (einmal interaktiv `claude` starten)?";
}
