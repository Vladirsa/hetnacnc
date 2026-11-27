"use client"

// Partir modelo 3D (hetnacnc.com/mx/disenar/partir-3d): un modelo que no cabe
// en la impresora se parte en piezas con conectores (pernos, perno integrado o
// imanes) y se descargan las piezas en STL o en un ZIP. Todo en el navegador.
import { T } from "@/components/hetna/i18n/Idioma"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"

import { leerOBJ, leerSTL, mallaSTL, medidasMalla, type Malla } from "@/lib/generador/vectores"
import { EjemplosPartir } from "./EjemplosPartir"
import { mandarArchivosAFabricar, mandarPaqueteACotizador } from "@/lib/generador/aCotizador"
import { OPCIONES_BASE, cabe, cortesParaCama, partir, type Corte, type Eje, type Resultado, type TipoConector } from "@/lib/generador/partir3d"

const Vista = dynamic(() => import("./Partir3DVista"), { ssr: false, loading: () => <div className="w-full h-[460px] rounded-[12px] bg-[#0F151E]" /> })

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522217076014"
const LIMITE = 60 * 1024 * 1024
const EJES = ["X", "Y", "Z"] as const
const numero = (s: string) => parseFloat((s || "").replace(",", "."))
const r1 = (x: number) => Math.round(x * 10) / 10

const IMPRESORAS: { nombre: string; cama: [number, number, number] }[] = [
  { nombre: "Ender 3 / V2 / S1", cama: [220, 220, 250] },
  { nombre: "Bambu A1 / P1S / X1", cama: [256, 256, 256] },
  { nombre: "Bambu A1 mini", cama: [180, 180, 180] },
  { nombre: "Prusa MK4 / MK3S", cama: [250, 210, 220] },
  { nombre: "Prusa Mini", cama: [180, 180, 180] },
  { nombre: "Elegoo Neptune 4", cama: [225, 225, 265] },
  { nombre: "Creality K1", cama: [220, 220, 250] },
]

const CONECTORES: { id: TipoConector; nombre: string; nota: string }[] = [
  { id: "pernos", nombre: "Pernos", nota: "Agujeros en las dos caras y pernos sueltos que imprimes aparte. Lo más fácil de imprimir." },
  { id: "integrado", nombre: "Perno integrado", nota: "Cada pieza trae su perno pegado y la otra el agujero. Sin piezas sueltas." },
  { id: "imanes", nombre: "Imanes", nota: "Huecos para imanes de neodimio: las piezas se arman y se separan." },
  { id: "ninguno", nombre: "Sin conector", nota: "Caras planas para pegar con pegamento." },
]

