// v89 — EINE Regel fuer „naechster freier Upload-Termin" (Owner 01.10.2026: Vorschlag lag auf
// heute und ignorierte das Format). Vorher rechneten detail.js, kontextmenu.js, store.js und
// nachschub.js je eigen. Regel und Begruendung: docs/packages/v89-upload-termin-eine-regel.md.
// Rein (kein DOM, kein fetch) — laeuft im Browser (/lib/uploadslots.js) und in Node.
import { slotsForMonth } from "./scheduler.js";
import {
  isoDatum, fruehesterUpload, deadlineOffsetsJetzt, hatVideoProduktion, contenttypName,
} from "./pipeline.js";

// Slot-Typ zu einem Karten-Format. Highlight teilt sich die Story-Slots (der Redaktionsplan
// fuehrt beide als „Story / Highlight"); ohne Format gilt die Karte als Reel.
export const slotTyp = (contenttyp) =>
  !contenttyp ? "reel" : contenttyp === "highlight" ? "story" : contenttyp;

// Fruehestes machbares Upload-Datum fuer einen Slot-Typ.
// Video (Reel, Langformat): naechster Drehtermin + 8 Tage (v37).
// Ohne Dreh: heute + Freigabe- + Schnitt-Vorlauf aus den Einstellungen.
export function fruehesterUploadFuer(typ, drehtermine, heute = isoDatum(new Date())) {
  if (hatVideoProduktion({ contenttyp: typ })) return fruehesterUpload(drehtermine, heute);
  const o = deadlineOffsetsJetzt();
  const d = new Date(heute + "T00:00:00");
  d.setDate(d.getDate() + o.freigabe + o.schnitt);
  return isoDatum(d);
}

// Alle Plan-Slots ab dem laufenden Monat, `monate` weit, chronologisch.
export function planSlots(plan, monate = 12, jetzt = new Date()) {
  const roh = [];
  for (let d = 0; d < monate; d++) {
    const year = jetzt.getFullYear() + Math.floor((jetzt.getMonth() + d) / 12);
    const month = (jetzt.getMonth() + d) % 12;
    roh.push(...slotsForMonth(plan || {}, year, month));
  }
  return roh.sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit || "").localeCompare(b.uhrzeit || ""));
}

const schluessel = (datum, uhrzeit) => datum + "|" + (uhrzeit || "");

// Belegte Termine = Upload-Datum + Uhrzeit jeder nicht verworfenen Karte, ausser den genannten.
export function belegteTermine(cards, ausser = new Set()) {
  return new Set(
    (cards || [])
      .filter((c) => c.column !== "verworfen" && !ausser.has(c.id) && (c.dates || {}).upload)
      .map((c) => schluessel(c.dates.upload, c.uploadTime)),
  );
}

// Naechster freier, machbarer Slot. `card` null = beliebiges Format (Idee von der KI: der Slot
// bestimmt das Format). `belegt` optional von aussen (schwebende Karten belegen nacheinander).
// Liefert { slot } oder { slot: null, grund } mit einem Satz fuer den Nutzer.
export function naechsterFreierUpload({
  plan, card = null, cards = [], drehtermine = [], heute = isoDatum(new Date()), belegt = null, monate = 12,
}) {
  const typ = card ? slotTyp(card.contenttyp) : null;
  const alle = planSlots(plan, monate);
  const passend = typ ? alle.filter((s) => s.typ === typ) : alle;
  if (!passend.length) {
    const was = card ? contenttypName(card.contenttyp || "reel") : "Beitrag";
    return {
      slot: null,
      grund: `Im Redaktionsplan ist kein ${was} geplant. Frequenz im Redaktionsplan erhoehen oder Datum von Hand waehlen.`,
    };
  }
  const besetzt = belegt || belegteTermine(cards, new Set(card ? [card.id] : []));
  const fruehJeTyp = {};
  const slot = passend.find((s) => {
    const frueh = (fruehJeTyp[s.typ] ??= fruehesterUploadFuer(s.typ, drehtermine, heute));
    return s.datum >= frueh && !besetzt.has(schluessel(s.datum, s.uhrzeit));
  });
  if (slot) return { slot };
  return { slot: null, grund: `Kein freier Termin in den naechsten ${monate} Monaten — Redaktionsplan pruefen.` };
}

export const slotSchluessel = schluessel;
