// Harte Tests (v115) — Gruppe „api": Eingangs-Haerte des Servers gegen die isolierte Umgebung.
// Deckt aus v114: B1-Ursache 2 (Absturz nach gesendeten Kopfzeilen), M3 (Herkunft), M4 (Plan/Parameter/Defaults
// mit Unsinn), N2 (Prompt-Kennungen), N3 (Groessengrenze), dazu die haltenden Faelle (.env, Pfad-Tricks).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { starteUmgebung, neueKarte, findeOrdner } from "./umgebung.mjs";
import { pruefer } from "./gemeinsam.mjs";

// Schreibende Endpunkte ohne Prozess-Starter, externe Dienste oder Zerstoerer. Der Einrichtungs-Speicher
// steht bewusst am Ende: er brachte in v114 den Server zum Absturz.
const ZIELE = [
  ["PUT", "/api/board"], ["PUT", "/api/defaults"], ["PUT", "/api/plan"], ["PUT", "/api/kontext"], ["PUT", "/api/prompts"],
  ["PUT", "/api/workflows"], ["PUT", "/api/boardparameter"], ["POST", "/api/drive/ordner/pruefen"], ["POST", "/api/drive/create"],
  ["POST", "/api/karte/loeschen"], ["POST", "/api/drive/move"], ["POST", "/api/drive/scan"], ["POST", "/api/drive/save"],
  ["PUT", "/api/config/env"], ["POST", "/api/einrichtung/stand"], ["PUT", "/api/board/name"], ["POST", "/api/zuordnung/pruefen"],
  ["POST", "/api/zuordnung/hand"], ["POST", "/api/zuordnung/entscheiden"], ["POST", "/api/projekt/upload"], ["POST", "/api/einrichtung/speichern"],
];
const UNSINN = { kaputt: "{", null: "null", array: "[]", zahl: "5", text: '"x"' };

