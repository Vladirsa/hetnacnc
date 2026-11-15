// CFDI de ejemplo (sin sello real) para probar el lector, el motor y el auditor.
// RFC de HETNA de prueba: SAVV800101AB1 (persona física, régimen 612).
export const RFC_YO = "SAVV800101AB1"

type Opc = {
  uuid: string
  tipo?: "I" | "E" | "P" | "N"
  fecha?: string
  emisor?: string
  emisorNombre?: string
  emisorRegimen?: string
  receptor?: string
  receptorNombre?: string
  receptorRegimen?: string
  receptorCp?: string
  uso?: string
  metodo?: "PUE" | "PPD"
  forma?: string
  moneda?: string
  tc?: number
  subtotal?: number
  iva?: number | "exento"
  ivaRet?: number
  isrRet?: number
  descripcion?: string
  claveProd?: string
  relacion?: { tipo: string; uuid: string }
  version?: "4.0" | "3.3"
}

export function cfdi(o: Opc) {
  const sub = o.subtotal ?? 1000
  const iva = o.iva === "exento" ? 0 : o.iva ?? Math.round(sub * 0.16 * 100) / 100
  const total = Math.round((sub + iva - (o.ivaRet || 0) - (o.isrRet || 0)) * 100) / 100
  const ver = o.version || "4.0"
  const ns = ver === "4.0" ? "http://www.sat.gob.mx/cfd/4" : "http://www.sat.gob.mx/cfd/3"
  const trasladoConcepto = o.iva === "exento"
    ? `<cfdi:Traslado Base="${sub}" Impuesto="002" TipoFactor="Exento"/>`
    : `<cfdi:Traslado Base="${sub}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva}"/>`
  const retenciones = (o.ivaRet || o.isrRet)
    ? `<cfdi:Retenciones>${o.isrRet ? `<cfdi:Retencion Impuesto="001" Importe="${o.isrRet}"/>` : ""}${o.ivaRet ? `<cfdi:Retencion Impuesto="002" Importe="${o.ivaRet}"/>` : ""}</cfdi:Retenciones>`
    : ""
  const totalRet = (o.ivaRet || 0) + (o.isrRet || 0)
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="${ns}" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="${ver}" Serie="A" Folio="1" Fecha="${o.fecha || "2026-10-15T10:00:00"}" Sello="AAAABBBBCCCCDDDDEEEEFFFF12345678" ${o.forma ? `FormaPago="${o.forma}"` : `FormaPago="03"`} NoCertificado="00001000000500000001" SubTotal="${sub}" Moneda="${o.moneda || "MXN"}" ${o.tc ? `TipoCambio="${o.tc}"` : ""} Total="${total}" TipoDeComprobante="${o.tipo || "I"}" Exportacion="01" MetodoPago="${o.metodo || "PUE"}" LugarExpedicion="90000">
  ${o.relacion ? `<cfdi:CfdiRelacionados TipoRelacion="${o.relacion.tipo}"><cfdi:CfdiRelacionado UUID="${o.relacion.uuid}"/></cfdi:CfdiRelacionados>` : ""}
  <cfdi:Emisor Rfc="${o.emisor || RFC_YO}" Nombre="${o.emisorNombre || "VLADIMIR PRUEBA"}" RegimenFiscal="${o.emisorRegimen || "612"}"/>
  <cfdi:Receptor Rfc="${o.receptor || "XAXX010101000"}" Nombre="${o.receptorNombre || "PUBLICO EN GENERAL"}" DomicilioFiscalReceptor="${o.receptorCp || "90000"}" RegimenFiscalReceptor="${o.receptorRegimen || "616"}" UsoCFDI="${o.uso || "G03"}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="${o.claveProd || "73181100"}" Cantidad="1" ClaveUnidad="E48" Descripcion="${o.descripcion || "Corte CNC de piezas de MDF"}" ValorUnitario="${sub}" Importe="${sub}" ObjetoImp="02">
      <cfdi:Impuestos><cfdi:Traslados>${trasladoConcepto}</cfdi:Traslados></cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  ${o.iva === "exento" ? "" : `<cfdi:Impuestos ${totalRet ? `TotalImpuestosRetenidos="${totalRet}"` : ""} TotalImpuestosTrasladados="${iva}">${retenciones}<cfdi:Traslados><cfdi:Traslado Base="${sub}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva}"/></cfdi:Traslados></cfdi:Impuestos>`}
  <cfdi:Complemento><tfd:TimbreFiscalDigital Version="1.1" UUID="${o.uuid}" FechaTimbrado="${o.fecha || "2026-10-15T10:00:05"}" RfcProvCertif="SPR190613I52" SelloCFD="x" NoCertificadoSAT="00001000000509846663" SelloSAT="y"/></cfdi:Complemento>
</cfdi:Comprobante>`
}

/** Complemento de pago 2.0 que paga (parcial o total) un CFDI PPD. */
export function rep(o: { uuid: string; emisor?: string; receptor?: string; fechaPago: string; doc: string; pagado: number; saldoAnt: number; parcialidad?: number }) {
  const base = Math.round((o.pagado / 1.16) * 100) / 100
  const iva = Math.round((o.pagado - base) * 100) / 100
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="${o.fechaPago}" Sello="ZZZZ" NoCertificado="00001000000500000001" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="P" Exportacion="01" LugarExpedicion="90000">
  <cfdi:Emisor Rfc="${o.emisor || RFC_YO}" Nombre="VLADIMIR PRUEBA" RegimenFiscal="612"/>
  <cfdi:Receptor Rfc="${o.receptor || "EKU9003173C9"}" Nombre="ESCUELA KEMPER URGATE" DomicilioFiscalReceptor="42501" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales MontoTotalPagos="${o.pagado}" TotalTrasladosBaseIVA16="${base}" TotalTrasladosImpuestoIVA16="${iva}"/>
      <pago20:Pago FechaPago="${o.fechaPago}" FormaDePagoP="03" MonedaP="MXN" TipoCambioP="1" Monto="${o.pagado}">
        <pago20:DoctoRelacionado IdDocumento="${o.doc}" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="${o.parcialidad || 1}" ImpSaldoAnt="${o.saldoAnt}" ImpPagado="${o.pagado}" ImpSaldoInsoluto="${Math.round((o.saldoAnt - o.pagado) * 100) / 100}" ObjetoImpDR="02">
          <pago20:ImpuestosDR><pago20:TrasladosDR><pago20:TrasladoDR BaseDR="${base}" ImpuestoDR="002" TipoFactorDR="Tasa" TasaOCuotaDR="0.160000" ImporteDR="${iva}"/></pago20:TrasladosDR></pago20:ImpuestosDR>
        </pago20:DoctoRelacionado>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="${o.uuid}" FechaTimbrado="${o.fechaPago}" RfcProvCertif="SPR190613I52" SelloCFD="x" NoCertificadoSAT="00001000000509846663" SelloSAT="y"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`
}
