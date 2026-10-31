import type { FieldValues, Resolver } from "react-hook-form"
import type { ZodType } from "zod"

/**
 * Reemplazo de zodResolver de @hookform/resolvers. La versión instalada (3.x)
 * no entiende los errores de zod 4: en lugar de devolverlos al formulario los
 * lanza, y el formulario se queda "sin hacer nada" y sin decir qué falta
 * (registro, inicio de sesión, direcciones, contraseña...). Éste usa
 * safeParseAsync y entrega cada error al campo que le toca, para que se vea en
 * rojo bajo el campo.
 */
export function zodResolver<T extends FieldValues = FieldValues>(schema: ZodType): Resolver<T> {
  return (async (values: T) => {
    const r = await schema.safeParseAsync(values)
    if (r.success) return { values: r.data as T, errors: {} }

    const errors: Record<string, any> = {}
    for (const issue of r.error.issues) {
      const ruta = issue.path.map(String)
      if (!ruta.length) continue
      // Anidado como lo espera react-hook-form: { direccion: { cp: {...} } }
      let nodo = errors
      for (const parte of ruta.slice(0, -1)) nodo = nodo[parte] ??= {}
      const ultimo = ruta[ruta.length - 1]
      if (!nodo[ultimo]) nodo[ultimo] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors }
  }) as unknown as Resolver<T>
}
