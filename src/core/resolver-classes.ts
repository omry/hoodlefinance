import type { ResolvedRequest } from "./request";
import { RawRequestInput, RequestInput } from "./request";

import { getGraphNodeNextIds, type Graph } from "./flow/graph";
export type { ExecutionContext, SelectNextContext } from "./flow/resolver";
import type { ExecutionContext, ResolutionResult } from "./flow/resolver";
export {
  FirstSuccessJunction,
  FlowNode,
  FlowJunction,
  StepJunction,
  SwitchJunction,
} from "./flow/core-resolvers";
import {
  FirstSuccessJunction,
  FlowNode,
  FlowJunction,
  StepJunction,
  SwitchJunction,
} from "./flow/core-resolvers";
import type { SelectNextContext } from "./flow/resolver";

export class IdentifierResolver extends FlowNode {}

export class BaseHFResolver extends FlowNode {
  readonly traceLabel: string;

  constructor(id: string, traceLabel?: string) {
    super(id);
    this.traceLabel = traceLabel || id;
  }

  batchKey(_job: unknown, _attempt: unknown): string {
    return "";
  }

  override execute(
    request: unknown,
    context?: ExecutionContext,
  ): ResolutionResult<unknown> {
    const result = super.execute(request, context);
    if (result.status !== "success" || result.value == null) {
      return result;
    }

    let attribute: string;
    let identifier: string;
    if (request instanceof RawRequestInput || request instanceof RequestInput) {
      attribute = request.attribute;
      identifier = request.identifier;
    } else {
      const req = request as {
        input?: { attribute?: unknown; identifier?: unknown };
      };
      attribute = String(req.input?.attribute || "price");
      identifier = String(req.input?.identifier || "");
    }

    return {
      status: "success",
      elapsedMs: result.elapsedMs,
      value: {
        quote: result.value,
        attribute,
        tickerInput: identifier,
        input: request as ResolvedRequest,
      },
    };
  }

  // Domain-specific resolver subclasses currently interpret the generic
  // flow-layer environment object here.
  // TODO: move env access into resolve context so resolvers do not retain it.
  initEnv(_env: unknown): void {}
}

export class RoutingPlan extends SwitchJunction {}

export class EquityAttributeResolutionPlan extends SwitchJunction {
  canHandle(request: unknown): boolean {
    return (
      !(request instanceof RawRequestInput) &&
      (request as { classification?: string }).classification === "equity" &&
      super.canHandle(request)
    );
  }
}

export class PseQuoteResolutionPlan extends FirstSuccessJunction {}

export class TickerQuoteResolutionPlan extends FirstSuccessJunction {}

export class FxAttributeResolutionPlan extends SwitchJunction {
  canHandle(request: unknown): boolean {
    return (
      !(request instanceof RawRequestInput) &&
      (request as { classification?: string }).classification === "fx" &&
      super.canHandle(request)
    );
  }

  constructor(name: string, nodes: FlowNode[]) {
    super(name, nodes);
    if (this.nodes.length < 2) {
      throw new Error(
        `FxAttributeResolutionPlan "${this.id}" expects at least 2 nodes (local and resolver).`,
      );
    }
  }

  selectNext(request: unknown, context: SelectNextContext = {}): FlowNode[] {
    if (this.getSelectedNodeCodes(context).size > 0) {
      return [];
    }

    const localNode = this.nodes[0];
    if (localNode && localNode.canHandle(request)) {
      const selectedNode = this.markSelectedNode(localNode, context);
      return selectedNode ? [selectedNode] : [];
    }
    const resolverNode = this.nodes[1];
    if (!resolverNode) {
      return [];
    }

    const selectedNode = this.markSelectedNode(resolverNode, context);
    return selectedNode ? [selectedNode] : [];
  }

  getRoutingNodes(): FlowNode[] {
    const routingNodes = [];
    if (this.nodes[0]) routingNodes.push(this.nodes[0]);
    if (this.nodes[1]) routingNodes.push(this.nodes[1]);
    return routingNodes;
  }
}

export const PLAN_RESOLVER_CLASSES_BY_NAME = {
  EquityAttributeResolutionPlan,
  FirstSuccessPlan: FirstSuccessJunction,
  FxAttributeResolutionPlan,
  PseQuoteResolutionPlan,
  RoutingPlan,
  StepPlan: StepJunction,
  TickerQuoteResolutionPlan,
} as const;

export function buildPlanNodeFromSpec(
  code: string,
  spec: Graph.Node,
  resolveNode: (nodeCode: string) => FlowNode | null,
): FlowNode {
  const PlanClass =
    PLAN_RESOLVER_CLASSES_BY_NAME[
      spec.type as keyof typeof PLAN_RESOLVER_CLASSES_BY_NAME
    ];

  if (!PlanClass) {
    throw new Error(
      `Unknown plan resolver class "${String(spec.type || "")}" for "${code}".`,
    );
  }

  const Ctor = PlanClass as unknown as new (
    name: string,
    nodes: (FlowNode | null)[],
  ) => FlowJunction;
  return new Ctor(code, getGraphNodeNextIds(spec).map(resolveNode));
}
