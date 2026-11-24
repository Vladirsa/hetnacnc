// Programas de ejemplo del Simulador de torno CNC (escritos por HETNA para practicar).
// Estilo Fanuc, en milímetros: X en diámetro, Z0 en la cara de la pieza, G99 (mm por vuelta).
import type { Barra, Inserto } from "./torno"

export type EjemploTorno = { id: string; nombre: string; explicacion: string; barra: Barra; inserto: Inserto; codigo: string }

export const EJEMPLOS_TORNO: EjemploTorno[] = [
  {
    id: "cilindrado",
    nombre: "1. Refrentado y cilindrado",
    explicacion: "Lo básico del torno: limpiar la cara (refrentar) y bajar el diámetro de 40 a 34 mm en dos pasadas. X siempre es diámetro.",
    barra: { diametro: 40, largo: 80 },
    inserto: { radioPunta: 0.4 },
    codigo: `%
(Refrentado y cilindrado: de diámetro 40 a 34 en 30 mm de largo)
G21 G99
T0101
G97 S1200 M3
G0 X42 Z2
(Refrentado: limpia la cara hasta el centro)
G0 X42 Z0
G1 X-1 F0.15
G0 Z2
(Primera pasada a diámetro 37)
G0 X37
G1 Z-30 F0.25
G1 X42
G0 Z2
(Segunda pasada a diámetro 34)
G0 X34
G1 Z-30 F0.2
G1 X42
G0 X100 Z50
M5
M30
%`,
  },
  {
    id: "g90",
    nombre: "2. Ciclo de cilindrado G90",
    explicacion: "En torno, G90 es un ciclo: con una sola línea entra, corta hasta Z, sale y regresa. Para la siguiente pasada sólo cambias X.",
    barra: { diametro: 40, largo: 80 },
    inserto: { radioPunta: 0.4 },
    codigo: `%
(Desbaste con el ciclo G90: de diámetro 40 a 28 en 40 mm)
G21 G99
T0101
G97 S1100 M3
G0 X42 Z2
G90 X37 Z-40 F0.25
X34
X31
X28
G0 X100 Z50
M5
M30
%`,
  },
  {
    id: "g94",
    nombre: "3. Refrentado con ciclo G94",
    explicacion: "G94 es el ciclo para refrentar: corta de afuera hacia el centro. Cada línea baja 1 mm en Z.",
    barra: { diametro: 40, largo: 80 },
    inserto: { radioPunta: 0.4 },
    codigo: `%
(Refrentado de 3 mm en tres pasadas con G94)
G21 G99
T0101
G96 S180 M3
G50 S2500
G0 X44 Z2
G94 X-1 Z-1 F0.15
Z-2
Z-3
G0 X100 Z50
M5
M30
%`,
  },
  {
    id: "perfil",
    nombre: "4. Perfil con chaflán y radio",
    explicacion: "Desbaste con G90 y luego el perfil de acabado: chaflán de 1 mm, diámetro 20, radio de 3 mm (G2) y escalón a diámetro 30.",
    barra: { diametro: 40, largo: 80 },
    inserto: { radioPunta: 0.4 },
    codigo: `%
(Perfil: chaflán 1x45, diámetro 20 x 15, radio 3, diámetro 30 x 35)
G21 G99
T0101
G96 S200 M3
G50 S2500
G0 X42 Z2
(Desbaste del diámetro 30)
G90 X36 Z-35 F0.25
X32
X30.5
(Desbaste del diámetro 20, sin entrar a la zona del radio)
G90 X26 Z-14.5 F0.25
X22 Z-13
X20.5 Z-12
G0 X100 Z50
(Acabado del perfil)
T0202
G0 X16 Z2
G1 X18 Z0 F0.1
G1 X20 Z-1
G1 Z-12
G2 X26 Z-15 R3
G1 X30
G1 Z-35
G1 X42
G0 X100 Z50
M5
M30
%`,
  },
  {
    id: "errores-torno",
    nombre: "5. Encuentra los errores (torno)",
    explicacion: "Este programa tiene 3 errores típicos del torno. Simúlalo, lee las alarmas y corrígelo hasta que corra limpio.",
    barra: { diametro: 40, largo: 80 },
    inserto: { radioPunta: 0.4 },
    codigo: `%
(Programa de torno con errores para practicar)
G21 G99
T0101
G97 S1000
G0 X42 Z2
G0 X36
(Error 1: corta sin encender el husillo)
G1 Z-20 F0.2
G0 X42
G0 Z2
M3
(Error 2: rápido directo contra la pieza)
G0 X30 Z-10
G1 Z-20
G0 X42 Z2
G0 X26
G1 Z-5
(Error 3: arco con el centro mal puesto)
G2 X30 Z-8 I5 K0
G0 X100 Z50
M30
%`,
  },
]
