// Erzeugt das nahtlos kachelbare Hintergrundmuster (Pop-Shop-Poster-Look) als SVG.
//
// Eigener Generator, keine nachgezeichnete Vorlage: tanzende Strichmaennchen-Silhouetten (dicke
// Tintenkontur, flache Signalfarbe, zufaellige Tanzposen, teils kopfueber) mit Bewegungsstrichen,
// dazwischen Kritzel-Fuellmotive (Schlangenlinien, Zickzack, Strichgruppen, Strahlenkraenze,
// Herzen, Sterne, Spiralen, Kreuze). Alles liegt auf einem Torus: was rechts herausragt, kommt
// links wieder herein, die Kachel schliesst sich an allen Seiten ohne Naht.
//
// Aufruf:  node tools/make-texture-popshop.mjs      (schreibt public/texture-popshop*.svg)
// Stellschrauben: T (Kachelgroesse), FIGUREN, FIGUR_ABSTAND, FUELL_ABSTAND, KONTUR, SEED.

import { writeFileSync } from "node:fs";

const T = 760; // Kachelgroesse in px
const FIGUREN = 9; // Anzahl tanzender Figuren je Kachel
const FIGUR_ABSTAND = 175; // Mindestabstand der Figurenmitten (Torus-Abstand)
const FUELL_ABSTAND = 54; // Mindestabstand der Fuellmotive zu allem anderen
const KONTUR = 6; // Dicke der Tintenkontur
const LIMB = 19; // Dicke der Koerperteile (Innenflaeche)
const SEED = 1987;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(SEED);
const zw = (a, b) => a + rnd() * (b - a);
const wahl = (arr) => arr[Math.floor(rnd() * arr.length)];
const f = (v) => (Math.round(v * 10) / 10).toString();
const rad = (g) => (g * Math.PI) / 180;

const FARBEN = {
  hell: { ink: "#1f1b16", op: 0.3, fill: ["#ff4b2b", "#ffd21f", "#1f8fe0", "#2fb457", "#ff4fa3", "#ff8a1f"] },
  dunkel: { ink: "#f0e4c8", op: 0.24, fill: ["#e5543a", "#e8c030", "#3c8fd0", "#3aa85a", "#e0529a", "#e8802a"] },
};

// Torus-Abstand zweier Punkte
const dist = (a, b) => {
  let dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  dx = Math.min(dx, T - dx); dy = Math.min(dy, T - dy);
  return Math.hypot(dx, dy);
};

// ---- Figur: Skelett aus Gelenken, Konturdurchgang unter Fuelldurchgang -------------------------
function figur(pal) {
  const farbe = wahl(pal.fill);
  const hueft = [0, 0];
  const torso = zw(30, 40);
  const hals = [0, -torso];
  const pol = (p, laenge, grad) => [p[0] + laenge * Math.cos(rad(grad)), p[1] + laenge * Math.sin(rad(grad))];
  // Arme: Schulter = Halsansatz; je zwei Segmente, Winkel in Grad (0 = rechts, -90 = oben)
  const armPose = () => {
    const a1 = wahl([-130, -110, -80, -50, -20, 160, 200, 20, 140]);
    const a2 = a1 + wahl([-70, -45, 40, 65, 0, 20]);
    const o = pol(hals, 30, a1);
    return [hals, o, pol(o, 28, a2)];
  };
  const beinPose = (seite) => {
    const a1 = 90 + seite * zw(10, 55); // 90 = nach unten
    const a2 = a1 + seite * wahl([-55, -30, 20, 45, 70]);
    const o = pol(hueft, 34, a1);
    return [hueft, o, pol(o, 32, a2)];
  };
  const glieder = [
    [hueft, hals],
    armPose(), armPose(),
    beinPose(-1), beinPose(1),
  ];
  const kopf = pol(hals, 22, wahl([-90, -90, -80, -100, -70, -110]));
  const kopfR = zw(15, 19);
  const striche = (breite, farbeStr) =>
    glieder.map((g) => `<polyline points="${g.map((p) => f(p[0]) + "," + f(p[1])).join(" ")}" stroke="${farbeStr}" stroke-width="${breite}" fill="none"/>`).join("") +
    `<circle cx="${f(kopf[0])}" cy="${f(kopf[1])}" r="${f(kopfR + (breite - LIMB) / 2)}" fill="${farbeStr}" stroke="none"/>`;
  // Innenzeichnung: zwei kurze Striche auf dem Rumpf, manchmal ein X
  let innen = "";
  if (rnd() < 0.6) innen += `<path d="M-6 ${f(-torso * 0.7)} l12 0 M-6 ${f(-torso * 0.4)} l12 0" stroke="__INK__" stroke-width="3.5" fill="none"/>`;
  else innen += `<path d="M-6 ${f(-torso * 0.75)} l12 ${f(torso * 0.5)} M6 ${f(-torso * 0.75)} l-12 ${f(torso * 0.5)}" stroke="__INK__" stroke-width="3.5" fill="none"/>`;
  // Bewegungsstriche um den Kopf
  let strahlen = "";
  const nS = wahl([0, 3, 5, 7]);
  for (let i = 0; i < nS; i++) {
    const w = -90 + (i - (nS - 1) / 2) * 24;
    const a = pol(kopf, kopfR + 12, w), b = pol(kopf, kopfR + 26, w);
    strahlen += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
  }
  const drehung = wahl([0, 0, 0, 180, -25, 25, -50, 50, 90, -90]);
  return { r: 112, drehung, svg: (ink) =>
    `<g>${striche(LIMB + KONTUR * 2, ink)}${striche(LIMB, farbe)}${innen.replaceAll("__INK__", ink)}<g stroke="${ink}" stroke-width="${KONTUR - 1}" stroke-linecap="round">${strahlen}</g></g>`,
  };
}

