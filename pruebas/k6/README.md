# Pruebas de rendimiento con k6

Miden si hetnacnc.com aguanta y responde rápido. **Sólo hacen lecturas (GET)**:
no crean carritos, no inician sesión, no mandan cotizaciones ni suman vistas.

| Script | Qué mide |
|---|---|
| `tienda.js` | Recorrido de un comprador: inicio → categorías → producto → talleres → feed de catálogo. Tiempos por página, TTFB, errores y peso del HTML. |
| `api.js` | API `/store` de Medusa (productos, producto por handle, categorías). Necesita la llave publicable. |
| `navegador.js` | Core Web Vitals (LCP, FCP, CLS, TTFB) en Chromium con pantalla de celular. |

## Instalar k6

En Ubuntu/Debian (VPS), con el repositorio oficial de Grafana:

```bash
gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" > /etc/apt/sources.list.d/k6.list
apt-get update && apt-get install -y k6
```

Con Go ya instalado (así se probó en desarrollo, k6 v1.8.2): `go install go.k6.io/k6@latest`.
No compiles k6 en el VPS de producción: tarda y se come la RAM del sitio.

Otras opciones (brew, Windows, binario): https://grafana.com/docs/k6/latest/set-up/install-k6/

**En el VPS** las pruebas viven en otra rama; sácalas fuera del repo para no ensuciar `main`:

```bash
mkdir -p /root/k6-pruebas && cd /root/hetnacnc && git fetch origin claude/fervent-dirac-2n43to && git archive FETCH_HEAD pruebas/k6 | tar -x -C /root/k6-pruebas
```

Correr desde el VPS mide el servidor sin la red de por medio y compite por CPU con la
tienda: para humo está bien; carga y estrés mejor desde otra máquina.

## Correr

```bash
# Humo: 1 usuario, 30 s. Seguro en producción a cualquier hora.
k6 run pruebas/k6/tienda.js

# Carga: 10 usuarios simultáneos ~4.5 min. Sólo en horario de poco tráfico.
PERFIL=carga k6 run pruebas/k6/tienda.js

# Techo: 40→100 usuarios con el mismo corte automático (requiere la microcaché).
PERFIL=techo k6 run pruebas/k6/tienda.js

# Despliegue: 3 usuarios 12 min sin corte; arrancarlo justo antes de desplegar
# y contar las líneas FALLO (hora, código y ruta de cada error).
PERFIL=despliegue k6 run pruebas/k6/tienda.js

# Estrés: hasta 60 usuarios. Puede tumbar el VPS: avisar antes y vigilar pm2.
PERFIL=estres k6 run pruebas/k6/tienda.js

# API (la llave es NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY; nunca la subas al repo)
PUBLISHABLE_KEY=pk_xxx k6 run pruebas/k6/api.js

# Web Vitals con navegador real
K6_BROWSER_ARGS=no-sandbox k6 run pruebas/k6/navegador.js
```

Variables: `BASE_URL` (por omisión `https://hetnacnc.com`; usa `http://localhost:3000`
para local), `PAIS` (`mx`), `PERFIL` (`humo` | `carga` | `estres`), `API_URL`, `ITERACIONES`.

Si un umbral (`thresholds`) no se cumple, k6 termina con código ≠ 0. Sirve para CI
o para un cron que avise por n8n.

## Umbrales

- Errores < 1 %, checks > 99 %.
- Páginas p95 < 1.5 s; TTFB p95 < 1.2 s; API p95 < 0.8 s.
- Web Vitals con los umbrales "buenos" de Google: LCP < 2.5 s, FCP < 1.8 s, CLS < 0.1, TTFB < 0.8 s.
- `feed Meta: con productos` falla si el catálogo de Meta sale vacío (sin él no hay anuncios dinámicos).
  El de Google sólo se reporta en consola: excluye servicios, créditos y descargables a propósito.
- Cada respuesta ≠ 200 se imprime como `FALLO <hora> <código> <ruta>` para cruzarla con
  `pm2 logs hetna-web` y el `error.log` de nginx.