export async function lauf({ port }) {
  const t = pruefer("api");
  const u = await starteUmgebung({ port });
  try {
    const sys = (n) => readFile(u.d("System (AI only)", n), "utf8").catch(() => null);
    const vorher = { plan: await sys("redaktionsplan.json"), param: await sys("boardparameter.json") };
    // Plan einmal regulaer anlegen, damit es etwas zu schuetzen gibt.
    await u.api("GET", "/api/plan");
    const planVorher = await sys("redaktionsplan.json");
    const paramVorher = await sys("boardparameter.json");

    // --- kaputte Bodies -------------------------------------------------------------
    let fuenfhundert = 0, tot = null, ohneSatz = 0;
    const bsp = [];
    for (const [m, p] of ZIELE) {
      for (const [n, b] of Object.entries(UNSINN)) {
        if (tot) break;
        let r;
        try { r = await u.api(m, p, b); } catch (e) { r = { status: 0, text: e.message }; }
        if (r.status >= 500 || r.status === 0) { fuenfhundert++; if (bsp.length < 6) bsp.push(`${m} ${p} ${n} -> ${r.status} ${r.text.slice(0, 60)}`); }
        else if (r.status >= 400 && !(r.daten && (r.daten.satz || r.daten.error))) ohneSatz++;
        if (!(await u.lebt())) tot = `${m} ${p} mit ${n}`;
      }
    }
    t.ok("B1 Server ueberlebt alle kaputten Anfragen (21 Endpunkte x 5 Varianten)", !tot, `Absturz bei ${tot}`);
    if (tot) { t.hinweis("Server tot — restliche api-Pruefungen entfallen."); return t.ende(); }
    t.ok("kaputte Anfragen enden mit 4xx statt 500", fuenfhundert === 0, `${fuenfhundert}x; ${bsp.join(" || ")}`);
    t.ok("jede 4xx-Antwort traegt einen Satz", ohneSatz === 0, `${ohneSatz}x ohne satz/error`);
    t.gleich("M4 Redaktionsplan in Drive unveraendert nach Unsinn", await sys("redaktionsplan.json"), planVorher);
    t.gleich("M4 Boardparameter in Drive unveraendert nach Unsinn", await sys("boardparameter.json"), paramVorher);
    t.gleich("M4 keine „Ohne Titel“-Ordner durch Unsinn", (await findeOrdner(u, "Ohne Titel")).length, 0);
    const leerPlan = await u.api("PUT", "/api/plan", {});
    t.ok("M4 leerer Plan {} wird abgelehnt", leerPlan.status === 400, leerPlan.status);
    const leerParam = await u.api("PUT", "/api/boardparameter", { kategorien: "x" });
    t.ok("M4 Boardparameter ohne Listen abgelehnt", leerParam.status === 400, leerParam.status);
    void vorher;

    // --- M3 Herkunft ----------------------------------------------------------------
    const fremd = async (kopf, ct = "text/plain;charset=UTF-8") => {
      const res = await fetch(u.url + "/api/drive/create", { method: "POST", headers: { "content-type": ct, ...kopf }, body: JSON.stringify({ id: "fremd" + Math.random(), title: "TEST hart Fremdseite", column: "idee" }) });
      return res.status;
    };
    const s1 = await fremd({ origin: "https://boese-seite.example", "sec-fetch-site": "cross-site", "sec-fetch-mode": "no-cors" });
    const s2 = await fremd({ origin: "https://boese-seite.example" }, "application/json");
    const s3 = await fremd({ "sec-fetch-site": "cross-site" }, "application/json");
    const s4 = await fremd({ origin: "http://localhost:" + port }, "application/json");
    t.ok("M3 fremde Seite (text/plain, cross-site) abgelehnt", s1 === 403, s1);
    t.ok("M3 fremde Herkunft mit JSON abgelehnt", s2 === 403, s2);
    t.ok("M3 Sec-Fetch-Site cross-site abgelehnt", s3 === 403, s3);
    t.ok("M3 http statt https (andere Herkunft) abgelehnt", s4 === 403, s4);
    t.gleich("M3 kein Ordner durch fremde Anfragen", (await findeOrdner(u, "TEST hart Fremdseite")).length, 0);
    const eigen = await u.api("POST", "/api/drive/create", { id: "eigen1", title: "TEST hart Eigen", column: "idee" });
    t.ok("M3 eigene Oberflaeche (same-origin) darf weiter", eigen.status === 200, eigen.status);
    const skript = await u.api("POST", "/api/drive/scan", { id: "eigen1", title: "TEST hart Eigen", column: "idee", driveName: "TEST hart Eigen" }, { ohneHerkunft: true });
    t.ok("M3 lokales Skript ohne Origin-Kopf darf weiter", skript.status === 200, skript.status);
    const ohneTyp = await u.api("POST", "/api/drive/scan", "{}", { kopf: { "content-type": "text/plain" } });
    t.ok("M3 JSON-Endpunkt mit text/plain abgelehnt (415)", ohneTyp.status === 415, ohneTyp.status);

    // --- N3 Groesse -----------------------------------------------------------------
    const mb = 30;
    const stueck = new Uint8Array(1024 * 1024).fill(97);
    let i = 0;
    const strom = new ReadableStream({ pull(c) { if (i++ < mb) c.enqueue(stueck); else c.close(); } });
    const t0 = Date.now();
    let gross;
    try { gross = (await u.api("PUT", "/api/kontext", strom)).status; } catch (e) { gross = "Verbindung zu: " + (e.cause?.code || e.message); }
    t.ok(`N3 ${mb} MB werden mit 413 abgelehnt`, gross === 413 || /ECONNRESET|EPIPE|other side closed/i.test(String(gross)), gross);
    t.ok("N3 Server lebt nach Riesen-Anfrage", await u.lebt(), `${Date.now() - t0} ms`);

    // --- N2 Prompt-Kennungen ---------------------------------------------------------
    for (const id of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const r = await u.api("PUT", "/api/prompts", { id, text: "TEST hart" });
      t.ok(`N2 Prompt-Kennung „${id}“ abgelehnt`, r.status === 400, r.status);
    }
    const pj = await sys("prompts.json");
    t.ok("N2 prompts.json in Drive ohne Fremd-Kennungen", !pj || !/"(constructor|toString|hasOwnProperty)"/.test(pj), (pj || "").slice(0, 200));

    // --- haltende Faelle (Regressionsschutz) -------------------------------------------
    const env1 = await u.api("PUT", "/api/config/env", { key: "TAVILY_API_KEY", value: "abc\nGOOGLE_OAUTH_CLIENT_ID=boese" });
    const env2 = await u.api("PUT", "/api/config/env", { key: "PATH", value: "x" });
    const envText = await readFile(join(u.code, ".env"), "utf8").catch(() => "");
    t.ok(".env: Zeilenumbruch eingeschleust bleibt eine Zeile", env1.status === 200 && !/^GOOGLE_OAUTH_CLIENT_ID=boese/m.test(envText), envText);
    t.ok(".env: fremder Schluessel abgelehnt", env2.status === 400, env2.status);
    const proto = await u.api("PUT", "/api/defaults", { ["__proto__"]: { verschmutzt: 1 }, constructor: { prototype: { v2: 1 } } });
    t.ok("Prototyp-Verschmutzung ueber /api/defaults ohne 500", proto.status < 500, proto.status);
    const pfad1 = await u.api("POST", "/api/drive/create", { id: "p1", title: "TEST hart Pfad", driveName: "../System (AI only)", column: "idee" });
    t.ok("Pfad-Trick „..“ im Ordnernamen abgelehnt (4xx, kein 500)", pfad1.status >= 400 && pfad1.status < 500, pfad1.status);
    const pfad2 = await u.api("POST", "/api/drive/create", { id: "p2", title: "../../TEST hart Ausbruch", column: "idee" });
    t.ok("Pfad-Trick im Titel entschaerft", pfad2.status === 200 && !String(pfad2.daten.basis).includes(".."), pfad2.daten);
    for (const [name, spalte] of [["KPI", "fertig"], ["1 Idee", "idee"], ["System (AI only)", "verworfen"]]) {
      const r = await u.api("POST", "/api/karte/loeschen", { id: "s-" + name, title: name, driveName: name, column: spalte });
      t.ok(`Systemordner „${name}“ nicht loeschbar`, r.status < 500 && !(r.daten && r.daten.getrasht), r.daten);
    }
    const karte = await neueKarte(u, { title: "TEST hart Speichern", column: "skript" });
    const save = await u.api("POST", "/api/drive/save", { card: karte, filename: "../boese.md", content: "x" });
    t.ok("Dateiname mit „../“ beim Speichern abgelehnt", save.status === 400, save.status);
  } finally {
    await u.aufraeumen();
  }
  return t.ende();
}
