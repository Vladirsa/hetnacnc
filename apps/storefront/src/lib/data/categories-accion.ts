'use server';

// Puerta para componentes de cliente (p. ej. el carrito vacío): lib/data/categories
// lee el idioma con next/headers y no puede importarse desde el navegador.
import { listCategories } from './categories';

export async function listarCategoriasAccion() {
  const { categories } = await listCategories();
  return categories ?? [];
}
