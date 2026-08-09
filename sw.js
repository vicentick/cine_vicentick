/* Service worker: el armazón y los datos se precargan; los pósters se
   cachean según se van viendo (o de golpe con el botón de la app). */

const SHELL_CACHE  = 'cine-shell-v23';
const POSTER_CACHE = 'cine-posters-v2';

const SHELL = [
  './',
  'index.html',
  'catalogo.html',
  'corrientes.html',
  'directores.html',
  'styles.css',
  'app.js',
  'browse.js',
  'data.json',
  'directors.json',
  'providers.json',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/logo.png',
  'icons/tmdb.svg',      // la atribución debe verse también sin conexión
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== POSTER_CACHE)
            .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Pósters del CDN de TMDb: caché primero, y lo descargado se queda guardado.
  // Su cabecera es Access-Control-Allow-Origin:*, así que son respuestas
  // normales (no opacas) y se pueden cachear e inspeccionar sin problemas.
  if (url.hostname === 'image.tmdb.org') {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        // 'opaque' cubre el caso de que algo pida la imagen sin CORS: ahí
        // res.ok es false aunque la descarga haya ido bien.
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(POSTER_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => new Response('', { status: 504 })))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Armazón: red primero para no servir versiones viejas, caché si no hay red.
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit ||
        caches.match('index.html')))
  );
});
