// Biblioteca de planos HETNA (storefront /planos): "Bájalo gratis con tu correo".
// Guarda quién pidió qué plano (con su permiso) y le manda la liga por correo.
// La lista de planos vive en el storefront (apps/storefront/src/lib/planos/modelos.ts);
// aquí sólo los nombres, para el asunto del correo. Al agregar un plano, súmalo aquí.
import { STORE_URL, boton, esc, marco } from "./licitacion"

export const T_PLANOS = "hetna_planos_descargas"

export const PLANOS_NOMBRES: Record<string, string> = {
  "banco-de-trabajo-movil": "Banco de trabajo móvil",
  "carro-para-tableros": "Carro para tableros y retazos",
  "panel-de-herramientas-liston-frances": "Panel de herramientas con listón francés",
  "cajonera-para-herrajes": "Cajonera para herrajes",
  "organizador-de-discos-de-lija": "Organizador para discos de lija",
  "caballetes-de-triplay": "Caballetes de triplay (par)",
}

export type PedidoPlano = { email: string; plano: string; nombre: string | null; promos: boolean }

const corto = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

export function validarPedidoPlano(b: Record<string, unknown>): { ok: true; datos: PedidoPlano } | { ok: false; mensaje: string } {
  if (b.acepta !== true) return { ok: false, mensaje: "Marca la casilla para que te mandemos el plano." }
  const email = corto(b.email, 160).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, mensaje: "Revisa tu correo." }
  const plano = corto(b.plano, 80)
  if (!PLANOS_NOMBRES[plano]) return { ok: false, mensaje: "Ese plano no existe." }
  return { ok: true, datos: { email, plano, nombre: corto(b.nombre, 80) || null, promos: b.promos === true } }
}

let lista = false
export async function asegurarTablaPlanos(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_PLANOS))) {
    await knex.schema.createTable(T_PLANOS, (t: any) => {
      t.increments("id").primary()
      t.text("email").notNullable().index()
      t.text("nombre").nullable()
      t.text("plano").notNullable()
      // permiso aparte para recibir novedades de HETNA (correos de marketing)
      t.boolean("promos").notNullable().defaultTo(false)
      t.timestamp("created_at").notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

export const ligaPlano = (slug: string) => `${STORE_URL}/mx/planos/${encodeURIComponent(slug)}?utm_source=correo&utm_medium=planos&utm_campaign=${encodeURIComponent(slug)}`

export function correoPlanoHtml(slug: string, nombre: string | null) {
  const titulo = PLANOS_NOMBRES[slug] || "Tu plano"
  return marco(`${titulo}: tu plano gratis`,
    `<p style="margin:0 0 12px;color:#40403A;font-size:14px;line-height:1.5">${nombre ? `Hola ${esc(nombre)}, a` : "A"}quí está tu plano. En la página puedes guardarlo en PDF y bajar el DXF para cortarlo en router CNC.</p>` +
    boton("Abrir mi plano", ligaPlano(slug)) +
    `<p style="margin:14px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">¿No tienes router o prefieres que te lo corten? En HETNA CNC un taller te lo fabrica: pide propuestas en <a href="${STORE_URL}/mx/cotizar" style="color:#B34D07">hetnacnc.com/mx/cotizar</a>.</p>`)
}
