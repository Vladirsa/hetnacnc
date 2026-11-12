"use client"

// Caja con juntas de dedo dentro del 2D Studio: panel oscuro a la izquierda,
// y a la derecha el plano de corte (Diseño 2D), la caja armada (Vista 3D) y
// los archivos (Exportación). Usa el mismo estudio que Letras 3D.
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
import { aDXF, aSVG, acomodar, areaMaterial, generarCaja } from "@/lib/generador/caja"
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
// Medidas de arranque, para probar rápido
const MODELOS = [
  { id: "joyero", nombre: "Joyero", a: 160, f: 110, h: 70, e: 3 },
  { id: "regalo", nombre: "Regalo", a: 200, f: 150, h: 100, e: 3 },
  { id: "organizador", nombre: "Organizador", a: 300, f: 200, h: 120, e: 6 },
  { id: "huacal", nombre: "Huacal", a: 400, f: 300, h: 250, e: 9 },
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
  const [maquina, setMaquina] = useState<keyof typeof MAQUINAS>("laser")
  const [kerf, setKerf] = useState<string>(MAQUINAS.laser.kerf)
  const [fresa, setFresa] = useState("3.175") // 1/8" en mm, fresa común para madera
  const [medidas, setMedidas] = useState<"exteriores" | "interiores">("exteriores")
  const [tapa, setTapa] = useState(true)

  const k = FACTOR[unidad]
  const r = useMemo(
    () =>
      generarCaja({
        ancho: numero(ancho) * k,
        fondo: numero(fondo) * k,
        alto: numero(alto) * k,
        espesor: numero(espesor) * k,
        dedo: numero(dedo) * k,
        kerf: numero(kerf) || 0,
        fresa: maquina === "router" ? numero(fresa) * k || 0 : 0,
        medidas,
        tapa,
      }),
    [ancho, fondo, alto, espesor, dedo, kerf, fresa, maquina, medidas, tapa, k]
  )
  const listo = r.piezas.length > 0
  const ext = r.exterior
  const esp = numero(espesor) * k
  const hoja = listo ? acomodar(r.piezas) : null
  const nombreArchivo = `caja-hetna-${r1(ext.ancho)}x${r1(ext.fondo)}x${r1(ext.alto)}mm-e${r1(esp)}`

  // La caja armada, como malla para el visor del estudio
  const tris = useMemo(() => {
    if (!listo) return undefined
    try {
      return grupoATris(piezasAGrupo3D(r.piezas, esp, ext))
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
    setUnidad(u)
  }

  const usarModelo = (id: string) => {
    const m = MODELOS.find((x) => x.id === id)
    if (!m) return
    const a = (mm: number) => String(Math.round((mm / k) * 1000) / 1000)
    setAncho(a(m.a))
    setFondo(a(m.f))
    setAlto(a(m.h))
    setEspesor(a(m.e))
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
    `Hola HETNA CNC, quiero cotizar el corte de una caja con juntas de dedo:\n` +
    `- Medidas exteriores: ${r1(ext.ancho)} x ${r1(ext.fondo)} x ${r1(ext.alto)} mm\n` +
    `- Material: ${r1(esp)} mm de espesor\n` +
    `- ${r.piezas.length} piezas${tapa ? " (con tapa)" : " (sin tapa)"}, ${hoja ? `hoja de ${r1(hoja.ancho)} x ${r1(hoja.alto)} mm` : ""}\n` +
    `- Máquina: ${MAQUINAS[maquina].nombre}`

  const panel = (
    <div className="flex flex-col gap-4">
      <Seccion titulo="Empezar con">
        <Chips items={MODELOS.map((m) => ({ id: m.id, nombre: m.nombre }))} onClick={usarModelo} />
      </Seccion>

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
          </span>
        )}
      </Destacado>

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

      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Ancho de dedo" valor={dedo} cambiar={setDedo} sufijo={unidad} />
        {maquina === "router" ? (
          <CampoNum etiqueta="Diámetro de fresa" valor={fresa} cambiar={setFresa} sufijo={unidad} />
        ) : (
          <CampoNum etiqueta="Kerf (corte)" valor={kerf} cambiar={setKerf} sufijo="mm" />
        )}
      </div>

      <Interruptor etiqueta="Con tapa" activo={tapa} cambiar={setTapa} />

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
    <div className="flex h-full flex-col gap-3 p-4">
      {!listo ? (
        <p className="m-0 text-[14px] text-[#8A97AB]">Revisa las medidas del panel.</p>
      ) : (
        <>
          <Datos
            filas={[
              ["Hoja necesaria", hoja ? `${r1(hoja.ancho)} × ${r1(hoja.alto)} mm` : "-"],
              ["Material", `${areaMaterial(r.piezas).toFixed(3)} m²`],
              ["Piezas", String(r.piezas.length)],
              ["Espesor", `${r1(esp)} mm`],
            ]}
          />
          <div
            className="min-h-[300px] flex-1 rounded-[10px] bg-[#0F151E] p-3 [&>svg]:h-full [&>svg]:max-h-[560px] [&>svg]:w-full"
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
                  pieza: "Caja con juntas de dedo",
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
      barra={
        listo ? (
          <span>
            · {r1(ext.ancho)} × {r1(ext.fondo)} × {r1(ext.alto)} mm · {r.piezas.length} piezas · {r1(esp)} mm
          </span>
        ) : null
      }
    />
  )
}
