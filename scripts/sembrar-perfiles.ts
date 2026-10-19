// Uso: cd ~/hetnacnc/packages/api && bun run ~/hetnacnc/scripts/sembrar-perfiles.ts
// Carga un perfil de EJEMPLO en los dos talleres actuales (solo si no tienen perfil).
// Reemplaza los datos por los reales desde el editor del panel /seller cuando exista.
const s = new Bun.SQL(process.env.DATABASE_URL as string)

const base = {
  ciudad: "Apizaco",
  estado: "Tlaxcala",
  lat: 19.4139,
  lng: -98.1428,
  entrega: "3 a 7 días",
  servicios: ["Corte CNC", "Grabado", "Fresado de madera"],
  capacidades: ["Corte de MDF y madera", "Grabado y tallado 2.5D", "Producción por lotes", "Cotización en 24 h"],
  maquinas: [{ nombre: "Router CNC 1530", area: "1500 x 3000 mm", detalle: "Spindle 3 kW, control Mach3" }],
  materiales: ["MDF", "Madera", "Acrílico", "Triplay"],
}

for (const handle of ["sasa", "hetna-cnc"]) {
  const [fila] = await s`select id, metadata from seller where handle = ${handle} and deleted_at is null`
  if (!fila) { console.log("no existe", handle); continue }
  if (fila.metadata?.perfil) { console.log("ya tiene perfil:", handle); continue }
  const nuevo = { ...(fila.metadata ?? {}), perfil: base }
  await s`update seller set metadata = ${JSON.stringify(nuevo)}::jsonb, updated_at = now() where id = ${fila.id}`
  console.log("perfil de ejemplo cargado:", handle)
}
await s.close()
