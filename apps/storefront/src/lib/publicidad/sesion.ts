// Verifica que quien llama sea administrador del /dashboard (solo servidor).
// No guardamos contraseñas ni creamos otra sesión: reutilizamos la del dashboard.
// El dashboard manda su sesión por cookie o por token; se la preguntamos a Medusa (/admin/users/me).

export const urlBackend = () =>
  (process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000").replace(
    /\/$/,
    ""
  )

/**
 * Si la petición viene de un administrador válido, devuelve las cabeceras que sirven para
 * hablar con Medusa en su nombre (token o cookie). Si no, devuelve null.
 */
export async function autorizacion(req: Request): Promise<Record<string, string> | null> {
  const intentos: Record<string, string>[] = []
  const bearer = req.headers.get("authorization")
  if (bearer && /^Bearer\s+\S+/i.test(bearer)) intentos.push({ authorization: bearer })
  const cookie = req.headers.get("cookie")
  if (cookie) intentos.push({ cookie })

  for (const h of intentos) {
    try {
      const r = await fetch(`${urlBackend()}/admin/users/me`, { headers: h, cache: "no-store" })
      if (r.ok) return h
    } catch {
      // intenta con la siguiente forma de autenticación
    }
  }
  return null
}
