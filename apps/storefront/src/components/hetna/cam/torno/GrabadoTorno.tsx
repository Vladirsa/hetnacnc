"use client"

// Grabado 2D (DXF o SVG) y relieve 3D (STL) envueltos sobre la pieza ya
// torneada. Aquí sólo se lee el archivo y se capturan las medidas; el programa
// lo arma el servidor (lib/torno/gcode.ts, etapas 6 y 7).
//
// El archivo se lee en el navegador y se manda ya reducido: los trazos
// normalizados de 0 a 1, o una cuadrícula de alturas de 0 a 255.
import { useState } from "react"

import { leerDXF, leerSTL, leerSVG } from "@/lib/generador/vectores"
import type { Grabado, Relieve } from "@/lib/torno/pieza"

const campo = "w-full rounded-[8px] border border-[#E7E4DC] bg-white px-3 py-2 text-[14px] text-[#1B1B18] focus:border-[#C2560A] focus:outline-none"
const etiqueta = "flex flex-col gap-1 text-[13px] font-medium text-[#4A4943]"
const MAX_PUNTOS = 30_000
const LADO_RELIEVE = 220

type Props = {
  grabado: Grabado
  relieve: Relieve
  cambiarGrabado: (c: Partial<Grabado>) => void
  cambiarRelieve: (c: Partial<Relieve>) => void
  largoPieza: number
  /** Radio de la pieza a la altura y (mm) */
  radioEnY: (y: number) => number
}

function Num({ texto, valor, onChange, min, paso = 0.5 }: { texto: string; valor: number; onChange: (n: number) => void; min?: number; paso?: number }) {
  return (
    <label className={etiqueta}>
      {texto}
      <input type="number" className={campo} value={Number.isFinite(valor) ? valor : ""} min={min} step={paso} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

/** Arco (grados) con el que un dibujo de proporción alto/ancho no se deforma sobre un radio r. */
const arcoProporcional = (largo: number, altoEntreAncho: number, r: number) =>
  Math.min(360, Math.max(5, Math.round(((largo * altoEntreAncho) / Math.max(r, 1)) * (180 / Math.PI))))

/** Trazos de un DXF o SVG, normalizados de 0 a 1 en los dos ejes. */
function leerDibujo(nombre: string, texto: string): { trazos: [number, number][][]; proporcion: number } {
  const d = nombre.toLowerCase().endsWith(".svg") ? leerSVG(texto) : leerDXF(texto)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, puntos = 0
  for (const t of d.trazos)
    for (const [x, y] of t.pts) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
      puntos++
    }
  const w = x1 - x0, h = y1 - y0
  if (!puntos || !(w > 0) || !(h > 0)) throw new Error("El archivo no trae líneas que se puedan grabar.")
  if (puntos > MAX_PUNTOS) throw new Error("El dibujo tiene demasiado detalle. Simplifícalo o usa uno con menos curvas.")
  const trazos = d.trazos
    .filter((t) => t.pts.length >= 2)
    .map((t) => {
      const pts = t.pts.map(([x, y]) => [Math.round(((x - x0) / w) * 1e4) / 1e4, Math.round(((y - y0) / h) * 1e4) / 1e4] as [number, number])
      if (t.cerrado) pts.push(pts[0])
      return pts
    })
  return { trazos, proporcion: h / w }
}

/** Cuadrícula de alturas de un STL visto desde arriba: X a lo largo de la pieza, Y alrededor, Z la altura. */
function leerRelieve(buf: ArrayBuffer): { nx: number; ny: number; alturas: number[]; proporcion: number } {
  const { tris } = leerSTL(buf)
  if (tris.length < 9) throw new Error("El STL no trae triángulos.")
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  for (let i = 0; i < tris.length; i += 3) {
    x0 = Math.min(x0, tris[i]); x1 = Math.max(x1, tris[i])
    y0 = Math.min(y0, tris[i + 1]); y1 = Math.max(y1, tris[i + 1])
    z0 = Math.min(z0, tris[i + 2]); z1 = Math.max(z1, tris[i + 2])
  }
  const w = x1 - x0, h = y1 - y0, alto = z1 - z0
  if (!(w > 0) || !(h > 0) || !(alto > 0)) throw new Error("El modelo es plano: no hay relieve que tallar.")
  const nx = w >= h ? LADO_RELIEVE : Math.max(2, Math.round((LADO_RELIEVE * w) / h))
  const ny = w >= h ? Math.max(2, Math.round((LADO_RELIEVE * h) / w)) : LADO_RELIEVE
  const z = new Float32Array(nx * ny).fill(z0)
  const sx = (nx - 1) / w, sy = (ny - 1) / h
  for (let t = 0; t < tris.length; t += 9) {
    const ax = (tris[t] - x0) * sx, ay = (tris[t + 1] - y0) * sy, az = tris[t + 2]
    const bx = (tris[t + 3] - x0) * sx, by = (tris[t + 4] - y0) * sy, bz = tris[t + 5]
    const cx = (tris[t + 6] - x0) * sx, cy = (tris[t + 7] - y0) * sy, cz = tris[t + 8]
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if (Math.abs(det) < 1e-12) continue
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(nx - 1, Math.ceil(Math.max(ax, bx, cx)))
    const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(ny - 1, Math.ceil(Math.max(ay, by, cy)))
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const u = ((by - cy) * (i - cx) + (cx - bx) * (j - cy)) / det
        const v = ((cy - ay) * (i - cx) + (ax - cx) * (j - cy)) / det
        const k = 1 - u - v
        if (u < -0.02 || v < -0.02 || k < -0.02) continue
        const zz = u * az + v * bz + k * cz
        if (zz > z[j * nx + i]) z[j * nx + i] = zz
      }
  }
  const alturas = Array.from(z, (v) => Math.round((255 * (v - z0)) / alto))
  return { nx, ny, alturas, proporcion: h / w }
}

