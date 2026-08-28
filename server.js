// Lokaler Server der Content-Maschine.
// Bewusst ohne Abhaengigkeiten: nur Node-Bordmittel.
//
// Diese Datei ist reine Wegweisung. Was die Sache selbst ausmacht, liegt in lib/:
//   pipeline.js  Phasen, Termine, Karten-Schema, Qualitaetstore (laeuft auch im Browser)
//   drive.js     rclone-Anbindung, trennt "gibt es nicht" von "geht gerade nicht"
//   projects.js  Projektordner anlegen, verschieben, lesen — und der Abgleich
//   ai.js        Prompts und die Claude-CLI
//   social.js    Instagram- und LinkedIn-Zahlen

import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import * as pipeline from "./lib/pipeline.js";
import * as drive from "./lib/drive.js";
import * as projekte from "./lib/projects.js";
import * as ki from "./lib/ai.js";
import * as social from "./lib/social.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const DATA_DIR = join(__dirname, "data");
const BOARD_FILE = join(DATA_DIR, "board.json");
const TOKEN_FILE = join(DATA_DIR, "tokens.json");
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
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

    // ---- KI --------------------------------------------------------------

    if (pfad === "/api/ai" && req.method === "POST") {
      const { task, card } = JSON.parse(await readBody(req));
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
        const text = await ki.runClaude(ki.MARKE_REGELN + kontextBlock + "\n\n---\n\n" + bauen(card || {}));
        const data = ki.JSON_AUFGABEN.has(task) ? ki.parseJson(text) : null;
        sendJson(res, 200, { text, data });
      } catch (e) {
        sendJson(res, 502, { error: e.message, hint: ki.hinweisZuFehler(e) });
      }
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

    // ---- OAuth: Instagram ------------------------------------------------

    if (pfad === "/api/auth/instagram" && req.method === "GET") {
      const appId = process.env.INSTAGRAM_APP_ID;
      if (!appId) {
        sendJson(res, 500, { error: "INSTAGRAM_APP_ID fehlt in .env" });
        return;
      }
      const p = new URLSearchParams({
        client_id: appId,
        redirect_uri: `http://localhost:${PORT}/api/auth/instagram/callback`,
        scope: "instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement",
        response_type: "code",
      });
      umleitung(res, `https://www.facebook.com/v21.0/dialog/oauth?${p}`);
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
        const redirectUri = `http://localhost:${PORT}/api/auth/instagram/callback`;
        const base = "https://graph.facebook.com/v21.0";

        const kurz = await (
          await fetch(
            `${base}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
          )
        ).json();
        if (kurz.error) throw new Error(kurz.error.message);

        const lang = await (
          await fetch(
            `${base}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${kurz.access_token}`
          )
        ).json();
        const userToken = lang.access_token || kurz.access_token;

        const seiten = await (await fetch(`${base}/me/accounts?access_token=${userToken}`)).json();
        if (!seiten.data?.length)
          throw new Error("Keine Facebook-Seite gefunden. Zuerst eine Facebook-Seite mit dem Instagram-Konto verknuepfen.");

        const seite = seiten.data[0];
        const seitenToken = seite.access_token;
        const igDaten = await (
          await fetch(`${base}/${seite.id}?fields=instagram_business_account&access_token=${seitenToken}`)
        ).json();
        if (!igDaten.instagram_business_account)
          throw new Error("Mit dieser Facebook-Seite ist kein Instagram-Konto fuer Unternehmen oder Creator verknuepft.");

        const igUserId = igDaten.instagram_business_account.id;
        const info = await (await fetch(`${base}/${igUserId}?fields=username&access_token=${seitenToken}`)).json();
        await speichereToken("instagram", { accessToken: seitenToken, igUserId, username: info.username || "" });
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
        redirect_uri: `http://localhost:${PORT}/api/auth/linkedin/callback`,
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
        const redirectUri = `http://localhost:${PORT}/api/auth/linkedin/callback`;
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
});

await ladeEnv();
server.listen(PORT, () => {
  console.log(`Content-Maschine laeuft auf http://localhost:${PORT}`);
});
