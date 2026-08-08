# Cinick — app para el móvil (PWA)

Catálogo de 576 obras, instalable en Android y iPhone. Funciona sin conexión.
No necesita tiendas de aplicaciones ni cuotas.

**Los pósters no están aquí dentro.** La app guarda la ruta de cada uno en TMDb
y se los pide a su CDN al mostrarlos, que es el uso que TMDb contempla. Así no
se rehospeda material ajeno.

## Qué hay aquí

| Fichero | Para qué |
|---|---|
| `index.html` | pantalla de inicio (Búsqueda general / Corrientes / Directores) |
| `catalogo.html`, `app.js` | el catálogo completo: buscar, filtrar, fichas |
| `corrientes.html`, `directores.html`, `browse.js` | exploración por década |
| `styles.css` | estilos de toda la app |
| `data.json` | las 576 obras + póster, sinopsis y plataformas de streaming (generado) |
| `directors.json` | fotos de director (generado) |
| `providers.json` | nombre y logo de cada plataforma de streaming (generado) |
| `icons/` | iconos de instalación y logo (generado desde `files/icons_src/`) |
| `manifest.json` | nombre, colores e iconos |
| `sw.js` | service worker: funcionamiento sin conexión |

Lo *generado* sale de los scripts de `..\files\`:

```
python build_urls.py         # averigua la ruta TMDb de cada póster -> _cache/urls.json
python build_synopsis.py     # sinopsis de cada obra -> _cache/synopsis.json
python build_directors.py    # fotos de director -> app/directors.json
python build_watch.py        # plataformas de streaming -> app/providers.json
python build_app.py          # junta todo en data.json
python build_brand_icons.py  # iconos de la app a partir de files/icons_src/cinick_logo.png
```

`build_urls.py` es incremental: solo consulta las obras que no conozca. Si
añades películas a `db_cine.json`, ejecútalo y luego `build_app.py`.

Necesita la clave de TMDb en `..\files\tmdb_key.txt`, pero **solo para
generar**. La app publicada no lleva clave ninguna.

## Probarla en el ordenador

```
python -m http.server 8765 -d "C:\Users\vicen\Desktop\Cine\app"
```

Y abre <http://localhost:8765>.

Hace falta un servidor: abrir `index.html` con doble clic **no funciona**,
porque el navegador bloquea la carga de `data.json` desde `file://`.

## Ponerla en el móvil

Requiere servirla por **HTTPS** (salvo en localhost). Sin HTTPS el navegador
desactiva el service worker y se pierde el uso sin conexión.

- **Android / Chrome**: menú ⋮ → *Instalar aplicación*
- **iPhone / Safari**: Compartir → *Añadir a pantalla de inicio*
  (en iOS tiene que ser Safari; desde Chrome no se instala)

Después, dentro de la app, pulsa una vez **«Descargar todo para usar sin
conexión»**: baja los 576 pósters (unos 20 MB) y a partir de ahí funciona en
modo avión. Sin pulsarlo también sirve, pero necesitará datos para las
imágenes que no haya visto todavía.

## Notas

- La atribución a TMDB que exigen sus condiciones está en el pie de la app.
- Uso personal y no comercial.
