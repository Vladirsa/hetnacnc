"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { FORMATOS, type ArgCajas, type EsquemaCajas } from "@/lib/hetna/cajas"
import { BloquePublicidad } from "./BloquePublicidad"

// Interfaz HETNA para un generador de Boxes.py: parámetros a la izquierda,
// vista previa en vivo a la derecha, descargas y "Fabrícamelo".
// La vista previa es el SVG que devuelve /api/cajas/generar; se vuelve a pedir
// medio segundo después del último cambio.

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

const Campo = ({ a, valor, cambiar }: { a: ArgCajas; valor: string | number | boolean | undefined; cambiar: (v: string | number | boolean) => void }) => {
  const id = `arg-${a.nombre}`
  const base = "w-full rounded-[10px] border-2 border-[#E7E4DC] bg-white px-3 py-2 text-[15px] font-bold text-[#142033] focus:border-[#FF6A1A] focus:outline-none"
  if (a.tipo === "bool") {
    return (
      <label className="flex items-center gap-2.5 text-[13.5px] font-semibold text-[#141A26]" title={a.ayuda}>
        <input type="checkbox" checked={Boolean(valor)} onChange={(e) => cambiar(e.target.checked)} className="h-[18px] w-[18px] accent-[#FF6A1A]" />
        {a.etiqueta}
      </label>
    )
  }
  if (a.opciones) {
    return (
      <label htmlFor={id} className="flex flex-col gap-1 text-[12px] font-semibold text-[#4A4943]" title={a.ayuda}>
        {a.etiqueta}
        <select id={id} value={String(valor ?? "")} onChange={(e) => cambiar(e.target.value)} className={base + " font-semibold"}>
          {a.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>{o.nombre}</option>
          ))}
        </select>
      </label>
    )
  }
  const esNum = a.tipo === "int" || a.tipo === "float"
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-[12px] font-semibold text-[#4A4943]" title={a.ayuda}>
      {a.etiqueta}
      <input
        id={id}
        type={esNum ? "number" : "text"}
        step={a.tipo === "int" ? 1 : "any"}
        value={String(valor ?? "")}
        onChange={(e) => cambiar(esNum ? e.target.value.replace(",", ".") : e.target.value)}
        className={base}
      />
    </label>
  )
}

