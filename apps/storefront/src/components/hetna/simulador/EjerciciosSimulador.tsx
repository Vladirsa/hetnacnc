"use client"

// Ejercicios calificados del Simulador CNC. El alumno lee el plano, escribe su
// programa, lo prueba en el simulador y lo manda a calificar: el SERVIDOR corre
// su programa y compara la pieza con la del plano (nadie puede "pasarlo" desde
// el navegador). Al aprobar todos, obtiene su constancia.
import { useEffect, useMemo, useState, useTransition } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { calificarEjercicioSim, listarEjerciciosSim, type CalificacionSim, type EjercicioSim, type ListaSim, type PlanoAlturas, type PlanoPerfil } from "@/lib/data/simulador"

export type Probar = { ejercicio: EjercicioSim; codigo: string }

const borrador = (id: string) => `hetna-sim-ej-${id}`
const INICIO_FRESA = "%\n(Escribe aquí tu programa)\nG21 G90\n\nM30\n%"
const INICIO_TORNO = "%\n(Escribe aquí tu programa de torno: X en diámetro)\nG21 G99\nT0101\n\nM30\n%"

/** Vista desde arriba de la pieza objetivo (fresadora): más oscuro = más hondo. */
function PlanoFresa({ p, ej, marcas }: { p: PlanoAlturas; ej: EjercicioSim; marcas: { x: number; y: number; color: string }[] }) {
  const m = ej.material!
  const minimo = Math.min(-0.01, ...p.alturas) / 100
  const W = 360
  const H = Math.round((W * m.largo) / m.ancho)
  const x0 = m.cero === "centro" ? -m.ancho / 2 : 0
  const y0 = m.cero === "centro" ? -m.largo / 2 : 0
  const [img, setImg] = useState<string>("")
  useEffect(() => {
    const c = document.createElement("canvas")
    c.width = p.nx
    c.height = p.ny
    const ctx = c.getContext("2d")!
    const d = ctx.createImageData(p.nx, p.ny)
    for (let j = 0; j < p.ny; j++)
      for (let i = 0; i < p.nx; i++) {
        const h = p.alturas[j * p.nx + i] / 100
        const t = h < -0.01 ? 0.35 + 0.65 * (h / minimo) : 0
        const k = ((p.ny - 1 - j) * p.nx + i) * 4 // Y hacia arriba
        d.data[k] = 216 - t * 160
        d.data[k + 1] = 185 - t * 135
        d.data[k + 2] = 140 - t * 110
        d.data[k + 3] = 255
      }
    ctx.putImageData(d, 0, 0)
    setImg(c.toDataURL())
  }, [p, minimo])
  return (
    <svg viewBox={`-28 -8 ${W + 40} ${H + 36}`} className="w-full max-w-[440px]" role="img" aria-label="Plano de la pieza vista desde arriba">
      {img && <image href={img} x={0} y={0} width={W} height={H} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="#8A97AB" />
      <text x={W / 2} y={H + 16} fill="#8A97AB" fontSize="11" textAnchor="middle">X: {m.ancho} mm</text>
      <text x={-10} y={H / 2} fill="#8A97AB" fontSize="11" textAnchor="middle" transform={`rotate(-90 -10 ${H / 2})`}>Y: {m.largo} mm</text>
      <circle cx={((0 - x0) / m.ancho) * W} cy={H - ((0 - y0) / m.largo) * H} r={4} fill="#F07A1A" />
      <text x={((0 - x0) / m.ancho) * W + 6} y={H - ((0 - y0) / m.largo) * H - 6} fill="#F28A3C" fontSize="10">X0 Y0</text>
      {marcas.map((k, i) => (
        <circle key={i} cx={((k.x - x0) / m.ancho) * W} cy={H - ((k.y - y0) / m.largo) * H} r={6} fill="none" stroke={k.color} strokeWidth={2.5} />
      ))}
    </svg>
  )
}

/** Perfil de la pieza objetivo (torno) con sus diámetros. */
function PlanoTorno({ p, ej, marcas }: { p: PlanoPerfil; ej: EjercicioSim; marcas: { z: number; color: string }[] }) {
  const b = ej.barra!
  const W = 380
  const esc = W / (b.largo + 8)
  const R = b.diametro / 2
  const H = Math.round(R * 2 * esc) + 50
  const cy = H / 2
  const X = (z: number) => W - 4 * esc + z * esc // z ≤ 0 → hacia la izquierda
  const pts = p.radios.map((r, i) => `${X(-i * p.paso).toFixed(1)},${(cy - r * esc).toFixed(1)}`)
  const ptsAbajo = p.radios.map((r, i) => `${X(-i * p.paso).toFixed(1)},${(cy + r * esc).toFixed(1)}`).reverse()
  // tramos de diámetro constante de 3 mm o más
  const tramos: { z0: number; z1: number; d: number }[] = []
  let ini = 0
  for (let i = 1; i <= p.radios.length; i++) {
    if (i === p.radios.length || Math.abs(p.radios[i] - p.radios[ini]) > 0.02) {
      if ((i - ini) * p.paso >= 3 && p.radios[ini] < R - 0.05) tramos.push({ z0: -ini * p.paso, z1: -(i - 1) * p.paso, d: p.radios[ini] * 2 })
      ini = i
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[460px]" role="img" aria-label="Plano de la pieza de torno">
      <rect x={X(-b.largo)} y={cy - R * esc} width={b.largo * esc} height={R * 2 * esc} fill="#2B3648" opacity={0.35} />
      <polygon points={[...pts, ...ptsAbajo].join(" ")} fill="#9AA3AD" stroke="#E6EAF0" strokeWidth={1} />
      <line x1={0} y1={cy} x2={W} y2={cy} stroke="#F07A1A" strokeDasharray="6 4" strokeWidth={0.8} />
      <text x={X(0)} y={H - 4} fill="#F28A3C" fontSize="10" textAnchor="middle">Z0</text>
      {tramos.map((t, i) => (
        <g key={i}>
          <text x={(X(t.z0) + X(t.z1)) / 2} y={cy - (t.d / 2) * esc - 5} fill="#E6EAF0" fontSize="10.5" textAnchor="middle">Ø{Math.round(t.d * 10) / 10}</text>
          <text x={(X(t.z0) + X(t.z1)) / 2} y={cy + (t.d / 2) * esc + 13} fill="#8A97AB" fontSize="9.5" textAnchor="middle">Z{Math.round(t.z0)} a Z{Math.round(t.z1)}</text>
        </g>
      ))}
      {marcas.map((k, i) => (
        <line key={i} x1={X(k.z)} y1={8} x2={X(k.z)} y2={H - 14} stroke={k.color} strokeWidth={2} />
      ))}
    </svg>
  )
}

const marcasDe = (r: CalificacionSim | null, torno: boolean) => {
  if (!r) return []
  const out: any[] = []
  for (const [d, color] of [[r.sobrecorte, "#FF5A4E"], [r.falta, "#F2C94C"]] as const) {
    if (!d.cantidad || !d.donde) continue
    const x = /X(-?[\d.]+)/.exec(d.donde)
    const y = /Y(-?[\d.]+)/.exec(d.donde)
    const z = /Z(-?[\d.]+)/.exec(d.donde)
    if (torno && z) out.push({ z: Number(z[1]), color })
    if (!torno && x && y) out.push({ x: Number(x[1]), y: Number(y[1]), color })
  }
  return out
}

export function EjerciciosSimulador({ alProbar, codigoProbado }: { alProbar: (p: Probar) => void; codigoProbado?: { id: string; codigo: string } | null }) {
  const [lista, setLista] = useState<ListaSim | null | undefined>(undefined)
  const [sel, setSel] = useState<string>("")
  const [codigo, setCodigo] = useState("")
  const [pista, setPista] = useState(false)
  const [resultado, setResultado] = useState<CalificacionSim | null>(null)
  const [mensaje, setMensaje] = useState("")
  const [enviando, iniciar] = useTransition()

  const cargar = () => listarEjerciciosSim().then((l) => {
    setLista(l)
    if (l && !sel) setSel(l.ejercicios[0]?.id || "")
  })
  useEffect(() => {
    cargar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ej = useMemo(() => lista?.ejercicios.find((e) => e.id === sel), [lista, sel])
  useEffect(() => {
    if (!ej) return
    setResultado(null)
    setMensaje("")
    setPista(false)
    const guardado = typeof window !== "undefined" ? localStorage.getItem(borrador(ej.id)) : null
    setCodigo(codigoProbado?.id === ej.id ? codigoProbado.codigo : guardado || (ej.maquina === "torno" ? INICIO_TORNO : INICIO_FRESA))
  }, [ej?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ej && codigo) localStorage.setItem(borrador(ej.id), codigo)
  }, [codigo, ej])

  if (lista === undefined) return <p className="text-[13px] text-[#8A97AB]">Cargando ejercicios…</p>
  if (lista === null) return <p className="text-[13px] text-[#FFB4AB]">No se pudieron cargar los ejercicios. Recarga la página en un momento.</p>

  const aprobados = lista.ejercicios.filter((e) => e.resultado?.aprobado).length
  const total = lista.ejercicios.length
  const torno = ej?.maquina === "torno"

  const enviar = () => {
    if (!ej) return
    setMensaje("")
    iniciar(async () => {
      const r = await calificarEjercicioSim(ej.id, codigo)
      if (!r.ok) return setMensaje(r.mensaje)
      setResultado(r.r)
      cargar()
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
      {/* Lista y avance */}
      <aside className="flex flex-col gap-3">
        <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3">
          <p className="m-0 text-[13px] font-bold text-white">Tu avance: {aprobados} de {total}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#1E9E52]" style={{ width: `${(aprobados / Math.max(total, 1)) * 100}%` }} />
          </div>
          {!lista.sesion && (
            <p className="m-0 mt-2 text-[12.5px] text-[#F2C94C]">
              <LocalizedClientLink href="/user" className="font-semibold underline">Inicia sesión</LocalizedClientLink> para calificar y guardar tu avance. Puedes leer los planos y practicar sin cuenta.
            </p>
          )}
          {aprobados === total && total > 0 && (
            <LocalizedClientLink href="/cam/simulador/constancia" className="mt-2 inline-block rounded-[8px] bg-[#1E9E52] px-3 py-1.5 text-[13px] font-bold text-white">
              🎓 Ver mi constancia
            </LocalizedClientLink>
          )}
        </div>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {lista.ejercicios.map((e, i) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSel(e.id)}
                className={`w-full rounded-[10px] border px-3 py-2 text-left text-[13px] ${sel === e.id ? "border-[#F07A1A] bg-[#F07A1A]/10" : "border-[#2B3648] bg-[#121A26] hover:border-[#5B6779]"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">{i + 1}. {e.titulo}</span>
                  <span className="shrink-0 text-[12px]">{e.resultado?.aprobado ? "✅" : !e.abierto ? "🔒" : e.resultado ? `${e.resultado.mejor}` : ""}</span>
                </span>
                <span className="text-[11.5px] text-[#8A97AB]">{e.maquina === "torno" ? "Torno" : "Fresadora"} · {e.nivel}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {ej && (
        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          {/* Plano */}
          <div className="flex flex-col gap-3">
            <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-4">
              <p className="m-0 text-[11.5px] font-bold uppercase tracking-wide text-[#F28A3C]">{torno ? "Torno CNC" : "Fresadora / router"} · {ej.nivel}</p>
              <h2 className="m-0 mt-1 text-[18px] font-bold text-white">{ej.titulo}</h2>
              <ul className="m-0 mt-2 space-y-1 pl-4 text-[13.5px] text-[#C9CED6]">
                {ej.enunciado.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              <button type="button" onClick={() => setPista(!pista)} className="mt-2 text-[12.5px] font-semibold text-[#F28A3C] hover:underline">
                {pista ? "Ocultar pista" : "Ver pista"}
              </button>
              {pista && <p className="m-0 mt-1 rounded-[8px] bg-white/5 p-2 text-[12.5px] text-[#E6EAF0]">💡 {ej.pista}</p>}
            </div>
            <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-4">
              <p className="m-0 mb-2 text-[13px] font-bold text-white">Plano: así debe quedar</p>
              {ej.plano.tipo === "alturas" ? (
                <PlanoFresa p={ej.plano} ej={ej} marcas={marcasDe(resultado, false)} />
              ) : (
                <PlanoTorno p={ej.plano} ej={ej} marcas={marcasDe(resultado, true)} />
              )}
              <p className="m-0 mt-1 text-[11.5px] text-[#8A97AB]">
                {torno ? "Vista de lado: la parte gris clara es la pieza terminada." : "Vista desde arriba: lo más oscuro es lo más hondo."} Después de calificar, los círculos rojos marcan dónde cortaste de más y los amarillos dónde falta material.
              </p>
            </div>
          </div>

          {/* Programa y calificación */}
          <div className="flex flex-col gap-3">
            <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3">
              <p className="m-0 mb-2 text-[13px] font-bold text-white">Tu programa</p>
              <textarea
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                spellCheck={false}
                aria-label="Tu programa G-code"
                className="h-[300px] w-full resize-y rounded-[8px] border border-[#2B3648] bg-[#0B1018] p-2 font-mono text-[12.5px] leading-[1.55] text-[#E6EAF0]"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => alProbar({ ejercicio: ej, codigo })} className="rounded-[8px] bg-white/10 px-3 py-2 text-[13px] font-bold text-white">
                  ▶ Probar en el simulador
                </button>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={enviando || !ej.abierto || !lista.sesion}
                  className="rounded-[8px] bg-[#1E9E52] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-40"
                >
                  {enviando ? "Calificando…" : "✓ Calificar"}
                </button>
              </div>
              {!ej.abierto && lista.cobro && (
                <p className="m-0 mt-2 text-[12.5px] text-[#F2C94C]">
                  🔒 Este ejercicio es parte del curso del simulador.{" "}
                  <LocalizedClientLink href={`/aprendizaje-cnc/cursos/${lista.cobro.curso}`} className="font-semibold underline">Ver el curso</LocalizedClientLink>
                </p>
              )}
              {mensaje && <p className="m-0 mt-2 text-[12.5px] text-[#FFB4AB]">{mensaje}</p>}
            </div>

            {resultado && (
              <div className={`rounded-[12px] border p-4 ${resultado.aprobado ? "border-[#1E7B3A] bg-[#1E7B3A]/15" : "border-[#B3261E] bg-[#B3261E]/10"}`}>
                <p className="m-0 text-[28px] font-extrabold text-white">{resultado.calificacion}<span className="text-[15px] font-semibold text-[#8A97AB]"> / 100</span></p>
                <p className={`m-0 mt-1 text-[14px] font-semibold ${resultado.aprobado ? "text-[#7BE0A3]" : "text-[#FFB4AB]"}`}>{resultado.mensaje}</p>
                {resultado.errores.length > 0 && (
                  <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[12.5px] text-[#FFB4AB]">
                    {resultado.errores.map((a, i) => (
                      <li key={i}><b>Línea {a.linea}:</b> {a.mensaje}</li>
                    ))}
                  </ul>
                )}
                {!resultado.errores.length && !resultado.aprobado && (
                  <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[12.5px] text-[#C9CED6]">
                    {resultado.sobrecorte.cantidad > 0 && <li>🔴 Cortaste de más {resultado.sobrecorte.donde} (hasta {resultado.sobrecorte.peor} mm{torno ? " en diámetro" : ""}).</li>}
                    {resultado.falta.cantidad > 0 && <li>🟡 Falta material {resultado.falta.donde} (hasta {resultado.falta.peor} mm{torno ? " en diámetro" : ""}).</li>}
                  </ul>
                )}
                <p className="m-0 mt-2 text-[12px] text-[#8A97AB]">Mejor calificación: {resultado.mejor} · Intentos: {resultado.intentos}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
