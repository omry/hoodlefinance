import {
  type PlanSpec,
  getPlanSpecNodeCodes,
  normalizePlanSpecCode,
} from "./plan-specs";
import type {
  ResolutionResult,
  ResolverNode,
  ResolverPlanNode,
  RouteClassResolver,
  RouteJob,
  RoutingNodeKind,
  RoutePathResolver,
  RuntimePlan,
} from "./planner";
import type { PlannerRequest, ResolvedRequest } from "./request";
import { FxRequest, RawRequestInput, RequestInput } from "./request";
import { buildPseQuoteRouteState, buildFxQuoteRouteState } from "./route-state";
import {
  extractAttributeValue,
  extractCurrencyValue,
  parseAttributeRequest,
} from "./attribute-extraction";
import { buildFxPairFromCodes } from "./fx-normalization";
import {
  createResolutionFailure,
  createResolutionSuccess,
  describePlanSource,
} from "./route-results";
import { createResolverRouteJob, prepareRouteJob } from "./route-jobs";
import { executeRouteJobs } from "./route-execution";
import type { PlanRuntimeRefs } from "./plan-runtime-refs";
import {
  resolvePlannedQuoteEnvelope,
  type LookupEnvelopeResult,
} from "./request-resolution";
import type { ResolverServices } from "./resolver-services";

export interface ResolverPlanOptions {
  routeClass?: string | RouteClassResolver;
  routePath?: string | RoutePathResolver;
}

function formatRoutingPlanTreeLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeNodeCode(nodeCode: string): string {
  return normalizePlanSpecCode(nodeCode);
}

export class Resolver {
  readonly code: string;
  readonly name: string;

  constructor(code = "") {
    this.code = code || "";
    this.name = this.code;
  }

  getExampleInput(): string | null {
    return null;
  }

  getRoutingDescription(): string | null {
    return null;
  }

  canHandle(_request: PlannerRequest): boolean {
    return true;
  }

  buildRuntimePlan(_request: PlannerRequest): RuntimePlan {
    throw new Error(
      `Resolver "${this.name}" must implement buildRuntimePlan().`,
    );
  }

  describe(request: PlannerRequest): string {
    return describePlanSource(this.buildRuntimePlan(request));
  }

  getRoutingNodeKind(): RoutingNodeKind {
    return "leaf";
  }

  describeRoutingNode(): string {
    const name = formatRoutingPlanTreeLabel(this.name);
    const description = String(this.getRoutingDescription() || "").trim();
    return description ? `${name} - ${description}` : name;
  }

  getGroupedSourceNames(_request: PlannerRequest): string[] {
    return [];
  }

  matchesSourceName(source: string): boolean {
    return (
      String(this.name || "")
        .trim()
        .toUpperCase() ===
      String(source || "")
        .trim()
        .toUpperCase()
    );
  }

  getGroupedSourceNamesForDisplay(
    source: string,
    request: PlannerRequest,
  ): string[] {
    return this.matchesSourceName(source)
      ? this.getGroupedSourceNames(request)
      : [];
  }

  resolve(request: PlannerRequest): ResolutionResult<unknown> {
    const startedAtMs = Date.now();

    try {
      const plan = this.buildRuntimePlan(request);
      const job = createResolverRouteJob(request);
      job.plan = plan;
      prepareRouteJob(job, plan);
      executeRouteJobs([job], (error) =>
        String(error instanceof Error ? error.message : (error ?? "")),
      );

      if (job.error) {
        return createResolutionFailure(
          job.error,
          Date.now() - startedAtMs,
          (error) =>
            String(error instanceof Error ? error.message : (error ?? "")),
        );
      }

      const value = job.valueResolved ? job.value : job.quote;
      return createResolutionSuccess(value, Date.now() - startedAtMs);
    } catch (error) {
      return createResolutionFailure(
        error,
        Date.now() - startedAtMs,
        (caughtError) =>
          String(
            caughtError instanceof Error
              ? caughtError.message
              : (caughtError ?? ""),
          ),
      );
    }
  }

  initEnv(_services: ResolverServices): void {}

  static fromSpec(..._args: unknown[]): Resolver {
    return new this();
  }
}

export class IdentifierResolver extends Resolver {}

export class AttributeResolver extends Resolver {}

export class RouteExecutionResolver extends AttributeResolver {
  readonly traceLabel: string;

  constructor(code: string, traceLabel?: string) {
    super(code);
    this.traceLabel = traceLabel || code;
  }

