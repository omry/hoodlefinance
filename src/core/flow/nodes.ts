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

  // Called by the engine on routing nodes to determine which child(ren) to
  // execute next. Returns all children for StepJunction, 0-or-1 for Switch/
  // FirstSuccess. context.selectedNodeCodes tracks already-dispatched children
  // across repeated calls within the same traversal. Throws on leaf nodes —
  // the engine checks getNodeKind() first so this is never reached.
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

  getNodesForRequest(request: unknown): FlowNode[] {
    const nodes = (this.nodes || []).slice();

    if (!nodes.length) {
      return nodes;
    }

    const firstMatchingIndex = nodes.findIndex(
      (node) => node.canHandle(request),
    );

    if (firstMatchingIndex < 0) {
      return nodes;
    }

    return nodes.slice(firstMatchingIndex);
  }

  getHandleableNodesForRequest(request: unknown): FlowNode[] {
    return (this.nodes || []).filter((node) => node.canHandle(request));
  }

  getRoutingNodes(): FlowNode[] {
    return (this.nodes || []).slice();
  }

  canHandle(request: unknown): boolean {
    return this.getHandleableNodesForRequest(request).length > 0;
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

// ---------------------------------------------------------------------------
// Junction kind base classes — driver dispatch table uses these to determine
// how each graph node is traversed: switch selects one child explicitly via
// selectNext(), step returns all children in one selection, try-each selects
// one child per call in order with fallback.
// ---------------------------------------------------------------------------

export class SwitchJunction extends FlowJunction {
  getNodeKind(): NodeKind {
    return NodeKind.Switch;
  }

  selectNext(request: unknown, context: SelectNextContext = {}): SelectedNodes {
    if (this.getSelectedNodeCodes(context).size > 0) {
      return [];
    }

    const matchingNodes = this.getHandleableNodesForRequest(request);

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

export class StepJunction extends FlowJunction {
  getNodeKind(): NodeKind {
    return NodeKind.Step;
  }

  getNodesForRequest(_request: unknown): FlowNode[] {
    return (this.nodes || []).slice();
  }

  selectNext(request: unknown, context: SelectNextContext = {}): SelectedNodes {
    const routingNodes = this.getRoutingNodes();
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
      this.getHandleableNodesForRequest(request),
      context,
    );

    const selectedNode = this.markSelectedNode(
      remainingNodes[0] ?? null,
      context,
    );
    return selectedNode ? [selectedNode] : [];
  }
}
