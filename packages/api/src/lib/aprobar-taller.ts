// Aprobar un taller (lib/alta-taller.ts). Lo usan el botón del correo al
// administrador (hooks/alta-taller/aprobar) y el alta automática al confirmar
// el correo (hooks/alta-taller/confirmar).
//
// Lo extra de HETNA al aprobar (correo de bienvenida y anuncio en redes) se
// manda UNA vez por taller: la marca metadata.bienvenida_hetna_en se toma de
// forma atómica antes de mandarlo. Así, aprobar desde el panel (Tiendas >
// Confirmar, que corre approveSellerWorkflow de Mercur sin pasar por aquí)
// también lo manda, por el suscriptor de "seller.approved"
// (subscribers/taller-aprobado-bienvenida.ts), sin repetirlo en los otros dos
// caminos: aquí la marca se toma ANTES de aprobar, y el suscriptor la ve tomada.
// Si el correo falla después de tomar la marca, no se reintenta (se registra).
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

export const MARCA_BIENVENIDA = "bienvenida_hetna_en"

/** Toma la marca de bienvenida (true = este proceso la manda). Atómico: de dos
 *  procesos al mismo tiempo, sólo uno la toma. */
export async function reclamarBienvenida(knex: any, sellerId: string): Promise<boolean> {
  const r = await knex.raw(
    `update seller set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb where id = ? and (metadata->>'${MARCA_BIENVENIDA}') is null`,
    [JSON.stringify({ [MARCA_BIENVENIDA]: new Date().toISOString() }), sellerId]
  )
  return (r?.rowCount ?? 0) > 0
}

async function soltarBienvenida(knex: any, sellerId: string) {
  await knex.raw(`update seller set metadata = metadata - '${MARCA_BIENVENIDA}' where id = ?`, [sellerId])
}

export async function aprobarTaller(scope: Scope, t: TallerAlta & { photo?: string | null }, opc: { automatica?: boolean } = {}) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  // La marca antes de aprobar: el suscriptor de seller.approved ya no la manda
  const mia = await reclamarBienvenida(knex, t.id)
  try {
    await (flujos as any).approveSellerWorkflow(scope).run({ input: { seller_id: t.id } })
  } catch (e) {
    // Sólo se suelta si la tomó esta llamada (un doble clic no suelta la del primero)
    if (mia) await soltarBienvenida(knex, t.id).catch(() => undefined)
    throw e
  }
  scope.resolve("logger").info(`[alta-taller] aprobado ${t.name} (${t.email})`)
  if (mia) await extrasAprobacion(scope, t, opc)
}

/** Correo de bienvenida y anuncio en redes del taller recién aprobado. Llamar
 *  sólo con la marca de bienvenida tomada (reclamarBienvenida). */
export async function extrasAprobacion(scope: Scope, t: TallerAlta & { photo?: string | null }, opc: { automatica?: boolean } = {}) {
  await avisarAprobado(t, scope).catch((e: Error) =>
    scope.resolve("logger").error(`[alta-taller] no se mandó la bienvenida a ${t.email} (no se reintenta): ${e.message}`)
  )
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
