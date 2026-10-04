'use server';

import { HttpTypes } from '@medusajs/types';

import { sortProducts } from '@/lib/helpers/sort-products';
import { getPricesForVariant } from '@/lib/helpers/get-product-price';
import { SortOptions } from '@/types/product';

import { sdk } from '../client';
import { getAuthHeaders } from './cookies';
import { CACHE_TAGS, getGlobalCacheOptions } from './cache-tags';
import { getRegion, retrieveRegion } from './regions';

const PRODUCT_LIST_FIELDS =
  '*variants.calculated_price,+variants.inventory_quantity,*variants.options,*attribute_values,*attribute_values.attribute';

export type SearchFacetBucket = { value: string; count: number };

/**
 * Storefront filter facets. `attributes` is keyed by the global product
 * attribute handle (e.g. `size`, `color`, `condition`); each entry is the list
 * of selectable values. Backed by `GET /store/product-attributes`.
 */
export type SearchFacets = {
  attributes: Record<string, SearchFacetBucket[]>;
  /** Nombre legible de cada atributo (clave = handle), p. ej. "Tipo de máquina". */
  names?: Record<string, string>;
};

type StoreProductAttribute = {
  handle: string;
  name: string;
  is_variant_axis: boolean;
  values?: { name: string; rank?: number }[];
};

export const getSearchFacets = async (): Promise<SearchFacets> => {
  const { product_attributes } = await (
    sdk.store.productAttributes.query({
      is_filterable: true,
      limit: 100,
      fields: 'handle,name,is_variant_axis,values.name,values.rank',
      fetchOptions: { next: { revalidate: 300 } },
    } as never) as unknown as Promise<{
      product_attributes: StoreProductAttribute[];
    }>
  ).catch(() => ({ product_attributes: [] as StoreProductAttribute[] }));

  const attributes: Record<string, SearchFacetBucket[]> = {};
  const names: Record<string, string> = {};
  for (const attribute of product_attributes) {
    if (attribute.name) names[attribute.handle] = attribute.name;
    attributes[attribute.handle] = (attribute.values ?? [])
      .slice()
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map((value) => ({
        value: value.name,
        count: 1,
      }));
  }

  return { attributes, names };
};

/**
 * Products in Mercur are master products from a single shared catalog — they are
 * not owned by a seller. Seller-scoped listings and per-seller price/inventory
 * come from offers, not from a product→seller relation; use `lib/data/offers.ts`.
 */
export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
  category_id,
  collection_id,
}: {
  pageParam?: number;
  queryParams?: HttpTypes.FindParams &
    HttpTypes.StoreProductParams & { handle?: string[] };
  category_id?: string | string[];
  collection_id?: string;
  countryCode?: string;
  regionId?: string;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
}> => {
  if (!countryCode && !regionId) {
    throw new Error('Country code or region ID is required');
  }

  const limit = queryParams?.limit || 12;
  const _pageParam = Math.max(pageParam, 1);
  const offset = (_pageParam - 1) * limit;

  const region = countryCode
    ? await getRegion(countryCode)
    : await retrieveRegion(regionId!);

  if (!region) {
    return { response: { products: [], count: 0 }, nextPage: null };
  }

  return (
    sdk.store.products.query({
      category_id,
      collection_id,
      limit,
      offset,
      region_id: region.id,
      fields: PRODUCT_LIST_FIELDS,
      ...queryParams,
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        cache: 'force-cache',
        next: getGlobalCacheOptions(CACHE_TAGS.products),
      },
    } as never) as unknown as Promise<{ products: HttpTypes.StoreProduct[]; count: number }>
  )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null;

      return {
        response: { products, count },
        nextPage,
        queryParams,
      };
    })
    .catch(() => ({
      response: { products: [], count: 0 },
      nextPage: null,
      queryParams,
    }));
};

export const listProductsWithSort = async ({
  page = 1,
  queryParams,
  sortBy = 'created_at',
  countryCode,
  category_id,
  collection_id,
}: {
  page?: number;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
  sortBy?: SortOptions;
  countryCode: string;
  category_id?: string | string[];
  collection_id?: string;
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number };
  nextPage: number | null;
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams;
}> => {
  const limit = queryParams?.limit || 12;

  const {
    response: { products, count },
  } = await listProducts({
    pageParam: 0,
    queryParams: { ...queryParams, limit: 100 },
    category_id,
    collection_id,
    countryCode,
  });

  const pricedProducts = products.filter(prod =>
    prod.variants?.some(variant => variant.calculated_price !== null)
  );

  const sortedProducts = sortProducts(pricedProducts, sortBy);

  const pageParam = (page - 1) * limit;
  const nextPage = count > pageParam + limit ? pageParam + limit : null;
  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit);

  return {
    response: { products: paginatedProducts, count },
    nextPage,
    queryParams,
  };
};

