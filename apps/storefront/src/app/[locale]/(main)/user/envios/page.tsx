import type { Metadata } from "next"

import { EvidenciaEnvio } from "@/components/hetna/envios/EvidenciaEnvio"
import { UserNavigation } from "@/components/molecules/UserNavigation/UserNavigation"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { misEnvios } from "@/lib/envios/cotizar"

export const metadata: Metadata = {
  title: "Mis envíos | Envíos HETNA",
  robots: { index: false, follow: false },
}

const ESTADO: Record<string, [string, string]> = {
  pendiente_pago: ["Pendiente de pago", "bg-[#FFF3E0] text-[#9A4A06]"],
  pagado: ["Pagado · generando guía", "bg-[#E8F0FB] text-[#1D4F8C]"],
  guia_generada: ["Guía lista", "bg-[#E6F4EC] text-[#14683F]"],
  cancelado: ["Cancelado", "bg-[#F3F1EA] text-[#6B675C]"],
}

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function MisEnvios() {
  const r = await misEnvios()

  if (!r.ok && r.login) {
    return (
      <main className="container">
        <div className="mx-auto max-w-[460px] py-16 text-center">
          <h1 className="text-[24px] font-bold text-[#1B1B18]">Entra a tu cuenta</h1>
          <p className="mt-2 text-[15px] text-[#4A4943]">Tus envíos y su evidencia viven en tu cuenta.</p>
          <LocalizedClientLink href="/login" className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 font-semibold text-white">
            Iniciar sesión
          </LocalizedClientLink>
        </div>
      </main>
    )
  }
  const envios = r.ok ? r.envios : []

  return (
    <main className="container pb-16">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
      <UserNavigation />
      <div className="min-w-0 md:col-span-3">
      <div className="flex flex-wrap gap-1.5 text-[13px] text-[#6B6A63]">
        <LocalizedClientLink href="/user" className="hover:text-[#B34D07]">
          Mi cuenta
        </LocalizedClientLink>
        <span>/</span>
        <span className="font-medium text-[#1B1B18]">Mis envíos</span>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#1B1B18] lg:text-[32px]">Mis envíos</h1>
          <p className="mt-1 max-w-[720px] text-[15px] text-[#4A4943]">
            Antes de entregar cada paquete, pega la guía y sube aquí las 4 fotos: alto, largo y ancho con cinta métrica y el paquete en la
            báscula, con la guía visible. Si la paquetería reporta sobrepeso o hay un daño, es tu prueba.
          </p>
        </div>
        <LocalizedClientLink href="/servicios/envios-hetna#cotizar-envio" className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110">
          Cotizar otro envío
        </LocalizedClientLink>
      </div>

      {!r.ok && <p className="mt-6 rounded-xl bg-[#FDECEA] p-4 text-[#B3261E]">No pudimos cargar tus envíos. Intenta de nuevo en un momento.</p>}

      {r.ok && r.sobrepesos.length > 0 && (
        <section className="mt-6 flex flex-col gap-3">
          <h2 className="m-0 text-lg font-extrabold text-[#142033]">Cobros por sobrepeso</h2>
          {r.sobrepesos.map((s) => (
            <div
              key={s.folio}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
                s.pago_url ? "border-[#F2C98F] bg-[#FFF8EE]" : "border-[#E7E4DC] bg-white"
              }`}
            >
              <div className="text-sm text-[#40403A]">
                <strong className="block text-[15px] text-[#142033]">
                  {s.folio} · {s.referencia}
                </strong>
                {s.kg_cotizado != null && s.kg_reportado != null && (
                  <span>
                    Cotizado {s.kg_cotizado} kg · la paquetería reportó {s.kg_reportado} kg ·{" "}
                  </span>
                )}
                <strong>{pesos(s.monto)} MXN</strong> · {s.estado_nombre}
              </div>
              {s.pago_url && (
                <a href={s.pago_url} className="rounded-xl bg-[#C2560A] px-5 py-2.5 font-semibold text-white hover:brightness-110">
                  Pagar sobrepeso
                </a>
              )}
            </div>
          ))}
          <p className="m-0 text-xs text-[#6B675C]">
            Mientras haya un sobrepeso por pagar no se pueden solicitar envíos nuevos. ¿Crees que es injusto y tienes tus fotos? Escríbenos con el folio y
            lo disputamos con la paquetería.
          </p>
        </section>
      )}
      {r.ok && envios.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-[#D9D4C8] bg-white p-8 text-center text-[#6B675C]">
          Aún no tienes envíos.{" "}
          <LocalizedClientLink href="/servicios/envios-hetna#cotizar-envio" className="font-semibold text-[#C2560A] underline">
            Cotiza el primero
          </LocalizedClientLink>
          .
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {envios.map((e) => {
          const [estado, color] = ESTADO[e.estado] || [e.estado, "bg-[#F3F1EA] text-[#6B675C]"]
          return (
            <section key={e.folio} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-lg font-extrabold text-[#142033]">
                    {e.folio} <span className="text-sm font-normal text-[#6B675C]">· {e.tarifa?.paqueteria} {e.tarifa?.servicio}</span>
                  </p>
                  <p className="m-0 text-sm text-[#40403A]">
                    {e.origen?.municipio || e.origen?.cp} → {e.destino?.municipio || e.destino?.cp} · {e.paquete?.largo}×{e.paquete?.ancho}×
                    {e.paquete?.alto} cm · {e.paquete?.peso} kg cotizados
                  </p>
                  <p className="m-0 text-sm text-[#6B675C]">
                    {pesos(e.precio)} MXN
                    {e.proteccion_valor ? ` · protegido por ${pesos(e.proteccion_valor)}` : ""}
                    {e.contenido_estado === "usado" ? " · usado" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}>{estado}</span>
                  {e.pago_url && (
                    <a href={e.pago_url} className="text-sm font-semibold text-[#C2560A] underline">
                      Pagar ahora
                    </a>
                  )}
                  {e.guia?.url && (
                    <a href={e.guia.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#C2560A] underline">
                      Descargar guía {e.guia.numero || ""}
                    </a>
                  )}
                </div>
              </div>
              {e.estado !== "cancelado" && e.estado !== "pendiente_pago" && (
                <div className="mt-4 border-t border-[#F0EDE6] pt-4">
                  <EvidenciaEnvio folio={e.folio} inicial={e.evidencia} />
                </div>
              )}
            </section>
          )
        })}
      </div>
      </div>
      </div>
    </main>
  )
}
