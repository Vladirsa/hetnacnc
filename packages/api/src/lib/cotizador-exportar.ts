// Exportar todos los datos de un taller de la app del Cotizador (portabilidad:
// lo promete el aviso de privacidad; Fase 1.3 de docs/analisis-sap-fase0.md).
//
// El administrador del taller lo pide desde la app con su sesión de Supabase y
// recibe un ZIP con un CSV (abre en Excel) y un JSON por tabla, más LEEME.txt.
// Nunca se exportan llaves, tokens ni contraseñas (Facturapi, Mercado Pago,
// PayPal, WooCommerce): esas tablas están fuera a propósito.
//
// El esquema completo de varias tablas no está en el repositorio de la app, así
// que cada tabla se intenta por negocio_id; las que cuelgan de otra (partidas de
// una cotización, avances de un pedido) se leen por los ids de su tabla padre.
// Lo que no se pueda leer queda anotado en LEEME.txt, nunca se calla.
import { strToU8, zipSync } from "fflate"

import { ErrorSuscripcion, supaBase } from "./cotizador-suscripciones"
import { supa } from "./cotizador-crm"

const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""

/** Tablas del taller que se exportan (por negocio_id). */
export const TABLAS_NEGOCIO = [
  "negocios",
  "configuracion_empresa",
  "empresa_config",
  "usuarios_negocio",
  "permisos_rol",
  "clientes",
  "etiquetas_cliente",
  "contactos_cliente",
  "categorias_producto",
  "productos",
  "cotizaciones",
  "cotizacion_pagos",
  "pedidos",
  "pedido_costos",
  "gastos",
  "inventario_bodega",
  "movimientos_inventario",
  "proveedores",
  "ordenes_compra",
  "orden_compra_recepciones",
  "maquinaria",
  "mano_obra",
  "mantenimiento_tareas",
  "mantenimiento_registros",
  "paros_maquina",
  "revisiones_calidad",
  "sim_servicios",
  "sim_tipos_trabajo",
  "sim_tarifas",
  "sim_rangos",
  "sim_acabados",
  "sim_extras",
  "sim2_velocidades",
  "sim2_acabados",
  "sim2_recetas",
  "sim2_historial",
  "cfdi_emitidos",
  "facturas",
  "citas",
  "agenda_eventos",
  "posventa_casos",
  "plantillas_wa",
  "campanas_marketing",
  "cupones",
  "catalogos_personalizados",
  "pdfs_catalogo",
  "negocios_pagina",
  "solicitudes_en_linea",
  "pedidos_publicos",
  "alertas",
] as const

/** Tablas hijas sin negocio_id: se leen por los ids de su tabla padre. */
export const TABLAS_HIJAS: { tabla: string; columna: string; padre: string }[] = [
  { tabla: "cotizacion_items", columna: "cotizacion_id", padre: "cotizaciones" },
  { tabla: "pedido_avances", columna: "pedido_id", padre: "pedidos" },
  { tabla: "pedido_fotos", columna: "pedido_id", padre: "pedidos" },
  { tabla: "preguntas_pedido", columna: "pedido_id", padre: "pedidos" },
  { tabla: "cliente_etiquetas", columna: "cliente_id", padre: "clientes" },
  { tabla: "orden_compra_items", columna: "orden_id", padre: "ordenes_compra" },
]

/** Nunca salen (llaves y secretos). */
export const TABLAS_EXCLUIDAS = ["negocios_facturapi", "negocios_mp", "negocios_paypal", "woocommerce_auth_tokens", "config_whatsapp"]
/** Columnas que no salen aunque estén en una tabla exportada. */
export const COLUMNAS_SECRETAS = /token|secret|password|contrasena|api_key|llave|refresh|access_key|csd/i

/** CSV para Excel: separador coma, todo entre comillas, BOM UTF-8 para acentos. */
export function aCsv(filas: Record<string, unknown>[]): string {
  if (!filas.length) return "﻿"
  const cols = [...new Set(filas.flatMap((f) => Object.keys(f)))]
  const celda = (v: unknown) => {
    const t = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)
    return `"${t.replace(/"/g, '""')}"`
  }
  return "﻿" + [cols.map(celda).join(","), ...filas.map((f) => cols.map((c) => celda(f[c])).join(","))].join("\r\n")
}

export function sinSecretos(filas: Record<string, unknown>[]) {
  return filas.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !COLUMNAS_SECRETAS.test(k))))
}

