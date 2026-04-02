import type { ResolverNode, RouteJob } from "./planner";
import { getCurrentRouteNode } from "./route-jobs";
import {
  applyRouteResult,
  defaultRouteFailureMessage,
  formatRouteFailureMessage,
  type RouteResult,
} from "./route-results";

export interface RouteExecutor {
  executeBatch(jobs: RouteJob[]): Array<RouteResult | null>;
  executorId: string;
}

export function getRouteExecutor(
  node: ResolverNode | null | undefined,
): RouteExecutor {
  if (node && typeof node.executeBatch === "function") {
    return {
      executorId: node.name || node.traceLabel || "resolver",
      executeBatch(jobs) {
        return node.executeBatch ? (node.executeBatch(jobs) as Array<RouteResult | null>) : [];
      },
    };
  }

  throw new Error(
    `Route node "${node ? node.name || "" : ""}" has no batch executor.`,
  );
}

export function executeRouteJobs(
  orderedJobs: RouteJob<Record<string, unknown>>[],
  errorMessage: (error: unknown) => string,
): void {
  while (true) {
    const groupsByKey: Record<
      string,
      { adapter: RouteExecutor; jobs: RouteJob[] }
    > = {};
    const groupOrder: string[] = [];
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

      const adapter = getRouteExecutor(node);
      const groupKey = adapter.executorId;

      if (!groupsByKey[groupKey]) {
        groupsByKey[groupKey] = {
          adapter,
          jobs: [],
        };
        groupOrder.push(groupKey);
      }

      groupsByKey[groupKey].jobs.push(job);
      pendingCount += 1;
    }

    if (!pendingCount) {
      return;
    }

    for (const groupKey of groupOrder) {
      const group = groupsByKey[groupKey];
      if (!group) {
        continue;
      }
      const startedAtMs = Date.now();
      const results = group.adapter.executeBatch(group.jobs);
      const elapsedMs = Date.now() - startedAtMs;

      for (
        let resultIndex = 0;
        resultIndex < group.jobs.length;
        resultIndex += 1
      ) {
        const job = group.jobs[resultIndex];
        if (!job) {
          continue;
        }
        applyRouteResult(
          job,
          getCurrentRouteNode(job),
          results[resultIndex],
          elapsedMs,
          errorMessage,
        );
      }
    }
  }
}
