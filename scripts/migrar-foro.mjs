#!/usr/bin/env node
// Migraciones de la base del foro (la de HETNA_FORO_DB, separada de Medusa).
//
// Corre, en orden, cada infra/foro/migracion-*.sql que todavía no se haya
// aplicado, y anota cuáles ya corrieron en foro.migraciones para no repetirlas
// (repetir la del 29 de octubre cuando ya hay vacantes o eventos fallaría).
// Cada archivo va en su propia transacción: si uno falla, no queda a medias.
//
// La conexión sale de HETNA_FORO_DB (o HETNA_TALLER_DB) del entorno o, si no
// está, de packages/api/.env. Nunca se imprime.
//
//   node scripts/migrar-foro.mjs          # falla con código 1 si algo sale mal
//   node scripts/migrar-foro.mjs --suave  # para el deploy: avisa y sigue
import { readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..")
const suave = process.argv.includes("--suave")
const { Client } = createRequire(join(raiz, "packages/api/package.json"))("pg")

function conexion() {
  const delEntorno = process.env.HETNA_FORO_DB || process.env.HETNA_TALLER_DB
  if (delEntorno) return delEntorno
  try {
    const env = readFileSync(join(raiz, "packages/api/.env"), "utf8")
    const linea = env.match(/^\s*(?:HETNA_FORO_DB|HETNA_TALLER_DB)\s*=\s*(.+)\s*$/m)
    return linea ? linea[1].trim().replace(/^(['"])(.*)\1$/, "$2") : ""
  } catch {
    return ""
  }
}

async function main() {
  const url = conexion()
  if (!url) throw new Error("no encontré HETNA_FORO_DB (ni en el entorno ni en packages/api/.env)")

  const carpeta = join(raiz, "infra/foro")
  const archivos = readdirSync(carpeta)
    .filter((f) => /^migracion-.*\.sql$/.test(f))
    .sort()

  const c = new Client({ connectionString: url, connectionTimeoutMillis: 15000 })
  await c.connect()
  try {
    const esquema = await c.query(`select to_regnamespace('foro') is not null as hay`)
    if (!esquema.rows[0].hay) throw new Error("la base no tiene el esquema foro: corre primero apps/storefront/src/lib/foro/esquema.sql")
    await c.query(`create table if not exists foro.migraciones (nombre text primary key, aplicada timestamptz not null default now())`)
    await c.query(`alter table foro.migraciones enable row level security`)
    const hechas = new Set((await c.query(`select nombre from foro.migraciones`)).rows.map((f) => f.nombre))

    let nuevas = 0
    for (const f of archivos) {
      if (hechas.has(f)) continue
      const sql = readFileSync(join(carpeta, f), "utf8")
      try {
        await c.query("begin")
        await c.query(sql)
        await c.query(`insert into foro.migraciones (nombre) values ($1)`, [f])
        await c.query("commit")
      } catch (e) {
        await c.query("rollback").catch(() => {})
        throw new Error(`${f}: ${e.message}`)
      }
      console.log(`   ✓ ${f}`)
      nuevas++
    }

    const r = await c.query(
      `select (select count(*) from foro.secciones)::int as secciones,
              to_regclass('foro.seguimientos') is not null as red,
              to_regclass('foro.avisos') is not null as avisos`
    )
    const { secciones, red, avisos } = r.rows[0]
    console.log(
      `   ${nuevas ? `${nuevas} migración(es) aplicadas` : "Ya estaba al día"} · ${secciones} secciones · red ${red ? "sí" : "no"} · avisos ${avisos ? "sí" : "no"}`
    )
  } finally {
    await c.end()
  }
}

main().catch((e) => {
  console.error(`   ✗ Migraciones del foro: ${e.message}`)
  if (suave) {
    console.error("     El sitio sigue funcionando; el foro sólo no tendrá lo nuevo hasta que esto se corrija.")
    process.exit(0)
  }
  process.exit(1)
})
