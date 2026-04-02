import type {
  FxPair,
  RequestClassification,
  RequestInput,
  ResolvedRequest,
} from "./request";

export type RouteKind = "attribute" | "identifier" | "quote";

export type ResolutionStatus = "success" | "failure";

export interface ResolutionSuccess<T> {
  elapsedMs: number;
  status: "success";
  value: T;
}

export interface ResolutionFailure {
  elapsedMs: number;
  error: string;
  status: "failure";
}

export type ResolutionResult<T> = ResolutionSuccess<T> | ResolutionFailure;

export interface RuntimePlan<RouteState = Record<string, unknown>> {
  nodes: ResolverNode[];
  routeClass: string;
  routePath: string;
  routeState: RouteState;
}

export interface RouteContext {
  outputCurrencyCache?: {
    conversionRateByPair: Record<string, number>;
    unitByCode: Record<string, string>;
  };
  plan?: RuntimePlan;
  tickerInput?: string;
}

export interface RouteJob<RouteState = Record<string, unknown>> {
  attribute: string;
  error: string | null;
  key: string;
  plan: RuntimePlan<RouteState> | null;
  quote: unknown;
  routeContext: RouteContext | null;
  routeKind: RouteKind;
  routeLastLookupFailure: string;
  routeNodes: ResolverNode[];
  routePreferredLookupFailure: string;
  routeRuntimeTrace: RouteTraceEntry[];
  routeState: RouteState;
  sourceQuote: unknown;
  tickerInput: string;
  value: unknown;
  valueResolved: boolean;
}

export interface RouteTraceEntry {
  elapsedMs: number | null;
  label: string;
  status: string;
}

export interface ResolverLike {
  code: string;
  describe(request: RequestInput | ResolvedRequest): string;
  name: string;
  routingDescription: string;
  routingLabel: string;
  sourceName: string;
}

export interface ResolverNode extends ResolverLike {
  canHandle(request: RequestInput | ResolvedRequest): boolean;
  buildRuntimePlan(request: RequestInput | ResolvedRequest): RuntimePlan;
  executeBatch?(jobs: RouteJob[]): Array<Record<string, unknown> | null>;
  traceLabel?: string;
}

export interface ResolverPlanNode extends ResolverNode {
  getNodesForRequest(request: RequestInput | ResolvedRequest): ResolverNode[];
  isRoutingNode: boolean;
  nodes?: ResolverNode[];
}

export interface ResolvePlan {
  attributePlan: ResolverPlanNode | null;
  buildAttributePlan:
    | ((resolvedIdentifierRequest: ResolvedRequest) => ResolverPlanNode | null)
    | null;
  debugValue: string;
  identifierPlan: ResolverPlanNode | null;
  plannedRoute: string;
  requestInput: RequestInput;
  resolvedRequest: ResolvedRequest | null;
}

export interface DebugRoutePlan {
  debugValue: string;
}

export interface RouteStateBuilderInput {
  classification?: RequestClassification;
  fxPair?: FxPair | null;
  yahooSymbol?: string;
}
