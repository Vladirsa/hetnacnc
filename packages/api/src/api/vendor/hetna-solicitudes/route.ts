import { T_CONTRA, asegurarVersiones } from "../../../lib/licitacion-versiones"
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  MOTIVOS_RESPUESTA,
  T_PROPUESTA,
  T_RESPUESTA,
  T_SOLICITUD,
  asegurarTablaRespuestas,
  asegurarTablas,
  folioTexto,
} from "../../../lib/licitacion"
import { servicioTalleres } from "../../../lib/alta-taller"
import { cupoLicitacion } from "../../../lib/licitacion-plan"
import { NOMBRE_ETAPA, asegurarSeguimiento, etapaDe } from "../../../lib/seguimiento"
import { asegurarPropuestaFormal } from "../../../lib/licitacion-propuesta"
import { T_INVITADO, asegurarPrivacidad, modalidadDe, relacionesTaller, tallerPuedeVer, trabajoParaTaller } from "../../../lib/licitacion-privacidad"
import { PCT_POR_PLAN, asegurarCobro, cuentaTaller, planComision } from "../../../lib/licitacion-cobro"
import { asegurarExtra, preguntasDe, rangoGanador } from "../../../lib/licitacion-extra"
import { aceptaCliente, filtroClientes, reputacionesClientes } from "../../../lib/trust"

