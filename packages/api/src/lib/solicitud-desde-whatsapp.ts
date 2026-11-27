// @ts-nocheck
// Solicitud registrada desde el WhatsApp (decidido por Vlado el 27 nov 2026):
// cuando el Agente de ventas detecta que el cliente necesita una pieza
// fabricada o un producto que la tienda no tiene (insertos, herramienta,
// material), la registra él mismo y le manda su folio y su liga. Es más rápido
// que mandarlo al formulario.
//
// Sigue el mismo camino que una del formulario: revisión de HETNA (o directo a
// los talleres si LICITACION_REVISION=0), anuncio en redes y Telegram (resumen
// sin datos del cliente) y la plática para completar datos
// (lib/solicitud-conversacion) en el mismo chat. Sin correo: los avisos le
// llegan por WhatsApp.
import { T_SOLICITUD, folioTexto, ligaPropuestas, nuevoId, nuevoToken } from "./licitacion"
import { difundirSolicitud } from "./difusion"
import { asegurarPrivacidad, leerPrivacidad } from "./licitacion-privacidad"
import { asegurarPropuestaFormal } from "./licitacion-propuesta"
import { asegurarSeguimiento, cambiarEtapa, revisionActiva } from "./seguimiento"
import { mandarPrivado } from "./social-telegram"

const DIAS_ABIERTA = 7
const corto = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

export type DatosSolicitudWa = {
  tipo: "fabricacion" | "suministro"
  descripcion: string
  servicio?: string
  material?: string
  medidas?: string
  cantidad?: string
  ciudad?: string
  fecha?: string
  nombre?: string
}

/** ¿Trae lo mínimo para que un taller o proveedor entienda qué cotizar? */
export function datosSuficientes(d: Partial<DatosSolicitudWa> | null | undefined) {
  return !!d && String(d.descripcion || "").trim().length >= 10
}

/**
 * Registra la solicitud. null si no hay datos suficientes o si este número ya
 * registró una en las últimas 24 h (se le da la que ya tiene).
 */
export async function crearSolicitudWhatsapp(knex: any, logger: any, numero: string, d: DatosSolicitudWa) {
  if (!datosSuficientes(d)) return null
  await asegurarSeguimiento(knex)
  await asegurarPrivacidad(knex)
  await asegurarPropuestaFormal(knex)
  for (const col of ["wa_confirmada_en", "wa_cierre_en"])
    if (!(await knex.schema.hasColumn(T_SOLICITUD, col))) await knex.schema.alterTable(T_SOLICITUD, (t: any) => t.timestamp(col, { useTz: true }).nullable())

  // Una por día por número: si ya tiene una reciente, se le recuerda ésa
  const recientes = (await knex(T_SOLICITUD)
    .where("created_at", ">=", knex.raw("now() - interval '24 hours'"))
    .whereRaw("contacto->>'whatsapp' = ?", [numero])
    .orderBy("created_at", "desc")
    .limit(1)) as any[]
  if (recientes[0]) return { nueva: false, folio: folioTexto(recientes[0].folio), liga: ligaPropuestas(recientes[0].token), solicitud: recientes[0] }

  const tipo = d.tipo === "suministro" ? "suministro" : "fabricacion"
  const trabajo: any = {
    descripcion: corto(d.descripcion, 3000),
    servicio: tipo === "suministro" ? "" : corto(d.servicio, 80),
    material: corto(d.material, 160),
    medidas: corto(d.medidas, 200),
    cantidad: corto(d.cantidad, 60),
    ciudad: corto(d.ciudad, 120),
    fecha: corto(d.fecha, 40),
    origen: { medio: "whatsapp", fuente: "agente", campana: "", contenido: "" },
  }
  const contacto = { nombre: corto(d.nombre, 120), email: "", telefono: "", whatsapp: numero, empresa: "" }
  const revision = revisionActiva()
  const [s] = await knex(T_SOLICITUD)
    .insert({
      id: nuevoId("sol"),
      token: nuevoToken(),
      modo: "abierta",
      taller_id: null,
      estado: revision ? "revision" : "abierta",
      trabajo,
      contacto,
      modalidad: "publica",
      privacidad: leerPrivacidad({}),
      difundir_redes: true,
      tipo,
      solo_verificados: false,
      cierra_en: revision ? null : new Date(Date.now() + DIAS_ABIERTA * 864e5),
      // Ya está en plática por WhatsApp: no se le manda otra confirmación
      wa_confirmada_en: new Date(),
    })
    .returning("*")
  await cambiarEtapa(knex, s, "nueva", { actor: "cliente", correo: false, nota: "Registrada desde WhatsApp por el Agente de HETNA." })
  await cambiarEtapa(knex, s, revision ? "en_revision" : "enviada_talleres", { actor: "sistema", correo: false })
  const folio = folioTexto(s.folio)
  const avisados = revision ? 0 : await difundirSolicitud(knex, logger, s).catch(() => 0)
  await mandarPrivado(knex, {
    texto:
      `🆕 Solicitud ${folio} registrada desde WhatsApp (${tipo === "suministro" ? "suministro" : "fabricación"})\n` +
      `+${numero}${contacto.nombre ? ` · ${contacto.nombre}` : ""}\n${trabajo.descripcion.slice(0, 400)}\n\n` +
      (revision ? "Está en revisión: apruébala en el panel → Solicitudes." : `Enviada a ${avisados} ${tipo === "suministro" ? "proveedores" : "talleres"}.`),
  }).catch(() => null)
  logger?.info?.(`[solicitud-whatsapp] ${folio} registrada desde el chat de +${numero}`)
  return { nueva: true, folio, liga: ligaPropuestas(s.token), solicitud: s }
}
