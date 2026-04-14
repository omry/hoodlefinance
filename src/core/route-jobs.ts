import type {
  RouteJob,
  RouteKind,
  RuntimePlan,
} from "./planner";
import {
  RawRequestInput,
  RequestInput,
  type ResolvedRequest,
} from "./request";

interface CreateRouteJobOptions<RouteState = Record<string, unknown>> {
  attribute?: string;
  key?: string;
  plan?: RouteJob<RouteState>["plan"];
  quote?: unknown;
  routeKind?: RouteKind;
  routeNodes?: RouteJob<RouteState>["routeNodes"];
  routeState?: RouteState;
  tickerInput?: string;
  value?: unknown;
  valueResolved?: boolean;
}


function cloneRouteState<RouteState extends Record<string, unknown>>(
  state: RouteState,
): RouteState {
  return { ...state };
}

export function createRouteJob<RouteState extends Record<string, unknown>>(
  options: CreateRouteJobOptions<RouteState> = {},
): RouteJob<RouteState> {
  return {
    attribute: options.attribute || "price",
    error: null,
    key: options.key || "",
    plan: options.plan || null,
    quote: options.quote || null,
    routeKind: options.routeKind || "quote",
    routeLastLookupFailure: "",
    routeNodes: options.routeNodes || [],
    routePreferredLookupFailure: "",
    routeRuntimeTrace: [],
    routeState: options.routeState || ({} as RouteState),
    tickerInput: options.tickerInput ? String(options.tickerInput).trim() : "",
    value: options.value || null,
    valueResolved: options.valueResolved === true,
  };
}


export function createResolverRouteJob(
  request: RawRequestInput | RequestInput | ResolvedRequest,
): RouteJob<Record<string, unknown>> {
  if (request instanceof RawRequestInput || request instanceof RequestInput) {
    return createRouteJob({
      attribute: request.attribute,
      routeKind: "identifier",
      tickerInput: request.identifier,
    });
  }

  return createRouteJob({
    attribute: request.input.attribute,
    routeKind: "quote",
    tickerInput: request.input.identifier,
  });
}

export function getCurrentRouteNode(
  job: Pick<RouteJob, "routeNodes"> | null | undefined,
) {
  if (!job || !job.routeNodes || !job.routeNodes.length) {
    return null;
  }

  return job.routeNodes[0] ?? null;
}

export function mergeRouteState<RouteState extends Record<string, unknown>>(
  job: Pick<RouteJob<RouteState>, "plan" | "routeState">,
  stateChanges: Partial<RouteState> | null | undefined,
): void {
  const changes = stateChanges || {};

  if (!job.routeState) {
    job.routeState = {} as RouteState;
  }

  for (const [key, value] of Object.entries(changes)) {
    job.routeState[key as keyof RouteState] =
      value as RouteState[keyof RouteState];
  }

  if (job.plan) {
    job.plan.routeState = job.routeState;
  }
}

export function prepareRouteJob<RouteState extends Record<string, unknown>>(
  job: RouteJob<RouteState>,
  plan: RuntimePlan<RouteState> | null | undefined,
): void {
  const routePlan =
    plan ||
    job.plan ||
    ({
      nodes: [],
      routeClass: "",
      routePath: "",
      routeState: {} as RouteState,
    } satisfies RuntimePlan<RouteState>);

  job.plan = routePlan;
  job.routeNodes = (routePlan.nodes || []).slice();
  job.routeState = cloneRouteState(routePlan.routeState || ({} as RouteState));
  job.routeRuntimeTrace = [];
  job.routeLastLookupFailure = "";
  job.routePreferredLookupFailure = "";
}

