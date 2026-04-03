import type { ResolverSpec } from "./plan-specs";
import type { ResolverNode } from "./planner";
import {
  getResolverByCode,
  registerResolver,
  type MaterializedResolverRegistry,
  type ResolverRegistryByCode,
  type ResolverRegistryByName,
} from "./resolver-registry";

export interface ResolverClassLike {
  fromSpec(code: string, spec: ResolverSpec, deps?: unknown): ResolverNode;
}

export interface ResolverMaterializationDependencies {
  registryByCode?: ResolverRegistryByCode;
  registryByName?: ResolverRegistryByName;
  resolverClassDependenciesByName?: Record<string, unknown>;
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
): MaterializedResolverRegistry {
  const byCode = deps.registryByCode || {};
  const byName = deps.registryByName || {};

  Object.keys(resolverSpecs || {}).forEach((code) => {
    const normalizedCode = normalizeCode(code);
    const spec = resolverSpecs[code] as ResolverSpec;
    const ResolverClass = deps.resolverClassesByName[spec.resolverClass] || null;

    if (!ResolverClass) {
      throw new Error(
        `Unknown resolver class "${String(spec.resolverClass || "")}" for "${normalizedCode}".`,
      );
    }

    const resolver = ResolverClass.fromSpec(
      normalizedCode,
      spec,
      deps.resolverClassDependenciesByName?.[spec.resolverClass],
    );

    registerResolver(byName, resolver);
    byCode[normalizedCode] = resolver;
  });

  return {
    byCode,
    byName,
  };
}

export function getMaterializedResolverByCode(
  registry: MaterializedResolverRegistry,
  code: string,
): ResolverNode | null {
  return getResolverByCode(registry.byCode, code);
}
