// Difusión de una solicitud: avisar a los talleres que pueden hacerla y, si es
// abierta, publicarla en redes. Se llama al crear la solicitud cuando no hay
// revisión, o cuando HETNA la aprueba (dashboard o job de revisión vencida).
import { sendEmail } from "./resend"
import { pushATalleres } from "./push"
import { cambiarEtapa } from "./seguimiento"
import { invitadosDe, modalidadDe, resumenRedes, trabajoParaTaller } from "./licitacion-privacidad"
import { puntajePosicion, tallerVerificado } from "./confianza"
import { aceptaCliente, reputacionCliente } from "./trust"
import { publicacionAutomatica } from "./social-hub"
import {
  T_SOLICITUD,
  type Trabajo,
  VENDOR_URL,
  esc,
  folioTexto,
  ligaTrabajo,
  marco,
  boton,
  tablaTrabajo,
} from "./licitacion"

const SITIO = process.env.NEXT_PUBLIC_SITE_NAME || "HETNA CNC"
const MAX_AVISOS = 60
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ¿El taller dice trabajar el material que pidió el cliente? El cliente
// escribe libre ("MDF de 6 mm", "acero negro cal. 14") y el taller pone una
// lista ("MDF", "Acero"), así que se compara sin acentos ni mayúsculas y
// basta con que una palabra de la lista del taller aparezca en el pedido.
const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
export function trabajaMaterial(materialesTaller: unknown, pedido?: string) {
  if (!pedido || !Array.isArray(materialesTaller)) return false
  const texto = ` ${sinAcentos(pedido)} `
  return materialesTaller.some((m) => {
    const clave = sinAcentos(String(m || "")).trim()
    return clave.length >= 3 && texto.includes(clave)
  })
}

// Talleres que pueden hacer una solicitud abierta, del más al menos indicado
// (material, municipio, estado y posicionamiento). Sin tope: quien difunde
// decide cuántos avisa. Respeta los filtros del cliente y de cada taller.
export async function candidatosAbiertos(knex: any, s: any, excluir?: string | null): Promise<{ id: string; email: string; metadata: any }[]> {
  const trabajo = s.trabajo || ({ descripcion: "" } as Trabajo)
  const suministro = s.tipo === "suministro"
  const otros = (await knex("seller")
    .whereNull("deleted_at")
    .whereNotNull("email")
    .modify((q: any) => (excluir ? q.whereNot({ id: excluir }) : q))
    .limit(500)
    .select("id", "email", "metadata")) as { id: string; email: string; metadata: any }[]
  // "Otro" no es un servicio que un taller pueda tener en su perfil: si
  // se compara literal, la solicitud no le llega a nadie.
  const servicioPedido = trabajo.servicio && trabajo.servicio !== "Otro" ? trabajo.servicio : ""
  // Licitaciones 3.0 (Fase 2): el suministro va a proveedores; la
  // fabricación, a talleres. "Ambos" recibe las dos.
  const tipoCuenta = (x: { metadata: any }) => String(x.metadata?.perfil?.tipo_cuenta || "taller")
  // Fase 4: talleres que sólo reciben clientes con buena reputación
  const repCliente = await reputacionCliente(knex, { clienteId: s.cliente_id, email: s.contacto?.email }).catch(() => null)
  const coinciden = otros.filter((x) => {
    if (!aceptaCliente(x.metadata, repCliente)) return false
    const t = tipoCuenta(x)
    if (s.solo_verificados && !tallerVerificado(x.metadata)) return false
    if (suministro) return t === "proveedor" || t === "ambos"
    if (t === "proveedor") return false
    const servicios: string[] = x.metadata?.perfil?.servicios || []
    return !servicioPedido || !servicios.length || servicios.includes(servicioPedido)
  })
  // Con el tope de avisos, el orden decide quién se entera. Primero los
  // que trabajan el material que pide el cliente (si el taller lo puso
  // en su perfil), luego los de su mismo estado, que entregan sin flete
  // caro y son los que más contestan.
  // Mismo municipio que el cliente: antes que nadie (puede entregar en mano).
  const norm = (v: unknown) => String(v || "").trim().toLowerCase()
  const mismoMunicipio = (p: any) => Boolean(trabajo.ciudad) && norm(p?.ciudad) === norm(trabajo.ciudad)
  const prioridad = (x: { metadata: any }) =>
    (trabajaMaterial(x.metadata?.perfil?.materiales, trabajo.material) ||
    (suministro && trabajaMaterial(x.metadata?.perfil?.marcas, `${trabajo.marca || ""} ${trabajo.material || ""}`))
      ? 0
      : 2) +
    (mismoMunicipio(x.metadata?.perfil) ? -1 : 0) +
    (Boolean(trabajo.estado_mx) && x.metadata?.perfil?.estado === trabajo.estado_mx ? 0 : 1)
  // Fase 3: a igual prioridad, primero los mejor posicionados (plan,
  // verificación y certificaciones). No cambia su calificación.
  coinciden.sort((x, y) => prioridad(x) - prioridad(y) || puntajePosicion(y.metadata) - puntajePosicion(x.metadata))
  return coinciden
}

