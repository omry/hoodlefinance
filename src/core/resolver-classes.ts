import type { PlanSpec } from "./plan-specs";
import type {
  ResolutionResult,
  ResolverNode,
  ResolverPlanNode,
  RouteClassResolver,
  RouteJob,
  RoutingNodeKind,
  RoutePathResolver,
  RouteStateBuilder,
  RuntimePlan,
} from "./planner";
import { RequestInput } from "./request";
import type { ResolvedRequest } from "./request";
import { buildIsinIdentifierRouteState } from "./route-state";
import { extractIsinFromRequestInput } from "./request-building";
import { createResolutionFailure, createResolutionSuccess, describePlanSource } from "./route-results";
import { createResolverRouteJob, prepareRouteJob } from "./route-jobs";
import { executeRouteJobs } from "./route-execution";
import type { PlanRuntimeRefs } from "./plan-runtime-refs";

export interface ResolverOptions {
  representativeTicker?: string;
  routingDescription?: string;
  routingLabel?: string;
  sourceName?: string;
}

export interface RouteExecutionResolverOptions extends ResolverOptions {}

export interface ResolverPlanOptions extends ResolverOptions {
  canHandle?: ((request: RequestInput | ResolvedRequest) => boolean) | null;
  isRoutingNode?: boolean;
  routeClass?: string | RouteClassResolver;
  routePath?: string | RoutePathResolver;
  routeStateBuilder?: RouteStateBuilder | null;
}

function formatRoutingPlanTreeLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeNodeCode(nodeCode: string): string {
  return String(nodeCode || "")
    .trim()
    .toUpperCase();
}

function extractIsinCountryCodeFromPlanRequest(
  request: RequestInput | ResolvedRequest | null,
  looksLikeIsin: (value: string) => boolean,
): string {
  const ticker =
    request && "ticker" in request
      ? String(request.ticker ?? "").trim()
      : request && "input" in request
        ? String(request.input?.identifier ?? "").trim()
        : "";
  const upperTicker = ticker.toUpperCase();
  const isin = looksLikeIsin(ticker)
    ? upperTicker
    : upperTicker.startsWith("ISIN:")
      ? upperTicker.slice(5).trim()
      : "";

  return isin ? isin.slice(0, 2).toUpperCase() : "";
}

interface IdentifierResolutionPlanSpec extends PlanSpec {
  nodeCodeByIsinCountry?: Record<string, string>;
}

export class Resolver {
  readonly code: string;
  readonly name: string;
  readonly representativeTicker: string;
  readonly routingDescription: string;
  readonly routingLabel: string;
  readonly sourceName: string;

  constructor(code = "", sourceName?: string, options: ResolverOptions = {}) {
    this.code = code || "";
    this.name = this.code;
    this.routingLabel = options.routingLabel || "";
    this.routingDescription = options.routingDescription || "";
    this.representativeTicker = options.representativeTicker || "";
    this.sourceName = sourceName != null ? sourceName : this.code;
  }

  canHandle(_request: RequestInput | ResolvedRequest): boolean {
    return true;
  }

  buildRuntimePlan(_request: RequestInput | ResolvedRequest): RuntimePlan {
    throw new Error(`Resolver "${this.name}" must implement buildRuntimePlan().`);
  }

  describe(request: RequestInput | ResolvedRequest): string {
    return describePlanSource(this.buildRuntimePlan(request));
  }

  getRoutingNodeKind(): RoutingNodeKind {
    return "leaf";
  }

  describeRoutingNode(): string {
    const name = formatRoutingPlanTreeLabel(this.name);
    const description = String(this.routingDescription || "").trim();
    return description ? `${name} - ${description}` : name;
  }

  getGroupedSourceNames(_request: RequestInput | ResolvedRequest): string[] {
    return [];
  }

  matchesSourceName(source: string): boolean {
    return (
      String(this.sourceName || "")
        .trim()
        .toUpperCase() ===
      String(source || "")
        .trim()
        .toUpperCase()
    );
  }

  getGroupedSourceNamesForDisplay(
    source: string,
    request: RequestInput | ResolvedRequest,
  ): string[] {
    return this.matchesSourceName(source) ? this.getGroupedSourceNames(request) : [];
  }

