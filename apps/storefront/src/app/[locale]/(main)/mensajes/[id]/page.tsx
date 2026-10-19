// Una conversación vista por el cliente.

import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import ChatVentana from "@/components/hetna/chat/ChatVentana"
import { conversacionDelCliente, mensajesDe, sesionChat } from "@/lib/chat/consultas"
import { db } from "@/lib/foro/db"

export const dynamic = "force-dynamic"
export const metadata = { title: "Conversación | HETNA CNC", robots: { index: false } }

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
        ← Mis mensajes
      </Link>
      <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
        <Link href={`/${locale}/talleres/${conv.tallerHandle}`}>{conv.tallerNombre}</Link>
      </h1>
      {conv.productoTitulo && <p className="mb-3 text-sm text-gray-500">Sobre: {conv.productoTitulo}</p>}
      <ChatVentana yo="cliente" conversacionId={conv.id} inicial={mensajes} cerrada={conv.estado === "cerrada"} />
    </main>
  )
}
