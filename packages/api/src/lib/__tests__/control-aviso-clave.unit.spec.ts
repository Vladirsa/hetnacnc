import { claveAviso, claveAvisoAnterior, tituloEstable } from "../control-aviso-clave"
import { avisosDeServicios } from "../vigilancia"

describe("Clave de los avisos urgentes del Centro de control", () => {
  const pedido = (n: number, horas: string) => ({ tipo: "pedido_sin_enviar", titulo: `Pedido #${n} lleva ${horas} sin enviarse`, url: `https://x/dashboard/orders/order_${n}` })

  it("no cambia cuando sólo avanzan las horas", () => {
    expect(claveAviso(pedido(123, "26 h"))).toBe(claveAviso(pedido(123, "28 h")))
  })
  it("distingue un pedido de otro", () => {
    expect(claveAviso(pedido(123, "26 h"))).not.toBe(claveAviso(pedido(124, "26 h")))
    // Aunque tuvieran la misma liga, el número con # cuenta
    expect(tituloEstable("Pedido #123 lleva 26 h")).not.toBe(tituloEstable("Pedido #124 lleva 26 h"))
  })
  it("no cambia con montos ni cantidades", () => {
    const a = { tipo: "sobrepeso", titulo: "3 sobrepeso(s) pendientes por $1,250", url: "/envios" }
    const b = { tipo: "sobrepeso", titulo: "4 sobrepeso(s) pendientes por $1,410.50", url: "/envios" }
    expect(claveAviso(a)).toBe(claveAviso(b))
  })
  it("los servicios usan su clave estable aunque cambie el saldo", () => {
    const servicio = (saldo: string, dias: string) => ({ id: "runpod", nombre: "RunPod", grupo: "saldo", estado: "rojo", valor: saldo, alerta: `Recarga RunPod: te quedan ${saldo} (${dias}). Sin saldo se detienen los escaneos 3D.` })
    const [a] = avisosDeServicios([servicio("US$8.50", "≈2 días")] as any, "/control")
    const [b] = avisosDeServicios([servicio("US$3.10", "alcanza hoy")] as any, "/control")
    expect((a as any).clave).toBe("servicio:runpod:rojo")
    expect(claveAviso(a as any)).toBe(claveAviso(b as any))
  })
  it("la clave anterior es el título exacto (para reconocer lo ya enviado)", () => {
    expect(claveAvisoAnterior(pedido(1, "26 h"))).not.toBe(claveAvisoAnterior(pedido(1, "28 h")))
    expect(claveAvisoAnterior(pedido(1, "26 h"))).not.toBe(claveAviso(pedido(1, "26 h")))
  })
})
