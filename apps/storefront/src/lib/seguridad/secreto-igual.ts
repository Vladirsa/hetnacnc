import { timingSafeEqual } from "crypto"

/** Compara un secreto en tiempo constante (que no se pueda adivinar midiendo cuánto tarda). */
export function secretoIgual(recibido: string | null | undefined, esperado: string): boolean {
  const a = Buffer.from(String(recibido ?? ""))
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}
