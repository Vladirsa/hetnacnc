# Microcaché de páginas (nginx)

Guarda 60 s cada página pública de la tienda para visitantes sin sesión ni
carrito, y sirve la última copia buena si la tienda o el API fallan.

- `hetna-cache-paginas.conf` → nivel http (`/etc/nginx/conf.d/`)
- `hetna-cache-paginas-location.conf` → dentro del `location` que hace `proxy_pass` a la tienda (3000)

Probado con nginx 1.24 y una tienda falsa: sesión, carrito, POST, navegación
interna (RSC), `?ref=`, rutas privadas y `/api` siempre van a la tienda; el
idioma (`hetna_lang` / `/us`) tiene su propia copia; un visitante nuevo recibe
la copia; con la tienda devolviendo 500 se sirve la copia.

## Instalar (en el VPS, como root)

1. Respaldo y archivo http:

```bash
cp -a /etc/nginx /root/nginx-respaldo-$(date +%F) && ln -sf /root/hetnacnc/infra/nginx/hetna-cache-paginas.conf /etc/nginx/conf.d/hetna-cache-paginas.conf
```

2. Encuentra el location de la tienda:

```bash
grep -rn "proxy_pass http://\(127.0.0.1\|localhost\):3000" /etc/nginx/sites-enabled/
```

3. Dentro de ese `location { ... }`, debajo del `proxy_pass`, agrega:

```nginx
include /root/hetnacnc/infra/nginx/hetna-cache-paginas-location.conf;
```

   Sólo en el location de la tienda (3000), nunca en el del API (9000).

4. Revisar y aplicar (si `nginx -t` falla, no recargues):

```bash
nginx -t && systemctl reload nginx
```

## Comprobar

```bash
for i in 1 2 3; do curl -s -o /dev/null -w '%{time_starttransfer}s\n' -H 'Cookie: _medusa_cache_id=x; hetna_lang=es' https://hetnacnc.com/mx; done
```

La 2.ª y 3.ª deben ser mucho más rápidas. Y deben aparecer archivos en:

```bash
find /var/cache/nginx/hetna-paginas -type f | wc -l
```

## Quitar

Borra la línea `include` del paso 3 y el enlace de `conf.d`, luego `nginx -t && systemctl reload nginx`.
Vaciar la caché: `find /var/cache/nginx/hetna-paginas -type f -delete`.

## Qué cambia para el negocio

- Un cambio de precio o producto tarda hasta ~1 min en verse para visitantes sin sesión.
- Con la tienda caída, los visitantes ven la última copia (hasta 24 h) en vez de un error.
