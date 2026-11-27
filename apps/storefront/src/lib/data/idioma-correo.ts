'use server';

// Idioma de los correos del cliente (packages/api/src/lib/idioma-correo.ts).
// Se avisa al servidor en momentos que el cliente elige: al entrar, al crear su
// cuenta y al poner su correo en el pago. Nunca falla hacia afuera.
import { idiomaServidor } from '@/i18n/servidor';

import { getAuthHeaders, getCartId } from './cookies';

const BACKEND = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const LLAVE = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string;

export async function avisarIdiomaCorreo(opciones: { conCarrito?: boolean } = {}): Promise<void> {
  try {
    const idioma = await idiomaServidor();
    const cart_id = opciones.conCarrito ? await getCartId() : undefined;
    await fetch(`${BACKEND}/store/hetna-idioma`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'x-publishable-api-key': LLAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idioma, ...(cart_id ? { cart_id } : {}) }),
      cache: 'no-store'
    });
  } catch {
    // El idioma de los correos es un extra: nunca debe tumbar el registro ni el pago
  }
}
