// Einrichtung (v91, neu gefasst in v93) — der Assistent, der ein Board arbeitsfaehig macht.
//
// Owner 01.10.2026: Er oeffnet sich bei JEDEM Start, solange etwas fehlt, und fuehrt Schritt fuer
// Schritt durch, bis alles da ist. Die Reihenfolge folgt den Abhaengigkeiten — erst Drive verbinden,
// dann den Projektordner waehlen, dann alles, was in diesem Ordner gespeichert wird; Google Kalender
// am Schluss. Jeder Prompt kommt mit einem Vorschlag, den man uebernimmt oder anpasst; Firmen- und
// Projektkontext haben bewusst keinen Vorschlag. Plan: docs/packages/v93-onboarding-logisch-und-default-prompts.md
//
// Jeder Schritt hat pruefe(stand) → { fehlt, gesperrt } und baue(el, ctx). Der Stand wird vor dem
// Start und nach jedem Schritt frisch gelesen, damit „fehlt" immer der Wirklichkeit entspricht.

import { rolleKonfig } from "./store.js";
import { knopf, eingabe, textfeld, escape, sanduhr, modalX } from "./ui.js";
import { zeigeRedaktionsplan } from "./redaktionsplan.js";

const MERKER = "cm-einrichtung-schritt"; // Rueckkehr nach Google-Anmeldung oder Ordnerwechsel (Neuladen)

// v94 (Owner 01.10.2026): Eingaben landen erst im ENTWURF (Browser-Zwischenspeicher) — „Weiter" ist sofort.
// Am Ende schreibt „Speichern und loslegen" alles in einem Durchgang nach Drive, mit Log je Teil.
// Form: { name?, nameBestaetigt?, kiRollen?, firma?, prompts?: {id: wert}, promptsBestaetigt?: {id: true}, planBestaetigt? }
const ENTWURF = "cm-einrichtung-entwurf";
export function leseEntwurf() {
  try { return JSON.parse(localStorage.getItem(ENTWURF) || "{}") || {}; } catch { return {}; }
}
function setzeEntwurf(teil) {
  const e = { ...leseEntwurf(), ...teil };
  try { localStorage.setItem(ENTWURF, JSON.stringify(e)); } catch {}
  return e;
}
function entwurfOhne(keys) {
  const e = leseEntwurf();
  for (const k of keys) delete e[k];
  try {
    if (Object.keys(e).length) localStorage.setItem(ENTWURF, JSON.stringify(e));
    else localStorage.removeItem(ENTWURF);
  } catch {}
}
const entwurfTeile = (e = leseEntwurf()) => [
  e.name ? `Name „${e.name}“` : null,
  e.kiRollen ? "KI-Rollen" : null,
  typeof e.firma === "string" ? "Firmenkontext" : null,
  e.prompts && Object.keys(e.prompts).length ? `${Object.keys(e.prompts).length} ${Object.keys(e.prompts).length === 1 ? "geänderter Prompt" : "geänderte Prompts"}` : null,
  e.promptsBestaetigt && Object.keys(e.promptsBestaetigt).length ? `${Object.keys(e.promptsBestaetigt).length} ${Object.keys(e.promptsBestaetigt).length === 1 ? "Prompt" : "Prompts"} bestätigt` : null,
  e.planBestaetigt ? "Redaktionsplan bestätigt" : null,
].filter(Boolean);

// Gespeicherter Stand + Entwurf = was der Assistent als erledigt zaehlt.
function wirksam(st) {
  const e = leseEntwurf();
  const defaults = { ...(st.defaults || {}) };
  if (e.nameBestaetigt) defaults.nameBestaetigt = true;
  if (e.kiRollen) defaults.kiRollen = e.kiRollen;
  if (e.planBestaetigt) defaults.planBestaetigt = true;
  if (e.promptsBestaetigt) defaults.promptsBestaetigt = { ...(defaults.promptsBestaetigt || {}), ...e.promptsBestaetigt };
  const kontext = typeof e.firma === "string" ? { ...st.kontext, firma: { ...((st.kontext || {}).firma || {}), text: e.firma } } : st.kontext;
  const name = e.name ? { ...st.name, name: e.name } : st.name;
  return { ...st, defaults, kontext, name };
}

const EMPFEHLUNG = {
  recherche: { modell: "deepseek-r1:14b", warum: "denkt gruendlich nach, bevor es antwortet — gut fuer Recherche, dafuer langsamer" },
  kontext: { modell: "qwen2.5:14b", warum: "schnell und genau beim Abgleichen von Texten mit dem Firmenkontext" },
};

// Reihenfolge = Ablauf einer Karte; jeder Prompt baut auf dem vorigen auf.
const PROMPT_REIHE = [
  ["system", "Gilt fuer JEDEN Text, den die KI fuer dich schreibt: Rolle, Arbeitsweise, Hausregeln, belegte Praxis. Marke und Zielgruppe kommen aus dem Firmenkontext."],
  ["ideen", "Anfang der Kette: „Idee von der KI“ schlaegt Themen vor, passend zu Kategorie, Zielgruppe und freien Upload-Slots."],
  ["recherche", "Schritt 1 einer Karte: sucht im Web, zieht belastbare Fakten heraus und schlaegt drei Blickwinkel (Fokus) vor."],
  ["hooks_verbal", "Schritt 2: drei gesprochene Einstiege genau zum gewaehlten Fokus."],
  ["hooks_visuell", "Schritt 3: drei Bild-Einstiege, die den gewaehlten Hook ohne Ton tragen."],
  ["skript", "Schritt 4: Sprechertext aus Fokus, Fakten und Hook — als Teleprompter in Abschnitten."],
  ["regieplan", "Aus dem Skript: Drehplan mit Einstellungen, Bild, Ton und Schnitt."],
  ["caption", "Letzter Text-Schritt: Caption je Plattform, ergaenzt das Video statt es zu wiederholen."],
  ["plan", "Redaktionsplan: Upload-Slots mit Format, Kategorie und Ziel fuer die naechsten Wochen."],
  ["analyse", "Nach dem Upload: wertet die Zahlen gegen den eigenen Median aus und sagt, was das naechste Stueck anders macht."],
  ["slider_aufbau", "Format Slider, Schritt 1: Text je Slide."],
  ["slider_visual", "Format Slider, Schritt 2: Bild je Slide, auf Basis von Schritt 1."],
  ["beitrag_visual", "Format Beitrag: Text plus ein Bild-Konzept."],
  ["story_frames", "Format Story: Frames mit Medium, Text und Sticker."],
  ["langform_konzept", "Format Langvideo: Storytelling-Konzept mit Kapiteln."],
];

const FIRMA_FRAGEN = [
  ["wer", "Wer seid ihr?", "Name, Rechtsform, seit wann, wo — in zwei, drei Saetzen."],
  ["wofuer", "Wofuer steht ihr?", "Mission und die zwei, drei Themen, ueber die ihr sprecht."],
  ["wen", "Wen wollt ihr erreichen?", "Zielgruppe: Alter, Interessen, was sie von euch brauchen."],
  ["ton", "Wie klingt ihr?", "Tonalitaet: duzen/siezen, locker/sachlich, Humor ja/nein, typische Woerter."],
  ["nogos", "Was nie?", "No-Gos: Themen, Woerter, Behauptungen, die nicht vorkommen duerfen."],
  ["cta", "Was soll man tun?", "Handlungsaufrufe: folgen, spenden, mitmachen — mit Link, falls es einen gibt. Marken-Hashtags hier nennen."],
];

