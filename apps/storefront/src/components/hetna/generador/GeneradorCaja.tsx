"use client"

// Caja con juntas de dedo dentro del 2D Studio: panel oscuro a la izquierda,
// y a la derecha el plano de corte (Diseño 2D), la caja armada (Vista 3D) y
// los archivos (Exportación). Usa el mismo estudio que Letras 3D.
//
// Tipos: cerrada, abierta (charola) y con tapa sobrepuesta; a cualquiera se
// le pueden poner divisores, asas y (cerrada) ranura de alcancía. El ancho
// de dedo va en automático (4 × espesor) para que al cambiar de material la
// caja siga saliendo; a mano se puede fijar.
import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"

import {
  Aviso,
  Boton,
  CampoNum,
  Chips,
  Datos,
  Destacado,
  Interruptor,
  Opciones,
  Seccion,
  TarjetaExport,
  descargar,
  grupoATris,
  numero,
  r1,
} from "@/components/hetna/estudio3d/Controles"
import { mandarACotizador, mandarAFabricar } from "@/lib/generador/aCotizador"
import { aDXF, aSVG, acomodar, areaMaterial, dedoAutomatico, generarCaja, type TipoCaja } from "@/lib/generador/caja"
import { piezasAGrupo3D } from "@/lib/generador/caja3d"

const Estudio3D = dynamic(() => import("@/components/hetna/estudio3d/Estudio3D").then((m) => m.Estudio3D), { ssr: false })
const CajaSolido = dynamic(() => import("./CajaSolido"), { ssr: false })

type Unidad = "mm" | "cm" | "in"
const FACTOR: Record<Unidad, number> = { mm: 1, cm: 10, in: 25.4 }
const MAQUINAS = {
  laser: { nombre: "Láser", kerf: "0.15" },
  router: { nombre: "Router CNC", kerf: "0" },
} as const
const ESPESORES = [
  { etiqueta: "MDF 3", mm: 3 },
  { etiqueta: "MDF 6", mm: 6 },
  { etiqueta: "MDF 9", mm: 9 },
  { etiqueta: "MDF 12", mm: 12 },
  { etiqueta: "MDF 18", mm: 18 },
  { etiqueta: "Acrílico 3", mm: 3 },
  { etiqueta: "Acrílico 5", mm: 5 },
]
const TIPOS: { id: TipoCaja; nombre: string; nota: string }[] = [
  { id: "cerrada", nombre: "Cerrada", nota: "6 caras, tapa fija con dedos" },
  { id: "abierta", nombre: "Abierta", nota: "Charola u organizador, sin tapa" },
  { id: "sobrepuesta", nombre: "Con tapa", nota: "Tapa que se quita, cae por fuera" },
]

type Modelo = {
  id: string
  nombre: string
  tipo: TipoCaja
  a: number
  f: number
  h: number
  e: number
  cols?: number
  filas?: number
  asas?: boolean
  ranura?: boolean
  tapa?: number
}
// Medidas de arranque, para probar rápido (mm, exteriores)
const MODELOS: Modelo[] = [
  { id: "joyero", nombre: "Joyero", tipo: "sobrepuesta", a: 180, f: 120, h: 70, e: 3, cols: 3, filas: 2, tapa: 25 },
  { id: "regalo", nombre: "Caja de regalo", tipo: "sobrepuesta", a: 200, f: 150, h: 100, e: 3, tapa: 35 },
  { id: "te", nombre: "Caja de té", tipo: "sobrepuesta", a: 240, f: 170, h: 90, e: 3, cols: 3, filas: 2, tapa: 30 },
  { id: "organizador", nombre: "Organizador", tipo: "abierta", a: 300, f: 200, h: 80, e: 6, cols: 3, filas: 2 },
  { id: "lapicero", nombre: "Lapicero", tipo: "abierta", a: 90, f: 90, h: 110, e: 3 },
  { id: "charola", nombre: "Charola con asas", tipo: "abierta", a: 380, f: 260, h: 70, e: 6, asas: true },
  { id: "huacal", nombre: "Huacal", tipo: "abierta", a: 400, f: 300, h: 250, e: 9, asas: true },
  { id: "herramientas", nombre: "Caja de herramientas", tipo: "abierta", a: 420, f: 220, h: 160, e: 9, cols: 2, asas: true },
  { id: "alcancia", nombre: "Alcancía", tipo: "cerrada", a: 140, f: 100, h: 120, e: 3, ranura: true },
  { id: "vino", nombre: "Caja para vino", tipo: "sobrepuesta", a: 110, f: 110, h: 360, e: 6, tapa: 60 },
  { id: "cubo", nombre: "Cubo", tipo: "cerrada", a: 100, f: 100, h: 100, e: 3 },
  { id: "cajon", nombre: "Cajón para mueble", tipo: "abierta", a: 450, f: 400, h: 150, e: 12 },
]

