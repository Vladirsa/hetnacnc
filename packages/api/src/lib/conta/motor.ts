// Motor fiscal: ISR provisional e IVA de cada mes de una persona física con
// actividad empresarial (régimen 612), con base en flujo de efectivo.
//
//   ISR (art. 106 LISR): base acumulada de enero al mes =
//       ingresos cobrados − deducciones autorizadas pagadas (incluida la depreciación);
//       ISR = tarifa acumulada del mes (Anexo 8) − pagos provisionales anteriores − ISR que le retuvieron.
//   IVA (art. 5-D LIVA): IVA trasladado y cobrado − IVA que le retuvieron − IVA acreditable pagado;
//       el saldo a favor de un mes se aplica a los siguientes.
//
// Cobrado/pagado: CFDI PUE en su fecha; CFDI PPD sólo cuando llega su complemento de
// pago (REP), en la fecha del pago y en proporción a lo pagado. Notas de crédito
// (tipo E) restan en su fecha. Los CFDI cancelados no cuentan.
//
// Es un borrador para el contador: no considera pérdidas de años anteriores, PTU
// pagada ni estímulos (se pueden capturar después), y lo que no puede decidir lo
// deja marcado para el auditor.
import type { Cfdi } from "./cfdi"
import { isrTarifa } from "./tarifas"
import {
  CLAVES_COMBUSTIBLE, CLAVES_RESTAURANTE, DEDUCIBLE_RESTAURANTE, DEPRECIACION, FORMA_EFECTIVO,
  TOPE_AUTO, TOPE_EFECTIVO, activoSugerido, type TipoActivo,
} from "./parametros"

export type FilaCfdi = {
  uuid: string
  direccion: "emitido" | "recibido"
  tipo: string
  categoria: string
  tipo_activo?: string | null
  estatus_sat?: string | null
  datos: Cfdi
}
export type Movimiento = { fecha: string; tipo: "ingreso" | "gasto"; concepto: string; subtotal: number; iva: number }

export type Partida = { uuid: string | null; fecha: string; rfc: string; nombre: string; concepto: string; base: number; iva: number; isr_ret: number; iva_ret: number; nota?: string }
export type NoDeducible = { uuid: string; fecha: string; nombre: string; base: number; iva: number; motivo: string }

export type Mes = {
  mes: number
  ingresos: number
  deducciones: number
  depreciacion: number
  iva_trasladado: number
  iva_retenido: number
  iva_acreditable: number
  isr_retenido: number
  // acumulados (art. 106)
  ingresos_acum: number
  deducciones_acum: number
  base_acum: number
  isr_causado_acum: number
  isr_pagos_previos: number
  isr_retenido_acum: number
  isr_a_pagar: number
  // IVA
  iva_saldo_mes: number      // positivo = a cargo antes de saldo a favor anterior
  iva_favor_aplicado: number
  iva_a_pagar: number
  iva_saldo_favor: number    // saldo a favor que pasa al siguiente mes
  detalle: { ingresos: Partida[]; deducciones: Partida[]; no_deducibles: NoDeducible[]; sin_factura: Movimiento[] }
}

const r2 = (n: number) => Math.round(n * 100) / 100
const mesDe = (fecha: string) => ({ anio: Number(fecha.slice(0, 4)), mes: Number(fecha.slice(5, 7)) })
const base = (c: Cfdi) => r2(c.subtotal_mxn - c.descuento_mxn)

function esRestaurante(c: Cfdi) {
  return c.conceptos.some((k) => CLAVES_RESTAURANTE.includes(k.clave_prod_serv) || /restaurant|consumo de alimentos/i.test(k.descripcion))
}
function esCombustible(c: Cfdi) {
  return c.conceptos.some((k) => CLAVES_COMBUSTIBLE.includes(k.clave_prod_serv) || /gasolina|di[eé]sel|combustible/i.test(k.descripcion))
}

/** Qué parte de un gasto es deducible (0 a 1) y por qué. La forma de pago que cuenta es la del pago real. */
export function deducibilidad(c: Cfdi, formaPago: string | null, monto: number): { factor: number; motivo?: string } {
  const efectivo = formaPago === FORMA_EFECTIVO
  if (esCombustible(c) && efectivo) return { factor: 0, motivo: "Combustible pagado en efectivo (art. 27 fr. III LISR)" }
  if (efectivo && monto > TOPE_EFECTIVO) return { factor: 0, motivo: `Pago en efectivo de más de $${TOPE_EFECTIVO.toLocaleString("es-MX")} (art. 27 fr. III LISR)` }
  if (esRestaurante(c)) {
    if (efectivo) return { factor: 0, motivo: "Restaurante pagado en efectivo (art. 28 fr. XX LISR)" }
    return { factor: DEDUCIBLE_RESTAURANTE, motivo: "Restaurante: sólo el 8.5% es deducible (art. 28 fr. XX LISR)" }
  }
  return { factor: 1 }
}