export function GrabadoTorno({ grabado, relieve, cambiarGrabado, cambiarRelieve, largoPieza, radioEnY }: Props) {
  const [aviso, setAviso] = useState<{ que: "grabado" | "relieve"; texto: string } | null>(null)
  const [propGrabado, setPropGrabado] = useState(1)
  const [propRelieve, setPropRelieve] = useState(1)
  const rEn = (yDesde: number, largo: number) => radioEnY(Math.min(largoPieza, Math.max(0, yDesde + largo / 2)))

  const subirDibujo = async (f: File | undefined) => {
    if (!f) return
    setAviso(null)
    try {
      if (f.size > 4 * 1024 * 1024) throw new Error("El archivo pasa de 4 MB.")
      const { trazos, proporcion } = leerDibujo(f.name, await f.text())
      setPropGrabado(proporcion)
      cambiarGrabado({ trazos, arco: arcoProporcional(grabado.largo, proporcion, rEn(grabado.yDesde, grabado.largo)) })
    } catch (e) {
      setAviso({ que: "grabado", texto: e instanceof Error ? e.message : "No pude leer el archivo. Sube un DXF o un SVG." })
    }
  }
  const subirModelo = async (f: File | undefined) => {
    if (!f) return
    setAviso(null)
    try {
      if (f.size > 40 * 1024 * 1024) throw new Error("El archivo pasa de 40 MB.")
      const r = leerRelieve(await f.arrayBuffer())
      setPropRelieve(r.proporcion)
      cambiarRelieve({ nx: r.nx, ny: r.ny, alturas: r.alturas, arco: arcoProporcional(relieve.largo, r.proporcion, rEn(relieve.yDesde, relieve.largo)) })
    } catch (e) {
      setAviso({ que: "relieve", texto: e instanceof Error ? e.message : "No pude leer el archivo. Sube un STL." })
    }
  }

  const zona = (v: Grabado | Relieve, cambiar: (c: Partial<Grabado & Relieve>) => void, prop: number) => (
    <>
      <Num texto="Empieza en (mm)" valor={v.yDesde} min={0} onChange={(n) => cambiar({ yDesde: n })} />
      <Num texto="Largo sobre la pieza (mm)" valor={v.largo} min={5} onChange={(n) => cambiar({ largo: n })} />
      <Num texto="Abarca (grados de la vuelta)" valor={v.arco} min={5} paso={1} onChange={(n) => cambiar({ arco: n })} />
      <Num texto="Ángulo donde empieza" valor={v.anguloInicio} paso={5} onChange={(n) => cambiar({ anguloInicio: n })} />
      <Num texto="Profundidad (mm)" valor={v.profundidad} min={0.2} paso={0.1} onChange={(n) => cambiar({ profundidad: n })} />
      <button type="button" onClick={() => cambiar({ arco: arcoProporcional(v.largo, prop, rEn(v.yDesde, v.largo)) })} className="self-end rounded-[8px] border border-[#C9C4B8] bg-white px-3 py-2 text-[13px] font-semibold text-[#1B1B18] hover:border-[#C2560A]">
        Ajustar los grados a la proporción
      </button>
    </>
  )

  return (
    <>
      <div className="mt-3 rounded-[10px] border border-[#E7E4DC] p-3">
        <label className="flex items-center gap-2 text-[14px] font-semibold text-[#1B1B18]">
          <input type="checkbox" checked={grabado.activo} onChange={(e) => cambiarGrabado({ activo: e.target.checked })} className="h-4 w-4 accent-[#C2560A]" />
          Grabado 2D sobre la pieza (DXF o SVG)
          <span className="rounded-full bg-[#FDEEE1] px-2 py-0.5 text-[11px] font-bold text-[#B34D07]">Plan Pro</span>
        </label>
        {grabado.activo && (
          <>
            <p className="mt-2 text-[12.5px] leading-snug text-[#6B6A63]">
              El dibujo se enrolla sobre la pieza terminada: su ancho va a lo largo y su alto alrededor. La fresa sigue las líneas a la profundidad que indiques; para letras y adornos usa fresa en V o de bola delgada.
            </p>
            <input type="file" accept=".dxf,.svg" onChange={(e) => subirDibujo(e.target.files?.[0])} className="mt-2 text-[13px] text-[#4A4943] file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#142033] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white" />
            {grabado.trazos.length > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <svg viewBox="-0.03 -0.03 1.06 1.06" preserveAspectRatio="none" className="h-20 w-40 rounded-[8px] border border-[#E7E4DC] bg-[#FAF9F6]" aria-label="Dibujo que se va a grabar">
                  {grabado.trazos.map((t, i) => (
                    <polyline key={i} points={t.map(([x, y]) => `${x},${1 - y}`).join(" ")} fill="none" stroke="#C2560A" strokeWidth={0.012} />
                  ))}
                </svg>
                <span className="text-[12.5px] text-[#4A4943]">{grabado.trazos.length.toLocaleString("es-MX")} trazos listos para grabar.</span>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{zona(grabado, cambiarGrabado, propGrabado)}</div>
            <label className="mt-2 flex items-center gap-2 text-[13px] text-[#4A4943]">
              <input type="checkbox" checked={grabado.espejo} onChange={(e) => cambiarGrabado({ espejo: e.target.checked })} className="h-4 w-4 accent-[#C2560A]" />
              Voltear alrededor (si en tu máquina el texto sale al revés)
            </label>
            {aviso?.que === "grabado" && <p className="mt-2 rounded-[8px] bg-[#FDECEC] px-3 py-2 text-[13px] text-[#9B1C1C]">{aviso.texto}</p>}
          </>
        )}
      </div>

      <div className="mt-3 rounded-[10px] border border-[#E7E4DC] p-3">
        <label className="flex items-center gap-2 text-[14px] font-semibold text-[#1B1B18]">
          <input type="checkbox" checked={relieve.activo} onChange={(e) => cambiarRelieve({ activo: e.target.checked })} className="h-4 w-4 accent-[#C2560A]" />
          Relieve 3D sobre la pieza (STL)
          <span className="rounded-full bg-[#FDEEE1] px-2 py-0.5 text-[11px] font-bold text-[#B34D07]">Plan Pro</span>
        </label>
        {relieve.activo && (
          <>
            <p className="mt-2 text-[12.5px] leading-snug text-[#6B6A63]">
              Sube un relieve visto desde arriba (X a lo largo, Y alrededor, Z la altura). Lo más alto queda a ras de la pieza y el fondo baja la profundidad que indiques. Usa fresa de bola.
            </p>
            <input type="file" accept=".stl" onChange={(e) => subirModelo(e.target.files?.[0])} className="mt-2 text-[13px] text-[#4A4943] file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#142033] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white" />
            {relieve.nx > 0 && <p className="mt-2 text-[12.5px] text-[#4A4943]">Relieve leído: cuadrícula de {relieve.nx} × {relieve.ny} puntos.</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {zona(relieve, cambiarRelieve, propRelieve)}
              <Num texto="Separación entre pasadas (mm)" valor={relieve.paso} min={0.2} paso={0.1} onChange={(n) => cambiarRelieve({ paso: n })} />
            </div>
            {aviso?.que === "relieve" && <p className="mt-2 rounded-[8px] bg-[#FDECEC] px-3 py-2 text-[13px] text-[#9B1C1C]">{aviso.texto}</p>}
          </>
        )}
      </div>
    </>
  )
}
