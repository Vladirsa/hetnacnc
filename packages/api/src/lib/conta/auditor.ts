// Loop de auditoría: revisa todas las facturas del contribuyente y deja hallazgos.
//
//  - Auditor fiscal: reglas de ISR/IVA/CFDI con su fundamento (lo que se puede
//    revisar con el XML).
//  - Auditor forense: señales de facturas falsas o riesgosas: emisor en listas
//    del SAT (69-B, no localizados), CFDI cancelado o inexistente en el SAT,
//    timbrado anómalo, duplicados, montos redondos con conceptos genéricos.
//
// Cada hallazgo tiene una clave estable (regla:uuid): el loop diario no repite
// avisos, respeta los que el usuario descartó y cierra solos los que ya no se
// cumplen (p. ej. llegó el complemento de pago).
//
// Severidad: "alta" = fundamento firme y afecta impuestos; "media" = revisar;
// "baja" = informativo. Las reglas marcadas [por confirmar] sólo avisan.
import type { Cfdi } from "./cfdi"
import type { FilaCfdi } from "./motor"
import { T_HALLAZGO, RFC_VALIDO } from "./almacen"
import { CLAVES_COMBUSTIBLE, CLAVES_RESTAURANTE, FORMA_EFECTIVO, TOPE_EFECTIVO } from "./parametros"

export type Hallazgo = { clave: string; regla: string; uuid: string | null; severidad: "alta" | "media" | "baja"; auditor: "fiscal" | "forense"; mensaje: string; base_legal: string }
export type Contexto = {
  rfc: string; regimen: string; cp: string | null; listas: Record<string, { lista: string; situacion: string }[]>; hoy?: Date
  // true cuando al menos un CFDI del contribuyente ya salió "Vigente" en el SAT: prueba de que la consulta
  // funciona. Mientras no, "no encontrado" no se reporta (podría ser un error de formato, no una factura falsa).
  satConfirmado?: boolean
}

const DIA = 86_400_000
const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const quien = (c: Cfdi, dir: string) => (dir === "recibido" ? `${c.emisor_nombre || c.emisor_rfc} (${c.emisor_rfc})` : `${c.receptor_nombre || c.receptor_rfc} (${c.receptor_rfc})`)
const generico = (c: Cfdi) => c.conceptos.some((k) => k.clave_prod_serv === "01010101" || /^(servicios?|varios|concepto|productos?|mercanc[ií]a)\.?$/i.test(k.descripcion.trim()))

