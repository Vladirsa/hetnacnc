// Conversación vista por el TALLER con su enlace privado (no necesita cuenta).
// El enlace se lo manda n8n por WhatsApp/correo cuando un cliente le escribe.

import { notFound } from "next/navigation"

import ChatVentana from "@/components/hetna/chat/ChatVentana"
import { conversacionDelTaller, mensajesDe } from "@/lib/chat/consultas"
import { db } from "@/lib/foro/db"

export const dynamic = "force-dynamic"
export const metadata = { title: "Mensaje de un cliente | HETNA CNC", robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const conv = await conversacionDelTaller(token)
  if (!conv) notFound()
  const mensajes = await mensajesDe(conv.id)
  await db().query(`update chat.conversaciones set sin_leer_taller = 0 where id = $1`, [conv.id]).catch(() => {})

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <p className="text-sm text-gray-500">{conv.tallerNombre}</p>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cliente: {conv.clienteNombre}</h1>
      {conv.productoTitulo && <p className="mb-3 text-sm text-gray-500">Sobre: {conv.productoTitulo}</p>}
      <ChatVentana yo="taller" token={token} inicial={mensajes} cerrada={conv.estado === "cerrada"} />
      <p className="mt-3 text-xs text-gray-500">Este enlace es privado de tu taller. No lo compartas.</p>
    </main>
  )
}
