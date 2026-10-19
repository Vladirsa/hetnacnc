// Copia las cuentas y cotizaciones del esquema `taller` (hetna/taller-001.sql,
// el cotizador que ya está vivo y habla SQL directo desde el storefront) a las
// tablas del módulo cotizador.
//
// NO BORRA NADA del esquema viejo: sólo lee. El esquema `taller` se queda
// intacto hasta que compruebes que lo nuevo funciona.
//
// Corre EN SECO por defecto: cuenta lo que haría y no escribe. Para que
// escriba de verdad hay que pasarle la palabra `aplicar` (sin guiones: el CLI
// de Medusa se queda con los flags que empiezan con -- y no llegan aquí).
//
//   ./node_modules/.bin/medusa exec ./src/scripts/migrar-taller-a-cotizador.ts
//   ./node_modules/.bin/medusa exec ./src/scripts/migrar-taller-a-cotizador.ts aplicar
//
// Se puede correr varias veces: salta los perfiles cuyo customer_id ya existe
// y las cotizaciones cuyo folio ya está en ese perfil.
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { randomBytes } from "node:crypto"

import { COTIZADOR_MODULE } from "../modules/cotizador"
import CotizadorModuleService from "../modules/cotizador/service"

// El estado viejo tiene tres valores; el nuevo distingue además "vista" y
// "vencida", que el viejo nunca supo. Perdida -> rechazada es la única
// traducción con pérdida: el viejo no separaba "me dijeron que no" de "se
// venció", y no hay forma de recuperar esa diferencia.
const ESTADOS: Record<string, string> = {
  Enviada: "enviada",
  Aceptada: "aceptada",
  Perdida: "rechazada",
}

export default async function migrarTallerACotizador({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const cotizadorModuleService = container.resolve<CotizadorModuleService>(COTIZADOR_MODULE)

  const aplicar = (args || []).includes("aplicar")

  const existeEsquema = await pg.raw(
    `select 1 from information_schema.tables where table_schema = 'taller' and table_name = 'cuentas' limit 1`
  )
  if (!existeEsquema?.rows?.length) {
    logger.error(
      "No existe taller.cuentas en esta base. Este script corre donde vive el esquema viejo (el VPS), no en un entorno limpio."
    )
    return
  }

  logger.info(aplicar ? "=== MIGRACIÓN REAL (aplicar) ===" : "=== EN SECO: no se escribe nada ===")

  const { rows: cuentas } = await pg.raw(`select * from taller.cuentas order by creado asc`)
  logger.info(`Cuentas en el esquema viejo: ${cuentas.length}`)

  let perfilesCreados = 0
  let perfilesSaltados = 0
  let cotizacionesCreadas = 0
  let cotizacionesSaltadas = 0
  const clavesConfigSinMapear = new Set<string>()

  for (const cuenta of cuentas) {
    const [perfilExistente] = await cotizadorModuleService.listTallerPerfils({
      customer_id: cuenta.customer_id,
    })

    let perfilId = perfilExistente?.id

    if (perfilExistente) {
      perfilesSaltados++
    } else {
      const config = (cuenta.config || {}) as Record<string, unknown>
      for (const clave of Object.keys(config)) {
        clavesConfigSinMapear.add(clave)
      }

      const datosPerfil = {
        customer_id: cuenta.customer_id,
        nombre_comercial: cuenta.nombre_taller || cuenta.correo || "Taller sin nombre",
        nombre_contacto: cuenta.nombre_contacto || null,
        correo: cuenta.correo || null,
        whatsapp: cuenta.whatsapp || null,
        plan: cuenta.plan || "gratis",
        plan_hasta: cuenta.plan_hasta || null,
        prueba_hasta: cuenta.prueba_hasta || null,
        uso_mes: cuenta.uso_mes || null,
        uso_n: Number(cuenta.uso_n) || 0,
        // El folio viejo es el PRÓXIMO número a usar; el nuevo guarda el
        // último consumido. De ahí el -1, para que no se salte un número.
        folio_consecutivo: Math.max(0, (Number(cuenta.folio) || 1) - 1),
        folio_prefijo: "COT",
        // config trae tarifas, costos, materiales, logo y condiciones en una
        // forma que este script no conoce. Se guarda completo bajo __origen
        // en vez de adivinar: no choca con las claves de servicio que lee
        // cfgDeTaller y así no se pierde nada mientras se mapea bien.
        tarifas: Object.keys(config).length ? { __origen: config } : null,
      }

      if (aplicar) {
        const [creado] = await cotizadorModuleService.createTallerPerfils([datosPerfil as any])
        perfilId = creado.id
      }
      perfilesCreados++
    }

    const { rows: cotizaciones } = await pg.raw(
      `select * from taller.cotizaciones where customer_id = ? order by creado asc`,
      [cuenta.customer_id]
    )

    for (const vieja of cotizaciones) {
      if (perfilId) {
        const [yaExiste] = await cotizadorModuleService.listCotizacions({
          perfil_id: perfilId,
          folio: vieja.folio,
        })
        if (yaExiste) {
          cotizacionesSaltadas++
          continue
        }
      }

      const cantidad = Math.max(1, Number(vieja.cantidad) || 1)
      const total = Number(vieja.total_estandar) || 0
      const concepto = [vieja.servicio, vieja.tipo].filter(Boolean).join(" · ") || "Servicio"

      if (aplicar && perfilId) {
        const [cotizacion] = await cotizadorModuleService.createCotizacions([
          {
            perfil_id: perfilId,
            folio: vieja.folio,
            revision: "A",
            moneda: "MXN",
            fecha: vieja.creado,
            cliente_nombre: vieja.cliente_nombre || "Cliente sin nombre",
            cliente_telefono: vieja.cliente_tel || null,
            subtotal: total,
            total,
            estatus: ESTADOS[vieja.estado] || "enviada",
            token_publico: randomBytes(16).toString("hex"),
            notas_internas: vieja.mensaje || null,
            // Lo que el esquema viejo guardaba en jsonb y el nuevo todavía no
            // modela (las 3 opciones de precio, el archivo, el desglose).
            // Queda aquí para no perderlo.
            tecnico: {
              __origen: {
                opciones: vieja.opciones || [],
                elegida: vieja.elegida || null,
                archivo: vieja.archivo || null,
                datos: vieja.datos || {},
              },
            },
          } as any,
        ])

        await cotizadorModuleService.createCotizacionPartidas([
          {
            cotizacion_id: cotizacion.id,
            posicion: 1,
            concepto,
            cantidad,
            unidad: "pza",
            precio_unitario: Math.round((total / cantidad) * 100) / 100,
            subtotal: total,
          } as any,
        ])
      }

      cotizacionesCreadas++
    }
  }

  logger.info("---")
  logger.info(`Perfiles:     ${perfilesCreados} ${aplicar ? "creados" : "se crearían"}, ${perfilesSaltados} ya existían`)
  logger.info(
    `Cotizaciones: ${cotizacionesCreadas} ${aplicar ? "creadas" : "se crearían"}, ${cotizacionesSaltadas} ya existían`
  )

  if (clavesConfigSinMapear.size) {
    logger.info("---")
    logger.info(
      `Claves de taller.cuentas.config guardadas bajo tarifas.__origen sin mapear a columnas: ${[...clavesConfigSinMapear].join(", ")}`
    )
    logger.info("Pásaselas a Claude para mapearlas a los costos y tarifas tipados del perfil.")
  }

  if (!aplicar) {
    logger.info("---")
    logger.info("Nada se escribió. Vuelve a correrlo con `aplicar` al final cuando revises los números de arriba.")
  }
}
