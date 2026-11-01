'use server';

import { HttpTypes } from '@medusajs/types';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

import { sdk } from '../client';
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken
} from './cookies';

export const retrieveCustomer = async (): Promise<HttpTypes.StoreCustomer | null> => {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders) return null;

  const headers = {
    ...authHeaders
  };

  const next = {
    ...(await getCacheOptions('customers'))
  };

  return await (sdk.store.customers.me
    .query({
      fields: '*orders',
      fetchOptions: { headers, next, cache: 'force-cache' }
    } as never) as unknown as Promise<{ customer: HttpTypes.StoreCustomer }>)
    .then(({ customer }) => customer ?? null)
    .catch(() => null);
};

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders())
  };

  const updateRes = await sdk.store.customers.me
    .mutate({ ...body, fetchOptions: { headers } })
    .then(({ customer }) => customer)
    .catch(err => {
      throw new Error(err.message);
    });

  const cacheTag = await getCacheTag('customers');
  revalidateTag(cacheTag);

  return updateRes;
};

// ── Registro e inicio de sesión ──────────────────────────────────────────────
// En Medusa la cuenta son dos cosas: la "identidad" (correo + contraseña) y el
// "cliente" (nombre, teléfono, pedidos). Si el registro se corta entre las dos
// (se reinició el servidor, se cayó la conexión), queda una identidad sin
// cliente: el correo "ya existe" para registrarse, pero al entrar la cuenta no
// sirve y la tienda vuelve a pedir iniciar sesión. Las funciones de abajo
// reparan ese caso solas: entran con la contraseña y crean el cliente que faltó.

const entrarConCorreo = (email: string, password: string) =>
  (sdk.auth.$actorType.$authProvider
    .mutate({ $actorType: 'customer', $authProvider: 'emailpass', email, password } as never) as unknown as Promise<{ token: string }>)
    .then(({ token }) => token);

const clienteDeLaSesion = async (): Promise<HttpTypes.StoreCustomer | null> => {
  const headers = { ...(await getAuthHeaders()) };
  return (sdk.store.customers.me.query({ fetchOptions: { headers, cache: 'no-store' } } as never) as unknown as Promise<{
    customer: HttpTypes.StoreCustomer;
  }>)
    .then(({ customer }) => customer ?? null)
    .catch(() => null);
};

/** Con la sesión ya puesta: si no hay cliente, lo crea y vuelve a entrar para que el token lo incluya. */
async function asegurarCliente(
  email: string,
  password: string,
  datos: { first_name?: string; last_name?: string; phone?: string }
): Promise<HttpTypes.StoreCustomer | null> {
  const existente = await clienteDeLaSesion();
  if (existente) return existente;

  const headers = { ...(await getAuthHeaders()) };
  const { customer } = await (sdk.store.customers.mutate({
    email,
    ...datos,
    fetchOptions: { headers }
  } as never) as unknown as Promise<{ customer: HttpTypes.StoreCustomer }>);

  // El token de antes no traía al cliente: uno nuevo que sí
  await setAuthToken(await entrarConCorreo(email, password));
  return customer;
}

const mensajeDeError = (e: unknown) => String((e as Error)?.message || e || '');

// ── Confirmación de correo (packages/api/src/lib/verificar-correo.ts) ─────────
// Las cuentas nuevas no quedan con sesión hasta confirmar su correo.
const BACKEND = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const LLAVE = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string;

/** Con la sesión puesta: true si la cuenta todavía no confirma su correo. */
async function faltaConfirmar(): Promise<boolean> {
  try {
    const r = await fetch(`${BACKEND}/store/verificacion`, {
      headers: { ...(await getAuthHeaders()), 'x-publishable-api-key': LLAVE },
      cache: 'no-store'
    });
    if (!r.ok) return false;
    return Boolean(((await r.json()) as { requiere?: boolean }).requiere);
  } catch {
    return false;
  }
}

