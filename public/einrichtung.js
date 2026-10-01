// Einrichtung (v91) — der Install-Flow eines neuen Boards, Schritt fuer Schritt.
//
// Owner 01.10.2026: nach dem Wechsel in einen neuen, leeren Drive-Ordner soll das Board gefuehrt
// arbeitsfaehig werden: Name (= Drive-Hauptordner), Google Kalender + Tasks, Claude, lokale KI
// (Ollama, DeepSeek/Qwen empfohlen), KI-Rollen, Firmenkontext und — strukturiert, mit Erklaerung —
// alle System-Prompts. Jeder Schritt ist ueberspringbar; der Assistent ist in den Einstellungen
// erneut startbar. Plan und Begruendung: docs/packages/v91-einrichtung-und-board-name.md.
//
// Alles, was hier gesetzt wird, landet dort, wo es auch die Einstellungen ablegen (Drive bzw. .env) —
// der Assistent hat keinen eigenen Speicher ausser dem Merker „wo war ich" fuer die Rueckkehr aus
// der Google-Anmeldung.

import { S, rolleKonfig, setzeRolleKonfig, speichereDefaults } from "./store.js";
import { knopf, eingabe, textfeld, escape, sanduhr, modalX } from "./ui.js";
import { zeigeRedaktionsplan } from "./redaktionsplan.js";

const MERKER = "cm-einrichtung-schritt";

// Empfehlung je Rolle (Owner: „bei den passenden Rollen DeepSeek oder Qwen").
const EMPFEHLUNG = {
  recherche: { modell: "deepseek-r1:14b", warum: "denkt gruendlich nach, bevor es antwortet — gut fuer Recherche, dafuer langsamer" },
  kontext: { modell: "qwen2.5:14b", warum: "schnell und genau beim Abgleichen von Texten mit dem Firmenkontext" },
};

// Reihenfolge der Prompts = Ablauf des Boards, damit die Texte logisch aufeinander aufbauen.
const PROMPT_REIHE = [
  ["system", "Gilt fuer JEDEN Text, den die KI fuer dich schreibt — Rolle, Haltung, Hausregeln. Hier steht, wer schreibt und fuer wen."],
  ["ideen", "Erster Schritt eines Inhalts: „Idee von der KI“ schlaegt Themen vor, die zur Kategorie und zum Ziel passen."],
  ["recherche", "Sammelt Fakten zum Thema (mit Web-Suche) und gleicht sie mit dem Firmenkontext ab — Grundlage fuer alles Weitere."],
  ["hooks_verbal", "Formuliert gesprochene Einstiege fuer die ersten Sekunden — baut auf der Recherche auf."],
  ["hooks_visuell", "Beschreibt den ersten Bildeindruck passend zum gewaehlten Hook."],
  ["skript", "Schreibt den Sprechertext fuer das Video aus Recherche, Fokus und Hook."],
  ["regieplan", "Macht aus dem Skript einen Drehplan: Einstellungen, Bilder, Ablauf."],
  ["caption", "Schreibt den Begleittext zum Post — Einstieg, Inhalt, Handlungsaufruf, Hashtags."],
  ["plan", "Fuellt den Redaktionsplan mit Themen fuer die naechsten Wochen."],
  ["analyse", "Liest die Zahlen eines veroeffentlichten Posts und sagt, was daraus folgt."],
  ["slider_aufbau", "Nur fuer Slider: teilt die Botschaft auf Slides auf (Text je Slide)."],
  ["slider_visual", "Nur fuer Slider: beschreibt das Bild je Slide und schreibt einen Bild-Prompt."],
  ["beitrag_visual", "Nur fuer Beitraege: Hook, Text, Handlungsaufruf und ein Bild-Konzept."],
  ["story_frames", "Nur fuer Storys: die einzelnen Frames mit Medium, Text und Sticker."],
  ["langform_konzept", "Nur fuer Langvideos: Storytelling-Konzept mit Kapiteln statt Skript."],
];

