/**
 * Generator strony Skyshot Polska.
 * Czyta treść z plików JSON, styl z styles.css, zdjęcia z folderu media
 * i zapisuje gotową stronę do katalogu dist/.
 *
 * Pliki mogą leżeć w podfolderach (src/content/, src/, media/)
 * albo wszystkie luzem w głównym katalogu — generator radzi sobie z obydwoma
 * układami, więc kolejność wgrywania na GitHuba nie ma znaczenia.
 *
 * Uruchomienie lokalne:  node build.mjs
 * Na Cloudflare uruchamia się automatycznie przy każdej zmianie w repozytorium.
 */
import {
  readFileSync, writeFileSync, mkdirSync, copyFileSync,
  readdirSync, rmSync, existsSync, statSync,
} from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

// Szuka pliku najpierw w podfolderze, potem w katalogu głównym.
// Pomija pliki puste — po nieudanym wgrywaniu potrafią zostać w repozytorium
// puste skorupki, które nie powinny przesłaniać poprawnej wersji.
const find = (...candidates) => {
  const hit = candidates.find(
    (c) => existsSync(join(root, c)) && statSync(join(root, c)).size > 0
  );
  if (!hit) {
    throw new Error(
      `Nie znaleziono pliku z treścią. Szukałem w: ${candidates.join(', ')}\n` +
        'Sprawdź, czy plik jest w repozytorium i czy nie jest pusty.'
    );
  }
  return hit;
};

// Wczytuje treść z pierwszego pliku, który daje się poprawnie odczytać.
const json = (name) => {
  const candidates = [`src/content/${name}.json`, `${name}.json`];
  const problems = [];

  for (const c of candidates) {
    const full = join(root, c);
    if (!existsSync(full)) continue;

    const raw = read(c).trim();
    if (!raw) {
      problems.push(`${c} — plik jest pusty, pomijam`);
      continue;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      problems.push(`${c} — błąd składni JSON: ${e.message}`);
    }
  }

  throw new Error(
    `Nie udało się wczytać treści sekcji "${name}".\n` +
      (problems.length
        ? problems.join('\n')
        : `Nie znaleziono żadnego z plików: ${candidates.join(', ')}`) +
      '\nPopraw wskazany plik w repozytorium i zapisz zmianę.'
  );
};

const site = json('site');
const hero = json('hero');
const services = json('services');
const work = json('work');
const process_ = json('process');
const pricing = json('pricing');
const contact = json('contact');

/* ---------- pomocnicze ---------- */

// Zamienia znaki specjalne HTML, żeby treść z panelu nie rozbiła strony.
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// *słowo* w treści zamienia na wyróżnienie kolorem marki.
const accent = (s = '') => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');

// Numer telefonu w formacie do kliknięcia (tel:).
const telHref = (s = '') => 'tel:' + String(s).replace(/[^\d+]/g, '');

const list = (arr = [], fn) => arr.map(fn).join('\n');

/* ---------- sekcje ---------- */

const navHtml = list(
  site.nav,
  (l) => `        <a href="${esc(l.href)}">${esc(l.label)}</a>`
);

const telemetryHtml = list(
  hero.telemetry,
  (t) =>
    `        <div class="tl"><dt>${esc(t.label)}</dt><dd>${esc(t.value)}</dd></div>`
);

const servicesHtml = list(
  services.items,
  (s) => `        <article class="svc">
          <span class="svc-idx">${esc(s.code)}</span>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.text)}</p>
          <ul>
${list(s.points, (p) => `            <li>${esc(p)}</li>`)}
          </ul>
        </article>`
);

// Rozmiary kafelków w siatce realizacji.
const sizeClass = { pion: 'g-a', duzy: 'g-b', polowa: 'g-c', panorama: 'g-e' };

const workHtml = list(
  work.items,
  (w) => `        <figure class="${sizeClass[w.size] || 'g-c'}">
          <img src="${esc(w.image)}" alt="${esc(w.alt)}" loading="lazy" decoding="async">
          <figcaption>
            <span class="cap-place">${esc(w.place)}</span>
            <span class="cap-meta">${(w.meta || [])
              .map((m) => `<span>${esc(m)}</span>`)
              .join('')}</span>
          </figcaption>
        </figure>`
);

