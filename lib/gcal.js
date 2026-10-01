// Google Calendar + Tasks — roh ueber die REST-APIs, kein googleapis-Paket (das Projekt ist
// dependency-frei; IG/LinkedIn machen OAuth genauso). Der OAuth-User-Flow liegt in server.js
// (/api/auth/google[/callback]); hier steckt nur: Access-Token frisch halten und die Aufrufe.
//
// Warum OAuth statt Service-Account: ein SA ohne Workspace-Delegation erreicht die Tasks eines
// privaten Gmail gar nicht (Uebergabe der Drive-Session, docs/packages/v16-drehtermine.md).

import { readFile, writeFile } from "node:fs/promises";
import * as ereignisse from "./ereignisse.js"; // v58: externe Aufrufe mitlesbar

const TOKEN_FILE = new URL("../data/tokens.json", import.meta.url);
const TZ = "Europe/Berlin";

async function leseTokens() {
  try { return JSON.parse(await readFile(TOKEN_FILE, "utf8")); } catch { return {}; }
}
async function schreibeGoogle(daten) {
  const t = await leseTokens();
  t.google = { ...(t.google || {}), ...daten };
  await writeFile(TOKEN_FILE, JSON.stringify(t, null, 2), "utf8");
  return t.google;
}

// Ist Google verbunden? (Refresh-Token vorhanden.)
export async function verbunden() {
  const t = await leseTokens();
  return !!(t.google && t.google.refresh_token);
}

// v45: echte Gueltigkeit statt bloßer Token-Existenz. Ein billiger authentifizierter Call
// (calendars/primary) erzwingt bei Bedarf den Token-Refresh — genau der schlaegt bei
// abgelaufenem/entzogenem Refresh-Token fehl (invalid_grant, "expired or revoked", v44).
// Auth-Fehler => nicht verbunden; reiner Netzfehler => unklar (NICHT abmelden).
function istAuthFehler(e) {
  return /invalid_grant|expired|revoked|Google API 401|Google API 403/i.test(String(e?.message || ""));
}

export async function gueltig() {
  const t = await leseTokens();
  if (!t.google || !t.google.refresh_token) return { gueltig: false, grund: "keiner" };
  try {
    // calendars/primary traegt als id die Mail des Kontos — v86: als „zuletzt verbunden als" merken,
    // damit das Konto auch dann sichtbar bleibt, wenn Google die Anmeldung spaeter ablehnt.
    const d = await api("https://www.googleapis.com/calendar/v3/calendars/primary", "GET");
    await schreibeGoogle({ email: d.id || t.google.email || "", letzterErfolg: new Date().toISOString() });
    return { gueltig: true, email: d.id || "" };
  } catch (e) {
    if (istAuthFehler(e)) return { gueltig: false, grund: "abgelaufen", fehler: e.message };
    return { unklar: true, grund: "netz", fehler: e.message }; // Netzstoerung: Status nicht auf abgemeldet kippen
  }
}

// Kurzer modul-lokaler Cache, damit Status-Polling Google nicht pro Aufruf trifft.
let statusCache = null; // { zeit:number, wert:object }
const STATUS_TTL_MS = 60000;
export function statusCacheLeeren() { statusCache = null; }

