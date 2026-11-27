"use client"

// Patrones paramétricos 3D: subes tu modelo (STL u OBJ: una maceta, un
// florero, una pantalla…) o empiezas con uno de los nuestros, y le das un
// patrón en la superficie (ondas, espiral, estrías, rombos, panal, Voronoi,
// burbujas, orgánico) y una torsión. Se mueve un número y todo se recalcula.
// Sale el STL para imprimir y, para router CNC, el patrón desenrollado como
// relieve plano o el modelo al CAM. Motor: lib/generador/parametrico.ts.
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"

import { BotonesCam } from "./BotonesCam"
import { Aviso, Boton, CampoNum, Datos, Etiqueta, Seccion, TarjetaExport, descargar, numero, r1 } from "@/components/hetna/estudio3d/Controles"
import { mandarAFabricar } from "@/lib/generador/aCotizador"
import {
  aplicarPatron,
  caraExterior,
  ejeDe,
  type MallaSoldada,
  MODELOS_INICIO,
  type ModeloInicio,
  modeloInicio,
  PATRONES,
  type PatronId,
  pasoPara,
  refinar,
  relievePlano,
  soldar,
} from "@/lib/generador/parametrico"
import { leerOBJ, leerSTL, mallaSTL } from "@/lib/generador/vectores"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })

const MAX_MB = 60
const botonSel = (activo: boolean) =>
  `rounded-[8px] px-1.5 py-2 text-[12px] font-semibold ${activo ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`

type Fuente = { tipo: "inicio"; id: ModeloInicio } | { tipo: "archivo"; nombre: string; tris: number[] }

/** Pone el modelo de pie: el eje que el usuario dice que es "arriba" pasa a Z. */
function deArriba(tris: number[], arriba: "z" | "y" | "x"): number[] {
  if (arriba === "z") return tris
  const out = new Array<number>(tris.length)
  for (let i = 0; i < tris.length; i += 3) {
    const [x, y, z] = [tris[i], tris[i + 1], tris[i + 2]]
    if (arriba === "y") {
      out[i] = x
      out[i + 1] = -z
      out[i + 2] = y
    } else {
      out[i] = -z
      out[i + 1] = y
      out[i + 2] = x
    }
  }
  return out
}

