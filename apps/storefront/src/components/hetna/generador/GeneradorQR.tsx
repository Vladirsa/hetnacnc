"use client"

// Código QR para grabar (2D Studio): QR vectorial para placas, mesas de
// restaurante, empaques y tarjetas de madera.
import { useEffect, useMemo, useState } from "react"

import { CampoNum, CampoTexto, Interruptor, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { FUENTES, cargarFuente } from "@/lib/generador/fuentes"
import { type Fuente, textoACurvas } from "@/lib/generador/letreros"
import { hacerQR } from "@/lib/generador/qrGrabado"

const EJEMPLOS = [
  { nombre: "Menú", etiqueta: "ESCANEA EL MENÚ" },
  { nombre: "WiFi", etiqueta: "WIFI GRATIS" },
  { nombre: "Reseñas", etiqueta: "DÉJANOS TU RESEÑA" },
  { nombre: "Pagos", etiqueta: "PAGA AQUÍ" },
]

export function GeneradorQR() {
  const [texto, setTexto] = useState("https://hetnacnc.com")
  const [lado, setLado] = useState("60")
  const [zona, setZona] = useState("3")
  const [placa, setPlaca] = useState(true)
  const [radio, setRadio] = useState("6")
  const [barreno, setBarreno] = useState(false)
  const [etiqueta, setEtiqueta] = useState("ESCANEA EL MENÚ")
  const [altoEtiqueta, setAltoEtiqueta] = useState("6")
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [errorFuente, setErrorFuente] = useState(false)

  useEffect(() => {
    if (!etiqueta.trim() || fuente) return
    const t = FUENTES.find((f) => f.id === "montserrat") || FUENTES[0]
    cargarFuente(t)
      .then(setFuente)
      .catch(() => setErrorFuente(true))
  }, [etiqueta, fuente])

  const curvas = useMemo(() => {
    if (!fuente || !etiqueta.trim()) return null
    return textoACurvas(fuente, { texto: etiqueta.trim(), alto: numero(altoEtiqueta) || 6, espaciado: 0.4, interlineado: 1.2, alineacion: "centro" }).curvas
  }, [fuente, etiqueta, altoEtiqueta])

  const r = useMemo(
    () =>
      hacerQR({
        texto,
        lado: numero(lado) || 60,
        zona: numero(zona) || 0,
        placa,
        radio: numero(radio) || 0,
        barreno,
        etiqueta: curvas,
        altoEtiqueta: numero(altoEtiqueta) || 6,
      }),
    [texto, lado, zona, placa, radio, barreno, curvas, altoEtiqueta],
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Liga o texto" nota="Mientras más corta la liga, más grandes salen los cuadritos y mejor se lee.">
        <CampoTexto valor={texto} cambiar={setTexto} max={300} placeholder="https://tu-negocio.com/menu" />
      </Seccion>
      <Seccion titulo="Texto abajo">
        <div className="flex flex-wrap gap-1.5">
          {EJEMPLOS.map((e) => (
            <button key={e.nombre} type="button" onClick={() => setEtiqueta(e.etiqueta)} className="rounded-full bg-[#1C2431] px-2.5 py-1 text-[12px] text-[#C9D2E0] hover:bg-[#232D3D]">
              {e.nombre}
            </button>
          ))}
        </div>
        <CampoTexto valor={etiqueta} cambiar={setEtiqueta} max={40} placeholder="Sin texto" />
        {etiqueta.trim() && <CampoNum etiqueta="Alto de las letras" valor={altoEtiqueta} cambiar={setAltoEtiqueta} />}
        {errorFuente && <span className="text-[12px] text-[#F6B8AE]">No se pudo cargar la letra; el QR sí sale.</span>}
      </Seccion>
      <Seccion titulo="Tamaño">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Lado del QR" valor={lado} cambiar={setLado} />
          <CampoNum etiqueta="Margen" valor={zona} cambiar={setZona} sufijo="cuadros" />
        </div>
      </Seccion>
      <Seccion titulo="Placa">
        <Interruptor etiqueta="Cortar la placa alrededor" activo={placa} cambiar={setPlaca} />
        {placa && (
          <>
            <CampoNum etiqueta="Esquinas redondas" valor={radio} cambiar={setRadio} />
            <Interruptor etiqueta="Barreno para colgar" activo={barreno} cambiar={setBarreno} />
          </>
        )}
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Código QR"
      acento="2D"
      subtitulo="QR vectorial para grabar en láser o router"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
        </svg>
      }
      panel={panel}
      dibujo={r.dibujo}
      avisos={r.avisos}
      archivo="codigo-qr"
      pieza={`Placa con código QR de ${lado} mm`}
      datos={r.modulo ? [["Cuadrito", `${r.modulo.toFixed(2)} mm`], ["Versión QR", String(r.version)]] : []}
      vacio="Escribe la liga o el texto del QR."
    />
  )
}