type Evento = { anio: number; mes: number; fecha: string; fila: FilaCfdi; proporcion: number; forma: string | null; base?: number; iva?: number }

/** Cobros y pagos efectivos: PUE en su fecha, PPD por cada pago de sus REP, E restando. */
function eventosDeFlujo(filas: FilaCfdi[]): Evento[] {
  const vivos = filas.filter((f) => f.estatus_sat !== "cancelado")
  const porUuid = new Map(vivos.map((f) => [f.uuid, f]))
  const out: Evento[] = []
  for (const f of vivos) {
    const c = f.datos
    if (c.tipo === "I" || c.tipo === "E") {
      if (c.metodo === "PPD") continue // cuenta cuando llega su pago
      const { anio, mes } = mesDe(c.fecha)
      out.push({ anio, mes, fecha: c.fecha.slice(0, 10), fila: f, proporcion: c.tipo === "E" ? -1 : 1, forma: c.forma })
    }
    if (c.tipo === "P") {
      for (const p of c.pagos) {
        const { anio, mes } = mesDe(p.fecha)
        for (const d of p.doctos) {
          const doc = porUuid.get(d.uuid)
          if (!doc || doc.direccion !== f.direccion) continue // sin el documento no se puede clasificar: lo reporta el auditor
          const totalDoc = doc.datos.total || 1
          out.push({
            anio, mes, fecha: p.fecha.slice(0, 10), fila: doc, proporcion: Math.min(1, d.pagado / totalDoc), forma: p.forma,
            base: d.base_iva ?? undefined, iva: d.iva ?? undefined,
          })
        }
      }
    }
  }
  return out
}

/** Depreciación mensual de cada inversión, desde el mes siguiente a su pago y hasta agotar el monto original. */
function depreciacionDelMes(filas: FilaCfdi[], anio: number, mes: number) {
  let total = 0
  const partidas: Partida[] = []
  for (const f of filas) {
    if (f.categoria !== "inversion" || f.direccion !== "recibido" || f.estatus_sat === "cancelado" || f.datos.tipo !== "I") continue
    const c = f.datos
    const tipo = (f.tipo_activo as TipoActivo) || activoSugerido(c.conceptos[0]?.clave_prod_serv || "")
    const p = DEPRECIACION[tipo] || DEPRECIACION.maquinaria_otras
    const moi = tipo === "automovil" ? Math.min(base(c), TOPE_AUTO) : base(c)
    const { anio: a0, mes: m0 } = mesDe(c.fecha)
    const mesesDesde = (anio - a0) * 12 + (mes - m0) // 1 = mes siguiente
    if (mesesDesde < 1) continue
    const mensual = (moi * p.tasa) / 12
    const yaDepreciado = mensual * (mesesDesde - 1)
    const este = Math.max(0, Math.min(mensual, moi - yaDepreciado))
    if (este <= 0) continue
    total += este
    partidas.push({ uuid: f.uuid, fecha: c.fecha.slice(0, 10), rfc: c.emisor_rfc, nombre: c.emisor_nombre, concepto: `Depreciación ${Math.round(p.tasa * 100)}% (${p.fuente})`, base: r2(este), iva: 0, isr_ret: 0, iva_ret: 0 })
  }
  return { total: r2(total), partidas }
}