const holeJson = async (url, opt) => (await fetch(url, opt)).json();
const sende = (url, methode, body) =>
  fetch(url, { method: methode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const putJson = (url, body) => sende(url, "PUT", body);
const postJson = (url, body) => sende(url, "POST", body);

// --- Stand lesen -------------------------------------------------------------

export async function leseStand() {
  const sicher = (p, leer = {}) => p.catch(() => leer);
  const [driveE, verb, ollama, defaults, name] = await Promise.all([
    sicher(holeJson("/api/drive/einrichtung")),
    sicher(holeJson("/api/verbindungen/status")),
    sicher(holeJson("/api/ai/ollama"), { laeuft: false, modelle: [] }),
    sicher(holeJson("/api/defaults")),
    sicher(holeJson("/api/board/name")),
  ]);
  const ordnerOk = !!(driveE.root && driveE.erreichbar);
  // Was im Ordner liegt, nur lesen, wenn der Ordner erreichbar ist (sonst haengen die Aufrufe).
  const [kontext, prompts, plan] = ordnerOk
    ? await Promise.all([sicher(holeJson("/api/kontext")), sicher(holeJson("/api/prompts")), sicher(holeJson("/api/plan"))])
    : [{}, {}, {}];
  return { drive: driveE, verb, ollama, defaults, name, kontext, prompts, plan, ordnerOk };
}

const bestaetigtePrompts = (st) => (st.defaults && st.defaults.promptsBestaetigt) || {};
// v96 (Owner 01.10.2026): erledigt ist ein Prompt, wenn sein Vorschlag einmal bestaetigt wurde ODER es eine eigene
// Fassung gibt — nur dann kommt der Assistent nach einer sauberen Einrichtung nicht wieder.
const hatEigenePrompt = (st, id) =>
  id === "system" ? !!(st.prompts.system && st.prompts.system.eigen) : !!((st.prompts.aufgaben || []).find((a) => a.id === id) || {}).eigen;
const offenePrompts = (st) => {
  const ids = new Set((st.prompts.aufgaben || []).map((a) => a.id));
  return PROMPT_REIHE.filter(([id]) => (id === "system" || ids.has(id)) && !bestaetigtePrompts(st)[id] && !hatEigenePrompt(st, id));
};
// Rollen: im Board gespeichert ODER schon einmal in Einstellungen → KI-Rollen gewaehlt (Browser-Speicher).
const hatEigeneRollen = () => {
  try { return Object.keys(localStorage).some((k) => k.startsWith("cm-rolle-")); } catch { return false; }
};
// v103: Welche Rollen-Verteilung gilt (gespeichert, Entwurf oder Browser)? null = noch nichts gewaehlt.
const ROLLEN_IDS = ["userkomm", "recherche", "kontext"];
const effRollen = (st) => (st.defaults && st.defaults.kiRollen) || (hatEigeneRollen() ? Object.fromEntries(ROLLEN_IDS.map((r) => [r, rolleKonfig(r)])) : null);
// Braucht die gewaehlte Verteilung diesen Anbieter? Ohne Wahl gilt der Standard-Weg (Claude + lokal).
const nutzt = (st, provider) => {
  const r = effRollen(st);
  return r ? Object.values(r).some((x) => x && x.provider === provider) : provider === "claude" || provider === "ollama";
};
const modellDa = (st, m) => (st.ollama.modelle || []).some((x) => x.name === m || x.name.startsWith(m + ":"));

// --- Schritte (Reihenfolge = Abhaengigkeiten) ---------------------------------

const OHNE_ORDNER = "Braucht zuerst einen Projektordner (Schritt „Projektordner wählen“).";

const SCHRITTE = [
  {
    id: "drive",
    titel: "Google Drive verbinden",
    satz: "Das Board speichert alles in einem Google-Drive-Ordner. Dafür braucht es eine Verbindung zu deinem Drive-Konto (über das Programm rclone).",
    pruefe: (st) => ({ fehlt: !st.drive.rclone || !st.drive.verbindung || (!!st.drive.root && !st.drive.erreichbar) }),
    baue: baueDrive,
    // v94: nach „Weiter" nur das neu pruefen, was dieser Schritt aendern kann — nicht den ganzen Stand.
    nachpruefen: async (st) => {
      st.drive = await holeJson("/api/drive/einrichtung");
      st.ordnerOk = !!(st.drive.root && st.drive.erreichbar);
    },
  },
  {
    id: "ordner",
    titel: "Projektordner wählen",
    satz: "Ein Board = ein Drive-Ordner. Ein leerer Ordner bekommt die Board-Struktur; ein Ordner mit vorhandenem Board wird geladen.",
    pruefe: (st) => ({ gesperrt: !st.drive.verbindung ? "Braucht zuerst die Drive-Verbindung." : null, fehlt: !st.ordnerOk }),
    baue: baueOrdner,
  },
  {
    id: "name",
    titel: "Wie heißt dieses Board?",
    satz: "Der Name ist der Name des Drive-Ordners — beides ist dasselbe. Er steht oben links und im Browser-Tab.",
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !st.defaults.nameBestaetigt && !(st.name && st.name.name) }),
    baue: baueName,
  },
  {
    id: "kiweg",
    titel: "Wie soll die KI laufen?",
    satz: "Wähle den Weg: Claude oder ChatGPT für die Texte und lokal (kostenlos) für Recherche und Abgleich — oder alles in der Cloud bzw. alles lokal. Danach fragt die Einrichtung nur noch, was dieser Weg braucht.",
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !st.defaults.kiRollen && !hatEigeneRollen() }),
    baue: baueKiWeg,
  },
  {
    id: "claude",
    titel: "Claude anmelden",
    satz: "Claude schreibt die Texte, die du später siehst (Hooks, Skript, Caption) — über dein Claude-Abo auf diesem Rechner, ohne API-Kosten.",
    // v103: nur gefragt, wenn eine Rolle Claude nutzt (Weg „ChatGPT" oder „nur lokal" braucht es nicht).
    pruefe: (st) => ({ fehlt: nutzt(st, "claude") && !(st.verb.claude && st.verb.claude.verbunden) }),
    baue: baueClaude,
    nachpruefen: async (st) => {
      const c = await holeJson("/api/auth/claude/status");
      st.verb = { ...st.verb, claude: { ...(st.verb.claude || {}), verbunden: !!c.loggedIn, email: c.email || "" } };
    },
  },
  {
    id: "chatgpt",
    titel: "ChatGPT anmelden",
    satz: "ChatGPT schreibt die Texte über die Codex-CLI von OpenAI auf diesem Rechner — mit deinem ChatGPT-Konto oder einem eigenen API-Schlüssel.",
    pruefe: (st) => ({ fehlt: nutzt(st, "codex") && !(st.verb.chatgpt && st.verb.chatgpt.verbunden) }),
    baue: baueChatgpt,
    nachpruefen: async (st) => {
      const c = await holeJson("/api/auth/chatgpt/status");
      st.verb = { ...st.verb, chatgpt: { ...(st.verb.chatgpt || {}), verbunden: !!c.loggedIn, installiert: c.installiert, art: c.art } };
    },
  },
  {
    id: "ollama",
    titel: "Lokale KI (Ollama)",
    satz: "Recherche und Kontextabgleich laufen kostenlos auf diesem Rechner. Dafür braucht es Ollama und die passenden Modelle.",
    pruefe: (st) => {
      const rollen = st.defaults.kiRollen || (hatEigeneRollen() ? Object.fromEntries(["userkomm", "recherche", "kontext"].map((r) => [r, rolleKonfig(r)])) : null);
      const lokal = rollen
        ? Object.values(rollen).filter((r) => r && r.provider === "ollama")
        : Object.values(EMPFEHLUNG).map((e) => ({ ollamaModel: e.modell }));
      return { fehlt: lokal.length > 0 && (!st.ollama.laeuft || lokal.some((r) => !modellDa(st, r.ollamaModel))) };
    },
    baue: baueOllama,
    nachpruefen: async (st) => { st.ollama = await holeJson("/api/ai/ollama"); },
  },
  {
    id: "firma",
    titel: "Wer seid ihr? (Firmenkontext)",
    satz: "Diese Angaben gehen in jeden Text der KI — Marke, Zielgruppe, Ton. Hier gibt es keinen Vorschlag: das weißt nur ihr.",
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !(st.kontext.firma && st.kontext.firma.text && st.kontext.firma.text.trim()) }),
    baue: baueFirma,
  },
  {
    id: "prompts",
    titel: "System-Prompts",
    satz: "Jeder KI-Knopf hat einen Prompt. Zu jedem gibt es einen Vorschlag — übernehmen oder anpassen. Die Reihenfolge folgt dem Ablauf einer Karte.",
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: st.ordnerOk && offenePrompts(st).length > 0 }),
    baue: bauePrompts,
  },
  {
    id: "plan",
    titel: "Redaktionsplan",
    satz: "Wie oft soll was erscheinen? Danach richten sich die vorgeschlagenen Upload-Termine und die Wochenprüfung oben im Board.",
    // Plan: bestaetigt ODER vom Standard abweichend (= eigene Eingabe; /api/plan liefert istStandard).
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !st.defaults.planBestaetigt && !(st.plan && st.plan.istStandard === false) }),
    baue: bauePlan,
  },
  {
    id: "google",
    titel: "Google Kalender + Tasks verbinden",
    satz: "Das Board trägt jeden Drehtermin als Termin in deinen Google-Kalender und als Aufgabe in Google Tasks ein. Es liest nichts zurück.",
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !(st.verb.google && st.verb.google.zustand === "live") }),
    baue: baueGoogle,
    nachpruefen: async (st) => { st.verb = await holeJson("/api/verbindungen/status"); },
  },
];

