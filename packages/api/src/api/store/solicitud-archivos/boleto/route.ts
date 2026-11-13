import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// POST /store/solicitud-archivos/boleto  (RETIRADO)
//
// Daba al navegador un token de subida directa a Backblaze. Ese token de B2
// sirve para escribir CUALQUIER archivo del bucket durante 24 horas, y además
// la subida directa se salta la revisión de contenido y antivirus. Ahora todo
// se sube por POST /store/solicitud-archivos. Responde 410 para que un
// formulario viejo (abierto antes del cambio) use la subida por el servidor:
// lib/subir-archivo.ts sólo se rinde ante 400/413.
export const POST = async (_req: MedusaRequest, res: MedusaResponse) =>
  res.status(410).json({ message: "La subida directa ya no está disponible; se sube por el servidor." })