  resolve(request: RequestInput | ResolvedRequest): ResolutionResult<unknown> {
    const startedAtMs = Date.now();

    try {
      const plan = this.buildRuntimePlan(request);
      const job = createResolverRouteJob(request);
      job.plan = plan;
      prepareRouteJob(job, plan);
      executeRouteJobs([job], (error) => String(error instanceof Error ? error.message : error ?? ""));

      if (job.error) {
        return createResolutionFailure(job.error, Date.now() - startedAtMs, (error) =>
          String(error instanceof Error ? error.message : error ?? ""),
        );
      }

      const value = job.valueResolved ? job.value : job.quote;
      return createResolutionSuccess(value, Date.now() - startedAtMs);
    } catch (error) {
      return createResolutionFailure(error, Date.now() - startedAtMs, (caughtError) =>
        String(caughtError instanceof Error ? caughtError.message : caughtError ?? ""),
      );
    }
  }

  static fromSpec(..._args: unknown[]): Resolver {
    return new this();
  }
}

export class IdentifierResolver extends Resolver {}

export class AttributeResolver extends Resolver {}

export class RouteExecutionResolver extends AttributeResolver {
  readonly traceLabel: string;

  constructor(
    code: string,
    traceLabel?: string | RouteExecutionResolverOptions,
    sourceName?: string | RouteExecutionResolverOptions,
    options?: RouteExecutionResolverOptions,
  ) {
    let resolvedTraceLabel = traceLabel;
    let resolvedSourceName = sourceName;
    let config = options;

    if (
      resolvedTraceLabel &&
      typeof resolvedTraceLabel === "object" &&
      !Array.isArray(resolvedTraceLabel)
    ) {
      config = resolvedTraceLabel;
      resolvedTraceLabel = "";
      resolvedSourceName = "";
    } else if (
      resolvedSourceName &&
      typeof resolvedSourceName === "object" &&
      !Array.isArray(resolvedSourceName)
    ) {
      config = resolvedSourceName;
      resolvedSourceName = "";
    }

    const normalizedTraceLabel =
      (resolvedTraceLabel as string | undefined) || code;
    const normalizedSourceName =
      (resolvedSourceName as string | undefined) || normalizedTraceLabel || code;

    super(code, normalizedSourceName, config);
    this.traceLabel = normalizedTraceLabel;
  }

  buildRouteState(_request: RequestInput | ResolvedRequest): Record<string, unknown> {
    return {};
  }

  batchKey(_job: RouteJob, _attempt: unknown): string {
    return "";
  }

  executeBatch(_jobs: RouteJob[]): Array<Record<string, unknown> | null> {
    throw new Error(`Resolver "${this.name}" must implement executeBatch().`);
  }

  getRouteClass(_request: RequestInput | ResolvedRequest): string {
    return this.name;
  }

  getRoutePath(_request: RequestInput | ResolvedRequest): string {
    return this.traceLabel;
  }

  buildRuntimePlan(request: RequestInput | ResolvedRequest): RuntimePlan {
    return {
      nodes: [this],
      routeClass: this.getRouteClass(request),
      routePath: this.getRoutePath(request),
      routeState: this.buildRouteState(request),
    };
  }
}

export class ResolverPlan extends Resolver implements ResolverPlanNode {
  readonly canHandlePredicate: ((request: RequestInput | ResolvedRequest) => boolean) | null;
  readonly isRoutingNode: boolean;
  readonly nodes: ResolverNode[];
  readonly routeClass: string | RouteClassResolver;
  readonly routePath: string | RoutePathResolver;
  readonly routeStateBuilder: RouteStateBuilder | null;

  constructor(name: string, nodes: ResolverNode[], options: ResolverPlanOptions = {}) {
    const sourceName = Object.prototype.hasOwnProperty.call(options, "sourceName")
      ? options.sourceName
      : "";

    super(name, sourceName, options);
    this.canHandlePredicate = options.canHandle || null;
    this.isRoutingNode = options.isRoutingNode === true;
    this.nodes = nodes || [];
    this.routeClass = options.routeClass || name;
    this.routePath = options.routePath || "";
    this.routeStateBuilder = options.routeStateBuilder || null;
  }

  getNodesForRequest(request: RequestInput | ResolvedRequest): ResolverNode[] {
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
    request: RequestInput | ResolvedRequest,
  ): ResolverNode[] {
    return (this.nodes || []).filter(
      (node) => !node.canHandle || node.canHandle(request),
    );
  }

  getRoutingNodes(): ResolverNode[] {
    return (this.nodes || []).slice();
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    if (this.canHandlePredicate && !this.canHandlePredicate(request)) {
      return false;
    }

    return this.getHandleableNodesForRequest(request).length > 0;
  }

  getRoutingNodeKind(): RoutingNodeKind {
    return this.isRoutingNode ? "switch" : "try each";
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    const singleNode = this.nodes.length === 1 ? this.nodes[0] : null;

    if (this.routeStateBuilder) {
      return this.routeStateBuilder(request);
    }

    if (singleNode && singleNode.buildRouteState) {
      return singleNode.buildRouteState(request);
    }

    return {};
  }

