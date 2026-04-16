import {
  getGraphNodeNextIds,
  normalizeGraphNodeId,
  type Graph,
} from "./graph";

import type {
  ResolutionResult,
  ResolverExecutionContext,
} from "./planner";
import { RoutingNodeKind } from "./planner";
import { FxRequest, RawRequestInput, RequestInput } from "./request";
import { extractAttributeValue, parseAttributeRequest } from "./attribute-extraction";
import { buildFxPairFromCodes } from "./fx-normalization";
import {
  createRouteResult,
  createResolutionFailure,
  createResolutionSuccess,
  defaultRouteFailureMessage,
  describePlanSource,
  formatRouteFailureMessage,
  type RouteResult,
} from "./route-results";
import type { StockQuote } from "./quote";
import type { ResolverServices } from "./resolver-services";

type RouteClassResolver = (request: unknown) => string;
type RoutePathResolver = (request: unknown) => string;

export interface LookupResult {
  error?: string;
  route: string;
  status: "failure" | "success";
  value: unknown;
}

// TEMPORARY: threads the runtime FX root plan into plan nodes for
// output-currency conversion until the execution DAG can model that edge.
export interface PlanRuntimeRefs {
  resolveFxQuote(request: FxRequest): LookupResult;
}

export interface ResolverPlanOptions {
  routeClass?: string | RouteClassResolver;
  routePath?: string | RoutePathResolver;
}

export interface SelectNextContext {
  // Tracks child nodes already returned during the current routing-node traversal.
  selectedNodeCodes?: Set<string>;
}

type SelectedNodes = Resolver[];

function formatRoutingPlanTreeLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeNodeCode(nodeCode: string): string {
  return normalizeGraphNodeId(nodeCode);
}

function formatResolverError(error: unknown): string {
  return String(error instanceof Error ? error.message : (error ?? ""));
}

function createResolverExecutionContext(
  request: unknown,
  routeState: Record<string, unknown>,
): ResolverExecutionContext<Record<string, unknown>> {
  if (request instanceof RawRequestInput || request instanceof RequestInput) {
    return {
      attribute: request.attribute,
      routeKind: "identifier",
      routeState,
      tickerInput: request.identifier,
    };
  }

  const resolvedRequest = request as {
    input?: { attribute?: unknown; identifier?: unknown };
  };

  return {
    attribute: String(resolvedRequest.input?.attribute || "price"),
    routeKind: "quote",
    routeState,
    tickerInput: String(resolvedRequest.input?.identifier || ""),
  };
}

function normalizeRouteResult(
  result: RouteResult | null | undefined,
): RouteResult {
  return (
    result ||
    createRouteResult("terminal_error", {
      error: "Resolver returned no result.",
    })
  );
}

function applyStateChanges(
  context: ResolverExecutionContext<Record<string, unknown>>,
  result: RouteResult,
): void {
  if (!result.stateChanges || typeof result.stateChanges !== "object") {
    return;
  }

  Object.assign(context.routeState, result.stateChanges);
}

function getResolvedRouteValue(result: RouteResult): unknown {
  if (Object.prototype.hasOwnProperty.call(result, "value")) {
    return result.value;
  }

  if (Object.prototype.hasOwnProperty.call(result, "quote")) {
    return result.quote;
  }

  return null;
}

function formatExecutionFailureMessage(
  resolver: Pick<Resolver, "name" | "traceLabel">,
  context: ResolverExecutionContext<Record<string, unknown>>,
  result: RouteResult,
): string {
  const message =
    formatResolverError(result.error) || defaultRouteFailureMessage(context);
  const label = String(resolver.traceLabel || resolver.name || "").trim();

  return formatRouteFailureMessage(
    {
      routeRuntimeTrace: label
        ? [{ elapsedMs: null, label, status: result.status }]
        : [],
    },
    message,
  );
}

export class Resolver {
  readonly code: string;
  readonly name: string;
  readonly traceLabel?: string;

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

  buildRouteState(_request: unknown): Record<string, unknown> {
    return {};
  }

  canHandle(_request: unknown): boolean {
    return true;
  }

  getRouteClass(_request: unknown): string {
    return this.name;
  }

  getRoutePath(_request: unknown): string {
    return String(this.traceLabel || this.name || "").trim();
  }

  describe(request: unknown): string {
    return describePlanSource({
      routeClass: this.getRouteClass(request),
      routePath: this.getRoutePath(request),
    });
  }

  getRoutingNodeKind(): RoutingNodeKind {
    return RoutingNodeKind.Leaf;
  }

  selectNext(
    _request: unknown,
    _context: SelectNextContext = {},
  ): SelectedNodes {
    throw new Error(
      `Resolver "${this.name}" does not support selectNext(); only routing nodes with explicit selection semantics may select next children.`,
    );
  }

  describeRoutingNode(): string {
    const name = formatRoutingPlanTreeLabel(this.name);
    const description = String(this.getRoutingDescription() || "").trim();
    return description ? `${name} - ${description}` : name;
  }

