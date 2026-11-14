import { asegurarVersiones, historialDe } from "../../../../lib/licitacion-versiones"
import { hitosConFotos } from "../../../../lib/licitacion-hitos-pedido"
import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PROPUESTA, T_SOLICITUD, asegurarTablas, folioTexto, ocultarContacto, pesoPlan } from "../../../../lib/licitacion"
import { asegurarCobro, estadoCobro } from "../../../../lib/licitacion-cobro"
import { T_ACCESO, T_INVITADO, asegurarPrivacidad, modalidadDe, privacidadDe } from "../../../../lib/licitacion-privacidad"
import { ligarCliente, preguntasDe, resenaDe } from "../../../../lib/licitacion-extra"
import { asegurarPropuestaFormal, compararPropuestas } from "../../../../lib/licitacion-propuesta"
import { getSignedDownloadUrls } from "../../../../lib/backblaze"
import { puntajePosicion } from "../../../../lib/confianza"
import { evaluacionesDe } from "../../../../lib/trust"
import { accesosDe } from "../../../../lib/archivo-acceso"
import { DIAS_CONSERVACION, etapaTerminada } from "../../../../lib/conservacion-archivos"
import { ETAPAS_REPORTABLES, NOMBRE_PROBLEMA, TipoProblema } from "../../../../lib/disputa"
import {
  EXPLICA_ETAPA,
  NOMBRE_ETAPA,
  T_EVENTO,
  asegurarSeguimiento,
  etapaDe,
  type Etapa,
} from "../../../../lib/seguimiento"

// El camino normal, en orden, para pintar la línea de tiempo del cliente.
// "nueva" no va: ya la tiene desde que ve esta página.
const CAMINO: Etapa[] = ["en_revision", "enviada_talleres", "cotizada", "aceptada", "en_produccion", "entregada", "cerrada"]

