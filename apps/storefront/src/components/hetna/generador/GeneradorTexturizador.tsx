"use client"

// Texturizador dentro del 3D Studio: una placa o un rodillo con un patrón
// repetido de palabras e íconos, para imprimir en 3D. Sirve para texturizar
// barro, fondant, galletas o plastilina (con el espejo activado se lee bien al
// presionar). El rodillo trae sus accesorios: mangos y guías de grosor.
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"

import {
  Aviso,
  Boton,
  CampoNum,
  Datos,
  Etiqueta,
  Seccion,
  TarjetaExport,
  descargar,
  numero,
  r1,
} from "@/components/hetna/estudio3d/Controles"
import { mandarAFabricar } from "@/lib/generador/aCotizador"
import { FUENTES, cargarFuente, instalarFuentesVista } from "@/lib/generador/fuentes"
import type { Fuente } from "@/lib/generador/letreros"
import {
  APOYO_RODILLO,
  HOLGURA_EJE,
  ICONOS_TEXTURA,
  type IconoTextura,
  hacerGuias,
  hacerMangos,
  hacerRodillo,
  hacerSoporte,
  hacerTexturizador,
} from "@/lib/generador/texturizador"
import { deUrl } from "@/lib/generador/texturizador-url"
import { type Dibujo, dibujoSVG, mallaSTL } from "@/lib/generador/vectores"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })

type Modelo = {
  id: string
  nombre: string
  palabras: string
  iconos: IconoTextura[]
  fuente: string
  ancho: string
  alto: string
  tamano: string
}

const MODELOS: Modelo[] = [
  { id: "nombre", nombre: "Nombre", palabras: "SOFÍA", iconos: ["estrella"], fuente: "montserrat", ancho: "150", alto: "100", tamano: "10" },
  { id: "galletas", nombre: "Galletas", palabras: "", iconos: ["corazon", "flor", "estrella"], fuente: "montserrat", ancho: "120", alto: "120", tamano: "12" },
  { id: "mascotas", nombre: "Mascotas", palabras: "MAX", iconos: ["huella"], fuente: "bebas-neue", ancho: "150", alto: "100", tamano: "11" },
  { id: "navidad", nombre: "Navidad", palabras: "NAVIDAD", iconos: ["copo", "estrella"], fuente: "cinzel", ancho: "180", alto: "120", tamano: "10" },
  { id: "noche", nombre: "Noche", palabras: "", iconos: ["luna", "estrella", "circulo"], fuente: "montserrat", ancho: "150", alto: "150", tamano: "9" },
  { id: "marca", nombre: "Mi marca", palabras: "HETNA", iconos: ["rombo"], fuente: "oswald", ancho: "200", alto: "120", tamano: "12" },
]

// Vista 2D: la placa con el patrón
function vistaTextura(d: Dibujo, bajo: boolean): string {
  const pts = d.trazos.flatMap((t) => t.pts)
  if (!pts.length) return ""
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const mar = 2
  const W = x1 - x0 + 2 * mar
  const H = y1 - y0 + 2 * mar
  const ruta = (grabado: boolean) =>
    d.trazos
      .filter((t) => (t.capa === "GRABADO") === grabado)
      .map((t) => t.pts.map(([x, y], i) => `${i ? "L" : "M"}${(x - x0 + mar).toFixed(2)} ${(H - mar - (y - y0)).toFixed(2)}`).join(" ") + " Z")
      .join(" ")
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">` +
    `<path d="${ruta(false)}" fill="#E9E2D6" fill-rule="evenodd" stroke="#FF7A2E" stroke-width="0.4"/>` +
    `<path d="${ruta(true)}" fill="${bajo ? "#8C7F6C" : "#C2560A"}" fill-rule="evenodd"/>` +
    `</svg>`
  )
}

const botonSel = (activo: boolean) =>
  `rounded-[8px] px-1.5 py-2 text-[12px] font-semibold ${
    activo ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
  }`

