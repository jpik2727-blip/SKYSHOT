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
// Przeglądarka i GitHub dopisują do nazw „ (1)” albo „_1”, gdy plik o tej nazwie
// już istnieje. variant() znajduje najnowszą taką wersję, więc nazwa pliku
// przy wgrywaniu przestaje mieć znaczenie.
const variant = (rel) => {
  const dir = dirname(rel) === '.' ? '' : dirname(rel) + '/';
  const ext = extname(rel);
  const base = basename(rel, ext);
  const full = join(root, dir || '.');
  if (!existsSync(full)) return null;
  const re = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:_(\\d+)| \\((\\d+)\\))' + ext.replace('.', '\\.') + '$');
  let best = null, bestN = -1;
  for (const f of readdirSync(full)) {
    const m = re.exec(f);
    if (!m) continue;
    const n = Number(m[1] || m[2]);
    if (n > bestN && statSync(join(full, f)).size > 0) { bestN = n; best = dir + f; }
  }
  return best;
};
// Zwraca plik do użycia. Wersja z dopiskiem („_2”, „ (3)”) powstaje przy pobieraniu
// nowszego pliku, więc ma pierwszeństwo przed dokładną nazwą; z kilku wariantów
// wygrywa najwyższy numer.
const pick = (...candidates) => {
  for (const c of candidates) {
    const v = variant(c);
    if (v) return v;
    if (existsSync(join(root, c)) && statSync(join(root, c)).size > 0) return c;
  }
  return null;
};

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
// FAQ jest opcjonalne — jeśli pliku nie ma, sekcja się nie pokazuje
let faq = null;
try { faq = json('faq'); } catch (e) { faq = null; }

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

// Link do Instagrama: jeśli w panelu jest sam adres instagram.com,
// budujemy link do profilu z nazwy konta.
const instaHandle = String(contact.instagram || '').replace(/^@/, '').trim();
const instaUrl = (() => {
  const u = String(contact.instagramUrl || '').trim();
  const bare = !u || /^https?:\/\/(www\.)?instagram\.com\/?$/i.test(u);
  return bare && instaHandle ? `https://instagram.com/${instaHandle}` : u;
})();

// WhatsApp: numer z pola „whatsapp” w panelu, a gdy go brak — numer telefonu.
// Wpisz w panelu „-”, żeby ukryć przycisk WhatsApp.
const waRaw = contact.whatsapp === undefined ? contact.phone : contact.whatsapp;
const waNumber = String(waRaw || '').trim() === '-' ? '' : String(waRaw || '').replace(/\D/g, '');
const waHref = waNumber
  ? `https://wa.me/${waNumber}?text=${encodeURIComponent('Dzień dobry, piszę ze strony Skyshot Polska w sprawie zlecenia.')}`
  : '';

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

// Ikony usług (rysowane liniami, kolor bierze się ze stylu)
const ICONS = {
  TUR: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  NRH: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  INS: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
  _: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
};
// Ikona dobierana po skrócie (jeśli jest) albo po nazwie usługi
const iconKey = (s) => {
  const code = String(s.code || '').toUpperCase();
  if (ICONS[code]) return code;
  const t = String(s.title || '').toLowerCase();
  if (/turyst|hotel|nocleg|agrotur/.test(t)) return 'TUR';
  if (/nieruch|inwest|dom|dewelop|dział/.test(t)) return 'NRH';
  if (/inspek|dokument|dach|budow/.test(t)) return 'INS';
  return '_';
};
const icon = (s) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${
    ICONS[iconKey(s)]
  }</svg>`;

const servicesHtml = list(
  services.items,
  (s) => `        <article class="svc">
          <span class="svc-icon" aria-hidden="true">${icon(s)}</span>
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
          <div class="step-n" aria-label="Krok ${i + 1}">${i + 1}</div>
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
const mediaSources = {};   // nazwa docelowa → faktyczny plik w repozytorium
const mediaFile = (name) => {
  const hit = pick('media/' + name, name);
  if (!hit) return '';
  mediaSources[name] = hit;
  return '/media/' + name;
};
const heroVideo = hero.video || mediaFile('tlo.mp4');
const heroVideoMobile = hero.videoMobile || mediaFile('tlo-mobile.mp4') || heroVideo;
const heroPoster = mediaFile('tlo-poster.jpg') || hero.image;

const WEB3FORMS_KEY = contact.web3formsKey || 'c57b8f83-4534-4ae3-a3b3-d3e49eb246c4';

const formNote = /program pocztowy/i.test(contact.formNote || '')
  ? 'Odpowiadamy w ciągu 24 godzin. Dane z formularza wykorzystujemy wyłącznie do odpowiedzi na zapytanie.'
  : contact.formNote;

