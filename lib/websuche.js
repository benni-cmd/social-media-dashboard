// Web-Suche fuer die Recherche-Rolle (v40). Zwei Backends, KEIN Extra-Dienst noetig — laeuft im
// Node-Server selbst, damit ein geklontes Repo ohne Docker/Redis/Installationen sofort sucht:
//   - Standard: DuckDuckGo schluessellos (html.duckduckgo.com) — null Setup, drosselt aber bei Last.
//   - Optional: Tavily (TAVILY_API_KEY in .env) — 1000 Gratis-Suchen/Monat ohne Karte, stabiler.
// Jeder Fehler faellt auf [] zurueck: die Web-Suche ist Beiwerk der Recherche, kein Tor — genau
// wie der Firmenkontext den KI-Aufruf nie verhindern darf.

export async function sucheWeb(frage, { max = 6 } = {}) {
  const q = (frage || "").trim();
  if (!q) return { treffer: [], quelle: "keine" };
  const key = process.env.TAVILY_API_KEY;
  try {
    if (key) return { treffer: await tavily(q, key, max), quelle: "tavily" };
    return { treffer: await duckduckgo(q, max), quelle: "duckduckgo" };
  } catch {
    return { treffer: [], quelle: "fehler" };
  }
}

async function tavily(q, key, max) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, query: q, max_results: max, search_depth: "basic" }),
  });
  if (!res.ok) throw new Error("Tavily HTTP " + res.status);
  const d = await res.json();
  return (d.results || []).slice(0, max).map((r) => ({
    titel: r.title || "",
    url: r.url || "",
    text: (r.content || "").slice(0, 500),
  }));
}

async function duckduckgo(q, max) {
  // POST an den html-Endpunkt verhaelt sich am naechsten zum Browser-Formular.
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    },
    body: "q=" + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error("DuckDuckGo HTTP " + res.status);
  return parseDdg(await res.text(), max);
}

// html.duckduckgo.com liefert je Treffer <a class="result__a" href="URL">TITEL</a> und
// <a class="result__snippet">TEXT</a>. Die href ist meist ueber /l/?uddg= umgeleitet — die echte
// URL steht im uddg-Parameter.
function parseDdg(html, max) {
  const treffer = [];
  const snippets = [];
  const snRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = snRe.exec(html))) snippets.push(entschaerfe(m[1]));
  const aRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let i = 0;
  while ((m = aRe.exec(html)) && treffer.length < max) {
    const titel = entschaerfe(m[2]);
    if (titel) treffer.push({ titel, url: echteUrl(m[1]), text: snippets[i] || "" });
    i++;
  }
  return treffer;
}

function echteUrl(href) {
  try {
    let h = href.startsWith("//") ? "https:" + href : href;
    const u = new URL(h, "https://duckduckgo.com");
    return u.searchParams.get("uddg") || u.href;
  } catch {
    return href;
  }
}

function entschaerfe(s) {
  return (s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Kompakter Prompt-Block: nummerierte Treffer mit Titel, Quelle, Auszug. Leer, wenn nichts kam —
// dann laeuft die Recherche wie bisher aus dem Modellwissen weiter.
export function alsPromptBlock(treffer) {
  if (!treffer || !treffer.length) return "";
  const zeilen = treffer.map((t, i) =>
    `${i + 1}. ${t.titel}${t.url ? " (" + t.url + ")" : ""}\n   ${t.text}`.trim()
  );
  return (
    "\n\n---\n\nWEB-RECHERCHE (frische Treffer aus dem Internet — nutze sie als Faktenbasis, " +
    "keine erfundenen Zahlen; nenne bei Bedarf die Quelle):\n" + zeilen.join("\n")
  );
}
