// Diccionario completo español -> inglés: el de src/i18n/en.ts más los archivos
// de cada fase de la traducción (en-fase*.ts). La metadata (en-meta-*.ts) sólo
// la carga el servidor (diccionario-servidor.ts), salvo en-meta-cliente.ts. Se separan en
// archivos chicos para poder subirlos y revisarlos sin tocar el grande.
// Lo cargan el servidor (i18n/servidor.ts), <T>/useT y el Traductor del navegador.
import { EN as EN_BASE, REGLAS as REGLAS_BASE } from "./en"
import { EN_FASE1, REGLAS_FASE1 } from "./en-fase1"
import { EN_META_CLIENTE } from "./en-meta-cliente"
import { EN_FASE2_A } from "./en-fase2-a"
import { EN_FASE2_B } from "./en-fase2-b"
import { EN_FASE2_C } from "./en-fase2-c"
import { EN_FASE2_D } from "./en-fase2-d"
import { EN_FASE2_E } from "./en-fase2-e"
import { EN_FASE3, REGLAS_FASE3 } from "./en-fase3"
import { EN_FASE4_A } from "./en-fase4-a"
import { EN_FASE4_B } from "./en-fase4-b"
import { EN_FASE4_C } from "./en-fase4-c"
import { EN_FASE4_D } from "./en-fase4-d"
import { EN_FASE4_E } from "./en-fase4-e"
import { EN_FASE4_F } from "./en-fase4-f"

export const EN: Record<string, string> = {
  ...EN_FASE1,
  ...EN_META_CLIENTE,
  ...EN_FASE2_A,
  ...EN_FASE2_B,
  ...EN_FASE2_C,
  ...EN_FASE2_D,
  ...EN_FASE2_E,
  ...EN_FASE3,
  ...EN_FASE4_A,
  ...EN_FASE4_B,
  ...EN_FASE4_C,
  ...EN_FASE4_D,
  ...EN_FASE4_E,
  ...EN_FASE4_F,
  // Lo de en.ts manda si una frase está en los dos
  ...EN_BASE,
}

export const REGLAS: [RegExp, string][] = [...REGLAS_BASE, ...REGLAS_FASE1, ...REGLAS_FASE3]
