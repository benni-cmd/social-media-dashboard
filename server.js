// Lokaler Server der Content-Maschine.
// Bewusst ohne Abhaengigkeiten: nur Node-Bordmittel.
//
// Diese Datei ist reine Wegweisung. Was die Sache selbst ausmacht, liegt in lib/:
//   pipeline.js  Phasen, Termine, Karten-Schema, Qualitaetstore (laeuft auch im Browser)
//   drive.js     rclone-Anbindung, trennt "gibt es nicht" von "geht gerade nicht"
//   projects.js  Projektordner anlegen, verschieben, lesen — und der Abgleich
//   ai.js        Prompts und die Claude-CLI
//   social.js    Instagram- und LinkedIn-Zahlen

import { createServer as createHttpsServer } from "node:https";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { execSync } from "node:child_process";

import * as pipeline from "./lib/pipeline.js";
import * as drive from "./lib/drive.js";
import * as projekte from "./lib/projects.js";
import * as ki from "./lib/ai.js";
import * as social from "./lib/social.js";
import * as kpi from "./lib/kpi.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const DATA_DIR = join(__dirname, "data");
const BOARD_FILE = join(DATA_DIR, "board.json");
const TOKEN_FILE = join(DATA_DIR, "tokens.json");
const DEFAULTS_FILE = join(DATA_DIR, "defaults.json");
const PLAN_FILE = join(DATA_DIR, "plan.json");
const PUBLIC_DIR = join(__dirname, "public");
const LIB_DIR = join(__dirname, "lib");