const FIRMA_FRAGEN = [
  ["wer", "Wer seid ihr?", "Name, Rechtsform, seit wann, wo — in zwei, drei Saetzen."],
  ["wofuer", "Wofuer steht ihr?", "Mission und die zwei, drei Themen, ueber die ihr sprecht."],
  ["wen", "Wen wollt ihr erreichen?", "Zielgruppe: Alter, Interessen, was sie von euch brauchen."],
  ["ton", "Wie klingt ihr?", "Tonalitaet: duzen/siezen, locker/sachlich, Humor ja/nein, typische Woerter."],
  ["nogos", "Was nie?", "No-Gos: Themen, Woerter, Behauptungen, die nicht vorkommen duerfen."],
  ["cta", "Was soll man tun?", "Handlungsaufrufe: folgen, spenden, mitmachen — mit Link, falls es einen gibt."],
];

const holeJson = async (url, opt) => (await fetch(url, opt)).json();
const putJson = (url, body) =>
  fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Startet automatisch, wenn ein frisch angelegtes Board (leer, Einrichtung nie abgeschlossen)
// geladen ist — oder wenn die Google-Anmeldung in die Einrichtung zurueckkehrt.
export function einrichtungFaellig() {
  let merker = null;
  try { merker = localStorage.getItem(MERKER); } catch {}
  if (merker !== null) return Number(merker) || 0;
  if (S.defaults.geladen && !S.defaults.einrichtungFertig && S.cards.length === 0) return 0;
  return null;
}

export function starteEinrichtung(ab = 0) {
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
  // Schliessen = „spaeter einrichten": nichts geht verloren, was schon gespeichert ist; der
  // Assistent startet ueber Einstellungen → Externe Dienste erneut.
  box.appendChild(modalX(() => schliessen(), "Einrichtung später fortsetzen"));

  const erledigt = new Set();
  const uebersprungen = new Set();
  let index = ab;
  let weiterAktion = null; // vom Schritt gesetzt: async () => true (weiter) | false (bleiben)

  const schliessen = () => {
    try { localStorage.removeItem(MERKER); } catch {}
    overlay.remove();
  };

  function zeige(i) {
    index = Math.max(0, Math.min(SCHRITTE.length - 1, i));
    try { localStorage.setItem(MERKER, String(index)); } catch {}
    const s = SCHRITTE[index];
    kopf.innerHTML =
      `<div class="einr-zaehler">Einrichtung · Schritt ${index + 1} von ${SCHRITTE.length}</div>` +
      `<div class="einr-titel">${escape(s.titel)}</div>` +
      `<p class="einr-satz">${escape(s.satz)}</p>`;
    leiste.innerHTML = SCHRITTE.map((x, j) =>
      `<span class="einr-punkt${j === index ? " aktiv" : erledigt.has(j) ? " ok" : uebersprungen.has(j) ? " weg" : ""}" title="${escape(x.titel)}"></span>`).join("");
    inhalt.innerHTML = "";
    weiterAktion = null;
    s.baue(inhalt, { setzeWeiter: (f) => (weiterAktion = f), erledigt, uebersprungen, schliessen });

    fuss.innerHTML = "";
    if (index > 0) fuss.appendChild(knopf("Zurück", { klick: () => zeige(index - 1) }));
    const rechts = document.createElement("div");
    rechts.className = "einr-fuss-rechts";
    if (!s.letzter) {
      rechts.appendChild(knopf("Später", { titel: "Diesen Schritt überspringen", klick: () => { uebersprungen.add(index); zeige(index + 1); } }));
      rechts.appendChild(knopf("Weiter", {
        art: "haupt",
        klick: async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          try {
            const ok = weiterAktion ? await weiterAktion() : true;
            if (ok !== false) { erledigt.add(index); uebersprungen.delete(index); zeige(index + 1); }
          } finally { b.disabled = false; }
        },
      }));
    } else {
      rechts.appendChild(knopf("Einrichtung abschließen", {
        art: "haupt",
        klick: async () => {
          await speichereDefaults({ einrichtungFertig: true }).catch(() => {});
          S.defaults.einrichtungFertig = true;
          schliessen();
        },
      }));
    }
    fuss.appendChild(rechts);
  }

  zeige(index);
  return { schliessen };
}

