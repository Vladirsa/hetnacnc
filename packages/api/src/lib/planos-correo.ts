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
  "librero-alto": "Librero alto de 5 niveles",
  "buro-con-cajon": "Buró con cajón",
  "zapatera-3-niveles": "Zapatera de 3 niveles",
  "escritorio-sencillo": "Escritorio sencillo",
  "mesa-de-centro": "Mesa de centro con repisa",
  "banca-de-entrada": "Banca de entrada con zapatero",
  "estacion-para-ingletadora": "Estación para ingletadora",
  "porta-sargentos-de-pared": "Porta sargentos de pared",
  "caja-de-herramientas": "Caja de herramientas portátil",
  "carro-de-herramientas": "Carro de herramientas",
  "repisa-de-pared": "Repisa de pared de 3 niveles",
  "banco-escalera": "Banco escalera de 2 peldaños",
  "cubos-organizadores-3x3": "Cubos organizadores 3 × 3",
  "jardinera": "Jardinera de 80 × 40 cm",
  "estante-para-retazos": "Estante de pared para retazos",
  "mesa-para-router": "Mesa para router de mano",
  "gabinete-de-pared": "Gabinete de pared con puertas",
  "mesa-de-trabajo-compacta": "Mesa de trabajo compacta",
  "mesa-de-comedor": "Mesa de comedor de 1.60 m",
  "consola-de-entrada": "Consola de entrada",
  "mueble-para-tv": "Mueble para TV",
  "base-de-cama-individual": "Base de cama individual",
  "casita-para-perro": "Casita para perro",
  "baul-para-juguetes": "Baúl para juguetes",
  "estante-para-pinturas": "Estante para pinturas y químicos",
  "caja-organizadora-con-divisiones": "Caja organizadora con 6 divisiones",
  "banco-alto-de-taller": "Banco alto de taller",
  "carro-para-aspiradora": "Carro para aspiradora y separador ciclónico",
  "estante-para-cargadores": "Estante de pared para cargadores de baterías",
  "cajon-bajo-cama": "Cajón con ruedas para debajo de la cama",
  "librero-bajo": "Librero bajo de 1 m",
  "macetero-escalonado": "Macetero escalonado de 3 niveles",
  "especiero-de-pared": "Especiero de pared",
  "comedero-elevado": "Comedero elevado para perro",
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

// ---------------------------------------------------------------------------
// Aviso semanal a suscritos: "Nuevo plano gratis". Sólo a quien marcó la casilla
// de novedades (promos = true) al bajar un plano, una vez por plano, en lotes,
// y respetando las bajas. No se le avisa del plano que ya bajó.
export const T_PLANOS_AVISOS = "hetna_planos_avisos"
export const LOTE_AVISOS = Number(process.env.PLANOS_AVISO_LOTE || 150)

let avisosLista = false
export async function asegurarTablaAvisos(knex: any) {
  if (avisosLista) return
  await asegurarTablaPlanos(knex)
  if (!(await knex.schema.hasTable(T_PLANOS_AVISOS))) {
    await knex.schema.createTable(T_PLANOS_AVISOS, (t: any) => {
      t.text("plano").notNullable()
      t.text("email").notNullable()
      t.timestamp("enviado_en").notNullable().defaultTo(knex.fn.now())
      t.primary(["plano", "email"])
    })
  }
  avisosLista = true
}

/** Suscritos que todavía no reciben el aviso de este plano (ni lo bajaron ya). */
export async function suscritosPendientes(knex: any, slug: string, limite = LOTE_AVISOS): Promise<{ email: string; nombre: string | null }[]> {
  await asegurarTablaAvisos(knex)
  return knex(T_PLANOS)
    .where({ promos: true })
    .whereNotIn("email", knex(T_PLANOS_AVISOS).where({ plano: slug }).select("email"))
    .whereNotIn("email", knex(T_PLANOS).where({ plano: slug }).select("email"))
    .groupBy("email")
    .select("email", knex.raw("max(nombre) as nombre"))
    .orderByRaw("min(created_at)")
    .limit(limite)
}

export const ligaPlanoAviso = (slug: string) => ligaPlano(slug).replace("utm_medium=planos", "utm_medium=aviso-semanal")

export function correoAvisoHtml(slug: string, nombre: string | null) {
  const titulo = PLANOS_NOMBRES[slug] || "Nuevo plano"
  const img = `${STORE_URL}/api/planos/${encodeURIComponent(slug)}/redes/1`
  return marco(`Plano gratis de la semana: ${titulo}`,
    `<p style="margin:0 0 12px;color:#40403A;font-size:14px;line-height:1.5">${nombre ? `Hola ${esc(nombre)}: ` : ""}esta semana sumamos a la Biblioteca de planos HETNA el <b>${esc(titulo)}</b>. Trae lista de corte con medidas, acomodo en hojas de triplay, armado paso a paso y el DXF para router CNC.</p>` +
    `<a href="${ligaPlanoAviso(slug)}"><img src="${img}" alt="${esc(titulo)}" width="420" style="display:block;width:100%;max-width:420px;height:auto;margin:0 auto 14px;border-radius:10px"></a>` +
    boton("Ver el plano gratis", ligaPlanoAviso(slug)) +
    `<p style="margin:14px 0 0;color:#6B6A63;font-size:13px;line-height:1.5">Te llega porque pediste recibir novedades al bajar un plano en hetnacnc.com. Todos los planos: <a href="${STORE_URL}/mx/planos" style="color:#B34D07">hetnacnc.com/mx/planos</a>.</p>`)
}
