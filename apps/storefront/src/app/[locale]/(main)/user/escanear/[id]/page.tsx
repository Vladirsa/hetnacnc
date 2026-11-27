import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { AprobarRender } from "@/components/hetna/escanear/AprobarRender"
import { CotizarEscanear } from "@/components/hetna/escanear/CotizarEscanear"
import { SubirArchivosEscanear } from "@/components/hetna/escanear/SubirArchivosEscanear"
import { Estudio3D } from "@/components/hetna/estudio3d/Estudio3D"
import { cargarSolicitudEscanear } from "@/lib/escanear/acciones"
import { fechaSegura } from "@/lib/helpers/fecha-segura"

export const dynamic = "force-dynamic"
const metadataEs: Metadata = { title: "Escanear · Mi pieza", robots: { index: false, follow: false } }

const PASOS = [
  ["recibida", "Recibida"],
  ["en_escaneo", "En escaneo"],
  ["en_rediseno", "En rediseño"],
  ["render_listo", "Render listo"],
  ["aprobada", "Aprobada"],
  ["en_prototipo", "En prototipo"],
  ["en_fabricacion", "En fabricación"],
  ["terminada", "Terminada"],
] as const
const SALIDA: Record<string, string> = { reposicion: "Pieza de reposición", adaptacion: "Pieza adaptada", molde: "Molde" }
const USO: Record<string, string> = { precision: "Precisión de ingeniería", mueble: "Mueble o madera", repuesto: "Repuesto común" }
const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" })
const mb = (b: number) => `${(b / 1048576).toFixed(b > 1048576 ? 1 : 2)} MB`

