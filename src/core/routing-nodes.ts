/* SPDX-License-Identifier: MPL-2.0 */

import type { RoutingNode, NodeInput } from "./routing-graph";
import type { RequestInput, ResolvedRequest } from "./request";
import { executeRouteNode } from "./route-execution";
import type { ResolverNode } from "./planner";

/**
 * InputNode: Entry point for each identifier in the graph.
 * No parents. Returns the RequestInput as-is.
 */
export class InputNode implements RoutingNode<RequestInput> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  private readonly input: RequestInput;

  constructor(identifier: string, input: RequestInput) {
    this.name = `input:${identifier}`;
    this.input = input;
  }

  execute(_inputs: Record<string, NodeInput>): RequestInput {
    return this.input;
  }
}

/**
 * SymbolFastForwardNode: Direct identifier resolution.
 * Wraps DirectIdentifierResolver. Parent: InputNode.
 */
export class SymbolFastForwardNode implements RoutingNode<ResolvedRequest> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  readonly executorId = "direct-identifier";
  private readonly inputNode: InputNode;
  private readonly resolver: ResolverNode;

  constructor(inputNode: InputNode, resolver: ResolverNode) {
    this.name = `symbol-fast-forward:${inputNode.name}`;
    this.inputNode = inputNode;
    this.resolver = resolver;
  }

  execute(inputs: Record<string, NodeInput>): ResolvedRequest {
    const input = inputs[this.inputNode.name]!.value as RequestInput;
    const job = executeRouteNode(this.resolver, input, String);
    if (job.error) throw new Error(job.error);
    return job.value as ResolvedRequest;
  }
}

/**
 * YahooIsinSearchNode: ISIN resolution via Yahoo.
 * Wraps YahooIsinSearchResolver. Parent: InputNode.
 */
export class YahooIsinSearchNode implements RoutingNode<ResolvedRequest> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  readonly executorId = "yahoo-isin-search";
  private readonly inputNode: InputNode;
  private readonly resolver: ResolverNode;

  constructor(inputNode: InputNode, resolver: ResolverNode) {
    this.name = `yahoo-isin-search:${inputNode.name}`;
    this.inputNode = inputNode;
    this.resolver = resolver;
  }

  execute(inputs: Record<string, NodeInput>): ResolvedRequest {
    const input = inputs[this.inputNode.name]!.value as RequestInput;
    const job = executeRouteNode(this.resolver, input, String);
    if (job.error) throw new Error(job.error);
    return job.value as ResolvedRequest;
  }
}

/**
 * PseIsinMapNode: ISIN resolution via PSE map (Philippines).
 * Wraps PseIsinMapResolver. Parent: InputNode.
 */
export class PseIsinMapNode implements RoutingNode<ResolvedRequest> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  readonly executorId = "pse-isin-map";
  private readonly inputNode: InputNode;
  private readonly resolver: ResolverNode;

  constructor(inputNode: InputNode, resolver: ResolverNode) {
    this.name = `pse-isin-map:${inputNode.name}`;
    this.inputNode = inputNode;
    this.resolver = resolver;
  }

  execute(inputs: Record<string, NodeInput>): ResolvedRequest {
    const input = inputs[this.inputNode.name]!.value as RequestInput;
    const job = executeRouteNode(this.resolver, input, String);
    if (job.error) throw new Error(job.error);
    return job.value as ResolvedRequest;
  }
}

/**
 * LocalFxNode: FX resolution via local provider.
 * Wraps LocalFxResolver. Parent: InputNode.
 */
export class LocalFxNode implements RoutingNode<ResolvedRequest> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  readonly executorId = "local-fx";
  private readonly inputNode: InputNode;
  private readonly resolver: ResolverNode;

  constructor(inputNode: InputNode, resolver: ResolverNode) {
    this.name = `local-fx:${inputNode.name}`;
    this.inputNode = inputNode;
    this.resolver = resolver;
  }

  execute(inputs: Record<string, NodeInput>): ResolvedRequest {
    const input = inputs[this.inputNode.name]!.value as RequestInput;
    const job = executeRouteNode(this.resolver, input, String);
    if (job.error) throw new Error(job.error);
    return job.value as ResolvedRequest;
  }
}

