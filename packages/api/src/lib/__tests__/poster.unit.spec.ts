import { htmlPoster } from "../fabrica/poster"
import { TEMAS } from "../fabrica/hyperframes"

describe("imágenes con el estilo nuevo", () => {
  it("usa el fondo del tema, la foto en su tarjeta y el QR", () => {
    const h = htmlPoster({ tema: "madre", cinta: "Día de las Madres", titulo: "Para mamá: portarretratos", cta: "Encuéntralo en HETNA", liga: "https://hetnacnc.com/r/x" }, { foto: true, qr: "<svg></svg>" })
    expect(h).toContain(TEMAS.madre.fondo)
    expect(h).toContain('src="foto.jpg"')
    expect(h).toContain('class="qr"')
    expect(h).toContain("hetnacnc.com/r/x")
    expect(h).not.toContain("https://hetnacnc.com/r/x</div>") // la liga se muestra sin https
  })

  it("los colores del tema sólo pintan el dibujo, nunca el QR", () => {
    const h = htmlPoster({ tema: "tecnico", titulo: "Cotiza en segundos", liga: "https://x.y" }, { qr: "<svg></svg>" })
    expect(h).toMatch(/\.dibujo svg \[stroke=/)
    expect(h).not.toMatch(/\n\s*svg \[stroke=/)
  })

  it("sin foto de fondo, el tema 'foto' usa el plano", () => {
    const h = htmlPoster({ tema: "foto", titulo: "Algo" }, {})
    expect(h).toContain(TEMAS.plano.fondo)
    expect(h).not.toContain('class="foto-fondo"')
  })
})
