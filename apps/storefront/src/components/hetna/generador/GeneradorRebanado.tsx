"use client"

// Rebanado en capas (2D Studio): convierte un modelo 3D en capas para cortar
// y pegar. Sube STL u OBJ; las capas salen numeradas, con barrenos de
// alineación y acomodadas en tus hojas.
import { useMemo, useState } from "react"

import { Aviso, CampoNum, Interruptor, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { type Eje, hacerRebanado } from "@/lib/generador/rebanado"
import { leerOBJ, leerSTL } from "@/lib/generador/vectores"

const LIMITE = 40 * 1024 * 1024

export function GeneradorRebanado() {
  const [nombre, setNombre] = useState("")
  const [tris, setTris] = useState<number[]>([])
  const [error, setError] = useState("")
  const [eje, setEje] = useState<Eje>("z")
  const [altura, setAltura] = useState("150")
  const [espesor, setEspesor] = useState("6")
  const [hojaAncho, setHojaAncho] = useState("600")
  const [hojaAlto, setHojaAlto] = useState("400")
  const [barrenos, setBarrenos] = useState(true)
  const [diam, setDiam] = useState("4")
  const [numerar, setNumerar] = useState(true)

  const abrir = async (f?: File | null) => {
    if (!f) return
    setError("")
    if (f.size > LIMITE) return setError("El archivo pesa más de 40 MB.")
    const ext = f.name.split(".").pop()?.toLowerCase()
    try {
      const m = ext === "obj" ? leerOBJ(await f.text()) : ext === "stl" ? leerSTL(await f.arrayBuffer()) : null
      if (!m) return setError("Sube un archivo STL u OBJ.")
      if (!m.tris.length) return setError(m.avisos[0] || "El archivo no trae triángulos.")
      setTris(m.tris)
      setNombre(f.name)
    } catch {
      setError("No pude leer ese archivo.")
    }
  }

  const r = useMemo(
    () =>
      hacerRebanado(tris, {
        eje,
        altura: numero(altura) || 150,
        espesor: numero(espesor) || 6,
        hoja: { ancho: numero(hojaAncho) || 600, alto: numero(hojaAlto) || 400 },
        barrenos,
        diametroBarreno: numero(diam) || 4,
        numerar,
      }),
    [tris, eje, altura, espesor, hojaAncho, hojaAlto, barrenos, diam, numerar],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          abrir(e.dataTransfer.files?.[0])
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed border-[#2B3648] p-4 text-center hover:border-[#C2560A] hover:bg-[#C2560A]/5"
      >
        <span className="text-[14px] font-semibold">{nombre ? `${nombre} (cambiar)` : "Sube tu modelo 3D"}</span>
        <span className="text-[11.5px] text-[#8A97AB]">STL u OBJ · hasta 40 MB</span>
        <input type="file" accept=".stl,.obj" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
      </label>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Seccion titulo="Qué eje queda de pie" nota="Las capas se apilan en este eje. Si sale acostado, prueba otro.">
        <Opciones opciones={[{ id: "z", nombre: "Z" }, { id: "y", nombre: "Y" }, { id: "x", nombre: "X" }]} valor={eje} cambiar={setEje} />
      </Seccion>
      <Seccion titulo="Tamaño y material">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Altura armada" valor={altura} cambiar={setAltura} />
          <CampoNum etiqueta="Espesor de hoja" valor={espesor} cambiar={setEspesor} />
        </div>
      </Seccion>
      <Seccion titulo="Hojas de material">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Ancho" valor={hojaAncho} cambiar={setHojaAncho} />
          <CampoNum etiqueta="Alto" valor={hojaAlto} cambiar={setHojaAlto} />
        </div>
      </Seccion>
      <Seccion titulo="Armado">
        <Interruptor etiqueta="Número grabado en cada capa" activo={numerar} cambiar={setNumerar} />
        <Interruptor etiqueta="Barrenos para alinear" activo={barrenos} cambiar={setBarrenos} />
        {barrenos && <CampoNum etiqueta="Diámetro del taquete" valor={diam} cambiar={setDiam} />}
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Rebanado en capas"
      acento="3D → 2D"
      subtitulo="Modelo 3D a capas para cortar y pegar"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l8 4-8 4-8-4zM4 12l8 4 8-4M4 16.5l8 4 8-4" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={tris.length ? r.avisos : []}
      archivo={`capas-${(nombre || "modelo").replace(/\.[^.]+$/, "")}`}
      pieza={`Modelo en ${r.capas} capas de ${espesor} mm`}
      material={`Hojas de ${espesor} mm`}
      datos={r.capas ? [["Capas", String(r.capas)], ["Hojas", String(r.hojas)]] : []}
      vacio="Sube un modelo STL u OBJ para rebanarlo en capas."
    />
  )
}
