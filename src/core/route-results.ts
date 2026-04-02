import type { DebugRoutePlan, ResolutionResult, RouteJob } from "./planner";

export interface RouteResult<StateChanges = Record<string, unknown>> {
  error?: unknown;
  quote?: unknown;
  stateChanges?: StateChanges;
  status: string;
  value?: unknown;
}

export function createDebugRoutePlan(value: unknown): DebugRoutePlan {
  return { debugValue: String(value ?? "") };
}

export function isDebugRoutePlan(plan: unknown): plan is DebugRoutePlan {
  return !!plan && Object.prototype.hasOwnProperty.call(plan, "debugValue");
}

export function describePlanSource(
  plan:
    | DebugRoutePlan
    | {
        routeClass?: unknown;
        routePath?: unknown;
      }
    | null
    | undefined,
): string {
  if (!plan) {
    return "";
  }

  if (isDebugRoutePlan(plan)) {
    return String(plan.debugValue || "");
  }

  const routeClass =
    plan.routeClass != null ? String(plan.routeClass).trim() : "";
  const routePath = plan.routePath != null ? String(plan.routePath).trim() : "";

  if (!routeClass) {
    return routePath;
  }

  if (!routePath || routeClass.startsWith("FORCED:")) {
    return routePath || routeClass;
  }

  return `${routeClass} -> ${routePath}`;
}

export function createRouteResult<StateChanges = Record<string, unknown>>(
  status: string,
  options: Omit<RouteResult<StateChanges>, "status"> = {},
): RouteResult<StateChanges> {
  return {
    status,
    ...options,
  };
}

export function createResolutionResult<T extends Record<string, unknown>>(
  status: ResolutionResult<unknown>["status"],
  options: T,
): { status: ResolutionResult<unknown>["status"] } & T {
  return {
    status,
    ...options,
  };
}

export function createResolutionSuccess<T>(
  value: T,
  elapsedMs: number,
): ResolutionResult<T> {
  return createResolutionResult("success", {
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
    value,
  }) as ResolutionResult<T>;
}

export function createResolutionFailure(
  error: unknown,
  elapsedMs: number,
  errorMessage: (error: unknown) => string,
): ResolutionResult<never> {
  return createResolutionResult("failure", {
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
    error: errorMessage(error),
  }) as ResolutionResult<never>;
}

export function defaultRouteFailureMessage(
  job: { routeKind?: string } | null | undefined,
): string {
  return job && job.routeKind === "isin"
    ? "ISIN lookup failed."
    : "Quote lookup failed.";
}

export function collectFailedRouteLabels(
  job: Pick<RouteJob, "routeRuntimeTrace"> | null | undefined,
): string[] {
  const trace =
    job && Array.isArray(job.routeRuntimeTrace) ? job.routeRuntimeTrace : [];
  const labels: string[] = [];

  for (const entry of trace) {
    if (!entry || !entry.label || entry.status === "success") {
      continue;
    }

    if (!labels.includes(entry.label)) {
      labels.push(entry.label);
    }
  }

  return labels;
}

export function formatRouteFailureMessage(
  job: Pick<RouteJob, "routeRuntimeTrace"> | null | undefined,
  message: unknown,
): string {
  const normalizedMessage = String(message || "").trim();
  const failedLabels = collectFailedRouteLabels(job);

  if (!failedLabels.length) {
    return normalizedMessage;
  }

  return `${normalizedMessage} Failed nodes: ${failedLabels.join(", ")}.`;
}
