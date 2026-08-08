/* Lógica compartida por corrientes.html y directores.html: primero una
   pantalla de décadas, y al elegir una, sus corrientes/directores (los que
   debutan en esa década, por la fecha de su obra más antigua). Cada tarjeta
   enlaza a catalogo.html con el filtro (o la ficha) ya aplicado. */

const IMG_BASE     = 'https://image.tmdb.org/t/p/w342';
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';

function decadeOrderOf(works) {
  const order = [];
  const seen = new Set();
  for (const w of works) {
    if (!seen.has(w.dec)) { seen.add(w.dec); order.push(w.dec); }
  }
  return order;
}

/* Para cada valor de la clave `key` ("m" o "d"), la obra más antigua que lo
   lleva: de ahí sacamos en qué década "debuta" y qué póster representarlo. */
function earliestByKey(works, key) {
  const first = new Map();
  for (const w of works) {
    const val = w[key];
    if (!val) continue;
    const cur = first.get(val);
    if (!cur || w.y < cur.y) first.set(val, w);
  }
  return first;
}

function countByDecade(entries, decadeOrder) {
  const counts = new Map(decadeOrder.map((d) => [d, 0]));
  for (const [, work] of entries) counts.set(work.dec, (counts.get(work.dec) || 0) + 1);
  return counts;
}

function renderDecadeTiles(wrap, decadeOrder, counts, pageHref, noun) {
  wrap.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'decade-grid';
  for (const dec of decadeOrder) {
    const n = counts.get(dec) || 0;
    if (!n) continue;
    const a = document.createElement('a');
    a.className = 'decade-tile';
    a.href = `${pageHref}?decada=${encodeURIComponent(dec)}`;
    const label = document.createElement('span');
    label.className = 'decade-tile-label';
    label.textContent = dec;
    const sub = document.createElement('span');
    sub.className = 'decade-tile-sub';
    sub.textContent = `${n} ${n === 1 ? noun.one : noun.many}`;
    a.append(label, sub);
    grid.appendChild(a);
  }
  wrap.appendChild(grid);
}

function renderFlatGrid(wrap, entries, makeItem) {
  wrap.innerHTML = '';
  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'browse-empty';
    p.textContent = 'No hay nada que mostrar.';
    wrap.appendChild(p);
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'browse-grid';
  for (const entry of entries) grid.appendChild(makeItem(entry));
  wrap.appendChild(grid);
}

/* Cuando ya hay una década elegida, el botón de inicio se convierte en
   "volver a la lista de décadas" y el título recuerda cuál es. */
function setupTopbar(decada, pageHref, baseTitle) {
  const h1 = document.getElementById('page-title');
  const homeBtn = document.getElementById('home-btn');
  if (!decada) {
    h1.textContent = baseTitle;
    return;
  }
  h1.textContent = `${baseTitle} · ${decada}`;
  const back = document.createElement('a');
  back.className = 'icon-btn';
  back.href = pageHref;
  back.title = 'Volver a las décadas';
  back.setAttribute('aria-label', 'Volver a las décadas');
  back.textContent = '◀';
  homeBtn.insertAdjacentElement('afterend', back);
}

function posterItem(name, work, href) {
  const a = document.createElement('a');
  a.className = 'browse-item';
  a.href = href;
  if (work.img) {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = IMG_BASE + work.img;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      const ph = document.createElement('div');
      ph.className = 'ph';
      ph.textContent = '🎬';
      img.replaceWith(ph);
    }, { once: true });
    a.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'ph';
    ph.textContent = '🎬';
    a.appendChild(ph);
  }
  const span = document.createElement('span');
  span.textContent = name;
  a.appendChild(span);
  return a;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
}

function personItem(name, work, href, photoPath) {
  const a = document.createElement('a');
  a.className = 'browse-item is-person';
  a.href = href;
  if (photoPath) {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = PROFILE_BASE + photoPath;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      const av = document.createElement('div');
      av.className = 'avatar-init';
      av.textContent = initials(name);
      img.replaceWith(av);
    }, { once: true });
    a.appendChild(img);
  } else {
    const av = document.createElement('div');
    av.className = 'avatar-init';
    av.textContent = initials(name);
    a.appendChild(av);
  }
  const span = document.createElement('span');
  span.textContent = name;
  a.appendChild(span);
  return a;
}

async function initCorrientes() {
  const wrap = document.getElementById('browse-wrap');
  const decada = new URLSearchParams(location.search).get('decada');
  setupTopbar(decada, 'corrientes.html', 'Corrientes');

  const data = await (await fetch('data.json')).json();
  const works = data.works;
  const decadeOrder = decadeOrderOf(works);
  const entries = earliestByKey(works, 'm');

  if (!decada) {
    renderDecadeTiles(wrap, decadeOrder, countByDecade(entries, decadeOrder), 'corrientes.html',
      { one: 'corriente', many: 'corrientes' });
    return;
  }
  const items = [...entries].filter(([, w]) => w.dec === decada)
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([name, work]) => ({ name, work }));
  renderFlatGrid(wrap, items, ({ name, work }) =>
    posterItem(name, work, `catalogo.html?corriente=${encodeURIComponent(name)}`));
}

async function initDirectores() {
  const wrap = document.getElementById('browse-wrap');
  const decada = new URLSearchParams(location.search).get('decada');
  setupTopbar(decada, 'directores.html', 'Directores');

  const [data, photos] = await Promise.all([
    fetch('data.json').then((r) => r.json()),
    fetch('directors.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  const works = data.works;
  const decadeOrder = decadeOrderOf(works);
  const entries = earliestByKey(works, 'd');

  if (!decada) {
    renderDecadeTiles(wrap, decadeOrder, countByDecade(entries, decadeOrder), 'directores.html',
      { one: 'director', many: 'directores' });
    return;
  }
  const items = [...entries].filter(([, w]) => w.dec === decada)
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([name, work]) => ({ name, work }));
  renderFlatGrid(wrap, items, ({ name, work }) =>
    personItem(name, work, `catalogo.html?director=${encodeURIComponent(name)}`, photos[name]));
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

const PAGE = document.body.dataset.page;
if (PAGE === 'corrientes') initCorrientes().catch(() => {});
if (PAGE === 'directores') initDirectores().catch(() => {});
