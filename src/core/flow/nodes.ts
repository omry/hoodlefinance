import {
  createResolutionFailure,
  createResolutionSuccess,
  type ExecutionContext,
  type ResolutionResult,
  NodeKind,
  type SelectNextContext,
} from "./types";

type SelectedNodes = FlowNode[];

function formatExecutionError(error: unknown): string {
  return String(error instanceof Error ? error.message : (error ?? ""));
}

export class FlowNode {
  readonly id: string;
  readonly traceLabel?: string;

  constructor(id = "") {
    this.id = id || "";
  }

  canHandle(_request: unknown): boolean {
    return true;
  }

  getNodeKind(): NodeKind {
    return NodeKind.Leaf;
  }

  // Returns the child(ren) selected for the current request. Implementations
  // may consult context.selectedNodeCodes to avoid re-selecting the same
  // children across repeated calls within a single traversal. Throws on leaf
  // nodes.
  selectNext(
    _request: unknown,
    _context: SelectNextContext = {},
  ): SelectedNodes {
    throw new Error(
      `FlowNode "${this.id}" does not support selectNext(); only routing nodes with explicit selection semantics may select next children.`,
    );
  }

  execute(
    request: unknown,
    context?: ExecutionContext,
  ): ResolutionResult<unknown> {
    const startedAtMs = Date.now();

    try {
      const value = this.run(request, context);
      return createResolutionSuccess(value, Date.now() - startedAtMs);
    } catch (error) {
      return createResolutionFailure(
        error,
        Date.now() - startedAtMs,
        formatExecutionError,
      );
    }
  }

  run(_request: unknown, _context?: ExecutionContext): unknown {
    throw new Error(`FlowNode "${this.id}" must implement run().`);
  }
}

export abstract class FlowJunction extends FlowNode {
  readonly nodes: FlowNode[];

  constructor(name: string, nodes: FlowNode[]) {
    super(name);
    this.nodes = nodes || [];
  }

  getHandleableNodes(request: unknown): FlowNode[] {
    return (this.nodes || []).filter((node) => node.canHandle(request));
  }

  canHandle(request: unknown): boolean {
    return this.getHandleableNodes(request).length > 0;
  }

  protected getSelectedNodeCodes(
    context: SelectNextContext | null | undefined,
  ): Set<string> {
    if (!context) {
      return new Set<string>();
    }

    if (!(context.selectedNodeCodes instanceof Set)) {
      context.selectedNodeCodes = new Set<string>();
    }

    return context.selectedNodeCodes;
  }

  protected getNodeSelectionCode(
    node: FlowNode | null | undefined,
  ): string {
    return String((node && node.id) || "")
      .trim()
      .toUpperCase();
  }

  protected markSelectedNode(
    node: FlowNode | null | undefined,
    context: SelectNextContext | null | undefined,
  ): FlowNode | null {
    if (!node || !context) {
      return node || null;
    }

    const selectionCode = this.getNodeSelectionCode(node);
    if (!selectionCode) {
      return node;
    }

    const selectedNodeCodes = this.getSelectedNodeCodes(context);
    selectedNodeCodes.add(selectionCode);

    return node;
  }

  protected getUnselectedNodes(
    nodes: Array<FlowNode | null | undefined>,
    context: SelectNextContext | null | undefined,
  ): FlowNode[] {
    const selected = this.getSelectedNodeCodes(context);
    return nodes.filter((node): node is FlowNode => {
      if (!node) return false;
      const code = this.getNodeSelectionCode(node);
      return !code || !selected.has(code);
    });
  }

  abstract getNodeKind(): NodeKind;
}

export class StepForwardNode extends FlowNode {
  getNodeKind(): NodeKind {
    return NodeKind.StepForward;
  }
}

export class TerminalCollectorNode extends FlowNode {
  override run(request: unknown): unknown {
    return request;
  }
}

// ---------------------------------------------------------------------------
// Junction kind base classes — driver dispatch table uses these to determine
// how each graph node is traversed: switch selects one child explicitly via
// selectNext(), fan-out returns all children in one selection, try-each
// selects one child per call in order with fallback.
// ---------------------------------------------------------------------------

export class SwitchJunction extends FlowJunction {
  getNodeKind(): NodeKind {
    return NodeKind.Switch;
  }

  selectNext(request: unknown, context: SelectNextContext = {}): SelectedNodes {
    if (this.getSelectedNodeCodes(context).size > 0) {
      return [];
    }

    const matchingNodes = this.getHandleableNodes(request);

    if (!matchingNodes.length) {
      return [];
    }

    if (matchingNodes.length > 1) {
      throw new Error(
        `FlowJunction "${this.id}" matched multiple nodes: ${matchingNodes
          .map((node) => node.id)
          .join(", ")}.`,
      );
    }

    const selectedNode = this.markSelectedNode(
      matchingNodes[0] ?? null,
      context,
    );
    return selectedNode ? [selectedNode] : [];
  }
}

export class FanOutJunction extends FlowJunction {
  getNodeKind(): NodeKind {
    return NodeKind.Step;
  }

  getHandleableNodes(_request: unknown): FlowNode[] {
    return (this.nodes || []).slice();
  }

  selectNext(request: unknown, context: SelectNextContext = {}): SelectedNodes {
    const routingNodes = this.getHandleableNodes(request);
    const blockingNode = routingNodes.find(
      (node) => node?.canHandle && !node.canHandle(request),
    );

    if (blockingNode) {
      throw new Error(
        `FlowJunction "${this.id}" has child "${blockingNode.id}" that cannot handle the current output.`,
      );
    }

    return this.getUnselectedNodes(routingNodes, context);
  }
}

export class FirstSuccessJunction extends FlowJunction {
  getNodeKind(): NodeKind {
    return NodeKind.TryEach;
  }

  selectNext(request: unknown, context: SelectNextContext = {}): SelectedNodes {
    const remainingNodes = this.getUnselectedNodes(
      this.getHandleableNodes(request),
      context,
    );

    const selectedNode = this.markSelectedNode(
      remainingNodes[0] ?? null,
      context,
    );
    return selectedNode ? [selectedNode] : [];
  }
}
