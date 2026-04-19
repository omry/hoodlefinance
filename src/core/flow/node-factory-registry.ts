import { Resolver, ResolverPlan } from "./core-resolvers";
import type { ResolverPlanOptions } from "./resolver";

export type LeafConstructor = new(code: string) => Resolver;
export type PlanConstructor = new(code: string, nodes: Resolver[], options?: ResolverPlanOptions) => Resolver;

export class NodeFactoryRegistry {
  readonly #entries: Map<string, LeafConstructor | PlanConstructor> = new Map();

  register(name: string, ctor: new(...args: any[]) => unknown): this {
    if (!(ctor.prototype instanceof Resolver)) {
      throw new Error(`"${name}" must extend Resolver.`);
    }
    this.#entries.set(name, ctor as LeafConstructor | PlanConstructor);
    return this;
  }

  registerLeaf(name: string, ctor: LeafConstructor): this {
    return this.register(name, ctor);
  }

  registerPlan(name: string, ctor: PlanConstructor): this {
    if (!(ctor.prototype instanceof ResolverPlan)) {
      throw new Error(`"${name}" must extend ResolverPlan.`);
    }
    return this.register(name, ctor);
  }

  get(name: string): LeafConstructor | PlanConstructor | undefined {
    return this.#entries.get(name);
  }
}
