import { createClient, InferClient } from '@mercurjs/client';

type Routes = Record<string, unknown>;

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';

// Límite de espera de cada consulta al API. Sin él, mientras el API arranca
// (despliegue) o se atora, la tienda se quedaba esperando: k6 midió una ficha
// de 24.6 s de puro tiempo de servidor (12 nov 2026). Con límite, la consulta
// falla rápido y entra el respaldo: la copia guardada de la ficha
// (lib/data/products.ts) o la copia de nginx (proxy_cache_use_stale).
// 5 s sobra para una consulta normal (100-500 ms) aun con el VPS cargado; una
// página hace varias seguidas, así que el límite por consulta se suma.
const LIMITE_API_MS = 5000;

export const sdk: InferClient<Routes> = createClient({
  baseUrl: MEDUSA_BACKEND_URL,
  fetchOptions: {
    headers: {
      'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
    },
    // Getter y no un valor: @mercurjs/client copia estas opciones en cada
    // petición, así que cada una estrena su propio reloj. Un AbortSignal fijo
    // vencería 5 s después de arrancar el servidor y cancelaría todo.
    // Una consulta que pase su propio signal reemplaza éste.
    get signal() {
      return AbortSignal.timeout(LIMITE_API_MS);
    },
  },
});
