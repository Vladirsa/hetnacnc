# Retiro del cotizador viejo (Fase 3, 23 nov 2026)

La app del Cotizador (Supabase) es la única fuente de cotizaciones de los
talleres (decisión 3 del informe `analisis-sap-fase0.md`). Se retiraron dos
sistemas viejos:

| | Qué era | Qué pasó |
|---|---|---|
| Módulo Medusa `cotizador` | Perfil del taller y cotizaciones con PDF (`/store/cotizador/*`) | Se quitó el código. Las ligas viejas `/cotizacion/<token>` muestran un aviso. La tarjeta "Tus cotizaciones" del tablero del vendedor ya no sale. |
| Esquema `taller.*` | Cuenta y cotizaciones del cotizador rápido | Se quitó la conexión. El cotizador rápido de `/servicios/cotizador-cnc` sigue (modo demostración: calcula en el navegador y no guarda). "Traer precios de mi cotizador" del generador de muebles usa los precios de este navegador. |

**Las tablas NO se borraron.** Mientras exista `cotizador_perfil`, quien tenga
ahí un plan vigente sigue con descargas gratis sin límite
(`lib/descargas-gratis.ts`).

## 1. Contar lo que queda (no cambia nada)

```bash
cd /root/hetnacnc/packages/api && NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/contar-cotizador-viejo.ts
```

## 2. Respaldar (antes de borrar)

```bash
cd /root/hetnacnc/packages/api && set -a && . ./.env && set +a
pg_dump "$DATABASE_URL" -t cotizador_perfil -t cotizador_cotizacion -t cotizador_partida > ~/respaldo-cotizador-medusa-$(date +%F).sql
pg_dump "$HETNA_TALLER_DB" -n taller > ~/respaldo-taller-$(date +%F).sql
```

## 3. Borrar (sólo con los respaldos hechos y revisados)

Base de Medusa (`DATABASE_URL`):

```sql
drop table if exists cotizador_partida, cotizador_cotizacion, cotizador_perfil cascade;
delete from mikro_orm_migrations where name in ('Migration20261018225924', 'Migration20261019003244');
```

Base de `HETNA_TALLER_DB` (**sólo el esquema taller**: la misma base guarda el
foro y el chat en `foro.*` y `chat.*`, que se quedan):

```sql
drop schema if exists taller cascade;
```

Después se pueden archivar `hetna/taller-001.sql` y `hetna/copiloto-001.sql`.