/** Vuelve a mandar la liga de confirmación (el servidor no dice si el correo existe). */
export async function reenviarConfirmacion(email: string): Promise<void> {
  await fetch(`${BACKEND}/hooks/verificar-correo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim().toLowerCase() }),
    cache: 'no-store'
  }).catch(() => undefined);
}

/**
 * Recomienda y gana: si llegó con la liga de un amigo (cookie hetna_ref, la
 * pone middleware.ts), liga la cuenta nueva con él. Nunca detiene el registro.
 */
async function vincularRecomendacion(): Promise<void> {
  try {
    const { cookies } = await import('next/headers');
    const tarro = await cookies();
    const codigo = tarro.get('hetna_ref')?.value;
    if (!codigo) return;
    await fetch(`${BACKEND}/store/hetna-recomienda/vincular`, {
      method: 'POST',
      headers: {
        ...(await getAuthHeaders()),
        'x-publishable-api-key': LLAVE,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ codigo }),
      cache: 'no-store'
    });
    tarro.delete('hetna_ref');
  } catch {
    // sin recomendación no pasa nada
  }
}

export async function signup(formData: FormData) {
  const password = formData.get('password') as string;
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const datos = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    phone: formData.get('phone') as string
  };

  try {
    let token: string;
    try {
      token = await (sdk.auth.$actorType.$authProvider.register
        .mutate({
          $actorType: 'customer',
          $authProvider: 'emailpass',
          email,
          password
        } as never) as unknown as Promise<{ token: string }>)
        .then(({ token }) => token);
    } catch (e) {
      if (!/already exists/i.test(mensajeDeError(e))) throw e;
      // El correo ya tiene identidad: puede ser un registro que se quedó a
      // medias. Con la misma contraseña se entra y se termina.
      try {
        token = await entrarConCorreo(email, password);
      } catch {
        return 'Ese correo ya tiene una cuenta. Inicia sesión o usa "¿Olvidaste tu contraseña?".';
      }
    }

    await setAuthToken(token);
    const cliente = await asegurarCliente(email, password, datos);
    await vincularRecomendacion();

    // Cuenta nueva: sin sesión hasta que confirme su correo (la liga ya va en
    // camino; si es una cuenta que ya existía sin confirmar, se reenvía).
    if (await faltaConfirmar()) {
      await removeAuthToken();
      await reenviarConfirmacion(email);
      return { verificar: email };
    }

    const customerCacheTag = await getCacheTag('customers');
    revalidateTag(customerCacheTag);
    await transferCart().catch(() => undefined);

    return cliente;
  } catch (error: unknown) {
    return mensajeDeError(error) || 'No se pudo crear la cuenta. Intenta de nuevo.';
  }
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = formData.get('password') as string;

  try {
    await setAuthToken(await entrarConCorreo(email, password));
    // Cuenta que quedó a medias (identidad sin cliente): se completa aquí
    await asegurarCliente(email, password, {}).catch(() => null);

    if (await faltaConfirmar()) {
      await removeAuthToken();
      await reenviarConfirmacion(email);
      return {
        success: false,
        verificar: true,
        message: `Primero confirma tu correo: te mandamos una liga a ${email}. Revisa también spam o promociones.`
      };
    }

    const customerCacheTag = await getCacheTag('customers');
    revalidateTag(customerCacheTag);

    return { success: true };
  } catch (error: unknown) {
    const m = mensajeDeError(error);
    return {
      success: false,
      message: /invalid email or password|unauthorized/i.test(m)
        ? 'Correo o contraseña incorrectos.'
        : m || 'No se pudo iniciar sesión. Intenta de nuevo.'
    };
  }
}

export async function signout() {
  await removeAuthToken();

  const customerCacheTag = await getCacheTag('customers');
  revalidateTag(customerCacheTag);

  await removeCartId();

  const cartCacheTag = await getCacheTag('carts');
  revalidateTag(cartCacheTag);
  redirect(`/`);
}

export async function transferCart() {
  const cartId = await getCartId();

  if (!cartId) {
    return;
  }

  const headers = await getAuthHeaders();

  await sdk.store.carts.$id.customer.mutate({ $id: cartId, fetchOptions: { headers } });

  const cartCacheTag = await getCacheTag('carts');
  revalidateTag(cartCacheTag);
}

export const addCustomerAddress = async (formData: FormData): Promise<any> => {
  const address = {
    address_name: formData.get('address_name') as string,
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    company: formData.get('company') as string,
    address_1: formData.get('address_1') as string,
    city: formData.get('city') as string,
    postal_code: formData.get('postal_code') as string,
    country_code: formData.get('country_code') as string,
    phone: formData.get('phone') as string,
    province: formData.get('province') as string,
    is_default_billing: Boolean(formData.get('isDefaultBilling')),
    is_default_shipping: Boolean(formData.get('isDefaultShipping'))
  };

  const headers = {
    ...(await getAuthHeaders())
  };

  return (sdk.store.customers.me.addresses
    .mutate({ ...address, fetchOptions: { headers } } as never) as unknown as Promise<unknown>)
    .then(async () => {
      const customerCacheTag = await getCacheTag('customers');
      revalidateTag(customerCacheTag);
      return { success: true, error: null };
    })
    .catch(err => {
      return { success: false, error: err.toString() };
    });
};

export const deleteCustomerAddress = async (addressId: string): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders())
  };

  await (sdk.store.customers.me.addresses.$addressId
    .delete({ $addressId: addressId, fetchOptions: { headers } } as never) as unknown as Promise<unknown>)
    .then(async () => {
      const customerCacheTag = await getCacheTag('customers');
      revalidateTag(customerCacheTag);
      return { success: true, error: null };
    })
    .catch(err => {
      return { success: false, error: err.toString() };
    });
};

export const updateCustomerAddress = async (formData: FormData): Promise<any> => {
  const addressId = formData.get('addressId') as string;

  if (!addressId) {
    return { success: false, error: 'Address ID is required' };
  }

  const address = {
    address_name: formData.get('address_name') as string,
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    company: formData.get('company') as string,
    address_1: formData.get('address_1') as string,
    address_2: formData.get('address_2') as string,
    city: formData.get('city') as string,
    postal_code: formData.get('postal_code') as string,
    province: formData.get('province') as string,
    country_code: formData.get('country_code') as string
  } as HttpTypes.StoreUpdateCustomerAddress;

  const phone = formData.get('phone') as string;

  if (phone) {
    address.phone = phone;
  }

  const headers = {
    ...(await getAuthHeaders())
  };

  return (sdk.store.customers.me.addresses.$addressId
    .mutate({ $addressId: addressId, ...address, fetchOptions: { headers } } as never) as unknown as Promise<unknown>)
    .then(async () => {
      const customerCacheTag = await getCacheTag('customers');
      revalidateTag(customerCacheTag);
      return { success: true, error: null };
    })
    .catch(err => {
      return { success: false, error: err.toString() };
    });
};

export const updateCustomerPassword = async (password: string, token: string): Promise<any> => {
  const res = await (sdk.auth.$actorType.$authProvider.update
    .mutate({
      $actorType: 'customer',
      $authProvider: 'emailpass',
      password,
      fetchOptions: { headers: { authorization: `Bearer ${token}` } }
    } as never) as unknown as Promise<unknown>)
    .then(async () => {
      await removeAuthToken();
      const customerCacheTag = await getCacheTag('customers');
      revalidateTag(customerCacheTag);
      return { success: true, error: null };
    })
    .catch((err: any) => {
      return { success: false, error: err.toString() };
    });

  return res;
};

// Con fetch directo: Medusa contesta 201 sin cuerpo y el cliente tipado lo
// tomaba como error aunque el correo sí se mandaba (por eso no salía el aviso).
export const sendResetPasswordEmail = async (email: string) => {
  try {
    const r = await fetch(`${BACKEND}/auth/customer/emailpass/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email }),
      cache: 'no-store'
    });
    return r.ok ? { success: true, error: null } : { success: false, error: `HTTP ${r.status}` };
  } catch (err: unknown) {
    return { success: false, error: String(err) };
  }
};
