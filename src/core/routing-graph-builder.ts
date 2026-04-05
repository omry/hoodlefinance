/* SPDX-License-Identifier: MPL-2.0 */

import type { RoutingGraph, RoutingNode } from "./routing-graph";
import type { RequestInput, ResolvedRequest } from "./request";
import {
  InputNode,
  SymbolFastForwardNode,
  YahooIsinSearchNode,
  PseIsinMapNode,
  LocalFxNode,
  GoogleFxNode,
  YahooQuoteNode,
  PSEEdgeQuoteNode,
  PSEFramesQuoteNode,
  TradingviewFundQuoteNode,
  FirstSuccessNode,
  FxRateBatchNode,
  AttributeExtractionNode,
  CurrencyConversionNode,
} from "./routing-nodes";
import type { ResolverNode } from "./planner";
import type { ResolveIsinAttributeDependencies } from "./routing-nodes";

export interface RoutingGraphBuilderDependencies {
  directIdentifierResolver: ResolverNode;
  yahooIsinSearchResolver: ResolverNode;
  pseIsinMapResolver: ResolverNode;
  localFxResolver: ResolverNode;
  googleFxResolver: ResolverNode;
  yahooQuoteResolver: ResolverNode;
  pseEdgeResolver: ResolverNode;
  pseFramesResolver: ResolverNode;
  tradingviewFundResolver: ResolverNode;
  /** Required for ISIN attribute type requests. */
  isinDeps?: ResolveIsinAttributeDependencies;
}

interface SubgraphResult {
  nodes: RoutingNode[];
  quoteNode: RoutingNode<Record<string, unknown>> | null;
  outputNode: RoutingNode;
}

/**
 * Build routing graph for a single identifier.
 * Returns the subgraph nodes and output node for this identifier.
 */
function buildIdentifierSubgraph(
  identifier: string,
  input: RequestInput,
  deps: RoutingGraphBuilderDependencies,
): SubgraphResult {
  const nodes: RoutingNode[] = [];

  // Step 1: Create InputNode
  const inputNode = new InputNode(identifier, input);
  nodes.push(inputNode);

  // Step 2: Branch on classification
  let identifierNode: RoutingNode<ResolvedRequest>;

  if (input.classification === "equity") {
    identifierNode = new SymbolFastForwardNode(inputNode, deps.directIdentifierResolver);
    nodes.push(identifierNode);
  } else if (input.classification === "isin") {
    // Check country code from ISIN
    const isinValue = input.identifier.toUpperCase().trim();
    const countryCode = isinValue.substring(0, 2);

    if (countryCode === "PH") {
      identifierNode = new PseIsinMapNode(inputNode, deps.pseIsinMapResolver);
    } else {
      identifierNode = new YahooIsinSearchNode(inputNode, deps.yahooIsinSearchResolver);
    }
    nodes.push(identifierNode);
  } else if (input.classification === "fx") {
    // For FX, try LocalFx first (via FirstSuccessNode), fallback to Google
    identifierNode = new LocalFxNode(inputNode, deps.localFxResolver);
    nodes.push(identifierNode);
    // TODO: Could use FirstSuccessNode for fallback, but for now keep simple
  } else {
    throw new Error(`Unknown classification: ${input.classification}`);
  }

  // Step 3: Wire inputNode.next → identifierNode
  inputNode.next.push(identifierNode);

  // Step 4: Create quote node for equity/isin, null for fx
  let quoteNode: RoutingNode<Record<string, unknown>> | null = null;

  if (input.classification === "equity" || input.classification === "isin") {
    // Determine quote source based on exchange in identifier or ISIN country
    let psExchange = false;

    if (input.classification === "isin") {
      const isinValue = input.identifier.toUpperCase().trim();
      psExchange = isinValue.substring(0, 2) === "PH";
    } else {
      // For equity, check ticker for PSE prefix
      psExchange = input.ticker.startsWith("PSE:");
    }

    if (psExchange) {
      // PSE: try PSEFrames first, then PSEEdge
      const pseFramesNode = new PSEFramesQuoteNode(identifierNode as RoutingNode<ResolvedRequest>, deps.pseFramesResolver);
      const pseEdgeNode = new PSEEdgeQuoteNode(identifierNode as RoutingNode<ResolvedRequest>, deps.pseEdgeResolver);
      quoteNode = new FirstSuccessNode(
        `pse-quote:${inputNode.name}`,
        identifierNode as RoutingNode<ResolvedRequest>,
        [pseFramesNode.asCandidate(), pseEdgeNode.asCandidate()],
      );
    } else {
      // Non-PSE: try Yahoo first, then TradingviewFund
      const yahooNode = new YahooQuoteNode(identifierNode as RoutingNode<ResolvedRequest>, deps.yahooQuoteResolver);
      const tvNode = new TradingviewFundQuoteNode(identifierNode as RoutingNode<ResolvedRequest>, deps.tradingviewFundResolver);
      quoteNode = new FirstSuccessNode(
        `equity-quote:${inputNode.name}`,
        identifierNode as RoutingNode<ResolvedRequest>,
        [yahooNode.asCandidate(), tvNode.asCandidate()],
      );
    }

    nodes.push(quoteNode);

    // Step 5: Wire identifierNode.next → quoteNode
    identifierNode.next.push(quoteNode);
  }

  // Step 6: Create AttributeExtractionNode
  const attrParent = quoteNode || identifierNode;
  const attrNode = new AttributeExtractionNode(
    attrParent as RoutingNode<Record<string, unknown>>,
    inputNode,
    deps.isinDeps,
  );
  nodes.push(attrNode);

  // Step 7: Wire parents → attrNode
  attrParent.next.push(attrNode);
  inputNode.next.push(attrNode);

  return { nodes, quoteNode, outputNode: attrNode };
}

