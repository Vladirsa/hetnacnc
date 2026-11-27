"use client"

// Llaveros, placas y adornos con nombre dentro del 3D Studio: el llavero en
// 3D (placa con letras en relieve, para imprimir), el dibujo para láser en
// Diseño 2D (capa CORTE y capa GRABADO) y los archivos en Exportación.
//
// 25 nov 2026: renglones de abajo más chicos (teléfono), ícono y logo del
// cliente a la izquierda, muchos nombres de una vez (ZIP) y liga con el diseño
// (?texto=…&forma=…&fuente=…&icono=…&alto=…), que usan los llaveros del
// catálogo de Impresión 3D bajo pedido para "modificar".
import { T } from "@/components/hetna/i18n/Idioma"
import { BotonesCam } from "./BotonesCam"
import { PanelColores, TarjetaColores, useMulticolor } from "./Multicolor"
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
import { mandarACotizador, mandarAFabricar, materialLaserPorEspesor, nombresDeArchivo, slugArchivo } from "@/lib/generador/aCotizador"
import { FUENTES, cargarFuente, instalarFuentesVista } from "@/lib/generador/fuentes"
import type { Fuente } from "@/lib/generador/letreros"
import { FORMAS_LLAVERO, type FormaLlavero, OPCIONES_LLAVERO_FABRICA as FABRICA, type OpcionesLlavero, hacerLlavero } from "@/lib/generador/llaveros"
import { TIPOS_LOGO, logoDeArchivo } from "@/lib/generador/logoContornos"
import { ICONOS_TEXTURA, type IconoTextura } from "@/lib/generador/texturizador"
import type { P } from "@/lib/generador/vectores"
import { type Dibujo, dibujoDXF, dibujoSVG, mallaSTL } from "@/lib/generador/vectores"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })


const MAX_NOMBRES = 200
const MAX_TEXTO = 60
/** Topes de lo que llega por la liga (lo mismo que dejan los controles) */
const TOPES: Record<string, [number, number]> = { alto: [5, 60], escala: [40, 100], grosor: [0.6, 20], relieve: [0, 10] }

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