// Panel del taller: solicitudes que puede cotizar (abiertas + las dirigidas a él)
// y las que ya cotizó. Nunca incluye datos de contacto del cliente.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  // Filtros del panel: por servicio y por estado de entrega. Sólo acotan lo
  // que está por cotizar; lo que el taller ya cotizó sale siempre.
  const servicio = String(req.query.servicio || "").trim().slice(0, 80)
  const estadoMx = String(req.query.estado_mx || "").trim().slice(0, 60)

  // "Ocultas" = las que este taller marcó como que no puede cotizar.
  const verOcultas = req.query.ocultas === "1"

  await asegurarTablas(knex)
  await asegurarTablaRespuestas(knex)
  await asegurarSeguimiento(knex)
  await asegurarCobro(knex)
  await asegurarExtra(knex)
  await asegurarPrivacidad(knex)
  await asegurarPropuestaFormal(knex)
  await asegurarVersiones(knex) // columna "version" y tabla de contraofertas
  const filas0 = (await knex(`${T_SOLICITUD} as s`)
    .leftJoin(`${T_PROPUESTA} as p`, function (this: any) {
      this.on("p.solicitud_id", "=", "s.id").andOn("p.seller_id", "=", knex.raw("?", [sellerId]))
    })
    .leftJoin(`${T_RESPUESTA} as r`, function (this: any) {
      this.on("r.solicitud_id", "=", "s.id").andOn("r.seller_id", "=", knex.raw("?", [sellerId]))
    })
    .where((q: any) =>
      q
        .where((a: any) =>
          a
            // Abiertas no privadas, o privadas a las que lo invitaron (Licitaciones 3.0)
            .where((b: any) =>
              b.where("s.modo", "abierta").andWhere((c: any) =>
                c
                  .whereNot("s.modalidad", "privada")
                  .orWhereExists(
                    knex(T_INVITADO).whereRaw(`${T_INVITADO}.solicitud_id = s.id`).where(`${T_INVITADO}.seller_id`, sellerId)
                  )
              )
            )
            .orWhere("s.taller_id", sellerId)
        )
        // Por cotizar = abierta y sin pasar su fecha de cierre (ver
        // recibePropuestas). Lo ya cotizado se ve siempre, aunque haya cerrado.
        .andWhere((a: any) =>
          a
            .where((x: any) =>
              x
                .where("s.estado", "abierta")
                .andWhere((c: any) => c.whereNull("s.cierra_en").orWhere("s.cierra_en", ">", knex.fn.now()))
                .modify((c: any) => {
                  // "Necesito más información" no la oculta: sigue pendiente.
                  if (!verOcultas) c.where((r: any) => r.whereNull("r.id").orWhere("r.motivo", "mas_info"))
                  if (servicio) c.whereRaw("s.trabajo->>'servicio' = ?", [servicio])
                  if (estadoMx) c.whereRaw("s.trabajo->>'estado_mx' = ?", [estadoMx])
                })
            )
            .orWhereNotNull("p.id")
        )
    )
    .orderBy("s.created_at", "desc")
    .limit(100)
    .select(
      "s.id", "s.folio", "s.modo", "s.taller_id", "s.estado", "s.trabajo", "s.cierra_en", "s.created_at",
      "s.modalidad", "s.privacidad", "s.contacto", "s.cliente_id",
      "s.etapa", "s.pago_estado", "s.paqueteria", "s.guia",
      "s.propuesta_elegida", "s.cobro", "s.comision_pct", "s.pagado",
      "p.id as p_id", "p.version as p_version", "p.precio", "p.dias", "p.vigencia_dias", "p.incluye_envio", "p.condiciones", "p.estado as p_estado", "p.anticipo_pct",
      "p.moneda", "p.materiales", "p.operaciones", "p.fecha_entrega", "p.condiciones_pago", "p.garantia", "p.observaciones", "p.adjuntos",
      "s.tipo", "s.solo_verificados",
      "r.motivo as r_motivo", "r.nota as r_nota"
    )) as any[]

  // Relación de este taller con cada una (invitado, acceso, propuso, ganó)
  const relaciones = await relacionesTaller(knex, filas0, sellerId)
  // Fase 2: el proveedor ve suministro; el taller, fabricación; "ambos", todo.
  // Lo que ya cotizó o lo dirigido a él se ve siempre.
  const yo = await knex("seller").where({ id: sellerId }).first("metadata").catch(() => null)
  const miTipo = String(yo?.metadata?.perfil?.tipo_cuenta || "taller")
  const meToca = (f: any) => {
    const r = relaciones.get(f.id)!
    if (r.propuso || r.invitado) return true
    // Fase 3: si el cliente pidió sólo talleres verificados
    if (f.solo_verificados && !(yo?.metadata?.verificado === true || yo?.metadata?.verificado === "true")) return false
    const suministro = f.tipo === "suministro"
    return miTipo === "ambos" || (suministro ? miTipo === "proveedor" : miTipo !== "proveedor")
  }
  // Fase 4 (Trust & Ranking): reputación del cliente como comprador (sin su contacto)
  const reputaciones = await reputacionesClientes(knex, filas0.map((f) => ({ id: f.id, cliente_id: f.cliente_id, email: f.contacto?.email }))).catch(() => new Map())
  // Filtro del taller: sólo clientes con cierta reputación (lo ya cotizado, lo
  // dirigido a él y las invitaciones se ven siempre).
  const pasaFiltroCliente = (f: any) => {
    const r = relaciones.get(f.id)!
    if (r.propuso || r.invitado || f.taller_id === sellerId) return true
    return aceptaCliente(yo?.metadata, reputaciones.get(f.id))
  }
  const ocultasPorFiltro = filas0.filter((f) => tallerPuedeVer(f, relaciones.get(f.id)!) && meToca(f) && !pasaFiltroCliente(f)).length
  const filas = filas0.filter((f) => tallerPuedeVer(f, relaciones.get(f.id)!) && meToca(f) && pasaFiltroCliente(f))

  const conteos = (await knex(T_PROPUESTA)
    .whereIn("solicitud_id", filas.map((f) => f.id))
    .groupBy("solicitud_id")
    .select("solicitud_id")
    .count("* as n")) as { solicitud_id: string; n: string }[]
  const nPorSol = Object.fromEntries(conteos.map((c) => [c.solicitud_id, Number(c.n)]))

  // Propuesta ganadora de las que este taller perdió: sólo rango y días.
  const perdidas = filas.filter((f) => f.p_estado === "descartada" && f.propuesta_elegida)
  const ganadoras = perdidas.length
    ? ((await knex(T_PROPUESTA).whereIn("id", perdidas.map((f) => f.propuesta_elegida)).select("id", "precio", "dias")) as any[])
    : []
  const ganadoraPorId = Object.fromEntries(ganadoras.map((g) => [g.id, g]))

  // Preguntas: las ya contestadas (todas) y las mías sin contestar.
  const preguntasPorSol: Record<string, any[]> = {}
  await Promise.all(
    filas.map(async (f) => {
      const ps = await preguntasDe(knex, f.id, { sellerId }).catch(() => [])
      preguntasPorSol[f.id] = ps.filter((p: any) => p.respuesta || p.mia)
    })
  )

  // Contraofertas del cliente a mis propuestas (para aceptarlas o rechazarlas)
  const misIds = filas.map((f) => f.p_id).filter(Boolean)
  const contrasPorProp = new Map<string, any[]>()
  if (misIds.length) {
    for (const c of await knex(T_CONTRA).whereIn("propuesta_id", misIds).orderBy("created_at", "asc")) {
      const l = contrasPorProp.get(c.propuesta_id) || []
      l.push({ id: c.id, precio: c.precio != null ? Number(c.precio) : null, dias: c.dias, mensaje: c.mensaje || "", estado: c.estado, nota_taller: c.nota_taller || "", fecha: c.created_at })
      contrasPorProp.set(c.propuesta_id, l)
    }
  }
  const solicitudes = filas.map((f) => ({
    id: f.id,
    folio: folioTexto(f.folio),
    para_mi: f.taller_id === sellerId,
    estado: f.estado,
    // El seguimiento sólo le importa al taller que ganó; a los demás les
    // basta saber si sigue abierta.
    etapa: f.p_estado === "elegida" ? etapaDe(f) : null,
    etapa_nombre: f.p_estado === "elegida" ? NOMBRE_ETAPA[etapaDe(f)] : null,
    pagada: f.estado === "pagada" || f.pago_estado === "pagado",
    envio: f.p_estado === "elegida" ? { paqueteria: f.paqueteria || "", guia: f.guia || "" } : null,
    cierra_en: f.cierra_en,
    creada: f.created_at,
    // De los archivos sólo nombre y tamaño: la liga se pide aparte, firmada.
    // Lo que el cliente permite ver (privacidad por elemento). Nunca el contacto.
    trabajo: trabajoParaTaller(f, relaciones.get(f.id)!),
    modalidad: modalidadDe(f),
    reputacion_cliente: reputaciones.get(f.id) || { promedio: null, evaluaciones: 0, suficiente: false },
    tipo: f.tipo === "suministro" ? "suministro" : "fabricacion",
    acceso: relaciones.get(f.id)!.acceso,
    invitado: relaciones.get(f.id)!.invitado,
    mi_respuesta: f.r_motivo
      ? { motivo: f.r_motivo, texto: MOTIVOS_RESPUESTA[f.r_motivo] || f.r_motivo, nota: f.r_nota || "" }
      : null,
    propuestas_recibidas: nPorSol[f.id] || 0,
    preguntas: preguntasPorSol[f.id] || [],
    // Si perdió: rango del precio elegido y sus días (sin decir quién ganó)
    eleccion:
      f.p_estado === "descartada" && ganadoraPorId[f.propuesta_elegida]
        ? { ...rangoGanador(Number(ganadoraPorId[f.propuesta_elegida].precio)), dias: ganadoraPorId[f.propuesta_elegida].dias }
        : null,
    // Si ganó: cómo le pagan y cuánto lleva pagado el cliente
    cobro:
      f.p_estado === "elegida"
        ? { modo: f.cobro || null, comision_pct: f.comision_pct != null ? Number(f.comision_pct) : null, pagado: Number(f.pagado || 0) }
        : null,
    mi_propuesta: f.p_id
      ? {
          id: f.p_id,
          version: Number(f.p_version || 1),
          contraofertas: contrasPorProp.get(f.p_id) || [],
          precio: Number(f.precio),
          dias: f.dias,
          vigencia_dias: f.vigencia_dias,
          incluye_envio: f.incluye_envio === "si",
          condiciones: f.condiciones || "",
          anticipo_pct: f.anticipo_pct ? Number(f.anticipo_pct) : 100,
          estado: f.p_estado,
          moneda: f.moneda || "MXN",
          materiales: f.materiales || "",
          operaciones: f.operaciones || "",
          fecha_entrega: f.fecha_entrega ? new Date(f.fecha_entrega).toISOString().slice(0, 10) : "",
          condiciones_pago: f.condiciones_pago || "",
          garantia: f.garantia || "",
          observaciones: f.observaciones || "",
          adjuntos: (Array.isArray(f.adjuntos) ? f.adjuntos : []).map((a: any) => ({ clave: a.clave, nombre: a.nombre, tamano: a.tamano })),
        }
      : null,
  }))

  // Cupo de propuestas del mes según el plan; null = no se pudo saber (no se limita).
  const seller = await servicioTalleres(req.scope).retrieveSeller(sellerId).catch(() => null)
  const cupo = seller ? await cupoLicitacion(knex, sellerId, seller).catch(() => null) : null

  // Cómo cobraría si gana: cuenta conectada en la app y comisión de su plan
  const cuenta = seller ? await cuentaTaller((seller as any).email).catch(() => null) : null
  const plan = seller ? await planComision(seller as any).catch(() => "gratis") : "gratis"
  const cobro_taller = {
    mercadopago: Boolean(cuenta?.mp),
    paypal: Boolean(cuenta?.paypal),
    comision_pct: PCT_POR_PLAN[plan] ?? 0,
  }

  return res.json({ solicitudes, cupo, cobro_taller, filtro_clientes: { ...filtroClientes(yo?.metadata), ocultas: ocultasPorFiltro } })
}
