import { DIAS_SOLICITUD_ABIERTA, PLAZO_PRIMERA_RESPUESTA } from "@/lib/hetna/promesas"
import EjemploCotizacion from "@/components/hetna/cotizar/EjemploCotizacion"
import CasosReales from "@/components/hetna/CasosReales"
import { JsonLd } from "@/components/hetna/JsonLd"
import { migas, servicioSchema } from "@/lib/hetna/schema"
import type { Metadata } from "next"

import { vistaPreviaWhatsapp } from "@/lib/publicidad/vista-previa"

import FormSolicitudTaller from "@/components/hetna/taller/FormSolicitudTaller"
import { verSolicitud } from "@/lib/cotizar/solicitud-taller"
import { CotizadorCliente } from "@/components/hetna/cotizador/CotizadorCliente"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { BloquePublicidad } from "@/components/hetna/disenar/BloquePublicidad"
import { TalleresCerca } from "@/components/hetna/taller/TalleresCerca"
import { listarTalleres, tallerPorHandle } from "@/lib/hetna/talleres"

const METADATA: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/cotizar" },
  title: "Solicitar cotización CNC",
  description:
    "Cotiza corte láser, router CNC, grabado y maquinado con talleres de México. Describe tu trabajo y recibe propuestas de talleres para comparar y elegir.",
}

// ?wa=N: la liga viene del WhatsApp de HETNA y la tarjeta muestra un anuncio (lib/publicidad/vista-previa.ts)
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ wa?: string }> }): Promise<Metadata> {
  const { wa } = await searchParams
  return vistaPreviaWhatsapp(wa, METADATA)
}

const CALCULADORAS = [
  {
    href: "/cotizar/corte-laser",
    titulo: "Corte láser",
    texto: "Precio estimado al instante para MDF, madera y acrílico.",
  },
  {
    href: "/cotizar/router-cnc",
    titulo: "Router CNC",
    texto: "Precio estimado al instante para corte en router.",
  },
  {
    href: "/cotizar/corte-plasma",
    titulo: "Corte plasma",
    texto: "Precio estimado al instante para lámina y placa de acero o aluminio.",
  },
  {
    href: "/cotizar/impresion-3d",
    titulo: "Impresión 3D",
    texto: "Precio estimado al instante en PLA, PETG, ABS y TPU.",
  },
]

