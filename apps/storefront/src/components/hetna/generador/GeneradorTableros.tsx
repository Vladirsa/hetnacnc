"use client"

// Mueble desde una imagen (2D Studio, Muebles): el cliente sube la foto, boceto
// o plano de cualquier mueble de tablero; la IA lo describe como tableros a
// escala y el motor (lib/generador/tableros.ts) calcula espigas, mortajas y
// alivios. La vista principal es el mueble armado en 3D, hecho con las mismas
// piezas que se cortan. Leer la imagen cuesta 2 créditos (se regresan si no
// sirve); ver, ajustar y medir es gratis; descargar los archivos, 1 crédito.
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams } from "next/navigation"

import { CampoNum, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import type { Herramienta, Plano } from "@/lib/generador/ensamble"
import { dibujo } from "@/lib/generador/geo2d"
import { TABLEROS_INICIO, type Tablero, muebleDeTableros } from "@/lib/generador/tableros"
import { cobrarDescargaMueble, disenarTablerosDesdeImagen } from "@/lib/muebles/acciones"

import { claveDiseno, mallaArmada, piezasTendidas, reducirImagen } from "./GeneradorEnsamble"
import { Visor3D } from "./Visor3D"

const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false })
const TABLERO = { ancho: 1220, largo: 2440 }
const FRESAS = [
  { id: "laser", nombre: "Láser" },
  { id: "3.175", nombre: "Fresa 1/8″" },
  { id: "6.35", nombre: "Fresa 1/4″" },
] as const
const PLANOS: { id: Plano; nombre: string }[] = [
  { id: "lateral", nombre: "Costado" },
  { id: "horizontal", nombre: "Repisa" },
  { id: "frontal", nombre: "Frente" },
]

// Ejemplo mientras no hay imagen: un librero
const EJEMPLO: { nombre: string; grosor: number; tableros: Tablero[] } = {
  nombre: "Librero (ejemplo)",
  grosor: 18,
  tableros: [
    { nombre: "Costado izquierdo", plano: "lateral", x0: 0, x1: 18, y0: 0, y1: 300, z0: 0, z1: 1800 },
    { nombre: "Costado derecho", plano: "lateral", x0: 782, x1: 800, y0: 0, y1: 300, z0: 0, z1: 1800 },
    { nombre: "Piso", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 60, z1: 78 },
    { nombre: "Repisa 1", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 480, z1: 498 },
    { nombre: "Repisa 2", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 900, z1: 918 },
    { nombre: "Repisa 3", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 1320, z1: 1338 },
    { nombre: "Techo", plano: "horizontal", x0: 18, x1: 782, y0: 0, y1: 300, z0: 1782, z1: 1800 },
    { nombre: "Respaldo", plano: "frontal", x0: 18, x1: 782, y0: 282, y1: 300, z0: 78, z1: 480 },
  ],
}

// tablero nuevo: una repisa al centro del mueble actual
function tableroNuevo(ts: Tablero[], g: number): Tablero {
  const x1 = Math.max(400, ...ts.map((t) => t.x1)), y1 = Math.max(250, ...ts.map((t) => t.y1)), z1 = Math.max(400, ...ts.map((t) => t.z1))
  const z = Math.round(z1 / 2)
  return { nombre: `Tablero ${ts.length + 1}`, plano: "horizontal", x0: 0, x1, y0: 0, y1, z0: z, z1: z + g }
}

