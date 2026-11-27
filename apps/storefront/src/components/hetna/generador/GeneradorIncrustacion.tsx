"use client"

// Incrustaciones (2D Studio · Letreros y placas): de un texto o un dibujo,
// el bolsillo (hembra) y la pieza que entra (macho), compensados por la fresa.
// Motor: lib/generador/letreros2d.ts.
import { T } from "@/components/hetna/i18n/Idioma"
import { useMemo, useState } from "react"

import { CampoNum, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { FUENTES } from "@/lib/generador/fuentes"
import { OPCIONES_INCRUSTACION as FABRICA, hacerIncrustacion, textoAForma } from "@/lib/generador/letreros2d"
import { type P, leerDXF, leerSVG } from "@/lib/generador/vectores"

import { useFuente } from "./useFuente"

const campo = "w-full rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[15px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
const FRESAS = [
  { nombre: "Láser (sin fresa)", d: 0 },
  { nombre: '1/16" (1.6 mm)', d: 1.5875 },
  { nombre: '1/8" (3.2 mm)', d: 3.175 },
  { nombre: '1/4" (6.35 mm)', d: 6.35 },
]

export function GeneradorIncrustacion({ cabecera }: { cabecera?: React.ReactNode }) {
  const [texto, setTexto] = useState("HETNA")
  const [alto, setAlto] = useState("60")
  const [letra, setLetra] = useState("montserrat")
  const [fresa, setFresa] = useState(String(FABRICA.fresa))
  const [holgura, setHolgura] = useState(String(FABRICA.holgura))
  const [profundidad, setProfundidad] = useState(String(FABRICA.profundidad))
  const [dibujo, setDibujo] = useState<{ nombre: string; forma: P[][] } | null>(null)
  const [errorArchivo, setErrorArchivo] = useState("")
  const { fuente, error } = useFuente(letra, !dibujo)

  const forma = useMemo(() => (dibujo ? dibujo.forma : fuente && texto.trim() ? textoAForma(fuente, texto.trim(), Math.min(1000, Math.max(5, numero(alto) || 60))) : []), [dibujo, fuente, texto, alto])
  const r = useMemo(() => {
    try {
      return hacerIncrustacion(forma, { fresa: Math.min(25, Math.max(0, numero(fresa) || 0)), holgura: numero(holgura) || 0, profundidad: numero(profundidad) || FABRICA.profundidad })
    } catch {
      // p. ej. un dibujo subido con coordenadas fuera de rango
      return { dibujo: { trazos: [], avisos: [], unidades: "mm" }, ancho: 0, alto: 0, avisos: [], errores: ["No se pudo armar la incrustación con ese dibujo: revisa que esté en milímetros y no sea enorme."] }
    }
  }, [forma, fresa, holgura, profundidad])

  const subir = async (f: File | undefined) => {
    setErrorArchivo("")
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return setErrorArchivo("El archivo pesa más de 5 MB.")
    try {
      const t = await f.text()
      const d = /\.dxf$/i.test(f.name) ? leerDXF(t) : leerSVG(t)
      const cerrados = d.trazos.filter((x) => x.cerrado && x.pts.length >= 3).map((x) => x.pts)
      if (!cerrados.length) return setErrorArchivo("El dibujo no tiene contornos cerrados.")
      setDibujo({ nombre: f.name, forma: cerrados })
    } catch {
      setErrorArchivo("No se pudo leer el archivo. Sube un SVG o DXF.")
    }
  }

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      {dibujo ? (
        <Seccion titulo="Dibujo">
          <span className="text-[13px] text-[#C9D2E0]">{dibujo.nombre}</span>
          <button type="button" onClick={() => setDibujo(null)} className="self-start text-[12.5px] font-semibold text-[#F28A3C] underline">
            Usar un texto
          </button>
        </Seccion>
      ) : (
        <>
          <Seccion titulo="Texto">
            <input value={texto} maxLength={40} onChange={(e) => setTexto(e.target.value)} className={campo} />
          </Seccion>
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Alto de letra" valor={alto} cambiar={setAlto} />
            <Seccion titulo="Letra">
              <select value={letra} onChange={(e) => setLetra(e.target.value)} className="rounded-[8px] bg-[#1C2431] px-2 py-2 text-[13px] text-white">
                {FUENTES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </Seccion>
          </div>
          <label className="flex flex-col gap-1 text-[12.5px] text-[#C9D2E0]">
            O sube tu dibujo (SVG o DXF con contornos cerrados)
            <input type="file" accept=".svg,.dxf" onChange={(e) => subir(e.target.files?.[0])} className="text-[12px]" />
          </label>
        </>
      )}
      <Seccion titulo="Fresa" nota="La misma para el bolsillo y para la pieza.">
        <div className="grid grid-cols-2 gap-1.5">
          {FRESAS.map((f) => (
            <button
              key={f.nombre}
              type="button"
              aria-pressed={Math.abs((numero(fresa) || 0) - f.d) < 0.01}
              onClick={() => setFresa(String(f.d))}
              className={`rounded-[8px] px-2 py-1.5 text-[12px] font-semibold ${Math.abs((numero(fresa) || 0) - f.d) < 0.01 ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#232D3D]"}`}
            >
              {f.nombre}
            </button>
          ))}
        </div>
      </Seccion>
      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Holgura por lado" valor={holgura} cambiar={setHolgura} />
        <CampoNum etiqueta="Profundidad del bolsillo" valor={profundidad} cambiar={setProfundidad} />
      </div>
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">
        A la izquierda el bolsillo (vacíalo {numero(profundidad) || FABRICA.profundidad} mm en la madera base); a la derecha la pieza que entra (córtala por fuera en la madera de contraste, de {(numero(profundidad) || FABRICA.profundidad) + 1} mm o más, y lija al ras después de pegar).
      </span>
      {(errorArchivo || error) && <span className="text-[12px] text-[#F6B8AE]"><T>{errorArchivo || "No se pudo cargar la letra. Revisa tu conexión."}</T></span>}
    </div>
  )

  return (
    <Estudio2D
      titulo="Incrustaciones"
      acento="2D"
      subtitulo="Bolsillo y pieza que encajan"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="2" y="6" width="9" height="12" rx="1" />
          <path d="M14 9h7v6h-7z" />
        </svg>
      }
      panel={panel}
      dibujo={r.errores.length ? null : r.dibujo}
      avisos={[...r.errores, ...r.avisos]}
      archivo={`incrustacion-${(dibujo?.nombre.replace(/\.[a-z]+$/i, "") || texto).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "hetna"}`}
      pieza={`Incrustación (bolsillo y pieza) de ${Math.round(r.ancho)} × ${Math.round(r.alto)} mm`}
      material="Dos maderas de contraste (p. ej. nogal y maple)"
      vacio={dibujo || fuente ? "Escribe un texto o sube un dibujo." : "Cargando la letra…"}
    />
  )
}
