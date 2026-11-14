"use client"

// Después de mandar una solicitud sin cuenta (packages/api/src/lib/afiliacion.ts):
// su número de afiliado al instante, el botón para activar la cuenta en un paso
// y los incentivos (cupón de bienvenida y, si tiene taller, la prueba gratis).
import type { AfiliacionNueva } from "@/lib/cotizar/solicitud-taller"

export function TarjetaAfiliacion({ afiliacion }: { afiliacion: AfiliacionNueva }) {
  return (
    <div className="mx-auto mt-5 max-w-md rounded-2xl border-2 border-[#C2560A] bg-[#FDEEE1] p-5 text-left">
      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9A4A06]">Tu número de afiliado HETNA</p>
      <p className="mt-1 text-3xl font-extrabold tracking-wide text-[#142033]">{afiliacion.numero}</p>
      {afiliacion.activar ? (
        <>
          <p className="mt-2 text-sm text-[#40403A]">
            Tu cuenta ya está lista. Sólo elige tu contraseña y verás tus solicitudes, propuestas y pedidos en un solo lugar.
          </p>
          <a
            href={afiliacion.activar}
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110"
          >
            Activar mi cuenta (30 segundos)
          </a>
        </>
      ) : (
        <p className="mt-2 text-sm text-[#40403A]">
          Ya tienes cuenta con este correo: inicia sesión y verás esta solicitud en «Mis solicitudes».
        </p>
      )}
      <ul className="mt-3 space-y-1 text-[13px] text-[#40403A]">
        <li>🎁 $100 de descuento en tu primera compra de $800 o más con el cupón <b>BIENVENIDA</b>.</li>
        <li>
          🛠️ ¿Tienes taller?{" "}
          <a href="/mx/talleres/unete" className="font-semibold text-[#C2560A] underline">
            Regístralo gratis y prueba 14 días el Cotizador CNC
          </a>
          .
        </li>
      </ul>
      <p className="mt-3 text-[11.5px] text-[#6B675C]">También te mandamos esto por correo.</p>
    </div>
  )
}