/** Calcula los 12 meses del año (o hasta hastaMes). */
export function calcularAnio(filas: FilaCfdi[], movimientos: Movimiento[], anio: number, hastaMes = 12): Mes[] {
  const eventos = eventosDeFlujo(filas).filter((e) => e.anio === anio)
  const meses: Mes[] = []
  let ingAcum = 0, dedAcum = 0, isrPagado = 0, retAcum = 0, favor = 0
  for (let mes = 1; mes <= hastaMes; mes++) {
    const det = { ingresos: [] as Partida[], deducciones: [] as Partida[], no_deducibles: [] as NoDeducible[], sin_factura: [] as Movimiento[] }
    let ingresos = 0, deducciones = 0, ivaTras = 0, ivaRet = 0, ivaAcr = 0, isrRet = 0
    for (const e of eventos.filter((x) => x.mes === mes)) {
      const c = e.fila.datos
      const signo = e.proporcion < 0 ? -1 : 1
      const prop = Math.abs(e.proporcion)
      const b = r2(signo * (e.base ?? base(c) * prop))
      const iva = r2(signo * (e.iva ?? c.impuestos.iva_trasladado * prop))
      const ir = r2(signo * c.impuestos.isr_retenido * prop)
      const vr = r2(signo * c.impuestos.iva_retenido * prop)
      const partida: Partida = { uuid: c.uuid, fecha: e.fecha, rfc: e.fila.direccion === "emitido" ? c.receptor_rfc : c.emisor_rfc, nombre: e.fila.direccion === "emitido" ? c.receptor_nombre : c.emisor_nombre, concepto: c.conceptos[0]?.descripcion || "", base: b, iva, isr_ret: ir, iva_ret: vr }
      if (e.fila.direccion === "emitido") {
        if (e.fila.categoria !== "ingreso") continue // cobros de terceros, nómina, etc.
        ingresos += b; ivaTras += iva; isrRet += ir; ivaRet += vr
        det.ingresos.push(partida)
      } else {
        if (e.fila.categoria === "inversion") {
          // La inversión se deduce por depreciación; su IVA se acredita cuando se paga
          ivaAcr += iva
          det.deducciones.push({ ...partida, base: 0, nota: "Inversión: se deduce por depreciación; IVA acreditable al pagarse" })
          continue
        }
        if (e.fila.categoria !== "gasto") {
          if (["no_deducible", "personal"].includes(e.fila.categoria)) det.no_deducibles.push({ uuid: c.uuid, fecha: e.fecha, nombre: c.emisor_nombre, base: b, iva, motivo: e.fila.categoria === "personal" ? "Deducción personal: va en la declaración anual" : "Marcado como no deducible" })
          continue
        }
        const d = deducibilidad(c, e.forma, Math.abs(c.total_mxn * prop))
        const bd = r2(b * d.factor)
        const ivad = r2(iva * d.factor)
        if (d.factor < 1) det.no_deducibles.push({ uuid: c.uuid, fecha: e.fecha, nombre: c.emisor_nombre, base: r2(b - bd), iva: r2(iva - ivad), motivo: d.motivo || "" })
        if (d.factor > 0) {
          deducciones += bd; ivaAcr += ivad
          det.deducciones.push({ ...partida, base: bd, iva: ivad, nota: d.factor < 1 ? d.motivo : undefined })
        }
      }
    }
    // Cobros sin factura (Excel): son ingreso igual. Gastos sin factura: no son deducibles (art. 27 fr. III).
    for (const m of movimientos.filter((x) => mesDe(x.fecha).anio === anio && mesDe(x.fecha).mes === mes)) {
      det.sin_factura.push(m)
      if (m.tipo === "ingreso") { ingresos += m.subtotal; ivaTras += m.iva }
    }
    const dep = depreciacionDelMes(filas, anio, mes)
    det.deducciones.push(...dep.partidas)

    ingresos = r2(ingresos); deducciones = r2(deducciones)
    ingAcum = r2(ingAcum + ingresos)
    dedAcum = r2(dedAcum + deducciones + dep.total)
    retAcum = r2(retAcum + isrRet)
    const baseAcum = r2(Math.max(0, ingAcum - dedAcum))
    const causado = isrTarifa(baseAcum, anio, mes)
    const isrAPagar = r2(Math.max(0, causado - isrPagado - retAcum))
    const saldoMes = r2(ivaTras - ivaRet - ivaAcr)
    const aplicado = saldoMes > 0 ? r2(Math.min(saldoMes, favor)) : 0
    const ivaAPagar = r2(Math.max(0, saldoMes - aplicado))
    favor = r2(favor - aplicado + (saldoMes < 0 ? -saldoMes : 0))
    meses.push({
      mes, ingresos, deducciones, depreciacion: dep.total,
      iva_trasladado: r2(ivaTras), iva_retenido: r2(ivaRet), iva_acreditable: r2(ivaAcr), isr_retenido: r2(isrRet),
      ingresos_acum: ingAcum, deducciones_acum: dedAcum, base_acum: baseAcum, isr_causado_acum: causado,
      isr_pagos_previos: isrPagado, isr_retenido_acum: retAcum, isr_a_pagar: isrAPagar,
      iva_saldo_mes: saldoMes, iva_favor_aplicado: aplicado, iva_a_pagar: ivaAPagar, iva_saldo_favor: favor,
      detalle: det,
    })
    isrPagado = r2(isrPagado + isrAPagar)
  }
  return meses
}