async function leerTodo(ruta: string): Promise<any[]> {
  const salida: any[] = []
  for (let desde = 0; desde < 200_000; desde += 1000) {
    const sep = ruta.includes("?") ? "&" : "?"
    const pagina = await supa<any[]>(`${ruta}${sep}limit=1000&offset=${desde}`)
    salida.push(...(pagina || []))
    if (!pagina || pagina.length < 1000) break
  }
  return salida
}

/** Taller (negocio) del usuario con sesión; sólo administradores exportan. */
export async function negocioDeAdmin(token: string | undefined) {
  if (!token) throw new ErrorSuscripcion("Inicia sesión en el Cotizador.", 401)
  const r = await fetch(`${supaBase()}/auth/v1/user`, { headers: { apikey: supaKey(), Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new ErrorSuscripcion("Tu sesión expiró. Vuelve a iniciar sesión.", 401)
  const user = (await r.json()) as { id: string }
  const fila = (await supa<any[]>(`/rest/v1/usuarios_negocio?user_id=eq.${user.id}&activo=eq.true&select=negocio_id,rol&limit=1`))[0]
  if (!fila) throw new ErrorSuscripcion("Tu cuenta no tiene taller.", 403)
  if (!["administrador", "super_admin"].includes(fila.rol)) throw new ErrorSuscripcion("Sólo el administrador del taller puede exportar los datos.", 403)
  const n = (await supa<any[]>(`/rest/v1/negocios?id=eq.${fila.negocio_id}&select=id,nombre&limit=1`))[0]
  if (!n) throw new ErrorSuscripcion("No encontramos tu taller.", 404)
  return n as { id: string; nombre: string }
}

export async function exportarTaller(negocioId: string, nombre: string) {
  if (!/^[0-9a-f-]{36}$/i.test(negocioId)) throw new ErrorSuscripcion("Taller inválido.", 400)
  const archivos: Record<string, Uint8Array> = {}
  const leidas: string[] = []
  const faltan: string[] = []
  const ids: Record<string, string[]> = {}

  for (const t of TABLAS_NEGOCIO) {
    const col = t === "negocios" ? "id" : "negocio_id"
    try {
      const filas = sinSecretos(await leerTodo(`/rest/v1/${t}?${col}=eq.${negocioId}&select=*`))
      ids[t] = filas.map((f) => String(f.id || "")).filter(Boolean)
      archivos[`csv/${t}.csv`] = strToU8(aCsv(filas))
      archivos[`json/${t}.json`] = strToU8(JSON.stringify(filas, null, 2))
      leidas.push(`${t}: ${filas.length}`)
    } catch {
      faltan.push(t)
    }
  }

  for (const h of TABLAS_HIJAS) {
    const padres = ids[h.padre] || []
    try {
      const filas: any[] = []
      for (let i = 0; i < padres.length; i += 100) {
        filas.push(...(await leerTodo(`/rest/v1/${h.tabla}?${h.columna}=in.(${padres.slice(i, i + 100).join(",")})&select=*`)))
      }
      const limpias = sinSecretos(filas)
      archivos[`csv/${h.tabla}.csv`] = strToU8(aCsv(limpias))
      archivos[`json/${h.tabla}.json`] = strToU8(JSON.stringify(limpias, null, 2))
      leidas.push(`${h.tabla}: ${limpias.length}`)
    } catch {
      faltan.push(h.tabla)
    }
  }

  const fecha = new Date().toISOString()
  archivos["LEEME.txt"] = strToU8(
    [
      `Datos de ${nombre} en HETNA Cotizador`,
      `Exportado: ${fecha}`,
      "",
      "Carpeta csv/: un archivo por tabla, se abre en Excel o Google Sheets.",
      "Carpeta json/: los mismos datos en JSON, para importarlos a otro sistema.",
      "",
      "Tablas y renglones:",
      ...leidas.map((x) => `  - ${x}`),
      ...(faltan.length ? ["", "No se pudieron leer (si las necesitas, escríbenos):", ...faltan.map((x) => `  - ${x}`)] : []),
      "",
      "Por seguridad NO se incluyen llaves ni contraseñas (Facturapi, Mercado Pago, PayPal, WooCommerce, WhatsApp).",
      "Las fotos y PDFs guardados se listan con su dirección en las tablas; descárgalos desde la app si los necesitas.",
    ].join("\r\n")
  )
  return { zip: zipSync(archivos, { level: 6 }), leidas, faltan, fecha }
}