  getGroupedSourceNames(_request: unknown): string[] {
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
    request: unknown,
  ): string[] {
    return this.matchesSourceName(source)
      ? this.getGroupedSourceNames(request)
      : [];
  }

  resolve(request: unknown): ResolutionResult<unknown> {
    const startedAtMs = Date.now();

    try {
      const context = createResolverExecutionContext(
        request,
        this.buildRouteState(request),
      );
      const result = normalizeRouteResult(
        this.executeRouteRequest(request, context),
      );
      applyStateChanges(context, result);

      if (result.status !== "success") {
        return createResolutionFailure(
          formatExecutionFailureMessage(this, context, result),
          Date.now() - startedAtMs,
          formatResolverError,
        );
      }

      const rawValue = getResolvedRouteValue(result);
      const value = this.resolveTransformValue(rawValue, context);
      return createResolutionSuccess(value, Date.now() - startedAtMs);
    } catch (error) {
      return createResolutionFailure(
        error,
        Date.now() - startedAtMs,
        formatResolverError,
      );
    }
  }

  executeRouteRequest(
    _request: unknown,
    _context: ResolverExecutionContext<Record<string, unknown>>,
  ): RouteResult {
    throw new Error(
      `Resolver "${this.name}" must implement executeRouteRequest().`,
    );
  }

  protected resolveTransformValue(
    value: unknown,
    _context: ResolverExecutionContext<Record<string, unknown>>,
  ): unknown {
    return value;
  }

  initEnv(_services: ResolverServices): void {}

  static fromSpec(..._args: unknown[]): Resolver {
    return new this();
  }
}


export abstract class ResolverPlan extends Resolver {
  readonly nodes: Resolver[];
  // TEMPORARY: this lets plan nodes reach the runtime FX root plan for the
  // current output-currency concession. Remove once the execution DAG can
  // express that edge directly.
  readonly refs: PlanRuntimeRefs | null;
  readonly routeClass: string | RouteClassResolver;
  readonly routePath: string | RoutePathResolver;

