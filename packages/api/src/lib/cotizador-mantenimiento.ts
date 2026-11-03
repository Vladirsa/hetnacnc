// @ts-nocheck
// Cotizador 2.0 · Fase 4 — Avisos de mantenimiento de máquinas.
//
// Las tareas (mantenimiento_tareas) dicen cada cuántas horas de máquina y/o
// cada cuántos días toca. Las horas de cada máquina salen de v_horas_maquina
// (horas_base + horas capturadas en los costos reales de los pedidos).
// Todos los días se revisa y, si a un taller le toca algo, se le avisa con
// una alerta en la app y notificación al celular (sin correo: no es urgente
// y serían muchos). No se repite el aviso de la misma tarea antes de 3 días.
import { avisarTaller } from "./avisos-taller"
import { supa } from "./cotizador-suscripciones"

const DIA = 86_400_000

export type Vencida = { tarea: any; maquina: string; motivo: string }

export function revisarTarea(t, horas: number, hoy = new Date()): string | null {
  const desdeHoras = horas - Number(t.ultima_horas || 0)
  const desdeDias = Math.floor((hoy.getTime() - new Date(`${t.ultima_fecha}T12:00:00Z`).getTime()) / DIA)
  if (t.cada_horas && desdeHoras >= Number(t.cada_horas)) return `lleva ${Math.round(desdeHoras)} h (cada ${Number(t.cada_horas)} h)`
  if (t.cada_dias && desdeDias >= Number(t.cada_dias)) return `lleva ${desdeDias} días (cada ${t.cada_dias})`
  return null
}

export async function avisosMantenimiento(logger?: any) {
  const tareas = await supa<any[]>(`/rest/v1/mantenimiento_tareas?activa=eq.true&select=*&limit=5000`).catch(() => [])
  if (!tareas.length) return 0
  const maquinaIds = [...new Set(tareas.map((t) => t.maquina_id))]
  const [horas, maquinas] = await Promise.all([
    supa<any[]>(`/rest/v1/v_horas_maquina?maquina_id=in.(${maquinaIds.join(",")})&select=maquina_id,horas`).catch(() => []),
    supa<any[]>(`/rest/v1/maquinaria?id=in.(${maquinaIds.join(",")})&select=id,nombre`).catch(() => []),
  ])
  const horasDe = new Map(horas.map((h) => [h.maquina_id, Number(h.horas) || 0]))
  const nombreDe = new Map(maquinas.map((m) => [m.id, m.nombre || "Máquina"]))
  const hace3 = Date.now() - 3 * DIA

  const porTaller = new Map<string, Vencida[]>()
  for (const t of tareas) {
    if (t.avisado_en && new Date(t.avisado_en).getTime() > hace3) continue
    const motivo = revisarTarea(t, horasDe.get(t.maquina_id) || 0)
    if (!motivo) continue
    porTaller.set(t.negocio_id, [...(porTaller.get(t.negocio_id) || []), { tarea: t, maquina: nombreDe.get(t.maquina_id) || "Máquina", motivo }])
  }

  let avisos = 0
  for (const [negocioId, lista] of porTaller) {
    const primeras = lista.slice(0, 3).map((v) => `${v.maquina}: ${v.tarea.nombre} (${v.motivo})`)
    await avisarTaller(
      {
        negocioId,
        tipo: "mantenimiento",
        titulo: `🔧 Toca mantenimiento: ${lista.length} tarea${lista.length > 1 ? "s" : ""}`,
        cuerpo: primeras.join(" · ") + (lista.length > 3 ? ` y ${lista.length - 3} más.` : "."),
        correo: false,
        liga: "https://hetnacnc.com/cotizador/",
      },
      logger
    )
    await supa(`/rest/v1/mantenimiento_tareas?id=in.(${lista.map((v) => v.tarea.id).join(",")})`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ avisado_en: new Date().toISOString() }),
    }).catch(() => {})
    avisos++
  }
  return avisos
}
