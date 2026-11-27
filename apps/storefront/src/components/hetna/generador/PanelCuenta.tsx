"use client"

// Dentro de las herramientas de diseño: los créditos del cliente (cuántos
// tiene, cuánto cuesta bajar este diseño y comprar más sin salir) y "Mis
// diseños" (guardar el diseño en su cuenta y volver a abrirlo después).
import { T } from "@/components/hetna/i18n/Idioma"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { type Paquete, type Proveedor, iniciarCompraCreditos, listarPaquetes, saldoBreve } from "@/lib/creditos/acciones"
import { CREDITOS_BIENVENIDA, textoCreditos } from "@/lib/hetna/precios-diseno"
import { type DisenoGuardado, abrirMiDiseno, borrarMiDiseno, guardarMiDiseno, listarMisDisenos } from "@/lib/muebles/acciones"

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`

export function PanelCreditos({ costo, pagado, antesDePagar, recarga = 0 }: { costo: number; pagado: boolean; antesDePagar?: () => void; recarga?: number }) {
  const { locale } = useParams<{ locale: string }>()
  const [saldo, setSaldo] = useState<{ saldo: number; ilimitado: boolean } | null | undefined>(undefined)
  const [abierto, setAbierto] = useState(false)
  const [cat, setCat] = useState<{ paquetes: Paquete[]; proveedores: Proveedor[] } | null>(null)
  const [trabajando, setTrabajando] = useState("")
  const [aviso, setAviso] = useState("")
  const leer = useCallback(() => saldoBreve().then(setSaldo), [])
  useEffect(() => {
    leer()
  }, [leer, recarga])
  useEffect(() => {
    if (abierto && !cat) listarPaquetes().then(setCat)
  }, [abierto, cat])
  const comprar = async (p: Paquete, prov: Proveedor) => {
    setTrabajando(`${p.handle}:${prov}`)
    setAviso("")
    antesDePagar?.()
    const r = await iniciarCompraCreditos(p.handle, prov, locale)
    if (r.ok) {
      window.location.href = r.url
      return
    }
    setTrabajando("")
    setAviso(r.mensaje)
  }
  const sinSesion = saldo === null
  const alcanza = saldo ? saldo.ilimitado || saldo.saldo >= costo : false
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[#2A3546] bg-[#111821] p-2.5 text-[12.5px] text-[#C9D2E0]">
      <div className="flex items-center justify-between gap-2">
        <span>
          <T>Tus créditos:</T><T>{" "}</T>
          <b className="text-[15px] text-white"><T>{saldo === undefined ? "…" : sinSesion ? "—" : saldo.ilimitado ? "∞" : saldo.saldo}</T></b>
        </span>
        <span className="text-right">
          <T>Este diseño:</T> <b className="text-white"><T>{pagado ? "pagado" : textoCreditos(costo)}</T></b>
        </span>
      </div>
      {sinSesion ? (
        <span className="text-[12px] text-[#8A97AB]">
          <Link href={`/${locale}/login`} className="font-semibold text-[#FFB27A] underline">
            <T>Crea tu cuenta gratis</T>
          </Link><T>{" "}</T>
          <T>y recibe</T> {CREDITOS_BIENVENIDA} <T>créditos de regalo para bajar tus primeros diseños.</T>
        </span>
      ) : (
        <>
          {!pagado && saldo && !alcanza && <span className="text-[12px] text-[#F6D58E]"><T>Te faltan</T> {textoCreditos(costo - saldo.saldo)} <T>para bajar este diseño.</T></span>}
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setAbierto((x) => !x)} className="flex-1 rounded-[7px] bg-[#1C2431] px-2 py-1.5 font-semibold text-white hover:bg-[#243045]">
              <T>{abierto ? "Ocultar paquetes" : "Comprar créditos"}</T>
            </button>
            <Link href={`/${locale}/user/creditos`} className="rounded-[7px] bg-[#1C2431] px-2 py-1.5 font-semibold text-[#C9D2E0] hover:bg-[#243045]">
              <T>Movimientos</T>
            </Link>
          </div>
        </>
      )}
      {abierto && !sinSesion && (
        <div className="flex flex-col gap-1.5">
          {!cat ? (
            <span className="text-[#8A97AB]"><T>Cargando paquetes…</T></span>
          ) : !cat.paquetes.length || !cat.proveedores.length ? (
            <span className="text-[#8A97AB]"><T>Ahorita no hay paquetes a la venta. Escríbenos y te los cargamos.</T></span>
          ) : (
            cat.paquetes.map((p) => (
              <div key={p.handle} className="flex flex-wrap items-center gap-1.5 rounded-[8px] bg-[#0F151E] px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <b className="text-white">{p.creditos} <T>créditos</T></b> · {pesos(p.precio)} <span className="text-[11px] text-[#8A97AB]">(${(p.precio / p.creditos).toFixed(1)} c/u)</span>
                </span>
                {cat.proveedores.map((prov) => (
                  <button key={prov} type="button" disabled={!!trabajando} onClick={() => comprar(p, prov)} className="rounded-[6px] bg-[#C2560A] px-2 py-1 text-[11.5px] font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50">
                    <T>{trabajando === `${p.handle}:${prov}` ? "Abriendo…" : prov === "mercadopago" ? "Mercado Pago" : "PayPal"}</T>
                  </button>
                ))}
              </div>
            ))
          )}
          <span className="text-[11px] text-[#8A97AB]"><T>Tu diseño se queda guardado en este navegador mientras pagas. Los créditos no caducan.</T></span>
          {aviso && <span className="text-[#F6B8AE]">{aviso}</span>}
        </div>
      )}
    </div>
  )
}

export function MisDisenos({
  herramienta,
  tipos,
  actual,
  abrir,
}: {
  herramienta: "mueble" | "cocina" | "moldura"
  tipos?: ("mueble" | "cocina" | "moldura")[] // qué diseños se pueden abrir aquí
  actual: () => { nombre: string; resumen: string; datos: Record<string, unknown> }
  abrir: (datos: Record<string, unknown>, nombre: string) => void
}) {
  const { locale } = useParams<{ locale: string }>()
  const [lista, setLista] = useState<DisenoGuardado[] | null>(null)
  const [maximo, setMaximo] = useState(50)
  const [sesion, setSesion] = useState(true)
  const [idActual, setIdActual] = useState<string | null>(null)
  const [aviso, setAviso] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const cargar = useCallback(async () => {
    const r = await listarMisDisenos()
    if (!r.ok) {
      if (r.noAutenticado) setSesion(false)
      setLista([])
      return
    }
    setLista(tipos ? r.disenos.filter((d) => tipos.includes(d.herramienta)) : r.disenos)
    setMaximo(r.maximo)
  }, [tipos?.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    cargar()
  }, [cargar])
  const guardar = async (comoNuevo: boolean) => {
    setTrabajando(true)
    setAviso("")
    const a = actual()
    const r = await guardarMiDiseno({ id: comoNuevo ? undefined : idActual || undefined, herramienta, nombre: a.nombre.slice(0, 120) || "Mi diseño", resumen: a.resumen.slice(0, 300), datos: a.datos })
    setTrabajando(false)
    if (!r.ok) return setAviso(r.mensaje)
    setIdActual(r.id)
    setAviso("Guardado en tu cuenta.")
    cargar()
  }
  if (!sesion)
    return (
      <span className="text-[12px] text-[#8A97AB]">
        <Link href={`/${locale}/login`} className="font-semibold text-[#FFB27A] underline">
          <T>Entra a tu cuenta</T>
        </Link><T>{" "}</T>
        <T>para guardar tus diseños y volver a abrirlos después (es gratis).</T>
      </span>
    )
  return (
    <div className="flex flex-col gap-1.5 text-[12.5px] text-[#C9D2E0]">
      <div className="flex gap-1.5">
        <button type="button" disabled={trabajando} onClick={() => guardar(false)} className="flex-1 rounded-[8px] bg-[#C2560A] px-2 py-1.5 font-semibold text-white hover:bg-[#A84A08] disabled:opacity-50">
          <T>{idActual ? "Guardar cambios" : "Guardar este diseño"}</T>
        </button>
        {idActual && (
          <button type="button" disabled={trabajando} onClick={() => guardar(true)} className="rounded-[8px] bg-[#1C2431] px-2 py-1.5 font-semibold hover:bg-[#243045] disabled:opacity-50">
            <T>Guardar como nuevo</T>
          </button>
        )}
      </div>
      {aviso && <span className={/Guardado/.test(aviso) ? "text-[#9FE0B5]" : "text-[#F6B8AE]"}>{aviso}</span>}
      {lista === null ? (
        <span className="text-[#8A97AB]"><T>Cargando…</T></span>
      ) : lista.length === 0 ? (
        <span className="text-[11.5px] text-[#8A97AB]"><T>Aún no tienes diseños guardados. Puedes guardar hasta</T> {maximo}<T>, gratis.</T></span>
      ) : (
        <ul className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-auto p-0">
          {lista.map((d) => (
            <li key={d.id} className={`flex items-center gap-1.5 rounded-[7px] px-2 py-1 ${d.id === idActual ? "bg-[#2A1C12]" : "bg-[#0F151E]"}`}>
              <button
                type="button"
                onClick={async () => {
                  const r = await abrirMiDiseno(d.id)
                  if (!r.ok) return setAviso(r.mensaje)
                  abrir(r.diseno.datos, r.diseno.nombre)
                  setIdActual(d.id)
                  setAviso("")
                }}
                className="min-w-0 flex-1 text-left"
                title="Abrir"
              >
                <span className="block truncate font-semibold text-white">{d.nombre}</span>
                <span className="block truncate text-[11px] text-[#8A97AB]">
                  <T>{d.herramienta === "cocina" ? "Cocina" : d.herramienta === "moldura" ? "Moldura" : "Mueble"}</T> · {new Date(d.actualizado).toLocaleDateString("es-MX")}
                  <T>{d.resumen ? ` · ${d.resumen}` : ""}</T>
                </span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`¿Borrar «${d.nombre}»?`)) return
                  await borrarMiDiseno(d.id)
                  if (d.id === idActual) setIdActual(null)
                  cargar()
                }}
                className="px-1 text-[#F6B8AE]"
                aria-label={`Borrar ${d.nombre}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
