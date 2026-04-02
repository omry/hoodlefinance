import type { ResolverNode } from "./planner";

export type ResolverRegistry = Record<string, ResolverNode>;

export function getResolverByCode(
  registry: ResolverRegistry,
  code: string,
): ResolverNode | null {
  return (
    registry[
      String(code || "")
        .trim()
        .toUpperCase()
    ] || null
  );
}

export function registerResolver(
  registry: ResolverRegistry,
  resolver: ResolverNode,
): ResolverNode {
  const name = String((resolver && resolver.name) || "")
    .trim()
    .toUpperCase();
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
