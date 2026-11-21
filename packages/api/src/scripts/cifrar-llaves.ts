// Cifra las llaves de terceros que ya están guardadas en texto plano
// (lib/cifrado-llaves.ts):
//   - Supabase del Cotizador: negocios_mp (access_token, refresh_token) y
//     negocios_facturapi (llave_prueba, llave_real).
//   - Configuración del Social Hub (hetna_social_config): tokens de TikTok,
//     Pinterest y Google (access, refresh) y el renovado de Threads (token).
//
// EN SECO por defecto: sólo cuenta cuántas hay en claro y cuántas cifradas
// por tabla (nunca enseña valores). Para escribir de verdad: APLICAR=1.
//
//   NODE_ENV=production bunx medusa exec ./src/scripts/cifrar-llaves.ts
//   APLICAR=1 NODE_ENV=production bunx medusa exec ./src/scripts/cifrar-llaves.ts
//
// Antes de correrlo con APLICAR=1:
//   1. El código que ya descifra debe estar desplegado (si no, el API viejo
//      leería "enc:v1:..." como si fuera el token y fallarían los cobros).
//   2. LLAVES_CIFRADO puesta en el .env del API (la misma que usa pm2) y
//      guardada también fuera del servidor.
// Se niega a correr sin llave válida. Se puede correr varias veces: lo ya
// cifrado se salta. Cada valor se comprueba (descifrar(cifrar(x)) === x)
// antes de escribirlo, y la fila sólo se toca si nadie la cambió mientras.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { cifradoListo, cifrar, descifrar, estaCifrado } from "../lib/cifrado-llaves"
import { supa } from "../lib/cotizador-suscripciones"

type Conteo = { plano: number; cifrado: number; ilegibles: number; vacio: number; escritas: number; saltadas: number }
const nuevoConteo = (): Conteo => ({ plano: 0, cifrado: 0, ilegibles: 0, vacio: 0, escritas: 0, saltadas: 0 })

const TABLAS_SUPABASE = [
  { tabla: "negocios_mp", campos: ["access_token", "refresh_token"] },
  { tabla: "negocios_facturapi", campos: ["llave_prueba", "llave_real"] },
] as const

const T_CONFIG_S = "hetna_social_config"
const CLAVES_SOCIAL: Record<string, string[]> = {
  tiktok: ["access", "refresh"],
  pinterest: ["access", "refresh"],
  google: ["access", "refresh"],
  threads: ["token"],
}

/** Cifra y comprueba la ida y vuelta; si no cuadra, no se escribe nada. */
function cifrarComprobado(valor: string): string {
  const enc = cifrar(valor)
  if (!estaCifrado(enc) || descifrar(enc) !== valor) throw new Error("la comprobación de cifrado no cuadró; no se escribió nada")
  return enc
}

function contar(c: Conteo, v: unknown) {
  if (typeof v !== "string" || v === "") c.vacio++
  else if (estaCifrado(v)) {
    c.cifrado++
    // Que se pueda leer con la llave actual o la anterior (si no, ese token
    // ya no sirve y hay que volver a conectar la cuenta)
    try {
      descifrar(v)
    } catch {
      c.ilegibles++
    }
  } else c.plano++
}

