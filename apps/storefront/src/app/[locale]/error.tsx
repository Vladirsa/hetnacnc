"use client"

import { useEffect } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { EMPRESA, ligaWhatsApp } from "@/lib/hetna/empresa"

// Red de seguridad para cualquier página de la tienda.
//
// Sin este archivo, un error de dibujado en el carrito o en la pasarela sube
// hasta `global-error.tsx`, que reemplaza la página ENTERA por un "¡Algo salió
// mal!" pelón: sin encabezado, sin salida y sin decir qué pasó. En la pantalla
// donde alguien iba a pagar, eso es la venta perdida y además un reporte
// imposible de atender ("me salió un error").
//
// Esto acota el daño a la sección que falló, deja un camino de regreso y manda
// el error a la consola del servidor, donde `pm2 logs hetna-web` sí lo enseña.
export default function ErrorDeSeccion({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[storefront] error de dibujado:", error)
  }, [error])

  return (
    <main className="container flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-[520px] rounded-[14px] border border-[#E7E4DC] bg-white p-6 text-center">
        <h1 className="text-[22px] font-bold text-[#1B1B18]">
          Esta parte no se pudo cargar
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">
          Tu carrito y tu cuenta están bien. Fue esta pantalla, y ya quedamos
          enterados.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
          >
            Volver a intentar
          </button>
          <LocalizedClientLink
            href="/cart"
            className="rounded-[10px] border border-[#E7E4DC] px-6 py-3 text-[15px] font-semibold text-[#1B1B18] hover:border-[#C2560A]"
          >
            Ir a mi carrito
          </LocalizedClientLink>
        </div>

        <p className="mt-5 text-[13px] leading-relaxed text-[#6B6A63]">
          ¿Ibas a pagar y no te deja?{" "}
          <a
            href={ligaWhatsApp("Hola, me salió un error en la página al intentar comprar.")}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#B34D07] underline"
          >
            Escríbenos por WhatsApp
          </a>{" "}
          y lo cerramos contigo. {EMPRESA.horario}.
        </p>

        {/* El digest es el identificador que Next deja también en el log del
            servidor: con él se encuentra el error exacto de este visitante. */}
        {error.digest && (
          <p className="mt-3 text-[11px] text-[#A5A29A]">Referencia: {error.digest}</p>
        )}
      </div>
    </main>
  )
}
