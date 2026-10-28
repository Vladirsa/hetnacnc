import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import { ESTADOS_MX } from "@/lib/foro/tipos"
import { trabajosAbiertos } from "@/lib/trabajos/datos"
import { SERVICIOS_SOLICITUD } from "@/lib/trabajos/servicios"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Trabajos de fabricación CNC abiertos en México",
  description:
    "Clientes de todo México buscan taller para corte láser, router, plasma, maquinado e impresión 3D. Revisa los trabajos abiertos y manda tu propuesta, o publica el tuyo gratis.",
}

// El tablero de la licitación. Lo leen dos personas distintas, y por eso
// tiene dos salidas desde arriba: el cliente que quiere ver si esto funciona
// (y publica lo suyo) y el taller que busca trabajo (y entra a cotizar).
//
// Los filtros son un <form method="get"> normal: funcionan sin JavaScript y
// cada combinación es una URL que se puede compartir.
export default async function TrabajosPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string; estado?: string }>
}) {
  const sp = await searchParams
  const servicio = SERVICIOS_SOLICITUD.includes(sp.servicio || "") ? sp.servicio : undefined
  const estado = ESTADOS_MX.includes(sp.estado || "") ? sp.estado : undefined
  const { trabajos, total } = await trabajosAbiertos({ servicio, estado_mx: estado, limit: 48 })
  const filtrado = Boolean(servicio || estado)

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 lg:px-8">
      <header className="mb-6 overflow-hidden rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Licitación HETNA</p>
        <h1 className="mt-1 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
          Trabajos de fabricación esperando taller
        </h1>
        <p className="mt-2 max-w-2xl text-white/75">
          Clientes de todo México publican lo que necesitan fabricar y los talleres de la red mandan su precio y
          tiempo de entrega. El cliente compara, elige y paga protegido dentro de HETNA.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink
            href="/cotizar"
            className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110"
          >
            Publicar mi trabajo gratis
          </LocalizedClientLink>
          {/* El panel del taller no vive bajo /mx: va sin LocalizedClientLink. */}
          <a
            href="/seller/solicitudes"
            className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10"
          >
            Soy taller: quiero cotizar
          </a>
        </div>
      </header>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-[#142033]">
          Servicio
          <select name="servicio" defaultValue={servicio || ""} className="h-10 rounded-lg border border-[#D9D5C9] bg-white px-3 font-normal">
            <option value="">Todos</option>
            {SERVICIOS_SOLICITUD.filter((s) => s !== "Otro").map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-[#142033]">
          Estado
          <select name="estado" defaultValue={estado || ""} className="h-10 rounded-lg border border-[#D9D5C9] bg-white px-3 font-normal">
            <option value="">Todo México</option>
            {ESTADOS_MX.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg bg-[#142033] px-5 font-semibold text-white">
          Filtrar
        </button>
        {filtrado && (
          <LocalizedClientLink href="/trabajos" className="h-10 content-center text-sm font-semibold text-[#C2560A]">
            Quitar filtros
          </LocalizedClientLink>
        )}
        <span className="ml-auto self-center text-sm text-[#6B675C]">
          {total === 1 ? "1 trabajo abierto" : `${total} trabajos abiertos`}
        </span>
      </form>

      {trabajos.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trabajos.map((t) => (
            <TarjetaTrabajo key={t.folio} trabajo={t} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-8 text-center">
          <p className="font-bold text-[#142033]">
            {filtrado ? "No hay trabajos abiertos con ese filtro." : "Ahora mismo no hay trabajos abiertos."}
          </p>
          <p className="mt-1 text-sm text-[#6B675C]">
            ¿Necesitas fabricar algo? Publícalo y los talleres te mandan propuestas en días.
          </p>
          <LocalizedClientLink
            href="/cotizar"
            className="mt-4 inline-block rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110"
          >
            Publicar mi trabajo
          </LocalizedClientLink>
        </div>
      )}
    </main>
  )
}
