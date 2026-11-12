import { Label } from '@/components/atoms/Label/Label'
import { HttpTypes } from '@medusajs/types';

export const ProductTags = ({
  tags,
}: {
  tags: HttpTypes.StoreProductTag[];
}) => {
  return (
    // flex-wrap: sin él, las etiquetas de los productos digitales ("organizador
    // brocas", "porta brocas"...) se salían de la pantalla y el celular
    // ensanchaba toda la ficha a 630-730 px (menú y barra inferior corridos).
    <div className='flex flex-wrap gap-2'>
      {tags.map(({ id, value }) => (
        <Label key={id}>{value}</Label>
      ))}
    </div>
  );
};
