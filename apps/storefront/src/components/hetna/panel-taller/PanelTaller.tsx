"use client"

// Panel del taller en la tienda (/mx/panel-taller).
//
// Usa la sesión del panel de vendedores (/seller): la cookie es del mismo
// dominio, así que todo se lee y se escribe con los mismos endpoints /vendor/*
// que usa el panel de vendedores, sin duplicar reglas:
//   GET  /vendor/sellers/me                       nombre, logo, perfil y calificación
//   GET  /vendor/hetna-solicitudes                solicitudes, propuestas, trabajos y cupo del plan
//   GET  /vendor/hetna-panel-taller               interruptor y etapas de los trabajos
//   POST /vendor/hetna-panel-taller               { recibe_solicitudes }
//   POST /vendor/hetna-solicitudes/:id/propuesta  { precio (con IVA), dias, condiciones }
//   POST /vendor/hetna-solicitudes/:id/etapa-taller   avanzar etapa (avisa al cliente)
//   POST /vendor/hetna-solicitudes/:id/avance     { tipo: "entregada", paqueteria, guia }
//   GET  /vendor/hetna-solicitudes/:id/archivos   ligas firmadas de los archivos del cliente
//
// Reglas: precios siempre en MXN con IVA incluido; el cliente cotiza sin
// registrarse, el taller necesita su cuenta para responder; nunca se muestran
// datos de contacto del cliente (el servidor ya no los manda).
import { useCallback, useEffect, useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// ---------------------------------------------------------------------------
// Tipos (lo que regresan los endpoints, sólo lo que usa el panel)
// ---------------------------------------------------------------------------
type Archivo = { nombre: string; tamano?: number }
type Trabajo = {
  descripcion?: string
  necesidad?: string
  servicio?: string
  material?: string
  cantidad?: string
  medidas?: string
  tolerancia?: string
  acabado?: string
  fecha?: string
  ciudad?: string
  estado_mx?: string
  presupuesto?: string
  frecuencia?: string
  archivos?: Archivo[]
}
type MiPropuesta = {
  id: string
  precio: number
  dias: number
  estado: string
  condiciones?: string
  vigencia_dias?: number
  fecha_entrega?: string | null
  materiales?: string | null
  condiciones_pago?: string | null
  garantia?: string | null
}
type Solicitud = {
  id: string
  folio: string
  para_mi: boolean
  estado: string
  etapa: string | null
  etapa_nombre: string | null
  pagada: boolean
  cierra_en: string | null
  creada: string
  trabajo: Trabajo
  tipo: "fabricacion" | "suministro"
  mi_respuesta: { motivo: string } | null
  propuestas_recibidas: number
  cobro: { modo: string | null; comision_pct: number | null; pagado: number } | null
  mi_propuesta: MiPropuesta | null
  reputacion_cliente?: { promedio: number | null; evaluaciones: number; suficiente: boolean }
}
type Cupo = { plan: "gratis" | "taller" | "pro"; nombre: string; limite: number | null; usadas: number; quedan: number | null } | null
type Seller = {
  id: string
  name: string
  handle: string
  logo?: string | null
  banner?: string | null
  metadata?: { perfil?: Record<string, any> } | null
}
type EtapaTaller = "en_corte" | "en_produccion" | "en_acabado" | "listo"

const ETAPAS: { clave: EtapaTaller; nombre: string }[] = [
  { clave: "en_corte", nombre: "En corte" },
  { clave: "en_produccion", nombre: "En producción" },
  { clave: "en_acabado", nombre: "En acabado" },
  { clave: "listo", nombre: "Listo para entregar" },
]

// Planes del Cotizador (MXN al mes). El cupo del servidor junta Pro e
// Industrial como "pro" (los dos sin límite de cotizaciones).
const PRECIO_PLAN: Record<string, string> = { gratis: "$0", taller: "$299", pro: "$599" }

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Math.round(n || 0))

const TZ = "America/Mexico_City"
const diaMx = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ })
const venceHoy = (iso: string | null) => Boolean(iso) && diaMx(new Date(iso!)) === diaMx(new Date())
const vencido = (iso: string | null) => Boolean(iso) && new Date(iso!).getTime() < Date.now()

function fechaLimite(iso: string | null) {
  if (!iso) return "Sin fecha límite"
  const d = new Date(iso)
  if (venceHoy(iso)) return `Vence hoy, ${d.toLocaleTimeString("es-MX", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}`
  const manana = new Date(Date.now() + 86_400_000)
  if (diaMx(d) === diaMx(manana)) return "Vence mañana"
  return `Vence el ${d.toLocaleDateString("es-MX", { timeZone: TZ, day: "numeric", month: "short" })}`
}

async function vendor<T = any>(ruta: string, init?: RequestInit): Promise<{ ok: boolean; status: number; datos: T }> {
  const r = await fetch(ruta, {
    credentials: "include",
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers || {}) },
  })
  const datos = (await r.json().catch(() => ({}))) as T
  return { ok: r.ok, status: r.status, datos }
}

/** Qué le falta al perfil (mismas reglas que Mi perfil del panel de vendedores). */
function revisarPerfil(s: Seller | null) {
  const p = s?.metadata?.perfil || {}
  const pasos: [string, boolean][] = [
    ["foto del taller (logo)", Boolean(s?.logo)],
    ["foto de portada", Boolean(s?.banner)],
    ["frase corta", Boolean(String(p.lema || "").trim())],
    ["ubicación", Boolean(p.ciudad && p.estado)],
    ["horario de atención", Boolean(String(p.horario || "").trim())],
    ["servicios", Array.isArray(p.servicios) && p.servicios.length > 0],
    ["materiales", Array.isArray(p.materiales) && p.materiales.length > 0],
    ["máquinas", Array.isArray(p.maquinas) && p.maquinas.length > 0],
    ["3 fotos de trabajos", Array.isArray(p.galeria) && p.galeria.length >= 3],
  ]
  const hechos = pasos.filter(([, ok]) => ok).length
  return { pct: Math.round((hechos / pasos.length) * 100), faltan: pasos.filter(([, ok]) => !ok).map(([n]) => n) }
}

