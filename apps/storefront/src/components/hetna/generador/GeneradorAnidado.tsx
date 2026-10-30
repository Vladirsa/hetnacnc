"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"

import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import { type PiezaAnidar, anidar, hojaAnidadaSVG, hojasComoDibujo, separarPiezas } from "@/lib/generador/anidado"
import { dibujoDXF, dibujoSVG, leerDXF, leerSVG, medidas, unir } from "@/lib/generador/vectores"

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
const LIMITE = 20 * 1024 * 1024
const HOJAS = [
  { etiqueta: "Láser 600 × 400", ancho: 600, alto: 400 },
  { etiqueta: "Láser 900 × 600", ancho: 900, alto: 600 },
  { etiqueta: "Láser 1300 × 900", ancho: 1300, alto: 900 },
  { etiqueta: "MDF 1220 × 2440", ancho: 1220, alto: 2440 },
  { etiqueta: "Melamina 1830 × 2440", ancho: 1830, alto: 2440 },
  { etiqueta: "Lámina 1220 × 2440", ancho: 1220, alto: 2440 },
]
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

const Campo = ({ etiqueta, valor, cambiar, sufijo = "mm" }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo?: string }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[13px] font-semibold text-[#1B1B18]">{etiqueta}</span>
    <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
      <input type="text" inputMode="decimal" value={valor} onChange={(e) => cambiar(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-[16px] text-[#1B1B18] bg-transparent outline-none" />
      {sufijo && <span className="pr-3 text-[13px] text-[#9A978C]">{sufijo}</span>}
    </span>
  </label>
)

type Fila = PiezaAnidar & { ancho: number; alto: number }

export function GeneradorAnidado() {
  const { locale } = useParams<{ locale: string }>()
  const [piezas, setPiezas] = useState<Fila[]>([])
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [separarContornos, setSepararContornos] = useState(true)
  const [hojaIdx, setHojaIdx] = useState(0)
  const [anchoHoja, setAnchoHoja] = useState("600")
  const [altoHoja, setAltoHoja] = useState("400")
  const [separacion, setSeparacion] = useState("3")
  const [margen, setMargen] = useState("5")
  const [girar, setGirar] = useState(true)
  const [hojaVista, setHojaVista] = useState(0)

  const abrir = async (lista: FileList | File[] | null) => {
    setError("")
    if (!lista) return
    const nuevas: Fila[] = []
    for (const f of Array.from(lista)) {
      if (f.size > LIMITE) { setError(`${f.name} pesa más de 20 MB.`); continue }
      try {
        const texto = await f.text()
        const ext = (f.name.split(".").pop() || "").toLowerCase()
        const d = unir(ext === "svg" || /^\s*(<\?xml|<svg)/i.test(texto.slice(0, 200)) ? leerSVG(texto) : leerDXF(texto))
        const base = f.name.replace(/\.[^.]+$/, "")
        const partes = separarContornos ? separarPiezas(d) : [d]
        partes.forEach((p, i) => {
          const m = medidas(p)
          if (!(m.ancho > 0 && m.alto > 0)) return
          nuevas.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nombre: partes.length > 1 ? `${base} ${i + 1}` : base, dibujo: p, cantidad: 1, ancho: m.ancho, alto: m.alto })
        })
      } catch {
        setError(`No pude leer ${f.name}. Sube DXF o SVG.`)
      }
    }
    setPiezas((xs) => [...xs, ...nuevas])
  }

  const elegirHoja = (i: number) => {
    setHojaIdx(i)
    setAnchoHoja(String(HOJAS[i].ancho))
    setAltoHoja(String(HOJAS[i].alto))
  }
  const hoja = { ancho: numero(anchoHoja), alto: numero(altoHoja) }
  const hojaOk = hoja.ancho > 0 && hoja.alto > 0

  const r = useMemo(() => {
    if (!piezas.length || !hojaOk) return null
    return anidar(piezas, { hoja, separacion: Math.max(0, numero(separacion) || 0), margen: Math.max(0, numero(margen) || 0), girar })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piezas, hoja.ancho, hoja.alto, separacion, margen, girar])

  const vistas = useMemo(() => (r ? r.hojas.map((h) => hojaAnidadaSVG(h, hoja)) : []), [r, hoja.ancho, hoja.alto]) // eslint-disable-line react-hooks/exhaustive-deps
  const listo = !!r && r.hojas.length > 0
  const dibujoTodo = useMemo(() => (r ? hojasComoDibujo(r, hoja) : null), [r, hoja.ancho, hoja.alto]) // eslint-disable-line react-hooks/exhaustive-deps
  const nombre = `anidado-hetna-${r1(hoja.ancho)}x${r1(hoja.alto)}`
  const colocadas = r ? r.hojas.reduce((s, h) => s + h.colocaciones.length, 0) : 0
  const mensaje = r
    ? `Hola HETNA CNC, quiero cotizar el corte de ${colocadas} piezas anidadas en ${r.hojas.length} hoja(s) de ${r1(hoja.ancho)} × ${r1(hoja.alto)} mm.`
    : ""

  return (
    <div className="w-full bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-4 pb-3">
        <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#E6F4EC] text-[#16794F] px-3 py-1 rounded-full">Gratis</span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Anidado de piezas en hojas</h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[720px]">
          Sube tus piezas en DXF o SVG, di cuántas de cada una y el tamaño de tu hoja, y te acomodamos todo para desperdiciar lo menos posible. Descarga el DXF listo para láser, router o plasma. Todo en tu navegador.
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[400px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); abrir(e.dataTransfer.files) }}
            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[#E7E4DC] rounded-[12px] cursor-pointer hover:border-[#C2560A] hover:bg-[#FFF8F1] text-center"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C2560A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></svg>
            <span className="text-[14px] font-semibold text-[#1B1B18]">Sube tus piezas (DXF o SVG)</span>
            <span className="text-[12px] text-[#6B6A63]">Puedes subir varios archivos a la vez</span>
            <input type="file" multiple accept=".dxf,.svg" className="hidden" onChange={(e) => abrir(e.target.files)} />
          </label>
          <label className="flex items-center gap-2 text-[13.5px] text-[#1B1B18]">
            <input type="checkbox" checked={separarContornos} onChange={(e) => setSepararContornos(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
            Si un archivo trae varias piezas, separarlas
          </label>
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}

          {piezas.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-[#1B1B18]">Piezas y cantidades</span>
              {piezas.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-[10px] border border-[#E7E4DC] px-2.5 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[#1B1B18]">{p.nombre}</span>
                    <span className="block text-[11.5px] text-[#6B6A63]">{r1(p.ancho)} × {r1(p.alto)} mm</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={p.cantidad}
                    onChange={(e) => setPiezas((xs) => xs.map((x) => (x.id === p.id ? { ...x, cantidad: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x)))}
                    className="w-16 h-9 rounded-[8px] border border-[#D9D5C9] px-2 text-center text-[14px] text-[#1B1B18]"
                    aria-label={`Cantidad de ${p.nombre}`}
                  />
                  <button type="button" onClick={() => setPiezas((xs) => xs.filter((x) => x.id !== p.id))} className="text-[12px] font-semibold text-[#6B675C] hover:text-[#B3261E]">Quitar</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#1B1B18]">Hoja de material</span>
            <div className="flex flex-wrap gap-1.5">
              {HOJAS.map((h, i) => <Opcion key={h.etiqueta} activa={hojaIdx === i && String(h.ancho) === anchoHoja && String(h.alto) === altoHoja} onClick={() => elegirHoja(i)}>{h.etiqueta}</Opcion>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Ancho de la hoja" valor={anchoHoja} cambiar={setAnchoHoja} />
              <Campo etiqueta="Alto de la hoja" valor={altoHoja} cambiar={setAltoHoja} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Separación entre piezas" valor={separacion} cambiar={setSeparacion} />
            <Campo etiqueta="Margen de la hoja" valor={margen} cambiar={setMargen} />
          </div>
          <label className="flex items-center gap-2 text-[14px] text-[#1B1B18]">
            <input type="checkbox" checked={girar} onChange={(e) => setGirar(e.target.checked)} className="w-4 h-4 accent-[#C2560A]" />
            Permitir girar las piezas 90° (desactívalo si el material tiene veta)
          </label>
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {!piezas.length && (
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-6 text-[14px] text-[#6B6A63] flex flex-col gap-2">
              <p className="m-0 font-semibold text-[#1B1B18]">Cómo funciona</p>
              <ul className="m-0 pl-5 flex flex-col gap-1">
                <li>Sube un archivo por pieza, o uno con varias piezas: las separamos solas.</li>
                <li>Escribe cuántas quieres de cada una y elige la hoja (láser, MDF, melamina, lámina).</li>
                <li>La separación es el espacio entre piezas: pon tu kerf más un margen de seguridad (2 a 4 mm en láser, el diámetro de la fresa más 2 mm en router).</li>
                <li>Descarga el DXF con todas las hojas: capa HOJA con el contorno y capa CORTE con las piezas.</li>
              </ul>
            </div>
          )}

          {r && (
            <>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
                {[
                  ["Hojas", String(r.hojas.length)],
                  ["Piezas colocadas", `${colocadas} de ${r.totalPiezas}`],
                  ["Aprovechamiento", `${Math.round(r.aprovechamiento * 100)}%`],
                  ["Hoja", `${r1(hoja.ancho)} × ${r1(hoja.alto)} mm`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                    <dt className="text-[12px] text-[#6B6A63]">{k}</dt>
                    <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>
              {r.noCaben.length > 0 && (
                <ul className="m-0 pl-5 text-[13.5px] text-[#8A1C1C] bg-[#FDECEC] border border-[#F2B8B5] rounded-[12px] py-3 pr-4">
                  {r.noCaben.map((a) => <li key={a}>No cabe en la hoja: {a}</li>)}
                </ul>
              )}

              {listo && (
                <>
                  {r.hojas.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {r.hojas.map((h, i) => <Opcion key={i} activa={hojaVista === i} onClick={() => setHojaVista(i)}>Hoja {i + 1} · {h.colocaciones.length} pzas</Opcion>)}
                    </div>
                  )}
                  <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-3 lg:p-4">
                    <div className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[560px]" dangerouslySetInnerHTML={{ __html: vistas[Math.min(hojaVista, vistas.length - 1)] || "" }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => { if (!mandarACotizador(`${nombre}.dxf`, dibujoDXF(dibujoTodo!), locale)) setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.") }}
                    className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                    Ver precio al instante en el Cotizador
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (!mandarAFabricar(`${nombre}.dxf`, dibujoDXF(dibujoTodo!), locale, { pieza: `${colocadas} piezas anidadas`, medidas: `${r.hojas.length} hoja(s) de ${r1(hoja.ancho)} × ${r1(hoja.alto)} mm`, proceso: "Corte láser" })) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.") }}
                    className="w-full bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></svg>
                    Fabrícamelo: que un taller las corte
                  </button>
                  {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button type="button" onClick={() => descargar(`${nombre}.dxf`, dibujoDXF(dibujoTodo!), "application/dxf")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                      Descargar DXF
                    </button>
                    <button type="button" onClick={() => descargar(`${nombre}.svg`, dibujoSVG(dibujoTodo!, "corte"), "image/svg+xml")} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3 rounded-[10px] text-[14px]">
                      Descargar SVG
                    </button>
                    <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="col-span-2 sm:col-span-1 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold py-3 rounded-[10px] text-[14px] text-center">
                      Pedir por WhatsApp
                    </a>
                  </div>
                  <p className="m-0 text-[12.5px] text-[#6B6A63]">
                    El acomodo usa el rectángulo que envuelve a cada pieza (con giro de 90° si lo permites). Las hojas van una junto a otra en el DXF, en capas HOJA y CORTE.
                  </p>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
