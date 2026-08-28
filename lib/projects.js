// Projektordner in Drive: anlegen, verschieben, lesen — und der Abgleich, der das Board
// gegen Drive heilt.
//
// Der Vertrag aus docs/drive-convention.md lautet: der Board-Zustand ist eine Spiegelung
// der Drive-Struktur. Bis v8 war das nur Prosa — `/api/drive/board` und `projekt.json`
// wurden geschrieben, aber nie gelesen (Befunde B4 und B5). Hier steht die Umsetzung.

import * as drive from "./drive.js";
import {
  PHASEN,
  UNTERORDNER,
  VIDEO_ENDUNGEN,
  projektName,
  projektNameNeu,
  projektPfad,
  phaseOrdner,
  leereKarte,
  migriere,
} from "./pipeline.js";

// Maschinen-Index eines Projekts, in Drive menschenlesbar als projekt.json.
export function projektJson(card) {
  return JSON.stringify(
    {
      id: card.id,
      name: projektName(card),
      serie: card.serie || "",
      episode: card.episode || "",
      title: card.title || "",
      format: card.format || "",
      pillar: card.pillar || "",
      goal: card.goal || "",
      platforms: card.platforms || [],
      column: card.column || "",
      dates: card.dates || {},
      uploadTime: card.uploadTime || "",
      aktualisiert: new Date().toISOString(),
    },
    null,
    2
  );
}

// Legt den Projektordner in der aktuellen Phase an. Gibt den eingefrorenen Namen zurueck —
// ab hier lebt er als card.driveName weiter und wird nie wieder aus dem Titel abgeleitet.
export async function anlegen(card) {
  const name = card.driveName || projektNameNeu(card);
  const basis = `${phaseOrdner(card.column)}/${name}`;
  await drive.mkdir(basis);
  for (const sub of UNTERORDNER) await drive.mkdir(`${basis}/${sub}`);
  await drive.writeFile(`${basis}/projekt.json`, projektJson({ ...card, driveName: name }));
  return { name, basis, links: await linksVon(basis) };
}

async function linksVon(basis) {
  const links = { _projekt: await drive.link(basis) };
  for (const sub of UNTERORDNER) links[sub] = await drive.link(`${basis}/${sub}`);
  return links;
}

// Sucht den Projektordner in ALLEN Phasen — nicht nur in der, die das Board vermutet.
// Damit findet der Abgleich einen Ordner auch dann, wenn jemand ihn in Drive von Hand
// verschoben hat.
export async function findeOrdner(name) {
  for (const p of PHASEN) {
    const pfad = `${p.ordner}/${name}`;
    if (await drive.existiert(pfad)) return { phase: p.id, pfad };
  }
  return null;
}

// Was liegt im Projektordner? Trennt sauber: gibt es ihn nicht, ist das kein Fehler;
// antwortet Drive nicht, ist das einer.
export async function scan(card) {
  const name = projektName(card);
  const erwartet = projektPfad(card);

  try {
    let ort = (await drive.existiert(erwartet)) ? { phase: card.column, pfad: erwartet } : null;
    if (!ort) ort = await findeOrdner(name);

    if (!ort)
      return {
        name,
        driveOk: true,
        vorhanden: false,
        satz: "Fuer diese Karte gibt es noch keinen Ordner in Drive.",
        rohmaterial: 0,
        final: 0,
        skriptDateien: [],
        links: {},
      };

    const roh = await drive.count(`${ort.pfad}/Rohmaterial`);
    const videoDateien = await drive.list(`${ort.pfad}/Fertiges Video`, { filesOnly: true });
    const final = videoDateien.filter((n) => VIDEO_ENDUNGEN.some((x) => n.toLowerCase().endsWith(x))).length;
    const skriptDateien = await drive.list(`${ort.pfad}/Skript und Caption`, { filesOnly: true });

    return {
      name,
      driveOk: true,
      vorhanden: true,
      phase: ort.phase,
      pfad: ort.pfad,
      verschoben: ort.phase !== card.column,
      satz:
        ort.phase === card.column
          ? `Der Ordner liegt in Drive unter "${ort.pfad}".`
          : `Der Ordner liegt in Drive unter "${ort.pfad}" — also in einer anderen Phase, als das Board zeigt.`,
      rohmaterial: roh,
      final,
      skriptDateien,
      links: await linksVon(ort.pfad),
    };
  } catch (e) {
    // Echte Stoerung: nicht als "leer" ausgeben, sonst zeigt die Oberflaeche etwas Falsches.
    return {
      name,
      driveOk: false,
      vorhanden: null,
      satz: `Drive liess sich nicht lesen: ${e.message}`,
      rohmaterial: 0,
      final: 0,
      skriptDateien: [],
      links: {},
    };
  }
}

