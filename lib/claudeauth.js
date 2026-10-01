// v86 — Claude-CLI aus dem Board anmelden (Owner 01.10.2026: „bei der Claude CLI steht nur ‚nicht
// konfiguriert', das ist nicht klickbar … das soll übers Board möglich sein").
//
// Ablauf von `claude auth login` (gemessen 01.10.2026, CLI 2.1.x): die CLI gibt eine Anmelde-URL
// aus („If the browser didn't open, visit: …"), versucht den Browser zu oeffnen und wartet dann auf
// „Paste code here if prompted >". Nach der Anmeldung zeigt claude.com einen Code; den liest die CLI
// von der Standardeingabe (belegt: ein falscher Code ergibt „Login failed: … 400").
// Das Board startet die CLI, reicht die URL an die Oberflaeche und den Code an die CLI weiter.
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const LAUFZEIT_MS = 10 * 60 * 1000;

let lauf = null; // { kind, ausgabe, url, timer, ende: Promise<{code, ausgabe}> }

function beende() {
  if (!lauf) return;
  clearTimeout(lauf.timer);
  try { lauf.kind.kill(); } catch {}
  lauf = null;
}

// Startet die Anmeldung und liefert die URL, sobald die CLI sie ausgibt (hoechstens 20 s).
export function starte() {
  beende();
  // Die CLI darf nicht glauben, sie liefe in einer anderen Claude-Sitzung.
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("CLAUDE")) delete env[k];
  const kind = spawn("claude", ["auth", "login", "--claudeai"], { env, shell: true, stdio: ["pipe", "pipe", "pipe"] });
  const l = { kind, ausgabe: "", url: "" };
  l.ende = new Promise((resolve) => kind.on("exit", (code) => resolve({ code, ausgabe: l.ausgabe })));
  l.timer = setTimeout(beende, LAUFZEIT_MS);
  lauf = l;
  return new Promise((resolve, reject) => {
    const frist = setTimeout(() => reject(new Error("Die Claude-CLI hat keine Anmelde-Adresse ausgegeben.")), 20000);
    const lies = (d) => {
      l.ausgabe += d;
      const m = l.ausgabe.match(/https:\/\/\S+oauth\/authorize\S+/);
      if (m && !l.url) {
        l.url = m[0];
        clearTimeout(frist);
        resolve({ url: l.url });
      }
    };
    kind.stdout.on("data", lies);
    kind.stderr.on("data", lies);
    kind.on("error", (e) => { clearTimeout(frist); reject(new Error(`Claude-CLI nicht startbar: ${e.message}`)); });
    l.ende.then(({ code }) => {
      if (!l.url) { clearTimeout(frist); reject(new Error(`Claude-CLI endete vorzeitig (Code ${code}).`)); }
    });
  });
}

// Reicht den Code von claude.com an die wartende CLI und meldet das Ergebnis.
export async function abschliessen(code) {
  if (!lauf) throw new Error("Keine Anmeldung offen — bitte „Anmelden“ neu starten.");
  const l = lauf;
  l.kind.stdin.write(String(code).trim() + "\n");
  const ergebnis = await Promise.race([
    l.ende,
    new Promise((r) => setTimeout(() => r({ code: "zeit", ausgabe: l.ausgabe }), 60000)),
  ]);
  beende();
  const st = await status();
  if (st.loggedIn) return { ok: true, email: st.email };
  const grund = (ergebnis.ausgabe.match(/Login failed[^\n]*/) || [""])[0];
  return { ok: false, grund: grund || "Anmeldung nicht abgeschlossen — Code pruefen und neu versuchen." };
}

export async function status() {
  try {
    const r = await execAsync("claude auth status", { encoding: "utf8", timeout: 15000 });
    const st = JSON.parse(r.stdout);
    return { loggedIn: !!st.loggedIn, email: st.email || "" };
  } catch {
    return { loggedIn: false, email: "" };
  }
}
