/* Cinick — PWA sin dependencias. */

const $ = (sel) => document.querySelector(sel);

const grid       = $('#grid');
const searchEl   = $('#search');
const clearEl    = $('#btn-clear');
const chipsEl    = $('#chips-section');
const decadeEl   = $('#filter-decade');
const movementEl = $('#filter-movement');
const genreEl    = $('#filter-genre');
const sortEl     = $('#sort');
const countEl    = $('#count');
const emptyEl    = $('#empty');
const sheet      = $('#sheet');
const sheetBody  = $('#sheet-body');
const lightbox   = $('#lightbox');
const lightboxImg = $('#lightbox-img');

/* Los pósters se piden al CDN de TMDb, no viajan dentro de la app: así no se
   rehospeda material ajeno. w342 basta para las tarjetas (170 px) y para la
   ficha (104 px) incluso en pantallas de alta densidad; w780 se pide sólo
   al ampliar el póster en el visor de pantalla completa. */
const IMG_BASE   = 'https://image.tmdb.org/t/p/w342';
const IMG_BASE_XL = 'https://image.tmdb.org/t/p/w780';
const posterURL = (path) => IMG_BASE + path;

function openLightbox(path, alt) {
  // el <img> del visor se reutiliza entre pósters: si no se limpia antes,
  // sigue enseñando el póster anterior los primeros instantes mientras
  // carga el nuevo.
  lightboxImg.removeAttribute('src');
  lightboxImg.alt = alt;
  lightboxImg.src = IMG_BASE_XL + path;
  lightbox.showModal();
}
lightbox.addEventListener('click', () => lightbox.close());

let WORKS = [];
let SECTIONS = {};
const state = { q: '', section: 'PELICULAS', decade: 'ALL', movement: 'ALL', genre: 'ALL', award: 'ALL', sort: 'year-asc' };

/* Búsqueda insensible a acentos y mayúsculas. */
const norm = (s) => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ---------------- premios ----------------
   El campo "p" es texto libre ("Oscar Mejor Película 1994", "Palma de Oro
   Cannes 2019; Oscar Mejor Película"...). "Nominada" es el único patrón del
   dataset que marca una candidatura sin victoria (marco plata); cualquier
   otra mención de "Oscar" se trata como victoria (marco dorado). */
function parseAwards(p) {
  const t = p || '';
  const oscarNom  = /^nominad/i.test(t.trim());
  const oscarWin  = /oscar/i.test(t) && !oscarNom;
  const palmaOro  = /palma de oro/i.test(t);
  const cannesWin = /cannes/i.test(t) && !palmaOro;
  const globoOro  = /globo de oro/i.test(t);
  return { oscarWin, oscarNom, palmaOro, cannesWin, globoOro };
}

/* Nota de TMDB dentro de "sc" ("TMDB 8.0"); null si no hay dato.
   IMDB/FilmAffinity/Rotten Tomatoes no tienen API pública gratuita, así
   que no hay forma legítima de rellenarlas en bloque; TMDB sí. */
function parseTmdbScore(sc) {
  const m = /TMDB\s+([\d.]+)/i.exec(sc || '');
  return m ? parseFloat(m[1]) : null;
}

/* ---------------- carga ---------------- */
let PROVIDERS = {};
async function init() {
  const [res, provRes] = await Promise.all([
    fetch('data.json'),
    fetch('providers.json').catch(() => null),
  ]);
  const data = await res.json();
  PROVIDERS = provRes && provRes.ok ? await provRes.json() : {};
  SECTIONS = data.sections;
  WORKS = data.works.map((w) => {
    const aw = parseAwards(w.p);
    return {
      ...w,
      _hay: norm([w.t, w.d, w.c, w.g, w.m, w.y].join(' ')),
      _t: norm(w.t),
      _d: norm(w.d),
      _aw: aw,
      _hasAward: aw.oscarWin || aw.oscarNom || aw.palmaOro || aw.cannesWin || aw.globoOro,
      _tmdbScore: parseTmdbScore(w.sc),
    };
  });

  buildChips();
  buildDecades();
  buildGenres();
  buildMovements();
  updateAwardBtn();
  bind();
  applyDeepLink();
  render();
}

/* Enlaces desde corrientes.html (?corriente=) y directores.html (?director=):
   preseleccionan el filtro o abren directamente la ficha de filmografía. */
function applyDeepLink() {
  const params = new URLSearchParams(location.search);
  const corriente = params.get('corriente');
  const decada = params.get('decada');
  const director = params.get('director');

  if (corriente) {
    state.section = 'ALL';
    chipsEl.querySelectorAll('.chip[data-key]').forEach((c) =>
      c.setAttribute('aria-pressed', String(c.dataset.key === 'ALL')));
    // si se llega desde una corriente ya filtrada por década en
    // corrientes.html, esa década viaja también en la URL: sin esto se
    // veían obras de la misma corriente pero de décadas distintas.
    if (decada && WORKS.some((w) => w.dec === decada)) {
      state.decade = decada;
      decadeEl.value = decada;
    }
    buildMovements();
    if (WORKS.some((w) => w.m === corriente)) {
      state.movement = corriente;
      movementEl.value = corriente;
    }
  }
  if (director && WORKS.some((w) => w.d === director)) {
    openDirectorSheet(director);
  }
}

function buildChips() {
  const opts = [...Object.entries(SECTIONS), ['ALL', 'Todo']];
  chipsEl.innerHTML = '';
  for (const [key, label] of opts) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = label;
    b.dataset.key = key;
    b.setAttribute('aria-pressed', String(key === state.section));
    b.addEventListener('click', () => {
      state.section = key;
      chipsEl.querySelectorAll('.chip[data-key]').forEach((c) =>
        c.setAttribute('aria-pressed', String(c.dataset.key === key)));
      buildMovements();
      render();
    });
    chipsEl.appendChild(b);
  }
}

