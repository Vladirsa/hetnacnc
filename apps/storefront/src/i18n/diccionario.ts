// Diccionario completo español -> inglés: el de src/i18n/en.ts más los archivos
// de cada fase de la traducción (en-fase*.ts, en-meta*.ts). Se separan en
// archivos chicos para poder subirlos y revisarlos sin tocar el grande.
// Lo cargan el servidor (i18n/servidor.ts), <T>/useT y el Traductor del navegador.
import { EN as EN_BASE, REGLAS as REGLAS_BASE } from "./en"
import { EN_FASE1, REGLAS_FASE1 } from "./en-fase1"

export const EN: Record<string, string> = {
  ...EN_FASE1,
  // Lo de en.ts manda si una frase está en los dos
  ...EN_BASE,
}

export const REGLAS: [RegExp, string][] = [...REGLAS_BASE, ...REGLAS_FASE1]
