// Konto-KPIs (Tabelle 2 + 3): Follower-Verlauf und Follower-Demografie als menschenlesbare
// CSV nach Drive — unabhaengig von einzelnen Videos, in fester Kadenz fortgeschrieben.
//
// Entwurf und Belege: docs/packages/v17-kpi-tabellen-drive.md
//
// Warum eine eigene Kadenz (nicht am Post-Alter): Follower-GESAMT und Demografie liefert die
// API nur als Jetzt-Wert ohne Historie — die Kurve entsteht allein durch regelmaessige
// Schnappschuesse. Nur der Follower-ZUWACHS ist ~12 Monate rueckwirkend holbar (einmaliger
// Backfill beim ersten Lauf). Ausloeser ist der bestehende collect-Fluss (kpi.sammle);
// server.js bleibt unberuehrt.

import * as drive from "./drive.js";
import * as social from "./social.js";
import { isoDatum, plattformName } from "./pipeline.js";
import { ORDNER, haengeCsv, zeileNachSpalten, headerAusSpalten, zahl, stelleLegendeSicher } from "./kpi-tabellen.js";

const VERLAUF = `${ORDNER}/kanal-verlauf.csv`;
const DEMOGRAFIE = `${ORDNER}/follower-demografie.csv`;

// Kadenz in Tagen: Konto-Verlauf woechentlich, Demografie quartalsweise (Owner 02.09.2026).
const VERLAUF_TAGE = 7;
const DEMOGRAFIE_TAGE = 90;

const VERLAUF_SPALTEN = [
  ["plattform", "plattform"],
  ["datum", "datum"],
  ["follower_gesamt", "followerGesamt"],
  ["follower_zuwachs_organisch", "zuwachsOrganisch"],
  ["follower_zuwachs_bezahlt", "zuwachsBezahlt"],
  ["reichweite_konto", "reichweite"],
  ["views_konto", "views"],
  ["interaktionen_konto", "interaktionen"],
  ["accounts_engaged", "accountsEngaged"],
  ["media_anzahl", "mediaAnzahl"],
];

const DEMOGRAFIE_SPALTEN = [
  ["plattform", "plattform"],
  ["datum", "datum"],
  ["facette", "facette"],
  ["auspraegung", "auspraegung"],
  ["anzahl", "anzahl"],
];

// --- Datum-Hilfen ----------------------------------------------------------