const processHtml = list(
  process_.items,
  (s, i) => `        <div class="step">
          <div class="step-n">KROK ${String(i + 1).padStart(2, '0')}</div>
          <h4>${esc(s.title)}</h4>
          <p>${esc(s.text)}</p>
        </div>`
);

const tiersHtml = list(
  pricing.tiers,
  (t) => `        <article class="tier${t.highlight ? ' mark' : ''}">
          <div class="tier-head">
            <div class="tier-name">${esc(t.name)}</div>
            <div class="tier-tag">${esc(t.tag || '')}</div>
          </div>
          <div class="tier-price"><span class="from">od</span><b>${esc(
            t.price
          )}</b><span class="cur">${esc(t.unit)}</span></div>
          <div class="tier-note">${esc(t.note || '')}</div>
          <ul>
${list(t.points, (p) => `            <li>${esc(p)}</li>`)}
          </ul>
          <a class="btn ${
            t.highlight ? 'btn-primary' : 'btn-ghost'
          }" href="#kontakt">${esc(t.cta)}</a>
        </article>`
);

const kitHtml = list(
  pricing.kit,
  (k) =>
    `        <dl class="kit"><dt>${esc(k.label)}</dt><dd>${esc(
      k.text
    )}</dd></dl>`
);

// Stara treść uwagi opisywała wysyłkę przez program pocztowy — po przejściu
// na formularz Netlify zastępujemy ją, dopóki nie zostanie zmieniona w panelu.
// Klucz Web3Forms — publiczny z założenia, pozwala tylko wysyłać zgłoszenia
// na adres przypisany do klucza. Można go nadpisać polem web3formsKey w contact.json.
// Film w tle nagłówka: pole "video" w hero.json albo, jeśli go nie ma,
// plik tlo.mp4 wgrany do repozytorium. tlo-mobile.mp4 (opcjonalnie) — lżejsza
// wersja na telefony, tlo-poster.jpg (opcjonalnie) — kadr pokazywany przed startem.
const mediaFile = (name) =>
  ['media/' + name, name].some((c) => existsSync(join(root, c))) ? '/media/' + name : '';
const heroVideo = hero.video || mediaFile('tlo.mp4');
const heroVideoMobile = hero.videoMobile || mediaFile('tlo-mobile.mp4') || heroVideo;
const heroPoster = mediaFile('tlo-poster.jpg') || hero.image;

const WEB3FORMS_KEY = contact.web3formsKey || 'c57b8f83-4534-4ae3-a3b3-d3e49eb246c4';

const formNote = /program pocztowy/i.test(contact.formNote || '')
  ? 'Odpowiadamy w ciągu 24 godzin. Dane z formularza wykorzystujemy wyłącznie do odpowiedzi na zapytanie.'
  : contact.formNote;

const serviceOptionsHtml = list(
  contact.serviceOptions,
  (o) => `                <option>${esc(o)}</option>`
);

/* ---------- dane strukturalne dla Google ---------- */

const schema = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: site.brandName,
  description: site.seoDescription,
  url: site.siteUrl,
  image: site.siteUrl + site.ogImage,
  telephone: contact.phone,
  email: contact.email,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Białystok',
    addressRegion: 'podlaskie',
    addressCountry: 'PL',
  },
  areaServed: [
    { '@type': 'AdministrativeArea', name: 'województwo podlaskie' },
    { '@type': 'Country', name: 'Polska' },
  ],
  priceRange: 'od 250 zł',
};

/* ---------- strona ---------- */

