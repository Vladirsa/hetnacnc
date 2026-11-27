"use client"

// Cortadores de galletas dentro del 3D Studio: eliges la forma (ícono, figura
// clásica, un nombre o tu propio dibujo en SVG), la medida y, si quieres, un
// sello con texto o ícono. Sale el STL del cortador (con filo y ceja) y el del
// sello, listos para imprimir. Motor: lib/generador/cortadores.ts.
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"

import { Aviso, Boton, CampoNum, Datos, Etiqueta, Seccion, TarjetaExport, descargar, numero, r1 } from "@/components/hetna/estudio3d/Controles"
import { mandarAFabricar } from "@/lib/generador/aCotizador"
import { ErrorCortador, FORMAS_CLASICAS, type FormaClasica, type FormaCortador, hacerCortador } from "@/lib/generador/cortadores"
import { FUENTES, cargarFuente, instalarFuentesVista } from "@/lib/generador/fuentes"
import type { Fuente } from "@/lib/generador/letreros"
import { ICONOS_TEXTURA, type IconoTextura } from "@/lib/generador/texturizador"
import { type Dibujo, leerSVG, mallaSTL } from "@/lib/generador/vectores"

import { colorPorId } from "@/lib/generador/multicolor"

import { PanelColores, TarjetaColores, useMulticolor } from "./Multicolor"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })

type TipoForma = "icono" | "clasica" | "nombre" | "svg"
type TipoSello = "ninguno" | "texto" | "icono"

const botonSel = (activo: boolean) =>
  `rounded-[8px] px-1.5 py-2 text-[12px] font-semibold ${activo ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`

// La galleta como quedaría: masa clara con el sello marcado
function vistaGalleta(d: Dibujo): string {
  const pts = d.trazos.flatMap((t) => t.pts)
  if (!pts.length) return ""
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const mar = 4, W = x1 - x0 + 2 * mar, H = y1 - y0 + 2 * mar
  const ruta = (capa: string) =>
    d.trazos
      .filter((t) => t.capa === capa)
      .map((t) => t.pts.map(([x, y], i) => `${i ? "L" : "M"}${(x - x0 + mar).toFixed(2)} ${(H - mar - (y - y0)).toFixed(2)}`).join(" ") + " Z")
      .join(" ")
  // el sello va en espejo en la pieza; en la galleta se ve al derecho
  const cx = (x0 + x1) / 2 - x0 + mar
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">` +
    `<path d="${ruta("CORTE")}" fill="#E8C48E" stroke="#C2560A" stroke-width="0.6"/>` +
    `<g transform="translate(${(2 * cx).toFixed(2)} 0) scale(-1 1)"><path d="${ruta("GRABADO")}" fill="#C89A5C" fill-rule="evenodd"/></g>` +
    `</svg>`
  )
}

