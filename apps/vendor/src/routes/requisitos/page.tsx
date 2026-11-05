// @ts-nocheck
// Panel del taller > Activa tu cuenta: los dos requisitos para publicar y
// cotizar en HETNA (decisión del 4 nov 2026):
//   1. Aceptar los Términos para vendedores vigentes.
//   2. Verificar una tarjeta de débito o crédito con Mercado Pago o PayPal
//      (cargo de $10 que se devuelve al momento; HETNA no ve ni guarda el número).
// Backend: /vendor/hetna-requisitos (packages/api/src/lib/requisitos-vendedor.ts)
import { useEffect, useState } from "react"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { ShieldCheck } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

import { LLAVE_TERMINOS, aceptarTerminos, leerRequisitos } from "../../lib/requisitos"

export const config: RouteConfig = {
  label: "Activa tu cuenta",
  icon: ShieldCheck,
  rank: 2,
}

const TIENDA = "https://hetnacnc.com/mx"
const fecha = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "")

export default function RequisitosPage() {
  const [e, setE] = useState(null)
  const [error, setError] = useState("")
  const [acepto, setAcepto] = useState(false)
  const [ocupado, setOcupado] = useState("")

  const cargar = async () => {
    try {
      // Regreso de Mercado Pago: trae el número de pago en la dirección
      const q = new URLSearchParams(window.location.search)
      const pago = q.get("payment_id") || q.get("collection_id") || ""
      const d = await leerRequisitos(/^\d{5,24}$/.test(pago) ? `?mp_pago=${pago}` : "")
      setE(d)
      if (q.get("mp") || q.get("paypal")) {
        if (d.tarjeta.ok) toast.success("¡Tarjeta verificada! El cargo de prueba ya se devolvió.")
        else if (d.aviso) toast.error(d.aviso)
        else if (q.get("mp") === "error" || q.get("paypal") === "error") toast.error("No se pudo verificar la tarjeta. Intenta otra vez o usa otra tarjeta.")
        else if (q.get("paypal") === "cancelado") toast.info("Cancelaste el pago con PayPal.")
        else if (q.get("paypal") === "pendiente" || q.get("mp")) toast.info("El pago está en revisión. Recarga la página en unos minutos.")
        window.history.replaceState(null, "", window.location.pathname)
      }
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => {
    cargar()
  }, [])

  const aceptar = async () => {
    setOcupado("terminos")
    try {
      await aceptarTerminos(e.terminos.version_vigente)
      try {
        localStorage.setItem(LLAVE_TERMINOS, e.terminos.version_vigente)
      } catch {}
      toast.success("Términos aceptados")
      await cargar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setOcupado("")
    }
  }

  const verificar = async (proveedor) => {
    setOcupado(proveedor)
    try {
      const r = await fetch("/vendor/hetna-requisitos/tarjeta", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedor }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d.message || "No se pudo abrir el pago.")
      window.location.href = d.url
    } catch (err) {
      toast.error(err.message)
      setOcupado("")
    }
  }

  if (error) return <Container className="p-6"><Text className="text-ui-fg-error">{error}</Text></Container>
  if (!e) return <Container className="p-6"><Text>Cargando…</Text></Container>

  return (
    <div className="flex flex-col gap-3">
      <Container className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Heading>Activa tu cuenta</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
              Para publicar productos, cursos y libros y para cotizar licitaciones en HETNA, todos los talleres y vendedores cumplen dos pasos. Así los
              clientes saben que tratan con negocios reales.
            </Text>
          </div>
          <Badge color={e.completo ? "green" : "orange"}>{e.completo ? "Cuenta activa" : "Falta completar"}</Badge>
        </div>
        {e.exento && <Text className="mt-3 text-ui-fg-subtle">Esta es una cuenta de HETNA: no necesita estos pasos.</Text>}
      </Container>

      <Container className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Heading level="h2">1. Términos para vendedores</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
              Versión vigente: {e.terminos.version_vigente}. Incluyen las comisiones, cómo se te paga, envíos, devoluciones y la lista de precios.
            </Text>
          </div>
          <Badge color={e.terminos.ok ? "green" : "grey"}>{e.terminos.ok ? "Aceptados" : "Pendiente"}</Badge>
        </div>
        {e.terminos.ok ? (
          <Text size="small" className="mt-2 text-ui-fg-subtle">
            Aceptaste la versión {e.terminos.version_aceptada} el {fecha(e.terminos.en)}.
          </Text>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {e.terminos.version_aceptada && (
              <Text size="small" className="text-ui-fg-subtle">
                Aceptaste la versión {e.terminos.version_aceptada}; hay una versión nueva.
              </Text>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={acepto} onChange={(ev) => setAcepto(ev.target.checked)} className="mt-1" />
              <span>
                He leído y acepto los{" "}
                <a href={`${TIENDA}/terminos-vendedores`} target="_blank" rel="noreferrer" className="text-ui-fg-interactive font-medium">
                  Términos para vendedores
                </a>{" "}
                (versión {e.terminos.version_vigente}) y el{" "}
                <a href={`${TIENDA}/aviso-de-privacidad`} target="_blank" rel="noreferrer" className="text-ui-fg-interactive font-medium">
                  Aviso de privacidad
                </a>
                .
              </span>
            </label>
            <div>
              <Button onClick={aceptar} disabled={!acepto} isLoading={ocupado === "terminos"}>
                Aceptar términos
              </Button>
            </div>
          </div>
        )}
      </Container>

      <Container className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Heading level="h2">2. Verifica tu tarjeta de débito o crédito</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
              Se hace un cargo de ${e.monto_verificacion} MXN que se devuelve al momento (puede tardar unos días en verse en tu estado de cuenta). Sólo
              comprueba que la tarjeta es real: HETNA no ve ni guarda el número y no se te cobra nada más.
            </Text>
          </div>
          <Badge color={e.tarjeta.ok ? "green" : "grey"}>{e.tarjeta.ok ? "Verificada" : "Pendiente"}</Badge>
        </div>
        {e.tarjeta.ok ? (
          <Text size="small" className="mt-2 text-ui-fg-subtle">
            Verificada con {e.tarjeta.proveedor === "paypal" ? "PayPal" : "Mercado Pago"}
            {e.tarjeta.detalle ? ` (${e.tarjeta.detalle})` : ""} el {fecha(e.tarjeta.en)}.
          </Text>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {e.metodos.mercadopago && (
              <Button onClick={() => verificar("mercadopago")} isLoading={ocupado === "mercadopago"} disabled={Boolean(ocupado)}>
                Verificar con Mercado Pago (México)
              </Button>
            )}
            {e.metodos.paypal && (
              <Button variant="secondary" onClick={() => verificar("paypal")} isLoading={ocupado === "paypal"} disabled={Boolean(ocupado)}>
                Verificar con PayPal (otros países)
              </Button>
            )}
            {!e.metodos.mercadopago && !e.metodos.paypal && (
              <Text className="text-ui-fg-error">Los pagos no están disponibles ahora. Intenta más tarde.</Text>
            )}
          </div>
        )}
      </Container>
    </div>
  )
}
