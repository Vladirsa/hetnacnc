"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import {
  Dibujo,
  Malla,
  dibujoDXF,
  dibujoSVG,
  escalar,
  escalarMalla,
  leerDXF,
  leerOBJ,
  leerSTL,
  leerSVG,
  mallaOBJ,
  mallaSTL,
  medidas,
  medidasMalla,
  unir,
} from "@/lib/generador/vectores"
import { mandarACotizador } from "@/lib/generador/aCotizador"

type Archivo =
  | { tipo: "2d"; nombre: string; formato: "dxf" | "svg"; dibujo: Dibujo }
  | { tipo: "3d"; nombre: string; formato: "stl" | "obj"; malla: Malla }

type ModoEscala = "igual" | "espesor" | "ancho" | "porcentaje" | "unidades"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const LIMITE = 30 * 1024 * 1024
const numero = (s: string) => parseFloat((s || "").replace(",", "."))
const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100

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

const Opcion = ({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-2 rounded-[8px] text-[13px] font-semibold border ${
      activa ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"
    }`}
  >
    {children}
  </button>
)

const Campo = ({ etiqueta, valor, cambiar, sufijo }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo: string }) => (
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

export function GeneradorConvertidor() {
  const { locale } = useParams<{ locale: string }>()
  const [avisoCotizar, setAvisoCotizar] = useState("")
  const [archivo, setArchivo] = useState<Archivo | null>(null)
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [juntar, setJuntar] = useState(true)
  const [modo, setModo] = useState<ModoEscala>("igual")
  const [espAntes, setEspAntes] = useState("3")
  const [espDespues, setEspDespues] = useState("6")
  const [anchoNuevo, setAnchoNuevo] = useState("")
  const [porcentaje, setPorcentaje] = useState("100")
  const [factorUnidades, setFactorUnidades] = useState(25.4)

  const abrir = async (f: File | undefined) => {
    setError("")
    if (!f) return
    if (f.size > LIMITE) { setError("El archivo pesa más de 30 MB."); return }
    const ext = (f.name.split(".").pop() || "").toLowerCase()
    setCargando(true)
    try {
      if (ext === "dxf") setArchivo({ tipo: "2d", nombre: f.name, formato: "dxf", dibujo: leerDXF(await f.text()) })
      else if (ext === "svg") setArchivo({ tipo: "2d", nombre: f.name, formato: "svg", dibujo: leerSVG(await f.text()) })
      else if (ext === "stl") setArchivo({ tipo: "3d", nombre: f.name, formato: "stl", malla: leerSTL(await f.arrayBuffer()) })
      else if (ext === "obj") setArchivo({ tipo: "3d", nombre: f.name, formato: "obj", malla: leerOBJ(await f.text()) })
      else setError("Formato no compatible. Sube un DXF, SVG, STL u OBJ.")
      setModo("igual")
    } catch {
      setError("No pude leer el archivo. Revisa que no esté dañado.")
    } finally {
      setCargando(false)
    }
  }

  // dibujo 2D ya unido
  const base2d = useMemo(() => (archivo?.tipo === "2d" ? (juntar ? unir(archivo.dibujo) : archivo.dibujo) : null), [archivo, juntar])
  const med0 = useMemo(() => (base2d ? medidas(base2d) : null), [base2d])
  const med3d0 = useMemo(() => (archivo?.tipo === "3d" ? medidasMalla(archivo.malla) : null), [archivo])

  // factor de escala
  const factor = (() => {
    if (modo === "espesor") { const a = numero(espAntes), b = numero(espDespues); return a > 0 && b > 0 ? b / a : NaN }
    if (modo === "ancho") { const w = numero(anchoNuevo); const w0 = med0 ? med0.ancho : med3d0?.x || 0; return w > 0 && w0 > 0 ? w / w0 : NaN }
    if (modo === "porcentaje") { const p = numero(porcentaje); return p > 0 ? p / 100 : NaN }
    if (modo === "unidades") return factorUnidades
    return 1
  })()
  const factorOk = Number.isFinite(factor) && factor > 0

  const salida2d = useMemo(() => (base2d && factorOk ? escalar(base2d, factor) : null), [base2d, factor, factorOk])
  const med = useMemo(() => (salida2d ? medidas(salida2d) : null), [salida2d])
  const vista = useMemo(() => (salida2d && salida2d.trazos.length ? dibujoSVG(salida2d, "vista") : ""), [salida2d])
  const salida3d = archivo?.tipo === "3d" && factorOk ? escalarMalla(archivo.malla, factor) : null
  const med3d = salida3d ? medidasMalla(salida3d) : null

  const raiz = archivo ? archivo.nombre.replace(/\.[^.]+$/, "") + (factorOk && factor !== 1 ? `-x${r2(factor)}` : "") : ""
  const mensaje = med
    ? `Hola HETNA CNC, quiero cotizar el corte de mi archivo "${archivo?.nombre}":\n- Tamaño: ${r1(med.ancho)} x ${r1(med.alto)} mm\n- Longitud de corte: ${r2(med.largo / 1000)} m\n- Contornos: ${med.cerrados} cerrados, ${med.abiertos} abiertos`
    : med3d
      ? `Hola HETNA CNC, quiero cotizar mi pieza 3D "${archivo?.nombre}":\n- Tamaño: ${r1(med3d.x)} x ${r1(med3d.y)} x ${r1(med3d.z)} mm`
      : ""

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-5 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios" className="hover:text-[#B34D07]">Servicios</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/servicios/generador-2d-3d" className="hover:text-[#B34D07]">Generador 2D y 3D</LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">Convertidor y reescalador</span>
      </div>

      <section className="px-4 lg:px-16 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">
          Gratis
        </span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">
          Convertidor y reescalador de archivos
        </h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Pasa tu archivo de DXF a SVG (o al revés) y de STL a OBJ, cambia su tamaño o ajústalo a otro espesor de material. Tu archivo no se sube a ningún servidor: todo se hace en tu navegador.
        </p>
      </section>

      <div className="px-4 lg:px-16 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[#E7E4DC] rounded-[12px] cursor-pointer hover:border-[#C2560A] hover:bg-[#FFF8F1] text-center">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C2560A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />
            </svg>
            <span className="text-[14px] font-semibold text-[#1B1B18]">{archivo ? archivo.nombre : "Sube tu archivo"}</span>
            <span className="text-[12px] text-[#6B6A63]">DXF, SVG, STL u OBJ · hasta 30 MB</span>
            <input type="file" accept=".dxf,.svg,.stl,.obj" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
          </label>
          {cargando && <p className="m-0 text-[13px] text-[#6B6A63]">Leyendo archivo...</p>}
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}

          {archivo && (
            <>
              {archivo.tipo === "2d" && (
                <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
                  <input type="checkbox" checked={juntar} onChange={(e) => setJuntar(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
                  Unir líneas sueltas en contornos
                </label>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-[#1B1B18]">Tamaño</span>
                <div className="flex flex-wrap gap-2">
                  <Opcion activa={modo === "igual"} onClick={() => setModo("igual")}>Igual</Opcion>
                  {archivo.tipo === "2d" && <Opcion activa={modo === "espesor"} onClick={() => setModo("espesor")}>Otro espesor</Opcion>}
                  <Opcion activa={modo === "ancho"} onClick={() => setModo("ancho")}>A un ancho</Opcion>
                  <Opcion activa={modo === "porcentaje"} onClick={() => setModo("porcentaje")}>Porcentaje</Opcion>
                  <Opcion activa={modo === "unidades"} onClick={() => setModo("unidades")}>Corregir unidades</Opcion>
                </div>
              </div>

              {modo === "espesor" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo etiqueta="Espesor del diseño" valor={espAntes} cambiar={setEspAntes} sufijo="mm" />
                    <Campo etiqueta="Espesor nuevo" valor={espDespues} cambiar={setEspDespues} sufijo="mm" />
                  </div>
                  <p className="m-0 text-[12.5px] text-[#6B6A63]">
                    Para diseños con ranuras y encastres: todo el dibujo crece o se achica en la misma proporción para que las ranuras midan lo mismo que tu material nuevo.
                  </p>
                </>
              )}
              {modo === "ancho" && <Campo etiqueta="Ancho nuevo" valor={anchoNuevo} cambiar={setAnchoNuevo} sufijo="mm" />}
              {modo === "porcentaje" && <Campo etiqueta="Porcentaje" valor={porcentaje} cambiar={setPorcentaje} sufijo="%" />}
              {modo === "unidades" && (
                <div className="flex flex-wrap gap-2">
                  <Opcion activa={factorUnidades === 25.4} onClick={() => setFactorUnidades(25.4)}>Estaba en pulgadas</Opcion>
                  <Opcion activa={factorUnidades === 10} onClick={() => setFactorUnidades(10)}>Estaba en cm</Opcion>
                  <Opcion activa={factorUnidades === 1000} onClick={() => setFactorUnidades(1000)}>Estaba en metros</Opcion>
                  <Opcion activa={factorUnidades === 1 / 25.4} onClick={() => setFactorUnidades(1 / 25.4)}>Pasar mm a pulgadas</Opcion>
                </div>
              )}
              {!factorOk && <p className="m-0 text-[13px] text-[#8A1C1C]">Escribe medidas mayores que cero.</p>}
            </>
          )}
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {!archivo && (
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 text-[14px] text-[#6B6A63] flex flex-col gap-2">
              <p className="m-0 font-semibold text-[#1B1B18]">¿Para qué sirve?</p>
              <ul className="m-0 pl-5 flex flex-col gap-1">
                <li>Abrir en LightBurn o VCarve un diseño que solo tienes en SVG, o en Inkscape uno que tienes en DXF.</li>
                <li>Cortar en MDF de 6 mm un diseño hecho para 3 mm, sin que las ranuras queden flojas.</li>
                <li>Arreglar archivos que salen diminutos o gigantes porque venían en pulgadas.</li>
                <li>Pasar un modelo STL a OBJ (o al revés) para tu programa de 3D.</li>
              </ul>
            </div>
          )}

          {archivo?.tipo === "2d" && (
            <>
              {archivo.dibujo.avisos.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#5A3A12] bg-[#FFF6E8] border border-[#F2C98F] rounded-[12px] py-3 pr-4">
                  {archivo.dibujo.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
              {vista && (
                <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-3 lg:p-5">
                  <div className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[520px]" dangerouslySetInnerHTML={{ __html: vista }} />
                  <div className="mt-3 flex flex-wrap gap-4 text-[12.5px] text-[#6B6A63]">
                    <span className="flex items-center gap-2"><span className="w-6 border-t-2 border-[#C2560A]" /> Contorno cerrado</span>
                    <span className="flex items-center gap-2"><span className="w-6 border-t-2 border-[#1F5FBF]" /> Línea abierta</span>
                  </div>
                </div>
              )}
              {med && med0 && (
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
                  {[
                    ["Tamaño", `${r1(med.ancho)} × ${r1(med.alto)} mm`],
                    ["Antes", `${r1(med0.ancho)} × ${r1(med0.alto)} mm`],
                    ["Longitud de corte", `${r2(med.largo / 1000)} m`],
                    ["Contornos", `${med.cerrados} cerrados · ${med.abiertos} abiertos`],
                  ].map(([t, v]) => (
                    <div key={t} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                      <dt className="text-[12px] text-[#6B6A63]">{t}</dt>
                      <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {med && med.abiertos > 0 && (
                <p className="m-0 text-[13px] text-[#5A3A12]">
                  Hay {med.abiertos} líneas abiertas (en azul): en el CAM no podrás hacer corte por dentro o por fuera en ellas. Si deben cerrar, revisa el dibujo o pide el servicio de Preparación para CAM.
                </p>
              )}
              {salida2d && salida2d.trazos.length > 0 && (
                <>
                <button
                  type="button"
                  onClick={() => { if (!mandarACotizador(`${raiz}.dxf`, dibujoDXF(salida2d), locale)) setAvisoCotizar("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                  className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                  Ver precio al instante en el Cotizador
                </button>
                {avisoCotizar && <p className="m-0 text-[13px] text-[#8A1C1C]">{avisoCotizar}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button type="button" onClick={() => descargar(`${raiz}.dxf`, dibujoDXF(salida2d), "application/dxf")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                    Descargar DXF
                  </button>
                  <button type="button" onClick={() => descargar(`${raiz}.svg`, dibujoSVG(salida2d, "corte"), "image/svg+xml")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                    Descargar SVG
                  </button>
                  <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="col-span-2 sm:col-span-1 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                    Pedir por WhatsApp
                  </a>
                </div>
                </>
              )}
            </>
          )}

          {archivo?.tipo === "3d" && med3d && med3d0 && (
            <>
              {archivo.malla.avisos.length > 0 && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{archivo.malla.avisos.join(" ")}</p>}
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 m-0">
                {[
                  ["Tamaño", `${r1(med3d.x)} × ${r1(med3d.y)} × ${r1(med3d.z)} mm`],
                  ["Antes", `${r1(med3d0.x)} × ${r1(med3d0.y)} × ${r1(med3d0.z)} mm`],
                  ["Triángulos", med3d.triangulos.toLocaleString("es-MX")],
                ].map(([t, v]) => (
                  <div key={t} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                    <dt className="text-[12px] text-[#6B6A63]">{t}</dt>
                    <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>
              {salida3d && salida3d.tris.length > 0 && (
                <>
                <button
                  type="button"
                  onClick={() => { if (!mandarACotizador(`${raiz}.stl`, mallaSTL(salida3d), locale)) setAvisoCotizar("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                  className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                  Ver precio al instante en el Cotizador
                </button>
                {avisoCotizar && <p className="m-0 text-[13px] text-[#8A1C1C]">{avisoCotizar}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button type="button" onClick={() => descargar(`${raiz}.stl`, mallaSTL(salida3d), "model/stl")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                    Descargar STL
                  </button>
                  <button type="button" onClick={() => descargar(`${raiz}.obj`, mallaOBJ(salida3d), "model/obj")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                    Descargar OBJ
                  </button>
                  <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="col-span-2 sm:col-span-1 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                    Pedir por WhatsApp
                  </a>
                </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