const faqHtml = faq && (faq.items || []).length
  ? `
  <section id="faq" class="faq">
    <div class="wrap faq-in">
      <div class="sec-head">
        <p class="eyebrow">${esc(faq.eyebrow || 'Pytania i odpowiedzi')}</p>
        <h2>${esc(faq.heading || 'Najczęstsze pytania')}</h2>
      </div>
      <div class="faq-list">
${list(faq.items, (f, i) => `        <details class="faq-item"${i === 0 ? ' open' : ''}>
          <summary>${esc(f.q)}</summary>
          <div class="faq-a"><p>${esc(f.a)}</p></div>
        </details>`)}
      </div>
    </div>
  </section>`
  : '';

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
/* Lżejsze przyciemnienie: mocne tylko pod tekstem, reszta filmu w pełnych kolorach */
.hero-media::after{background:
  linear-gradient(90deg,rgba(8,8,10,.80) 0%,rgba(8,8,10,.58) 30%,rgba(8,8,10,.14) 58%,rgba(8,8,10,0) 100%),
  linear-gradient(180deg,rgba(10,10,12,.40) 0%,rgba(10,10,12,0) 20%,rgba(10,10,12,0) 72%,var(--ground) 100%)}
.hero-video{filter:saturate(1.06) contrast(1.03)}
.hero h1,.hero .lede,.hero .eyebrow{text-shadow:0 2px 22px rgba(0,0,0,.45)}
@media(max-width:820px){
  .hero-media::after{background:
    linear-gradient(180deg,rgba(10,10,12,.48) 0%,rgba(10,10,12,.28) 30%,rgba(10,10,12,.42) 62%,var(--ground) 100%)}
  .hero h1,.hero .lede,.hero .eyebrow{text-shadow:0 2px 16px rgba(0,0,0,.6)}
}
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
<script type="application/ld+json">${JSON.stringify(schema)}</script>${
  faq && (faq.items || []).length
    ? `\n<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.items.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      })}</script>`
    : ''
}
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

${faqHtml}

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
            instaUrl
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

<nav class="quickbar" aria-label="Szybki kontakt">
  <a class="qb qb-call" href="${esc(telHref(contact.phone))}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    Zadzwoń
  </a>${waHref ? `
  <a class="qb qb-wa" href="${esc(waHref)}" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.01c-.24.68-1.41 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.46.24.55.79 1.9.86 2.04.07.14.11.3.02.48-.09.18-.14.3-.27.45-.14.16-.29.36-.41.48-.14.14-.28.28-.12.56.16.27.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.21 1.37.27.14.43.11.59-.07.16-.18.68-.8.87-1.07.18-.27.36-.23.61-.14.25.09 1.59.75 1.86.89.27.14.45.2.52.32.07.11.07.66-.17 1.34z"/></svg>
    WhatsApp
  </a>` : ''}
</nav>

<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Podgląd zdjęcia" hidden>
  <button class="lb-btn lb-close" type="button" aria-label="Zamknij podgląd">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
  </button>
  <button class="lb-btn lb-prev" type="button" aria-label="Poprzednie zdjęcie">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
  </button>
  <figure class="lb-fig">
    <img class="lb-img" alt="">
    <figcaption class="lb-cap"></figcaption>
  </figure>
  <button class="lb-btn lb-next" type="button" aria-label="Następne zdjęcie">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
  </button>
</div>

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
  // Podgląd zdjęć z realizacji na pełnym ekranie
  var lb = document.getElementById('lightbox');
  var figs = [].slice.call(document.querySelectorAll('#realizacje figure'));
  if (!lb || !figs.length) return;
  var img = lb.querySelector('.lb-img'), cap = lb.querySelector('.lb-cap');
  var idx = 0, lastFocus = null, startX = null;
  var show = function(i){
    idx = (i + figs.length) % figs.length;
    var src = figs[idx].querySelector('img');
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    var place = figs[idx].querySelector('.cap-place');
    cap.textContent = place ? place.textContent : '';
  };
  var open = function(i){
    lastFocus = document.activeElement;
    show(i); lb.hidden = false; document.body.classList.add('lb-open');
    lb.querySelector('.lb-close').focus();
  };
  var close = function(){
    lb.hidden = true; document.body.classList.remove('lb-open');
    if (lastFocus) lastFocus.focus();
  };
  figs.forEach(function(f, i){
    f.tabIndex = 0; f.setAttribute('role', 'button');
    f.setAttribute('aria-label', 'Powiększ zdjęcie: ' + (f.querySelector('.cap-place') || {}).textContent);
    f.addEventListener('click', function(){ open(i); });
    f.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
  });
  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-prev').addEventListener('click', function(){ show(idx - 1); });
  lb.querySelector('.lb-next').addEventListener('click', function(){ show(idx + 1); });
  lb.addEventListener('click', function(e){ if (e.target === lb) close(); });
  document.addEventListener('keydown', function(e){
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
  lb.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function(e){
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX; startX = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  });
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
writeFileSync(join(dist, 'styles.css'), read(pick('src/styles.css', 'styles.css') || find('src/styles.css', 'styles.css')));

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

// Filmy i kadr startowy wgrane z dopiskiem w nazwie trafiają pod właściwą nazwą
for (const [name, src] of Object.entries(mediaSources)) {
  copyFileSync(join(root, src), join(mediaOut, name));
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