function tageZwischen(isoFrueh, isoSpaet) {
  const a = new Date(isoFrueh + "T00:00:00");
  const b = new Date(isoSpaet + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

// Neuestes Datum (Spalte 1) in einer Drive-CSV, oder null wenn Datei fehlt/leer.
async function letztesDatum(pfad) {
  let inhalt = "";
  try {
    inhalt = await drive.readFile(pfad);
  } catch (e) {
    if (e.fehlend) return null;
    throw e;
  }
  let neuestes = null;
  for (const zeile of inhalt.split(/\r?\n/).slice(1)) {
    const feld = zeile.split(";");
    const d = (feld[1] || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!neuestes || d > neuestes)) neuestes = d;
  }
  return neuestes;
}

// Ist eine Tabelle faellig? Fehlt sie ganz -> ja. Sonst wenn der Abstand die Kadenz erreicht.
async function faellig(pfad, tage, heute) {
  const letztes = await letztesDatum(pfad);
  if (!letztes) return true;
  return tageZwischen(letztes, heute) >= tage;
}

// --- Zeilen bauen ----------------------------------------------------------

function verlaufZeile(snap, heute) {
  return {
    plattform: plattformName(snap.plattform),
    datum: heute,
    followerGesamt: zahl(snap.followerGesamt),
    zuwachsOrganisch: zahl(snap.zuwachsOrganisch),
    zuwachsBezahlt: zahl(snap.zuwachsBezahlt),
    reichweite: zahl(snap.reichweite),
    views: zahl(snap.views),
    interaktionen: zahl(snap.interaktionen),
    accountsEngaged: zahl(snap.accountsEngaged),
    mediaAnzahl: zahl(snap.mediaAnzahl),
  };
}

function demografieZeilen(snap, heute) {
  return (snap.demografie || []).map((d) => ({
    plattform: plattformName(snap.plattform),
    datum: heute,
    facette: d.facette,
    auspraegung: d.auspraegung,
    anzahl: zahl(d.anzahl),
  }));
}

// Backfill-Zeilen aus der LinkedIn-Zuwachsreihe: nur Zuwachs, kein Follower-Gesamt.
function backfillZeilen(reihe) {
  return reihe
    .filter((p) => p.datum)
    .map((p) => ({
      plattform: plattformName("linkedin"),
      datum: p.datum,
      followerGesamt: "",
      zuwachsOrganisch: zahl(p.organisch),
      zuwachsBezahlt: zahl(p.bezahlt),
      reichweite: "", views: "", interaktionen: "", accountsEngaged: "", mediaAnzahl: "",
    }));
}

// --- Schreiben -------------------------------------------------------------

async function schreibeVerlauf(zeilen) {
  return haengeCsv({
    pfad: VERLAUF,
    header: headerAusSpalten(VERLAUF_SPALTEN),
    zeilen,
    zuCsv: (z) => zeileNachSpalten(z, VERLAUF_SPALTEN),
    schluessel: (z) => `${z.plattform}|${z.datum}`,
    schluesselAusFelder: (f) => `${f[0]}|${f[1]}`,
  });
}

async function schreibeDemografie(zeilen) {
  return haengeCsv({
    pfad: DEMOGRAFIE,
    header: headerAusSpalten(DEMOGRAFIE_SPALTEN),
    zeilen,
    zuCsv: (z) => zeileNachSpalten(z, DEMOGRAFIE_SPALTEN),
    schluessel: (z) => `${z.plattform}|${z.datum}|${z.facette}|${z.auspraegung}`,
    schluesselAusFelder: (f) => `${f[0]}|${f[1]}|${f[2]}|${f[3]}`,
  });
}

// --- Einstieg --------------------------------------------------------------

// Zieht — falls faellig — einen Konto-Schnappschuss je verbundener Plattform und schreibt
// ihn in kanal-verlauf.csv / follower-demografie.csv. Beim allerersten Lauf wird der
// LinkedIn-Follower-Zuwachs 12 Monate rueckwirkend nachgetragen. Gibt einen Bericht zurueck.
export async function schnappschussWennFaellig(tokens, heute = isoDatum(new Date())) {
  const bericht = [];
  const verlaufFaellig = await faellig(VERLAUF, VERLAUF_TAGE, heute);
  const demoFaellig = await faellig(DEMOGRAFIE, DEMOGRAFIE_TAGE, heute);
  if (!verlaufFaellig && !demoFaellig) return bericht;

  await drive.mkdir(ORDNER);
  await stelleLegendeSicher();
  const erstlauf = !(await drive.existiert(VERLAUF));

  const holer = { instagram: social.instagramKonto, linkedin: social.linkedinKonto };
  for (const plattform of ["instagram", "linkedin"]) {
    const token = tokens[plattform];
    if (!token) continue;

    let snap;
    try {
      snap = await holer[plattform](token);
    } catch (e) {
      bericht.push({ status: "kanal-fehler", plattform, grund: e.message });
      continue;
    }

    if (verlaufFaellig) {
      try {
        const { geschrieben } = await schreibeVerlauf([verlaufZeile(snap, heute)]);
        if (geschrieben) bericht.push({ status: "kanal-verlauf", plattform, zeilen: geschrieben });
      } catch (e) {
        bericht.push({ status: "kanal-fehler", plattform, grund: `Verlauf: ${e.message}` });
      }
    }

    if (demoFaellig) {
      const zeilen = demografieZeilen(snap, heute);
      if (zeilen.length) {
        try {
          const { geschrieben } = await schreibeDemografie(zeilen);
          if (geschrieben) bericht.push({ status: "demografie", plattform, zeilen: geschrieben });
        } catch (e) {
          bericht.push({ status: "kanal-fehler", plattform, grund: `Demografie: ${e.message}` });
        }
      }
    }

    // Einmaliger LinkedIn-Zuwachs-Backfill beim ersten Verlauf-Lauf.
    if (erstlauf && plattform === "linkedin") {
      try {
        const reihe = await social.linkedinZuwachsReihe(token, 12);
        const { geschrieben } = await schreibeVerlauf(backfillZeilen(reihe));
        if (geschrieben) bericht.push({ status: "kanal-backfill", plattform, zeilen: geschrieben });
      } catch (e) {
        bericht.push({ status: "kanal-fehler", plattform, grund: `Backfill: ${e.message}` });
      }
    }
  }

  return bericht;
}

export const _intern = {
  VERLAUF, DEMOGRAFIE, VERLAUF_SPALTEN, DEMOGRAFIE_SPALTEN,
  verlaufZeile, demografieZeilen, backfillZeilen, tageZwischen, faellig,
};
