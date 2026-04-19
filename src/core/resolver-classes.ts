import type { ResolvedRequest } from "./request";
import { RawRequestInput, RequestInput } from "./request";

import { getGraphNodeNextIds, type Graph } from "./flow/graph";
export type { ExecutionContext, SelectNextContext } from "./flow/resolver";
export {
  FirstSuccessPlan,
  Resolver,
  ResolverPlan,
  StepPlan,
  SwitchPlan,
} from "./flow/core-resolvers";
import {
  FirstSuccessPlan,
  Resolver,
  ResolverPlan,
  StepPlan,
  SwitchPlan,
} from "./flow/core-resolvers";
import type { SelectNextContext } from "./flow/resolver";

export class IdentifierResolver extends Resolver {}

class AttributeResolver extends Resolver {}

export class BaseHFResolver extends AttributeResolver {
  readonly traceLabel: string;

  constructor(code: string, traceLabel?: string) {
    super(code);
    this.traceLabel = traceLabel || code;
  }

  batchKey(_job: unknown, _attempt: unknown): string {
    return "";
  }

  getResolverClass(): string {
    return this.name;
  }

  getResolverPath(): string {
    return this.traceLabel;
  }

  protected override resolveTransformValue(
    value: unknown,
    request: unknown,
  ): unknown {
    if (value == null) return value;
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
      quote: value,
      attribute,
      tickerInput: identifier,
      input: request as ResolvedRequest,
    };
  }

  // Domain-specific resolver subclasses currently interpret the generic
  // flow-layer environment object here.
  // TODO: move env access into resolve context so resolvers do not retain it.
  initEnv(_env: unknown): void {}
}

export class RoutingPlan extends SwitchPlan {}

export class EquityAttributeResolutionPlan extends SwitchPlan {
  canHandle(request: unknown): boolean {
    return (
      !(request instanceof RawRequestInput) &&
      (request as { classification?: string }).classification === "equity" &&
      super.canHandle(request)
    );
  }
}

export class PseQuoteResolutionPlan extends FirstSuccessPlan {
  getExampleInput(): string | null {
    return "PSE:BDO";
  }
}

export class TickerQuoteResolutionPlan extends FirstSuccessPlan {}

export class FxAttributeResolutionPlan extends SwitchPlan {
  canHandle(request: unknown): boolean {
    return (
      !(request instanceof RawRequestInput) &&
      (request as { classification?: string }).classification === "fx" &&
      super.canHandle(request)
    );
  }

  constructor(name: string, nodes: Resolver[]) {
    super(name, nodes);
    if (this.nodes.length < 2) {
      throw new Error(
        `FxAttributeResolutionPlan "${this.name}" expects at least 2 nodes (local and resolver).`,
      );
    }
  }

  selectNext(request: unknown, context: SelectNextContext = {}): Resolver[] {
    if (this.getSelectedNodeCodes(context).size > 0) {
      return [];
    }

    const localNode = this.nodes[0];
    if (localNode && (!localNode.canHandle || localNode.canHandle(request))) {
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

  getRoutingNodes(): Resolver[] {
    const routingNodes = [];
    if (this.nodes[0]) routingNodes.push(this.nodes[0]);
    if (this.nodes[1]) routingNodes.push(this.nodes[1]);
    return routingNodes;
  }
}

export const PLAN_RESOLVER_CLASSES_BY_NAME = {
  EquityAttributeResolutionPlan,
  FirstSuccessPlan,
  FxAttributeResolutionPlan,
  PseQuoteResolutionPlan,
  RoutingPlan,
  StepPlan,
  TickerQuoteResolutionPlan,
} as const;

export function buildPlanNodeFromSpec(
  code: string,
  spec: Graph.Node,
  resolveNode: (nodeCode: string) => Resolver | null,
): Resolver {
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
    nodes: (Resolver | null)[],
  ) => ResolverPlan;
  return new Ctor(code, getGraphNodeNextIds(spec).map(resolveNode));
}
