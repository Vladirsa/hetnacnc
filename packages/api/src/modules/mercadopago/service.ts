// Proveedor de pago Mercado Pago (Checkout Pro) para HETNA CNC.
//
// Flujo:
// 1. initiatePayment crea una "preferencia" en Mercado Pago y guarda la liga de pago
//    (checkout_url) en los datos de la sesión.
// 2. El storefront manda al cliente a esa liga. El cliente paga con tarjeta o saldo.
// 3. Mercado Pago lo regresa a /checkout/mercadopago y el storefront completa el carrito.
// 4. authorizePayment busca el pago por su referencia y lo da por autorizado si está aprobado.
//
// Todo el dinero cae en la cuenta de HETNA. Checkout Pro cobra al momento, por eso
// capturePayment no hace llamadas: solo registra la captura en Medusa.
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
  accessToken: string
  // Dirección pública de la tienda, p. ej. https://hetnacnc.com
  storefrontUrl: string
  // Texto que aparece en el estado de cuenta del cliente (máx. 22 caracteres)
  statementDescriptor?: string
}

type DatosSesion = Record<string, unknown> & {
  referencia?: string
  preference_id?: string
  checkout_url?: string
  payment_id?: string | number
  monto?: number
  session_id?: string
  cart_id?: string
  email?: string
  return_url?: string
}

type PagoMP = {
  id: number
  status: string
  status_detail?: string
  transaction_amount?: number
  external_reference?: string
  metadata?: Record<string, unknown>
}

const API = "https://api.mercadopago.com"

// Medusa puede mandar el monto como número, texto o BigNumber
const aNumero = (monto: unknown): number => {
  if (monto && typeof monto === "object" && "numeric" in (monto as Record<string, unknown>)) {
    return Number((monto as { numeric: unknown }).numeric)
  }
  return Number(monto)
}
const redondear = (n: number) => Math.round(n * 100) / 100

class MercadoPagoProviderService extends AbstractPaymentProvider<Opciones> {
  static identifier = "mercadopago"

