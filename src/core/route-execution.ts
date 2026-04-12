import type { RouteJob } from "./planner";
import type { Resolver } from "./resolver-classes";
import { getCurrentRouteNode } from "./route-jobs";
import {
  applyRouteResult,
  defaultRouteFailureMessage,
  formatRouteFailureMessage,
  type RouteResult,
} from "./route-results";

export function executeRouteJobs(
  orderedJobs: RouteJob<Record<string, unknown>>[],
  errorMessage: (error: unknown) => string,
): void {
  while (true) {
    let pendingCount = 0;

    for (const job of orderedJobs) {
      if (job.error || job.quote || job.valueResolved) {
        continue;
      }

      const node = getCurrentRouteNode(job);

      if (!node) {
        if (!job.error) {
          job.error = formatRouteFailureMessage(
            job,
            job.routePreferredLookupFailure ||
              job.routeLastLookupFailure ||
              defaultRouteFailureMessage(job),
          );
        }
        continue;
      }

      const execute = (node as Resolver & { executeBatch?(jobs: RouteJob[]): Array<RouteResult | null> }).executeBatch;
      if (typeof execute !== "function") {
        throw new Error(`Route node "${node.name || ""}" has no executor.`);
      }

      const startedAtMs = Date.now();
      const result = execute.call(node, [job])[0];
      const elapsedMs = Date.now() - startedAtMs;

      applyRouteResult(job, getCurrentRouteNode(job), result, elapsedMs, errorMessage);
      pendingCount += 1;
    }

    if (!pendingCount) {
      return;
    }
  }
}
