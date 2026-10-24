"use client"

// Laboratorio CAM > Torno 4 ejes (HETNA TURN STUDIO).
//
// El cliente arma la pieza por segmentos (cilindro, cono, bola, cintura), ve
// el perfil al momento y pide el G-code a /api/cam/torno, donde vive el motor
// (lib/torno/gcode.ts). El perfil de la pantalla usa el MISMO lib/torno/pieza.ts
// que el generador, así que lo que se ve es lo que se corta.

import { useMemo, useState } from "react"

import { longitudTotal, radioEn, radioMaximo, type Segmento, type TipoSegmento } from "@/lib/torno/pieza"

const TIPOS: { valor: TipoSegmento; etiqueta: string }[] = [
  { valor: "cilindro", etiqueta: "Cilindro (recto)" },
  { valor: "cono", etiqueta: "Cono (ahusado)" },
  { valor: "esfera", etiqueta: "Bola / perilla" },
  { valor: "cova", etiqueta: "Cintura (cóncava)" },
]

const MATERIALES = [
  { valor: "pino", etiqueta: "Pino" },
  { valor: "dura", etiqueta: "Madera dura" },
  { valor: "mdf", etiqueta: "MDF" },
  { valor: "generico", etiqueta: "Genérico" },
]

let contador = 0
const nuevoId = () => `seg-${Date.now()}-${contador++}`

const seg = (tipo: TipoSegmento, inicioY: number, finY: number, radioInicio: number, radioFin: number): Segmento => ({
  id: nuevoId(),
  tipo,
  inicioY,
  finY,
  radioInicio,
  radioFin,
})

// Puntos de partida para no empezar en blanco. Medidas en mm.
const EJEMPLOS: { nombre: string; bloque: number; segmentos: () => Segmento[] }[] = [
  {
    nombre: "Balaustre",
    bloque: 60,
    segmentos: () => [
      seg("cilindro", 0, 60, 28, 28),
      seg("cova", 60, 90, 28, 18),
      seg("esfera", 90, 150, 20, 27),
      seg("cono", 150, 330, 20, 14),
      seg("cova", 330, 360, 22, 13),
      seg("cilindro", 360, 420, 28, 28),
    ],
  },
  {
    nombre: "Pata de mesa",
    bloque: 75,
    segmentos: () => [
      seg("cilindro", 0, 120, 35, 35),
      seg("cova", 120, 150, 35, 26),
      seg("cono", 150, 650, 30, 17),
      seg("esfera", 650, 700, 17, 22),
    ],
  },
  {
    nombre: "Columna",
    bloque: 100,
    segmentos: () => [
      seg("cilindro", 0, 40, 48, 48),
      seg("cova", 40, 70, 48, 38),
      seg("cono", 70, 500, 40, 35),
      seg("cova", 500, 530, 46, 36),
      seg("cilindro", 530, 570, 48, 48),
    ],
  },
]

const caja = "rounded-[14px] border border-[#E7E4DC] bg-white p-4 lg:p-5"
const etiqueta = "block text-[12px] font-semibold text-[#6B6A63]"
const campo =
  "mt-1 w-full rounded-[8px] border border-[#E7E4DC] bg-white px-2.5 py-2 text-[14px] text-[#1B1B18] focus:border-[#C2560A] focus:outline-none"

function Numero({
  texto,
  valor,
  onChange,
  min,
  paso,
}: {
  texto: string
  valor: number
  onChange: (n: number) => void
  min?: number
  paso?: number
}) {
  return (
    <label className={etiqueta}>
      {texto}
      <input
        type="number"
        inputMode="decimal"
        className={campo}
        value={Number.isFinite(valor) ? valor : ""}
        min={min}
        step={paso ?? "any"}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      />
    </label>
  )
}

