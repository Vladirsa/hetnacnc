"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { FORMATOS, rutaArchivo, type ArgCajas, type EsquemaCajas } from "@/lib/hetna/cajas"
import { BloquePublicidad } from "./BloquePublicidad"

// Interfaz HETNA para un generador de Boxes.py, dentro del 2D Studio oscuro
// (mismo aspecto que la caja con juntas): parámetros a la izquierda, plano de
// corte a la derecha con zoom y arrastre, y descargas y "Fabrícamelo" fijos al
// pie del panel. En el celular el plano va arriba y fijo.
// La vista previa es el SVG que devuelve disenar/cajas/archivo/generar; se
// vuelve a pedir medio segundo después del último cambio. Boxes.py sólo da
// planos 2D: aquí no hay vista 3D.

type Valores = Record<string, string | number | boolean>

// Presets de material: espesor típico y kerf sugerido (mm)
const MATERIALES = [
  { nombre: "MDF 3 mm", thickness: 3, burn: 0.1 },
  { nombre: "MDF 6 mm", thickness: 6, burn: 0.12 },
  { nombre: "MDF 9 mm", thickness: 9, burn: 0.15 },
  { nombre: "Triplay 6 mm", thickness: 6, burn: 0.15 },
  { nombre: "Acrílico 3 mm", thickness: 3, burn: 0.08 },
  { nombre: "Acrílico 5 mm", thickness: 5, burn: 0.1 },
]

const inicial = (e: EsquemaCajas): Valores => {
  const v: Valores = {}
  for (const g of e.grupos) for (const a of g.args) if (a.default !== null && a.default !== undefined) v[a.nombre] = a.default as string | number | boolean
  return v
}

const aQuery = (v: Valores) => {
  const q = new URLSearchParams()
  for (const [k, x] of Object.entries(v)) q.set(k, typeof x === "boolean" ? (x ? "1" : "0") : String(x))
  return q
}

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522217076014"

// Otros diseños a la mano (los tipos de makercase y la caja propia en 3D)
const OTROS: { id: string; nombre: string }[] = [
  { id: "SlidingLidBox", nombre: "Tapa corrediza" },
  { id: "HingeBox", nombre: "Con bisagra" },
  { id: "SlidingDrawer", nombre: "Cajonera" },
  { id: "TypeTray", nombre: "Divisiones a medida" },
  { id: "StackableBin", nombre: "Apilable" },
  { id: "RegularBox", nombre: "Poligonal" },
  { id: "FlexBox", nombre: "Curva" },
  { id: "TwoPiece", nombre: "Dos piezas" },
]

// Medidas que llegan en la liga (?x=&y=&h=&thickness=&outside=): sólo las
// que este generador tiene, para seguir con la caja que el usuario ya traía
const LLEGAN = ["x", "y", "h", "thickness", "outside"]

