// v107 Selbsttest: Datumsregeln, CSV und "anstehend" der Kampagnen — ohne Drive.
// Aufruf: node tools/kampagnen-selbsttest.mjs
import * as k from "../lib/kampagnen.js";

let ok = 0, fehl = 0;
const pruefe = (name, ist, soll) => {
  const a = JSON.stringify(ist), b = JSON.stringify(soll);
  if (a === b) ok++; else { fehl++; console.log(`FEHLER ${name}: ist ${a}, soll ${b}`); }
};

// Bekannte Daten (Ostern 2026 = 05.04., 2027 = 28.03.; Kauf-nix-Tag 2026 = 28.11.; Black Friday 2026 = 27.11.)
pruefe("Ostern 2026", k.naechstesDatum("Ostern", "2026-01-01").datum, "2026-04-05");
pruefe("Ostern 2027", k.naechstesDatum("Ostern", "2026-10-05").datum, "2027-03-28");
pruefe("Himmelfahrt 2027", k.naechstesDatum("Ostern+39", "2026-10-05").datum, "2027-05-06");
pruefe("Karfreitag 2027", k.naechstesDatum("Ostern-2", "2026-10-05").datum, "2027-03-26");
pruefe("Kauf-nix-Tag 2026", k.naechstesDatum("letzter Samstag im November", "2026-10-05").datum, "2026-11-28");
pruefe("Black Friday 2026", k.naechstesDatum("4. Donnerstag im November+1", "2026-10-05").datum, "2026-11-27");
pruefe("Muttertag 2027", k.naechstesDatum("2. Sonntag im Mai", "2026-10-05").datum, "2027-05-09");
pruefe("jaehrlich, schon vorbei -> naechstes Jahr", k.naechstesDatum("18.03.", "2026-10-05").datum, "2027-03-18");
pruefe("jaehrlich, heute", k.naechstesDatum("05.10.", "2026-10-05").datum, "2026-10-05");
pruefe("einmalig vorbei", k.naechstesDatum("30.07.2026", "2026-10-05"), { datum: null, vorbei: true });
pruefe("Umlaut im Monat", k.naechstesDatum("letzter Samstag im März", "2026-10-05").datum, "2027-03-27");
pruefe("unverstaendlich", !!k.naechstesDatum("irgendwann", "2026-10-05").fehler, true);
pruefe("Monat 13", !!k.naechstesDatum("01.13.", "2026-10-05").fehler, true);

// CSV: Semikolon (Board) und Komma (Sheets-Export), Anfuehrungszeichen, BOM
const csv = k.schreibeCsv([{ Anlass: "Test; mit Semikolon", Datum: "01.11.", Ziel: "Gespräch auslösen", Format: "Slider" }]);
const t = k.leseTabelle(csv);
pruefe("CSV rund", [t.eintraege[0].anlass, t.eintraege[0].ziel, t.eintraege[0].format], ["Test; mit Semikolon", "community", "slider"]);
const komma = k.leseTabelle("Anlass,Datum,Themen\nWeltrecyclingtag,18.03.,\"Recycling, Wertstoffe\"\n");
pruefe("Sheets-Komma", [komma.eintraege[0].anlass, komma.eintraege[0].themen], ["Weltrecyclingtag", "Recycling, Wertstoffe"]);
pruefe("unbekanntes Ziel -> Befund", k.leseTabelle("Anlass;Datum;Ziel\nX;01.01.;Ruhm\n").befunde.length, 1);
pruefe("Kopf ohne Datum -> Befund", k.leseTabelle("Anlass;Themen\nX;y\n").befunde.length, 1);

// Anstehend: Fenster 60 Tage, inaktive Kampagne ignoriert, Befund fuer kaputte Zeile
const kampagnen = [{ id: "a", name: "Aktionstage", aktiv: true }, { id: "b", name: "Aus", aktiv: false }];
const tabellen = {
  a: k.schreibeCsv([
    { Anlass: "Kauf-nix-Tag", Datum: "letzter Samstag im November" },
    { Anlass: "Weltrecyclingtag", Datum: "18.03." },
    { Anlass: "Kaputt", Datum: "bald" },
  ]),
  b: k.schreibeCsv([{ Anlass: "Nie", Datum: "06.10." }]),
};
const r = k.anstehende({ kampagnen, tabellen, heute: "2026-10-05" });
pruefe("anstehend", r.anstehend.map((x) => [x.anlass, x.datum, x.tage]), [["Kauf-nix-Tag", "2026-11-28", 54]]);
pruefe("anstehend Befund", r.befunde.length, 1);
pruefe("Schluessel", r.anstehend[0].schluessel, "a|Kauf-nix-Tag|2026-11-28");

// Vorlagen: jede Zeile hat ein lesbares Datum
for (const v of k.VORLAGEN) {
  const tv = k.leseTabelle(k.schreibeCsv(v.zeilen));
  pruefe(`Vorlage ${v.name} ohne Befund`, tv.befunde, []);
  for (const e of tv.eintraege) pruefe(`Vorlage ${e.anlass} Datum`, !k.naechstesDatum(e.regel, "2026-10-05").fehler, true);
}
pruefe("Tabellenpfad", k.tabellePfad("Gesetzliche Feiertage"), "Kampagnen/Gesetzliche Feiertage.csv");

console.log(`${ok}/${ok + fehl} ok`);
process.exit(fehl ? 1 : 0);
