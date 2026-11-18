// Secreto con el que se firman las ligas que llegan por correo: confirmar el
// correo de una cuenta (lib/verificar-correo.ts), confirmar y aprobar un taller
// (lib/alta-taller.ts) y darse de baja de las promociones (lib/baja.ts).
//
// Misma guarda que lib/archivo-acceso.ts: sin secreto, o con el "supersecret"
// que Medusa trae de fábrica, cualquiera podría fabricar una liga. En ese caso
// no se firma ni se acepta ninguna (falla cerrado) y queda el error en el log.
// No lanza: el servidor arranca igual y lo demás sigue funcionando.
let avisado = 0

export function secretoLigas(): string | null {
  const s = process.env.BAJA_SECRET || process.env.COOKIE_SECRET || process.env.JWT_SECRET || ""
  if (s && s !== "supersecret") return s
  // Una vez por hora, para que se vea en el log sin llenarlo
  if (Date.now() - avisado > 3600_000) {
    avisado = Date.now()
    console.error(
      "[secreto-ligas] NO SE PUEDEN FIRMAR NI VALIDAR LIGAS DE CORREO (confirmar correo, aprobar taller, baja): " +
        'falta BAJA_SECRET (o COOKIE_SECRET / JWT_SECRET) o vale "supersecret". Pon un secreto propio en el .env del API.'
    )
  }
  return null
}