/**
 * GoogleFxNode: FX resolution via Google Finance.
 * Wraps GoogleFxResolver. Parent: InputNode.
 */
export class GoogleFxNode implements RoutingNode<ResolvedRequest> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  readonly executorId = "google-fx";
  private readonly inputNode: InputNode;
  private readonly resolver: ResolverNode;

  constructor(inputNode: InputNode, resolver: ResolverNode) {
    this.name = `google-fx:${inputNode.name}`;
    this.inputNode = inputNode;
    this.resolver = resolver;
  }

  execute(inputs: Record<string, NodeInput>): ResolvedRequest {
    const input = inputs[this.inputNode.name]!.value as RequestInput;
    const job = executeRouteNode(this.resolver, input, String);
    if (job.error) throw new Error(job.error);
    return job.value as ResolvedRequest;
  }
}

/**
 * Quote node base pattern (YahooQuoteNode, PSEEdgeQuoteNode, etc.)
 * These nodes are standalone or used as candidates in FirstSuccessNode.
 */
export abstract class QuoteNode implements RoutingNode<Record<string, unknown>> {
  abstract readonly name: string;
  readonly next: RoutingNode[] = [];
  abstract readonly executorId: string;
  protected readonly identifierNode: RoutingNode<ResolvedRequest>;
  protected readonly resolver: ResolverNode;

  constructor(identifierNode: RoutingNode<ResolvedRequest>, resolver: ResolverNode) {
    this.identifierNode = identifierNode;
    this.resolver = resolver;
  }

  execute(inputs: Record<string, NodeInput>): Record<string, unknown> {
    const resolved = inputs[this.identifierNode.name]!.value as ResolvedRequest;
    const job = executeRouteNode(this.resolver, resolved, String);
    if (job.error) throw new Error(job.error);
    return job.quote as Record<string, unknown>;
  }

  /** For use in FirstSuccessNode candidates */
  asCandidate() {
    return {
      execute: (resolved: ResolvedRequest) => {
        const job = executeRouteNode(this.resolver, resolved, String);
        if (job.error) return null;
        return job.quote as Record<string, unknown>;
      },
      label: this.name,
    };
  }
}

export class YahooQuoteNode extends QuoteNode {
  readonly name: string;
  readonly executorId = "yahoo-quote";

  constructor(identifierNode: RoutingNode<ResolvedRequest>, resolver: ResolverNode) {
    super(identifierNode, resolver);
    this.name = `yahoo-quote:${identifierNode.name}`;
  }
}

export class PSEEdgeQuoteNode extends QuoteNode {
  readonly name: string;
  readonly executorId = "pse-edge-quote";

  constructor(identifierNode: RoutingNode<ResolvedRequest>, resolver: ResolverNode) {
    super(identifierNode, resolver);
    this.name = `pse-edge-quote:${identifierNode.name}`;
  }
}

export class PSEFramesQuoteNode extends QuoteNode {
  readonly name: string;
  readonly executorId = "pse-frames-quote";

  constructor(identifierNode: RoutingNode<ResolvedRequest>, resolver: ResolverNode) {
    super(identifierNode, resolver);
    this.name = `pse-frames-quote:${identifierNode.name}`;
  }
}

export class TradingviewFundQuoteNode extends QuoteNode {
  readonly name: string;
  readonly executorId = "tradingview-fund-quote";

  constructor(identifierNode: RoutingNode<ResolvedRequest>, resolver: ResolverNode) {
    super(identifierNode, resolver);
    this.name = `tradingview-fund-quote:${identifierNode.name}`;
  }
}

/**
 * FirstSuccessNode: Try fallback chain of quote nodes.
 * Tries candidates in order until one succeeds.
 */
export type QuoteCandidate = {
  execute(resolved: ResolvedRequest): Record<string, unknown> | null;
  label: string;
};