export function GeneradorTableros({ cabecera }: { cabecera?: React.ReactNode }) {
  const { locale } = useParams<{ locale: string }>()
  const [nombre, setNombre] = useState(EJEMPLO.nombre)
  const [tableros, setTableros] = useState<Tablero[]>(EJEMPLO.tableros)
  const [esEjemplo, setEsEjemplo] = useState(true)
  const [foto, setFoto] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [lectura, setLectura] = useState<{ texto: string; tipo: "ok" | "aviso" | "error"; login?: boolean; creditos?: boolean } | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [v, setV] = useState<Record<string, string>>({ ancho: "", fondo: "", alto: "", grosor: String(EJEMPLO.grosor), holgura: "0.3", saliente: "0" })
  const [herr, setHerr] = useState<(typeof FRESAS)[number]["id"]>("6.35")
  const [tris, setTris] = useState<number[] | null>(null)
  const [pagados, setPagados] = useState<Record<string, boolean>>({})
  const [cobrando, setCobrando] = useState(false)
  const [avisoCobro, setAvisoCobro] = useState<{ texto: string; login?: boolean; creditos?: boolean } | null>(null)
  const cambiar = (k: string) => (x: string) => setV((s) => ({ ...s, [k]: x }))

  const herramienta: Herramienta = herr === "laser" ? { tipo: "laser" } : { tipo: "fresa", diametro: Number(herr) }
  const opciones = {
    ancho: numero(v.ancho) || undefined,
    fondo: numero(v.fondo) || undefined,
    alto: numero(v.alto) || undefined,
    grosor: numero(v.grosor) || TABLEROS_INICIO.grosor,
    holgura: numero(v.holgura) >= 0 ? numero(v.holgura) : TABLEROS_INICIO.holgura,
    saliente: numero(v.saliente) >= 0 ? numero(v.saliente) : 0,
    herramienta,
  }
  const clave = JSON.stringify({ tableros, opciones })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => muebleDeTableros(tableros, opciones), [clave])
  const d = useMemo(() => (m.piezas.length && !m.errores.length ? dibujo(piezasTendidas(m.piezas)) : null), [m])

  // el armado 3D se rehace al cambiar el diseño (con una pausa corta al teclear)
  useEffect(() => {
    if (!m.piezas.length) return setTris(null)
    let vivo = true
    const t = setTimeout(() => mallaArmada(m.piezas).then((x) => vivo && setTris(x)), 150)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [m])

  const areaM2 = useMemo(() => {
    let a = 0
    for (const p of m.piezas) {
      let s = 0
      const c = p.contorno
      for (let i = 0, j = c.length - 1; i < c.length; j = i++) s += (c[j][0] - c[i][0]) * (c[j][1] + c[i][1])
      a += Math.abs(s / 2)
    }
    return a / 1e6
  }, [m])
  const hojas = Math.max(1, Math.ceil(areaM2 / ((TABLERO.ancho * TABLERO.largo) / 1e6) / 0.8))

  const subirImagen = async (archivo?: File | null) => {
    if (!archivo) return
    setLectura(null)
    setLeyendo(true)
    try {
      const datos = await reducirImagen(archivo)
      setFoto(`data:image/jpeg;base64,${datos}`)
      const r = await disenarTablerosDesdeImagen(datos, "image/jpeg")
      if (!r.ok) setLectura({ texto: r.mensaje, tipo: "error", login: r.noAutenticado, creditos: r.saldoInsuficiente })
      else if (r.lectura.tipo !== "tableros") setLectura({ texto: `${r.lectura.notas || "La imagen no parece un mueble de tablero."} No se te cobró.`, tipo: "aviso" })
      else {
        setTableros(r.lectura.tableros)
        setNombre(r.lectura.nombre)
        setEsEjemplo(false)
        setAbierto(null)
        // la lectura trae sus medidas: los campos de medidas totales quedan vacíos (= las de la imagen)
        setV((s) => ({ ...s, ancho: "", fondo: "", alto: "", grosor: String(r.lectura.grosor) }))
        const conf = r.lectura.confianza === "alta" ? "" : r.lectura.confianza === "media" ? " Revisa las medidas: algunas son estimadas." : " Revisa todas las medidas: la imagen no tenía cotas claras."
        setLectura({ texto: `${r.lectura.notas}${conf}`, tipo: "ok" })
      }
    } catch {
      setLectura({ texto: "No se pudo abrir la imagen. Prueba con un JPG o PNG.", tipo: "error" })
    } finally {
      setLeyendo(false)
    }
  }

  const editar = (i: number, cambio: Partial<Tablero>) => setTableros((ts) => ts.map((t, j) => (j === i ? { ...t, ...cambio } : t)))
  const medidasTxt = `${m.medidas.ancho} × ${m.medidas.fondo} × ${m.medidas.alto} mm`
  const avisos = [...m.errores, ...m.avisos]

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Sube la imagen de tu mueble">
        <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border-2 border-dashed border-[#2A3546] p-3 text-center hover:border-[#C2560A] ${leyendo ? "pointer-events-none opacity-60" : ""}`}>
          <span className="text-[13.5px] font-semibold text-white">{leyendo ? "Leyendo la imagen…" : "Foto, boceto, render o plano"}</span>
          <span className="text-[12px] text-[#8A97AB]">La IA lo convierte en piezas para maquilar · 2 créditos</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { subirImagen(e.target.files?.[0]); e.target.value = "" }} />
        </label>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="Imagen que subiste" className="max-h-40 w-full rounded-[8px] border border-[#2A3546] bg-white object-contain" />
        )}
        {lectura && (
          <p className={`m-0 text-[12.5px] ${lectura.tipo === "ok" ? "text-[#9FE0B5]" : lectura.tipo === "aviso" ? "text-[#F6D58E]" : "text-[#F6B8AE]"}`}>
            {lectura.texto}{" "}
            {lectura.login && <Link href={`/${locale}/login`} className="underline">Iniciar sesión</Link>}
            {lectura.creditos && <Link href={`/${locale}/user/creditos`} className="underline">Comprar créditos</Link>}
          </p>
        )}
        <span className="text-[11.5px] text-[#5B6880]">
          Funciona con muebles de tablero plano a escuadra (libreros, mesas, bancos, repisas, exhibidores). Curvas e inclinaciones se aproximan con rectángulos. Si la imagen no sirve, no se cobra.
        </span>
      </Seccion>

      <div className="rounded-[10px] border border-[#2A3546] bg-[#141B26] p-3 text-[12.5px] text-[#C9D2E0]">
        <b className="text-white">{nombre}.</b> {m.piezas.length} piezas, {m.uniones} uniones de caja y espiga, sin tornillos.
        {esEjemplo && " Es un ejemplo: sube tu imagen para reemplazarlo."}
      </div>

      <Seccion titulo="Medidas totales">
        <div className="grid grid-cols-3 gap-2">
          <CampoNum etiqueta="Ancho" valor={v.ancho} cambiar={cambiar("ancho")} sufijo="mm" />
          <CampoNum etiqueta="Fondo" valor={v.fondo} cambiar={cambiar("fondo")} sufijo="mm" />
          <CampoNum etiqueta="Alto" valor={v.alto} cambiar={cambiar("alto")} sufijo="mm" />
        </div>
        <span className="text-[12px] text-[#8A97AB]">
          Vacío = las medidas de la imagen ({m.original.ancho} × {m.original.fondo} × {m.original.alto} mm). Al cambiarlas todo el mueble se ajusta y las uniones se recalculan.
        </span>
      </Seccion>

      <Seccion titulo="Tablero y máquina">
        <div className="grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Grosor real (medido)" valor={v.grosor} cambiar={cambiar("grosor")} sufijo="mm" />
          <CampoNum etiqueta="Holgura de ensamble" valor={v.holgura} cambiar={cambiar("holgura")} sufijo="mm" />
          <CampoNum etiqueta="Espiga sobresale" valor={v.saliente} cambiar={cambiar("saliente")} sufijo="mm" />
        </div>
        <Opciones opciones={FRESAS.map((f) => ({ id: f.id, nombre: f.nombre }))} valor={herr} cambiar={setHerr} />
        <span className="text-[12px] text-[#8A97AB]">Mide el grosor con vernier: el MDF de «18 mm» suele medir entre 17.5 y 18.5. Con fresa, las esquinas llevan alivio para que asienten.</span>
      </Seccion>

      <Seccion titulo={`Tableros (${tableros.length})`}>
        <div className="flex flex-col gap-1.5">
          {tableros.map((t, i) => {
            const fuera = m.descartados.some((x) => x.startsWith(t.nombre))
            return (
              <div key={i} className={`rounded-[8px] border ${abierto === i ? "border-[#C2560A]" : "border-[#2A3546]"} bg-[#111821]`}>
                <button type="button" onClick={() => setAbierto(abierto === i ? null : i)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12.5px]">
                  <span className={`flex-1 truncate font-semibold ${fuera ? "text-[#F6B8AE] line-through" : "text-white"}`}>{t.nombre}</span>
                  <span className="text-[#8A97AB]">
                    {Math.round(t.x1 - t.x0)} × {Math.round(t.y1 - t.y0)} × {Math.round(t.z1 - t.z0)}
                  </span>
                </button>
                {abierto === i && (
                  <div className="flex flex-col gap-2 border-t border-[#1F2937] p-2.5">
                    <input
                      value={t.nombre}
                      onChange={(e) => editar(i, { nombre: e.target.value })}
                      className="rounded-[7px] border border-[#2A3546] bg-[#0B0F15] px-2 py-1.5 text-[13px] text-white"
                      aria-label="Nombre del tablero"
                    />
                    <Opciones opciones={PLANOS} valor={(t.plano as Plano) || "horizontal"} cambiar={(p) => editar(i, { plano: p })} />
                    <div className="grid grid-cols-2 gap-2">
                      {(["x0", "x1", "y0", "y1", "z0", "z1"] as const).map((k) => (
                        <CampoNum
                          key={k}
                          etiqueta={{ x0: "Izquierda", x1: "Derecha", y0: "Frente", y1: "Atrás", z0: "Abajo", z1: "Arriba" }[k]}
                          valor={String(t[k])}
                          cambiar={(x) => Number.isFinite(numero(x)) && editar(i, { [k]: numero(x) })}
                          sufijo="mm"
                        />
                      ))}
                    </div>
                    <button type="button" onClick={() => { setTableros((ts) => ts.filter((_, j) => j !== i)); setAbierto(null) }} className="self-start rounded-[7px] px-2 py-1 text-[12.5px] font-semibold text-[#F6B8AE] hover:bg-[#2A1C1C]">
                      Quitar tablero
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => { setTableros((ts) => [...ts, tableroNuevo(ts, opciones.grosor)]); setAbierto(tableros.length) }}
          className="rounded-[8px] bg-[#1C2431] px-3 py-2 text-[13px] font-semibold text-[#C9D2E0] hover:bg-[#243045]"
        >
          Agregar tablero
        </button>
        <span className="text-[12px] text-[#8A97AB]">Medidas en mm desde la esquina de abajo, al frente y a la izquierda del mueble. Las uniones se calculan solas.</span>
      </Seccion>
    </div>
  )

  const vista3D = (
    <Visor3D oscuro alto="h-full min-h-[260px]">
      {tris && tris.length ? (
        <Malla3D oscuro tris={tris} color={0xd8b98e} />
      ) : (
        <div className="grid h-full place-items-center text-[14px] text-[#8A97AB]">{m.piezas.length ? "Armando el mueble…" : m.errores[0] || "Sube la imagen de un mueble."}</div>
      )}
    </Visor3D>
  )

  return (
    <Estudio2D
      titulo="Mueble desde imagen"
      acento="2D"
      subtitulo="Tu foto o plano, listo para maquilar"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M7 18v2M17 18v2M3 11h18M12 4v7" />
        </svg>
      }
      panel={
        <>
          {cabecera}
          {panel}
        </>
      }
      vista3D={vista3D}
      dibujo={d}
      avisos={avisos}
      archivo={`mueble-${m.medidas.ancho}x${m.medidas.alto}-${opciones.grosor}mm`}
      pieza={`${nombre}: ${medidasTxt}, ${m.piezas.length} piezas de caja y espiga`}
      material={`Triplay o MDF de ${opciones.grosor} mm`}
      datos={[
        ["Armado", medidasTxt],
        ["Piezas", String(m.piezas.length)],
        ["Tablero", `${areaM2.toFixed(2)} m² · ${hojas} ${hojas === 1 ? "hoja" : "hojas"} de ${TABLERO.largo} × ${TABLERO.ancho}`],
      ]}
      descargas={(exportar) => {
        const claveCobro = claveDiseno(clave)
        if (pagados[claveCobro])
          return (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {(["dxf", "svg", "pdf"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => exportar(t)} className={`flex-1 rounded-[8px] px-3 py-2.5 text-[13px] font-semibold ${t === "dxf" ? "bg-[#C2560A] text-white hover:bg-[#A84A08]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-[#9FE0B5]">Pagado. Puedes bajar los tres formatos de este diseño durante 24 horas sin costo extra.</span>
            </div>
          )
        return (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={cobrando || !!m.errores.length || !m.piezas.length}
              onClick={async () => {
                setCobrando(true)
                setAvisoCobro(null)
                const r = await cobrarDescargaMueble(claveCobro, `${nombre} ${medidasTxt}, ${opciones.grosor} mm`)
                setCobrando(false)
                if (!r.ok) return setAvisoCobro({ texto: r.mensaje, login: r.noAutenticado, creditos: r.saldoInsuficiente })
                setPagados((p) => ({ ...p, [claveCobro]: true }))
                exportar("dxf")
              }}
              className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50"
            >
              {cobrando ? "Cobrando…" : "Descargar DXF, SVG y PDF · 1 crédito"}
            </button>
            {avisoCobro && (
              <span className="text-[12px] text-[#F6B8AE]">
                {avisoCobro.texto}{" "}
                {avisoCobro.login && <Link href={`/${locale}/login`} className="underline">Iniciar sesión</Link>}
                {avisoCobro.creditos && <Link href={`/${locale}/user/creditos`} className="underline">Comprar créditos</Link>}
              </span>
            )}
            <span className="text-[12px] text-[#8A97AB]">Ver el armado, las medidas y el material es gratis. Si no tienes máquina, Fabrícamelo es sin costo.</span>
          </div>
        )
      }}
    />
  )
}
