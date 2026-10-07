// Drive einrichten (v63): welches Google-Konto, welcher Arbeitsordner, Struktur anlegen.
//
// Alles laeuft ueber die schon vorhandene rclone-Anbindung (lib/drive.js) — kein eigener
// Google-API-Zugriff, keine zusaetzlichen Zugangsdaten.

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as drive from "./drive.js";
import { PHASEN, SYSTEM_ORDNER, pruefeStruktur, strukturOrdner } from "./pipeline.js";

// --- Konto ---------------------------------------------------------------------
//
// rclone kennt keinen Befehl fuer die Konto-Mail. Aber Drive liefert bei jeder Datei den
// BESITZER mit (`rclone lsjson --metadata` -> Metadata.owner) — und die Dateien in
// "System (AI only)" hat das Board selbst mit dem verbundenen Konto geschrieben. Der Besitzer
// dieser Dateien IST das verbundene Konto. Kein zweiter Token-Weg, keine hinterlegten
// Fremd-Zugangsdaten. Ohne Board-Dateien im Ordner (frisch gewaehlt, Struktur noch nicht
// angelegt) ist das Konto nicht ableitbar -> null.
let kontoCache = null; // { zeit, root, wert }
const KONTO_TTL_MS = 5 * 60 * 1000;
export function kontoCacheLeeren() { kontoCache = null; }

export async function konto() {
  const root = drive.aktuellerRoot();
  if (kontoCache && kontoCache.root === root && Date.now() - kontoCache.zeit < KONTO_TTL_MS) return kontoCache.wert;
  let wert = null;
  try {
    const out = await drive.rcloneMitRoot(["lsjson", `gdrive:${SYSTEM_ORDNER}`, "--metadata", "--files-only"], root, { timeoutMs: 45000 });
    const dateien = JSON.parse(out || "[]");
    const bevorzugt = dateien.find((d) => d.Name === "LIESMICH.md") || dateien.find((d) => d.Name === "spalten.json") || dateien[0];
    const mail = bevorzugt && bevorzugt.Metadata && bevorzugt.Metadata.owner;
    if (mail) wert = { email: mail };
  } catch {
    wert = null;
  }
  // v103: In einer geteilten Ablage gehoeren Dateien der Ablage, nicht einer Person (kein owner) —
  // dann fragt das Board Drive direkt, wer angemeldet ist (about.user, derselbe Zugang wie rclone).
  if (!wert) {
    try {
      const token = await driveToken();
      const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", { headers: { authorization: `Bearer ${token}` } });
      const mail = r.ok ? ((await r.json()).user || {}).emailAddress : "";
      if (mail) wert = { email: mail };
    } catch { /* bleibt null */ }
  }
  kontoCache = { zeit: Date.now(), root, wert };
  return wert;
}

// --- Name des Arbeitsordners (v86) -------------------------------------------------
//
// Owner 01.10.2026: „Der Arbeitsordner ist nicht nutzerfreundlich benannt" — die Anzeige zeigte die
// ID. rclone kann den Namen des Root-Ordners selbst nicht liefern (er listet nur dessen Inhalt);
// deshalb EIN Drive-API-Aufruf files/<id>?fields=name mit demselben Zugang wie rclone. Das Token
// wird nur im Speicher erneuert (rclone schreibt seinen eigenen Stand selbst). Fehler -> "".
const nameCache = new Map(); // id -> name
let zugriff = null; // { token, bis }

async function driveToken() {
  if (zugriff && Date.now() < zugriff.bis) return zugriff.token;
  const env = drive.zugang();
  if (!env) throw new Error("kein Drive-Zugang");
  const tok = JSON.parse(env.RCLONE_CONFIG_GDRIVE_TOKEN || "{}");
  if (tok.access_token && Date.parse(tok.expiry) - 60000 > Date.now()) {
    zugriff = { token: tok.access_token, bis: Date.parse(tok.expiry) - 60000 };
    return zugriff.token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.RCLONE_CONFIG_GDRIVE_CLIENT_ID || "",
      client_secret: env.RCLONE_CONFIG_GDRIVE_CLIENT_SECRET || "",
      refresh_token: tok.refresh_token || "",
      grant_type: "refresh_token",
    }),
  });
  const d = await res.json();
  if (!res.ok || !d.access_token) throw new Error(`Drive-Token: ${d.error || res.status}`);
  zugriff = { token: d.access_token, bis: Date.now() + ((d.expires_in || 3600) - 60) * 1000 };
  return zugriff.token;
}

