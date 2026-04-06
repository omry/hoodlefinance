/* SPDX-License-Identifier: MPL-2.0 */

import { getInput, getInputs, type RoutingNode, type NodeInput } from "./routing-graph";
import type { RequestInput } from "./request";
import { executeRouteNode } from "./route-execution";
import type { ResolverNode } from "./planner";
import { extractAttributeValue, extractCurrencyValue } from "./attribute-extraction";
import {
  resolveIsinAttributeValue,
  type ResolveIsinAttributeDependencies,
} from "./isin-lookup";
import { buildFxPairFromCodes } from "./fx-normalization";

export type { ResolveIsinAttributeDependencies };

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
 * FxRateBatchNode: Batch fetch FX rates after all quote nodes settle.
 * Parents: all quote nodes. Output: Record<sourceCurrency, rate>
 */
export class FxRateBatchNode implements RoutingNode<Record<string, number>> {
  readonly name = "fx-rate-batch";
  readonly next: RoutingNode[] = [];
  private readonly quoteNodes: RoutingNode<Record<string, unknown>>[];
  private readonly targetCurrency: string;
  private readonly resolver: ResolverNode;

  constructor(
    quoteNodes: RoutingNode<Record<string, unknown>>[],
    targetCurrency: string,
    resolver: ResolverNode,
  ) {
    this.quoteNodes = quoteNodes;
    for (const qn of quoteNodes) {
      qn.next.push(this);
    }
    this.targetCurrency = targetCurrency;
    this.resolver = resolver;
  }

  execute(inputs: Record<string, NodeInput>): Record<string, number> {
    const quotes = getInputs(inputs, this.quoteNodes);

    const sourceCurrencies = new Set<string>();
    for (const quote of quotes) {
      const currency = extractCurrencyValue(quote);
      if (currency && currency !== this.targetCurrency) {
        sourceCurrencies.add(currency);
      }
    }

    if (sourceCurrencies.size === 0) {
      return {};
    }

    const rateMap: Record<string, number> = {};
    for (const sourceCurrency of sourceCurrencies) {
      const fxPair = buildFxPairFromCodes(sourceCurrency, this.targetCurrency);
      if (!fxPair) continue;

      const fxRequest = {
        attribute: "price",
        identifier: fxPair.yahooSymbol,
        ticker: fxPair.yahooSymbol,
        attributeType: "quote",
        classification: "fx",
        attributeRequest: {
          baseAttribute: "price",
          outputCode: this.targetCurrency,
          rawAttribute: "price",
          wantsOutputCurrency: false,
        },
        fxPair,
        infoMode: "",
        sourceOverride: "",
      } as RequestInput;

      const job = executeRouteNode(this.resolver, fxRequest, String);
      if (!job.error && job.quote) {
        const price = extractAttributeValue(job.quote as Record<string, unknown>, "price");
        const rate = Number(price);
        if (Number.isFinite(rate)) {
          rateMap[sourceCurrency] = rate;
        }
      }
    }

    return rateMap;
  }
}

/**
 * AttributeExtractionNode: Extract attribute from quote.
 * Parents: quote node, InputNode.
 */
export class AttributeExtractionNode implements RoutingNode<unknown> {
  readonly name: string;
  readonly next: RoutingNode[] = [];
  private readonly quoteNode: RoutingNode<Record<string, unknown>>;
  private readonly inputNode: InputNode;
  private readonly isinDeps: ResolveIsinAttributeDependencies | null;

  constructor(
    quoteNode: RoutingNode<Record<string, unknown>>,
    inputNode: InputNode,
    isinDeps?: ResolveIsinAttributeDependencies,
  ) {
    this.name = `attribute-extraction:${inputNode.name}`;
    this.quoteNode = quoteNode;
    this.inputNode = inputNode;
    this.isinDeps = isinDeps ?? null;
  }

  execute(inputs: Record<string, NodeInput>): unknown {
    const quote = getInput(inputs, this.quoteNode);
    const input = getInput(inputs, this.inputNode);

    if (input.attributeType === "isin") {
      if (!this.isinDeps) throw new Error("ISIN attribute resolution requires isinDeps.");
      return resolveIsinAttributeValue(
        quote,
        { sourceOverride: input.sourceOverride, tickerInput: input.ticker },
        this.isinDeps,
      );
    }

    return extractAttributeValue(quote, input.attribute, { tickerInput: input.ticker });
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
    const attributeValue = getInput(inputs, this.attrNode);
    const rateTable = getInput(inputs, this.fxBatchNode);
    const quote = getInput(inputs, this.quoteNode);

    const sourceCurrency = extractCurrencyValue(quote);
    const rate = rateTable[sourceCurrency];
    if (!rate || !Number.isFinite(rate)) return attributeValue;

    const patchedQuote = { ...quote, hoodlefinanceFxUnitScale: rate };
    return extractAttributeValue(patchedQuote, "price", {});
  }
}
