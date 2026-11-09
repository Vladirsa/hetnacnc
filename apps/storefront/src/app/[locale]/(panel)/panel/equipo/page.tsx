// HETNA Panel → Equipo (sólo dueño): quién entra y qué ve.
import { Tarjeta, Titulo } from "@/components/hetna/panel/ui"
import { Equipo } from "@/components/hetna/panel/Equipo"
import { ROLES, rolDe } from "@/lib/panel/roles"
import { adminFetch, exigirPagina } from "@/lib/panel/sesion"

type U = { id: string; email: string; first_name?: string; last_name?: string; metadata?: Record<string, unknown>; created_at: string }

export default async function PanelEquipo({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const yo = await exigirPagina(locale, "equipo")
  let usuarios: U[] = [], error = ""
  try { usuarios = (await adminFetch<{ users: U[] }>("/admin/users?limit=50&order=created_at")).users || [] } catch (e) { error = (e as Error).message }
  const lista = usuarios.map((u, i) => ({ id: u.id, email: u.email, nombre: [u.first_name, u.last_name].filter(Boolean).join(" "), rol: rolDe(u.metadata, i === 0), esYo: u.id === yo.id }))
  return (
    <div className="grid gap-4">
      <Tarjeta>
        <Titulo>Roles del panel</Titulo>
        <ul className="grid gap-1 text-[12.5px] text-[#40403A]">
          {Object.entries(ROLES).filter(([k]) => k !== "sin_acceso").map(([k, r]) => <li key={k}><b>{r.nombre}:</b> {r.que}</li>)}
        </ul>
      </Tarjeta>
      <Equipo usuarios={lista} error={error} />
    </div>
  )
}
