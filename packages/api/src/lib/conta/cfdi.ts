// Lector de CFDI (3.3 y 4.0): convierte el XML timbrado en un objeto plano con
// lo que necesita la contabilidad: quién emite y recibe, tipo, método y forma
// de pago, importes en pesos, impuestos (IVA trasladado/retenido, ISR
// retenido, IEPS), CFDI relacionados y, en los complementos de pago (REP),
// cada documento pagado con su base e impuestos.
//
// No valida el sello ni consulta al SAT: eso lo hace el auditor (lib/conta/auditor).
import { XMLParser } from "fast-xml-parser"

export type TipoCfdi = "I" | "E" | "P" | "N" | "T"

export type ImpuestosCfdi = {
  iva_trasladado: number
  iva_tasa: number | null // 0.16, 0.08, 0 (null = exento / no objeto)
  iva_exento: boolean
  iva_retenido: number
  isr_retenido: number
  ieps: number
}

export type PagoDocto = {
  uuid: string
  moneda: string
  parcialidad: number | null
  saldo_anterior: number | null
  pagado: number          // en la moneda del documento
  saldo_insoluto: number | null
  base_iva: number | null // en pesos (pago 2.0); null en 3.3
  iva: number | null
  iva_retenido: number | null
  isr_retenido: number | null
}

export type PagoCfdi = {
  fecha: string
  forma: string | null
  moneda: string
  tipo_cambio: number
  monto: number           // en la moneda del pago
  monto_mxn: number
  doctos: PagoDocto[]
}

export type Concepto = {
  clave_prod_serv: string
  descripcion: string
  cantidad: number
  clave_unidad: string | null
  valor_unitario: number
  importe: number
  descuento: number
  objeto_imp: string | null
}

export type Cfdi = {
  uuid: string
  version: string
  tipo: TipoCfdi
  serie: string | null
  folio: string | null
  fecha: string
  fecha_timbrado: string | null
  lugar_expedicion: string | null
  emisor_rfc: string
  emisor_nombre: string
  emisor_regimen: string | null
  receptor_rfc: string
  receptor_nombre: string
  receptor_regimen: string | null
  receptor_cp: string | null
  uso: string | null
  metodo: "PUE" | "PPD" | null
  forma: string | null
  moneda: string
  tipo_cambio: number
  subtotal: number        // en moneda original
  descuento: number
  total: number
  // En pesos (moneda original × tipo de cambio)
  subtotal_mxn: number
  descuento_mxn: number
  total_mxn: number
  impuestos: ImpuestosCfdi // en pesos
  conceptos: Concepto[]
  relacionados: { tipo: string; uuid: string }[]
  pagos: PagoCfdi[]
  no_certificado: string | null
  rfc_pac: string | null
  sello_cfd_final: string | null // últimos 8 caracteres del sello (para la liga de verificación del SAT)
}

export class ErrorCfdi extends Error {}

const SIEMPRE_LISTA = new Set([
  "Concepto", "Traslado", "Retencion", "CfdiRelacionados", "CfdiRelacionado", "Pago", "DoctoRelacionado",
  "TrasladoDR", "RetencionDR", "TrasladoP", "RetencionP",
])

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (nombre) => SIEMPRE_LISTA.has(nombre),
})

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const numONull = (v: unknown) => (v === undefined || v === null || v === "" ? null : num(v))
const txt = (v: unknown) => (v === undefined || v === null ? null : String(v).trim() || null)
const lista = <T = any>(v: unknown): T[] => (Array.isArray(v) ? v : v ? [v as T] : [])
const r2 = (n: number) => Math.round(n * 100) / 100