// Welche Schritte sind offen? (Stand + Entwurf)
export function offeneSchritte(st) {
  const w = wirksam(st);
  return SCHRITTE.map((s) => ({ s, ...s.pruefe(w) })).filter((x) => x.fehlt || x.gesperrt);
}

// Beim Start: Stand lesen; fehlt etwas ODER liegt ein ungespeicherter Entwurf vor, Assistent oeffnen.
// --- Start-Tor (v101) -----------------------------------------------------------
//
// Owner 01.10.2026: Vor der Entscheidung „eingerichtet oder nicht" darf das Board nicht bedienbar sein. Zuerst werden
// zwei kleine Status-Dateien gelesen (Board-Ordner in Drive + Anbindungen dieses Rechners); stehen beide auf fertig,
// startet das Board sofort — ohne den vollen Pruef-Lauf. Sonst bleibt die Sperre, bis der Assistent offen ist.
// Plan: docs/packages/v101-start-tor-einrichtungsstand.md
const LOKALE_SCHRITTE = new Set(["drive", "ordner", "claude", "chatgpt", "ollama", "google"]);

function zeigeSperre(text) {
  const el = document.createElement("div");
  el.className = "start-sperre";
  const box = document.createElement("div");
  box.className = "start-sperre-box";
  box.appendChild(sanduhr(text));
  el.appendChild(box);
  document.body.appendChild(el);
  return {
    text: (t) => { box.innerHTML = ""; box.appendChild(sanduhr(t)); },
    weg: () => el.remove(),
  };
}

// Schreibt den echten Stand in beide Status-Dateien (Board-Schritte nach Drive, Anbindungen lokal).
export async function schreibeStand(st) {
  const offen = offeneSchritte(st).map((x) => x.s.id);
  const lokalOffen = offen.filter((id) => LOKALE_SCHRITTE.has(id));
  const boardOffen = offen.filter((id) => !LOKALE_SCHRITTE.has(id));
  await postJson("/api/einrichtung/stand", {
    lokal: { fertig: lokalOffen.length === 0, offen: lokalOffen },
    board: st.ordnerOk ? { fertig: boardOffen.length === 0, offen: boardOffen } : undefined,
  }).catch(() => {});
}

export async function startTor() {
  const sperre = zeigeSperre("Board wird vorbereitet …");
  try {
    let merker = null;
    try { merker = localStorage.getItem(MERKER); } catch {}
    const stand = await holeJson("/api/einrichtung/stand").catch(() => ({}));
    const fertig = stand.lokal && stand.lokal.fertig && stand.board && stand.board.fertig;
    if (fertig && merker === null && !entwurfTeile().length) { sperre.weg(); return; }

    sperre.text("Prüfe die Einrichtung …");
    const st = await leseStand();
    if (merker === null && !offeneSchritte(st).length && !entwurfTeile().length) {
      await schreibeStand(st); // alles da (z. B. erster Start mit v101) -> Status-Dateien anlegen
      sperre.weg();
      return;
    }
    await starteEinrichtung(st); // der Assistent liegt jetzt selbst ueber dem Board
    sperre.weg();
  } catch {
    sperre.weg(); // nie ein dauerhaft gesperrtes Board
  }
}

// Alt-Name (v93) — wird vom Start nicht mehr genutzt, bleibt fuer andere Aufrufer gleichbedeutend.
export const einrichtungBeimStart = startTor;

// --- Assistent ---------------------------------------------------------------

