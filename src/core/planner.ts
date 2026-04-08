import type {
  FxPair,
  PlannerRequest,
  RequestInput,
  RequestClassification,
  ResolvedRequest,
} from "./request";
import type { ResolverServices } from "./resolver-services";

export type RouteKind = "attribute" | "identifier" | "quote";
export type RoutingNodeKind = "leaf" | "switch" | "try each";

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

export type RouteClassResolver = (request: PlannerRequest) => string;

export type RoutePathResolver = (request: PlannerRequest) => string;

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
  describe(request: PlannerRequest): string;
  describeRoutingNode?(): string;
  getExampleInput(): string | null;
  getRoutingNodeKind(): RoutingNodeKind;
  getGroupedSourceNames?(request: PlannerRequest): string[];
  getGroupedSourceNamesForDisplay?(
    source: string,
    request: PlannerRequest,
  ): string[];
  getRoutingDescription(): string | null;
  getRoutingNodes?(): ResolverNode[];
  matchesSourceName?(source: string): boolean;
  name: string;
}

export interface ResolverNode extends ResolverLike {
  buildRouteState?(request: PlannerRequest): Record<string, unknown>;
  canHandle(request: PlannerRequest): boolean;
  buildRuntimePlan(request: PlannerRequest): RuntimePlan;
  executeBatch?(jobs: RouteJob[]): Array<Record<string, unknown> | null>;
  initEnv?(services: ResolverServices): void;
  resolve?(request: PlannerRequest): ResolutionResult<unknown>;
  traceLabel?: string;
}

export interface ResolverPlanNode extends ResolverNode {
  getNodesForRequest(request: PlannerRequest): ResolverNode[];
  getRoutingNodes?(): ResolverNode[];
  nodes?: ResolverNode[];
  routeClass?: string | RouteClassResolver;
  routePath?: string | RoutePathResolver;
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