function sumarImpuestos(nodo: any, tc: number): ImpuestosCfdi {
  const out: ImpuestosCfdi = { iva_trasladado: 0, iva_tasa: null, iva_exento: false, iva_retenido: 0, isr_retenido: 0, ieps: 0 }
  for (const t of lista(nodo?.Traslados?.Traslado)) {
    if (t.Impuesto === "002") {
      if (t.TipoFactor === "Exento") out.iva_exento = true
      else {
        out.iva_trasladado += num(t.Importe)
        const tasa = num(t.TasaOCuota)
        if (out.iva_tasa === null || tasa > out.iva_tasa) out.iva_tasa = tasa
      }
    } else if (t.Impuesto === "003") out.ieps += num(t.Importe)
  }
  for (const r of lista(nodo?.Retenciones?.Retencion)) {
    if (r.Impuesto === "001") out.isr_retenido += num(r.Importe)
    else if (r.Impuesto === "002") out.iva_retenido += num(r.Importe)
  }
  out.iva_trasladado = r2(out.iva_trasladado * tc)
  out.iva_retenido = r2(out.iva_retenido * tc)
  out.isr_retenido = r2(out.isr_retenido * tc)
  out.ieps = r2(out.ieps * tc)
  return out
}

/** Impuestos del comprobante; si no trae el nodo global (p. ej. todo exento), se suman los de los conceptos. */
function impuestosComprobante(c: any, tc: number): ImpuestosCfdi {
  if (c.Impuestos) {
    const g = sumarImpuestos(c.Impuestos, tc)
    // El nodo global no dice "exento": se mira en los conceptos
    for (const k of lista(c.Conceptos?.Concepto)) {
      for (const t of lista(k.Impuestos?.Traslados?.Traslado)) if (t.Impuesto === "002" && t.TipoFactor === "Exento") g.iva_exento = true
    }
    return g
  }
  const acc: ImpuestosCfdi = { iva_trasladado: 0, iva_tasa: null, iva_exento: false, iva_retenido: 0, isr_retenido: 0, ieps: 0 }
  for (const k of lista(c.Conceptos?.Concepto)) {
    const s = sumarImpuestos(k.Impuestos, tc)
    acc.iva_trasladado += s.iva_trasladado
    acc.iva_retenido += s.iva_retenido
    acc.isr_retenido += s.isr_retenido
    acc.ieps += s.ieps
    acc.iva_exento = acc.iva_exento || s.iva_exento
    if (s.iva_tasa !== null && (acc.iva_tasa === null || s.iva_tasa > acc.iva_tasa)) acc.iva_tasa = s.iva_tasa
  }
  return acc
}

function leerPagos(complemento: any): PagoCfdi[] {
  const nodo = complemento?.Pagos
  if (!nodo) return []
  return lista(nodo.Pago).map((p: any) => {
    const tcPago = num(p.TipoCambioP) || 1
    const monedaP = String(p.MonedaP || "MXN")
    return {
      fecha: String(p.FechaPago || ""),
      forma: txt(p.FormaDePagoP),
      moneda: monedaP,
      tipo_cambio: tcPago,
      monto: num(p.Monto),
      monto_mxn: r2(num(p.Monto) * (monedaP === "MXN" ? 1 : tcPago)),
      doctos: lista(p.DoctoRelacionado).map((d: any) => {
        // Pago 2.0: EquivalenciaDR = cuántas unidades de la moneda del documento hay por unidad del pago
        const equiv = num(d.EquivalenciaDR) || 1
        const aPesos = (importeDR: number) => (monedaP === "MXN" ? importeDR / equiv : (importeDR / equiv) * tcPago)
        let base: number | null = null, iva: number | null = null, ivaRet: number | null = null, isrRet: number | null = null
        if (d.ImpuestosDR) {
          base = 0; iva = 0; ivaRet = 0; isrRet = 0
          for (const t of lista(d.ImpuestosDR.TrasladosDR?.TrasladoDR)) {
            if (t.ImpuestoDR === "002") { base += aPesos(num(t.BaseDR)); if (t.TipoFactorDR !== "Exento") iva += aPesos(num(t.ImporteDR)) }
          }
          for (const r of lista(d.ImpuestosDR.RetencionesDR?.RetencionDR)) {
            if (r.ImpuestoDR === "002") ivaRet += aPesos(num(r.ImporteDR))
            if (r.ImpuestoDR === "001") isrRet += aPesos(num(r.ImporteDR))
          }
          base = r2(base); iva = r2(iva); ivaRet = r2(ivaRet); isrRet = r2(isrRet)
        }
        return {
          uuid: String(d.IdDocumento || "").toUpperCase(),
          moneda: String(d.MonedaDR || monedaP),
          parcialidad: numONull(d.NumParcialidad),
          saldo_anterior: numONull(d.ImpSaldoAnt),
          pagado: num(d.ImpPagado),
          saldo_insoluto: numONull(d.ImpSaldoInsoluto),
          base_iva: base, iva, iva_retenido: ivaRet, isr_retenido: isrRet,
        }
      }),
    }
  })
}