export async function ordnerName(id = drive.aktuellerRoot()) {
  if (!id) return "";
  if (nameCache.has(id)) return nameCache.get(id);
  const token = await driveToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive ${res.status}`);
  const name = (await res.json()).name || "";
  nameCache.set(id, name);
  return name;
}

// v91: Board-Name = Name des Drive-Hauptordners (eine Wahrheit). Umbenennen im Board benennt den
// Drive-Ordner um; danach zeigt der Kopf den neuen Namen.
export async function ordnerUmbenennen(name, id = drive.aktuellerRoot()) {
  const neu = String(name || "").trim();
  if (!id) throw new Error("Kein Arbeitsordner gesetzt.");
  if (!neu) throw new Error("Der Name darf nicht leer sein.");
  const token = await driveToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name&supportsAllDrives=true`,
    { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ name: neu }) },
  );
  if (!res.ok) throw new Error(`Drive hat das Umbenennen abgelehnt (${res.status}).`);
  const name2 = (await res.json()).name || neu;
  nameCache.set(id, name2);
  return name2;
}

// --- Geteilte Ablage (v103) ---------------------------------------------------------
//
// Owner 02.10.2026: „Der offizielle Social-Media-Ordner ist ein Unterordner in einem geteilten Workspace."
// Ein Ordner in einer geteilten Ablage traegt deren ID (driveId); die eigenen Rechte stehen in capabilities.
// Das Board verschiebt Projektordner zwischen den Spaltenordnern — das darf in einer geteilten Ablage erst
// die Rolle Content-Manager (Drive-API „Roles and permissions": Mitwirkende koennen nicht verschieben).
export async function ablageInfo(id) {
  const token = await driveToken();
  const felder = "name,driveId,capabilities(canMoveItemWithinDrive,canAddChildren,canEdit,canTrash)";
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${felder}&supportsAllDrives=true`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(r.status === 404 ? "Ordner nicht gefunden oder kein Zugriff mit diesem Google-Konto." : `Drive ${r.status}`);
  const f = await r.json();
  const c = f.capabilities || {};
  let ablageName = "";
  if (f.driveId) {
    const d = await fetch(`https://www.googleapis.com/drive/v3/drives/${encodeURIComponent(f.driveId)}?fields=name`, { headers: { authorization: `Bearer ${token}` } });
    if (d.ok) ablageName = (await d.json()).name || "";
  }
  return {
    name: f.name || "",
    teamDrive: f.driveId || null,
    ablageName,
    rechte: { anlegen: !!c.canAddChildren, bearbeiten: !!c.canEdit, verschieben: f.driveId ? !!c.canMoveItemWithinDrive : !!c.canEdit, papierkorb: !!c.canTrash },
  };
}

// Satz fuer die Oberflaeche: wo der Ordner liegt und ob die Rechte fuer das Board reichen.
export function ablageSatz(a) {
  if (!a || !a.teamDrive) return "";
  const wo = `Liegt in der geteilten Ablage „${a.ablageName || a.teamDrive}“.`;
  if (!a.rechte.anlegen) return `${wo} Dein Konto darf dort nichts anlegen — das Board braucht dort mindestens die Rolle Content-Manager.`;
  if (!a.rechte.verschieben) return `${wo} Dein Konto darf dort anlegen, aber nicht verschieben (Rolle Mitwirkender) — Karten könnten nicht die Spalte wechseln. Bitte bei einem Manager der Ablage die Rolle Content-Manager erbitten.`;
  return `${wo} Deine Rechte reichen: anlegen, schreiben und Karten zwischen Spalten verschieben.`;
}

// --- Ordner-ID aus Link oder ID --------------------------------------------------

export function parseOrdnerId(eingabe) {
  const t = String(eingabe || "").trim();
  if (!t) return null;
  const m = t.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || t.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : null;
}

// --- Ordner pruefen -----------------------------------------------------------------
//
// v87 (Owner 30.09.2026): Die Struktur steht fest (PHASEN). Das Board passt sich nicht an,
// es prueft:
// leer   = keinerlei Inhalt                          -> Struktur wird angelegt
// board  = feste Struktur vollstaendig erkannt       -> wird geladen
// falsch = "System (AI only)" da, Struktur aber nicht -> abgelehnt, `fehler` sagt warum
// fremd  = etwas anderes (kein Board-Ordner)         -> abgelehnt
// Nicht erreichbar/kein Zugriff -> Fehler (nicht "fremd").
export async function pruefeOrdner(id) {
  // v103: zuerst klaeren, ob der Ordner in einer geteilten Ablage liegt — sonst listet rclone ihn leer
  // und ein vorhandenes Board saehe aus wie ein leerer Ordner. Scheitert die Abfrage, gilt „Meine Ablage".
  const ablage = await ablageInfo(id).catch(() => null);
  const teamDrive = ablage ? ablage.teamDrive : null;
  let ausgabe;
  try {
    ausgabe = await drive.rcloneMitRoot(["lsf", "-R", "--fast-list", "--max-depth", "2", "gdrive:"], id, { timeoutMs: 45000, teamDrive });
  } catch (e) {
    throw new Error(`Der Ordner ist mit diesem Google-Konto nicht erreichbar (${e.message}).`);
  }
  const eintraege = ausgabe.split(/\r?\n/).filter(Boolean);
  if (eintraege.length === 0) return { art: "leer", eintraege, fehler: [], ablage };
  const ordner = eintraege.filter((e) => e.endsWith("/"));
  if (!ordner.some((e) => e.replace(/\/$/, "") === SYSTEM_ORDNER)) return { art: "fremd", eintraege, fehler: [], ablage };
  const p = pruefeStruktur(ordner);
  return { art: p.ok ? "board" : "falsch", eintraege, fehler: p.fehler, ablage };
}

