import type { ResolveFlow } from "./resolve-flow";
import type { Graph } from "./graph";
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

  async execute(input: Envelope): Promise<Envelope> {
    const graph = this.#flow.getGraph();
    const root = graph.getRoot();
    if (!root) {
      throw new Error("Graph has no ROOT node.");
    }
    return this.#executeNode(root, input, graph);
  }

  async #executeNode(
    node: Graph.Node,
    envelope: Envelope,
    graph: Graph.View,
  ): Promise<Envelope> {
    const resolver = this.#flow.getResolver(node.id);
    if (!resolver) {
      // TERMINAL or unresolvable node — return current envelope as final result.
      return envelope;
    }

    const kind = resolver.getRoutingNodeKind();

    // Plan nodes (switch / try-each / step) are routing containers; calling
    // their legacy resolve() runs the full pipeline and breaks the model.
    // Gate them via canHandle: pass the envelope through unchanged when the
    // node can accept it, fail immediately when it cannot.
    // Leaf nodes (resolvers that do real work) use resolve() as normal.
    let outEnvelope: Envelope;
    if (kind !== "leaf") {
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

    const childNodes = this.#getChildNodes(node, graph);

    if (kind === "step") {
      // step: fan out the current output to every next node. There is no
      // request-based filtering yet; all next nodes are expected to accept the
      // current output shape.
      for (const childNode of childNodes) {
        if (!this.#childCanHandle(childNode, outEnvelope.value)) {
          throw new Error(
            `Step node "${node.id}" has child "${childNode.id}" that cannot handle the current output.`,
          );
        }
      }

      for (const childNode of childNodes) {
        const childResult = await this.#executeNode(
          childNode,
          outEnvelope,
          graph,
        );
        if (childResult.status !== EnvelopeStatus.Success) {
          return childResult;
        }
      }
      return outEnvelope;
    }

    if (kind === "switch") {
      // switch: route to the one matching child. This is selection, not
      // failover; a selected child may fail and we do not try siblings.
      const matchingChildren = childNodes.filter((childNode) =>
        this.#childCanHandle(childNode, outEnvelope.value),
      );

      if (!matchingChildren.length) {
        return { value: outEnvelope.value, status: EnvelopeStatus.Failure };
      }

      if (matchingChildren.length > 1) {
        throw new Error(
          `Switch node "${node.id}" matched multiple children: ${matchingChildren
            .map((childNode) => childNode.id)
            .join(", ")}.`,
        );
      }

      const selectedChild = matchingChildren[0];
      if (!selectedChild) {
        return { value: outEnvelope.value, status: EnvelopeStatus.Failure };
      }

      return this.#executeNode(selectedChild, outEnvelope, graph);
    }

    // try each: try each handleable child in declaration order until one
    // succeeds. Exhaustion is terminal. leaf nodes keep the same ordered
    // fallback behavior, but exhaustion is a normal Failure.
    for (const childNode of childNodes) {
      if (!this.#childCanHandle(childNode, outEnvelope.value)) {
        continue;
      }
      const childResult = await this.#executeNode(
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
    const exhaustedStatus =
      kind === "try each"
        ? EnvelopeStatus.TerminalFailure
        : EnvelopeStatus.Failure;
    return { value: outEnvelope.value, status: exhaustedStatus };
  }
}
