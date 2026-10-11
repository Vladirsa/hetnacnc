// Marca talleres: fundador (insignia + plan Pro 6 meses), prueba (oculto al público) o quitar-prueba.
// Uso (desde packages/api): node ../../scripts/talleres-flags.cjs fundador <handle>
//                           node ../../scripts/talleres-flags.cjs prueba <handle>
//                           node ../../scripts/talleres-flags.cjs quitar-prueba <handle>
//                           node ../../scripts/talleres-flags.cjs lista
const fs = require("fs")
const path = require("path")
const { Client } = require(process.env.PG_MOD || "pg")

const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8")
const m = env.match(/^DATABASE_URL=(.*)$/m)
if (!m) { console.error("No encontré DATABASE_URL en .env (corre esto desde packages/api)"); process.exit(1) }
const url = m[1].trim().replace(/^["']|["']$/g, "")
const [accion, handle] = process.argv.slice(2)

;(async () => {
  const c = new Client({ connectionString: url })
  await c.connect()
  const set = (obj) =>
    c.query("update seller set metadata = coalesce(metadata, '{}'::jsonb) || $1::jsonb where handle = $2 and deleted_at is null", [JSON.stringify(obj), handle])
  let r
  if (accion === "fundador") {
    const vence = new Date(); vence.setMonth(vence.getMonth() + 6)
    r = await set({ fundador: true, plan: "pro", plan_vence: vence.toISOString().slice(0, 10) })
  } else if (accion === "prueba") {
    r = await set({ prueba: true })
  } else if (accion === "quitar-prueba") {
    r = await set({ prueba: false })
  } else if (accion !== "lista") {
    console.error("Acción no válida. Usa: fundador | prueba | quitar-prueba | lista"); process.exit(1)
  }
  if (r) console.log(r.rowCount ? `Listo: ${accion} -> ${handle}` : `No encontré el taller "${handle}"`)
  const v = await c.query(
    "select handle, name, coalesce((metadata->>'fundador')::boolean, false) fundador, metadata->>'plan' plan, metadata->>'plan_vence' vence, coalesce((metadata->>'prueba')::boolean, false) prueba from seller where deleted_at is null order by created_at")
  console.table(v.rows)
  await c.end()
})().catch((e) => { console.error("ERROR", e.message); process.exit(1) })