  buildRoutePath(request: RequestInput | ResolvedRequest): string {
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

  getGroupedSourceNames(_request: RequestInput | ResolvedRequest): string[] {
    const groupedNames: string[] = [];

    this.nodes.forEach((node) => {
      const groupedName = String((node && ("traceLabel" in node ? node.traceLabel : node.name)) || "")
        .trim()
        .toUpperCase();

      if (
        groupedName &&
        groupedName !== String(this.sourceName || "").trim().toUpperCase() &&
        !groupedNames.includes(groupedName)
      ) {
        groupedNames.push(groupedName);
      }
    });

    return groupedNames;
  }

  buildRuntimePlan(request: RequestInput | ResolvedRequest): RuntimePlan {
    let routeClass = this.routeClass;
    const nodes = this.getNodesForRequest(request);

    if (!nodes.length) {
      throw new Error(`Resolver plan "${this.name}" cannot handle this request.`);
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

  static getSpecNodeCodes(spec: PlanSpec): string[] {
    const nodeCodes: string[] = [];

    function addNodeCode(nodeCode: string): void {
      const normalizedCode = normalizeNodeCode(nodeCode);

      if (normalizedCode && !nodeCodes.includes(normalizedCode)) {
        nodeCodes.push(normalizedCode);
      }
    }

    (spec.defaultNodeCodes || []).forEach(addNodeCode);
    (spec.nodeCodes || []).forEach(addNodeCode);

    return nodeCodes;
  }

  static materializeOptions(
    spec: PlanSpec,
    overrides: Record<string, unknown> | null | undefined,
    refs: PlanRuntimeRefs,
    _deps?: PlanNodeBuilderDependencies,
  ): ResolverPlanOptions {
    const sourceOptions = Object.assign({}, spec.options || {}, overrides || {});
    const materializedOptions = Object.assign({}, sourceOptions) as ResolverPlanOptions & {
      canHandleRef?: string;
      nodeSelectorRef?: string;
      routePathRef?: string;
      routeStateBuilderRef?: string;
    };

    if (sourceOptions.routePathRef) {
      materializedOptions.routePath =
        refs.routePathByRef[sourceOptions.routePathRef] || "";
      delete materializedOptions.routePathRef;
    }

    if (sourceOptions.routeStateBuilderRef) {
      materializedOptions.routeStateBuilder =
        refs.routeStateBuilderByRef[sourceOptions.routeStateBuilderRef] || null;
      delete materializedOptions.routeStateBuilderRef;
    }


    if (sourceOptions.canHandleRef) {
      materializedOptions.canHandle =
        refs.canHandleByRef[sourceOptions.canHandleRef] || null;
      delete materializedOptions.canHandleRef;
    }

    return materializedOptions;
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
        : (nodeCode: string) => resolverMap[normalizeNodeCode(nodeCode)] || null;

    return new this(
      code,
      this.getSpecNodeCodes(spec).map((nodeCode) =>
        resolveNodeByCode(nodeCode),
      ) as ResolverNode[],
      this.materializeOptions(spec, overrides, deps.refs, deps),
    );
  }
}

export class IdentifierResolutionPlan extends ResolverPlan {
  nodeCodeByIsinCountry: Record<string, string> | null = null;
  defaultLookupNodeCodes: string[] = [];
  looksLikeIsin?: (value: string) => boolean;

  static getSpecNodeCodes(spec: PlanSpec): string[] {
    const nodeCodes = super.getSpecNodeCodes(spec);
    const nodeCodeByIsinCountry = (
      spec as IdentifierResolutionPlanSpec
    ).nodeCodeByIsinCountry || null;

    Object.entries(nodeCodeByIsinCountry || {}).forEach(([countryCode, nodeCode]) => {
      if (countryCode === "_default_") return;
      const normalizedCode = normalizeNodeCode(nodeCode || "");
      if (normalizedCode && !nodeCodes.includes(normalizedCode)) {
        nodeCodes.unshift(normalizedCode);
      }
    });

    const defaultCode = normalizeNodeCode((nodeCodeByIsinCountry || {})["_default_"] || "");
    if (defaultCode && !nodeCodes.includes(defaultCode)) {
      nodeCodes.push(defaultCode);
    }

    return nodeCodes;
  }

  getNodesForRequest(request: RequestInput | ResolvedRequest): ResolverNode[] {
    const nodeByCode: Record<string, ResolverNode> = {};
    const selectedNodes: ResolverNode[] = [];
    const countryCode = extractIsinCountryCodeFromPlanRequest(
      request,
      this.looksLikeIsin || (() => false),
    );
    const countryNodeCode = normalizeNodeCode(
      (this.nodeCodeByIsinCountry || {})[countryCode] || "",
    );

    (this.nodes || []).forEach((node) => {
      nodeByCode[normalizeNodeCode(node?.name || "")] = node;
    });

    [countryNodeCode].concat(this.defaultLookupNodeCodes).forEach((nodeCode) => {
      if (nodeByCode[nodeCode] && !selectedNodes.includes(nodeByCode[nodeCode])) {
        selectedNodes.push(nodeByCode[nodeCode]);
      }
    });

    const firstMatchingIndex = selectedNodes.findIndex(
      (node) => !node.canHandle || node.canHandle(request),
    );

    if (firstMatchingIndex < 0) {
      return selectedNodes;
    }

    return selectedNodes.slice(firstMatchingIndex);
  }

  getRoutingNodeKind(): RoutingNodeKind {
    return "switch";
  }

  static fromSpec(
    code: string,
    spec: PlanSpec,
    resolverMap:
      | Record<string, ResolverNode>
      | ((nodeCode: string) => ResolverNode | null),
    overrides: Record<string, unknown> | null | undefined,
    deps: PlanNodeBuilderDependencies,
  ): IdentifierResolutionPlan {
    const resolveNodeByCode =
      typeof resolverMap === "function"
        ? resolverMap
        : (nodeCode: string) => resolverMap[normalizeNodeCode(nodeCode)] || null;

    const plan = new this(
      code,
      this.getSpecNodeCodes(spec).map((nodeCode) =>
        resolveNodeByCode(nodeCode),
      ) as ResolverNode[],
      this.materializeOptions(spec, overrides, deps.refs, deps),
    );

    const nodeCodeByIsinCountry = (spec as IdentifierResolutionPlanSpec).nodeCodeByIsinCountry || null;
    const defaultCode = normalizeNodeCode((nodeCodeByIsinCountry || {})["_default_"] || "");
    plan.nodeCodeByIsinCountry = nodeCodeByIsinCountry;
    plan.defaultLookupNodeCodes = defaultCode ? [defaultCode] : (spec.defaultNodeCodes || []).map(normalizeNodeCode);
    plan.looksLikeIsin = deps.refs.looksLikeIsin;

    return plan;
  }

  buildRouteState(request: RequestInput | ResolvedRequest): Record<string, unknown> {
    if (!(request instanceof RequestInput)) return {};
    return buildIsinIdentifierRouteState(
      request,
      (input) => extractIsinFromRequestInput(input, this.looksLikeIsin || (() => false)),
    );
  }
}

export class AttributeResolutionPlan extends ResolverPlan {}

export class PseQuoteResolutionPlan extends AttributeResolutionPlan {}

export class TickerQuoteResolutionPlan extends AttributeResolutionPlan {}

export class FxAttributeResolutionPlan extends AttributeResolutionPlan {
  constructor(name: string, nodes: ResolverNode[], options: ResolverPlanOptions = {}) {
    super(name, nodes, options);
    if (this.nodes.length < 2) {
      throw new Error(`FxAttributeResolutionPlan "${this.name}" expects at least 2 nodes (local and resolver).`);
    }
  }

  getNodesForRequest(request: RequestInput | ResolvedRequest): ResolverNode[] {
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
  FxAttributeResolutionPlan,
  IdentifierResolutionPlan,
  PseQuoteResolutionPlan,
  ResolverPlan,
  TickerQuoteResolutionPlan,
} as const;

export type PlanResolverClassName = keyof typeof PLAN_RESOLVER_CLASSES_BY_NAME;

export interface PlanNodeBuilderDependencies {
  refs: PlanRuntimeRefs;
}

export function buildPlanNodeFromSpec(
  code: string,
  spec: PlanSpec,
  resolveNode: (nodeCode: string) => ResolverNode | null,
  overrides: Record<string, unknown> | null | undefined,
  deps: PlanNodeBuilderDependencies,
): ResolverNode {
  const PlanClass = PLAN_RESOLVER_CLASSES_BY_NAME[
    spec.resolverClass as PlanResolverClassName
  ];

  if (!PlanClass) {
    throw new Error(
      `Unknown plan resolver class "${String(spec.resolverClass || "")}" for "${code}".`,
    );
  }

  return PlanClass.fromSpec(code, spec, resolveNode, overrides, deps);
}
