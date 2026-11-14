import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { FormActivar } from "@/components/hetna/cuenta/FormActivar"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { datosActivacion, retrieveCustomer } from "@/lib/data/customer"

// «Activar mi cuenta» (packages/api/src/lib/afiliacion.ts): llega desde el correo
// o la pantalla de «Recibimos tu solicitud». El correo ya viene puesto; la
// persona sólo elige su contraseña.
export const metadata: Metadata = {
  title: "Activar mi cuenta",
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ t?: string }> }

export default async function ActivarPage({ searchParams }: Props) {
  const { t = "" } = await searchParams
  if (await retrieveCustomer()) redirect("/user")
  const datos = await datosActivacion(t)

  return (
    <main className="mx-auto w-full max-w-[520px] px-4 py-10">
      {!datos ? (
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-6 text-center">
          <h1 className="text-2xl font-extrabold text-[#142033]">Esta liga ya no es válida</h1>
          <p className="mt-2 text-[#40403A]">Puede que ya hayas activado tu cuenta o que la liga haya vencido.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <LocalizedClientLink href="/login" className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white">
              Iniciar sesión
            </LocalizedClientLink>
            <LocalizedClientLink href="/register" className="rounded-xl border border-[#E7E4DC] px-5 py-3 font-semibold text-[#142033]">
              Crear cuenta
            </LocalizedClientLink>
          </div>
        </div>
      ) : datos.cuenta_existe ? (
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9A4A06]">Afiliado {datos.numero}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#142033]">Ya tienes cuenta</h1>
          <p className="mt-2 text-[#40403A]">
            {datos.email} ya está registrado. Inicia sesión para ver tus solicitudes y pedidos.
          </p>
          <LocalizedClientLink href="/login" className="mt-5 inline-flex rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white">
            Iniciar sesión
          </LocalizedClientLink>
        </div>
      ) : (
        <FormActivar t={t} datos={datos} />
      )}
    </main>
  )
}
