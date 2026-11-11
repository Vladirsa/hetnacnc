# Microcaché de páginas (nginx)

Guarda 60 s las páginas públicas de la tienda (inicio, catálogo, fichas y
páginas informativas) para visitantes sin sesión ni carrito. Si la tienda o el
API fallan, sirve la última copia buena (hasta 24 h) en vez del error.

- `hetna-cache-paginas.conf` → nivel http (`/etc/nginx/conf.d/`)
- `hetna-cache-paginas-location.conf` → dentro del `location` que hace `proxy_pass` a la tienda (3000)

## Qué se probó (nginx 1.24, tienda falsa)

- Siempre van a la tienda: sesión (`_medusa_jwt`), carrito (`_medusa_cart_id`), panel, POST,
  navegación interna de Next (cabecera `RSC`), `?ref=` y toda ruta fuera de la lista permitida.
- Un visitante nuevo recibe la copia; `gclid` / `fbclid` / `utm_*` no rompen la copia.
- Idioma (`hetna_lang` / `/us`) y robots (`isBot`) tienen su propia copia.
- Copia vencida con la tienda bien → se arma de nuevo. Con la tienda dando 500 → se sirve la copia.
- `scripts/desplegar.sh` vacía la microcaché al reiniciar la tienda y el calentamiento la vuelve a llenar.

## Instalar (en el VPS, como root)

0. **Antes, pásale a quien te ayuda el bloque real de la tienda**, para revisar
   `proxy_buffering off`, cachés existentes o varios locations hacia el 3000:

```bash
nginx -T 2>/dev/null | grep -n -B3 -A15 "proxy_pass http://\(127.0.0.1\|localhost\):3000"
```

1. Respaldo y copia de los archivos (copias, no enlaces al repo: así un
   `git pull` nunca deja a nginx sin un archivo que espera):

```bash
cp -a /etc/nginx /root/nginx-respaldo-$(date +%F) && cp /root/hetnacnc/infra/nginx/hetna-cache-paginas.conf /etc/nginx/conf.d/ && cp /root/hetnacnc/infra/nginx/hetna-cache-paginas-location.conf /etc/nginx/
```

2. Dentro del `location { ... }` de la tienda (el del `proxy_pass` al 3000),
   debajo del `proxy_pass`, agrega una línea. Nunca en el del API (9000):

```nginx
include /etc/nginx/hetna-cache-paginas-location.conf;
```

3. Revisar y aplicar (si `nginx -t` falla, no recargues):

```bash
nginx -t && systemctl reload nginx
```

## Comprobar

```bash
for i in 1 2 3; do curl -s -o /dev/null -w '%{time_starttransfer}s\n' -H 'Cookie: _medusa_cache_id=x; hetna_lang=es' https://hetnacnc.com/mx; done
```

La 2.ª y la 3.ª deben ser mucho más rápidas, y debe haber archivos en:

```bash
find /var/cache/nginx/hetna-paginas -type f | wc -l
```

## Quitar

Borra la línea `include` del paso 2 y `/etc/nginx/conf.d/hetna-cache-paginas.conf`, luego
`nginx -t && systemctl reload nginx`. Vaciar a mano: `find /var/cache/nginx/hetna-paginas -type f -delete`.

## Si cambias estos archivos en el repo

Vuelve a copiarlos (paso 1, sin el respaldo) y `nginx -t && systemctl reload nginx`.
Una página nueva sólo entra a la caché si se agrega a `$hetna_ruta_publica`, después
de revisar que no lea cookies de sesión o carrito.

## Qué cambia para el negocio

- Un cambio de precio o producto tarda hasta ~1 min en verse para visitantes sin sesión.
- Con la tienda caída, los visitantes ven la última copia en vez de un error.
