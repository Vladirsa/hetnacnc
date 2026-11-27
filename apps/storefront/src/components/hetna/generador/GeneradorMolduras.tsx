"use client"

// Molduras y tallados (2D Studio, Muebles): moldura recta con perfil de fresa o
// panel con marco moldurado y centro tallado en relieve (patrón o imagen).
// Vista 3D del sólido y vista 2D (perfil, contorno y líneas para tallar en V).
// Sale en STL (para el Laboratorio CAM: desbaste y acabado con fresa de bola),
// DXF, SVG y PDF, y se manda directo al Laboratorio CAM.
import { T } from "@/components/hetna/i18n/Idioma"
import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"

import { CampoNum, Opciones, Seccion, numero } from "@/components/hetna/estudio3d/Controles"
import { Estudio2D } from "@/components/hetna/estudio/Estudio2D"
import { mandarALaboratorio } from "@/lib/generador/aLaboratorio"
import { dibujo } from "@/lib/generador/geo2d"
import { PATRONES, PERFILES, type Patron, type TipoPerfil, dibujoPanel, dibujoSeccion, mallaMoldura, mallaPanel, perfilDe, radioConcavoMinimo, trisDeSTL } from "@/lib/generador/molduras"

import { SelectorFresa, useFresas } from "./SelectorFresa"
import { MisDisenos, PanelCreditos } from "./PanelCuenta"
import { claveDiseno } from "./GeneradorEnsamble"
import { cobrarDescargaMueble } from "@/lib/muebles/acciones"
import { creditosDescarga, textoCreditos } from "@/lib/hetna/precios-diseno"
import Link from "next/link"
import { Visor3D } from "./Visor3D"

const Malla3D = dynamic(() => import("./Malla3D"), { ssr: false })

// dibujito del perfil para los botones
function IconoPerfil({ id }: { id: TipoPerfil }) {
  const h = perfilDe(id).h
  const pts = Array.from({ length: 31 }, (_, i) => `${2 + (i / 30) * 36},${30 - h(i / 30) * 22}`).join(" ")
  return (
    <svg width="40" height="34" viewBox="0 0 40 34" aria-hidden="true">
      <polygon points={`2,32 38,32 ${pts.split(" ").reverse().join(" ")}`} fill="#C2560A33" stroke="#F0A060" strokeWidth="1.2" />
    </svg>
  )
}

// imagen → gris reducido (para tallar desde una foto o dibujo)
function grisDeImagen(archivo: File, lado = 320): Promise<{ gris: Float32Array; w: number; h: number }> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const k = Math.min(1, lado / Math.max(img.width, img.height))
      const w = Math.max(2, Math.round(img.width * k)), h = Math.max(2, Math.round(img.height * k))
      const c = document.createElement("canvas")
      c.width = w
      c.height = h
      const g = c.getContext("2d")
      if (!g) return mal(new Error("canvas"))
      g.drawImage(img, 0, 0, w, h)
      const d = g.getImageData(0, 0, w, h).data
      const gris = new Float32Array(w * h)
      for (let i = 0; i < w * h; i++) gris[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
      ok({ gris, w, h })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      mal(new Error("imagen"))
    }
    img.src = url
  })
}

