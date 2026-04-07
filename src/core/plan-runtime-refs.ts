export interface PlanRuntimeRefDependencies {
  looksLikeIsin(value: string): boolean;
  resolvePreferredYahooSymbol?(symbol: string): string;
}

export function createPlanRuntimeRefs(
  deps: PlanRuntimeRefDependencies,
): PlanRuntimeRefs {
  return {
    looksLikeIsin: deps.looksLikeIsin,
  };
}

export interface PlanRuntimeRefs {
  looksLikeIsin(value: string): boolean;
}
