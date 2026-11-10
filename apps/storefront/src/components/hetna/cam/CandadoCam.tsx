"use client"

// Lo que ve quien quiere descargar un programa y su plan no alcanza: por qué,
// y el paso que sigue (entrar a su cuenta o ver los planes). También la línea
// de "te quedan N este mes".
import { useEffect, useState } from "react"

export type CupoVista = { incluido: boolean; limite: number | null; usadas: number; restantes: number | null }
export type EstadoCamVista = { plan: string; plan_nombre: string; basico: CupoVista; torno: CupoVista; grabado: boolean; multieje: boolean }
export type NegadoCam = { codigo: "sesion" | "plan" | "cupo" | "servicio"; mensaje: string; plan_necesario?: string; estado?: EstadoCamVista }

const PLANES = "/mx/servicios/cotizador-cnc#planes"

/** El cupo del plan de quien está viendo la herramienta. `version` cambia para volver a leerlo tras una descarga. */
export function useCupoCam(version = 0) {
  const [cupo, setCupo] = useState<{ sesion: boolean; estado: EstadoCamVista | null } | null>(null)
  useEffect(() => {
    let vivo = true
    fetch("/api/cam/cupo", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => vivo && setCupo(d))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [version])
  return cupo
}

export function textoCupo(sesion: boolean, c: CupoVista | undefined, plan: string | undefined, que: string): string {
  if (!c) return ""
  if (!sesion) return c.incluido ? `Calcular y simular es gratis. Para descargar entra a tu cuenta: tienes ${c.limite} programas gratis al mes.` : `Calcular y simular es gratis. ${que} se descarga con plan Taller o mayor.`
  if (!c.incluido) return `${que} se descarga con plan Taller o mayor. Tu plan es ${plan}.`
  if (c.restantes === null) return `Plan ${plan}: descargas sin límite.`
  return `Plan ${plan}: te quedan ${c.restantes} de ${c.limite} programas este mes.`
}

export function CandadoCam({ negado, oscuro = false, regreso }: { negado: NegadoCam; oscuro?: boolean; regreso: string }) {
  const caja = oscuro ? "border-[#6a3a14] bg-[#2a1a0c] text-[#F6C79B]" : "border-[#F2A65A] bg-[#FDEEE1] text-[#1B1B18]"
  const boton = "inline-flex items-center justify-center rounded-[8px] bg-[#C2560A] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#A84A08]"
  return (
    <div role="alert" className={`flex flex-col gap-2 rounded-[10px] border p-3 text-[13.5px] leading-snug ${caja}`}>
      <span>{negado.mensaje}</span>
      {negado.codigo === "sesion" && (
        <a href={`/mx/login?volver=${encodeURIComponent(regreso)}`} className={boton}>
          Entrar o crear mi cuenta
        </a>
      )}
      {(negado.codigo === "plan" || negado.codigo === "cupo") && (
        <a href={PLANES} className={boton}>
          Ver los planes
        </a>
      )}
    </div>
  )
}