  constructor(
    name: string,
    nodes: Resolver[],
    refsOrOptions: PlanRuntimeRefs | ResolverPlanOptions = {},
    options: ResolverPlanOptions = {},
  ) {
    const hasRefs =
      !!refsOrOptions &&
      typeof refsOrOptions === "object" &&
      "resolveFxQuote" in refsOrOptions;
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

  getNodesForRequest(request: unknown): Resolver[] {
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
    request: unknown,
  ): Resolver[] {
    return (this.nodes || []).filter(
      (node) => !node.canHandle || node.canHandle(request),
    );
  }

  getRoutingNodes(): Resolver[] {
    return (this.nodes || []).slice();
  }

  canHandle(request: unknown): boolean {
    return this.getHandleableNodesForRequest(request).length > 0;
  }

  protected getSelectedNodeCodes(
    context: SelectNextContext | null | undefined,
  ): Set<string> {
    if (!context) {
      return new Set<string>();
    }

    if (!(context.selectedNodeCodes instanceof Set)) {
      context.selectedNodeCodes = new Set<string>();
    }

    return context.selectedNodeCodes;
  }

  protected getNodeSelectionCode(
    node: Pick<Resolver, "code" | "name"> | null | undefined,
  ): string {
    return String((node && (node.code || node.name)) || "")
      .trim()
      .toUpperCase();
  }

  protected hasSelectedNode(
    node: Resolver | null | undefined,
    context: SelectNextContext | null | undefined,
  ): boolean {
    const selectionCode = this.getNodeSelectionCode(node);
    return !!selectionCode && this.getSelectedNodeCodes(context).has(selectionCode);
  }

  protected markSelectedNode(
    node: Resolver | null | undefined,
    context: SelectNextContext | null | undefined,
  ): Resolver | null {
    if (!node || !context) {
      return node || null;
    }

    const selectionCode = this.getNodeSelectionCode(node);
    if (!selectionCode) {
      return node;
    }

    const selectedNodeCodes = this.getSelectedNodeCodes(context);
    selectedNodeCodes.add(selectionCode);

    return node;
  }

  protected getUnselectedNodes(
    nodes: Array<Resolver | null | undefined>,
    context: SelectNextContext | null | undefined,
  ): Resolver[] {
    return nodes.filter(
      (node): node is Resolver => !!node && !this.hasSelectedNode(node, context),
    );
  }

  abstract getRoutingNodeKind(): RoutingNodeKind;

  buildRoutePath(request: unknown): string {
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

  getGroupedSourceNames(_request: unknown): string[] {
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

  override describe(request: unknown): string {
    const routeClass =
      typeof this.routeClass === "function"
        ? this.routeClass(request)
        : this.routeClass;

    return describePlanSource({
      routeClass,
      routePath: this.buildRoutePath(request),
    });
  }

  resolveOutputCurrencyResult(
    requestInput: RequestInput,
    quote: StockQuote,
  ): LookupResult | null {
    const singleNode = this.nodes.length === 1 ? this.nodes[0] : null;

    if (!this.refs && singleNode) {
      const nestedResolver = singleNode as Resolver & {
        resolveOutputCurrencyResult?: (
          request: RequestInput,
          value: StockQuote,
        ) => LookupResult | null;
      };

      if (typeof nestedResolver.resolveOutputCurrencyResult === "function") {
        return nestedResolver.resolveOutputCurrencyResult(requestInput, quote);
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

    const sourceCurrency = quote.currency;
    const targetCurrency = attributeRequest.outputCode.trim().toUpperCase();

    if (
      !sourceCurrency ||
      !targetCurrency ||
      sourceCurrency === targetCurrency ||
      (quote.fxUnitScale != null && Number.isFinite(Number(quote.fxUnitScale)))
    ) {
      return null;
    }

    const fxPair = buildFxPairFromCodes(sourceCurrency, targetCurrency);
    if (!fxPair) {
      throw new Error(
        `Output-currency conversion from "${sourceCurrency}" to "${targetCurrency}" is not supported. Use recognized 3- or 4-character currency codes.`,
      );
    }

    const fxResult = this.refs.resolveFxQuote(
      new FxRequest({
        attribute: "price",
        fxPair,
        identifier: fxPair.yahooChartSymbol,
      }),
    );

    if (fxResult.status === "success") {
      const rate = Number(
        extractAttributeValue(
          fxResult.value as StockQuote,
          "price",
        ),
      );

      if (Number.isFinite(rate)) {
        return { ...fxResult, value: rate };
      }
    }

    return fxResult;
  }

  static getSpecNodeCodes(spec: Graph.Node): string[] {
    return getGraphNodeNextIds(spec);
  }

  static fromSpec(
    code: string,
    spec: Graph.Node,
    resolverMap:
      | Record<string, Resolver>
      | ((nodeCode: string) => Resolver | null),
    overrides: Record<string, unknown> | null | undefined,
    deps: PlanRuntimeRefs,
  ): ResolverPlan {
    const resolveNodeByCode =
      typeof resolverMap === "function"
        ? resolverMap
        : (nodeCode: string) =>
            resolverMap[normalizeNodeCode(nodeCode)] || null;

    const Ctor = this as unknown as new (
      name: string,
      nodes: Resolver[],
      refs: PlanRuntimeRefs,
      options: ResolverPlanOptions,
    ) => ResolverPlan;
    return new Ctor(
      code,
      this.getSpecNodeCodes(spec).map((nodeCode: string) =>
        resolveNodeByCode(nodeCode),
      ) as Resolver[],
      deps,
      (overrides || {}) as ResolverPlanOptions,
    );
  }
}

// ---------------------------------------------------------------------------
// Plan kind base classes — driver dispatch table uses these to determine how
// each graph node is traversed: switch selects one child explicitly via
// selectNext(), step returns all children in one selection, try-each selects
// one child per call in order with fallback.
// ---------------------------------------------------------------------------

export class SwitchPlan extends ResolverPlan {
  getRoutingNodeKind(): RoutingNodeKind {
    return RoutingNodeKind.Switch;
  }

  selectNext(
    request: unknown,
    context: SelectNextContext = {},
  ): SelectedNodes {
    if (this.getSelectedNodeCodes(context).size > 0) {
      return [];
    }

    const matchingNodes = this.getHandleableNodesForRequest(request);

    if (!matchingNodes.length) {
      return [];
    }

    if (matchingNodes.length > 1) {
      throw new Error(
        `Resolver plan "${this.name}" matched multiple nodes: ${matchingNodes
          .map((node) => node.name)
          .join(", ")}.`,
      );
    }

    const selectedNode = this.markSelectedNode(matchingNodes[0] ?? null, context);
    return selectedNode ? [selectedNode] : [];
  }
}

export class StepPlan extends ResolverPlan {
  getRoutingNodeKind(): RoutingNodeKind {
    return RoutingNodeKind.Step;
  }

  getNodesForRequest(_request: unknown): Resolver[] {
    return (this.nodes || []).slice();
  }

  selectNext(
    request: unknown,
    context: SelectNextContext = {},
  ): SelectedNodes {
    const routingNodes = this.getRoutingNodes();
    const blockingNode = routingNodes.find(
      (node) => node?.canHandle && !node.canHandle(request),
    );

    if (blockingNode) {
      throw new Error(
        `Resolver plan "${this.name}" has child "${blockingNode.name}" that cannot handle the current output.`,
      );
    }

    return this.getUnselectedNodes(routingNodes, context);
  }
}

export class FirstSuccessPlan extends ResolverPlan {
  getRoutingNodeKind(): RoutingNodeKind {
    return RoutingNodeKind.TryEach;
  }

  selectNext(
    request: unknown,
    context: SelectNextContext = {},
  ): SelectedNodes {
    const remainingNodes = this.getUnselectedNodes(
      this.getHandleableNodesForRequest(request),
      context,
    );

    const selectedNode = this.markSelectedNode(remainingNodes[0] ?? null, context);
    return selectedNode ? [selectedNode] : [];
  }
}
