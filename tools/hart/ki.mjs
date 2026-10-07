// Harte Tests (v115) — Gruppe „ki": KI-Lauf bricht ab, wenn der Browser die Verbindung trennt (M6).
// Braucht ein laufendes lokales Ollama mit einem qwen2.5-Modell; sonst wird die Gruppe uebersprungen.
// Aufgabe „hooks_verbal" hat genau einen Schritt ohne Web-Suche — es geht nichts ins Internet.

import { starteUmgebung, neueKarte } from "./umgebung.mjs";
import { pruefer, schlaf, warteBis } from "./gemeinsam.mjs";

async function ollamaModell() {
  try {
    const r = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
    const namen = (await r.json()).models.map((m) => m.name);
    return namen.find((n) => /^qwen2\.5:(7b|14b)/.test(n)) || namen.find((n) => /^qwen2\.5/.test(n)) || null;
  } catch { return null; }
}

export async function lauf({ port }) {
  const t = pruefer("ki");
  const modell = await ollamaModell();
  if (!modell) { t.hinweis("Ollama nicht erreichbar oder kein qwen2.5-Modell — Gruppe uebersprungen."); return t.ende(); }
  const u = await starteUmgebung({ port });
  try {
    const k = await neueKarte(u, { title: "TEST hart KI Kompost", column: "idee" }, { mitOrdner: false });
    const eine = { provider: "ollama", ollamaModel: modell };
    const body = { task: "hooks_verbal", card: k, rollenModelle: { userkomm: eine, recherche: eine, kontext: eine } };
    const kiAktiv = async () => (await u.api("GET", "/api/ereignisse?sektion=ki")).daten.aktiv.ki;

    // Drei lange Schritte ohne Web-Suche — ein Weiterrechnen nach dem Abbruch dauert damit deutlich laenger als 8 s.
    const lang = { rolle: "userkomm", websuche: false, prompt: "Schreibe einen sachlichen Text mit 400 Woertern ueber Kompostwuermer. Nur der Text.{{kontext}}" };
    const p = await u.api("PUT", "/api/prompts", { id: "hooks_verbal", schritte: [lang, lang, lang] });
    t.ok("Testaufgabe mit drei Schritten eingestellt (Vorbedingung)", p.status === 200, p.text.slice(0, 200));

    // Abbruch 3 s nachdem Schritt 1 angelaufen ist.
    const ctrl = new AbortController();
    const res = await u.api("POST", "/api/ai/stream", body, { roh: true, signal: ctrl.signal });
    const leser = res.body.getReader();
    const t0 = Date.now();
    let puffer = "", laeuft = false;
    while (Date.now() - t0 < 120000 && !laeuft) {
      const { value, done } = await leser.read();
      if (done) break;
      puffer += new TextDecoder().decode(value);
      laeuft = /"t":"stufe"[^\n]*"schritt":1[,}]/.test(puffer) && /"modell"/.test(puffer);
    }
    t.ok("KI-Schritt 1 laeuft (Vorbedingung)", laeuft, puffer.slice(0, 300));
    await schlaf(3000);
    ctrl.abort();
    const tAbbruch = Date.now();
    const ruhig = await warteBis(async () => !(await kiAktiv()), { ms: 8000, takt: 250 });
    t.ok(`M6 nach Abbruch ist die KI binnen 8 s still (gemessen ${((Date.now() - tAbbruch) / 1000).toFixed(1)} s)`, ruhig, "KI laeuft weiter");
    await schlaf(500);

    // Gegenprobe: ohne Abbruch kommt ein Ergebnis (Standard-Prompt zurueck: ein kurzer Schritt).
    await u.api("PUT", "/api/prompts", { id: "hooks_verbal", schritte: [] });
    const voll = await u.api("POST", "/api/ai/stream", body);
    t.ok("KI-Lauf ohne Abbruch endet mit Ergebnis", /"t":"done"/.test(voll.text), voll.text.slice(-200));
  } finally {
    await u.aufraeumen();
  }
  return t.ende();
}