export function auditar(filas: FilaCfdi[], ctx: Contexto): Hallazgo[] {
  const hoy = ctx.hoy || new Date()
  const out: Hallazgo[] = []
  const h = (regla: string, f: FilaCfdi | null, severidad: Hallazgo["severidad"], auditor: Hallazgo["auditor"], mensaje: string, base_legal: string) =>
    out.push({ clave: `${regla}:${f?.uuid || "general"}`, regla, uuid: f?.uuid || null, severidad, auditor, mensaje, base_legal })

  // Pagos registrados por documento (REP) para saber qué PPD siguen sin cobrar/pagar
  const pagado = new Map<string, number>()
  const vivos = filas.filter((f) => f.estatus_sat !== "cancelado")
  for (const f of vivos) for (const p of f.datos.pagos) for (const d of p.doctos) pagado.set(d.uuid, (pagado.get(d.uuid) || 0) + d.pagado)

  // Duplicados: mismo emisor, mismo total, mismo día, distinto UUID
  const firmas = new Map<string, FilaCfdi[]>()
  for (const f of vivos.filter((x) => x.datos.tipo === "I" && x.direccion === "recibido")) {
    const k = `${f.datos.emisor_rfc}|${f.datos.receptor_rfc}|${f.datos.total.toFixed(2)}|${f.datos.fecha.slice(0, 10)}`
    firmas.set(k, [...(firmas.get(k) || []), f])
  }

  for (const f of filas) {
    const c = f.datos
    const recibido = f.direccion === "recibido"
    const gasto = recibido && ["gasto", "inversion"].includes(f.categoria)

    // ── Forense: estatus en el SAT ──
    if (f.estatus_sat === "cancelado" && recibido && c.tipo !== "P")
      h("X03", f, "alta", "forense", `El SAT dice que la factura de ${quien(c, f.direccion)} por ${pesos(c.total_mxn)} está CANCELADA. No se puede deducir ni acreditar su IVA. Si la pagaste, pide una nueva.`, "CFF arts. 29 y 29-A; LISR art. 27 fr. III")
    if (f.estatus_sat === "no_encontrado" && c.tipo !== "P" && ctx.satConfirmado !== false)
      h("X03b", f, "media", "forense", `El SAT no encuentra la factura ${c.uuid} de ${quien(c, f.direccion)}. Puede ser reciente (tarda hasta 72 h) o apócrifa: revísala en verificacfdi.facturaelectronica.sat.gob.mx.`, "CFF art. 29 fr. IV")

    if (recibido && c.tipo !== "P") {
      // ── Forense: listas del SAT ──
      for (const l of ctx.listas[c.emisor_rfc] || []) {
        if (l.lista === "69B" && l.situacion === "Definitivo")
          h("X01", f, "alta", "forense", `${quien(c, f.direccion)} está en la lista DEFINITIVA del art. 69-B (facturas de operaciones inexistentes). Esa factura no surte efectos: no la deduzcas ni acredites su IVA, y revisa con tu contador si debes corregir declaraciones (tienes 30 días desde la publicación para acreditar que la operación fue real).`, "CFF art. 69-B")
        else if (l.lista === "69B" && l.situacion === "Presunto")
          h("X01b", f, "media", "forense", `${quien(c, f.direccion)} está como PRESUNTO en el art. 69-B. Todavía puede desvirtuarlo, pero junta pruebas de que la operación fue real (contrato, entregas, fotos, pagos) y evita comprarle más mientras tanto.`, "CFF art. 69-B")
        else if (l.lista === "NO_LOCALIZADO")
          h("X02", f, "media", "forense", `${quien(c, f.direccion)} aparece como NO LOCALIZADO por el SAT. Verifica que exista y conserva pruebas de la operación.`, "CFF art. 69")
      }
      // ── Forense: datos del timbre y patrones ──
      if (!RFC_VALIDO.test(c.emisor_rfc))
        h("X04", f, "alta", "forense", `El RFC del emisor "${c.emisor_rfc}" no tiene un formato válido.`, "CFF art. 29-A fr. I")
      if (c.fecha_timbrado) {
        const horas = (new Date(c.fecha_timbrado).getTime() - new Date(c.fecha).getTime()) / 3_600_000
        if (horas < -1 || horas > 72)
          h("X05", f, "media", "forense", `La factura de ${quien(c, f.direccion)} se timbró ${horas < 0 ? "ANTES de su fecha" : `${Math.round(horas)} horas después de su fecha`}. Lo normal es que se timbre dentro de las 72 horas siguientes.`, "Anexo 20 (CFDI 4.0), regla de timbrado [por confirmar]")
      }
      if (c.total_mxn >= 50000 && c.subtotal_mxn % 1000 === 0 && generico(c))
        h("X07", f, "media", "forense", `Monto redondo (${pesos(c.subtotal_mxn)}) con un concepto genérico en la factura de ${quien(c, f.direccion)}. Es un patrón común de facturas simuladas: guarda evidencia de qué se compró.`, "Heurística (CFF art. 69-B: materialidad)")
      else if (generico(c))
        h("X09", f, "baja", "forense", `La factura de ${quien(c, f.direccion)} usa un concepto genérico ("${c.conceptos[0]?.descripcion}"). El concepto debe describir lo que se compró.`, "CFF art. 29-A fr. V")
      const dia = new Date(c.fecha).getDay()
      if (gasto && c.total_mxn >= 20000 && (dia === 0 || dia === 6))
        h("X08", f, "baja", "forense", `Gasto de ${pesos(c.total_mxn)} facturado en fin de semana por ${quien(c, f.direccion)}. No es ilegal, pero es una señal que el SAT revisa.`, "Heurística")
    }

    if (c.tipo === "I" && recibido) {
      const dup = firmas.get(`${c.emisor_rfc}|${c.receptor_rfc}|${c.total.toFixed(2)}|${c.fecha.slice(0, 10)}`) || []
      if (dup.length > 1 && f.estatus_sat !== "cancelado")
        h("X06", f, "media", "forense", `Posible factura duplicada: hay ${dup.length} facturas de ${quien(c, f.direccion)} por ${pesos(c.total_mxn)} el mismo día (${dup.map((d) => d.uuid.slice(0, 8)).join(", ")}).`, "Heurística")
    }

    if (f.estatus_sat === "cancelado") continue // lo demás no aplica a canceladas

    // ── Fiscal ──
    if (recibido && c.tipo === "I") {
      if (c.receptor_regimen && c.receptor_regimen !== ctx.regimen)
        h("F01", f, "alta", "fiscal", `La factura de ${quien(c, f.direccion)} trae tu régimen como ${c.receptor_regimen}, pero el tuyo es ${ctx.regimen}. Pide que la corrijan para poder deducirla.`, "CFF art. 29-A fr. IV; Anexo 20 (CFDI 4.0)")
      if (ctx.cp && c.receptor_cp && c.receptor_cp !== ctx.cp)
        h("F01b", f, "alta", "fiscal", `La factura de ${quien(c, f.direccion)} trae tu código postal fiscal como ${c.receptor_cp}, pero el tuyo es ${ctx.cp}.`, "CFF art. 29-A fr. IV; Anexo 20 (CFDI 4.0)")
      if (f.categoria === "gasto" && c.uso === "S01")
        h("F02", f, "media", "fiscal", `La factura de ${quien(c, f.direccion)} tiene uso "S01 Sin efectos fiscales". Si es un gasto del negocio, pide que la emitan con G03 (gastos en general) o G01 (mercancías).`, "Anexo 20; LISR art. 27")
      const formaPago = c.forma
      if (gasto && formaPago === FORMA_EFECTIVO && c.total_mxn > TOPE_EFECTIVO)
        h("F05", f, "media", "fiscal", `Gasto de ${pesos(c.total_mxn)} pagado en efectivo con ${quien(c, f.direccion)}: no es deducible (más de $2,000 en efectivo). La próxima vez paga con transferencia o tarjeta.`, "LISR art. 27 fr. III")
      if (gasto && formaPago === FORMA_EFECTIVO && c.conceptos.some((k) => CLAVES_COMBUSTIBLE.includes(k.clave_prod_serv) || /gasolina|di[eé]sel|combustible/i.test(k.descripcion)))
        h("F06", f, "media", "fiscal", `Combustible pagado en efectivo (${quien(c, f.direccion)}): no es deducible aunque sea poco.`, "LISR art. 27 fr. III, 2º párrafo")
      if (f.categoria === "gasto" && c.conceptos.some((k) => CLAVES_RESTAURANTE.includes(k.clave_prod_serv) || /restaurant|consumo de alimentos/i.test(k.descripcion)))
        h("F07", f, "baja", "fiscal", `Consumo en restaurante (${quien(c, f.direccion)}): sólo se deduce el 8.5%${c.forma === FORMA_EFECTIVO ? ", y en efectivo nada" : ""}. El cálculo ya lo aplica.`, "LISR art. 28 fr. XX")
    }
    if ((c.tipo === "I" || c.tipo === "E") && c.metodo) {
      if (c.metodo === "PPD" && c.forma && c.forma !== "99")
        h("F08", f, "media", "fiscal", `Factura a crédito (PPD) con forma de pago ${c.forma}: en PPD la forma debe ser "99 Por definir"; la forma real va en el complemento de pago.`, "Guía de llenado del Anexo 20 [por confirmar]")
      if (c.metodo === "PUE" && c.forma === "99")
        h("F08b", f, "media", "fiscal", `Factura de contado (PUE) con forma "99 Por definir": en PUE debe ir la forma en que se pagó.`, "Guía de llenado del Anexo 20 [por confirmar]")
    }
    if (c.tipo === "E" && !c.relacionados.some((r) => ["01", "03"].includes(r.tipo)))
      h("F09", f, "alta", "fiscal", `Nota de crédito ${c.uuid.slice(0, 8)} sin la factura que corrige (CFDI relacionado tipo 01 o 03).`, "Anexo 20 (CFDI 4.0)")
    if (!recibido && c.tipo === "I" && c.impuestos.iva_tasa === 0 && c.impuestos.iva_trasladado === 0 && !c.impuestos.iva_exento)
      h("F10", f, "media", "fiscal", `Facturaste a ${quien(c, f.direccion)} con IVA 0%. Sólo procede en exportación (bienes con pedimento, o servicios aprovechados en el extranjero): guarda la evidencia.`, "LIVA art. 29")
    if (c.metodo === "PPD" && (c.tipo === "I")) {
      const pag = pagado.get(c.uuid) || 0
      const saldo = c.total - pag
      const dias = (hoy.getTime() - new Date(c.fecha).getTime()) / DIA
      if (saldo > 0.01 && dias > 60)
        h("F03", f, "media", "fiscal", recibido
          ? `La factura a crédito de ${quien(c, f.direccion)} (${pesos(c.total_mxn)}) lleva ${Math.round(dias)} días sin complemento de pago. Si ya la pagaste, pide el complemento: sin él no puedes deducirla ni acreditar el IVA.`
          : `Tu factura a crédito a ${quien(c, f.direccion)} (${pesos(c.total_mxn)}) lleva ${Math.round(dias)} días sin complemento de pago. Si ya te pagó, emite el complemento: el ingreso y el IVA cuentan en el mes del cobro.`,
          "CFF art. 29 fr. VI; LISR art. 102; LIVA art. 1-B")
    }
    if (!recibido && c.tipo === "P") {
      for (const p of c.pagos) {
        const fp = new Date(p.fecha)
        const limite = new Date(Date.UTC(fp.getUTCFullYear(), fp.getUTCMonth() + 1, 5, 23, 59))
        if (new Date(c.fecha).getTime() > limite.getTime()) {
          h("F04", f, "media", "fiscal", `Emitiste el complemento de pago ${c.uuid.slice(0, 8)} después del día 5 del mes siguiente al pago (${p.fecha.slice(0, 10)}).`, "CFF art. 29 fr. VI; RMF 2026 (regla del complemento de pago) [por confirmar]")
          break
        }
      }
    }
  }
  return out
}

