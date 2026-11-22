# La tienda y el API sin root (usuario `hetna`)

**Para qué:** hoy `hetna-api` y `hetna-web` corren como `root` (inventario del 22 nov 2026).
Si alguien encontrara una falla en el código, tendría el servidor completo. Con un
usuario propio sin privilegios, una falla sólo alcanza los archivos de la tienda.

**Qué NO cambia:** Postgres, Redis, n8n, WhatsApp y el visor de cajas siguen en Docker
como están (la tienda los usa por `127.0.0.1`). nginx sigue igual (sólo hace proxy a los
puertos 3000 y 9000). Los respaldos siguen corriendo como root.

**Cómo queda:**

| Antes | Después |
|---|---|
| `/root/hetnacnc` | `/srv/hetnacnc` (dueño `hetna`). `/root/hetnacnc` queda como liga: los comandos de siempre, nginx y los respaldos siguen funcionando |
| `/root/hetna-privado`, `/root/hetna-data`, `/root/.hetna` | `/home/hetna/…` (el API los busca en la carpeta de su usuario). En `/root` quedan ligas para los respaldos |
| pm2 de root | pm2 de `hetna`, arranca solo al prender el servidor |
| `./scripts/desplegar.sh` como root | `sudo -iu hetna` y luego el mismo guion |
| tareas de prospectos y caché en el crontab de root | en el crontab de `hetna` |

**Cuándo:** en un horario tranquilo (la tienda se cae ~2 minutos en el paso 6) y con el
respaldo recién probado:

```bash
bash /root/hetnacnc/scripts/respaldar.sh && bash /root/hetnacnc/scripts/probar-restauracion.sh
```

Todo se corre como root, un bloque a la vez. Si un paso marca error, detente y pásalo.

---

## 1. Revisar dónde están bun y pm2

```bash
command -v bun pm2 node
```

Si `bun` sale dentro de `/root` (por ejemplo `/root/.bun/bin/bun`), el usuario nuevo no
lo puede usar; se le instala el suyo en el paso 3. `pm2` y `node` deben salir en
`/usr/bin` o `/usr/local/bin`.

## 2. Crear el usuario (sin contraseña, no entra por SSH)

```bash
id hetna 2>/dev/null || useradd --create-home --shell /bin/bash hetna
```

```bash
passwd -l hetna
```

## 3. Darle bun (sólo si en el paso 1 salió dentro de /root)

```bash
sudo -iu hetna bash -c 'curl -fsSL https://bun.sh/install | bash' && sudo -iu hetna bash -lc 'bun --version'
```

## 4. Su única regla de sudo: vaciar la microcaché de nginx al desplegar

```bash
echo 'hetna ALL=(root) NOPASSWD: /usr/bin/find /var/cache/nginx/hetna-paginas -type f -delete' > /etc/sudoers.d/hetna-cache && chmod 440 /etc/sudoers.d/hetna-cache && visudo -c
```

Debe terminar con `parsed OK`.

## 5. Carpeta para la marca del respaldo (el Centro de control la lee)

```bash
mkdir -p /srv/hetna-estado && chmod 755 /srv/hetna-estado && cp /root/respaldos/ultimo-ok /srv/hetna-estado/ 2>/dev/null; ls -l /srv/hetna-estado
```

```bash
cd /root/hetnacnc/packages/api && grep -q '^RESPALDO_MARCA=' .env || echo 'RESPALDO_MARCA=/srv/hetna-estado/ultimo-ok' >> .env
```

## 6. Parar la tienda de root (aquí empieza la caída)

```bash
pm2 stop hetna-web hetna-api && pm2 save --force
```

```bash
crontab -l > /root/crontab-antes.txt && crontab -l | grep -v -e prospectos/ -e mantener-cache | crontab - && crontab -l
```

## 7. Mover el repositorio y los datos

```bash
mv /root/hetnacnc /srv/hetnacnc && ln -s /srv/hetnacnc /root/hetnacnc
```

```bash
for d in hetna-privado hetna-data .hetna; do if [ -e "/root/$d" ] && [ ! -L "/root/$d" ]; then mv "/root/$d" "/home/hetna/$d" && ln -s "/home/hetna/$d" "/root/$d"; fi; done; ls -la /root | grep -e hetna
```

```bash
chown -R hetna:hetna /srv/hetnacnc /home/hetna && rm -f /tmp/hetna-desplegar.lock /tmp/hetna-mantener-cache.lock
```

El `chown` tarda un poco (la carpeta trae `node_modules` y 426 MB de fotos).

## 8. Arrancar la tienda como `hetna`

```bash
sudo -iu hetna bash -lc 'cd /srv/hetnacnc/packages/api && pm2 start "bun run start" --name hetna-api --kill-timeout 15000'
```

Espera ~30 segundos (Medusa tarda en arrancar). Debe responder `200`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9000/health
```

```bash
sudo -iu hetna bash -lc 'cd /srv/hetnacnc/apps/storefront && NEXT_DIST_DIR=$(cat .dist-actual) pm2 start "bun run start" --name hetna-web --kill-timeout 15000 && pm2 save'
```

Debe responder `200` (aquí termina la caída):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://hetnacnc.com/mx
```

## 9. Que arranque solo al prender el servidor

```bash
env PATH=$PATH:/usr/bin pm2 startup systemd -u hetna --hp /home/hetna
```

```bash
pm2 unstartup systemd; pm2 delete hetna-api hetna-web; pm2 save --force
```

Lo último quita los procesos viejos de root, que ya estaban parados.

## 10. Pasar las tareas programadas a `hetna`

```bash
grep -e prospectos/ -e mantener-cache /root/crontab-antes.txt | sed 's#/root/hetnacnc#/srv/hetnacnc#g' | sudo -u hetna crontab - && sudo -u hetna crontab -l
```

## 11. Comprobar

Los dos procesos deben salir como `hetna`:

```bash
ps -o user=,cmd= -C node | grep -E "medusa|next" | head
```

Despliegue de prueba, ya como `hetna`:

```bash
sudo -iu hetna bash -lc 'cd /srv/hetnacnc && ./scripts/desplegar.sh'
```

Entra al Centro de control del panel: el respaldo no debe salir como vencido.

---

## Desde ahora

- **Desplegar:** `sudo -iu hetna bash -lc 'cd /srv/hetnacnc && ./scripts/desplegar.sh'`
- **Ver logs:** `sudo -iu hetna pm2 logs hetna-api --lines 100 --nostream`
- **Comandos de `medusa exec`:** también como `hetna`, desde `/srv/hetnacnc/packages/api`.
- **No corras el despliegue como root:** dejaría archivos de root dentro de la carpeta
  y `hetna` ya no podría escribirlos. Si pasa, se arregla con
  `chown -R hetna:hetna /srv/hetnacnc`.
- **Si el despliegue avisa que no pudo instalar FFmpeg, Piper o HyperFrames** (sólo pasa
  la primera vez de una versión nueva), corre esa instalación como root aparte; el
  sitio sigue funcionando mientras tanto.