// Interruptor propio: importarlo de estudio3d/Controles metería three.js
// (~100 kB) en esta página, que no tiene vista 3D
const Interruptor = ({ etiqueta, activo, cambiar }: { etiqueta: string; activo: boolean; cambiar: (v: boolean) => void }) => (
  <button type="button" onClick={() => cambiar(!activo)} aria-pressed={activo} className="flex items-center justify-between gap-3 text-left">
    <span className="text-[13.5px] text-[#E6EBF2]">{etiqueta}</span>
    <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${activo ? "bg-[#C2560A]" : "bg-[#2B3648]"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${activo ? "left-[18px]" : "left-0.5"}`} />
    </span>
  </button>
)

const campoOscuro =
  "w-full rounded-[8px] bg-[#1C2431] px-2.5 py-2 text-[14px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"

const Campo = ({ a, valor, cambiar }: { a: ArgCajas; valor: string | number | boolean | undefined; cambiar: (v: string | number | boolean) => void }) => {
  const id = `arg-${a.nombre}`
  if (a.tipo === "bool") return <Interruptor etiqueta={a.etiqueta} activo={Boolean(valor)} cambiar={cambiar} />
  if (a.opciones) {
    return (
      <label htmlFor={id} className="flex flex-col gap-1 text-[12.5px] text-[#C9D2E0]" title={a.ayuda}>
        {a.etiqueta}
        <select id={id} value={String(valor ?? "")} onChange={(e) => cambiar(e.target.value)} className={campoOscuro + " text-ellipsis pr-8 text-[13px]"}>
          {a.opciones.map((o) => (
            // sin la letra de código de Boxes.py ("h Canto…" -> "Canto…")
            <option key={o.valor} value={o.valor} className="bg-[#1C2431]">
              {String(o.valor).length === 1 && String(o.nombre).startsWith(`${o.valor} `) ? String(o.nombre).slice(2) : o.nombre}
            </option>
          ))}
        </select>
      </label>
    )
  }
  const esNum = a.tipo === "int" || a.tipo === "float"
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-[12.5px] text-[#C9D2E0]" title={a.ayuda}>
      {a.etiqueta}
      <input
        id={id}
        type="text"
        inputMode={esNum ? "decimal" : "text"}
        value={String(valor ?? "")}
        onChange={(e) => cambiar(esNum ? e.target.value.replace(",", ".") : e.target.value)}
        className={campoOscuro}
      />
    </label>
  )
}

const Boton = ({ href, children, tipo = "secundario", titulo, descarga }: { href: string; children: React.ReactNode; tipo?: "primario" | "secundario" | "verde"; titulo?: string; descarga?: boolean }) => (
  <a
    href={href}
    title={titulo}
    {...(descarga ? { download: true } : { target: "_blank", rel: "noopener noreferrer" })}
    className={`flex-1 rounded-[8px] px-2 py-2 text-center text-[13px] font-semibold text-white ${
      tipo === "primario" ? "bg-[#C2560A] hover:bg-[#A84A08]" : tipo === "verde" ? "bg-[#16794F] hover:bg-[#12623F]" : "bg-[#2B3648] hover:bg-[#344158]"
    }`}
  >
    {children}
  </a>
)

export const GeneradorCajas = ({ esquema, locale }: { esquema: EsquemaCajas; locale: string }) => {
  const [valores, setValores] = useState<Valores>(() => inicial(esquema))
  const [material, setMaterial] = useState<string>("")
  const [vista, setVista] = useState<string>("")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abiertos, setAbiertos] = useState<Record<number, boolean>>({ 0: true, 1: true })
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Medidas que trae la liga desde la caja con juntas u otro generador
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const existen = new Set(esquema.grupos.flatMap((g) => g.args.map((a) => a.nombre)))
    const nuevos: Valores = {}
    for (const k of LLEGAN) {
      const v = q.get(k)
      if (v !== null && v !== "" && existen.has(k) && /^[0-9.]+$/.test(v)) nuevos[k] = k === "outside" ? v === "1" : v
    }
    if (Object.keys(nuevos).length) setValores((p) => ({ ...p, ...nuevos }))
  }, [esquema])

  const query = useMemo(() => aQuery(valores).toString(), [valores])

  // Vista previa en vivo (se espera medio segundo tras el último cambio)
  useEffect(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(async () => {
      setCargando(true)
      setError(null)
      try {
        const r = await fetch(rutaArchivo(locale, "generar", esquema.id, `formato=svg&${query}`))
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || "No se pudo generar con esos valores.")
        }
        // Sólo para verlo en el estudio oscuro: cortes en naranja, cortes
        // interiores en azul y líneas de grosor fijo en pantalla. Las descargas
        // no pasan por aquí: salen tal cual del servicio.
        const svg = (await r.text())
          .replace(/stroke="rgb\(0,0,0\)"/g, 'stroke="#FF7A2E"')
          .replace(/stroke="rgb\(0,0,255\)"/g, 'stroke="#5FA8F5"')
          .replace(/stroke-width="[^"]*"/g, 'stroke-width="1.3" vector-effect="non-scaling-stroke"')
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
        // suelta el plano anterior: si no, cada cambio deja uno en memoria
        setVista((viejo) => {
          if (viejo) URL.revokeObjectURL(viejo)
          return url
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo generar.")
      } finally {
        setCargando(false)
      }
    }, 500)
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [esquema.id, query, locale])

  // ---- Zoom y arrastre del plano (rueda, ratón, uno o dos dedos) ----
  const cajaRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 })
  const camRef = useRef(cam)
  camRef.current = cam
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const gesto = useRef<{ dist: number; k: number; cx: number; cy: number; vx: number; vy: number } | null>(null)
  const desdeCentro = (x: number, y: number) => {
    const c = cajaRef.current?.getBoundingClientRect()
    return c ? [x - c.left - c.width / 2, y - c.top - c.height / 2] : [0, 0]
  }
  const zoomEn = (k: number, px: number, py: number) => {
    const b = camRef.current
    const nk = Math.min(40, Math.max(0.3, k))
    const r = nk / b.k
    setCam({ k: nk, x: px - (px - b.x) * r, y: py - (py - b.y) * r })
  }
  useEffect(() => {
    const el = cajaRef.current
    if (!el) return
    const onRueda = (e: WheelEvent) => {
      e.preventDefault()
      const [px, py] = desdeCentro(e.clientX, e.clientY)
      zoomEn(camRef.current.k * Math.pow(1.0018, -e.deltaY), px, py)
    }
    el.addEventListener("wheel", onRueda, { passive: false })
    return () => el.removeEventListener("wheel", onRueda)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const empezarGesto = () => {
    const ps = [...punteros.current.values()]
    const v = camRef.current
    if (ps.length >= 2) {
      const [a, b] = ps
      const [cx, cy] = desdeCentro((a.x + b.x) / 2, (a.y + b.y) / 2)
      gesto.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: v.k, cx, cy, vx: v.x, vy: v.y }
    } else if (ps.length === 1) gesto.current = { dist: 0, k: v.k, cx: ps[0].x, cy: ps[0].y, vx: v.x, vy: v.y }
    else gesto.current = null
  }

  const cambiar = (nombre: string) => (v: string | number | boolean) => setValores((p) => ({ ...p, [nombre]: v }))

  const elegirMaterial = (m: (typeof MATERIALES)[number]) => {
    setMaterial(m.nombre)
    setValores((p) => ({ ...p, thickness: m.thickness, burn: m.burn }))
  }

  const medidas = ["x", "y", "h"].map((k) => valores[k]).filter((v) => v !== undefined && v !== "").join(" × ")
  const fabricar = `/${locale}/cotizar?${new URLSearchParams({
    desde: "cajas",
    pieza: esquema.nombre,
    medidas: medidas ? `${medidas} mm` : "",
    material: material || `espesor ${valores.thickness ?? ""} mm`,
    proceso: "Corte láser",
    archivo: rutaArchivo(locale, "generar", esquema.id, `formato=dxf&${query}`),
  }).toString()}`
  const mensaje = `Hola HETNA CNC, quiero cotizar el corte de: ${esquema.nombre}${medidas ? ` de ${medidas} mm` : ""}, ${material || `material de ${valores.thickness ?? ""} mm`}.`
  // medidas para pasar a otro diseño
  const llevar = new URLSearchParams()
  for (const k of LLEGAN) if (valores[k] !== undefined && valores[k] !== "") llevar.set(k, typeof valores[k] === "boolean" ? (valores[k] ? "1" : "0") : String(valores[k]))
  const conMedidas = llevar.toString() ? `?${llevar.toString()}` : ""

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#0D1015] text-white lg:flex-row">
      <aside className="order-2 flex w-full flex-col gap-4 border-t border-[#1F2937] bg-[#111722] p-4 lg:sticky lg:top-14 lg:order-none lg:max-h-[calc(100dvh-3.5rem)] lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-t-0">
        <div className="flex flex-col gap-2">
          <LocalizedClientLink href="/disenar/caja-con-juntas" className="self-start text-[12px] font-semibold text-[#F28A3C] hover:underline">
            ← Caja con juntas (con vista 3D)
          </LocalizedClientLink>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#C2560A]/20 text-[#F28A3C]" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M12 2l9 5v10l-9 5-9-5V7z" />
                <path d="M12 22V12M21 7l-9 5-9-5" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="m-0 text-[16px] font-bold leading-tight">{esquema.nombre}</h1>
              <p className="m-0 text-[12px] text-[#8A97AB]">{esquema.descripcion || "Caja para corte láser y router"}</p>
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-2 rounded-[12px] border border-[#1F2937] bg-[#0F151E] p-3">
          <h2 className="m-0 text-[13px] font-bold">Material</h2>
          <div className="flex flex-wrap gap-1.5">
            {MATERIALES.map((m) => (
              <button
                key={m.nombre}
                type="button"
                aria-pressed={material === m.nombre}
                onClick={() => elegirMaterial(m)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${material === m.nombre ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045] hover:text-white"}`}
              >
                {m.nombre}
              </button>
            ))}
          </div>
          <p className="m-0 text-[11.5px] leading-snug text-[#8A97AB]">Mide tu tablero con vernier y corrige el espesor abajo: el MDF &quot;de 3&quot; suele medir 2.7 a 2.9 mm.</p>
        </section>

        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
          {esquema.grupos.map((g, i) => (
            <fieldset key={g.titulo} className="m-0 rounded-[12px] border border-[#1F2937] bg-[#0F151E] p-3">
              <legend className="sr-only">{g.titulo}</legend>
              <button
                type="button"
                onClick={() => setAbiertos((p) => ({ ...p, [i]: !p[i] }))}
                className="flex w-full items-center justify-between text-left text-[13px] font-bold text-white"
                aria-expanded={Boolean(abiertos[i])}
              >
                {g.titulo}
                <span aria-hidden="true" className={`text-[#8A97AB] transition ${abiertos[i] ? "rotate-90" : ""}`}>
                  ▸
                </span>
              </button>
              {abiertos[i] && (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {g.args.map((a) => (
                    <div key={a.nombre} className={a.tipo === "bool" || a.opciones || a.tipo === "texto" ? "col-span-2" : ""}>
                      <Campo a={a} valor={valores[a.nombre]} cambiar={cambiar(a.nombre)} />
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
          ))}
        </form>

        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-[11.5px] font-bold uppercase tracking-wide text-[#8A97AB]">Otros diseños · con tus medidas</h2>
          <div className="flex flex-wrap gap-1.5">
            {OTROS.filter((o) => o.id !== esquema.id).map((o) => (
              <LocalizedClientLink
                key={o.id}
                href={`/disenar/cajas/${o.id}${conMedidas}`}
                className="rounded-full border border-dashed border-[#2B3648] px-2.5 py-1 text-[11.5px] font-semibold text-[#C9D2E0] hover:border-[#F28A3C] hover:text-white"
              >
                {o.nombre}
              </LocalizedClientLink>
            ))}
            <LocalizedClientLink href="/disenar/cajas" className="rounded-full border border-dashed border-[#C2560A]/60 px-2.5 py-1 text-[11.5px] font-bold text-[#F28A3C] hover:border-[#F28A3C]">
              Ver los 170+
            </LocalizedClientLink>
          </div>
        </section>

        <p className="m-0 text-[12px] leading-relaxed text-[#8A97AB]">
          DXF para router o plasma; SVG o LightBurn para láser. ¿Router sin CAM? Pásalo a{" "}
          <LocalizedClientLink href="/cam/subir" className="font-semibold text-[#F28A3C] hover:underline">
            DXF a G-code
          </LocalizedClientLink>
          . Haz una prueba de encaje en un recorte antes de cortar todo.
        </p>

        <div className="tema-estudio rounded-[12px]">
          <BloquePublicidad compacto />
        </div>

        <p className="m-0 text-[11.5px] text-[#5B6880]">
          Motor:{" "}
          <a href="https://github.com/florianfesti/boxes" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#8A97AB] hover:underline">
            Boxes.py
          </a>{" "}
          (GPL-3.0), sin modificar. Interfaz y conexión con talleres: HETNA.
        </p>

        {/* Descargas y venta siempre a la mano, al pie del panel */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-auto flex flex-col gap-2 border-t border-[#1F2937] bg-[#111722] px-4 pb-4 pt-3 shadow-[0_-8px_16px_rgba(0,0,0,0.35)]">
          <div className="grid grid-cols-4 gap-1.5">
            {FORMATOS.map((f, i) => (
              <Boton key={f.id} tipo={i === 0 ? "primario" : "secundario"} titulo={f.para} descarga href={rutaArchivo(locale, "generar", esquema.id, `formato=${f.id}&descargar=1&${query}`)}>
                {f.nombre}
              </Boton>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={fabricar} className="rounded-[8px] bg-[#16794F] px-2 py-2 text-center text-[13px] font-semibold text-white hover:bg-[#12623F]">
              Fabrícamelo
            </a>
            <Boton href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`}>WhatsApp</Boton>
          </div>
        </div>
      </aside>

      {/* Plano de corte: arriba y fijo en el celular */}
      <section className="sticky top-14 z-10 order-1 flex h-[46vh] flex-col bg-[#0D1015] lg:static lg:order-none lg:h-auto lg:min-h-[60vh] lg:flex-1">
        <div className="flex items-center gap-1 border-b border-[#1F2937] bg-[#0F141C] px-3 py-2 text-[12.5px] text-[#8A97AB]">
          <span className="mr-auto font-semibold text-[#C9D2E0]">Plano de corte · 2D</span>
          {(
            [
              ["Ajustar", () => setCam({ x: 0, y: 0, k: 1 })],
              ["Acercar", () => zoomEn(cam.k * 1.3, 0, 0)],
              ["Alejar", () => zoomEn(cam.k / 1.3, 0, 0)],
            ] as const
          ).map(([t, fn]) => (
            <button key={t} type="button" onClick={fn} className="rounded-[7px] px-2.5 py-1 hover:bg-[#1C2431] hover:text-white">
              {t}
            </button>
          ))}
        </div>
        <div
          ref={cajaRef}
          className="relative flex-1 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
          style={{
            backgroundColor: "#0B0F15",
            backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          onPointerDown={(e) => {
            ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
            punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
            empezarGesto()
          }}
          onPointerMove={(e) => {
            if (!punteros.current.has(e.pointerId)) return
            punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
            const g = gesto.current
            if (!g) return
            const ps = [...punteros.current.values()]
            if (ps.length >= 2 && g.dist) {
              const [a, b] = ps
              const [cx, cy] = desdeCentro((a.x + b.x) / 2, (a.y + b.y) / 2)
              const nk = Math.min(40, Math.max(0.3, (g.k * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist))
              const r = nk / g.k
              setCam({ k: nk, x: cx - (g.cx - g.vx) * r, y: cy - (g.cy - g.vy) * r })
            } else if (ps.length === 1) setCam({ ...camRef.current, x: g.vx + ps[0].x - g.cx, y: g.vy + ps[0].y - g.cy })
          }}
          onPointerUp={(e) => {
            punteros.current.delete(e.pointerId)
            empezarGesto()
          }}
          onPointerCancel={(e) => {
            punteros.current.delete(e.pointerId)
            empezarGesto()
          }}
          onDoubleClick={() => setCam({ x: 0, y: 0, k: 1 })}
        >
          {vista && !error && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vista}
              alt={`Plano de corte de ${esquema.nombre}`}
              draggable={false}
              className={`pointer-events-none absolute inset-0 h-full w-full object-contain p-6 transition-opacity ${cargando ? "opacity-50" : "opacity-100"}`}
              style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`, transformOrigin: "center" }}
            />
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center p-6">
              <div className="max-w-[420px] rounded-[12px] bg-[#3A1C1C] p-4 text-center text-[14px] text-[#F6B8AE]">
                <strong className="text-white">No se pudo dibujar.</strong> {error} Revisa que las medidas sean mayores que varias veces el espesor.
              </div>
            </div>
          )}
          {cargando && !vista && <div className="absolute inset-0 grid place-items-center text-[14px] text-[#8A97AB]">Dibujando…</div>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#1F2937] bg-[#0F141C] px-4 py-2 text-[12.5px] text-[#8A97AB]">
          {medidas && (
            <span>
              Medidas: <b className="text-white">{medidas} mm</b>
            </span>
          )}
          {valores.thickness !== undefined && (
            <span>
              Espesor: <b className="text-white">{String(valores.thickness)} mm</b>
            </span>
          )}
          {!error && !cargando && <span className="rounded-full bg-[#12301F] px-2 py-0.5 text-[11.5px] font-bold text-[#9BE3B8]">Listo para cortar</span>}
        </div>
      </section>
    </div>
  )
}
