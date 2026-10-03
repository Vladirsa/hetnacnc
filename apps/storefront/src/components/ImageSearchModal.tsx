'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { useMobileNet } from '@/hooks/useMobileNet';
import { generateSearchQuery } from '@/lib/searchLabelsMapper';

export function ImageSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const { classifyFromBase64, isLoading, error } = useMobileNet();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { setPreview(r.result as string); setMsg(null); };
    r.readAsDataURL(file);
  };

  const search = async () => {
    if (!preview) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = generateSearchQuery(await classifyFromBase64(preview));
      if (!res.query) {
        setMsg('No pude identificar un producto en la foto. Prueba con otra más cercana, o escribe lo que buscas.');
        return;
      }
      router.push(`/${locale}/categories?query=${encodeURIComponent(res.query)}`);
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al analizar la imagen');
    } finally {
      setBusy(false);
    }
  };

  const pick = 'flex flex-col items-center gap-1 p-4 border-2 border-dashed border-[#E7E4DC] rounded-lg cursor-pointer text-xs font-semibold text-[#1B1B18]';

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[#1B1B18]">Buscar por imagen</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-2xl text-[#999]">✕</button>
        </div>

        {isLoading && <p className="mb-3 p-3 rounded-lg bg-blue-50 text-sm text-blue-900">Preparando el buscador de imágenes (solo la primera vez)...</p>}
        {error && <p className="mb-3 p-3 rounded-lg bg-red-50 text-sm text-red-900">{error}</p>}

        {preview ? (
          <div className="mb-4">
            <img src={preview} alt="Vista previa" className="w-full h-48 object-cover rounded-lg border border-[#E7E4DC]" />
            <button onClick={() => { setPreview(null); setMsg(null); }} className="w-full mt-2 text-sm text-[#6B6A63]">Cambiar imagen</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className={pick}>
              <span className="text-3xl">📷</span>Cámara
              <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
            </label>
            <label className={pick}>
              <span className="text-3xl">🖼️</span>Galería
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>
        )}

        {msg && <p className="mb-3 p-3 rounded-lg bg-red-50 text-sm text-red-900">{msg}</p>}

        <button
          onClick={search}
          disabled={!preview || busy || isLoading || !!error}
          className="w-full bg-[#F08A3C] text-white font-semibold py-3 rounded-lg disabled:opacity-50"
        >
          {busy ? 'Analizando...' : 'Buscar producto similar'}
        </button>
        <p className="text-xs text-[#6B6A63] mt-3 text-center">Funciona mejor con fotos claras de una sola herramienta o pieza.</p>
      </div>
    </div>
  );
}
