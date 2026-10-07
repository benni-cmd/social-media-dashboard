// Projektordner in Drive: anlegen, verschieben, lesen — und der Abgleich, der das Board
// gegen Drive heilt.
//
// Der Vertrag aus docs/drive-convention.md lautet: der Board-Zustand ist eine Spiegelung
// der Drive-Struktur. Bis v8 war das nur Prosa — `/api/drive/board` und `projekt.json`
// wurden geschrieben, aber nie gelesen (Befunde B4 und B5). Hier steht die Umsetzung.

import { createHash } from "node:crypto";
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
  phase,
  TERMINE,
  deutschesDatum,
  contenttypName,
  kategorieName,
  zielInfo,
  PLATTFORMEN,
  istSystemOrdner,
  pfadstueckOk,
} from "./pipeline.js";

// --- Ordner je Spalte (v87: fest aus PHASEN) --------------------------------
//
// Bis v86 kamen die Spaltenordner aus Drive (spalten.json, v17b) und der Server setzte hier eine
// Map. Seit v87 steht die Struktur fest; der Abgleich prueft sie, statt sich anzupassen.
const ordnerVon = (id) => phaseOrdner(id);
export const projektPfadDyn = (card, spalte) => `${ordnerVon(spalte || card.column)}/${projektName(card)}`;

// --- Abgleich auf den neuesten Board-Stand legen (v88) ----------------------
//
// start      = Karten, mit denen der Abgleich begann
// abgeglichen = Ergebnis des Abgleichs (start + Drive-Aenderungen + Karten aus Ordnern ohne Karte)
// neuester   = board.json NACH dem Abgleich (enthaelt, was der Mensch inzwischen gespeichert hat)
// Ergebnis: neuester Stand + Drive-Aenderungen; eine seit dem Start vom Menschen geaenderte Karte
// behaelt seine Fassung. Rein, ohne Drive.
export function abgleichAufNeuesten(start, abgeglichen, neuester) {
  const vorher = new Map(start.map((c) => [c.id, JSON.stringify(c)]));
  const vomAbgleich = new Map(abgeglichen.filter((c) => vorher.get(c.id) !== JSON.stringify(c)).map((c) => [c.id, c]));
  let zuSchreiben = false;
  // v113 (H4): Karten, die der Abgleich entfernt hat (Geisterkarten zu Systemordnern), fallen auch hier raus —
  // ausser der Mensch hat sie seit dem Start selbst geaendert (dann gewinnt wie ueberall seine Fassung).
  const abgIds = new Set(abgeglichen.map((c) => c.id));
  const cards = [];
  for (const c of neuester) {
    const unveraendert = vorher.get(c.id) === JSON.stringify(c);
    if (vorher.has(c.id) && !abgIds.has(c.id) && unveraendert) { zuSchreiben = true; continue; }
    if (vomAbgleich.has(c.id) && unveraendert) { zuSchreiben = true; cards.push(vomAbgleich.get(c.id)); continue; }
    cards.push(c);
  }
  const da = new Set(cards.map((c) => c.id));
  for (const c of vomAbgleich.values()) {
    if (!vorher.has(c.id) && !da.has(c.id)) { cards.push(c); zuSchreiben = true; } // Drive-Ordner ohne Karte
  }
  return { cards, zuSchreiben };
}

// --- Steckbrief (v85-B, Owner 30.09.2026) -----------------------------------
//
// Grundsatz „ohne Board arbeitsfaehig" (docs/drive-convention.md): Phase, Termine und Eckdaten
// standen nur in `(AI only)/projekt.json` — ein Mensch ohne Board sah nicht, was faellig ist.
// `Steckbrief.md` im Projektordner sagt es im Klartext. Wahrheit bleibt projekt.json; der
// Steckbrief wird ueberall mitgeschrieben, wo projekt.json entsteht, und nur bei geaendertem
// Inhalt (kein Zeitstempel darin -> derselbe Stand ergibt dieselbe Datei und denselben MD5).
export const STECKBRIEF = "Steckbrief.md";
const segment = (ordner) => String(ordner).slice(String(ordner).lastIndexOf("/") + 1);

