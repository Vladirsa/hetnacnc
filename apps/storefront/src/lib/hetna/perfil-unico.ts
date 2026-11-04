// Un solo perfil del taller: liga /talleres/<handle> con su cotizador en
// línea /t/<slug> (mismo correo). GET /store/hetna-perfil-unico
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

async function leer(q: string) {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-perfil-unico?${q}`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 300 },
    })
    return res.ok ? await res.json() : {}
  } catch {
    return {}
  }
}

export async function cotizadorDeTaller(handle: string): Promise<string | null> {
  const r = await leer(`taller=${encodeURIComponent(handle)}`)
  return r?.en_linea?.slug || null
}

export async function tiendaDeCotizador(slug: string): Promise<string | null> {
  const r = await leer(`slug=${encodeURIComponent(slug)}`)
  return r?.tienda?.handle || null
}
