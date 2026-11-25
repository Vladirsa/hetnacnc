// Catálogo de la Biblioteca de planos para el backend: lo lee el script que
// crea un producto por plano en la tienda (packages/api/src/scripts/
// crear-productos-planos.ts) y, después, el panel de ofertas de los talleres.
// Lleva el precio recomendado por HETNA de cada acabado (kit cortado), el peso
// y las medidas del paquete, con los ajustes de precio del dueño.
import { medidasDe } from "@/lib/planos/medidas"
import { buscarPlano, todosLosPlanos } from "@/lib/planos/fuente"
import type { Plano } from "@/lib/planos/modelos"
import { ACABADOS_PLANO, cotizarPlano } from "@/lib/planos/precio"
import { listaCorte } from "@/lib/planos/calculo"
import type { ConfigPrecios } from "@/lib/cotizador/estimador"

export const dynamic = "force-dynamic"

async function configPrecios(): Promise<ConfigPrecios | null> {
  try {
    const r = await fetch(`${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/hetna-precios`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "" },
      cache: "no-store",
    })
    return r.ok ? ((await r.json()).cfg as ConfigPrecios) || null : null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const cfg = await configPrecios()
  // ?solo=a,b: sólo esos planos, pedidos uno por uno sin caché (al aprobar uno nuevo)
  const solo = (new URL(req.url).searchParams.get("solo") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20)
  const lista: Plano[] = solo.length ? ((await Promise.all(solo.map((s) => buscarPlano(s)))).filter(Boolean) as Plano[]) : await todosLosPlanos()
  const planos = lista.map((pl) => {
    const m = medidasDe(pl.piezas, pl.ruedas)
    const base = cotizarPlano(pl, cfg, "lijado")
    const filas = listaCorte(pl).filas
    // paquete: la pieza más larga × la más ancha × el grueso de todo apilado
    const largo = Math.max(...filas.map((f) => f.largo))
    const ancho = Math.max(...filas.map((f) => f.ancho))
    const grueso = filas.reduce((s, f) => s + f.grosor * f.cantidad, 0)
    return {
      slug: pl.slug,
      nombre: pl.nombre,
      categoria: pl.categoria,
      resumen: pl.resumen,
      descripcion: pl.descripcion,
      nivel: pl.nivel,
      horas: pl.horas,
      herrajes: pl.herrajes,
      medidas_mm: m,
      paquete_cm: { largo: Math.ceil(largo / 10) + 4, ancho: Math.ceil(ancho / 10) + 4, alto: Math.ceil(grueso / 10) + 4 },
      peso_kg: base.pesoKg,
      piezas: base.piezas,
      hojas: base.hojas,
      dias_fabricacion: base.diasFabricacion,
      precios: Object.fromEntries(ACABADOS_PLANO.map((a) => [a.clave, a.clave === "lijado" ? base.precio : cotizarPlano(pl, cfg, a.clave).precio])),
      imagenes: [1, 2, 3, 4].map((n) => `/mx/planos/${pl.slug}/redes/${n}`),
    }
  })
  return Response.json({ planos }, { headers: { "Cache-Control": "no-store" } })
}
