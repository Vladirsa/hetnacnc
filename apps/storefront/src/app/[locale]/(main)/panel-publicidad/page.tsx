// El panel de publicidad ahora vive dentro del dashboard (menú lateral > Publicidad).
// Esta dirección antigua solo redirige para no romper marcadores.
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function PaginaPanelPublicidad() {
  redirect("/dashboard/publicidad")
}
