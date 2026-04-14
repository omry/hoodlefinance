import type { ResolveFlow } from "./resolve-flow";
import type { Graph } from "./graph";
import type { SelectNextContext } from "./core-resolvers";
import { RoutingNodeKind } from "./planner";
import { getGraphNodeNextIds } from "./graph";

// ROOT (RequestClassifierResolver) outputs { requestInput, resolvedRequest }.
// Downstream nodes expect ResolvedRequest (non-ISIN) or RequestInput (ISIN).
// Detect and unwrap so the correct type flows to plan-node canHandle checks.
function isClassifiedInput(
  value: unknown,
): value is { requestInput: object; resolvedRequest: object | null } {
  return (
    value != null &&
    typeof value === "object" &&
    "requestInput" in (value as object) &&
    "resolvedRequest" in (value as object)
  );
}

export enum EnvelopeStatus {
  Success = "success",
  Failure = "failure",
  TerminalFailure = "terminal_failure",
}

export interface Envelope {
  value: object;
  // status is absent on input; the driver always sets it on output.
  status?: EnvelopeStatus;
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
        throw new Error(`Routing node "${node.id}" selected a child without a code.`);
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

  execute(input: Envelope): Envelope {
    const graph = this.#flow.getGraph();
    const root = graph.getRoot();
    if (!root) {
      throw new Error("Graph has no ROOT node.");
    }
    return this.#executeNode(root, input, graph);
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
  ): Envelope {
    const kind = resolver.getRoutingNodeKind();
    const childNodes = this.#getChildNodes(node, graph);
    const selectionContext: SelectNextContext = {};

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
          );

          if (childResult.status !== EnvelopeStatus.Success) {
            return childResult;
          }
        }

        return envelope;
      }

      const childResult = this.#executeNode(
        selectedChildren[0] as Graph.Node,
        envelope,
        graph,
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
    }

    const exhaustedStatus =
      kind === RoutingNodeKind.TryEach
        ? EnvelopeStatus.TerminalFailure
        : EnvelopeStatus.Failure;
    return { value: envelope.value, status: exhaustedStatus };
  }

  #executeNode(
    node: Graph.Node,
    envelope: Envelope,
    graph: Graph.View,
  ): Envelope {
    const resolver = this.#flow.getResolver(node.id);
    if (!resolver) {
      // TERMINAL or unresolvable node — return current envelope as final result.
      return envelope;
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
      const result = resolver.resolve(envelope.value);
      if (result.status === "success") {
        outEnvelope = {
          value: result.value != null ? (result.value as object) : envelope.value,
          status: EnvelopeStatus.Success,
        };
      } else {
        outEnvelope = { value: envelope.value, status: EnvelopeStatus.Failure };
      }
    }

    if (outEnvelope.status !== EnvelopeStatus.Success) {
      return outEnvelope;
    }

    // Unwrap ClassifiedInput from ROOT: the classifier outputs
    // { requestInput, resolvedRequest } but children expect one type directly.
    if (
      node.id === graph.getRoot()?.id &&
      isClassifiedInput(outEnvelope.value)
    ) {
      const { resolvedRequest, requestInput } = outEnvelope.value;
      outEnvelope = {
        ...outEnvelope,
        value: (resolvedRequest ?? requestInput) as object,
      };
    }

    if (kind !== RoutingNodeKind.Leaf) {
      return this.#executeRoutingNode(node, resolver, outEnvelope, graph);
    }

    const childNodes = this.#getChildNodes(node, graph);

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
      );
      if (childResult.status === EnvelopeStatus.TerminalFailure) {
        return childResult;
      }
      if (childResult.status !== EnvelopeStatus.Failure) {
        return childResult;
      }
      // child subtree failed — try next sibling
    }

    // All eligible next edges exhausted.
    // try each exhaustion is terminal because it is explicit failover. leaf
    // exhaustion remains a normal Failure so an ancestor try-each may keep
    // looking for another branch.
    return { value: outEnvelope.value, status: EnvelopeStatus.Failure };
  }
}
