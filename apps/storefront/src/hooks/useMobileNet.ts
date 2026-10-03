'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MobileNet } from '@tensorflow-models/mobilenet';

export interface Classification {
  className: string;
  probability: number;
}

export function useMobileNet() {
  const modelRef = useRef<MobileNet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tf = await import('@tensorflow/tfjs');
        await tf.ready();
        const mn = await import('@tensorflow-models/mobilenet');
        const m = await mn.load({ version: 2, alpha: 0.5 });
        if (!cancelled) modelRef.current = m;
      } catch (e) {
        if (!cancelled) setError('No se pudo cargar el modelo de imágenes');
        console.error(e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const classifyFromBase64 = useCallback(
    (src: string) =>
      new Promise<Classification[]>((resolve, reject) => {
        const m = modelRef.current;
        if (!m) return reject(new Error('El modelo aún no está listo'));
        const img = new Image();
        img.onload = async () => {
          try { resolve(await m.classify(img, 10)); } catch (e) { reject(e); }
        };
        img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
        img.src = src;
      }),
    []
  );

  return { isLoading, error, classifyFromBase64 };
}