// Vollstaendiger Google-Verbindungs-Status fuer /api/verbindungen/status (v45).
// v86 (Owner 30.09./01.10.2026): nicht nur „verbunden", sondern womit, wohin, ob es JETZT geht.
// zustand: live | gestoert (Netz unklar) | getrennt (nie verbunden oder von Google abgelehnt).
export async function statusGoogle() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const clientKonfiguriert = !!clientId;
  const t = (await leseTokens()).google || {};
  const basis = {
    clientKonfiguriert,
    // Woher/wohin: das Board ist Quelle der Drehtermine und schreibt nur — es liest nichts zurueck.
    rolle: "nur Ziel",
    fluss: "Board → Google: jeder Drehtermin wird ein Termin im Hauptkalender und eine Aufgabe in der Standard-Aufgabenliste. Das Board liest nichts zurück.",
    anbindung: clientKonfiguriert
      ? `Google-Anmeldung (OAuth) über deine eigene Google-Cloud-App, Client-ID …${clientId.split(".")[0].slice(-6)}`
      : "Google-Anmeldung (OAuth) — Zugangsdaten der Google-Cloud-App fehlen noch",
    rechte: (t.scope || "").split(" ").filter(Boolean).map((s) => s.replace("https://www.googleapis.com/auth/", "")),
    email: t.email || "",
    verbundenAm: t.verbundenAm || null,
    letzterErfolg: t.letzterErfolg || null,
  };
  if (!(await verbunden())) return { ...basis, verbunden: false, zustand: "getrennt", grund: "Noch nicht verbunden." };
  if (statusCache && Date.now() - statusCache.zeit < STATUS_TTL_MS) return statusCache.wert;

  const g = await gueltig();
  let wert;
  if (g.gueltig) wert = { ...basis, verbunden: true, zustand: "live", email: g.email || basis.email, letzterErfolg: new Date().toISOString() };
  else if (g.unklar)
    // Netz unklar: Bestandsschutz (verbunden bleibt), aber NICHT gruen.
    wert = { ...basis, verbunden: true, zustand: "gestoert", grund: "Google gerade nicht erreichbar — Netz pruefen.", fehler: g.fehler };
  else
    wert = {
      ...basis, verbunden: false, zustand: "getrennt", hinweis: "Anmeldung abgelaufen",
      grund: "Google hat die Anmeldung abgelehnt (abgelaufen oder entzogen) — neu verbinden.", fehler: g.fehler,
    };
  statusCache = { zeit: Date.now(), wert };
  return wert;
}

