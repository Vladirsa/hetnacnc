import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres, type Taller } from "@/lib/hetna/talleres"

// HETNA Trust & Ranking (Licitaciones 3.0, Fase 4 — sección 8.E y 8.F):
// clasificaciones públicas por especialidad y región, con reputación
// comercial y capacidad técnica por separado. Sólo cuentan evaluaciones de
// trabajos pagados y entregados en HETNA; los planes y membresías NO cuentan.

export const revalidate = 1800

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/talleres/ranking" },
  title: "Ranking de talleres CNC en México",
  description:
    "Los talleres CNC mejor evaluados por sus clientes en HETNA: corte láser, plasma, router, fresado y torno, impresión 3D y moldes, por estado. Sólo trabajos reales y pagados.",
}

const ESPECIALIDADES: { clave: string; nombre: string; re: RegExp }[] = [
  { clave: "laser", nombre: "Corte láser", re: /l[aá]ser/i },
  { clave: "plasma", nombre: "Plasma", re: /plasma/i },
  { clave: "fresado", nombre: "Fresadoras y tornos", re: /fresad|torno|maquinad|centro de/i },
  { clave: "router", nombre: "Router CNC", re: /router/i },
  { clave: "3d", nombre: "Impresión 3D", re: /3d|impresi[oó]n/i },
  { clave: "moldes", nombre: "Moldes", re: /molde/i },
]
const ORDENES = { general: "General", comercial: "Reputación comercial", tecnica: "Capacidad técnica" } as const
type Orden = keyof typeof ORDENES

// Promedio bayesiano: con pocas evaluaciones, la calificación se acerca a 4.0
// para que un taller con una sola reseña de 5 no gane a uno con 30 de 4.8.
const PRIOR = 4
const PESO = 3
const puntaje = (valor: number | undefined, n: number) => (valor == null || !n ? 0 : (PRIOR * PESO + valor * n) / (PESO + n))

const textoDe = (t: Taller) => [...t.perfil.servicios, ...t.perfil.capacidades, ...t.perfil.maquinas.map((m) => JSON.stringify(m))].join(" ")

function valorPara(t: Taller, orden: Orden) {
  const p = t.perfil
  if (orden === "comercial") return p.reputacion_comercial ?? p.calificacion
  if (orden === "tecnica") return p.capacidad_tecnica ?? p.calificacion
  return p.calificacion
}

