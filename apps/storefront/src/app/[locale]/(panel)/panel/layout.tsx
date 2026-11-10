// HETNA Panel: app instalable para el dueño y su equipo. Móvil primero.
// Cada página revisa el rol; aquí va el marco: cabecera, navegación inferior
// con las páginas que el rol puede ver, y el manifiesto para instalarla.
import type { Metadata, Viewport } from "next"
import { redirect } from "next/navigation"

import { PAGINAS, puede } from "@/lib/panel/roles"
import { usuarioPanel } from "@/lib/panel/sesion"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "HETNA Panel",
  manifest: "/panel-manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "HETNA Panel", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/panel-192.png" },
}
export const viewport: Viewport = { themeColor: "#142033", width: "device-width", initialScale: 1, maximumScale: 1 }

export default async function PanelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const u = await usuarioPanel()
  // La página de entrar no lleva marco (y es la única sin sesión)
  if (!u) {
    return <div className="min-h-screen bg-[#142033] text-white">{children}</div>
  }
  if (u.rol === "sin_acceso") {
    return (
      <div className="min-h-screen bg-[#142033] p-6 text-white">
        <h1 className="text-xl font-bold">HETNA Panel</h1>
        <p className="mt-3 text-sm text-white/80">Tu cuenta ({u.email}) todavía no tiene acceso al panel. Pide al dueño que te asigne un rol en Equipo.</p>
        {u.diagnostico && <p className="mt-2 text-xs text-white/50">{u.diagnostico}</p>}
        <p className="mt-2 text-xs text-white/40">Versión del panel: 3</p>
        <form action="/api/app/panel/salir" method="post" className="mt-6"><button className="rounded-lg bg-white/10 px-4 py-2 text-sm">Salir</button></form>
      </div>
    )
  }
  const visibles = PAGINAS.filter((p) => puede(u.rol, p.clave))
  return (
    <div className="min-h-screen bg-[#F3F1EA] pb-20 text-[#142033]">
      <header className="sticky top-0 z-20 bg-[#142033] px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] text-white">
        <div className="mx-auto flex max-w-[860px] items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#C2560A] text-sm font-black">H</span>
            <div>
              <p className="text-[15px] font-extrabold leading-none">HETNA Panel</p>
              <p className="text-[11px] text-white/70">{u.nombre} · {u.rol === "dueno" ? "Dueño" : u.rol}</p>
            </div>
          </div>
          <form action="/api/app/panel/salir" method="post"><button className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold">Salir</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E7E4DC] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-[860px] justify-around">
          {visibles.map((p) => (
            <a key={p.clave} href={`/${locale}${p.ruta}`} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-[#40403A] hover:text-[#C2560A]">
              <span className="text-lg leading-none">{p.icono}</span>{p.nombre}
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