const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.seoTitle)}</title>
<meta name="description" content="${esc(site.seoDescription)}">
<link rel="canonical" href="${esc(site.siteUrl)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pl_PL">
<meta property="og:title" content="${esc(site.seoTitle)}">
<meta property="og:description" content="${esc(site.seoDescription)}">
<meta property="og:image" content="${esc(site.siteUrl + site.ogImage)}">
<meta property="og:url" content="${esc(site.siteUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0A0A0C">
<link rel="icon" href="${esc(site.logo)}">
<link rel="apple-touch-icon" href="${esc(site.logo)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Barlow:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/styles.css">
<style>
/* formularz: pułapka na boty i potwierdzenie wysyłki */
.hp{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
.form-done{font-family:var(--display);font-size:clamp(20px,2.2vw,26px);line-height:1.35;padding:28px 0;border-top:2px solid var(--accent);max-width:28ch}
button[disabled]{opacity:.6;cursor:progress}
/* film w tle nagłówka — przykrywa zdjęcie, które zostaje jako zapas */
/* kolejność warstw: zdjęcie (0) → film (1) → przyciemnienie (2) → tekst i przycisk */
.hero-video{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;object-position:center;
  filter:saturate(.94) contrast(1.04);opacity:0;transition:opacity .8s ease}
.hero-media::after{z-index:2}
.hero-video.is-playing{opacity:1}
.hero-video.is-playing + img{animation:none}
.hero-toggle{position:absolute;z-index:3;right:var(--pad);bottom:24px;width:42px;height:42px;border-radius:50%;
  border:1px solid rgba(244,243,241,.35);background:rgba(10,10,12,.45);color:#F4F3F1;cursor:pointer;
  display:grid;place-items:center;padding:0;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  transition:border-color .2s,background .2s}
.hero-toggle:hover{border-color:var(--accent);background:rgba(10,10,12,.65)}
.hero-toggle svg{width:14px;height:14px;fill:currentColor}
.hero-toggle[data-state="playing"] .i-play,.hero-toggle[data-state="paused"] .i-pause{display:none}
@media(max-width:820px){.hero-toggle{bottom:16px;width:38px;height:38px}}
</style>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>

<header class="nav">
  <div class="wrap nav-in">
    <a class="brand" href="#top"><img src="${esc(site.logo)}" alt="${esc(
  site.brandName
)}" width="317" height="260"></a>
    <nav class="nav-links">
${navHtml}
    </nav>
    <a class="nav-cta" href="#kontakt">${esc(site.navCta)}</a>
  </div>
</header>

<main id="top">

  <section class="hero" style="padding:0">
    <div class="hero-media">
      ${heroVideo ? `<video class="hero-video" id="heroVideo" muted loop playsinline autoplay preload="metadata"
        poster="${esc(heroPoster)}" aria-hidden="true"
        data-src="${esc(heroVideo)}" data-src-mobile="${esc(heroVideoMobile)}"></video>` : ''}
      <img src="${esc(heroVideo ? heroPoster : hero.image)}" alt="${esc(
  hero.imageAlt
)}" fetchpriority="high" decoding="async">
    </div>
    ${heroVideo ? `<button class="hero-toggle" id="heroToggle" type="button" data-state="paused" aria-label="Odtwórz film w tle" aria-pressed="true" hidden>
      <svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>
      <svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4a.8.8 0 0 0 1.2.7l8.3-5.2a.8.8 0 0 0 0-1.4L5.7 2.1a.8.8 0 0 0-1.2.7z"/></svg>
    </button>` : ''}
    <div class="hero-copy">
      <div class="wrap">
        <p class="eyebrow">${esc(hero.eyebrow)}</p>
        <h1>${accent(hero.title)}</h1>
        <p class="lede">${esc(hero.lede)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#kontakt">${esc(
            hero.ctaPrimary
          )}</a>
          <a class="btn btn-ghost" href="#realizacje">${esc(
            hero.ctaSecondary
          )}</a>
        </div>
      </div>
    </div>
  </section>

  <div class="telemetry">
    <div class="wrap">
      <dl class="telemetry-in">
${telemetryHtml}
      </dl>
    </div>
  </div>

  <section id="uslugi">
    <div class="wrap">
      <div class="sec-head">
        <p class="eyebrow">${esc(services.eyebrow)}</p>
        <h2>${esc(services.heading)}</h2>
        <p class="lede">${esc(services.lede)}</p>
      </div>
      <div class="services">
${servicesHtml}
      </div>
    </div>
  </section>

  <section class="work" id="realizacje">
    <div class="wrap">
      <div class="sec-head">
        <p class="eyebrow">${esc(work.eyebrow)}</p>
        <h2>${esc(work.heading)}</h2>
      </div>
      <div class="grid">
