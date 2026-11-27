"use client"

// Placa redonda (2D Studio · Letreros y placas): texto en arco arriba y abajo,
// monograma al centro, aro y adornos. Motor: lib/generador/letreros2d.ts.
import { useMemo, useState } from "react"

import { CampoNum, Interruptor, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { FUENTES } from "@/lib/generador/fuentes"
import { OPCIONES_PLACA_REDONDA as FABRICA, hacerPlacaRedonda } from "@/lib/generador/letreros2d"
import { ICONOS_TEXTURA, type IconoTextura } from "@/lib/generador/texturizador"

import { useFuente } from "./useFuente"

const campo = "w-full rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[15px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
const LETRAS = FUENTES.filter((f) => f.grupo !== "Cursiva")

export function GeneradorPlacaRedonda({ cabecera }: { cabecera?: React.ReactNode }) {
  const [arriba, setArriba] = useState(FABRICA.arriba)
  const [abajo, setAbajo] = useState(FABRICA.abajo)
  const [centro, setCentro] = useState(FABRICA.centro)
  const [diametro, setDiametro] = useState(String(FABRICA.diametro))
  const [borde, setBorde] = useState(FABRICA.borde)
  const [adorno, setAdorno] = useState<IconoTextura | "">(FABRICA.adorno)
  const [letra, setLetra] = useState("montserrat")
  const { fuente, error } = useFuente(letra)
  const r = useMemo(() => hacerPlacaRedonda(fuente, { arriba, abajo, centro, diametro: numero(diametro) || FABRICA.diametro, borde, adorno }), [fuente, arriba, abajo, centro, diametro, borde, adorno])

  const panel = (
    <div className="flex flex-col gap-4">
      {cabecera}
      <Seccion titulo="Texto de arriba">
        <input value={arriba} maxLength={40} onChange={(e) => setArriba(e.target.value)} className={campo} />
      </Seccion>
      <Seccion titulo="Al centro" nota="Iniciales, un monograma o un texto corto.">
        <input value={centro} maxLength={12} onChange={(e) => setCentro(e.target.value)} className={campo} />
      </Seccion>
      <Seccion titulo="Texto de abajo">
        <input value={abajo} maxLength={40} onChange={(e) => setAbajo(e.target.value)} className={campo} />
      </Seccion>
      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Diámetro" valor={diametro} cambiar={setDiametro} />
        <Seccion titulo="Adorno a los lados">
          <select value={adorno} onChange={(e) => setAdorno(e.target.value as IconoTextura | "")} className="rounded-[8px] bg-[#1C2431] px-2 py-2 text-[13px] text-white">
            <option value="">Ninguno</option>
            {ICONOS_TEXTURA.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
        </Seccion>
      </div>
      <Interruptor etiqueta="Aro grabado en la orilla" activo={borde} cambiar={setBorde} />
      <Seccion titulo="Letra">
        <select value={letra} onChange={(e) => setLetra(e.target.value)} className="rounded-[8px] bg-[#1C2431] px-2 py-2 text-[13px] text-white">
          {LETRAS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
        {error && <span className="text-[12px] text-[#F6B8AE]">No se pudo cargar la letra. Revisa tu conexión.</span>}
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Placa redonda"
      acento="2D"
      subtitulo="Texto en arco y monograma"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M6 9a7 7 0 0112 0M9 15h6" />
        </svg>
      }
      panel={panel}
      dibujo={r.errores.length ? null : r.dibujo}
      avisos={[...r.errores, ...r.avisos]}
      archivo={`placa-redonda-${(arriba || centro).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "hetna"}`}
      pieza={`Placa redonda de ${Math.round(r.ancho)} mm "${[arriba, centro, abajo].filter(Boolean).join(" · ").slice(0, 60)}"`}
      material="MDF, triplay o acrílico de 3 a 6 mm"
      vacio={fuente ? "Escribe un texto." : "Cargando la letra…"}
    />
  )
}
