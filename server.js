// Lokaler Server des Content-Pipeline-Boards.
// Bewusst ohne Abhaengigkeiten: nur Node-Bordmittel (http, fs, child_process).
// Drei Aufgaben: statische Dateien ausliefern, den Board-Stand lesen/speichern,
// und KI-Aktionen ueber die lokale Claude-Code-CLI (`claude -p`) ausfuehren —
// so laeuft die KI ueber das Abo, nicht ueber die kostenpflichtige API.

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const BOARD_FILE = join(__dirname, "data", "board.json");
const PUBLIC_DIR = join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// --- KI-Aufgaben: fester Katalog. Jede baut aus dem Karten-Inhalt einen Prompt. ---
const AI_TASKS = {
  skript: (card) =>
    `Du bist Kurzvideo-Autor fuer Instagram Reels und LinkedIn. Schreibe aus dieser Idee ` +
    `ein knappes Skript (Hook, 3-4 Kernpunkte, Call-to-Action), maximal 45 Sekunden ` +
    `Sprechzeit, auf Deutsch.\n\nTitel: ${card.title}\nNotizen: ${card.notes || "(keine)"}`,
  caption: (card) =>
    `Schreibe eine Caption fuer Instagram und LinkedIn zu diesem Content. Erst ein ` +
    `packender erster Satz, dann 2-3 Saetze Kontext, am Ende 5-8 passende Hashtags. ` +
    `Auf Deutsch.\n\nTitel: ${card.title}\nNotizen: ${card.notes || "(keine)"}`,
  hooks: (card) =>
    `Gib fuenf verschiedene starke Hooks (erste 3 Sekunden) fuer ein Kurzvideo zu diesem ` +
    `Thema. Nummeriert, je eine Zeile, auf Deutsch.\n\nTitel: ${card.title}\nNotizen: ${
      card.notes || "(keine)"
    }`,
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

// Ruft die lokale Claude-Code-CLI im Headless-Modus auf. Der Prompt geht ueber stdin,
// damit keine Anfuehrungszeichen/Umbrueche in der Kommandozeile zerbrechen.
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    // Auf Windows ist `claude` eine .cmd -> shell:true. Der Prompt steht NICHT in den
    // Argumenten (kommt ueber stdin), darum ist shell:true hier unkritisch.
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      shell: true,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `claude endete mit Code ${code}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // --- Board-Stand lesen ---
    if (path === "/api/board" && req.method === "GET") {
      try {
        const data = await readFile(BOARD_FILE, "utf8");
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(data);
      } catch {
        sendJson(res, 200, { columns: [], cards: [] });
      }
      return;
    }

    // --- Board-Stand speichern ---
    if (path === "/api/board" && req.method === "PUT") {
      const body = await readBody(req);
      JSON.parse(body); // validiert, dass es JSON ist
      await writeFile(BOARD_FILE, body, "utf8");
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- KI-Aktion ---
    if (path === "/api/ai" && req.method === "POST") {
      const body = await readBody(req);
      const { task, card } = JSON.parse(body);
      const build = AI_TASKS[task];
      if (!build) {
        sendJson(res, 400, { error: `Unbekannte KI-Aufgabe: ${task}` });
        return;
      }
      try {
        const text = await runClaude(build(card || {}));
        sendJson(res, 200, { text });
      } catch (e) {
        // Haeufigster Fall: CLI nicht installiert oder nicht eingeloggt.
        const hint =
          e.code === "ENOENT" || /not recognized|not found|nicht gefunden/i.test(e.message)
            ? "Die Claude-Code-CLI ist nicht installiert. Einmalig: `npm i -g @anthropic-ai/claude-code`, dann `claude` starten und einloggen."
            : "Die KI-Aktion konnte nicht ausgefuehrt werden. Ist `claude` installiert und eingeloggt (`claude` einmal interaktiv starten)?";
        sendJson(res, 502, { error: e.message, hint });
      }
      return;
    }

    // --- Statische Dateien ---
    let rel = path === "/" ? "/index.html" : path;
    const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
    const file = join(PUBLIC_DIR, safe);
    try {
      const data = await readFile(file);
      res.writeHead(200, {
        "content-type": MIME[extname(file)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Nicht gefunden.");
    }
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`Content-Pipeline-Board laeuft auf http://localhost:${PORT}`);
});
