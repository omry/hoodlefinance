export type ResolverClassName =
  | "AttributeResolutionPlan"
  | "DirectIdentifierResolver"
  | "FxAttributeResolutionPlan"
  | "GoogleFxResolver"
  | "IdentifierResolutionPlan"
  | "LocalFxResolver"
  | "PseQuoteResolutionPlan"
  | "PSEEdgeResolver"
  | "PSEFramesResolver"
  | "PseIsinMapResolver"
  | "ResolverPlan"
  | "TickerQuoteResolutionPlan"
  | "TradingviewFundResolver"
  | "YahooIsinSearchResolver"
  | "YahooQuoteResolver";

export interface ResolverSpecOptions {
  representativeTicker?: string;
  routingDescription?: string;
  routingLabel?: string;
  sourceName?: string;
}

export interface ResolverSpec {
  options?: ResolverSpecOptions;
  resolverClass: ResolverClassName;
}

export interface PlanSpecOptions extends ResolverSpecOptions {
  canHandleRef?: string;
  isRoutingNode?: boolean;
  routeClass?: string;
  routeClassRef?: string;
  routePath?: string;
  routePathRef?: string;
  routeStateBuilderRef?: string;
}

export interface PlanSpec {
  defaultNodeCodes?: string[];
  nodeCodes?: string[];
  options?: PlanSpecOptions;
  resolverClass: ResolverClassName;
}