// ---- Fuellmotive (nur Kontur, Tinte) -----------------------------------------------------------
function fuell(pal) {
  const typ = wahl(["welle", "welle", "zickzack", "striche", "strahl", "spirale", "herz", "stern", "kreuz", "punkte", "bogen", "krake"]);
  const farbe = wahl(pal.fill);
  switch (typ) {
    case "welle": {
      const n = wahl([3, 4, 5, 6]), l = 22;
      let d = `M0 0`; for (let i = 0; i < n; i++) d += ` q${l / 2} ${-l} ${l} 0`;
      return { r: n * l / 2 + 8, svg: (ink) => `<path d="${d}" fill="none" stroke="${ink}"/>`, dreh: zw(0, 360) };
    }
    case "zickzack": {
      const n = wahl([4, 5, 6, 7]), l = 14;
      let d = `M0 0`; for (let i = 0; i < n; i++) d += ` l${l / 2} ${i % 2 ? l : -l}`;
      return { r: n * l / 2 + 8, svg: (ink) => `<path d="${d}" fill="none" stroke="${ink}"/>`, dreh: zw(0, 360) };
    }
    case "striche": {
      const n = wahl([3, 4, 5]); let d = "";
      for (let i = 0; i < n; i++) d += `M${i * 13} ${zw(-2, 2)} l${zw(-3, 3)} ${zw(26, 38)}`;
      return { r: 36, svg: (ink) => `<path d="${d}" fill="none" stroke="${ink}"/>`, dreh: zw(0, 360) };
    }
    case "strahl": {
      const n = wahl([8, 10, 12]); let d = "";
      for (let i = 0; i < n; i++) { const a = rad((i * 360) / n); d += `M${f(14 * Math.cos(a))} ${f(14 * Math.sin(a))} L${f(30 * Math.cos(a))} ${f(30 * Math.sin(a))} `; }
      return { r: 34, svg: (ink) => `<path d="${d}" fill="none" stroke="${ink}"/><circle r="9" fill="${farbe}" stroke="${ink}"/>`, dreh: 0 };
    }
    case "spirale": {
      let d = "M0 0"; for (let i = 1; i < 60; i++) { const a = i * 0.34, r = 1 + i * 0.42; d += ` L${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`; }
      return { r: 30, svg: (ink) => `<path d="${d}" fill="none" stroke="${ink}"/>`, dreh: zw(0, 360) };
    }
    case "herz":
      return { r: 28, svg: (ink) => `<path d="M0 22 C-34 -4 -22 -26 -9 -24 C-3 -23 0 -15 0 -15 C0 -15 3 -23 9 -24 C22 -26 34 -4 0 22 Z" fill="${farbe}" stroke="${ink}"/>`, dreh: zw(-25, 25) };
    case "stern": {
      let p = ""; for (let i = 0; i < 10; i++) { const a = rad(-90 + i * 36), r = i % 2 ? 11 : 27; p += `${f(r * Math.cos(a))},${f(r * Math.sin(a))} `; }
      return { r: 30, svg: (ink) => `<polygon points="${p}" fill="${farbe}" stroke="${ink}"/>`, dreh: zw(-30, 30) };
    }
    case "kreuz":
      return { r: 20, svg: (ink) => `<path d="M-14 -14 L14 14 M14 -14 L-14 14" fill="none" stroke="${ink}"/>`, dreh: zw(-20, 20) };
    case "punkte":
      return { r: 26, svg: (ink) => `<circle cx="-12" cy="0" r="5.5" fill="${ink}" stroke="none"/><circle cx="6" cy="-10" r="5.5" fill="${ink}" stroke="none"/><circle cx="12" cy="12" r="5.5" fill="${ink}" stroke="none"/>`, dreh: zw(0, 360) };
    case "bogen":
      return { r: 36, svg: (ink) => `<path d="M-30 12 Q0 -34 30 12" fill="none" stroke="${ink}"/><path d="M-18 14 Q0 -14 18 14" fill="none" stroke="${ink}"/>`, dreh: zw(0, 360) };
    default: // krake: kleines Wesen mit Schlangenarmen
      return { r: 36, svg: (ink) => `<circle r="13" fill="${farbe}" stroke="${ink}"/><path d="M-11 11 q-8 18 -20 14 M-4 13 q-3 22 -12 24 M5 13 q3 22 12 24 M11 11 q8 18 20 14" fill="none" stroke="${ink}"/><circle cx="-5" cy="-3" r="2.6" fill="${ink}" stroke="none"/><circle cx="5" cy="-3" r="2.6" fill="${ink}" stroke="none"/>`, dreh: zw(-25, 25) };
  }
}