/** Guarda hallazgos: inserta los nuevos, reabre nada de lo descartado y cierra los que ya no se cumplen. */
export async function guardarHallazgos(knex: any, contribuyenteId: string, hallazgos: Hallazgo[]) {
  const previos = (await knex(T_HALLAZGO).where({ contribuyente_id: contribuyenteId }).select("clave", "estado")) as { clave: string; estado: string }[]
  const ya = new Map(previos.map((p) => [p.clave, p.estado]))
  const actuales = new Set(hallazgos.map((x) => x.clave))
  const nuevos = hallazgos.filter((x) => !ya.has(x.clave))
  for (let i = 0; i < nuevos.length; i += 500) {
    await knex(T_HALLAZGO).insert(nuevos.slice(i, i + 500).map((x) => ({ id: `hz_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, contribuyente_id: contribuyenteId, ...x })))
      .onConflict(["contribuyente_id", "clave"]).ignore()
  }
  // Los que estaban abiertos y ya no aparecen: se corrigieron solos
  const cerrar = previos.filter((p) => p.estado === "abierto" && !actuales.has(p.clave)).map((p) => p.clave)
  for (let i = 0; i < cerrar.length; i += 500) {
    await knex(T_HALLAZGO).where({ contribuyente_id: contribuyenteId }).whereIn("clave", cerrar.slice(i, i + 500))
      .update({ estado: "resuelto", nota: "Se corrigió solo (la condición ya no se cumple).", updated_at: knex.fn.now() })
  }
  return { nuevos: nuevos.length, cerrados: cerrar.length, nuevos_alta: nuevos.filter((x) => x.severidad === "alta") }
}
