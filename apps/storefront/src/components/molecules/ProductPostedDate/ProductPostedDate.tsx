import { TS } from "@/i18n/TS"
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const ProductPostedDate = async ({
  posted,
}: {
  posted: string | null;
}) => {
  // Sin fecha (o mal guardada) no se pone nada: formatDistanceToNow lanza
  // "RangeError: Invalid time value" y tumbaba la ficha completa (21 nov 2026).
  const fecha = posted ? new Date(posted) : null;
  if (!fecha || !Number.isFinite(fecha.getTime())) return null;
  const postedDate = formatDistanceToNow(fecha, { addSuffix: true, locale: es });

  return (
    <p className='label-md text-secondary'>
      {/* Un solo texto para que el traductor (REGLAS de i18n/en.ts) lo pase al inglés */}
      <TS>{`Publicado ${postedDate}`}</TS>
    </p>
  );
};
