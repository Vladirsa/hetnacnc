"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"

import { aDXF, aSVG, acomodar, areaMaterial, generarCaja } from "@/lib/generador/caja"
import { mandarACotizador } from "@/lib/generador/aCotizador"
import Caja3D from "./Caja3D"
import CajaSolido from "./CajaSolido"

type Unidad = "mm" | "cm" | "in"
const FACTOR: Record<Unidad, number> = { mm: 1, cm: 10, in: 25.4 }
const MAQUINAS = {
  laser: { nombre: "Láser", kerf: "0.15" },
  router: { nombre: "Router CNC", kerf: "0" },
} as const
const ESPESORES = [
  { etiqueta: "MDF 3", mm: 3 },
  { etiqueta: "MDF 6", mm: 6 },
  { etiqueta: "MDF 9", mm: 9 },
  { etiqueta: "MDF 12", mm: 12 },
  { etiqueta: "MDF 18", mm: 18 },
  { etiqueta: "Acrílico 3", mm: 3 },
  { etiqueta: "Acrílico 5", mm: 5 },
]

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const numero = (s: string) => parseFloat(s.replace(",", "."))
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

const Campo = ({
  etiqueta,
  valor,
  cambiar,
  sufijo,
}: {
  etiqueta: string
  valor: string
  cambiar: (v: string) => void
  sufijo: string
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-[13px] font-semibold text-[#1B1B18]">{etiqueta}</span>
    <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none"
      />
      <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>
    </span>
  </label>
)

const Opcion = ({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-2 rounded-[8px] text-[13.5px] font-semibold border ${
      activa ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"
    }`}
  >
    {children}
  </button>
)

export function GeneradorCaja() {
  const { locale } = useParams<{ locale: string }>()
  const [avisoCotizar, setAvisoCotizar] = useState("")
  const [unidad, setUnidad] = useState<Unidad>("mm")
  const [ancho, setAncho] = useState("200")
  const [fondo, setFondo] = useState("150")
  const [alto, setAlto] = useState("100")
  const [espesor, setEspesor] = useState("3")
  const [dedo, setDedo] = useState("12")
  const [maquina, setMaquina] = useState<keyof typeof MAQUINAS>("laser")
  const [kerf, setKerf] = useState<string>(MAQUINAS.laser.kerf)
  const [fresa, setFresa] = useState("3.175") // 1/8" en mm, fresa común para madera
  const [medidas, setMedidas] = useState<"exteriores" | "interiores">("exteriores")
  const [tapa, setTapa] = useState(true)
  const [vista3D, setVista3D] = useState(false)

  const k = FACTOR[unidad]
  const r = useMemo(
    () =>
      generarCaja({
        ancho: numero(ancho) * k,
        fondo: numero(fondo) * k,
        alto: numero(alto) * k,
        espesor: numero(espesor) * k,
        dedo: numero(dedo) * k,
        kerf: numero(kerf) || 0,
        fresa: maquina === "router" ? numero(fresa) * k || 0 : 0,
        medidas,
        tapa,
      }),
    [ancho, fondo, alto, espesor, dedo, kerf, fresa, maquina, medidas, tapa, k]
  )
  const listo = r.piezas.length > 0
  const vista = useMemo(() => (listo ? aSVG(r.piezas, "vista") : ""), [r, listo])
  const hoja = listo ? acomodar(r.piezas) : null
  const ext = r.exterior
  const nombreArchivo = `caja-hetna-${r1(ext.ancho)}x${r1(ext.fondo)}x${r1(ext.alto)}mm-e${r1(numero(espesor) * k)}`

  const cambiarUnidad = (u: Unidad) => {
    const conv = (s: string) => {
      const v = numero(s)
      return Number.isFinite(v) ? String(Math.round(((v * FACTOR[unidad]) / FACTOR[u]) * 1000) / 1000) : s
    }
    setAncho(conv(ancho)); setFondo(conv(fondo)); setAlto(conv(alto)); setEspesor(conv(espesor)); setDedo(conv(dedo)); setFresa(conv(fresa))
    setUnidad(u)
  }

  const imprimir = () => {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(
      `<!doctype html><title>${nombreArchivo}</title><style>@page{margin:5mm}body{margin:0}</style>` +
        `<p style="font:12px sans-serif">Imprime al 100% (sin "ajustar a la página"). Medidas en mm.</p>` +
        aSVG(r.piezas, "corte")
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const mensaje =
    `Hola HETNA CNC, quiero cotizar el corte de una caja con juntas de dedo:\n` +
    `- Medidas exteriores: ${r1(ext.ancho)} x ${r1(ext.fondo)} x ${r1(ext.alto)} mm\n` +
    `- Material: ${r1(numero(espesor) * k)} mm de espesor\n` +
    `- ${r.piezas.length} piezas${tapa ? " (con tapa)" : " (sin tapa)"}, ${hoja ? `hoja de ${r1(hoja.ancho)} x ${r1(hoja.alto)} mm` : ""}\n` +
    `- Máquina: ${MAQUINAS[maquina].nombre}`

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">
          Gratis
        </span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">
          Generador de caja con juntas de dedo
        </h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[680px]">
          Escribe las medidas y el espesor de tu material, y descarga el archivo listo para láser o router CNC.
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        {/* Datos */}
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Máquina</span>
            <div className="flex gap-2">
              {(Object.keys(MAQUINAS) as (keyof typeof MAQUINAS)[]).map((m) => (
                <Opcion key={m} activa={maquina === m} onClick={() => { setMaquina(m); setKerf(MAQUINAS[m].kerf) }}>
                  {MAQUINAS[m].nombre}
                </Opcion>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Unidades</span>
            <div className="flex gap-2">
              {(["mm", "cm", "in"] as Unidad[]).map((u) => (
                <Opcion key={u} activa={unidad === u} onClick={() => cambiarUnidad(u)}>
                  {u === "in" ? "pulgadas" : u}
                </Opcion>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Campo etiqueta="Ancho" valor={ancho} cambiar={setAncho} sufijo={unidad} />
            <Campo etiqueta="Fondo" valor={fondo} cambiar={setFondo} sufijo={unidad} />
            <Campo etiqueta="Alto" valor={alto} cambiar={setAlto} sufijo={unidad} />
          </div>

          <div className="flex gap-2">
            <Opcion activa={medidas === "exteriores"} onClick={() => setMedidas("exteriores")}>Medidas exteriores</Opcion>
            <Opcion activa={medidas === "interiores"} onClick={() => setMedidas("interiores")}>Interiores</Opcion>
          </div>

          <div className="flex flex-col gap-2">
            <Campo etiqueta="Espesor del material" valor={espesor} cambiar={setEspesor} sufijo={unidad} />
            <div className="flex flex-wrap gap-1.5">
              {ESPESORES.map((e) => (
                <button
                  key={e.etiqueta}
                  type="button"
                  onClick={() => setEspesor(String(Math.round((e.mm / k) * 1000) / 1000))}
                  className="text-[12px] font-semibold bg-[#FAF9F6] border border-[#E7E4DC] hover:border-[#C2560A] px-2.5 py-1 rounded-full text-[#1B1B18]"
                >
                  {e.etiqueta} mm
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Ancho de dedo" valor={dedo} cambiar={setDedo} sufijo={unidad} />
            {maquina === "router" ? (
              <Campo etiqueta="Diámetro de fresa" valor={fresa} cambiar={setFresa} sufijo={unidad} />
            ) : (
              <Campo etiqueta="Kerf (corte)" valor={kerf} cambiar={setKerf} sufijo="mm" />
            )}
          </div>

          <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
            <input type="checkbox" checked={tapa} onChange={(e) => setTapa(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
            Con tapa
          </label>
        </section>

        {/* Vista previa y descarga */}
        <section className="flex flex-col gap-4 min-w-0">
          {r.errores.length > 0 && (
            <div className="bg-[#FDECEC] border border-[#F2B8B5] text-[#8A1C1C] rounded-[12px] px-4 py-3 text-[14px]">
              {r.errores.map((e) => <p key={e} className="m-0">{e}</p>)}
            </div>
          )}

          {listo && (
            <>
              <div className="flex gap-2">
                <Opcion activa={!vista3D} onClick={() => setVista3D(false)}>Plano de corte (2D)</Opcion>
                <Opcion activa={vista3D} onClick={() => setVista3D(true)}>Vista armada (3D)</Opcion>
              </div>

              <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-3 lg:p-5">
                {vista3D ? (
                  <Caja3D piezas={r.piezas} espesor={numero(espesor) * k} exterior={ext} />
                ) : (
                  <div
                    className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[520px]"
                    dangerouslySetInnerHTML={{ __html: vista }}
                  />
                )}
              </div>
              {vista3D && (
                <p className="m-0 -mt-2 text-[12.5px] text-[#6B6A63]">Arrastra para rotar, rueda del mouse para acercar. Es una vista de referencia del armado, no sustituye el archivo de corte.</p>
              )}

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
                {[
                  ["Exterior", `${r1(ext.ancho)} × ${r1(ext.fondo)} × ${r1(ext.alto)} mm`],
                  ["Interior", `${r1(r.interior.ancho)} × ${r1(r.interior.fondo)} × ${r1(r.interior.alto)} mm`],
                  ["Hoja necesaria", hoja ? `${r1(hoja.ancho)} × ${r1(hoja.alto)} mm` : "-"],
                  ["Material", `${areaMaterial(r.piezas).toFixed(3)} m² · ${r.piezas.length} piezas`],
                ].map(([t, v]) => (
                  <div key={t} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                    <dt className="text-[12px] text-[#6B6A63]">{t}</dt>
                    <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>

              {r.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {r.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
              {maquina === "router" && numero(fresa) * k > 0 && (
                <p className="m-0 text-[13px] text-[#16794F] bg-[#E6F4EC] border border-[#B7E0C8] rounded-[12px] px-4 py-2.5">
                  El archivo ya incluye el alivio de esquina (&quot;dogbone&quot;) para tu fresa de {r1(numero(fresa) * k)} mm: no hace falta activarlo en tu CAM.
                </p>
              )}

              <button
                type="button"
                onClick={() => { if (!mandarACotizador(`${nombreArchivo}.dxf`, aDXF(r.piezas), locale)) setAvisoCotizar("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                Ver precio al instante en el Cotizador
              </button>
              {avisoCotizar && <p className="m-0 text-[13px] text-[#8A1C1C]">{avisoCotizar}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => descargar(`${nombreArchivo}.dxf`, aDXF(r.piezas), "application/dxf")}
                  className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  Descargar DXF
                </button>
                <button
                  type="button"
                  onClick={() => descargar(`${nombreArchivo}.svg`, aSVG(r.piezas, "corte"), "image/svg+xml")}
                  className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  Descargar SVG
                </button>
                <button
                  type="button"
                  onClick={imprimir}
                  className="bg-white border border-[#142033] text-[#142033] font-semibold py-3 rounded-[10px] text-[14px]"
                >
                  PDF / Imprimir
                </button>
                <a
                  href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center"
                >
                  Pedir por WhatsApp
                </a>
              </div>
              <p className="m-0 text-[12.5px] text-[#6B6A63]">
                Revisa el archivo antes de cortar y haz una prueba en retazo para ajustar el kerf de tu máquina. ¿No tienes máquina? Te lo cortamos y te lo enviamos.
              </p>

              <CajaSolido piezas={r.piezas} espesor={numero(espesor) * k} exterior={ext} nombreArchivo={nombreArchivo} />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