// Gueltiges Access-Token — refresht bei Ablauf ueber den Refresh-Token. Wirft, wenn nicht
// verbunden oder der Client fehlt: der Aufrufer faengt das als "nicht verbunden" ab.
async function accessToken() {
  const t = await leseTokens();
  const g = t.google;
  if (!g || !g.refresh_token) throw new Error("Google ist nicht verbunden.");
  if (g.access_token && g.expiry && Date.now() < g.expiry - 60000) return g.access_token;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET fehlt in .env.");

  // v58: mitlesbar machen — aber NUR Vorgang und Ergebnis, niemals der Body: der traegt
  // client_secret und refresh_token.
  const vorgang = ereignisse.starte({
    sektion: "weitere",
    dienst: "google",
    text: "Zugangstoken erneuern (oauth2.googleapis.com/token)",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: g.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const daten = await res.json();
  if (!res.ok || !daten.access_token) {
    vorgang.fehler(`${res.status} ${daten.error || ""}`.trim());
    // v86: `error` (z. B. invalid_grant) MUSS in der Meldung stehen — istAuthFehler() erkennt daran
    // eine von Google abgelehnte Anmeldung. Vorher stand nur „Bad Request" drin → galt als Netzfehler → grün.
    throw new Error(`Token-Refresh fehlgeschlagen: ${[daten.error, daten.error_description].filter(Boolean).join(" — ") || res.status}`);
  }
  vorgang.fertig(`${res.status}, gueltig fuer ${daten.expires_in || 3600} s`);
  await schreibeGoogle({ access_token: daten.access_token, expiry: Date.now() + (daten.expires_in || 3600) * 1000 });
  return daten.access_token;
}

// Speichert das Ergebnis des Code-Austauschs (aus dem Callback) in tokens.json.
export async function speichereAusCode(tokenAntwort) {
  await schreibeGoogle({
    access_token: tokenAntwort.access_token,
    refresh_token: tokenAntwort.refresh_token, // nur beim ersten Consent gesetzt
    expiry: Date.now() + (tokenAntwort.expires_in || 3600) * 1000,
    scope: tokenAntwort.scope,
    verbundenAm: new Date().toISOString(),
  });
}

async function api(url, methode, koerper) {
  const token = await accessToken();
  // v58: Durch diesen Wrapper laeuft JEDER Kalender- und Tasks-Aufruf. Der Token steht im
  // Header und wird deshalb gar nicht erst uebergeben — nur Methode und Endpunkt.
  const vorgang = ereignisse.starte({
    sektion: "weitere",
    dienst: "google",
    text: `${methode} ${String(url).replace("https://www.googleapis.com/", "")}`,
  });
  const res = await fetch(url, {
    method: methode,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: koerper ? JSON.stringify(koerper) : undefined,
  });
  const text = await res.text();
  let daten = {};
  try { daten = text ? JSON.parse(text) : {}; } catch { daten = { raw: text }; }
  if (!res.ok) {
    vorgang.fehler(`${res.status}: ${daten.error?.message || text.slice(0, 120)}`);
    throw new Error(`Google API ${res.status}: ${daten.error?.message || text.slice(0, 200)}`);
  }
  vorgang.fertig(`${res.status} OK`);
  return daten;
}

// --- Kalender -------------------------------------------------------------
// zeit "" → ganztaegiges Event (nur Datum); sonst 1-Stunden-Termin ab der Uhrzeit.
function eventZeit(datum, zeit) {
  if (!zeit) {
    const ende = new Date(datum + "T00:00:00"); ende.setDate(ende.getDate() + 1);
    const p = (n) => String(n).padStart(2, "0");
    const endeIso = `${ende.getFullYear()}-${p(ende.getMonth() + 1)}-${p(ende.getDate())}`;
    return { start: { date: datum }, end: { date: endeIso } };
  }
  const [h, m] = zeit.split(":").map(Number);
  const endeH = String((h + 1) % 24).padStart(2, "0");
  return {
    start: { dateTime: `${datum}T${zeit}:00`, timeZone: TZ },
    end: { dateTime: `${datum}T${endeH}:${String(m).padStart(2, "0")}:00`, timeZone: TZ },
  };
}

function eventKoerper({ titel, beschreibung, datum, zeit, teilnehmer }) {
  return {
    summary: titel,
    description: beschreibung || "",
    ...eventZeit(datum, zeit),
    ...(teilnehmer && teilnehmer.length ? { attendees: teilnehmer.map((email) => ({ email })) } : {}),
  };
}

const calBasis = (calId) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId || "primary")}/events`;

// sendUpdates steuert, ob Google die Teilnehmer per Mail benachrichtigt: "all" bei
// Erst-Einladung/neuem Teilnehmer/Absage, "none" bei stillen Aenderungen (Karten/Datum) —
// die propagieren trotzdem in die Kalender der Teilnehmer, nur ohne Mail (v44).
export async function eventAnlegen(calId, felder, sendUpdates = "all") {
  const d = await api(`${calBasis(calId)}?sendUpdates=${sendUpdates}`, "POST", eventKoerper(felder));
  return d.id;
}
export async function eventUpdaten(calId, eventId, felder, sendUpdates = "all") {
  await api(`${calBasis(calId)}/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`, "PATCH", eventKoerper(felder));
}
export async function eventLoeschen(calId, eventId) {
  await api(`${calBasis(calId)}/${encodeURIComponent(eventId)}?sendUpdates=all`, "DELETE");
}

// Mail des verbundenen Kontos = id des primaeren Kalenders (braucht nur den Calendar-Scope).
export async function kontoMail() {
  try {
    const d = await api("https://www.googleapis.com/calendar/v3/calendars/primary", "GET");
    return d.id || "";
  } catch {
    return "";
  }
}

// --- Tasks (nur in der eigenen @default-Liste, v1) ------------------------
const TASK_BASIS = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";

export async function taskAnlegen({ titel, notiz, faellig }) {
  const koerper = { title: titel, notes: notiz || "" };
  if (faellig) koerper.due = `${faellig}T00:00:00.000Z`;
  const d = await api(TASK_BASIS, "POST", koerper);
  return d.id;
}
export async function taskUpdaten(taskId, { titel, notiz, faellig }) {
  const koerper = { title: titel, notes: notiz || "" };
  if (faellig) koerper.due = `${faellig}T00:00:00.000Z`;
  await api(`${TASK_BASIS}/${encodeURIComponent(taskId)}`, "PATCH", koerper);
}
export async function taskLoeschen(taskId) {
  await api(`${TASK_BASIS}/${encodeURIComponent(taskId)}`, "DELETE");
}