export function steckbrief(card) {
  const p = phase(card.column);
  const naechste = p.weiter ? phase(p.weiter) : null;
  const zeilen = [
    `# ${card.title || "(ohne Titel)"}`,
    "",
    "> Diese Datei schreibt das Social-Media-Board automatisch — Änderungen hier werden",
    "> überschrieben. Ohne Board: Phase wechseln = diesen Projektordner in den nächsten",
    "> Spaltenordner ziehen. Inhalte gehören in „Skript und Caption“, „Rohmaterial“ und",
    "> „Fertiges Video“.",
    "",
    `- **Phase:** ${p.name} (Ordner „${segment(ordnerVon(p.id))}“)`,
    `- **Zu tun:** ${p.satz || "—"}`,
  ];
  if (naechste && naechste.id !== p.id) zeilen.push(`- **Danach:** ${naechste.name} (Ordner „${segment(ordnerVon(naechste.id))}“)`);
  if (card.contenttyp) zeilen.push(`- **Format:** ${contenttypName(card.contenttyp)}`);
  if (card.serie) zeilen.push(`- **Reihe:** ${card.serie}${card.episode ? `, Episode ${card.episode}` : ""}`);
  if (card.kategorie) zeilen.push(`- **Kategorie:** ${kategorieName(card.kategorie)}`);
  if (card.goal) zeilen.push(`- **Ziel:** ${zielInfo(card.goal).name}`);
  // v107: Anlass-Projekt — wer nur Drive oeffnet, sieht, wofuer es entstand und wann es online geht.
  if (card.anlass && card.anlass.name) zeilen.push(`- **Anlass:** ${card.anlass.name} am ${String(card.anlass.datum || "").split("-").reverse().join(".")} (Kampagne „${card.anlass.kampagne || ""}“)`);
  const plattformen = (card.platforms || []).map((id) => (PLATTFORMEN.find((x) => x.id === id) || { name: id }).name);
  if (plattformen.length) zeilen.push(`- **Plattformen:** ${plattformen.join(", ")}`);
  zeilen.push("", "## Termine", "");
  const d = card.dates || {};
  for (const t of [...TERMINE].reverse()) {
    let wert = d[t.key] ? deutschesDatum(d[t.key]) : "noch offen";
    if (t.key === "upload" && card.floatUpload && !d.upload) wert = "noch nicht fest (das Board verteilt auf den nächsten freien Termin)";
    if (t.key === "upload" && d.upload && card.uploadTime) wert += `, ${card.uploadTime} Uhr`;
    zeilen.push(`- ${t.name}: ${wert}`);
  }
  if (card.notes && card.notes.trim()) zeilen.push("", "## Notizen", "", card.notes.trim());
  return zeilen.join("\n") + "\n";
}

// Zuletzt geschriebener Stand je Projektordner (MD5), damit ein Speichern ohne Aenderung am
// Steckbrief keinen Drive-Schreibvorgang kostet. Gefuellt beim Schreiben und vom
// Steckbrief-Abgleich (steckbriefeAbgleichen) aus den MD5-Werten in Drive.
const steckbriefMd5 = new Map();
const md5 = (text) => createHash("md5").update(text, "utf8").digest("hex");

async function schreibeSteckbrief(basis, card) {
  try {
    const text = steckbrief(card);
    const h = md5(text);
    if (steckbriefMd5.get(basis) === h) return false;
    await drive.writeFile(`${basis}/${STECKBRIEF}`, text);
    steckbriefMd5.set(basis, h);
    return true;
  } catch (e) {
    console.log(`Steckbrief nicht geschrieben (${basis}): ${e.message}`); // Kuer, kippt nie den Aufrufer
    return false;
  }
}

