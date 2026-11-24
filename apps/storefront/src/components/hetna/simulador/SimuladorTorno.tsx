"use client"

// Simulador de torno CNC (2 ejes, estilo Fanuc) de la Academia HETNA.
// Mismo panel que el de la fresadora: ciclo de inicio, pausa, bloque a bloque,
// velocidad, coordenadas (X en diámetro y Z) y alarmas que detienen la máquina.
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { EJEMPLOS_TORNO } from "@/lib/simulador/ejemplos-torno"
import { INICIO_TORNO, interpretarTorno, Perfil, type Barra, type Inserto, type PuntoT } from "@/lib/simulador/torno"

const Vista3D = dynamic(() => import("./Vista3DTorno"), {
  ssr: false,
  loading: () => <div className="grid h-[520px] place-items-center rounded-[12px] border border-[#2B3648] text-[13px] text-[#8A97AB]">Cargando vista 3D…</div>,
})

const VELOCIDADES = [1, 2, 5, 10, 25, 100]
const f3 = (n: number) => (Math.abs(n) < 0.0005 ? "0.000" : n.toFixed(3))
const minutos = (m: number) => (m < 1 ? `${Math.round(m * 60)} s` : `${Math.floor(m)} min ${Math.round((m % 1) * 60)} s`)
type Estado = "listo" | "corriendo" | "pausa" | "alarma" | "terminado"
const BTN = "rounded-[8px] px-3 py-2 text-[13px] font-bold transition disabled:opacity-40"
const CAMPO = "w-full rounded-[8px] border border-[#2B3648] bg-[#0F151E] px-2 py-1.5 text-[13px] text-white"

