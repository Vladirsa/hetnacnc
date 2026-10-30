"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import { hacerRompecabezas } from "@/lib/generador/rompecabezas"
import { dibujoDXF, dibujoSVG } from "@/lib/generador/vectores"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const numero = (s: string) => parseFloat((s || "").replace(",", "."))
const r1 = (x: number) => Math.round(x * 10) / 10

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const Campo = ({ etiqueta, valor, cambiar, sufijo = "mm" }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo?: string }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[13px] font-semibold text-[#1B1B18]">{etiqueta}</span>
    <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
      <input type="text" inputMode="decimal" value={valor} onChange={(e) => cambiar(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
      {sufijo && <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>}
    </span>
  </label>
)

// Puntos de partida. Las medidas son de la placa completa.
const MODELOS: { id: string; nombre: string; detalle: string; ancho: string; alto: string; columnas: string; filas: string }[] = [
  { id: "ninos", nombre: "Para niños", detalle: "6 piezas grandes", ancho: "210", alto: "150", columnas: "3", filas: "2" },
  { id: "clasico", nombre: "Clásico", detalle: "24 piezas", ancho: "200", alto: "150", columnas: "6", filas: "4" },
  { id: "carta", nombre: "Tamaño carta", detalle: "48 piezas", ancho: "279", alto: "216", columnas: "8", filas: "6" },
  { id: "foto", nombre: "Foto 30 × 20", detalle: "70 piezas", ancho: "300", alto: "200", columnas: "10", filas: "7" },
  { id: "grande", nombre: "Grande 40 × 30", detalle: "130 piezas", ancho: "400", alto: "300", columnas: "13", filas: "10" },
  { id: "corazon", nombre: "Mensaje", detalle: "9 piezas, con marco", ancho: "150", alto: "150", columnas: "3", filas: "3" },
]

export function GeneradorRompecabezas() {
  const { locale } = useParams<{ locale: string }>()
  const [ancho, setAncho] = useState("200")
  const [alto, setAlto] = useState("150")
  const [columnas, setColumnas] = useState("6")
  const [filas, setFilas] = useState("4")
  const [nudo, setNudo] = useState("20")
  const [variacion, setVariacion] = useState("4")
  // Semilla fija al renderizar (el servidor y el navegador deben coincidir);
  // se cambia al azar ya en el navegador.
  const [semilla, setSemilla] = useState(2026)
  useEffect(() => {
    setSemilla(1 + Math.floor(Math.random() * 9999))
  }, [])
  const [esquinas, setEsquinas] = useState("4")
  const [conMarco, setConMarco] = useState(false)
  const [marco, setMarco] = useState("12")
  const [holgura, setHolgura] = useState("0.5")
  const [aviso, setAviso] = useState("")

  const elegirModelo = (m: (typeof MODELOS)[number]) => {
    setAncho(m.ancho)
    setAlto(m.alto)
    setColumnas(m.columnas)
    setFilas(m.filas)
    if (m.id === "corazon") setConMarco(true)
  }

  const r = useMemo(
    () =>
      hacerRompecabezas({
        ancho: numero(ancho),
        alto: numero(alto),
        columnas: numero(columnas),
        filas: numero(filas),
        nudo: (numero(nudo) || 20) / 100,
        variacion: (numero(variacion) || 0) / 100,
        semilla,
        esquinas: numero(esquinas) || 0,
        marco: conMarco ? numero(marco) || 0 : 0,
        holgura: numero(holgura) || 0,
      }),
    [ancho, alto, columnas, filas, nudo, variacion, semilla, esquinas, conMarco, marco, holgura]
  )
  const listo = !r.errores.length
  const vista = useMemo(() => (listo ? dibujoSVG(r.dibujo, "vista") : ""), [r, listo])
  const archivo = `rompecabezas-hetna-${r.piezas}-piezas-${semilla}`
  const mensaje = `Hola HETNA CNC, quiero cotizar un rompecabezas:\n- Placa: ${ancho} × ${alto} mm\n- ${r.piezas} piezas (${columnas} × ${filas})${conMarco ? "\n- Con marco y base" : ""}`

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Rompecabezas para corte láser</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Mide la placa, di cuántas piezas quieres y descarga el DXF o SVG con las líneas de corte: cada línea va de orilla a orilla en un solo trazo, y ninguna pieza se repite. Con marco y base opcionales para armarlo encima.
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[400px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Empieza con un modelo</span>
            <div className="grid grid-cols-3 gap-1.5">
              {MODELOS.map((m) => (
                <button key={m.id} type="button" onClick={() => elegirModelo(m)} className="rounded-[10px] border border-[#E7E4DC] bg-white px-1.5 py-2 text-left leading-tight hover:border-[#C2560A]">
                  <span className="block text-[11.5px] font-semibold text-[#1B1B18]">{m.nombre}</span>
                  <span className="block text-[10.5px] text-[#6B6A63]">{m.detalle}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Ancho de la placa" valor={ancho} cambiar={setAncho} />
            <Campo etiqueta="Alto de la placa" valor={alto} cambiar={setAlto} />
            <Campo etiqueta="Columnas" valor={columnas} cambiar={setColumnas} sufijo="" />
            <Campo etiqueta="Filas" valor={filas} cambiar={setFilas} sufijo="" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Tamaño del nudo" valor={nudo} cambiar={setNudo} sufijo="%" />
            <Campo etiqueta="Variación" valor={variacion} cambiar={setVariacion} sufijo="%" />
            <Campo etiqueta="Esquinas redondas" valor={esquinas} cambiar={setEsquinas} />
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-[#1B1B18]">Acomodo nº {semilla}</span>
              <button type="button" onClick={() => setSemilla(1 + Math.floor(Math.random() * 9999))} className="h-[46px] rounded-[10px] border border-[#E7E4DC] bg-white text-[14px] font-semibold text-[#1B1B18] hover:border-[#C2560A]">
                Otro acomodo
              </button>
            </label>
          </div>
          <p className="m-0 -mt-2 text-[12px] text-[#6B6A63]">El nudo clásico es 20 %; con 4 % de variación ninguna pieza queda igual. El número de acomodo te deja volver a generar exactamente el mismo rompecabezas.</p>

          <div className="border-t border-[#E7E4DC] pt-3 flex flex-col gap-3">
            <label className="flex items-center gap-2 text-[14px] font-semibold text-[#1B1B18]">
              <input type="checkbox" checked={conMarco} onChange={(e) => setConMarco(e.target.checked)} className="h-4 w-4 accent-[#C2560A]" />
              Agregar marco y base
            </label>
            {conMarco && (
              <div className="grid grid-cols-2 gap-2">
                <Campo etiqueta="Ancho del marco" valor={marco} cambiar={setMarco} />
                <Campo etiqueta="Holgura" valor={holgura} cambiar={setHolgura} />
              </div>
            )}
            <p className="m-0 text-[12px] text-[#6B6A63]">El marco es un anillo y la base una placa lisa: se pegan y el rompecabezas se arma adentro. Van en las capas MARCO y BASE para cortarlas aparte.</p>
          </div>
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {r.errores.length > 0 && (
            <div className="bg-[#FDECEC] border border-[#F2B8B5] text-[#8A1C1C] rounded-[12px] px-4 py-3 text-[14px]">
              {r.errores.map((e) => <p key={e} className="m-0">{e}</p>)}
            </div>
          )}
          <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 flex items-center justify-center min-h-[260px]">
            {listo ? (
              <div className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[440px]" dangerouslySetInnerHTML={{ __html: vista }} />
            ) : (
              <span className="text-[14px] text-[#6B6A63]">Revisa las medidas</span>
            )}
          </div>
          {listo && (
            <>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 m-0">
                {[
                  ["Piezas", `${r.piezas} (${columnas} × ${filas})`],
                  ["Cada pieza", `${r1(r.piezaAncho)} × ${r1(r.piezaAlto)} mm`],
                  ["Placa", `${ancho} × ${alto} mm`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                    <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                    <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>
              {r.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {r.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
              <button
                type="button"
                onClick={() => { if (!mandarACotizador(`${archivo}.dxf`, dibujoDXF(r.dibujo), locale)) setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                Ver precio al instante en el Cotizador
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!mandarAFabricar(`${archivo}.dxf`, dibujoDXF(r.dibujo), locale, { pieza: `Rompecabezas de ${r.piezas} piezas`, medidas: `${ancho} × ${alto} mm`, proceso: "Corte láser" }))
                    setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
                }}
                className="w-full bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                Fabrícamelo: que un taller lo corte
              </button>
              {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => descargar(`${archivo}.dxf`, dibujoDXF(r.dibujo), "application/dxf")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Descargar DXF
                </button>
                <button type="button" onClick={() => descargar(`${archivo}.svg`, dibujoSVG(r.dibujo, "corte"), "image/svg+xml")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                  Descargar SVG
                </button>
                <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                  Pedir por WhatsApp
                </a>
              </div>
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                ¿Quieres una foto en el rompecabezas? Prepárala en{" "}
                <LocalizedClientLink href="/disenar/grabado-foto" className="font-semibold text-[#B34D07] hover:underline">Foto para grabado láser</LocalizedClientLink>{" "}
                al mismo tamaño de la placa, graba primero y corta después con este archivo. Recomendado: MDF o triplay de 3 mm; en LightBurn pon la capa CORTE a cortar y deja el marco y la base en capas aparte.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
