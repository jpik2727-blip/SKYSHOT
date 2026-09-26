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
// Polityka prywatności — opcjonalna; bez pliku strona po prostu jej nie ma
let privacy = null;
try { privacy = json('polityka'); } catch (e) { privacy = null; }
const PRIVACY_URL = '/polityka-prywatnosci/';
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

/* ---------- mapa: kraje, w których latałem ---------- */
// mapa-swiata.svg — kontury państw; mapa-kraje.json — polskie nazwy, kontynenty
// i położenie punktów. Lista odwiedzonych krajów pochodzi z panelu (mapa.json).
let mapHtml = '';
{
  let mapData = null, svgRaw = null, meta = null;
  try { mapData = json('mapa'); } catch (e) { mapData = null; }
  const svgFile = pick('mapa-swiata.svg', 'media/mapa-swiata.svg');
  const metaFile = pick('mapa-kraje.json', 'media/mapa-kraje.json');
  if (mapData && svgFile && metaFile) {
    svgRaw = read(svgFile);
    meta = JSON.parse(read(metaFile));
  }
  if (mapData && svgRaw && meta) {
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
    const byName = {};
    for (const [code, m] of Object.entries(meta)) byName[norm(m.name)] = code;
    // skróty, które łatwo wpisać odruchowo
    Object.assign(byName, { zea: 'AE', emiraty: 'AE', usa: 'US', uk: 'GB', anglia: 'GB', czechy: 'CZ', 'republika czeska': 'CZ' });
    const isCam = (c) => /aparat|foto|zdj/i.test(String(c.type || ''));
    const LBL_DRONE = mapData.labelDrone || 'Realizacje z drona';
    const LBL_CAM = mapData.labelCam || 'Realizacje fotograficzne';
    const visited = [];
    for (const c of mapData.countries || []) {
      const code = byName[norm(c.name)];
      if (!code) { console.warn(`Mapa: nie rozpoznaję kraju „${c.name}” — sprawdź pisownię w panelu.`); continue; }
      const prev = visited.find((v) => v.code === code);
      if (prev) { if (!isCam(c)) prev.cam = false; continue; }   // dron „wygrywa” z aparatem
      visited.push({ ...meta[code], code, name: meta[code].name, photo: c.photo || '', cam: isCam(c) });
    }
    const codes = new Set(visited.map((v) => v.code));
    const camCodes = new Set(visited.filter((v) => v.cam).map((v) => v.code));
    const droneCount = visited.length - camCodes.size;
    const continents = [...new Set(visited.map((v) => v.continent).filter(Boolean))];

    // polska odmiana liczebników: 1 kraj, 2–4 kraje, 5+ krajów (12–14 → krajów)
    const plural = (n, one, few, many) => {
      if (n === 1) return one;
      const d = n % 10, t = n % 100;
      return d >= 2 && d <= 4 && !(t >= 12 && t <= 14) ? few : many;
    };

    const svgMarked = svgRaw
      .replace(/<\?xml[^>]*>\s*/, '')
      .replace('<svg ', '<svg class="world" role="img" aria-labelledby="mapTitle" preserveAspectRatio="xMidYMid meet" ')
      .replace(/<path data-c="([A-Z]{2})"/g, (m, c) => codes.has(c) ? `<path data-c="${c}" class="on${camCodes.has(c) ? ' cam' : ''}"` : m);
    // kropki: małe kraje (na mapie ledwo widoczne) i miejsca bez konturu
    const DOT_ALWAYS = new Set(['FJ', 'TW', 'SG', 'HK', 'MO', 'MT']);   // wyspy i małe kraje
    const dots = visited.filter((v) => v.small || v.dotOnly || DOT_ALWAYS.has(v.code))
      .map((v) => `<circle class="dot${v.cam ? ' cam' : ''}" data-c="${v.code}" cx="${v.cx}" cy="${v.cy}" r="3.6"/>`).join('');
    // baza: Białystok
    const homeAttr = (/data-home="([\d.]+) ([\d.]+)"/.exec(svgRaw) || []);
    const [bx, by] = homeAttr[1] ? [+homeAttr[1], +homeAttr[2]] : [meta.PL ? meta.PL.cx + 6 : 0, meta.PL ? meta.PL.cy - 4 : 0];
    const home = meta.PL
      ? `<defs><radialGradient id="homeGlow"><stop offset="0" stop-color="#FF4141" stop-opacity=".45"/><stop offset="1" stop-color="#FF4141" stop-opacity="0"/></radialGradient></defs><g class="home" transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><circle class="home-glow" r="26"/><circle class="home-pulse" r="7"/><circle class="home-dot" r="3.4"/></g>`
      : '';
    // łuki „przelotów” z bazy do krajów z dronem
    const arcs = meta.PL ? visited.filter((v) => !v.cam && Math.hypot(v.cx - bx, v.cy - by) > 45).map((v, i) => {
      const dx = v.cx - bx, dy = v.cy - by, dist = Math.hypot(dx, dy);
      const lift = Math.min(90, 14 + dist * 0.22);
      const mx = (bx + v.cx) / 2, my = (by + v.cy) / 2 - lift;
      const len = Math.round(dist * 1.15 + lift);
      return `<path class="arc" style="--len:${len};--i:${i}" d="M${bx.toFixed(1)} ${by.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${v.cx} ${v.cy}"/>`;
    }).join('') : '';
    const svg = svgMarked.replace('</svg>', `<g class="arcs">${arcs}</g><g class="dots">${dots}</g>${home}</svg>`);

    const groups = continents.map((ct) => `
          <div class="map-group">
            <p class="map-group-t">${esc(ct)}</p>
            <div class="chips">${visited.filter((v) => v.continent === ct)
              .map((v) => `<button type="button" class="chip${v.cam ? ' cam' : ''}" data-c="${v.code}">${esc(v.name)}</button>`).join('')}</div>
          </div>`).join('');

    const vb = (/viewBox="([\d.\s-]+)"/.exec(svgRaw) || [, '0 0 1000 500'])[1].split(/\s+/).map(Number);
    const tipData = Object.fromEntries(visited.map((v) => [v.code, { n: v.name, p: v.photo, k: v.cam ? LBL_CAM : LBL_DRONE, x: +(v.cx / vb[2]).toFixed(4), y: +(v.cy / vb[3]).toFixed(4) }]));

    mapHtml = `
  <section id="mapa" class="map-sec">
    <div class="wrap">
      <div class="sec-head">
        <p class="eyebrow">${esc(mapData.eyebrow || 'Gdzie latałem')}</p>
        <h2 id="mapTitle">${esc(mapData.heading || '')}</h2>
        ${mapData.lede ? `<p class="lede">${esc(mapData.lede)}</p>` : ''}
      </div>
      <div class="map-stats">
        <div class="ms"><b>${visited.length}</b><span>${plural(visited.length, 'kraj', 'kraje i regiony', 'krajów i regionów')}</span></div>
        ${camCodes.size ? `<div class="ms"><b>${droneCount}</b><span>z dronem</span></div>` : ''}
        <div class="ms"><b>${continents.length}</b><span>${plural(continents.length, 'kontynent', 'kontynenty', 'kontynentów')}</span></div>
        <div class="ms"><b class="ms-home">●</b><span>Baza: ${esc(mapData.base || 'Białystok')}</span></div>
      </div>
      <div class="map-box">
        ${svg}
        <div class="map-tip" id="mapTip" hidden><img alt="" hidden><span></span><small></small></div>
      </div>
      ${camCodes.size ? `<div class="map-legend"><span class="lg lg-dron">${esc(LBL_DRONE)}</span><span class="lg lg-cam">${esc(LBL_CAM)}</span>${arcs ? `<span class="lg lg-arc">Przeloty z bazy</span>` : ''}<span class="lg lg-home">Baza: ${esc(mapData.base || 'Białystok')}</span></div>` : ''}
      <div class="map-list">${groups}
      </div>
    </div>
    <script type="application/json" id="mapData">${JSON.stringify(tipData).replace(/</g, '\\u003c')}</script>
  </section>`;
  }
}

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