// --- Bausteine -------------------------------------------------------------

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

function statusZeile(zustandText, art) {
  const d = document.createElement("div");
  d.className = "einr-status";
  d.innerHTML = `<span class="chip ${art === "ok" ? "chip-ok" : art === "hinweis" ? "chip-hinweis" : "chip-fehlt"}">${escape(zustandText)}</span>`;
  return d;
}

function laedt(el, text) {
  el.innerHTML = "";
  el.appendChild(sanduhr(text));
}

// --- Schritte --------------------------------------------------------------

const SCHRITTE = [
  {
    titel: "Wie heißt dieses Board?",
    satz: "Der Name ist der Name des Drive-Hauptordners — beides ist dasselbe. Er steht oben links und im Browser-Tab.",
    baue(el, { setzeWeiter }) {
      laedt(el, "Lese den Ordnernamen aus Drive …");
      holeJson("/api/board/name").then((r) => {
        el.innerHTML = "";
        const name = eingabe(r.name || "", { platzhalter: "z. B. World Eden Era – Social Media" });
        el.appendChild(feldBlock("Name", name, "Ändern benennt den Ordner in Google Drive um."));
        if (r.fehler) el.appendChild(absatz(`Drive-Name nicht lesbar: ${escape(r.fehler)}`, "einr-warn"));
        setzeWeiter(async () => {
          const neu = name.value.trim();
          if (!neu || neu === r.name) return true;
          const res = await putJson("/api/board/name", { name: neu });
          const j = await res.json();
          if (!res.ok) { el.appendChild(absatz(escape(j.error || "Umbenennen fehlgeschlagen."), "einr-warn")); return false; }
          window.dispatchEvent(new CustomEvent("board-name", { detail: j.name }));
          return true;
        });
      });
    },
  },
  {
    titel: "Google Kalender + Tasks verbinden",
    satz: "Das Board trägt jeden Drehtermin als Termin in deinen Google-Kalender und als Aufgabe in Google Tasks ein. Es liest nichts zurück.",
    baue(el) {
      laedt(el, "Prüfe die Google-Verbindung …");
      holeJson("/api/verbindungen/status").then((s) => {
        const g = s.google || {};
        el.innerHTML = "";
        el.appendChild(statusZeile(g.zustand === "live" ? `verbunden${g.email ? ` als ${g.email}` : ""}` : g.hinweis || (g.verbunden ? "gestört" : "nicht verbunden"),
          g.zustand === "live" ? "ok" : "hinweis"));
        if (g.grund && g.zustand !== "live") el.appendChild(absatz(escape(g.grund)));
        if (g.zustand === "live") return;
        if (!g.clientKonfiguriert) {
          el.appendChild(absatz(
            "Zuerst braucht das Board die Zugangsdaten einer eigenen Google-Cloud-App (einmalig):<br>" +
            "1. <b>console.cloud.google.com</b> → APIs: <i>Google Calendar API</i> und <i>Google Tasks API</i> aktivieren.<br>" +
            "2. Credentials → OAuth client ID (Web application), Redirect URI: <code>https://localhost:4321/api/auth/google/callback</code>.<br>" +
            "3. Client-ID und Client-Secret hier eintragen."));
          const id = eingabe("", { platzhalter: "Client-ID (…apps.googleusercontent.com)" });
          const geheim = eingabe("", { typ: "password", platzhalter: "Client-Secret" });
          el.appendChild(feldBlock("Client-ID", id));
          el.appendChild(feldBlock("Client-Secret", geheim, "Bleibt lokal in .env — landet weder in Drive noch auf GitHub."));
          el.appendChild(knopf("Speichern und verbinden", {
            art: "haupt",
            klick: async () => {
              if (!id.value.trim() || !geheim.value.trim()) return;
              await putJson("/api/config/env", { key: "GOOGLE_OAUTH_CLIENT_ID", value: id.value.trim() });
              await putJson("/api/config/env", { key: "GOOGLE_OAUTH_CLIENT_SECRET", value: geheim.value.trim() });
              window.location.href = "/api/auth/google";
            },
          }));
        } else {
          el.appendChild(knopf("Mit Google verbinden", {
            art: "haupt",
            klick: () => { window.location.href = "/api/auth/google"; }, // kehrt hierher zurueck (Merker)
          }));
        }
      });
    },
  },
  {
    titel: "Claude anmelden",
    satz: "Claude schreibt die Texte, die du später siehst (Hooks, Skript, Caption). Es läuft über dein Claude-Abo auf diesem Rechner — keine API-Kosten.",
    baue(el) {
      laedt(el, "Prüfe die Claude-Anmeldung …");
      holeJson("/api/verbindungen/status").then((s) => {
        const c = s.claude || {};
        el.innerHTML = "";
        el.appendChild(statusZeile(c.verbunden ? `angemeldet${c.email ? ` als ${c.email}` : ""}` : "nicht angemeldet", c.verbunden ? "ok" : "hinweis"));
        if (c.verbunden) return;
        const schritt = document.createElement("div");
        const code = eingabe("", { platzhalter: "Code von claude.com hier einfügen" });
        const info = absatz("", "einr-text");
        el.appendChild(knopf("Anmeldung starten", {
          art: "haupt",
          klick: async () => {
            laedt(schritt, "Starte die Claude-Anmeldung …");
            const r = await holeJson("/api/auth/claude/start", { method: "POST" }).catch((e) => ({ error: e.message }));
            schritt.innerHTML = "";
            if (!r.url) { schritt.appendChild(absatz(escape(r.error || "Start fehlgeschlagen. Ist die Claude-CLI installiert?"), "einr-warn")); return; }
            schritt.appendChild(absatz(
              `1. <a href="${escape(r.url)}" target="_blank" rel="noopener">Bei Claude anmelden ↗</a> (öffnet sich meist von selbst).<br>` +
              "2. claude.com zeigt danach einen Code — hier einfügen und abschließen."));
            schritt.appendChild(feldBlock("Code", code));
            schritt.appendChild(knopf("Anmeldung abschließen", {
              art: "haupt",
              klick: async () => {
                info.textContent = "Melde an …";
                const j = await (await fetch("/api/auth/claude/code", {
                  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.value }),
                })).json().catch(() => ({}));
                info.textContent = j.ok ? `Angemeldet${j.email ? ` als ${j.email}` : ""}. Weiter mit „Weiter“.` : j.grund || j.error || "Anmeldung fehlgeschlagen.";
              },
            }));
            schritt.appendChild(info);
          },
        }));
        el.appendChild(schritt);
      });
    },
  },
  {
    titel: "Lokale KI (Ollama)",
    satz: "Recherche und Kontextabgleich laufen kostenlos auf diesem Rechner. Dafür braucht es Ollama und zwei Modelle.",
    baue(el) {
      const zeichneOllama = () => {
        laedt(el, "Frage Ollama nach seinen Modellen …");
        holeJson("/api/ai/ollama").then((o) => {
          el.innerHTML = "";
          if (!o.laeuft) {
            el.appendChild(statusZeile("Ollama läuft nicht", "fehlt"));
            el.appendChild(absatz(
              "Ollama installieren (einmalig): im Terminal <code>winget install Ollama.Ollama</code> oder von " +
              "<a href=\"https://ollama.com/download\" target=\"_blank\" rel=\"noopener\">ollama.com/download</a>. Danach Ollama starten und hier neu prüfen."));
            el.appendChild(knopf("Neu prüfen", { klick: zeichneOllama }));
            return;
          }
          el.appendChild(statusZeile(`Ollama läuft · ${o.modelle.length} Modelle`, "ok"));
          for (const [rolle, e] of Object.entries(EMPFEHLUNG)) {
            const da = o.modelle.some((m) => m.name === e.modell);
            const z = document.createElement("div");
            z.className = "einr-modell";
            z.innerHTML = `<div><b>${escape(e.modell)}</b> — empfohlen für ${rolle === "recherche" ? "Recherche" : "Kontextabgleich"}<br><span class="einr-feld-hilfe">${escape(e.warum)}</span></div>`;
            if (da) z.appendChild(statusZeile("vorhanden", "ok"));
            else {
              const stand = document.createElement("span");
              stand.className = "einr-feld-hilfe";
              z.appendChild(knopf("Laden", {
                klick: async (ev) => {
                  ev.currentTarget.disabled = true;
                  await ladeModell(e.modell, (t) => (stand.textContent = t));
                  zeichneOllama();
                },
              }));
              z.appendChild(stand);
            }
            el.appendChild(z);
          }
        });
      };
      zeichneOllama();
    },
  },
  {
    titel: "KI-Rollen verteilen",
    satz: "Jede KI-Aufgabe läuft über das Modell ihrer Rolle. Der Vorschlag ist vorausgewählt — gespeichert wird im Board (Drive), nicht im Browser.",
    baue(el, { setzeWeiter }) {
      laedt(el, "Lese verfügbare Modelle …");
      holeJson("/api/ai/ollama").then((o) => {
        el.innerHTML = "";
        const lokale = (o.modelle || []).map((m) => m.name);
        const rollen = [
          ["userkomm", "Userkommunikation", "Texte, die du siehst und veröffentlichst", { provider: "claude", claudeModell: "haiku" }],
          ["recherche", "Recherche", "Fakten sammeln, mit Web-Suche", { provider: "ollama", ollamaModel: EMPFEHLUNG.recherche.modell }],
          ["kontext", "Kontextabgleich", "Texte mit dem Firmenkontext abgleichen", { provider: "ollama", ollamaModel: EMPFEHLUNG.kontext.modell }],
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
          const akt = rolleKonfig(id);
          const vor = vorschlag.provider === "claude" ? `claude:${vorschlag.claudeModell}` : `ollama:${vorschlag.ollamaModel}`;
          const jetzt = akt.provider === "claude" ? `claude:${akt.claudeModell}` : `ollama:${akt.ollamaModel}`;
          const gewaehlt = optionen.some(([v]) => v === vor) ? vor : optionen.some(([v]) => v === jetzt) ? jetzt : "claude:haiku";
          sel.innerHTML = optionen.map(([v, t]) => `<option value="${escape(v)}"${v === gewaehlt ? " selected" : ""}>${escape(t)}</option>`).join("");
          wahl[id] = sel;
          el.appendChild(feldBlock(name, sel, wozu));
        }
        setzeWeiter(async () => {
          for (const [id, sel] of Object.entries(wahl)) {
            const [provider, modell] = sel.value.split(/:(.+)/);
            setzeRolleKonfig(id, provider === "claude" ? { provider, claudeModell: modell } : { provider, ollamaModel: modell });
          }
          return true;
        });
      });
    },
  },
  {
    titel: "Wer seid ihr? (Firmenkontext)",
    satz: "Diese Angaben gehen in jeden Text, den die KI schreibt. Kurz und konkret reicht — du kannst sie jederzeit in Einstellungen → Unternehmenskontext ändern.",
    baue(el, { setzeWeiter }) {
      laedt(el, "Lese den vorhandenen Firmenkontext …");
      holeJson("/api/kontext").then((k) => {
        el.innerHTML = "";
        const vorhanden = (k.firma && k.firma.text) || "";
        if (vorhanden) {
          const t = textfeld(vorhanden, 12);
          el.appendChild(feldBlock("Firmenkontext (vorhanden)", t, "Schon ausgefüllt — prüfen und bei Bedarf ergänzen."));
          setzeWeiter(async () => { await putJson("/api/kontext", { was: "firma-text", text: t.value }); return true; });
          return;
        }
        const felder = {};
        for (const [id, frage, hilfe] of FIRMA_FRAGEN) {
          felder[id] = textfeld("", 2, hilfe);
          el.appendChild(feldBlock(frage, felder[id]));
        }
        setzeWeiter(async () => {
          const text = FIRMA_FRAGEN.filter(([id]) => felder[id].value.trim())
            .map(([id, frage]) => `## ${frage}\n${felder[id].value.trim()}`).join("\n\n");
          if (text) await putJson("/api/kontext", { was: "firma-text", text });
          return true;
        });
      });
    },
  },
  {
    titel: "System-Prompts",
    satz: "Jeder KI-Knopf hat einen Prompt. Die Reihenfolge folgt dem Ablauf einer Karte — jeder Prompt baut auf dem vorigen auf. Standard übernehmen ist ein guter Start.",
    baue(el, { setzeWeiter }) {
      laedt(el, "Lese die Prompts …");
      holeJson("/api/prompts").then((p) => {
        const nachId = Object.fromEntries((p.aufgaben || []).map((a) => [a.id, a]));
        const legende = { ...(p.system?.platzhalter || {}), ...((p.aufgaben || [])[0]?.platzhalter || {}) };
        const rolleName = Object.fromEntries((p.rollen || []).map((r) => [r.id, r.name]));
        const reihe = PROMPT_REIHE.filter(([id]) => id === "system" || nachId[id]);
        let i = 0;
        const zeichneEinen = () => {
          el.innerHTML = "";
          const [id, wozu] = reihe[i];
          const a = id === "system" ? p.system : nachId[id];
          const kopf = document.createElement("div");
          kopf.className = "einr-prompt-kopf";
          kopf.innerHTML =
            `<div class="einr-zaehler">Prompt ${i + 1} von ${reihe.length}</div>` +
            `<div class="einr-prompt-name">${escape(a.name || id)}</div>` +
            `<p class="einr-text">${escape(wozu)}</p>` +
            (a.knopf || a.ort ? `<p class="einr-feld-hilfe">Knopf: ${escape(a.knopf || "—")} · Ort: ${escape(a.ort || "—")}</p>` : "");
          el.appendChild(kopf);
          const texte = [];
          if (id === "system") {
            const t = textfeld(a.vorlage || "", 10);
            texte.push(t);
            el.appendChild(feldBlock("System-Vorspann", t));
          } else {
            (a.schritte || []).forEach((s, j) => {
              const t = textfeld(s.prompt || "", 8);
              texte.push(t);
              el.appendChild(feldBlock(`Schritt ${j + 1} · ${rolleName[s.rolle] || s.rolle}${s.websuche ? " · mit Web-Suche" : ""}`, t));
            });
          }
          const benutzt = [...new Set(texte.flatMap((t) => [...t.value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])))];
          if (benutzt.length)
            el.appendChild(absatz("Platzhalter, die das Board einsetzt: " +
              benutzt.map((x) => `<code>{{${escape(x)}}}</code> ${escape(legende[x] || "")}`).join(" · "), "einr-feld-hilfe"));
          const nav = document.createElement("div");
          nav.className = "einr-prompt-nav";
          if (i > 0) nav.appendChild(knopf("Voriger Prompt", { klick: () => { i--; zeichneEinen(); } }));
          el.appendChild(nav);
          setzeWeiter(async () => {
            const geaendert = id === "system"
              ? texte[0].value !== (a.vorlage || "")
              : texte.some((t, j) => t.value !== (a.schritte[j].prompt || ""));
            if (geaendert) {
              const body = id === "system" ? { id, text: texte[0].value }
                : { id, schritte: a.schritte.map((s, j) => ({ ...s, prompt: texte[j].value })) };
              const r = await putJson("/api/prompts", body);
              if (!r.ok) { el.appendChild(absatz("Speichern fehlgeschlagen — bitte erneut versuchen.", "einr-warn")); return false; }
            }
            if (i < reihe.length - 1) { i++; zeichneEinen(); return false; } // im Schritt bleiben, naechster Prompt
            return true;
          });
        };
        zeichneEinen();
      });
    },
  },
  {
    titel: "Redaktionsplan",
    satz: "Wie oft soll was erscheinen? Danach richten sich die vorgeschlagenen Upload-Termine und die Wochenprüfung oben im Board.",
    baue(el) {
      el.appendChild(absatz("Lege Plattformen, Posts pro Woche je Format und den maximalen Abstand fest. Der Dialog öffnet sich über dem Assistenten; danach hier mit „Weiter“."));
      el.appendChild(knopf("Redaktionsplan öffnen", { art: "haupt", klick: () => zeigeRedaktionsplan() }));
    },
  },
  {
    titel: "Fertig",
    satz: "Das Board ist eingerichtet. Übersprungenes kannst du jederzeit in den Einstellungen nachholen.",
    letzter: true,
    // Kein „erledigt", weil „Weiter" gedrueckt wurde — der Stand wird hier echt nachgeprueft.
    baue(el) {
      laedt(el, "Prüfe, was jetzt eingerichtet ist …");
      Promise.all([
        holeJson("/api/board/name").catch(() => ({})),
        holeJson("/api/verbindungen/status").catch(() => ({})),
        holeJson("/api/ai/ollama").catch(() => ({})),
        holeJson("/api/kontext").catch(() => ({})),
      ]).then(([n, s, o, k]) => {
        const g = s.google || {};
        const c = s.claude || {};
        const fehlend = Object.values(EMPFEHLUNG).map((e) => e.modell).filter((m) => !(o.modelle || []).some((x) => x.name === m));
        const rollen = ["userkomm", "recherche", "kontext"].map((r) => {
          const x = rolleKonfig(r);
          return x.provider === "claude" ? `Claude ${x.claudeModell}` : x.ollamaModel;
        });
        const zeilen = [
          [!!n.name, `Name: ${n.name || "nicht lesbar"}`],
          [g.zustand === "live", `Google Kalender + Tasks: ${g.zustand === "live" ? `verbunden${g.email ? ` als ${g.email}` : ""}` : g.hinweis || "nicht verbunden"}`],
          [!!c.verbunden, `Claude: ${c.verbunden ? `angemeldet${c.email ? ` als ${c.email}` : ""}` : "nicht angemeldet"}`],
          [o.laeuft && !fehlend.length, `Lokale KI: ${!o.laeuft ? "Ollama läuft nicht" : fehlend.length ? `es fehlt ${fehlend.join(", ")}` : "bereit"}`],
          [true, `KI-Rollen: Userkommunikation ${rollen[0]} · Recherche ${rollen[1]} · Kontextabgleich ${rollen[2]}`],
          [!!(k.firma && k.firma.text), `Firmenkontext: ${k.firma && k.firma.text ? `${k.firma.text.length} Zeichen` : "leer — die KI schreibt ohne Firmenwissen"}`],
        ];
        el.innerHTML = "";
        el.appendChild(absatz(`<ul class="einr-liste">${zeilen.map(([ok, t]) => `<li class="${ok ? "ok" : "weg"}">${ok ? "✓" : "○"} ${escape(t)}</li>`).join("")}</ul>`));
        if (zeilen.some(([ok]) => !ok)
        ) el.appendChild(absatz("Offenes lässt sich in Einstellungen → Externe Dienste nachholen; dort startet auch dieser Assistent erneut.", "einr-feld-hilfe"));
      });
    },
  },
];

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
