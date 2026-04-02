import type { ResolverSpec } from "./plan-specs";
import type { ResolverNode } from "./planner";
import {
  getResolverByCode,
  registerResolver,
  type ResolverRegistry,
} from "./resolver-registry";

export interface ResolverClassLike {
  fromSpec(code: string, spec: ResolverSpec): ResolverNode;
}

export interface ResolverMaterializationDependencies {
  registry?: ResolverRegistry;
  resolverClassesByName: Record<string, ResolverClassLike | undefined>;
}

function normalizeCode(code: string): string {
  return String(code || "")
    .trim()
    .toUpperCase();
}

export function materializeResolversByCode(
  resolverSpecs: Record<string, ResolverSpec>,
  deps: ResolverMaterializationDependencies,
): ResolverRegistry {
  const registry = deps.registry || {};

  Object.keys(resolverSpecs || {}).forEach((code) => {
    const normalizedCode = normalizeCode(code);
    const spec = resolverSpecs[code] as ResolverSpec;
    const ResolverClass = deps.resolverClassesByName[spec.resolverClass] || null;

    if (!ResolverClass) {
      throw new Error(
        `Unknown resolver class "${String(spec.resolverClass || "")}" for "${normalizedCode}".`,
      );
    }

    registerResolver(registry, ResolverClass.fromSpec(normalizedCode, spec));
  });

  return registry;
}

export function getMaterializedResolverByCode(
  registry: ResolverRegistry,
  code: string,
): ResolverNode | null {
  return getResolverByCode(registry, code);
}
