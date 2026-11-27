// Modelos para atraer clientes Y talleres (27 nov 2026): carcasas para electrónica,
// piezas mecánicas (polea GT2, acoplador de ejes), plantillas de carpintería y
// trofeos/medallas. Mismo contrato que modelos3d.ts: parámetros y `construir` con el kit.
// Todo en mm, apoyado en Z = 0 y listo para la cama de la impresora.
import type { Kit, Modelo3D } from "./modelos3d"

type S = any // un sólido de manifold
const lim = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export const MODELOS_FABRICACION: Modelo3D[] = [
  // ── Electrónica ────────────────────────────────────────────────────────────
  {
    id: "caja-electronica-tapa",
    nombre: "Carcasa con tapa para tarjeta electrónica",
    texto: "Caja con tapa a presión para Arduino, Raspberry Pi, ESP32 o tu tarjeta: postes donde van sus barrenos, ventana para el conector y ventilación en la tapa.",
    categoria: "electronica",
    claves: "carcasa caja gabinete enclosure arduino uno raspberry pi esp32 pcb tarjeta tapa postes conector usb ventilacion",
    params: [
      { k: "largo", nombre: "Largo de la tarjeta", def: 85, min: 20, max: 200 },
      { k: "ancho", nombre: "Ancho de la tarjeta", def: 56, min: 15, max: 150 },
      { k: "altoInt", nombre: "Alto libre sobre la tarjeta", def: 22, min: 8, max: 80 },
      { k: "origenX", nombre: "Primer barreno: distancia a lo largo", def: 3.5, min: 1, max: 60, paso: 0.1 },
      { k: "origenY", nombre: "Primer barreno: distancia a lo ancho", def: 3.5, min: 1, max: 60, paso: 0.1 },
      { k: "sepX", nombre: "Separación de barrenos a lo largo", def: 58, min: 5, max: 190, paso: 0.1 },
      { k: "sepY", nombre: "Separación de barrenos a lo ancho", def: 49, min: 5, max: 140, paso: 0.1 },
      { k: "barreno", nombre: "Barreno del poste (tornillo M2.5: 2.2)", def: 2.2, min: 1.5, max: 4, paso: 0.1 },
      { k: "ventana", nombre: "Ventana del conector (0 = no, 1 = frente, 2 = lado izq., 3 = lado der.)", def: 3, min: 0, max: 3, unidad: "" },
      { k: "posVentana", nombre: "Centro de la ventana (desde la esquina de la tarjeta)", def: 28, min: 5, max: 195 },
      { k: "anchoVentana", nombre: "Ancho de la ventana", def: 40, min: 5, max: 120 },
      { k: "altoVentana", nombre: "Alto de la ventana", def: 14, min: 3, max: 60 },
      { k: "pared", nombre: "Pared", def: 2, min: 1.2, max: 4, paso: 0.1 },
    ],
    construir: (p, k) => {
      const w = p.pared, hueco = 2, poste = 5, alto = p.altoInt + poste + w
      const L = p.largo + 2 * (hueco + w), A = p.ancho + 2 * (hueco + w), r = 3
      const x0 = w + hueco, y0 = w + hueco // esquina de la tarjeta dentro de la caja
      let caja = k.restar(k.bloque(L, A, alto, 0, 0, 0, r), k.bloque(L - 2 * w, A - 2 * w, alto, w, w, w, Math.max(0.5, r - w)))
      const postes: S[] = []
      for (const dx of [0, p.sepX]) for (const dy of [0, p.sepY]) {
        const x = lim(x0 + p.origenX + dx, w + 3, L - w - 3), y = lim(y0 + p.origenY + dy, w + 3, A - w - 3)
        postes.push(k.restar(k.cil(6, poste, x, y, w), k.cil(p.barreno, poste + 1, x, y, w + 0.6)))
      }
      caja = k.unir(caja, ...postes)
      // ventana del conector, a la altura de la tarjeta (sobre los postes)
      const v = Math.round(p.ventana)
      if (v > 0) {
        const z = w + poste - 1
        const hV = Math.min(p.altoVentana, alto - z - 1)
        if (v === 1) caja = k.restar(caja, k.bloque(Math.min(p.anchoVentana, L - 2 * r), w + 2, hV, lim(x0 + p.posVentana - p.anchoVentana / 2, r, L - r - p.anchoVentana), -1, z))
        else caja = k.restar(caja, k.bloque(w + 2, Math.min(p.anchoVentana, A - 2 * r), hV, v === 2 ? -1 : L - w - 1, lim(y0 + p.posVentana - p.anchoVentana / 2, r, A - r - p.anchoVentana), z))
      }
      // tapa a presión, a un lado: placa con ceja que entra por dentro (0.3 mm de holgura) y ranuras de ventilación
      const hol = 0.3, ceja = 4
      let tapa = k.unir(
        k.bloque(L, A, w, 0, 0, 0, r),
        k.restar(k.bloque(L - 2 * w - 2 * hol, A - 2 * w - 2 * hol, ceja, w + hol, w + hol, w), k.bloque(L - 2 * w - 2 * hol - 2.4, A - 2 * w - 2 * hol - 2.4, ceja + 1, w + hol + 1.2, w + hol + 1.2, w))
      )
      const nr = Math.max(1, Math.floor((L - 30) / 6))
      tapa = k.restar(tapa, ...Array.from({ length: nr }, (_, i) => k.bloque(2.4, A * 0.4, w + 2, 15 + i * 6, A * 0.3, -1)))
      return k.unir(caja, k.mover(tapa, L + 8, 0, 0))
    },
  },

  // ── Piezas mecánicas ───────────────────────────────────────────────────────
  {
    id: "polea-gt2",
    nombre: "Polea dentada GT2",
    texto: "Polea para banda GT2 de 6 o 10 mm (impresoras, CNC, ejes lineales): número de dientes, barreno del eje, pestañas y cubo con opresor. Perfil aproximado: prueba con tu banda.",
    categoria: "taller",
    claves: "polea gt2 dentada timing pulley banda 6mm 10mm 20 dientes motor nema impresora cnc",
    params: [
      { k: "dientes", nombre: "Dientes", def: 20, min: 12, max: 80, unidad: "" },
      { k: "eje", nombre: "Barreno del eje", def: 5, min: 2, max: 14, paso: 0.05 },
      { k: "banda", nombre: "Ancho de la banda", def: 6, min: 4, max: 15 },
      { k: "pestanas", nombre: "Pestañas (0 = no, 1 = sí)", def: 1, min: 0, max: 1, unidad: "" },
      { k: "cubo", nombre: "Largo del cubo (0 = sin cubo)", def: 7, min: 0, max: 20 },
    ],
    construir: (p, k) => {
      const n = Math.round(p.dientes)
      const PD = (n * 2) / Math.PI // diámetro de paso (paso de 2 mm)
      const OD = PD - 0.508 // exterior: la línea de paso de GT2 queda 0.254 mm afuera
      const cuboD = Math.max(p.eje + 7, Math.min(OD + 4, 16)), hC = p.cubo > 0 ? p.cubo : 0
      const dP = Math.max(OD + 3, cuboD) // pestaña: nunca más chica que el cubo
      const pest = p.pestanas >= 0.5 ? 1 : 0, ep = 1 // grosor de cada pestaña
      const zD = hC + pest * ep, hD = p.banda + 0.6
      const partes: S[] = []
      if (hC > 0) partes.push(k.cil(cuboD, hC, 0, 0, 0))
      if (pest) {
        partes.push(k.cil(dP, ep, 0, 0, hC))
        partes.push(k.cil(dP, ep, 0, 0, zD + hD))
      }
      // dientes: cilindro exterior con ranuras semicirculares (radio 0.555, profundidad ~0.75)
      const ranuras = Array.from({ length: n }, (_, i) => {
        const t = (i / n) * 2 * Math.PI, rc = OD / 2 - 0.195
        return k.cil(1.11, hD + 0.02, rc * Math.cos(t), rc * Math.sin(t), zD - 0.01, 16)
      })
      partes.push(k.restar(k.cil(OD, hD, 0, 0, zD, 0), ...ranuras))
      const total = zD + hD + pest * ep
      let polea = k.restar(k.unir(...partes), k.barreno(p.eje + 0.15, total + 1, 0, 0, -0.5))
      // opresor M3 en el cubo
      if (hC >= 5) polea = k.restar(polea, k.mover(k.girar(k.cil(2.8, cuboD, 0, 0, 0), 90, 0, 0), 0, 0, hC / 2))
      return polea
    },
  },
  {
    id: "acoplador-ejes",
    nombre: "Acoplador de ejes",
    texto: "Une dos ejes de distinto diámetro (motor de 5 mm con husillo de 8 mm, por ejemplo), con opresores de cada lado.",
    categoria: "taller",
    claves: "acoplador coupler eje motor nema husillo 5mm 8mm opresor union rigido cnc impresora",
    params: [
      { k: "eje1", nombre: "Eje de un lado", def: 5, min: 2, max: 20, paso: 0.05 },
      { k: "eje2", nombre: "Eje del otro lado", def: 8, min: 2, max: 20, paso: 0.05 },
      { k: "largo", nombre: "Largo", def: 25, min: 12, max: 60 },
      { k: "diametro", nombre: "Diámetro exterior", def: 19, min: 10, max: 40 },
    ],
    construir: (p, k) => {
      const D = Math.max(p.diametro, Math.max(p.eje1, p.eje2) + 6), L = p.largo, m = L / 2
      let a = k.restar(k.cil(D, L), k.barreno(p.eje1 + 0.15, m + 0.5, 0, 0, -0.5), k.barreno(p.eje2 + 0.15, m + 0.5, 0, 0, m))
      // opresores M3 a la mitad de cada lado
      const opresor = (z: number) => k.mover(k.girar(k.cil(2.8, D, 0, 0, 0), 90, 0, 0), 0, D / 4, z)
      a = k.restar(a, opresor(m / 2), opresor(m + m / 2))
      return a
    },
  },

  // ── Carpintería ────────────────────────────────────────────────────────────
  {
    id: "plantilla-bisagra-cazoleta",
    nombre: "Plantilla para bisagra de cazoleta",
    texto: "Guía con tope para barrenar la copa de 35 mm y los dos tornillos de la bisagra de cazoleta en puertas de cocina y closet.",
    categoria: "carpinteria",
    claves: "plantilla bisagra cazoleta 35 mm copa forstner puerta cocina closet bisagra bidimensional jig carpinteria",
    params: [
      { k: "copa", nombre: "Diámetro de la copa", def: 35, min: 20, max: 40, paso: 0.5 },
      { k: "distancia", nombre: "Centro de la copa al canto de la puerta", def: 22.5, min: 18, max: 30, paso: 0.5 },
      { k: "separacion", nombre: "Separación de los tornillos", def: 45, min: 30, max: 60, paso: 0.5 },
      { k: "desfase", nombre: "Tornillos: distancia desde el centro de la copa", def: 9.5, min: 0, max: 15, paso: 0.5 },
      { k: "piloto", nombre: "Barreno guía de los tornillos", def: 2.5, min: 1.5, max: 5, paso: 0.1 },
      { k: "grosor", nombre: "Grosor de la plantilla", def: 8, min: 5, max: 15 },
    ],
    construir: (p, k) => {
      const tope = 6, alturaTope = 12
      const largo = Math.max(70, p.separacion + 25), ancho = tope + p.distancia + p.copa / 2 + 18
      const cx = largo / 2, cy = tope + p.distancia
      const placa = k.unir(k.bloque(largo, ancho, p.grosor, 0, 0, 0, 3), k.bloque(largo, tope, p.grosor + alturaTope)) // el tope se apoya en el canto
      return k.restar(
        placa,
        k.barreno(p.copa + 0.4, p.grosor, cx, cy),
        k.barreno(p.piloto + 0.2, p.grosor, cx - p.separacion / 2, cy + p.desfase),
        k.barreno(p.piloto + 0.2, p.grosor, cx + p.separacion / 2, cy + p.desfase),
        k.bloque(1, 4, p.grosor + alturaTope + 2, cx - 0.5, -1, -1) // marca del centro en el tope
      )
    },
  },
  {
    id: "guia-jaladeras",
    nombre: "Guía para barrenar jaladeras",
    texto: "Plantilla con tope para barrenar jaladeras de cajón y puerta siempre a la misma distancia: 96, 128, 160 mm o la medida de tu jaladera.",
    categoria: "carpinteria",
    claves: "guia plantilla jaladeras tiradores manijas cajon puerta 96 128 160 mm barrenar jig carpinteria cocina",
    params: [
      { k: "separacion", nombre: "Distancia entre centros de la jaladera", def: 128, min: 32, max: 320 },
      { k: "distancia", nombre: "Distancia de los barrenos al canto", def: 30, min: 10, max: 120 },
      { k: "broca", nombre: "Diámetro de la broca", def: 5, min: 3, max: 10, paso: 0.1 },
      { k: "grosor", nombre: "Grosor de la plantilla", def: 6, min: 4, max: 12 },
    ],
    construir: (p, k) => {
      const tope = 6, alturaTope = 10, margen = 20
      const largo = p.separacion + 2 * margen, ancho = tope + p.distancia + 15
      const y = tope + p.distancia, x1 = margen, x2 = margen + p.separacion
      const placa = k.unir(k.bloque(largo, ancho, p.grosor, 0, 0, 0, 3), k.bloque(largo, tope, p.grosor + alturaTope))
      return k.restar(
        placa,
        k.barreno(p.broca + 0.2, p.grosor, x1, y),
        k.barreno(p.broca + 0.2, p.grosor, x2, y),
        // ventana central y marca para alinear con el centro del cajón
        k.bloque(1, ancho, p.grosor + alturaTope + 2, largo / 2 - 0.5, -1, -1),
        k.bloque(Math.min(30, p.separacion - 20), 10, p.grosor + 2, largo / 2 - Math.min(30, p.separacion - 20) / 2, y - 5, -1)
      )
    },
  },
  {
    id: "escuadra-sujecion",
    nombre: "Escuadra de armado a 90°",
    texto: "Escuadra para armar cajones y muebles a escuadra: dos topes a 90°, ventanas para las prensas y alivio en la esquina para el pegamento.",
    categoria: "carpinteria",
    claves: "escuadra armado 90 grados sujecion prensas clamp square cajones muebles carpinteria esquina",
    params: [
      { k: "lado", nombre: "Largo de cada lado", def: 100, min: 50, max: 200 },
      { k: "alto", nombre: "Alto de los topes", def: 25, min: 10, max: 60 },
      { k: "grosor", nombre: "Grosor de los topes", def: 8, min: 5, max: 15 },
    ],
    construir: (p, k) => {
      const L = p.lado, t = p.grosor, base = 6
      const placa = k.extruir([[0, 0], [L, 0], [0, L]], base)
      const topes = k.unir(k.bloque(L, t, p.alto), k.bloque(t, L, p.alto))
      const v = Math.max(12, L * 0.18) // ventanas para las prensas
      return k.restar(
        k.unir(placa, topes),
        k.barreno(6, p.alto + 2, t, t, -1), // alivio en la esquina interior para el pegamento
        k.bloque(v, v, base + 2, t + L * 0.25, t + 4, -1),
        k.bloque(v, v, base + 2, t + 4, t + L * 0.25, -1)
      )
    },
  },

  // ── Trofeos y eventos ──────────────────────────────────────────────────────
  {
    id: "base-trofeo",
    nombre: "Base para trofeo de acrílico",
    texto: "Base escalonada con ranura inclinada para una placa de acrílico cortada en láser con el logo y el texto del evento.",
    categoria: "eventos",
    claves: "trofeo base acrilico placa reconocimiento premio evento torneo empresa laser ranura",
    params: [
      { k: "ancho", nombre: "Ancho de la base", def: 120, min: 60, max: 250 },
      { k: "fondo", nombre: "Fondo de la base", def: 70, min: 40, max: 150 },
      { k: "alto", nombre: "Alto de la base", def: 24, min: 12, max: 60 },
      { k: "placa", nombre: "Grosor de la placa de acrílico", def: 3, min: 2, max: 10, paso: 0.5 },
      { k: "anchoPlaca", nombre: "Ancho de la placa", def: 100, min: 30, max: 240 },
      { k: "inclinacion", nombre: "Inclinación de la placa", def: 10, min: 0, max: 25, unidad: "°" },
    ],
    construir: (p, k) => {
      const W = p.ancho, F = p.fondo, H = p.alto, esc = Math.min(8, W / 10, F / 6)
      const base = k.unir(k.bloque(W, F, H / 2, 0, 0, 0, 4), k.bloque(W - 2 * esc, F - 2 * esc, H / 2, esc, esc, H / 2, 3))
      const prof = Math.min(H * 0.6, 14), t = p.placa + 0.3, wp = Math.min(p.anchoPlaca + 0.6, W - 2 * esc - 6)
      // ranura centrada, inclinada hacia atrás
      const ranura = k.mover(k.girar(k.bloque(wp, t, prof + 2, -wp / 2, -t / 2, -prof), -p.inclinacion, 0, 0), W / 2, F / 2, H + 0.01)
      return k.restar(base, ranura)
    },
  },
  {
    id: "medalla",
    nombre: "Medalla con hueco para logo",
    texto: "Medalla con orilla en relieve, hueco al frente para un disco de acrílico o una calcomanía con tu logo y ojal para el listón.",
    categoria: "eventos",
    claves: "medalla premio carrera torneo evento escuela liston logo reconocimiento deportiva",
    params: [
      { k: "diametro", nombre: "Diámetro", def: 60, min: 30, max: 120 },
      { k: "grosor", nombre: "Grosor", def: 4, min: 2.5, max: 10, paso: 0.5 },
      { k: "orilla", nombre: "Ancho de la orilla", def: 3, min: 1.5, max: 10, paso: 0.5 },
      { k: "hueco", nombre: "Profundidad del hueco del logo", def: 1.2, min: 0.4, max: 3, paso: 0.1 },
      { k: "liston", nombre: "Ancho del listón", def: 22, min: 8, max: 40 },
    ],
    construir: (p, k) => {
      const R = p.diametro / 2, g = p.grosor, prof = Math.min(p.hueco, g - 1.2)
      const ojalAncho = p.liston + 8, ojalAlto = 9
      const cuerpo = k.unir(k.cil(p.diametro, g, R, R, 0, 0), k.bloque(ojalAncho, ojalAlto + 4, g, R - ojalAncho / 2, 2 * R - 4, 0, 2))
      return k.restar(
        cuerpo,
        k.cil(p.diametro - 2 * p.orilla, prof + 0.01, R, R, g - prof, 0), // hueco del logo al frente
        k.bloque(p.liston + 0.5, 3, g + 2, R - (p.liston + 0.5) / 2, 2 * R + 1, -1) // ojal del listón
      )
    },
  },
]

export type { Kit }
