// Consentimiento de cookies (solo navegador).
//
// "necesarias": sesión, carrito, idioma y esta misma decisión. No se pueden apagar.
// "todas": además, estadística (Google Analytics) y publicidad (Meta Pixel).
//
// Las de estadística y publicidad NO se cargan hasta que la persona las acepta.
// Si el navegador manda Global Privacy Control o Do Not Track, se toma como
// rechazo y ni siquiera se muestra el aviso (ya dijo que no).
export const COOKIE_CONSENTIMIENTO = "hetna_cookies"
export const EVENTO_CONSENTIMIENTO = "hetna-consentimiento"
export const EVENTO_ABRIR_PREFERENCIAS = "hetna-abrir-cookies"

export type Consentimiento = "todas" | "necesarias"

export const senalNoRastrear = (): boolean => {
  try {
    const n = navigator as Navigator & { globalPrivacyControl?: boolean }
    return n.globalPrivacyControl === true || n.doNotTrack === "1"
  } catch {
    return false
  }
}

export const leerConsentimiento = (): Consentimiento | null => {
  try {
    const c = document.cookie.split("; ").find((x) => x.startsWith(COOKIE_CONSENTIMIENTO + "="))
    const v = c?.split("=")[1]
    return v === "todas" || v === "necesarias" ? v : null
  } catch {
    return null
  }
}

// ¿Se pueden cargar estadística y publicidad?
export const permiteRastreo = (): boolean => leerConsentimiento() === "todas" && !senalNoRastrear()

// Cookies que dejan Google Analytics y Meta Pixel
const COOKIES_RASTREO = /^(_ga|_gid|_gat|_fbp|_fbc)/

export const guardarConsentimiento = (v: Consentimiento) => {
  try {
    const seguro = location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `${COOKIE_CONSENTIMIENTO}=${v}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${seguro}`
    if (v === "necesarias") {
      // Si antes había aceptado, se borran las cookies de rastreo que ya existan
      const dominio = location.hostname.replace(/^www\./, "")
      for (const par of document.cookie.split("; ")) {
        const nombre = par.split("=")[0]
        if (!COOKIES_RASTREO.test(nombre)) continue
        for (const d of ["", `; Domain=.${dominio}`, `; Domain=${dominio}`]) {
          document.cookie = `${nombre}=; Path=/; Max-Age=0${d}`
        }
      }
    }
    window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMIENTO, { detail: v }))
  } catch {
    /* sin cookies disponibles: el sitio sigue funcionando, solo no se guarda la decisión */
  }
}

export const abrirPreferenciasCookies = () => {
  try {
    window.dispatchEvent(new Event(EVENTO_ABRIR_PREFERENCIAS))
  } catch {
    /* nada */
  }
}
