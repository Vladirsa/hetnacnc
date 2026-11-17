// Aprobar un taller (lib/alta-taller.ts). Lo usan el botón del correo al
// administrador (hooks/alta-taller/aprobar) y el alta automática al confirmar
// el correo (hooks/alta-taller/confirmar).
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as flujos from "@mercurjs/core/workflows"

import { avisarAprobado, type TallerAlta } from "./alta-taller"
import { STORE_URL } from "./licitacion"
import { publicacionAutomatica } from "./social-hub"

/** Alta automática (17 nov 2026, para que haya más productos): el taller queda
 *  aprobado al confirmar su correo y HETNA recibe un aviso para revisarlo o
 *  suspenderlo. ALTA_AUTOMATICA=false regresa a la aprobación manual. */
export const altaAutomatica = () => process.env.ALTA_AUTOMATICA !== "false"

type Scope = { resolve: (k: string) => any }

export async function aprobarTaller(scope: Scope, t: TallerAlta & { photo?: string | null }, opc: { automatica?: boolean } = {}) {
  await (flujos as any).approveSellerWorkflow(scope).run({ input: { seller_id: t.id } })
  scope.resolve("logger").info(`[alta-taller] aprobado ${t.name} (${t.email})`)
  await avisarAprobado(t)
  // Fase 5A: anuncio del taller nuevo en redes, un día después para que
  // alcance a llenar su perfil. Las cuentas de prueba no se anuncian.
  if (!(t.metadata as any)?.prueba && t.handle) {
    await publicacionAutomatica(
      scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
      {
        origen: "taller",
        origen_id: t.id,
        titulo: t.name || "Taller nuevo",
        lugar: [(t.metadata as any)?.perfil?.ciudad, (t.metadata as any)?.perfil?.estado].filter(Boolean).join(", "),
        url: `${STORE_URL}/mx/talleres/${t.handle}`,
        medios: t.photo ? [{ url: t.photo, tipo: "imagen" }] : [],
        programada_para: new Date(Date.now() + 24 * 3_600_000),
      },
      scope.resolve("logger"),
      // Alta automática: el anuncio queda en borrador hasta que HETNA lo revise
      { revision: !!opc.automatica }
    )
  }
}
