"use client"

// Organizador de herramientas desde una foto (2D Studio · Imagen). La foto no
// sale de tu equipo: todo se calcula en el navegador. Motor: lib/generador/organizadorFoto.ts.
import { useMemo, useState } from "react"

import { Aviso, Boton, CampoNum, Interruptor, Seccion, TarjetaExport, descargar, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { HOJAS, OPCIONES_ORGANIZADOR as FABRICA, type TipoHoja, contornosHerramientas, encontrarHoja, enderezar, hacerOrganizador } from "@/lib/generador/organizadorFoto"
import { gris } from "@/lib/generador/trazado"
import { mallaSTL } from "@/lib/generador/vectores"

import { useImagenSubida } from "./useImagenSubida"

const PXMM = 2.5 // resolución de la hoja enderezada (píxeles por mm)

export function GeneradorOrganizadorFoto({ cabecera }: { cabecera?: React.ReactNode }) {
  const { subida, error, abrir } = useImagenSubida(1600)
  const [hoja, setHoja] = useState<TipoHoja>("carta")
  const [holgura, setHolgura] = useState(String(FABRICA.holgura))
  const [margen, setMargen] = useState(String(FABRICA.margen))
  const [grosor, setGrosor] = useState(String(FABRICA.grosor))
  const [profundidad, setProfundidad] = useState(String(FABRICA.profundidad))
  const [dedos, setDedos] = useState(FABRICA.dedos)

  // la parte pesada (encontrar la hoja y enderezarla) sólo cambia con la foto o la hoja
  const herramientas = useMemo(() => {
    if (!subida) return null
    const g = gris(subida.im)
    const esquinas = encontrarHoja(g, subida.im.width, subida.im.height)
    if (!esquinas) return { error: "No encontramos la hoja en la foto: que se vea completa, blanca, sobre una mesa más oscura.", contornos: [] }
    const r = enderezar(g, subida.im.width, subida.im.height, esquinas, hoja, PXMM)
    return { error: "", contornos: contornosHerramientas(r.gris, r.w, r.h, PXMM) }
  }, [subida, hoja])
  const r = useMemo(
    () => (herramientas && !herramientas.error ? hacerOrganizador(herramientas.contornos, { holgura: numero(holgura) || 0, margen: numero(margen) || FABRICA.margen, grosor: numero(grosor) || FABRICA.grosor, profundidad: numero(profundidad) || FABRICA.profundidad, dedos }) : null),
    [herramientas, holgura, margen, grosor, profundidad, dedos],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      <Seccion titulo="1. La foto" nota="Pon las herramientas sobre una hoja blanca, la hoja sobre una mesa oscura, y toma la foto desde arriba, derecho y con buena luz (sin flash). La hoja da la medida.">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => abrir(e.target.files?.[0])} className="text-[12.5px] text-[#C9D2E0]" />
        {subida && <img src={subida.url} alt="Tu foto" className="mt-1 max-h-[140px] w-auto self-start rounded-[6px]" />}
      </Seccion>
      <Seccion titulo="Tamaño de la hoja">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(HOJAS) as TipoHoja[]).map((k) => (
            <button key={k} type="button" aria-pressed={hoja === k} onClick={() => setHoja(k)} className={`rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold ${hoja === k ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0]"}`}>
              {HOJAS[k].nombre}
            </button>
          ))}
        </div>
      </Seccion>
      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Holgura" valor={holgura} cambiar={setHolgura} />
        <CampoNum etiqueta="Margen" valor={margen} cambiar={setMargen} />
        <CampoNum etiqueta="Grosor del inserto" valor={grosor} cambiar={setGrosor} />
        <CampoNum etiqueta="Profundidad (3D)" valor={profundidad} cambiar={setProfundidad} />
      </div>
      <Interruptor etiqueta="Hueco para los dedos" activo={dedos} cambiar={setDedos} />
      {(error || herramientas?.error) && <Aviso tipo="error">{error || herramientas!.error}</Aviso>}
      {r && !r.errores.length && <span className="text-[12px] text-[#F2D29B]">{r.piezas} {r.piezas === 1 ? "herramienta" : "herramientas"} · inserto de {Math.round(r.ancho)} × {Math.round(r.alto)} mm</span>}
      {r && !r.errores.length && (
        <TarjetaExport titulo="Para impresora 3D (STL)" nota="Placa con los huecos a la profundidad que pusiste.">
          <Boton onClick={() => descargar("organizador-herramientas-hetna.stl", mallaSTL(r.malla), "model/stl")}>STL</Boton>
        </TarjetaExport>
      )}
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">Para espuma: corta los huecos de lado a lado en una capa y pégala sobre otra sin huecos. Para router: vacía los huecos a la profundidad en MDF o triplay.</span>
    </div>
  )

  return (
    <Estudio2D
      titulo="Organizador desde foto"
      acento="2D"
      subtitulo="Inserto con la silueta de tus herramientas"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8v8M11 8l2 8M16 8a2 2 0 110 4 2 2 0 010-4z" />
        </svg>
      }
      panel={panel}
      dibujo={r && !r.errores.length ? r.dibujo : null}
      avisos={r ? [...r.errores, ...r.avisos] : []}
      archivo="organizador-herramientas-hetna"
      pieza={r ? `Inserto organizador de ${Math.round(r.ancho)} × ${Math.round(r.alto)} mm con ${r.piezas} huecos` : "Inserto organizador"}
      material="Espuma EVA, MDF o triplay"
      stl={() => (r && !r.errores.length ? mallaSTL(r.malla) : null)}
      vacio="Sube la foto de tus herramientas sobre una hoja."
    />
  )
}