export default async function CotizarPage({
  searchParams,
}: {
  searchParams: Promise<{
    taller?: string
    servicio?: string
    necesidad?: string
    // Desde "Fabrícamelo" en Diseñar y escanear: la pieza ya viene lista
    desde?: string
    pieza?: string
    medidas?: string
    material?: string
    archivo?: string
    proceso?: string
    // Proyectos (Cotizador, Partir 3D): cantidad total y descripción ya escrita
    cantidad?: string
    nota?: string
    // Desde la tienda: lo que se buscó y no había
    descripcion?: string
    // Repetir un pedido anterior (liga que manda el agente de WhatsApp): token de la solicitud
    repite?: string
  }>
}) {
  const sp = await searchParams
  const { taller, servicio, necesidad, desde, pieza, medidas, material, archivo, proceso, descripcion, cantidad, nota, repite } = sp
  const descripcionInicial = typeof descripcion === "string" && descripcion.trim() ? descripcion.trim() : undefined
  const [t, talleres] = await Promise.all([taller ? tallerPorHandle(taller) : null, listarTalleres().catch(() => [])])
  // Lo que no es el taller elegido, para que "Cotizar con este taller" conserve la pieza
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "taller" && typeof v === "string") as [string, string][]).toString()
  const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined)
  // Repetir pedido (estrategia 3.5): la solicitud anterior ya llena, sin archivos
  // (sin cuenta no se reusan: el cliente los vuelve a subir si hacen falta)
  const anterior = typeof repite === "string" && /^[\w-]{8,80}$/.test(repite) ? await verSolicitud(repite).catch(() => null) : null
  const t0 = anterior?.trabajo || null
  const prellenado = t0
    ? {
        pieza: String(t0.descripcion || "Pieza").split(/[.\n]/)[0].slice(0, 80),
        medidas: t0.medidas || undefined,
        material: t0.material || undefined,
        proceso: t0.servicio || undefined,
        cantidad: t0.cantidad || undefined,
        descripcion: String(t0.descripcion || "").slice(0, 1500) || undefined,
        repiteFolio: anterior!.folio,
      }
    : desde && pieza ? { desde, pieza, medidas, material, archivo: archivo?.startsWith("/") ? archivo : undefined, proceso, cantidad: texto(cantidad, 60), descripcion: texto(nota, 1500) } : undefined

  return (
    <main className="w-full bg-[#FAF9F6]">
      <JsonLd
        datos={[
          servicioSchema({ nombre: "Cotización de trabajos CNC", descripcion: "Describe tu trabajo de corte, grabado, maquinado o impresión 3D y recibe propuestas de talleres CNC de México.", ruta: "/mx/cotizar", tipo: "Fabricación CNC" }),
          migas([{ nombre: "Inicio", ruta: "https://hetnacnc.com/mx" }, { nombre: "Solicitar cotización" }]),
        ]}
      />
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-6">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#C2560A]">Cotización</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#142033] sm:text-4xl">
            {t ? `Cotiza con ${t.nombre}` : prellenado?.desde === "producto" ? "Fabrica este diseño con un taller" : prellenado ? "Fabrícamelo: elige quién la corta" : "Solicita tu trabajo CNC"}
          </h1>
          <p className="mt-2 max-w-2xl text-[#6B675C]">
            {t
              ? `Describe tu trabajo y ${t.nombre} te manda su propuesta. Te llega una liga por correo para verla, elegir y pagar dentro de HETNA.`
              : prellenado
                ? `Cuéntanos qué necesitas, sube tu archivo (o descríbelo si no tienes) y los talleres de la red te mandan propuestas durante ${DIAS_SOLICITUD_ABIERTA} días. Te llega una liga por correo para compararlas, elegir y pagar dentro de HETNA.`
                : `Sube tu archivo o escribe las medidas y ve un precio aproximado al instante. Si te conviene, pide propuestas: los talleres de la red te cotizan durante ${DIAS_SOLICITUD_ABIERTA} días y tú eliges y pagas dentro de HETNA.`}
          </p>
          {/* Tarea 6 de la auditoría de mejoras: el plazo, visible antes del formulario */}
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#EEF7F0] px-3 py-1.5 text-[14px] font-semibold text-[#17633A]" data-testid="plazo-respuesta">
            ⏱ Te respondemos en {PLAZO_PRIMERA_RESPUESTA}. Sin registro: sólo tu nombre y correo.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {t || prellenado ? (
            <FormSolicitudTaller taller={t?.handle} nombreTaller={t?.nombre} servicioInicial={servicio} necesidadInicial={necesidad} descripcionInicial={descripcionInicial} prellenado={prellenado} />
          ) : (
            // Sin taller ni datos prellenados: primero el estimado al instante (lo que
            // prometen los anuncios y los correos a compradores) y, para diseño,
            // grabado, volumen o trabajos sin medidas, la solicitud completa.
            <div className="grid content-start gap-6">
              <CotizadorCliente />
              <details className="rounded-[18px] border border-[#E7E4DC] bg-white p-5" open={Boolean(servicio || necesidad || descripcionInicial)}>
                <summary className="cursor-pointer text-[16px] font-bold text-[#142033]">
                  ¿Necesitas diseño, grabado, producción por volumen o no tienes medidas? Llena la solicitud completa
                </summary>
                <div className="mt-4">
                  <FormSolicitudTaller servicioInicial={servicio} necesidadInicial={necesidad} descripcionInicial={descripcionInicial} />
                </div>
              </details>
            </div>
          )}

          <aside className="grid content-start gap-4">
            <EjemploCotizacion />
            <TalleresCerca talleres={talleres.filter((x) => x.handle !== t?.handle)} proceso={proceso || servicio} query={query} />
            <LocalizedClientLink
              href="/cotizar/suministro"
              className="rounded-2xl border border-[#1E7B3A]/30 bg-[#EEF6F0] p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="font-bold text-[#142033]">📦 ¿Necesitas material o insumos? →</p>
              <p className="mt-1 text-sm text-[#40403A]">Lámina, MDF, acrílico, fresas o consumibles: los proveedores te cotizan.</p>
            </LocalizedClientLink>
            <p className="text-sm font-semibold text-[#142033]">¿Quieres un precio al instante?</p>
            {CALCULADORAS.map((c) => (
              <LocalizedClientLink
                key={c.href}
                href={c.href}
                className="rounded-2xl border border-[#E7E4DC] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="font-bold text-[#142033]">{c.titulo} →</p>
                <p className="mt-1 text-sm text-[#6B675C]">{c.texto}</p>
              </LocalizedClientLink>
            ))}
            <LocalizedClientLink
              href="/talleres"
              className="rounded-2xl bg-[#142033] p-5 text-white transition hover:-translate-y-0.5"
            >
              <p className="font-bold">Ver directorio de talleres →</p>
              <p className="mt-1 text-sm text-white/70">Elige un taller por servicio, material o estado.</p>
            </LocalizedClientLink>
            <BloquePublicidad />
          </aside>
        </div>
        <CasosReales compacto />
      </div>
    </main>
  )
}
