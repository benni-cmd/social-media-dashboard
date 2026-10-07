// Harte Tests (v115) — Gruppe „zip": ZIP-Schreiber und Rohmaterial-Download.
// Deckt aus v114: B1 (ZIP ueber 4 GB, Server-Absturz). Jedes ZIP wird von ZWEI unabhaengigen Lesern geprueft:
// Windows-tar (libarchive, prueft CRC beim Entpacken) und .NET System.IO.Compression (PowerShell).
// Die Grossfaelle (--zip-gross) brauchen rund 20 GB freien Platz im Temp-Ordner und einige Minuten.

import { execFileSync } from "node:child_process";
import { createWriteStream, openSync, ftruncateSync, closeSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { schreibeZip } from "../../lib/zip.js";
import { starteUmgebung, neueKarte } from "./umgebung.mjs";
import { pruefer } from "./gemeinsam.mjs";

const GB = 1024 ** 3;
const TAR = "C:\\Windows\\System32\\tar.exe";

function leerDatei(pfad, bytes) {
  const fd = openSync(pfad, "w");
  ftruncateSync(fd, bytes);
  closeSync(fd);
}

// Liest das ZIP mit beiden Lesern: { tar: [{name,groesse}], net: [{name,groesse}], crcOk }
function lies(zipPfad) {
  const ergebnis = { tar: null, net: null, crcOk: null, fehler: [] };
  try {
    const out = execFileSync(TAR, ["-tvf", zipPfad], { encoding: "utf8", maxBuffer: 1 << 24 });
    ergebnis.tar = out.trim().split(/\r?\n/).filter(Boolean).map((z) => { const m = z.match(/^\S+\s+\S+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+\S+\s+\S+\s+(.+)$/); return m ? { groesse: Number(m[1]), name: m[2] } : { roh: z }; });
  } catch (e) { ergebnis.fehler.push("tar -t: " + String(e.stderr || e.message).slice(0, 200)); }
  try {
    const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${zipPfad.replace(/'/g, "''")}'); foreach($e in $z.Entries){ [Console]::Out.WriteLine($e.FullName + '|' + $e.Length) }; $z.Dispose()`;
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "[Console]::OutputEncoding=[Text.Encoding]::UTF8; " + ps], { encoding: "utf8", maxBuffer: 1 << 24 });
    ergebnis.net = out.trim().split(/\r?\n/).filter(Boolean).map((z) => { const i = z.lastIndexOf("|"); return { name: z.slice(0, i), groesse: Number(z.slice(i + 1)) }; });
  } catch (e) { ergebnis.fehler.push(".NET: " + String(e.stderr || e.message).slice(0, 200)); }
  try {
    // Entpacken nach stdout prueft jede CRC; Ausgabe wird verworfen.
    execFileSync(TAR, ["-xOf", zipPfad], { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1 << 24 });
    ergebnis.crcOk = true;
  } catch (e) { ergebnis.crcOk = false; ergebnis.fehler.push("tar -x: " + String(e.stderr || e.message).slice(0, 200)); }
  return ergebnis;
}

// Windows-tar gibt Namen in der Konsolen-Codepage aus (Umlaute als „�") — Namen darum ohne Nicht-ASCII vergleichen;
// .NET liest die UTF-8-Namen korrekt und wird zusaetzlich exakt verglichen (passtGenau).
const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, "?");
const passt = (liste, soll) => !!liste && liste.length === soll.length && soll.every((s) => liste.some((x) => ascii(x.name) === ascii(s.name) && x.groesse === s.groesse));
const passtGenau = (liste, soll) => !!liste && liste.length === soll.length && soll.every((s) => liste.some((x) => x.name === s.name && x.groesse === s.groesse));

export async function lauf({ port, zipGross = false }) {
  const t = pruefer("zip");
  const tmp = await mkdtemp(join(tmpdir(), "smd-hart-zip-"));
  try {
    // --- klein: Umlaute, mehrere Dateien, leere Datei -------------------------------------------
    {
      const dateien = [["Skript Ä Ö Ü ß.txt", "Grüße aus dem Kompost\n".repeat(50)], ["leer.txt", ""], ["clip.mp4", "x".repeat(70000)]];
      for (const [n, inhalt] of dateien) await writeFile(join(tmp, n), inhalt);
      const zip = join(tmp, "klein.zip");
      const strom = createWriteStream(zip);
      await schreibeZip(strom, dateien.map(([name]) => ({ name, pfad: join(tmp, name) })));
      await new Promise((r) => strom.end(r));
      const soll = dateien.map(([name, inhalt]) => ({ name, groesse: Buffer.byteLength(inhalt) }));
      const l = lies(zip);
      t.ok("klein: tar liest alle Eintraege mit Groesse", passt(l.tar, soll), { tar: l.tar, fehler: l.fehler });
      t.ok("klein: .NET liest alle Eintraege mit Groesse (UTF-8-Namen exakt)", passtGenau(l.net, soll), { net: l.net, fehler: l.fehler });
      t.ok("klein: CRC stimmt (tar entpackt fehlerfrei)", l.crcOk, l.fehler);
    }

    // --- klein ueber den Server -------------------------------------------------------------------
    const u = await starteUmgebung({ port });
    try {
      const k = await neueKarte(u, { title: "TEST hart Zip", column: "videodreh" });
      const roh = u.d("In Bearbeitung/3 Videodreh/TEST hart Zip/Rohmaterial");
      await writeFile(join(roh, "a.mp4"), "a".repeat(123456));
      await writeFile(join(roh, "Übersicht.txt"), "ü");
      const res = await u.api("GET", `/api/projekt/download?was=rohmaterial&karteId=${k.id}`, undefined, { roh: true });
      const zip = join(tmp, "server-klein.zip");
      await pipeline(Readable.fromWeb(res.body), createWriteStream(zip));
      const l = lies(zip);
      t.ok("Server-Download klein: beide Leser, CRC ok", res.status === 200 && passt(l.tar, [{ name: "a.mp4", groesse: 123456 }, { name: "Übersicht.txt", groesse: 2 }]) && passtGenau(l.net, [{ name: "a.mp4", groesse: 123456 }, { name: "Übersicht.txt", groesse: 2 }]) && l.crcOk, { status: res.status, tar: l.tar, net: l.net, fehler: l.fehler });
      await rm(zip, { force: true });

      if (!zipGross) {
        t.hinweis("Grossfaelle uebersprungen (mit --zip-gross: Datei ueber 4 GB und 4,4 GB ueber den Server).");
      } else {
        // --- gross, Einzeldatei ueber 4 GB (Einheit) ------------------------------------------------
        const g1 = join(tmp, "riesig.mp4");
        leerDatei(g1, Math.round(4.3 * GB));
        await writeFile(join(tmp, "klein-danach.txt"), "danach");
        const zip1 = join(tmp, "gross1.zip");
        const s1 = createWriteStream(zip1);
        let fehler1 = null;
        try { await schreibeZip(s1, [{ name: "riesig.mp4", pfad: g1 }, { name: "klein-danach.txt", pfad: join(tmp, "klein-danach.txt") }]); } catch (e) { fehler1 = e.message; }
        await new Promise((r) => s1.end(r));
        await rm(g1, { force: true });
        const soll1 = [{ name: "riesig.mp4", groesse: Math.round(4.3 * GB) }, { name: "klein-danach.txt", groesse: 6 }];
        const l1 = fehler1 ? { fehler: [fehler1] } : lies(zip1);
        t.ok("B1 Einzeldatei 4,3 GB: tar liest Groessen", !fehler1 && passt(l1.tar, soll1), { tar: l1.tar, fehler: l1.fehler });
        t.ok("B1 Einzeldatei 4,3 GB: .NET liest Groessen", !fehler1 && passt(l1.net, soll1), { net: l1.net, fehler: l1.fehler });
        t.ok("B1 Einzeldatei 4,3 GB: CRC stimmt", !fehler1 && l1.crcOk, l1.fehler);
        await rm(zip1, { force: true });

        // --- gross ueber den Server: 2 x 2,2 GB = Offsets ueber 4 GB --------------------------------
        const g = Math.round(2.2 * GB);
        leerDatei(join(roh, "TEST-clip-a.mp4"), g);
        leerDatei(join(roh, "TEST-clip-b.mp4"), g);
        const res2 = await u.api("GET", `/api/projekt/download?was=rohmaterial&karteId=${k.id}`, undefined, { roh: true });
        const zip2 = join(tmp, "server-gross.zip");
        let fehler2 = null;
        try { await pipeline(Readable.fromWeb(res2.body), createWriteStream(zip2)); } catch (e) { fehler2 = e.message; }
        const soll2 = [{ name: "a.mp4", groesse: 123456 }, { name: "Übersicht.txt", groesse: 2 }, { name: "TEST-clip-a.mp4", groesse: g }, { name: "TEST-clip-b.mp4", groesse: g }];
        t.ok("B1 Server lebt nach 4,4-GB-Download", await u.lebt(), (await u.log()).slice(-600));
        const l2 = fehler2 ? { fehler: [fehler2] } : lies(zip2);
        t.ok("B1 4,4-GB-ZIP vom Server: tar und .NET lesen alles, CRC ok", !fehler2 && passt(l2.tar, soll2) && passt(l2.net, soll2) && l2.crcOk, { tar: l2.tar, net: l2.net, fehler: l2.fehler });
        await rm(zip2, { force: true });
      }
    } finally {
      await u.aufraeumen();
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  return t.ende();
}