export function GeneradorTexturizador() {
  const { locale } = useParams<{ locale: string }>()
  const [palabras, setPalabras] = useState("SOFÍA")
  const [iconos, setIconos] = useState<IconoTextura[]>(["estrella"])
  const [fuenteId, setFuenteId] = useState("montserrat")
  const [fuente, setFuente] = useState<Fuente | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [ancho, setAncho] = useState("150")
  const [alto, setAlto] = useState("100")
  const [radio, setRadio] = useState("4")
  const [tamano, setTamano] = useState("10")
  const [espacioX, setEspacioX] = useState("5")
  const [espacioY, setEspacioY] = useState("6")
  const [acomodo, setAcomodo] = useState<"cuadricula" | "intercalado">("intercalado")
  const [orilla, setOrilla] = useState("0")
  const [grosor, setGrosor] = useState("3")
  const [relieve, setRelieve] = useState("1.2")
  const [modo, setModo] = useState<"alto" | "bajo">("alto")
  const [espejo, setEspejo] = useState(true)
  const [forma, setForma] = useState<"placa" | "rodillo">("placa")
  const [diametro, setDiametro] = useState("40")
  const [largo, setLargo] = useState("120")
  const [eje, setEje] = useState("12")
  const [grosorMasa, setGrosorMasa] = useState("3")
  const [verSoporte, setVerSoporte] = useState(false)
  const [aviso, setAviso] = useState("")

  useEffect(() => {
    instalarFuentesVista()
    // /disenar/texturizador?forma=rodillo&palabras=… abre ese diseño (fichas de Impresión 3D bajo pedido)
    const d = deUrl(window.location.search)
    const txt = (n?: number) => (n === undefined ? undefined : String(n))
    if (d.forma) setForma(d.forma)
    if (d.palabras) setPalabras(d.palabras.join(", "))
    if (d.iconos) setIconos(d.iconos)
    if (d.fuente && FUENTES.some((f) => f.id === d.fuente)) setFuenteId(d.fuente)
    if (d.acomodo) setAcomodo(d.acomodo)
    if (d.modo) setModo(d.modo)
    if (d.espejo !== undefined) setEspejo(d.espejo)
    const pares: [number | undefined, (v: string) => void][] = [
      [d.tamano, setTamano], [d.espacioX, setEspacioX], [d.espacioY, setEspacioY], [d.orilla, setOrilla], [d.relieve, setRelieve],
      [d.ancho, setAncho], [d.alto, setAlto], [d.radio, setRadio], [d.grosor, setGrosor], [d.diametro, setDiametro], [d.largo, setLargo], [d.eje, setEje],
    ]
    for (const [v, poner] of pares) if (v !== undefined) poner(txt(v)!)
    if (new URLSearchParams(window.location.search).get("soporte") === "1") setVerSoporte(true)
  }, [])

  const listaPalabras = useMemo(
    () => palabras.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean).slice(0, 6),
    [palabras]
  )
  const conTexto = listaPalabras.length > 0

  useEffect(() => {
    if (!conTexto) return
    const t = FUENTES.find((x) => x.id === fuenteId)
    if (!t) return
    let vivo = true
    setCargando(true)
    setError("")
    cargarFuente(t)
      .then((f) => {
        if (vivo) setFuente(f)
      })
      .catch(() => {
        if (vivo) setError("No se pudo cargar la tipografía. Revisa tu conexión e inténtalo otra vez.")
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [fuenteId, conTexto])

  const elegirModelo = (m: Modelo) => {
    setPalabras(m.palabras)
    setIconos(m.iconos)
    setFuenteId(m.fuente)
    setAncho(m.ancho)
    setAlto(m.alto)
    setTamano(m.tamano)
  }

  const alternarIcono = (id: IconoTextura) =>
    setIconos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))

  const rodillo = forma === "rodillo"
  const r = useMemo(() => {
    if (conTexto && !fuente) return null
    try {
      const comun = {
        palabras: listaPalabras,
        iconos,
        tamano: numero(tamano),
        espacioX: numero(espacioX) || 0,
        espacioY: numero(espacioY) || 0,
        acomodo,
        orilla: numero(orilla) || 0,
        relieve: numero(relieve),
        espejo,
      }
      if (rodillo)
        return hacerRodillo(conTexto ? fuente : null, { ...comun, modo: "alto", diametro: numero(diametro), largo: numero(largo), eje: numero(eje) })
      return hacerTexturizador(conTexto ? fuente : null, {
        palabras: listaPalabras,
        iconos,
        ancho: numero(ancho),
        alto: numero(alto),
        radio: numero(radio) || 0,
        tamano: numero(tamano),
        espacioX: numero(espacioX) || 0,
        espacioY: numero(espacioY) || 0,
        acomodo,
        orilla: numero(orilla) || 0,
        grosor: numero(grosor),
        relieve: numero(relieve),
        modo,
        espejo,
      })
    } catch {
      return null
    }
  }, [fuente, conTexto, listaPalabras, iconos, ancho, alto, radio, tamano, espacioX, espacioY, acomodo, orilla, grosor, relieve, modo, espejo, rodillo, diametro, largo, eje])

  const listo = !!r && !r.errores.length
  const hundido = !rodillo && modo === "bajo"
  const vista2d = useMemo(() => (listo ? vistaTextura(r!.dibujo, hundido) : ""), [r, listo, hundido])
  const total = r && "diametroTotal" in r ? (r.diametroTotal as number) : 0
  const vuelta = r && "vuelta" in r ? (r.vuelta as number) : 0
  const diametroSoporte = Math.ceil(total + 10)
  // vista armada: el rodillo puesto en su soporte
  const tris3d = useMemo(() => {
    if (!listo) return undefined
    if (!rodillo || !verSoporte) return r!.malla.tris
    const rod = r!.malla.tris.slice()
    for (let i = 2; i < rod.length; i += 3) rod[i] += APOYO_RODILLO
    return [...hacerSoporte(numero(eje), numero(largo), diametroSoporte).tris, ...rod]
  }, [r, listo, rodillo, verSoporte, eje, largo, diametroSoporte])
  const archivo = `texturizador-hetna-${
    (listaPalabras[0] || iconos[0] || "patron")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30)
      .toLowerCase() || "patron"
  }`
  const medidas = rodillo ? `Ø ${r1(total)} × ${r1(numero(largo))} mm` : `${r1(numero(ancho))} × ${r1(numero(alto))} mm`
  const altoTotal = modo === "alto" ? numero(grosor) + numero(relieve) : numero(grosor)
  const nombreArchivo = rodillo ? archivo.replace("texturizador-", "rodillo-") : archivo

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="¿Qué quieres hacer?">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => setForma("placa")} aria-pressed={!rodillo} className={botonSel(!rodillo)}>
            Placa
          </button>
          <button type="button" onClick={() => setForma("rodillo")} aria-pressed={rodillo} className={botonSel(rodillo)}>
            Rodillo
          </button>
        </div>
      </Seccion>

      <Seccion titulo="Empieza con un modelo">
        <div className="grid grid-cols-3 gap-1.5">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => elegirModelo(m)}
              className="rounded-[8px] bg-[#1C2431] px-1.5 py-2 text-[11.5px] font-semibold leading-tight text-[#C9D2E0] hover:bg-[#243045] hover:text-white"
            >
              {m.nombre}
            </button>
          ))}
        </div>
      </Seccion>

      <label className="flex flex-col gap-1.5">
        <Etiqueta>Palabras</Etiqueta>
        <textarea
          value={palabras}
          onChange={(e) => setPalabras(e.target.value)}
          rows={2}
          maxLength={120}
          placeholder="Vacío = sólo íconos"
          className="w-full resize-y rounded-[8px] bg-[#1C2431] px-3 py-2.5 text-[16px] font-semibold text-white outline-none focus:ring-1 focus:ring-[#C2560A]"
        />
        <span className="text-[11.5px] text-[#8A97AB]">Separa varias palabras con coma o Enter (hasta 6).</span>
      </label>

      <Seccion titulo="Íconos">
        <div className="grid grid-cols-4 gap-1.5">
          {ICONOS_TEXTURA.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => alternarIcono(i.id)}
              aria-pressed={iconos.includes(i.id)}
              title={i.nombre}
              className={botonSel(iconos.includes(i.id))}
            >
              <span className="block text-[18px] leading-none">{i.simbolo}</span>
              <span className="mt-1 block text-[10.5px]">{i.nombre}</span>
            </button>
          ))}
        </div>
      </Seccion>

      {conTexto && (
        <Seccion titulo={`Tipografía${cargando ? " (cargando…)" : ""}`}>
          <div className="max-h-[188px] shrink-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-1.5">
              {FUENTES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFuenteId(t.id)}
                  aria-pressed={fuenteId === t.id}
                  style={{ fontFamily: `"hl-${t.id}", sans-serif`, fontWeight: t.peso }}
                  className={`h-10 truncate rounded-[8px] px-2 text-[15px] ${
                    fuenteId === t.id ? "bg-[#243045] text-white ring-1 ring-[#C2560A]" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045]"
                  }`}
                >
                  {t.nombre}
                </button>
              ))}
            </div>
          </div>
        </Seccion>
      )}

      {rodillo ? (
        <Seccion titulo="Rodillo" nota="El patrón da la vuelta completa sin costura. Se imprime de pie, sin soportes.">
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Diámetro" valor={diametro} cambiar={setDiametro} />
            <CampoNum etiqueta="Largo" valor={largo} cambiar={setLargo} />
            <CampoNum etiqueta="Hueco del eje" valor={eje} cambiar={setEje} />
            <CampoNum etiqueta="Orilla lisa en los extremos" valor={orilla} cambiar={setOrilla} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-[13px] text-[#C9D2E0]">
            <input type="checkbox" checked={verSoporte} onChange={(e) => setVerSoporte(e.target.checked)} className="accent-[#C2560A]" />
            Ver en 3D puesto en su soporte
          </label>
        </Seccion>
      ) : (
        <Seccion titulo="Placa">
          <div className="grid grid-cols-2 gap-2">
            <CampoNum etiqueta="Ancho" valor={ancho} cambiar={setAncho} />
            <CampoNum etiqueta="Alto" valor={alto} cambiar={setAlto} />
            <CampoNum etiqueta="Esquinas" valor={radio} cambiar={setRadio} />
            <CampoNum etiqueta="Orilla lisa (0 = sin)" valor={orilla} cambiar={setOrilla} />
          </div>
        </Seccion>
      )}

      <Seccion titulo="Patrón">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => setAcomodo("intercalado")} aria-pressed={acomodo === "intercalado"} className={botonSel(acomodo === "intercalado")}>
            Intercalado
          </button>
          <button type="button" onClick={() => setAcomodo("cuadricula")} aria-pressed={acomodo === "cuadricula"} className={botonSel(acomodo === "cuadricula")}>
            Cuadrícula
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <CampoNum etiqueta="Tamaño de letra e ícono" valor={tamano} cambiar={setTamano} />
          <CampoNum etiqueta="Espacio entre piezas" valor={espacioX} cambiar={setEspacioX} />
          <CampoNum etiqueta="Espacio entre filas" valor={espacioY} cambiar={setEspacioY} />
        </div>
      </Seccion>

      <Seccion titulo="Impresión 3D" nota="Con el espejo activado, el texto se lee bien al presionar la placa sobre barro, fondant o plastilina.">
        {!rodillo && (
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setModo("alto")} aria-pressed={modo === "alto"} className={botonSel(modo === "alto")}>
              En relieve
            </button>
            <button type="button" onClick={() => setModo("bajo")} aria-pressed={modo === "bajo"} className={botonSel(modo === "bajo")}>
              Hundido
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {!rodillo && <CampoNum etiqueta="Grosor de la placa" valor={grosor} cambiar={setGrosor} />}
          <CampoNum etiqueta={hundido ? "Profundidad" : "Altura del patrón"} valor={relieve} cambiar={setRelieve} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-[13px] text-[#C9D2E0]">
          <input type="checkbox" checked={espejo} onChange={(e) => setEspejo(e.target.checked)} className="accent-[#C2560A]" />
          Espejo (para sellar o texturizar)
        </label>
      </Seccion>

      {conTexto && error && <Aviso tipo="error">{error}</Aviso>}
      {r?.errores.map((e) => (
        <Aviso key={e} tipo="error">
          {e}
        </Aviso>
      ))}
      {listo && r!.avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
    </div>
  )

  const diseno2d = (
    <div className="flex h-full flex-col gap-3 p-4">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#8A97AB]">{cargando ? "Cargando tipografía…" : "Escribe una palabra o elige un ícono."}</p>
      ) : (
        <>
          <Datos
            filas={
              rodillo
                ? [
                    ["Rodillo", medidas],
                    ["Una vuelta", `${r1(vuelta)} mm`],
                    ["Piezas en el patrón", String(r!.piezas)],
                    ["Hueco del eje", `${r1(numero(eje))} mm`],
                  ]
                : [
                    ["Placa", medidas],
                    ["Piezas en el patrón", String(r!.piezas)],
                    ["Impresión 3D", `${r1(altoTotal)} mm de alto`],
                    ["Patrón", modo === "alto" ? `En relieve, ${r1(numero(relieve))} mm` : `Hundido, ${r1(numero(relieve))} mm`],
                  ]
            }
          />
          <div
            className="flex min-h-[300px] flex-1 items-center justify-center rounded-[10px] bg-[#0F151E] p-6 [&>svg]:max-h-[460px] [&>svg]:w-full [&>svg]:max-w-[720px]"
            dangerouslySetInnerHTML={{ __html: vista2d }}
          />
          <p className="m-0 text-[12.5px] text-[#8A97AB]">
            {rodillo ? "Así se ve el patrón desenrollado: una vuelta completa del rodillo. " : ""}
            {espejo ? "Se ve al revés a propósito: al presionarla, la marca queda al derecho." : "Sin espejo: se lee al derecho en la placa."}
          </p>
        </>
      )}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Escribe una palabra o elige un ícono para generar los archivos.</p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <h3 className="m-0 text-[18px] font-bold">Archivos</h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]">En milímetros. STL listo para tu laminador; SVG con la placa y el patrón.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaExport
          titulo="Para impresión 3D"
          nota={rodillo ? "El rodillo de pie, sin soportes. Capas de 0.12 a 0.16 mm para que el patrón salga fino." : "Imprime con la placa acostada y el patrón hacia arriba."}
        >
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${nombreArchivo}.stl`, mallaSTL(r!.malla), "model/stl")}>
              STL
            </Boton>
          </div>
        </TarjetaExport>
        <TarjetaExport
          titulo="Dibujo"
          nota={rodillo ? "El patrón desenrollado (una vuelta), para imprimirlo en papel o grabarlo." : "Placa (corte) y patrón (grabado) para láser o router."}
        >
          <div className="flex gap-2">
            <Boton onClick={() => descargar(`${nombreArchivo}.svg`, dibujoSVG(r!.dibujo, "corte"), "image/svg+xml")}>SVG</Boton>
          </div>
        </TarjetaExport>
      </div>

      {rodillo && (
        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-[16px] font-bold">Accesorios</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <TarjetaExport
              titulo="Mangos (2)"
              nota={`Uno por cada lado: el perno entra al hueco (${r1(numero(eje) - HOLGURA_EJE)} mm, ${HOLGURA_EJE} mm de holgura) y el rodillo gira. Imprímelos de pie, con 100 % de relleno en el perno.`}
            >
              <div className="flex gap-2">
                <Boton
                  tipo="primario"
                  onClick={() => descargar(`${nombreArchivo}-mangos.stl`, mallaSTL(hacerMangos(numero(eje), numero(largo), numero(diametro))), "model/stl")}
                >
                  STL
                </Boton>
              </div>
            </TarjetaExport>
            <TarjetaExport
              titulo="Soporte (sólo cambias el rodillo)"
              nota={`Mango con eje: el rodillo entra en el eje y lo detiene un seguro en C (vienen 2). Sirve para todos tus rodillos con hueco de ${r1(numero(eje))} mm, largo de ${r1(numero(largo))} mm y hasta Ø ${diametroSoporte} mm. Imprímelo acostado, con 100 % de relleno.`}
            >
              <div className="flex gap-2">
                <Boton
                  tipo="primario"
                  onClick={() =>
                    descargar(
                      `soporte-rodillo-eje${r1(numero(eje))}-largo${r1(numero(largo))}-hetna.stl`,
                      mallaSTL(hacerSoporte(numero(eje), numero(largo), diametroSoporte)),
                      "model/stl"
                    )
                  }
                >
                  STL
                </Boton>
              </div>
            </TarjetaExport>
            <TarjetaExport titulo="Guías de grosor (2)" nota="Pon la masa entre las dos guías y pasa el rodillo encima: queda pareja, del grosor de la guía.">
              <div className="flex items-end gap-2">
                <span className="w-[120px]">
                  <CampoNum etiqueta="Grosor de la masa" valor={grosorMasa} cambiar={setGrosorMasa} />
                </span>
                <Boton
                  tipo="primario"
                  onClick={() => descargar(`guias-${r1(numero(grosorMasa) || 3)}mm-hetna.stl`, mallaSTL(hacerGuias(numero(grosorMasa) || 3)), "model/stl")}
                >
                  STL
                </Boton>
              </div>
            </TarjetaExport>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold">¿No tienes impresora 3D?</span>
        <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA la imprime y te la envía.</span>
        <a href={`/${locale}/collections/impresion-3d-bajo-pedido`} className="text-[13px] font-semibold text-[#F2D29B] underline">
          O compra uno de nuestros diseños ya listos, impreso por el taller que elijas
        </a>
        <div className="flex gap-2">
          <Boton
            tipo="primario"
            onClick={() => {
              const ok = mandarAFabricar(`${nombreArchivo}.stl`, mallaSTL(r!.malla), locale, {
                pieza: `${rodillo ? "Rodillo texturizador" : "Texturizador"} ${listaPalabras[0] ? `"${listaPalabras[0]}"` : "de íconos"}`,
                medidas,
                proceso: "Impresión 3D",
              })
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
      titulo={listaPalabras[0] || "Texturizador"}
      subtitulo={rodillo ? "Rodillo texturizador" : "Texturizador para impresión 3D"}
      materialInicial="naranja"
      tris={tris3d}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={[]}
      barra={listo ? <span>· {medidas} · {r!.piezas} piezas</span> : null}
    />
  )
}
