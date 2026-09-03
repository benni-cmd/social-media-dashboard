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
  AI_ORDNER,
  projektJsonPfad,
  VIDEO_ENDUNGEN,
  projektName,
  projektNameNeu,
  projektPfad,
  phaseOrdner,
  leereKarte,
  migriere,
} from "./pipeline.js";

// --- Dynamischer Ordner-Resolver (v17b) -----------------------------------
//
// Die Ordnernamen der Spalten kommen ab v17b aus Drive (System (AI only)/spalten.json), nicht
// mehr fest aus PHASEN. Der Server setzt hier nach jedem Abgleich die id->ordner-Map. Fehlt sie
// (oder eine id), faellt der Resolver auf den statischen phaseOrdner zurueck — so bleibt das
// Verhalten unveraendert, bis wirklich eine Spalte umbenannt wurde.
let SPALTEN_ORDNER = null;
export function setSpalten(map) { SPALTEN_ORDNER = map || null; }
const ordnerVon = (id) => (SPALTEN_ORDNER && SPALTEN_ORDNER.get(id)) || phaseOrdner(id);
const projektPfadDyn = (card, spalte) => `${ordnerVon(spalte || card.column)}/${projektName(card)}`;

// Die GANZE Karte als Drive-Wahrheit (v17). Frueher nur ein Auszug — die reichen Felder
// (hook, cta, frame, caption, video, checks, ai, published, metrics, KPI) lebten nur in
// board.json. Ab jetzt traegt projekt.json die vollstaendige Karte; `name` steht zusaetzlich
// obenauf, damit ein Blick in die Datei den Ordner benennt. Liegt in `<Karte>/(AI only)/`.
export function projektJson(card) {
  return JSON.stringify(
    { name: projektName(card), ...card, driveName: card.driveName || projektName(card), aktualisiert: new Date().toISOString() },
    null,
    2
  );
}

// Legt den Projektordner in der aktuellen Phase an. Gibt den eingefrorenen Namen zurueck —
// ab hier lebt er als card.driveName weiter und wird nie wieder aus dem Titel abgeleitet.
export async function anlegen(card) {
  const name = card.driveName || projektNameNeu(card);
  const basis = `${ordnerVon(card.column)}/${name}`;
  await drive.mkdir(basis);
  for (const sub of UNTERORDNER) await drive.mkdir(`${basis}/${sub}`);
  await drive.mkdir(`${basis}/${AI_ORDNER}`);
  await drive.writeFile(projektJsonPfad(basis), projektJson({ ...card, driveName: name }));
  return { name, basis, links: await linksVon(basis) };
}

// v23: Links aus Drive-IDs statt aus `rclone link` — ein `stat` + ein `lsjson -R` statt
// vier langsamer link-Aufrufe.
async function linksVon(basis) {
  const projId = await drive.ordnerId(basis);
  const inhalt = (await drive.inhaltRekursiv(basis)) || [];
  const idVon = (sub) => {
    const d = inhalt.find((e) => e.IsDir && e.Path === sub);
    return d && d.ID;
  };
  const links = { _projekt: drive.ordnerLink(projId) };
  for (const sub of UNTERORDNER) links[sub] = drive.ordnerLink(idVon(sub));
  return links;
}

// Sucht den Projektordner in ALLEN Phasen — nicht nur in der, die das Board vermutet.
// Damit findet der Abgleich einen Ordner auch dann, wenn jemand ihn in Drive von Hand
// verschoben hat.
export async function findeOrdner(name) {
  for (const p of PHASEN) {
    const pfad = `${ordnerVon(p.id)}/${name}`;
    if (await drive.existiert(pfad)) return { phase: p.id, pfad };
  }
  return null;
}

