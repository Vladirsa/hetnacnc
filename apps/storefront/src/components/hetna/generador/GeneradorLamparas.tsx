"use client"

// Lámparas por capas (2D Studio): costillas que se encastran en anillos, con
// el hueco del socket en la base.
import { useMemo, useState } from "react"

import { CampoNum, Interruptor, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { type FormaLampara, hacerLampara, perfil } from "@/lib/generador/lamparas"

const FORMAS: { id: FormaLampara; nombre: string }[] = [
  { id: "esfera", nombre: "Esfera" },
  { id: "gota", nombre: "Gota" },
  { id: "jarron", nombre: "Jarrón" },
  { id: "cilindro", nombre: "Cilindro" },
]

// Silueta chiquita de la forma (para elegirla)
function Silueta({ forma }: { forma: FormaLampara }) {
  const pts: string[] = []
  for (let i = 0; i <= 20; i++) pts.push(`${(16 + perfil(forma, (i / 20) * 30, 30, 12, 3)).toFixed(1)},${(32 - (i / 20) * 30).toFixed(1)}`)
  for (let i = 20; i >= 0; i--) pts.push(`${(16 - perfil(forma, (i / 20) * 30, 30, 12, 3)).toFixed(1)},${(32 - (i / 20) * 30).toFixed(1)}`)
  return (
    <svg width="32" height="34" viewBox="0 0 32 34" aria-hidden="true" className="mx-auto block">
      <polygon points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function GeneradorLamparas() {
  const [forma, setForma] = useState<FormaLampara>("esfera")
  const [alto, setAlto] = useState("300")
  const [diametro, setDiametro] = useState("260")
  const [costillas, setCostillas] = useState("10")
  const [niveles, setNiveles] = useState("4")
  const [espesor, setEspesor] = useState("3")
  const [holgura, setHolgura] = useState("0.1")
  const [socket, setSocket] = useState("40")
  const [anillo, setAnillo] = useState("15")
  const [ventanas, setVentanas] = useState(true)
  const [hojaAncho, setHojaAncho] = useState("600")
  const [hojaAlto, setHojaAlto] = useState("400")

  const r = useMemo(
    () =>
      hacerLampara({
        forma,
        alto: numero(alto) || 300,
        diametro: numero(diametro) || 260,
        costillas: numero(costillas) || 10,
        niveles: numero(niveles) || 4,
        espesor: numero(espesor) || 3,
        holgura: Math.max(0, numero(holgura) || 0),
        socket: numero(socket) || 40,
        anchoAnillo: numero(anillo) || 15,
        ventanas,
        hoja: { ancho: numero(hojaAncho) || 600, alto: numero(hojaAlto) || 400 },
      }),
    [forma, alto, diametro, costillas, niveles, espesor, holgura, socket, anillo, ventanas, hojaAncho, hojaAlto],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Forma">
        <Opciones
          opciones={FORMAS.map((f) => ({ id: f.id, nombre: <span className="flex flex-col gap-1"><Silueta forma={f.id} />{f.nombre}</span> }))}
          valor={forma}
          cambiar={setForma}
        />
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Alto" valor={alto} cambiar={setAlto} />
          <CampoNum etiqueta="Diámetro" valor={diametro} cambiar={setDiametro} />
        </div>
      </Seccion>
      <Seccion titulo="Piezas" nota="Los niveles son los anillos horizontales; el primero es la base con el socket.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Costillas" valor={costillas} cambiar={setCostillas} sufijo="" />
          <CampoNum etiqueta="Niveles" valor={niveles} cambiar={setNiveles} sufijo="" />
          <CampoNum etiqueta="Ancho de anillo" valor={anillo} cambiar={setAnillo} />
          <CampoNum etiqueta="Hueco del socket" valor={socket} cambiar={setSocket} />
        </div>
        <Interruptor etiqueta="Calado en las costillas" activo={ventanas} cambiar={setVentanas} />
      </Seccion>
      <Seccion titulo="Material">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Espesor" valor={espesor} cambiar={setEspesor} />
          <CampoNum etiqueta="Holgura" valor={holgura} cambiar={setHolgura} />
          <CampoNum etiqueta="Hoja ancho" valor={hojaAncho} cambiar={setHojaAncho} />
          <CampoNum etiqueta="Hoja alto" valor={hojaAlto} cambiar={setHojaAlto} />
        </div>
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Lámparas por capas"
      acento="2D"
      subtitulo="Costillas y anillos que se encastran"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2v3M7 9a5 5 0 0110 0c0 3-2 5-2 8H9c0-3-2-5-2-8zM10 21h4" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`lampara-${forma}-${alto}mm`}
      pieza={`Lámpara ${forma} de ${alto} mm, ${r.piezas} piezas`}
      material={`Hojas de ${espesor} mm`}
      datos={[["Piezas", String(r.piezas)], ["Hojas", String(r.hojas)]]}
    />
  )
}
