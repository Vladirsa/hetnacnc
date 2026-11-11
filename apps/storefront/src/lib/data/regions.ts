'use server';

import { HttpTypes } from '@medusajs/types';

import medusaError from '@/lib/helpers/medusa-error';

import { sdk } from '../client';
import { getCacheOptions } from './cookies';

// Última respuesta buena de regiones. El layout de toda la tienda las pide en
// cada página (checkRegion); si el API se está reiniciando y la caché de fetch
// está fría, sin esta copia TODAS las páginas daban 500.
let ultimasRegiones: HttpTypes.StoreRegion[] | null = null;

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions('regions')),
    revalidate: 3600,
  };

  return sdk.store.regions
    .query({ fetchOptions: { next, cache: 'force-cache' } })
    .then(({ regions }: { regions: HttpTypes.StoreRegion[] }) => {
      if (regions?.length) ultimasRegiones = regions;
      return regions;
    })
    .catch((e) => {
      if (ultimasRegiones) return ultimasRegiones;
      return medusaError(e);
    });
};

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(['regions', id].join('-'))),
    revalidate: 3600,
  };

  return sdk.store.regions.$id
    .query({ $id: id, fetchOptions: { next, cache: 'force-cache' } })
    .then(({ region }) => region)
    .catch(medusaError);
};

const regionMap = new Map<string, HttpTypes.StoreRegion>();

export const getRegion = async (countryCode: string) => {
  try {
    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode);
    }

    const regions = await listRegions();

    if (!regions) {
      return null;
    }

    regions.forEach(region => {
      region.countries?.forEach(c => {
        regionMap.set(c?.iso_2 ?? '', region);
      });
    });

    return regionMap.get(countryCode) ?? regionMap.get('us');
  } catch (e) {
    return null;
  }
};