/** Lee un XML de CFDI. Lanza ErrorCfdi si no es un CFDI timbrado. */
export function leerCfdi(xml: string): Cfdi {
  let raiz: any
  try {
    raiz = parser.parse(xml.replace(/^﻿/, ""))
  } catch (e) {
    throw new ErrorCfdi("El archivo no es un XML válido (está incompleto o dañado).")
  }
  const c = raiz?.Comprobante
  if (!c) throw new ErrorCfdi("El XML no es un CFDI (no tiene Comprobante).")
  const timbre = c.Complemento?.TimbreFiscalDigital
  const uuid = txt(timbre?.UUID)?.toUpperCase()
  if (!uuid) throw new ErrorCfdi("El CFDI no está timbrado (no tiene UUID).")
  const moneda = String(c.Moneda || "MXN")
  const tc = moneda === "MXN" || moneda === "XXX" ? 1 : num(c.TipoCambio) || 1
  const tipo = String(c.TipoDeComprobante || "I").toUpperCase() as TipoCfdi
  const sello = txt(c.Sello)

  return {
    uuid,
    version: String(c.Version || c.version || ""),
    tipo,
    serie: txt(c.Serie),
    folio: txt(c.Folio),
    fecha: String(c.Fecha || ""),
    fecha_timbrado: txt(timbre?.FechaTimbrado),
    lugar_expedicion: txt(c.LugarExpedicion),
    emisor_rfc: String(c.Emisor?.Rfc || "").toUpperCase(),
    emisor_nombre: String(c.Emisor?.Nombre || ""),
    emisor_regimen: txt(c.Emisor?.RegimenFiscal),
    receptor_rfc: String(c.Receptor?.Rfc || "").toUpperCase(),
    receptor_nombre: String(c.Receptor?.Nombre || ""),
    receptor_regimen: txt(c.Receptor?.RegimenFiscalReceptor),
    receptor_cp: txt(c.Receptor?.DomicilioFiscalReceptor),
    uso: txt(c.Receptor?.UsoCFDI),
    metodo: (txt(c.MetodoPago) as any) || null,
    forma: txt(c.FormaPago),
    moneda,
    tipo_cambio: tc,
    subtotal: num(c.SubTotal),
    descuento: num(c.Descuento),
    total: num(c.Total),
    subtotal_mxn: r2(num(c.SubTotal) * tc),
    descuento_mxn: r2(num(c.Descuento) * tc),
    total_mxn: r2(num(c.Total) * tc),
    impuestos: impuestosComprobante(c, tc),
    conceptos: lista(c.Conceptos?.Concepto).map((k: any) => ({
      clave_prod_serv: String(k.ClaveProdServ || ""),
      descripcion: String(k.Descripcion || ""),
      cantidad: num(k.Cantidad),
      clave_unidad: txt(k.ClaveUnidad),
      valor_unitario: num(k.ValorUnitario),
      importe: num(k.Importe),
      descuento: num(k.Descuento),
      objeto_imp: txt(k.ObjetoImp),
    })),
    relacionados: lista(c.CfdiRelacionados).flatMap((g: any) =>
      lista(g.CfdiRelacionado).map((r: any) => ({ tipo: String(g.TipoRelacion || ""), uuid: String(r.UUID || "").toUpperCase() }))
    ),
    pagos: tipo === "P" ? leerPagos(c.Complemento) : [],
    no_certificado: txt(c.NoCertificado),
    rfc_pac: txt(timbre?.RfcProvCertif),
    sello_cfd_final: sello ? sello.slice(-8) : null,
  }
}
