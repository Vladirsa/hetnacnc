import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { FormPerfil } from "@/components/hetna/foro/FormPerfil"
import { FormRed } from "@/components/hetna/foro/RedCliente"
import { ForoCerrado, Migas } from "@/components/hetna/foro/Piezas"
import { VincularTaller } from "@/components/hetna/foro/VincularTaller"
import { buscarMiTaller } from "@/lib/foro/acciones"
import { secciones, sesionForo } from "@/lib/foro/consultas"
import { urlPerfil } from "@/lib/foro/tipos"

export const metadata: Metadata = {
  title: "Mi perfil del Foro CNC México",
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function ForoMiPerfil({ searchParams }: Props) {
  const q = await searchParams
  const [secs, sesion] = await Promise.all([secciones(), sesionForo()])
  if (!secs) return <ForoCerrado />
  const sig = Array.isArray(q.siguiente) ? q.siguiente[0] : q.siguiente
  // solo direcciones dentro del foro
  const siguiente = sig && /^\/foro-cnc(\/|\?|#|$)/.test(sig) && !sig.includes("//") ? sig : undefined
  const p = sesion?.perfil
  // Sólo se pregunta por el taller si ya tiene perfil y no está ligado.
  const encontrado = p && !p.taller ? await buscarMiTaller() : null

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="max-w-[860px] mx-auto px-4 py-6 lg:py-8 flex flex-col gap-5">
        <Migas items={[{ nombre: "Foro CNC", href: "/foro-cnc" }, { nombre: p ? "Editar perfil" : "Crear perfil" }]} />
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-[28px] font-bold m-0 text-[#1B1B18]">{p ? "Tu perfil" : "Crea tu perfil del foro"}</h1>
            <p className="m-0 mt-1.5 text-[14.5px] text-[#6B6A63] max-w-[620px]">
              Tu perfil es tu tarjeta de presentación en la comunidad: los clientes ven quién eres, qué máquinas tienes y tus trabajos.
            </p>
          </div>
          {p && (
            <LocalizedClientLink href={urlPerfil(p.usuario)} className="text-[14px] font-semibold text-[#B34D07] hover:underline">
              Ver mi perfil público
            </LocalizedClientLink>
          )}
        </div>
        {!sesion ? (
          <div className="bg-white border border-[#E7E4DC] rounded-[16px] p-6 flex flex-col gap-3">
            <p className="m-0 text-[15px] text-[#44433D]">Primero entra con tu cuenta de HETNA CNC (es gratis y es la misma de la tienda).</p>
            <div className="flex gap-2">
              <LocalizedClientLink href="/login" className="border border-[#E0DCD2] font-semibold px-4 py-2.5 rounded-[10px] text-[14px] hover:border-[#C2560A]">
                Entrar
              </LocalizedClientLink>
              <LocalizedClientLink href="/register" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">
                Crear cuenta gratis
              </LocalizedClientLink>
            </div>
          </div>
        ) : (
          <>
          {p && (
            <VincularTaller
              ligado={p.taller}
              encontrado={encontrado ? { handle: encontrado.handle, nombre: encontrado.nombre, verificado: encontrado.verificado } : null}
            />
          )}
          <div className="bg-white border border-[#E7E4DC] rounded-[16px] p-5 sm:p-7">
            <FormPerfil
              nuevo={!p}
              siguiente={siguiente}
              inicial={{
                usuario: p?.usuario || "",
                nombre: p?.nombre || sesion.nombre,
                tipo: p?.tipo || "aficionado",
                bio: p?.bio || "",
                ciudad: p?.ciudad || "",
                estadoMx: p?.estadoMx || "",
                redes: p?.redes || {},
                maquinas: p?.maquinas || [],
                software: p?.software || [],
                foto: p?.foto || null,
              }}
            />
          </div>
          {p && (
            <div id="curriculum" className="bg-white border border-[#E7E4DC] rounded-[16px] p-5 sm:p-7 scroll-mt-4">
              <FormRed inicial={{ aptitudes: p.aptitudes, trayectoria: p.trayectoria, abierto: p.abierto }} />
            </div>
          )}
          </>
        )}
      </div>
    </main>
  )
}
