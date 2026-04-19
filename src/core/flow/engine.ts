import type { ResolveFlow } from "./resolve-flow";
import type { Graph } from "./graph";
import type { ExecutionContext, SelectNextContext } from "./resolver";
import { RoutingNodeKind } from "./resolver";
import { getGraphNodeNextIds } from "./graph";

export enum EnvelopeStatus {
  Success = "success",
  Failure = "failure",
  TerminalFailure = "terminal_failure",
}

export interface Envelope {
  value: object;
  error?: string;
  // status is absent on input; the driver always sets it on output.
  status?: EnvelopeStatus;
  // Internal bounded-execution marker so callers can stop at a declared node
  // without continuing through sibling branches.
  didReachStopNode?: boolean;
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
  readonly #flow: ResolveFlow;

  constructor(flow: ResolveFlow) {
    this.#flow = flow;
  }

  #getChildNodes(node: Graph.Node, graph: Graph.View): Graph.Node[] {
    return getGraphNodeNextIds(node)
      .map((nextId) => graph.getNode(nextId))
      .filter((nextNode): nextNode is Graph.Node => nextNode != null);
  }

  #childCanHandle(childNode: Graph.Node, value: object): boolean {
    const childResolver = this.#flow.getResolver(childNode.id);
    return !childResolver?.canHandle || childResolver.canHandle(value);
  }

  #getSelectedChild(
    node: Graph.Node,
    resolver: {
      selectNext(
        request: unknown,
        context?: SelectNextContext,
      ): Array<{ code: string }>;
    },
    request: object,
    childNodes: Graph.Node[],
    context: SelectNextContext,
  ): Graph.Node[] {
    if (typeof resolver.selectNext !== "function") {
      throw new Error(`Routing node "${node.id}" must implement selectNext().`);
    }

    const selectedResolvers = resolver.selectNext(request, context);
    if (!selectedResolvers.length) {
      return [];
    }

    return selectedResolvers.map((selectedResolver) => {
      const selectedCode = String(selectedResolver.code || "").trim();
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
    resolver: {
      getRoutingNodeKind(): RoutingNodeKind;
      selectNext(
        request: unknown,
        context?: SelectNextContext,
      ): Array<{ code: string }>;
    },
    envelope: Envelope,
    graph: Graph.View,
    trace?: ExecutionTrace,
    stopNodeId?: string,
  ): Envelope {
    const kind = resolver.getRoutingNodeKind();
    const childNodes = this.#getChildNodes(node, graph);
    const selectionContext: SelectNextContext = {};
    let lastFailureError = "";

    while (true) {
      const selectedChildren = this.#getSelectedChild(
        node,
        resolver,
        envelope.value,
        childNodes,
        selectionContext,
      );

      if (!selectedChildren.length) {
        break;
      }

      if (kind !== RoutingNodeKind.Step && selectedChildren.length > 1) {
        throw new Error(
          `Routing node "${node.id}" selected ${selectedChildren.length} children; expected at most 1.`,
        );
      }

      if (kind === RoutingNodeKind.Step) {
        for (const selectedChild of selectedChildren) {
          const childResult = this.#executeNode(
            selectedChild,
            envelope,
            graph,
            trace,
            stopNodeId,
          );

          if (childResult.didReachStopNode) {
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

      if (kind === RoutingNodeKind.Switch) {
        return childResult;
      }

      if (childResult.status === EnvelopeStatus.TerminalFailure) {
        return childResult;
      }

      if (childResult.status !== EnvelopeStatus.Failure) {
        return childResult;
      }

      if (childResult.error) {
        lastFailureError = childResult.error;
      }
    }

    const exhaustedStatus =
      kind === RoutingNodeKind.TryEach
        ? EnvelopeStatus.TerminalFailure
        : EnvelopeStatus.Failure;
    return {
      value: envelope.value,
      ...(lastFailureError ? { error: lastFailureError } : {}),
      status: exhaustedStatus,
    };
  }

  #executeNode(
    node: Graph.Node,
    envelope: Envelope,
    graph: Graph.View,
    trace?: ExecutionTrace,
    stopNodeId?: string,
  ): Envelope {
    const resolver = this.#flow.getResolver(node.id);
    if (!resolver) {
      if (trace) {
        trace.visitedNodeIds.push(node.id);
      }
      // TERMINAL or unresolvable node — return current envelope as final result.
      return envelope;
    }

    if (trace) {
      trace.visitedNodeIds.push(node.id);
    }

    const kind = resolver.getRoutingNodeKind();

    // Non-leaf routing nodes do not perform leaf resolution here. They either
    // select a next child (switch), fan out to all children (step), or try
    // children in order (try each). Leaf nodes resolve values directly.
    let outEnvelope: Envelope;
    if (kind !== RoutingNodeKind.Leaf) {
      if (resolver.canHandle && !resolver.canHandle(envelope.value)) {
        return { value: envelope.value, status: EnvelopeStatus.Failure };
      }
      outEnvelope = { value: envelope.value, status: EnvelopeStatus.Success };
    } else {
      const executionContext: ExecutionContext = {
        callSubgraph: (id, input) => this.#flow.callSubgraph(id, input),
      };
      const result = resolver.resolve(envelope.value, executionContext);
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
        didReachStopNode: true,
      };
    }

    if (kind !== RoutingNodeKind.Leaf) {
      return this.#executeRoutingNode(
        node,
        resolver,
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

      if (childResult.didReachStopNode) {
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
