import type { RouteJob, RuntimePlan } from "./planner";
import type { ResolvedRequest } from "./request";
import { RawRequestInput, RequestInput } from "./request";
import { buildPseQuoteRouteState, buildFxQuoteRouteState } from "./route-state";
import type { Graph } from "./graph";
import type { ResolverServices } from "./resolver-services";

export type { PlanRuntimeRefs, ResolverPlanOptions } from "./core-resolvers";
export {
  FirstSuccessPlan,
  Resolver,
  ResolverPlan,
  type SelectNextContext,
  StepPlan,
  SwitchPlan,
} from "./core-resolvers";
import {
  FirstSuccessPlan,
  Resolver,
  ResolverPlanOptions,
  type SelectNextContext,
  StepPlan,
  SwitchPlan,
  type PlanRuntimeRefs,
} from "./core-resolvers";

export class IdentifierResolver extends Resolver {}

class AttributeResolver extends Resolver {}

export class RouteExecutionResolver extends AttributeResolver {
  readonly traceLabel: string;

  constructor(code: string, traceLabel?: string) {
    super(code);
    this.traceLabel = traceLabel || code;
  }

  buildRouteState(_request: unknown): Record<string, unknown> {
    return {};
  }

  batchKey(_job: RouteJob, _attempt: unknown): string {
    return "";
  }

  executeBatch(_jobs: RouteJob[]): Array<Record<string, unknown> | null> {
    throw new Error(`Resolver "${this.name}" must implement executeBatch().`);
  }

  getRouteClass(_request: unknown): string {
    return this.name;
  }

  getRoutePath(_request: unknown): string {
    return this.traceLabel;
  }

  buildRuntimePlan(request: unknown): RuntimePlan {
    return {
      nodes: [this],
      routeClass: this.getRouteClass(request),
      routePath: this.getRoutePath(request),
      routeState: this.buildRouteState(request),
    };
  }

  initEnv(_services: ResolverServices): void {}
}

export class RoutingPlan extends SwitchPlan {}

export class EquityAttributeResolutionPlan extends SwitchPlan {
  canHandle(request: unknown): boolean {
    return (
      !(request instanceof RawRequestInput) &&
      (request as RequestInput).classification === "equity" &&
      super.canHandle(request)
    );
  }
}

export class PseQuoteResolutionPlan extends FirstSuccessPlan {
  getExampleInput(): string | null {
    return "PSE:BDO";
  }

  buildRouteState(request: unknown): Record<string, unknown> {
    if (!request || !("symbol" in (request as object))) return {};
    return buildPseQuoteRouteState(
      request as Extract<ResolvedRequest, { requestType: "equity" }>,
    );
  }
}

export class TickerQuoteResolutionPlan extends FirstSuccessPlan {}

export class FxAttributeResolutionPlan extends SwitchPlan {
  buildRouteState(request: unknown): Record<string, unknown> {
    if (!request || !("fxPair" in (request as object))) return {};
    return buildFxQuoteRouteState(
      request as Extract<ResolvedRequest, { requestType: "fx" }>,
    );
  }

  canHandle(request: unknown): boolean {
    return (
      !(request instanceof RawRequestInput) &&
      (request as RequestInput).classification === "fx" &&
      super.canHandle(request)
    );
  }

  constructor(
    name: string,
    nodes: Resolver[],
    refsOrOptions: PlanRuntimeRefs | ResolverPlanOptions = {},
    options: ResolverPlanOptions = {},
  ) {
    super(name, nodes, refsOrOptions, options);
    if (this.nodes.length < 2) {
      throw new Error(
        `FxAttributeResolutionPlan "${this.name}" expects at least 2 nodes (local and resolver).`,
      );
    }
  }

  selectNext(
    request: unknown,
    context: SelectNextContext = {},
  ): Resolver[] {
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
  overrides: Record<string, unknown> | null | undefined,
  deps: PlanRuntimeRefs,
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

  return PlanClass.fromSpec(code, spec, resolveNode, overrides, deps);
}
