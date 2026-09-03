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
const FLAGS = 0x0808; // Bit 3 (Data-Descriptor) + Bit 11 (UTF-8-Name)

// Schreibt einen vollstaendigen ZIP nach `strom`. `dateien` = [{ name, pfad }].
// Beendet `strom` NICHT — das entscheidet der Aufrufer. Wirft bei Lesefehlern.
export async function schreibeZip(strom, dateien) {
  const eintraege = [];
  let offset = 0;

  for (const { name, pfad } of dateien) {
    const nameBuf = Buffer.from(name, "utf8");
    const { zeit, datum } = dosZeitDatum(new Date());

    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(SIG_LOKAL, 0);
    lokal.writeUInt16LE(20, 4); // Version, die zum Entpacken noetig ist
    lokal.writeUInt16LE(FLAGS, 6);
    lokal.writeUInt16LE(0, 8); // Methode 0 = stored
    lokal.writeUInt16LE(zeit, 10);
    lokal.writeUInt16LE(datum, 12);
    // CRC + Groessen bleiben 0 — sie kommen im Data-Descriptor.
    lokal.writeUInt16LE(nameBuf.length, 26);
    lokal.writeUInt16LE(0, 28); // extra length
    await schreib(strom, lokal);
    await schreib(strom, nameBuf);
    const lokalOffset = offset;
    offset += lokal.length + nameBuf.length;

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

    const desk = Buffer.alloc(16);
    desk.writeUInt32LE(SIG_DESKRIPTOR, 0);
    desk.writeUInt32LE(crc, 4);
    desk.writeUInt32LE(groesse, 8); // komprimiert = unkomprimiert (stored)
    desk.writeUInt32LE(groesse, 12);
    await schreib(strom, desk);
    offset += desk.length;

    eintraege.push({ nameBuf, crc, groesse, lokalOffset, zeit, datum });
  }

  // Zentrales Verzeichnis.
  const zentralStart = offset;
  for (const e of eintraege) {
    const kopf = Buffer.alloc(46);
    kopf.writeUInt32LE(SIG_ZENTRAL, 0);
    kopf.writeUInt16LE(20, 4); // version made by
    kopf.writeUInt16LE(20, 6); // version needed
    kopf.writeUInt16LE(FLAGS, 8);
    kopf.writeUInt16LE(0, 10); // Methode stored
    kopf.writeUInt16LE(e.zeit, 12);
    kopf.writeUInt16LE(e.datum, 14);
    kopf.writeUInt32LE(e.crc, 16);
    kopf.writeUInt32LE(e.groesse, 20);
    kopf.writeUInt32LE(e.groesse, 24);
    kopf.writeUInt16LE(e.nameBuf.length, 28);
    kopf.writeUInt16LE(0, 30); // extra
    kopf.writeUInt16LE(0, 32); // comment
    kopf.writeUInt16LE(0, 34); // disk
    kopf.writeUInt16LE(0, 36); // interne Attribute
    kopf.writeUInt32LE(0, 38); // externe Attribute
    kopf.writeUInt32LE(e.lokalOffset, 42);
    await schreib(strom, kopf);
    await schreib(strom, e.nameBuf);
    offset += kopf.length + e.nameBuf.length;
  }
  const zentralGroesse = offset - zentralStart;

  // End Of Central Directory.
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4); // Disk
  eocd.writeUInt16LE(0, 6); // Disk mit CD
  eocd.writeUInt16LE(eintraege.length, 8);
  eocd.writeUInt16LE(eintraege.length, 10);
  eocd.writeUInt32LE(zentralGroesse, 12);
  eocd.writeUInt32LE(zentralStart, 16);
  eocd.writeUInt16LE(0, 20); // Kommentarlaenge
  await schreib(strom, eocd);
}