/* ---------- czcionki ---------- */
// Pliki .woff2 (np. sora-latin-600-normal.woff2) wgrane do repozytorium są
// podawane z własnego serwera. Jeśli ich brak, strona używa Google Fonts.
const FONT_FAMILIES = { sora: 'Sora', barlow: 'Barlow', 'ibm-plex-mono': 'IBM Plex Mono' };
const UNICODE = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};
const FONT_RE = /^(sora|barlow|ibm-plex-mono)-(latin-ext|latin)-(\d{3})-normal(?:_\d+| \(\d+\))?\.woff2$/i;
const fontFiles = {};   // docelowa nazwa → plik w repozytorium
for (const dir of ['fonts', 'media', '.']) {
  const from = join(root, dir);
  if (!existsSync(from)) continue;
  for (const f of readdirSync(from)) {
    const m = FONT_RE.exec(f);
    if (!m || !statSync(join(from, f)).size) continue;
    const clean = `${m[1].toLowerCase()}-${m[2].toLowerCase()}-${m[3]}-normal.woff2`;
    if (!fontFiles[clean]) fontFiles[clean] = join(dir, f);
  }
}
const localFonts = Object.keys(fontFiles).length > 0;
const fontFaceCss = Object.keys(fontFiles).sort().map((clean) => {
  const [, fam, subset, weight] = FONT_RE.exec(clean);
  return `@font-face{font-family:"${FONT_FAMILIES[fam]}";font-style:normal;font-weight:${weight};font-display:swap;src:url(/fonts/${clean}) format("woff2");unicode-range:${UNICODE[subset]}}`;
}).join('\n');
// Czcionki najważniejsze dla pierwszego widoku ładujemy od razu
const fontPreload = ['sora-latin-600-normal.woff2', 'barlow-latin-400-normal.woff2']
  .filter((f) => fontFiles[f])
  .map((f) => `<link rel="preload" href="/fonts/${f}" as="font" type="font/woff2" crossorigin>`)
  .join('\n');