// Vista privada del cliente: su solicitud y las propuestas recibidas.
// Solo con el token secreto que le llegó por correo. Sin datos de contacto de nadie.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })

  await asegurarTablas(knex)
  await asegurarSeguimiento(knex)
  await asegurarCobro(knex) // columnas nuevas (anticipo_pct) antes de leerlas
  await asegurarPropuestaFormal(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  // Con sesión iniciada, la solicitud queda en "Mis solicitudes" del cliente
  // (la liga secreta prueba que es suya).
  const clienteId = (req as unknown as AuthenticatedMedusaRequest).auth_context?.actor_id
  if (clienteId) await ligarCliente(knex, s.id, clienteId).catch(() => {})

  await asegurarVersiones(knex) // agrega la columna "version" si todavía no existe
  const props = (await knex(`${T_PROPUESTA} as p`)
    .join("seller as v", "v.id", "p.seller_id")
    .where("p.solicitud_id", s.id)
    .select(
      "p.id", "p.precio", "p.dias", "p.vigencia_dias", "p.incluye_envio", "p.condiciones", "p.estado", "p.created_at", "p.anticipo_pct",
      "p.moneda", "p.materiales", "p.operaciones", "p.fecha_entrega", "p.condiciones_pago", "p.garantia", "p.observaciones", "p.adjuntos", "p.version",
      "v.name as taller", "v.handle", "v.metadata"
    )) as any[]

  // Ligas firmadas (1 hora) a los archivos adjuntos de las propuestas
  const clavesAdj = props.flatMap((p) => (Array.isArray(p.adjuntos) ? p.adjuntos : []).map((a: any) => a.clave))
  const ligasAdj = clavesAdj.length ? await getSignedDownloadUrls(clavesAdj, 3600).catch(() => new Map<string, string>()) : new Map<string, string>()

  // Versiones anteriores y contraofertas de cada propuesta
  const hist = await historialDe(knex, s.id).catch(() => null)
  const propuestas = props
    .map((p) => {
      const perfil = p.metadata?.perfil || {}
      return {
        id: p.id,
        precio: Number(p.precio),
        dias: p.dias,
        vigencia_dias: p.vigencia_dias,
        incluye_envio: p.incluye_envio === "si",
        condiciones: p.condiciones ? ocultarContacto(p.condiciones) : "",
        estado: p.estado,
        fecha: p.created_at,
        anticipo_pct: p.anticipo_pct && p.anticipo_pct < 100 ? Number(p.anticipo_pct) : null,
        // Licitaciones 3.0 (Fase 2): propuesta formal
        moneda: p.moneda || "MXN",
        materiales: p.materiales || "",
        operaciones: p.operaciones || "",
        fecha_entrega: p.fecha_entrega ? new Date(p.fecha_entrega).toISOString().slice(0, 10) : null,
        condiciones_pago: p.condiciones_pago || "",
        garantia: p.garantia || "",
        observaciones: p.observaciones || "",
        adjuntos: (Array.isArray(p.adjuntos) ? p.adjuntos : []).map((a: any) => ({ nombre: a.nombre, tamano: a.tamano, url: ligasAdj.get(a.clave) || null })),
        taller: {
          nombre: p.taller,
          handle: p.handle,
          estado: perfil.estado || "",
          calificacion: perfil.calificacion ?? null,
          resenas: Number(perfil.resenas || 0),
          // Historial medido (puntualidad real, terminados, reclamos): lib/reputacion-medida.ts
          medido: perfil.medido
            ? {
                terminados: Number(perfil.medido.terminados || 0),
                puntualidad_pct: perfil.medido.puntualidad_pct ?? null,
                terminados_pct: perfil.medido.terminados_pct ?? null,
                reclamos: Number(perfil.medido.reclamos || 0),
                reclamos_resueltos: Number(perfil.medido.reclamos_resueltos || 0),
                puntaje: perfil.medido.puntaje ?? null,
                suficiente: perfil.medido.suficiente === true,
              }
            : null,
          verificado: p.metadata?.verificado === true || p.metadata?.verificado === "true",
          // Capacidad declarada en su perfil: máquinas por tipo y el área de trabajo más grande
          capacidad: capacidadTaller(perfil.maquinas),
        },
        destacado: pesoPlan(p.metadata) > 0,
        version: Number(p.version || 1),
        historial: hist?.versiones.get(p.id) || [],
        contraofertas: hist?.contras.get(p.id) || [],
        _peso: puntajePosicion(p.metadata),
      }
    })
    // Talleres con membresía primero; luego el más barato.
    .sort((a, b) => b._peso - a._peso || a.precio - b.precio)
    .map(({ _peso, ...p }) => p)

  const etapa = etapaDe(s, propuestas.length)
  const eventos = (await knex(T_EVENTO)
    .where({ solicitud_id: s.id, visible_cliente: true })
    .orderBy("created_at", "asc")
    .select("etapa", "actor", "nota", "created_at")) as any[]
  // Cuándo llegó a cada etapa (la última vez), para la línea de tiempo.
  const cuando: Record<string, string> = {}
  for (const e of eventos) if (e.etapa) cuando[e.etapa] = e.created_at
  // Hitos de producción (plan contra real, con fotos) cuando ya se pagó
  const hitos = ["en_produccion", "entregada", "cerrada"].includes(etapa) || s.estado === "pagada" || s.pago_estado === "pagado"
    ? await hitosConFotos(knex, s, cuando["en_produccion"] || null).catch(() => [])
    : []
  const posicion = CAMINO.indexOf(etapa)
  const linea = CAMINO
    // Si no hubo revisión, ese paso no se enseña.
    .filter((e) => e !== "en_revision" || cuando.en_revision || etapa === "en_revision")
    .map((e) => ({
      etapa: e,
      nombre: NOMBRE_ETAPA[e],
      explica: EXPLICA_ETAPA[e],
      fecha: cuando[e] || null,
      // Cerrada o cancelada antes de tiempo (p. ej. sin propuestas): sólo
      // cuenta como hecho lo que de verdad pasó; lo demás se salta.
      estado:
        etapa === "cancelada" || etapa === "cerrada"
          ? e === etapa
            ? "hecha"
            : cuando[e]
              ? "hecha"
              : "omitida"
          : CAMINO.indexOf(e) < posicion
            ? "hecha"
            : e === etapa
              ? "actual"
              : "pendiente",
    }))

  // Licitaciones 3.0: privacidad, invitados y quién pidió ver los planos
  await asegurarPrivacidad(knex)
  const [accesos, invitados] = await Promise.all([
    knex(`${T_ACCESO} as a`)
      .join("seller as v", "v.id", "a.seller_id")
      .where("a.solicitud_id", s.id)
      .orderBy("a.created_at", "desc")
      .select("a.seller_id", "a.estado", "a.mensaje", "a.created_at", "v.name as taller", "v.handle")
      .catch(() => []),
    knex(`${T_INVITADO} as i`)
      .join("seller as v", "v.id", "i.seller_id")
      .where("i.solicitud_id", s.id)
      .select("v.id as seller_id", "v.name as taller", "v.handle")
      .catch(() => []),
  ])

  // Problema 4: quién bajó sus archivos (sin IP) y su conservación.
  const descargas = ((await accesosDe(knex, s.id, 100).catch(() => [])) as any[])
    .filter((x) => x.accion !== "negada")
    .map((x) => ({ fecha: x.created_at, archivo: x.nombre, quien: x.actor === "hetna" ? "HETNA" : x.actor_nombre || "Taller", accion: x.accion }))
  const nArchivos = (s.trabajo?.archivos || []).length

  const [cobro, preguntas, resena, evaluaciones] = await Promise.all([
    s.propuesta_elegida ? estadoCobro(knex, s).catch(() => null) : null,
    preguntasDe(knex, s.id).catch(() => []),
    s.propuesta_elegida ? resenaDe(knex, s.id).catch(() => null) : null,
    s.propuesta_elegida ? evaluacionesDe(knex, s, "cliente").catch(() => null) : null,
  ])

  return res.json({
    folio: folioTexto(s.folio),
    cobro,
    preguntas,
    resena: resena
      ? {
          calidad: resena.calidad, tiempo: resena.tiempo, trato: resena.trato, comunicacion: resena.comunicacion ?? null, precio: resena.precio ?? null,
          capacidad: resena.capacidad ?? null, profesionalismo: resena.profesionalismo ?? null, posventa: resena.posventa ?? null, comentario: resena.comentario || "",
        }
      : null,
    // Fase 4 (Trust & Ranking): la evaluación que el taller hizo del cliente, sólo ya publicada
    evaluaciones,
    puede_resenar: Boolean(s.propuesta_elegida) && ["entregada", "cerrada"].includes(etapa) && Boolean(cobro && cobro.pagado > 0),
    etapa,
    etapa_nombre: NOMBRE_ETAPA[etapa],
    etapa_explica: EXPLICA_ETAPA[etapa],
    linea,
    hitos,
    historial: eventos
      .filter((e) => e.nota)
      .map((e) => ({ fecha: e.created_at, quien: e.actor, nota: ocultarContacto(e.nota) })),
    envio: s.paqueteria || s.guia ? { paqueteria: s.paqueteria || "", guia: s.guia || "" } : null,
    // Con una disputa abierta no se confirma: primero HETNA resuelve.
    puede_confirmar: etapa === "entregada" && !s.disputa,
    puede_reportar: (ETAPAS_REPORTABLES as readonly string[]).includes(etapa) && !s.disputa,
    archivos_protegidos: {
      descargas,
      borrados_en: s.trabajo?.archivos_borrados_en || null,
      borrados: (s.trabajo?.archivos_borrados || []).map((a: any) => a.nombre),
      puede_borrar: nArchivos > 0 && etapaTerminada(s) && !s.disputa,
      dias_conservacion: DIAS_CONSERVACION,
    },
    // true = el cliente le paga directo a la cuenta del taller: HETNA no retiene nada.
    cobro_directo: s.cobro === "taller",
    disputa: s.disputa
      ? { tipo: s.disputa, nombre: NOMBRE_PROBLEMA[s.disputa as TipoProblema] || "Problema", desde: s.disputa_desde }
      : null,
    modo: s.modo,
    estado: s.estado,
    creada: s.created_at,
    cierra_en: s.cierra_en,
    trabajo: s.trabajo,
    propuesta_elegida: s.propuesta_elegida,
    pago_url: s.estado === "elegida" && s.pago_estado !== "pagado" && s.pago_estado !== "anticipo" ? s.pago_url || null : null,
    pago_estado: s.pago_estado || null,
    propuestas,
    // Comparación con reglas (diferencias y omisiones). El resumen con IA se
    // pide aparte: POST /store/solicitudes-taller/:token/analisis
    comparacion: compararPropuestas(
      propuestas.map((p) => ({
        id: p.id, taller: p.taller.nombre, precio: p.precio, moneda: p.moneda, dias: p.dias, incluye_envio: p.incluye_envio,
        anticipo_pct: p.anticipo_pct, materiales: p.materiales, operaciones: p.operaciones, fecha_entrega: p.fecha_entrega,
        condiciones_pago: p.condiciones_pago, garantia: p.garantia, observaciones: p.observaciones,
        calificacion: p.taller.calificacion, verificado: p.taller.verificado, adjuntos: p.adjuntos.length,
      }))
    ),
    modalidad: modalidadDe(s),
    privacidad: privacidadDe(s),
    difundir_redes: !!s.difundir_redes,
    accesos,
    invitados,
  })
}

