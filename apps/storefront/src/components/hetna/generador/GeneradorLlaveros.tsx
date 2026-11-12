"use client"

// Llaveros, placas y adornos con nombre dentro del 3D Studio: el llavero en
// 3D (placa con letras en relieve, para imprimir), el dibujo para láser en
// Diseño 2D (capa CORTE y capa GRABADO) y los archivos en Exportación.
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"

import {
  Aviso,
  Boton,
  CampoNum,
  Datos,
  Destacado,
  Etiqueta,
  Seccion,
  TarjetaExport,
  descargar,
  numero,
  r1,
} from "@/components/hetna/estudio3d/Controles"
import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import { FUENTES, cargarFuente, instalarFuentesVista } from "@/lib/generador/fuentes"
import type { Fuente } from "@/lib/generador/letreros"
import { FORMAS_LLAVERO, type FormaLlavero, hacerLlavero } from "@/lib/generador/llaveros"
import { type Dibujo, dibujoDXF, dibujoSVG, mallaSTL } from "@/lib/generador/vectores"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522217076014"

// Modelos con nombre: mismas opciones, distinto punto de partida
const MODELOS: { id: string; nombre: string; forma: FormaLlavero; texto: string; alto: string; fuente: string }[] = [
  { id: "llavero", nombre: "Llavero", forma: "rect", texto: "Sofía", alto: "12", fuente: "pacifico" },
  { id: "etiqueta", nombre: "Etiqueta de maleta", forma: "etiqueta", texto: "VIAJE", alto: "14", fuente: "bebas-neue" },
  { id: "corazon", nombre: "Corazón", forma: "corazon", texto: "Mamá", alto: "11", fuente: "lobster" },
  { id: "mascota", nombre: "Placa de mascota", forma: "circulo", texto: "Max", alto: "13", fuente: "montserrat" },
  { id: "placa", nombre: "Placa de puerta", forma: "rect", texto: "Taller", alto: "20", fuente: "oswald" },
  { id: "adorno", nombre: "Adorno", forma: "ovalo", texto: "2026", alto: "16", fuente: "cinzel" },
]

// El llavero como quedaría: placa de madera con las letras grabadas
function vistaLlavero(d: Dibujo): string {
  const pts = d.trazos.flatMap((t) => t.pts)
  if (!pts.length) return ""
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const mar = 3
  const W = x1 - x0 + 2 * mar
  const H = y1 - y0 + 2 * mar
  const ruta = (capa: string) =>
    d.trazos
      .filter((t) => (capa === "GRABADO" ? t.capa === "GRABADO" : t.capa !== "GRABADO"))
      .map((t) => t.pts.map(([x, y], i) => `${i ? "L" : "M"}${(x - x0 + mar).toFixed(2)} ${(H - mar - (y - y0)).toFixed(2)}`).join(" ") + (t.cerrado ? " Z" : ""))
      .join(" ")
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">` +
    `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9B48A"/><stop offset="1" stop-color="#B98A5C"/></linearGradient></defs>` +
    `<path d="${ruta("CORTE")}" fill="url(#m)" fill-rule="evenodd" stroke="#FF7A2E" stroke-width="0.35"/>` +
    `<path d="${ruta("GRABADO")}" fill="#5A3A1E" fill-rule="evenodd" stroke="#3B2512" stroke-width="0.15"/>` +
    `</svg>`
  )
}