  protected opciones_: Opciones
  protected logger_: Logger

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.accessToken) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Mercado Pago: falta accessToken (MERCADOPAGO_ACCESS_TOKEN)")
    }
    if (!options.storefrontUrl) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Mercado Pago: falta storefrontUrl (STOREFRONT_URL)")
    }
  }

  constructor(container: Record<string, unknown>, options: Opciones) {
    super(container, options)
    this.opciones_ = options
    this.logger_ = container.logger as Logger
  }

  // ---------- utilidades ----------

  private async mp<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.opciones_.accessToken}`,
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
      const msg = (json as { message?: string })?.message || `HTTP ${res.status}`
      this.logger_?.error(`Mercado Pago ${ruta}: ${msg}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Mercado Pago: ${msg}`)
    }
    return json as T
  }

  private estado(status?: string): PaymentSessionStatus {
    switch (status) {
      case "approved":
      case "authorized":
        return PaymentSessionStatus.AUTHORIZED
      case "rejected":
        return PaymentSessionStatus.ERROR
      case "cancelled":
      case "refunded":
      case "charged_back":
        return PaymentSessionStatus.CANCELED
      default:
        return PaymentSessionStatus.PENDING
    }
  }

  private urlRetorno(solicitada?: string): string {
    const base = this.opciones_.storefrontUrl.replace(/\/$/, "")
    // Solo aceptamos regresos a nuestra propia tienda
    if (solicitada && solicitada.startsWith(`${base}/`)) return solicitada
    return `${base}/mx/checkout/mercadopago`
  }

  private async buscarPago(datos: DatosSesion): Promise<PagoMP | null> {
    if (datos.payment_id) {
      return this.mp<PagoMP>(`/v1/payments/${datos.payment_id}`)
    }
    if (!datos.referencia) return null
    const r = await this.mp<{ results?: PagoMP[] }>(
      `/v1/payments/search?external_reference=${encodeURIComponent(datos.referencia)}&sort=date_created&criteria=desc`
    )
    const pagos = r.results || []
    return pagos.find((p) => p.status === "approved") || pagos[0] || null
  }

  private async crearPreferencia(
    monto: number,
    moneda: string,
    datos: DatosSesion,
    sessionId?: string
  ): Promise<DatosSesion> {
    const referencia = `hetna_${datos.cart_id || sessionId || crypto.randomUUID()}_${Date.now()}`
    const retorno = this.urlRetorno(datos.return_url)

    const preferencia = await this.mp<{ id: string; init_point: string; sandbox_init_point: string }>(
      "/checkout/preferences",
      {
        method: "POST",
        headers: { "X-Idempotency-Key": referencia },
        body: JSON.stringify({
          items: [
            {
              id: datos.cart_id || referencia,
              title: "Compra en HETNA CNC",
              quantity: 1,
              unit_price: monto,
              currency_id: moneda,
            },
          ],
          payer: datos.email ? { email: datos.email } : undefined,
          external_reference: referencia,
          metadata: { session_id: sessionId, cart_id: datos.cart_id },
          back_urls: { success: retorno, failure: retorno, pending: retorno },
          auto_return: "approved",
          // Solo aprobado o rechazado: sin pagos "en proceso"
          binary_mode: true,
          statement_descriptor: (this.opciones_.statementDescriptor || "HETNA CNC").slice(0, 22),
          // Primera versión: tarjeta y saldo de Mercado Pago. OXXO y SPEI quedan
          // pendientes porque se pagan después y necesitan confirmación por webhook.
          payment_methods: {
            excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }],
          },
        }),
      }
    )

    const prueba = this.opciones_.accessToken.startsWith("TEST-")

    return {
      ...datos,
      session_id: sessionId,
      referencia,
      monto,
      preference_id: preferencia.id,
      checkout_url: prueba ? preferencia.sandbox_init_point : preferencia.init_point,
    }
  }

  // ---------- métodos del proveedor ----------

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const datos = (input.data || {}) as DatosSesion
    const contexto = (input.context || {}) as Record<string, unknown>
    const sessionId = (datos.session_id as string) || (contexto.idempotency_key as string) || undefined
    const monto = redondear(aNumero(input.amount))
    const moneda = (input.currency_code || "mxn").toUpperCase()

    const nuevos = await this.crearPreferencia(monto, moneda, datos, sessionId)

    return {
      id: nuevos.preference_id as string,
      status: PaymentSessionStatus.PENDING,
      data: nuevos,
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Si cambió el total del carrito, generamos una preferencia nueva con el monto correcto
    const datos = (input.data || {}) as DatosSesion
    const monto = redondear(aNumero(input.amount))
    const moneda = (input.currency_code || "mxn").toUpperCase()

    if (datos.preference_id && datos.monto === monto) {
      return { data: datos, status: PaymentSessionStatus.PENDING }
    }

    const nuevos = await this.crearPreferencia(monto, moneda, datos, datos.session_id)
    return { data: nuevos, status: PaymentSessionStatus.PENDING }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const datos = (input.data || {}) as DatosSesion
    const pago = await this.buscarPago(datos)

    if (!pago) {
      return { status: PaymentSessionStatus.PENDING, data: datos }
    }

    let status = this.estado(pago.status)

    // Defensa extra: el pago debe cubrir el monto del carrito
    if (
      status === PaymentSessionStatus.AUTHORIZED &&
      typeof datos.monto === "number" &&
      typeof pago.transaction_amount === "number" &&
      pago.transaction_amount + 0.01 < datos.monto
    ) {
      this.logger_?.error(
        `Mercado Pago: el pago ${pago.id} (${pago.transaction_amount}) no cubre el total (${datos.monto})`
      )
      status = PaymentSessionStatus.ERROR
    }

    return {
      status,
      data: { ...datos, payment_id: pago.id, mp_status: pago.status, mp_status_detail: pago.status_detail },
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    // Checkout Pro ya cobró al aprobarse; solo lo registramos
    return { data: { ...(input.data || {}), capturado: true } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const datos = (input.data || {}) as DatosSesion
    try {
      const pago = await this.buscarPago(datos)
      if (pago && (pago.status === "pending" || pago.status === "in_process")) {
        await this.mp(`/v1/payments/${pago.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "cancelled" }),
        })
      }
    } catch (e) {
      this.logger_?.warn(`Mercado Pago: no se pudo cancelar el pago: ${(e as Error).message}`)
    }
    return { data: datos }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const datos = (input.data || {}) as DatosSesion
    const pago = await this.buscarPago(datos)
    if (!pago) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se encontró el pago en Mercado Pago para reembolsar")
    }
    const monto = redondear(aNumero(input.amount))
    await this.mp(`/v1/payments/${pago.id}/refunds`, {
      method: "POST",
      headers: { "X-Idempotency-Key": `reembolso_${pago.id}_${monto}_${Date.now()}` },
      body: JSON.stringify({ amount: monto }),
    })
    return { data: { ...datos, payment_id: pago.id } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const datos = (input.data || {}) as DatosSesion
    const pago = await this.buscarPago(datos)
    return { data: pago ? { ...datos, payment_id: pago.id, mp_status: pago.status } : datos }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data || {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const datos = (input.data || {}) as DatosSesion
    const pago = await this.buscarPago(datos)
    return { status: pago ? this.estado(pago.status) : PaymentSessionStatus.PENDING, data: datos }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    // Primera versión sin webhooks: el pedido se crea cuando el cliente regresa a la tienda.
    // No usamos el flujo automático de Medusa porque completaría el carrito sin la
    // división por vendedor de Mercur.
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default MercadoPagoProviderService