export async function starteEinrichtung(stand = null) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal einrichtung-modal";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const kopf = document.createElement("div");
  kopf.className = "einr-kopf";
  const leiste = document.createElement("div");
  leiste.className = "einr-leiste";
  const inhalt = document.createElement("div");
  inhalt.className = "einr-inhalt";
  const fuss = document.createElement("div");
  fuss.className = "einr-fuss";
  box.append(kopf, leiste, inhalt, fuss);

  const spaeter = new Set(); // in DIESER Sitzung uebersprungen
  let st = stand;
  let weiterAktion = null;
  const eff = () => wirksam(st);
  const schliessen = () => {
    try { localStorage.removeItem(MERKER); } catch {}
    overlay.remove();
  };
  // Schliessen = fuer diese Sitzung; der Entwurf bleibt erhalten, beim naechsten Start geht es weiter.
  box.appendChild(modalX(() => schliessen(), "Für diese Sitzung schließen — Eingaben bleiben im Entwurf, beim nächsten Start geht es weiter"));

  async function neuLesen(text = "Prüfe, was schon eingerichtet ist …") {
    inhalt.innerHTML = "";
    inhalt.appendChild(sanduhr(text));
    fuss.innerHTML = "";
    st = await leseStand();
  }

  // Naechster offener, nicht gesperrter, nicht uebersprungener Schritt ab Index `ab`.
  function naechster(ab = 0) {
    const w = eff();
    for (let i = ab; i < SCHRITTE.length; i++) {
      const p = SCHRITTE[i].pruefe(w);
      if (p.fehlt && !p.gesperrt && !spaeter.has(SCHRITTE[i].id)) return i;
    }
    return -1;
  }

  function zeichneLeiste(aktiv) {
    const w = eff();
    leiste.innerHTML = SCHRITTE.map((x, j) => {
      const p = x.pruefe(w);
      const art = j === aktiv ? "aktiv" : p.gesperrt ? "gesperrt" : !p.fehlt ? "ok" : spaeter.has(x.id) ? "weg" : "";
      const titel = `${x.titel}${p.gesperrt ? ` — ${p.gesperrt}` : !p.fehlt ? " — erledigt" : ""}`;
      return `<span class="einr-punkt ${art}" title="${escape(titel)}"></span>`;
    }).join("");
  }

  // Links in der Fusszeile: was im Entwurf liegt (noch nicht in Drive).
  function entwurfHinweis() {
    const t = entwurfTeile();
    const d = document.createElement("div");
    d.className = "einr-entwurf";
    d.textContent = t.length ? `Im Entwurf: ${t.join(" · ")} — wird am Ende gespeichert` : "";
    return d;
  }

  async function zeige(i) {
    if (i < 0) return zeigeAbschluss();
    const s = SCHRITTE[i];
    try { localStorage.setItem(MERKER, s.id); } catch {}
    const w = eff();
    const offen = SCHRITTE.filter((x) => x.pruefe(w).fehlt).length;
    kopf.innerHTML =
      `<div class="einr-zaehler">Einrichtung · Schritt ${i + 1} von ${SCHRITTE.length} · noch ${offen} offen</div>` +
      `<div class="einr-titel">${escape(s.titel)}</div>` +
      `<p class="einr-satz">${escape(s.satz)}</p>`;
    zeichneLeiste(i);
    inhalt.innerHTML = "";
    weiterAktion = null;
    s.baue(inhalt, { st: w, setzeWeiter: (f) => (weiterAktion = f), schliessen });

    fuss.innerHTML = "";
    fuss.appendChild(entwurfHinweis());
    const rechts = document.createElement("div");
    rechts.className = "einr-fuss-rechts";
    rechts.appendChild(knopf("Später", {
      titel: "Diesen Schritt jetzt überspringen — beim nächsten Start wird wieder gefragt",
      klick: () => { spaeter.add(s.id); zeige(naechster(i + 1) >= 0 ? naechster(i + 1) : naechster(0)); },
    }));
    rechts.appendChild(knopf("Weiter", {
      art: "haupt",
      klick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          const ok = weiterAktion ? await weiterAktion() : true;
          if (ok === false) return;
          // Live-Schritte (Drive, Claude, Ollama, Google) pruefen nur sich selbst, sichtbar am Knopf.
          if (s.nachpruefen) {
            b.textContent = "Prüfe …";
            await s.nachpruefen(st).catch(() => {});
          }
          const nochOffen = s.pruefe(eff()).fehlt && !spaeter.has(s.id);
          zeige(nochOffen ? i : naechster(0));
        } finally { b.disabled = false; }
      },
    }));
    fuss.appendChild(rechts);
  }

  // altLog: das Speicher-Log des gerade gelaufenen Durchgangs bleibt nach dem Neuzeichnen stehen.
  function zeigeAbschluss(altLog = null) {
    try { localStorage.removeItem(MERKER); } catch {}
    zeichneLeiste(-1);
    // v101: Stand festhalten (Drive + lokal), sobald nichts mehr im Entwurf liegt — beim naechsten Start entscheidet
    // das Start-Tor dann ohne vollen Pruef-Lauf.
    if (!entwurfTeile().length) schreibeStand(st);
    const w = eff();
    const offen = offeneSchritte(st);
    const teile = entwurfTeile();
    kopf.innerHTML =
      `<div class="einr-zaehler">Einrichtung · Stand</div>` +
      `<div class="einr-titel">${teile.length ? "Speichern und loslegen" : offen.length ? "Fast fertig" : "Alles eingerichtet"}</div>` +
      `<p class="einr-satz">${teile.length
        ? "Deine Eingaben liegen noch im Entwurf. Ein Klick schreibt sie nacheinander nach Drive — das Log zeigt jeden Teil."
        : offen.length ? "Übersprungenes fragt der Assistent beim nächsten Start wieder ab." : "Das Board ist vollständig eingerichtet."}</p>`;
    inhalt.innerHTML = "";
    const zeilen = SCHRITTE.map((s) => {
      const p = s.pruefe(w);
      const erledigt = !p.fehlt && !p.gesperrt;
      const grund = p.gesperrt ? ` — ${p.gesperrt}` : p.fehlt ? " — noch offen" : "";
      return `<li class="${erledigt ? "ok" : "weg"}">${erledigt ? "✓" : "○"} ${escape(s.titel)}${escape(grund)}</li>`;
    });
    inhalt.appendChild(absatz(`<ul class="einr-liste">${zeilen.join("")}</ul>`));
    const log = altLog || document.createElement("div");
    log.className = "einr-log";
    log.hidden = !altLog;
    inhalt.appendChild(log);

    fuss.innerHTML = "";
    fuss.appendChild(entwurfHinweis());
    const rechts = document.createElement("div");
    rechts.className = "einr-fuss-rechts";
    if (teile.length) {
      const sp = knopf("Speichern und loslegen", {
        art: "haupt",
        klick: async () => {
          sp.disabled = true;
          sp.textContent = "Speichert …";
          const alleOk = await speichereEntwurf(st, log, offen.length === 0);
          if (alleOk) {
            await neuLesen("Lese den gespeicherten Stand aus Drive …");
            zeigeAbschluss(log); // das Log bleibt sichtbar
          } else {
            sp.disabled = false;
            sp.textContent = "Fehlgeschlagenes erneut speichern";
            fuss.replaceChild(entwurfHinweis(), fuss.firstChild); // Hinweis zeigt nur noch, was offen ist
          }
        },
      });
      rechts.appendChild(sp);
    } else {
      rechts.appendChild(knopf(offen.length ? "Schließen" : "Loslegen", { art: "haupt", klick: () => schliessen() }));
    }
    fuss.appendChild(rechts);
  }

  if (!st) await neuLesen();
  // Rueckkehr (Merker): dort weitermachen, falls der Schritt noch offen ist.
  let merker = null;
  try { merker = localStorage.getItem(MERKER); } catch {}
  const mi = SCHRITTE.findIndex((s) => s.id === merker);
  const w0 = eff();
  const start = mi >= 0 && SCHRITTE[mi].pruefe(w0).fehlt && !SCHRITTE[mi].pruefe(w0).gesperrt ? mi : naechster(0);
  zeige(start);
  return { schliessen };
}

