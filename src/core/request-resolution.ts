import type { ResolutionResult } from "./planner";
import type { ResolverPlan } from "./resolver-classes";
import {
  RawRequestInput,
  type RequestInput,
  type ResolvedRequest,
} from "./request";
import type { TextHttpResponse } from "./text-http-response";

interface ResolvablePlan<TRequest, TValue> {
  describe(request: TRequest): string;
  resolve(request: TRequest): ResolutionResult<TValue>;
}

export interface LookupExecutionSelection {
  attributePlan: ResolverPlan | null;
  buildAttributePlan:
    | ((resolvedIdentifierRequest: ResolvedRequest) => ResolverPlan | null)
    | null;
  identifierPlan: ResolverPlan | null;
  requestInput: RequestInput;
  resolvedRequest: ResolvedRequest | null;
}


export interface RequestResolutionDependencies {
  httpFetch(url: string): TextHttpResponse;
  getCachedString(cacheKey: string): string;
  looksLikeIsin(value: string): boolean;
  putCachedString(cacheKey: string, value: string, ttlSeconds?: number): string;
  selectLookupExecution(requestInput: RawRequestInput): LookupExecutionSelection;
}

export interface LookupResult {
  error?: string;
  route: string;
  status: "failure" | "success";
  value: unknown;
}


function normalizePlanOutcome(
  route: string,
  outcome: {
    error?: unknown;
    status: "failure" | "success";
    value?: unknown;
  },
): LookupResult {
  const normalized: LookupResult = {
    route,
    status: outcome.status,
    value:
      outcome.status === "success" &&
      Object.prototype.hasOwnProperty.call(outcome, "value")
        ? outcome.value
        : null,
  };

  if (outcome.error != null) {
    normalized.error = String(
      outcome.error instanceof Error ? outcome.error.message : outcome.error,
    );
  }

  return normalized;
}

function requireResolvablePlan<TRequest, TValue>(
  plan: ResolverPlan | null | undefined,
  errorMessage: string,
): ResolvablePlan<TRequest, TValue> {
  if (!plan || typeof plan.resolve !== "function") {
    throw new Error(errorMessage);
  }

  return plan as ResolvablePlan<TRequest, TValue>;
}



export function resolvePlannedQuoteResult(
  attributePlan: ResolverPlan,
  resolvedRequest: ResolvedRequest,
): LookupResult {
  const resolvableAttributePlan = requireResolvablePlan<ResolvedRequest, unknown>(
    attributePlan,
    "Attribute plan cannot execute this request.",
  );
  const route = resolvableAttributePlan.describe(resolvedRequest);
  const outcome = resolvableAttributePlan.resolve(resolvedRequest);

  return normalizePlanOutcome(route, {
    error: outcome.status === "failure" ? outcome.error : undefined,
    status: outcome.status,
    value: outcome.status === "success" ? outcome.value : null,
  });
}

