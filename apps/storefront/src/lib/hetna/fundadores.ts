// Lógica del programa de Talleres fundadores (solo servidor).
// La marca de fundador vive en los datos extra (metadata) del taller en Mercur:
//   fundador: true | false
//   fundador_desde: fecha en que se marcó
//   plan_pro_hasta: fecha en que termina el plan Pro gratis (6 meses)
// Quien llama a marcar/quitar/listarAdmin debe haber verificado antes que es administrador.

import { db } from "@/lib/foro/db"
import { urlBackend } from "@/lib/publicidad/sesion"

export const CUPO = 30
export const MESES_PRO = 6
export const DIAS_AVISO = 30

type Cabeceras = Record<string, string>
type SellerCrudo = {
  id: string
  name?: string | null
  handle?: string | null
  metadata?: Record<string, unknown> | null
}

export type Fila = {
  id: string
  nombre: string
  handle: string
  fundador: boolean
  desde: string | null
  vence: string | null
  diasRestantes: number | null
}

export type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const ID = /^[A-Za-z0-9_-]{6,80}$/

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null

const fechaValida = (v: unknown): string | null => {
  const t = texto(v)
  return t && !Number.isNaN(Date.parse(t)) ? t : null
}

const diasHasta = (iso: string | null): number | null =>
  iso ? Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000) : null

const esPrueba = (s: SellerCrudo) => s.metadata?.prueba === true

const aFila = (s: SellerCrudo): Fila => {
  const m = s.metadata ?? {}
  const vence = fechaValida(m.plan_pro_hasta)
  return {
    id: s.id,
    nombre: s.name || s.handle || s.id,
    handle: s.handle || "",
    fundador: m.fundador === true,
    desde: fechaValida(m.fundador_desde),
    vence,
    diasRestantes: diasHasta(vence),
  }
}

const contarFundadores = (todos: SellerCrudo[]) =>
  todos.filter((s) => !esPrueba(s) && s.metadata?.fundador === true).length

async function leerTodos(h: Cabeceras): Promise<SellerCrudo[]> {
  const r = await fetch(`${urlBackend()}/admin/sellers?limit=200&fields=id,name,handle,metadata`, {
    headers: h,
    cache: "no-store",
  })
  if (!r.ok) throw new Error(`Medusa respondió ${r.status}`)
  const j = (await r.json()) as { sellers?: SellerCrudo[] }
  return j.sellers ?? []
}