export function GeneradorLlaveros({ cabecera }: { cabecera?: React.ReactNode } = {}) {
  const { locale } = useParams<{ locale: string }>()
  const [texto, setTexto] = useState("Sofía")
  const [fuenteId, setFuenteId] = useState("pacifico")
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [forma, setForma] = useState<FormaLlavero>("rect")
  const [alto, setAlto] = useState("12")
  const [espaciado, setEspaciado] = useState(String(FABRICA.espaciado))
  const [margen, setMargen] = useState(String(FABRICA.margen))
  const [radio, setRadio] = useState(String(FABRICA.radio))
  const [argolla, setArgolla] = useState(String(FABRICA.argolla))
  const [grosor, setGrosor] = useState(String(FABRICA.grosor))
  const [relieve, setRelieve] = useState(String(FABRICA.relieve))
  const [cantidad, setCantidad] = useState("1")
  const [aviso, setAviso] = useState("")
  const [escala2, setEscala2] = useState("60")
  const [icono, setIcono] = useState<IconoTextura | "">("")
  const [logo, setLogo] = useState<P[][] | null>(null)
  const [logoNombre, setLogoNombre] = useState("")
  const [logoAviso, setLogoAviso] = useState("")
  const [leyendoLogo, setLeyendoLogo] = useState(false)
  const [nombres, setNombres] = useState("")
  const [armandoZip, setArmandoZip] = useState(false)

  // Liga con el diseño (catálogo de impresión: "modificar")
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const t = q.get("texto")
    if (t) setTexto(t.slice(0, MAX_TEXTO))
    const f = q.get("forma")
    if (f && FORMAS_LLAVERO.some((x) => x.id === f)) setForma(f as FormaLlavero)
    const fu = q.get("fuente")
    if (fu && FUENTES.some((x) => x.id === fu)) setFuenteId(fu)
    const ic = q.get("icono")
    if (ic && ICONOS_TEXTURA.some((x) => x.id === ic)) setIcono(ic as IconoTextura)
    for (const [k, poner] of [["alto", setAlto], ["escala", setEscala2], ["grosor", setGrosor], ["relieve", setRelieve]] as const) {
      const v = Number(q.get(k))
      const [min, max] = TOPES[k]
      if (q.get(k)?.trim() && Number.isFinite(v) && v > 0) poner(String(Math.min(max, Math.max(min, v))))
    }
  }, [])

  const subirLogo = async (f: File | undefined) => {
    if (!f) return
    setLogoAviso("")
    setLeyendoLogo(true)
    try {
      setLogo(await logoDeArchivo(f))
      setLogoNombre(f.name)
    } catch (e) {
      setLogoAviso(e instanceof Error ? e.message : "No se pudo leer el logo.")
    } finally {
      setLeyendoLogo(false)
    }
  }

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

  // Todo menos el texto (lo mismo sirve para "muchos nombres")
  const opciones = useMemo<Omit<OpcionesLlavero, "texto">>(
    () => ({
      alto: numero(alto),
      espaciado: numero(espaciado) || 0,
      forma,
      margen: numero(margen) || 0,
      radio: numero(radio) || 0,
      argolla: numero(argolla) || 0,
      grosor: numero(grosor) || 0,
      relieve: numero(relieve) || 0,
      escalaRenglones: numero(escala2) || 100,
      icono,
      logo,
    }),
    [alto, espaciado, forma, margen, radio, argolla, grosor, relieve, escala2, icono, logo]
  )

  const r = useMemo(() => {
    if (!fuente) return null
    try {
      return hacerLlavero(fuente, { ...opciones, texto })
    } catch {
      return null
    }
  }, [fuente, texto, opciones])

  const listo = !!r && !r.errores.length
  const vista2d = useMemo(() => (listo ? vistaLlavero(r!.dibujo) : ""), [r, listo])
  const piezas = Math.max(1, Math.round(numero(cantidad) || 1))
  const primerRenglon = texto.split("\n")[0] || "nombre"
  const archivo = `llavero-hetna-${slugArchivo(primerRenglon, "nombre")}`
  const formaNombre = FORMAS_LLAVERO.find((f) => f.id === forma)?.nombre
  const mc = useMulticolor(listo ? r!.malla : null)

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
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
        <Etiqueta><T>Texto</T></Etiqueta>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={MAX_TEXTO}
          className="w-full resize-y rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[16px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        />
        <span className="text-[11.5px] text-[#8A97AB]"><T>Enter para un segundo renglón (por ejemplo, el teléfono en la placa de mascota).</T></span>
      </label>
      {texto.includes("\n") && (
        <div className="flex items-center gap-3">
          <Etiqueta><T>Renglones de abajo</T></Etiqueta>
          <input type="range" min={40} max={100} step={5} value={numero(escala2) || 100} onChange={(e) => setEscala2(e.target.value)} className="flex-1 accent-[#C2560A]" />
          <span className="w-[44px] text-right text-[12.5px] text-[#C9D2E0]">{numero(escala2) || 100}%</span>
        </div>
      )}

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

      <Seccion titulo="Ícono" nota="Va a la izquierda del texto.">
        <div className="grid grid-cols-5 gap-1.5">
          {[{ id: "" as const, nombre: "Ninguno", simbolo: "—" }, ...ICONOS_TEXTURA].map((i) => (
            <button
              key={i.id || "ninguno"}
              type="button"
              title={i.nombre}
              aria-label={i.nombre}
              aria-pressed={icono === i.id}
              onClick={() => setIcono(i.id)}
              className={`h-10 rounded-[8px] text-[17px] ${icono === i.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}
            >
              {i.simbolo}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Tu logo" nota="PNG, JPG o SVG, de preferencia oscuro sobre fondo claro. Queda en relieve (3D) o grabado (láser), a la izquierda del texto.">
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-[8px] bg-[#1C2431] px-3 py-2 text-[12.5px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
            {leyendoLogo ? "Leyendo…" : logo ? "Cambiar logo" : "Subir logo"}
            <input type="file" accept={TIPOS_LOGO} className="hidden" onChange={(e) => subirLogo(e.target.files?.[0])} data-testid="logo-llavero" />
          </label>
          {logo && (
            <>
              <span className="max-w-[150px] truncate text-[12px] text-[#8A97AB]">{logoNombre}</span>
              <button type="button" onClick={() => { setLogo(null); setLogoNombre("") }} className="text-[12px] font-semibold text-[#F2A36B] underline">
                <T>Quitar</T>
              </button>
            </>
          )}
        </div>
        {logoAviso && <Aviso tipo="error">{logoAviso}</Aviso>}
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
            <T>El llavero mide</T> {r1(r!.ancho)} × {r1(r!.alto)} <T>mm</T>
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
      <PanelColores mc={mc} />

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
          <p className="m-0 text-[12.5px] text-[#8A97AB]"><T>Naranja: corte de la placa y agujero · Café oscuro: letras para grabar.</T></p>
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

  // Muchos nombres: uno por renglón; cada llavero lleva el nombre arriba y,
  // debajo, los demás renglones del texto actual (p. ej. el teléfono)
  const listaNombres = nombres
    .split(/\r?\n/)
    .map((n) => n.trim().slice(0, MAX_TEXTO))
    .filter(Boolean)
    .slice(0, MAX_NOMBRES)
  const zipNombres = async (tipo: "stl" | "dxf") => {
    if (!fuente || !listaNombres.length) return
    setArmandoZip(true)
    setAviso("")
    try {
      const { zipSync, strToU8 } = await import("fflate")
      const resto = texto.split("\n").slice(1).join("\n")
      const z: Record<string, Uint8Array> = {}
      const fallaron: string[] = []
      const listos: { nombre: string; x: ReturnType<typeof hacerLlavero> }[] = []
      for (const n of listaNombres) {
        const x = hacerLlavero(fuente, { ...opciones, texto: resto ? `${n}\n${resto}` : n })
        if (x.errores.length) fallaron.push(n)
        else listos.push({ nombre: n, x })
      }
      // nombres de archivo limpios y sin repetir ("ana", "ana-2"…)
      nombresDeArchivo(listos.map((l) => `llavero-${l.nombre}`), tipo).forEach((nombre, i) => {
        const { x } = listos[i]
        z[nombre] = tipo === "stl" ? new Uint8Array(mallaSTL(x.malla)) : strToU8(dibujoDXF(x.dibujo))
      })
      if (!Object.keys(z).length) throw new Error("Ningún nombre se pudo armar con esta tipografía.")
      descargar(`llaveros-hetna-${listaNombres.length}.zip`, new Blob([zipSync(z, { level: 6 }) as unknown as BlobPart], { type: "application/zip" }), "application/zip")
      if (fallaron.length) setAviso(`No se pudieron armar: ${fallaron.slice(0, 5).join(", ")}${fallaron.length > 5 ? "…" : ""} (la tipografía no tiene esas letras).`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo armar el ZIP.")
    } finally {
      setArmandoZip(false)
    }
  }

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]"><T>Escribe un texto para generar los archivos.</T></p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <h3 className="m-0 text-[18px] font-bold"><T>Archivos</T></h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]"><T>En milímetros. DXF y SVG con capa CORTE y capa GRABADO; STL con las letras en relieve.</T></p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaExport titulo="Para láser" nota="Corta la placa y graba o marca las letras.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${archivo}.dxf`, dibujoDXF(r!.dibujo), "application/dxf")}>
              <T>DXF</T>
            </Boton>
            <Boton onClick={() => descargar(`${archivo}.svg`, dibujoSVG(r!.dibujo, "corte"), "image/svg+xml")}><T>SVG</T></Boton>
          </div>
        </TarjetaExport>
        <TarjetaExport titulo="Para impresión 3D" nota="Placa con el agujero y las letras en relieve.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${archivo}.stl`, mallaSTL(r!.malla), "model/stl")}>
              <T>STL</T>
            </Boton>
          </div>
        </TarjetaExport>
      </div>
      <TarjetaColores mc={mc} archivo={archivo} titulo={`Llavero ${primerRenglon}`} />
      <TarjetaExport titulo="Muchos nombres de una vez" nota={`Para eventos, escuelas o empresas: un nombre por renglón (hasta ${MAX_NOMBRES}). Cada llavero sale con la forma, la letra, el ícono y el logo de arriba.`}>
        <textarea
          value={nombres}
          onChange={(e) => setNombres(e.target.value)}
          rows={5}
          placeholder={"Ana\nLuis\nSofía"}
          className="w-full resize-y rounded-[8px] bg-[#1C2431] px-3 py-2 text-[14px] text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
          data-testid="nombres-llaveros"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Boton tipo="primario" disabled={armandoZip || !listaNombres.length} onClick={() => zipNombres("stl")}>
            {armandoZip ? "Armando…" : `ZIP con ${listaNombres.length || 0} STL`}
          </Boton>
          <Boton disabled={armandoZip || !listaNombres.length} onClick={() => zipNombres("dxf")}>{`ZIP con ${listaNombres.length || 0} DXF`}</Boton>
        </div>
      </TarjetaExport>

      <TarjetaExport titulo="Maquinar en tu láser o router" nota="Se abre en el CAM de HETNA: eliges máquina y herramienta y bajas el G-code.">
        <BotonesCam nombre={archivo} dxf={() => dibujoDXF(r!.dibujo)} stl={() => mallaSTL(r!.malla)} />
      </TarjetaExport>

      <TarjetaExport titulo="¿Cuánto cuesta?" nota={`Precio para ${piezas} ${piezas === 1 ? "pieza" : "piezas"}, al instante en el Cotizador.`}>
        <div className="flex gap-2">
          <Boton
            tipo="verde"
            onClick={() => {
              if (!mandarACotizador(`${archivo}.dxf`, dibujoDXF(r!.dibujo), locale, { origen: "Llaveros", servicio: "laser_co2", cantidad: piezas, opciones: { materialLaser: materialLaserPorEspesor(numero(grosor) || 3) } }))
                setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.")
            }}
          >
            <T>Cotizador</T>
          </Boton>
        </div>
      </TarjetaExport>

      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold"><T>¿No tienes máquina?</T></span>
        <span className="text-[13px] text-[#F2D29B]"><T>Un taller de HETNA los corta o los imprime y te los envía.</T></span>
        <div className="flex gap-2">
          <Boton tipo="primario" onClick={() => fabricar("Corte láser")}>
            <T>Cortar en láser</T>
          </Boton>
          <Boton tipo="primario" onClick={() => fabricar("Impresión 3D")}>
            <T>Imprimir en 3D</T>
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
      colores={mc.vista}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={[]}
      barra={listo ? <span>· {r1(r!.ancho)} × {r1(r!.alto)} <T>mm ·</T> {formaNombre}</span> : null}
    />
  )
}
