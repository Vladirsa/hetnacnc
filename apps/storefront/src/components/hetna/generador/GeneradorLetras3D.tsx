"use client"

// Letras 3D en caja (anuncios y letras luminosas) dentro del Estudio 3D:
// Diseño 2D (las hojas de corte), Vista 3D (la letra armada) y Exportación.
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"

import { mandarAFabricar } from "@/lib/generador/aCotizador"
import { type PiezaAnidar, anidar, hojaAnidadaSVG, hojasComoDibujo } from "@/lib/generador/anidado"
import { FUENTES, cargarFuente } from "@/lib/generador/fuentes"
import {
  CONSTRUCCIONES,
  type Construccion,
  hacerLetras3D,
  mallaLetras,
  piezaComoDibujo,
  resumenMateriales,
} from "@/lib/generador/letras3d"
import type { Fuente } from "@/lib/generador/letreros"
import { dibujoDXF, dibujoSVG, mallaSTL } from "@/lib/generador/vectores"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })

const numero = (s: string) => parseFloat((s || "").replace(",", "."))
const r1 = (x: number) => Math.round(x * 10) / 10

function descargar(nombre: string, contenido: string | ArrayBuffer, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Áreas de trabajo comunes en México
const HOJAS = [
  { id: "600x400", nombre: "Láser 600 × 400", ancho: 600, alto: 400 },
  { id: "900x600", nombre: "Láser 900 × 600", ancho: 900, alto: 600 },
  { id: "1300x900", nombre: "Láser 1300 × 900", ancho: 1300, alto: 900 },
  { id: "1220x2440", nombre: "Hoja MDF 1220 × 2440", ancho: 2440, alto: 1220 },
]

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">{children}</span>
)

const CampoNum = ({ etiqueta, valor, cambiar, sufijo = "mm" }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo?: string }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[12.5px] text-[#C9D2E0]">{etiqueta}</span>
    <span className="flex items-center rounded-[8px] bg-[#1C2431] focus-within:ring-1 focus-within:ring-[#C2560A]">
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        className="w-full min-w-0 bg-transparent px-2.5 py-2 text-[14px] text-white outline-none"
      />
      <span className="pr-2.5 text-[12px] text-[#8A97AB]">{sufijo}</span>
    </span>
  </label>
)

