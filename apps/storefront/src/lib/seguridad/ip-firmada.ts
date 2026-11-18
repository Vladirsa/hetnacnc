// IP del comprador, firmada, para las llamadas de la tienda al API (ver
// packages/api/src/lib/ip-firmada.ts). Sólo en el servidor de la tienda.
import 'server-only';

import { createHmac } from 'crypto';
import { headers } from 'next/headers';

/** Cabecera x-hetna-ip para pasarla en fetchOptions.headers; {} si no se puede. */
export async function cabeceraIpCliente(): Promise<Record<string, string>> {
  const s = process.env.REVALIDATE_SECRET || '';
  if (!s || s === 'supersecret' || s.length < 16) return {};
  try {
    const h = await headers();
    // nginx agrega la IP real al final de X-Forwarded-For (lo anterior lo pudo
    // escribir el propio visitante): se toma la última
    const xff = (h.get('x-forwarded-for') || '').split(',').map((x) => x.trim()).filter(Boolean);
    const ip = (xff[xff.length - 1] || h.get('x-real-ip') || '').replace(/^::ffff:/, '');
    if (!/^[0-9a-fA-F:.]{2,64}$/.test(ip)) return {};
    const ts = Math.floor(Date.now() / 1000);
    const firma = createHmac('sha256', s).update(`${ip}|${ts}`).digest('base64url');
    return { 'x-hetna-ip': `${ip}.${ts}.${firma}` };
  } catch {
    return {}; // fuera de una petición (build, tareas): sin IP
  }
}
