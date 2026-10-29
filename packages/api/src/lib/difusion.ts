// Difusión de una solicitud: avisar a los talleres que pueden hacerla y, si es
// abierta, publicarla en redes. Se llama al crear la solicitud cuando no hay
// revisión, o cuando HETNA la aprueba (dashboard o job de revisión vencida).
import { avisarRedes } from "./redes"
import { sendEmail } from "./resend"
import { cambiarEtapa } from "./seguimiento"
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
  s: { id: string; folio: number | string; modo: string; taller_id?: string | null; trabajo: Trabajo }
): Promise<number> {
  const folio = folioTexto(s.folio)
  const trabajo = s.trabajo || ({ descripcion: "" } as Trabajo)
  const abierta = s.modo === "abierta"
  const trabajoTaller: Trabajo = { ...trabajo, descripcion: ocultarContacto(trabajo.descripcion || "") }

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

  const destinos: { email: string; nombre?: string }[] = []
  if (taller?.email) destinos.push({ email: taller.email, nombre: taller.name })
  if (abierta) {
    try {
      const otros = (await knex("seller")
        .whereNull("deleted_at")
        .whereNotNull("email")
        .modify((q: any) => (taller ? q.whereNot({ id: taller.id }) : q))
        .limit(500)
        .select("email", "metadata")) as { email: string; metadata: any }[]
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
        destinos.push({ email: x.email })
      }
    } catch (e) {
      logger.warn(`[licitacion] no se pudo listar talleres: ${(e as Error).message}`)
    }
  }
  for (const d of destinos) {
    const r = await sendEmail({
      to: d.email,
      subject: `[${folio}] Nueva solicitud de fabricación en ${SITIO}`,
      html: avisoTaller(d.nombre),
    })
    if (!r.sent) logger.info(`[licitacion] aviso a taller no enviado: ${r.reason}`)
    await pausa(600)
  }

  // Redes: sólo solicitudes abiertas y sólo datos públicos (sin contacto)
  if (abierta) {
    await avisarRedes(
      {
        tipo: "licitacion",
        titulo: [trabajo.servicio, trabajo.material].filter(Boolean).join(" - ") || "Trabajo de fabricacion CNC",
        resumen: [trabajo.cantidad ? "Cantidad: " + trabajo.cantidad : "", trabajo.fecha ? "Para: " + trabajo.fecha : ""]
          .filter(Boolean)
          .join(". "),
        lugar: [trabajo.ciudad, trabajo.estado_mx].filter(Boolean).join(", "),
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
