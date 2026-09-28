export const USAGE_HALF_LIFE_DAYS = 14;
export const USAGE_BOOST_CAP = 0.08;

export interface UsageObservation {
  atMs: number;
  exposures: number;
  position: number;
  selected: boolean;
}

const decayWeight = (ageDays: number): number =>
  2 ** (-ageDays / USAGE_HALF_LIFE_DAYS);

const positionCredit = (position: number): number =>
  1 / Math.log2(position + 1);

export const orgUsageBoost = (
  observations: readonly UsageObservation[],
  nowMs: number
): number => {
  let decayedExposures = 0;
  let decayedSelections = 0;
  for (const observation of observations) {
    const ageDays = Math.max(0, (nowMs - observation.atMs) / 86_400_000);
    const weight = decayWeight(ageDays);
    decayedExposures += observation.exposures * weight;
    if (observation.selected) {
      decayedSelections += positionCredit(observation.position) * weight;
    }
  }
  const raw = (decayedSelections + 1) / (decayedExposures + 2) - 0.5;
  return Math.min(USAGE_BOOST_CAP, Math.max(0, raw));
};