/**
 * Build complete routing graph for a request.
 * Handles multiple identifiers (if input.identifiers is supported).
 * For now, loops over a single identifier.
 */
export function buildRoutingGraph(
  input: RequestInput,
  deps: RoutingGraphBuilderDependencies,
): RoutingGraph {
  const allNodes: RoutingNode[] = [];
  const outputs: RoutingNode[] = [];
  const quoteNodesForFxBatch: RoutingNode<Record<string, unknown>>[] = [];

  // Check if output currency conversion is needed
  const wantsOutputCurrency =
    input.attributeRequest.wantsOutputCurrency &&
    input.attributeRequest.baseAttribute === "price";
  const targetCurrency = wantsOutputCurrency
    ? input.attributeRequest.outputCode.trim().toUpperCase()
    : null;

  // For now, single identifier. Future: loop over input.identifiers
  const identifier = input.identifier;

  const subgraph = buildIdentifierSubgraph(identifier, input, deps);
  allNodes.push(...subgraph.nodes);

  if (wantsOutputCurrency && subgraph.quoteNode) {
    quoteNodesForFxBatch.push(subgraph.quoteNode);
  }

  outputs.push(subgraph.outputNode);

  // If FX conversion needed, create FxRateBatchNode and wrap outputs
  if (wantsOutputCurrency && quoteNodesForFxBatch.length > 0) {
    const fxRateBatchNode = new FxRateBatchNode(
      quoteNodesForFxBatch,
      targetCurrency!,
      deps.googleFxResolver,
    );
    allNodes.push(fxRateBatchNode);

    // Wrap output node with CurrencyConversionNode
    for (let i = 0; i < outputs.length; i++) {
      const attrNode = outputs[i] as AttributeExtractionNode;
      const quoteNode = quoteNodesForFxBatch[i];
      if (attrNode && quoteNode) {
        const convNode = new CurrencyConversionNode(attrNode, fxRateBatchNode, quoteNode);
        allNodes.push(convNode);
        outputs[i] = convNode;

        // Wire all three parents → convNode
        attrNode.next.push(convNode);
        fxRateBatchNode.next.push(convNode);
        quoteNode.next.push(convNode);
      }
    }
  }

  return { nodes: allNodes, outputs };
}
