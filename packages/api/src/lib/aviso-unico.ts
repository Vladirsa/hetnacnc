// Avisos de pago (Mercado Pago): un mismo pago llega casi siempre dos veces al
// mismo tiempo (webhook `type=payment` e IPN `topic=payment`), y ahora que los
// avisos responden 500 cuando algo falla, Mercado Pago también los reintenta.
// Si dos avisos del mismo pago se procesan a la vez, los dos leen el estado
// anterior y se duplican pedidos y correos (auditoría Thermos, 15 nov 2026).
//
// El API corre en un solo proceso (pm2), así que basta con que el segundo
// aviso espere al primero. Cuando éste termina, el segundo ya ve el pago
// anotado y no repite nada (los procesos son idempotentes en serie).
const enCurso = new Map<string, Promise<unknown>>()

export async function unaVezALaVez<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  // Espera a que termine el que ya está corriendo con esa clave (salga bien o mal)
  while (enCurso.has(clave)) {
    await enCurso.get(clave)!.catch(() => undefined)
  }
  const p = fn()
  enCurso.set(clave, p)
  try {
    return await p
  } finally {
    if (enCurso.get(clave) === p) enCurso.delete(clave)
  }
}

/** ¿El error de Mercado Pago es definitivo (el pago no existe o no es nuestro)? Entonces no se reintenta. */
export const errorDefinitivo = (e: unknown) => {
  const s = Number((e as { status?: number })?.status)
  return s === 404 || s === 401 || s === 403
}
