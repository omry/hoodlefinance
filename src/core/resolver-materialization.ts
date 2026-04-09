import type { ResolverNode } from "./planner";
import {
  getResolverByCode,
  registerResolver,
  type MaterializedResolverRegistry,
  type ResolverRegistryByCode,
  type ResolverRegistryByName,
} from "./resolver-registry";
import type { ResolverServices } from "./resolver-services";

export interface ResolverClass {
  fromSpec(code: string): ResolverNode;
}

export interface ResolverMaterializationDependencies {
  registryByCode?: ResolverRegistryByCode;
  registryByName?: ResolverRegistryByName;
  resolverClassesByName: Record<string, ResolverClass | undefined>;
  resolverServices?: ResolverServices;
}

function normalizeCode(code: string): string {
  return String(code || "")
    .trim()
    .toUpperCase();
}

export function materializeResolversByCode(
  resolverSpecs: Record<string, string>,
  deps: ResolverMaterializationDependencies,
): MaterializedResolverRegistry {
  const byCode = deps.registryByCode || {};
  const byName = deps.registryByName || {};

  Object.keys(resolverSpecs || {}).forEach((code) => {
    const normalizedCode = normalizeCode(code);
    const resolverClass = resolverSpecs[code] as string;
    const ResolverClass = deps.resolverClassesByName[resolverClass] || null;

    if (!ResolverClass) {
      throw new Error(
        `Unknown resolver class "${String(resolverClass || "")}" for "${normalizedCode}".`,
      );
    }

    const resolver = ResolverClass.fromSpec(normalizedCode);

    if (deps.resolverServices && typeof resolver.initEnv === "function") {
      resolver.initEnv(deps.resolverServices);
    }

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
