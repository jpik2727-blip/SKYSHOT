/**
 * Generator strony Skyshot Polska.
 * Czyta treść z src/content/*.json, szablon stylów z src/styles.css
 * i zapisuje gotową stronę do katalogu dist/.
 *
 * Uruchomienie lokalne:  node build.mjs
 * Na Netlify uruchamia się automatycznie (patrz netlify.toml).
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (name) => JSON.parse(read(`src/content/${name}.json`));

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
      <img src="${esc(hero.image)}" alt="${esc(
  hero.imageAlt
)}" fetchpriority="high" decoding="async">
    </div>
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
        <form id="brief">
          <div class="row2">
            <div class="field">
              <label for="f-name">Imię i nazwisko</label>
              <input id="f-name" name="name" type="text" placeholder="Jan Kowalski" required>
            </div>
            <div class="field">
              <label for="f-contact">E-mail lub telefon</label>
              <input id="f-contact" name="contact" type="text" placeholder="jan@firma.pl" required>
            </div>
          </div>
          <div class="row2">
            <div class="field">
              <label for="f-service">Rodzaj zlecenia</label>
              <select id="f-service" name="service">
${serviceOptionsHtml}
              </select>
            </div>
            <div class="field">
              <label for="f-place">Lokalizacja</label>
              <input id="f-place" name="place" type="text" placeholder="Białystok, Wysoki Stoczek" required>
            </div>
          </div>
          <div class="field">
            <label for="f-date">Planowany termin</label>
            <input id="f-date" name="date" type="text" placeholder="np. druga połowa maja">
          </div>
          <div class="field">
            <label for="f-msg">Krótki opis</label>
            <textarea id="f-msg" name="msg" placeholder="Co ma powstać i gdzie trafi materiał?"></textarea>
          </div>
          <button class="btn btn-primary" type="submit">${esc(
            contact.submitLabel
          )}</button>
          <p class="form-note" id="note">${esc(contact.formNote)}</p>
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
  var form = document.getElementById('brief');
  var note = document.getElementById('note');
  var mail = ${JSON.stringify(contact.email)};
  if(!form) return;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var v = function(id){ return (document.getElementById(id).value || '—').trim(); };
    var subject = 'Zapytanie o wycenę — ' + v('f-service') + ' · ' + v('f-place');
    var body = [
      'Imię i nazwisko: ' + v('f-name'),
      'Kontakt: ' + v('f-contact'),
      'Rodzaj zlecenia: ' + v('f-service'),
      'Lokalizacja: ' + v('f-place'),
      'Planowany termin: ' + v('f-date'),
      '',
      'Opis:',
      v('f-msg')
    ].join('\\n');
    window.location.href = 'mailto:' + mail
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
    note.textContent = 'Otwieramy program pocztowy. Jeśli nic się nie stało, napisz na ' + mail;
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
writeFileSync(join(dist, 'styles.css'), read('src/styles.css'));
cpSync(join(root, 'media'), join(dist, 'media'), { recursive: true });

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