const fontHead = localFonts
  ? `${fontPreload}\n<style>\n${fontFaceCss}\n</style>`
  : `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Barlow:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">`;

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
${fontHead}
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
    <div class="nav-left">
      <button type="button" class="burger" id="burger" aria-label="Otwórz menu" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
      <a class="brand" href="#top"><img src="${esc(site.logo)}" alt="${esc(
  site.brandName
)}" width="317" height="260"></a>
    </div>
    <nav class="nav-links">
${navHtml}
    </nav>
    <a class="nav-cta" href="#kontakt">${esc(site.navCta)}</a>
  </div>
  <nav class="mobile-menu" id="mobileMenu" aria-label="Menu" hidden>
    <div class="wrap mm-in">
      <p class="mm-eyebrow">Menu</p>
      <div class="mm-links">
${(site.nav || []).map((l, i) => `        <a href="${esc(l.href)}" style="--d:${i}"><span class="mm-l">${esc(l.label)}</span><svg class="mm-arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a>`).join('\n')}
      </div>
      <a class="mm-cta" href="#kontakt" style="--d:${(site.nav || []).length}">${esc(site.navCta)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a>
      <div class="mm-foot" style="--d:${(site.nav || []).length + 1}">
        ${contact.phone ? `<a href="${esc(telHref(contact.phone))}">${esc(contact.phone)}</a>` : ''}
        ${contact.email ? `<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : ''}
      </div>
    </div>
  </nav>
</header>
<div class="mm-veil" id="mmVeil" hidden></div>

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
      <div class="grid" id="workTrack">
${workHtml}
      </div>
      <div class="car-ui" aria-hidden="true">
        <div class="car-dots">${(work.items || []).map((_, i) => `<button type="button" tabindex="-1" data-i="${i}"></button>`).join('')}</div>
        <div class="car-count"><b>01</b> / ${String((work.items || []).length).padStart(2, '0')}</div>
      </div>
    </div>
  </section>

${mapHtml}

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
          <p class="form-note" id="note" role="status" aria-live="polite">${esc(formNote)}${
            privacy ? ` Szczegóły w <a href="${PRIVACY_URL}">polityce prywatności</a>.` : ''
          }</p>
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
      ${esc(site.footerRights)}${
        privacy ? `<br><a class="foot-link" href="${PRIVACY_URL}">Polityka prywatności</a>` : ''
      }
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
  // Menu na telefonie: trzy kreski obok logo
  var btn = document.getElementById('burger'), menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;
  var veil = document.getElementById('mmVeil'), timer = null;
  var isOpen = function(){ return btn.getAttribute('aria-expanded') === 'true'; };
  var set = function(open){
    if (open === isOpen()) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
    document.body.classList.toggle('menu-open', open);
    clearTimeout(timer);
    if (open) {
      menu.hidden = false; if (veil) veil.hidden = false;
      menu.classList.remove('closing');
      menu.offsetHeight;   // start animacji od stanu zamkniętego
      menu.classList.add('open');
    } else {
      menu.classList.add('closing'); menu.classList.remove('open');
      timer = setTimeout(function(){ menu.hidden = true; menu.classList.remove('closing'); if (veil) veil.hidden = true; }, 420);
    }
  };
  btn.addEventListener('click', function(){ set(!isOpen()); });
  menu.addEventListener('click', function(e){
    var a = e.target.closest('a'); if (!a) return;
    var href = a.getAttribute('href') || '';
    var target = href.charAt(0) === '#' && document.querySelector(href);
    set(false);
    if (target) {
      // najpierw menu płynnie się chowa, potem strona przewija się do sekcji
      e.preventDefault();
      setTimeout(function(){ target.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', href); }, 220);
    }
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') set(false); });
  document.addEventListener('click', function(e){ if (!e.target.closest('header.nav') && isOpen()) set(false); });
  window.addEventListener('resize', function(){ if (innerWidth > 900) set(false); });
})();
(function(){
  // Mapa: podpis z nazwą kraju (i zdjęciem, jeśli jest) po najechaniu lub dotknięciu
  var box = document.querySelector('.map-box');
  var dataEl = document.getElementById('mapData');
  if (!box || !dataEl) return;
  var data = JSON.parse(dataEl.textContent);
  var tip = document.getElementById('mapTip'), tipImg = tip.querySelector('img'), tipTxt = tip.querySelector('span'), tipKind = tip.querySelector('small');
  var current = null;
  var mark = function(code, on){
    box.querySelectorAll('[data-c="' + code + '"]').forEach(function(el){ el.classList.toggle('hl', on); });
    document.querySelectorAll('.chip[data-c="' + code + '"]').forEach(function(el){ el.classList.toggle('hl', on); });
  };
  var svgEl = box.querySelector('svg.world');
  var place = function(code){
    // podpis nad środkiem kraju (współrzędne względne z generatora)
    var s = svgEl.getBoundingClientRect(), b = box.getBoundingClientRect(), d = data[code];
    var x = s.left - b.left + d.x * s.width, y = s.top - b.top + d.y * s.height;
    tip.style.left = Math.min(Math.max(x, 80), b.width - 80) + 'px';
    tip.style.top = Math.max(y - 6, tip.offsetHeight + 16) + 'px';
  };
  var show = function(code){
    if (!data[code]) return hide();
    if (current && current !== code) mark(current, false);
    current = code; mark(code, true);
    tipTxt.textContent = data[code].n;
    tipKind.textContent = data[code].k || '';
    if (data[code].p) { tipImg.src = data[code].p; tipImg.hidden = false; } else { tipImg.hidden = true; tipImg.removeAttribute('src'); }
    tip.hidden = false; place(code);
  };
  var hide = function(){ if (current) mark(current, false); current = null; tip.hidden = true; };
  box.addEventListener('mouseover', function(e){ var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c && data[c]) show(c); });
  box.addEventListener('mouseleave', hide);
  box.addEventListener('click', function(e){ var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (c && data[c]) show(c); else hide(); });
  document.querySelectorAll('.chip').forEach(function(ch){
    var c = ch.getAttribute('data-c');
    ch.addEventListener('mouseenter', function(){ show(c); });
    ch.addEventListener('focus', function(){ show(c); });
    ch.addEventListener('mouseleave', hide);
    ch.addEventListener('blur', hide);
    ch.addEventListener('click', function(){ show(c); });
  });
  window.addEventListener('resize', function(){ if (current) place(current); });
  // łuki rysują się, gdy mapa pojawi się na ekranie
  var arcs = box.querySelector('.arcs');
  if (arcs && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    arcs.style.visibility = 'hidden';
    var io = new IntersectionObserver(function(en){
      if (en[0].isIntersecting) { arcs.style.visibility = ''; arcs.classList.add('anim'); io.disconnect(); }
    }, { threshold: .35 });
    io.observe(box);
  }
})();
(function(){
  // Realizacje na telefonie: przesuwana karuzela z przyciąganiem
  var track = document.getElementById('workTrack');
  if (!track) return;
  var slides = [].slice.call(track.children);
  var dots = [].slice.call(document.querySelectorAll('.car-dots button'));
  var count = document.querySelector('.car-count b');
  var mq = matchMedia('(max-width: 820px)');
  var active = -1, raf = 0;
  var setActive = function(i){
    if (i === active) return; active = i;
    slides.forEach(function(s, k){ s.classList.toggle('is-active', k === i); });
    dots.forEach(function(d, k){ d.classList.toggle('on', k === i); });
    if (count) count.textContent = String(i + 1).padStart(2, '0');
  };
  var measure = function(){
    raf = 0;
    if (!mq.matches) return;
    var mid = track.getBoundingClientRect().left + track.clientWidth / 2, best = 0, bestD = Infinity;
    slides.forEach(function(s, k){ var r = s.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < bestD) { bestD = d; best = k; } });
    setActive(best);
  };
  var go = function(i){
    var s = slides[i]; if (!s) return;
    track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2, behavior: 'smooth' });
  };
  track.addEventListener('scroll', function(){ if (!raf) raf = requestAnimationFrame(measure); }, { passive: true });
  window.addEventListener('resize', function(){ active = -1; measure(); });
  dots.forEach(function(d){ d.addEventListener('click', function(){ go(+d.getAttribute('data-i')); }); });
  // dotknięcie bocznego zdjęcia najpierw je przyciąga, dopiero aktywne otwiera podgląd
  track.addEventListener('click', function(e){
    if (!mq.matches) return;
    var f = e.target.closest('figure'); if (!f) return;
    var i = slides.indexOf(f);
    if (i !== active) { e.stopPropagation(); e.preventDefault(); go(i); }
  }, true);
  measure();
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

/* ---------- polityka prywatności: osobna podstrona ---------- */

// Prosty zapis tekstu z panelu: pusta linia = nowy akapit, „- ” = punkt listy
const richText = (text = '') =>
  String(text)
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return '';
      if (lines.every((l) => /^[-•]\s+/.test(l)))
        return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^[-•]\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    })
    .join('\n');

const privacyHtml = privacy && `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(privacy.heading)} · ${esc(site.brandName)}</title>
<meta name="description" content="${esc(privacy.intro || '')}">
<link rel="canonical" href="${esc(site.siteUrl + PRIVACY_URL)}">
<meta name="theme-color" content="#0A0A0C">
<link rel="icon" href="${esc(site.logo)}">
${fontHead}
<link rel="stylesheet" href="/styles.css">
<style>
.legal-top{padding-top:clamp(40px,6vw,72px);padding-bottom:28px;border-bottom:1px solid var(--line)}
.legal-top h1{font-size:clamp(34px,4.6vw,56px);letter-spacing:-.02em;margin:16px 0 14px}
.legal-top .lede{max-width:60ch}
.legal-meta{margin-top:16px;font-size:14px;color:var(--muted-dim)}
.legal{display:grid;grid-template-columns:260px 1fr;gap:clamp(28px,5vw,72px);padding-top:clamp(36px,5vw,64px);padding-bottom:clamp(56px,7vw,96px);align-items:start}
.toc{position:sticky;top:96px;display:flex;flex-direction:column;gap:2px;font-size:15px}
.toc a{color:var(--muted);text-decoration:none;padding:7px 12px;border-radius:10px;transition:background .2s,color .2s}
.toc a:hover{color:var(--text);background:rgba(255,255,255,.06)}
.legal-body{max-width:70ch}
.legal-body section{padding:0 0 34px;border:0}
.legal-body h2{font-size:clamp(20px,2vw,24px);margin:0 0 12px;scroll-margin-top:96px}
.legal-body p,.legal-body li{color:var(--muted);font-size:16.5px;line-height:1.7}
.legal-body p+p,.legal-body p+ul,.legal-body ul+p{margin-top:12px}
.legal-body ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}
.legal-body li::marker{color:var(--accent-hi)}
.legal-body a{color:var(--text)}
.controller{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px 22px}
.controller p{color:var(--text)}
.back{display:inline-flex;align-items:center;gap:8px;color:var(--muted);text-decoration:none;font-weight:500;font-size:15px}
.back:hover{color:var(--text)}
@media(max-width:860px){.legal{grid-template-columns:1fr}.toc{position:static;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:10px}.toc a{padding:8px 10px}}
</style>
</head>
<body>
<header class="nav">
  <div class="wrap nav-in">
    <a class="brand" href="/"><img src="${esc(site.logo)}" alt="${esc(site.brandName)}" width="317" height="260"></a>
    <a class="back" href="/">← Wróć na stronę główną</a>
  </div>
