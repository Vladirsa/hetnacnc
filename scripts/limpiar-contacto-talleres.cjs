// Quita whatsapp/lat/lng del perfil público de los talleres (con respaldo).
// Uso: cd packages/api && node ../../scripts/limpiar-contacto-talleres.cjs
const fs = require("fs")
const path = require("path")
const { Client } = require(require.resolve("pg", { paths: [process.cwd()] }))

const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8")
const m = env.match(/^DATABASE_URL=(.*)$/m)
if (!m) { console.error("No encontré DATABASE_URL en .env"); process.exit(1) }
const url = m[1].trim().replace(/^["']|["']$/g, "")

;(async () => {
  const c = new Client({ connectionString: url })
  await c.connect()
  await c.query("create table if not exists seller_metadata_bak_20261007 as select id, metadata from seller")
  const r = await c.query(
    "update seller set metadata = jsonb_set(metadata, '{perfil}', (metadata->'perfil') - 'whatsapp' - 'lat' - 'lng') where jsonb_typeof(metadata->'perfil')='object'"
  )
  console.log("Talleres actualizados:", r.rowCount)
  const v = await c.query(
    "select handle, metadata->'perfil'->>'ciudad' as ciudad, coalesce((metadata->'perfil') ? 'whatsapp', false) as tiene_wa from seller"
  )
  console.table(v.rows)
  await c.end()
})().catch((e) => { console.error("ERROR", e.message); process.exit(1) })