${workHtml}
      </div>
    </div>
  </section>

  <section id="proces">
    <div class="wrap">
      <div class="sec-head">
        <p class="eyebrow">${esc(process_.eyebrow)}</p>
        <h2>${esc(process_.heading)}</h2>
      </div>
      <div class="steps">
${processHtml}
      </div>
    </div>
  </section>

  <section id="pakiety">
    <div class="wrap">
      <div class="sec-head">
        <p class="eyebrow">${esc(pricing.eyebrow)}</p>
        <h2>${esc(pricing.heading)}</h2>
        <p class="lede">${esc(pricing.lede)}</p>
      </div>
      <div class="tiers">
${tiersHtml}
      </div>
      <p class="price-foot">${esc(pricing.footnote)}</p>
    </div>
  </section>

  <div class="band">
    <div class="wrap">
      <div class="band-in">
${kitHtml}
      </div>
    </div>
  </div>

  <section id="kontakt">
    <div class="wrap">
      <div class="sec-head">
        <p class="eyebrow">${esc(contact.eyebrow)}</p>
        <h2>${esc(contact.heading)}</h2>
        <p class="lede">${esc(contact.lede)}</p>
      </div>
      <div class="contact-grid">
        <form id="brief" method="POST" action="https://api.web3forms.com/submit">
          <input type="hidden" name="access_key" value="${esc(WEB3FORMS_KEY)}">
          <input type="hidden" name="subject" value="Nowe zapytanie ze strony Skyshot Polska">
          <input type="hidden" name="from_name" value="Strona Skyshot Polska">
          <input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="row2">
            <div class="field">
              <label for="f-name">Imię i nazwisko</label>
              <input id="f-name" name="Imię i nazwisko" type="text" placeholder="Jan Kowalski" required>
            </div>
            <div class="field">
              <label for="f-contact">E-mail lub telefon</label>
              <input id="f-contact" name="Kontakt" type="text" placeholder="jan@firma.pl" required>
            </div>
          </div>
          <div class="row2">
            <div class="field">
              <label for="f-service">Rodzaj zlecenia</label>
              <select id="f-service" name="Rodzaj zlecenia">
${serviceOptionsHtml}
              </select>
            </div>
            <div class="field">
              <label for="f-place">Lokalizacja</label>
              <input id="f-place" name="Lokalizacja" type="text" placeholder="Białystok, Wysoki Stoczek" required>
            </div>
          </div>
          <div class="field">
            <label for="f-date">Planowany termin</label>
            <input id="f-date" name="Planowany termin" type="text" placeholder="np. druga połowa maja">
          </div>
          <div class="field">
            <label for="f-msg">Krótki opis</label>
            <textarea id="f-msg" name="Opis" placeholder="Co ma powstać i gdzie trafi materiał?"></textarea>
          </div>
          <button class="btn btn-primary" type="submit">${esc(
            contact.submitLabel
          )}</button>
          <p class="form-note" id="note" role="status" aria-live="polite">${esc(formNote)}</p>
        </form>

        <dl class="contact-info">
          <div class="ci"><dt>E-mail</dt><dd><a href="mailto:${esc(
            contact.email
          )}">${esc(contact.email)}</a></dd></div>
          <div class="ci"><dt>Telefon</dt><dd><a href="${esc(
            telHref(contact.phone)
          )}">${esc(contact.phone)}</a></dd></div>
          <div class="ci"><dt>Instagram</dt><dd><a href="${esc(
            contact.instagramUrl
          )}" target="_blank" rel="noopener">${esc(
  contact.instagram
)}</a></dd></div>
          <div class="ci"><dt>Baza</dt><dd>${esc(contact.base)}</dd></div>
          <div class="ci"><dt>Obszar realizacji</dt><dd class="ci-soft">${esc(
            contact.area
          )}</dd></div>
        </dl>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap foot-in">
    <img src="${esc(site.logo)}" alt="${esc(
  site.brandName
)}" width="317" height="260" loading="lazy">
    <div class="foot-meta">
      ${esc(site.footerTagline)}<br>
      ${esc(contact.email)} · ${esc(contact.phone)}<br>
      ${esc(site.footerRights)}
    </div>
  </div>
</footer>