// --- .env laden (ohne dotenv-Paket) --------------------------------------
async function ladeEnv() {
  try {
    const inhalt = await readFile(join(__dirname, ".env"), "utf8");
    for (const zeile of inhalt.split("\n")) {
      const m = zeile.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* keine .env vorhanden */
  }
}

// --- Board lesen und schreiben -------------------------------------------
//
// Geschrieben wird ueber eine Zwischendatei und mit Versionsnummer: zwei offene Tabs
// koennen sich damit nicht mehr gegenseitig ueberschreiben (Befund B12).

async function leseBoard() {
  try {
    const roh = JSON.parse(await readFile(BOARD_FILE, "utf8"));
    const cards = (roh.cards || []).map(pipeline.migriere);
    return { version: roh.version || 1, cards };
  } catch {
    return { version: 1, cards: [] };
  }
}

async function schreibeBoard(cards, version) {
  await mkdir(DATA_DIR, { recursive: true });
  const inhalt = JSON.stringify({ version, cards }, null, 2);
  const temp = BOARD_FILE + ".tmp";
  await writeFile(temp, inhalt, "utf8");
  await rename(temp, BOARD_FILE);
}

async function leseTokens() {
  try {
    return JSON.parse(await readFile(TOKEN_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function speichereToken(plattform, daten) {
  const t = await leseTokens();
  t[plattform] = { ...daten, verbundenAm: new Date().toISOString() };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(t, null, 2), "utf8");
}

// --- kleine Helfer --------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const umleitung = (res, ziel) => {
  res.writeHead(302, { location: ziel });
  res.end();
};

// Liest den Kontext aus Drive (global und je Reihe) fuer die Prompt-Anreicherung.
async function leseKontext(serie) {
  const ordner = ["Kontext/_global"];
  if (serie) ordner.push(`Kontext/${serie}`);
  const teile = [];
  for (const o of ordner) {
    let dateien = [];
    try {
      dateien = await drive.list(o, { filesOnly: true });
    } catch {
      continue; // Kontext ist Beiwerk; eine Stoerung darf den KI-Aufruf nicht verhindern.
    }
    for (const d of dateien) {
      if (!/\.(md|txt)$/i.test(d)) continue;
      try {
        const inhalt = await drive.readFile(`${o}/${d}`);
        if (inhalt.trim()) teile.push(`# Kontext: ${o}/${d}\n${inhalt.trim()}`);
      } catch {
        /* einzelne Datei unlesbar — der Rest zaehlt trotzdem */
      }
    }
  }
  return teile.join("\n\n");
}

// --- Wegweisung -----------------------------------------------------------

async function handler(req, res) {
  aktivitaetGemeldet();
  try {
    const url = new URL(req.url, `https://localhost:${PORT}`);
    const pfad = url.pathname;

    // ---- Board ----------------------------------------------------------

    if (pfad === "/api/board" && req.method === "GET") {
      const board = await leseBoard();
      sendJson(res, 200, { ...board, phasen: pipeline.PHASEN });
      return;
    }

    if (pfad === "/api/board" && req.method === "PUT") {
      const { cards, version } = JSON.parse(await readBody(req));
      if (!Array.isArray(cards)) {
        sendJson(res, 400, { error: "Das Board braucht eine Liste von Karten." });
        return;
      }
      const aktuell = await leseBoard();
      if (version != null && version !== aktuell.version) {
        // Jemand anderes war schneller. Nicht ueberschreiben, sondern melden.
        sendJson(res, 409, {
          error: "Der Board-Stand hat sich zwischenzeitlich geaendert.",
          satz: "Ein anderes Fenster hat gespeichert. Lade den Stand neu, damit nichts verloren geht.",
          aktuell,
        });
        return;
      }
      const neueVersion = aktuell.version + 1;
      await schreibeBoard(cards.map(pipeline.migriere), neueVersion);
      sendJson(res, 200, { ok: true, version: neueVersion });
      return;
    }

    // ---- Benutzer-Defaults ------------------------------------------------

    if (pfad === "/api/defaults" && req.method === "GET") {
      try {
        const roh = JSON.parse(await readFile(DEFAULTS_FILE, "utf8"));
        sendJson(res, 200, roh);
      } catch {
        sendJson(res, 200, {});
      }
      return;
    }

    if (pfad === "/api/defaults" && req.method === "PUT") {
      const daten = JSON.parse(await readBody(req));
      await mkdir(DATA_DIR, { recursive: true });
      let alt = {};
      try { alt = JSON.parse(await readFile(DEFAULTS_FILE, "utf8")); } catch {}
      const neu = { ...alt, ...daten };
      await writeFile(DEFAULTS_FILE, JSON.stringify(neu, null, 2), "utf8");
      sendJson(res, 200, { ok: true, defaults: neu });
      return;
    }

    // ---- Redaktionsplan --------------------------------------------------

    if (pfad === "/api/plan" && req.method === "GET") {
      try {
        const roh = JSON.parse(await readFile(PLAN_FILE, "utf8"));
        sendJson(res, 200, roh);
      } catch {
        sendJson(res, 200, pipeline.defaultPlan());
      }
      return;
    }

    if (pfad === "/api/plan" && req.method === "PUT") {
      const daten = JSON.parse(await readBody(req));
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(PLAN_FILE, JSON.stringify(daten, null, 2), "utf8");
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pfad === "/api/plan/slot" && req.method === "PUT") {
      const { slotId, karteId } = JSON.parse(await readBody(req));
      let plan;
      try { plan = JSON.parse(await readFile(PLAN_FILE, "utf8")); } catch { plan = pipeline.defaultPlan(); }
      const slot = (plan.slots || []).find((s) => s.id === slotId);
      if (!slot) { sendJson(res, 404, { error: "Slot nicht gefunden." }); return; }
      slot.karteId = karteId || null;
      await writeFile(PLAN_FILE, JSON.stringify(plan, null, 2), "utf8");
      sendJson(res, 200, { ok: true, slot });
      return;
    }

    // ---- KI --------------------------------------------------------------

    if (pfad === "/api/ai" && req.method === "POST") {
      const { task, card, provider = "claude", ollamaModel = "llama3.2" } = JSON.parse(await readBody(req));
      const bauen = ki.AUFGABEN[task];
      if (!bauen) {
        sendJson(res, 400, { error: `Unbekannte KI-Aufgabe: ${task}` });
        return;
      }
      try {
        let kontextBlock = "";
        if (card && card.serie && ["recherche", "skript", "regieplan"].includes(task)) {
          const kt = await leseKontext(pipeline.slug(card.serie)).catch(() => "");
          if (kt) kontextBlock = `\n\n--- Projekt-Kontext (aus Drive) ---\n${kt}`;
        }
        const userMsg = kontextBlock + "\n\n---\n\n" + bauen(card || {});
        let text;
        if (provider === "ollama") {
          text = await ki.runOllama(ki.MARKE_REGELN, userMsg, ollamaModel);
        } else {
          text = await ki.runClaude(ki.MARKE_REGELN + userMsg);
        }
        const data = ki.JSON_AUFGABEN.has(task) ? ki.parseJson(text) : null;
        sendJson(res, 200, { text, data });
      } catch (e) {
        sendJson(res, 502, { error: e.message, hint: ki.hinweisZuFehler(e, provider) });
      }
      return;
    }

    // Gleiche Aufgabe, aber der Text kommt live: NDJSON-Zeilen {t:"delta"|"status"|"done"|"error"}.
    if (pfad === "/api/ai/stream" && req.method === "POST") {
      const { task, card, provider = "claude", ollamaModel = "llama3.2" } = JSON.parse(await readBody(req));
      const bauen = ki.AUFGABEN[task];
      if (!bauen) {
        sendJson(res, 400, { error: `Unbekannte KI-Aufgabe: ${task}` });
        return;
      }
      res.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
      });
      const schreib = (o) => res.write(JSON.stringify(o) + "\n");
      try {
        let kontextBlock = "";
        if (card && card.serie && ["recherche", "hooks_verbal", "hooks_visuell", "skript", "regieplan"].includes(task)) {
          const kt = await leseKontext(pipeline.slug(card.serie)).catch(() => "");
          if (kt) kontextBlock = `\n\n--- Projekt-Kontext (aus Drive) ---\n${kt}`;
        }
        const userMsg = kontextBlock + "\n\n---\n\n" + bauen(card || {});
        let text;
        if (provider === "ollama") {
          text = await ki.runOllamaStream(ki.MARKE_REGELN, userMsg, ollamaModel, (delta) => {
            if (delta) schreib({ t: "delta", text: delta });
          });
        } else {
          const prompt = ki.MARKE_REGELN + userMsg;
          text = await ki.runClaudeStream(prompt, (delta, status) => {
            if (delta) schreib({ t: "delta", text: delta });
            if (status) schreib({ t: "status", text: status });
          });
        }
        const data = ki.JSON_AUFGABEN.has(task) ? ki.parseJson(text) : null;
        schreib({ t: "done", text, data });
      } catch (e) {
        schreib({ t: "error", error: e.message, hint: ki.hinweisZuFehler(e, provider) });
      }
      res.end();
      return;
    }

    if (pfad === "/api/ai/ping-ollama" && req.method === "POST") {
      const { model = "llama3.2" } = JSON.parse(await readBody(req));
      sendJson(res, 200, await ki.pingOllama(model));
      return;
    }

    // ---- Drive -----------------------------------------------------------

    if (pfad === "/api/drive/status" && req.method === "GET") {
      sendJson(res, 200, await drive.erreichbar());
      return;
    }

    if (pfad === "/api/drive/create" && req.method === "POST") {
      const card = JSON.parse(await readBody(req));
      sendJson(res, 200, await projekte.anlegen(card));
      return;
    }

    if (pfad === "/api/drive/move" && req.method === "POST") {
      const { card, ziel } = JSON.parse(await readBody(req));
      sendJson(res, 200, await projekte.verschiebe(card, ziel));
      return;
    }

    if (pfad === "/api/drive/scan" && req.method === "POST") {
      const card = JSON.parse(await readBody(req));
      sendJson(res, 200, await projekte.scan(card));
      return;
    }

    if (pfad === "/api/drive/save" && req.method === "POST") {
      const { card, filename, content } = JSON.parse(await readBody(req));
      // Der Dateiname kommt aus dem Browser — vorher ungeprueft, was in Drive echte
      // Ordner namens ".." erzeugte (Befund B3).
      if (!pipeline.pfadstueckOk(filename)) {
        sendJson(res, 400, {
          error: "Unzulaessiger Dateiname.",
          satz: "Ein Dateiname darf keine Schraegstriche und keine Punkt-Ordner enthalten.",
        });
        return;
      }
      const ziel = await projekte.speichereDatei(card, filename, content ?? "");
      sendJson(res, 200, { ok: true, pfad: ziel });
      return;
    }

    if (pfad === "/api/drive/reconcile" && req.method === "POST") {
      const aktuell = await leseBoard();
      const { cards, befunde, geaendert } = await projekte.abgleich(aktuell.cards);
      let version = aktuell.version;
      if (geaendert) {
        version = aktuell.version + 1;
        await schreibeBoard(cards, version);
      }
      sendJson(res, 200, { cards, befunde, geaendert, version });
      return;
    }

    if (pfad === "/api/drive/kontext" && req.method === "GET") {
      const text = await leseKontext(pipeline.slug(url.searchParams.get("serie") || "")).catch(() => "");
      sendJson(res, 200, { text });
      return;
    }

    // ---- OAuth: Instagram (Weg B — Instagram Login, keine Facebook-Seite noetig) ---

    if (pfad === "/api/auth/instagram" && req.method === "GET") {
      const appId = process.env.INSTAGRAM_APP_ID;
      if (!appId) {
        sendJson(res, 500, { error: "INSTAGRAM_APP_ID fehlt in .env" });
        return;
      }
      const p = new URLSearchParams({
        client_id: appId,
        redirect_uri: `https://localhost:${PORT}/api/auth/instagram/callback`,
        scope: "instagram_business_basic,instagram_business_manage_insights",
        response_type: "code",
      });
      umleitung(res, `https://www.instagram.com/oauth/authorize?${p}`);
      return;
    }

    if (pfad === "/api/auth/instagram/callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      if (!code) {
        umleitung(
          res,
          `/?fehler=${encodeURIComponent(url.searchParams.get("error_description") || "Verbindung abgebrochen")}`
        );
        return;
      }
      try {
        const appId = process.env.INSTAGRAM_APP_ID;
        const appSecret = process.env.INSTAGRAM_APP_SECRET;
        const redirectUri = `https://localhost:${PORT}/api/auth/instagram/callback`;

        // Kurzzeit-Token (1 Stunde) — liefert auch die user_id direkt mit.
        const kurzRes = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
          }),
        });
        const kurz = await kurzRes.json();
        if (kurz.error_message) throw new Error(kurz.error_message);
        if (!kurz.access_token) throw new Error("Kein Token erhalten. Ist der Account als Tester eingeladen und akzeptiert?");

        // Langzeit-Token (60 Tage).
        const langRes = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${kurz.access_token}`
        );
        const lang = await langRes.json();
        const accessToken = lang.access_token || kurz.access_token;
        // Nutzername und echte ID holen (user_id aus dem Token-Tausch kann abweichen).
        const infoRes = await fetch(
          `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${accessToken}`
        );
        const info = await infoRes.json();
        const igUserId = String(info.user_id || info.id || kurz.user_id);

        await speichereToken("instagram", { accessToken, igUserId, username: info.username || "" });
        umleitung(res, "/?verbunden=instagram");
      } catch (e) {
        umleitung(res, `/?fehler=${encodeURIComponent(e.message)}`);
      }
      return;
    }

    // ---- OAuth: LinkedIn -------------------------------------------------

    if (pfad === "/api/auth/linkedin" && req.method === "GET") {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      if (!clientId) {
        sendJson(res, 500, { error: "LINKEDIN_CLIENT_ID fehlt in .env" });
        return;
      }
      const p = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: `https://localhost:${PORT}/api/auth/linkedin/callback`,
        scope: "r_organization_social rw_organization_admin",
        state: "li_" + Date.now(),
      });
      umleitung(res, `https://www.linkedin.com/oauth/v2/authorization?${p}`);
      return;
    }

    if (pfad === "/api/auth/linkedin/callback" && req.method === "GET") {
      const code = url.searchParams.get("code");
      if (!code) {
        umleitung(res, `/?fehler=${encodeURIComponent("LinkedIn-Verbindung abgebrochen")}`);
        return;
      }
      try {
        const redirectUri = `https://localhost:${PORT}/api/auth/linkedin/callback`;
        const tok = await (
          await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
              client_id: process.env.LINKEDIN_CLIENT_ID,
              client_secret: process.env.LINKEDIN_CLIENT_SECRET,
            }),
          })
        ).json();
        if (tok.error) throw new Error(tok.error_description || tok.error);

        const accessToken = tok.access_token;
        const headers = {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202601",
          "X-Restli-Protocol-Version": "2.0.0",
        };
        const orgs = await (
          await fetch(
            "https://api.linkedin.com/rest/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&count=5",
            { headers }
          )
        ).json();
        const liste = orgs.elements || [];
        if (!liste.length) throw new Error("Keine LinkedIn-Unternehmensseite mit Administratorrolle gefunden.");

        const orgUrn = liste[0].organizationalTarget;
        const orgId = orgUrn?.split(":").pop() || "";
        const name = await (
          await fetch(`https://api.linkedin.com/rest/organizations/${orgId}`, { headers })
        ).json();

        await speichereToken("linkedin", { accessToken, orgUrn, orgId, orgName: name.localizedName || orgId });
        umleitung(res, "/?verbunden=linkedin");
      } catch (e) {
        umleitung(res, `/?fehler=${encodeURIComponent(e.message)}`);
      }
      return;
    }

    // ---- Zahlen ----------------------------------------------------------

    if (pfad === "/api/stats/instagram" && req.method === "GET") {
      const ig = (await leseTokens()).instagram;
      if (!ig) {
        sendJson(res, 200, { verbunden: false });
        return;
      }
      try {
        sendJson(res, 200, await social.instagramZahlen(ig));
      } catch (e) {
        sendJson(res, 200, { verbunden: true, fehler: e.message, hinweis: social.hinweisZuFehler("Instagram", e) });
      }
      return;
    }

    if (pfad === "/api/stats/linkedin" && req.method === "GET") {
      const li = (await leseTokens()).linkedin;
      if (!li) {
        sendJson(res, 200, { verbunden: false });
        return;
      }
      try {
        sendJson(res, 200, await social.linkedinZahlen(li));
      } catch (e) {
        sendJson(res, 200, { verbunden: true, fehler: e.message, hinweis: social.hinweisZuFehler("LinkedIn", e) });
      }
      return;
    }

    // ---- KPI-Erfassung ----------------------------------------------------

    if (pfad === "/api/kpi/status" && req.method === "GET") {
      const board = await leseBoard();
      sendJson(res, 200, kpi.status(board.cards));
      return;
    }

    if (pfad === "/api/kpi/collect" && req.method === "POST") {
      const board = await leseBoard();
      const tokens = await leseTokens();
      const ergebnis = await kpi.sammle(board.cards, tokens);
      if (ergebnis.gesammelt > 0) {
        const neueVersion = board.version + 1;
        await schreibeBoard(ergebnis.cards, neueVersion);
      }
      sendJson(res, 200, { gesammelt: ergebnis.gesammelt, bericht: ergebnis.bericht });
      return;
    }

    // ---- Dateien ---------------------------------------------------------
    //
    // lib/ wird mit ausgeliefert: pipeline.js laeuft im Browser genauso wie hier.

    const wurzel = pfad.startsWith("/lib/") ? LIB_DIR : PUBLIC_DIR;
    const rel = pfad === "/" ? "index.html" : pfad.replace(/^\/(lib\/)?/, "");
    const datei = join(wurzel, normalize(rel));
    // Nach dem Zusammensetzen pruefen, dass der Pfad die Wurzel nicht verlassen hat.
    if (!datei.startsWith(wurzel + sep)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("Nicht erlaubt.");
      return;
    }
    try {
      const daten = await readFile(datei);
      res.writeHead(200, { "content-type": MIME[extname(datei)] || "application/octet-stream" });
      res.end(daten);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Nicht gefunden.");
    }
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
}

