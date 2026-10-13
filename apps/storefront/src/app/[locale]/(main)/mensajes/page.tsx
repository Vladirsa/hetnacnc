// Bandeja de mensajes del cliente: todas sus conversaciones con talleres.

import Link from "next/link"
import { redirect } from "next/navigation"

import { misConversaciones, sesionChat } from "@/lib/chat/consultas"

export const dynamic = "force-dynamic"
export const metadata = { title: "Mis mensajes | HETNA CNC", robots: { index: false } }

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const s = await sesionChat()
  if (!s) redirect(`/${locale}/user`)
  const lista = await misConversaciones(s.clienteId)

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis mensajes</h1>
      {lista.length === 0 ? (
        <p className="mt-6 text-gray-600 dark:text-gray-300">
          Aún no has escrito a ningún taller. Entra a un producto o a un taller y toca “Preguntar al taller”.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-[#142033]">
          {lista.map((c) => (
            <li key={c.id}>
              <Link href={`/${locale}/mensajes/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-[#1E3250]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 dark:text-white">{c.tallerNombre}</p>
                  {c.productoTitulo && <p className="truncate text-xs text-gray-500">{c.productoTitulo}</p>}
                  <p className="truncate text-sm text-gray-600 dark:text-gray-300">{c.ultimo}</p>
                </div>
                {c.sinLeer > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#C2560A] px-2 text-xs font-bold text-white">{c.sinLeer}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
