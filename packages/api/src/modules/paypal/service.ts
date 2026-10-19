// Proveedor de pago PayPal (Orders v2) para HETNA CNC.
//
// Flujo (igual que Mercado Pago):
// 1. initiatePayment crea una "orden" en PayPal y guarda la liga de pago
//    (checkout_url) en los datos de la sesión.
// 2. El storefront manda al cliente a esa liga. El cliente paga con su cuenta PayPal
//    o con tarjeta como invitado.
// 3. PayPal lo regresa a /checkout/paypal y el storefront completa el carrito.
// 4. authorizePayment consulta la orden en PayPal; si el cliente ya la aprobó, la COBRA
//    (captura) en ese momento y la da por autorizada solo si el cobro quedó completo.
//
// Todo el dinero cae en la cuenta PayPal de HETNA. Como el cobro ocurre en
// authorizePayment, capturePayment no hace llamadas: solo registra la captura en Medusa.
import crypto from "crypto"

import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

type Opciones = {
  clientId: string
  clientSecret: string
  // Dirección pública de la tienda, p. ej. https://hetnacnc.com
  storefrontUrl: string
  // true = modo de pruebas (sandbox) de PayPal, sin dinero real
  sandbox?: boolean
  // Nombre que ve el cliente en la página de PayPal
  marca?: string
}

type DatosSesion = Record<string, unknown> & {
  referencia?: string
  paypal_order_id?: string
  checkout_url?: string
  capture_id?: string
  paypal_status?: string
  monto?: number
  moneda?: string
  session_id?: string
  cart_id?: string
  email?: string
  return_url?: string
}

type OrdenPayPal = {
  id: string
  status: string
  links?: { rel: string; href: string }[]
  purchase_units?: {
    custom_id?: string
    amount?: { currency_code?: string; value?: string }
    payments?: { captures?: { id: string; status: string }[] }
  }[]
}

// Medusa puede mandar el monto como número, texto o BigNumber
const aNumero = (monto: unknown): number => {
  if (monto && typeof monto === "object" && "numeric" in (monto as Record<string, unknown>)) {
    return Number((monto as { numeric: unknown }).numeric)
  }
  return Number(monto)
}
const redondear = (n: number) => Math.round(n * 100) / 100

class PayPalProviderService extends AbstractPaymentProvider<Opciones> {
  static identifier = "paypal"

