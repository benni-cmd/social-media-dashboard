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

import { S, rolleKonfig, setzeRolleKonfig, speichereDefaults } from "./store.js";
import { knopf, eingabe, textfeld, escape, sanduhr, modalX } from "./ui.js";
import { zeigeRedaktionsplan } from "./redaktionsplan.js";

const MERKER = "cm-einrichtung-schritt"; // Rueckkehr nach Google-Anmeldung oder Ordnerwechsel (Neuladen)

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
  const [kontext, prompts] = ordnerOk
    ? await Promise.all([sicher(holeJson("/api/kontext")), sicher(holeJson("/api/prompts"))])
    : [{}, {}];
  return { drive: driveE, verb, ollama, defaults, name, kontext, prompts, ordnerOk };
}

const bestaetigtePrompts = (st) => (st.defaults && st.defaults.promptsBestaetigt) || {};
const offenePrompts = (st) => {
  const ids = new Set((st.prompts.aufgaben || []).map((a) => a.id));
  return PROMPT_REIHE.filter(([id]) => (id === "system" || ids.has(id)) && !bestaetigtePrompts(st)[id]);
};
const lokaleRollen = () => ["userkomm", "recherche", "kontext"].map((r) => rolleKonfig(r)).filter((x) => x.provider === "ollama");
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
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !st.defaults.nameBestaetigt }),
    baue: baueName,
  },
  {
    id: "claude",
    titel: "Claude anmelden",
    satz: "Claude schreibt die Texte, die du später siehst (Hooks, Skript, Caption) — über dein Claude-Abo auf diesem Rechner, ohne API-Kosten.",
    pruefe: (st) => ({ fehlt: !(st.verb.claude && st.verb.claude.verbunden) }),
    baue: baueClaude,
  },
  {
    id: "ollama",
    titel: "Lokale KI (Ollama)",
    satz: "Recherche und Kontextabgleich laufen kostenlos auf diesem Rechner. Dafür braucht es Ollama und die passenden Modelle.",
    pruefe: (st) => {
      const lokal = st.defaults.kiRollen ? lokaleRollen() : Object.values(EMPFEHLUNG).map((e) => ({ ollamaModel: e.modell }));
      return { fehlt: lokal.length > 0 && (!st.ollama.laeuft || lokal.some((r) => !modellDa(st, r.ollamaModel))) };
    },
    baue: baueOllama,
  },
  {
    id: "rollen",
    titel: "KI-Rollen verteilen",
    satz: "Jede KI-Aufgabe läuft über das Modell ihrer Rolle. Der Vorschlag ist vorausgewählt; gespeichert wird im Board.",
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !st.defaults.kiRollen }),
    baue: baueRollen,
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
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !st.defaults.planBestaetigt }),
    baue: bauePlan,
  },
  {
    id: "google",
    titel: "Google Kalender + Tasks verbinden",
    satz: "Das Board trägt jeden Drehtermin als Termin in deinen Google-Kalender und als Aufgabe in Google Tasks ein. Es liest nichts zurück.",
    pruefe: (st) => ({ gesperrt: st.ordnerOk ? null : OHNE_ORDNER, fehlt: !(st.verb.google && st.verb.google.zustand === "live") }),
    baue: baueGoogle,
  },
];

// Welche Schritte sind offen? (fuer den Start-Check in app.js)
export function offeneSchritte(st) {
  return SCHRITTE.map((s) => ({ s, ...s.pruefe(st) })).filter((x) => x.fehlt || x.gesperrt);
}

