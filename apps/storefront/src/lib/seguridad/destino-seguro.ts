// A dónde regresar después de iniciar sesión (?volver=/mx/...). Sólo rutas del
// mismo sitio. Auditoría de seguridad del 15 nov 2026: "/\evil.com" pasaba el
// chequeo de "empieza con / y no con //" y el navegador lo abre como
// https://evil.com (redirección abierta para phishing).
export function destinoSeguro(v: string | null | undefined, porOmision = "/user"): string {
  const s = String(v ?? "")
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || /[\u0000-\u001f\u007f]/.test(s)) return porOmision
  try {
    const base = "https://hetnacnc.com"
    const u = new URL(s, base)
    // Se revisa también la salida: new URL quita los segmentos "." y "..", y
    // "/.//evil.com" saldría como "//evil.com" (auditoría Thermos, 15 nov 2026)
    const out = u.pathname + u.search + u.hash
    return u.origin === base && !out.startsWith("//") && !out.includes("\\") ? out : porOmision
  } catch {
    return porOmision
  }
}