  protected opciones_: Opciones
  protected logger_: Logger
  private token_: { valor: string; vence: number } | null = null

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.clientId || !options.clientSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal: faltan PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET"
      )
    }
    if (!options.storefrontUrl) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "PayPal: falta storefrontUrl (STOREFRONT_URL)")
    }
  }

  constructor(container: Record<string, unknown>, options: Opciones) {
    super(container, options)
    this.opciones_ = options
    this.logger_ = container.logger as Logger
  }

  // ---------- utilidades ----------

  private get api(): string {
    return this.opciones_.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"
  }

  // PayPal pide un "token" temporal para cada sesión de trabajo; lo guardamos hasta que venza
  private async token(): Promise<string> {
    if (this.token_ && Date.now() < this.token_.vence) return this.token_.valor

    const basico = Buffer.from(`${this.opciones_.clientId}:${this.opciones_.clientSecret}`).toString("base64")
    const res = await fetch(`${this.api}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basico}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string
      expires_in?: number
      error_description?: string
    }
    if (!res.ok || !json.access_token) {
      const msg = json.error_description || `HTTP ${res.status}`
      this.logger_?.error(`PayPal: no se pudo obtener token: ${msg}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `PayPal: credenciales no válidas (${msg})`)
    }
    this.token_ = {
      valor: json.access_token,
      // Renovamos 60 segundos antes de que venza
      vence: Date.now() + Math.max(60, (json.expires_in || 300) - 60) * 1000,
    }
    return this.token_.valor
  }

  private async pp<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.api}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        "Content-Type": "application/json",
        ...((init.headers as Record<string, string>) || {}),
      },
    })
    const texto = await res.text()
    let json: unknown = {}
    try {
      json = texto ? JSON.parse(texto) : {}
    } catch {
      json = { message: texto.slice(0, 200) }
    }
    if (!res.ok) {
      const j = json as { message?: string; details?: { issue?: string; description?: string }[] }
      const detalle = j.details?.[0]?.issue || j.details?.[0]?.description
      const msg = [j.message, detalle].filter(Boolean).join(" - ") || `HTTP ${res.status}`
      this.logger_?.error(`PayPal ${ruta}: ${msg}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `PayPal: ${msg}`)
    }
    return json as T
  }

  private urlRetorno(solicitada?: string): string {
    const base = this.opciones_.storefrontUrl.replace(/\/$/, "")
    // Solo aceptamos regresos a nuestra propia tienda
    if (solicitada && solicitada.startsWith(`${base}/`)) return solicitada
    return `${base}/mx/checkout/paypal`
  }

  private obtenerOrden(id: string): Promise<OrdenPayPal> {
    return this.pp<OrdenPayPal>(`/v2/checkout/orders/${id}`)
  }

  private capturaDe(orden: OrdenPayPal) {
    return orden.purchase_units?.[0]?.payments?.captures?.[0]
  }

  private estadoOrden(orden: OrdenPayPal): PaymentSessionStatus {
    const captura = this.capturaDe(orden)
    if (orden.status === "COMPLETED" && captura?.status === "COMPLETED") {
      return PaymentSessionStatus.AUTHORIZED
    }
    if (orden.status === "VOIDED") return PaymentSessionStatus.CANCELED
    return PaymentSessionStatus.PENDING
  }

  private async crearOrden(
    monto: number,
    moneda: string,
    datos: DatosSesion,
    sessionId?: string
  ): Promise<DatosSesion> {
    const referencia = `hetna_${datos.cart_id || sessionId || crypto.randomUUID()}_${Date.now()}`
    const retorno = this.urlRetorno(datos.return_url)

    const orden = await this.pp<OrdenPayPal>("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": referencia },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: "default",
            // Con este dato comprobamos después que la orden pertenece a este carrito
            custom_id: referencia,
            description: "Compra en HETNA CNC",
            amount: { currency_code: moneda, value: monto.toFixed(2) },
          },
        ],
        payment_source: {
          paypal: {
            email_address: datos.email || undefined,
            experience_context: {
              brand_name: this.opciones_.marca || "HETNA CNC",
              locale: "es-MX",
              // El envío ya se eligió en nuestra tienda
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: retorno,
              cancel_url: `${retorno}?cancelado=1`,
            },
          },
        },
      }),
    })

    const liga = orden.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")
    if (!liga) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "PayPal no devolvió la liga de pago")
    }

    return {
      ...datos,
      session_id: sessionId,
      referencia,
      monto,
      moneda,
      paypal_order_id: orden.id,
      paypal_status: orden.status,
      checkout_url: liga.href,
    }
  }

  // ---------- métodos del proveedor ----------

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    // Quitamos cualquier dato de pago que venga del navegador: solo confiamos en lo que crea el servidor
    const recibidos = (input.data || {}) as DatosSesion
    const datos: DatosSesion = {
      cart_id: recibidos.cart_id,
      email: recibidos.email,
      return_url: recibidos.return_url,
    }
    const contexto = (input.context || {}) as Record<string, unknown>
    const sessionId = (contexto.idempotency_key as string) || undefined
    const monto = redondear(aNumero(input.amount))
    const moneda = (input.currency_code || "mxn").toUpperCase()

    const nuevos = await this.crearOrden(monto, moneda, datos, sessionId)

    return {
      id: nuevos.paypal_order_id as string,
      status: PaymentSessionStatus.PENDING,
      data: nuevos,
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Si cambió el total del carrito, generamos una orden nueva con el monto correcto
    const datos = (input.data || {}) as DatosSesion
    const monto = redondear(aNumero(input.amount))
    const moneda = (input.currency_code || "mxn").toUpperCase()

    if (datos.paypal_order_id && datos.monto === monto) {
      return { data: datos, status: PaymentSessionStatus.PENDING }
    }

    const nuevos = await this.crearOrden(monto, moneda, datos, datos.session_id)
    return { data: nuevos, status: PaymentSessionStatus.PENDING }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const datos = (input.data || {}) as DatosSesion
    if (!datos.paypal_order_id) {
      return { status: PaymentSessionStatus.PENDING, data: datos }
    }

    let orden = await this.obtenerOrden(datos.paypal_order_id)

    // El cliente ya aprobó en PayPal pero falta cobrar: cobramos ahora
    if (orden.status === "APPROVED") {
      try {
        orden = await this.pp<OrdenPayPal>(`/v2/checkout/orders/${orden.id}/capture`, {
          method: "POST",
          headers: { "PayPal-Request-Id": `captura_${orden.id}` },
          body: "{}",
        })
      } catch (e) {
        // Puede que otra petición ya la haya cobrado; la volvemos a consultar
        orden = await this.obtenerOrden(orden.id)
        if (orden.status !== "COMPLETED") {
          this.logger_?.error(`PayPal: no se pudo cobrar la orden ${orden.id}: ${(e as Error).message}`)
          return { status: PaymentSessionStatus.ERROR, data: { ...datos, paypal_status: orden.status } }
        }
      }
    }

    let status = this.estadoOrden(orden)
    const unidad = orden.purchase_units?.[0]

    if (status === PaymentSessionStatus.AUTHORIZED) {
      const pagado = Number(unidad?.amount?.value)
      const mismaOrden = !datos.referencia || unidad?.custom_id === datos.referencia
      const mismaMoneda = !datos.moneda || unidad?.amount?.currency_code === datos.moneda
      const cubreMonto =
        typeof datos.monto !== "number" || (Number.isFinite(pagado) && pagado + 0.01 >= datos.monto)

      // Defensa extra: la orden debe ser de este carrito y cubrir el monto
      if (!mismaOrden || !mismaMoneda || !cubreMonto) {
        this.logger_?.error(
          `PayPal: la orden ${orden.id} no coincide con el carrito (pagado ${pagado}, esperado ${datos.monto})`
        )
        status = PaymentSessionStatus.ERROR
      }
    }

    return {
      status,
      data: {
        ...datos,
        capture_id: this.capturaDe(orden)?.id || datos.capture_id,
        paypal_status: orden.status,
      },
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    // El cobro ya se hizo en authorizePayment; solo lo registramos
    return { data: { ...(input.data || {}), capturado: true } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    // Una orden de PayPal sin aprobar se vence sola; no hay nada que cancelar
    return { data: input.data || {} }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const datos = (input.data || {}) as DatosSesion
    let capturaId = datos.capture_id

    if (!capturaId && datos.paypal_order_id) {
      capturaId = this.capturaDe(await this.obtenerOrden(datos.paypal_order_id))?.id
    }
    if (!capturaId) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se encontró el cobro en PayPal para reembolsar")
    }

    const monto = redondear(aNumero(input.amount))
    await this.pp(`/v2/payments/captures/${capturaId}/refund`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `reembolso_${capturaId}_${monto}_${Date.now()}` },
      body: JSON.stringify({
        amount: { value: monto.toFixed(2), currency_code: datos.moneda || "MXN" },
      }),
    })
    return { data: { ...datos, capture_id: capturaId } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const datos = (input.data || {}) as DatosSesion
    if (!datos.paypal_order_id) return { data: datos }
    const orden = await this.obtenerOrden(datos.paypal_order_id)
    return { data: { ...datos, paypal_status: orden.status } }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data || {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const datos = (input.data || {}) as DatosSesion
    if (!datos.paypal_order_id) return { status: PaymentSessionStatus.PENDING, data: datos }
    const orden = await this.obtenerOrden(datos.paypal_order_id)
    return { status: this.estadoOrden(orden), data: datos }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    // Igual que Mercado Pago: sin webhooks en esta primera versión.
    // El pedido se crea cuando el cliente regresa a la tienda.
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default PayPalProviderService