// Silueta de la pieza (vista lateral) dentro del bloque cuadrado.
function Perfil({ segmentos, bloque }: { segmentos: Segmento[]; bloque: number }) {
  const datos = useMemo(() => {
    const validos = segmentos.filter(
      (s) => [s.inicioY, s.finY, s.radioInicio, s.radioFin].every(Number.isFinite) && s.finY > s.inicioY
    )
    const largo = longitudTotal(validos)
    if (!validos.length || largo <= 0) return null
    const rMax = radioMaximo(validos)
    const medio = Math.max(rMax, bloque / 2)
    const paso = Math.max(0.5, largo / 400)
    const arriba: string[] = []
    const abajo: string[] = []
    for (let y = 0; y <= largo + 1e-6; y += paso) {
      const r = radioEn(y, validos)
      arriba.push(`${y.toFixed(1)},${(medio - r).toFixed(2)}`)
      abajo.unshift(`${y.toFixed(1)},${(medio + r).toFixed(2)}`)
    }
    return { largo, rMax, medio, d: `M${arriba.join(" L")} L${abajo.join(" L")} Z` }
  }, [segmentos, bloque])

  if (!datos) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-[10px] bg-[#F7F5EF] text-[13px] text-[#6B6A63]">
        Agrega segmentos con medidas válidas para ver la pieza.
      </div>
    )
  }

  const { largo, rMax, medio, d } = datos
  const alto = medio * 2
  const margen = Math.max(largo, alto) * 0.04
  return (
    <figure>
      <svg
        viewBox={`${-margen} ${-margen} ${largo + margen * 2} ${alto + margen * 2}`}
        className="h-[200px] w-full rounded-[10px] bg-[#F7F5EF]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Vista lateral de la pieza"
      >
        <rect
          x={0}
          y={medio - bloque / 2}
          width={largo}
          height={bloque}
          fill="none"
          stroke="#A5A29A"
          strokeDasharray={`${margen / 2} ${margen / 3}`}
          strokeWidth={Math.max(0.6, largo / 600)}
        />
        <path d={d} fill="#E9C9A4" stroke="#B34D07" strokeWidth={Math.max(0.6, largo / 500)} />
        <line x1={-margen / 2} x2={largo + margen / 2} y1={medio} y2={medio} stroke="#6B6A63" strokeDasharray={`${margen / 3} ${margen / 4}`} strokeWidth={Math.max(0.4, largo / 900)} />
      </svg>
      <figcaption className="mt-2 text-[12px] text-[#6B6A63]">
        {largo.toFixed(0)} mm de largo · Ø máximo {(rMax * 2).toFixed(1)} mm · bloque de {bloque || 0} mm (línea punteada)
      </figcaption>
    </figure>
  )
}

