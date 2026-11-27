// Bandeja de mensajes del cliente: todas sus conversaciones con talleres.

import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import Link from "next/link"
import { redirect } from "next/navigation"

import { misConversaciones, sesionChat } from "@/lib/chat/consultas"

export const dynamic = "force-dynamic"
const metadataEs = { title: "Mis mensajes", robots: { index: false } }

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const s = await sesionChat()
  if (!s) redirect(`/${locale}/user`)
  const lista = await misConversaciones(s.clienteId)

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white"><TS>Mis mensajes</TS></h1>
      {lista.length === 0 ? (
        <p className="mt-6 text-gray-600 dark:text-gray-300">
          <TS>Aún no has escrito a ningún taller. Entra a un producto o a un taller y toca “Preguntar al taller”.</TS>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-[#142033]">
          {lista.map((c) => (
            <li key={c.id}>
              <Link href={`/${locale}/mensajes/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-[#1E3250]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 dark:text-white"><TS>{c.tallerNombre}</TS></p>
                  {c.productoTitulo && <p className="truncate text-xs text-gray-500"><TS>{c.productoTitulo}</TS></p>}
                  <p className="truncate text-sm text-gray-600 dark:text-gray-300"><TS>{c.ultimo}</TS></p>
                </div>
                {c.sinLeer > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#C2560A] px-2 text-xs font-bold text-white"><TS>{c.sinLeer}</TS></span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