<script>
(function(){
  var v = document.getElementById('heroVideo');
  var b = document.getElementById('heroToggle');
  if (!v) return;
  // Tryb oszczędzania danych w telefonie — zostaje samo zdjęcie
  if (navigator.connection && navigator.connection.saveData) { v.remove(); if (b) b.remove(); return; }

  var KEY = 'skyshotTloPauza';
  var store = {
    get: function(){ try { return localStorage.getItem(KEY) === '1'; } catch(e){ return false; } },
    set: function(on){ try { on ? localStorage.setItem(KEY,'1') : localStorage.removeItem(KEY); } catch(e){} }
  };
  var setState = function(playing){
    if (!b) return;
    b.hidden = false;
    b.dataset.state = playing ? 'playing' : 'paused';
    b.setAttribute('aria-label', playing ? 'Zatrzymaj film w tle' : 'Odtwórz film w tle');
    b.setAttribute('aria-pressed', playing ? 'false' : 'true');
  };

  var mobile = window.matchMedia('(max-width: 760px)').matches;
  var loaded = false;
  var start = function(){
    if (!loaded) { v.src = mobile ? v.dataset.srcMobile : v.dataset.src; loaded = true; }
    v.muted = true;
    var p = v.play();
    if (p && p.catch) p.catch(function(){ setState(false); });   // przeglądarka zablokowała autostart
  };

  v.addEventListener('playing', function(){ v.classList.add('is-playing'); setState(true); });
  v.addEventListener('pause', function(){ if (!v.ended) setState(false); });
  // zapętlenie: po końcu film zaczyna się od nowa
  v.addEventListener('ended', function(){ v.currentTime = 0; v.play(); });

  if (b) b.addEventListener('click', function(){
    if (v.paused) { store.set(false); start(); }
    else { store.set(true); v.pause(); }
  });

  if (store.get()) setState(false);   // odwiedzający wcześniej zatrzymał film
  else start();
})();
(function(){
  var form = document.getElementById('brief');
  var note = document.getElementById('note');
  var mail = ${JSON.stringify(contact.email)};
  if(!form) return;

  var thanks = 'Dziękujemy, zapytanie dotarło. Odezwiemy się w ciągu 24 godzin.';

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Wysyłanie…';

    var data = Object.fromEntries(new FormData(form));
    // Jeśli klient podał e-mail, odpowiedź z Gmaila trafi prosto do niego
    var kontakt = (data['Kontakt'] || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kontakt)) data.replyto = kontakt;

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r){ return r.json(); }).then(function(res){
      if (!res || !res.success) throw new Error(res && res.message);
      form.innerHTML = '<p class="form-done">' + thanks + '</p>';
    }).catch(function(){
      btn.disabled = false;
      btn.textContent = label;
      note.innerHTML = 'Nie udało się wysłać formularza. Napisz bezpośrednio na <a href="mailto:' + mail + '">' + mail + '</a>.';
    });
  });
})();
</script>
</body>
</html>
`;

/* ---------- zapis ---------- */

const dist = join(root, 'dist');
if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist, { recursive: true });

writeFileSync(join(dist, 'index.html'), html);
writeFileSync(join(dist, 'styles.css'), read(find('src/styles.css', 'styles.css')));

// Zdjęcia trafiają do dist/media niezależnie od tego, gdzie leżą w repozytorium.
const IMG = /\.(jpe?g|png|webp|svg|avif|gif|ico|mp4|webm)$/i;
const mediaOut = join(dist, 'media');
mkdirSync(mediaOut, { recursive: true });

let copied = 0;
for (const dir of ['media', '.']) {
  const from = join(root, dir);
  if (!existsSync(from)) continue;
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    if (!IMG.test(name) || !statSync(src).isFile()) continue;
    const target = join(mediaOut, basename(name));
    if (existsSync(target)) continue; // folder media ma pierwszeństwo
    copyFileSync(src, target);
    copied++;
  }
}

if (copied === 0) {
  console.warn('Uwaga: nie znaleziono żadnych zdjęć — strona wyświetli się bez grafik.');
}

writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}/sitemap.xml\n`
);
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site.siteUrl}/</loc><lastmod>${
    new Date().toISOString().split('T')[0]
  }</lastmod></url>
</urlset>
`
);

console.log('Strona zbudowana → dist/  (' + Math.round(html.length / 1024) + ' kB HTML)');
