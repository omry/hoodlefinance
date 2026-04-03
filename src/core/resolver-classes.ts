import type { PlanSpec } from "./plan-specs";
import type {
  NodeSelector,
  ResolutionResult,
  ResolverNode,
  ResolverPlanNode,
  RouteClassResolver,
  RouteJob,
  RoutePathResolver,
  RouteStateBuilder,
  RuntimePlan,
} from "./planner";
import type { RequestInput, ResolvedRequest } from "./request";
import { createResolutionFailure, createResolutionSuccess, describePlanSource } from "./route-results";
import { createResolverRouteJob, prepareRouteJob } from "./route-jobs";
import { executeRouteJobs } from "./route-execution";
import type { PlanRuntimeRefs } from "./plan-runtime-refs";

export interface ResolverOptions {
  isSourceOverrideable?: boolean;
  representativeTicker?: string;
  routingDescription?: string;
  routingLabel?: string;
  sourceName?: string;
}

export interface RouteExecutionResolverOptions extends ResolverOptions {}

export interface ResolverPlanOptions extends ResolverOptions {
  canHandle?: ((request: RequestInput | ResolvedRequest) => boolean) | null;
  isRoutingNode?: boolean;
  nodeSelector?: NodeSelector | null;
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

export class Resolver {
  readonly code: string;
  readonly isSourceOverrideable: boolean;
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
    this.isSourceOverrideable = options.isSourceOverrideable === true;
  }

  canHandle(_request: RequestInput | ResolvedRequest): boolean {
    return true;
  }

  getAttributeOverrideSources(_request: RequestInput | ResolvedRequest): string[] {
    return [];
  }

  buildRuntimePlan(_request: RequestInput | ResolvedRequest): RuntimePlan {
    throw new Error(`Resolver "${this.name}" must implement buildRuntimePlan().`);
  }

  describe(request: RequestInput | ResolvedRequest): string {
    return describePlanSource(this.buildRuntimePlan(request));
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
  readonly nodeSelector: NodeSelector | null;
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
    this.nodeSelector = options.nodeSelector || null;
  }

  getNodesForRequest(request: RequestInput | ResolvedRequest): ResolverNode[] {
    const selected = this.nodeSelector ? this.nodeSelector(this.nodes, request) : this.nodes;

    return (selected || []).filter(
      (node) => !node.canHandle || node.canHandle(request),
    );
  }

  getRoutingNodes(): ResolverNode[] {
    if (!this.nodeSelector || this.isRoutingNode) {
      return (this.nodes || []).slice();
    }

    if (this.nodeSelector.requestDependent === true) {
      return (this.nodes || []).slice();
    }

    return (this.nodeSelector(this.nodes, null) || []).slice();
  }

  canHandle(request: RequestInput | ResolvedRequest): boolean {
    if (this.canHandlePredicate && !this.canHandlePredicate(request)) {
      return false;
    }

    return this.getNodesForRequest(request).length > 0;
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

    return {
      nodes,
      routeClass,
      routePath: this.buildRoutePath(request),
      routeState: this.buildRouteState(request),
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

    Object.keys(spec.nodeCodeByIsinCountry || {}).forEach(
      (countryCode) => addNodeCode((spec.nodeCodeByIsinCountry || {})[countryCode] || ""),
    );
    (spec.defaultNodeCodes || []).forEach(addNodeCode);
    (spec.nodeCodes || []).forEach(addNodeCode);

    return nodeCodes;
  }

  static buildNodeSelector(spec: PlanSpec, extractIsinCountryCode: (request: RequestInput | ResolvedRequest | null) => string): NodeSelector | null {
    const nodeCodeByIsinCountry = spec.nodeCodeByIsinCountry || null;
    const defaultNodeCodes = (spec.defaultNodeCodes || []).map(normalizeNodeCode);

    if (!nodeCodeByIsinCountry) {
      return null;
    }

    const selector: NodeSelector = (nodes, request) => {
      const nodeByCode: Record<string, ResolverNode> = {};
      const selectedNodes: ResolverNode[] = [];
      const countryCode = extractIsinCountryCode(request);
      const countryNodeCode = normalizeNodeCode(nodeCodeByIsinCountry[countryCode] || "");

      nodes.forEach((node) => {
        nodeByCode[normalizeNodeCode(node?.name || "")] = node;
      });

      [countryNodeCode].concat(defaultNodeCodes).forEach((nodeCode) => {
        if (nodeByCode[nodeCode] && !selectedNodes.includes(nodeByCode[nodeCode])) {
          selectedNodes.push(nodeByCode[nodeCode]);
        }
      });

      return selectedNodes;
    };

    selector.requestDependent = true;
    return selector;
  }

  static materializeOptions(
    spec: PlanSpec,
    overrides: Record<string, unknown> | null | undefined,
    refs: PlanRuntimeRefs,
    extractIsinCountryCode: (request: RequestInput | ResolvedRequest | null) => string,
  ): ResolverPlanOptions {
    const sourceOptions = Object.assign({}, spec.options || {}, overrides || {});
    const materializedOptions = Object.assign({}, sourceOptions) as ResolverPlanOptions & {
      canHandleRef?: string;
      nodeSelectorRef?: string;
      routeClassRef?: string;
      routePathRef?: string;
      routeStateBuilderRef?: string;
    };
    const nodeSelector = this.buildNodeSelector(spec, extractIsinCountryCode);

    if (sourceOptions.routeClassRef) {
      materializedOptions.routeClass =
        refs.routeClassByRef[sourceOptions.routeClassRef] || "";
      delete materializedOptions.routeClassRef;
    }

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

    if (sourceOptions.nodeSelectorRef) {
      materializedOptions.nodeSelector =
        refs.nodeSelectorByRef[sourceOptions.nodeSelectorRef] || null;
      delete materializedOptions.nodeSelectorRef;
    }

    if (sourceOptions.canHandleRef) {
      materializedOptions.canHandle =
        refs.canHandleByRef[sourceOptions.canHandleRef] || null;
      delete materializedOptions.canHandleRef;
    }

    if (nodeSelector) {
      materializedOptions.nodeSelector = nodeSelector;
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
    refs: PlanRuntimeRefs,
    extractIsinCountryCode: (request: RequestInput | ResolvedRequest | null) => string,
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
      this.materializeOptions(spec, overrides, refs, extractIsinCountryCode),
    );
  }
}

export class IdentifierResolutionPlan extends ResolverPlan {}

export class AttributeResolutionPlan extends ResolverPlan {}

export const PLAN_RESOLVER_CLASSES_BY_NAME = {
  AttributeResolutionPlan,
  IdentifierResolutionPlan,
  ResolverPlan,
} as const;

export type PlanResolverClassName = keyof typeof PLAN_RESOLVER_CLASSES_BY_NAME;

export interface PlanNodeBuilderDependencies {
  extractIsinCountryCode: (
    request: RequestInput | ResolvedRequest | null,
  ) => string;
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

  return PlanClass.fromSpec(
    code,
    spec,
    resolveNode,
    overrides,
    deps.refs,
    deps.extractIsinCountryCode,
  );
}