async function supabase(aplicar: boolean, logger: any) {
  if (!process.env.COTIZADOR_SUPABASE_SERVICE_KEY) {
    logger.warn("Supabase del Cotizador: falta COTIZADOR_SUPABASE_SERVICE_KEY; se salta.")
    return
  }
  for (const { tabla, campos } of TABLAS_SUPABASE) {
    const conteos: Record<string, Conteo> = Object.fromEntries(campos.map((c) => [c, nuevoConteo()]))
    const errores: string[] = []
    const LOTE = 200
    let desde = 0
    try {
      for (;;) {
        // Sólo lo necesario: id, los campos secretos y la marca de cambio
        const filas = await supa<any[]>(
          `/rest/v1/${tabla}?select=negocio_id,actualizado,${campos.join(",")}&order=negocio_id.asc&limit=${LOTE}&offset=${desde}`
        )
        for (const f of filas || []) {
          for (const c of campos) contar(conteos[c], f[c])
          if (!aplicar) continue
          const cambios: Record<string, string> = {}
          for (const c of campos) if (typeof f[c] === "string" && f[c] !== "" && !estaCifrado(f[c])) cambios[c] = cifrarComprobado(f[c])
          if (!Object.keys(cambios).length) continue
          // Nunca se filtra por el token (iría en la URL): se filtra por la
          // fila y su "actualizado"; si alguien la cambió mientras, se salta.
          const marca = f.actualizado ? `actualizado=eq.${encodeURIComponent(f.actualizado)}` : "actualizado=is.null"
          try {
            const r = await supa<any[]>(`/rest/v1/${tabla}?negocio_id=eq.${encodeURIComponent(f.negocio_id)}&${marca}`, {
              method: "PATCH",
              headers: { Prefer: "return=representation" },
              body: JSON.stringify(cambios),
            })
            const n = Array.isArray(r) ? r.length : 0
            for (const c of Object.keys(cambios)) conteos[c][n ? "escritas" : "saltadas"]++
          } catch (e) {
            // Sólo el código HTTP: el cuerpo de un error de Postgres puede traer la fila
            errores.push(`${f.negocio_id}: ${/Supabase (\d+)/.exec(String((e as Error).message))?.[1] || "error"}`)
          }
        }
        if (!filas || filas.length < LOTE) break
        desde += LOTE
      }
    } catch (e) {
      const m = String((e as Error).message)
      if (/42P01|does not exist|PGRST205|Could not find the table/i.test(m)) {
        logger.info(`${tabla}: la tabla no existe en Supabase; nada que hacer.`)
        continue
      }
      logger.error(`${tabla}: no se pudo leer (${/Supabase (\d+)/.exec(m)?.[0] || "error de red"})`)
      continue
    }
    for (const c of campos) {
      const k = conteos[c]
      logger.info(`${tabla}.${c}: ${k.plano} en claro, ${k.cifrado} cifradas${k.ilegibles ? ` (${k.ilegibles} NO se pueden leer con las llaves actuales)` : ""}, ${k.vacio} vacías${aplicar ? `; cifradas ahora ${k.escritas}, saltadas por cambio ${k.saltadas}` : ""}`)
    }
    for (const e of errores) logger.error(`${tabla}: no se pudo escribir la fila ${e}`)
  }
}

async function configSocial(knex: any, aplicar: boolean, logger: any) {
  if (!(await knex.schema.hasTable(T_CONFIG_S))) {
    logger.info(`${T_CONFIG_S}: la tabla no existe; nada que hacer.`)
    return
  }
  const filas = await knex(T_CONFIG_S).whereIn("clave", Object.keys(CLAVES_SOCIAL)).select("clave", "valor")
  for (const clave of Object.keys(CLAVES_SOCIAL)) {
    const fila = filas.find((f: any) => f.clave === clave)
    const valor = fila?.valor || {}
    for (const campo of CLAVES_SOCIAL[clave]) {
      const k = nuevoConteo()
      const v = valor[campo]
      contar(k, v)
      if (aplicar && typeof v === "string" && v !== "" && !estaCifrado(v)) {
        const enc = cifrarComprobado(v)
        // Sólo ese campo, y sólo si sigue igual (el valor va como parámetro, no en el texto)
        const r = await knex.raw(
          `update ?? set valor = jsonb_set(valor, ?::text[], to_jsonb(?::text)) where clave = ? and valor->>(?::text) = ?::text`,
          [T_CONFIG_S, `{${campo}}`, enc, clave, campo, v]
        )
        k[(r?.rowCount || 0) > 0 ? "escritas" : "saltadas"]++
      }
      logger.info(`${T_CONFIG_S}[${clave}].${campo}: ${k.plano} en claro, ${k.cifrado} cifradas${k.ilegibles ? ` (${k.ilegibles} NO se pueden leer con las llaves actuales)` : ""}, ${k.vacio} vacías${aplicar ? `; cifradas ahora ${k.escritas}, saltadas por cambio ${k.saltadas}` : ""}`)
    }
  }
}

export default async function cifrarLlaves({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!cifradoListo()) {
    logger.error("Falta LLAVES_CIFRADO (o no tiene formato válido: 32 bytes, openssl rand -hex 32). No se hace nada.")
    process.exitCode = 1
    return
  }
  const aplicar = process.env.APLICAR === "1"
  logger.info(aplicar ? "=== CIFRANDO (APLICAR=1) ===" : "=== EN SECO: sólo cuenta, no escribe (para cifrar: APLICAR=1) ===")
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await supabase(aplicar, logger)
  await configSocial(knex, aplicar, logger)
  logger.info("Listo.")
}
