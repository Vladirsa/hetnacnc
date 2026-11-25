// POST /mx/planos/validar { plano } -> revisión de geometría (lib/planos/validar.ts)
// La usa el backend al guardar un plano nuevo (packages/api/src/lib/
// planos-biblioteca.ts). Con PLANOS_VALIDAR_SECRETO en el .env de la tienda,
// sólo acepta llamadas que traigan el mismo valor en x-hetna-secreto.
import { validarPlano } from "@/lib/planos/validar"
import type { Plano } from "@/lib/planos/modelos"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const secreto = process.env.PLANOS_VALIDAR_SECRETO
  if (secreto && req.headers.get("x-hetna-secreto") !== secreto) return Response.json({ message: "No autorizado" }, { status: 401 })
  const texto = await req.text()
  if (texto.length > 200_000) return Response.json({ message: "Plano demasiado grande" }, { status: 413 })
  let plano: Plano
  try {
    plano = (JSON.parse(texto) as { plano: Plano }).plano
  } catch {
    return Response.json({ message: "JSON no válido" }, { status: 400 })
  }
  if (!plano || !Array.isArray(plano.piezas) || plano.piezas.length > 80 || !Array.isArray(plano.pasos)) return Response.json({ ok: false, errores: ["El plano no tiene la forma esperada."], avisos: [] })
  try {
    return Response.json(validarPlano(plano), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return Response.json({ ok: false, errores: [`No se pudo revisar: ${(e as Error).message}`], avisos: [] })
  }
}