// Ein Satz fuer die Oberflaeche aus dem Pruefergebnis.
export function pruefSatz(p) {
  if (p.art === "leer") return "Der Ordner ist leer — die Board-Struktur wird darin angelegt.";
  if (p.art === "board") return "Die Board-Struktur ist vollständig — sie wird geladen.";
  if (p.art === "falsch") return `Das Board kann diesen Ordner nicht laden: ${p.fehler.join(" ")}`;
  return "Der Ordner ist nicht leer und enthält keine Board-Struktur — bitte einen leeren Ordner wählen.";
}

// --- Struktur anlegen ---------------------------------------------------------------
//
// Legt im (bereits als Root gesetzten) Ordner die feste Struktur an: alle Spaltenordner und
// „System (AI only)" mit einer LIESMICH.md, die Menschen die Struktur erklaert. Ein Upload als
// lokaler Baum (einzeln waeren es ~10 rclone-Aufrufe, gemessen 184 s). Vorhandenes bleibt.
export function liesMich() {
  return [
    "# Board-Struktur (fest)",
    "",
    "Diesen Ordner hat das Social-Media-Board angelegt. Die Struktur ist fest — Ordner hier",
    "nicht umbenennen, verschieben oder löschen, sonst lädt das Board nichts und sagt, warum.",
    "",
    ...PHASEN.map((p) => `- „${p.ordner}“ — ${p.name}: ${p.satz || ""}`),
    `- „${SYSTEM_ORDNER}“ — Einstellungen des Boards (nicht von Hand ändern)`,
    // v113 (N15): die Ordner, die das Board bei Bedarf selbst anlegt, standen hier nicht.
    "- „Papierkorb“ — gelöschte Karten; ihr Projektordner liegt hier mit Zeitstempel und lässt sich zurückholen",
    "- „Kontext“ — Dateien, die in jeden KI-Text gehen: „Kontext/_global“ für alle, „Kontext/<Reihe>“ je Reihe",
    "- „Kampagnen“ — eine Tabelle je Kampagne mit Anlässen und Datum (Redaktionsplan → Kampagnen)",
    "- „Videoauswertung/KPI“ und „Videoauswertung/Auswertung-Tabellen“ — Messwerte des Boards, keine Projekte",
    "",
    "Ohne Board: ein Projekt wechselt die Phase, indem man seinen Ordner in den nächsten",
    "Spaltenordner zieht. Jeder Projektordner hat einen Steckbrief.md mit Stand und Terminen.",
    "",
  ].join("\n");
}

export async function legeStrukturAn() {
  const wurzel = await mkdtemp(join(tmpdir(), "board-struktur-"));
  try {
    for (const o of strukturOrdner()) await mkdir(join(wurzel, ...o.split("/")), { recursive: true });
    await writeFile(join(wurzel, SYSTEM_ORDNER, "LIESMICH.md"), liesMich(), "utf8");
    await drive.baumHochladen(wurzel);
  } finally {
    await rm(wurzel, { recursive: true, force: true });
  }
  return { angelegt: strukturOrdner().length };
}

// --- Konto wechseln -----------------------------------------------------------------
//
// Startet rclones Browser-Anmeldung (`rclone config reconnect gdrive:`). rclone oeffnet den
// Browser selbst und wartet auf den Rueckruf; erst nach erfolgreichem Login wird die Config
// neu geschrieben. Gibt den Prozess zurueck (Aufrufer entscheidet ueber Wartezeit/Abbruch).
// v93: `neu` = {clientId, clientSecret} legt die Verbindung „gdrive" erst an (frischer Rechner, Einrichtung
// Schritt 1); rclone oeffnet dafuer selbst die Google-Anmeldung im Browser. Ohne `neu`: bestehende erneuern.
export function starteKontoWechsel(configPfad, neu = null) {
  const args = neu
    ? ["config", "create", "gdrive", "drive", `client_id=${neu.clientId}`, `client_secret=${neu.clientSecret}`, "scope=drive"]
    : ["config", "reconnect", "gdrive:", "--auto-confirm"];
  if (configPfad) args.push("--config", configPfad);
  return spawn("rclone", args, { shell: false });
}
