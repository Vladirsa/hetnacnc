"use client"

import { convertToLocale } from "@/lib/helpers/money"

// "Te faltan $180 para que SASA te mande gratis."
//
// Es el único momento en que el cliente ya tiene la cartera en la mano, así que
// es donde más pesa decirle lo que le falta. Si ya lo alcanzó, también se dice:
// un premio que no se anuncia no se siente.
//
// Sobre con qué se mide: el umbral del taller es un precio de $0 en su opción de
// envío con regla `item_total >= X`, y Medusa evalúa esa regla contra el
// CARRITO COMPLETO, no contra lo que el cliente lleva de ese taller. Por eso el
// avance que entra aquí es el del carrito y el texto dice "de tu carrito": si
// midiéramos sólo lo de ese taller, la barra pediría más de lo que el backend
// va a pedir, y el cliente pagaría envío creyendo que le faltaba.
export const BarraEnvioGratis = ({
  nombre,
  umbral,
  avance,
  precioEnvio,
  currency_code,
}: {
  nombre: string
  umbral: number
  avance: number
  precioEnvio?: number | null
  currency_code: string
}) => {
  if (!(umbral > 0)) return null

  const falta = Math.max(0, umbral - avance)
  const logrado = falta <= 0
  const porcentaje = Math.max(0, Math.min(100, (avance / umbral) * 100))

  const dinero = (amount: number) => convertToLocale({ amount, currency_code })
  const ahorro = typeof precioEnvio === "number" && precioEnvio > 0 ? precioEnvio : null

  return (
    <div
      className={`rounded-b-[12px] border border-t-0 px-3 py-2.5 sm:px-4 ${
        logrado
          ? "border-[#A8D3AC] bg-[#EDF7EE]"
          : "border-[#F0D08A] bg-[#FFF7E8]"
      }`}
      data-testid="barra-envio-gratis"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-[1px] text-[14px] leading-none">
          {logrado ? "✅" : "🚚"}
        </span>
        <p
          className={`text-[13px] leading-snug ${
            logrado ? "text-[#1F5B29]" : "text-[#7A4A09]"
          }`}
        >
          {logrado ? (
            <>
              <span className="font-bold">¡Listo!</span> {nombre} te manda{" "}
              <span className="font-bold">gratis</span> este pedido
              {ahorro !== null && (
                <> — te ahorras {dinero(ahorro)} de envío</>
              )}
              .
            </>
          ) : (
            <>
              Te faltan <span className="font-bold">{dinero(falta)}</span> de tu
              carrito para que <span className="font-semibold">{nombre}</span> te
              mande <span className="font-bold">gratis</span>
              {ahorro !== null && <> y te ahorres {dinero(ahorro)} de envío</>}.
            </>
          )}
        </p>
      </div>

      {/* La barra va después del texto a propósito: el dato es la frase, la
          barra nomás lo dibuja. Y sin el texto, una barra sola no dice nada. */}
      <div
        className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-white/80"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={umbral}
        aria-valuenow={Math.min(avance, umbral)}
        aria-label={
          logrado
            ? `Ya tienes envío gratis de ${nombre}`
            : `Te faltan ${dinero(falta)} para el envío gratis de ${nombre}`
        }
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            logrado ? "bg-[#2E7D34]" : "bg-[#B34D07]"
          }`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {!logrado && (
        <p className="mt-1.5 text-[11px] text-[#8A6A33]">
          {nombre} manda gratis a partir de {dinero(umbral)} en tu carrito.
        </p>
      )}
    </div>
  )
}
