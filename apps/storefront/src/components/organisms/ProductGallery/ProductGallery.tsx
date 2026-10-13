import { HttpTypes } from '@medusajs/types';

import GaleriaProducto from '@/components/hetna/GaleriaProducto';

// La galería ahora es la de HETNA (miniaturas + ampliación). El título se usa para el texto alternativo de las fotos (SEO).
export const ProductGallery = ({
  images,
  title = 'Producto',
}: {
  images: HttpTypes.StoreProduct['images'];
  title?: string;
}) => {
  if (!images || images.length === 0) return null;

  return <GaleriaProducto imagenes={images.map((i) => ({ id: i.id, url: i.url }))} titulo={title} />;
};