// --- Selbstsigniertes Zertifikat (Meta und LinkedIn verlangen https fuer Redirect-URIs) ---
async function ladeTls() {
  const keyFile = join(DATA_DIR, "localhost.key");
  const certFile = join(DATA_DIR, "localhost.crt");
  try {
    return { key: await readFile(keyFile), cert: await readFile(certFile) };
  } catch {
    console.log("Erzeuge selbstsigniertes Zertifikat …");
    await mkdir(DATA_DIR, { recursive: true });
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" ` +
      `-days 365 -nodes -subj "/CN=localhost"`,
      { stdio: "pipe" }
    );
    return { key: await readFile(keyFile), cert: await readFile(certFile) };
  }
}

await ladeEnv();

const tls = await ladeTls();
const server = createHttpsServer(tls, handler);
// --- Auto-Shutdown nach 1 Stunde Inaktivitaet ----------------------------

const IDLE_LIMIT_MS = 60 * 60 * 1000;
let letzteAktivitaet = Date.now();

function aktivitaetGemeldet() {
  letzteAktivitaet = Date.now();
}

async function ollamaEntladen() {
  try {
    const res = await fetch("http://localhost:11434/api/ps");
    if (!res.ok) return;
    const { models } = await res.json();
    for (const m of (models || [])) {
      await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: m.name, keep_alive: 0 }),
      }).catch(() => {});
    }
    if ((models || []).length) console.log("Ollama: Modelle entladen.");
  } catch { /* Ollama war nicht aktiv */ }
}

setInterval(async () => {
  if (Date.now() - letzteAktivitaet >= IDLE_LIMIT_MS) {
    console.log("Auto-Shutdown: 1 Stunde keine Aktivitaet.");
    await ollamaEntladen();
    process.exit(0);
  }
}, 5 * 60 * 1000);

server.listen(PORT, async () => {
  console.log(`Content-Maschine laeuft auf https://localhost:${PORT}`);
  try {
    const board = await leseBoard();
    const faellig = kpi.pruefeKarten(board.cards);
    if (faellig.length) {
      const anzahl = faellig.reduce((s, f) => s + f.ausstehend.length, 0);
      console.log(`KPI: ${anzahl} faellige Messung(en) fuer ${faellig.length} Post(s). POST /api/kpi/collect zum Erfassen.`);
    }
  } catch { /* KPI-Pruefung darf den Start nicht blockieren */ }
});