// Quién recibió aviso de cada solicitud y en qué ronda (1 = al publicarse;
// 2 y 3 = ampliaciones cuando nadie cotiza, ver lib/licitacion-ampliar).
export const T_AVISO = "hetna_solicitud_aviso"
let avisosListos = false
export async function asegurarAvisos(knex: any) {
  if (avisosListos) return
  if (!(await knex.schema.hasTable(T_AVISO))) {
    await knex.schema.createTable(T_AVISO, (t: any) => {
      t.text("solicitud_id").notNullable().index()
      t.text("seller_id").notNullable()
      t.integer("ronda").notNullable().defaultTo(1)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.primary(["solicitud_id", "seller_id", "ronda"])
    })
  }
  avisosListos = true
}
export async function registrarAvisos(knex: any, solicitudId: string, sellerIds: (string | undefined | null)[], ronda: number) {
  const ids = [...new Set(sellerIds.filter(Boolean))] as string[]
  if (!ids.length) return
  try {
    await asegurarAvisos(knex)
    await knex(T_AVISO).insert(ids.map((seller_id) => ({ solicitud_id: solicitudId, seller_id, ronda }))).onConflict(["solicitud_id", "seller_id", "ronda"]).ignore()
  } catch {
    /* el registro no debe frenar la difusión */
  }
}