export default async function RankingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams
  const esp = ESPECIALIDADES.find((e) => e.clave === q.esp)
  const orden: Orden = q.orden === "comercial" || q.orden === "tecnica" ? q.orden : "general"
  const proveedores = q.tipo === "proveedores"
  const todos = await listarTalleres()
  const estados = [...new Set(todos.map((t) => t.perfil.estado).filter(Boolean) as string[])].sort()
  const estado = q.estado && estados.includes(q.estado) ? q.estado : ""

  const candidatos = todos.filter((t) => {
    const tipo = t.perfil.tipo_cuenta || "taller"
    if (proveedores ? tipo === "taller" : tipo === "proveedor") return false
    if (esp && !esp.re.test(textoDe(t))) return false
    if (estado && t.perfil.estado !== estado) return false
    return true
  })
  const evaluados = candidatos
    .filter((t) => (t.perfil.resenas || 0) > 0)
    .map((t) => ({
      t,
      // Proveedores: cuenta sobre todo el cumplimiento de entregas
      s: proveedores
        ? puntaje(t.perfil.indicadores?.tiempo ?? t.perfil.calificacion, t.perfil.resenas || 0)
        : puntaje(valorPara(t, orden), t.perfil.resenas || 0),
    }))
    .sort((a, b) => b.s - a.s || (b.t.perfil.resenas || 0) - (a.t.perfil.resenas || 0))
  const sinHistorial = candidatos.filter((t) => !(t.perfil.resenas || 0)).length

  const liga = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const final = { esp: esp?.clave, estado: estado || undefined, orden: orden === "general" ? undefined : orden, tipo: proveedores ? "proveedores" : undefined, ...cambios }
    for (const [k, v] of Object.entries(final)) if (v) p.set(k, v)
    const s = p.toString()
    return `/talleres/ranking${s ? `?${s}` : ""}`
  }
  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-semibold ${activo ? "bg-[#142033] text-white" : "bg-[#F3F1EA] text-[#40403A] hover:bg-[#E7E4DC]"}`

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#C2560A]">HETNA Trust & Ranking</p>
      <h1 className="mt-1 text-3xl font-extrabold text-[#142033] sm:text-4xl">
        {proveedores ? "Proveedores con mayor cumplimiento" : `Mejores talleres${esp ? ` de ${esp.nombre.toLowerCase()}` : " CNC"}`}
        {estado ? ` en ${estado}` : " en México"}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[#6B675C]">
        Calculado sólo con evaluaciones de clientes en trabajos pagados y entregados dentro de HETNA. Pagar un plan o una membresía no cambia el lugar en
        este ranking. Un taller pequeño especializado puede quedar arriba de una fábrica grande.
      </p>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Tipo">
        <LocalizedClientLink href={liga({ tipo: undefined })} className={chip(!proveedores)}>Talleres</LocalizedClientLink>
        <LocalizedClientLink href={liga({ tipo: "proveedores", esp: undefined, orden: undefined })} className={chip(proveedores)}>Proveedores</LocalizedClientLink>
      </nav>
      {!proveedores && (
        <>
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Especialidad">
            <LocalizedClientLink href={liga({ esp: undefined })} className={chip(!esp)}>Todas</LocalizedClientLink>
            {ESPECIALIDADES.map((e) => (
              <LocalizedClientLink key={e.clave} href={liga({ esp: e.clave })} className={chip(esp?.clave === e.clave)}>
                {e.nombre}
              </LocalizedClientLink>
            ))}
          </nav>
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Ordenar por">
            {(Object.keys(ORDENES) as Orden[]).map((o) => (
              <LocalizedClientLink key={o} href={liga({ orden: o === "general" ? undefined : o })} className={chip(orden === o)}>
                {ORDENES[o]}
              </LocalizedClientLink>
            ))}
          </nav>
        </>
      )}
      {estados.length > 0 && (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Estado">
          <LocalizedClientLink href={liga({ estado: undefined })} className={chip(!estado)}>Todo México</LocalizedClientLink>
          {estados.map((e) => (
            <LocalizedClientLink key={e} href={liga({ estado: e })} className={chip(estado === e)}>
              {e}
            </LocalizedClientLink>
          ))}
        </nav>
      )}

      {evaluados.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[#E7E4DC] bg-white p-6 text-[#40403A]">
          <p className="font-bold text-[#142033]">Todavía no hay evaluaciones suficientes para este ranking.</p>
          <p className="mt-1 text-sm">
            El ranking se llena con trabajos reales: cuando un cliente recibe su pedido, evalúa al taller.{" "}
            {sinHistorial > 0 && `Hay ${sinHistorial} ${sinHistorial === 1 ? "taller" : "talleres"} aquí que aún no tienen evaluaciones. `}
            <LocalizedClientLink href="/talleres" className="font-semibold text-[#C2560A] underline">Ver el directorio</LocalizedClientLink>
          </p>
        </div>
      ) : (
        <ol className="mt-8 grid gap-3">
          {evaluados.map(({ t }, i) => {
            const p = t.perfil
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E7E4DC] bg-white p-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${i < 3 ? "bg-[#C2560A] text-white" : "bg-[#F3F1EA] text-[#142033]"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <LocalizedClientLink href={`/talleres/${t.handle}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                    {t.nombre}
                  </LocalizedClientLink>
                  {t.verificado && <span className="ml-2 text-xs font-bold text-[#1E7B3A]">✓ Verificado</span>}
                  <p className="text-xs text-[#6B675C]">
                    {[p.ciudad, p.estado].filter(Boolean).join(", ")}
                    {p.servicios.length ? ` · ${p.servicios.slice(0, 3).join(", ")}` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center text-xs text-[#6B675C]">
                  <div><b className="block text-lg text-[#142033]">{p.calificacion ?? "—"}</b>General</div>
                  <div><b className="block text-lg text-[#142033]">{p.reputacion_comercial ?? "—"}</b>Comercial</div>
                  <div><b className="block text-lg text-[#142033]">{p.capacidad_tecnica ?? "—"}</b>Técnica</div>
                </div>
                <span className="w-full text-xs text-[#6B675C] sm:w-auto">
                  {p.resenas} {p.resenas === 1 ? "evaluación" : "evaluaciones"}
                  {!p.historial_suficiente && " · historial aún corto"}
                  {t.certificaciones.length > 0 && ` · 🎖 ${t.certificaciones.length} certificación(es)`}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {evaluados.length > 0 && sinHistorial > 0 && (
        <p className="mt-4 text-sm text-[#6B675C]">
          {sinHistorial} {sinHistorial === 1 ? "taller más aún no tiene" : "talleres más aún no tienen"} evaluaciones y no aparecen en el ranking.{" "}
          <LocalizedClientLink href="/talleres" className="font-semibold text-[#C2560A] underline">Ver directorio completo</LocalizedClientLink>
        </p>
      )}
    </main>
  )
}
