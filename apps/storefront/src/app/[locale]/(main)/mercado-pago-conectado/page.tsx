import type { Metadata } from "next"

// Aquí regresa el taller después de:
//   · conectar (o cancelar) su Mercado Pago  -> /api/cotizador-mp/callback
//   · vincular su PayPal (cuenta=paypal)     -> /api/cotizador-paypal/callback
//   · pagar la comisión HETNA del mes (resultado=comision)
export const metadata: Metadata = {
  title: "Cuenta de cobro | Cotizador HETNA",
  robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ resultado?: string; cuenta?: string }> }

export default async function CuentaConectadaPage({ searchParams }: Props) {
  const { resultado, cuenta } = await searchParams
  const servicio = cuenta === "paypal" ? "PayPal" : "Mercado Pago"
  const ok = resultado === "ok"
  const comision = resultado === "comision"
  const cancelado = resultado === "cancelado"

  const [icono, titulo, texto] = comision
    ? ["✅", "¡Gracias! Pagaste la comisión del mes", "Ya quedó registrada. En Configuración del Cotizador verás tus comisiones en cero."]
    : ok
      ? [
          "✅",
          `Tu ${servicio} quedó vinculado`,
          cuenta === "paypal"
            ? "Desde ahora tus clientes pueden pagar el anticipo con PayPal desde la liga de la cotización. El dinero te llega completo a tu PayPal y la comisión de HETNA se cobra una vez al mes, según tu plan."
            : "Desde ahora, cuando tus clientes paguen el anticipo desde la liga de la cotización, el dinero entra directo a tu cuenta de Mercado Pago. La comisión de HETNA se descuenta sola según tu plan.",
        ]
      : cancelado
        ? ["↩️", "No se completó", "Cancelaste el proceso. Puedes volver a intentarlo desde Configuración en el Cotizador."]
        : [
            "⚠️",
            "Algo no salió bien",
            "La liga venció o el servicio no respondió. Vuelve a intentarlo desde Configuración en el Cotizador; si sigue fallando, escríbenos.",
          ]

  return (
    <main className="container py-10">
      <section className="mx-auto max-w-xl rounded-[18px] border border-[#E7E4DC] bg-white p-6 text-center">
        <p className="m-0 text-[44px] leading-none" aria-hidden="true">
          {icono}
        </p>
        <h1 className="m-0 mt-3 text-[22px] font-bold text-[#142033]">{titulo}</h1>
        <p className="m-0 mt-2 text-[15px] leading-relaxed text-[#40403A]">{texto}</p>
        <p className="m-0 mt-5 text-[14px] text-[#7A776E]">Ya puedes cerrar esta pestaña y regresar a la app.</p>
      </section>
    </main>
  )
}
