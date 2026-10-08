// Minimaler ZIP-Schreiber — nur "stored" (keine Kompression). Zwei Gruende:
//   1. Rohvideo ist schon komprimiert; deflate braechte fast nichts und kostet CPU.
//   2. Das Projekt ist abhaengigkeitsfrei (package.json ohne dependencies) — eine
//      Zip-Bibliothek waere die erste Fremd-Dependency. Der Format-Kern ist klein genug,
//      um ihn hier selbst und belegt zu halten (APPNOTE 6.3.x, .ZIP File Format).
//
// Speichersicher bei grossen Dateien: die Dateikoerper werden GESTREAMT, nur die Header
// liegen im Speicher. Weil CRC und Groesse erst NACH dem Streamen feststehen, nutzen wir
// Data-Descriptors (General-Purpose-Bit 3); Bit 11 markiert die Namen als UTF-8.

import { createReadStream } from "node:fs";
import { once } from "node:events";
import { stat } from "node:fs/promises";

// --- CRC-32 (IEEE, wie ZIP ihn verlangt) ----------------------------------
const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crcStart = () => 0xffffffff;
function crcNext(crc, buf) {
  for (let i = 0; i < buf.length; i++) crc = (CRC_TABELLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return crc >>> 0;
}
const crcFertig = (crc) => (crc ^ 0xffffffff) >>> 0;

// DOS-Zeit/Datum aus einem Date (ZIP kennt kein ISO-Datum).
function dosZeitDatum(d) {
  const zeit = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const jahr = Math.max(0, d.getFullYear() - 1980);
  const datum = ((jahr & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { zeit, datum };
}

// Schreibt einen Buffer und respektiert Backpressure (wichtig bei grossen Streams).
async function schreib(strom, buf) {
  if (!strom.write(buf)) await once(strom, "drain");
}

const SIG_LOKAL = 0x04034b50;
const SIG_DESKRIPTOR = 0x08074b50;
const SIG_ZENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOKATOR = 0x07064b50;
const FLAGS = 0x0808; // Bit 3 (Data-Descriptor) + Bit 11 (UTF-8-Name)

// v115 (v114 B1): ZIP64 (APPNOTE 4.3.9, 4.4.x, 4.5.3). Bis v114 schrieb der Schreiber Groessen und Offsets nur als
// 32 Bit — ab 4 GB Rohmaterial (zwei 2,2-GB-Clips reichen) warf writeUInt32LE mitten im Download, das ZIP blieb
// ohne Verzeichnis und der Server stuerzte ab. Jetzt: eine Datei ab 4 GB bekommt im lokalen Kopf das ZIP64-Extra
// mit beiden Groessen und einen 64-Bit-Data-Descriptor; im zentralen Verzeichnis stehen grosse Groessen und Offsets
// im ZIP64-Extra; ab 4 GB Gesamtgroesse (oder 65 535 Eintraegen) folgen ZIP64-Ende und -Lokator.
// Geprueft mit zwei unabhaengigen Lesern (Windows-tar/libarchive inkl. CRC, .NET System.IO.Compression):
// tools/hart/zip.mjs --zip-gross.
const VOLL32 = 0xffffffff;
const VOLL16 = 0xffff;
const ZIP64_VERSION = 45;
const NORMAL_VERSION = 20;

function zip64Extra(werte) {
  const b = Buffer.alloc(4 + 8 * werte.length);
  b.writeUInt16LE(0x0001, 0);
  b.writeUInt16LE(8 * werte.length, 2);
  werte.forEach((w, i) => b.writeBigUInt64LE(BigInt(w), 4 + 8 * i));
  return b;
}

// Schreibt einen vollstaendigen ZIP nach `strom`. `dateien` = [{ name, pfad }].
// Beendet `strom` NICHT — das entscheidet der Aufrufer. Wirft bei Lesefehlern.
export async function schreibeZip(strom, dateien) {
  const eintraege = [];
  let offset = 0;

  for (const { name, pfad } of dateien) {
    const nameBuf = Buffer.from(name, "utf8");
    const { zeit, datum } = dosZeitDatum(new Date());
    const groesseVorab = (await stat(pfad)).size;
    const gross = groesseVorab >= VOLL32; // diese Datei braucht ZIP64-Groessen
    const extraLokal = gross ? zip64Extra([groesseVorab, groesseVorab]) : Buffer.alloc(0);

    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(SIG_LOKAL, 0);
    lokal.writeUInt16LE(gross ? ZIP64_VERSION : NORMAL_VERSION, 4); // Version, die zum Entpacken noetig ist
    lokal.writeUInt16LE(FLAGS, 6);
    lokal.writeUInt16LE(0, 8); // Methode 0 = stored
    lokal.writeUInt16LE(zeit, 10);
    lokal.writeUInt16LE(datum, 12);
    // CRC bleibt 0, Groessen 0 (bzw. 0xFFFFFFFF bei ZIP64) — die Werte kommen im Data-Descriptor.
    lokal.writeUInt32LE(gross ? VOLL32 : 0, 18);
    lokal.writeUInt32LE(gross ? VOLL32 : 0, 22);
    lokal.writeUInt16LE(nameBuf.length, 26);
    lokal.writeUInt16LE(extraLokal.length, 28);
    const lokalOffset = offset;
    await schreib(strom, lokal);
    await schreib(strom, nameBuf);
    if (extraLokal.length) await schreib(strom, extraLokal);
    offset += lokal.length + nameBuf.length + extraLokal.length;

    // Dateikoerper streamen, dabei CRC und Groesse mitzaehlen.
    let crc = crcStart();
    let groesse = 0;
    const leser = createReadStream(pfad);
    for await (const chunk of leser) {
      groesse += chunk.length;
      crc = crcNext(crc, chunk);
      await schreib(strom, chunk);
    }
    crc = crcFertig(crc);
    offset += groesse;
    if (groesse !== groesseVorab) throw new Error(`„${name}“ hat sich waehrend des Packens geaendert (${groesseVorab} -> ${groesse} Bytes).`);

    const desk = Buffer.alloc(gross ? 24 : 16);
    desk.writeUInt32LE(SIG_DESKRIPTOR, 0);
    desk.writeUInt32LE(crc, 4);
    if (gross) {
      desk.writeBigUInt64LE(BigInt(groesse), 8); // komprimiert = unkomprimiert (stored)
      desk.writeBigUInt64LE(BigInt(groesse), 16);
    } else {
      desk.writeUInt32LE(groesse, 8);
      desk.writeUInt32LE(groesse, 12);
    }
    await schreib(strom, desk);
    offset += desk.length;

    eintraege.push({ nameBuf, crc, groesse, lokalOffset, zeit, datum, gross });
  }

  // Zentrales Verzeichnis.
  const zentralStart = offset;
  for (const e of eintraege) {
    const werte = [];
    if (e.groesse >= VOLL32 || e.gross) werte.push(e.groesse, e.groesse); // unkomprimiert, komprimiert
    if (e.lokalOffset >= VOLL32) werte.push(e.lokalOffset);
    const extra = werte.length ? zip64Extra(werte) : Buffer.alloc(0);
    const z64 = werte.length > 0;
    const kopf = Buffer.alloc(46);
    kopf.writeUInt32LE(SIG_ZENTRAL, 0);
    kopf.writeUInt16LE(z64 ? ZIP64_VERSION : NORMAL_VERSION, 4); // version made by
    kopf.writeUInt16LE(z64 ? ZIP64_VERSION : NORMAL_VERSION, 6); // version needed
    kopf.writeUInt16LE(FLAGS, 8);
    kopf.writeUInt16LE(0, 10); // Methode stored
    kopf.writeUInt16LE(e.zeit, 12);
    kopf.writeUInt16LE(e.datum, 14);
    kopf.writeUInt32LE(e.crc, 16);
    kopf.writeUInt32LE(e.groesse >= VOLL32 || e.gross ? VOLL32 : e.groesse, 20);
    kopf.writeUInt32LE(e.groesse >= VOLL32 || e.gross ? VOLL32 : e.groesse, 24);
    kopf.writeUInt16LE(e.nameBuf.length, 28);
    kopf.writeUInt16LE(extra.length, 30); // extra
    kopf.writeUInt16LE(0, 32); // comment
    kopf.writeUInt16LE(0, 34); // disk
    kopf.writeUInt16LE(0, 36); // interne Attribute
    kopf.writeUInt32LE(0, 38); // externe Attribute
    kopf.writeUInt32LE(e.lokalOffset >= VOLL32 ? VOLL32 : e.lokalOffset, 42);
    await schreib(strom, kopf);
    await schreib(strom, e.nameBuf);
    if (extra.length) await schreib(strom, extra);
    offset += kopf.length + e.nameBuf.length + extra.length;
  }
  const zentralGroesse = offset - zentralStart;

  // ZIP64-Ende + Lokator, sobald ein Wert des normalen Endes nicht mehr passt.
  const anzahl = eintraege.length;
  const brauchtEnde64 = anzahl >= VOLL16 || zentralGroesse >= VOLL32 || zentralStart >= VOLL32;
  if (brauchtEnde64) {
    const ende64Offset = offset;
    const e64 = Buffer.alloc(56);
    e64.writeUInt32LE(SIG_EOCD64, 0);
    e64.writeBigUInt64LE(44n, 4); // Groesse des restlichen Datensatzes
    e64.writeUInt16LE(ZIP64_VERSION, 12);
    e64.writeUInt16LE(ZIP64_VERSION, 14);
    e64.writeUInt32LE(0, 16); // diese Disk
    e64.writeUInt32LE(0, 20); // Disk mit dem Verzeichnis
    e64.writeBigUInt64LE(BigInt(anzahl), 24);
    e64.writeBigUInt64LE(BigInt(anzahl), 32);
    e64.writeBigUInt64LE(BigInt(zentralGroesse), 40);
    e64.writeBigUInt64LE(BigInt(zentralStart), 48);
    await schreib(strom, e64);
    const lok = Buffer.alloc(20);
    lok.writeUInt32LE(SIG_EOCD64_LOKATOR, 0);
    lok.writeUInt32LE(0, 4);
    lok.writeBigUInt64LE(BigInt(ende64Offset), 8);
    lok.writeUInt32LE(1, 16); // Anzahl Disks
    await schreib(strom, lok);
    offset += e64.length + lok.length;
  }

  // End Of Central Directory.
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4); // Disk
  eocd.writeUInt16LE(0, 6); // Disk mit CD
  eocd.writeUInt16LE(Math.min(anzahl, VOLL16), 8);
  eocd.writeUInt16LE(Math.min(anzahl, VOLL16), 10);
  eocd.writeUInt32LE(Math.min(zentralGroesse, VOLL32), 12);
  eocd.writeUInt32LE(Math.min(zentralStart, VOLL32), 16);
  eocd.writeUInt16LE(0, 20); // Kommentarlaenge
  await schreib(strom, eocd);
}