function bajar(nombre: string, datos: ArrayBuffer) {
  const url = URL.createObjectURL(new Blob([datos], { type: "model/stl" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function GeneradorMolduras({ cabecera }: { cabecera?: React.ReactNode }) {
  const { locale } = useParams<{ locale: string }>()
  const [modo, setModo] = useState<"moldura" | "panel">("panel")
  const [perfil, setPerfil] = useState<TipoPerfil>("ogee")
  const [v, setV] = useState<Record<string, string>>({ ancho: "40", alto: "15", base: "5", largo: "1000", pAncho: "400", pAlto: "600", grosor: "18", aMold: "50", hMold: "8", hTall: "5", petalos: "8" })
  const [invertir, setInvertir] = useState(false)
  const [patron, setPatron] = useState<Patron>("roseton")
  const [imagen, setImagen] = useState<{ gris: Float32Array; w: number; h: number } | null>(null)
  const [aviso, setAviso] = useState("")
  const [mandando, setMandando] = useState(false)
  const { todas: fresas, agregar } = useFresas()
  const [desbaste, setDesbaste] = useState("base-r6")
  const [acabado, setAcabado] = useState("base-b6")
  const [tallaV, setTallaV] = useState("base-v60")
  const n = (k: string, def: number) => numero(v[k] ?? "") || def
  const cambiar = (k: string) => (x: string) => setV((s) => ({ ...s, [k]: x }))

  const optMoldura = { perfil, ancho: Math.max(5, n("ancho", 40)), alto: Math.max(1, n("alto", 15)), base: Math.max(0, n("base", 5)), largo: Math.max(10, Math.min(3000, n("largo", 1000))), invertir }
  const W = Math.max(60, Math.min(1500, n("pAncho", 400))), H = Math.max(60, Math.min(2440, n("pAlto", 600)))
  // paso del mapa de alturas: ~120 mil puntos para el archivo, ~25 mil para la vista
  const pasoArchivo = Math.max(0.5, Math.round(Math.sqrt((W * H) / 120000) * 10) / 10)
  const optPanel = {
    ancho: W,
    alto: H,
    grosor: Math.max(6, Math.min(50, n("grosor", 18))),
    perfil,
    anchoMoldura: Math.max(5, Math.min(Math.min(W, H) / 2 - 5, n("aMold", 50))),
    hondoMoldura: Math.max(0.5, Math.min(n("grosor", 18) - 2, n("hMold", 8))),
    patron,
    hondoTallado: Math.max(0, Math.min(n("grosor", 18) - 3, n("hTall", 5))),
    petalos: n("petalos", 8),
    imagen: imagen || undefined,
    paso: pasoArchivo,
  }
  const clave = JSON.stringify({ modo, optMoldura, optPanel: { ...optPanel, imagen: !!imagen } })
  // malla de la vista (más gruesa en el panel)
  const tris = useMemo(() => {
    try {
      if (modo === "moldura") return trisDeSTL(mallaMoldura(optMoldura))
      return trisDeSTL(mallaPanel({ ...optPanel, paso: Math.max(optPanel.paso, Math.sqrt((W * H) / 25000)) }))
    } catch {
      return []
    }
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = useMemo(() => dibujo(modo === "moldura" ? dibujoSeccion(optMoldura) : dibujoPanel(optPanel)), [clave]) // eslint-disable-line react-hooks/exhaustive-deps

  // la fresa de acabado cabe en las partes cóncavas del perfil?
  const rMin = modo === "moldura" ? radioConcavoMinimo(perfil, optMoldura.ancho, optMoldura.alto) : radioConcavoMinimo(perfil, optPanel.anchoMoldura, optPanel.hondoMoldura)
  const fAcabado = fresas.find((f) => f.id === acabado)
  const rFresa = fAcabado ? (fAcabado.tipo === "bola" ? fAcabado.diametro / 2 : fAcabado.tipo === "conica_bola" ? (fAcabado.puntaD || fAcabado.diametro) / 2 : fAcabado.tipo === "v" ? 0.1 : Infinity) : Infinity
  const avisoFresa =
    fAcabado && (fAcabado.tipo === "recta" || fAcabado.tipo === "upcut" || fAcabado.tipo === "compresion")
      ? "Una fresa recta deja escalones en las curvas: para el acabado usa una de bola."
      : rFresa > rMin + 0.05
        ? `La fresa de acabado (radio ${rFresa.toFixed(1)} mm) no entra en la curva más cerrada del perfil (radio ${rMin.toFixed(1)} mm): usa una bola más chica o el perfil quedará redondeado.`
        : ""
  const pasoAcabado = fAcabado && fAcabado.tipo === "bola" ? Math.round(fAcabado.diametro * 0.12 * 100) / 100 : null

  const nombreArchivo = modo === "moldura" ? `moldura-${perfil}-${optMoldura.ancho}x${optMoldura.largo}` : `panel-${patron}-${W}x${H}`
  const stl = () => (modo === "moldura" ? mallaMoldura(optMoldura) : mallaPanel(optPanel))

  // ---- créditos: moldura 1, panel tallado 2; el mismo diseño no se cobra dos veces ----
  const herrCobro = modo === "moldura" ? "moldura" : "tallado"
  const costo = creditosDescarga(herrCobro, 1)
  const claveCobro = claveDiseno(JSON.stringify({ modo, perfil, v, invertir, patron, img: imagen ? `${imagen.w}x${imagen.h}:${imagen.gris.length}:${imagen.gris[Math.floor(imagen.gris.length / 2)]}` : null }))
  const [pagados, setPagados] = useState<Record<string, boolean>>({})
  const pagado = !!pagados[claveCobro]
  const [cobrando, setCobrando] = useState(false)
  const [avisoCobro, setAvisoCobro] = useState<{ texto: string; login?: boolean; creditos?: boolean } | null>(null)
  const [recarga, setRecarga] = useState(0)
  const datosDiseno = () => ({ v: 1, modo, perfil, medidas: v, invertir, patron: patron === "imagen" ? "roseton" : patron, desbaste, acabado, tallaV })
  const abrirDatos = (dd: Record<string, unknown>) => {
    if (dd.modo === "moldura" || dd.modo === "panel") setModo(dd.modo)
    if (typeof dd.perfil === "string" && PERFILES.some((x) => x.id === dd.perfil)) setPerfil(dd.perfil as TipoPerfil)
    if (dd.medidas && typeof dd.medidas === "object") setV((x) => ({ ...x, ...(dd.medidas as Record<string, string>) }))
    setInvertir(!!dd.invertir)
    if (typeof dd.patron === "string" && PATRONES.some((x) => x.id === dd.patron)) setPatron(dd.patron as Patron)
    if (typeof dd.desbaste === "string") setDesbaste(dd.desbaste)
    if (typeof dd.acabado === "string") setAcabado(dd.acabado)
    if (typeof dd.tallaV === "string") setTallaV(dd.tallaV)
  }
  const cobrar = async () => {
    setCobrando(true)
    setAvisoCobro(null)
    const r = await cobrarDescargaMueble(claveCobro, nombreArchivo, herrCobro)
    setCobrando(false)
    setRecarga((n) => n + 1)
    if (!r.ok) {
      setAvisoCobro({ texto: r.mensaje, login: r.noAutenticado, creditos: r.saldoInsuficiente })
      return false
    }
    setPagados((p) => ({ ...p, [claveCobro]: true }))
    return true
  }

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Créditos y mis diseños">
        <PanelCreditos costo={costo} pagado={pagado} recarga={recarga} />
        <MisDisenos herramienta="moldura" tipos={["moldura"]} actual={() => ({ nombre: modo === "moldura" ? `Moldura ${perfilDe(perfil).nombre}` : `Panel ${PATRONES.find((p) => p.id === patron)?.nombre || ""}`, resumen: nombreArchivo, datos: datosDiseno() })} abrir={(dd) => abrirDatos(dd)} />
        <span className="text-[11.5px] text-[#8A97AB]"><T>Diseñar y ver es gratis. Bajar los archivos o mandarlos al Laboratorio CAM: moldura</T> {textoCreditos(1)}<T>, panel tallado</T> {textoCreditos(2)}<T>. El mismo diseño no se vuelve a cobrar.</T><T>{patron === "imagen" ? " El tallado de tu foto no se guarda: vuelve a subir la foto al abrirlo." : ""}</T></span>
      </Seccion>
      <Seccion titulo="Qué vas a hacer">
        <Opciones opciones={[{ id: "panel", nombre: "Panel tallado (puerta, frente)" }, { id: "moldura", nombre: "Moldura recta" }]} valor={modo} cambiar={(x) => setModo(x as "moldura" | "panel")} />
      </Seccion>

      <Seccion titulo="Perfil de la moldura">
        <div className="grid grid-cols-4 gap-1.5">
          {PERFILES.map((p) => (
            <button key={p.id} type="button" aria-pressed={perfil === p.id} onClick={() => setPerfil(p.id)} title={p.nombre} className={`flex flex-col items-center gap-0.5 rounded-[8px] px-1 py-1.5 text-[10.5px] leading-tight ${perfil === p.id ? "bg-[#2A1C12] text-white ring-1 ring-[#C2560A]" : "bg-[#141B26] text-[#C9D2E0] ring-1 ring-[#2A3546] hover:ring-[#3A4A63]"}`}>
              <IconoPerfil id={p.id} />
              <T>{p.nombre}</T>
            </button>
          ))}
        </div>
        {modo === "moldura" && (
          <label className="flex items-center gap-2 text-[12.5px] text-[#C9D2E0]">
            <input type="checkbox" checked={invertir} onChange={(e) => setInvertir(e.target.checked)} className="accent-[#C2560A]" /> <T>Voltear el perfil</T>
          </label>
        )}
      </Seccion>

      {modo === "moldura" ? (
        <Seccion titulo="Medidas de la moldura">
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Ancho" valor={v.ancho} cambiar={cambiar("ancho")} sufijo="mm" />
            <CampoNum etiqueta="Alto del perfil" valor={v.alto} cambiar={cambiar("alto")} sufijo="mm" />
            <CampoNum etiqueta="Base" valor={v.base} cambiar={cambiar("base")} sufijo="mm" />
            <CampoNum etiqueta="Largo" valor={v.largo} cambiar={cambiar("largo")} sufijo="mm" />
          </div>
        </Seccion>
      ) : (
        <>
          <Seccion titulo="Panel">
            <div className="grid grid-cols-3 gap-2">
              <CampoNum etiqueta="Ancho" valor={v.pAncho} cambiar={cambiar("pAncho")} sufijo="mm" />
              <CampoNum etiqueta="Alto" valor={v.pAlto} cambiar={cambiar("pAlto")} sufijo="mm" />
              <CampoNum etiqueta="Grosor" valor={v.grosor} cambiar={cambiar("grosor")} sufijo="mm" />
              <CampoNum etiqueta="Ancho moldura" valor={v.aMold} cambiar={cambiar("aMold")} sufijo="mm" />
              <CampoNum etiqueta="Hondo moldura" valor={v.hMold} cambiar={cambiar("hMold")} sufijo="mm" />
            </div>
            <span className="text-[11.5px] text-[#8A97AB]"><T>La moldura corre alrededor con las esquinas a inglete; el centro queda al fondo de la moldura.</T></span>
          </Seccion>
          <Seccion titulo="Tallado del centro">
            <div className="grid grid-cols-3 gap-1.5">
              {PATRONES.map((p) => (
                <button key={p.id} type="button" aria-pressed={patron === p.id} onClick={() => setPatron(p.id)} className={`rounded-[8px] px-2 py-1.5 text-[12px] font-semibold ${patron === p.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"}`}>
                  <T>{p.nombre}</T>
                </button>
              ))}
            </div>
            {patron !== "liso" && (
              <div className="grid grid-cols-2 gap-2">
                <CampoNum etiqueta="Relieve del tallado" valor={v.hTall} cambiar={cambiar("hTall")} sufijo="mm" />
                {(patron === "roseton" || patron === "estrella") && <CampoNum etiqueta="Pétalos o puntas" valor={v.petalos} cambiar={cambiar("petalos")} />}
              </div>
            )}
            {patron === "imagen" && (
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-[10px] border-2 border-dashed border-[#2A3546] p-3 text-center hover:border-[#C2560A]">
                <span className="text-[13px] font-semibold text-white"><T>{imagen ? "Cambiar la imagen" : "Sube una imagen o dibujo"}</T></span>
                <span className="text-[11.5px] text-[#8A97AB]"><T>Lo claro queda alto y lo oscuro hondo. Funciona mejor con dibujos de alto contraste.</T></span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ""
                    if (!f) return
                    try {
                      setImagen(await grisDeImagen(f))
                    } catch {
                      setAviso("No se pudo abrir la imagen.")
                    }
                  }}
                />
              </label>
            )}
          </Seccion>
        </>
      )}

      <Seccion titulo="Herramientas de corte">
        <SelectorFresa etiqueta="Desbaste" tipos={["recta", "upcut", "compresion", "desbaste", "bola"]} valor={desbaste} cambiar={(f) => setDesbaste(f.id)} todas={fresas} agregar={agregar} nota="Quita el material grueso." />
        <SelectorFresa etiqueta="Acabado" tipos={["bola", "conica_bola", "v", "recta"]} valor={acabado} cambiar={(f) => setAcabado(f.id)} todas={fresas} agregar={agregar} nota={pasoAcabado ? `Paso lateral sugerido: ${pasoAcabado} mm (12 % del diámetro).` : undefined} />
        {modo === "panel" && patron !== "liso" && <SelectorFresa etiqueta="Tallado en V (2D)" tipos={["v"]} valor={tallaV} cambiar={(f) => setTallaV(f.id)} todas={fresas} agregar={agregar} nota="Para las líneas de la capa GRABADO (vista 2D)." />}
        {avisoFresa && <p className="m-0 text-[12px] text-[#F6D58E]"><T>{avisoFresa}</T></p>}
        <span className="text-[11.5px] text-[#8A97AB]"><T>Curva más cerrada del perfil: radio</T> <T>{Number.isFinite(rMin) ? `${rMin.toFixed(1)} mm` : "sin curvas cóncavas"}</T><T>. En el Laboratorio CAM eliges estas fresas para el desbaste y el acabado.</T></span>
      </Seccion>
    </div>
  )

  return (
    <Estudio2D
      titulo="Molduras y tallados"
      acento="3D"
      subtitulo="Perfiles de fresa y paneles tallados para router"
      icono={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="10" height="10" rx="1" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      }
      panel={
        <>
          <T>{cabecera}</T>
          <T>{panel}</T>
        </>
      }
      vista3D={
        <Visor3D oscuro alto="h-full min-h-[260px]">
          {tris.length ? <Malla3D oscuro tris={tris} color={0xd8b98e} /> : <div className="grid h-full place-items-center text-[14px] text-[#8A97AB]"><T>Ajusta las medidas.</T></div>}
        </Visor3D>
      }
      dibujo={d}
      avisos={aviso ? [aviso, ...(avisoFresa ? [avisoFresa] : [])] : avisoFresa ? [avisoFresa] : []}
      archivo={nombreArchivo}
      pieza={modo === "moldura" ? `Moldura ${perfilDe(perfil).nombre} ${optMoldura.ancho} × ${optMoldura.alto} mm, ${optMoldura.largo} mm de largo` : `Panel tallado ${W} × ${H} × ${optPanel.grosor} mm`}
      material="MDF o madera sólida"
      sinAcomodo
      datos={
        modo === "moldura"
          ? [["Perfil", perfilDe(perfil).nombre], ["Sección", `${optMoldura.ancho} × ${optMoldura.base + optMoldura.alto} mm`], ["Largo", `${optMoldura.largo} mm`]]
          : [["Panel", `${W} × ${H} × ${optPanel.grosor} mm`], ["Moldura", `${perfilDe(perfil).nombre} ${optPanel.anchoMoldura} mm`], ["Tallado", PATRONES.find((p) => p.id === patron)?.nombre || ""], ["Resolución", `${pasoArchivo} mm`]]
      }
      camBloqueado={pagado ? undefined : `Paga la descarga (${textoCreditos(costo)}) y se activa el envío al CAM 2D.`}
      descargas={(exportar) => !pagado ? (
        <div className="flex flex-col gap-2">
          <button type="button" disabled={cobrando || !tris.length} onClick={cobrar} className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50">
            <T>{cobrando ? "Cobrando…" : `STL, DXF y Laboratorio CAM · ${textoCreditos(costo)}`}</T>
          </button>
          {avisoCobro && (
            <span className="text-[12px] text-[#F6B8AE]">
              <T>{avisoCobro.texto}</T><T>{" "}</T>
              {avisoCobro.login && <Link href={`/${locale}/login`} className="underline"><T>Iniciar sesión</T></Link>}
              {avisoCobro.creditos && <Link href={`/${locale}/user/creditos`} className="underline"><T>Comprar créditos</T></Link>}
            </span>
          )}
          <span className="text-[12px] text-[#8A97AB]"><T>Ver el perfil, el tallado y las medidas es gratis.</T></span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={mandando}
            onClick={async () => {
              setMandando(true)
              setAviso("")
              const ok = await mandarALaboratorio(`${nombreArchivo}.stl`, stl(), locale)
              if (!ok) {
                setMandando(false)
                setAviso("No se pudo abrir el Laboratorio CAM desde aquí. Descarga el STL y súbelo.")
              }
            }}
            className="rounded-[8px] bg-[#C2560A] px-3 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-60"
          >
            <T>{mandando ? "Abriendo el Laboratorio…" : "Mandar al Laboratorio CAM"}</T>
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => bajar(`${nombreArchivo}.stl`, stl())} className="flex-1 rounded-[8px] bg-[#1C2431] px-3 py-2 text-[13px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
              <T>STL</T>
            </button>
            {(["dxf", "svg", "pdf"] as const).map((t) => (
              <button key={t} type="button" onClick={() => exportar(t)} className="flex-1 rounded-[8px] bg-[#1C2431] px-3 py-2 text-[13px] font-semibold text-[#C9D2E0] hover:bg-[#243045]">
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-[#8A97AB]"><T>STL: el sólido para desbaste y acabado en 3D. DXF:</T> <T>{modo === "moldura" ? "el perfil de la sección" : "el contorno de corte y las líneas para tallar en V"}</T>.</span>
        </div>
      )}
    />
  )
}