// Was liegt im Projektordner? Trennt sauber: gibt es ihn nicht, ist das kein Fehler;
// antwortet Drive nicht, ist das einer.
export async function scan(card) {
  const name = projektName(card);
  const erwartet = projektPfadDyn(card);

  try {
    // v23: EIN `stat` (Existenz + eigene Drive-ID) statt `existiert`; danach EIN `lsjson -R`
    // statt 3x list + 4x link. Aus 8 seriellen rclone-Aufrufen werden 2.
    let ort = null;
    const id = await drive.ordnerId(erwartet);
    if (id) ort = { phase: card.column, pfad: erwartet, id };
    else {
      const gefunden = await findeOrdner(name);
      if (gefunden) ort = { ...gefunden, id: await drive.ordnerId(gefunden.pfad) };
    }

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

    const inhalt = (await drive.inhaltRekursiv(ort.pfad)) || [];
    const dateienIn = (unter) => inhalt.filter((e) => !e.IsDir && e.Path.startsWith(unter + "/")).map((e) => e.Name);
    const idVon = (unter) => {
      const d = inhalt.find((e) => e.IsDir && e.Path === unter);
      return d && d.ID;
    };

    const roh = dateienIn("Rohmaterial").length;
    const skriptDateien = dateienIn("Skript und Caption");
    const final = dateienIn("Fertiges Video").filter((n) => VIDEO_ENDUNGEN.some((x) => n.toLowerCase().endsWith(x))).length;

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
      links: {
        _projekt: drive.ordnerLink(ort.id),
        "Skript und Caption": drive.ordnerLink(idVon("Skript und Caption")),
        Rohmaterial: drive.ordnerLink(idVon("Rohmaterial")),
        "Fertiges Video": drive.ordnerLink(idVon("Fertiges Video")),
      },
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
  const ziel = `${ordnerVon(zielPhase)}/${name}`;
  if (ort.pfad !== ziel) await drive.moveDir(ort.pfad, ziel);
  await drive.mkdir(`${ziel}/${AI_ORDNER}`);
  await drive.writeFile(projektJsonPfad(ziel), projektJson({ ...card, column: zielPhase, driveName: name }));
  return { angelegt: false, name, basis: ziel, links: await linksVon(ziel) };
}

export async function speichereDatei(card, dateiname, inhalt) {
  const name = projektName(card);
  const ort = (await findeOrdner(name)) || { pfad: projektPfadDyn(card) };
  const ziel = `${ort.pfad}/Skript und Caption`;
  await drive.mkdir(ort.pfad);
  await drive.mkdir(ziel);
  await drive.writeFile(`${ziel}/${dateiname}`, inhalt);
  return `${ziel}/${dateiname}`;
}

// Liest die projekt.json eines Ordners und sagt, WO sie lag: am neuen Ort `(AI only)/`
// oder noch am alten Ort in der Ordnerwurzel (v16 und frueher). Der Ort steuert die
// einmalige Migration im Abgleich (alt -> neu verschieben).
async function leseProjektJsonMitOrt(pfad) {
  try {
    return { daten: JSON.parse(await drive.readFile(projektJsonPfad(pfad))), amNeuenOrt: true };
  } catch {
    /* nicht am neuen Ort — alten Ort versuchen */
  }
  try {
    return { daten: JSON.parse(await drive.readFile(`${pfad}/projekt.json`)), amNeuenOrt: false };
  } catch {
    return { daten: null, amNeuenOrt: false };
  }
}

async function leseProjektJson(pfad) {
  return (await leseProjektJsonMitOrt(pfad)).daten;
}

// Schreibt die volle projekt.json einer Karte an den ERWARTETEN Ort (aus column + driveName),
// ohne Drive erst zu durchsuchen — schlank genug fuer den Speicherpfad (mkdir + write, kein
// deletefile). Nur fuer Karten mit driveName aufrufen; ein von Hand verschobener Ordner wird
// beim naechsten Abgleich geheilt. So propagiert jeder Karten-Edit in die Drive-Wahrheit.
export async function spiegeleKarte(card) {
  const pfad = projektPfadDyn(card);
  await drive.mkdir(`${pfad}/${AI_ORDNER}`);
  await drive.writeFile(projektJsonPfad(pfad), projektJson(migriere(card)));
  return pfad;
}

// Schreibt die volle projekt.json an den neuen Ort und raeumt eine Alt-Datei in der
// Ordnerwurzel weg. Idempotent genutzt: der Abgleich ruft das nur, wenn wirklich etwas fehlt
// oder migriert werden muss — im eingeschwungenen Zustand schreibt er nichts.
async function schreibeProjektJson(pfad, card) {
  await drive.mkdir(`${pfad}/${AI_ORDNER}`);
  await drive.writeFile(projektJsonPfad(pfad), projektJson(card));
  await drive.deleteFile(`${pfad}/projekt.json`); // Alt-Ort aufraeumen (fehlt = ok)
}

// --- Abgleich -------------------------------------------------------------
//
// Liest ALLE Phasenordner und stellt sie den Karten gegenueber. Drive gewinnt bei der
// Phase (dort sieht ein Mensch, was er tut); das Board gewinnt bei allem, was in Drive
// gar nicht steht. Liefert einen Bericht in Saetzen, keine stille Korrektur.

export async function abgleich(cards) {
  // Alle Karten-Ordner je Phase einsammeln: Ordnername -> Phase-ID. (AI only) und
  // System (AI only) sind Unterordner bzw. liegen im Root — sie tauchen hier nie auf.
  const inDrive = new Map();
  for (const p of PHASEN) {
    const namen = await drive.list(ordnerVon(p.id), { dirsOnly: true });
    for (const n of namen) inDrive.set(n, p.id);
  }

  const karten = cards.map((c) => migriere(c));
  const befunde = [];
  let geaendert = false;

  for (let i = 0; i < karten.length; i++) {
    const karte = karten[i];
    const name = projektName(karte);

    // Kein Ordner in Drive: Board behaelt die Karte unveraendert (Drive kann nur ueber
    // Felder gewinnen, die es auch fuehrt) — solange sie schon einmal angelegt war, Befund.
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
    const pfad = `${ordnerVon(drivePhase)}/${name}`;
    const { daten, amNeuenOrt } = await leseProjektJsonMitOrt(pfad);
    const vorher = JSON.stringify(karte);

    let neu;
    if (daten && daten.schema) {
      // Volle Karte in Drive = die Wahrheit. Drive gewinnt komplett; nur die id bleibt stabil.
      neu = migriere({ ...daten, id: daten.id || karte.id, driveName: name, column: drivePhase });
    } else if (daten) {
      // Alt-Auszug (v16 und frueher): Board liefert die reichen Felder, der Auszug seine —
      // so geht bei der Migration nichts verloren.
      neu = migriere({ ...karte, ...daten, id: karte.id, driveName: name, column: drivePhase });
    } else {
      // Ordner ohne projekt.json: Board-Karte bleibt Wahrheit, wird jetzt nach Drive gespiegelt.
      neu = migriere({ ...karte, driveName: name, column: drivePhase });
    }

    if (drivePhase !== karte.column)
      befunde.push({
        status: "hinweis",
        satz: `"${neu.title}" liegt in Drive unter "${ordnerVon(drivePhase)}", das Board zeigte "${ordnerVon(karte.column)}". Das Board folgt Drive.`,
      });

    // Backfill/Migration nur wenn noetig: fehlt die volle projekt.json am neuen Ort, jetzt
    // schreiben (und einen Alt-Ort aufraeumen). Im eingeschwungenen Zustand passiert hier nichts.
    if (!amNeuenOrt) {
      await schreibeProjektJson(pfad, neu);
      befunde.push({
        status: "hinweis",
        satz: `"${neu.title}": vollstaendige projekt.json in "(AI only)" geschrieben${daten ? " (aus dem Alt-Ort migriert)" : ""}.`,
      });
    }

    karten[i] = neu;
    if (!amNeuenOrt || JSON.stringify(neu) !== vorher) geaendert = true;
  }

  // Ordner in Drive ohne Karte im Board: aus der (vollen) projekt.json aufbauen.
  for (const [name, phaseId] of inDrive) {
    const pfad = `${ordnerVon(phaseId)}/${name}`;
    const { daten, amNeuenOrt } = await leseProjektJsonMitOrt(pfad);
    let neu;
    if (daten && daten.schema) {
      neu = migriere({ ...daten, driveName: name, column: phaseId });
    } else if (daten) {
      neu = migriere({ ...leereKarte(phaseId), ...daten, driveName: name, column: phaseId });
    } else {
      neu = migriere({
        ...leereKarte(phaseId),
        title: name,
        driveName: name,
        notes: "Aus dem Drive-Ordner uebernommen — es gab keine projekt.json zum Auslesen.",
      });
    }
    if (!amNeuenOrt) await schreibeProjektJson(pfad, neu);
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
