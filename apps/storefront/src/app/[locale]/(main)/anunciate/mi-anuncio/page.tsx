// /mx/anunciate/mi-anuncio?pedido=<id>&t=<llave> — panel del anunciante.
// Sin cuenta ni contraseña: la llave (token) se le da al comprar y le llega por
// correo. Muestra el estado del anuncio, sus vistas, clics y cuándo termina.
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { estadoParaAnunciante } from "@/lib/publicidad/pedidos"
import { miles, pesos } from "@/lib/publicidad/precios"
import { ESPACIOS, esEspacio, nombreCorto } from "@/lib/publicidad/tipos"

export const metadata: Metadata = {
  title: { absolute: "Mi anuncio | HETNA CNC" },
  robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" }).format(new Date(iso)) : "—"

export default async function MiAnuncio({ searchParams }: Props) {
  const q = await searchParams
  const pedido = typeof q.pedido === "string" ? q.pedido : ""
  const t = typeof q.t === "string" ? q.t : ""
  const e = await estadoParaAnunciante(pedido, t).catch(() => null)

  if (!e)
    return (
      <main className="w-full bg-[#FAF9F6]">
        <div className="max-w-[640px] mx-auto px-4 py-16 flex flex-col gap-3 text-center items-center">
          <h1 className="m-0 font-display text-[28px] font-bold text-[#1B1B18]">No encontramos tu anuncio</h1>
          <p className="m-0 text-[15px] text-[#44433D]">
            Abre la liga completa que te llegó por correo al pagar. Si no la encuentras, escríbenos desde Contacto con el correo que usaste.
          </p>
          <LocalizedClientLink href="/contacto" className="mt-2 bg-[#C2560A] text-white font-semibold px-6 py-3 rounded-[10px]">
            Ir a Contacto
          </LocalizedClientLink>
        </div>
      </main>
    )

  const espacio = esEspacio(e.espacio) ? nombreCorto(ESPACIOS[e.espacio].nombre) : e.espacio
  const vistas = e.pieza?.vistas ?? 0
  const clics = e.pieza?.clics ?? 0
  const ctr = vistas >= 50 ? `${Math.round((clics / vistas) * 1000) / 10}%` : "—"
  const porVistas = e.modalidad === "vistas" && e.vistas_compradas
  const avance = porVistas ? Math.min(100, Math.round((vistas / (e.vistas_compradas as number)) * 100)) : null

  const estado =
    e.estado === "pendiente"
      ? { t: "Esperando tu pago", d: "Si pagaste en OXXO o por transferencia, se confirma cuando Mercado Pago nos avise.", c: "bg-[#FFF6E8] text-[#7A4B0B]" }
      : e.estado === "rechazado"
        ? { t: "Pago rechazado", d: "No se te cobró nada. Puedes intentar de nuevo.", c: "bg-[#FDECEC] text-[#8A1F1F]" }
        : e.estado === "vencido"
          ? { t: "Terminó", d: porVistas ? "Ya se cumplieron tus vistas." : "Ya pasó el periodo que contrataste.", c: "bg-[#EEF0F2] text-[#3A414B]" }
          : e.pieza?.activo
            ? { t: "Activo", d: "Tu anuncio ya se está mostrando.", c: "bg-[#E8F5EC] text-[#17603A]" }
            : { t: "En revisión", d: "Pagaste: estamos revisando tu anuncio. Normalmente lo activamos en menos de 24 horas.", c: "bg-[#EAF1FB] text-[#1F4E8C]" }

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="max-w-[760px] mx-auto px-4 py-10 flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B34D07]">Mi anuncio en HETNA</p>
          <h1 className="m-0 font-display text-[28px] font-bold text-[#1B1B18]">{e.anunciante}</h1>
          <p className="m-0 text-[14.5px] text-[#44433D]">
            {espacio} · {porVistas ? `${miles(e.vistas_compradas as number)} vistas` : `${e.dias} días`} · {pesos(e.monto)}
          </p>
        </header>

        <section className={`rounded-[14px] px-5 py-4 ${estado.c}`} aria-live="polite">
          <p className="m-0 text-[17px] font-bold">{estado.t}</p>
          <p className="m-0 mt-0.5 text-[14px]">{estado.d}</p>
        </section>

        <section className="grid grid-cols-3 gap-3" aria-label="Resultados">
          {[
            ["Vistas", miles(vistas)],
            ["Clics", miles(clics)],
            ["% de clics", ctr],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <p className="m-0 text-[12.5px] text-[#6B6A63]">{k}</p>
              <p className="m-0 mt-1 text-[26px] font-bold tabular-nums text-[#1B1B18]">{v}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[14px] border border-[#E7E4DC] bg-white p-5 flex flex-col gap-2">
          {porVistas ? (
            <>
              <p className="m-0 text-[14.5px] text-[#1B1B18]">
                <b>{miles(vistas)}</b> de {miles(e.vistas_compradas as number)} vistas ({avance}%)
              </p>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#F0EDE6]" role="progressbar" aria-valuenow={avance ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-[#C2560A]" style={{ width: `${avance}%` }} />
              </div>
              <p className="m-0 text-[13px] text-[#6B6A63]">Tu anuncio sale hasta cumplir todas tus vistas, tarde lo que tarde.</p>
            </>
          ) : (
            <p className="m-0 text-[14.5px] text-[#1B1B18]">
              {e.estado === "pagado" ? (
                <>
                  Se muestra hasta el <b>{fecha(e.pieza?.hasta || e.vence)}</b>.
                </>
              ) : e.estado === "vencido" ? (
                <>Terminó el {fecha(e.vence)}.</>
              ) : (
                <>Empieza a contar cuando se active.</>
              )}
            </p>
          )}
          <p className="m-0 text-[13px] text-[#6B6A63]">
            Al hacer clic, tu anuncio lleva a: <span className="break-all font-mono text-[12.5px]">{e.enlace}</span>
          </p>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <LocalizedClientLink
            href={`/anunciate?espacio=${e.espacio}#comprar`}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] bg-[#C2560A] px-6 font-bold text-white hover:bg-[#A84A08]"
          >
            {e.estado === "vencido" ? "Volver a anunciarme" : "Renovar o contratar otro"}
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/contacto"
            className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] border border-[#1B1B18] px-6 font-semibold text-[#1B1B18]"
          >
            Cambiar mi imagen o mi enlace
          </LocalizedClientLink>
        </div>
        <p className="m-0 text-[12.5px] text-[#6B6A63]">Esta liga es personal: quien la tenga ve los resultados de tu anuncio. No la compartas.</p>
      </div>
    </main>
  )
}
