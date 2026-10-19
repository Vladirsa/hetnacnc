// Avisa al servidor que un anuncio se mostró (solo navegador). Una vez por anuncio y por sesión.

export function registrarVistas(ids: string[]) {
  if (typeof window === "undefined" || !ids.length) return
  try {
    const clave = "hetna_pub_vistos"
    const vistos: string[] = JSON.parse(sessionStorage.getItem(clave) || "[]")
    const nuevos = ids.filter((i) => !vistos.includes(i))
    if (!nuevos.length) return
    sessionStorage.setItem(clave, JSON.stringify([...vistos, ...nuevos].slice(-100)))
    fetch("/api/pub/vista", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: nuevos }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // sin almacenamiento del navegador: simplemente no contamos
  }
}
