import type { Resolver } from "./resolver-classes";

export type ResolverRegistryByCode = Record<string, Resolver>;

export type ResolverRegistryByName = Record<string, Resolver>;

export interface MaterializedResolverRegistry {
  byCode: ResolverRegistryByCode;
  byName: ResolverRegistryByName;
}

function normalizeKey(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function getRegisteredResolverByName(
  registry: ResolverRegistryByName,
  name: string,
): Resolver | null {
  return registry[normalizeKey(name)] || null;
}

export function registerResolver(
  registry: ResolverRegistryByName,
  resolver: Resolver,
): Resolver {
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
