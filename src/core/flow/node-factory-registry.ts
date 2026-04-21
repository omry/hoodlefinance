import { FlowNode, FlowJunction } from "./nodes";

export type LeafConstructor = new(code: string, env?: any) => FlowNode;
export type JunctionConstructor = new(
  code: string,
  nodes: FlowNode[],
  env?: any,
) => FlowNode;

export class NodeFactoryRegistry {
  readonly #entries: Map<string, LeafConstructor | JunctionConstructor> =
    new Map();

  register(name: string, ctor: new(...args: any[]) => unknown): this {
    if (!(ctor.prototype instanceof FlowNode)) {
      throw new Error(`"${name}" must extend FlowNode.`);
    }
    this.#entries.set(name, ctor as LeafConstructor | JunctionConstructor);
    return this;
  }

  get(name: string): LeafConstructor | JunctionConstructor | undefined {
    return this.#entries.get(name);
  }
}
