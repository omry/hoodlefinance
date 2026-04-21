import type { Flow } from "./flow";
import type { Graph } from "./graph";
import type { ExecutionContext, SelectNextContext } from "./types";
import { NodeKind } from "./types";
import { getGraphNodeNextIds } from "./graph";

export enum EnvelopeStatus {
  Success = "success",
  Failure = "failure",
}

export interface Envelope {
  value: object;
  error?: string;
  // status is absent on input; the driver always sets it on output.
  status?: EnvelopeStatus;
}

// Not exported — used only within FlowEngine to propagate bounded-execution
// stop signals between private methods without leaking them to callers.
interface InternalEnvelope extends Envelope {
  _didReachStopNode?: boolean;
}

export interface SubgraphCallTrace {
  error?: string;
  path: string[];
  route: string;
  status: "failure" | "success";
  subgraphId: string;
}

export interface ExecutionTrace {
  visitedNodeIds: string[];
  subgraphCallTraces?: SubgraphCallTrace[];
}

export class FlowEngine {
  readonly #flow: Flow;

  constructor(flow: Flow) {
    this.#flow = flow;
  }

  #getChildNodes(node: Graph.Node, graph: Graph.View): Graph.Node[] {
    return getGraphNodeNextIds(node)
      .map((nextId) => graph.getNode(nextId))
      .filter((nextNode): nextNode is Graph.Node => nextNode != null);
  }

  #childCanHandle(childNode: Graph.Node, value: object): boolean {
    const childFlowNode = this.#flow.getNode(childNode.id);
    if (!childFlowNode) {
      return true;
    }
    return childFlowNode.canHandle(value);
  }

  #getSelectedChild(
    node: Graph.Node,
    flowNode: {
      selectNext(
        request: unknown,
        context?: SelectNextContext,
      ): Array<{ id: string }>;
    },
    request: object,
    childNodes: Graph.Node[],
    context: SelectNextContext,
  ): Graph.Node[] {
    if (typeof flowNode.selectNext !== "function") {
      throw new Error(`Routing node "${node.id}" must implement selectNext().`);
    }

    const selectedNodes = flowNode.selectNext(request, context);
    if (!selectedNodes.length) {
      return [];
    }

    return selectedNodes.map((selectedNode) => {
      const selectedCode = String(selectedNode.id || "").trim();
      if (!selectedCode) {
        throw new Error(
          `Routing node "${node.id}" selected a child without a code.`,
        );
      }

      const selectedChild = childNodes.find(
        (childNode) => childNode.id === selectedCode,
      );

      if (!selectedChild) {
        throw new Error(
          `Routing node "${node.id}" selected unknown child "${selectedCode}".`,
        );
      }

      return selectedChild;
    });
  }

  execute(input: Envelope, trace?: ExecutionTrace): Envelope {
    const graph = this.#flow.getGraph();
    const root = graph.getRoot();
    if (!root) {
      throw new Error("Graph has no ROOT node.");
    }
    return this.#executeNode(root, input, graph, trace);
  }

  executeFromNodeId(
    nodeId: string,
    input: Envelope,
    trace?: ExecutionTrace,
  ): Envelope {
    const graph = this.#flow.getGraph();
    const node = graph.getNode(nodeId);

    if (!node) {
      throw new Error(`Graph has no node "${String(nodeId || "")}".`);
    }

    return this.#executeNode(node, input, graph, trace);
  }

  executeBounded(
    rootNodeId: string,
    terminalNodeId: string,
    input: Envelope,
    trace?: ExecutionTrace,
  ): Envelope {
    const graph = this.#flow.getGraph();
    const rootNode = graph.getNode(rootNodeId);

    if (!rootNode) {
      throw new Error(`Graph has no node "${String(rootNodeId || "")}".`);
    }

    if (!graph.getNode(terminalNodeId)) {
      throw new Error(`Graph has no node "${String(terminalNodeId || "")}".`);
    }

    return this.#executeNode(rootNode, input, graph, trace, terminalNodeId);
  }

  #executeRoutingNode(
    node: Graph.Node,
    flowNode: {
      getNodeKind(): NodeKind;
      selectNext(
        request: unknown,
        context?: SelectNextContext,
      ): Array<{ id: string }>;
    },
    envelope: Envelope,
    graph: Graph.View,
    trace?: ExecutionTrace,
    stopNodeId?: string,
  ): InternalEnvelope {
    const kind = flowNode.getNodeKind();
    const childNodes = this.#getChildNodes(node, graph);
    const selectionContext: SelectNextContext = {};
    let lastFailureError = "";

    while (true) {
      const selectedChildren = this.#getSelectedChild(
        node,
        flowNode,
        envelope.value,
        childNodes,
        selectionContext,
      );

      if (!selectedChildren.length) {
        break;
      }

      if (kind !== NodeKind.Step && selectedChildren.length > 1) {
        throw new Error(
          `Routing node "${node.id}" selected ${selectedChildren.length} children; expected at most 1.`,
        );
      }

      if (kind === NodeKind.Step) {
        for (const selectedChild of selectedChildren) {
          const childResult = this.#executeNode(
            selectedChild,
            envelope,
            graph,
            trace,
            stopNodeId,
          );

          if (childResult._didReachStopNode) {
            return childResult;
          }

          if (childResult.status !== EnvelopeStatus.Success) {
            if (childResult.error) {
              lastFailureError = childResult.error;
            }
            return childResult;
          }
        }

        return envelope;
      }

      const childResult = this.#executeNode(
        selectedChildren[0] as Graph.Node,
        envelope,
        graph,
        trace,
        stopNodeId,
      );

      if (kind === NodeKind.Switch) {
        return childResult;
      }

      if (childResult.status !== EnvelopeStatus.Failure) {
        return childResult;
      }

      if (childResult.error) {
        lastFailureError = childResult.error;
      }
    }

    const error =
      lastFailureError ||
      (kind === NodeKind.TryEach
        ? `exhausted all options in node ${node.id} [${childNodes.map((n) => n.id).join(", ")}]`
        : "");
    return {
      value: envelope.value,
      ...(error ? { error } : {}),
      status: EnvelopeStatus.Failure,
    };
  }

  #executeNode(
    node: Graph.Node,
    envelope: Envelope,
    graph: Graph.View,
    trace?: ExecutionTrace,
    stopNodeId?: string,
  ): InternalEnvelope {
    const flowNode = this.#flow.getNode(node.id);
    if (!flowNode) {
      if (trace) {
        trace.visitedNodeIds.push(node.id);
      }
      // TERMINAL or non-executable node — return current envelope as final result.
      return envelope;
    }

    if (trace) {
      trace.visitedNodeIds.push(node.id);
    }

    const kind = flowNode.getNodeKind();

    // Non-leaf routing nodes do not perform leaf resolution here. They either
    // select a next child (switch), fan out to all children (step), or try
    // children in order (try each). Leaf nodes compute values directly.
    let outEnvelope: Envelope;
    if (kind !== NodeKind.Leaf) {
      if (flowNode.canHandle && !flowNode.canHandle(envelope.value)) {
        return { value: envelope.value, status: EnvelopeStatus.Failure };
      }
      outEnvelope = { value: envelope.value, status: EnvelopeStatus.Success };
    } else {
      const executionContext: ExecutionContext = {
        callSubgraph: (id, input) => this.#flow.callSubgraph(id, input),
      };
      const result = flowNode.execute(envelope.value, executionContext);
      if (result.status === "success") {
        outEnvelope = {
          value:
            result.value != null ? (result.value as object) : envelope.value,
          status: EnvelopeStatus.Success,
        };
      } else {
        const error = String(result.error || "").trim();
        outEnvelope = {
          value: envelope.value,
          ...(error ? { error } : {}),
          status: EnvelopeStatus.Failure,
        };
      }
    }

    if (outEnvelope.status !== EnvelopeStatus.Success) {
      return outEnvelope;
    }

    if (node.id === stopNodeId) {
      return {
        ...outEnvelope,
        _didReachStopNode: true,
      };
    }

    if (kind !== NodeKind.Leaf) {
      return this.#executeRoutingNode(
        node,
        flowNode,
        outEnvelope,
        graph,
        trace,
        stopNodeId,
      );
    }

    const childNodes = this.#getChildNodes(node, graph);
    let lastFailureError = "";

    // try each: try each handleable child in declaration order until one
    // succeeds. Exhaustion is terminal. leaf nodes keep the same ordered
    // fallback behavior, but exhaustion is a normal Failure.
    for (const childNode of childNodes) {
      if (!this.#childCanHandle(childNode, outEnvelope.value)) {
        continue;
      }
      const childResult = this.#executeNode(
        childNode,
        outEnvelope,
        graph,
        trace,
        stopNodeId,
      );

      if (childResult._didReachStopNode) {
        return childResult;
      }

      if (childResult.status === EnvelopeStatus.Success) {
        return childResult;
      }

      if (childResult.error) {
        lastFailureError = childResult.error;
      }
    }

    return {
      value: outEnvelope.value,
      ...(lastFailureError ? { error: lastFailureError } : {}),
      status: EnvelopeStatus.Failure,
    };
  }
}
