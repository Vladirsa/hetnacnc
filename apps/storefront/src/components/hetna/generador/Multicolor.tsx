"use client"

// Piezas de varios colores en las herramientas de impresión 3D: el interruptor
// y la paleta por parte (panel), la vista pintada y los archivos (3MF y un ZIP
// con un STL por color). El motor de cada herramienta da las partes con nombre
// (lib/generador/vectores: conPartes); los archivos se arman en lib/generador/multicolor.
import { useState } from "react"

import { Boton, Interruptor, Seccion, TarjetaExport, descargar } from "@/components/hetna/estudio3d/Controles"
import { PALETA, type TramoColor, archivo3MF, colorPorId, coloresIniciales, partesConColor, zipPorColor } from "@/lib/generador/multicolor"
import type { Malla } from "@/lib/generador/vectores"

export type EstadoMulticolor = ReturnType<typeof useMulticolor>

/** Colores elegidos por nombre de parte: si cambia el texto, la placa sigue del mismo color. */
export function useMulticolor(malla: Malla | null | undefined) {
  const [activo, setActivo] = useState(false)
  const [elegidos, setElegidos] = useState<Record<string, string>>({})
  const lista = malla?.partes || []
  const iniciales = coloresIniciales(lista.length)
  const colores = lista.map((p, i) => elegidos[p.nombre] || iniciales[i])
  const disponible = lista.length > 1
  return {
    activo: activo && disponible,
    setActivo,
    disponible,
    malla: malla || null,
    partes: lista,
    colores,
    cambiar: (nombre: string, id: string) => setElegidos((e) => ({ ...e, [nombre]: id })),
    /** para Estudio3D (prop `colores`): sólo con el interruptor prendido */
    vista: activo && disponible ? lista.map((p, i): TramoColor => ({ triangulos: p.triangulos, hex: colorPorId(colores[i]).hex })) : undefined,
  }
}

/** Interruptor y un renglón de colores por parte (va en el panel de la herramienta). */
export function PanelColores({ mc }: { mc: EstadoMulticolor }) {
  if (!mc.disponible) return null
  return (
    <Seccion titulo="Colores" nota={mc.activo ? "Para impresoras de varios colores (AMS, MMU) o para cambiar el filamento a mano." : undefined}>
      <Interruptor etiqueta="Varios colores" activo={mc.activo} cambiar={mc.setActivo} />
      {mc.activo &&
        mc.partes.map((p, i) => (
          <div key={p.nombre} className="flex flex-col gap-1">
            <span className="text-[12.5px] text-[#C9D2E0]">
              {p.nombre}: <b className="text-white">{colorPorId(mc.colores[i]).nombre}</b>
            </span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Color de ${p.nombre}`}>
              {PALETA.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={mc.colores[i] === c.id}
                  aria-label={c.nombre}
                  title={c.nombre}
                  onClick={() => mc.cambiar(p.nombre, c.id)}
                  className={`h-6 w-6 rounded-full border ${mc.colores[i] === c.id ? "ring-2 ring-[#C2560A] ring-offset-2 ring-offset-[#121925]" : ""} border-white/25`}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>
        ))}
    </Seccion>
  )
}

/** Tarjeta de descarga para impresoras de varios colores (va en la pestaña Exportación). */
export function TarjetaColores({ mc, archivo, titulo, nota }: { mc: EstadoMulticolor; archivo: string; titulo: string; nota?: string }) {
  const malla = mc.malla
  if (!mc.disponible || !malla) return null
  const partes = () => partesConColor(malla, mc.colores)
  const resumen = mc.partes.map((p, i) => `${p.nombre} (${colorPorId(mc.colores[i]).nombre.toLowerCase()})`).join(", ")
  return (
    <TarjetaExport
      titulo="Para impresora de varios colores"
      nota={`${nota ? `${nota} ` : ""}${resumen}. El 3MF abre como una pieza con sus partes: a cada una le asignas su filamento. Si tu slicer no lo abre, usa los STL por color.`}
    >
      <div className="flex gap-2">
        <Boton tipo="primario" onClick={() => descargar(`${archivo}-colores.3mf`, new Blob([archivo3MF(partes(), titulo) as BlobPart], { type: "model/3mf" }), "model/3mf")}>
          3MF
        </Boton>
        <Boton onClick={() => descargar(`${archivo}-por-color.zip`, new Blob([zipPorColor(partes(), archivo) as BlobPart], { type: "application/zip" }), "application/zip")}>
          STL por color (ZIP)
        </Boton>
      </div>
    </TarjetaExport>
  )
}
