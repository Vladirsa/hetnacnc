// Cuenta (sin cambiar nada) lo que queda en los dos cotizadores viejos antes
// de retirarlos (Fase 3: la app del Cotizador en Supabase es la única fuente):
//   A) módulo Medusa "cotizador": cotizador_perfil, cotizador_cotizacion, cotizador_partida
//   B) esquema taller.* en la base de HETNA_TALLER_DB (cotizador rápido)
//
// Uso en el servidor:
//   cd /root/hetnacnc/packages/api && NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/contar-cotizador-viejo.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Pool } from "pg"

async function contar(q: () => Promise<any>, etiqueta: string) {
  try {
    const r = await q()
    console.log(`  ${etiqueta}: ${JSON.stringify(r)}`)
  } catch (e) {
    console.log(`  ${etiqueta}: no se pudo leer (${(e as Error).message.slice(0, 120)})`)
  }
}

export default async function contarCotizadorViejo({ container }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  console.log("\nA) Módulo Medusa 'cotizador'")
  await contar(async () => (await knex.raw("select count(*)::int n, count(*) filter (where coalesce(plan,'gratis') <> 'gratis')::int con_plan, count(*) filter (where plan_hasta > now() or prueba_hasta > now())::int vigentes from cotizador_perfil where deleted_at is null")).rows[0], "perfiles")
  await contar(async () => (await knex.raw("select count(*)::int n, max(created_at) ultima, count(*) filter (where created_at > now() - interval '90 days')::int ultimos_90_dias from cotizador_cotizacion where deleted_at is null")).rows[0], "cotizaciones")
  await contar(async () => (await knex.raw("select count(*)::int n from cotizador_partida where deleted_at is null")).rows[0], "partidas")
  await contar(async () => (await knex.raw("select p.plan, count(*)::int n from cotizador_perfil p where p.deleted_at is null group by 1 order by 2 desc")).rows, "perfiles por plan")

  console.log("\nB) Esquema taller.* (cotizador rápido)")
  const url = process.env.HETNA_TALLER_DB
  if (!url) {
    console.log("  HETNA_TALLER_DB no está configurada: no hay cotizador rápido que contar.")
  } else {
    const pool = new Pool({ connectionString: url, max: 1 })
    await contar(async () => (await pool.query("select count(*)::int n, max(creado) ultima from taller.cuentas")).rows[0], "cuentas")
    await contar(async () => (await pool.query("select count(*)::int n, max(creado) ultima, count(*) filter (where creado > now() - interval '90 days')::int ultimos_90_dias from taller.cotizaciones")).rows[0], "cotizaciones")
    await contar(async () => (await pool.query("select count(*)::int n from taller.copiloto")).rows[0], "copiloto")
    await pool.end()
  }
  console.log("\nListo. No se cambió nada.\n")
}
