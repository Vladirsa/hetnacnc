import { htmlLimpio } from "../fabrica/poster-limpio"

const idea: any = {
  titulo: "Cotiza <rápido> & fácil", sub: "Sube tu DXF", invitacion: "Empieza gratis", boton: "PROBAR GRATIS", pie: "",
  pantalla: { encabezado: "Cotizador", filas: [{ k: "Material", v: "Acero" }, { k: "Piezas", v: "3" }, { k: "Archivo", v: "DXF" }], resaltado: null },
  foto_persona: "", foto_producto: "",
}

describe("htmlLimpio", () => {
  it("pinta las tres variantes en fondo blanco y escapa el texto", () => {
    for (const variante of ["telefono", "persona", "producto"] as const) {
      const h = htmlLimpio(idea, { alto: 1350, variante })
      expect(h).toContain("background: #fff")
      expect(h).toContain("Cotiza &lt;rápido&gt; &amp; fácil")
      expect(h).not.toContain("<rápido>")
    }
  })
  it("el teléfono lleva las filas reales y la liga; la persona, el botón", () => {
    expect(htmlLimpio(idea, { alto: 1350, variante: "telefono" })).toContain("Gratis en<br>www.hetnacnc.com")
    expect(htmlLimpio(idea, { alto: 1350, variante: "telefono" })).toContain("<b>Acero</b>")
    expect(htmlLimpio(idea, { alto: 1920, variante: "persona" })).toContain("PROBAR GRATIS")
  })
})
