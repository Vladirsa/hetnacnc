import type { Metadata } from "next"

// Aquí regresa el taller después de autorizar (o cancelar) la conexión de su
// cuenta de Mercado Pago con el Cotizador. Ver /api/cotizador-mp/callback.
export const metadata: Metadata = {
  title: "Mercado Pago conectado | Cotizador HETNA",
  robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ resultado?: string }> }

export default async function MercadoPagoConectadoPage({ searchParams }: Props) {
  const { resultado } = await searchParams
  const ok = resultado === "ok"
  const cancelado = resultado === "cancelado"
  return (
    <main className="container py-10">
      <section className="mx-auto max-w-xl rounded-[18px] border border-[#E7E4DC] bg-white p-6 text-center">
        <p className="m-0 text-[44px] leading-none" aria-hidden="true">
          {ok ? "✅" : cancelado ? "↩️" : "⚠️"}
        </p>
        <h1 className="m-0 mt-3 text-[22px] font-bold text-[#142033]">
          {ok ? "Tu Mercado Pago quedó conectado" : cancelado ? "No se conectó la cuenta" : "No pudimos conectar tu cuenta"}
        </h1>
        <p className="m-0 mt-2 text-[15px] leading-relaxed text-[#40403A]">
          {ok
            ? "Desde ahora, cuando tus clientes paguen el anticipo desde la liga de la cotización, el dinero entra directo a tu cuenta de Mercado Pago. La comisión de HETNA se descuenta sola según tu plan."
            : cancelado
              ? "Cancelaste la autorización en Mercado Pago. Puedes volver a intentarlo desde Configuración en el Cotizador."
              : "La liga venció o Mercado Pago no respondió. Vuelve a intentarlo desde Configuración en el Cotizador; si sigue fallando, escríbenos."}
        </p>
        <p className="m-0 mt-5 text-[14px] text-[#7A776E]">Ya puedes cerrar esta pestaña y regresar a la app.</p>
      </section>
    </main>
  )
}
