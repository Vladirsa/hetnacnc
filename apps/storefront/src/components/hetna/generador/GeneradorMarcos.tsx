"use client"

// Marcos y portarretratos (2D Studio): marco por capas con ranura para el
// vidrio y la foto, texto grabado y pata para mesa o colgador.
import { useMemo, useState } from "react"

import { CampoNum, CampoTexto, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { type Borde, type Soporte, hacerMarco } from "@/lib/generador/marcos"

import { useFuente } from "./useFuente"

const FOTOS = [
  { id: "10x15", nombre: "10 × 15", a: 100, b: 150 },
  { id: "13x18", nombre: "13 × 18", a: 130, b: 180 },
  { id: "20x25", nombre: "20 × 25", a: 200, b: 250 },
  { id: "carta", nombre: "Carta", a: 216, b: 279 },
  { id: "otra", nombre: "Otra", a: 0, b: 0 },
] as const
type Foto = (typeof FOTOS)[number]["id"]

export function GeneradorMarcos() {
  const [foto, setFoto] = useState<Foto>("10x15")
  const [fotoA, setFotoA] = useState("100")
  const [fotoB, setFotoB] = useState("150")
  const [horizontal, setHorizontal] = useState<"v" | "h">("v")
  const [ancho, setAncho] = useState("30")
  const [solapa, setSolapa] = useState("5")
  const [holgura, setHolgura] = useState("1")
  const [borde, setBorde] = useState<Borde>("redondo")
  const [soporte, setSoporte] = useState<Soporte>("mesa")
  const [leyenda, setLeyenda] = useState("")
  const { texto, error } = useFuente("great-vibes", !!leyenda.trim())

  const elegir = (id: Foto) => {
    setFoto(id)
    const f = FOTOS.find((x) => x.id === id)
    if (f && f.a) {
      setFotoA(String(f.a))
      setFotoB(String(f.b))
    }
  }
  const a = numero(fotoA) || 100
  const b = numero(fotoB) || 150
  const [fw, fh] = horizontal === "h" ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)]

  const r = useMemo(
    () =>
      hacerMarco({
        fotoAncho: fw,
        fotoAlto: fh,
        ancho: numero(ancho) || 30,
        solapa: numero(solapa) || 5,
        holgura: Math.max(0, numero(holgura) || 0),
        borde,
        soporte,
        texto,
        leyenda,
      }),
    [fw, fh, ancho, solapa, holgura, borde, soporte, texto, leyenda],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Medida de la foto">
        <Opciones opciones={FOTOS.map((f) => ({ id: f.id, nombre: f.nombre }))} valor={foto} cambiar={elegir} columnas={3} />
        {foto === "otra" && (
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Ancho" valor={fotoA} cambiar={setFotoA} />
            <CampoNum etiqueta="Alto" valor={fotoB} cambiar={setFotoB} />
          </div>
        )}
        <Opciones opciones={[{ id: "v", nombre: "Vertical" }, { id: "h", nombre: "Horizontal" }]} valor={horizontal} cambiar={setHorizontal} />
      </Seccion>
      <Seccion titulo="Marco">
        <Opciones
          opciones={[{ id: "recto", nombre: "Recto" }, { id: "redondo", nombre: "Redondo" }, { id: "ochavado", nombre: "Ochavado" }, { id: "feston", nombre: "Festón" }]}
          valor={borde}
          cambiar={setBorde}
          columnas={2}
        />
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Ancho del marco" valor={ancho} cambiar={setAncho} />
          <CampoNum etiqueta="Tapa sobre la foto" valor={solapa} cambiar={setSolapa} />
        </div>
        <CampoNum etiqueta="Juego para vidrio y foto" valor={holgura} cambiar={setHolgura} />
      </Seccion>
      <Seccion titulo="Nombre o fecha (grabado abajo)">
        <CampoTexto valor={leyenda} cambiar={setLeyenda} max={30} placeholder="Ej. Ana · 2026" />
        {error && <span className="text-[12px] text-[#F6B8AE]">No se pudo cargar la letra.</span>}
      </Seccion>
      <Seccion titulo="Soporte">
        <Opciones opciones={[{ id: "mesa", nombre: "Pata para mesa" }, { id: "colgador", nombre: "Para colgar" }, { id: "ninguno", nombre: "Sin soporte" }]} valor={soporte} cambiar={setSoporte} />
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Marcos y portarretratos"
      acento="2D"
      subtitulo="Marco por capas con ranura para vidrio y foto"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="10" height="10" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo={`marco-${Math.round(fw / 10)}x${Math.round(fh / 10)}`}
      pieza={`Marco para foto de ${Math.round(fw / 10)} × ${Math.round(fh / 10)} cm, ${r.piezas} piezas`}
      material="MDF de 3 mm"
      datos={[["Medida exterior", `${Math.round(r.exterior[0])} × ${Math.round(r.exterior[1])} mm`], ["Piezas", String(r.piezas)]]}
    />
  )
}
