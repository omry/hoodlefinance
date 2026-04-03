import type { ResolverNode } from "./planner";

export type ResolverRegistryByCode = Record<string, ResolverNode>;

export type ResolverRegistryByName = Record<string, ResolverNode>;

export interface MaterializedResolverRegistry {
  byCode: ResolverRegistryByCode;
  byName: ResolverRegistryByName;
}

function normalizeKey(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function getResolverByCode(
  registry: ResolverRegistryByCode,
  code: string,
): ResolverNode | null {
  return registry[normalizeKey(code)] || null;
}

export function getRegisteredResolverByName(
  registry: ResolverRegistryByName,
  name: string,
): ResolverNode | null {
  return registry[normalizeKey(name)] || null;
}

export function registerResolver(
  registry: ResolverRegistryByName,
  resolver: ResolverNode,
): ResolverNode {
  const name = normalizeKey((resolver && resolver.name) || "");
  const existing = name ? registry[name] || null : null;

  if (existing && existing !== resolver) {
    throw new Error(
      `Resolver name "${name}" is already registered to a different resolver.`,
    );
  }

  if (name) {
    registry[name] = resolver;
  }

  return resolver;
}
