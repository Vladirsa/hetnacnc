import { envioGratisDelTaller } from "../../modules/skydropx/service"

const ctx = (gratis: string[], mios: string[]) => ({
  from_location: { id: "loc_1" },
  items: [{ id: "a" }, { id: "b" }, { id: "c" }],
  hetna_renglones_por_almacen: { loc_1: mios },
  hetna_renglones_envio_gratis: gratis,
})

describe("envío gratis del taller", () => {
  it("es gratis si todos sus renglones vienen de ofertas con envío gratis", () => {
    expect(envioGratisDelTaller(ctx(["a", "b"], ["a", "b"]))).toBe(true)
  })
  it("se cobra si alguno de sus renglones no tiene envío gratis", () => {
    expect(envioGratisDelTaller(ctx(["a"], ["a", "b"]))).toBe(false)
  })
  it("los renglones de otro taller no cuentan", () => {
    expect(envioGratisDelTaller(ctx(["a"], ["a"]))).toBe(true)
    expect(envioGratisDelTaller(ctx([], ["a"]))).toBe(false)
  })
})
