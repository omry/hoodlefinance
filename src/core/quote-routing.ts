import type { ResolvedRequest } from "./request";

export interface QuoteRoutingDependencies {
  quoteEquityPlan: QuoteRoutingPlanLike;
  quoteFxPlan: QuoteRoutingPlanLike;
}

export interface QuoteRoutingPlanLike {
  describe(request: ResolvedRequest): string;
  resolve(request: ResolvedRequest): {
    error?: unknown;
    elapsedMs?: number;
    status: "failure" | "success";
    value?: unknown;
  };
}

export function resolveQuoteForResolvedRequest(
  env: QuoteRoutingDependencies,
  resolvedRequest: ResolvedRequest,
) {
  if (resolvedRequest.requestType === "fx") {
    const plan = env.quoteFxPlan;
    const routeLabel = plan.describe(resolvedRequest);
    const outcome = plan.resolve(resolvedRequest);

    return {
      ...outcome,
      kind: "quote",
      route: routeLabel,
    };
  }

  if (
    resolvedRequest.requestType === "equity" &&
    !!resolvedRequest.yahooSymbol
  ) {
    const plan = env.quoteEquityPlan;
    const routeLabel = plan.describe(resolvedRequest);
    const outcome = plan.resolve(resolvedRequest);
    return {
      ...outcome,
      kind: "quote",
      route: routeLabel,
    };
  }

  return {
    error:
      "Quote lookup is not yet available for this request in the TypeScript CLI.",
    kind: "quote",
    route: "(none)",
    status: "failure",
  };
}