// Holt fehlende oder veraltete Steckbriefe nach (einmal je Abgleich, im Hintergrund): EIN
// md5sum-Aufruf je Hauptordner liefert den Stand aller vorhandenen Steckbriefe; geschrieben
// wird nur, wo die Datei fehlt oder vom Karten-Stand abweicht (auch von Hand geaendert).
export async function steckbriefeAbgleichen(cards, ordnerDa) {
  const mitOrdner = cards.filter((c) => c.driveName && c.column && ordnerDa.has(projektName(c)));
  const hauptVon = (pfad) => pfad.split("/")[0];
  const gruppen = new Map(); // Hauptordner -> Tiefe
  for (const c of mitOrdner) {
    const pfad = projektPfadDyn(c);
    gruppen.set(hauptVon(pfad), Math.max(gruppen.get(hauptVon(pfad)) || 0, pfad.split("/").length));
  }
  const inDrive = new Map(); // voller Pfad -> md5
  for (const [haupt, tiefe] of gruppen) {
    const liste = await drive.md5Liste(haupt, [`**/${STECKBRIEF}`], tiefe);
    for (const { md5: h, pfad } of liste) inDrive.set(`${haupt}/${pfad}`, h);
  }
  let geschrieben = 0;
  for (const c of mitOrdner) {
    const basis = projektPfadDyn(c);
    const vorhanden = inDrive.get(`${basis}/${STECKBRIEF}`);
    if (vorhanden) steckbriefMd5.set(basis, vorhanden);
    if (await schreibeSteckbrief(basis, c)) geschrieben += 1;
  }
  return { geprueft: mitOrdner.length, geschrieben };
}

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
  scanCacheWeg(card && card.id); // Ordner entsteht neu -> alter Scan-Stand ist ueberholt
  const name = card.driveName || (await freierName(card));
  // v113 (H4): eine Geisterkarte zu einem Systemordner legt nie etwas in „Videoauswertung/KPI" & Co. an.
  if (istSystemOrdner(card.column, name))
    throw new Error(`„${name}“ ist ein Systemordner des Boards und kein Projekt.`);
  const basis = `${ordnerVon(card.column)}/${name}`;
  await drive.mkdir(basis);
  for (const sub of UNTERORDNER) await drive.mkdir(`${basis}/${sub}`);
  await drive.mkdir(`${basis}/${AI_ORDNER}`);
  await drive.writeFile(projektJsonPfad(basis), projektJson({ ...card, driveName: name }));
  await schreibeSteckbrief(basis, { ...card, driveName: name });
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
//
// v113 (B1): Eine „Huelle" (Projektordner ohne eine einzige Datei — Rest eines Verschiebens in ein schon
// vorhandenes Ziel, Befund v112) gilt nicht als Projektordner, solange derselbe Name noch woanders MIT
// Inhalt liegt. Dann wird die Huelle entfernt (Owner 07.10.2026; `rmdirs` loescht nie eine Datei) und der
// echte Ordner zurueckgegeben. Ein echter Projektordner hat immer mindestens projekt.json und Steckbrief.
export async function findeOrdner(name) {
  const huellen = [];
  for (const p of PHASEN) {
    if (istSystemOrdner(p.id, name)) continue; // v113 (H4): „Videoauswertung/KPI" & Co. sind nie ein Projekt
    const pfad = `${ordnerVon(p.id)}/${name}`;
    if (!(await drive.existiert(pfad))) continue;
    if (await istHuelle(pfad)) {
      huellen.push({ phase: p.id, pfad });
      continue;
    }
    for (const h of huellen) await drive.rmdirs(h.pfad).catch(() => {});
    return { phase: p.id, pfad };
  }
  return huellen[0] || null; // nur leere Ordner: der erste bleibt der Projektordner
}

// Ordner ohne eine einzige Datei (nur leere Unterordner)?
async function istHuelle(pfad) {
  const inhalt = await drive.inhaltRekursiv(pfad);
  return Array.isArray(inhalt) && !inhalt.some((e) => !e.IsDir);
}

// v113 (H6): Gehoert der Ordner dieser Karte? projekt.json traegt die Karten-id. Ohne lesbare id (Alt-Ordner,
// Hand-Ordner) zaehlt der Ordner als ihrer — so verhielt sich das Board bisher.
async function gehoertKarte(pfad, card) {
  const daten = await leseProjektJson(pfad).catch(() => null);
  return !daten || !daten.id || daten.id === card.id;
}