  buildRouteState(
    _request: PlannerRequest,
  ): Record<string, unknown> {
    return {};
  }

  batchKey(_job: RouteJob, _attempt: unknown): string {
    return "";
  }

  executeBatch(_jobs: RouteJob[]): Array<Record<string, unknown> | null> {
    throw new Error(`Resolver "${this.name}" must implement executeBatch().`);
  }

  getRouteClass(_request: PlannerRequest): string {
    return this.name;
  }

  getRoutePath(_request: PlannerRequest): string {
    return this.traceLabel;
  }

  buildRuntimePlan(request: PlannerRequest): RuntimePlan {
    return {
      nodes: [this],
      routeClass: this.getRouteClass(request),
      routePath: this.getRoutePath(request),
      routeState: this.buildRouteState(request),
    };
  }
}

export abstract class ResolverPlan
  extends Resolver
  implements ResolverPlanNode
{
  readonly nodes: ResolverNode[];
  // TEMPORARY: this lets plan nodes reach shared runtime services, including
  // ResolveFlow itself for the current FX-conversion concession. Remove once
  // the compiled execution DAG can express those edges directly.
  readonly refs: PlanRuntimeRefs | null;
  readonly routeClass: string | RouteClassResolver;
  readonly routePath: string | RoutePathResolver;

  constructor(
    name: string,
    nodes: ResolverNode[],
    refsOrOptions: PlanRuntimeRefs | ResolverPlanOptions = {},
    options: ResolverPlanOptions = {},
  ) {
    const hasRefs =
      !!refsOrOptions &&
      typeof refsOrOptions === "object" &&
      "resolveFlow" in refsOrOptions;
    const resolvedRefs = hasRefs
      ? (refsOrOptions as PlanRuntimeRefs)
      : null;
    const resolvedOptions = hasRefs
      ? options
      : (refsOrOptions as ResolverPlanOptions);

    super(name);
    this.nodes = nodes || [];
    this.refs = resolvedRefs;
    this.routeClass = resolvedOptions.routeClass || name;
    this.routePath = resolvedOptions.routePath || "";
  }

  getNodesForRequest(request: PlannerRequest): ResolverNode[] {
    const nodes = (this.nodes || []).slice();

    if (!nodes.length) {
      return nodes;
    }

    const firstMatchingIndex = nodes.findIndex(
      (node) => !node.canHandle || node.canHandle(request),
    );

    if (firstMatchingIndex < 0) {
      return nodes;
    }

    return nodes.slice(firstMatchingIndex);
  }

  getHandleableNodesForRequest(
    request: PlannerRequest,
  ): ResolverNode[] {
    return (this.nodes || []).filter(
      (node) => !node.canHandle || node.canHandle(request),
    );
  }

  getRoutingNodes(): ResolverNode[] {
    return (this.nodes || []).slice();
  }

  canHandle(request: PlannerRequest): boolean {
    return this.getHandleableNodesForRequest(request).length > 0;
  }

  abstract getRoutingNodeKind(): RoutingNodeKind;

  buildRouteState(
    request: PlannerRequest,
  ): Record<string, unknown> {
    const singleNode = this.nodes.length === 1 ? this.nodes[0] : null;

    if (singleNode && singleNode.buildRouteState) {
      return singleNode.buildRouteState(request);
    }

    return {};
  }

  buildRoutePath(request: PlannerRequest): string {
    let routePath = this.routePath;
    const nodes = this.getNodesForRequest(request);

    if (typeof routePath === "function") {
      routePath = routePath(request);
    }

    if (routePath) {
      return routePath;
    }

    return nodes.map((node) => node.name).join(" -> ");
  }

  getGroupedSourceNames(_request: PlannerRequest): string[] {
    const groupedNames: string[] = [];

    this.nodes.forEach((node) => {
      const groupedName = String(
        (node && ("traceLabel" in node ? node.traceLabel : node.name)) || "",
      )
        .trim()
        .toUpperCase();

      if (
        groupedName &&
        groupedName !==
          String(this.name || "")
            .trim()
            .toUpperCase() &&
        !groupedNames.includes(groupedName)
      ) {
        groupedNames.push(groupedName);
      }
    });

    return groupedNames;
  }

  buildRuntimePlan(request: PlannerRequest): RuntimePlan {
    let routeClass = this.routeClass;
    const nodes = this.getNodesForRequest(request);

    if (!nodes.length) {
      throw new Error(
        `Resolver plan "${this.name}" cannot handle this request.`,
      );
    }

    if (typeof routeClass === "function") {
      routeClass = routeClass(request);
    }

    const routeState = this.buildRouteState(request);
    const flattenedNodes: ResolverNode[] = [];

    for (const node of nodes) {
      const runtimePlan = node.buildRuntimePlan(request);
      flattenedNodes.push(...(runtimePlan.nodes || []));

      if (runtimePlan.routeState) {
        Object.assign(routeState, runtimePlan.routeState);
      }
    }

    return {
      nodes: flattenedNodes,
      routeClass,
      routePath: this.buildRoutePath(request),
      routeState,
    };
  }

  resolveOutputCurrencyEnvelope(
    requestInput: RequestInput,
    quote: Record<string, unknown>,
  ): LookupEnvelopeResult | null {
    const singleNode = this.nodes.length === 1 ? this.nodes[0] : null;

    if (!this.refs && singleNode) {
      const nestedResolver = singleNode as ResolverNode & {
        resolveOutputCurrencyEnvelope?: (
          request: RequestInput,
          value: Record<string, unknown>,
        ) => LookupEnvelopeResult | null;
      };

      if (typeof nestedResolver.resolveOutputCurrencyEnvelope === "function") {
        return nestedResolver.resolveOutputCurrencyEnvelope(requestInput, quote);
      }
    }

    if (!this.refs) {
      return null;
    }

    const attributeRequest = parseAttributeRequest(requestInput.attribute);
    if (
      requestInput.attributeType !== "quote" ||
      !attributeRequest.wantsOutputCurrency ||
      attributeRequest.baseAttribute !== "price"
    ) {
      return null;
    }

    const sourceCurrency = extractCurrencyValue(quote);
    const targetCurrency = attributeRequest.outputCode.trim().toUpperCase();

    if (
      !sourceCurrency ||
      !targetCurrency ||
      sourceCurrency === targetCurrency ||
      (quote.hoodlefinanceFxUnitScale != null &&
        Number.isFinite(Number(quote.hoodlefinanceFxUnitScale)))
    ) {
      return null;
    }

    const fxPair = buildFxPairFromCodes(sourceCurrency, targetCurrency);
    if (!fxPair) {
      throw new Error(
        `Output-currency conversion from "${sourceCurrency}" to "${targetCurrency}" is not supported. Use recognized 3- or 4-character currency codes.`,
      );
    }

    const fxPlan = this.refs.resolveFlow.getPlanNodeByCode(
      "DEFAULT-ATTRIBUTE:FX",
    );
    const fxEnvelope = resolvePlannedQuoteEnvelope(
      fxPlan,
      new FxRequest({
        attribute: "price",
        fxPair,
        identifier: fxPair.yahooChartSymbol,
      }),
      [],
    );

    if (fxEnvelope.status === "success") {
      const rate = Number(
        extractAttributeValue(
          fxEnvelope.value as Record<string, unknown>,
          "price",
        ),
      );

      if (Number.isFinite(rate)) {
        return { ...fxEnvelope, value: rate };
      }
    }

    return fxEnvelope;
  }

  static getSpecNodeCodes(spec: PlanSpec): string[] {
    return getPlanSpecNodeCodes(spec);
  }

  static materializeOptions(
    overrides: Record<string, unknown> | null | undefined,
  ): ResolverPlanOptions {
    return Object.assign({}, overrides || {}) as ResolverPlanOptions;
  }

  static fromSpec(
    code: string,
    spec: PlanSpec,
    resolverMap:
      | Record<string, ResolverNode>
      | ((nodeCode: string) => ResolverNode | null),
    overrides: Record<string, unknown> | null | undefined,
    deps: PlanNodeBuilderDependencies,
  ): ResolverPlan {
    const resolveNodeByCode =
      typeof resolverMap === "function"
        ? resolverMap
        : (nodeCode: string) =>
            resolverMap[normalizeNodeCode(nodeCode)] || null;

    const Ctor = this as unknown as new (
      name: string,
      nodes: ResolverNode[],
      refs: PlanRuntimeRefs,
      options: ResolverPlanOptions,
    ) => ResolverPlan;
    return new Ctor(
      code,
      this.getSpecNodeCodes(spec).map((nodeCode: string) =>
        resolveNodeByCode(nodeCode),
      ) as ResolverNode[],
      deps.refs,
      this.materializeOptions(overrides),
    );
  }
}

