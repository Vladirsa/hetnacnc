// Modelos de casa y organización (Gridfinity, cadena portacables, florero en
// modo espiral y pantalla de lámpara), aparte de modelos3d.ts para que ese
// archivo no siga creciendo. Mismo contrato: parámetros y `construir` con el kit.
import type { Kit, Modelo3D } from "./modelos3d"

type S = any // un sólido de manifold

/** Losa delgada de un cuadrado redondeado (para armar perfiles escalonados con envolventes). */
const losa = (k: Kit, lado: number, r: number, z: number, cx: number, cy: number) => k.bloque(lado, lado, 0.01, cx - lado / 2, cy - lado / 2, z, r)

/** Círculo con `n` ondas de profundidad `amp` (radio medio R − amp/2), recorrido `dr` hacia adentro. */
function perfilOndulado(R: number, n: number, amp: number, dr: number, puntos: number): [number, number][] {
  return Array.from({ length: puntos }, (_, i) => {
    const t = (i / puntos) * 2 * Math.PI
    const r = R - amp / 2 + (amp / 2) * Math.cos(n * t) - dr
    return [r * Math.cos(t), r * Math.sin(t)] as [number, number]
  })
}

export const MODELOS_CASA_ORGANIZAR: Modelo3D[] = [
  // ── Gridfinity (sistema modular de organización: rejilla de 42 mm, alturas de 7 mm) ──
  {
    id: "gridfinity-caja",
    nombre: "Caja Gridfinity",
    texto: "Cajita del sistema Gridfinity a la medida: casillas de 42 mm, alto en unidades de 7 mm, divisiones e imanes opcionales.",
    categoria: "organizar",
    claves: "gridfinity bin caja organizador modular rejilla 42 mm imanes divisiones cajon",
    params: [
      { k: "x", nombre: "Casillas a lo ancho", def: 2, min: 1, max: 8, unidad: "" },
      { k: "y", nombre: "Casillas a lo fondo", def: 1, min: 1, max: 8, unidad: "" },
      { k: "alto", nombre: "Alto (unidades de 7 mm)", def: 6, min: 2, max: 20, unidad: "" },
      { k: "divisiones", nombre: "Divisiones a lo ancho", def: 1, min: 1, max: 8, unidad: "" },
      { k: "pared", nombre: "Pared", def: 1.2, min: 0.8, max: 3, paso: 0.1 },
      { k: "imanes", nombre: "Huecos para imán 6×2 (0 = no, 1 = sí)", def: 0, min: 0, max: 1, unidad: "" },
    ],
    construir: (p, k) => {
      const nx = Math.round(p.x), ny = Math.round(p.y), G = 42, H = Math.round(p.alto) * 7, w = p.pared
      const W = nx * G - 0.5, F = ny * G - 0.5, PIE = 4.75
      // pie de cada casilla con el perfil escalonado del estándar (chaflán 0.8, recto 1.8, chaflán 2.15)
      const pies: S[] = []
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < ny; j++) {
          const cx = i * G + G / 2 - 0.25, cy = j * G + G / 2 - 0.25
          pies.push(k.envolver(losa(k, 35.6, 0.8, 0, cx, cy), losa(k, 37.2, 1.6, 0.8, cx, cy)))
          pies.push(k.envolver(losa(k, 37.2, 1.6, 0.8, cx, cy), losa(k, 37.2, 1.6, 2.6, cx, cy)))
          pies.push(k.envolver(losa(k, 37.2, 1.6, 2.6, cx, cy), losa(k, 41.5, 3.75, PIE, cx, cy)))
        }
      const piso = 1.2
      let caja = k.unir(...pies, k.bloque(W, F, H - PIE, 0, 0, PIE, 3.75))
      caja = k.restar(caja, k.bloque(W - 2 * w, F - 2 * w, H, w, w, PIE + piso, Math.max(0.5, 3.75 - w)))
      // divisiones a lo ancho
      const nd = Math.round(p.divisiones)
      const paredes = Array.from({ length: nd - 1 }, (_, i) => k.bloque(w, F - 2 * w, H - PIE - piso - 2, w + ((W - 2 * w) * (i + 1)) / nd - w / 2, w, PIE + piso))
      if (paredes.length) caja = k.unir(caja, ...paredes)
      // imanes: 4 por casilla, a ±13 mm del centro, por abajo
      if (p.imanes >= 0.5) {
        const huecos: S[] = []
        for (let i = 0; i < nx; i++)
          for (let j = 0; j < ny; j++)
            for (const [dx, dy] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) huecos.push(k.cil(6.5, 2.4, i * G + G / 2 - 0.25 + dx, j * G + G / 2 - 0.25 + dy, -0.01))
        caja = k.restar(caja, ...huecos)
      }
      return caja
    },
  },
  {
    id: "gridfinity-base",
    nombre: "Base Gridfinity",
    texto: "La rejilla donde se encajan las cajas Gridfinity: tantas casillas como quepan en tu cajón o mesa.",
    categoria: "organizar",
    claves: "gridfinity baseplate base rejilla organizador modular cajon 42 mm",
    params: [
      { k: "x", nombre: "Casillas a lo ancho", def: 4, min: 1, max: 10, unidad: "" },
      { k: "y", nombre: "Casillas a lo fondo", def: 3, min: 1, max: 10, unidad: "" },
    ],
    construir: (p, k) => {
      const nx = Math.round(p.x), ny = Math.round(p.y), G = 42, T = 4.65
      const huecos: S[] = []
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < ny; j++) {
          const cx = i * G + G / 2, cy = j * G + G / 2
          // el negativo del pie de la caja (chaflán 0.7, recto 1.8, chaflán 2.15), pasado hasta abajo
          huecos.push(k.envolver(losa(k, 35.6, 0.8, -1, cx, cy), losa(k, 35.6, 0.8, 0.7, cx, cy)))
          huecos.push(k.envolver(losa(k, 35.6, 0.8, 0.7, cx, cy), losa(k, 37.7, 1.85, 0.7 + 0.01, cx, cy)))
          huecos.push(k.envolver(losa(k, 37.7, 1.85, 0.7, cx, cy), losa(k, 37.7, 1.85, 2.5, cx, cy)))
          huecos.push(k.envolver(losa(k, 37.7, 1.85, 2.5, cx, cy), losa(k, 42, 4, T + 0.01, cx, cy)))
        }
      return k.restar(k.bloque(nx * G, ny * G, T, 0, 0, 0, 4), ...huecos)
    },
  },
  {
    id: "cadena-portacables",
    nombre: "Cadena portacables",
    texto: "Eslabones que se abrochan entre sí para guiar cables y mangueras de tu CNC o impresora. Salen varios por impresión.",
    categoria: "taller",
    claves: "cadena portacables drag chain eslabon cnc impresora cables manguera oruga",
    params: [
      { k: "ancho", nombre: "Ancho por dentro", def: 15, min: 6, max: 60 },
      { k: "alto", nombre: "Alto por dentro", def: 10, min: 6, max: 40 },
      { k: "eslabones", nombre: "Eslabones por impresión", def: 6, min: 1, max: 12, unidad: "" },
    ],
    construir: (p, k) => {
      const w = 1.6, a = p.ancho, h = p.alto, L = Math.max(16, h + 8)
      const A = a + 2 * w, Hh = h + 2 * w, ped = 3.4 // diámetro del perno (el agujero lleva 0.4 de holgura)
      const eslabon = (x0: number) => {
        // paredes laterales y travesaños abajo y arriba (abierto al frente para meter el cable)
        const lados = k.unir(k.bloque(L, w, Hh, x0, 0, 0), k.bloque(L, w, Hh, x0, A - w, 0))
        const piso = k.bloque(L * 0.6, A, w, x0 + L * 0.2, 0, 0)
        const techo = k.bloque(L * 0.3, A, w, x0 + L * 0.35, 0, Hh - w)
        // lengüetas al frente, metidas por dentro, con perno hacia afuera
        const leng = k.unir(k.bloque(L * 0.45, w, Hh * 0.7, x0 + L * 0.8, w + 0.3, Hh * 0.15), k.bloque(L * 0.45, w, Hh * 0.7, x0 + L * 0.8, A - 2 * w - 0.3, Hh * 0.15))
        // pernos hacia afuera (-Y y +Y), que entran en los agujeros de las paredes del eslabón siguiente
        const haciaAfuera = (signo: number) => k.girar(k.cil(ped, w + 0.6, 0, 0, 0), signo * 90, 0, 0)
        const pernos = k.unir(k.mover(haciaAfuera(1), x0 + L * 1.05, w + 0.3 + 0.01, Hh / 2), k.mover(haciaAfuera(-1), x0 + L * 1.05, A - w - 0.3 - 0.01, Hh / 2))
        // agujero que atraviesa las dos paredes
        const agujeros = k.mover(k.girar(k.cil(ped + 0.4, A + 2, 0, 0, 0), -90, 0, 0), x0 + L * 0.2, -1, Hh / 2)
        return k.restar(k.unir(lados, piso, techo, leng, pernos), agujeros)
      }
      const n = Math.round(p.eslabones)
      return k.unir(...Array.from({ length: n }, (_, i) => eslabon(i * (L * 1.35 + 4))))
    },
  },
  {
    id: "florero-espiral",
    nombre: "Florero para modo espiral",
    texto: "Florero con ondas y giro: sale sólido para imprimirlo en modo espiral (vase mode) en una sola pasada, rápido y sin costuras.",
    categoria: "casa",
    claves: "florero jarron vase mode espiral spiralize decoracion maceta ondas giro",
    params: [
      { k: "diametro", nombre: "Diámetro de la base", def: 80, min: 30, max: 200 },
      { k: "alto", nombre: "Alto", def: 150, min: 40, max: 300 },
      { k: "boca", nombre: "Boca (% de la base)", def: 80, min: 30, max: 200, unidad: "%" },
      { k: "ondas", nombre: "Ondas (0 = liso)", def: 8, min: 0, max: 24, unidad: "" },
      { k: "profundidad", nombre: "Profundidad de la onda", def: 6, min: 0, max: 20 },
      { k: "giro", nombre: "Giro", def: 90, min: -360, max: 360, unidad: "°" },
    ],
    construir: (p, k) => {
      const R = p.diametro / 2, n = Math.round(p.ondas), amp = n ? Math.min(p.profundidad, R * 0.4) : 0
      return k.extruir(perfilOndulado(R, n, amp, 0, 180), p.alto, p.giro, p.boca / 100)
    },
  },
  {
    id: "pantalla-lampara",
    nombre: "Pantalla de lámpara",
    texto: "Pantalla con ondas y giro para foco LED: hueca, abierta abajo y con el aro arriba para el socket E27 (o el que pongas).",
    categoria: "casa",
    claves: "pantalla lampara lamp shade e27 socket foco led decoracion ondas",
    params: [
      { k: "abajo", nombre: "Diámetro abajo", def: 160, min: 60, max: 250 },
      { k: "arriba", nombre: "Diámetro arriba", def: 110, min: 60, max: 250 },
      { k: "alto", nombre: "Alto", def: 140, min: 40, max: 250 },
      { k: "ondas", nombre: "Ondas", def: 12, min: 0, max: 30, unidad: "" },
      { k: "profundidad", nombre: "Profundidad de la onda", def: 8, min: 0, max: 20 },
      { k: "giro", nombre: "Giro", def: 60, min: -360, max: 360, unidad: "°" },
      { k: "pared", nombre: "Pared", def: 1.6, min: 0.8, max: 4, paso: 0.1 },
      { k: "socket", nombre: "Barreno del socket (E27: 40.5)", def: 40.5, min: 20, max: 60, paso: 0.5 },
    ],
    construir: (p, k) => {
      const R = p.abajo / 2, n = Math.round(p.ondas), amp = n ? Math.min(p.profundidad, R * 0.3) : 0, w = p.pared
      const escala = p.arriba / p.abajo
      const perfil = (dr: number) => perfilOndulado(R, n, amp, dr, 200)
      // concha: el perfil menos el mismo perfil recorrido hacia adentro (pasado de abajo a arriba)
      const concha = k.restar(k.extruir(perfil(0), p.alto, p.giro, escala), k.extruir(perfil(w), p.alto + 0.02, p.giro, escala, -0.01))
      // aro arriba: disco con el barreno del socket y ventanas para el calor
      const rArriba = (R - amp) * escala
      const aro = k.restar(
        k.cil(2 * rArriba, 2.4, 0, 0, p.alto - 2.4),
        k.barreno(p.socket, 3, 0, 0, p.alto - 2.4),
        ...[0, 1, 2, 3, 4, 5].map((i) => {
          const t = (i / 6) * 2 * Math.PI, rr = (p.socket / 2 + rArriba) / 2
          return k.barreno(Math.max(4, (rArriba - p.socket / 2) * 0.5), 3, rr * Math.cos(t), rr * Math.sin(t), p.alto - 2.4)
        })
      )
      return k.unir(concha, aro)
    },
  },
]