// v113 (H6): Der eigene Ordner einer Karte. Ein eingefrorener driveName ist eindeutig; ohne ihn (noch nie
// angelegt) kann der aus dem Titel abgeleitete Name schon einer ANDEREN Karte mit gleichem Titel gehoeren —
// dann ist es nicht ihr Ordner (v112: die zweite Karte schrieb sonst ihre projekt.json in den fremden Ordner).
export async function findeEigenenOrdner(card) {
  const ort = await findeOrdner(projektName(card));
  if (!ort || card.driveName) return ort;
  return (await gehoertKarte(ort.pfad, card)) ? ort : null;
}

// v113 (H6, Owner 07.10.2026): freier Ordnername — ist der Name schon von einer anderen Karte belegt,
// bekommt der neue Ordner „ (2)", „ (3)" … Der Kartentitel bleibt unveraendert.
async function freierName(card) {
  const basis = projektNameNeu(card);
  for (let n = 1; n <= 50; n++) {
    const name = n === 1 ? basis : `${basis} (${n})`;
    if (!pfadstueckOk(name)) break;
    if (istSystemOrdner("fertig", name)) continue; // Titel „KPI" bekommt „KPI (2)", nie den Systemordner
    const ort = await findeOrdner(name);
    if (!ort || (await gehoertKarte(ort.pfad, card))) return name;
  }
  return `${basis.slice(0, 100)} (${card.id})`;
}

// Was liegt im Projektordner? Trennt sauber: gibt es ihn nicht, ist das kein Fehler;
// antwortet Drive nicht, ist das einer.
// --- v32 C2: Scan-Cache ----------------------------------------------------
//
// Jeder Scan startet rclone (Subprozess + Google-Roundtrip, spuerbar). Wiederholte Scans
// derselben Karte — Neuladen, mehrere Tabs/Sessions — muessen das nicht jedes Mal tun. Kurz-
// lebiger Cache je Karte; jede Karten-veraendernde Operation (anlegen/verschiebe/speichereDatei)
// verwirft ihren Eintrag sofort, ein Voll-Abgleich leert alles, und `frisch` umgeht den Cache
// (der Client setzt es nach eigenen Aenderungen). Nur erfolgreiche Scans werden gecacht — ein
// "Drive gerade nicht erreichbar" darf nicht kleben bleiben.
const SCAN_CACHE_MS = 60_000;
const scanCache = new Map(); // cardId -> { stand, zeit }
export function scanCacheLeeren() { scanCache.clear(); }
function scanCacheWeg(cardId) { if (cardId) scanCache.delete(cardId); }

export async function scan(card, frisch = false) {
  const id = card && card.id;
  if (!frisch && id) {
    const e = scanCache.get(id);
    if (e && Date.now() - e.zeit <= SCAN_CACHE_MS) return e.stand;
  }
  const stand = await scanRoh(card);
  if (id && stand && stand.driveOk) scanCache.set(id, { stand, zeit: Date.now() });
  return stand;
}

async function scanRoh(card) {
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
  scanCacheWeg(card && card.id); // Ordner wandert -> Pfad/Phase im Scan-Stand ueberholt
  const name = projektName(card);
  const ort = await findeEigenenOrdner(card); // v113 (H6): nie den Ordner einer gleichnamigen Karte
  if (!ort) {
    // Es gibt noch nichts zu verschieben — dann jetzt am Ziel anlegen (ohne driveName vergibt anlegen()
    // einen freien Namen, v113 H6).
    const angelegt = await anlegen({ ...card, column: zielPhase });
    return { angelegt: true, ...angelegt };
  }
  const ziel = `${ordnerVon(zielPhase)}/${name}`;
  if (ort.pfad !== ziel) await drive.moveDir(ort.pfad, ziel);
  await drive.mkdir(`${ziel}/${AI_ORDNER}`);
  await drive.writeFile(projektJsonPfad(ziel), projektJson({ ...card, column: zielPhase, driveName: name }));
  await schreibeSteckbrief(ziel, { ...card, column: zielPhase, driveName: name });
  return { angelegt: false, name, basis: ziel, links: await linksVon(ziel) };
}