export class RoutingPlan extends ResolverPlan {
  getRoutingNodeKind(): RoutingNodeKind {
    return "switch";
  }
}

export class RequestClassificationPlan extends ResolverPlan {
  getRoutingNodeKind(): RoutingNodeKind {
    return "switch";
  }

  getNodesForRequest(request: PlannerRequest): ResolverNode[] {
    const classifierNode = this.nodes[0] || null;
    const requestRootNode = this.nodes[1] || null;

    if (request instanceof RawRequestInput) {
      return classifierNode ? [classifierNode] : [];
    }

    return requestRootNode ? [requestRootNode] : [];
  }

  getRoutingNodes(): ResolverNode[] {
    return (this.nodes || []).filter(Boolean);
  }
}

export class FirstSuccessPlan extends ResolverPlan {
  getRoutingNodeKind(): RoutingNodeKind {
    return "try each";
  }
}

export class AttributeResolutionPlan extends FirstSuccessPlan {}

export class EquityAttributeResolutionPlan extends AttributeResolutionPlan {
  getRoutingNodeKind(): RoutingNodeKind {
    return "switch";
  }

  canHandle(request: PlannerRequest): boolean {
    return (
      !(request instanceof RawRequestInput) &&
      request.classification === "equity" &&
      super.canHandle(request)
    );
  }
}

