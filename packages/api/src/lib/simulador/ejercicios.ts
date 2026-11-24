// Ejercicios calificados del Simulador CNC (Academia HETNA).
//
// Cada ejercicio trae el material, la herramienta, el enunciado con medidas y
// la SOLUCIÓN de referencia. La solución vive sólo en el servidor: se usa para
// sacar la pieza objetivo y comparar la del alumno (lib/simulador/calificar.ts).
// Se califica la PIEZA, no el programa: cualquier estrategia que deje la misma
// pieza sin errores aprueba.
//
// Si cambias la solución o el material de un ejercicio, sube su `version`: los
// aprobados de la versión anterior siguen contando, pero el alumno ve que cambió.
import type { Material } from "./gcode"
import type { Fresa } from "./material"
import type { Barra, Inserto } from "./torno"

type Base = { id: string; version: number; titulo: string; nivel: "básico" | "intermedio"; enunciado: string[]; pista: string; solucion: string }
export type EjercicioFresa = Base & { maquina: "fresadora"; material: Material; fresa: Fresa }
export type EjercicioTorno = Base & { maquina: "torno"; barra: Barra; inserto: Inserto }
export type Ejercicio = EjercicioFresa | EjercicioTorno

export const EJERCICIOS: Ejercicio[] = [
  {
    id: "f1-contorno",
    version: 1,
    maquina: "fresadora",
    nivel: "básico",
    titulo: "Contorno rectangular",
    material: { ancho: 120, largo: 80, alto: 9, cero: "esquina" },
    fresa: { diametro: 6, tipo: "plana" },
    enunciado: [
      "Material: MDF de 120 × 80 × 9 mm. Cero en la esquina inferior izquierda, Z0 en la cara de arriba.",
      "Fresa plana de 6 mm.",
      "Corta una ranura rectangular siguiendo, con el CENTRO de la fresa, el rectángulo de X10 Y10 a X110 Y70.",
      "Profundidad final: 6 mm (Z-6). Bájala en dos pasadas o más: la fresa no debe bajar más de 3 mm por pasada.",
    ],
    pista: "Enciende el husillo (M3 S…), acércate con G0 por arriba, baja con G1 y un avance F, y recorre las 4 esquinas.",
    solucion: `G21 G90
M3 S18000
G0 Z5
G0 X10 Y10
G1 Z-3 F300
G1 X110 F1200
G1 Y70
G1 X10
G1 Y10
G1 Z-6 F300
G1 X110 F1200
G1 Y70
G1 X10
G1 Y10
G0 Z5
M5
M30`,
  },
  {
    id: "f2-bolsillo-redondo",
    version: 1,
    maquina: "fresadora",
    nivel: "intermedio",
    titulo: "Bolsillo redondo",
    material: { ancho: 100, largo: 80, alto: 12, cero: "esquina" },
    fresa: { diametro: 6, tipo: "plana" },
    enunciado: [
      "Material: 100 × 80 × 12 mm. Cero en la esquina inferior izquierda, Z0 arriba.",
      "Fresa plana de 6 mm.",
      "Vacía un bolsillo redondo de 40 mm de DIÁMETRO (la orilla del hueco, no el centro de la fresa) y 3 mm de profundidad.",
      "Centro del bolsillo: X50 Y40. El fondo debe quedar parejo, sin crestas.",
    ],
    pista: "La orilla del hueco está a 20 mm del centro: el centro de la fresa debe llegar a 17 mm. Haz círculos de adentro hacia afuera con un paso menor a 6 mm.",
    solucion: `G21 G90
M3 S16000
G0 Z5
G0 X50 Y40
G1 Z-3 F200
G1 X53 F900
G2 X53 Y40 I-3 J0
G1 X56
G2 X56 Y40 I-6 J0
G1 X60
G2 X60 Y40 I-10 J0
G1 X64
G2 X64 Y40 I-14 J0
G1 X67
G2 X67 Y40 I-17 J0
G0 Z5
M5
M30`,
  },
  {
    id: "f3-barrenos",
    version: 1,
    maquina: "fresadora",
    nivel: "básico",
    titulo: "Cuatro barrenos pasados",
    material: { ancho: 100, largo: 60, alto: 12, cero: "esquina" },
    fresa: { diametro: 6, tipo: "plana" },
    enunciado: [
      "Material: tablero de 100 × 60 × 12 mm. Cero en la esquina inferior izquierda, Z0 arriba.",
      "Fresa plana de 6 mm (hace barrenos de 6 mm).",
      "Haz 4 barrenos que atraviesen el tablero (hasta Z-13) en X15 Y15, X85 Y15, X85 Y45 y X15 Y45.",
    ],
    pista: "Puedes usar el ciclo G81 (X… Y… Z-13 R2 F…) o bajar con G1 en cada punto. Sube siempre antes de moverte al siguiente.",
    solucion: `G21 G90
M3 S12000
G0 Z10
G98 G81 X15 Y15 Z-13 R2 F400
X85
Y45
X15
G80
G0 Z10
M5
M30`,
  },
  {
    id: "f4-ranura-arco",
    version: 1,
    maquina: "fresadora",
    nivel: "intermedio",
    titulo: "Ranura en medio círculo",
    material: { ancho: 100, largo: 60, alto: 9, cero: "esquina" },
    fresa: { diametro: 6, tipo: "plana" },
    enunciado: [
      "Material: 100 × 60 × 9 mm. Cero en la esquina inferior izquierda, Z0 arriba.",
      "Fresa plana de 6 mm.",
      "Corta una ranura de 2 mm de profundidad que siga, con el centro de la fresa, MEDIO círculo de radio 30 con centro en X50 Y15.",
      "La ranura va de X20 Y15 a X80 Y15 pasando por arriba (por X50 Y45).",
    ],
    pista: "De X20 Y15 a X80 Y15 por arriba es en el sentido del reloj: G2 con R30, o con I30 J0.",
    solucion: `G21 G90
M3 S18000
G0 Z5
G0 X20 Y15
G1 Z-2 F250
G2 X80 Y15 R30 F900
G0 Z5
M5
M30`,
  },
  {
    id: "t1-cilindrado",
    version: 1,
    maquina: "torno",
    nivel: "básico",
    titulo: "Cilindrado a diámetro 30",
    barra: { diametro: 40, largo: 80 },
    inserto: { radioPunta: 0.4 },
    enunciado: [
      "Barra de diámetro 40, 80 mm fuera del chuck. Z0 en la cara de la pieza. X se programa en diámetro.",
      "Inserto con radio de punta 0.4 mm.",
      "Deja la pieza en diámetro 30 desde la cara (Z0) hasta Z-25. El resto queda en diámetro 40.",
      "Quita el material en pasadas de no más de 2.5 mm por lado (5 mm en diámetro).",
    ],
    pista: "Acércate con G0 a X42 Z2. Puedes usar el ciclo G90 (X35 Z-25 F0.25, luego X30) o pasadas con G1.",
    solucion: `G21 G99
T0101
G97 S1200 M3
G0 X42 Z2
G90 X35 Z-25 F0.25
X30
G0 X100 Z50
M5
M30`,
  },
  {
    id: "t2-escalones",
    version: 1,
    maquina: "torno",
    nivel: "intermedio",
    titulo: "Pieza con dos escalones",
    barra: { diametro: 40, largo: 80 },
    inserto: { radioPunta: 0.4 },
    enunciado: [
      "Barra de diámetro 40, 80 mm fuera del chuck. Z0 en la cara. X en diámetro.",
      "Inserto con radio de punta 0.4 mm.",
      "Escalón 1: diámetro 32 desde Z0 hasta Z-40.",
      "Escalón 2: diámetro 24 desde Z0 hasta Z-20.",
    ],
    pista: "Primero el escalón largo (diámetro 32 hasta Z-40) y después el corto. Con G90 sólo cambias X y Z en cada pasada.",
    solucion: `G21 G99
T0101
G96 S180 M3
G50 S2500
G0 X42 Z2
G90 X36 Z-40 F0.25
X32
G90 X28 Z-20 F0.25
X24
G0 X100 Z50
M5
M30`,
  },
  {
    id: "t3-perfil",
    version: 1,
    maquina: "torno",
    nivel: "intermedio",
    titulo: "Perfil con chaflán y radio",
    barra: { diametro: 40, largo: 80 },
    inserto: { radioPunta: 0.4 },
    enunciado: [
      "Barra de diámetro 40, 80 mm fuera del chuck. Z0 en la cara. X en diámetro.",
      "Inserto con radio de punta 0.4 mm.",
      "Chaflán de 1 × 45° en la cara: de diámetro 18 en Z0 a diámetro 20 en Z-1.",
      "Diámetro 20 hasta Z-12, luego un radio de 3 mm (cóncavo) que sube al hombro en diámetro 26 a Z-15.",
      "Hombro: de diámetro 26 a 30 en Z-15. Diámetro 30 hasta Z-35.",
    ],
    pista: "Desbasta con G90 sin entrar a la zona del radio y termina con un pase de acabado: G1 al chaflán, G1 Z-12, G2 X26 Z-15 R3, G1 X30, G1 Z-35.",
    solucion: `G21 G99
T0101
G96 S200 M3
G50 S2500
G0 X42 Z2
G90 X36 Z-35 F0.25
X32
X30.5
G90 X26 Z-14.5 F0.25
X22 Z-13
X20.5 Z-12
G0 X100 Z50
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
M30`,
  },
]

export const ejercicioPorId = (id: string) => EJERCICIOS.find((e) => e.id === id)
