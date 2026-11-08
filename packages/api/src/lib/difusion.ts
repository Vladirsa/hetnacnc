// Difusión de una solicitud: avisar a los talleres que pueden hacerla y, si es
// abierta, publicarla en redes. Se llama al crear la solicitud cuando no hay
// revisión, o cuando HETNA la aprueba (dashboard o job de revisión vencida).
import { avisarRedes } from "./redes"
import { sendEmail } from "./resend"
import { pushATalleres } from "./push"
import { cambiarEtapa } from "./seguimiento"
import { invitadosDe, modalidadDe, resumenRedes, trabajoParaTaller } from "./licitacion-privacidad"
import {
  T_SOLICITUD,
  type Trabajo,
  VENDOR_URL,
  esc,
  folioTexto,
  ligaTrabajo,
  marco,
  boton,
  ocultarContacto,
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

export async function difundirSolicitud(
  knex: any,
  logger: { info: (m: string) => void; warn: (m: string) => void },
  s: { id: string; folio: number | string; modo: string; taller_id?: string | null; trabajo: Trabajo; [k: string]: any }
): Promise<number> {
  const folio = folioTexto(s.folio)
  const trabajo = s.trabajo || ({ descripcion: "" } as Trabajo)
  const modalidad = modalidadDe(s)
  // Privada: sólo los invitados (y el taller directo). No se difunde a nadie más.
  const abierta = s.modo === "abierta" && modalidad !== "privada"
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
      nombreTaller ? `${nombreTaller}: un cliente quiere tu cotización` : "Nueva solicitud de fabricación",
      `<p style="margin:0 0 12px;color:#40403A">Folio <strong>${esc(folio)}</strong>. ` +
        `Manda tu precio y tiempo de entrega desde tu panel de HETNA. El cliente compara propuestas y elige; ` +
        `el pago y el envío se hacen dentro de la plataforma.</p>` +
        tablaTrabajo(trabajoTaller) +
        boton("Enviar mi propuesta", `${VENDOR_URL}/solicitudes`)
    )

  const destinos: { email: string; nombre?: string; id?: string }[] = []
  if (taller?.email) destinos.push({ email: taller.email, nombre: taller.name, id: taller.id })
  if (modalidad === "privada") {
    const ids = (await invitadosDe(knex, s).catch(() => [] as string[])).filter((x) => x !== taller?.id)
    if (ids.length) {
      const inv = (await knex("seller").whereIn("id", ids).whereNull("deleted_at").whereNotNull("email").select("id", "name", "email")) as any[]
      for (const t of inv) destinos.push({ email: t.email, nombre: t.name, id: t.id })
    }
  }
  if (abierta) {
    try {
      const otros = (await knex("seller")
        .whereNull("deleted_at")
        .whereNotNull("email")
        .modify((q: any) => (taller ? q.whereNot({ id: taller.id }) : q))
        .limit(500)
        .select("id", "email", "metadata")) as { id: string; email: string; metadata: any }[]
      // "Otro" no es un servicio que un taller pueda tener en su perfil: si
      // se compara literal, la solicitud no le llega a nadie.
      const servicioPedido = trabajo.servicio && trabajo.servicio !== "Otro" ? trabajo.servicio : ""
      const coinciden = otros.filter((x) => {
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
        (trabajaMaterial(x.metadata?.perfil?.materiales, trabajo.material) ? 0 : 2) +
        (mismoMunicipio(x.metadata?.perfil) ? -1 : 0) +
        (Boolean(trabajo.estado_mx) && x.metadata?.perfil?.estado === trabajo.estado_mx ? 0 : 1)
      coinciden.sort((x, y) => prioridad(x) - prioridad(y))
      for (const x of coinciden) {
        if (destinos.length >= MAX_AVISOS) break
        destinos.push({ email: x.email, id: x.id })
      }
    } catch (e) {
      logger.warn(`[licitacion] no se pudo listar talleres: ${(e as Error).message}`)
    }
  }
  await pushATalleres(
    knex,
    destinos.map((d) => d.id),
    {
      titulo: taller && !abierta ? "Un cliente quiere tu cotización" : "Nueva solicitud de fabricación",
      cuerpo: `${folio}: ${[trabajoTaller.servicio, trabajoTaller.material, trabajoTaller.ciudad || trabajoTaller.estado_mx].filter(Boolean).join(" · ") || "manda tu precio"}`,
      url: "/seller/solicitudes",
      etiqueta: `sol-${s.id}`,
    },
    logger
  )
  for (const d of destinos) {
    const r = await sendEmail({
      to: d.email,
      subject: `[${folio}] Nueva solicitud de fabricación en ${SITIO}`,
      html: avisoTaller(d.nombre),
    })
    if (!r.sent) logger.info(`[licitacion] aviso a taller no enviado: ${r.reason}`)
    await pausa(600)
  }

  // Redes: sólo con autorización expresa del cliente (difundir_redes), nunca
  // una privada, y con el resumen sin datos sensibles (Licitaciones 3.0 §1.3):
  // sin planos, sin presupuesto confidencial, sin contacto.
  if (abierta && s.difundir_redes) {
    await avisarRedes(
      {
        tipo: "licitacion",
        titulo: [trabajoTaller.servicio, trabajoTaller.material].filter(Boolean).join(" - ") || "Trabajo de fabricacion CNC",
        resumen: resumenRedes(s),
        lugar: [trabajoTaller.ciudad, trabajoTaller.estado_mx].filter(Boolean).join(", "),
        url: ligaTrabajo(s.folio),
      },
      logger as any
    )
  }
  logger.info(`[licitacion] ${folio} difundida a ${destinos.length} talleres`)
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
