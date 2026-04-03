import type { ResolvedRequest } from "./request";
import { isSameCurrencyFxPair } from "./fx-quotes";
import { describePlanSource } from "./route-results";

export interface QuoteRoutingResolverLike {
  name: string;
  canHandle?(request: ResolvedRequest): boolean;
  getRouteClass?(request: ResolvedRequest): string;
  resolve(request: ResolvedRequest): {
    error?: unknown;
    elapsedMs?: number;
    status: "failure" | "success";
    value?: unknown;
  };
}

export interface QuoteRoutingDependencies {
  identifierIsinPlan?: QuoteRoutingPlanLike;
  quoteEquityPlan?: QuoteRoutingPlanLike;
  quoteFxPlan?: QuoteRoutingPlanLike;
  googleFxResolver: QuoteRoutingResolverLike;
  localFxResolver: QuoteRoutingResolverLike;
  pseEdgeResolver: QuoteRoutingResolverLike;
  pseFramesResolver: QuoteRoutingResolverLike;
  tradingviewFundResolver: QuoteRoutingResolverLike;
  yahooQuoteResolver: QuoteRoutingResolverLike;
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

function routeLabelFromPlan(routeClass: string, routePath: string): string {
  return describePlanSource({
    routeClass,
    routePath,
  });
}

export function resolveQuoteForResolvedRequest(
  env: QuoteRoutingDependencies,
  resolvedRequest: ResolvedRequest,
  attemptedRoutes: string[],
) {
  if (resolvedRequest.requestType === "fx") {
    if (env.quoteFxPlan) {
      const plan = env.quoteFxPlan;
      const routeLabel = plan.describe(resolvedRequest);
      const outcome = plan.resolve(resolvedRequest);

      return {
        ...outcome,
        attemptedRoutes: attemptedRoutes.concat([routeLabel]),
        kind: "quote",
        route: routeLabel,
      };
    }

    const routePath = isSameCurrencyFxPair(resolvedRequest.fxPair)
      ? env.localFxResolver.name
      : env.googleFxResolver.name;
    const routeLabel = routeLabelFromPlan("FX", routePath);
    const outcome = isSameCurrencyFxPair(resolvedRequest.fxPair)
      ? env.localFxResolver.resolve(resolvedRequest)
      : env.googleFxResolver.resolve(resolvedRequest);

    return {
      ...outcome,
      attemptedRoutes: attemptedRoutes.concat([routeLabel]),
      kind: "quote",
      route: routeLabel,
    };
  }

  if (
    resolvedRequest.requestType === "equity" &&
    resolvedRequest.exchange === "PSE"
  ) {
    if (env.quoteEquityPlan) {
      const plan = env.quoteEquityPlan;
      const routeLabel = plan.describe(resolvedRequest);
      const outcome = plan.resolve(resolvedRequest);

      return {
        ...outcome,
        attemptedRoutes: attemptedRoutes.concat([routeLabel]),
        kind: "quote",
        route: routeLabel,
      };
    }

    const routeClass = "EQUITY -> PSE";
    const framesLabel = routeLabelFromPlan(
      routeClass,
      env.pseFramesResolver.name,
    );
    const framesOutcome = env.pseFramesResolver.resolve(resolvedRequest);
    let nextAttemptedRoutes = attemptedRoutes.concat([framesLabel]);

    if (framesOutcome.status === "success") {
      return {
        ...framesOutcome,
        attemptedRoutes: nextAttemptedRoutes,
        kind: "quote",
        route: framesLabel,
      };
    }

    const edgeLabel = routeLabelFromPlan(
      routeClass,
      env.pseEdgeResolver.name,
    );
    const edgeOutcome = env.pseEdgeResolver.resolve(resolvedRequest);
    nextAttemptedRoutes = nextAttemptedRoutes.concat([edgeLabel]);

    if (edgeOutcome.status === "success") {
      return {
        ...edgeOutcome,
        attemptedRoutes: nextAttemptedRoutes,
        kind: "quote",
        route: edgeLabel,
      };
    }

    attemptedRoutes = nextAttemptedRoutes;
  }

  if (
    resolvedRequest.requestType === "equity" &&
    !!resolvedRequest.yahooSymbol
  ) {
    if (env.quoteEquityPlan) {
      const plan = env.quoteEquityPlan;
      const routeLabel = plan.describe(resolvedRequest);
      const outcome = plan.resolve(resolvedRequest);

      return {
        ...outcome,
        attemptedRoutes: attemptedRoutes.concat([routeLabel]),
        kind: "quote",
        route: routeLabel,
      };
    }

    const routeLabel = routeLabelFromPlan(
      env.yahooQuoteResolver.getRouteClass
        ? env.yahooQuoteResolver.getRouteClass(resolvedRequest)
        : env.yahooQuoteResolver.name,
      env.yahooQuoteResolver.name,
    );
    const outcome = env.yahooQuoteResolver.resolve(resolvedRequest);

    if (outcome.status === "success") {
      return {
        ...outcome,
        attemptedRoutes: attemptedRoutes.concat([routeLabel]),
        kind: "quote",
        route: routeLabel,
      };
    }

    if (
      resolvedRequest.allowTradingviewFallback &&
      env.tradingviewFundResolver.canHandle &&
      env.tradingviewFundResolver.canHandle(resolvedRequest)
    ) {
      const fallbackLabel = routeLabelFromPlan(
        env.yahooQuoteResolver.getRouteClass
          ? env.yahooQuoteResolver.getRouteClass(resolvedRequest)
          : env.yahooQuoteResolver.name,
        env.tradingviewFundResolver.name,
      );
      const fallbackOutcome = env.tradingviewFundResolver.resolve(
        resolvedRequest,
      );

      return {
        ...fallbackOutcome,
        attemptedRoutes: attemptedRoutes.concat([routeLabel, fallbackLabel]),
        kind: "quote",
        route: fallbackLabel,
      };
    }

    return {
      ...outcome,
      attemptedRoutes: attemptedRoutes.concat([routeLabel]),
      kind: "quote",
      route: routeLabel,
    };
  }

  return {
    attemptedRoutes,
    error: "Quote lookup is not yet available for this request in the TypeScript CLI.",
    kind: "quote",
    route: attemptedRoutes[attemptedRoutes.length - 1] || "(none)",
    status: "failure",
  };
}
