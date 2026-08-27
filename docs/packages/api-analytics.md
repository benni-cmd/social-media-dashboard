# Arbeitspaket: API Analytics — Instagram + LinkedIn

## Problem
Das Social-Media-Dashboard hat keine Verbindung zu echten Plattform-APIs. Follower-Zahlen,
Reichweite und Post-Performance sind nicht sichtbar.

## Intent
Instagram Graph API und LinkedIn API anbinden — OAuth-Flow lokal, Token-Speicherung sicher
(nie im Repo), Stats-Endpunkte als Proxy im bestehenden Node-Server.

## Goal
- `/analytics.html` zeigt Follower, Post-Anzahl, letzte 12 Posts (Likes, Kommentare,
  Impressionen, Plays) für Instagram und LinkedIn.
- OAuth-Verbindung läuft vollständig lokal über `localhost:4321`.
- Keine neuen npm-Pakete.

---

## Plan

| Schritt | Was | Datei |
|---------|-----|-------|
| B1 | `data/tokens.json` + `.env*` zu `.gitignore` | `.gitignore` |
| B1 | `.env.example` mit Platzhaltern | `.env.example` |
| B2 | OAuth-Routen (4 Stück: IG + LI je start + callback) | `server.js` |
| B3 | Stats-Routen `/api/stats/instagram` + `/api/stats/linkedin` | `server.js` |
| B4 | Analytics-Dashboard-Seite | `public/analytics.html`, `public/analytics.js` |
| B5 | Navigation-Link im Board-Header | `public/index.html` |

---

## Stand

- [ ] B1 — .gitignore + .env.example
- [ ] B2 — OAuth-Routen
- [ ] B3 — Stats-Routen
- [ ] B4 — Analytics-Seite
- [ ] B5 — Navigation

---

## Definition of Done

- `GET /api/auth/instagram` leitet zu Meta weiter
- `GET /api/auth/instagram/callback` speichert Token in `data/tokens.json`
- `GET /api/stats/instagram` liefert `{ verbunden: true, konto: {...}, medien: [...] }`
- Analog für LinkedIn
- `analytics.html` rendert beide Plattformen; bei fehlendem Token: Verbinden-Button
