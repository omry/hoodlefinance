import {
  getGraphNodeNextIds,
  normalizeGraphNodeId,
  type Graph,
} from "./graph";

import { FxRequest, RawRequestInput, RequestInput } from "./request";
import {
  extractAttributeValue,
} from "./attribute-extraction";
import { buildFxPairFromCodes } from "./fx-normalization";
import type { StockQuote } from "./quote";
import type { ResolverServices } from "./resolver-services";

export type ResolutionResult<T> =
  | { elapsedMs: number; status: "success"; value: T }
  | { elapsedMs: number; error: string; status: "failure" };

function createResolutionResult<T extends Record<string, unknown>>(
  status: ResolutionResult<unknown>["status"],
  options: T,
): { status: ResolutionResult<unknown>["status"] } & T {
  return { status, ...options };
}

export function createResolutionSuccess<T>(
  value: T,
  elapsedMs: number,
): ResolutionResult<T> {
  return createResolutionResult("success", {
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
    value,
  }) as ResolutionResult<T>;
}

export function createResolutionFailure(
  error: unknown,
  elapsedMs: number,
  errorMessage: (error: unknown) => string,
): ResolutionResult<never> {
  return createResolutionResult("failure", {
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
    error: errorMessage(error),
  }) as ResolutionResult<never>;
}

export enum RoutingNodeKind {
  Leaf = "leaf",
  Switch = "switch",
  TryEach = "try each",
  Step = "step",
}

export interface LookupResult {
  error?: string;
  route: string;
  status: "failure" | "success";
  value: unknown;
}

export interface PlanRuntimeRefs {
  callSubgraph(subgraphId: string, input: object): LookupResult;
}

const FX_CONVERSION_SUBGRAPH_ID = "FX_CONVERSION";

// TODO: rename routeClass/routePath to drop legacy "route" terminology once spec format is updated
export interface ResolverPlanOptions {
  routeClass?: string;
  routePath?: string;
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

function unwrapLookupValue(value: unknown): unknown {
  if (
    value != null &&
    typeof value === "object" &&
    "extractedValue" in (value as Record<string, unknown>)
  ) {
    return (value as { extractedValue: unknown }).extractedValue;
  }

  return value;
}

export function resolveCanonicalCurrencyCode(currency: unknown): string {
  const rawCurrency = String(currency || "").trim();

  if (!rawCurrency) {
    return "";
  }

  const selfPair = buildFxPairFromCodes(rawCurrency, rawCurrency);
  return selfPair?.quoteCanonicalCode || rawCurrency.toUpperCase();
}

export function resolveFxConversionRate(
  refs: PlanRuntimeRefs,
  sourceCurrency: string,
  targetCurrency: string,
): LookupResult {
  const fxPair = buildFxPairFromCodes(sourceCurrency, targetCurrency);
  if (!fxPair) {
    throw new Error(
      `Output-currency conversion from "${sourceCurrency}" to "${targetCurrency}" is not supported. Use recognized 3- or 4-character currency codes.`,
    );
  }

  const fxResult = refs.callSubgraph(
    FX_CONVERSION_SUBGRAPH_ID,
    new FxRequest({
      attribute: "price",
      fxPair,
      identifier: fxPair.yahooChartSymbol,
    }),
  );

  if (fxResult.status !== "success") {
    return fxResult;
  }

  const resolvedValue = unwrapLookupValue(fxResult.value);
  const rate = Number(
    resolvedValue != null && typeof resolvedValue === "object"
      ? extractAttributeValue(resolvedValue as StockQuote, "price")
      : resolvedValue,
  );

  if (!Number.isFinite(rate)) {
    throw new Error(
      `FX conversion from "${sourceCurrency}" to "${targetCurrency}" returned a non-numeric rate.`,
    );
  }

  return {
    ...fxResult,
    value: rate,
  };
}

export function describePlanSource(
  plan:
    | {
        routeClass?: unknown;
        routePath?: unknown;
      }
    | null
    | undefined,
): string {
  if (!plan) {
    return "";
  }

  const routeClass =
    plan.routeClass != null ? String(plan.routeClass).trim() : "";
  const routePath = plan.routePath != null ? String(plan.routePath).trim() : "";

  if (!routeClass) {
    return routePath;
  }

  if (!routePath || routeClass.startsWith("FORCED:")) {
    return routePath || routeClass;
  }

  return `${routeClass} -> ${routePath}`;
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

  canHandle(_request: unknown): boolean {
    return true;
  }

  getResolverClass(): string {
    return this.name;
  }

  getResolverPath(): string {
    return String(this.traceLabel || this.name || "").trim();
  }

  describe(request: unknown): string {
    return describePlanSource({
      routeClass: this.getResolverClass(),
      routePath: this.getResolverPath(),
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
      const rawValue = this.execute(request);
      const value = this.resolveTransformValue(rawValue, request);
      return createResolutionSuccess(value, Date.now() - startedAtMs);
    } catch (error) {
      return createResolutionFailure(
        error,
        Date.now() - startedAtMs,
        formatResolverError,
      );
    }
  }

  execute(_request: unknown): unknown {
    throw new Error(
      `Resolver "${this.name}" must implement execute().`,
    );
  }

  protected resolveTransformValue(
    value: unknown,
    _request: unknown,
  ): unknown {
    return value;
  }

  initEnv(_services: ResolverServices): void {}

  initRuntimeRefs(_refs: PlanRuntimeRefs): void {}

  static fromSpec(code: string, ..._args: unknown[]): Resolver {
    return new this(code);
  }
}


export abstract class ResolverPlan extends Resolver {
  readonly nodes: Resolver[];
  readonly routeClass: string;
  readonly routePath: string;

  constructor(
    name: string,
    nodes: Resolver[],
    options: ResolverPlanOptions = {},
  ) {
    super(name);
    this.nodes = nodes || [];
    this.routeClass = options.routeClass || name;
    this.routePath = options.routePath || "";
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
    if (this.routePath) {
      return this.routePath;
    }

    return this.getNodesForRequest(request).map((node) => node.name).join(" -> ");
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
    return describePlanSource({
      routeClass: this.routeClass,
      routePath: this.buildRoutePath(request),
    });
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
  ): ResolverPlan {
    const resolveNodeByCode =
      typeof resolverMap === "function"
        ? resolverMap
        : (nodeCode: string) =>
            resolverMap[normalizeNodeCode(nodeCode)] || null;

    const Ctor = this as unknown as new (
      name: string,
      nodes: Resolver[],
      options: ResolverPlanOptions,
    ) => ResolverPlan;
    return new Ctor(
      code,
      this.getSpecNodeCodes(spec).map((nodeCode: string) =>
        resolveNodeByCode(nodeCode),
      ) as Resolver[],
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