// Verschiebt den Projektordner in die Ziel-Phase. Nutzt den EINGEFRORENEN Namen, damit
// ein umbenannter Titel den Ordner nicht verwaisen laesst (Befund B2).
export async function verschiebe(card, zielPhase) {
  const name = projektName(card);
  const ort = await findeOrdner(name);
  if (!ort) {
    // Es gibt noch nichts zu verschieben — dann jetzt am Ziel anlegen.
    const angelegt = await anlegen({ ...card, column: zielPhase, driveName: name });
    return { angelegt: true, ...angelegt };
  }
  const ziel = `${phaseOrdner(zielPhase)}/${name}`;
  if (ort.pfad !== ziel) await drive.moveDir(ort.pfad, ziel);
  await drive.writeFile(`${ziel}/projekt.json`, projektJson({ ...card, column: zielPhase, driveName: name }));
  return { angelegt: false, name, basis: ziel, links: await linksVon(ziel) };
}

export async function speichereDatei(card, dateiname, inhalt) {
  const name = projektName(card);
  const ort = (await findeOrdner(name)) || { pfad: projektPfad(card) };
  const ziel = `${ort.pfad}/Skript und Caption`;
  await drive.mkdir(ort.pfad);
  await drive.mkdir(ziel);
  await drive.writeFile(`${ziel}/${dateiname}`, inhalt);
  return `${ziel}/${dateiname}`;
}

async function leseProjektJson(pfad) {
  try {
    return JSON.parse(await drive.readFile(`${pfad}/projekt.json`));
  } catch {
    return null;
  }
}

// --- Abgleich -------------------------------------------------------------
//
// Liest ALLE Phasenordner und stellt sie den Karten gegenueber. Drive gewinnt bei der
// Phase (dort sieht ein Mensch, was er tut); das Board gewinnt bei allem, was in Drive
// gar nicht steht. Liefert einen Bericht in Saetzen, keine stille Korrektur.

export async function abgleich(cards) {
  const inDrive = new Map(); // Ordnername -> Phase
  for (const p of PHASEN) {
    const namen = await drive.list(p.ordner, { dirsOnly: true });
    for (const n of namen) inDrive.set(n, p.id);
  }

  const karten = cards.map((c) => migriere(c));
  const befunde = [];
  let geaendert = false;

  for (const karte of karten) {
    const name = projektName(karte);
    // Karten ohne Ordner in Drive: unauffaellig, solange sie noch nie angelegt wurden.
    if (!inDrive.has(name)) {
      if (karte.driveName)
        befunde.push({
          status: "befund",
          satz: `Zur Karte "${karte.title}" gibt es in Drive keinen Ordner "${name}" mehr.`,
        });
      continue;
    }
    const drivePhase = inDrive.get(name);
    inDrive.delete(name);
    // Namen einfrieren, falls das noch nicht geschehen ist.
    if (!karte.driveName) {
      karte.driveName = name;
      geaendert = true;
    }
    if (drivePhase !== karte.column) {
      befunde.push({
        status: "hinweis",
        satz: `"${karte.title}" liegt in Drive unter "${phaseOrdner(drivePhase)}", das Board zeigte "${phaseOrdner(
          karte.column
        )}". Das Board folgt Drive.`,
      });
      karte.column = drivePhase;
      geaendert = true;
    }
  }

  // Was in Drive liegt, aber keine Karte hat: aus projekt.json aufbauen.
  for (const [name, phaseId] of inDrive) {
    const daten = await leseProjektJson(`${phaseOrdner(phaseId)}/${name}`);
    const neu = {
      ...leereKarte(phaseId),
      title: (daten && daten.title) || name,
      serie: (daten && daten.serie) || "",
      episode: (daten && daten.episode) || "",
      format: (daten && daten.format) || "Reel",
      pillar: (daten && daten.pillar) || "",
      goal: (daten && daten.goal) || "reach_new",
      platforms: (daten && daten.platforms) || ["instagram"],
      dates: (daten && daten.dates) || {},
      uploadTime: (daten && daten.uploadTime) || "",
      driveName: name,
      notes: daten ? "" : "Aus dem Drive-Ordner uebernommen — es gab keine projekt.json zum Auslesen.",
    };
    if (daten && daten.id) neu.id = daten.id;
    karten.push(neu);
    geaendert = true;
    befunde.push({
      status: "hinweis",
      satz: `In Drive lag "${name}" ohne Karte im Board. Die Karte wurde angelegt.`,
    });
  }

  if (!befunde.length)
    befunde.push({ status: "ok", satz: "Board und Drive stimmen ueberein — nichts zu heilen." });

  return { cards: karten, befunde, geaendert };
}