export function GeneradorLetras3D() {
  const { locale } = useParams<{ locale: string }>()
  const [texto, setTexto] = useState("HETNA")
  const [fuenteId, setFuenteId] = useState("alfa-slab-one")
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [errorFuente, setErrorFuente] = useState("")
  const [alto, setAlto] = useState("200")
  const [espaciado, setEspaciado] = useState("15")
  const [profundidad, setProfundidad] = useState("50")
  const [espesor, setEspesor] = useState("6")
  const [espesorFrente, setEspesorFrente] = useState("3")
  const [pared, setPared] = useState("12")
  const [cable, setCable] = useState("8")
  const [construccion, setConstruccion] = useState<Construccion>("mdf_acrilico")
  const [hojaId, setHojaId] = useState("600x400")
  const [separar, setSeparar] = useState(0)
  const [hojaVista, setHojaVista] = useState(0)

  useEffect(() => {
    const t = FUENTES.find((f) => f.id === fuenteId) || FUENTES[0]
    let vivo = true
    setErrorFuente("")
    cargarFuente(t)
      .then((f) => vivo && setFuente(f))
      .catch(() => vivo && setErrorFuente("No se pudo cargar la tipografía. Revisa tu conexión."))
    return () => {
      vivo = false
    }
  }, [fuenteId])

  const r = useMemo(() => {
    if (!fuente) return null
    // Una tipografía con contornos raros no debe tumbar la herramienta: si la
    // geometría truena, se avisa y se puede probar otra letra o tamaño.
    try {
    return hacerLetras3D(fuente, {
      texto,
      alto: numero(alto),
      espaciado: numero(espaciado) || 0,
      profundidad: numero(profundidad),
      espesor: numero(espesor),
      espesorFrente: numero(espesorFrente),
      pared: numero(pared),
      construccion,
      cable: numero(cable) || 0,
    })
    } catch (e) {
      console.error("[letras-3d]", e)
      return {
        piezas: [],
        ancho: 0,
        alto: 0,
        capasPared: 0,
        profundidadReal: 0,
        avisos: [],
        errores: ["No se pudo armar ese texto con esta tipografía. Prueba con otra tipografía, otro tamaño o quita los símbolos raros."],
      }
    }
  }, [fuente, texto, alto, espaciado, profundidad, espesor, espesorFrente, pared, construccion, cable])

  const listo = !!r && !r.errores.length
  const hoja = HOJAS.find((h) => h.id === hojaId) || HOJAS[0]

  // Anidado por material: cada material y espesor va en sus propias hojas
  const grupos = useMemo(() => {
    if (!listo) return []
    const por = new Map<string, PiezaAnidar[]>()
    for (const p of r!.piezas) {
      const k = `${p.material} ${p.espesor} mm`
      const lista = por.get(k) || []
      lista.push({ id: p.id, nombre: `${p.letra} · ${p.rol}`, dibujo: piezaComoDibujo(p), cantidad: p.cantidad })
      por.set(k, lista)
    }
    return Array.from(por.entries()).map(([material, piezas]) => ({
      material,
      resultado: anidar(piezas, { hoja: { ancho: hoja.ancho, alto: hoja.alto }, separacion: 4, margen: 5, girar: true }),
    }))
  }, [listo, r, hoja])

  const hojas = grupos.flatMap((g) => g.resultado.hojas.map((h, i) => ({ material: g.material, h, i, total: g.resultado.hojas.length })))
  const noCaben = grupos.flatMap((g) => g.resultado.noCaben)
  const totalHojas = hojas.length
  const actual = hojas[Math.min(hojaVista, Math.max(0, totalHojas - 1))]

  const malla = useMemo(() => {
    if (!listo) return null
    try {
      return mallaLetras(r!, separar)
    } catch (e) {
      console.error("[letras-3d] vista 3D", e)
      return null
    }
  }, [listo, r, separar])
  const principal = malla ? (malla.tris.length ? malla.tris : malla.acrilico) : undefined
  const segunda = useMemo(
    () => (malla && malla.tris.length && malla.acrilico.length ? { tris: malla.acrilico, color: 0xcfe2fa, opacidad: 0.38 } : undefined),
    [malla]
  )

  const archivo = `letras-3d-${texto.trim().replace(/[^\w]+/g, "-").toLowerCase() || "hetna"}`
  const totalPiezas = listo ? r!.piezas.reduce((t, p) => t + p.cantidad, 0) : 0

  const panel = (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <Etiqueta>Texto</Etiqueta>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, 24))}
          className="rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[16px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <Etiqueta>Tipografía</Etiqueta>
        <select
          value={fuenteId}
          onChange={(e) => setFuenteId(e.target.value)}
          className="rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[14px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        >
          {FUENTES.filter((f) => f.grupo !== "Cursiva").map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
        <span className="text-[11.5px] text-[#8A97AB]">Las letras gruesas (de molde) dan más espacio para los LED.</span>
      </label>

      <div className="rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-3 flex flex-col gap-2">
        <span className="text-[13px] font-bold text-white">Alto de letra (la H)</span>
        <div className="flex items-center gap-3">
          <input type="range" min={50} max={800} step={5} value={numero(alto) || 50} onChange={(e) => setAlto(e.target.value)} className="flex-1 accent-[#C2560A]" />
          <span className="w-[84px]">
            <CampoNum etiqueta="" valor={alto} cambiar={setAlto} />
          </span>
        </div>
        {listo && (
          <span className="text-[12px] text-[#F2D29B]">
            Ancho total {r1(r!.ancho)} mm · alto {r1(r!.alto)} mm · fondo {r1(r!.profundidadReal)} mm
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Etiqueta>Construcción</Etiqueta>
        <div className="grid grid-cols-3 gap-1.5">
          {CONSTRUCCIONES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setConstruccion(c.id)}
              aria-pressed={construccion === c.id}
              className={`rounded-[8px] px-1.5 py-2 text-[11.5px] font-semibold leading-tight ${
                construccion === c.id ? "bg-[#243045] ring-1 ring-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Fondo de la letra" valor={profundidad} cambiar={setProfundidad} />
        <CampoNum etiqueta="Ancho de pared" valor={pared} cambiar={setPared} />
        <CampoNum etiqueta="Espesor MDF" valor={espesor} cambiar={setEspesor} />
        <CampoNum etiqueta="Espesor frente" valor={espesorFrente} cambiar={setEspesorFrente} />
        <CampoNum etiqueta="Entre letras" valor={espaciado} cambiar={setEspaciado} />
        <CampoNum etiqueta="Barreno cable" valor={cable} cambiar={setCable} />
      </div>

      <label className="flex flex-col gap-1.5">
        <Etiqueta>Área de corte de tu máquina</Etiqueta>
        <select
          value={hojaId}
          onChange={(e) => {
            setHojaId(e.target.value)
            setHojaVista(0)
          }}
          className="rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[14px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        >
          {HOJAS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.nombre} mm
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <Etiqueta>Separar capas (vista 3D)</Etiqueta>
        <input type="range" min={0} max={20} step={1} value={separar} onChange={(e) => setSeparar(Number(e.target.value))} className="accent-[#C2560A]" />
      </label>

      {errorFuente && <p className="m-0 text-[13px] text-[#F2B8A8]">{errorFuente}</p>}
      {r?.errores.map((e) => (
        <p key={e} className="m-0 text-[13px] text-[#F2B8A8]">
          {e}
        </p>
      ))}
    </div>
  )

  const diseno2d = (
    <div className="p-4 flex flex-col gap-3 h-full">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#8A97AB]">{fuente ? "Revisa los datos del panel." : "Cargando la tipografía…"}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {hojas.map((x, k) => (
              <button
                key={k}
                type="button"
                onClick={() => setHojaVista(k)}
                className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold ${
                  k === hojaVista ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
                }`}
              >
                {x.material} · hoja {x.i + 1}/{x.total}
              </button>
            ))}
          </div>
          {actual && (
            <div
              className="flex-1 min-h-[300px] rounded-[10px] bg-[#0F151E] p-2 [&>svg]:w-full [&>svg]:h-full"
              // SVG armado aquí mismo con los contornos de las piezas
              dangerouslySetInnerHTML={{
                __html: hojaAnidadaSVG(actual.h, { ancho: hoja.ancho, alto: hoja.alto })
                  .replace('fill="#F4F1EA" stroke="#9A978C"', 'fill="#151C27" stroke="#3A4A63"')
                  .replace(/fill="#FDEEE1" fill-opacity="0.7"/g, actual.material.startsWith("Acr") ? 'fill="#BFD6F2" fill-opacity="0.28"' : 'fill="#C9A27A" fill-opacity="0.9"')
                  .replace(/stroke="#C2560A" stroke-width="1.2"/g, 'stroke="#FF7A2E" stroke-width="1.4"')
                  .replace(/fill="#142033" font-family/g, 'fill="#FFFFFF" font-family'),
              }}
            />
          )}
          {noCaben.length > 0 && (
            <p className="m-0 text-[13px] text-[#F2D29B]">
              {noCaben.length} {noCaben.length === 1 ? "pieza no cabe" : "piezas no caben"} en el área de corte: elige un área más grande o baja el alto.
            </p>
          )}
        </>
      )}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Completa los datos para generar los archivos.</p>
  ) : (
    <div className="flex flex-col gap-5 max-w-[720px]">
      <div>
        <h3 className="m-0 text-[18px] font-bold">Archivos de corte</h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]">Un archivo por material, con todas sus hojas acomodadas una junto a otra.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {grupos.map((g) => {
          const d = hojasComoDibujo(g.resultado, { ancho: hoja.ancho, alto: hoja.alto })
          const nombre = `${archivo}-${g.material.replace(/\s+/g, "-").toLowerCase()}`
          return (
            <div key={g.material} className="rounded-[12px] bg-[#1C2431] border border-[#2B3648] p-4 flex flex-col gap-2">
              <span className="text-[15px] font-bold">{g.material}</span>
              <span className="text-[12.5px] text-[#8A97AB]">
                {g.resultado.totalPiezas} piezas · {g.resultado.hojas.length} {g.resultado.hojas.length === 1 ? "hoja" : "hojas"} ·{" "}
                {Math.round(g.resultado.aprovechamiento * 100)}% aprovechado
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => descargar(`${nombre}.dxf`, dibujoDXF(d), "application/dxf")} className="flex-1 rounded-[8px] bg-[#C2560A] hover:bg-[#A84A08] py-2 text-[13px] font-semibold">
                  DXF
                </button>
                <button type="button" onClick={() => descargar(`${nombre}.svg`, dibujoSVG(d, "corte"), "image/svg+xml")} className="flex-1 rounded-[8px] bg-[#2B3648] hover:bg-[#344158] py-2 text-[13px] font-semibold">
                  SVG
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-[12px] bg-[#1C2431] border border-[#2B3648] p-4 flex flex-col gap-2">
        <span className="text-[15px] font-bold">Modelo 3D (STL)</span>
        <span className="text-[12.5px] text-[#8A97AB]">Para revisarlo en tu programa o imprimir una maqueta.</span>
        <button
          type="button"
          onClick={() => {
            const m = mallaLetras(r!, 0)
            descargar(`${archivo}.stl`, mallaSTL({ tris: [...m.tris, ...m.acrilico], avisos: [] }), "model/stl")
          }}
          className="self-start rounded-[8px] bg-[#2B3648] hover:bg-[#344158] px-4 py-2 text-[13px] font-semibold"
        >
          Descargar STL
        </button>
      </div>

      <div className="rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4 flex flex-col gap-2">
        <span className="text-[15px] font-bold">¿No tienes láser?</span>
        <span className="text-[13px] text-[#F2D29B]">Mándalo a cortar con un taller de HETNA: recibes precio y tiempo de entrega.</span>
        <button
          type="button"
          onClick={() => {
            const g = grupos[0]
            if (!g) return
            mandarAFabricar(`${archivo}.dxf`, dibujoDXF(hojasComoDibujo(g.resultado, { ancho: hoja.ancho, alto: hoja.alto })), locale, {
              pieza: `Letras 3D "${texto}"`,
              medidas: `${r1(r!.ancho)} × ${r1(r!.alto)} × ${r1(r!.profundidadReal)} mm`,
              material: Object.keys(resumenMateriales(r!)).join(", "),
              proceso: "Corte láser",
            })
          }}
          className="self-start rounded-[8px] bg-[#C2560A] hover:bg-[#A84A08] px-4 py-2 text-[13px] font-semibold"
        >
          Cotizar el corte
        </button>
      </div>
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo={texto || "Letras"}
      subtitulo="Letras 3D en caja"
      materialInicial="mdf"
      lineas
      dePie
      tris={principal}
      segunda={segunda}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={listo ? r!.avisos : []}
      barra={
        listo ? (
          <span>
            · {totalPiezas} piezas · {totalHojas} {totalHojas === 1 ? "hoja" : "hojas"} ·{" "}
            {Object.entries(resumenMateriales(r!))
              .map(([m, n]) => `${n} de ${m}`)
              .join(" · ")}
          </span>
        ) : null
      }
    />
  )
}