export function SimuladorTorno() {
  const [ejemploId, setEjemploId] = useState(EJEMPLOS_TORNO[0].id)
  const [codigo, setCodigo] = useState(EJEMPLOS_TORNO[0].codigo)
  const [barra, setBarra] = useState<Barra>(EJEMPLOS_TORNO[0].barra)
  const [inserto, setInserto] = useState<Inserto>(EJEMPLOS_TORNO[0].inserto)
  const [estado, setEstado] = useState<Estado>("listo")
  const [bloqueABloque, setBloqueABloque] = useState(false)
  const [vel, setVel] = useState(5)
  const [trayectoria, setTrayectoria] = useState(true)
  const [herramienta, setHerramienta] = useState<PuntoT>(INICIO_TORNO)
  const [linea, setLinea] = useState(0)
  const [version, setVersion] = useState(0)
  const [progreso, setProgreso] = useState(0)
  const [alarmaActiva, setAlarmaActiva] = useState<string | null>(null)

  const resultado = useMemo(() => interpretarTorno(codigo, barra, inserto), [codigo, barra, inserto])
  const perfil = useMemo(() => new Perfil(barra, 0.1), [barra])
  const lineaConError = useMemo(() => new Map(resultado.alarmas.filter((a) => a.nivel === "error").map((a) => [a.linea, a.mensaje])), [resultado])
  const totalLargo = useMemo(
    () => resultado.movimientos.reduce((acc, m) => acc + m.puntos.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - m.puntos[i].x, p.z - m.puntos[i].z), 0), 0),
    [resultado]
  )

  const rep = useRef({ mov: 0, punto: 1, pos: INICIO_TORNO as PuntoT, recorrido: 0, ultimaLinea: 0, revisado: -1 })
  const animando = useRef(0)
  const velRef = useRef(vel)
  velRef.current = vel
  const bloqueRef = useRef(bloqueABloque)
  bloqueRef.current = bloqueABloque
  const detener = () => cancelAnimationFrame(animando.current)

  const reiniciar = useCallback(() => {
    detener()
    perfil.reiniciar()
    rep.current = { mov: 0, punto: 1, pos: INICIO_TORNO, recorrido: 0, ultimaLinea: 0, revisado: -1 }
    setHerramienta(INICIO_TORNO)
    setLinea(0)
    setProgreso(0)
    setAlarmaActiva(null)
    setEstado("listo")
    setVersion((v) => v + 1)
  }, [perfil])

  useEffect(() => {
    reiniciar()
  }, [resultado, reiniciar])
  useEffect(() => () => detener(), [])

  const avanzar = (mm: number): Estado | "linea" | null => {
    const r = rep.current
    const movs = resultado.movimientos
    let resto = mm
    while (resto > 0) {
      const m = movs[r.mov]
      if (!m) return "terminado"
      if (r.revisado !== r.mov) {
        r.revisado = r.mov
        if (lineaConError.has(m.linea)) {
          setAlarmaActiva(`ALARMA en la línea ${m.linea}: ${lineaConError.get(m.linea)}`)
          setLinea(m.linea)
          return "alarma"
        }
      }
      if (m.linea !== r.ultimaLinea) {
        const cambio = r.ultimaLinea !== 0
        r.ultimaLinea = m.linea
        setLinea(m.linea)
        if (cambio && bloqueRef.current) return "linea"
      }
      const obj = m.puntos[r.punto]
      const d = Math.hypot(obj.x - r.pos.x, obj.z - r.pos.z)
      if (d <= resto) {
        if (m.tipo === "corte") perfil.cortar(r.pos, obj, inserto)
        r.pos = obj
        r.recorrido += d
        resto -= d
        r.punto++
        if (r.punto >= m.puntos.length) {
          r.mov++
          r.punto = 1
          if (movs[r.mov]) r.pos = movs[r.mov].puntos[0]
        }
      } else {
        const t = resto / d
        const p = { x: r.pos.x + (obj.x - r.pos.x) * t, z: r.pos.z + (obj.z - r.pos.z) * t }
        if (m.tipo === "corte") perfil.cortar(r.pos, p, inserto)
        r.pos = p
        r.recorrido += resto
        resto = 0
      }
    }
    return null
  }

  const ciclo = () => {
    if (estado === "terminado" || estado === "alarma") reiniciar()
    setEstado("corriendo")
    setAlarmaActiva(null)
    let antes = performance.now()
    const paso = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000)
      antes = ahora
      const m = resultado.movimientos[rep.current.mov]
      const parada = avanzar(((m ? m.fMin : 1) / 60) * dt * velRef.current)
      setHerramienta({ ...rep.current.pos })
      setProgreso(totalLargo ? Math.min(1, rep.current.recorrido / totalLargo) : 1)
      setVersion((v) => v + 1)
      if (parada === "terminado") return setEstado("terminado")
      if (parada === "alarma") return setEstado("alarma")
      if (parada === "linea") return setEstado("pausa")
      animando.current = requestAnimationFrame(paso)
    }
    animando.current = requestAnimationFrame(paso)
  }

  const pausar = () => {
    detener()
    setEstado("pausa")
  }

  const alFinal = () => {
    detener()
    const parada = avanzar(Number.MAX_SAFE_INTEGER)
    setHerramienta({ ...rep.current.pos })
    setProgreso(parada === "alarma" ? rep.current.recorrido / Math.max(totalLargo, 1) : 1)
    setVersion((v) => v + 1)
    setEstado(parada === "alarma" ? "alarma" : "terminado")
  }

  const cargarEjemplo = (id: string) => {
    const e = EJEMPLOS_TORNO.find((x) => x.id === id)
    if (!e) return
    setEjemploId(id)
    setBarra(e.barra)
    setInserto(e.inserto)
    setCodigo(e.codigo)
  }

  const subirArchivo = async (archivo?: File) => {
    if (!archivo) return
    if (archivo.size > 3 * 1024 * 1024) return alert("El archivo pesa más de 3 MB. Para practicar usa programas más cortos.")
    setEjemploId("")
    setCodigo(await archivo.text())
  }

  const bajar = () => {
    const url = URL.createObjectURL(new Blob([codigo], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "programa-torno-hetna.nc"
    a.click()
    URL.revokeObjectURL(url)
  }

  const m = resultado.movimientos[rep.current.mov]
  const enMarcha = estado === "corriendo" || estado === "pausa" || progreso > 0
  const ejemplo = EJEMPLOS_TORNO.find((e) => e.id === ejemploId)
  const lineaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    lineaRef.current?.querySelector(`[data-l="${linea}"]`)?.scrollIntoView({ block: "nearest" })
  }, [linea])

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3">
          <label className="text-[12px] font-semibold text-[#8A97AB]">Ejercicio de torno</label>
          <select className={CAMPO} value={ejemploId} onChange={(e) => cargarEjemplo(e.target.value)}>
            {!ejemploId && <option value="">Mi programa</option>}
            {EJEMPLOS_TORNO.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
          {ejemplo && <p className="m-0 mt-2 text-[12.5px] text-[#C9CED6]">{ejemplo.explicacion}</p>}
        </div>

        <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-white">Programa G-code (torno)</span>
            <div className="flex gap-2 text-[12px]">
              <label className="cursor-pointer font-semibold text-[#F28A3C] hover:underline">
                Abrir archivo
                <input type="file" accept=".nc,.gcode,.ngc,.tap,.cnc,.txt" className="hidden" onChange={(e) => subirArchivo(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={bajar} className="font-semibold text-[#F28A3C] hover:underline">Descargar .nc</button>
            </div>
          </div>
          {enMarcha ? (
            <div ref={lineaRef} className="h-[360px] overflow-auto rounded-[8px] border border-[#2B3648] bg-[#0B1018] font-mono text-[12.5px] leading-[1.55]">
              {resultado.lineas.map((t, i) => (
                <div key={i} data-l={i + 1} className={`flex gap-2 px-2 ${i + 1 === linea ? "bg-[#F07A1A]/25 text-white" : lineaConError.has(i + 1) ? "bg-[#B3261E]/25 text-[#FFB4AB]" : "text-[#C9CED6]"}`}>
                  <span className="w-8 shrink-0 select-none text-right text-[#5B6779]">{i + 1}</span>
                  <span className="whitespace-pre">{t || " "}</span>
                </div>
              ))}
            </div>
          ) : (
            <textarea
              value={codigo}
              onChange={(e) => {
                setEjemploId("")
                setCodigo(e.target.value)
              }}
              spellCheck={false}
              aria-label="Programa G-code de torno"
              className="h-[360px] w-full resize-y rounded-[8px] border border-[#2B3648] bg-[#0B1018] p-2 font-mono text-[12.5px] leading-[1.55] text-[#E6EAF0]"
            />
          )}
          {enMarcha && (
            <button type="button" onClick={reiniciar} className="mt-2 text-[12px] font-semibold text-[#F28A3C] hover:underline">
              Detener y editar el programa
            </button>
          )}
        </div>

        <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3">
          <span className="text-[13px] font-bold text-white">Alarmas y avisos ({resultado.alarmas.length})</span>
          {resultado.alarmas.length === 0 ? (
            <p className="m-0 mt-1 text-[12.5px] text-[#7BE0A3]">✓ Sin errores. El programa está listo para correr.</p>
          ) : (
            <ul className="m-0 mt-1 list-none space-y-1 p-0">
              {resultado.alarmas.map((a, i) => (
                <li key={i} className={`text-[12.5px] ${a.nivel === "error" ? "text-[#FFB4AB]" : "text-[#F2C94C]"}`}>
                  <b>Línea {a.linea}:</b> {a.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <Vista3D barra={barra} perfil={perfil} version={version} movimientos={resultado.movimientos} herramienta={herramienta} trayectoria={trayectoria} girando={estado === "corriendo" && !!m?.husillo} />

        {alarmaActiva && <div className="rounded-[10px] border border-[#B3261E] bg-[#B3261E]/20 px-3 py-2 text-[13px] font-semibold text-[#FFB4AB]">{alarmaActiva}</div>}
        {estado === "terminado" && !alarmaActiva && (
          <div className="rounded-[10px] border border-[#1E7B3A] bg-[#1E7B3A]/20 px-3 py-2 text-[13px] font-semibold text-[#7BE0A3]">
            Programa terminado. Material quitado: {perfil.volumenQuitado().toFixed(1)} cm³.
          </div>
        )}

        <div className="grid gap-3 rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-2">
            {estado === "corriendo" ? (
              <button type="button" onClick={pausar} className={`${BTN} bg-[#F2C94C] text-[#1B1B18]`}>⏸ Pausa</button>
            ) : (
              <button type="button" onClick={ciclo} disabled={!resultado.movimientos.length} className={`${BTN} bg-[#1E9E52] text-white`}>
                ▶ {estado === "pausa" ? "Continuar" : "Ciclo de inicio"}
              </button>
            )}
            <button type="button" onClick={alFinal} disabled={!resultado.movimientos.length} className={`${BTN} bg-white/10 text-white`}>⏭ Ver resultado</button>
            <button type="button" onClick={reiniciar} className={`${BTN} bg-white/10 text-white`}>⟲ Reiniciar</button>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[#C9CED6]">
              <input type="checkbox" checked={bloqueABloque} onChange={(e) => setBloqueABloque(e.target.checked)} /> Bloque a bloque
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[#C9CED6]">
              <input type="checkbox" checked={trayectoria} onChange={(e) => setTrayectoria(e.target.checked)} /> Trayectorias
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[#C9CED6]">
              Velocidad
              <select className="rounded-[6px] border border-[#2B3648] bg-[#0F151E] px-1 py-0.5 text-white" value={vel} onChange={(e) => setVel(Number(e.target.value))}>
                {VELOCIDADES.map((v) => (
                  <option key={v} value={v}>×{v}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 font-mono text-[13px]">
            <span className="text-[#8A97AB]">X <b className="text-white">{f3(herramienta.x * 2)}</b></span>
            <span className="text-[#8A97AB]">Z <b className="text-white">{f3(herramienta.z)}</b></span>
            <span className="text-[#8A97AB]">T <b className="text-white">{m ? String(m.herramienta).padStart(2, "0") : "—"}</b></span>
            <span className="text-[#8A97AB]">RPM <b className="text-white">{m?.husillo ? Math.round(m.rpm) : 0}</b></span>
            <span className="text-[#8A97AB]">F <b className="text-white">{m && m.tipo === "corte" ? `${Math.round(m.fMin)}/min` : "—"}</b></span>
            <span className="text-[#8A97AB]">Husillo <b className={m?.husillo ? "text-[#7BE0A3]" : "text-white"}>{m?.husillo ? "ON" : "OFF"}</b></span>
          </div>
          <div className="lg:col-span-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[#F07A1A]" style={{ width: `${Math.round(progreso * 100)}%` }} />
            </div>
            <p className="m-0 mt-1 text-[12px] text-[#8A97AB]">
              Línea {linea || "—"} · {Math.round(progreso * 100)}% · Tiempo estimado del programa: {minutos(resultado.tiempoMin)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3 sm:grid-cols-2">
          <div>
            <span className="text-[13px] font-bold text-white">Barra (mm)</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="text-[11.5px] text-[#8A97AB]">
                Diámetro
                <input type="number" min={2} className={CAMPO} value={barra.diametro} onChange={(e) => setBarra({ ...barra, diametro: Math.max(2, Math.min(400, Number(e.target.value) || 2)) })} />
              </label>
              <label className="text-[11.5px] text-[#8A97AB]">
                Largo fuera del chuck
                <input type="number" min={5} className={CAMPO} value={barra.largo} onChange={(e) => setBarra({ ...barra, largo: Math.max(5, Math.min(600, Number(e.target.value) || 5)) })} />
              </label>
            </div>
            <p className="m-0 mt-1 text-[11.5px] text-[#8A97AB]">Z0 = cara de la pieza. X se programa en diámetro.</p>
          </div>
          <div>
            <span className="text-[13px] font-bold text-white">Inserto</span>
            <label className="mt-1 block text-[11.5px] text-[#8A97AB]">
              Radio de punta (mm)
              <select className={CAMPO} value={inserto.radioPunta} onChange={(e) => setInserto({ radioPunta: Number(e.target.value) })}>
                {[0.2, 0.4, 0.8, 1.2].map((r) => (
                  <option key={r} value={r}>R{r}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}
