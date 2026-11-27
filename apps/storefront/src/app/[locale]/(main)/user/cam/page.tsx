import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listMyCamJobs } from "@/lib/data/cam"

const metadataEs: Metadata = {
  title: "Mis trabajos CAM",
  description: "Estado y archivos de tus servicios del Laboratorio CAM.",
  robots: { index: false, follow: false },
}

const ESTADO: Record<string, string> = {
  received: "Recibido",
  in_cart: "En carrito",
  paid: "Pagado · en cola",
  in_review: "En revisión",
  delivered: "Entregado",
  cancelled: "Cancelado",
}

const SERVICIO: Record<string, string> = {
  cam_3: "Programa CAM 3 ejes",
  cam_4: "Programa CAM 4 ejes",
  cam_5: "Programa CAM 5 ejes",
  post: "Posprocesador personalizado",
}

export default async function MisTrabajosCam() {
  const { jobs, sesion } = await listMyCamJobs()

  if (!sesion) {
    return (
      <main className="container">
        <div className="mx-auto max-w-[460px] py-16 text-center">
          <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>Entra a tu cuenta</TS></h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">
            <TS>Tus trabajos CAM y sus archivos se guardan en tu cuenta.</TS>
          </p>
          <LocalizedClientLink
            href="/login"
            className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
          >
            <TS>Iniciar sesión</TS>
          </LocalizedClientLink>
        </div>
      </main>
    )
  }

  return (
    <main className="container">
      <div className="mx-auto max-w-[820px] py-10">
        <h1 className="text-[26px] font-bold text-[#1B1B18]"><TS>Mis trabajos CAM</TS></h1>
        <p className="mt-2 text-[15px] text-[#4A4943]">
          <TS>Los servicios que pediste en el Laboratorio CAM y los archivos que te entregamos.</TS>
        </p>

        {!jobs.length ? (
          <div className="mt-8 rounded-[14px] border border-[#E7E4DC] bg-white p-6">
            <p className="text-[15px] text-[#4A4943]"><TS>Todavía no tienes trabajos pagados.</TS></p>
            <LocalizedClientLink
              href="/cam/lab"
              className="mt-4 inline-block rounded-[10px] bg-[#C2560A] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#A84A08]"
            >
              <TS>Abrir el laboratorio</TS>
            </LocalizedClientLink>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-4">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[16px] font-bold text-[#1B1B18] break-all"><TS>{job.model_name}</TS></span>
                  <span className="rounded-full bg-[#F7F5EF] px-3 py-1 text-[13px] text-[#1B1B18]">
                    {ESTADO[job.status] ?? job.status}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[#6B6A63]">
                  {SERVICIO[job.service] ?? job.service}
                  <TS>{job.tier ? ` · ${job.tier}` : ""}</TS>
                  <TS>{job.review_requested ? " · con revisión" : ""}</TS> ·<TS>{" "}</TS>
                  {new Date(job.created_at).toLocaleDateString("es-MX")}
                </p>
                {job.deliverables?.length ? (
                  <ul className="mt-3 flex flex-col gap-1">
                    {job.deliverables.map((d) => (
                      <li key={d.id}>
                        <a href={d.url} className="text-[14px] font-semibold text-[#B34D07] underline" download>
                          <TS>Descargar</TS> <TS>{d.name}</TS>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