const AWARD_LABELS = { ALL: 'Premios', YES: 'Premiadas', NO: 'No premiadas' };
const AWARD_NEXT = { ALL: 'YES', YES: 'NO', NO: 'ALL' };
function updateAwardBtn() {
  const btn = $('#btn-award');
  btn.title = AWARD_LABELS[state.award];
  btn.setAttribute('aria-label', `Filtrar por premios: ${AWARD_LABELS[state.award]}`);
  btn.setAttribute('aria-pressed', String(state.award !== 'ALL'));
}

function buildDecades() {
  const decs = [...new Set(WORKS.map((w) => w.dec))];
  decadeEl.innerHTML = '<option value="ALL">Todas las décadas</option>' +
    decs.map((d) => `<option value="${d}">${d}</option>`).join('');
}

/* Las corrientes dependen de la década y de la sección elegidas: sin
   filtrar ninguna, todas las que haya en el catálogo; filtrando, sólo las
   que aparecen entre las obras que cumplen esos filtros (así no salen
   corrientes de documentales al filtrar por películas, y viceversa). */
function buildMovements() {
  const pool = WORKS.filter((w) =>
    (state.decade === 'ALL' || w.dec === state.decade) &&
    (state.section === 'ALL' ? w.s !== 'SERIES' : w.s === state.section));
  const movs = [...new Set(pool.map((w) => w.m).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const prev = state.movement;
  movementEl.innerHTML = '<option value="ALL">Todas las corrientes</option>' +
    movs.map((m) => `<option value="${m}">${m}</option>`).join('');
  state.movement = movs.includes(prev) ? prev : 'ALL';
  movementEl.value = state.movement;
}

function buildGenres() {
  const genres = [...new Set(WORKS.map((w) => w.g).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  genreEl.innerHTML = '<option value="ALL">Todos los géneros</option>' +
    genres.map((g) => `<option value="${g}">${g}</option>`).join('');
}

function bind() {
  let t;
  searchEl.addEventListener('input', () => {
    clearEl.hidden = !searchEl.value;
    clearTimeout(t);
    t = setTimeout(() => { state.q = norm(searchEl.value.trim()); render(); }, 120);
  });
  clearEl.addEventListener('click', () => {
    searchEl.value = ''; clearEl.hidden = true; state.q = ''; render(); searchEl.focus();
  });
  decadeEl.addEventListener('change', () => {
    state.decade = decadeEl.value;
    buildMovements();
    render();
  });
  movementEl.addEventListener('change', () => { state.movement = movementEl.value; render(); });
  genreEl.addEventListener('change', () => { state.genre = genreEl.value; render(); });
  sortEl.addEventListener('change', () => { state.sort = sortEl.value; render(); });

  $('#btn-award').addEventListener('click', () => {
    state.award = AWARD_NEXT[state.award];
    updateAwardBtn();
    render();
  });

  $('#btn-random').addEventListener('click', () => {
    const pool = filtered();
    if (pool.length) openSheet(pool[Math.floor(Math.random() * pool.length)]);
  });

  $('#sheet-close').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => {          // toca fuera para cerrar
    if (e.target === sheet) sheet.close();
  });
}

/* ---------------- filtrado ---------------- */
function filtered() {
  const { q, section, decade, movement, genre, award, sort } = state;
  let out = WORKS.filter((w) =>
    (section === 'ALL' || w.s === section) &&
    (decade === 'ALL' || w.dec === decade) &&
    (movement === 'ALL' || w.m === movement) &&
    (genre === 'ALL' || w.g === genre) &&
    (award === 'ALL' || (award === 'YES' ? w._hasAward : !w._hasAward)) &&
    (!q || w._hay.includes(q)));

  const by = {
    'year-asc':  (a, b) => a.y - b.y || a._t.localeCompare(b._t),
    'year-desc': (a, b) => b.y - a.y || a._t.localeCompare(b._t),
    'title':     (a, b) => a._t.localeCompare(b._t),
    'director':  (a, b) => a._d.localeCompare(b._d) || a.y - b.y,
    'tmdb-desc': (a, b) => (b._tmdbScore ?? -1) - (a._tmdbScore ?? -1) || a._t.localeCompare(b._t),
  }[sort];
  return out.sort(by);
}

/* ---------------- render ----------------
   Por tandas: meter 576 tarjetas de golpe atasca el móvil. Se pintan PAGE
   y el resto va entrando conforme el scroll se acerca al final. */
const PAGE = 48;
let visible = [];      // resultado del filtro actual
let shown = 0;         // cuántas hay ya en el DOM

/* Se dispara por scroll y no con IntersectionObserver a propósito: el
   observer sólo entrega notificaciones si el navegador está produciendo
   frames, y se queda mudo con la pestaña en segundo plano o dentro de un
   iframe parcialmente fuera de vista. El scroll es más tosco pero fiable. */
const MARGEN = 800;   // px antes del final a los que se pide la siguiente tanda

function cercaDelFinal() {
  return window.scrollY + window.innerHeight >=
         document.documentElement.scrollHeight - MARGEN;
}

/* Agrupado con setTimeout y no con requestAnimationFrame: rAF tampoco
   corre sin frames (pestaña oculta, iframe fuera de vista). */
let pendiente = false;
function alScroll() {
  if (pendiente) return;
  pendiente = true;
  setTimeout(() => { pendiente = false; rellenar(); }, 80);
}

/* Añade tandas mientras quepan y falten: cubre el caso de que la primera
   no llegue a llenar la pantalla en tablets o en horizontal. */
function rellenar() {
  let guarda = 0;
  while (shown < visible.length && cercaDelFinal() && guarda++ < 20) appendChunk();
}

window.addEventListener('scroll', alScroll, { passive: true });
window.addEventListener('resize', alScroll, { passive: true });

/* Silueta genérica de "estatuilla", sin guardar las proporciones ni la
   pose de ningún premio real (cabeza redonda, cuerpo troncocónico liso,
   sin espada ni peana de carrete): sólo evoca "trofeo con figura". */
const STATUETTE_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
  <circle cx="12" cy="6" r="3" fill="#3b2a06"/>
  <path d="M8.5 10c0-1 1-1.7 3.5-1.7s3.5.7 3.5 1.7l1 7c0 1-.8 1.6-1.8 1.6h-5.4c-1 0-1.8-.6-1.8-1.6z" fill="#3b2a06"/>
  <rect x="6.5" y="18.6" width="11" height="2.2" rx="0.6" fill="#3b2a06"/>
  <rect x="8" y="20.8" width="8" height="1.6" rx="0.5" fill="#3b2a06"/>
</svg>`;

/* Iconitos de premio: pequeños, no interactivos (pointer-events:none en CSS),
   sólo informativos encima del póster. */
const AWARD_ICONS = [
  ['oscarWin',  STATUETTE_SVG, 'Ganadora de un Oscar', 'badge-oscar'],
  ['palmaOro',  '🌴', 'Palma de Oro (Cannes)', 'badge-palma'],
  ['cannesWin', '🎬', 'Premio del Festival de Cannes', 'badge-cannes'],
  ['globoOro',  '🌐', 'Globo de Oro', 'badge-globo'],
];

function awardBadges(w) {
  const aw = w._aw || {};
  const active = AWARD_ICONS.filter(([key]) => aw[key]);
  if (!active.length) return null;
  const wrap = document.createElement('div');
  wrap.className = 'badges';
  for (const [, icon, label, cls] of active) {
    const b = document.createElement('span');
    b.className = `badge ${cls}`;
    if (icon.startsWith('<svg')) b.innerHTML = icon;
    else b.textContent = icon;
    b.title = label;
    wrap.appendChild(b);
  }
  return wrap;
}

/* Logos de plataforma: vienen de TMDb (datos de JustWatch). w92 basta para
   los iconos pequeños de tarjeta y para la fila de la ficha. */
const PROVIDER_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

function providerIcons(w) {
  const ids = w.wp || [];
  const wrap = document.createElement('div');
  wrap.className = 'providers';
  for (const id of ids) {
    const info = PROVIDERS[id];
    if (!info || !info.l) continue;
    const img = document.createElement('img');
    img.className = 'provider-icon';
    img.crossOrigin = 'anonymous';
    img.src = PROVIDER_LOGO_BASE + info.l;
    img.alt = info.n;
    img.title = info.n;
    img.loading = 'lazy';
    img.decoding = 'async';
    wrap.appendChild(img);
  }
  return wrap.childElementCount ? wrap : null;
}

/* El nombre del director es clicable (abre su filmografía) sin disparar el
   click de la tarjeta/ficha que lo envuelve. */
function makeDirectorLink(name) {
  const a = document.createElement('span');
  a.className = 'dir-link';
  a.textContent = name;
  a.addEventListener('click', (e) => {
    e.stopPropagation();
    openDirectorSheet(name);
  });
  return a;
}

function makeCard(w) {
  const card = document.createElement('button');
  card.className = 'card';
  card.type = 'button';
  if (w._aw.oscarWin) card.classList.add('frame-gold');
  else if (w._aw.oscarNom) card.classList.add('frame-silver');

  if (w.img) {
    const img = document.createElement('img');
    // crossOrigin antes que src: sin él la petición sale en modo no-cors y la
    // respuesta es opaca (status 0), que no se puede cachear ni comprobar.
    // TMDb envía Access-Control-Allow-Origin:*, así que CORS funciona.
    img.crossOrigin = 'anonymous';
    img.src = posterURL(w.img);
    img.alt = `Póster de ${w.t}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    // sin conexión y sin caché el hueco quedaría roto: mejor el marcador
    img.addEventListener('error', () => {
      const ph = document.createElement('div');
      ph.className = 'ph';
      ph.textContent = 'sin imagen';
      img.replaceWith(ph);
    }, { once: true });
    card.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'ph';
    ph.textContent = 'sin póster';
    card.appendChild(ph);
  }

  const badges = awardBadges(w);
  if (badges) card.appendChild(badges);

  const h = document.createElement('h3');
  h.textContent = w.t;
  const p = document.createElement('p');
  if (w.d) p.appendChild(makeDirectorLink(w.d));
  else p.append('—');
  p.append(` · ${w.y}`);
  card.append(h, p);
  card.addEventListener('click', () => openSheet(w));
  return card;
}

function appendChunk() {
  if (shown >= visible.length) return;
  const frag = document.createDocumentFragment();
  for (const w of visible.slice(shown, shown + PAGE)) frag.appendChild(makeCard(w));
  shown = Math.min(shown + PAGE, visible.length);
  grid.appendChild(frag);
}

function render() {
  visible = filtered();
  shown = 0;
  countEl.textContent = `${visible.length} ${visible.length === 1 ? 'obra' : 'obras'}`;
  emptyEl.hidden = visible.length > 0;

  grid.replaceChildren();
  window.scrollTo({ top: 0 });   // antes de rellenar: decide cuántas tandas caben
  appendChunk();
  rellenar();
}

/* ---------------- ficha ---------------- */
function openSheet(w) {
  const rows = [
    ['Tipo',        SECTIONS[w.s]],
    ['Género',      w.g],
    ['Corriente',   w.m],
    ['Reparto',     w.c],
    ['Puntuaciones', w.sc],
  ].filter(([, v]) => v);

  const inner = document.createElement('div');
  inner.className = 'sheet-inner';

  const hero = document.createElement('div');
  hero.className = 'sheet-hero';
  if (w.img) {
    const posterBtn = document.createElement('button');
    posterBtn.type = 'button';
    posterBtn.className = 'poster-zoom';
    posterBtn.setAttribute('aria-label', `Ampliar póster de ${w.t}`);
    const im = document.createElement('img');
    im.crossOrigin = 'anonymous';
    im.src = posterURL(w.img);
    im.alt = `Póster de ${w.t}`;
    posterBtn.appendChild(im);
    const hint = document.createElement('span');
    hint.className = 'zoom-hint';
    hint.textContent = '🔍';
    posterBtn.appendChild(hint);
    posterBtn.addEventListener('click', () => openLightbox(w.img, im.alt));
    hero.appendChild(posterBtn);
  }
  const head = document.createElement('div');
  const h2 = document.createElement('h2');
  h2.textContent = w.t;
  const meta = document.createElement('p');
  meta.className = 'meta';
  if (w.d) meta.appendChild(makeDirectorLink(w.d));
  else meta.append('—');
  meta.append(` · ${w.y}`);
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = w.dec;
  head.append(h2, meta, tag);
  hero.appendChild(head);

  const parts = [hero];
  if (w.ov) {
    const syn = document.createElement('p');
    syn.className = 'synopsis';
    syn.textContent = w.ov;
    parts.push(syn);
  }

  const watch = document.createElement('div');
  watch.className = 'watch-row';
  const watchLabel = document.createElement('span');
  watchLabel.className = 'watch-label';
  watchLabel.textContent = 'Disponible en';
  const watchIcons = providerIcons(w);
  if (watchIcons) {
    watch.append(watchLabel, watchIcons);
    parts.push(watch);
  }

  const dl = document.createElement('dl');
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }
  if (w.p) {
    const dt = document.createElement('dt'); dt.textContent = 'Premios';
    const dd = document.createElement('dd'); dd.className = 'premios'; dd.textContent = w.p;
    dl.append(dt, dd);
  }

  parts.push(dl);
  inner.append(...parts);
  sheetBody.replaceChildren(inner);
  if (!sheet.open) sheet.showModal();
}

