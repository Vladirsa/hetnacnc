// Portadas del carrusel principal, administradas desde /dashboard → Portadas.
// Si el backend no responde o no hay portadas, la página usa las portadas fijas del código.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';

export type PortadaTienda = {
  id: string;
  etiqueta: string;
  titulo: string;
  texto: string;
  imagen_url: string | null;
  boton1_texto: string | null;
  boton1_url: string | null;
  boton2_texto: string | null;
  boton2_url: string | null;
};

export async function listarPortadas(): Promise<PortadaTienda[]> {
  try {
    const respuesta = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna/portadas`, {
      headers: {
        'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ''
      },
      // Revisa cada minuto: así una portada nueva, programada o vencida cambia sola
      next: { revalidate: 60, tags: ['portadas'] }
    });
    if (!respuesta.ok) return [];
    const datos = (await respuesta.json()) as { portadas?: PortadaTienda[] };
    return Array.isArray(datos.portadas) ? datos.portadas : [];
  } catch {
    return [];
  }
}