const TELEFONO = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522217076014"

export function GeneradorCaja() {
  const { locale } = useParams<{ locale: string }>()
  const [aviso, setAviso] = useState("")
  const [unidad, setUnidad] = useState<Unidad>("mm")
  const [ancho, setAncho] = useState("200")
  const [fondo, setFondo] = useState("150")
  const [alto, setAlto] = useState("100")
  const [espesor, setEspesor] = useState("3")
  const [dedo, setDedo] = useState("12")
  const [dedoAuto, setDedoAuto] = useState(true)
  const [tipo, setTipo] = useState<TipoCaja>("cerrada")
  const [altoTapa, setAltoTapa] = useState("30")
  const [columnas, setColumnas] = useState(1)
  const [filas, setFilas] = useState(1)
  const [asas, setAsas] = useState(false)
  const [ranura, setRanura] = useState(false)
  const [modelo, setModelo] = useState("")
  const [maquina, setMaquina] = useState<keyof typeof MAQUINAS>("laser")
  const [kerf, setKerf] = useState<string>(MAQUINAS.laser.kerf)
  const [fresa, setFresa] = useState("3.175") // 1/8" en mm, fresa común para madera
  const [medidas, setMedidas] = useState<"exteriores" | "interiores">("exteriores")

  const k = FACTOR[unidad]
  const r = useMemo(
    () =>
      generarCaja({
        ancho: numero(ancho) * k,
        fondo: numero(fondo) * k,
        alto: numero(alto) * k,
        espesor: numero(espesor) * k,
        dedo: dedoAuto ? 0 : numero(dedo) * k,
        kerf: numero(kerf) || 0,
        fresa: maquina === "router" ? numero(fresa) * k || 0 : 0,
        medidas,
        tipo,
        altoTapa: numero(altoTapa) * k,
        columnas,
        filas,
        asas,
        ranura: tipo === "cerrada" && ranura,
      }),
    [ancho, fondo, alto, espesor, dedo, dedoAuto, kerf, fresa, maquina, medidas, tipo, altoTapa, columnas, filas, asas, ranura, k]
  )
  const listo = r.piezas.length > 0
  const ext = r.exterior
  const esp = numero(espesor) * k
  const tapa = tipo !== "abierta"
  const nombreTipo = TIPOS.find((x) => x.id === tipo)?.nombre || ""
  const hoja = listo ? acomodar(r.piezas) : null
  const nombreArchivo = `caja-hetna-${r1(ext.ancho)}x${r1(ext.fondo)}x${r1(ext.alto)}mm-e${r1(esp)}`

  // La caja armada, como malla para el visor del estudio
  const tris = useMemo(() => {
    if (!listo) return undefined
    try {
      // la tapa sobrepuesta se ve levantada, para que se vea adentro
      const alzar = Math.max(15, ext.alto * 0.45)
      const piezas = r.piezas.map((p) =>
        p.nombre.startsWith("Tapa · ") && p.ubicacion
          ? { ...p, ubicacion: { ...p.ubicacion, origen: [p.ubicacion.origen[0], p.ubicacion.origen[1] + alzar, p.ubicacion.origen[2]] as [number, number, number] } }
          : p
      )
      return grupoATris(piezasAGrupo3D(piezas, esp, ext))
    } catch {
      return undefined
    }
  }, [listo, r, esp, ext])

  const vista = useMemo(
    () =>
      listo
        ? aSVG(r.piezas, "vista")
            .replace(/fill="#FDEEE1" fill-opacity="0.55"/g, 'fill="#C9A27A" fill-opacity="0.9"')
            .replace(/stroke="#C2560A" stroke-width="1.4"/g, 'stroke="#FF7A2E" stroke-width="1.4"')
            .replace(/fill="#6B6A63" font-family/g, 'fill="#FFFFFF" font-family')
        : "",
    [r, listo]
  )

  const cambiarUnidad = (u: Unidad) => {
    const conv = (s: string) => {
      const v = numero(s)
      return Number.isFinite(v) ? String(Math.round(((v * FACTOR[unidad]) / FACTOR[u]) * 1000) / 1000) : s
    }
    setAncho(conv(ancho))
    setFondo(conv(fondo))
    setAlto(conv(alto))
    setEspesor(conv(espesor))
    setDedo(conv(dedo))
    setFresa(conv(fresa))
    setAltoTapa(conv(altoTapa))
    setUnidad(u)
  }

  const usarModelo = (id: string) => {
    const m = MODELOS.find((x) => x.id === id)
    if (!m) return
    const a = (mm: number) => String(Math.round((mm / k) * 1000) / 1000)
    setModelo(id)
    setTipo(m.tipo)
    setMedidas("exteriores")
    setAncho(a(m.a))
    setFondo(a(m.f))
    setAlto(a(m.h))
    setEspesor(a(m.e))
    setColumnas(m.cols || 1)
    setFilas(m.filas || 1)
    setAsas(!!m.asas)
    setRanura(!!m.ranura)
    if (m.tapa) setAltoTapa(a(m.tapa))
    // el dedo vuelve a automático: así un material grueso no rompe la caja
    setDedoAuto(true)
  }

  const imprimir = () => {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(
      `<!doctype html><title>${nombreArchivo}</title><style>@page{margin:5mm}body{margin:0}</style>` +
        `<p style="font:12px sans-serif">Imprime al 100% (sin "ajustar a la página"). Medidas en mm.</p>` +
        aSVG(r.piezas, "corte")
    )
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const mensaje =
    `Hola HETNA CNC, quiero cotizar el corte de una caja con juntas de dedo (${nombreTipo.toLowerCase()}):\n` +
    `- Medidas exteriores: ${r1(ext.ancho)} x ${r1(ext.fondo)} x ${r1(ext.alto)} mm\n` +
    `- Material: ${r1(esp)} mm de espesor\n` +
    `- ${r.piezas.length} piezas${tapa ? " (con tapa)" : " (sin tapa)"}${columnas * filas > 1 ? `, ${columnas * filas} compartimentos` : ""}, ${hoja ? `hoja de ${r1(hoja.ancho)} x ${r1(hoja.alto)} mm` : ""}\n` +
    `- Máquina: ${MAQUINAS[maquina].nombre}`

  const Contador = ({ etiqueta, valor, cambiar }: { etiqueta: string; valor: number; cambiar: (n: number) => void }) => (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[12.5px] text-[#C9D2E0]">{etiqueta}</span>
      <div className="flex items-center rounded-[8px] bg-[#1C2431]">
        <button type="button" aria-label={`Menos: ${etiqueta}`} onClick={() => cambiar(Math.max(1, valor - 1))} className="px-3 py-2 text-[16px] text-[#C9D2E0] hover:text-white">
          −
        </button>
        <span className="flex-1 text-center text-[14px] font-semibold text-white">{valor}</span>
        <button type="button" aria-label={`Más: ${etiqueta}`} onClick={() => cambiar(Math.min(12, valor + 1))} className="px-3 py-2 text-[16px] text-[#C9D2E0] hover:text-white">
          +
        </button>
      </div>
    </div>
  )

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Tipo de caja">
        <Opciones
          opciones={TIPOS.map((t) => ({ id: t.id, nombre: t.nombre }))}
          valor={tipo}
          cambiar={(t) => {
            setTipo(t)
            setModelo("")
          }}
        />
        <span className="text-[11.5px] leading-snug text-[#8A97AB]">{TIPOS.find((t) => t.id === tipo)?.nota}</span>
      </Seccion>

      <Seccion titulo="Empezar con un modelo">
        <div className="flex flex-wrap gap-1.5">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => usarModelo(m.id)}
              aria-pressed={modelo === m.id}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                modelo === m.id ? "bg-[#C2560A] text-white" : "bg-[#1C2431] text-[#C9D2E0] hover:bg-[#243045] hover:text-white"
              }`}
            >
              {m.nombre}
            </button>
          ))}
        </div>
      </Seccion>

      <Destacado titulo="Medidas de la caja">
        <Opciones
          opciones={[
            { id: "mm", nombre: "mm" },
            { id: "cm", nombre: "cm" },
            { id: "in", nombre: "pulgadas" },
          ]}
          valor={unidad}
          cambiar={(u) => cambiarUnidad(u as Unidad)}
        />
        <div className="grid grid-cols-3 gap-2">
          <CampoNum etiqueta="Ancho" valor={ancho} cambiar={setAncho} sufijo="" />
          <CampoNum etiqueta="Fondo" valor={fondo} cambiar={setFondo} sufijo="" />
          <CampoNum etiqueta="Alto" valor={alto} cambiar={setAlto} sufijo="" />
        </div>
        <Opciones
          opciones={[
            { id: "exteriores", nombre: "Exteriores" },
            { id: "interiores", nombre: "Interiores" },
          ]}
          valor={medidas}
          cambiar={(m) => setMedidas(m as "exteriores" | "interiores")}
        />
        {listo && (
          <span className="text-[12px] text-[#F2D29B]">
            Exterior {r1(ext.ancho)} × {r1(ext.fondo)} × {r1(ext.alto)} mm · interior {r1(r.interior.ancho)} × {r1(r.interior.fondo)} ×{" "}
            {r1(r.interior.alto)} mm
            {tipo === "sobrepuesta" && ` · con la tapa puesta ${r1(r.armado.ancho)} × ${r1(r.armado.fondo)} × ${r1(r.armado.alto)} mm`}
          </span>
        )}
      </Destacado>

      {tipo === "sobrepuesta" && (
        <CampoNum etiqueta="Alto de la tapa (por fuera)" valor={altoTapa} cambiar={setAltoTapa} sufijo={unidad} />
      )}

      <Seccion titulo="Material">
        <CampoNum etiqueta="Espesor" valor={espesor} cambiar={setEspesor} sufijo={unidad} />
        <Chips
          items={ESPESORES.map((e) => ({ id: e.etiqueta, nombre: `${e.etiqueta} mm` }))}
          onClick={(id) => {
            const e = ESPESORES.find((x) => x.etiqueta === id)
            if (e) setEspesor(String(Math.round((e.mm / k) * 1000) / 1000))
          }}
        />
      </Seccion>

      <Seccion titulo="Compartimentos" nota="Divisores sueltos que se cruzan a media altura; entran desde arriba.">
        <div className="grid grid-cols-2 gap-2">
          <Contador etiqueta="A lo ancho" valor={columnas} cambiar={setColumnas} />
          <Contador etiqueta="A lo fondo" valor={filas} cambiar={setFilas} />
        </div>
      </Seccion>

      <div className="flex flex-col gap-2">
        <Interruptor etiqueta="Asas en los costados" activo={asas} cambiar={setAsas} />
        {tipo === "cerrada" && <Interruptor etiqueta="Ranura de alcancía en la tapa" activo={ranura} cambiar={setRanura} />}
      </div>

      <Seccion titulo="Máquina">
        <Opciones
          opciones={(Object.keys(MAQUINAS) as (keyof typeof MAQUINAS)[]).map((m) => ({ id: m, nombre: MAQUINAS[m].nombre }))}
          valor={maquina}
          cambiar={(m) => {
            setMaquina(m)
            setKerf(MAQUINAS[m].kerf)
          }}
        />
      </Seccion>

      <div className="flex flex-col gap-2">
        <Interruptor
          etiqueta={`Dedos automáticos${dedoAuto && listo ? ` (${r1(r.dedoUsado / k)} ${unidad})` : ""}`}
          activo={dedoAuto}
          cambiar={(v) => {
            if (!v) setDedo(String(Math.round((r.dedoUsado || dedoAutomatico(esp)) / k * 1000) / 1000))
            setDedoAuto(v)
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          {!dedoAuto && <CampoNum etiqueta="Ancho de dedo" valor={dedo} cambiar={setDedo} sufijo={unidad} />}
          {maquina === "router" ? (
            <CampoNum etiqueta="Diámetro de fresa" valor={fresa} cambiar={setFresa} sufijo={unidad} />
          ) : (
            <CampoNum etiqueta="Kerf (corte)" valor={kerf} cambiar={setKerf} sufijo="mm" />
          )}
        </div>
      </div>

      {r.errores.map((e) => (
        <Aviso key={e} tipo="error">
          {e}
        </Aviso>
      ))}
      {r.avisos.map((a) => (
        <Aviso key={a}>{a}</Aviso>
      ))}
      {maquina === "router" && numero(fresa) * k > 0 && listo && (
        <Aviso tipo="ok">El archivo ya trae el alivio de esquina (&quot;dogbone&quot;) para tu fresa de {r1(numero(fresa) * k)} mm.</Aviso>
      )}
    </div>
  )

  const diseno2d = (
    <div className="flex h-full flex-col gap-3 p-3 lg:p-4">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#F6B8AE]">{r.errores[0] || "Revisa las medidas del panel."}</p>
      ) : (
        <>
          <div className="hidden sm:block">
            <Datos
              filas={[
                ["Hoja necesaria", hoja ? `${r1(hoja.ancho)} × ${r1(hoja.alto)} mm` : "-"],
                ["Material", `${areaMaterial(r.piezas).toFixed(3)} m²`],
                ["Piezas", `${r.piezas.length}${columnas * filas > 1 ? ` · ${columnas * filas} compartimentos` : ""}`],
                ["Espesor", `${r1(esp)} mm`],
              ]}
            />
          </div>
          <p className="m-0 text-[12px] text-[#C9D2E0] sm:hidden">
            Hoja {hoja ? `${r1(hoja.ancho)} × ${r1(hoja.alto)} mm` : "-"} · {r.piezas.length} piezas · {areaMaterial(r.piezas).toFixed(3)} m²
          </p>
          <div
            className="min-h-[200px] flex-1 rounded-[10px] bg-[#0F151E] p-3 [&>svg]:h-full [&>svg]:max-h-[560px] [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: vista }}
          />
        </>
      )}
    </div>
  )

  const exportacion = !listo ? (
    <p className="m-0 text-[14px] text-[#8A97AB]">Completa las medidas para generar los archivos.</p>
  ) : (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <h3 className="m-0 text-[18px] font-bold">Archivos de corte</h3>
        <p className="m-0 mt-1 text-[13px] text-[#8A97AB]">Revisa el archivo antes de cortar y haz una prueba en retazo para ajustar el kerf.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TarjetaExport titulo="Para tu máquina" nota="DXF para LightBurn, RDWorks, Aspire o Fusion; SVG para Inkscape o Illustrator.">
          <div className="flex gap-2">
            <Boton tipo="primario" onClick={() => descargar(`${nombreArchivo}.dxf`, aDXF(r.piezas), "application/dxf")}>
              DXF
            </Boton>
            <Boton onClick={() => descargar(`${nombreArchivo}.svg`, aSVG(r.piezas, "corte"), "image/svg+xml")}>SVG</Boton>
            <Boton onClick={imprimir}>PDF</Boton>
          </div>
        </TarjetaExport>
        <TarjetaExport titulo="¿Cuánto cuesta cortarla?" nota="Ve el precio al instante o pídela por WhatsApp.">
          <div className="flex gap-2">
            <Boton
              tipo="verde"
              onClick={() => {
                if (!mandarACotizador(`${nombreArchivo}.dxf`, aDXF(r.piezas), locale))
                  setAviso("El archivo es muy grande para pasarlo al Cotizador. Descárgalo y súbelo ahí.")
              }}
            >
              Cotizador
            </Boton>
            <Boton href={`https://wa.me/${TELEFONO}?text=${encodeURIComponent(mensaje)}`}>WhatsApp</Boton>
          </div>
        </TarjetaExport>
      </div>

      <div className="flex flex-col gap-2 rounded-[12px] border border-[#C2560A]/50 bg-[#C2560A]/10 p-4">
        <span className="text-[15px] font-bold">¿No tienes máquina?</span>
        <span className="text-[13px] text-[#F2D29B]">Un taller de HETNA te la corta y te la envía.</span>
        <div>
          <Boton
            tipo="primario"
            onClick={() => {
              if (
                !mandarAFabricar(`${nombreArchivo}.dxf`, aDXF(r.piezas), locale, {
                  pieza: `Caja con juntas de dedo (${nombreTipo.toLowerCase()})`,
                  medidas: `${r1(ext.ancho)} × ${r1(ext.fondo)} × ${r1(ext.alto)} mm`,
                  proceso: maquina === "router" ? "Router CNC" : "Corte láser",
                })
              )
                setAviso("El archivo es muy grande para mandarlo. Descárgalo y súbelo en la solicitud.")
            }}
          >
            Fabrícamelo
          </Boton>
        </div>
      </div>
      {aviso && <Aviso tipo="error">{aviso}</Aviso>}

      <div className="overflow-hidden rounded-[14px] text-[#1B1B18]">
        <CajaSolido piezas={r.piezas} espesor={esp} exterior={ext} nombreArchivo={nombreArchivo} />
      </div>
    </div>
  )

  return (
    <Estudio3D
      llenar
      titulo="Caja con juntas de dedo"
      subtitulo="2D Studio · láser y router"
      materialInicial="mdf"
      lineas
      dePie
      tris={tris}
      panel={panel}
      diseno2d={diseno2d}
      exportacion={exportacion}
      avisos={[]}
      sinPieza={r.errores[0] || "Revisa las medidas del panel."}
      barra={
        listo ? (
          <span>
            · {nombreTipo} · {r.piezas.length} piezas · {r1(esp)} mm · dedo {r1(r.dedoUsado)} mm
          </span>
        ) : null
      }
    />
  )
}