// Karte loeschen (v46): den Drive-Ordner in den Papierkorb verschieben, statt ihn stehen zu
// lassen. Grund: `abgleich` baut aus JEDEM Phasen-Ordner ohne Board-Karte eine Karte neu auf —
// ein zurueckgelassener Ordner liess die geloeschte Karte beim naechsten Abgleich wiederkehren.
// Der Papierkorb liegt AUSSERHALB der Phasen-Ordner, die `abgleich` scannt, also sieht ihn kein
// Abgleich mehr als Waise. Nicht-destruktiv: der Ordner (Skripte/Videos) bleibt wiederherstellbar.
// Kein Ordner vorhanden -> nichts zu tun (Erfolg). Wirft nur, wenn Drive den Move ablehnt.
const PAPIERKORB = "Papierkorb";
export async function loesche(card) {
  scanCacheWeg(card && card.id);
  const name = projektName(card);
  // Aktueller Ort, folgt auch Hand-Verschiebungen. v113: nie der Ordner einer gleichnamigen anderen Karte (H6)
  // und nie ein Systemordner (H4 — findeOrdner ueberspringt sie; eine Geisterkarte „KPI" verliesse das Board,
  // ohne den echten KPI-Ordner in den Papierkorb zu schieben).
  const ort = await findeEigenenOrdner(card);
  if (!ort) return { getrasht: false }; // kein Ordner -> Karte kann einfach aus dem Board raus
  const stempel = new Date().toISOString().replace(/[:.]/g, "-");
  const ziel = `${PAPIERKORB}/${name}__${stempel}`; // Zeitstempel gegen Namenskollision
  await drive.moveDir(ort.pfad, ziel);
  return { getrasht: true, pfad: ziel };
}

// v113 (H6): Gibt { pfad, name } zurueck — `name` ist der Ordnername, den die Karte ab jetzt als driveName
// fuehrt. Ohne eigenen Ordner wird er erst regulaer angelegt (Unterordner, projekt.json, freier Name), statt
// wie bis v112 in einen gleichnamigen fremden Ordner zu schreiben.
export async function speichereDatei(card, dateiname, inhalt) {
  scanCacheWeg(card && card.id); // neue Datei -> Datei-Zahlen im Scan-Stand ueberholt
  let ort = await findeEigenenOrdner(card);
  if (!ort) {
    const angelegt = await anlegen(card);
    ort = { pfad: angelegt.basis };
  }
  const name = ort.pfad.split("/").pop();
  const ziel = `${ort.pfad}/Skript und Caption`;
  await drive.mkdir(ziel);
  await drive.writeFile(`${ziel}/${dateiname}`, inhalt);
  return { pfad: `${ziel}/${dateiname}`, name };
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
  if (istSystemOrdner(card.column, projektName(card))) return null; // v113 (H4): nie in einen Systemordner
  const pfad = projektPfadDyn(card);
  await drive.mkdir(`${pfad}/${AI_ORDNER}`);
  await drive.writeFile(projektJsonPfad(pfad), projektJson(migriere(card)));
  await schreibeSteckbrief(pfad, migriere(card));
  return pfad;
}

// Schreibt die volle projekt.json an den neuen Ort und raeumt eine Alt-Datei in der
// Ordnerwurzel weg. Idempotent genutzt: der Abgleich ruft das nur, wenn wirklich etwas fehlt
// oder migriert werden muss — im eingeschwungenen Zustand schreibt er nichts.
async function schreibeProjektJson(pfad, card) {
  await drive.mkdir(`${pfad}/${AI_ORDNER}`);
  await drive.writeFile(projektJsonPfad(pfad), projektJson(card));
  await drive.deleteFile(`${pfad}/projekt.json`); // Alt-Ort aufraeumen (fehlt = ok)
  await schreibeSteckbrief(pfad, card);
}

// --- Abgleich -------------------------------------------------------------
//
// Liest ALLE Phasenordner und stellt sie den Karten gegenueber. Drive gewinnt bei der
// Phase (dort sieht ein Mensch, was er tut); das Board gewinnt bei allem, was in Drive
// gar nicht steht. Liefert einen Bericht in Saetzen, keine stille Korrektur.

