import { rankingBoostHotKey } from './hot-keys';
import type { HotKvBinding } from './http-context';
import { orgUsageBoost } from './ranking-boost';
import type { UsageObservation } from './ranking-boost';

export const readOrgBoostMap = async (
  hot: HotKvBinding,
  organizationId: string
): Promise<Record<string, number>> => {
  const raw = await hot.get(rankingBoostHotKey(organizationId));
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const writeOrgBoostMap = async (
  hot: HotKvBinding,
  organizationId: string,
  boosts: Record<string, number>
): Promise<void> => {
  await hot.put(rankingBoostHotKey(organizationId), JSON.stringify(boosts));
};

export const recomputeOrgBoostMap = (
  observationsByCapability: Record<string, readonly UsageObservation[]>,
  nowMs: number
): Record<string, number> => {
  const boosts: Record<string, number> = {};
  for (const [capabilityId, observations] of Object.entries(
    observationsByCapability
  )) {
    const boost = orgUsageBoost(observations, nowMs);
    if (boost > 0) {
      boosts[capabilityId] = boost;
    }
  }
  return boosts;
};
