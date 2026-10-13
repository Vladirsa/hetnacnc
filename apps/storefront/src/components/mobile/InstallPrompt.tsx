'use client';
import { useEffect, useState } from 'react';

const KEY = 'hetna-install-dismissed';
const VISITAS = 'hetna-visitas';
// El banner ya no sale al instante: espera a que el cliente lleve un rato
// navegando y solo desde su segunda visita (antes salia en cuanto abria la pagina).
const ESPERA_MS = 30_000;
const VISITAS_MINIMAS = 2;

export function InstallPrompt() {
  const [evt, setEvt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (standalone) return;
    let visitas = 1;
    try {
      const t = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - t < 7 * 864e5) return;
      // Cuenta una visita por sesion del navegador
      if (!sessionStorage.getItem(VISITAS)) {
        sessionStorage.setItem(VISITAS, '1');
        localStorage.setItem(VISITAS, String(Number(localStorage.getItem(VISITAS) || 0) + 1));
      }
      visitas = Number(localStorage.getItem(VISITAS) || 1);
    } catch {}
    if (visitas < VISITAS_MINIMAS) return;

    const timer = window.setTimeout(() => setListo(true), ESPERA_MS);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) { setIos(true); setHidden(false); }

    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e); setHidden(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
  };
  const install = async () => {
    if (!evt) return;
    evt.prompt();
    await evt.userChoice;
    setEvt(null);
    dismiss();
  };

  if (hidden || !listo || (!evt && !ios)) return null;
  return (
    <div className="md:hidden fixed left-3 right-3 bottom-20 z-50 bg-white border border-[#E7E4DC] rounded-xl shadow-lg p-3 flex items-center gap-3">
      <div className="flex-1 text-sm text-[#1B1B18]">
        <div className="font-semibold">Instala la app de HetNa</div>
        <div className="text-xs text-[#6B6A63]">
          {ios ? 'Toca Compartir y luego "Agregar a pantalla de inicio".' : 'Acceso directo, más rápida y sin Play Store.'}
        </div>
      </div>
      {!ios && <button onClick={install} className="bg-[#F08A3C] text-white text-sm font-semibold px-3 py-2 rounded-lg">Instalar</button>}
      <button onClick={dismiss} aria-label="Cerrar" className="text-[#999] text-xl">✕</button>
    </div>
  );
}