export const GeneradorCajas = ({ esquema, locale }: { esquema: EsquemaCajas; locale: string }) => {
  const [valores, setValores] = useState<Valores>(() => inicial(esquema))
  const [material, setMaterial] = useState<string>("")
  const [vista, setVista] = useState<string>("")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abiertos, setAbiertos] = useState<Record<number, boolean>>({ 0: true, 1: true })
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query = useMemo(() => aQuery(valores).toString(), [valores])

  // Vista previa en vivo (se espera medio segundo tras el último cambio)
  useEffect(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(async () => {
      setCargando(true)
      setError(null)
      try {
        const r = await fetch(`/api/cajas/generar/${esquema.id}?formato=svg&${query}`)
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || "No se pudo generar con esos valores.")
        }
        const svg = await r.text()
        setVista(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })))
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo generar.")
      } finally {
        setCargando(false)
      }
    }, 500)
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [esquema.id, query])

  const cambiar = (nombre: string) => (v: string | number | boolean) => setValores((p) => ({ ...p, [nombre]: v }))

  const elegirMaterial = (m: (typeof MATERIALES)[number]) => {
    setMaterial(m.nombre)
    setValores((p) => ({ ...p, thickness: m.thickness, burn: m.burn }))
  }

  const medidas = ["x", "y", "h"].map((k) => valores[k]).filter((v) => v !== undefined && v !== "").join(" × ")
  const fabricar = `/${locale}/fabricacion?desde=cajas&pieza=${encodeURIComponent(esquema.id)}&medidas=${encodeURIComponent(medidas ? medidas + " mm" : "")}&material=${encodeURIComponent(material || `espesor ${valores.thickness ?? ""} mm`)}&archivo=${encodeURIComponent(`/api/cajas/generar/${esquema.id}?formato=dxf&${query}`)}`

  return (
    <div className="px-4 lg:px-8 pt-4 pb-12">
      <div className="flex flex-wrap items-start gap-6">
        {/* Parámetros */}
        <form onSubmit={(e) => e.preventDefault()} className="flex w-full flex-col gap-4 rounded-[18px] border-2 border-[#FFD5B8] bg-white p-5 lg:w-[340px] lg:shrink-0">
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-[#142033]">{esquema.nombre}</h1>
            {esquema.descripcion && <p className="mt-1 text-[13.5px] text-[#6B6A63]">{esquema.descripcion}</p>}
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#B34D07]">Material</legend>
            <div className="flex flex-wrap gap-1.5">
              {MATERIALES.map((m) => (
                <button
                  key={m.nombre}
                  type="button"
                  onClick={() => elegirMaterial(m)}
                  className={`rounded-full border-2 px-3 py-1.5 text-[12.5px] font-bold ${material === m.nombre ? "border-[#FF6A1A] bg-[#FFE1CC] text-[#B34D07]" : "border-[#E7E4DC] bg-white text-[#141A26] hover:border-[#FF6A1A]"}`}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-[#6B6A63]">Mide tu tablero con vernier y corrige el espesor abajo: el MDF "de 3" suele medir 2.7 a 2.9 mm.</p>
          </fieldset>

          {esquema.grupos.map((g, i) => (
            <fieldset key={g.titulo} className="m-0 border-0 p-0">
              <legend className="w-full">
                <button
                  type="button"
                  onClick={() => setAbiertos((p) => ({ ...p, [i]: !p[i] }))}
                  className="flex w-full items-center justify-between py-1 text-left text-[11px] font-bold uppercase tracking-wide text-[#B34D07]"
                  aria-expanded={Boolean(abiertos[i])}
                >
                  {g.titulo}
                  <span aria-hidden="true" className="text-[14px]">{abiertos[i] ? "−" : "+"}</span>
                </button>
              </legend>
              {abiertos[i] && (
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {g.args.map((a) => (
                    <div key={a.nombre} className={a.tipo === "bool" || a.opciones || a.tipo === "texto" ? "col-span-2" : ""}>
                      <Campo a={a} valor={valores[a.nombre]} cambiar={cambiar(a.nombre)} />
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
          ))}

          <BloquePublicidad />
        </form>

        {/* Vista previa y descargas */}
        <section className="flex min-w-0 flex-1 flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-[#4A4943]">Plano de corte</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {FORMATOS.map((f) => (
                <a
                  key={f.id}
                  href={`/api/cajas/generar/${esquema.id}?formato=${f.id}&descargar=1&${query}`}
                  download
                  title={f.para}
                  className="rounded-[12px] border-2 border-[#142033] bg-white px-4 py-2.5 text-[14px] font-bold text-[#142033] hover:bg-[#142033] hover:text-white"
                >
                  {f.nombre}
                </a>
              ))}
              <a href={fabricar} className="inline-flex items-center gap-2 rounded-[12px] bg-[#FF6A1A] px-4 py-2.5 text-[14px] font-extrabold text-white hover:bg-[#E65C12]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                Fabrícamelo
              </a>
            </div>
          </div>

          <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-[18px] bg-[#142033] p-6">
            {vista && !error && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vista} alt={`Plano de corte de ${esquema.nombre}`} className={`max-h-[70vh] w-full object-contain transition-opacity ${cargando ? "opacity-50" : "opacity-100"}`} style={{ filter: "invert(1) hue-rotate(180deg) saturate(2)" }} />
            )}
            {error && (
              <div className="max-w-[420px] rounded-[12px] bg-white p-4 text-center text-[14px] text-[#B3261E]">
                <strong>No se pudo dibujar.</strong> {error} Revisa que las medidas sean mayores que varias veces el espesor.
              </div>
            )}
            {cargando && !vista && <span className="text-[14px] text-[#C9D2E0]">Dibujando…</span>}
            <div className="absolute left-3.5 top-3.5 flex gap-1.5">
              {medidas && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white">{medidas} mm</span>}
              {!error && !cargando && <span className="rounded-full bg-[#19B374] px-2.5 py-1 text-[12px] font-bold text-white">Listo para cortar</span>}
            </div>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <div className="rounded-[16px] border-2 border-[#BFEFD8] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#0F7A4A]">Si la mandas a fabricar</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[#4A4943]">Toca <strong>Fabrícamelo</strong>: el archivo, las medidas y el material ya van llenos. Talleres cerca de ti te dan precio y te la envían o la recoges.</p>
            </div>
            <div className="rounded-[16px] border-2 border-[#E7E4DC] bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#B34D07]">Si la cortas tú</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[#4A4943]">
                Descarga DXF para router o plasma, SVG o LightBurn para láser. ¿Router sin CAM? Pásalo a{" "}
                <LocalizedClientLink href="/cam/subir" className="font-bold text-[#B34D07] hover:underline">DXF a G-code</LocalizedClientLink>. Haz una prueba de encaje en un recorte antes de cortar todo.
              </p>
            </div>
          </div>

          <p className="text-[12px] text-[#6B6A63]">
            Motor: <a href="https://github.com/florianfesti/boxes" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#B34D07] hover:underline">Boxes.py</a> (GPL-3.0), sin modificar. Interfaz y conexión con talleres: HETNA.
          </p>
        </section>
      </div>
    </div>
  )
}
