/* Super DB de Cine — PWA sin dependencias. */

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

/* Los pósters se piden al CDN de TMDb, no viajan dentro de la app: así no se
   rehospeda material ajeno. w342 basta para las tarjetas (170 px) y para la
   ficha (104 px) incluso en pantallas de alta densidad. */
const IMG_BASE = 'https://image.tmdb.org/t/p/w342';
const posterURL = (path) => IMG_BASE + path;

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

/* Nota de IMDB dentro de "sc" ("FA –/IMDB 8.0/RT –"); null si no hay dato. */
function parseImdb(sc) {
  const m = /IMDB\s+([\d.]+)/i.exec(sc || '');
  return m ? parseFloat(m[1]) : null;
}

/* ---------------- carga ---------------- */
async function init() {
  const res = await fetch('data.json');
  const data = await res.json();
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
      _imdb: parseImdb(w.sc),
    };
  });

  buildChips();
  buildDecades();
  buildGenres();
  buildMovements();
  bind();
  render();
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

  const AWARD_LABELS = { ALL: '🏆 Premios', YES: '🏆 Premiadas', NO: '🏆 No premiadas' };
  const AWARD_NEXT = { ALL: 'YES', YES: 'NO', NO: 'ALL' };
  const awardBtn = document.createElement('button');
  awardBtn.className = 'chip chip-award';
  awardBtn.type = 'button';
  awardBtn.textContent = AWARD_LABELS[state.award];
  awardBtn.setAttribute('aria-pressed', String(state.award !== 'ALL'));
  awardBtn.addEventListener('click', () => {
    state.award = AWARD_NEXT[state.award];
    awardBtn.textContent = AWARD_LABELS[state.award];
    awardBtn.setAttribute('aria-pressed', String(state.award !== 'ALL'));
    render();
  });
  chipsEl.appendChild(awardBtn);
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
    (state.section === 'ALL' || w.s === state.section));
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
    'imdb-desc': (a, b) => (b._imdb ?? -1) - (a._imdb ?? -1) || a._t.localeCompare(b._t),
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

/* Iconitos de premio: pequeños, no interactivos (pointer-events:none en CSS),
   sólo informativos encima del póster. */
const AWARD_ICONS = [
  ['oscarWin',  '🏆', 'Ganadora de un Oscar', 'badge-oscar'],
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
    b.textContent = icon;
    b.title = label;
    wrap.appendChild(b);
  }
  return wrap;
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
    const im = document.createElement('img');
    im.crossOrigin = 'anonymous';
    im.src = posterURL(w.img);
    im.alt = `Póster de ${w.t}`;
    hero.appendChild(im);
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
