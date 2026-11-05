"use client"

// Relojes de pared (2D Studio): carátula con números o marcas, nombre al
// centro y el barreno del mecanismo, lista para cortar o grabar.
import { useMemo, useState } from "react"

import { CampoNum, CampoTexto, Interruptor, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { FUENTES } from "@/lib/generador/fuentes"
import { type Forma, type Numeros, hacerReloj } from "@/lib/generador/relojes"

import { useFuente } from "./useFuente"

const LETRAS = FUENTES.filter((f) => ["cinzel", "montserrat", "oswald", "roboto-slab", "bebas-neue", "allerta-stencil", "stardos-stencil"].includes(f.id))

export function GeneradorRelojes() {
  const [diametro, setDiametro] = useState("300")
  const [forma, setForma] = useState<Forma>("circulo")
  const [numeros, setNumeros] = useState<Numeros>("romanos")
  const [letra, setLetra] = useState("cinzel")
  const [calados, setCalados] = useState(false)
  const [minutos, setMinutos] = useState(true)
  const [marco, setMarco] = useState(true)
  const [barreno, setBarreno] = useState<"7.5" | "8" | "10">("8")
  const [nombre, setNombre] = useState("")

  const { texto, error } = useFuente(letra, numeros !== "marcas" || !!nombre.trim())

  const r = useMemo(
    () =>
      hacerReloj({
        diametro: numero(diametro) || 300,
        forma,
        numeros,
        calados,
        minutos,
        marco,
        barreno: numero(barreno),
        colgador: false,
        texto,
        nombre,
      }),
    [diametro, forma, numeros, calados, minutos, marco, barreno, texto, nombre],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Carátula">
        <Opciones opciones={[{ id: "circulo", nombre: "Redonda" }, { id: "cuadrado", nombre: "Cuadrada" }, { id: "hexagono", nombre: "Hexágono" }]} valor={forma} cambiar={setForma} />
        <CampoNum etiqueta="Diámetro (o lado)" valor={diametro} cambiar={setDiametro} />
      </Seccion>
      <Seccion titulo="Números">
        <Opciones
          opciones={[{ id: "romanos", nombre: "Romanos" }, { id: "arabigos", nombre: "1 al 12" }, { id: "cuatro", nombre: "12·3·6·9" }, { id: "marcas", nombre: "Marcas" }]}
          valor={numeros}
          cambiar={setNumeros}
          columnas={2}
        />
        {numeros !== "marcas" && (
          <div className="grid grid-cols-2 gap-1.5">
            {LETRAS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setLetra(f.id)}
                aria-pressed={letra === f.id}
                className={`rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold ${letra === f.id ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#232D3D]"}`}
              >
                {f.nombre}
              </button>
            ))}
          </div>
        )}
        <Interruptor etiqueta="Calar los números (atravesar)" activo={calados} cambiar={setCalados} />
        <Interruptor etiqueta="Marcas de minutos" activo={minutos} cambiar={setMinutos} />
        <Interruptor etiqueta="Marco grabado" activo={marco} cambiar={setMarco} />
        {error && <span className="text-[12px] text-[#F6B8AE]">No se pudo cargar la letra. Revisa tu conexión.</span>}
      </Seccion>
      <Seccion titulo="Nombre o frase al centro">
        <CampoTexto valor={nombre} cambiar={setNombre} max={24} placeholder="Ej. Familia López" />
      </Seccion>
      <Seccion titulo="Mecanismo" nota="El barreno es para el eje roscado del mecanismo de cuarzo.">
        <Opciones opciones={[{ id: "7.5", nombre: "7.5 mm" }, { id: "8", nombre: "8 mm" }, { id: "10", nombre: "10 mm" }]} valor={barreno} cambiar={setBarreno} />
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Relojes de pared"
      acento="2D"
      subtitulo="Carátulas para cortar o grabar"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`reloj-${diametro}mm`}
      pieza={`Carátula de reloj de ${diametro} mm`}
    />
  )
}
