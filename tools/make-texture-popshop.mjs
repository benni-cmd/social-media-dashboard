// Erzeugt das nahtlos kachelbare Hintergrundmuster (Pop-Shop-Labyrinth) als SVG.
// Eigener Generator, keine nachgezeichnete Vorlage: ein zufaelliger Spannbaum (Tiefensuche) auf
// einem Torus (Raster, dessen Rand sich um die Kachel schliesst) wird zu dicken, weich gerundeten
// Linien. Weil der Rand "herumlaeuft", passt die Kachel an allen vier Seiten ohne Naht.
//
// Aufruf:  node tools/make-texture-popshop.mjs          (schreibt public/texture-popshop*.svg)
// Stellschrauben unten: ZELLE (Dichte), STRICH (Liniendicke), WACKEL (Unruhe), SEED (anderes Muster).

import { writeFileSync } from "node:fs";

const ZELLE = 22; // Abstand der Linien in px
const N = 26; // Zellen je Seite -> Kachel = 572 px
const T = ZELLE * N;
const STRICH = 10; // Liniendicke
const WACKEL = 4.5; // Versatz der Knoten, macht die Linien unruhig statt gitterfoermig
const SEED = 1987;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);

const id = (x, y) => ((y + N) % N) * N + ((x + N) % N);
const knoten = [];
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    knoten.push({ x, y, px: x * ZELLE + ZELLE / 2 + (rnd() - 0.5) * 2 * WACKEL, py: y * ZELLE + ZELLE / 2 + (rnd() - 0.5) * 2 * WACKEL, nb: [] });
  }
}

// Zufaellige Tiefensuche -> Spannbaum mit langen, schlangenfoermigen Gaengen.
const besucht = new Uint8Array(N * N);
const stapel = [[0, 0]];
besucht[0] = 1;
const RICHT = [[1, 0], [-1, 0], [0, 1], [0, -1]];
while (stapel.length) {
  const [x, y] = stapel[stapel.length - 1];
  const frei = RICHT.map(([dx, dy]) => [dx, dy]).filter(([dx, dy]) => !besucht[id(x + dx, y + dy)]);
  if (!frei.length) { stapel.pop(); continue; }
  const [dx, dy] = frei[Math.floor(rnd() * frei.length)];
  const a = knoten[id(x, y)], b = knoten[id(x + dx, y + dy)];
  a.nb.push({ n: b, dx, dy });
  b.nb.push({ n: a, dx: -dx, dy: -dy });
  besucht[id(x + dx, y + dy)] = 1;
  stapel.push([(x + dx + N) % N, (y + dy + N) % N]);
}

// Ketten zwischen Knoten mit Grad != 2 ablaufen; Koordinaten "abgewickelt" (ueber den Rand hinaus).
const benutzt = new Set();
const kante = (a, b) => (a.x + a.y * N) * N * N + (b.x + b.y * N);
const ketten = [];
for (const start of knoten) {
  if (start.nb.length === 2) continue;
  for (const e0 of start.nb) {
    if (benutzt.has(kante(start, e0.n))) continue;
    // Abgewickelte Zellkoordinaten: jeder Schritt addiert (dx,dy) ohne Modulo, die Pixelposition
    // ergibt sich aus der Knotenposition plus dem Vielfachen der Kachelgroesse.
    let ux = start.x, uy = start.y;
    const pos = (n) => [n.px + (ux - n.x) * ZELLE, n.py + (uy - n.y) * ZELLE];
    const pts = [pos(start)];
    let vor = start, aktuell = e0;
    for (;;) {
      benutzt.add(kante(vor, aktuell.n)); benutzt.add(kante(aktuell.n, vor));
      ux += aktuell.dx; uy += aktuell.dy;
      pts.push(pos(aktuell.n));
      if (aktuell.n.nb.length !== 2) break;
      const weiter = aktuell.n.nb.find((e) => e.n !== vor);
      vor = aktuell.n; aktuell = weiter;
    }
    ketten.push(pts);
  }
}

const f = (v) => v.toFixed(1);
function pfad(pts, sx, sy) {
  const P = pts.map(([x, y]) => [x + sx * T, y + sy * T]);
  if (P.length === 2) return `M${f(P[0][0])} ${f(P[0][1])}L${f(P[1][0])} ${f(P[1][1])}`;
  let d = `M${f(P[0][0])} ${f(P[0][1])}`;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(P[0], P[1]);
  d += `L${f(m0[0])} ${f(m0[1])}`;
  for (let i = 1; i < P.length - 1; i++) {
    const m = mid(P[i], P[i + 1]);
    d += `Q${f(P[i][0])} ${f(P[i][1])} ${f(m[0])} ${f(m[1])}`;
  }
  d += `L${f(P[P.length - 1][0])} ${f(P[P.length - 1][1])}`;
  return d;
}
const pad = STRICH;
const teile = [];
for (const pts of ketten) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  for (let sx = -2; sx <= 2; sx++) {
    for (let sy = -2; sy <= 2; sy++) {
      if (maxx + sx * T < -pad || minx + sx * T > T + pad) continue;
      if (maxy + sy * T < -pad || miny + sy * T > T + pad) continue;
      teile.push(pfad(pts, sx, sy));
    }
  }
}

function svg(farbe, deckkraft) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}"><path fill="none" stroke="${farbe}" stroke-opacity="${deckkraft}" stroke-width="${STRICH}" stroke-linecap="round" stroke-linejoin="round" d="${teile.join("")}"/></svg>`;
}
writeFileSync(new URL("../public/texture-popshop.svg", import.meta.url), svg("#2c2a26", 0.16));
writeFileSync(new URL("../public/texture-popshop-dark.svg", import.meta.url), svg("#ece0c4", 0.12));
console.log(`Kachel ${T}x${T}px, ${ketten.length} Ketten, ${teile.length} Teilpfade`);
