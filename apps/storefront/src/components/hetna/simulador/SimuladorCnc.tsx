"use client"

// Simulador CNC de la Academia HETNA (fresadora / router 3 ejes).
// Escribes o subes G-code, la máquina virtual lo corre y ves en 3D cómo la
// fresa quita el material. Panel como el de una máquina: ciclo de inicio,
// pausa, bloque a bloque, velocidad y coordenadas. Si el programa tiene un
// error, la máquina se detiene en esa línea con la alarma, como la de verdad.
// Todo corre en el navegador: el programa no sale de tu computadora.
import { T } from "@/components/hetna/i18n/Idioma"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { EJEMPLOS } from "@/lib/simulador/ejemplos"
import { interpretar, VELOCIDAD_RAPIDO, Z_SEGURA, type Material, type Punto } from "@/lib/simulador/gcode"
import { Bloque, type Fresa } from "@/lib/simulador/material"

const Vista3D = dynamic(() => import("./Vista3DSimulador"), {
  ssr: false,
  loading: () => <div className="grid h-[520px] place-items-center rounded-[12px] border border-[#2B3648] text-[13px] text-[#8A97AB]"><T>Cargando vista 3D…</T></div>,
})

const VELOCIDADES = [1, 2, 5, 10, 25, 100]
const INICIO: Punto = { x: 0, y: 0, z: Z_SEGURA }
const f3 = (n: number) => (Math.abs(n) < 0.0005 ? "0.000" : n.toFixed(3))
const minutos = (m: number) => (m < 1 ? `${Math.round(m * 60)} s` : `${Math.floor(m)} min ${Math.round((m % 1) * 60)} s`)

type Estado = "listo" | "corriendo" | "pausa" | "alarma" | "terminado"

const BTN = "rounded-[8px] px-3 py-2 text-[13px] font-bold transition disabled:opacity-40"
const CAMPO = "w-full rounded-[8px] border border-[#2B3648] bg-[#0F151E] px-2 py-1.5 text-[13px] text-white"

export type InicialFresa = { clave: number; codigo: string; material: Material; fresa: Fresa }

