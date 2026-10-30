"use server"

// El monedero de créditos del cliente.
//
// Los créditos son la moneda de las herramientas (hoy el escaneo 3D y el
// cotizador). No son pesos: un crédito no se puede retirar ni cambiar a
// efectivo, y por eso el saldo NUNCA se enseña como "MX$0.00" -- se enseña en
// créditos y en lo que alcanzan a pagar, que es lo que el taller quiere saber.
//
// Comprarlos es directo: el cliente elige un paquete y paga en ese momento con
// Mercado Pago o PayPal, sin pasar por el carrito. Al regresar del pago,
// /user/creditos/pago confirma con el backend, que pregunta al proveedor y
// acredita. Ver packages/api/src/lib/creditos-compra.ts.

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

const encabezados = async () => ({
  "Content-Type": "application/json",
  "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
  ...((await getAuthHeaders()) as Record<string, string>),
})

export type Movimiento = {
  id: string
  cantidad: number
  tipo: string
  descripcion: string | null
  creado: string
}

export type Saldo = {
  saldo: number
  // Cuenta de la casa (HETNA): créditos ilimitados, no se descuentan
  ilimitado: boolean
  creditos_por_escaneo: number
  movimientos: Movimiento[]
}

export type RespuestaSaldo =
  | { ok: true; datos: Saldo }
  | { ok: false; mensaje: string; noAutenticado?: boolean }

export async function obtenerSaldo(): Promise<RespuestaSaldo> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return { ok: false, mensaje: "Necesitas iniciar sesión.", noAutenticado: true }
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/creditos-3d/saldo`, {
      headers: await encabezados(),
      cache: "no-store",
    })

    if (res.status === 401) {
      return { ok: false, mensaje: "Tu sesión expiró.", noAutenticado: true }
    }
    if (!res.ok) {
      return { ok: false, mensaje: "No se pudo leer tu saldo." }
    }

    const cuerpo = (await res.json()) as Partial<Saldo>
    return {
      ok: true,
      datos: {
        saldo: cuerpo.saldo ?? 0,
        ilimitado: cuerpo.ilimitado === true,
        creditos_por_escaneo: cuerpo.creditos_por_escaneo || 5,
        movimientos: cuerpo.movimientos ?? [],
      },
    }
  } catch (e) {
    console.error("[creditos] no se pudo leer el saldo", e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor." }
  }
}

// Sólo el número de créditos, para el encabezado. null = sin sesión o sin
// respuesta: el encabezado no enseña nada en vez de un saldo equivocado.
export async function saldoBreve(): Promise<{ saldo: number; ilimitado: boolean } | null> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return null
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/creditos-3d/saldo?resumen=1`, {
      headers: await encabezados(),
      cache: "no-store",
    })
    if (!res.ok) return null
    const cuerpo = (await res.json()) as { saldo?: number; ilimitado?: boolean }
    return { saldo: typeof cuerpo.saldo === "number" ? cuerpo.saldo : 0, ilimitado: cuerpo.ilimitado === true }
  } catch {
    return null
  }
}

export type Proveedor = "mercadopago" | "paypal"

export type Paquete = {
  handle: string
  titulo: string
  descripcion: string | null
  creditos: number
  precio: number
  moneda: string
}

export type CatalogoCreditos = { paquetes: Paquete[]; proveedores: Proveedor[] }

// Los paquetes a la venta y con qué se pueden pagar
export async function listarPaquetes(): Promise<CatalogoCreditos> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/creditos-3d/paquetes`, {
      headers: await encabezados(),
      cache: "no-store",
    })
    if (!res.ok) return { paquetes: [], proveedores: [] }
    const cuerpo = (await res.json()) as Partial<CatalogoCreditos>
    return {
      paquetes: (cuerpo.paquetes ?? []).filter((p) => p.creditos > 0 && p.precio > 0).sort((a, b) => a.creditos - b.creditos),
      proveedores: cuerpo.proveedores ?? [],
    }
  } catch (e) {
    console.error("[creditos] no se pudieron leer los paquetes", e)
    return { paquetes: [], proveedores: [] }
  }
}

export type RespuestaCompra = { ok: true; url: string } | { ok: false; mensaje: string; noAutenticado?: boolean }

// Crea la compra y devuelve la liga de pago de Mercado Pago o PayPal
export async function iniciarCompraCreditos(handle: string, proveedor: Proveedor, pais: string): Promise<RespuestaCompra> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/creditos-3d/comprar`, {
      method: "POST",
      headers: await encabezados(),
      body: JSON.stringify({ handle, proveedor, pais }),
      cache: "no-store",
    })
    if (res.status === 401) return { ok: false, mensaje: "Tu sesión expiró. Vuelve a entrar.", noAutenticado: true }
    const cuerpo = (await res.json().catch(() => ({}))) as { url?: string; message?: string }
    if (!res.ok || !cuerpo.url) return { ok: false, mensaje: cuerpo.message || "No se pudo preparar el pago." }
    return { ok: true, url: cuerpo.url }
  } catch (e) {
    console.error("[creditos] no se pudo iniciar la compra", e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor." }
  }
}

export type RespuestaConfirmacion =
  | { ok: true; estado: "pendiente" | "pagado" | "vencido"; creditos: number; titulo: string | null }
  | { ok: false; mensaje: string; noAutenticado?: boolean }

// Al regresar del pago: el backend pregunta al proveedor y acredita si se pagó
export async function confirmarCompraCreditos(compra: string): Promise<RespuestaConfirmacion> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/creditos-3d/confirmar`, {
      method: "POST",
      headers: await encabezados(),
      body: JSON.stringify({ compra }),
      cache: "no-store",
    })
    if (res.status === 401) return { ok: false, mensaje: "Tu sesión expiró. Vuelve a entrar.", noAutenticado: true }
    const cuerpo = (await res.json().catch(() => ({}))) as {
      estado?: "pendiente" | "pagado" | "vencido"
      creditos?: number
      titulo?: string | null
      message?: string
    }
    if (!res.ok || !cuerpo.estado) return { ok: false, mensaje: cuerpo.message || "No pudimos confirmar el pago." }
    return { ok: true, estado: cuerpo.estado, creditos: cuerpo.creditos ?? 0, titulo: cuerpo.titulo ?? null }
  } catch (e) {
    console.error("[creditos] no se pudo confirmar la compra", e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor." }
  }
}
