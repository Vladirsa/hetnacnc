# Guías de seguridad que se hacen fuera del código (18 nov 2026)

Estas tareas son configuración del servidor o de servicios externos. No se
pueden hacer desde el repositorio. Van en orden de importancia.

## 1. Probar que el respaldo se puede restaurar (una vez al mes)

El respaldo diario ya corre (`/etc/cron.d/hetna-respaldo`, 9:17 hora del servidor)
y sube cifrado a Backblaze. Una vez al mes, prueba que de verdad se restaura:

```bash
bash /root/hetnacnc/scripts/probar-restauracion.sh
```

Baja el último respaldo, lo carga en una base temporal aislada y compara pedidos,
productos, clientes y talleres con la base real. No toca la tienda.

**Protección extra contra borrado:** quien entre al servidor puede leer la llave
de Backblaze de `/root/.respaldo.env` y borrar los respaldos. Para que un borrado
se pueda deshacer, en Backblaze → **Buckets** → tu bucket → **Lifecycle
Settings** elige **Keep prior versions for this number of days: 30**. Así un
archivo borrado se queda 30 días como versión oculta y se puede recuperar.

**Guarda la contraseña de restic** (`RESTIC_PASSWORD` de `/root/.respaldo.env`)
también en tu gestor de contraseñas: sin ella los respaldos no sirven.

## 2. n8n y WhatsApp detrás de Cloudflare Access

`n8n.hetnacnc.com` y `whatsapp.hetnacnc.com` están abiertos a internet; sólo los
protege su propia contraseña. Cloudflare Access pone una pantalla de acceso antes
(un código a tu correo) sin costo para pocas personas.

1. Cloudflare → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. **Application domain:** `n8n.hetnacnc.com`. **Session duration:** 24 hours.
3. **Policy:** Action **Allow**, regla **Emails** → tu correo.
4. **Exenciones (importante, o se rompen las automatizaciones):** crea una
   segunda aplicación para el mismo dominio con **Path** `webhook` (y otra para
   `webhook-test`) y política **Bypass** → **Everyone**. Por ahí llegan los
   avisos de la tienda, de Meta y de WhatsApp a n8n.
5. Repite para `whatsapp.hetnacnc.com` protegiendo sólo el panel (`/manager`).
   La tienda y n8n le hablan por la red interna de Docker, no por el dominio.
6. **Prueba:** abre `https://n8n.hetnacnc.com` en una ventana privada (debe pedir
   el código) y manda un mensaje de prueba por WhatsApp (debe seguir
   contestando).

Además, en n8n: **Settings** → **Personal** → **Enable 2FA**.

## 3. Repositorio de GitHub

Ver `docs/seguridad/guia-github.md` (verificación en dos pasos, repositorio
privado, proteger `main`).

## 4. Llave de cifrado de las llaves guardadas

Después de desplegar, para cifrar los tokens de Mercado Pago, Facturapi y redes
que se guardan en la base:

1. Genera la llave y **guárdala en tu gestor de contraseñas** antes de seguir.
   Si se pierde, todos los talleres tienen que volver a conectar Mercado Pago y
   Facturapi, y tú las redes.
   ```bash
   openssl rand -hex 32
   ```
2. Agrégala al `.env` del API como `LLAVES_CIFRADO=...` y reinicia el API
   pasándola también a pm2 (ver el mensaje de entrega).
3. Prueba en seco, sin cambiar nada:
   ```bash
   cd ~/hetnacnc/packages/api && NODE_ENV=production bunx medusa exec ./src/scripts/cifrar-llaves.ts
   ```
4. Si los números se ven bien, lo mismo con `APLICAR=1` al inicio.

Una vez cifrado, no regreses a una versión del código anterior a este cambio:
no sabría leer los tokens.

## 5. Usuario propio para la tienda (en lugar de root)

Hoy la tienda y el API corren como `root`. Si alguien encontrara una falla en el
código, tendría el servidor completo. Lo ideal es un usuario sin privilegios,
pero el cambio toca pm2, permisos de carpetas, Docker y el script de despliegue,
y un error deja el sitio abajo. Recomendación: hacerlo en una ventana de
mantenimiento, con el respaldo recién probado. Pídelo cuando quieras y se
prepara paso a paso.

## 6. Decisiones pendientes del Cotizador

- **Carpeta `catalogos` pública:** cualquiera con la liga exacta abre un
  catálogo. Hacerla privada rompe las ligas que ya se mandaron a clientes.
  Decide si importa (¿hay listas de precios que no quieres que circulen?).
- **Referidos:** hoy se premia al registrar al invitado; se puede abusar con
  cuentas falsas (hasta 12 meses gratis). Propuesta: premiar cuando el invitado
  paga su primer mes.
- **Token de WhatsApp y llaves de WooCommerce:** la app los lee de la base.
  Moverlos al servidor necesita una versión nueva de la app; las versiones
  viejas (APK instaladas a mano) dejarían de poder usar esas funciones.
- **Auditar las tablas que faltan:** unas 20 tablas y 10 funciones del Cotizador
  no están en el repositorio. El respaldo diario ya trae su estructura
  (`/root/respaldos/supabase-cotizador-*.sql.gz`); se puede revisar desde ahí.
