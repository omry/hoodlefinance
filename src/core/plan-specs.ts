export type ResolverClassName =
  | "AttributeResolutionPlan"
  | "DirectIdentifierResolver"
  | "FunctionValueResolver"
  | "GoogleFxResolver"
  | "IdentifierResolutionPlan"
  | "LocalFxResolver"
  | "PSEEdgeResolver"
  | "PSEFramesResolver"
  | "PseIsinMapResolver"
  | "ResolverPlan"
  | "TradingviewFundResolver"
  | "YahooIsinSearchResolver"
  | "YahooQuoteResolver";

export interface ResolverSpecOptions {
  isSourceOverrideable?: boolean;
  representativeTicker?: string;
  routingDescription?: string;
  routingLabel?: string;
  sourceName?: string;
}

export interface ResolverSpec {
  options?: ResolverSpecOptions;
  resolveFunctionRef?: string;
  resolverClass: ResolverClassName;
}

export interface PlanSpecOptions extends ResolverSpecOptions {
  canHandleRef?: string;
  isRoutingNode?: boolean;
  nodeSelectorRef?: string;
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
