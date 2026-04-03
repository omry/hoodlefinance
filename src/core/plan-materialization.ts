import type { PlanSpec } from "./plan-specs";
import type { ResolverNode } from "./planner";
import { createPlanRuntimeRefs, type PlanRuntimeRefDependencies } from "./plan-runtime-refs";
import { buildPlanNodeFromSpec } from "./resolver-classes";

export interface PlanMaterializationDependencies {
  buildPlanNode(
    code: string,
    spec: PlanSpec,
    resolveNode: (nodeCode: string) => ResolverNode,
    overrides: Record<string, unknown>,
  ): ResolverNode;
  planSpecsByCode: Record<string, PlanSpec>;
  resolversByCode: Record<string, ResolverNode>;
}

function normalizeCode(code: string): string {
  return String(code || "")
    .trim()
    .toUpperCase();
}

export function extractIsinCountryCode(
  request: { ticker?: string },
  looksLikeIsin: (value: string) => boolean,
): string {
  const ticker = String(request.ticker || "").trim();
  const upperTicker = ticker.toUpperCase();
  const isin = looksLikeIsin(ticker)
    ? upperTicker
    : upperTicker.startsWith("ISIN:")
      ? upperTicker.slice(5).trim()
      : "";

  return isin ? isin.slice(0, 2).toUpperCase() : "";
}

export function materializePlanNodeByCode(
  code: string,
  optionOverrides: Record<string, unknown> | null | undefined,
  ancestry: string[],
  deps: PlanMaterializationDependencies,
): ResolverNode {
  const normalizedCode = normalizeCode(code);
  const spec = deps.planSpecsByCode[normalizedCode];
  const overrides = optionOverrides || {};
  const planAncestry = ancestry || [];

  if (spec && deps.resolversByCode[normalizedCode]) {
    throw new Error(
      `Resolver code "${normalizedCode}" collides with a resolver plan spec of the same name.`,
    );
  }

  if (deps.resolversByCode[normalizedCode]) {
    return deps.resolversByCode[normalizedCode];
  }

  if (!spec) {
    throw new Error(`Unknown resolver plan spec "${normalizedCode}".`);
  }

  if (planAncestry.includes(normalizedCode)) {
    throw new Error(
      `Resolver plan spec cycle detected: ${planAncestry.concat([normalizedCode]).join(" -> ")}.`,
    );
  }

  return deps.buildPlanNode(
    normalizedCode,
    spec,
    (nodeCode) =>
      materializePlanNodeByCode(
        nodeCode,
        null,
        planAncestry.concat([normalizedCode]),
        deps,
      ),
    overrides,
  );
}

export function materializePlanFromSpec(
  code: string,
  optionOverrides: Record<string, unknown> | null | undefined,
  deps: PlanMaterializationDependencies,
): ResolverNode {
  return materializePlanNodeByCode(code, optionOverrides, [], deps);
}

export function listSourceOverridePlanCodes(
  planSpecsByCode: Record<string, PlanSpec>,
): string[] {
  return Object.keys(planSpecsByCode).filter(
    (code) => !!(planSpecsByCode[code]?.options || {}).isSourceOverrideable,
  );
}

export interface DefaultPlanMaterializationDependencies
  extends Omit<PlanMaterializationDependencies, "buildPlanNode">,
    PlanRuntimeRefDependencies {
  extractIsinCountryCode(request: { ticker?: string }): string;
}

export function createDefaultPlanMaterializationDependencies(
  deps: DefaultPlanMaterializationDependencies,
): PlanMaterializationDependencies {
  return {
    buildPlanNode(code, spec, resolveNode, overrides) {
      return buildPlanNodeFromSpec(code, spec, resolveNode, overrides, {
        extractIsinCountryCode(request) {
          if (request && "ticker" in request) {
            const requestWithTicker = request as {
              ticker?: unknown;
            };

            return deps.extractIsinCountryCode({
              ticker: String(requestWithTicker.ticker ?? "").trim(),
            });
          }

          if (request && "input" in request) {
            const identifier = String(request.input?.identifier || "").trim();
            return deps.extractIsinCountryCode({
              ticker: identifier,
            });
          }

          return deps.extractIsinCountryCode({});
        },
        refs: createPlanRuntimeRefs(deps),
      });
    },
    planSpecsByCode: deps.planSpecsByCode,
    resolversByCode: deps.resolversByCode,
  };
}
