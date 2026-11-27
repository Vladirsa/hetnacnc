// Una conversación vista por el cliente.

import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import ChatVentana from "@/components/hetna/chat/ChatVentana"
import { conversacionDelCliente, mensajesDe, sesionChat } from "@/lib/chat/consultas"
import { db } from "@/lib/foro/db"

export const dynamic = "force-dynamic"
const metadataEs = { title: "Conversación", robots: { index: false } }

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const s = await sesionChat()
  if (!s) redirect(`/${locale}/user`)
  const conv = await conversacionDelCliente(id, s.clienteId)
  if (!conv) notFound()
  const mensajes = await mensajesDe(conv.id)
  await db().query(`update chat.conversaciones set sin_leer_cliente = 0 where id = $1`, [conv.id]).catch(() => {})

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href={`/${locale}/mensajes`} className="text-sm text-[#C2560A]">
        <TS>← Mis mensajes</TS>
      </Link>
      <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
        <Link href={`/${locale}/talleres/${conv.tallerHandle}`}><TS>{conv.tallerNombre}</TS></Link>
      </h1>
      {conv.productoTitulo && <p className="mb-3 text-sm text-gray-500"><TS>Sobre:</TS> <TS>{conv.productoTitulo}</TS></p>}
      <ChatVentana yo="cliente" conversacionId={conv.id} inicial={mensajes} cerrada={conv.estado === "cerrada"} />
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
