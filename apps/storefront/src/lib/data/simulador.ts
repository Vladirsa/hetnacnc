'use server';

// Ejercicios calificados del Simulador CNC (API /store/simulador/*).
// La calificación se hace en el servidor: el navegador sólo manda el programa.
import { getAuthHeaders } from './cookies';

const API = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string;
const ID = /^[a-z0-9][a-z0-9-]{0,60}$/;

export type PlanoAlturas = { tipo: 'alturas'; nx: number; ny: number; celda: number; alturas: number[] };
export type PlanoPerfil = { tipo: 'perfil'; paso: number; radios: number[] };
export type EjercicioSim = {
  id: string;
  version: number;
  maquina: 'fresadora' | 'torno';
  nivel: string;
  titulo: string;
  enunciado: string[];
  pista: string;
  material?: { ancho: number; largo: number; alto: number; cero: 'esquina' | 'centro' };
  fresa?: { diametro: number; tipo: 'plana' | 'bola' | 'v'; angulo?: number };
  barra?: { diametro: number; largo: number };
  inserto?: { radioPunta: number };
  plano: PlanoAlturas | PlanoPerfil;
  abierto: boolean;
  resultado: { mejor: number; intentos: number; aprobado: boolean; version: number } | null;
};
export type ListaSim = { cobro: { curso: string; gratis: number; inscrito: boolean } | null; ejercicios: EjercicioSim[]; sesion: boolean };
export type Defecto = { cantidad: number; peor: number; donde: string };
export type CalificacionSim = {
  aprobado: boolean;
  calificacion: number;
  errores: { linea: number; mensaje: string }[];
  sobrecorte: Defecto;
  falta: Defecto;
  mensaje: string;
  mejor: number;
  intentos: number;
};
export type ConstanciaSim = { folio: string; alumno: string; fecha: string; promedio: number; ejercicios: { titulo: string; maquina: string }[] };

const auth = async () => ((await getAuthHeaders().catch(() => ({}))) as { authorization?: string });

export const listarEjerciciosSim = async (): Promise<ListaSim | null> => {
  const a = await auth();
  try {
    const r = await fetch(`${API}/store/simulador/ejercicios`, { headers: { 'x-publishable-api-key': PK, ...a }, cache: 'no-store' });
    if (!r.ok) return null;
    return { ...((await r.json()) as Omit<ListaSim, 'sesion'>), sesion: !!a.authorization };
  } catch {
    return null;
  }
};

export const calificarEjercicioSim = async (id: string, codigo: string): Promise<{ ok: true; r: CalificacionSim } | { ok: false; mensaje: string }> => {
  if (!ID.test(id)) return { ok: false, mensaje: 'Ejercicio inválido.' };
  const a = await auth();
  if (!a.authorization) return { ok: false, mensaje: 'Inicia sesión para calificar y guardar tu avance.' };
  try {
    const r = await fetch(`${API}/store/simulador/ejercicios/${id}/calificar`, {
      method: 'POST',
      headers: { 'x-publishable-api-key': PK, 'content-type': 'application/json', ...a },
      body: JSON.stringify({ codigo: String(codigo).slice(0, 100_000) }),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => ({}))) as CalificacionSim & { message?: string };
    return r.ok ? { ok: true, r: j } : { ok: false, mensaje: j.message || 'No se pudo calificar. Intenta de nuevo.' };
  } catch {
    return { ok: false, mensaje: 'No se pudo calificar. Intenta de nuevo.' };
  }
};

export const constanciaSim = async (): Promise<ConstanciaSim | null> => {
  const a = await auth();
  if (!a.authorization) return null;
  try {
    const r = await fetch(`${API}/store/simulador/certificado`, { headers: { 'x-publishable-api-key': PK, ...a }, cache: 'no-store' });
    return r.ok ? ((await r.json()) as ConstanciaSim) : null;
  } catch {
    return null;
  }
};