// Beim Start: Stand lesen; fehlt etwas, Assistent oeffnen (ab dem ersten offenen Schritt).
export async function einrichtungBeimStart() {
  let merker = null;
  try { merker = localStorage.getItem(MERKER); } catch {}
  const st = await leseStand();
  if (merker === null && !offeneSchritte(st).length) return;
  starteEinrichtung(st);
}

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
  const schliessen = () => {
    try { localStorage.removeItem(MERKER); } catch {}
    overlay.remove();
  };
  // Schliessen = fuer diese Sitzung. Beim naechsten Start kommt der Assistent wieder, solange etwas fehlt.
  box.appendChild(modalX(() => schliessen(), "Für diese Sitzung schließen — beim nächsten Start geht es hier weiter"));

  async function neuLesen(text = "Prüfe, was schon eingerichtet ist …") {
    inhalt.innerHTML = "";
    inhalt.appendChild(sanduhr(text));
    fuss.innerHTML = "";
    st = await leseStand();
  }

  // Naechster offener, nicht gesperrter, nicht uebersprungener Schritt ab Index `ab`.
  function naechster(ab = 0) {
    for (let i = ab; i < SCHRITTE.length; i++) {
      const p = SCHRITTE[i].pruefe(st);
      if (p.fehlt && !p.gesperrt && !spaeter.has(SCHRITTE[i].id)) return i;
    }
    return -1;
  }

  function zeichneLeiste(aktiv) {
    leiste.innerHTML = SCHRITTE.map((x, j) => {
      const p = x.pruefe(st);
      const art = j === aktiv ? "aktiv" : p.gesperrt ? "gesperrt" : !p.fehlt ? "ok" : spaeter.has(x.id) ? "weg" : "";
      const titel = `${x.titel}${p.gesperrt ? ` — ${p.gesperrt}` : !p.fehlt ? " — erledigt" : ""}`;
      return `<span class="einr-punkt ${art}" title="${escape(titel)}"></span>`;
    }).join("");
  }

  async function zeige(i) {
    if (i < 0) return zeigeAbschluss();
    const s = SCHRITTE[i];
    try { localStorage.setItem(MERKER, s.id); } catch {}
    const offen = SCHRITTE.filter((x) => x.pruefe(st).fehlt).length;
    kopf.innerHTML =
      `<div class="einr-zaehler">Einrichtung · Schritt ${i + 1} von ${SCHRITTE.length} · noch ${offen} offen</div>` +
      `<div class="einr-titel">${escape(s.titel)}</div>` +
      `<p class="einr-satz">${escape(s.satz)}</p>`;
    zeichneLeiste(i);
    inhalt.innerHTML = "";
    weiterAktion = null;
    s.baue(inhalt, { st, setzeWeiter: (f) => (weiterAktion = f), schliessen });

    fuss.innerHTML = "";
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
          await neuLesen();
          // Ist der Schritt immer noch offen (z. B. Anmeldung nicht abgeschlossen), bleibt man dort.
          const nochOffen = s.pruefe(st).fehlt && !spaeter.has(s.id);
          zeige(nochOffen ? i : naechster(0));
        } finally { b.disabled = false; }
      },
    }));
    fuss.appendChild(rechts);
  }

  function zeigeAbschluss() {
    try { localStorage.removeItem(MERKER); } catch {}
    zeichneLeiste(-1);
    const offen = offeneSchritte(st);
    kopf.innerHTML =
      `<div class="einr-zaehler">Einrichtung · Stand</div>` +
      `<div class="einr-titel">${offen.length ? "Fast fertig" : "Alles eingerichtet"}</div>` +
      `<p class="einr-satz">${offen.length ? "Übersprungenes fragt der Assistent beim nächsten Start wieder ab." : "Das Board ist vollständig eingerichtet."}</p>`;
    inhalt.innerHTML = "";
    const zeilen = SCHRITTE.map((s) => {
      const p = s.pruefe(st);
      const zeichen = !p.fehlt && !p.gesperrt ? "✓" : "○";
      const grund = p.gesperrt ? ` — ${p.gesperrt}` : p.fehlt ? " — noch offen" : "";
      return `<li class="${!p.fehlt && !p.gesperrt ? "ok" : "weg"}">${zeichen} ${escape(s.titel)}${escape(grund)}</li>`;
    });
    inhalt.appendChild(absatz(`<ul class="einr-liste">${zeilen.join("")}</ul>`));
    fuss.innerHTML = "";
    const rechts = document.createElement("div");
    rechts.className = "einr-fuss-rechts";
    rechts.appendChild(knopf(offen.length ? "Schließen" : "Fertig", {
      art: "haupt",
      klick: async () => {
        if (!offen.length) await speichereDefaults({ einrichtungFertig: true }).catch(() => {});
        schliessen();
      },
    }));
    fuss.appendChild(rechts);
  }

  if (!st) await neuLesen();
  // Rueckkehr (Merker): dort weitermachen, falls der Schritt noch offen ist.
  let merker = null;
  try { merker = localStorage.getItem(MERKER); } catch {}
  const mi = SCHRITTE.findIndex((s) => s.id === merker);
  const start = mi >= 0 && SCHRITTE[mi].pruefe(st).fehlt && !SCHRITTE[mi].pruefe(st).gesperrt ? mi : naechster(0);
  zeige(start);
  return { schliessen };
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
  setzeWeiter(async () => {
    const neu = name.value.trim();
    if (neu && neu !== st.name.name) {
      const res = await putJson("/api/board/name", { name: neu });
      const j = await res.json();
      if (!res.ok) { el.appendChild(absatz(escape(j.error || "Umbenennen fehlgeschlagen."), "einr-warn")); return false; }
      window.dispatchEvent(new CustomEvent("board-name", { detail: j.name }));
    } else if (st.name.name) window.dispatchEvent(new CustomEvent("board-name", { detail: st.name.name }));
    await speichereDefaults({ nameBestaetigt: true });
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

function baueRollen(el, { st, setzeWeiter }) {
  const lokale = (st.ollama.modelle || []).map((m) => m.name);
  const rollen = [
    ["userkomm", "Userkommunikation", "Texte, die du siehst und veröffentlichst", "claude:haiku"],
    ["recherche", "Recherche", "Fakten sammeln, mit Web-Suche", `ollama:${EMPFEHLUNG.recherche.modell}`],
    ["kontext", "Kontextabgleich", "Texte mit dem Firmenkontext abgleichen", `ollama:${EMPFEHLUNG.kontext.modell}`],
  ];
  const wahl = {};
  for (const [id, name, wozu, vorschlag] of rollen) {
    const sel = document.createElement("select");
    sel.className = "einr-select";
    const optionen = [
      ["claude:haiku", "Claude Haiku (schnell, Abo)"],
      ["claude:sonnet", "Claude Sonnet (ausgewogen, Abo)"],
      ["claude:opus", "Claude Opus (stärkste Texte, Abo)"],
      ...lokale.map((m) => [`ollama:${m}`, `${m} (lokal, kostenlos)`]),
    ];
    const vor = optionen.some(([v]) => v === vorschlag) ? vorschlag : "claude:haiku";
    sel.innerHTML = optionen.map(([v, t]) => `<option value="${escape(v)}"${v === vor ? " selected" : ""}>${escape(t)}${v === vorschlag ? " — Vorschlag" : ""}</option>`).join("");
    wahl[id] = sel;
    el.appendChild(feldBlock(name, sel, wozu));
  }
  setzeWeiter(async () => {
    const kiRollen = {};
    for (const [id, sel] of Object.entries(wahl)) {
      const [provider, modell] = sel.value.split(/:(.+)/);
      const teil = provider === "claude" ? { provider, claudeModell: modell } : { provider, ollamaModel: modell };
      setzeRolleKonfig(id, teil);
      kiRollen[id] = rolleKonfig(id);
    }
    await speichereDefaults({ kiRollen }); // sofort, nicht erst nach der Buendelung in store.js
    return true;
  });
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
    const text = vorhanden ? `${vorhanden.trim()}\n\n${neu}` : neu;
    const r = await putJson("/api/kontext", { was: "firma-text", text });
    if (!r.ok) { info.textContent = "Speichern fehlgeschlagen — bitte erneut versuchen."; return false; }
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
    const eigen = id === "system" ? (a.eigen ? [a.eigen] : null) : a.eigen ? (a.schritte || []).map((s) => s.prompt || "") : null;
    const schritteInfo = id === "system" ? [{ rolle: "userkomm" }] : (a.standard || []);

    el.appendChild(absatz(
      `<span class="einr-zaehler">Prompt ${i + 1} von ${reihe.length}</span><br>` +
      `<b class="einr-prompt-name">${escape(a.name || id)}</b><br>${escape(wozu)}` +
      (a.knopf || a.ort ? `<br><span class="einr-feld-hilfe">Knopf: ${escape(a.knopf || "—")} · Ort: ${escape(a.ort || "—")}</span>` : "")));

    // Eigene Fassung vorhanden → sie ist vorausgewaehlt; ein schnelles „Weiter" ueberschreibt nichts.
    const texte = vorschlag.map((v, j) => textfeld(eigen ? eigen[j] ?? eigen[0] ?? v : v, id === "system" ? 12 : 9));
    if (eigen) {
      const wahl = document.createElement("div");
      wahl.className = "einr-wahl";
      wahl.innerHTML =
        `<label><input type="radio" name="pw" value="e" checked> Meine bisherige Fassung</label>` +
        `<label><input type="radio" name="pw" value="v"> Vorschlag übernehmen</label>`;
      wahl.addEventListener("change", (e) => {
        const quelle = e.target.value === "e" ? eigen : vorschlag;
        texte.forEach((t, j) => (t.value = quelle[j] ?? quelle[0] ?? ""));
      });
      el.appendChild(feldBlock("Du hast diesen Prompt schon angepasst", wahl, "Wähle, womit du weitermachst — beides lässt sich im Feld noch ändern."));
    }
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
      const istVorschlag = texte.every((t, j) => t.value === vorschlag[j]);
      let r;
      if (id === "system") r = await putJson("/api/prompts", { id, text: istVorschlag ? "" : texte[0].value });
      else r = await putJson("/api/prompts", {
        id,
        schritte: istVorschlag ? [] : (a.standard || []).map((s, j) => ({ ...s, prompt: texte[j].value })),
      });
      if (!r.ok) { warn.textContent = "Speichern fehlgeschlagen — bitte erneut versuchen."; return false; }
      const bestaetigt = { ...bestaetigtePrompts(st), [id]: true };
      st.defaults.promptsBestaetigt = bestaetigt;
      await speichereDefaults({ promptsBestaetigt: bestaetigt });
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
  setzeWeiter(async () => { await speichereDefaults({ planBestaetigt: true }); return true; });
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
