"use client"

// Modelos 3D paramétricos (24 nov 2026): eliges un modelo, mueves sus medidas,
// lo ves en 3D y descargas el STL para imprimir; o lo mandas al Cotizador para
// que un taller de HETNA lo imprima. Los modelos y su geometría viven en
// lib/generador/modelos3d.ts (manifold-3d: sólidos cerrados, sin errores de malla).
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { Visor3D } from "@/components/hetna/generador/Visor3D"
import { mandarArchivosAFabricar } from "@/lib/generador/aCotizador"
import { CATEGORIAS, MODELOS, construirMalla, limpiarValores, modeloPorId, valoresIniciales, type MallaModelo, type Modelo3D } from "@/lib/generador/modelos3d"
import { mallaSTL } from "@/lib/generador/vectores"

const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false, loading: () => <div className="h-full w-full bg-[#F7F3EE]" /> })

const r1 = (x: number) => Math.round(x * 10) / 10

function descargar(nombre: string, datos: ArrayBuffer) {
  const url = URL.createObjectURL(new Blob([datos], { type: "model/stl" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a) // que el clic llegue al documento (lo cuenta el tablero)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// `inicial`: la página de un modelo (/disenar/modelos-3d/<id>) abre ya en ese modelo
export function GeneradorModelos3D({ inicial }: { inicial?: string } = {}) {
  const { locale } = useParams<{ locale: string }>()
  const [modelo, setModelo] = useState<Modelo3D>(() => (inicial && modeloPorId(inicial)) || MODELOS[0])
  const [valores, setValores] = useState<Record<string, number>>(() => valoresIniciales(modelo))
  const [malla, setMalla] = useState<MallaModelo | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")

  // /disenar/modelos-3d?modelo=maceta abre ese modelo (sin useSearchParams: la página es estática).
  // Con medidas en la liga (?modelo=maceta&alto=140…) abre con ésas: las piezas de
  // Impresión 3D bajo pedido mandan aquí para "modificar las medidas".
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const m = modeloPorId(q.get("modelo") || "") || (inicial ? modeloPorId(inicial) : undefined)
    if (!m) return
    const v = valoresIniciales(m)
    let cambia = !!q.get("modelo")
    for (const p of m.params) {
      const t = q.get(p.k)?.trim()
      const n = Number(t)
      if (t && Number.isFinite(n)) {
        v[p.k] = n
        cambia = true
      }
    }
    if (!cambia) return
    setModelo(m)
    setValores(limpiarValores(m, v))
  }, [inicial])

  // El modelo se arma en un Web Worker (lib/generador/modelos3d.worker.ts) para
  // que la página no se trabe; sin Worker, aquí mismo.
  const trabajador = useRef<Worker | null>(null)
  const sinTrabajador = useRef(false)
  const ultimo = useRef(0)
  useEffect(() => () => trabajador.current?.terminate(), [])

  // Se arma de nuevo cada vez que cambia una medida (con un respiro para no trabar los deslizadores)
  useEffect(() => {
    const id = ++ultimo.current
    const listo = (m: MallaModelo) => id === ultimo.current && (setMalla(m), setError(""))
    const fallo = () => id === ultimo.current && setError("No se pudo armar el modelo con esas medidas. Prueba con otras.")
    const aqui = () => construirMalla(modelo, valores).then(listo).catch(fallo)
    const t = setTimeout(() => {
      if (!trabajador.current && !sinTrabajador.current && typeof Worker !== "undefined") {
        try {
          trabajador.current = new Worker(new URL("../../../lib/generador/modelos3d.worker.ts", import.meta.url))
        } catch {
          sinTrabajador.current = true
        }
      }
      const w = trabajador.current
      if (!w) return void aqui()
      w.onmessage = (e: MessageEvent<{ id: number; malla?: MallaModelo; error?: string }>) => {
        if (e.data.id !== ultimo.current) return
        if (e.data.malla) return void listo(e.data.malla)
        // Si en el Worker no se pudo (p. ej. el navegador no deja WASM ahí), se arma aquí;
        // si son las medidas, aquí también falla y sale el aviso.
        w.terminate()
        trabajador.current = null
        sinTrabajador.current = true
        void aqui()
      }
      w.onerror = () => {
        w.terminate()
        trabajador.current = null
        sinTrabajador.current = true
        if (id === ultimo.current) void aqui()
      }
      w.postMessage({ id, modelo: modelo.id, valores })
    }, 120)
    return () => clearTimeout(t)
  }, [modelo, valores])

  const elegir = (m: Modelo3D) => {
    setModelo(m)
    setValores(valoresIniciales(m))
    setMalla(null)
    setAviso("")
    // Cada modelo tiene su página: la dirección cambia sin recargar (se puede compartir)
    window.history.replaceState(null, "", `/${locale}/disenar/modelos-3d/${m.id}`)
  }

  const nombreArchivo = useMemo(() => {
    const medidas = malla ? `-${malla.medidas.map((x) => Math.round(x)).join("x")}mm` : ""
    return `${modelo.id}${medidas}.stl`
  }, [modelo, malla])

  const stl = () => (malla ? mallaSTL({ tris: malla.tris } as never) : null)

  const fabricar = () => {
    const datos = stl()
    if (!datos || !malla) return
    const ok = mandarArchivosAFabricar([{ nombre: nombreArchivo, contenido: datos }], locale, {
      pieza: modelo.nombre,
      medidas: `${malla.medidas.map(r1).join(" × ")} mm`,
      proceso: "Impresión 3D",
      cantidad: "1",
      nota: `Modelo paramétrico de HETNA «${modelo.nombre}» con: ${modelo.params.map((p) => `${p.nombre.toLowerCase()} ${r1(valores[p.k])}${p.unidad ?? " mm"}`).join(", ")}.`,
    })
    if (!ok) setAviso("No se pudo mandar. Descarga el STL y súbelo en la solicitud.")
  }

  return (
    <main className="flex-1 bg-[#FAF9F6]">
      <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[.18em] text-[#0EA5E9]">Impresión 3D · paramétrico</p>
        <h1 className="font-display m-0 mt-1 text-[26px] font-bold text-[#1B1B18] lg:text-[34px]">{inicial ? `${modelo.nombre}: modelo 3D a tu medida` : "Modelos 3D a tu medida"}</h1>
        <p className="m-0 mt-1 max-w-3xl text-[15px] text-[#4A4943]">
          Elige un modelo, ajusta sus medidas y descarga el STL listo para imprimir, sin saber CAD. O pide que un taller de HETNA te lo imprima.
        </p>

        {/* Modelos por categoría */}
        <div className="mt-5 flex flex-col gap-3">
          {CATEGORIAS.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <span className="w-[120px] shrink-0 text-[13px] font-semibold text-[#6B675C]">{c.nombre}</span>
              {MODELOS.filter((m) => m.categoria === c.id).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => elegir(m)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] ${m.id === modelo.id ? "border-[#0EA5E9] bg-[#0EA5E9] text-white" : "border-[#E7E4DC] bg-white text-[#1B1B18] hover:border-[#0EA5E9]"}`}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-hidden rounded-[14px] border border-[#E7E4DC]">
            <Visor3D>{malla ? <Malla3D tris={malla.tris} color={0x0ea5e9} /> : <div className="grid h-full place-items-center text-[#6B675C]">{error || "Armando el modelo…"}</div>}</Visor3D>
          </div>

          <div className="flex flex-col gap-4 rounded-[14px] border border-[#E7E4DC] bg-white p-4">
            <div>
              <h2 className="m-0 text-[18px] font-bold text-[#142033]">{modelo.nombre}</h2>
              <p className="m-0 mt-1 text-[13.5px] text-[#4A4943]">{modelo.texto}</p>
            </div>

            {modelo.params.map((p) => {
              const v = valores[p.k]
              const paso = p.paso ?? (p.max - p.min > 50 ? 1 : 0.5)
              return (
                <label key={p.k} className="flex flex-col gap-1">
                  <span className="flex items-center justify-between text-[13px] text-[#1B1B18]">
                    {p.nombre}
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        value={v}
                        min={p.min}
                        max={p.max}
                        step={paso}
                        onChange={(e) => setValores({ ...valores, [p.k]: Number(e.target.value) })}
                        className="w-[76px] rounded-[6px] border border-[#E7E4DC] px-2 py-0.5 text-right text-[13px]"
                        // Fondo y letra fijos: dentro del estudio oscuro (.tema-estudio) el texto salía blanco sobre blanco
                        style={{ background: "#1C2431", color: "#E6EBF2", borderColor: "#2B3648" }}
                      />
                      <span className="w-6 text-[12px] text-[#6B675C]">{p.unidad ?? "mm"}</span>
                    </span>
                  </span>
                  <input type="range" min={p.min} max={p.max} step={paso} value={v} onChange={(e) => setValores({ ...valores, [p.k]: Number(e.target.value) })} className="accent-[#0EA5E9]" />
                </label>
              )
            })}

            {malla && (
              <p className="m-0 rounded-[8px] bg-[#F3F1EA] px-3 py-2 text-[13px] text-[#40403A]">
                Medidas: <b>{malla.medidas.map(r1).join(" × ")} mm</b> · {Math.round(malla.tris.length / 9).toLocaleString("es-MX")} triángulos
              </p>
            )}

            <button
              type="button"
              disabled={!malla}
              onClick={() => {
                const d = stl()
                if (d) descargar(nombreArchivo, d)
              }}
              className="rounded-[10px] bg-[#142033] py-3 text-[15px] font-semibold text-white hover:bg-[#0F1826] disabled:opacity-50"
            >
              Descargar STL
            </button>
            <button type="button" disabled={!malla} onClick={fabricar} className="rounded-[10px] bg-[#FF6A1A] py-3 text-[15px] font-extrabold text-white hover:bg-[#E65C12] disabled:opacity-50">
              Fabrícamelo: que un taller lo imprima
            </button>
            {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
            <button type="button" onClick={() => setValores(valoresIniciales(modelo))} className="text-[13px] font-semibold text-[#0284C7] underline">
              Volver a las medidas de fábrica
            </button>
            <p className="m-0 text-[12px] text-[#6B675C]">
              El STL sale cerrado y apoyado en la cama. Imprímelo en PLA o PETG; para piezas de taller, 3 perímetros y 30% de relleno.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