function descargar(nombre: string, contenido: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const Opcion = ({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-2 rounded-[8px] text-[13px] font-semibold border ${activa ? "bg-[#142033] text-white border-[#142033]" : "bg-white text-[#1B1B18] border-[#E7E4DC] hover:border-[#C2560A]"}`}
  >
    {children}
  </button>
)

const Numero = ({ etiqueta, valor, cambiar, sufijo = "mm" }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo?: string }) => (
  <label className="flex flex-col gap-1 min-w-0">
    <span className="text-[12px] font-semibold text-[#6B6A63]"><T>{etiqueta}</T></span>
    <span className="flex items-center bg-white border border-[#E7E4DC] rounded-[10px] focus-within:border-[#C2560A]">
      <input type="text" inputMode="decimal" value={valor} onChange={(e) => cambiar(e.target.value)} className="w-full min-w-0 px-2.5 py-2 text-[15px] text-[#1B1B18] bg-transparent outline-none" />
      <span className="pr-2.5 text-[12px] text-[#9A978C]">{sufijo}</span>
    </span>
  </label>
)

export function GeneradorPartir3D() {
  const { locale } = useParams<{ locale: string }>()
  const [nombre, setNombre] = useState("")
  const [malla, setMalla] = useState<Malla | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [cargando, setCargando] = useState("")
  const [impresora, setImpresora] = useState(0)
  const [cama, setCama] = useState(["220", "220", "250"])
  const [cortes, setCortes] = useState<Corte[]>([])
  const [conector, setConector] = useState<TipoConector>("pernos")
  const [diametro, setDiametro] = useState("5")
  const [largo, setLargo] = useState("12")
  const [holgura, setHolgura] = useState("0.2")
  const [imanD, setImanD] = useState("6")
  const [imanH, setImanH] = useState("3")
  const [res, setRes] = useState<Resultado | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [separar, setSeparar] = useState(20)
  const [porUnion, setPorUnion] = useState(0) // 0 = automático
  const [vista, setVista] = useState<"piezas" | "cortes">("piezas")
  const [ejeToque, setEjeToque] = useState<Eje>(2)
  const turno = useRef(0)

  const med = useMemo(() => (malla ? medidasMalla(malla) : null), [malla])
  const caja = useMemo(() => {
    if (!malla) return null
    let a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity]
    const t = malla.tris
    for (let i = 0; i < t.length; i += 3) for (let e = 0; e < 3; e++) { a[e] = Math.min(a[e], t[i + e]); b[e] = Math.max(b[e], t[i + e]) }
    return { min: a, max: b }
  }, [malla])
  const camaN = cama.map(numero) as [number, number, number]
  const camaOk = camaN.every((v) => v >= 30 && v <= 2000)
  const margen = conector === "integrado" ? 4 + Math.min(numero(largo) / 2 || 6, 10) : 4

  const repartir = (c = camaN) => {
    if (!caja || !c.every((v) => v >= 30)) return
    setCortes(cortesParaCama(caja.min, caja.max, c, margen))
  }

  const abrir = async (f: File | undefined) => {
    setError("")
    setAviso("")
    if (!f) return
    if (f.size > LIMITE) { setError("El archivo pesa más de 60 MB."); return }
    const ext = (f.name.split(".").pop() || "").toLowerCase()
    setCargando(ext === "step" || ext === "stp" ? "Abriendo el STEP con el motor CAD (la primera vez baja ~23 MB)..." : "Leyendo archivo...")
    try {
      let m: Malla
      if (ext === "stl") m = leerSTL(await f.arrayBuffer())
      else if (ext === "obj") m = leerOBJ(await f.text())
      else if (ext === "step" || ext === "stp") m = (await (await import("@/lib/generador/step")).leerSTEP(f, "normal")).malla
      else { setError("Formato no compatible. Sube un STL, OBJ o STEP."); return }
      if (m.tris.length < 36) { setError("El archivo no trae un modelo 3D."); return }
      setNombre(f.name.replace(/\.[^.]+$/, ""))
      setRes(null)
      setMalla(m)
    } catch (e) {
      setError(ext === "step" || ext === "stp" ? (e as Error).message : "No pude leer el archivo. Revisa que no esté dañado.")
    } finally {
      setCargando("")
    }
  }

  // Al abrir un modelo: cortes repartidos para la impresora elegida
  useEffect(() => {
    repartir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caja])

  // Parte el modelo (con una pausa corta para no recalcular a cada tecla)
  useEffect(() => {
    if (!malla) return
    const n = ++turno.current
    setCalculando(true)
    const reloj = setTimeout(async () => {
      try {
        const r = await partir(malla, {
          cortes,
          conector,
          diametro: numero(diametro) || OPCIONES_BASE.diametro,
          largo: numero(largo) || OPCIONES_BASE.largo,
          holgura: Number.isFinite(numero(holgura)) ? numero(holgura) : OPCIONES_BASE.holgura,
          imanD: numero(imanD) || OPCIONES_BASE.imanD,
          imanH: numero(imanH) || OPCIONES_BASE.imanH,
          porUnion,
        })
        if (n === turno.current) { setRes(r); setError("") }
      } catch (e) {
        if (n === turno.current) { setRes(null); setError((e as Error).message || "No se pudo partir el modelo.") }
      } finally {
        if (n === turno.current) setCalculando(false)
      }
    }, 350)
    return () => clearTimeout(reloj)
  }, [malla, cortes, conector, diametro, largo, holgura, imanD, imanH, porUnion])

  // Para la vista: arreglos estables (si no, el 3D se rehace en cada render)
  const piezasVista = useMemo(() => (res && res.piezas.length > 1 ? res.piezas.map((p) => ({ nombre: p.nombre, tris: p.malla.tris })) : null), [res])
  const marcasVista = useMemo(() => (res ? res.marcas : []), [res])
  // Tocar el modelo en la vista "Cortes y pernos": corte en ese punto, en el eje elegido
  const cortarAqui = (p: [number, number, number]) => {
    const pos = r1(p[ejeToque])
    if (cortes.some((c) => c.eje === ejeToque && Math.abs(c.pos - pos) < 2)) return
    setCortes((cs) => [...cs, { eje: ejeToque, pos }])
  }

  const elegirImpresora = (i: number) => {
    setImpresora(i)
    if (i < IMPRESORAS.length) {
      const c = IMPRESORAS[i].cama
      setCama(c.map(String))
      repartir(c)
    }
  }
  const moverCorte = (i: number, v: string) => {
    const x = numero(v)
    if (!Number.isFinite(x)) return
    setCortes((cs) => cs.map((c, j) => (j === i ? { ...c, pos: x } : c)))
  }
  const quitarCorte = (i: number) => setCortes((cs) => cs.filter((_, j) => j !== i))
  const agregarCorte = (eje: Eje) => {
    if (!caja) return
    const mismos = cortes.filter((c) => c.eje === eje).map((c) => c.pos)
    const puntos = [caja.min[eje], ...mismos.sort((a, b) => a - b), caja.max[eje]]
    // a la mitad del tramo más largo
    let mejor = 0
    for (let i = 1; i < puntos.length; i++) if (puntos[i] - puntos[i - 1] > puntos[mejor + 1] - puntos[mejor]) mejor = i - 1
    setCortes((cs) => [...cs, { eje, pos: r1((puntos[mejor] + puntos[mejor + 1]) / 2) }])
  }

  const noCaben = res ? res.piezas.filter((p) => !cabe(p.tam, camaN)).length : 0

  const armarZip = async (): Promise<Uint8Array | null> => {
    if (!res) return null
    const { zipSync } = await import("fflate")
    const archivos: Record<string, Uint8Array> = {}
    for (const p of res.piezas) archivos[`${nombre}-${p.nombre}.stl`] = new Uint8Array(mallaSTL(p.malla))
    if (res.perno) archivos[`perno-${diametro}x${res.pernoLargo}mm.stl`] = new Uint8Array(mallaSTL(res.perno))
    const leeme = [
      `${nombre} partido en ${res.piezas.length} piezas - hetnacnc.com/mx/disenar/partir-3d`,
      "",
      ...res.piezas.map((p) => `${p.nombre}: ${p.tam.join(" x ")} mm`),
      "",
      conector === "pernos" ? `Imprime ${res.conectores} pernos (perno-${diametro}x${res.pernoLargo}mm.stl), acostados o de pie.` : "",
      conector === "imanes" ? `Necesitas ${res.conectores * 2} imanes de ${imanD} x ${imanH} mm (uno por hueco). Revisa la polaridad antes de pegarlos.` : "",
      conector === "integrado" ? "Las piezas traen su perno integrado: imprímelas con el perno hacia arriba." : "",
      "El nombre dice la posición: X1 es la de menor X, Y2 la siguiente en Y, etc.",
      "Imprime cada pieza con la cara del corte sobre la cama: queda plana y sin soportes en esa cara.",
    ].filter(Boolean).join("\r\n")
    archivos["LEEME.txt"] = new TextEncoder().encode(leeme)
    return zipSync(archivos, { level: 6 })
  }
  const bajarZip = async () => {
    const zip = await armarZip()
    if (zip) descargar(`${nombre}-partido.zip`, zip as unknown as BlobPart, "application/zip")
  }
  // Fabrícamelo: el proyecto completo (ZIP con piezas, pernos y LEEME) a la solicitud
  const fabricar = async () => {
    if (!res || !med) return
    const zip = await armarZip()
    if (!zip) return
    const unidades = res.piezas.length + (res.perno ? res.conectores : 0)
    const ok = mandarArchivosAFabricar([{ nombre: `${nombre}-partido.zip`, contenido: new Blob([zip as unknown as BlobPart], { type: "application/zip" }) }], locale, {
      pieza: `${nombre}: modelo partido en ${res.piezas.length} piezas`,
      medidas: `${r1(med.x)} × ${r1(med.y)} × ${r1(med.z)} mm (armado)`,
      proceso: "Impresión 3D",
      cantidad: `${unidades} piezas (1 juego)`,
      nota: [
        `Imprimir ${nombre} partido en ${res.piezas.length} piezas (cama de ${camaN.join(" × ")} mm). El ZIP trae cada pieza en STL y un LEEME con instrucciones.`,
        `Piezas: ${res.piezas.map((p) => `${p.nombre} (${p.tam.join("×")} mm)`).join(", ")}.`,
        conector === "pernos" ? `Más ${res.conectores} pernos Ø${diametro} × ${res.pernoLargo} mm (incluidos en el ZIP).` : "",
        conector === "imanes" ? `Lleva ${res.conectores * 2} imanes de ${imanD} × ${imanH} mm.` : "",
      ].filter(Boolean).join(" "),
    })
    if (!ok) setAviso("El proyecto es muy grande para mandarlo. Descarga el ZIP y súbelo en la solicitud.")
  }

  // Todas las piezas (y los pernos) al Cotizador como un proyecto
  const cotizar = () => {
    if (!res) return
    const piezas = res.piezas.map((p) => ({ nombre: `${nombre}-${p.nombre}.stl`, contenido: mallaSTL(p.malla), cantidad: 1 }))
    if (res.perno) piezas.push({ nombre: `perno-${diametro}x${res.pernoLargo}mm.stl`, contenido: mallaSTL(res.perno), cantidad: res.conectores })
    const union = CONECTORES.find((c) => c.id === conector)?.nombre.toLowerCase() || ""
    const ok = mandarPaqueteACotizador(
      {
        proyecto: nombre,
        origen: "Partir modelo 3D",
        servicio: "impresion_3d",
        opciones: { materialImpresion: "pla" },
        nota: `${nombre} partido en ${res.piezas.length} piezas para cama de ${camaN.join(" × ")} mm${conector === "ninguno" ? "" : `, unión con ${union}`}${conector === "imanes" && res.conectores ? ` (${res.conectores * 2} imanes de ${imanD} × ${imanH} mm)` : ""}.`,
        piezas,
      },
      locale
    )
    if (!ok) setAviso("El proyecto es muy grande para pasarlo al Cotizador. Descarga el ZIP y súbelo pieza por pieza.")
  }

  const mensaje = res
    ? `Hola HETNA, partí mi modelo "${nombre}" en ${res.piezas.length} piezas (${med ? `${r1(med.x)} × ${r1(med.y)} × ${r1(med.z)} mm` : ""}) y quiero que me lo impriman.`
    : "Hola HETNA, quiero imprimir un modelo grande en partes."

  return (
    <main className="flex-1 bg-[#FAF9F6]">
      <section className="px-4 lg:px-8 pt-6 pb-4">
        <span className="inline-block px-3 py-1 rounded-full bg-[#E6F4EC] text-[#16794F] text-[12px] font-bold tracking-wide"><T>GRATIS · SIN MARCA DE AGUA</T></span>
        <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]"><T>Imprime en grande con tu impresora de siempre</T></h1>
        <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[760px]">
          <strong className="text-[#1B1B18]"><T>Partir modelo 3D:</T></strong> <T>sube tu STL, OBJ o STEP, elige tu impresora y lo dividimos en piezas que sí caben en la cama, con pernos o imanes para armarlo como una sola pieza. Cascos, macetas, letreros, piezas largas… Tu archivo no sale de tu navegador.</T>
        </p>
      </section>

      <div className="px-4 lg:px-8 pb-12 grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        <section className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 lg:p-5 flex flex-col gap-4">
          <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[#E7E4DC] rounded-[12px] cursor-pointer hover:border-[#C2560A] hover:bg-[#FFF8F1] text-center">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C2560A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></svg>
            <span className="text-[14px] font-semibold text-[#1B1B18]">{nombre || "Sube tu modelo 3D"}</span>
            <span className="text-[12px] text-[#6B6A63]"><T>STL, OBJ o STEP · hasta 60 MB</T></span>
            <input type="file" accept=".stl,.obj,.step,.stp" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
          </label>
          {cargando && <p className="m-0 text-[13px] text-[#6B6A63]">{cargando}</p>}
          {error && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{error}</p>}

          {malla && med && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-[#1B1B18]"><T>Tu impresora</T></span>
                <select
                  value={impresora}
                  onChange={(e) => elegirImpresora(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-[10px] border border-[#E7E4DC] bg-white text-[14px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
                >
                  {IMPRESORAS.map((p, i) => <option key={p.nombre} value={i}>{p.nombre} · {p.cama.join("×")} mm</option>)}
                  <option value={IMPRESORAS.length}>Otra (escribe la medida)</option>
                </select>
                <div className="grid grid-cols-3 gap-2">
                  {EJES.map((e, i) => <Numero key={e} etiqueta={`Cama ${e}`} valor={cama[i]} cambiar={(v) => { setImpresora(IMPRESORAS.length); setCama((c) => c.map((x, j) => (j === i ? v : x))) }} />)}
                </div>
                <button type="button" disabled={!camaOk} onClick={() => repartir()} className="self-start text-[13px] font-semibold text-[#C2560A] hover:underline disabled:opacity-50">
                  <T>Repartir cortes para esta cama</T>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-[#1B1B18]"><T>Cortes (</T>{cortes.length})</span>
                {cortes.length === 0 && <span className="text-[13px] text-[#6B6A63]"><T>Sin cortes: el modelo va completo.</T></span>}
                {cortes.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 text-[13px] font-bold text-[#C2560A]">{EJES[c.eje]}</span>
                    <input
                      type="range"
                      min={caja ? r1(caja.min[c.eje] + 1) : 0}
                      max={caja ? r1(caja.max[c.eje] - 1) : 100}
                      step={0.5}
                      value={c.pos}
                      onChange={(e) => moverCorte(i, e.target.value)}
                      className="flex-1 accent-[#C2560A]"
                      aria-label={`Posición del corte en ${EJES[c.eje]}`}
                    />
                    <input
                      key={`${i}-${c.pos}`}
                      type="text"
                      inputMode="decimal"
                      defaultValue={c.pos}
                      onBlur={(e) => moverCorte(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") moverCorte(i, (e.target as HTMLInputElement).value) }}
                      className="w-[72px] px-2 py-1.5 text-[13px] bg-white text-[#1B1B18] border border-[#E7E4DC] rounded-[8px] outline-none focus:border-[#C2560A]"
                      aria-label="Posición en mm"
                    />
                    <button type="button" onClick={() => quitarCorte(i)} className="w-7 h-7 rounded-[8px] border border-[#E7E4DC] text-[#6B6A63] hover:border-[#8A1C1C] hover:text-[#8A1C1C]" aria-label="Quitar corte">×</button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {EJES.map((e, i) => (
                    <button key={e} type="button" onClick={() => agregarCorte(i as Eje)} className="px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold border border-[#E7E4DC] bg-white hover:border-[#C2560A]">
                      <T>+ Corte en</T> {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-[#1B1B18]"><T>Cómo se unen</T></span>
                <div className="flex flex-wrap gap-2">
                  {CONECTORES.map((c) => <Opcion key={c.id} activa={conector === c.id} onClick={() => setConector(c.id)}>{c.nombre}</Opcion>)}
                </div>
                <span className="text-[12.5px] text-[#6B6A63]"><T>{CONECTORES.find((c) => c.id === conector)?.nota}</T></span>
                {conector !== "ninguno" && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[#6B6A63]">{conector === "imanes" ? "Imanes" : "Pernos"} <T>por unión</T></span>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 1, 2, 3, 4, 6].map((n) => (
                        <Opcion key={n} activa={porUnion === n} onClick={() => setPorUnion(n)}>{n === 0 ? "Automático" : n}</Opcion>
                      ))}
                    </div>
                    <span className="text-[12px] text-[#6B6A63]">
                      {porUnion === 0 ? "Según el tamaño de cada cara: 1 en caras chicas y hasta 4 en las grandes." : `${porUnion} en cada cara de corte, si caben con su pared.`} <T>Ve dónde quedan en “Cortes y pernos”.</T>
                    </span>
                  </div>
                )}
                {(conector === "pernos" || conector === "integrado") && (
                  <div className="grid grid-cols-3 gap-2">
                    <Numero etiqueta="Diámetro" valor={diametro} cambiar={setDiametro} />
                    <Numero etiqueta="Largo" valor={largo} cambiar={setLargo} />
                    <Numero etiqueta="Holgura" valor={holgura} cambiar={setHolgura} />
                  </div>
                )}
                {conector === "imanes" && (
                  <div className="grid grid-cols-3 gap-2">
                    <Numero etiqueta="Imán Ø" valor={imanD} cambiar={setImanD} />
                    <Numero etiqueta="Imán alto" valor={imanH} cambiar={setImanH} />
                    <Numero etiqueta="Holgura" valor={holgura} cambiar={setHolgura} />
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {!malla && <EjemplosPartir />}

          {malla && med && (
            <>
              <div className="relative">
                <Vista modelo={malla.tris} piezas={piezasVista} cortes={cortes} marcas={vista === "cortes" ? marcasVista : []} modo={vista} separar={separar} alTocar={cortarAqui} />
                {calculando && <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 text-[12.5px] font-semibold text-[#6B6A63] border border-[#E7E4DC]"><T>Partiendo...</T></span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Opcion activa={vista === "piezas"} onClick={() => setVista("piezas")}><T>Piezas</T></Opcion>
                <Opcion activa={vista === "cortes"} onClick={() => setVista("cortes")}><T>Cortes y</T> {conector === "imanes" ? "imanes" : "pernos"}</Opcion>
                {vista === "cortes" && (
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B6A63]">
                    <span className="ml-1"><T>Toca el modelo para cortar en</T></span>
                    {EJES.map((e, i) => (
                      <Opcion key={e} activa={ejeToque === i} onClick={() => setEjeToque(i as Eje)}>{e}</Opcion>
                    ))}
                  </span>
                )}
              </div>
              {vista === "cortes" && <p className="m-0 text-[12.5px] text-[#6B6A63]"><T>Los planos naranjas son los cortes y los cilindros verdes,</T> {conector === "imanes" ? "los huecos de los imanes" : "los pernos"}<T>. Gira con un dedo o el ratón; un toque sin arrastrar agrega un corte en ese punto.</T></p>}
              {res && res.piezas.length > 1 && vista === "piezas" && (
                <label className="flex items-center gap-3 text-[13px] text-[#6B6A63]">
                  <T>Separar piezas</T>
                  <input type="range" min={0} max={80} value={separar} onChange={(e) => setSeparar(Number(e.target.value))} className="flex-1 max-w-[260px] accent-[#C2560A]" />
                </label>
              )}

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 m-0">
                {[
                  ["Modelo", `${r1(med.x)} × ${r1(med.y)} × ${r1(med.z)} mm`],
                  ["Piezas", res ? String(res.piezas.length) : "—"],
                  [conector === "imanes" ? "Imanes" : "Pernos", res ? (conector === "ninguno" ? "—" : `${conector === "imanes" ? res.conectores * 2 : res.conectores} en ${res.uniones} ${res.uniones === 1 ? "unión" : "uniones"}`) : "—"],
                  ["Caben en la cama", res ? (noCaben ? `${res.piezas.length - noCaben} de ${res.piezas.length}` : "Todas ✓") : "—"],
                ].map(([t, v]) => (
                  <div key={t} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5">
                    <dt className="text-[12px] text-[#6B6A63]">{t}</dt>
                    <dd className="m-0 text-[14px] font-semibold text-[#1B1B18]">{v}</dd>
                  </div>
                ))}
              </dl>

              {res && (
                <>
                  {res.avisos.map((a) => <p key={a} className="m-0 text-[13.5px] text-[#B34D07]">{a}</p>)}
                  {noCaben > 0 && <p className="m-0 text-[13.5px] text-[#8A1C1C]">{noCaben === 1 ? "Una pieza no cabe" : `${noCaben} piezas no caben`} <T>en la cama de</T> {camaN.join("×")} <T>mm. Agrega cortes o pulsa “Repartir cortes para esta cama”.</T></p>}
                  {aviso && <p className="m-0 text-[13px] text-[#8A1C1C]">{aviso}</p>}

                  <button type="button" onClick={cotizar} className="w-full bg-[#16794F] hover:bg-[#12623F] text-white font-semibold py-3.5 rounded-[10px] text-[15px] flex items-center justify-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h4" /></svg>
                    <T>Ver precio de todas las piezas en el Cotizador</T>
                  </button>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <button type="button" onClick={bajarZip} className="bg-[#142033] hover:bg-[#0F1826] text-white font-semibold py-3.5 rounded-[10px] text-[15px]">
                      <T>Descargar todo (ZIP)</T>
                    </button>
                    <button
                      type="button"
                      onClick={fabricar}
                      className="bg-[#FF6A1A] hover:bg-[#E65C12] text-white font-extrabold py-3.5 rounded-[10px] text-[15px]"
                    >
                      <T>Fabrícamelo: que un taller lo imprima</T>
                    </button>
                  </div>

                  <ul className="m-0 p-0 list-none grid sm:grid-cols-2 gap-2">
                    {res.piezas.map((p) => {
                      const ok = cabe(p.tam, camaN)
                      return (
                        <li key={p.nombre} className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-semibold text-[#1B1B18]">{p.nombre}</div>
                            <div className={`text-[12.5px] ${ok ? "text-[#6B6A63]" : "text-[#8A1C1C]"}`}>{p.tam.join(" × ")} <T>mm</T>{ok ? "" : " · no cabe"}</div>
                          </div>
                          <button type="button" onClick={() => descargar(`${nombre}-${p.nombre}.stl`, mallaSTL(p.malla), "model/stl")} className="px-3 py-2 rounded-[8px] bg-[#142033] hover:bg-[#0F1826] text-white text-[13px] font-semibold">
                            <T>STL</T>
                          </button>
                        </li>
                      )
                    })}
                    {res.perno && (
                      <li className="bg-white border border-[#E7E4DC] rounded-[12px] px-3 py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-semibold text-[#1B1B18]"><T>Perno ×</T> {res.conectores}</div>
                          <div className="text-[12.5px] text-[#6B6A63]">Ø {diametro} × {res.pernoLargo} <T>mm</T></div>
                        </div>
                        <button type="button" onClick={() => descargar(`perno-${diametro}x${res.pernoLargo}mm.stl`, mallaSTL(res.perno!), "model/stl")} className="px-3 py-2 rounded-[8px] bg-[#142033] hover:bg-[#0F1826] text-white text-[13px] font-semibold">
                          <T>STL</T>
                        </button>
                      </li>
                    )}
                  </ul>
                  <a href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="self-start text-[13.5px] font-semibold text-[#C2560A] hover:underline">
                    <T>¿Dudas? Pregúntanos por WhatsApp</T>
                  </a>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