async function guardarMetadata(h: Cabeceras, id: string, metadata: Record<string, unknown>): Promise<boolean> {
  const r = await fetch(`${urlBackend()}/admin/sellers/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { ...h, "content-type": "application/json" },
    body: JSON.stringify({ metadata }),
    cache: "no-store",
  })
  if (!r.ok) {
    console.error("[fundadores] no se pudo guardar", r.status, (await r.text().catch(() => "")).slice(0, 200))
    return false
  }
  return true
}

export async function listarAdmin(
  h: Cabeceras
): Promise<Res<{ filas: Fila[]; cupo: number; usados: number; meses: number }>> {
  try {
    const todos = (await leerTodos(h)).filter((s) => !esPrueba(s))
    const filas = todos.map(aFila).sort((a, b) => Number(b.fundador) - Number(a.fundador) || a.nombre.localeCompare(b.nombre))
    return { ok: true, filas, cupo: CUPO, usados: contarFundadores(todos), meses: MESES_PRO }
  } catch (e) {
    console.error("[fundadores] listar", e instanceof Error ? e.message : e)
    return { ok: false, error: "No se pudo leer la lista de talleres." }
  }
}

export async function marcar(h: Cabeceras, id: string): Promise<Res<{ vence: string }>> {
  if (!ID.test(id || "")) return { ok: false, error: "Taller no válido." }
  try {
    const todos = await leerTodos(h)
    const s = todos.find((x) => x.id === id)
    if (!s) return { ok: false, error: "No encontré ese taller." }
    const actual = s.metadata ?? {}
    const yaFundador = actual.fundador === true
    if (yaFundador && fechaValida(actual.plan_pro_hasta)) return { ok: false, error: "Este taller ya es fundador." }
    // Un fundador marcado a mano antes (sin fechas) no ocupa lugar nuevo: solo se le registran las fechas.
    if (!yaFundador && contarFundadores(todos) >= CUPO)
      return { ok: false, error: `Ya se llenó el cupo de ${CUPO} talleres fundadores.` }

    const ahora = new Date()
    const vence = new Date(ahora)
    vence.setMonth(vence.getMonth() + MESES_PRO)
    const ok = await guardarMetadata(h, id, {
      ...actual,
      fundador: true,
      fundador_desde: ahora.toISOString(),
      plan_pro_hasta: vence.toISOString(),
    })
    if (!ok) return { ok: false, error: "No se pudo guardar el cambio en el taller." }
    // Si se vuelve a marcar, que el aviso de vencimiento pueda salir otra vez.
    await db().query("delete from publicidad.fundadores_avisos where seller_id = $1", [id]).catch(() => undefined)
    return { ok: true, vence: vence.toISOString() }
  } catch (e) {
    console.error("[fundadores] marcar", e instanceof Error ? e.message : e)
    return { ok: false, error: "No se pudo marcar el taller. Intenta de nuevo." }
  }
}

export async function quitar(h: Cabeceras, id: string): Promise<Res> {
  if (!ID.test(id || "")) return { ok: false, error: "Taller no válido." }
  try {
    const todos = await leerTodos(h)
    const s = todos.find((x) => x.id === id)
    if (!s) return { ok: false, error: "No encontré ese taller." }
    const ok = await guardarMetadata(h, id, {
      ...(s.metadata ?? {}),
      fundador: false,
      fundador_desde: "",
      plan_pro_hasta: "",
    })
    return ok ? { ok: true } : { ok: false, error: "No se pudo guardar el cambio en el taller." }
  } catch (e) {
    console.error("[fundadores] quitar", e instanceof Error ? e.message : e)
    return { ok: false, error: "No se pudo quitar la marca. Intenta de nuevo." }
  }
}

// Talleres fundadores cuyo plan Pro termina pronto (o ya terminó) y a los que aún no se avisó.
// Cada taller sale una sola vez. Lo llama n8n una vez al día.
export async function porVencer(): Promise<
  Res<{ porVencer: { nombre: string; handle: string; vence: string; dias: number }[] }>
> {
  try {
    const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
    const r = await fetch(`${urlBackend()}/store/sellers?limit=100&fields=id,name,handle,metadata`, {
      headers: pk ? { "x-publishable-api-key": pk } : {},
      cache: "no-store",
    })
    if (!r.ok) throw new Error(`Medusa respondió ${r.status}`)
    const j = (await r.json()) as { sellers?: SellerCrudo[] }
    const candidatos = (j.sellers ?? [])
      .filter((s) => !esPrueba(s))
      .map(aFila)
      .filter((f) => f.fundador && f.vence && f.diasRestantes !== null && f.diasRestantes <= DIAS_AVISO)

    const nuevos: { nombre: string; handle: string; vence: string; dias: number }[] = []
    for (const f of candidatos) {
      const ins = await db().query(
        "insert into publicidad.fundadores_avisos (seller_id) values ($1) on conflict do nothing returning seller_id",
        [f.id]
      )
      if (ins.rowCount) nuevos.push({ nombre: f.nombre, handle: f.handle, vence: f.vence as string, dias: f.diasRestantes as number })
    }
    return { ok: true, porVencer: nuevos }
  } catch (e) {
    console.error("[fundadores] por vencer", e instanceof Error ? e.message : e)
    return { ok: false, error: "No se pudo revisar los vencimientos." }
  }
}
