import { formulario, stripeListo } from "../stripe-api"
import { finDePeriodo } from "../cotizador-stripe"

describe("Cliente de Stripe", () => {
  it("arma el formulario anidado como lo espera Stripe", () => {
    const f = formulario({
      mode: "subscription",
      line_items: [{ price: "price_1", quantity: 1 }],
      metadata: { ref: "cotizador:n1:pro" },
      payment_method_types: ["card", "oxxo"],
      vacio: undefined,
      success_url: "https://x.mx/?s={CHECKOUT_SESSION_ID}",
    }).map(decodeURIComponent)
    expect(f).toEqual([
      "mode=subscription",
      "line_items[0][price]=price_1",
      "line_items[0][quantity]=1",
      "metadata[ref]=cotizador:n1:pro",
      "payment_method_types[0]=card",
      "payment_method_types[1]=oxxo",
      "success_url=https://x.mx/?s={CHECKOUT_SESSION_ID}",
    ])
  })
  it("fin de periodo con la API vieja y la nueva", () => {
    expect(finDePeriodo({ current_period_end: 1767225600 })).toBe("2026-01-01T00:00:00.000Z")
    expect(finDePeriodo({ items: { data: [{ current_period_end: 1767225600 }] } })).toBe("2026-01-01T00:00:00.000Z")
    expect(finDePeriodo({})).toBeNull()
  })
  it("sin llave válida no se activa", () => {
    const antes = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = "pk_live_x"
    expect(stripeListo()).toBe(false)
    process.env.STRIPE_SECRET_KEY = "sk_test_abc"
    expect(stripeListo()).toBe(true)
    process.env.STRIPE_SECRET_KEY = antes
  })
})
