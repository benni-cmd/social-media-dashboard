// Harte Tests (v115) — Gesamtlauf.
//
//   node tools/hart/lauf.mjs                 alle Gruppen (logik, api, wettlauf, drive-hand, zip, ki)
//   node tools/hart/lauf.mjs api wettlauf    nur diese Gruppen
//   --zip-gross                              zusaetzlich ZIP ueber 4 GB (rund 20 GB Temp-Platz, einige Minuten)
//   --port N                                 Port der Testkopie (Standard 4399; 4321 = Live-Board ist gesperrt)
//
// Jede Server-Gruppe baut ihre eigene isolierte Kopie mit Schein-Drive auf und raeumt sie danach weg
// (tools/hart/umgebung.mjs). Echtes Drive, Zugangsdaten und das Live-Board werden nie beruehrt.
// Ausgabe je Pruefung „ok"/„BEF"; Exit-Code 1, sobald es einen Befund gibt.

process.env.TZ = "Europe/Berlin"; // Datums-Grenzen gelten fuer deutsche Zeit — vor jedem Date-Gebrauch setzen

const GRUPPEN = ["logik", "api", "wettlauf", "drive-hand", "zip", "ki"];
const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const port = portIdx >= 0 ? Number(args[portIdx + 1]) : 4399;
const zipGross = args.includes("--zip-gross");
const gewaehlt = args.filter((a, i) => GRUPPEN.includes(a) && args[i - 1] !== "--port");
const liste = gewaehlt.length ? gewaehlt : GRUPPEN;

const bilanz = [];
for (const g of liste) {
  const t0 = Date.now();
  console.log(`\n### Gruppe ${g}`);
  try {
    const mod = await import(`./${g}.mjs`);
    const r = await mod.lauf({ port, zipGross });
    bilanz.push({ ...r, sek: Math.round((Date.now() - t0) / 1000) });
  } catch (e) {
    console.log(`BEF | ${g} | Gruppe abgebrochen: ${e.stack || e.message}`);
    bilanz.push({ gruppe: g, ok: 0, bef: 1, sek: Math.round((Date.now() - t0) / 1000), abbruch: true });
  }
}
console.log("\n### Bilanz");
for (const b of bilanz) console.log(`${b.bef ? "BEF" : "ok "} | ${b.gruppe}: ${b.ok} ok, ${b.bef} Befund${b.bef === 1 ? "" : "e"}${b.abbruch ? " (abgebrochen)" : ""} · ${b.sek} s`);
const summe = bilanz.reduce((s, b) => s + b.bef, 0);
console.log(summe ? `${summe} Befund${summe === 1 ? "" : "e"} offen.` : "Alles ok.");
process.exit(summe ? 1 : 0);