export function GeneradorCortadores() {
  const { locale } = useParams<{ locale: string }>()
  const [tipo, setTipo] = useState<TipoForma>("icono")
  const [icono, setIcono] = useState<IconoTextura>("corazon")
  const [clasica, setClasica] = useState<FormaClasica>("nube")
  const [nombre, setNombre] = useState("Sofía")
  const [svg, setSvg] = useState<{ nombre: string; dibujo: Dibujo } | null>(null)
  const [fuenteId, setFuenteId] = useState("pacifico")
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [tamano, setTamano] = useState("70")
  const [altura, setAltura] = useState("14")
  const [pared, setPared] = useState("1.2")
  const [ceja, setCeja] = useState("4")
  const [grosorCeja, setGrosorCeja] = useState("2")
  const [tipoSello, setTipoSello] = useState<TipoSello>("ninguno")
  const [textoSello, setTextoSello] = useState("Te amo")
  const [iconoSello, setIconoSello] = useState<IconoTextura>("estrella")
  const [relieve, setRelieve] = useState("1.5")
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    instalarFuentesVista()
    // /disenar/cortadores-galletas?forma=nube | ?icono=corazon | ?nombre=Sofia (+ &tamano=, &sello=, &selloIcono=, &fuente=)
    const q = new URLSearchParams(window.location.search)
    const f = q.get("forma"), i = q.get("icono"), n = q.get("nombre")
    if (f && FORMAS_CLASICAS.some((x) => x.id === f)) {
      setTipo("clasica")
      setClasica(f as FormaClasica)
    } else if (i && ICONOS_TEXTURA.some((x) => x.id === i)) {
      setTipo("icono")
      setIcono(i as IconoTextura)
    } else if (n) {
      setTipo("nombre")
      setNombre(n.slice(0, 14))
    }
    const t = Number(q.get("tamano"))
    if (t >= 20 && t <= 200) setTamano(String(t))
    // sello: ?sello=Te%20amo&fuente=pacifico  |  ?selloIcono=estrella
    const st = q.get("sello"), si = q.get("selloIcono"), fu = q.get("fuente")
    if (st) {
      setTipoSello("texto")
      setTextoSello(st.slice(0, 24))
    } else if (si && ICONOS_TEXTURA.some((x) => x.id === si)) {
      setTipoSello("icono")
      setIconoSello(si as IconoTextura)
    }
    if (fu && FUENTES.some((x) => x.id === fu)) setFuenteId(fu)
  }, [])

  const usaFuente = tipo === "nombre" || tipoSello === "texto"
  useEffect(() => {
    if (!usaFuente) return
    const t = FUENTES.find((x) => x.id === fuenteId)
    if (!t) return
    let vivo = true
    setCargando(true)
    setError("")
    cargarFuente(t)
      .then((f) => vivo && setFuente(f))
      .catch(() => vivo && setError("No se pudo cargar la tipografía. Revisa tu conexión e inténtalo otra vez."))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [fuenteId, usaFuente])

  const subirSvg = async (archivo: File | undefined) => {
    if (!archivo) return
    setError("")
    if (archivo.size > 5 * 1024 * 1024) return setError("El SVG es muy pesado (máximo 5 MB).")
    try {
      const dibujo = leerSVG(await archivo.text())
      if (!dibujo.trazos.length) throw new Error()
      setSvg({ nombre: archivo.name, dibujo })
      setTipo("svg")
    } catch {
      setError("No se pudo leer ese SVG. Exporta tu dibujo como SVG con la silueta como trazo cerrado.")
    }
  }

  const forma: FormaCortador | null =
    tipo === "icono" ? { tipo: "icono", icono } : tipo === "clasica" ? { tipo: "clasica", forma: clasica } : tipo === "nombre" ? { tipo: "nombre", texto: nombre } : svg ? { tipo: "svg", dibujo: svg.dibujo } : null

  const r = useMemo(() => {
    if (!forma) return null
    try {
      return hacerCortador(forma, usaFuente ? fuente : null, {
        tamano: numero(tamano),
        altura: numero(altura),
        pared: numero(pared),
        ceja: numero(ceja) || 0,
        grosorCeja: numero(grosorCeja),
        sello: tipoSello === "texto" ? { tipo: "texto", texto: textoSello } : tipoSello === "icono" ? { tipo: "icono", icono: iconoSello } : { tipo: "ninguno" },
        relieveSello: numero(relieve),
      })
    } catch (e) {
      if (e instanceof ErrorCortador) return null
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, icono, clasica, nombre, svg, fuente, usaFuente, tamano, altura, pared, ceja, grosorCeja, tipoSello, textoSello, iconoSello, relieve])

  const listo = !!r && !r.errores.length
  const tris = useMemo(() => (listo ? [...r!.cortador.tris, ...(r!.sello?.tris || [])] : undefined), [r, listo])
  const vista2d = useMemo(() => (listo ? vistaGalleta(r!.dibujo) : ""), [r, listo])
  // el sello puede ir en dos colores; el cortador, de uno (en la vista, naranja)
  const mc = useMulticolor(listo ? r!.sello : null)
  const coloresVista = mc.vista && listo ? [{ triangulos: r!.cortador.tris.length / 9, hex: colorPorId("naranja").hex }, ...mc.vista] : undefined
  const nombreForma =
    tipo === "icono" ? ICONOS_TEXTURA.find((i) => i.id === icono)?.nombre : tipo === "clasica" ? FORMAS_CLASICAS.find((c) => c.id === clasica)?.nombre : tipo === "nombre" ? nombre : svg?.nombre.replace(/\.svg$/i, "")
  const archivo = `cortador-galleta-${String(nombreForma || "forma")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30)
    .toLowerCase()}`
  const medidas = listo ? `${r1(r!.ancho)} × ${r1(r!.alto)} mm` : ""

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Forma">
        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              ["icono", "Íconos"],
              ["clasica", "Clásicas"],
              ["nombre", "Nombre"],
              ["svg", "Tu dibujo"],
            ] as [TipoForma, string][]
          ).map(([id, txt]) => (
            <button key={id} type="button" onClick={() => setTipo(id)} aria-pressed={tipo === id} className={botonSel(tipo === id)}>
              <T>{txt}</T>
            </button>
          ))}
        </div>
        {tipo === "icono" && (
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {ICONOS_TEXTURA.map((i) => (
              <button key={i.id} type="button" onClick={() => setIcono(i.id)} aria-pressed={icono === i.id} title={i.nombre} className={botonSel(icono === i.id)}>
                <span className="block text-[18px] leading-none"><T>{i.simbolo}</T></span>
                <span className="mt-1 block text-[10.5px]"><T>{i.nombre}</T></span>
              </button>
            ))}
          </div>
        )}
        {tipo === "clasica" && (
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {FORMAS_CLASICAS.map((c) => (
              <button key={c.id} type="button" onClick={() => setClasica(c.id)} aria-pressed={clasica === c.id} className={botonSel(clasica === c.id)}>
                <T>{c.nombre}</T>
              </button>
            ))}
          </div>
        )}
        {tipo === "nombre" && (
          <label className="mt-2 flex flex-col gap-1.5">
            <Etiqueta><T>Nombre o palabra</T></Etiqueta>
            <input
              value={nombre}
              maxLength={14}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[16px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
            />
            <span className="text-[11.5px] text-[#8A97AB]"><T>Las letras se unen en una sola galleta. Las letras cursivas quedan mejor.</T></span>
          </label>
        )}
        {tipo === "svg" && (
          <label className="mt-2 flex flex-col gap-1.5">
            <Etiqueta><T>Tu dibujo en SVG</T></Etiqueta>
            <input type="file" accept=".svg,image/svg+xml" onChange={(e) => subirSvg(e.target.files?.[0])} className="text-[13px] text-[#C9D2E0]" />
            <span className="text-[11.5px] text-[#8A97AB]">
              <T>{svg ? `Cargado: ${svg.nombre}` : "La silueta como trazo cerrado. ¿Tienes una foto?"}</T><T>{" "}</T>
              {!svg && (
                <a href={`/${locale}/disenar/vectorizador`} className="underline">
                  <T>Pásala a SVG con el vectorizador</T>
                </a>
              )}
            </span>
          </label>
        )}
      </Seccion>

      {usaFuente && (
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
                  className={`h-10 truncate rounded-[8px] px-2 text-[15px] ${fuenteId === t.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}
                >
                  <T>{t.nombre}</T>
                </button>
              ))}
            </div>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Medidas" nota="La galleta sale del tamaño de la forma: la pared va por fuera.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Tamaño de la galleta" valor={tamano} cambiar={setTamano} />
          <CampoNum etiqueta="Altura del cortador" valor={altura} cambiar={setAltura} />
          <CampoNum etiqueta="Grosor de la pared" valor={pared} cambiar={setPared} />
          <CampoNum etiqueta="Ceja (0 = sin)" valor={ceja} cambiar={setCeja} />
          {numero(ceja) > 0 && <CampoNum etiqueta="Grosor de la ceja" valor={grosorCeja} cambiar={setGrosorCeja} />}
        </div>
      </Seccion>

      <Seccion titulo="Sello (opcional)" nota="Una placa que entra en el cortador y marca la galleta. Va en espejo para que en la galleta se lea al derecho.">
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["ninguno", "Sin sello"],
              ["texto", "Texto"],
              ["icono", "Ícono"],
            ] as [TipoSello, string][]
          ).map(([id, txt]) => (
            <button key={id} type="button" onClick={() => setTipoSello(id)} aria-pressed={tipoSello === id} className={botonSel(tipoSello === id)}>
              <T>{txt}</T>
            </button>
          ))}
        </div>
        {tipoSello === "texto" && (
          <input
            value={textoSello}
            maxLength={24}
            onChange={(e) => setTextoSello(e.target.value)}
            className="mt-2 w-full rounded-[8px] bg-[#1C2431] px-3 py-2 text-[15px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
          />
        )}
        {tipoSello === "icono" && (
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {ICONOS_TEXTURA.map((i) => (
              <button key={i.id} type="button" onClick={() => setIconoSello(i.id)} aria-pressed={iconoSello === i.id} title={i.nombre} className={botonSel(iconoSello === i.id)}>
                <span className="block text-[18px] leading-none"><T>{i.simbolo}</T></span>
              </button>
            ))}
          </div>
        )}
        {tipoSello !== "ninguno" && (
          <div className="mt-2 w-1/2">
            <CampoNum etiqueta="Relieve del sello" valor={relieve} cambiar={setRelieve} />
          </div>
        )}
      </Seccion>
      <PanelColores mc={mc} />

      {error && <Aviso tipo="error"><T>{error}</T></Aviso>}
      {r?.errores.map((e) => (
        <Aviso key={e} tipo="error">
          <T>{e}</T>
        </Aviso>
      ))}
      {listo && r!.avisos.map((a) => <Aviso key={a}><T>{a}</T></Aviso>)}
    </div>
  )

  const diseno2d = (
    <div className="flex h-full flex-col gap-3 p-4">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#8A97AB]"><T>{cargando ? "Cargando tipografía…" : tipo === "svg" && !svg ? "Sube tu dibujo en SVG." : "Elige una forma."}</T></p>
      ) : (
        <>
          <Datos
            filas={[
              ["Galleta", medidas],
              ["Cortador", `${r1(numero(altura))} mm de alto · pared ${r1(numero(pared))} mm`],
              ["Ceja", numero(ceja) > 0 ? `${r1(numero(ceja))} mm` : "Sin ceja"],
              ["Sello", tipoSello === "ninguno" ? "Sin sello" : tipoSello === "texto" ? `«${textoSello}»` : ICONOS_TEXTURA.find((i) => i.id === iconoSello)?.nombre || ""],
            ]}
          />
          <div
            className="flex min-h-[300px] flex-1 items-center justify-center rounded-[10px] bg-[#0F151E] p-6 [&>svg]:max-h-[460px] [&>svg]:w-full [&>svg]:max-w-[560px]"
            dangerouslySetInnerHTML={{ __html: vista2d }}
          />
          <p className="m-0 text-[12.5px] text-[#8A97AB]"><T>Así queda la galleta (con el sello, si elegiste uno).</T></p>
        </>
      )}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]"><T>Elige una forma para generar los archivos.</T></p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <h3 className="m-0 text-[18px] font-bold"><T>Archivos</T></h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]"><T>STL en milímetros, listos para tu laminador.</T></p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaExport titulo="Cortador" nota="Imprímelo así: la ceja sobre la cama y el filo hacia arriba. Sin soportes; 2 o 3 perímetros, sin relleno.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${archivo}.stl`, mallaSTL(r!.cortador), "model/stl")}>
              <T>STL</T>
            </Boton>
          </div>
        </TarjetaExport>
        {r!.sello && (
          <TarjetaExport titulo="Sello" nota="Imprímelo con el dibujo hacia arriba. Entra en el cortador con 0.8 mm de holgura.">
            <div className="flex gap-2">
              <Boton tipo="primario" onClick={() => descargar(`${archivo}-sello.stl`, mallaSTL(r!.sello!), "model/stl")}>
                <T>STL</T>
              </Boton>
            </div>
          </TarjetaExport>
        )}
      </div>
      <TarjetaColores mc={mc} archivo={`${archivo}-sello`} titulo={`Sello ${nombreForma || ""}`.trim()} nota="El sello: la placa de un color y el dibujo de otro." />
      <Aviso>
        <T>Para masa de galleta o fondant usa un filamento que el fabricante indique como apto para contacto con alimentos, y lávalo a mano. Las capas de una
        pieza impresa guardan restos: si es para vender, imprime uno nuevo cada temporada.</T>
      </Aviso>
      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold"><T>¿No tienes impresora 3D?</T></span>
        <span className="text-[13px] text-[#F2D29B]"><T>Un taller de HETNA lo imprime y te lo envía.</T></span>
        <div className="flex gap-2">
          <Boton
            tipo="primario"
            onClick={() => {
              const ok = mandarAFabricar(`${archivo}.stl`, mallaSTL(r!.cortador), locale, {
                pieza: `Cortador de galletas «${nombreForma}»${r!.sello ? " con sello" : ""}`,
                medidas,
                proceso: "Impresión 3D",
              })
              if (!ok) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
            }}
          >
            <T>Imprimir en 3D</T>
          </Boton>
        </div>
      </div>
      {aviso && <Aviso tipo="error"><T>{aviso}</T></Aviso>}
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo={String(nombreForma || "Cortador")}
      subtitulo="Cortadores de galletas"
      materialInicial="naranja"
      tris={tris}
      colores={coloresVista}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={[]}
      barra={listo ? <span>· <T>{medidas}</T><T>{r!.sello ? " · con sello" : ""}</T></span> : null}
    />
  )
}