/* ---------------- filmografía de director ---------------- */
function openDirectorSheet(director) {
  const films = WORKS.filter((w) => w.d === director).sort((a, b) => a.y - b.y);

  const inner = document.createElement('div');
  inner.className = 'sheet-inner';

  const h2 = document.createElement('h2');
  h2.className = 'director-title';
  h2.textContent = director;
  const count = document.createElement('p');
  count.className = 'meta';
  count.textContent = `${films.length} ${films.length === 1 ? 'obra' : 'obras'} en el catálogo`;

  const list = document.createElement('div');
  list.className = 'director-grid';
  for (const w of films) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'director-item';
    if (w.img) {
      const im = document.createElement('img');
      im.crossOrigin = 'anonymous';
      im.src = posterURL(w.img);
      im.alt = `Póster de ${w.t}`;
      im.loading = 'lazy';
      item.appendChild(im);
    } else {
      const ph = document.createElement('div');
      ph.className = 'ph';
      ph.textContent = 'sin póster';
      item.appendChild(ph);
    }
    const h = document.createElement('h4');
    h.textContent = w.t;
    const p = document.createElement('p');
    p.textContent = w.y;
    item.append(h, p);
    item.addEventListener('click', () => openSheet(w));
    list.appendChild(item);
  }

  inner.append(h2, count, list);
  sheetBody.replaceChildren(inner);
  if (!sheet.open) sheet.showModal();
}