</header>
<main>
  <div class="wrap legal-top">
    <p class="eyebrow">Dokumenty</p>
    <h1>${esc(privacy.heading)}</h1>
    <p class="lede">${esc(privacy.intro || '')}</p>
    ${privacy.updated ? `<p class="legal-meta">Ostatnia aktualizacja: ${esc(privacy.updated)}</p>` : ''}
  </div>
  <div class="wrap legal">
    <nav class="toc" aria-label="Spis treści">
      <a href="#administrator">Administrator danych</a>
${list(privacy.sections || [], (s, i) => `      <a href="#p${i + 1}">${esc(s.title)}</a>`)}
    </nav>
    <div class="legal-body">
      <section id="administrator">
        <h2>Administrator danych</h2>
        <div class="controller">
          <p>Administratorem Twoich danych osobowych jest <strong>${esc(privacy.administrator)}</strong>${
            privacy.brand ? `, działający pod marką ${esc(privacy.brand)}` : ''
          }.</p>
          ${privacy.companyDetails ? richText(privacy.companyDetails) : ''}
          <p>Kontakt w sprawach danych osobowych: <a href="mailto:${esc(privacy.email)}">${esc(privacy.email)}</a></p>
        </div>
      </section>
${list(privacy.sections || [], (s, i) => `      <section id="p${i + 1}">
        <h2>${esc(s.title)}</h2>
        ${richText(s.text)}
      </section>`)}
    </div>
  </div>