// v51 T7: `onStufe` meldet live, WO der Abgleich steht. Die acht Phasen-Listings sind laut
// v25-Messung der Flaschenhals (je ein rclone-Aufruf, seriell durch die globale rclone-Kette)
// — ohne Zwischenmeldung sieht der Nutzer 10-70 s lang nur „laeuft".
export async function abgleich(cards, { onStufe = () => {} } = {}) {
  scanCacheLeeren(); // Voll-Abgleich liest Drive frisch -> jeder gecachte Scan-Stand ist ueberholt
  // Alle Karten-Ordner je Phase einsammeln: Ordnername -> Phase-ID. (AI only) und
  // System (AI only) sind Unterordner bzw. liegen im Root — sie tauchen hier nie auf.
  const inDrive = new Map();
  const orte = new Map(); // v113: Ordnername -> alle Phasen, in denen er liegt (v87 meldete nur Paare)
  // v84: Ein rekursiver Aufruf je Hauptordner ("In Bearbeitung", "Videoauswertung", …) statt
  // eines Aufrufs je Spalte — 8 Aufrufe werden 2-3. Ein Spaltenordner "In Bearbeitung/Idee"
  // liegt eine Ebene unter seinem Hauptordner, seine Karten-Ordner also zwei Ebenen tief.
  const gruppen = new Map(); // Hauptordner -> [{ p, rest }]
  for (const p of PHASEN) {
    const pfad = ordnerVon(p.id);
    const i = pfad.indexOf("/");
    const haupt = i < 0 ? pfad : pfad.slice(0, i);
    if (!gruppen.has(haupt)) gruppen.set(haupt, []);
    gruppen.get(haupt).push({ p, rest: i < 0 ? "" : pfad.slice(i + 1) });
  }
  let gi = 0;
  for (const [haupt, spalten] of gruppen) {
    gi += 1;
    onStufe({ stufe: "drive-ordner", schritt: gi, von: gruppen.size, was: haupt });
    const tiefe = Math.max(...spalten.map((s) => (s.rest ? s.rest.split("/").length : 0))) + 1;
    const pfade = await drive.ordnerBaum(haupt, tiefe);
    for (const { p, rest } of spalten) {
      const praefix = rest ? rest + "/" : "";
      for (const rel of pfade) {
        if (!rel.startsWith(praefix)) continue;
        const name = rel.slice(praefix.length);
        if (!name || name.includes("/")) continue;
        if (istSystemOrdner(p.id, name)) continue; // v113 (H4): KPI/Auswertung-Tabellen sind keine Projekte
        // v87: Derselbe Projektordner in zwei Spalten (Befund 30.09.2026: 4 Projekte doppelt,
        // Kopien ohne Inhalt) — v113 klaert das unten (leere Kopien weg, sonst Befund).
        if (!orte.has(name)) orte.set(name, []);
        if (!orte.get(name).includes(p.id)) orte.get(name).push(p.id);
        inDrive.set(name, p.id);
      }
      // v83: Ordner dieser Spalte gelesen -> die Oberflaeche darf sie ab jetzt als live zeigen.
      onStufe({ stufe: "drive-ordner-fertig", phase: p.id });
    }
  }

  // v113 (B1/H5, Owner 07.10.2026): Liegt ein Projektordner in mehreren Spalten, sind die Kopien ohne eine
  // einzige Datei Reste des alten Verschiebe-Fehlers — sie werden entfernt (`rmdirs` loescht nie eine Datei).
  // Haben mehrere Kopien Inhalt, raet der Befund zum Zusammenfuehren statt zum Loeschen (v112: der alte Rat
  // „eine Kopie entfernen" haette echte Dateien gekostet). Gezaehlt wird die Kopie mit Inhalt (die spaeteste).
  const vorab = [];
  for (const [name, phasen] of orte) {
    if (phasen.length < 2) continue;
    const mitInhalt = [];
    const leer = [];
    for (const ph of phasen) {
      const inhalt = (await drive.inhaltRekursiv(`${ordnerVon(ph)}/${name}`)) || [];
      const n = inhalt.filter((e) => !e.IsDir).length;
      (n ? mitInhalt : leer).push({ ph, n });
    }
    const bleibt = mitInhalt.length ? mitInhalt[mitInhalt.length - 1] : leer[leer.length - 1];
    for (const k of leer) {
      if (k === bleibt) continue;
      try {
        await drive.rmdirs(`${ordnerVon(k.ph)}/${name}`);
        vorab.push({ status: "hinweis", satz: `Leere Kopie von „${name}“ in „${ordnerVon(k.ph)}“ entfernt — der Projektordner liegt in „${ordnerVon(bleibt.ph)}“.` });
      } catch (e) {
        vorab.push({ status: "befund", satz: `Leere Kopie von „${name}“ in „${ordnerVon(k.ph)}“ liess sich nicht entfernen: ${e.message}` });
      }
    }
    if (mitInhalt.length > 1)
      vorab.push({
        status: "befund",
        satz: `Projektordner „${name}“ liegt mehrfach mit Inhalt: ${mitInhalt.map((k) => `„${ordnerVon(k.ph)}“ (${k.n} ${k.n === 1 ? "Datei" : "Dateien"})`).join(", ")}. Bitte in Drive zusammenführen: Dateien in einen Ordner ziehen, den leeren danach liegen lassen — das Board räumt leere Kopien selbst weg.`,
      });
    inDrive.set(name, bleibt.ph);
  }

  // v85-B: Welche Projektordner es in Drive WIRKLICH gibt (vor dem Abarbeiten der Map) — der
  // Steckbrief-Abgleich schreibt nur dorthin, sonst legte er zu einer Karte ohne Ordner einen
  // neuen an und ueberdeckte den Befund „kein Ordner mehr".
  const ordnerDa = new Set(inDrive.keys());

  const befunde = [...vorab];
  let geaendert = false;
  // v113 (H4, Owner 07.10.2026): Geisterkarten zu Systemordnern („KPI", „Auswertung-Tabellen") verlassen das
  // Board, der Ordner bleibt unberuehrt; nur die von v112 hineingeschriebenen projekt.json/Steckbrief.md
  // werden dort geloescht (einzelne Dateien, nie der Ordner).
  const karten = [];
  for (const c of cards.map((x) => migriere(x))) {
    const name = projektName(c);
    if (!istSystemOrdner(c.column, name)) {
      karten.push(c);
      continue;
    }
    geaendert = true;
    const basis = `${ordnerVon("fertig")}/${name}`;
    for (const datei of [projektJsonPfad(basis), `${basis}/projekt.json`, `${basis}/${STECKBRIEF}`]) await drive.deleteFile(datei).catch(() => {});
    await drive.rmdirs(`${basis}/${AI_ORDNER}`).catch(() => {});
    befunde.push({ status: "hinweis", satz: `Karte „${c.title}“ entfernt — „${basis}“ ist ein Systemordner des Boards, kein Projekt. Der Ordner bleibt unverändert.` });
  }

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

    // v25-Schnellpfad: Die Karte liegt schon in ihrer Phase und traegt ihren eingefrorenen
    // driveName — es gibt nichts abzugleichen, also KEIN projekt.json-Read. Das spart im
    // eingeschwungenen Zustand den teuersten rclone-cat je Karte; ohne das lief der Abgleich
    // bei vielen Karten in den Timeout (v25). Backfill der projekt.json passiert beim
    // Speichern/PUT am erwarteten Ort, nicht mehr hier.
    if (drivePhase === karte.column && karte.driveName === name) continue;

    // Nur die Karten, die wirklich aus Drive gelesen werden (der v25-Schnellpfad oben
    // ueberspringt den Rest) — sonst zaehlte die Anzeige Arbeit mit, die gar nicht anfaellt.
    onStufe({ stufe: "drive-karte", schritt: i + 1, von: karten.length, was: karte.title || name });
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

  return { cards: karten, befunde, geaendert, ordnerDa };
}