export async function difundirSolicitud(
  knex: any,
  logger: { info: (m: string) => void; warn: (m: string) => void },
  s: { id: string; folio: number | string; modo: string; taller_id?: string | null; trabajo: Trabajo; [k: string]: any },
  // Ronda de ampliación (lib/licitacion-ampliar): sólo a estos talleres, con
  // un aviso de que la solicitud sigue sin propuestas, y sin volver a redes.
  extra?: { ronda: number; ids: string[]; intro: string; titulo: string }
): Promise<number> {
  const folio = folioTexto(s.folio)
  const trabajo = s.trabajo || ({ descripcion: "" } as Trabajo)
  const modalidad = modalidadDe(s)
  // Privada: sólo los invitados (y el taller directo). No se difunde a nadie más.
  const abierta = s.modo === "abierta" && modalidad !== "privada"
  const suministro = s.tipo === "suministro"
  // Lo que ve un taller que todavía no participa (Licitaciones 3.0, Fase 1)
  const vista = trabajoParaTaller(s, { invitado: modalidad === "privada", acceso: "ninguno", propuso: false, elegido: false })
  const trabajoTaller: Trabajo = {
    ...trabajo,
    ...vista,
    archivos: trabajo.archivos,
    descripcion: vista.descripcion_restringida
      ? "La descripción completa la ven los talleres que el cliente autoriza. Pide acceso desde tu panel."
      : vista.descripcion,
  } as Trabajo

  let taller: { id: string; name: string; email: string | null } | null = null
  if (s.taller_id) {
    taller = (await knex("seller").where({ id: s.taller_id }).first("id", "name", "email").catch(() => null)) || null
  }

  const avisoTaller = (nombreTaller?: string) =>
    marco(
      extra ? extra.titulo : nombreTaller ? `${nombreTaller}: un cliente quiere tu cotización` : suministro ? "Nueva solicitud de suministro" : "Nueva solicitud de fabricación",
      (extra ? `<p style="margin:0 0 12px;color:#40403A;background:#FFF8EE;padding:10px 12px;border-radius:8px">${esc(extra.intro)}</p>` : "") +
      `<p style="margin:0 0 12px;color:#40403A">Folio <strong>${esc(folio)}</strong>. ` +
        `Manda tu precio y tiempo de entrega desde tu panel de HETNA. El cliente compara propuestas y elige; ` +
        `el pago y el envío se hacen dentro de la plataforma.</p>` +
        tablaTrabajo(trabajoTaller) +
        boton("Enviar mi propuesta", `${VENDOR_URL}/solicitudes`)
    )

  const destinos: { email: string; nombre?: string; id?: string }[] = []
  if (extra) {
    const filas = extra.ids.length
      ? ((await knex("seller").whereIn("id", extra.ids).whereNull("deleted_at").whereNotNull("email").select("id", "email")) as any[])
      : []
    const orden = new Map(extra.ids.map((id, i) => [id, i]))
    filas.sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0))
    for (const t of filas) destinos.push({ email: t.email, id: t.id })
  } else if (taller?.email) destinos.push({ email: taller.email, nombre: taller.name, id: taller.id })
  if (!extra && modalidad === "privada") {
    const ids = (await invitadosDe(knex, s).catch(() => [] as string[])).filter((x) => x !== taller?.id)
    if (ids.length) {
      const inv = (await knex("seller").whereIn("id", ids).whereNull("deleted_at").whereNotNull("email").select("id", "name", "email")) as any[]
      for (const t of inv) destinos.push({ email: t.email, nombre: t.name, id: t.id })
    }
  }
  if (!extra && abierta) {
    try {
      for (const x of await candidatosAbiertos(knex, s, taller?.id)) {
        if (destinos.length >= MAX_AVISOS) break
        destinos.push({ email: x.email, id: x.id })
      }
    } catch (e) {
      logger.warn(`[licitacion] no se pudo listar talleres: ${(e as Error).message}`)
    }
  }
  await registrarAvisos(knex, s.id, destinos.map((d) => d.id), extra?.ronda || 1)
  await pushATalleres(
    knex,
    destinos.map((d) => d.id),
    {
      titulo: extra ? extra.titulo : taller && !abierta ? "Un cliente quiere tu cotización" : suministro ? "Nueva solicitud de suministro" : "Nueva solicitud de fabricación",
      cuerpo: `${folio}: ${[trabajoTaller.servicio, trabajoTaller.material, trabajoTaller.ciudad || trabajoTaller.estado_mx].filter(Boolean).join(" · ") || "manda tu precio"}`,
      url: "/seller/solicitudes",
      etiqueta: `sol-${s.id}`,
    },
    logger
  )
  for (const d of destinos) {
    const r = await sendEmail({
      to: d.email,
      subject: extra ? `[${folio}] ${extra.titulo}` : `[${folio}] Nueva solicitud de ${suministro ? "suministro" : "fabricación"} en ${SITIO}`,
      html: avisoTaller(d.nombre),
    })
    if (!r.sent) logger.info(`[licitacion] aviso a taller no enviado: ${r.reason}`)
    await pausa(600)
  }

  // Redes: sólo con autorización expresa del cliente (difundir_redes), nunca
  // una privada, y con el resumen sin datos sensibles (Licitaciones 3.0 §1.3):
  // sin planos, sin presupuesto confidencial, sin contacto.
  if (!extra && abierta && s.difundir_redes) {
    // Fase 5A: pasa por el Social Hub (textos por red, horario y medición)
    await publicacionAutomatica(
      knex,
      {
        origen: "licitacion",
        origen_id: s.id,
        titulo: [trabajoTaller.servicio, trabajoTaller.material].filter(Boolean).join(" - ") || "Trabajo de fabricación CNC",
        resumen: resumenRedes(s),
        lugar: [trabajoTaller.ciudad, trabajoTaller.estado_mx].filter(Boolean).join(", "),
        url: ligaTrabajo(s.folio),
      },
      logger
    )
  }
  logger.info(`[licitacion] ${folio} difundida a ${destinos.length} talleres${extra ? ` (ronda ${extra.ronda})` : ""}`)
  return destinos.length
}

// HETNA aprueba una solicitud en revisión (o el job, si se venció el plazo):
// se abre a propuestas por 7 días desde ahora, se le avisa al cliente y se
// difunde a los talleres.
export async function aprobarSolicitud(
  knex: any,
  logger: { info: (m: string) => void; warn: (m: string) => void },
  s: any,
  actor: "hetna" | "sistema",
  nota?: string
) {
  const n = await knex(T_SOLICITUD)
    .where({ id: s.id, estado: "revision" })
    .update({ estado: "abierta", cierra_en: new Date(Date.now() + 7 * 864e5), updated_at: knex.fn.now() })
  // Otro proceso ya la aprobó (doble clic, o el job al mismo tiempo).
  if (!n) return false
  await cambiarEtapa(knex, s, "enviada_talleres", { actor, nota, logger })
  await difundirSolicitud(knex, logger, s)
  return true
}