const NOMBRE_MAQUINA: Record<string, string> = {
  router: "Router CNC", laser_co2: "Láser CO2", laser_fibra: "Láser de fibra", plasma: "Plasma CNC", fresadora: "Fresadora",
  torno: "Torno CNC", impresora_3d: "Impresora 3D", waterjet: "Chorro de agua", dobladora: "Dobladora", otra: "Otra",
}

/** "2 Router CNC · 1 Láser CO2" y el área de trabajo mayor ("1300 × 2500 mm"), o null si no declaró máquinas. */
function capacidadTaller(maquinas: unknown): { maquinas: number; resumen: string; area_mayor: string | null } | null {
  if (!Array.isArray(maquinas) || !maquinas.length) return null
  const porTipo = new Map<string, number>()
  let mayor: { x: number; y: number } | null = null
  for (const m of maquinas as any[]) {
    const tipo = NOMBRE_MAQUINA[String(m?.tipo || "")] || String(m?.nombre || "Máquina").slice(0, 40)
    porTipo.set(tipo, (porTipo.get(tipo) || 0) + 1)
    const x = Number(m?.x) || 0, y = Number(m?.y) || 0
    if (x > 0 && y > 0 && (!mayor || x * y > mayor.x * mayor.y)) mayor = { x, y }
  }
  return {
    maquinas: maquinas.length,
    resumen: [...porTipo].map(([t, n]) => `${n} ${t}`).join(" · "),
    area_mayor: mayor ? `${Math.round(mayor.x)} × ${Math.round(mayor.y)} mm` : null,
  }
}
