'use server';

// Para componentes de cliente (p. ej. el carrito vacío): categories.ts usa el
// idioma del servidor (next/headers), así que no puede ir al navegador. Esta
// acción de servidor lo llama del lado del servidor.
import { listCategories } from './categories';

export async function listCategoriesAccion() {
  return listCategories();
}
