// Auditoría Thermos del 15 nov 2026: llaves de archivos y metadata protegida.
import { llaveDeProductoValida } from "../archivo-seguro"
import { blindarProducto } from "../../api/vendor/hetna-producto-protegido/middlewares"

describe("llaveDeProductoValida", () => {
  it("acepta archivos de productos", () => {
    expect(llaveDeProductoValida("libros/sel_1/0123456789abcdef.pdf")).toBe(true)
    expect(llaveDeProductoValida("fabrica/diseno-123.dxf")).toBe(true)
  })
  it("rechaza planos y documentos privados", () => {
    for (const k of ["solicitudes/abc/plano.dxf", "propuestas/x.pdf", "facturas/1.xml", "cloud/s/1.stl", "certificaciones/c.pdf", "avances/f.jpg", "guias/g.pdf"]) {
      expect(llaveDeProductoValida(k)).toBe(false)
    }
  })
  it("rechaza rutas raras y valores vacíos", () => {
    for (const k of ["", "../solicitudes/x", "/etc/passwd", "libros\\x", 42, null, undefined]) {
      expect(llaveDeProductoValida(k)).toBe(false)
    }
  })
})

describe("blindarProducto", () => {
  it("un producto nuevo no puede traer llaves de HETNA", () => {
    const out = blindarProducto({ archivo_storage_key: "libros/x/1.pdf", archivo_gratis: true, producto_digital: true, precio_mxn: 1, color: "rojo" }, {})
    expect(out).toEqual({ color: "rojo" })
  })
  it("al editar se conservan los valores guardados", () => {
    const guardada = { archivo_storage_key: "libros/s/a.pdf", producto_digital: true }
    const out = blindarProducto({ archivo_storage_key: "solicitudes/otro.dxf", producto_digital: false, archivo_gratis: true, x: 1 }, guardada)
    expect(out).toEqual({ archivo_storage_key: "libros/s/a.pdf", producto_digital: true, x: 1 })
  })
})

import { trabajosPagables } from "../../workflows/cam/steps/mark-cam-jobs-paid"

describe("trabajosPagables (CAM)", () => {
  const productos = [
    { handle: "servicio-cam-5-ejes", variants: [
      { id: "var_5_alta", options: [{ value: "Alta", option: { title: "Complejidad" } }] },
      { id: "var_5_basica", options: [{ value: "Básica", option: { title: "Complejidad" } }] },
    ] },
    { handle: "revision-especialista-cam", variants: [{ id: "var_rev", options: [] }] },
  ]
  const job = { id: "camjob_1", status: "in_cart", service: "cam_5", tier: "Alta" }
  it("paga con la línea del servicio y nivel correctos", () => {
    expect(trabajosPagables([job], [{ variant_id: "var_5_alta", metadata: { cam_job_id: "camjob_1" } }], productos)).toHaveLength(1)
  })
  it("no paga con otro producto, otro nivel o sólo la revisión", () => {
    expect(trabajosPagables([job], [{ variant_id: "var_barato", metadata: { cam_job_id: "camjob_1" } }], productos)).toHaveLength(0)
    expect(trabajosPagables([job], [{ variant_id: "var_5_basica", metadata: { cam_job_id: "camjob_1" } }], productos)).toHaveLength(0)
    expect(trabajosPagables([job], [{ variant_id: "var_rev", metadata: { cam_job_id: "camjob_1", cam_addon: "review" } }], productos)).toHaveLength(0)
  })
  it("no paga un trabajo que no estaba en el carrito", () => {
    expect(trabajosPagables([{ ...job, status: "received" }], [{ variant_id: "var_5_alta", metadata: { cam_job_id: "camjob_1" } }], productos)).toHaveLength(0)
  })
})

import { errorDefinitivo, unaVezALaVez } from "../aviso-unico"

describe("unaVezALaVez (avisos de pago)", () => {
  it("dos avisos del mismo pago se procesan uno tras otro", async () => {
    const orden: string[] = []
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const trabajo = (n: string) => async () => {
      orden.push(`inicia ${n}`)
      await espera(20)
      orden.push(`termina ${n}`)
    }
    await Promise.all([unaVezALaVez("mp:1", trabajo("a")), unaVezALaVez("mp:1", trabajo("b"))])
    expect(orden).toEqual(["inicia a", "termina a", "inicia b", "termina b"])
  })
  it("si el primero falla, el segundo corre igual", async () => {
    const p1 = unaVezALaVez("mp:2", async () => { throw new Error("falla") })
    const p2 = unaVezALaVez("mp:2", async () => "ok")
    await expect(p1).rejects.toThrow("falla")
    await expect(p2).resolves.toBe("ok")
  })
  it("404 es definitivo; 500 se reintenta", () => {
    expect(errorDefinitivo({ status: 404 })).toBe(true)
    expect(errorDefinitivo({ status: 500 })).toBe(false)
    expect(errorDefinitivo(new Error("red"))).toBe(false)
  })
})