export class PseQuoteResolutionPlan extends AttributeResolutionPlan {
  getExampleInput(): string | null {
    return "PSE:BDO";
  }

  buildRouteState(request: PlannerRequest): Record<string, unknown> {
    if (!("symbol" in request)) return {};
    return buildPseQuoteRouteState(
      request as Extract<ResolvedRequest, { requestType: "equity" }>,
    );
  }
}

export class TickerQuoteResolutionPlan extends AttributeResolutionPlan {}

export class FxAttributeResolutionPlan extends AttributeResolutionPlan {
  buildRouteState(request: PlannerRequest): Record<string, unknown> {
    if (!("fxPair" in request)) return {};
    return buildFxQuoteRouteState(
      request as Extract<ResolvedRequest, { requestType: "fx" }>,
    );
  }

  canHandle(request: PlannerRequest): boolean {
    return (
      !(request instanceof RawRequestInput) &&
      request.classification === "fx" &&
      super.canHandle(request)
    );
  }

  constructor(
    name: string,
    nodes: ResolverNode[],
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

  getNodesForRequest(request: PlannerRequest): ResolverNode[] {
    const localNode = this.nodes[0];
    if (localNode && (!localNode.canHandle || localNode.canHandle(request))) {
      return [localNode];
    }
    const resolverNode = this.nodes[1];
    return resolverNode ? [resolverNode] : [];
  }

  getRoutingNodes(): ResolverNode[] {
    const routingNodes = [];
    if (this.nodes[0]) routingNodes.push(this.nodes[0]);
    if (this.nodes[1]) routingNodes.push(this.nodes[1]);
    return routingNodes;
  }
}

export const PLAN_RESOLVER_CLASSES_BY_NAME = {
  AttributeResolutionPlan,
  EquityAttributeResolutionPlan,
  FirstSuccessPlan,
  FxAttributeResolutionPlan,
  PseQuoteResolutionPlan,
  RequestClassificationPlan,
  RoutingPlan,
  TickerQuoteResolutionPlan,
} as const;

export type PlanResolverClassName = keyof typeof PLAN_RESOLVER_CLASSES_BY_NAME;

export interface PlanNodeBuilderDependencies {
  // TEMPORARY: this shared refs bag is the only acceptable place to thread
  // ResolveFlow into plan nodes for the current FX-conversion concession.
  // TODO: remove any ResolveFlow reference from here once conversion moves to
  // the compiled execution DAG.
  refs: PlanRuntimeRefs;
}

export function buildPlanNodeFromSpec(
  code: string,
  spec: PlanSpec,
  resolveNode: (nodeCode: string) => ResolverNode | null,
  overrides: Record<string, unknown> | null | undefined,
  deps: PlanNodeBuilderDependencies,
): ResolverNode {
  const PlanClass =
    PLAN_RESOLVER_CLASSES_BY_NAME[spec.type as PlanResolverClassName];

  if (!PlanClass) {
    throw new Error(
      `Unknown plan resolver class "${String(spec.type || "")}" for "${code}".`,
    );
  }

  return PlanClass.fromSpec(code, spec, resolveNode, overrides, deps);
}
