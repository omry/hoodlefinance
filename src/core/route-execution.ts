import type { RequestInput, ResolvedRequest } from "./request";
import type { RouteJob } from "./planner";
import type { Resolver } from "./resolver-classes";
import { createResolverRouteJob, getCurrentRouteNode, prepareRouteJob } from "./route-jobs";
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
  node: Resolver | null | undefined,
): RouteExecutor {
  const batchNode = node as Resolver & { executeBatch?(jobs: RouteJob[]): Array<RouteResult | null> };
  if (batchNode && typeof batchNode.executeBatch === "function") {
    return {
      executorId: batchNode.name || batchNode.traceLabel || "resolver",
      executeBatch(jobs) {
        return batchNode.executeBatch ? batchNode.executeBatch(jobs) : [];
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

export function executeRouteNode(
  node: Resolver,
  request: RequestInput | ResolvedRequest,
  errorMessage: (error: unknown) => string,
): RouteJob<Record<string, unknown>> {
  const job = createResolverRouteJob(request);
  const plan = node.buildRuntimePlan(request);

  job.plan = plan;
  prepareRouteJob(job, plan);
  executeRouteJobs([job], errorMessage);

  return job;
}