</main>
<footer>
  <div class="wrap foot-in">
    <img src="${esc(site.logo)}" alt="${esc(site.brandName)}" width="317" height="260" loading="lazy">
    <div class="foot-meta">
      ${esc(site.footerTagline)}<br>
      ${esc(contact.email)} · ${esc(contact.phone)}<br>
      ${esc(site.footerRights)}
    </div>
  </div>
</footer>
</body>
</html>
`;


/* ---------- zapis ---------- */

const dist = join(root, 'dist');
if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist, { recursive: true });

writeFileSync(join(dist, 'index.html'), html);
if (privacyHtml) {
  mkdirSync(join(dist, 'polityka-prywatnosci'), { recursive: true });
  writeFileSync(join(dist, 'polityka-prywatnosci', 'index.html'), privacyHtml);
}
let stylesCss = read(pick('src/styles.css', 'styles.css') || find('src/styles.css', 'styles.css'));
if (localFonts) {
  // czcionki są lokalne — odwołanie do Google Fonts w stylach jest zbędne
  stylesCss = stylesCss.replace(/@import\s+url\(["']?https:\/\/fonts\.googleapis\.com[^)]*\)\s*;?\s*/g, '');
  mkdirSync(join(dist, 'fonts'), { recursive: true });
  for (const [clean, src] of Object.entries(fontFiles)) copyFileSync(join(root, src), join(dist, 'fonts', clean));
}
writeFileSync(join(dist, 'styles.css'), stylesCss);

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
  }</lastmod></url>${
    privacyHtml ? `\n  <url><loc>${site.siteUrl}${PRIVACY_URL}</loc></url>` : ''
  }
</urlset>
`
);

console.log('Strona zbudowana → dist/  (' + Math.round(html.length / 1024) + ' kB HTML)' +
  (privacyHtml ? ' + polityka prywatności' : '') +
  (localFonts ? ` · czcionki lokalne: ${Object.keys(fontFiles).length}` : ' · czcionki: Google Fonts'));