/* ---------------- offline ---------------- */
const POSTER_CACHE = 'cine-posters-v2';

/* Las condiciones de la API de TMDB prohíben conservar su contenido más de
   6 meses. Se anota cuándo se llenó la caché y se vacía al caducar; las
   imágenes se vuelven a pedir solas la próxima vez que hagan falta. */
const CADUCIDAD_MS = 150 * 24 * 60 * 60 * 1000;   // 150 días, con margen
const SELLO = 'cine-posters-fecha';

async function purgarSiCaduco() {
  if (!('caches' in window)) return;
  const sello = Number(localStorage.getItem(SELLO) || 0);
  if (!sello) return;
  if (Date.now() - sello < CADUCIDAD_MS) return;
  await caches.delete(POSTER_CACHE);
  localStorage.removeItem(SELLO);
}

async function downloadAll(btn, status) {
  if (!('caches' in window)) {
    status.textContent = 'Este navegador no permite guardar sin conexión.';
    return;
  }
  btn.disabled = true;
  const cache = await caches.open(POSTER_CACHE);
  const urls = [...new Set(WORKS.filter((w) => w.img).map((w) => posterURL(w.img)))];
  let done = 0, failed = 0;

  // Concurrencia moderada y reintentos: el CDN descarta peticiones cuando le
  // llegan muchas de golpe, y sin reintento se perdía una de cada tres.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const queue = urls.slice();

  const guardar = async (url) => {
    for (let intento = 0; intento < 3; intento++) {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) { await cache.put(url, res); return true; }
      } catch { /* red caída o rechazo puntual: se reintenta */ }
      await sleep(300 * (intento + 1));
    }
    return false;
  };

  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!(await cache.match(url)) && !(await guardar(url))) failed++;
      done++;
      if (done % 10 === 0 || done === urls.length) {
        status.textContent = `Guardando… ${done}/${urls.length}`;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  localStorage.setItem(SELLO, String(Date.now()));
  status.textContent = failed
    ? `Listo con ${failed} fallos. Vuelve a pulsar para reintentar.`
    : 'Listo: la app funciona entera sin conexión.';
  btn.disabled = false;
}

$('#btn-offline').addEventListener('click', (e) =>
  downloadAll(e.currentTarget, $('#offline-status')));

/* ---------------- service worker ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(() => {}));
}

purgarSiCaduco().catch(() => {});

init().catch((err) => {
  countEl.textContent = 'No se pudieron cargar los datos.';
  console.error(err);
});
