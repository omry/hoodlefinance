import type { ResolvePlan, RouteContext, RouteJob, RouteKind } from "./planner";
import { RequestInput, type ResolvedRequest } from "./request";

export interface CreateRouteJobOptions<RouteState = Record<string, unknown>> {
  attribute?: string;
  key?: string;
  plan?: RouteJob<RouteState>["plan"];
  quote?: unknown;
  routeContext?: RouteContext | null;
  routeKind?: RouteKind;
  routeNodes?: RouteJob<RouteState>["routeNodes"];
  routeState?: RouteState;
  sourceQuote?: unknown;
  tickerInput?: string;
  value?: unknown;
  valueResolved?: boolean;
}

export function buildTickerJobKey(ticker: string, attribute: string): string {
  return `${String(ticker).trim()}\n${String(attribute).trim().toLowerCase()}`;
}

export function cloneRouteState<RouteState extends Record<string, unknown>>(
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
    routeContext: options.routeContext || null,
    routeKind: options.routeKind || "quote",
    routeLastLookupFailure: "",
    routeNodes: options.routeNodes || [],
    routePreferredLookupFailure: "",
    routeRuntimeTrace: [],
    routeState: options.routeState || ({} as RouteState),
    sourceQuote: options.sourceQuote || null,
    tickerInput: options.tickerInput ? String(options.tickerInput).trim() : "",
    value: options.value || null,
    valueResolved: options.valueResolved === true,
  };
}

export function createQuoteRouteJob(
  ticker: string,
  attribute: string,
): RouteJob<Record<string, unknown>> {
  const normalizedTicker = String(ticker).trim();
  const normalizedAttribute = String(
    attribute == null ? "price" : attribute,
  ).trim();

  return createRouteJob({
    attribute: normalizedAttribute,
    key: buildTickerJobKey(normalizedTicker, normalizedAttribute),
    tickerInput: normalizedTicker,
  });
}

export function createAttributeRouteJob(
  attribute: string,
  quote: unknown,
  context: RouteContext = {},
  routeKind: RouteKind = "attribute",
): RouteJob<Record<string, unknown>> {
  return createRouteJob({
    attribute: String(attribute == null ? "" : attribute).trim(),
    routeContext: context,
    routeKind,
    sourceQuote: quote,
    tickerInput: context.tickerInput ? String(context.tickerInput).trim() : "",
  });
}

export function createResolverRouteJob(
  request: RequestInput | ResolvedRequest,
): RouteJob<Record<string, unknown>> {
  if (request instanceof RequestInput) {
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

export function createResolvePlan(
  options: Partial<ResolvePlan>,
): Readonly<ResolvePlan> {
  return Object.freeze({
    attributePlan: options.attributePlan || null,
    buildAttributePlan:
      typeof options.buildAttributePlan === "function"
        ? options.buildAttributePlan
        : null,
    debugValue: options.debugValue != null ? String(options.debugValue) : "",
    identifierPlan: options.identifierPlan || null,
    plannedRoute:
      options.plannedRoute != null ? String(options.plannedRoute) : "",
    requestInput: options.requestInput || null,
    resolvedRequest: options.resolvedRequest || null,
  }) as Readonly<ResolvePlan>;
}