// Schreibt den Entwurf in EINEM Durchgang nach Drive und fuehrt das Log. Erfolgreiche Teile verlassen
// den Entwurf; fehlgeschlagene bleiben drin und lassen sich erneut speichern. Liefert true, wenn alles ging.
async function speichereEntwurf(st, log, fertig) {
  if (!Object.keys(leseEntwurf().prompts || {}).length) entwurfOhne(["prompts"]); // leere Reste weg
  const e = leseEntwurf();
  log.hidden = false;
  log.innerHTML = `<div class="einr-log-kopf">Speicher-Log</div>`;
  const zeilen = {};
  const zeile = (teil) => {
    if (!zeilen[teil]) {
      zeilen[teil] = document.createElement("div");
      zeilen[teil].className = "einr-log-zeile";
      log.appendChild(zeilen[teil]);
    }
    return zeilen[teil];
  };
  const bestaetigt = { ...((st.defaults || {}).promptsBestaetigt || {}), ...(e.promptsBestaetigt || {}) };
  const body = {
    name: e.name && e.name !== (st.name || {}).name ? e.name : undefined,
    firma: e.firma,
    prompts: Object.entries(e.prompts || {}).map(([id, value]) => ({ id, value })),
    nameBestaetigt: e.nameBestaetigt,
    kiRollen: e.kiRollen,
    promptsBestaetigt: e.promptsBestaetigt ? bestaetigt : undefined,
    planBestaetigt: e.planBestaetigt,
    einrichtungFertig: fertig || undefined,
  };
  // Welche Entwurfs-Felder ein erfolgreicher Teil erledigt.
  const ERLEDIGT = {
    name: ["name"],
    firma: ["firma"],
    prompts: ["prompts"],
    einstellungen: ["nameBestaetigt", "kiRollen", "promptsBestaetigt", "planBestaetigt"],
  };
  let alleOk = true;
  try {
    const res = await fetch("/api/einrichtung/speichern", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let puffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      puffer += dec.decode(value, { stream: true });
      let nl;
      while ((nl = puffer.indexOf("\n")) >= 0) {
        const z = puffer.slice(0, nl).trim();
        puffer = puffer.slice(nl + 1);
        if (!z) continue;
        let o;
        try { o = JSON.parse(z); } catch { continue; }
        if (o.teil === "ende") continue;
        const el = zeile(o.teil);
        if (o.status === "laeuft") {
          el.innerHTML = "";
          el.appendChild(sanduhr(`${o.text} …`, { klein: true }));
        } else if (o.status === "ok") {
          el.innerHTML = `<span class="einr-log-ok">✓</span> ${escape(o.text)} <span class="einr-log-zeit">${(o.ms / 1000).toFixed(1)} s</span>`;
          entwurfOhne(ERLEDIGT[o.teil] || []);
          if (o.teil === "einstellungen" && e.kiRollen)
            for (const [r, v] of Object.entries(e.kiRollen)) { try { localStorage.setItem(`cm-rolle-${r}`, JSON.stringify(v)); } catch {} }
          if (o.teil === "name") window.dispatchEvent(new CustomEvent("board-name", { detail: e.name }));
        } else {
          alleOk = false;
          el.innerHTML = `<span class="einr-log-fehler">✗</span> ${escape(o.text)} — ${escape(o.fehler || "fehlgeschlagen")}`;
        }
      }
    }
  } catch (err) {
    alleOk = false;
    zeile("netz").innerHTML = `<span class="einr-log-fehler">✗</span> Verbindung zum Board abgebrochen: ${escape(err.message)}`;
  }
  return alleOk;
}

// --- Bausteine ---------------------------------------------------------------

function absatz(html, klasse = "einr-text") {
  const p = document.createElement("p");
  p.className = klasse;
  p.innerHTML = html;
  return p;
}

function feldBlock(label, el, hilfe = "") {
  const w = document.createElement("label");
  w.className = "einr-feld";
  w.innerHTML = `<span class="einr-feld-label">${escape(label)}</span>` + (hilfe ? `<span class="einr-feld-hilfe">${escape(hilfe)}</span>` : "");
  w.appendChild(el);
  return w;
}

function statusZeile(text, art) {
  const d = document.createElement("div");
  d.className = "einr-status";
  d.innerHTML = `<span class="chip ${art === "ok" ? "chip-ok" : art === "hinweis" ? "chip-hinweis" : "chip-fehlt"}">${escape(text)}</span>`;
  return d;
}

// Fragt eine laufende Hintergrund-Anmeldung ab, bis sie fertig ist.
function warteAuf(url, info, fertig) {
  const t = setInterval(async () => {
    try {
      const s = await holeJson(url);
      info.textContent = s.satz || "";
      if (!s.laeuft) { clearInterval(t); fertig(s.ergebnis === "ok"); }
    } catch { /* naechster Versuch */ }
  }, 2000);
}

// --- Schritt-Inhalte ---------------------------------------------------------

function baueDrive(el, { st }) {
  const d = st.drive;
  if (!d.rclone) {
    el.appendChild(statusZeile("rclone fehlt", "fehlt"));
    el.appendChild(absatz("Das Board spricht über das Programm <b>rclone</b> mit Google Drive. Installieren (einmalig): im Terminal " +
      "<code>winget install Rclone.Rclone</code>, danach das Board neu starten."));
    return;
  }
  const info = absatz("", "einr-feld-hilfe");
  if (d.verbindung) {
    el.appendChild(statusZeile(d.root && !d.erreichbar ? "Anmeldung abgelaufen" : "verbunden", d.root && !d.erreichbar ? "hinweis" : "ok"));
    el.appendChild(absatz("Die Drive-Verbindung ist eingerichtet, Google lässt den Zugriff aber gerade nicht zu. Neu anmelden — im Browser öffnet sich der Google-Login."));
    el.appendChild(knopf("Bei Google neu anmelden", {
      art: "haupt",
      klick: async (e) => {
        e.currentTarget.disabled = true;
        await postJson("/api/drive/konto/wechseln", {});
        warteAuf("/api/drive/konto/wechseln", info, () => {});
      },
    }));
    el.appendChild(info);
    return;
  }
  el.appendChild(statusZeile("nicht verbunden", "hinweis"));
  el.appendChild(absatz(
    "Einmalig braucht das Board eine eigene Google-Cloud-App für Drive:<br>" +
    "1. <b>console.cloud.google.com</b> → Projekt anlegen → <i>Google Drive API</i> aktivieren.<br>" +
    "2. Credentials → OAuth client ID → Typ <b>Desktop app</b>.<br>" +
    "3. Client-ID und Client-Secret hier eintragen → „Verbinden“ öffnet den Google-Login im Browser."));
  const id = eingabe("", { platzhalter: "Client-ID (…apps.googleusercontent.com)" });
  const geheim = eingabe("", { typ: "password", platzhalter: "Client-Secret" });
  el.appendChild(feldBlock("Client-ID", id));
  el.appendChild(feldBlock("Client-Secret", geheim, "Bleibt in der rclone-Konfiguration auf diesem Rechner — nicht in Drive, nicht auf GitHub."));
  el.appendChild(knopf("Verbinden", {
    art: "haupt",
    klick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      const r = await postJson("/api/drive/konto/wechseln", { clientId: id.value.trim(), clientSecret: geheim.value.trim() });
      if (!r.ok) { info.textContent = (await r.json()).error || "Start fehlgeschlagen."; b.disabled = false; return; }
      warteAuf("/api/drive/konto/wechseln", info, (ok) => { if (!ok) b.disabled = false; else info.textContent = "Verbunden. Weiter mit „Weiter“."; });
    },
  }));
  el.appendChild(info);
}