function bauen(pal) {
  const platziert = [];
  const frei = (p, abstand) => platziert.every((q) => dist(p, q) >= abstand + (q.r + p.r) * 0.35);
  const figuren = [];
  for (let versuch = 0; figuren.length < FIGUREN && versuch < 4000; versuch++) {
    const m = { x: zw(0, T), y: zw(0, T), r: 112 };
    if (!frei(m, FIGUR_ABSTAND - 80)) continue;
    const fg = figur(pal);
    platziert.push({ ...m }); figuren.push({ ...m, fg });
  }
  const fuellungen = [];
  for (let versuch = 0; versuch < 9000; versuch++) {
    const m = { x: zw(0, T), y: zw(0, T) };
    const fe = fuell(pal);
    m.r = fe.r;
    if (!frei(m, FUELL_ABSTAND - 10)) continue;
    platziert.push(m); fuellungen.push({ ...m, fe });
  }
  const teile = [];
  const kopieren = (x, y, r, inhalt, drehung) => {
    for (let sx = -1; sx <= 1; sx++) for (let sy = -1; sy <= 1; sy++) {
      const cx = x + sx * T, cy = y + sy * T;
      if (cx < -r - 10 || cx > T + r + 10 || cy < -r - 10 || cy > T + r + 10) continue;
      teile.push(`<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(drehung)})">${inhalt}</g>`);
    }
  };
  for (const { x, y, fg } of figuren) kopieren(x, y, 112, fg.svg(pal.ink), fg.drehung);
  for (const { x, y, r, fe } of fuellungen) kopieren(x, y, r, fe.svg(pal.ink), fe.dreh);
  return { teile, figuren: figuren.length, fuellungen: fuellungen.length };
}

function svg(pal) {
  const { teile, figuren, fuellungen } = bauen(pal);
  console.log(`  ${figuren} Figuren, ${fuellungen} Fuellmotive, ${teile.length} Gruppen`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}"><g opacity="${pal.op}" stroke-width="${KONTUR}" stroke-linecap="round" stroke-linejoin="round">${teile.join("")}</g></svg>`;
}

// Gleiche Anordnung fuer hell und dunkel: Zufallsfolge je Datei neu starten, nur die Farben aendern sich.
for (const [name, pal] of [["hell", FARBEN.hell], ["dunkel", FARBEN.dunkel]]) {
  rnd = mulberry32(SEED);
  console.log(name);
  writeFileSync(new URL(`../public/texture-popshop${name === "dunkel" ? "-dark" : ""}.svg`, import.meta.url), svg(pal));
}