export class FirstSuccessNode implements RoutingNode<Record<string, unknown>> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  readonly executorId: string;
  readonly candidates: QuoteCandidate[];
  private readonly identifierNode: RoutingNode<ResolvedRequest>;

  constructor(
    name: string,
    identifierNode: RoutingNode<ResolvedRequest>,
    candidates: QuoteCandidate[],
  ) {
    this.name = name;
    this.identifierNode = identifierNode;
    this.executorId = name;
    this.candidates = candidates;
  }

  execute(inputs: Record<string, NodeInput>): Record<string, unknown> {
    const resolved = inputs[this.identifierNode.name]!.value as ResolvedRequest;
    let lastError: string = "No candidates.";

    for (const candidate of this.candidates) {
      try {
        const quote = candidate.execute(resolved);
        if (quote) return quote;
        lastError = `${candidate.label} returned empty.`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err ?? "");
      }
    }

    throw new Error(lastError);
  }
}

/**
 * FxRateBatchNode: Batch fetch FX rates after all quote nodes settle.
 * Parents: all quote nodes. Output: Record<sourceCurrency, rate>
 */
export class FxRateBatchNode implements RoutingNode<Record<string, number>> {
  readonly name = "fx-rate-batch";
  readonly next: RoutingNode[] = [];
  private readonly targetCurrency: string;
  private readonly resolver: ResolverNode;

  constructor(
    quoteNodes: RoutingNode<Record<string, unknown>>[],
    targetCurrency: string,
    resolver: ResolverNode,
  ) {
    for (const qn of quoteNodes) {
      qn.next.push(this);
    }
    this.targetCurrency = targetCurrency;
    this.resolver = resolver;
  }

  execute(inputs: Record<string, NodeInput>): Record<string, number> {
    // All parent quote nodes have delivered — collect their values
    const quotes = Object.values(inputs).map((inp) => inp.value as Record<string, unknown>);

    // TODO: Phase 2 impl — extract currency pairs, batch fetch rates
    // For now, return empty to allow graph to progress
    return {};
  }
}

/**
 * AttributeExtractionNode: Extract attribute from quote (no parent resolver).
 * Parents: quote/fx node, InputNode.
 */
export class AttributeExtractionNode implements RoutingNode<unknown> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  private readonly quoteOrFxNode: RoutingNode<Record<string, unknown>>;
  private readonly inputNode: InputNode;

  constructor(
    quoteOrFxNode: RoutingNode<Record<string, unknown>>,
    inputNode: InputNode,
  ) {
    this.name = `attribute-extraction:${inputNode.name}`;
    this.quoteOrFxNode = quoteOrFxNode;
    this.inputNode = inputNode;
  }

  execute(inputs: Record<string, NodeInput>): unknown {
    const quote = inputs[this.quoteOrFxNode.name]!.value as Record<string, unknown>;
    const input = inputs[this.inputNode.name]!.value as RequestInput;

    // TODO: Phase 2 impl — extract attribute value
    // Call extractAttributeValue(quote, input.attribute, ...)
    return null;
  }
}

/**
 * CurrencyConversionNode: Apply FX conversion to extracted attribute.
 * Parents: AttributeExtractionNode, FxRateBatchNode, quote node.
 */
export class CurrencyConversionNode implements RoutingNode<unknown> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  private readonly attrNode: AttributeExtractionNode;
  private readonly fxBatchNode: FxRateBatchNode;
  private readonly quoteNode: RoutingNode<Record<string, unknown>>;

  constructor(
    attrNode: AttributeExtractionNode,
    fxBatchNode: FxRateBatchNode,
    quoteNode: RoutingNode<Record<string, unknown>>,
  ) {
    this.name = `currency-conversion:${attrNode.name}`;
    this.attrNode = attrNode;
    this.fxBatchNode = fxBatchNode;
    this.quoteNode = quoteNode;
  }

  execute(inputs: Record<string, NodeInput>): unknown {
    const attributeValue = inputs[this.attrNode.name]!.value;
    const _rateTable = inputs[this.fxBatchNode.name]!.value as Record<string, number>;
    const _quote = inputs[this.quoteNode.name]!.value as Record<string, unknown>;

    // TODO: Phase 2 impl — apply FX conversion
    // Call extractCurrencyValue(quote), lookup rate, re-extract with rate
    return attributeValue;
  }
}