const esNueva = (s: Solicitud) =>
  s.estado === "abierta" && !s.mi_propuesta && (!s.mi_respuesta || s.mi_respuesta.motivo === "mas_info") && !vencido(s.cierra_en)
const esRespondida = (s: Solicitud) => Boolean(s.mi_propuesta) && !["elegida", "descartada"].includes(s.mi_propuesta!.estado)
const esAceptada = (s: Solicitud) => s.mi_propuesta?.estado === "elegida"
// El dinero queda apartado con HETNA (SafeDeal) cuando el cliente le pagó a
// HETNA y todavía no confirma que recibió.
const enSafeDeal = (s: Solicitud) =>
  esAceptada(s) && s.pagada && (s.cobro?.modo === "hetna" || !s.cobro?.modo) && s.etapa !== "cerrada" && s.etapa !== "cancelada"

function tituloDe(t: Trabajo) {
  const base = String(t.necesidad || t.descripcion || "").trim().split(/\n/)[0]
  if (base) return base.length > 80 ? `${base.slice(0, 78)}…` : base
  return [t.servicio, t.material].filter(Boolean).join(" · ") || "Trabajo de fabricación CNC"
}

// ---------------------------------------------------------------------------
// Íconos (trazos simples, heredan el color)
// ---------------------------------------------------------------------------
const I = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d={d} />
  </svg>
)
const IC = {
  resumen: "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z",
  solicitudes: "M4 4h16v12H5.2L4 17.2V4zM8 8h8M8 12h5",
  trabajos: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z",
  cotizador: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01",
  mensajes: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  perfil: "M3 21v-8l9-6 9 6v8M9 21v-6h6v6",
  archivo: "M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4zM14 3v4h4",
  reloj: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  pin: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  escudo: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z",
  estrella: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z",
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function PanelTaller() {
  const [estado, setEstado] = useState<"cargando" | "sin-sesion" | "error" | "listo">("cargando")
  const [seller, setSeller] = useState<Seller | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cupo, setCupo] = useState<Cupo>(null)
  const [recibe, setRecibe] = useState(true)
  const [etapas, setEtapas] = useState<Record<string, EtapaTaller>>({})
  const [aviso, setAviso] = useState("")

  const cargar = useCallback(async () => {
    try {
      const me = await vendor<{ seller?: Seller }>("/vendor/sellers/me?fields=id,name,handle,logo,banner,metadata")
      if (me.status === 401 || me.status === 403 || !me.datos?.seller) {
        setEstado("sin-sesion")
        return
      }
      setSeller(me.datos.seller)
      const [sol, panel] = await Promise.all([
        vendor<{ solicitudes?: Solicitud[]; cupo?: Cupo }>("/vendor/hetna-solicitudes"),
        vendor<{ recibe_solicitudes?: boolean; etapas?: Record<string, EtapaTaller> }>("/vendor/hetna-panel-taller"),
      ])
      if (!sol.ok) throw new Error()
      setSolicitudes(sol.datos.solicitudes || [])
      setCupo(sol.datos.cupo ?? null)
      if (panel.ok) {
        setRecibe(panel.datos.recibe_solicitudes !== false)
        setEtapas(panel.datos.etapas || {})
      }
      setEstado("listo")
    } catch {
      setEstado("error")
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(""), 4500)
    return () => clearTimeout(t)
  }, [aviso])

  const nuevas = useMemo(() => solicitudes.filter(esNueva), [solicitudes])
  const trabajos = useMemo(
    () => solicitudes.filter((s) => esAceptada(s) && !["cerrada", "cancelada"].includes(String(s.etapa))),
    [solicitudes]
  )
  const porLiberar = useMemo(
    () =>
      solicitudes.filter(enSafeDeal).reduce((suma, s) => {
        const pagado = s.cobro?.pagado || s.mi_propuesta?.precio || 0
        return suma + pagado * (1 - (s.cobro?.comision_pct || 0) / 100)
      }, 0),
    [solicitudes]
  )
  const nSafeDeal = solicitudes.filter(enSafeDeal).length
  const perfil = useMemo(() => revisarPerfil(seller), [seller])

  const cambiarRecibe = async (v: boolean) => {
    setRecibe(v)
    const r = await vendor("/vendor/hetna-panel-taller", { method: "POST", body: JSON.stringify({ recibe_solicitudes: v }) })
    if (!r.ok) {
      setRecibe(!v)
      setAviso("No se pudo cambiar. Intenta de nuevo.")
    } else {
      setAviso(v ? "Listo: vuelves a recibir solicitudes nuevas." : "Pausado: no te llegarán avisos de solicitudes nuevas.")
    }
  }

  if (estado === "cargando") return <Cargando />
  if (estado === "sin-sesion") return <SinSesion />
  if (estado === "error")
    return (
      <Centro>
        <p className="text-[15px] text-[#3F3D37]">No pudimos cargar tu panel.</p>
        <button type="button" onClick={() => { setEstado("cargando"); cargar() }} className={BTN_PRIMARIO}>
          Reintentar
        </button>
      </Centro>
    )

  const calif = seller?.metadata?.perfil?.calificacion
  const nResenas = Number(seller?.metadata?.perfil?.resenas || 0)
  const nombre = seller?.name || "tu taller"
  const hoyVence = nuevas.filter((s) => venceHoy(s.cierra_en)).sort((a, b) => String(a.cierra_en).localeCompare(String(b.cierra_en)))[0]
  const esperandoPago = trabajos.filter((t) => !t.pagada).length

  return (
    <div className="lg:flex">
      <BarraLateral nuevas={nuevas.length} cupo={cupo} />

      <div className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-8">
        {/* Encabezado */}
        <header id="resumen" className="flex scroll-mt-24 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] text-[#6B6A63] first-letter:uppercase">
              {new Date().toLocaleDateString("es-MX", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-0.5 font-display text-[26px] font-bold leading-tight text-[#142033] sm:text-[30px]">
              Hola, {nombre}
            </h1>
          </div>
          <Interruptor activo={recibe} alCambiar={cambiarRecibe} />
        </header>

        {!recibe && (
          <p className="mt-4 rounded-xl border border-[#F2D4B8] bg-[#FDF3EA] px-4 py-3 text-[14px] text-[#8A3F06]">
            Pausaste las solicitudes: no te avisamos de solicitudes nuevas. Las que un cliente te mande directo te siguen llegando.
          </p>
        )}

        {/* Alerta de perfil */}
        {perfil.pct < 100 && (
          <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
            <Anillo pct={perfil.pct} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#1B1B18]">Tu perfil está {perfil.pct}% completo</p>
              <p className="mt-0.5 text-[14px] text-[#5C5A53]">
                Te falta: <span className="font-medium text-[#1B1B18]">{perfil.faltan.join(", ")}</span>. Los perfiles completos aparecen
                primero en el directorio de talleres.
              </p>
            </div>
            <a href="/seller/perfil-taller" className={`${BTN_SECUNDARIO} shrink-0`}>
              Completar perfil
            </a>
          </section>
        )}

        {/* Indicadores */}
        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
          <Indicador
            etiqueta="Solicitudes nuevas"
            valor={String(nuevas.length)}
            icono={IC.solicitudes}
            nota={
              hoyVence ? (
                <span className="font-semibold text-[#C2560A]">{hoyVence.folio} vence hoy</span>
              ) : nuevas.length ? (
                "Ninguna vence hoy"
              ) : (
                "Te avisamos cuando llegue una"
              )
            }
            destacado={Boolean(hoyVence)}
          />
          <Indicador
            etiqueta="Trabajos en curso"
            valor={String(trabajos.length)}
            icono={IC.trabajos}
            nota={esperandoPago ? `${esperandoPago} esperando el pago del cliente` : trabajos.length ? "Todos pagados" : "Aún sin trabajos ganados"}
          />
          <Indicador
            etiqueta="Por liberar en SafeDeal"
            valor={mxn(porLiberar)}
            icono={IC.escudo}
            nota={nSafeDeal ? `${nSafeDeal} ${nSafeDeal === 1 ? "trabajo" : "trabajos"} · ya sin comisión` : "Nada apartado por ahora"}
          />
          <Indicador
            etiqueta="Calificación"
            valor={nResenas > 0 && typeof calif === "number" ? `${calif.toFixed(1)} ★` : "Aún sin reseñas"}
            valorChico={!(nResenas > 0 && typeof calif === "number")}
            icono={IC.estrella}
            nota={nResenas > 0 ? `${nResenas} ${nResenas === 1 ? "reseña" : "reseñas"} de trabajos entregados` : "Llegan al entregar tu primer trabajo"}
          />
        </section>

        <Solicitudes
          solicitudes={solicitudes}
          cupo={cupo}
          alEnviar={(id, p) => {
            setSolicitudes((xs) =>
              xs.map((s) => (s.id === id ? { ...s, mi_propuesta: { id: s.mi_propuesta?.id || "nueva", estado: "enviada", ...p } } : s))
            )
            setCupo((c) => (c && c.limite != null ? { ...c, usadas: c.usadas + 1, quedan: Math.max(0, (c.quedan ?? 0) - 1) } : c))
            setAviso("Cotización enviada. Le avisamos al cliente.")
          }}
        />

        <Trabajos
          trabajos={trabajos}
          etapas={etapas}
          alAvanzar={(id, etapa) => {
            setEtapas((e) => ({ ...e, [id]: etapa }))
            setAviso("Etapa actualizada. Le avisamos al cliente.")
          }}
          alEntregar={(id) => {
            setSolicitudes((xs) => xs.map((s) => (s.id === id ? { ...s, etapa: "entregada", etapa_nombre: "Entregada" } : s)))
            setAviso("Marcado como entregado. Le avisamos al cliente.")
          }}
        />
      </div>

      {aviso && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl bg-[#142033] px-4 py-3 text-center text-[14px] text-white shadow-lg lg:bottom-6">
          {aviso}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barra lateral (en celular: barra arriba con las secciones en fila)
// ---------------------------------------------------------------------------
function BarraLateral({ nuevas, cupo }: { nuevas: number; cupo: Cupo }) {
  const items: { href: string; texto: string; icono: string; cuenta?: number; externo?: boolean }[] = [
    { href: "#resumen", texto: "Resumen", icono: IC.resumen },
    { href: "#solicitudes", texto: "Solicitudes", icono: IC.solicitudes, cuenta: nuevas },
    { href: "#trabajos", texto: "Trabajos", icono: IC.trabajos },
    { href: "/api/app/entrar-cotizador", texto: "Cotizador", icono: IC.cotizador, externo: true },
    { href: "/seller/mensajes", texto: "Mensajes", icono: IC.mensajes, externo: true },
    { href: "/seller/perfil-taller", texto: "Máquinas y perfil", icono: IC.perfil, externo: true },
  ]
  return (
    <aside className="z-30 bg-[#142033] text-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-6">
        <LocalizedClientLink href="/" className="font-display text-[19px] font-bold tracking-tight">
          HETNA <span className="text-[#FF8A3D]">CNC</span>
        </LocalizedClientLink>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80 lg:hidden">Taller</span>
      </div>
      <nav aria-label="Secciones del panel" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
        {items.map((it) => (
          <a
            key={it.href}
            href={it.href}
            className="flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-xl px-3 text-[14px] font-medium text-white/80 hover:bg-white/10 hover:text-white lg:px-3.5"
          >
            <I d={it.icono} className="h-[18px] w-[18px]" />
            <span className="whitespace-nowrap">{it.texto}</span>
            {it.cuenta ? (
              <span className="ml-auto min-w-[22px] rounded-full bg-[#FF6A1A] px-1.5 text-center text-[12px] font-bold leading-[22px] text-white">{it.cuenta}</span>
            ) : null}
          </a>
        ))}
      </nav>
      <div className="hidden lg:mt-auto lg:block lg:p-4">
        <TarjetaPlan cupo={cupo} />
      </div>
      <div className="px-4 pb-3 lg:hidden">
        <TarjetaPlan cupo={cupo} compacta />
      </div>
    </aside>
  )
}

function TarjetaPlan({ cupo, compacta = false }: { cupo: Cupo; compacta?: boolean }) {
  const plan = cupo?.plan || "gratis"
  const nombre = cupo?.nombre || "Gratis"
  const limite = cupo?.limite ?? null
  const usadas = cupo?.usadas ?? 0
  const pct = limite ? Math.min(100, Math.round((usadas / limite) * 100)) : 0
  const lleno = limite != null && usadas >= limite
  return (
    <div className={`rounded-2xl bg-white/[0.07] ${compacta ? "flex items-center gap-3 px-3 py-2.5" : "p-4"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold">Plan {nombre}</p>
          <p className="text-[12px] text-white/60">{PRECIO_PLAN[plan] || "$0"} MXN/mes</p>
        </div>
        {cupo === null ? (
          <p className="mt-1 text-[12px] text-white/60">No pudimos leer tu uso de este mes.</p>
        ) : limite == null ? (
          <p className="mt-1 text-[12px] text-white/70">Cotizaciones sin límite este mes ({usadas} enviadas)</p>
        ) : (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={usadas} aria-valuemin={0} aria-valuemax={limite} aria-label="Cotizaciones usadas este mes">
              <div className={`h-full rounded-full ${lleno ? "bg-[#F2B544]" : "bg-[#FF8A3D]"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-white/70">
              {usadas} de {limite} cotizaciones este mes
            </p>
          </>
        )}
      </div>
      {(plan !== "pro" || !compacta) && (
        <LocalizedClientLink
          href="/servicios/cotizador-cnc#planes"
          className={`inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 text-[13px] font-semibold ${
            compacta ? "shrink-0" : "mt-3 w-full"
          } ${plan === "pro" ? "text-white/80 underline-offset-2 hover:underline" : "bg-[#FF6A1A] text-white hover:bg-[#E65C12]"}`}
        >
          {plan === "pro" ? "Ver planes" : "Mejorar plan"}
        </LocalizedClientLink>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Encabezado: interruptor
// ---------------------------------------------------------------------------
function Interruptor({ activo, alCambiar }: { activo: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => alCambiar(!activo)}
      className="flex min-h-[44px] items-center gap-3 self-start rounded-full border border-[#E7E4DC] bg-white py-1.5 pl-4 pr-1.5 text-[14px] font-medium text-[#1B1B18] sm:self-auto"
    >
      <span>{activo ? "Recibiendo solicitudes" : "Solicitudes en pausa"}</span>
      <span className={`relative h-7 w-12 rounded-full transition-colors ${activo ? "bg-[#16794F]" : "bg-[#C9C5BA]"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${activo ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  )
}

function Anillo({ pct }: { pct: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#EFECE4" strokeWidth="6" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="#FF6A1A" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[13px] font-bold text-[#142033]">{pct}%</span>
    </div>
  )
}

function Indicador({
  etiqueta,
  valor,
  nota,
  icono,
  destacado = false,
  valorChico = false,
}: {
  etiqueta: string
  valor: string
  nota: React.ReactNode
  icono: string
  destacado?: boolean
  valorChico?: boolean
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${destacado ? "border-[#F2B98C] ring-1 ring-[#F2B98C]" : "border-[#E7E4DC]"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[#6B6A63]">{etiqueta}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F6F4EF] text-[#142033]">
          <I d={icono} className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-2 font-display font-bold text-[#142033] ${valorChico ? "text-[19px] leading-[34px]" : "text-[28px] leading-[34px]"}`}>{valor}</p>
      <p className="mt-1 text-[13px] text-[#6B6A63]">{nota}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Solicitudes de cotización
// ---------------------------------------------------------------------------
type Filtro = "todas" | "nuevas" | "respondidas" | "aceptadas"

function Solicitudes({
  solicitudes,
  cupo,
  alEnviar,
}: {
  solicitudes: Solicitud[]
  cupo: Cupo
  alEnviar: (id: string, p: { precio: number; dias: number; condiciones: string }) => void
}) {
  const [filtro, setFiltro] = useState<Filtro>("nuevas")
  const grupos: Record<Filtro, Solicitud[]> = useMemo(() => {
    const visibles = solicitudes.filter((s) => esNueva(s) || esRespondida(s) || esAceptada(s))
    return {
      todas: visibles,
      nuevas: visibles.filter(esNueva),
      respondidas: visibles.filter(esRespondida),
      aceptadas: visibles.filter(esAceptada),
    }
  }, [solicitudes])
  const lista = [...grupos[filtro]].sort((a, b) => {
    const fa = a.cierra_en ? new Date(a.cierra_en).getTime() : Infinity
    const fb = b.cierra_en ? new Date(b.cierra_en).getTime() : Infinity
    return fa - fb
  })
  const filtros: [Filtro, string][] = [
    ["todas", "Todas"],
    ["nuevas", "Nuevas"],
    ["respondidas", "Respondidas"],
    ["aceptadas", "Aceptadas"],
  ]

  return (
    <section id="solicitudes" className="mt-9 scroll-mt-28">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-[21px] font-bold text-[#142033]">Solicitudes de cotización</h2>
          <p className="text-[14px] text-[#6B6A63]">Ordenadas por fecha límite. Tus precios van en MXN con IVA incluido.</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#ECE9E1] p-1 sm:flex" role="tablist" aria-label="Filtrar solicitudes">
          {filtros.map(([k, t]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filtro === k}
              onClick={() => setFiltro(k)}
              className={`min-h-[44px] shrink-0 rounded-lg px-3.5 text-[14px] font-medium ${
                filtro === k ? "bg-white text-[#142033] shadow-sm" : "text-[#5C5A53] hover:text-[#142033]"
              }`}
            >
              {t} <span className="ml-0.5 text-[12px] text-[#8A877E]">{grupos[k].length}</span>
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#D9D5CB] bg-white px-5 py-10 text-center">
          <p className="text-[15px] font-medium text-[#1B1B18]">
            {filtro === "nuevas" ? "No tienes solicitudes nuevas" : filtro === "aceptadas" ? "Aún no te aceptan una cotización" : "Nada por aquí"}
          </p>
          <p className="mt-1 text-[14px] text-[#6B6A63]">Los clientes cotizan sin registrarse; te avisamos por correo y aquí en cuanto llegue una para ti.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {lista.map((s) => (
            <TarjetaSolicitud key={s.id} s={s} cupo={cupo} alEnviar={alEnviar} />
          ))}
        </div>
      )}
    </section>
  )
}

function TarjetaSolicitud({
  s,
  cupo,
  alEnviar,
}: {
  s: Solicitud
  cupo: Cupo
  alEnviar: (id: string, p: { precio: number; dias: number; condiciones: string }) => void
}) {
  const [abierta, setAbierta] = useState<"no" | "cotizar" | "detalle">("no")
  const t = s.trabajo || {}
  const lugar = [t.ciudad, t.estado_mx].filter(Boolean).join(", ")
  const hoy = venceHoy(s.cierra_en)
  const nueva = esNueva(s)
  const aceptada = esAceptada(s)
  const respondida = esRespondida(s)
  const sinCupo = !s.para_mi && !s.mi_propuesta && cupo?.limite != null && (cupo.quedan ?? 0) <= 0

  return (
    <article className={`rounded-2xl border bg-white p-4 sm:p-5 ${hoy && nueva ? "border-[#F2B98C]" : "border-[#E7E4DC]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-mono font-semibold text-[#6B6A63]">{s.folio}</span>
            {nueva && <Etiqueta tono="naranja">Nueva</Etiqueta>}
            {respondida && <Etiqueta tono="azul">Respondida</Etiqueta>}
            {aceptada && <Etiqueta tono="verde">Aceptada</Etiqueta>}
            {s.para_mi && <Etiqueta tono="gris">Te la mandaron a ti</Etiqueta>}
            {s.tipo === "suministro" && <Etiqueta tono="gris">Suministro</Etiqueta>}
          </div>
          <h3 className="mt-1.5 text-[16px] font-semibold leading-snug text-[#1B1B18]">{tituloDe(t)}</h3>
        </div>
        <p className={`flex items-center gap-1.5 text-[13px] font-medium ${hoy ? "text-[#C2560A]" : "text-[#5C5A53]"}`}>
          <I d={IC.reloj} className="h-4 w-4" />
          {fechaLimite(s.cierra_en)}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
        <Dato k="Ciudad" v={lugar || "No indicada"} />
        <Dato k="Servicio" v={t.servicio || "Por definir"} />
        <Dato k="Material" v={t.material || "Por definir"} />
        <Dato k="Cantidad" v={t.cantidad || "—"} />
      </dl>

      <ArchivosCliente s={s} />

      {s.mi_propuesta && (
        <p className="mt-3 rounded-xl bg-[#F6F4EF] px-3 py-2 text-[13px] text-[#3F3D37]">
          Tu cotización: <b>{mxn(s.mi_propuesta.precio)}</b> con IVA · {s.mi_propuesta.dias} {s.mi_propuesta.dias === 1 ? "día" : "días"} de entrega
          {aceptada ? " · el cliente la aceptó" : ""}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(nueva || respondida) && s.estado === "abierta" && (
          <button
            type="button"
            onClick={() => setAbierta(abierta === "cotizar" ? "no" : "cotizar")}
            aria-expanded={abierta === "cotizar"}
            disabled={sinCupo}
            className={BTN_PRIMARIO}
          >
            {respondida ? "Cambiar cotización" : "Cotizar"}
          </button>
        )}
        <button type="button" onClick={() => setAbierta(abierta === "detalle" ? "no" : "detalle")} aria-expanded={abierta === "detalle"} className={BTN_SECUNDARIO}>
          {abierta === "detalle" ? "Ocultar detalle" : "Ver detalle"}
        </button>
      </div>
      {sinCupo && (
        <p className="mt-2 text-[13px] text-[#8A3F06]">
          Ya usaste las {cupo?.limite} cotizaciones de tu plan este mes.{" "}
          <LocalizedClientLink href="/servicios/cotizador-cnc#planes" className="font-semibold underline underline-offset-2">
            Mejora tu plan
          </LocalizedClientLink>{" "}
          para seguir cotizando.
        </p>
      )}

      {abierta === "detalle" && <Detalle s={s} />}
      {abierta === "cotizar" && (
        <FormCotizar
          s={s}
          alCancelar={() => setAbierta("no")}
          alEnviar={(p) => {
            alEnviar(s.id, p)
            setAbierta("no")
          }}
        />
      )}
    </article>
  )
}

function Detalle({ s }: { s: Solicitud }) {
  const t = s.trabajo || {}
  const filas: [string, string | undefined][] = [
    ["Lo que necesita", t.necesidad],
    ["Medidas", t.medidas],
    ["Tolerancia", t.tolerancia],
    ["Acabado", t.acabado],
    ["Fecha que necesita", t.fecha],
    ["Frecuencia", t.frecuencia],
    ["Presupuesto del cliente", t.presupuesto],
  ]
  const rep = s.reputacion_cliente
  return (
    <div className="mt-4 rounded-xl border border-[#EFECE4] bg-[#FBFAF7] p-4 text-[14px]">
      {t.descripcion && <p className="whitespace-pre-line leading-relaxed text-[#2B2A26]">{t.descripcion}</p>}
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {filas
          .filter(([, v]) => Boolean(v && String(v).trim()))
          .map(([k, v]) => (
            <Dato key={k} k={k} v={String(v)} />
          ))}
        <Dato k="Cotizaciones recibidas" v={String(s.propuestas_recibidas || 0)} />
        <Dato
          k="Cliente"
          v={rep?.suficiente && rep.promedio != null ? `★ ${rep.promedio.toFixed(1)} (${rep.evaluaciones} evaluaciones)` : "Cliente nuevo en HETNA"}
        />
      </dl>
      <p className="mt-3 text-[12px] text-[#8A877E]">Por seguridad, los datos de contacto del cliente no se muestran: todo se trata dentro de HETNA.</p>
    </div>
  )
}

function FormCotizar({
  s,
  alCancelar,
  alEnviar,
}: {
  s: Solicitud
  alCancelar: () => void
  alEnviar: (p: { precio: number; dias: number; condiciones: string }) => void
}) {
  // Propuesta completa (auditoría del 19 nov 2026, punto 4.2): precio, días de
  // fabricación, fecha de entrega, material, condiciones de pago, vigencia y
  // garantía son obligatorios; el servidor también lo revisa.
  const mp = (s.mi_propuesta || {}) as MiPropuesta
  const [precio, setPrecio] = useState(s.mi_propuesta ? String(s.mi_propuesta.precio) : "")
  const [dias, setDias] = useState(s.mi_propuesta ? String(s.mi_propuesta.dias) : "")
  const [fecha, setFecha] = useState(mp.fecha_entrega || "")
  const [vigencia, setVigencia] = useState(String(mp.vigencia_dias || 15))
  const [materiales, setMateriales] = useState(mp.materiales || "")
  const [pago, setPago] = useState(mp.condiciones_pago || "")
  const [garantia, setGarantia] = useState(mp.garantia || "")
  const [nota, setNota] = useState(s.mi_propuesta?.condiciones || "")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const hoy = new Date().toISOString().slice(0, 10)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const p = Number(String(precio).replace(/[^\d.]/g, ""))
    const d = Math.round(Number(dias))
    const v = Math.round(Number(vigencia))
    if (!(p > 0)) return setError("Escribe el precio total.")
    if (!(d >= 1 && d <= 365)) return setError("Escribe los días de fabricación (1 a 365).")
    if (!fecha || fecha < hoy) return setError("Elige la fecha estimada de entrega.")
    if (!(v >= 1 && v <= 90)) return setError("La vigencia va de 1 a 90 días.")
    if (!materiales.trim() || !pago.trim() || !garantia.trim()) return setError("Completa material, condiciones de pago y garantía.")
    setEnviando(true)
    const r = await vendor<{ message?: string }>(`/vendor/hetna-solicitudes/${s.id}/propuesta`, {
      method: "POST",
      body: JSON.stringify({
        precio: p,
        dias: d,
        moneda: "MXN",
        fecha_entrega: fecha,
        vigencia_dias: v,
        materiales: materiales.trim(),
        condiciones_pago: pago.trim(),
        garantia: garantia.trim(),
        condiciones: nota.trim(),
      }),
    }).catch(() => ({ ok: false, status: 0, datos: {} as { message?: string } }))
    setEnviando(false)
    if (!r.ok) return setError(r.datos?.message || "No se pudo enviar. Intenta de nuevo.")
    alEnviar({ precio: p, dias: d, condiciones: nota.trim() })
  }

  const campo = "mt-1 min-h-[44px] w-full rounded-xl border border-[#D9D5CB] bg-white px-3 text-[15px] outline-none focus:border-[#C2560A]"
  const area = "mt-1 w-full rounded-xl border border-[#D9D5CB] bg-white px-3 py-2 text-[15px] outline-none focus:border-[#C2560A]"
  const etiqueta = "block text-[13px] font-medium text-[#3F3D37]"

  return (
    <form onSubmit={enviar} className="mt-4 grid gap-3 rounded-xl border border-[#F2D4B8] bg-[#FFF9F4] p-4 sm:grid-cols-2">
      <p className="text-[12.5px] text-[#6B6A63] sm:col-span-2">Todos los campos con * son obligatorios: así el cliente compara tu propuesta con las demás con los mismos datos.</p>
      <label className={etiqueta}>
        Precio total (MXN, IVA incluido) *
        <div className="mt-1 flex min-h-[44px] items-center rounded-xl border border-[#D9D5CB] bg-white px-3 focus-within:border-[#C2560A]">
          <span className="text-[#8A877E]">$</span>
          <input
            inputMode="decimal"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="w-full bg-transparent px-1.5 py-2 text-[15px] outline-none"
            placeholder="0"
            aria-label="Precio total con IVA incluido"
            required
          />
        </div>
      </label>
      <label className={etiqueta}>
        Días de fabricación *
        <input inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} className={campo} placeholder="5" required />
      </label>
      <label className={etiqueta}>
        Fecha estimada de entrega *
        <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} required />
      </label>
      <label className={etiqueta}>
        Vigencia de la propuesta (días) *
        <input inputMode="numeric" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={campo} required />
      </label>
      <label className={`${etiqueta} sm:col-span-2`}>
        Material y especificaciones *
        <textarea value={materiales} onChange={(e) => setMateriales(e.target.value)} rows={2} maxLength={600} className={area} placeholder="Ej. MDF 18 mm, corte con fresa de 6 mm, tolerancia ±0.2 mm" required />
      </label>
      <label className={etiqueta}>
        Condiciones de pago *
        <textarea value={pago} onChange={(e) => setPago(e.target.value)} rows={2} maxLength={600} className={area} placeholder="Ej. 50% para empezar y 50% al entregar" required />
      </label>
      <label className={etiqueta}>
        Garantía *
        <textarea value={garantia} onChange={(e) => setGarantia(e.target.value)} rows={2} maxLength={600} className={area} placeholder="Ej. Reposición sin costo por defecto de fabricación en 30 días" required />
      </label>
      <label className={`${etiqueta} sm:col-span-2`}>
        Nota para el cliente (opcional)
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={1500} className={area} placeholder="Qué incluye, cómo se entrega…" />
        <span className="mt-1 block text-[12px] font-normal text-[#8A877E]">Sin teléfonos ni correos: el trato sigue dentro de HETNA. Puedes adjuntar planos o fotos desde el panel de vendedor.</span>
      </label>
      {error && <p className="text-[13px] text-[#B3261E] sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" disabled={enviando} className={BTN_PRIMARIO}>
          {enviando ? "Enviando…" : s.mi_propuesta ? "Guardar cambios" : "Enviar cotización"}
        </button>
        <button type="button" onClick={alCancelar} className={BTN_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function ArchivosCliente({ s }: { s: Solicitud }) {
  const archivos = s.trabajo?.archivos || []
  const [estado, setEstado] = useState<"" | "pidiendo" | "error">("")
  if (!archivos.length) return null
  const descargar = async () => {
    setEstado("pidiendo")
    const r = await vendor<{ archivos?: { nombre: string; url: string }[]; message?: string }>(`/vendor/hetna-solicitudes/${s.id}/archivos`).catch(() => null)
    if (!r?.ok || !r.datos.archivos?.length) return setEstado("error")
    setEstado("")
    for (const a of r.datos.archivos) window.open(a.url, "_blank", "noopener")
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {archivos.map((a) => (
        <span key={a.nombre} className="inline-flex items-center gap-1.5 rounded-lg bg-[#F1EEE7] px-2.5 py-1.5 text-[13px] text-[#3F3D37]">
          <I d={IC.archivo} className="h-4 w-4 text-[#6B6A63]" />
          {a.nombre}
        </span>
      ))}
      <button type="button" onClick={descargar} disabled={estado === "pidiendo"} className="min-h-[44px] rounded-lg px-2 text-[13px] font-semibold text-[#B34D07] underline-offset-2 hover:underline">
        {estado === "pidiendo" ? "Preparando…" : archivos.length === 1 ? "Descargar archivo" : "Descargar archivos"}
      </button>
      {estado === "error" && <span className="text-[13px] text-[#B3261E]">No se pudieron preparar los archivos.</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trabajos en curso
// ---------------------------------------------------------------------------
function Trabajos({
  trabajos,
  etapas,
  alAvanzar,
  alEntregar,
}: {
  trabajos: Solicitud[]
  etapas: Record<string, EtapaTaller>
  alAvanzar: (id: string, etapa: EtapaTaller) => void
  alEntregar: (id: string) => void
}) {
  return (
    <section id="trabajos" className="mt-10 scroll-mt-28">
      <h2 className="font-display text-[21px] font-bold text-[#142033]">Trabajos en curso</h2>
      <p className="text-[14px] text-[#6B6A63]">Cada vez que avanzas una etapa, el cliente recibe aviso.</p>
      {trabajos.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#D9D5CB] bg-white px-5 py-10 text-center">
          <p className="text-[15px] font-medium text-[#1B1B18]">Aún no tienes trabajos en curso</p>
          <p className="mt-1 text-[14px] text-[#6B6A63]">Cuando un cliente acepte tu cotización y pague, aparece aquí.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {trabajos.map((t) => (
            <FilaTrabajo key={t.id} t={t} etapa={etapas[t.id] || "en_corte"} alAvanzar={alAvanzar} alEntregar={alEntregar} />
          ))}
        </div>
      )}
    </section>
  )
}

function FilaTrabajo({
  t,
  etapa,
  alAvanzar,
  alEntregar,
}: {
  t: Solicitud
  etapa: EtapaTaller
  alAvanzar: (id: string, etapa: EtapaTaller) => void
  alEntregar: (id: string) => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const [entrega, setEntrega] = useState(false)
  const [paqueteria, setPaqueteria] = useState("")
  const [guia, setGuia] = useState("")
  const entregada = t.etapa === "entregada"
  const i = ETAPAS.findIndex((e) => e.clave === etapa)
  const pct = entregada ? 100 : t.pagada ? ((i + 1) / ETAPAS.length) * 100 : 0
  const monto = t.cobro?.pagado || t.mi_propuesta?.precio || 0
  const safe = enSafeDeal(t)

  const avanzar = async () => {
    setOcupado(true)
    setError("")
    const r = await vendor<{ etapa?: EtapaTaller; message?: string }>(`/vendor/hetna-solicitudes/${t.id}/etapa-taller`, { method: "POST", body: "{}" }).catch(() => null)
    setOcupado(false)
    if (!r?.ok || !r.datos.etapa) return setError(r?.datos?.message || "No se pudo avanzar. Intenta de nuevo.")
    alAvanzar(t.id, r.datos.etapa)
  }
  const entregar = async (e: React.FormEvent) => {
    e.preventDefault()
    setOcupado(true)
    setError("")
    const r = await vendor<{ message?: string }>(`/vendor/hetna-solicitudes/${t.id}/avance`, {
      method: "POST",
      body: JSON.stringify({ tipo: "entregada", paqueteria: paqueteria.trim(), guia: guia.trim() }),
    }).catch(() => null)
    setOcupado(false)
    if (!r?.ok) return setError(r?.datos?.message || "No se pudo marcar. Intenta de nuevo.")
    alEntregar(t.id)
  }

  return (
    <article className="rounded-2xl border border-[#E7E4DC] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] font-semibold text-[#6B6A63]">{t.folio}</p>
          <h3 className="mt-0.5 text-[16px] font-semibold text-[#1B1B18]">{tituloDe(t.trabajo || {})}</h3>
        </div>
        <div className="text-right">
          <p className="font-display text-[20px] font-bold text-[#142033]">{mxn(monto)}</p>
          {safe ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#16794F]">
              <I d={IC.escudo} className="h-3.5 w-3.5" /> SafeDeal apartado
            </p>
          ) : t.pagada ? (
            <p className="mt-0.5 text-[12px] text-[#6B6A63]">Pagado a tu cuenta</p>
          ) : (
            <p className="mt-0.5 text-[12px] text-[#8A3F06]">Esperando el pago</p>
          )}
        </div>
      </div>

      {/* Etapas */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-semibold text-[#142033]">
            {entregada ? "Entregado · esperando que el cliente confirme" : t.pagada ? ETAPAS[i].nombre : "Esperando el pago del cliente"}
          </span>
          {t.pagada && !entregada && <span className="text-[#8A877E]">Etapa {i + 1} de {ETAPAS.length}</span>}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EFECE4]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del trabajo">
          <div className="h-full rounded-full bg-[#FF6A1A] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-2 hidden grid-cols-4 gap-2 text-[12px] sm:grid">
          {ETAPAS.map((e, k) => (
            <li key={e.clave} className={t.pagada && (entregada || k <= i) ? "font-medium text-[#142033]" : "text-[#A19E95]"}>
              {e.nombre}
            </li>
          ))}
        </ol>
      </div>

      {t.pagada && !entregada && (
        <div className="mt-4 flex flex-wrap gap-2">
          {etapa !== "listo" ? (
            <button type="button" onClick={avanzar} disabled={ocupado} className={BTN_PRIMARIO}>
              {ocupado ? "Avanzando…" : `Avanzar a «${ETAPAS[i + 1].nombre}»`}
            </button>
          ) : (
            !entrega && (
              <button type="button" onClick={() => setEntrega(true)} className={BTN_PRIMARIO}>
                Marcar como entregado
              </button>
            )
          )}
        </div>
      )}
      {entrega && !entregada && (
        <form onSubmit={entregar} className="mt-3 grid gap-3 rounded-xl border border-[#E7E4DC] bg-[#FBFAF7] p-4 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[#3F3D37]">
            Paquetería (si la envías)
            <input value={paqueteria} onChange={(e) => setPaqueteria(e.target.value)} maxLength={60} className="mt-1 min-h-[44px] w-full rounded-xl border border-[#D9D5CB] bg-white px-3 text-[15px] outline-none focus:border-[#C2560A]" placeholder="Ej. Estafeta" />
          </label>
          <label className="block text-[13px] font-medium text-[#3F3D37]">
            Número de guía
            <input value={guia} onChange={(e) => setGuia(e.target.value)} maxLength={80} className="mt-1 min-h-[44px] w-full rounded-xl border border-[#D9D5CB] bg-white px-3 text-[15px] outline-none focus:border-[#C2560A]" />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={ocupado} className={BTN_PRIMARIO}>
              {ocupado ? "Guardando…" : "Confirmar entrega"}
            </button>
            <button type="button" onClick={() => setEntrega(false)} className={BTN_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-[13px] text-[#B3261E]">{error}</p>}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Piezas pequeñas
// ---------------------------------------------------------------------------
const BTN_PRIMARIO =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#FF6A1A] px-4 text-[14px] font-semibold text-white hover:bg-[#E65C12] disabled:cursor-not-allowed disabled:opacity-50"
const BTN_SECUNDARIO =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#D9D5CB] bg-white px-4 text-[14px] font-semibold text-[#142033] hover:border-[#142033]"

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-[#8A877E]">{k}</dt>
      <dd className="truncate font-medium text-[#1B1B18]" title={v}>
        {v}
      </dd>
    </div>
  )
}

function Etiqueta({ tono, children }: { tono: "naranja" | "azul" | "verde" | "gris"; children: React.ReactNode }) {
  const c = {
    naranja: "bg-[#FDEEE1] text-[#B34D07]",
    azul: "bg-[#E8EEF8] text-[#22406E]",
    verde: "bg-[#E3F2EA] text-[#16794F]",
    gris: "bg-[#F1EEE7] text-[#5C5A53]",
  }[tono]
  return <span className={`rounded-full px-2 py-0.5 font-semibold ${c}`}>{children}</span>
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">{children}</div>
}

function Cargando() {
  return (
    <div className="lg:flex" aria-busy="true">
      <div className="h-28 bg-[#142033] lg:fixed lg:inset-y-0 lg:w-64" />
      <div className="flex-1 px-4 pt-6 lg:ml-64 lg:px-10">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[#E7E4DC]" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  )
}

function SinSesion() {
  return (
    <Centro>
      <span className="font-display text-[22px] font-bold text-[#142033]">
        HETNA <span className="text-[#FF6A1A]">CNC</span>
      </span>
      <h1 className="font-display text-[26px] font-bold text-[#142033]">Panel del taller</h1>
      <p className="text-[15px] leading-relaxed text-[#5C5A53]">
        Aquí respondes las solicitudes de cotización y sigues tus trabajos. Los clientes cotizan sin registrarse; para responder necesitas tu
        cuenta de taller.
      </p>
      <a href="/seller" className={`${BTN_PRIMARIO} w-full`}>
        Iniciar sesión como taller
      </a>
      <LocalizedClientLink href="/talleres/unete" className={`${BTN_SECUNDARIO} w-full`}>
        Registrar mi taller
      </LocalizedClientLink>
      <p className="text-[13px] text-[#8A877E]">Después de iniciar sesión, vuelve a esta página.</p>
    </Centro>
  )
}
