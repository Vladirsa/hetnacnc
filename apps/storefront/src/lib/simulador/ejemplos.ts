// Programas de ejemplo del Simulador CNC (escritos por HETNA para practicar).
// Todos en milímetros, con Z0 en la cara de arriba y X0 Y0 en la esquina.
import type { Fresa } from "./material"
import type { Material } from "./gcode"

export type Ejemplo = { id: string; nombre: string; explicacion: string; material: Material; fresa: Fresa; codigo: string }

export const EJEMPLOS: Ejemplo[] = [
  {
    id: "contorno",
    nombre: "1. Contorno de una placa",
    explicacion: "Lo primero que se aprende: subir, bajar con avance y recorrer un rectángulo en dos pasadas de 3 mm.",
    material: { ancho: 120, largo: 80, alto: 9, cero: "esquina" },
    fresa: { diametro: 6, tipo: "plana" },
    codigo: `%
(Contorno de placa 100 x 60 mm, MDF de 9 mm)
(Fresa plana de 6 mm. Cero: esquina inferior izquierda, Z0 arriba del material)
G21 G90 G17
M3 S18000
G0 Z5
G0 X10 Y10
(Primera pasada a 3 mm)
G1 Z-3 F300
G1 X110 F1200
G1 Y70
G1 X10
G1 Y10
(Segunda pasada a 6 mm)
G1 Z-6 F300
G1 X110 F1200
G1 Y70
G1 X10
G1 Y10
G0 Z5
M5
G0 X0 Y0
M30
%`,
  },
  {
    id: "bolsillo",
    nombre: "2. Bolsillo rectangular",
    explicacion: "Vaciar un hueco: la fresa recorre vueltas cada vez más grandes con un paso de 4 mm.",
    material: { ancho: 100, largo: 80, alto: 15, cero: "esquina" },
    fresa: { diametro: 6, tipo: "plana" },
    codigo: `%
(Bolsillo de 50 x 30 mm, 4 mm de profundo)
G21 G90
M3 S16000
G0 Z5
G0 X50 Y40
G1 Z-4 F250
(Vueltas de adentro hacia afuera, paso de 4 mm)
G1 X46 Y36 F1000
G1 X54
G1 Y44
G1 X46
G1 Y36
G1 X42 Y32
G1 X58
G1 Y48
G1 X42
G1 Y32
G1 X38 Y28
G1 X62
G1 Y52
G1 X38
G1 Y28
G1 X28 Y28
G1 X72
G1 Y52
G1 X28
G1 Y28
G0 Z5
M5
M30
%`,
  },
  {
    id: "circulo",
    nombre: "3. Círculos con G2 y G3",
    explicacion: "Arcos: G2 gira en el sentido del reloj y G3 al revés. I y J dicen dónde está el centro, contado desde donde está la fresa.",
    material: { ancho: 100, largo: 100, alto: 10, cero: "centro" },
    fresa: { diametro: 6, tipo: "plana" },
    codigo: `%
(Ranura circular de 60 mm y un círculo de 20 mm. Cero al centro de la pieza)
G21 G90
M3 S18000
G0 Z5
G0 X30 Y0
G1 Z-3 F300
(Círculo completo: regresa al mismo punto, centro a -30 en X)
G2 X30 Y0 I-30 J0 F900
G0 Z5
G0 X10 Y0
G1 Z-5 F300
G3 X10 Y0 I-10 J0 F700
G0 Z5
(Medio arco con R)
G0 X-40 Y-40
G1 Z-2 F300
G2 X40 Y-40 R45 F900
G0 Z5
M5
M30
%`,
  },
  {
    id: "taladro",
    nombre: "4. Barrenos con G81",
    explicacion: "Un ciclo fijo: con una sola línea por agujero la máquina baja, perfora y regresa.",
    material: { ancho: 120, largo: 60, alto: 12, cero: "esquina" },
    fresa: { diametro: 5, tipo: "plana" },
    codigo: `%
(4 barrenos pasados de 5 mm en tablero de 12 mm)
G21 G90
M3 S12000
G0 Z10
G98 G81 X20 Y30 Z-13 R2 F400
X50
X80
X100
G80
G0 Z10
M5
M30
%`,
  },
  {
    id: "grabado",
    nombre: "5. Grabado en V: letra H",
    explicacion: "Una fresa en V graba más ancho entre más baja. Aquí se graba la letra H a 1.5 mm.",
    material: { ancho: 80, largo: 80, alto: 6, cero: "esquina" },
    fresa: { diametro: 6.35, tipo: "v", angulo: 60 },
    codigo: `%
(Letra H grabada con fresa en V de 60 grados)
G21 G90
M3 S20000
G0 Z3
G0 X20 Y15
G1 Z-1.5 F200
G1 Y65 F800
G0 Z3
G0 X60 Y15
G1 Z-1.5 F200
G1 Y65 F800
G0 Z3
G0 X20 Y40
G1 Z-1.5 F200
G1 X60 F800
G0 Z3
M5
M30
%`,
  },
  {
    id: "errores",
    nombre: "6. Encuentra los errores",
    explicacion: "Este programa tiene 3 errores típicos. Simúlalo, lee las alarmas y corrígelo hasta que corra limpio.",
    material: { ancho: 100, largo: 60, alto: 9, cero: "esquina" },
    fresa: { diametro: 6, tipo: "plana" },
    codigo: `%
(Programa con errores para practicar)
G21 G90
G0 Z5
G0 X10 Y10
(Error 1: baja a cortar sin encender el husillo)
G1 Z-3 F300
M3 S18000
G1 X90 F1000
G0 Y50
(Error 2: el rápido de arriba cruzó dentro del material)
G1 X10
G0 Z5
(Error 3: arco con el centro mal puesto)
G0 X30 Y30
G1 Z-2
G2 X50 Y30 I5 J0
G0 Z5
M5
M30
%`,
  },
]
