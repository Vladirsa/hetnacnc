import { SellerDTO } from '@mercurjs/types';

import { sdk } from '../client';

const SELLER_FIELDS =
  'id,name,handle,description,logo,banner,is_premium,metadata,created_at';
// Sin correo ni teléfono: la API pública ya no los da (api/store/proteger-vendedores.ts)

export const getSellerByHandle = async (
  handle: string
): Promise<SellerDTO | null> => {
  return (
    sdk.store.sellers.query({
      handle,
      fields: SELLER_FIELDS,
      fetchOptions: { cache: 'no-cache' },
    } as never) as unknown as Promise<{ sellers: SellerDTO[] }>
  )
    .then(({ sellers }) => sellers.find((s) => s.handle === handle) ?? null)
    .catch(() => null);
};