export const getProductByHandle = async (handle: string, regionId: string) => {
  const next = getGlobalCacheOptions(
    CACHE_TAGS.products,
    CACHE_TAGS.product(handle)
  );

  return (
    sdk.store.products.query({
      handle,
      region_id: regionId,
      fields: PRODUCT_LIST_FIELDS,
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        cache: 'force-cache',
        next,
      },
    } as never) as unknown as Promise<{ products: HttpTypes.StoreProduct[] }>
  ).then(({ products }) => products[0]);
};

/**
 * Price sorts are applied client-side because `/store/products` can only order
 * by product columns.
 */
export const searchProducts = async ({
  query,
  countryCode,
  regionId,
  category_id,
  collection_id,
  seller_id,
  attributes,
  page = 1,
  limit = 12,
  sortBy,
  minPrice,
  maxPrice,
  onlyAvailable,
}: {
  query?: string;
  countryCode?: string;
  regionId?: string;
  category_id?: string | string[];
  collection_id?: string | string[];
  seller_id?: string | string[];
  attributes?: Record<string, string | string[]>;
  page?: number;
  limit?: number;
  sortBy?: SortOptions;
  /** Precio mínimo / máximo en la moneda de la región (p. ej. MXN). */
  minPrice?: number;
  maxPrice?: number;
  /** Solo productos con al menos una variante con precio activo. */
  onlyAvailable?: boolean;
}): Promise<{
  products: HttpTypes.StoreProduct[];
  count: number;
  nextPage: number | null;
}> => {
  const region = countryCode ? await getRegion(countryCode) : { id: regionId };

  if (!region?.id) {
    return { products: [], count: 0, nextPage: null };
  }

  const offset = Math.max(page - 1, 0) * limit;
  const order = !sortBy || sortBy === 'created_at' ? '-created_at' : undefined;

  const hasAttributeFilters =
    attributes && Object.keys(attributes).length > 0;

  const authHeaders = await getAuthHeaders();

  const fetchPage = (pageOffset: number, pageLimit: number) =>
    (sdk.store.products.query({
      q: query || undefined,
      region_id: region.id,
      category_id,
      collection_id,
      seller_id,
      attributes: hasAttributeFilters ? attributes : undefined,
      order,
      limit: pageLimit,
      offset: pageOffset,
      fields: PRODUCT_LIST_FIELDS,
      fetchOptions: { headers: { ...authHeaders }, cache: 'no-cache' },
    } as never) as unknown as Promise<{
      products: HttpTypes.StoreProduct[];
      count: number;
    }>).catch(() => ({
      products: [] as HttpTypes.StoreProduct[],
      count: 0,
    }));

  const isPriceSort = sortBy === 'price_asc' || sortBy === 'price_desc';
  const hasMin = typeof minPrice === 'number' && Number.isFinite(minPrice);
  const hasMax = typeof maxPrice === 'number' && Number.isFinite(maxPrice);

  // Sin filtros de precio/disponibilidad ni orden por precio, la API pagina sola.
  if (!hasMin && !hasMax && !onlyAvailable && !isPriceSort) {
    const { products, count } = await fetchPage(offset, limit);
    const nextPage = count > offset + limit ? page + 1 : null;
    return { products, count, nextPage };
  }

  // Precio y disponibilidad se calculan después de la consulta (la API no los filtra),
  // así que se traen hasta SCAN_MAX productos y se filtra, ordena y pagina aquí.
  const SCAN_PAGE = 100;
  const SCAN_MAX = 300;
  const all: HttpTypes.StoreProduct[] = [];
  for (let o = 0; o < SCAN_MAX; o += SCAN_PAGE) {
    const { products, count } = await fetchPage(o, SCAN_PAGE);
    all.push(...products);
    if (all.length >= count || products.length < SCAN_PAGE) break;
  }

  const lowestPrice = (product: HttpTypes.StoreProduct): number | null => {
    const prices = (product.variants || [])
      .map((variant) => {
        try {
          return getPricesForVariant(variant)?.calculated_price_number;
        } catch {
          // Una variante con precio incompleto no debe romper todo el listado.
          return undefined;
        }
      })
      .filter((value): value is number => typeof value === 'number');
    return prices.length ? Math.min(...prices) : null;
  };

  const filtered = all.filter((product) => {
    const price = lowestPrice(product);
    if (onlyAvailable && price === null) return false;
    if (hasMin && (price === null || price < (minPrice as number))) return false;
    if (hasMax && (price === null || price > (maxPrice as number))) return false;
    return true;
  });

  const ordered = isPriceSort ? sortProducts(filtered, sortBy) : filtered;
  const pageItems = ordered.slice(offset, offset + limit);
  const nextPage = ordered.length > offset + limit ? page + 1 : null;

  return { products: pageItems, count: ordered.length, nextPage };
};