export function GeneradorParametrico() {
  const { locale } = useParams<{ locale: string }>()
  const [fuente, setFuente] = useState<Fuente>({ tipo: "inicio", id: "florero" })
  const [arriba, setArriba] = useState<"z" | "y" | "x">("z")
  const [escala, setEscala] = useState("100")
  const [patron, setPatron] = useState<PatronId>("voronoi")
  const [tamano, setTamano] = useState("12")
  const [profundidad, setProfundidad] = useState("1.5")
  const [torsion, setTorsion] = useState("0")
  const [margenArriba, setMargenArriba] = useState("6")
  const [margenAbajo, setMargenAbajo] = useState("6")
  const [soloExterior, setSoloExterior] = useState(true)
  const [semilla, setSemilla] = useState(1)
  const [preparada, setPreparada] = useState<MallaSoldada | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")

  // /disenar/patrones-3d?patron=panal&modelo=pantalla
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const p = q.get("patron"), m = q.get("modelo")
    if (p && PATRONES.some((x) => x.id === p)) setPatron(p as PatronId)
    if (m && MODELOS_INICIO.some((x) => x.id === m)) setFuente({ tipo: "inicio", id: m as ModeloInicio })
  }, [])

  const subir = async (f: File | undefined) => {
    if (!f) return
    setError("")
    const ext = f.name.split(".").pop()?.toLowerCase()
    if (f.size > MAX_MB * 1024 * 1024) return setError(`El archivo pesa más de ${MAX_MB} MB.`)
    try {
      const m = ext === "stl" ? leerSTL(await f.arrayBuffer()) : ext === "obj" ? leerOBJ(await f.text()) : null
      if (!m || m.tris.length < 36) throw new Error()
      setFuente({ tipo: "archivo", nombre: f.name, tris: Array.from(m.tris) })
    } catch {
      setError("No se pudo leer el archivo. Sube un STL u OBJ de una sola pieza cerrada.")
    }
  }

  // 1) modelo base → soldado y refinado (lo pesado; sólo cuando cambia el modelo o el tamaño del patrón)
  const tam = Math.max(3, Math.min(80, numero(tamano) || 12))
  const pasoRef = pasoPara(tam)
  useEffect(() => {
    let vivo = true
    setTrabajando(true)
    setError("")
    const t = setTimeout(() => {
      try {
        const k = Math.max(0.3, Math.min(3, (numero(escala) || 100) / 100))
        let tris = fuente.tipo === "inicio" ? modeloInicio(fuente.id, k) : deArriba(fuente.tris, arriba)
        if (fuente.tipo === "archivo" && k !== 1) tris = tris.map((v) => v * k)
        const s = soldar(tris)
        const [cx, cy] = ejeDe(s)
        const r = refinar(s, pasoRef, 700_000, caraExterior(cx, cy))
        if (vivo) setPreparada(r)
      } catch {
        if (vivo) setError("No se pudo preparar el modelo.")
      } finally {
        if (vivo) setTrabajando(false)
      }
    }, 30)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [fuente, arriba, escala, pasoRef])

  // 2) patrón (rápido: se recalcula con cada número)
  const opciones = {
    patron,
    tamano: tam,
    profundidad: Math.max(-6, Math.min(6, numero(profundidad) || 0)),
    margenArriba: Math.max(0, numero(margenArriba) || 0),
    margenAbajo: Math.max(0, numero(margenAbajo) || 0),
    soloExterior,
    torsion: Math.max(-360, Math.min(360, numero(torsion) || 0)),
    semilla,
  }
  const r = useMemo(() => (preparada ? aplicarPatron(preparada, opciones) : null), [preparada, patron, tam, profundidad, margenArriba, margenAbajo, soloExterior, torsion, semilla]) // eslint-disable-line react-hooks/exhaustive-deps
  const nombreBase = fuente.tipo === "inicio" ? MODELOS_INICIO.find((m) => m.id === fuente.id)?.nombre || "modelo" : fuente.nombre.replace(/\.(stl|obj)$/i, "")
  const archivo = `${String(nombreBase).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${patron}-hetna`
  const medidas = r ? `${r1(r.medidas[0])} × ${r1(r.medidas[1])} × ${r1(r.medidas[2])} mm` : ""
  const listo = !!r && !trabajando

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Modelo">
        <div className="grid grid-cols-2 gap-1.5">
          {MODELOS_INICIO.map((m) => (
            <button key={m.id} type="button" onClick={() => setFuente({ tipo: "inicio", id: m.id })} aria-pressed={fuente.tipo === "inicio" && fuente.id === m.id} className={botonSel(fuente.tipo === "inicio" && fuente.id === m.id)}>
              {m.nombre}
            </button>
          ))}
        </div>
        <label className="mt-2 flex flex-col gap-1.5">
          <Etiqueta>O sube el tuyo (STL u OBJ)</Etiqueta>
          <input type="file" accept=".stl,.obj" onChange={(e) => subir(e.target.files?.[0])} className="text-[13px] text-[#C9D2E0]" />
          {fuente.tipo === "archivo" && <span className="text-[11.5px] text-[#8A97AB]">Cargado: {fuente.nombre}</span>}
        </label>
        {fuente.tipo === "archivo" && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(["z", "y", "x"] as const).map((e) => (
              <button key={e} type="button" onClick={() => setArriba(e)} aria-pressed={arriba === e} className={botonSel(arriba === e)}>
                Arriba es {e.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 w-1/2">
          <CampoNum etiqueta="Escala (%)" valor={escala} cambiar={setEscala} sufijo="%" />
        </div>
      </Seccion>

      <Seccion titulo="Patrón">
        <div className="grid grid-cols-2 gap-1.5">
          {PATRONES.map((p) => (
            <button key={p.id} type="button" onClick={() => setPatron(p.id)} aria-pressed={patron === p.id} title={p.nota} className={botonSel(patron === p.id)}>
              {p.nombre}
            </button>
          ))}
        </div>
        {(patron === "voronoi" || patron === "organico") && (
          <button type="button" onClick={() => setSemilla((s) => s + 1)} className="mt-2 w-full rounded-[8px] bg-[#1C2431] py-2 text-[12px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
            Otra variación
          </button>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Tamaño de la celda" valor={tamano} cambiar={setTamano} />
          <CampoNum etiqueta="Profundidad (− hunde)" valor={profundidad} cambiar={setProfundidad} />
          <CampoNum etiqueta="Torsión" valor={torsion} cambiar={setTorsion} sufijo="°" />
        </div>
      </Seccion>

      <Seccion titulo="Dónde va" nota="El patrón se queda en la cara de afuera; arriba y abajo quedan lisos para que asiente y se vea limpio el borde.">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Liso arriba" valor={margenArriba} cambiar={setMargenArriba} />
          <CampoNum etiqueta="Liso abajo" valor={margenAbajo} cambiar={setMargenAbajo} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-[13px] text-[#C9D2E0]">
          <input type="checkbox" checked={soloExterior} onChange={(e) => setSoloExterior(e.target.checked)} className="accent-[#C2560A]" />
          Sólo por fuera (no tocar el interior)
        </label>
      </Seccion>

      {trabajando && <Aviso>Preparando el modelo…</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {listo && r!.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
    </div>
  )

  const diseno2d = (
    <div className="flex h-full flex-col gap-3 p-4">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#8A97AB]">{trabajando ? "Preparando el modelo…" : "Elige o sube un modelo."}</p>
      ) : (
        <>
          <Datos
            filas={[
              ["Modelo", String(nombreBase)],
              ["Medidas", medidas],
              ["Patrón", `${PATRONES.find((p) => p.id === patron)?.nombre} · ${r!.celdas} celdas por vuelta`],
              ["Malla", `${Math.round(r!.tris.length / 9).toLocaleString("es-MX")} triángulos`],
            ]}
          />
          <p className="m-0 text-[13px] text-[#8A97AB]">Mira el resultado en la Vista 3D. El patrón cierra exacto alrededor: el número de celdas por vuelta se ajusta al tamaño que pides.</p>
        </>
      )}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Elige o sube un modelo para generar los archivos.</p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <h3 className="m-0 text-[18px] font-bold">Archivos</h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]">STL en milímetros. Tu archivo no sale de tu navegador.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaExport titulo="Para impresión 3D" nota="El modelo con el patrón. Los relieves de menos de 0.8 mm casi no se ven en una impresora de filamento.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${archivo}.stl`, mallaSTL({ tris: r!.tris, avisos: [] }), "model/stl")}>
              STL
            </Boton>
          </div>
        </TarjetaExport>
        <TarjetaExport titulo="Para router CNC: relieve plano" nota={`El mismo patrón desenrollado: una placa de ${r1(r!.vuelta)} × ${r1(r!.medidas[2])} mm para tallar en 3D (panel, puerta, cabecera).`}>
          <div className="flex gap-2">
            <Boton onClick={() => descargar(`${archivo}-relieve-plano.stl`, mallaSTL({ tris: relievePlano(opciones, r!.vuelta, r!.medidas[2], 3, Math.min(1.5, Math.max(0.5, tam / 16))), avisos: [] }), "model/stl")}>STL</Boton>
          </div>
        </TarjetaExport>
      </div>
      <TarjetaExport titulo="Maquinar en tu router" nota="Se abre en el CAM de HETNA (3 a 5 ejes): eliges máquina y herramienta y bajas el G-code.">
        <BotonesCam nombre={archivo} stl={() => mallaSTL({ tris: r!.tris, avisos: [] })} />
      </TarjetaExport>
      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold">¿No tienes impresora 3D?</span>
        <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA lo imprime y te lo envía.</span>
        <div className="flex gap-2">
          <Boton
            tipo="primario"
            onClick={() => {
              const ok = mandarAFabricar(`${archivo}.stl`, mallaSTL({ tris: r!.tris, avisos: [] }), locale, { pieza: `${nombreBase} con patrón ${PATRONES.find((p) => p.id === patron)?.nombre}`, medidas, proceso: "Impresión 3D" })
              if (!ok) setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
            }}
          >
            Imprimir en 3D
          </Boton>
        </div>
      </div>
      {aviso && <Aviso tipo="error">{aviso}</Aviso>}
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo={String(nombreBase)}
      subtitulo="Patrones paramétricos 3D"
      materialInicial="naranja"
      tris={listo ? r!.tris : undefined}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={[]}
      barra={listo ? <span>· {PATRONES.find((p) => p.id === patron)?.nombre} · {r!.celdas} celdas por vuelta</span> : null}
    />
  )
}
