// Analytics-Dashboard: laedt Stats von Instagram und LinkedIn und rendert sie.

function fmtZahl(n) {
  if (n == null) return "–";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " Mio";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".", ",") + " Tsd";
  return String(n);
}

function fmtDatum(iso) {
  if (!iso) return "";
  try {
    return new Date(typeof iso === "number" ? iso : iso).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "2-digit"
    });
  } catch { return ""; }
}

// --- Instagram ---

async function ladeInstagram() {
  const inhalt = document.getElementById("ig-inhalt");
  const knopf = document.getElementById("ig-verbinden-knopf");
  try {
    const res = await fetch("/api/stats/instagram");
    const daten = await res.json();

    if (!daten.verbunden) {
      knopf.style.display = "";
      inhalt.innerHTML = `
        <div class="plattform-nicht-verbunden">
          <p class="plattform-hinweis">Noch nicht mit Instagram verbunden.</p>
          <a class="plattform-verbinden" href="/api/auth/instagram">Mit Instagram verbinden</a>
        </div>`;
      return;
    }

    if (daten.fehler) {
      inhalt.innerHTML = `<div class="fehler-banner">${escHtml(daten.fehler)}</div>`;
      knopf.style.display = "";
      return;
    }

    const k = daten.konto || {};
    const medien = daten.medien || [];
    knopf.textContent = "Neu verbinden";
    knopf.style.display = "";

    inhalt.innerHTML = `
      <div class="konto-leiste">
        ${k.profile_picture_url
          ? `<img class="konto-bild" src="${escHtml(k.profile_picture_url)}" alt="Profilbild" crossorigin="anonymous">`
          : ""}
        <div class="konto-info-block">
          <div class="konto-nutzername">@${escHtml(k.username || "")}</div>
          <div class="konto-kennzahlen">
            <div class="kennzahl">
              <span class="kennzahl-wert">${fmtZahl(k.followers_count)}</span>
              <span class="kennzahl-label">Follower</span>
            </div>
            <div class="kennzahl">
              <span class="kennzahl-wert">${fmtZahl(k.media_count)}</span>
              <span class="kennzahl-label">Posts</span>
            </div>
          </div>
        </div>
      </div>
      <div class="medien-grid" id="ig-grid"></div>`;

    const grid = document.getElementById("ig-grid");
    for (const m of medien) {
      const bild = m.thumbnail_url || m.media_url || "";
      const ins = m.insights || {};
      const card = document.createElement("a");
      card.className = "medien-karte";
      card.href = m.permalink || "#";
      card.target = "_blank";
      card.rel = "noopener";
      card.innerHTML = `
        ${bild
          ? `<img class="medien-thumb" src="${escHtml(bild)}" alt="" loading="lazy" crossorigin="anonymous">`
          : `<div class="medien-kein-bild">&#127916;</div>`}
        <div class="medien-meta">
          <div class="medien-typ">${escHtml(m.media_type || "")} · ${fmtDatum(m.timestamp)}</div>
          <div class="medien-metriken">
            <span title="Likes">&#9829; ${fmtZahl(m.like_count ?? 0)}</span>
            <span title="Kommentare">&#128172; ${fmtZahl(m.comments_count ?? 0)}</span>
            ${ins.impressions != null ? `<span title="Impressionen">&#128064; ${fmtZahl(ins.impressions)}</span>` : ""}
            ${ins.plays != null ? `<span title="Plays">&#9654; ${fmtZahl(ins.plays)}</span>` : ""}
          </div>
        </div>`;
      grid.appendChild(card);
    }
    if (!medien.length) {
      grid.innerHTML = `<p class="plattform-hinweis">Noch keine Posts gefunden.</p>`;
    }
  } catch (e) {
    inhalt.innerHTML = `<div class="fehler-banner">Netzwerkfehler: ${escHtml(e.message)}</div>`;
  }
}

// --- LinkedIn ---

async function ladeLinkedIn() {
  const inhalt = document.getElementById("li-inhalt");
  const knopf = document.getElementById("li-verbinden-knopf");
  try {
    const res = await fetch("/api/stats/linkedin");
    const daten = await res.json();

    if (!daten.verbunden) {
      knopf.style.display = "";
      inhalt.innerHTML = `
        <div class="plattform-nicht-verbunden">
          <p class="plattform-hinweis">Noch nicht mit LinkedIn verbunden.</p>
          <a class="plattform-verbinden" href="/api/auth/linkedin">Mit LinkedIn verbinden</a>
        </div>`;
      return;
    }

    if (daten.fehler) {
      inhalt.innerHTML = `<div class="fehler-banner">${escHtml(daten.fehler)}</div>`;
      knopf.style.display = "";
      return;
    }

    const k = daten.konto || {};
    const posts = daten.posts || [];
    knopf.textContent = "Neu verbinden";
    knopf.style.display = "";

    inhalt.innerHTML = `
      <div class="konto-leiste">
        <div class="konto-info-block">
          <div class="konto-nutzername">${escHtml(k.name || "")}</div>
          <div class="konto-kennzahlen">
            <div class="kennzahl">
              <span class="kennzahl-wert">${fmtZahl(k.follower)}</span>
              <span class="kennzahl-label">Follower</span>
            </div>
          </div>
        </div>
      </div>
      <div class="posts-liste" id="li-liste"></div>`;

    const liste = document.getElementById("li-liste");
    for (const p of posts) {
      const el = document.createElement("div");
      el.className = "post-karte";
      el.innerHTML = `
        ${p.text ? `<div class="post-text">${escHtml(p.text)}</div>` : ""}
        <div class="post-metriken">
          <span title="Likes">&#9829; ${fmtZahl(p.likes ?? 0)}</span>
          <span title="Kommentare">&#128172; ${fmtZahl(p.kommentare ?? 0)}</span>
        </div>
        <div class="post-datum">${fmtDatum(p.erstellt)}</div>`;
      liste.appendChild(el);
    }
    if (!posts.length) {
      liste.innerHTML = `<p class="plattform-hinweis">Noch keine Posts gefunden.</p>`;
    }
  } catch (e) {
    inhalt.innerHTML = `<div class="fehler-banner">Netzwerkfehler: ${escHtml(e.message)}</div>`;
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- URL-Parameter auswerten (nach OAuth-Redirect) ---
function pruefeUrlParameter() {
  const p = new URLSearchParams(location.search);
  const meldung = document.getElementById("meldung");
  if (p.has("verbunden")) {
    const plattform = p.get("verbunden");
    meldung.textContent = `${plattform === "instagram" ? "Instagram" : "LinkedIn"} verbunden.`;
    meldung.style.color = "#7fdba0";
    history.replaceState({}, "", "/analytics.html");
  }
  if (p.has("fehler")) {
    meldung.textContent = `Fehler: ${p.get("fehler")}`;
    meldung.style.color = "var(--gefahr)";
    history.replaceState({}, "", "/analytics.html");
  }
}

pruefeUrlParameter();
ladeInstagram();
ladeLinkedIn();