function baueOrdner(el, { st, setzeWeiter }) {
  if (st.ordnerOk) {
    el.appendChild(statusZeile(`Ordner gesetzt: ${st.name.name || st.drive.root}`, "ok"));
    return;
  }
  el.appendChild(absatz(
    "Lege in Google Drive einen <b>leeren Ordner</b> an (sein Name wird der Name des Boards) oder nimm einen Ordner, " +
    "in dem schon ein Board liegt. Öffne ihn in Drive und kopiere den Link aus der Adresszeile."));
  const link = eingabe("", { platzhalter: "https://drive.google.com/drive/folders/…" });
  el.appendChild(feldBlock("Link des Drive-Ordners", link));
  const info = absatz("", "einr-text");
  el.appendChild(info);
  setzeWeiter(async () => {
    if (!link.value.trim()) { info.textContent = "Bitte zuerst den Link einfügen."; return false; }
    info.textContent = "Prüfe den Ordner …";
    const p = await (await postJson("/api/drive/ordner/pruefen", { eingabe: link.value })).json().catch(() => ({}));
    if (!p.ok) { info.textContent = p.satz || p.error || "Der Ordner lässt sich nicht verwenden."; return false; }
    info.textContent = `${p.satz} Richte ein … (kann eine Minute dauern)`;
    const r = await postJson("/api/drive/ordner/setzen", { eingabe: link.value });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { info.textContent = j.satz || j.error || "Wechsel fehlgeschlagen."; return false; }
    // Das Board laedt mit dem neuen Ordner neu; der Assistent macht beim Start hier weiter.
    try { localStorage.setItem(MERKER, "name"); localStorage.removeItem("cm-board-name"); } catch {}
    location.reload();
    return false;
  });
}

function baueName(el, { st, setzeWeiter }) {
  const name = eingabe(st.name.name || "", { platzhalter: "z. B. Gartenwerk – Social Media" });
  el.appendChild(feldBlock("Name", name, "Ändern benennt den Ordner in Google Drive um."));
  if (st.name.fehler) el.appendChild(absatz(`Drive-Name nicht lesbar: ${escape(st.name.fehler)}`, "einr-warn"));
  // v94: nur in den Entwurf — das Umbenennen in Drive passiert beim Speichern am Ende.
  setzeWeiter(async () => {
    const neu = name.value.trim();
    setzeEntwurf({ nameBestaetigt: true, ...(neu ? { name: neu } : {}) });
    return true;
  });
}

function baueClaude(el) {
  el.appendChild(statusZeile("nicht angemeldet", "hinweis"));
  const schritt = document.createElement("div");
  const code = eingabe("", { platzhalter: "Code von claude.com hier einfügen" });
  const info = absatz("", "einr-text");
  el.appendChild(knopf("Anmeldung starten", {
    art: "haupt",
    klick: async () => {
      schritt.innerHTML = "";
      schritt.appendChild(sanduhr("Starte die Claude-Anmeldung …"));
      const r = await holeJson("/api/auth/claude/start", { method: "POST" }).catch((e) => ({ error: e.message }));
      schritt.innerHTML = "";
      if (!r.url) {
        schritt.appendChild(absatz(escape(r.error || "Start fehlgeschlagen.") +
          " Ist die Claude-CLI installiert? Im Terminal: <code>npm i -g @anthropic-ai/claude-code</code>", "einr-warn"));
        return;
      }
      schritt.appendChild(absatz(
        `1. <a href="${escape(r.url)}" target="_blank" rel="noopener">Bei Claude anmelden ↗</a> (öffnet sich meist von selbst).<br>` +
        "2. claude.com zeigt danach einen Code — hier einfügen und abschließen."));
      schritt.appendChild(feldBlock("Code", code));
      schritt.appendChild(knopf("Anmeldung abschließen", {
        art: "haupt",
        klick: async () => {
          info.textContent = "Melde an …";
          const j = await (await postJson("/api/auth/claude/code", { code: code.value })).json().catch(() => ({}));
          info.textContent = j.ok ? `Angemeldet${j.email ? ` als ${j.email}` : ""}. Weiter mit „Weiter“.` : j.grund || j.error || "Anmeldung fehlgeschlagen.";
        },
      }));
      schritt.appendChild(info);
    },
  }));
  el.appendChild(schritt);
}

function baueOllama(el, { st }) {
  const o = st.ollama;
  if (!o.laeuft) {
    el.appendChild(statusZeile("Ollama läuft nicht", "fehlt"));
    el.appendChild(absatz(
      "Ollama installieren (einmalig): im Terminal <code>winget install Ollama.Ollama</code> oder von " +
      "<a href=\"https://ollama.com/download\" target=\"_blank\" rel=\"noopener\">ollama.com/download</a>. Danach Ollama starten " +
      "(<code>Start-Board.cmd</code> tut das mit) und „Weiter“."));
    return;
  }
  el.appendChild(statusZeile(`Ollama läuft · ${o.modelle.length} Modelle`, "ok"));
  for (const [rolle, e] of Object.entries(EMPFEHLUNG)) {
    const z = document.createElement("div");
    z.className = "einr-modell";
    z.innerHTML = `<div><b>${escape(e.modell)}</b> — empfohlen für ${rolle === "recherche" ? "Recherche" : "Kontextabgleich"}<br><span class="einr-feld-hilfe">${escape(e.warum)}</span></div>`;
    if (modellDa(st, e.modell)) z.appendChild(statusZeile("vorhanden", "ok"));
    else {
      const stand = document.createElement("span");
      stand.className = "einr-feld-hilfe";
      z.appendChild(knopf("Laden (~9 GB)", {
        klick: async (ev) => {
          ev.currentTarget.disabled = true;
          await ladeModell(e.modell, (t) => (stand.textContent = t));
          stand.textContent = "Geladen. Weiter mit „Weiter“.";
        },
      }));
      z.appendChild(stand);
    }
    el.appendChild(z);
  }
}

// v103 (Owner 02.10.2026): Weg-Wahl statt fester Claude-Pflicht. Ein Weg setzt die drei Rollen vor; darunter
// lassen sie sich einzeln umstellen. Was der Weg braucht (Claude, ChatGPT, Ollama), fragen die naechsten Schritte.
const WEGE = [
  { id: "claude", titel: "Claude + lokal", satz: "Texte mit deinem Claude-Abo, Recherche und Abgleich kostenlos auf diesem Rechner. Empfohlen.",
    rollen: { userkomm: "claude:haiku", recherche: `ollama:${EMPFEHLUNG.recherche.modell}`, kontext: `ollama:${EMPFEHLUNG.kontext.modell}` } },
  { id: "chatgpt", titel: "ChatGPT + lokal", satz: "Texte mit ChatGPT (Konto oder API-Schlüssel), Recherche und Abgleich kostenlos auf diesem Rechner.",
    rollen: { userkomm: "codex:standard", recherche: `ollama:${EMPFEHLUNG.recherche.modell}`, kontext: `ollama:${EMPFEHLUNG.kontext.modell}` } },
  { id: "cloud", titel: "Nur Cloud", satz: "Alles über Claude — kein Ollama nötig, schnell, braucht mehr vom Abo. Für ChatGPT unten je Rolle umstellen.",
    rollen: { userkomm: "claude:haiku", recherche: "claude:haiku", kontext: "claude:haiku" } },
  { id: "lokal", titel: "Nur lokal", satz: "Alles auf diesem Rechner, kostenlos und ohne Konto. Langsamer, Texte schwächer als in der Cloud.",
    rollen: { userkomm: `ollama:${EMPFEHLUNG.kontext.modell}`, recherche: `ollama:${EMPFEHLUNG.recherche.modell}`, kontext: `ollama:${EMPFEHLUNG.kontext.modell}` } },
];

