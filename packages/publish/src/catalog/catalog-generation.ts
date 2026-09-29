import type { HotKvBinding } from '../http/http-context';
import { catalogGenerationHotKey } from './hot-keys';

export const readCatalogGeneration = async (
  hot: HotKvBinding,
  organizationId: string
): Promise<number> => {
  const raw = await hot.get(catalogGenerationHotKey(organizationId));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const bumpCatalogGeneration = async (
  hot: HotKvBinding,
  organizationId: string
): Promise<number> => {
  const next = (await readCatalogGeneration(hot, organizationId)) + 1;
  await hot.put(catalogGenerationHotKey(organizationId), String(next));
  return next;
};

export const writeCatalogGeneration = async (
  hot: HotKvBinding,
  organizationId: string,
  generation: number
): Promise<void> => {
  await hot.put(catalogGenerationHotKey(organizationId), String(generation));
};
