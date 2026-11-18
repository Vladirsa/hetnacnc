import { redirect } from "next/navigation"

import { checkRegion } from "@/lib/helpers/check-region"

// Panel del taller (/mx/panel-taller): ocupa toda la pantalla, como una
// aplicación, sin el encabezado ni el pie del sitio. Trae su propia barra
// lateral (en celular se repliega arriba).
export default async function TallerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!(await checkRegion(locale))) return redirect("/")
  return (
    <div className="min-h-[100dvh] bg-[#F6F4EF]">
      <main id="contenido">{children}</main>
    </div>
  )
}