export function EstudioTorno() {
  const [segmentos, setSegmentos] = useState<Segmento[]>(() => EJEMPLOS[0].segmentos())
  const [material, setMaterial] = useState("pino")
  const [origenPunto, setOrigenPunto] = useState<"mandril" | "contrapunto">("mandril")

  const [stockWidthMm, setStockWidthMm] = useState(EJEMPLOS[0].bloque)
  const [startOffsetMm, setStartOffsetMm] = useState(20)
  const [endOffsetMm, setEndOffsetMm] = useState(20)
  const [safeZClearanceMm, setSafeZClearanceMm] = useState(10)

  const [toolDiameterMm, setToolDiameterMm] = useState(6)
  const [feed, setFeed] = useState(1200)

  const [rpmCilindrado, setRpmCilindrado] = useState(30)
  const [rpmDesbaste, setRpmDesbaste] = useState(40)
  const [rpmAcabado, setRpmAcabado] = useState(65)

  const [gcode, setGcode] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const [avisos, setAvisos] = useState<string[]>([])

  const limpiarResultado = () => {
    setGcode(null)
    setInfo(null)
    setAvisos([])
  }

  function cargarEjemplo(i: number) {
    setSegmentos(EJEMPLOS[i].segmentos())
    setStockWidthMm(EJEMPLOS[i].bloque)
    limpiarResultado()
  }

  function agregarSegmento() {
    const ultimo = segmentos[segmentos.length - 1]
    const inicio = ultimo && Number.isFinite(ultimo.finY) ? ultimo.finY : 0
    const r = ultimo && Number.isFinite(ultimo.radioFin) ? ultimo.radioFin : 20
    setSegmentos([...segmentos, seg("cilindro", inicio, inicio + 50, r, r)])
    limpiarResultado()
  }

  function quitarSegmento(id: string) {
    setSegmentos(segmentos.filter((s) => s.id !== id))
    limpiarResultado()
  }

  function actualizarSegmento(id: string, cambios: Partial<Segmento>) {
    setSegmentos(segmentos.map((s) => (s.id === id ? { ...s, ...cambios } : s)))
    limpiarResultado()
  }

  async function generar() {
    setError(null)
    limpiarResultado()
    setGenerando(true)
    try {
      const resp = await fetch("/api/cam/torno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentos,
          material,
          origenPunto,
          maquina: { stockWidthMm, startOffsetMm, endOffsetMm, safeZClearanceMm },
          herramienta: { toolDiameterMm, feed },
          rpm: { rpmCilindrado, rpmDesbaste, rpmAcabado },
        }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setError(data.error ?? "No se pudo generar el G-code.")
        return
      }
      setGcode(data.gcode)
      setAvisos(data.avisos ?? [])
      setInfo(
        `${data.longitudTotalMm.toFixed(0)} mm de largo · Ø máximo ${(data.radioMaximoMm * 2).toFixed(1)} mm · ` +
          `${data.totalLineas.toLocaleString("es-MX")} líneas · unos ${Math.max(1, Math.round(data.minutosEstimados))} min de corte`
      )
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.")
    } finally {
      setGenerando(false)
    }
  }

  function descargar() {
    if (!gcode) return
    const blob = new Blob([gcode], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "pieza_torno_hetna.nc"
    a.click()
    URL.revokeObjectURL(url)
  }

  const vistaPrevia = useMemo(() => {
    if (!gcode) return ""
    const lineas = gcode.split("\n")
    return lineas.length > 200
      ? `${lineas.slice(0, 200).join("\n")}\n(… ${lineas.length - 200} líneas más en el archivo …)`
      : gcode
  }, [gcode])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className={caja}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold text-[#1B1B18]">Tu pieza</h2>
            <div className="flex flex-wrap gap-1.5">
              {EJEMPLOS.map((e, i) => (
                <button
                  key={e.nombre}
                  type="button"
                  onClick={() => cargarEjemplo(i)}
                  className="rounded-full border border-[#E7E4DC] px-3 py-1 text-[12px] font-semibold text-[#4A4943] hover:border-[#C2560A] hover:text-[#B34D07]"
                >
                  {e.nombre}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <Perfil segmentos={segmentos} bloque={stockWidthMm} />
          </div>
        </section>

        <section className={caja}>
          <h2 className="text-[17px] font-bold text-[#1B1B18]">Segmentos</h2>
          <p className="mt-1 text-[13px] text-[#6B6A63]">
            De un extremo al otro, en milímetros. El radio es la mitad del diámetro.
          </p>
          <div className="mt-3 flex flex-col gap-2.5">
            {segmentos.map((s, i) => (
              <div
                key={s.id}
                className="grid grid-cols-2 items-end gap-2 rounded-[10px] border border-[#E7E4DC] p-3 sm:grid-cols-[1.4fr_repeat(4,1fr)_auto]"
              >
                <label className={`${etiqueta} col-span-2 sm:col-span-1`}>
                  {i + 1}. Forma
                  <select
                    className={campo}
                    value={s.tipo}
                    onChange={(e) => actualizarSegmento(s.id, { tipo: e.target.value as TipoSegmento })}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                <Numero texto="Empieza" valor={s.inicioY} min={0} onChange={(n) => actualizarSegmento(s.id, { inicioY: n })} />
                <Numero texto="Termina" valor={s.finY} min={0} onChange={(n) => actualizarSegmento(s.id, { finY: n })} />
                <Numero
                  texto={s.tipo === "cilindro" ? "Radio" : "Radio inicio"}
                  valor={s.radioInicio}
                  min={0}
                  onChange={(n) =>
                    actualizarSegmento(s.id, s.tipo === "cilindro" ? { radioInicio: n, radioFin: n } : { radioInicio: n })
                  }
                />
                <Numero
                  texto={s.tipo === "esfera" ? "Radio de la bola" : s.tipo === "cova" ? "Radio cintura" : "Radio fin"}
                  valor={s.radioFin}
                  min={0}
                  onChange={(n) => actualizarSegmento(s.id, { radioFin: n })}
                />
                <button
                  type="button"
                  onClick={() => quitarSegmento(s.id)}
                  title="Quitar segmento"
                  aria-label={`Quitar segmento ${i + 1}`}
                  className="col-span-2 h-[38px] rounded-[8px] border border-[#E7E4DC] px-3 text-[14px] text-[#9B1C1C] hover:bg-[#FDECEC] sm:col-span-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={agregarSegmento}
            className="mt-3 rounded-[10px] border border-dashed border-[#C2560A] px-4 py-2 text-[14px] font-semibold text-[#B34D07] hover:bg-[#FFF8EC]"
          >
            + Agregar segmento
          </button>
        </section>

        {(gcode || error || avisos.length > 0) && (
          <section className={caja}>
            <h2 className="text-[17px] font-bold text-[#1B1B18]">Resultado</h2>
            {error && (
              <p className="mt-3 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[14px] text-[#9B1C1C]">{error}</p>
            )}
            {info && <p className="mt-3 text-[14px] font-semibold text-[#16794F]">{info}</p>}
            {avisos.map((a, i) => (
              <p key={i} className="mt-2 rounded-[10px] bg-[#FFF8EC] px-3 py-2 text-[13px] text-[#7A4A06]">
                ⚠ {a}
              </p>
            ))}
            {gcode && (
              <>
                <button
                  type="button"
                  onClick={descargar}
                  className="mt-4 rounded-[10px] bg-[#C2560A] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
                >
                  ⬇ Descargar archivo .nc
                </button>
                <pre className="mt-3 max-h-[320px] overflow-auto rounded-[10px] bg-[#1B1B18] p-3 text-[12px] leading-relaxed text-[#E7E4DC]">
                  {vistaPrevia}
                </pre>
              </>
            )}
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-5">
        <section className={caja}>
          <h2 className="text-[17px] font-bold text-[#1B1B18]">Material y máquina</h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className={etiqueta}>
              Material
              <select className={campo} value={material} onChange={(e) => setMaterial(e.target.value)}>
                {MATERIALES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <Numero texto="Ancho del bloque cuadrado (mm)" valor={stockWidthMm} min={1} onChange={setStockWidthMm} />
            <div className="grid grid-cols-2 gap-2">
              <Numero texto="Margen inicio (mm)" valor={startOffsetMm} min={0} onChange={setStartOffsetMm} />
              <Numero texto="Margen fin (mm)" valor={endOffsetMm} min={0} onChange={setEndOffsetMm} />
            </div>
            <Numero texto="Retiro seguro en Z (mm)" valor={safeZClearanceMm} min={1} onChange={setSafeZClearanceMm} />
            <label className={etiqueta}>
              Origen del recorrido
              <select
                className={campo}
                value={origenPunto}
                onChange={(e) => setOrigenPunto(e.target.value as "mandril" | "contrapunto")}
              >
                <option value="mandril">Desde el mandril</option>
                <option value="contrapunto">Desde el contrapunto</option>
              </select>
            </label>
          </div>
        </section>

        <section className={caja}>
          <h2 className="text-[17px] font-bold text-[#1B1B18]">Fresa y RPM</h2>
          <div className="mt-3 flex flex-col gap-3">
            <Numero texto="Diámetro de la fresa (mm)" valor={toolDiameterMm} min={1} onChange={setToolDiameterMm} />
            <Numero texto="Avance de referencia (mm/min)" valor={feed} min={0} onChange={setFeed} />
            <p className="text-[12px] leading-snug text-[#6B6A63]">
              RPM de la <strong>pieza</strong> (el eje A), no de la fresa:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Numero texto="Escuadrado" valor={rpmCilindrado} min={1} onChange={setRpmCilindrado} />
              <Numero texto="Desbaste" valor={rpmDesbaste} min={1} onChange={setRpmDesbaste} />
              <Numero texto="Acabado" valor={rpmAcabado} min={1} onChange={setRpmAcabado} />
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={generar}
          disabled={generando}
          className="rounded-[10px] bg-[#C2560A] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60"
        >
          {generando ? "Generando…" : "Generar G-code"}
        </button>

        <p className="rounded-[10px] border border-[#F0D9B5] bg-[#FFF8EC] px-3 py-2.5 text-[12px] leading-relaxed text-[#7A4A06]">
          Ejes: A gira la pieza, Y recorre el largo y Z es el radio de corte, con Z0 en el centro del eje
          rotativo. Prueba el programa primero en aire o con material de descarte, y revisa que tu eje A no
          tenga límites de giro.
        </p>
      </aside>
    </div>
  )
}