export function SimuladorCnc({ inicial, alCambiarCodigo, aviso }: { inicial?: InicialFresa; alCambiarCodigo?: (codigo: string) => void; aviso?: React.ReactNode } = {}) {
  const [ejemploId, setEjemploId] = useState(EJEMPLOS[0].id)
  const [codigo, setCodigo] = useState(EJEMPLOS[0].codigo)
  const [material, setMaterial] = useState<Material>(EJEMPLOS[0].material)
  const [fresa, setFresa] = useState<Fresa>(EJEMPLOS[0].fresa)
  const [estado, setEstado] = useState<Estado>("listo")
  const [bloqueABloque, setBloqueABloque] = useState(false)
  const [vel, setVel] = useState(5)
  const [trayectoria, setTrayectoria] = useState(true)
  const [herramienta, setHerramienta] = useState<Punto>(INICIO)
  const [linea, setLinea] = useState(0)
  const [version, setVersion] = useState(0)
  const [progreso, setProgreso] = useState(0)
  const [alarmaActiva, setAlarmaActiva] = useState<string | null>(null)

  // Un ejercicio manda su programa, material y fresa
  useEffect(() => {
    if (!inicial) return
    setEjemploId("")
    setMaterial(inicial.material)
    setFresa(inicial.fresa)
    setCodigo(inicial.codigo)
  }, [inicial?.clave]) // eslint-disable-line react-hooks/exhaustive-deps
  // Avisa los cambios del programa (para guardarlo en el ejercicio), pero sólo
  // después de haber cargado el del ejercicio: si no, lo pisaría el de ejemplo
  const alCambiarRef = useRef(alCambiarCodigo)
  alCambiarRef.current = alCambiarCodigo
  const cargado = useRef(false)
  useEffect(() => {
    cargado.current = false
  }, [inicial?.clave])
  useEffect(() => {
    if (!inicial) return
    if (!cargado.current) {
      if (codigo === inicial.codigo) cargado.current = true
      return
    }
    alCambiarRef.current?.(codigo)
  }, [codigo]) // eslint-disable-line react-hooks/exhaustive-deps

  const resultado = useMemo(() => interpretar(codigo, material), [codigo, material])
  const bloque = useMemo(() => new Bloque(material), [material])
  const errores = resultado.alarmas.filter((a) => a.nivel === "error")
  const lineaConError = useMemo(() => new Map(errores.map((a) => [a.linea, a.mensaje])), [errores])
  const totalLargo = useMemo(
    () => resultado.movimientos.reduce((acc, m) => acc + m.puntos.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - m.puntos[i].x, p.y - m.puntos[i].y, p.z - m.puntos[i].z), 0), 0),
    [resultado]
  )

  // Estado de la reproducción (en refs para no redibujar en cada paso)
  const rep = useRef({ mov: 0, punto: 1, pos: INICIO as Punto, recorrido: 0, ultimaLinea: 0, revisado: -1 })
  const animando = useRef(0)
  const velRef = useRef(vel)
  velRef.current = vel
  const bloqueRef = useRef(bloqueABloque)
  bloqueRef.current = bloqueABloque

  const detener = () => cancelAnimationFrame(animando.current)

  const reiniciar = useCallback(() => {
    detener()
    bloque.reiniciar()
    rep.current = { mov: 0, punto: 1, pos: INICIO, recorrido: 0, ultimaLinea: 0, revisado: -1 }
    setHerramienta(INICIO)
    setLinea(0)
    setProgreso(0)
    setAlarmaActiva(null)
    setEstado("listo")
    setVersion((v) => v + 1)
  }, [bloque])

  // Cambiar el programa, el material o la fresa reinicia la máquina
  useEffect(() => {
    reiniciar()
  }, [resultado, fresa, reiniciar])
  useEffect(() => () => detener(), [])

  /** Avanza `mm` milímetros de trayectoria. Regresa por qué se detuvo, si se detuvo. */
  const avanzar = (mm: number): Estado | "linea" | null => {
    const r = rep.current
    const movs = resultado.movimientos
    let resto = mm
    while (resto > 0) {
      const m = movs[r.mov]
      if (!m) return "terminado"
      // Al empezar cada movimiento: si su línea tiene error, la máquina se detiene ahí
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
      const objetivo = m.puntos[r.punto]
      const d = Math.hypot(objetivo.x - r.pos.x, objetivo.y - r.pos.y, objetivo.z - r.pos.z)
      if (d <= resto) {
        if (m.tipo === "corte") bloque.cortar(r.pos, objetivo, fresa)
        r.pos = objetivo
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
        const p = { x: r.pos.x + (objetivo.x - r.pos.x) * t, y: r.pos.y + (objetivo.y - r.pos.y) * t, z: r.pos.z + (objetivo.z - r.pos.z) * t }
        if (m.tipo === "corte") bloque.cortar(r.pos, p, fresa)
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
      const avance = m ? (m.tipo === "rapido" ? VELOCIDAD_RAPIDO : Math.max(m.f, 1)) : 1
      const parada = avanzar((avance / 60) * dt * velRef.current)
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
    const e = EJEMPLOS.find((x) => x.id === id)
    if (!e) return
    setEjemploId(id)
    setMaterial(e.material)
    setFresa(e.fresa)
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
    a.download = "programa-hetna.nc"
    a.click()
    URL.revokeObjectURL(url)
  }

  const m = resultado.movimientos[rep.current.mov]
  const enMarcha = estado === "corriendo" || estado === "pausa" || progreso > 0
  const ejemplo = EJEMPLOS.find((e) => e.id === ejemploId)
  const lineaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    lineaRef.current?.querySelector(`[data-l="${linea}"]`)?.scrollIntoView({ block: "nearest" })
  }, [linea])

  const numMaterial = (k: "ancho" | "largo" | "alto", v: string) => {
    const n = Math.max(1, Math.min(2000, Number(v) || 1))
    setMaterial({ ...material, [k]: n })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      {/* Programa */}
      <section className="flex min-w-0 flex-col gap-3">
        {aviso}
        <div className={`rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3 ${aviso ? "hidden" : ""}`}>
          <label className="text-[12px] font-semibold text-[#8A97AB]"><T>Ejercicio</T></label>
          <select className={CAMPO} value={ejemploId} onChange={(e) => cargarEjemplo(e.target.value)}>
            {!ejemploId && <option value="">Mi programa</option>}
            {EJEMPLOS.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
          {ejemplo && <p className="m-0 mt-2 text-[12.5px] text-[#C9CED6]">{ejemplo.explicacion}</p>}
        </div>

        <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-white"><T>Programa G-code</T></span>
            <div className="flex gap-2 text-[12px]">
              <label className="cursor-pointer font-semibold text-[#F28A3C] hover:underline">
                <T>Abrir archivo</T>
                <input type="file" accept=".nc,.gcode,.ngc,.tap,.cnc,.txt" className="hidden" onChange={(e) => subirArchivo(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={bajar} className="font-semibold text-[#F28A3C] hover:underline"><T>Descargar .nc</T></button>
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
              aria-label="Programa G-code"
              className="h-[360px] w-full resize-y rounded-[8px] border border-[#2B3648] bg-[#0B1018] p-2 font-mono text-[12.5px] leading-[1.55] text-[#E6EAF0]"
            />
          )}
          {enMarcha && (
            <button type="button" onClick={reiniciar} className="mt-2 text-[12px] font-semibold text-[#F28A3C] hover:underline">
              <T>Detener y editar el programa</T>
            </button>
          )}
        </div>

        <div className="rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3">
          <span className="text-[13px] font-bold text-white"><T>Alarmas y avisos (</T>{resultado.alarmas.length})</span>
          {resultado.alarmas.length === 0 ? (
            <p className="m-0 mt-1 text-[12.5px] text-[#7BE0A3]"><T>✓ Sin errores. El programa está listo para correr.</T></p>
          ) : (
            <ul className="m-0 mt-1 list-none space-y-1 p-0">
              {resultado.alarmas.map((a, i) => (
                <li key={i} className={`text-[12.5px] ${a.nivel === "error" ? "text-[#FFB4AB]" : "text-[#F2C94C]"}`}>
                  <b><T>Línea</T> {a.linea}:</b> <T>{a.mensaje}</T>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Máquina */}
      <section className="flex min-w-0 flex-col gap-3">
        <Vista3D material={material} fresa={fresa} bloque={bloque} version={version} movimientos={resultado.movimientos} herramienta={herramienta} trayectoria={trayectoria} />

        {alarmaActiva && <div className="rounded-[10px] border border-[#B3261E] bg-[#B3261E]/20 px-3 py-2 text-[13px] font-semibold text-[#FFB4AB]">{alarmaActiva}</div>}
        {estado === "terminado" && !alarmaActiva && (
          <div className="rounded-[10px] border border-[#1E7B3A] bg-[#1E7B3A]/20 px-3 py-2 text-[13px] font-semibold text-[#7BE0A3]">
            <T>Programa terminado. Material quitado:</T> {bloque.volumenQuitado().toFixed(1)} <T>cm³.</T>
          </div>
        )}

        <div className="grid gap-3 rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3 lg:grid-cols-[1fr_auto]">
          {/* Panel de control */}
          <div className="flex flex-wrap items-center gap-2">
            {estado === "corriendo" ? (
              <button type="button" onClick={pausar} className={`${BTN} bg-[#F2C94C] text-[#1B1B18]`}><T>⏸ Pausa</T></button>
            ) : (
              <button type="button" onClick={ciclo} disabled={!resultado.movimientos.length} className={`${BTN} bg-[#1E9E52] text-white`}>
                ▶ {estado === "pausa" ? "Continuar" : "Ciclo de inicio"}
              </button>
            )}
            <button type="button" onClick={alFinal} disabled={!resultado.movimientos.length} className={`${BTN} bg-white/10 text-white`}><T>⏭ Ver resultado</T></button>
            <button type="button" onClick={reiniciar} className={`${BTN} bg-white/10 text-white`}><T>⟲ Reiniciar</T></button>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[#C9CED6]">
              <input type="checkbox" checked={bloqueABloque} onChange={(e) => setBloqueABloque(e.target.checked)} /> <T>Bloque a bloque</T>
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[#C9CED6]">
              <input type="checkbox" checked={trayectoria} onChange={(e) => setTrayectoria(e.target.checked)} /> <T>Trayectorias</T>
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[#C9CED6]">
              <T>Velocidad</T>
              <select className="rounded-[6px] border border-[#2B3648] bg-[#0F151E] px-1 py-0.5 text-white" value={vel} onChange={(e) => setVel(Number(e.target.value))}>
                {VELOCIDADES.map((v) => (
                  <option key={v} value={v}>×{v}</option>
                ))}
              </select>
            </label>
          </div>
          {/* Coordenadas */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 font-mono text-[13px]">
            <span className="text-[#8A97AB]">X <b className="text-white">{f3(herramienta.x)}</b></span>
            <span className="text-[#8A97AB]">Y <b className="text-white">{f3(herramienta.y)}</b></span>
            <span className="text-[#8A97AB]">Z <b className="text-white">{f3(herramienta.z)}</b></span>
            <span className="text-[#8A97AB]">F <b className="text-white">{m && m.tipo === "corte" ? Math.round(m.f) : "—"}</b></span>
            <span className="text-[#8A97AB]">S <b className="text-white">{m ? m.s : 0}</b></span>
            <span className="text-[#8A97AB]"><T>Husillo</T> <b className={m?.husillo ? "text-[#7BE0A3]" : "text-white"}>{m?.husillo ? "ON" : "OFF"}</b></span>
          </div>
          <div className="lg:col-span-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[#F07A1A]" style={{ width: `${Math.round(progreso * 100)}%` }} />
            </div>
            <p className="m-0 mt-1 text-[12px] text-[#8A97AB]">
              <T>Línea</T> {linea || "—"} · {Math.round(progreso * 100)}<T>% · Tiempo estimado del programa:</T> {minutos(resultado.tiempoMin)}
            </p>
          </div>
        </div>

        {/* Material y fresa */}
        <div className="grid gap-3 rounded-[12px] border border-[#2B3648] bg-[#121A26] p-3 sm:grid-cols-2">
          <div>
            <span className="text-[13px] font-bold text-white"><T>Material (mm)</T></span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["ancho", "largo", "alto"] as const).map((k) => (
                <label key={k} className="text-[11.5px] text-[#8A97AB]">
                  {k === "ancho" ? "Ancho X" : k === "largo" ? "Largo Y" : "Espesor Z"}
                  <input type="number" min={1} className={CAMPO} value={material[k]} onChange={(e) => numMaterial(k, e.target.value)} />
                </label>
              ))}
            </div>
            <label className="mt-2 block text-[11.5px] text-[#8A97AB]">
              <T>Cero de pieza (X0 Y0); Z0 = cara de arriba</T>
              <select className={CAMPO} value={material.cero} onChange={(e) => setMaterial({ ...material, cero: e.target.value as Material["cero"] })}>
                <option value="esquina">Esquina inferior izquierda</option>
                <option value="centro">Centro de la pieza</option>
              </select>
            </label>
          </div>
          <div>
            <span className="text-[13px] font-bold text-white"><T>Fresa</T></span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="text-[11.5px] text-[#8A97AB]">
                <T>Tipo</T>
                <select className={CAMPO} value={fresa.tipo} onChange={(e) => setFresa({ ...fresa, tipo: e.target.value as Fresa["tipo"] })}>
                  <option value="plana">Plana (recta)</option>
                  <option value="bola">Punta de bola</option>
                  <option value="v">En V (grabado)</option>
                </select>
              </label>
              <label className="text-[11.5px] text-[#8A97AB]">
                <T>Diámetro (mm)</T>
                <input type="number" min={0.5} step={0.1} className={CAMPO} value={fresa.diametro} onChange={(e) => setFresa({ ...fresa, diametro: Math.max(0.5, Math.min(50, Number(e.target.value) || 1)) })} />
              </label>
              {fresa.tipo === "v" && (
                <label className="text-[11.5px] text-[#8A97AB]">
                  <T>Ángulo (°)</T>
                  <input type="number" min={10} max={150} className={CAMPO} value={fresa.angulo || 60} onChange={(e) => setFresa({ ...fresa, angulo: Math.max(10, Math.min(150, Number(e.target.value) || 60)) })} />
                </label>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