export default async function SolicitudEscanearPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const r = await cargarSolicitudEscanear(id)
  if (!r.ok) {
    if (r.noAutenticado) {
      return (
        <main className="container py-16 text-center">
          <LocalizedClientLink href="/login" className="rounded-[10px] bg-[#C2560A] px-6 py-3 font-semibold text-white"><TS>Inicia sesión para ver tu pieza</TS></LocalizedClientLink>
        </main>
      )
    }
    notFound()
  }
  const s = r.datos.solicitud
  const ruta = (a: { id: string }) => `/api/escanear/${s.id}/archivos/${a.id}`
  const renders = s.archivos.filter((a) => a.tipo === "render")
  const modelos = s.archivos.filter((a) => a.tipo === "modelo")
  const modeloStl = [...modelos].reverse().find((a) => /\.stl$/i.test(a.nombre))
  const propios = s.archivos.filter((a) => a.de === "cliente")
  const indice = PASOS.findIndex(([e]) => e === s.estado)
  const cerrada = s.estado === "terminada" || s.estado === "cancelada"
  const aprobada = ["aprobada", "en_prototipo", "en_fabricacion", "terminada"].includes(s.estado)
  const ultimoModelo = modelos[modelos.length - 1] || null

  return (
    <main className="container">
      <div className="mx-auto max-w-[980px] py-8">
        <LocalizedClientLink href="/user/escanear" className="text-[14px] font-semibold text-[#B34D07]"><TS>← Mis piezas</TS></LocalizedClientLink>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="m-0 text-[27px] font-bold text-[#0E2A5C]"><TS>{s.titulo}</TS></h1>
          <span className="text-[14px] font-bold text-[#6B6A63]"><TS>{s.folio_texto}</TS></span>
        </div>
        <p className="mt-3 rounded-[10px] border border-[#F2D9C4] bg-[#FFF8F1] px-4 py-3 text-[13.5px] leading-relaxed text-[#6B4A2B]"><TS>{s.aviso}</TS></p>

        {/* Estados */}
        {s.estado === "cancelada" ? (
          <p className="mt-5 rounded-[10px] bg-[#F3F3F1] px-4 py-3 text-[15px] font-semibold text-[#6B6A63]"><TS>Solicitud cancelada.</TS></p>
        ) : (
          <ol className="mt-5 grid grid-cols-2 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-8">
            {PASOS.map(([e, nombre], i) => (
              <li key={e} className={`list-none rounded-[10px] px-2.5 py-2 text-center text-[12.5px] font-semibold ${i < indice ? "bg-[#E7F6EE] text-[#0F7A4A]" : i === indice ? "bg-[#C2560A] text-white" : "bg-[#F3F3F1] text-[#8A8880]"}`}>
                <TS>{nombre}</TS>
                {s.tiempos[e] && <span className="block text-[11px] font-normal opacity-80">{fechaSegura(FECHA, s.tiempos[e])}</span>}
              </li>
            ))}
          </ol>
        )}

        {/* Render para aprobar */}
        {(renders.length > 0 || modelos.length > 0) && (
          <section className="mt-8 rounded-[14px] border border-[#E7E4DC] bg-white p-5">
            <h2 className="m-0 text-[20px] font-bold text-[#0E2A5C]"><TS>Pieza reconstruida</TS></h2>
            {s.estado === "render_listo" && <p className="m-0 mt-1 text-[14.5px] text-[#40403A]"><TS>Revísala con calma. Apruébala si está bien o pide los ajustes que necesites; no se fabrica nada sin tu aprobación.</TS></p>}
            {renders.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {renders.map((a) => (
                  <a key={a.id} href={ruta(a)} target="_blank" rel="noopener" className="block overflow-hidden rounded-[10px] border border-[#E7E4DC]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ruta(a)} alt={`Render: ${a.nombre}`} className="h-auto w-full" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            {modeloStl && (
              <div className="mt-4">
                <Estudio3D titulo={s.titulo} subtitulo="Modelo rediseñado" urlStl={ruta(modeloStl)} descargas={[{ etiqueta: "Descargar STL", href: `${ruta(modeloStl)}?descargar=1`, nota: "Modelo rediseñado" }]} />
              </div>
            )}
            {modelos.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 p-0">
                {modelos.map((a) => (
                  <li key={a.id} className="list-none text-[14px]">
                    <a href={`${ruta(a)}?descargar=1`} className="font-semibold text-[#B34D07] underline"><TS>{a.nombre}</TS></a> <span className="text-[#6B6A63]">· {mb(a.tamano)}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.verificacion.length > 0 && (
              <div className="mt-4">
                <h3 className="m-0 text-[15px] font-bold text-[#1B1B18]"><TS>Medidas verificadas</TS></h3>
                <table className="mt-2 w-full text-[13.5px]">
                  <thead><tr className="text-left text-[#6B6A63]"><th className="py-1"><TS>Medida</TS></th><th><TS>Esperada</TS></th><th><TS>Medida real</TS></th><th><TS>Tolerancia</TS></th><th></th></tr></thead>
                  <tbody>
                    {s.verificacion.map((v, i) => (
                      <tr key={i} className="border-t border-[#EEEAE2]"><td className="py-1"><TS>{v.medida}</TS></td><td><TS>{v.esperado_mm}</TS> <TS>mm</TS></td><td><TS>{v.medido_mm}</TS> <TS>mm</TS></td><td>±<TS>{v.tolerancia_mm}</TS> <TS>mm</TS></td><td className={v.ok ? "text-[#0F7A4A]" : "text-[#9B1C1C]"}><TS>{v.ok ? "✓" : "Fuera"}</TS></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {aprobada && (
          <section className="mt-6 rounded-[14px] border border-[#CDEBD9] bg-[#F3FBF6] p-5">
            <h2 className="m-0 text-[18px] font-bold text-[#0F7A4A]"><TS>{s.estado === "terminada" ? "Volver a fabricar" : "Aprobada: cotiza la fabricación"}</TS></h2>
            <div className="mt-3">
              <CotizarEscanear id={s.id} locale={locale} modelo={ultimoModelo ? { id: ultimoModelo.id, nombre: ultimoModelo.nombre } : null} pieza={s.titulo} material={s.material_deseado || s.material_original} salida={SALIDA[s.salida] || s.salida} folio={s.folio_texto} />
            </div>
          </section>
        )}

        {/* Comentarios y aprobación */}
        {!cerrada && (
          <section className="mt-6 rounded-[14px] border border-[#E7E4DC] bg-white p-5">
            <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>{s.estado === "render_listo" ? "¿Apruebas el render?" : "Comentarios"}</TS></h2>
            {s.comentarios.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2 p-0">
                {s.comentarios.map((c, i) => (
                  <li key={i} className={`list-none rounded-[10px] px-3 py-2 text-[14px] ${c.de === "equipo" ? "bg-[#EEF1F6]" : "bg-[#FAF8F4]"}`}>
                    <b><TS>{c.de === "equipo" ? "HETNA" : "Tú"}</TS></b>
                    <TS>{c.accion === "aprobar" ? " · aprobó" : c.accion === "ajuste" ? " · pidió ajuste" : ""}</TS> <span className="text-[12px] text-[#6B6A63]">{fechaSegura(FECHA, c.creado)}</span>
                    <p className="m-0 mt-1 whitespace-pre-line"><TS>{c.texto}</TS></p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <AprobarRender id={s.id} puedeAprobar={s.estado === "render_listo"} aviso={s.aviso} />
            </div>
          </section>
        )}

        {/* Lo que mandó el cliente */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
            <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Tu solicitud</TS></h2>
            <p className="m-0 mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-[#40403A]"><TS>{s.descripcion}</TS></p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
              <dt className="text-[#6B6A63]"><TS>Tipo</TS></dt><dd className="m-0"><TS>{USO[s.uso]}</TS></dd>
              <dt className="text-[#6B6A63]"><TS>Salida</TS></dt><dd className="m-0"><TS>{SALIDA[s.salida]}</TS></dd>
              {s.material_original && <><dt className="text-[#6B6A63]"><TS>Material original</TS></dt><dd className="m-0"><TS>{s.material_original}</TS></dd></>}
              {s.material_deseado && <><dt className="text-[#6B6A63]"><TS>Material deseado</TS></dt><dd className="m-0"><TS>{s.material_deseado}</TS></dd></>}
              {s.zona && <><dt className="text-[#6B6A63]"><TS>Zona</TS></dt><dd className="m-0"><TS>{s.zona}</TS></dd></>}
            </dl>
            <h3 className="m-0 mt-3 text-[14px] font-bold"><TS>Medidas a mano</TS></h3>
            <ul className="m-0 mt-1 p-0 text-[14px]">{s.medidas.map((m, i) => <li key={i} className="list-none"><TS>{m.nombre}</TS>: <b><TS>{m.mm}</TS> <TS>mm</TS></b></li>)}</ul>
          </div>
          <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
            <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Escaneo y fotos</TS></h2>
            {propios.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 p-0">
                {propios.map((a) => (
                  <li key={a.id} className="list-none text-[14px]">
                    <span className="mr-1 rounded bg-[#F3F3F1] px-1.5 py-0.5 text-[11px] font-bold uppercase text-[#6B6A63]"><TS>{a.tipo}</TS></span>
                    <a href={`${ruta(a)}?descargar=1`} className="font-semibold text-[#1B1B18] underline"><TS>{a.nombre}</TS></a> <span className="text-[#6B6A63]">· {mb(a.tamano)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-2 text-[14px] text-[#9B1C1C]"><TS>Todavía no hay archivos. Sube el escaneo y fotos de la pieza para empezar.</TS></p>
            )}
            {!cerrada && !aprobada && <div className="mt-4"><SubirArchivosEscanear id={s.id} /></div>}
          </div>
        </section>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
