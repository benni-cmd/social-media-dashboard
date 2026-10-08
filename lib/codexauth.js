// v103 — ChatGPT ueber die Codex-CLI aus dem Board anmelden (Owner 02.10.2026: „statt Claude auch ChatGPT
// verbinden … oder komplett skippen und nur lokal arbeiten").
//
// Zwei Wege, beide von OpenAI dokumentiert (learn.chatgpt.com/docs/auth, …/non-interactive-mode):
// - `codex login` — Anmeldung mit dem ChatGPT-Konto im Browser (Rueckruf auf localhost:1455), Abrechnung ueber den Plan.
// - `codex login --with-api-key` — liest einen API-Schluessel von der Standardeingabe, Abrechnung nach Verbrauch.
// Die CLI legt den Zugang selbst ab (~/.codex/auth.json oder Schluesselbund) — das Board speichert nichts davon.
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const LAUFZEIT_MS = 10 * 60 * 1000;

let lauf = null; // { kind, ausgabe, url, timer }

function beende() {
  if (!lauf) return;
  clearTimeout(lauf.timer);
  try { lauf.kind.kill(); } catch {}
  lauf = null;
}

// { installiert, loggedIn, art: "chatgpt"|"apikey"|"", satz }
export async function status() {
  try {
    const r = await execAsync("codex login status", { encoding: "utf8", timeout: 15000 });
    const text = `${r.stdout}\n${r.stderr}`.trim();
    const art = /chatgpt/i.test(text) ? "chatgpt" : /api key/i.test(text) ? "apikey" : "";
    return { installiert: true, loggedIn: /logged in/i.test(text) && !/not logged in/i.test(text), art, satz: text.split("\n")[0].replace(/sk-\S+/g, "sk-…") };
  } catch (e) {
    const text = `${e.stdout || ""}\n${e.stderr || ""}\n${e.message || ""}`;
    const fehlt = /not recognized|not found|nicht gefunden|ENOENT/i.test(text) && !/logged/i.test(text);
    return { installiert: !fehlt, loggedIn: false, art: "", satz: fehlt ? "Codex-CLI nicht installiert" : "nicht angemeldet" };
  }
}

// ChatGPT-Anmeldung: startet `codex login` (oeffnet selbst den Browser) und reicht die Adresse an die
// Oberflaeche — falls sich kein Browser oeffnet. Das Ende meldet status() (die Oberflaeche fragt nach).
export function starte() {
  beende();
  const kind = spawn("codex login", { shell: true, // v115 (N10): fester Befehlstext (DEP0190)
    stdio: ["ignore", "pipe", "pipe"] });
  const l = { kind, ausgabe: "", url: "" };
  l.timer = setTimeout(beende, LAUFZEIT_MS);
  lauf = l;
  kind.on("exit", () => { if (lauf === l) { clearTimeout(l.timer); lauf = null; } });
  return new Promise((resolve, reject) => {
    const frist = setTimeout(() => resolve({ url: "" }), 15000); // Browser ging vermutlich von selbst auf
    const lies = (d) => {
      l.ausgabe += d;
      const m = l.ausgabe.match(/https:\/\/auth\.openai\.com\/\S+/);
      if (m && !l.url) { l.url = m[0]; clearTimeout(frist); resolve({ url: l.url }); }
    };
    kind.stdout.on("data", lies);
    kind.stderr.on("data", lies);
    kind.on("error", (e) => { clearTimeout(frist); reject(new Error(`Codex-CLI nicht startbar: ${e.message}`)); });
    kind.on("exit", (code) => {
      if (!l.url && code !== 0) {
        clearTimeout(frist);
        const fehlt = /not recognized|not found/i.test(l.ausgabe);
        reject(new Error(fehlt ? "Die Codex-CLI ist nicht installiert." : `Codex-CLI endete vorzeitig (Code ${code}).`));
      }
    });
  });
}

// API-Schluessel: geht nur ueber die Standardeingabe an die CLI, nie in eine Datei des Boards oder ins Log.
export function mitSchluessel(schluessel) {
  beende();
  return new Promise((resolve) => {
    const kind = spawn("codex login --with-api-key", { shell: true, // v115 (N10): fester Befehlstext (DEP0190)
      stdio: ["pipe", "pipe", "pipe"] });
    let aus = "";
    kind.stdout.on("data", (d) => (aus += d));
    kind.stderr.on("data", (d) => (aus += d));
    kind.on("error", (e) => resolve({ ok: false, grund: `Codex-CLI nicht startbar: ${e.message}` }));
    kind.on("exit", async (code) => {
      const st = await status();
      resolve(st.loggedIn ? { ok: true, art: st.art } : { ok: false, grund: (aus.trim().split("\n").pop() || `Code ${code}`).replace(/sk-\S+/g, "sk-…") });
    });
    kind.stdin.write(String(schluessel || "").trim() + "\n");
    kind.stdin.end();
  });
}

export async function abmelden() {
  beende();
  await execAsync("codex logout", { timeout: 15000 }).catch(() => {});
  return status();
}
