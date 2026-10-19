'use server';

import { HttpTypes } from '@medusajs/types';
import { revalidateTag } from 'next/cache';

import { sdk } from '../client';
import { getAuthHeaders, getCacheTag } from './cookies';

// Crea (o renueva) la sesión de pago de Mercado Pago del carrito.
// El backend genera la preferencia y devuelve la liga de pago en session.data.checkout_url.
export async function iniciarMercadoPago(
  cart: HttpTypes.StoreCart,
  providerId: string,
  returnUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const headers = {
    ...(await getAuthHeaders())
  };

  try {
    let paymentCollection = cart.payment_collection;

    if (!paymentCollection) {
      const { payment_collection } = await (sdk.store.paymentCollections.mutate({
        cart_id: cart.id,
        fetchOptions: { headers }
      } as never) as unknown as Promise<{ payment_collection: HttpTypes.StorePaymentCollection }>);
      paymentCollection = payment_collection;
    }

    await (sdk.store.paymentCollections.$id.paymentSessions.mutate({
      $id: paymentCollection!.id,
      provider_id: providerId,
      data: {
        cart_id: cart.id,
        email: cart.email,
        return_url: returnUrl
      },
      fetchOptions: { headers }
    } as never) as unknown as Promise<unknown>);

    const cartCacheTag = await getCacheTag('carts');
    revalidateTag(cartCacheTag);

    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'No se pudo preparar el pago con Mercado Pago. Intenta de nuevo.'
    };
  }
}
