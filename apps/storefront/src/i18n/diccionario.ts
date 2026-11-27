// Diccionario completo español -> inglés: el de src/i18n/en.ts más los archivos
// de cada fase de la traducción (en-fase*.ts, en-meta*.ts). Se separan en
// archivos chicos para poder subirlos y revisarlos sin tocar el grande.
// Lo cargan el servidor (i18n/servidor.ts), <T>/useT y el Traductor del navegador.
import { EN as EN_BASE, REGLAS as REGLAS_BASE } from "./en"
import { EN_FASE1, REGLAS_FASE1 } from "./en-fase1"
import { EN_FASE2_A } from "./en-fase2-a"
import { EN_FASE2_B } from "./en-fase2-b"
import { EN_FASE2_C } from "./en-fase2-c"
import { EN_FASE2_D } from "./en-fase2-d"
import { EN_FASE2_E } from "./en-fase2-e"
import { EN_META_A } from "./en-meta-a"
import { EN_META_B } from "./en-meta-b"
import { EN_META_C } from "./en-meta-c"
import { EN_META_D } from "./en-meta-d"
import { EN_META_E } from "./en-meta-e"
import { EN_META_F } from "./en-meta-f"
import { EN_FASE3, REGLAS_FASE3 } from "./en-fase3"

export const EN: Record<string, string> = {
  ...EN_FASE1,
  ...EN_META_A,
  ...EN_META_B,
  ...EN_META_C,
  ...EN_META_D,
  ...EN_META_E,
  ...EN_META_F,
  ...EN_FASE2_A,
  ...EN_FASE2_B,
  ...EN_FASE2_C,
  ...EN_FASE2_D,
  ...EN_FASE2_E,
  ...EN_FASE3,
  // Lo de en.ts manda si una frase está en los dos
  ...EN_BASE,
}

export const REGLAS: [RegExp, string][] = [...REGLAS_BASE, ...REGLAS_FASE1, ...REGLAS_FASE3]