function baueKiWeg(el, { st, setzeWeiter }) {
  const lokale = (st.ollama.modelle || []).map((m) => m.name);
  const rollen = [
    ["userkomm", "Userkommunikation", "Texte, die du siehst und veröffentlichst"],
    ["recherche", "Recherche", "Fakten sammeln, mit Web-Suche"],
    ["kontext", "Kontextabgleich", "Texte mit dem Firmenkontext abgleichen"],
  ];
  const vorschlagModelle = [...new Set(WEGE.flatMap((w) => Object.values(w.rollen)).filter((v) => v.startsWith("ollama:")).map((v) => v.slice(7)))];
  const optionen = [
    ["claude:haiku", "Claude Haiku (schnell, Abo)"],
    ["claude:sonnet", "Claude Sonnet (ausgewogen, Abo)"],
    ["claude:opus", "Claude Opus (stärkste Texte, Abo)"],
    ["codex:standard", "ChatGPT (Codex-CLI, Konto oder API-Schlüssel)"],
    ...lokale.map((m) => [`ollama:${m}`, `${m} (lokal, kostenlos)`]),
    // Vorschlags-Modelle, die noch fehlen, bleiben waehlbar — der Schritt „Lokale KI" laedt sie danach.
    ...vorschlagModelle.filter((m) => !lokale.includes(m)).map((m) => [`ollama:${m}`, `${m} (lokal, wird im nächsten Schritt geladen)`]),
  ];
  const wahl = {};
  const karten = document.createElement("div");
  karten.className = "einr-wege";
  const passt = (weg) => Object.entries(wahl).every(([r, sel]) => weg.rollen[r] === sel.value);
  const markiere = () => karten.querySelectorAll(".einr-weg").forEach((k) => k.classList.toggle("aktiv", passt(WEGE.find((w) => w.id === k.dataset.weg))));
  for (const weg of WEGE) {
    const k = document.createElement("button");
    k.type = "button";
    k.className = "einr-weg";
    k.dataset.weg = weg.id;
    k.innerHTML = `<b>${escape(weg.titel)}</b><span>${escape(weg.satz)}</span>`;
    k.addEventListener("click", () => {
      for (const [id, sel] of Object.entries(wahl)) sel.value = weg.rollen[id];
      markiere();
    });
    karten.appendChild(k);
  }
  el.appendChild(karten);
  for (const [id, name, wozu] of rollen) {
    const sel = document.createElement("select");
    sel.className = "einr-select";
    sel.innerHTML = optionen.map(([v, t]) => `<option value="${escape(v)}">${escape(t)}</option>`).join("");
    sel.value = WEGE[0].rollen[id];
    sel.addEventListener("change", markiere);
    wahl[id] = sel;
    el.appendChild(feldBlock(name, sel, wozu));
  }
  markiere();
  setzeWeiter(async () => {
    const kiRollen = {};
    for (const [id, sel] of Object.entries(wahl)) {
      const [provider, modell] = sel.value.split(/:(.+)/);
      const teil = provider === "claude" ? { provider, claudeModell: modell }
        : provider === "codex" ? { provider, codexModell: modell === "standard" ? "" : modell }
        : { provider, ollamaModel: modell };
      kiRollen[id] = { ...rolleKonfig(id), ...teil };
    }
    setzeEntwurf({ kiRollen }); // v94: Entwurf; Browser-Rollen + Drive erst beim Speichern
    return true;
  });
}

// v103: ChatGPT ueber die Codex-CLI — Anmeldung mit dem ChatGPT-Konto (Browser) oder einem API-Schluessel.
// Der Schluessel geht nur an die CLI (die ihn selbst ablegt), nie in Drive oder eine Board-Datei.
function baueChatgpt(el, { st }) {
  const c = st.verb.chatgpt || {};
  const info = absatz("", "einr-text");
  if (c.installiert === false) {
    el.appendChild(statusZeile("Codex-CLI fehlt", "fehlt"));
    el.appendChild(absatz("Einmalig im Terminal installieren: <code>npm i -g @openai/codex</code> — danach „Weiter“ (prüft neu)."));
    return;
  }
  el.appendChild(statusZeile("nicht angemeldet", "hinweis"));
  el.appendChild(absatz("<b>Mit ChatGPT-Konto</b> — im Browser anmelden; die Nutzung läuft über deinen ChatGPT-Plan. " +
    "OpenAI empfiehlt für Automatisierung einen API-Schlüssel; das Board ruft ChatGPT nur auf deinen Klick."));
  el.appendChild(knopf("Mit ChatGPT anmelden", {
    art: "haupt",
    klick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      info.textContent = "Starte die Anmeldung — im Browser öffnet sich OpenAI …";
      const r = await holeJson("/api/auth/chatgpt/start", { method: "POST" }).catch((err) => ({ error: err.message }));
      if (r.error) { info.textContent = r.error; b.disabled = false; return; }
      info.innerHTML = (r.url ? `Falls sich kein Browser öffnet: <a href="${escape(r.url)}" target="_blank" rel="noopener">bei OpenAI anmelden ↗</a>. ` : "") +
        "Nach der Anmeldung „Weiter“.";
    },
  }));
  const schluessel = eingabe("", { typ: "password", platzhalter: "sk-…" });
  el.appendChild(feldBlock("Oder: OpenAI-API-Schlüssel", schluessel, "Abrechnung nach Verbrauch bei OpenAI. Geht nur an die Codex-CLI auf diesem Rechner — nicht in Drive, nicht auf GitHub."));
  el.appendChild(knopf("Mit Schlüssel anmelden", {
    klick: async () => {
      if (!schluessel.value.trim()) { info.textContent = "Bitte zuerst den Schlüssel einfügen."; return; }
      info.textContent = "Melde an …";
      const j = await (await postJson("/api/auth/chatgpt/schluessel", { schluessel: schluessel.value })).json().catch(() => ({}));
      schluessel.value = "";
      info.textContent = j.ok ? "Angemeldet. Weiter mit „Weiter“." : j.grund || j.error || "Anmeldung fehlgeschlagen.";
    },
  }));
  el.appendChild(info);
}

function baueFirma(el, { st, setzeWeiter }) {
  const vorhanden = (st.kontext.firma && st.kontext.firma.text) || "";
  const felder = {};
  for (const [id, frage, hilfe] of FIRMA_FRAGEN) {
    felder[id] = textfeld("", 2, hilfe);
    el.appendChild(feldBlock(frage, felder[id]));
  }
  if (vorhanden) el.appendChild(absatz("Vorhandener Text bleibt erhalten; die Antworten werden angehängt.", "einr-feld-hilfe"));
  const info = absatz("", "einr-warn");
  el.appendChild(info);
  setzeWeiter(async () => {
    const neu = FIRMA_FRAGEN.filter(([id]) => felder[id].value.trim())
      .map(([id, frage]) => `## ${frage}\n${felder[id].value.trim()}`).join("\n\n");
    if (!neu) { info.textContent = "Mindestens „Wer seid ihr?“ und „Wen wollt ihr erreichen?“ — ohne Firmenkontext schreibt die KI ins Blaue."; return false; }
    setzeEntwurf({ firma: vorhanden ? `${vorhanden.trim()}\n\n${neu}` : neu }); // v94: Entwurf
    return true;
  });
}

