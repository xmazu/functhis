import { catalogGenerationHotKey } from '../catalog/hot-keys';
import type { HotKvBinding } from '../http/http-context';

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
