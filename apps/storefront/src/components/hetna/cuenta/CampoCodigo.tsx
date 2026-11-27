'use client';

// Código de 6 dígitos para confirmar el correo (llega junto con la liga).
// Sirve cuando la persona abre el correo en el celular pero se registró en la
// computadora: copia el código aquí y su cuenta queda confirmada.
import { T } from "@/components/hetna/i18n/Idioma"
import { useState } from 'react';

import { confirmarConCodigo } from '@/lib/data/customer';

export function CampoCodigo({ email, alConfirmar }: { email: string; alConfirmar: () => void | Promise<void> }) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    setError('');
    setOcupado(true);
    const r = await confirmarConCodigo(email, codigo);
    if (r.ok) {
      await alConfirmar();
    } else {
      setError(r.mensaje || 'El código no es correcto.');
    }
    setOcupado(false);
  };

  return (
    <div className="mt-4 text-left" data-testid="campo-codigo">
      <label htmlFor="codigo-verificacion" className="block text-md font-semibold">
        <T>¿Prefieres escribir el código del correo?</T>
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="codigo-verificacion"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="123456"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && codigo.length === 6) {
              e.preventDefault();
              void enviar();
            }
          }}
          className="w-[150px] rounded-sm border px-3 py-2 text-center text-[20px] font-bold tracking-[6px]"
        />
        <button
          type="button"
          disabled={codigo.length !== 6 || ocupado}
          onClick={() => void enviar()}
          className="rounded-sm bg-[#142033] px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {ocupado ? 'Revisando…' : 'Confirmar'}
        </button>
      </div>
      {error && <p className="mt-2 mb-0 text-md text-[#B42318]">{error}</p>}
    </div>
  );
}
