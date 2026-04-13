import type { ResolveFlow } from "./resolve-flow";
import type { Graph } from "./graph";
import { getGraphNodeNextIds } from "./graph";

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

    const result = resolver.resolve(envelope.value);

    let outEnvelope: Envelope;
    if (result.status === "success") {
      outEnvelope = {
        value: result.value != null ? (result.value as object) : envelope.value,
        status: EnvelopeStatus.Success,
      };
    } else {
      outEnvelope = { value: envelope.value, status: EnvelopeStatus.Failure };
    }

    if (outEnvelope.status !== EnvelopeStatus.Success) {
      return outEnvelope;
    }

    const nextIds = getGraphNodeNextIds(node);
    const kind = resolver.getRoutingNodeKind();

    if (kind === "step") {
      // All next edges must succeed in sequence. First failure stops execution.
      let current = outEnvelope;
      for (const nextId of nextIds) {
        const nextNode = graph.getNode(nextId);
        if (!nextNode) {
          continue;
        }
        const childResult = await this.#executeNode(nextNode, current, graph);
        if (childResult.status !== EnvelopeStatus.Success) {
          return childResult;
        }
        current = childResult;
      }
      return current;
    }

    // "switch", "try each", "leaf": try next edges in declaration order,
    // return first non-failure.
    for (const nextId of nextIds) {
      const nextNode = graph.getNode(nextId);
      if (!nextNode) {
        continue;
      }
      const childResult = await this.#executeNode(nextNode, outEnvelope, graph);
      if (childResult.status === EnvelopeStatus.TerminalFailure) {
        return childResult;
      }
      if (childResult.status !== EnvelopeStatus.Failure) {
        return childResult;
      }
      // child subtree failed — try next sibling
    }

    // All next edges exhausted.
    // TerminalFailure is produced here and only here in the driver — when a
    // "try each" node has tried every child and none succeeded. It signals that
    // the attempt is unrecoverable: no ancestor switch or try-each may retry this
    // branch. Failure (non-terminal) is returned for switch/leaf so an ancestor
    // can still try another branch.
    const exhaustedStatus =
      kind === "try each"
        ? EnvelopeStatus.TerminalFailure
        : EnvelopeStatus.Failure;
    return { value: outEnvelope.value, status: exhaustedStatus };
  }
}
