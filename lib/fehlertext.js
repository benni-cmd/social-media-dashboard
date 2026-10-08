// v115 (v114 N1) — EINE Uebersetzung technischer Fehlertexte in einen deutschen Satz.
// Rein (kein DOM, kein fetch): laeuft im Server (Antwort-`satz`) und im Browser (/lib/fehlertext.js, Toasts).
// Bis v114 standen rohe rclone-Logzeilen („2026/10/07 09:41:37 ERROR : Local file system … Server side directory
// move failed") und JS-Laufzeitfehler („Cannot create property …") im Toast.

const RCLONE_ZEILE = /\b\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} (?:ERROR|NOTICE|CRITICAL|INFO|DEBUG)\s*:\s*/;

// Reihenfolge = Vorrang: der erste passende Grund gewinnt.
const DRIVE_GRUENDE = [
  [/storageQuotaExceeded|quotaExceeded|insufficient storage|not enough space/i, "Der Drive-Speicher ist voll."],
  [/rateLimitExceeded|userRateLimitExceeded|too many requests|\b429\b/i, "Drive bremst gerade (zu viele Anfragen) — in einer Minute nochmal versuchen."],
  [/insufficientFilePermissions|insufficientPermissions|permission denied|forbidden|\b403\b/i, "Fuer diesen Drive-Ordner fehlen die Rechte."],
  [/directory not empty/i, "Der Zielordner in Drive ist nicht leer."],
  [/Server side directory move failed|can't move|cannot move|move failed|not a directory/i, "Drive konnte den Ordner nicht verschieben — das Ziel ist nicht beschreibbar."],
  [/directory not found|file not found|object not found|no such file|cannot find the path|\b404\b/i, "Der Ordner oder die Datei ist in Drive nicht (mehr) da."],
  [/timed? ?out|deadline exceeded/i, "Drive hat nicht rechtzeitig geantwortet."],
  [/ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|network is unreachable|dial tcp|no such host/i, "Keine Verbindung zu Drive (Netzwerk)."],
];

const JS_LAUFZEIT = /Cannot (read|set|create) propert|is not a function|is not iterable|is not defined|Unexpected token|Maximum call stack/i;

// Liefert den deutschen Satz; unbekannte Texte kommen unveraendert zurueck (die sind meist schon Saetze).
// Ein Satzanfang vor dem technischen Teil bleibt stehen („„Kompost“ verschieben ging nicht: <Grund>").
export function verstaendlicherFehler(roh) {
  const s = String(roh ?? "");
  if (/unauthorized_client/i.test(s)) return "Drive lehnt die Anmeldung ab: Die Client-ID passt nicht zum gespeicherten Zugang. Drive in den Einstellungen neu verbinden.";
  if (/invalid_grant/i.test(s)) return "Die Anmeldung bei Google ist abgelaufen. In den Einstellungen neu verbinden.";
  if (/(didn't|couldn't) find section in config file/i.test(s))
    return "Drive ist auf diesem Rechner nicht verbunden (rclone kennt die Verbindung „gdrive“ nicht). Einstellungen → Google → Google Drive verbinden.";
  const mitVorsatz = (start, grund) => {
    const vor = s.slice(0, start).replace(/[\s:–—-]+$/, "").trim();
    return vor ? `${vor}: ${grund}` : grund;
  };
  const zeile = s.match(RCLONE_ZEILE) || s.match(/googleapi:|rclone endete mit Code/i);
  if (zeile) {
    const treffer = DRIVE_GRUENDE.find(([muster]) => muster.test(s));
    return mitVorsatz(zeile.index, treffer ? treffer[1] : "Drive hat den Vorgang abgelehnt. Details stehen im Server-Fenster.");
  }
  const js = s.match(JS_LAUFZEIT);
  if (js) return mitVorsatz(s.lastIndexOf(":", js.index) > -1 ? s.lastIndexOf(":", js.index) : 0, "Im Board ist ein interner Fehler passiert. Details stehen im Server-Fenster.");
  return s;
}
