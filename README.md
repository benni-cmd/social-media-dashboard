# Social Media Dashboard

Lokales Werkzeug fuer Bens Social-Media-Content. Zwei Teile:

1. **Content-Pipeline-Board** (v1, gebaut) — ein Trello-artiges Board, auf dem eine Idee
   den Weg **Idee &rsaquo; Skript &rsaquo; Schnitt &rsaquo; Caption &rsaquo; Upload** wandert.
   Pro Karte gibt es KI-Buttons (Skript-Entwurf, Caption, Hook-Ideen).
2. **Analytics-Dashboard** (spaetere Ausbaustufe) — Instagram- und LinkedIn-Zahlen auswerten
   und analysieren, warum ein Video besser oder schlechter lief.

## KI ohne Token-Kosten

Die KI-Buttons rufen **lokal die Claude-Code-CLI** auf (`claude -p`). Das laeuft ueber dein
Claude-Abo und kostet **keine API-Tokens** — nur die ueblichen Abo-Ratenlimits.

Einmalige Einrichtung:

```
npm i -g @anthropic-ai/claude-code   # CLI installieren
claude                               # einmal starten und interaktiv einloggen
```

## Starten

```
npm start
```

Dann im Browser `http://localhost:4321` oeffnen. Der Server braucht **keine** npm-Abhaengigkeiten
(nur Node >= 20) — er nutzt ausschliesslich Node-Bordmittel.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `server.js` | Node-Server: statische Dateien, Board-Stand lesen/speichern, KI-Aktion ueber `claude -p`. |
| `public/` | Board-Oberflaeche (`index.html`, `style.css`, `app.js`). |
| `data/board.json` | Persistierter Board-Stand. |
| `docs/packages/` | Arbeitspakete (Plan, Stand, Definition of Done). |
