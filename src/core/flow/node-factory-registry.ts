import { FlowNode, FlowJunction } from "./core-resolvers";

export type LeafConstructor = new(code: string) => FlowNode;
export type PlanConstructor = new(code: string, nodes: FlowNode[]) => FlowNode;

export class NodeFactoryRegistry {
  readonly #entries: Map<string, LeafConstructor | PlanConstructor> = new Map();

  register(name: string, ctor: new(...args: any[]) => unknown): this {
    if (!(ctor.prototype instanceof FlowNode)) {
      throw new Error(`"${name}" must extend FlowNode.`);
    }
    this.#entries.set(name, ctor as LeafConstructor | PlanConstructor);
    return this;
  }

  registerLeaf(name: string, ctor: LeafConstructor): this {
    return this.register(name, ctor);
  }

  registerPlan(name: string, ctor: PlanConstructor): this {
    if (!(ctor.prototype instanceof FlowJunction)) {
      throw new Error(`"${name}" must extend FlowJunction.`);
    }
    return this.register(name, ctor);
  }

  get(name: string): LeafConstructor | PlanConstructor | undefined {
    return this.#entries.get(name);
  }
}
