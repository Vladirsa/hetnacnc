// Datos de empresa del cliente (estrategia 2.4): razón social, RFC, régimen,
// uso de CFDI y CP fiscal, guardados una vez para que cada solicitud lleve los
// datos de factura sin volverlos a escribir. Gratis para todas las cuentas.
export const T_CLIENTE_EMPRESA = "hetna_cliente_empresa"

let lista = false
export async function asegurarClienteEmpresa(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_CLIENTE_EMPRESA))) {
    await knex.schema.createTable(T_CLIENTE_EMPRESA, (t: any) => {
      t.text("customer_id").primary()
      t.text("razon_social").notNullable()
      t.text("rfc").notNullable()
      t.text("regimen")
      t.text("uso_cfdi")
      t.text("cp")
      t.text("correo")
      t.timestamp("actualizado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

export type EmpresaCliente = { razon_social: string; rfc: string; regimen: string; uso_cfdi: string; cp: string; correo: string }

const RFC = /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/
const limpio = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n)

/** Valida y limpia. Lanza Error con mensaje para el cliente. */
export function validarEmpresa(b: any): EmpresaCliente {
  const e = {
    razon_social: limpio(b?.razon_social, 160),
    rfc: limpio(String(b?.rfc ?? "").replace(/[\s-]/g, ""), 13).toUpperCase(),
    regimen: limpio(b?.regimen, 80),
    uso_cfdi: limpio(b?.uso_cfdi, 60),
    cp: limpio(b?.cp, 5),
    correo: limpio(b?.correo, 120).toLowerCase(),
  }
  if (e.razon_social.length < 3) throw new Error("Escribe la razón social como viene en tu constancia fiscal.")
  if (!RFC.test(e.rfc)) throw new Error("El RFC no es válido (12 caracteres para empresa, 13 para persona física).")
  if (e.cp && !/^\d{5}$/.test(e.cp)) throw new Error("El código postal fiscal debe tener 5 dígitos.")
  if (e.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.correo)) throw new Error("El correo para facturas no es válido.")
  return e
}

export async function leerEmpresa(knex: any, customerId: string): Promise<EmpresaCliente | null> {
  await asegurarClienteEmpresa(knex)
  const f = await knex(T_CLIENTE_EMPRESA).where({ customer_id: customerId }).first()
  return f ? { razon_social: f.razon_social, rfc: f.rfc, regimen: f.regimen || "", uso_cfdi: f.uso_cfdi || "", cp: f.cp || "", correo: f.correo || "" } : null
}

export async function guardarEmpresa(knex: any, customerId: string, b: any): Promise<EmpresaCliente> {
  const e = validarEmpresa(b)
  await asegurarClienteEmpresa(knex)
  await knex(T_CLIENTE_EMPRESA)
    .insert({ customer_id: customerId, ...e, actualizado: new Date() })
    .onConflict("customer_id")
    .merge()
  return e
}
