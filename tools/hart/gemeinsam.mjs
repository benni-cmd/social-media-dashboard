// Harte Tests (v115) — gemeinsame Pruef-Helfer. Jede Gruppe sammelt Zeilen „ok"/„BEF" und meldet am Ende
// ihre Bilanz; lauf.mjs setzt daraus den Exit-Code. Soll = das Verhalten NACH den Fixes aus v114
// (docs/packages/v114-harter-nachtest.md, v115-fixes-aus-hartem-nachtest.md).

export function pruefer(gruppe) {
  const zeilen = [];
  const kurz = (x) => {
    const s = typeof x === "string" ? x : JSON.stringify(x);
    return s && s.length > 220 ? s.slice(0, 220) + " …" : s;
  };
  return {
    // Bedingung wahr = ok. `beleg` erscheint nur bei einem Befund.
    ok(name, bedingung, beleg) {
      zeilen.push({ ok: !!bedingung, text: `${bedingung ? "ok " : "BEF"} | ${gruppe} | ${name}${!bedingung && beleg !== undefined ? ` | ${kurz(beleg)}` : ""}` });
      return !!bedingung;
    },
    gleich(name, ist, soll) {
      const ok = JSON.stringify(ist) === JSON.stringify(soll);
      zeilen.push({ ok, text: `${ok ? "ok " : "BEF"} | ${gruppe} | ${name}${ok ? "" : ` | ist=${kurz(ist)} soll=${kurz(soll)}`}` });
      return ok;
    },
    hinweis(text) {
      zeilen.push({ ok: true, hinweis: true, text: `--- | ${gruppe} | ${text}` });
    },
    ende() {
      for (const z of zeilen) console.log(z.text);
      const bef = zeilen.filter((z) => !z.ok).length;
      const ok = zeilen.filter((z) => z.ok && !z.hinweis).length;
      console.log(`=== ${gruppe}: ${ok} ok, ${bef} Befund${bef === 1 ? "" : "e"}`);
      return { gruppe, ok, bef };
    },
  };
}

export const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

// Wartet, bis `f()` wahr liefert (oder die Zeit um ist). Liefert den letzten Wert.
export async function warteBis(f, { ms = 30000, takt = 250 } = {}) {
  const ende = Date.now() + ms;
  let w;
  while (Date.now() < ende) {
    try { w = await f(); if (w) return w; } catch { /* weiter warten */ }
    await schlaf(takt);
  }
  return w;
}
