import type { Metadata } from "next"

import { FormFiscal } from "@/components/hetna/cuenta/Facturacion"
import { LoginForm } from "@/components/molecules/LoginForm/LoginForm"
import { ProfileDetails } from "@/components/molecules/ProfileDetails/ProfileDetails"
import { UserNavigation } from "@/components/molecules/UserNavigation/UserNavigation"
import { ProfilePassword } from "@/components/molecules/ProfileDetails/ProfilePassword"
import { leerFiscal } from "@/lib/cuenta/facturas"
import { retrieveCustomer } from "@/lib/data/customer"

export const metadata: Metadata = {
  title: "Datos y contraseña | HETNA CNC",
  robots: { index: false, follow: false },
}

export default async function DatosCuenta() {
  const user = await retrieveCustomer()

  if (!user) return <LoginForm />
  const fiscal = await leerFiscal()

  return (
    <main className="container pb-16" data-testid="profile-settings-page">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="flex min-w-0 flex-col gap-6 md:col-span-3" data-testid="profile-settings-container">
          <div>
            <h1 className="m-0 text-[26px] font-extrabold text-[#142033]">Datos y contraseña</h1>
            <p className="m-0 mt-1 text-[14.5px] text-[#6B6A63]">Tus datos de contacto, tu contraseña y los datos para que los talleres te facturen.</p>
          </div>
          <ProfileDetails user={user} />
          <ProfilePassword user={user} />
          <section id="fiscal" className="scroll-mt-28 rounded-[16px] border border-[#E7E4DC] bg-white p-5 sm:p-6">
            <h2 className="m-0 text-[19px] font-bold text-[#142033]">Datos fiscales</h2>
            <p className="m-0 mb-4 mt-1 text-[14px] text-[#6B6A63]">
              Guárdalos una vez y pide factura (CFDI) desde cada pedido. Cada taller emite la factura de lo que te vendió.
            </p>
            {fiscal ? (
              <FormFiscal inicial={fiscal.fiscal} regimenes={fiscal.regimenes} usos={fiscal.usos} />
            ) : (
              <p className="m-0 text-[14px] text-[#B3261E]">No pudimos cargar tus datos fiscales. Recarga la página.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