export function GeneradorLlaveros() {
  const { locale } = useParams<{ locale: string }>()
  const [texto, setTexto] = useState("Sofía")
  const [fuenteId, setFuenteId] = useState("pacifico")
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [forma, setForma] = useState<FormaLlavero>("rect")
  const [alto, setAlto] = useState("12")
  const [espaciado, setEspaciado] = useState("0")
  const [margen, setMargen] = useState("4")
  const [radio, setRadio] = useState("5")
  const [argolla, setArgolla] = useState("4.5")
  const [grosor, setGrosor] = useState("3")
  const [relieve, setRelieve] = useState("1.5")
  const [cantidad, setCantidad] = useState("1")
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    instalarFuentesVista()
  }, [])

  useEffect(() => {
    const t = FUENTES.find((x) => x.id === fuenteId)
    if (!t) return
    let vivo = true
    setCargando(true)
    setError("")
    cargarFuente(t)
      .then((f) => {
        if (vivo) setFuente(f)
      })
      .catch(() => {
        if (vivo) setError("No se pudo cargar la tipografía. Revisa tu conexión e inténtalo otra vez.")
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [fuenteId])

  const elegirModelo = (m: (typeof MODELOS)[number]) => {
    setForma(m.forma)
    setTexto(m.texto)
    setAlto(m.alto)
    setFuenteId(m.fuente)
  }

  const r = useMemo(() => {
    if (!fuente) return null
    try {
      return hacerLlavero(fuente, {
        texto,
        alto: numero(alto),
        espaciado: numero(espaciado) || 0,
        forma,
        margen: numero(margen) || 0,
        radio: numero(radio) || 0,
        argolla: numero(argolla) || 0,
        grosor: numero(grosor) || 0,
        relieve: numero(relieve) || 0,
      })
    } catch {
      return null
    }
  }, [fuente, texto, alto, espaciado, forma, margen, radio, argolla, grosor, relieve])

  const listo = !!r && !r.errores.length
  const vista2d = useMemo(() => (listo ? vistaLlavero(r!.dibujo) : ""), [r, listo])
  const piezas = Math.max(1, Math.round(numero(cantidad) || 1))
  const primerRenglon = texto.split("\n")[0] || "nombre"
  const archivo = `llavero-hetna-${
    primerRenglon
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30)
      .toLowerCase() || "nombre"
  }`
  const formaNombre = FORMAS_LLAVERO.find((f) => f.id === forma)?.nombre
  const mensaje = r
    ? `Hola HETNA CNC, quiero cotizar llaveros con nombre:\n- Texto: ${texto}\n- Forma: ${formaNombre}\n- Tamaño: ${r1(r.ancho)} × ${r1(r.alto)} mm\n- Cantidad: ${piezas}`
    : ""

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Empieza con un modelo">
        <div className="grid grid-cols-3 gap-1.5">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => elegirModelo(m)}
              className="rounded-[8px] bg-[#1C2431] px-1.5 py-2 text-[11.5px] font-semibold leading-tight text-[#C9D2E0] hover:bg-[#243045] hover:text-white"
            >
              {m.nombre}
            </button>
          ))}
        </div>
      </Seccion>

      <label className="flex flex-col gap-1.5">
        <Etiqueta>Texto</Etiqueta>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={60}
          className="w-full resize-y rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[16px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        />
        <span className="text-[11.5px] text-[#8A97AB]">Enter para un segundo renglón.</span>
      </label>

      <Seccion titulo={`Tipografía${cargando ? " (cargando…)" : ""}`}>
        <div className="max-h-[188px] shrink-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-1.5">
          {FUENTES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFuenteId(t.id)}
              aria-pressed={fuenteId === t.id}
              style={{ fontFamily: `"hl-${t.id}", sans-serif`, fontWeight: t.peso }}
              className={`h-10 truncate rounded-[8px] px-2 text-[15px] ${
                fuenteId === t.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
              }`}
            >
              {t.nombre}
            </button>
          ))}
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Forma">
        <div className="grid grid-cols-3 gap-1.5">
          {FORMAS_LLAVERO.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setForma(f.id)}
              aria-pressed={forma === f.id}
              className={`rounded-[8px] px-1.5 py-2 text-[12px] font-semibold ${
                forma === f.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
              }`}
            >
              {f.nombre}
            </button>
          ))}
        </div>
      </Seccion>

      <Destacado titulo="Tamaño">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={60}
            step={0.5}
            value={numero(alto) || 5}
            onChange={(e) => setAlto(e.target.value)}
            className="flex-1 accent-[#C2560A]"
          />
          <span className="w-[84px]">
            <CampoNum etiqueta="" valor={alto} cambiar={setAlto} />
          </span>
        </div>
        {listo && (
          <span className="text-[12px] text-[#F2D29B]">
            El llavero mide {r1(r!.ancho)} × {r1(r!.alto)} mm
          </span>
        )}
      </Destacado>

      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Entre letras" valor={espaciado} cambiar={setEspaciado} />
        <CampoNum etiqueta="Margen" valor={margen} cambiar={setMargen} />
        {(forma === "rect" || forma === "etiqueta") && <CampoNum etiqueta="Esquinas" valor={radio} cambiar={setRadio} />}
        <CampoNum etiqueta="Argolla (0 = sin)" valor={argolla} cambiar={setArgolla} />
      </div>

      <Seccion titulo="Impresión 3D" nota="Pausa la impresión al llegar al relieve para cambiar de color y que el nombre quede en otro tono.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Grosor de la placa" valor={grosor} cambiar={setGrosor} />
          <CampoNum etiqueta="Relieve de letras" valor={relieve} cambiar={setRelieve} />
        </div>
      </Seccion>

      <CampoNum etiqueta="Cuántos quieres (para cotizar)" valor={cantidad} cambiar={setCantidad} sufijo="pzas" />

      {error && <Aviso tipo="error">{error}</Aviso>}
      {r?.errores.map((e) => (
        <Aviso key={e} tipo="error">
          {e}
        </Aviso>
      ))}
      {listo && r!.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
    </div>
  )

  const diseno2d = (
    <div className="flex h-full flex-col gap-3 p-4">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#8A97AB]">{cargando ? "Cargando tipografía…" : "Escribe un texto."}</p>
      ) : (
        <>
          <Datos
            filas={[
              ["Tamaño", `${r1(r!.ancho)} × ${r1(r!.alto)} mm`],
              ["Láser", "Capa CORTE + capa GRABADO"],
              ["Impresión 3D", `${r1(numero(grosor) + numero(relieve))} mm de alto`],
              ["Forma", formaNombre || ""],
            ]}
          />
          <div
            className="flex min-h-[300px] flex-1 items-center justify-center rounded-[10px] bg-[#0F151E] p-6 [&>svg]:max-h-[460px] [&>svg]:w-full [&>svg]:max-w-[720px]"
            dangerouslySetInnerHTML={{ __html: vista2d }}
          />
          <p className="m-0 text-[12.5px] text-[#8A97AB]">Naranja: corte de la placa y agujero · Café oscuro: letras para grabar.</p>
        </>
      )}
    </div>
  )

  const fabricar = (proceso: "Corte láser" | "Impresión 3D") => {
    const datos = {
      pieza: `${piezas} ${piezas === 1 ? "llavero" : "llaveros"} "${primerRenglon}"`,
      medidas: `${r1(r!.ancho)} × ${r1(r!.alto)} mm`,
      proceso,
    }
    const ok =
      proceso === "Impresión 3D"
        ? mandarAFabricar(`${archivo}.stl`, mallaSTL(r!.malla), locale, datos)
        : mandarAFabricar(`${archivo}.dxf`, dibujoDXF(r!.dibujo), locale, datos)
    if (!ok) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
  }

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Escribe un texto para generar los archivos.</p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <h3 className="m-0 text-[18px] font-bold">Archivos</h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]">En milímetros. DXF y SVG con capa CORTE y capa GRABADO; STL con las letras en relieve.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaExport titulo="Para láser" nota="Corta la placa y graba o marca las letras.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${archivo}.dxf`, dibujoDXF(r!.dibujo), "application/dxf")}>
              DXF
            </Boton>
            <Boton onClick={() => descargar(`${archivo}.svg`, dibujoSVG(r!.dibujo, "corte"), "image/svg+xml")}>SVG</Boton>
          </div>
        </TarjetaExport>
        <TarjetaExport titulo="Para impresión 3D" nota="Placa con el agujero y las letras en relieve.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${archivo}.stl`, mallaSTL(r!.malla), "model/stl")}>
              STL
            </Boton>
          </div>
        </TarjetaExport>
      </div>

      <TarjetaExport titulo="¿Cuánto cuesta?" nota={`Precio para ${piezas} ${piezas === 1 ? "pieza" : "piezas"}, al instante o por WhatsApp.`}>
        <div className="flex gap-2">
          <Boton
            tipo="verde"
            onClick={() => {
              if (!mandarACotizador(`${archivo}.dxf`, dibujoDXF(r!.dibujo), locale))
                setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.")
            }}
          >
            Cotizador
          </Boton>
          <Boton href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`}>WhatsApp</Boton>
        </div>
      </TarjetaExport>

      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold">¿No tienes máquina?</span>
        <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA los corta o los imprime y te los envía.</span>
        <div className="flex gap-2">
          <Boton tipo="primario" onClick={() => fabricar("Corte láser")}>
            Cortar en láser
          </Boton>
          <Boton tipo="primario" onClick={() => fabricar("Impresión 3D")}>
            Imprimir en 3D
          </Boton>
        </div>
      </div>
      {aviso && <Aviso tipo="error">{aviso}</Aviso>}
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo={primerRenglon || "Llavero"}
      subtitulo="Llaveros, placas y adornos"
      materialInicial="naranja"
      tris={listo ? r!.malla.tris : undefined}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={[]}
      barra={listo ? <span>· {r1(r!.ancho)} × {r1(r!.alto)} mm · {formaNombre}</span> : null}
    />
  )
}
