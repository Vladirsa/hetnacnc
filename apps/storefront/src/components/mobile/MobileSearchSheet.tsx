'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';

// Ruta de resultados de tu tienda (ajústala si tu buscador usa otra)
const SEARCH_PATH = '/categories?query=';

// El modelo de IA solo se descarga si el usuario toca "Buscar por imagen"
const ImageSearchModal = dynamic(
  () => import('@/components/ImageSearchModal').then((m) => m.ImageSearchModal),
  { ssr: false }
);

export function MobileSearchSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [q, setQ] = useState('');
  const [img, setImg] = useState(false);

  if (img) return <ImageSearchModal isOpen onClose={onClose} />;

  return (
    <div className="md:hidden fixed inset-0 z-[60] bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!q.trim()) return;
            router.push(`/${locale}${SEARCH_PATH}${encodeURIComponent(q.trim())}`);
            onClose();
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="Buscar fresas, MDF, routers..."
            className="flex-1 min-w-0 border border-[#E7E4DC] rounded-lg px-3 py-2.5 text-base text-[#1B1B18] outline-none focus:border-[#F08A3C]"
          />
          <button type="submit" className="bg-[#F08A3C] text-white font-semibold px-4 rounded-lg">Buscar</button>
        </form>
        <button
          onClick={() => setImg(true)}
          className="w-full mt-3 flex items-center justify-center gap-2 border border-[#142033] text-[#142033] font-semibold py-2.5 rounded-lg"
        >
          📷 Buscar por imagen
        </button>
      </div>
    </div>
  );
}
