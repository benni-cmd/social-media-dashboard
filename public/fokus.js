// Sitzungs-Zustand der Fokus-Ansicht (P27 F4): ob bei offener Karte das Board ausgeblendet
// und die Detailspalte breiter/zentriert gezeigt wird. Eigenes, winziges Modul statt ein Feld
// in store.js' S — der Flag ist reine UI-Sicht (kein Karten-/Board-Zustand, nichts, was der
// Server je sieht), und ein eigenes Modul haelt diesen Schnitt unabhaengig von paralleler
// Arbeit an store.js.
export const FOKUS = { an: false };
