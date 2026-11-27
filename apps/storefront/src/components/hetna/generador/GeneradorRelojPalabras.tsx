"use client"

// Reloj de palabras (2D Studio · Decoración). Motor: lib/generador/relojPalabras.ts.
import { useEffect, useMemo, useState } from "react"

import { Boton, CampoNum, Seccion, descargar, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { contextoMDF, precioMDF } from "@/lib/generador/aCotizador"
import { largoCorte } from "@/lib/generador/geo2d"
import { CUADRICULA, celdasDe, hacerRelojPalabras, palabrasDeLaHora } from "@/lib/generador/relojPalabras"

import { useFuente } from "./useFuente"

export function GeneradorRelojPalabras({ cabecera }: { cabecera?: React.ReactNode }) {
  const [lado, setLado] = useState("300")
  const [margen, setMargen] = useState("30")
  const [letra, setLetra] = useState("60")
  const [ahora, setAhora] = useState<Date | null>(null)
  useEffect(() => {
    setAhora(new Date())
    const t = setInterval(() => setAhora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  const { texto } = useFuente("stardos-stencil")
  const r = useMemo(() => hacerRelojPalabras({ lado: numero(lado), margen: numero(margen), letra: numero(letra) }, texto ? (c, alto) => texto(c, alto, "corte") : null), [lado, margen, letra, texto])
  const encendidas = useMemo(() => new Set(ahora ? celdasDe(palabrasDeLaHora(ahora.getHours(), ahora.getMinutes())).map(([f, c]) => `${f}-${c}`) : []), [ahora])

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      <Seccion titulo="Así se ve ahorita" nota="Se prenden las palabras de la hora, cada 5 minutos.">
        <div className="grid gap-[2px] rounded-[8px] bg-black p-2 font-mono text-[11px] font-bold" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          {CUADRICULA.flatMap((renglon, f) =>
            [...renglon].map((c, k) => (
              <span key={`${f}-${k}`} className={`text-center ${encendidas.has(`${f}-${k}`) ? "text-[#FFD9A8]" : "text-[#2B3240]"}`}>
                {c}
              </span>
            )),
          )}
        </div>
      </Seccion>
      <div className="grid grid-cols-3 gap-2">
        <CampoNum etiqueta="Lado" valor={lado} cambiar={setLado} />
        <CampoNum etiqueta="Margen" valor={margen} cambiar={setMargen} />
        <CampoNum etiqueta="Letra" valor={letra} cambiar={setLetra} sufijo="%" />
      </div>
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">
        Salen 3 capas: el frente con las letras caladas (letra esténcil), la rejilla que separa la luz de cada letra (córtala en MDF de 6 a 9 mm) y el fondo para pegar una tira de LEDs direccionables (WS2812) por letra. Detrás del frente pon papel albanene o acrílico opalino.
      </span>
      <Boton onClick={() => descargar("reloj-palabras-leds.csv", "﻿" + r.tabla.join("\r\n"), "text/csv")}>Bajar la tabla de LEDs (CSV)</Boton>
    </div>
  )

  // precio aprox.: 3 placas de L × L en láser (MDF de 3 mm de referencia; la rejilla gruesa sube un poco)
  const L = r.alto
  const corte = r.dibujo.trazos.filter((t) => t.capa === "corte")
  const pedidoPrecio = texto && corte.length ? { ...precioMDF("laser", 3), anchoMm: L, largoMm: L, cantidad: 3, corte_mm: largoCorte(corte) / 3, perforaciones: Math.round(corte.length / 3) } : undefined

  return (
    <Estudio2D
      titulo="Reloj de palabras"
      acento="2D"
      subtitulo="La hora escrita con letras que se iluminan"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 8h4M13 8h4M7 12h10M7 16h6" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`reloj-palabras-${Math.round(numero(lado) || 300)}mm-hetna`}
      pieza={`Reloj de palabras de ${Math.round(numero(lado) || 300)} mm (frente, rejilla y fondo)`}
      material="MDF de 3 mm (frente y fondo) y de 6 a 9 mm (rejilla)"
      precio={pedidoPrecio}
      cotizar={pedidoPrecio ? { ...contextoMDF("laser", 3), nota: `Reloj de palabras de ${Math.round(L)} mm: 3 placas (frente con letras caladas, rejilla de 6 a 9 mm y fondo). Sin electrónica.` } : undefined}
      vacio="Cargando la letra…"
    />
  )
}
