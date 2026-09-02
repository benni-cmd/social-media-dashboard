// Google Calendar + Tasks — roh ueber die REST-APIs, kein googleapis-Paket (das Projekt ist
// dependency-frei; IG/LinkedIn machen OAuth genauso). Der OAuth-User-Flow liegt in server.js
// (/api/auth/google[/callback]); hier steckt nur: Access-Token frisch halten und die Aufrufe.
//
// Warum OAuth statt Service-Account: ein SA ohne Workspace-Delegation erreicht die Tasks eines
// privaten Gmail gar nicht (Uebergabe der Drive-Session, docs/packages/v16-drehtermine.md).

import { readFile, writeFile } from "node:fs/promises";

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
    throw new Error(`Token-Refresh fehlgeschlagen: ${daten.error_description || daten.error || res.status}`);
  }
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
  const res = await fetch(url, {
    method: methode,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: koerper ? JSON.stringify(koerper) : undefined,
  });
  const text = await res.text();
  let daten = {};
  try { daten = text ? JSON.parse(text) : {}; } catch { daten = { raw: text }; }
  if (!res.ok) throw new Error(`Google API ${res.status}: ${daten.error?.message || text.slice(0, 200)}`);
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

export async function eventAnlegen(calId, felder) {
  const d = await api(`${calBasis(calId)}?sendUpdates=all`, "POST", eventKoerper(felder));
  return d.id;
}
export async function eventUpdaten(calId, eventId, felder) {
  await api(`${calBasis(calId)}/${encodeURIComponent(eventId)}?sendUpdates=all`, "PATCH", eventKoerper(felder));
}
export async function eventLoeschen(calId, eventId) {
  await api(`${calBasis(calId)}/${encodeURIComponent(eventId)}?sendUpdates=all`, "DELETE");
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
