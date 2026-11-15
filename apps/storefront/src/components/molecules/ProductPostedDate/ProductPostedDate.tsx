import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const ProductPostedDate = async ({
  posted,
}: {
  posted: string | null;
}) => {
  const postedDate = formatDistanceToNow(
    new Date(posted || ''),
    { addSuffix: true, locale: es }
  );

  return (
    <p className='label-md text-secondary'>
      Publicado {postedDate}
    </p>
  );
};