// Prompts: nur die noch nicht bestaetigten, einer nach dem anderen. Je Prompt der Vorschlag
// (Standard) — und, falls vorhanden, die eigene Fassung zum Vergleich. „Weiter" speichert, was im
// Feld steht: identisch mit dem Vorschlag = Standard (keine eigene Fassung), sonst eigene Fassung.
function bauePrompts(el, { st, setzeWeiter }) {
  const p = st.prompts;
  const nachId = Object.fromEntries((p.aufgaben || []).map((a) => [a.id, a]));
  const legende = { ...(p.system?.platzhalter || {}), ...((p.aufgaben || [])[0]?.platzhalter || {}) };
  const rolleName = Object.fromEntries((p.rollen || []).map((r) => [r.id, r.name]));
  const reihe = offenePrompts(st);
  let i = 0;

  const zeichneEinen = () => {
    el.innerHTML = "";
    const [id, wozu] = reihe[i];
    const a = id === "system" ? p.system : nachId[id];
    const vorschlag = id === "system" ? [a.vorlage || ""] : (a.standard || []).map((s) => s.prompt || "");
    const schritteInfo = id === "system" ? [{ rolle: "userkomm" }] : (a.standard || []);

    el.appendChild(absatz(
      `<span class="einr-zaehler">Prompt ${i + 1} von ${reihe.length}</span><br>` +
      `<b class="einr-prompt-name">${escape(a.name || id)}</b><br>${escape(wozu)}` +
      (a.knopf || a.ort ? `<br><span class="einr-feld-hilfe">Knopf: ${escape(a.knopf || "—")} · Ort: ${escape(a.ort || "—")}</span>` : "")));

    // Hier landen nur Prompts ohne eigene Fassung (v96) — das Feld zeigt den Vorschlag zum Uebernehmen oder Anpassen.
    const texte = vorschlag.map((v) => textfeld(v, id === "system" ? 12 : 9));
    texte.forEach((t, j) => {
      const s = schritteInfo[j] || {};
      const label = id === "system" ? "System-Vorspann (Vorschlag)" : `${texte.length > 1 ? `Schritt ${j + 1} · ` : ""}${rolleName[s.rolle] || s.rolle || ""}${s.websuche ? " · mit Web-Suche" : ""}`;
      el.appendChild(feldBlock(label, t));
    });
    const benutzt = [...new Set(vorschlag.join(" ").match(/\{\{\w+\}\}/g) || [])].map((x) => x.slice(2, -2));
    if (benutzt.length)
      el.appendChild(absatz("Diese Platzhalter setzt das Board ein: " +
        benutzt.map((x) => `<code>{{${escape(x)}}}</code> ${escape({ ...legende, ...(a.platzhalter || {}) }[x] || "")}`).join(" · "), "einr-feld-hilfe"));
    const warn = absatz("", "einr-warn");
    el.appendChild(warn);

    setzeWeiter(async () => {
      // v94: Entwurf. Unveraenderter Vorschlag = nichts zu schreiben (nur bestaetigen); angepasst = eigene Fassung.
      const istVorschlag = texte.every((t, j) => t.value === vorschlag[j]);
      const e = leseEntwurf();
      const promptsNeu = { ...(e.prompts || {}) };
      if (istVorschlag) delete promptsNeu[id];
      else promptsNeu[id] = id === "system" ? texte[0].value : (a.standard || []).map((s, j) => ({ ...s, prompt: texte[j].value }));
      setzeEntwurf({ prompts: promptsNeu, promptsBestaetigt: { ...(e.promptsBestaetigt || {}), [id]: true } });
      if (i < reihe.length - 1) { i++; zeichneEinen(); return false; } // naechster Prompt, Schritt bleibt
      return true;
    });
  };
  if (!reihe.length) { el.appendChild(absatz("Alle Prompts sind bestätigt.")); return; }
  zeichneEinen();
}

function bauePlan(el, { setzeWeiter }) {
  el.appendChild(absatz("Lege Plattformen, Posts pro Woche je Format und den maximalen Abstand fest und speichere. " +
    "Der Dialog öffnet sich über dem Assistenten; danach hier „Weiter“."));
  el.appendChild(knopf("Redaktionsplan öffnen", { art: "haupt", klick: () => zeigeRedaktionsplan() }));
  setzeWeiter(async () => { setzeEntwurf({ planBestaetigt: true }); return true; });
}

function baueGoogle(el, { st }) {
  const g = st.verb.google || {};
  el.appendChild(statusZeile(g.hinweis || (g.verbunden ? "gestört" : "nicht verbunden"), "hinweis"));
  if (g.grund) el.appendChild(absatz(escape(g.grund)));
  if (!g.clientKonfiguriert) {
    el.appendChild(absatz(
      "Einmalig braucht das Board eine Google-Cloud-App für Kalender und Tasks (dasselbe Projekt wie für Drive geht):<br>" +
      "1. <b>console.cloud.google.com</b> → <i>Google Calendar API</i> und <i>Google Tasks API</i> aktivieren.<br>" +
      "2. Credentials → OAuth client ID → <b>Web application</b>, Redirect URI <code>https://localhost:4321/api/auth/google/callback</code>.<br>" +
      "3. Für Dauerbetrieb die App auf „In production“ stellen (im Modus „Testing“ läuft die Anmeldung nach 7 Tagen ab)."));
    const id = eingabe("", { platzhalter: "Client-ID (…apps.googleusercontent.com)" });
    const geheim = eingabe("", { typ: "password", platzhalter: "Client-Secret" });
    el.appendChild(feldBlock("Client-ID", id));
    el.appendChild(feldBlock("Client-Secret", geheim, "Bleibt lokal in .env."));
    el.appendChild(knopf("Speichern und verbinden", {
      art: "haupt",
      klick: async () => {
        if (!id.value.trim() || !geheim.value.trim()) return;
        await putJson("/api/config/env", { key: "GOOGLE_OAUTH_CLIENT_ID", value: id.value.trim() });
        await putJson("/api/config/env", { key: "GOOGLE_OAUTH_CLIENT_SECRET", value: geheim.value.trim() });
        window.location.href = "/api/auth/google"; // kehrt per Merker hierher zurueck
      },
    }));
  } else {
    el.appendChild(knopf("Mit Google verbinden", { art: "haupt", klick: () => { window.location.href = "/api/auth/google"; } }));
  }
}

// Modell ueber den Server laden; meldet den Fortschritt als Satz.
async function ladeModell(modell, melde) {
  try {
    const res = await fetch("/api/ai/ollama/pull", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: modell }),
    });
    if (!res.ok || !res.body) { melde("Laden fehlgeschlagen."); return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let puffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      puffer += dec.decode(value, { stream: true });
      let nl;
      while ((nl = puffer.indexOf("\n")) >= 0) {
        const z = puffer.slice(0, nl).trim();
        puffer = puffer.slice(nl + 1);
        if (!z) continue;
        try {
          const o = JSON.parse(z);
          if (o.error) melde(`Fehler: ${o.error}`);
          else if (o.total && o.completed) melde(`${Math.round((o.completed / o.total) * 100)} % von ${(o.total / 1e9).toFixed(1)} GB`);
          else if (o.status) melde(o.status);
        } catch {}
      }
    }
  } catch (e) {
    melde(`Laden fehlgeschlagen: ${e.message}`);
  }
}
