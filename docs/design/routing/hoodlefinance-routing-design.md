---
status: Draft
updated: 2026-04-11
summary: Routing split and typed-request model for the current and planned runtime.
---

# Hoodlefinance Routing Design Sketch

This sketch separates routing into two explicit phases:

1. Identifier resolution
2. Attribute resolution

The goal is to make routing explicit and composable by separating identifier
resolution from attribute resolution.

Removing implicit runtime `pivot` behavior is a consequence of that design, not
the primary goal.

## Core Idea

- The public API still starts from two raw strings: `identifier` and
  `attribute`.
- The runtime immediately represents that raw public input as
  `RawRequestInput`, then classifies and parses it into a richer `RequestInput`
  before routing continues.
- Identifier resolvers turn those raw inputs into a typed request object for
  the resolved identifier family.
- Attribute resolvers take that typed request and return the
  requested attribute value.
- Plans own graph structure, fallback order, and containment.
- Resolvers own only capability and execution. Plans are also resolvers, so
  nested plans and leaf resolvers share the same basic contract.

This document remains partly aspirational. It describes the current routing
split, but it also keeps a few deferred design goals visible so the intended
end state stays clear.

## High-Level Flow

```text
identifier + attribute
  -> IdentifierResolutionPlan
  -> Typed request
  -> AttributeResolutionPlan
  -> Final value
```

Example:

```text
ISIN:PHY077751022 + price
  -> identifier plan resolves to PSE:BDO
  -> attribute plan resolves price through PSE
  -> 119.1
```

## Input

Current runtime input shape:

```js
class RawRequestInput {
  // Original identifier string from the caller.
  identifier;

  // Requested attribute, for example: "price", "isin", "symbol".
  attribute;
}
```

The current runtime then classifies and enriches that raw input into a parsed
request object before identifier and attribute routing proceed:

```js
class RequestInput {
  // Original raw identifier from the caller.
  identifier;

  // Normalized requested attribute.
  attribute;

  // Parsed ticker after source-override and info-mode handling.
  ticker;

  // Parsed classification used for routing, for example:
  // "equity", "fx", or "isin".
  classification;

  // Parsed source override when present, for example from "PSE:BDO@PSE-EDGE".
  sourceOverride;

  // Parsed info-mode flag for source-list / source-name style introspection.
  infoMode;

  // Parsed FX metadata when the request is an FX pair.
  fxPair;

  // Parsed attribute metadata such as base attribute and output-code request.
  attributeRequest;
  attributeType;
}
```

So in current code the public input is still two strings, but the routing
layers do not pass those strings around directly after classification.

## Typed Request Types

Current implemented typed requests:

```js
class BaseRequest {
  // Original raw input from the caller.
  // Type: RequestInput
  input;

  // Time spent resolving the input identifier into this typed request, in
  // milliseconds.
  identifierResolutionMs;
}

class EquityRequest extends BaseRequest {
  // Resolved exchange when the identifier family uses one, for example "PSE".
  exchange;

  // Resolved symbol within that exchange or market context.
  symbol;
}

class FxRequest extends BaseRequest {
  // Parsed currencies for downstream FX resolvers.
  baseCurrency;
  quoteCurrency;
}
```

Deferred / future typed request family:

```js
class CommodityRequest extends BaseRequest {
  // Resolved commodity code, for example "GOLD" or "BRENT".
  commodity;

  // Resolved source when the identifier or planner selects one explicitly.
  source;

  // Resolved instrument type, for example "spot", "benchmark", or "futures".
  instrumentType;

  // Resolved output unit used by downstream attribute resolution.
  unit;

  // Resolved output currency used by downstream attribute resolution.
  currency;

  // Optional contract or selector information when the identifier resolves to
  // something more specific than the broad commodity itself.
  selector;
}
```

`CommodityRequest` is not implemented yet. It remains here as a planned
extension point for the next routing families rather than a description of
today's shipped runtime surface.

## Phase Functions

```js
// Resolve the classified request input into the typed request object used by
// downstream attribute resolution.
//
// This phase is responsible for identifier interpretation, normalization, and
// discovery across identifier families such as securities, ISIN-backed inputs,
// FX pairs, and commodities. It should also split identifiers into structured
// fields such as exchange and symbol when that is useful for downstream
// resolution.
//
// Returns ResolutionResult. On success, `value` is one of the typed
// request objects such as EquityRequest, FxRequest, or later CommodityRequest.
function resolveIdentifier(input) {}

// Get the requested attribute value from the typed request returned by
// identifier resolution.
//
// This phase typically involves selecting the right attribute resolver path
// and accessing upstream data sources needed to return the final value.
function resolveAttribute(request) {}
```

## Resolution Outputs

```js
class ResolutionResult {
  // "success" or "failure"
  status;

  // Time spent in this step, in milliseconds.
  elapsedMs;

  // Populated on success.
  value;

  // Populated on failure.
  error;
}
```

## Resolver Interface

```js
class Resolver {
  // Stable node name.
  name;

  // Returns true if this resolver can handle the request shape.
  canHandle(request) {}

  // Resolve this resolver for the given request.
  resolve(request) {}
}
```

This is the shared base for identifier resolvers, attribute resolvers, and
plans. Both phases should use the same execution verb for simplicity.

Here, `request` is phase-dependent:

- for request classification, `request` means `RawRequestInput`
- for identifier resolvers, `request` means the classified `RequestInput`
- for attribute resolvers, `request` means one of the typed request objects

The runtime implementation can assert that the request shape is correct for the
current phase before invoking a resolver.

Resolvers do not:

- know whether they are forced
- own fallback ordering
- expose children
- rewrite graphs at runtime

Those are responsibilities of composite plans.

## Identifier Resolvers

```js
class IdentifierResolver extends Resolver {}
// Resolve the raw request input into the typed request used by the attribute
// layer.
IdentifierResolver.prototype.resolve = function (input) {};
// Pass through identifiers that are already in a usable project format.
class DirectIdentifierResolver extends IdentifierResolver {}
// Map an ISIN into a PSE equity identifier when the mapping is known.
class PseIsinMapResolver extends IdentifierResolver {}
// Search Yahoo-backed identifier data to discover a usable downstream symbol.
class YahooIsinSearchResolver extends IdentifierResolver {}
// Normalize FX-style inputs into the parsed currency pair request shape.
class FxNormalizationResolver extends IdentifierResolver {}
```

Current implementation note:

- `DirectIdentifierResolver`, `PseIsinMapResolver`, and
  `YahooIsinSearchResolver` are implemented today.
- FX normalization currently happens during request parsing and classification,
  before identifier-plan execution. `FxNormalizationResolver` remains a valid
  future shape if that work later moves into the identifier graph explicitly.

Purpose:

- interpret raw input
- normalize identifiers into a typed request
- split structured identifiers into their downstream fields when applicable
- return the typed request needed by the attribute layer

## Attribute Resolvers

```js
class AttributeResolver extends Resolver {}
// Resolve the requested attribute value for the typed request.
AttributeResolver.prototype.resolve = function (request) {};
class YahooQuoteResolver extends AttributeResolver {}
class GoogleFxResolver extends AttributeResolver {}
class PSEFramesResolver extends AttributeResolver {}
class PSEEdgeResolver extends AttributeResolver {}
class ArivaIsinResolver extends AttributeResolver {}
class LonIsinResolver extends AttributeResolver {}
class IbkrIsinResolver extends AttributeResolver {}
class TradingViewIsinResolver extends AttributeResolver {}
```

Current implementation note:

- DAG-backed attribute routing today is centered on quote resolvers such as
  `YahooQuoteResolver`, `GoogleFxResolver`, `PSEFramesResolver`,
  `PSEEdgeResolver`, and `TradingviewFundResolver`.
- ISIN attribute lookup currently still uses helper logic outside the authored
  attribute DAG rather than dedicated resolver nodes such as
  `ArivaIsinResolver`, `LonIsinResolver`, `IbkrIsinResolver`, or
  `TradingViewIsinResolver`.
- Those dedicated ISIN attribute resolvers remain a plausible future DAG shape.

Purpose:

- take a typed request
- return the requested attribute value

## Plans

Plans contain resolvers or nested plans.

This is the composition layer, similar to UI container/panel composition.

### Base Plan

```js
class ResolverPlan extends Resolver {
  // Ordered child nodes.
  // Each node is either:
  // - Resolver
  // - ResolverPlan
  nodes;

  // Resolve this plan by running its child nodes in order until one succeeds
  // or the plan fails.
  resolve(request) {}
}
```

`ResolverPlan` is a composite resolver. It uses the same `canHandle(request)`
and `resolve(request)` contract as any other resolver, but its `resolve(...)`
implementation runs child nodes in order until one succeeds or the plan fails.

### Identifier Plan

```js
class IdentifierResolutionPlan extends ResolverPlan {}
class DefaultIdentifierPlan extends IdentifierResolutionPlan {}
class ForcedIdentifierPlan extends IdentifierResolutionPlan {}

// Resolve identifier-phase nodes in order until one resolves the raw request
// or all fail.
IdentifierResolutionPlan.prototype.resolve = function (input) {};
```

Typical nodes:

- direct identifier parser
- PSE ISIN map
- Yahoo ISIN search

### Attribute Plan

```js
class AttributeResolutionPlan extends ResolverPlan {}
class QuotePlan extends AttributeResolutionPlan {}
class IsinAttributePlan extends AttributeResolutionPlan {}
class SymbolAttributePlan extends AttributeResolutionPlan {}

// Resolve attribute-phase nodes in order until one resolves the requested value
// or all fail.
AttributeResolutionPlan.prototype.resolve = function (request) {};
```

Typical nodes:

- PSE plan containing `PSEFramesResolver`, `PSEEdgeResolver`
- Yahoo quote plan
- Google FX plan
- future IBKR/LON/ARIVA/TradingView ISIN plans

## Composite Resolver Plans

Containment lives in plans, not resolvers.

Example:

```js
class PSEQuotePlan extends AttributeResolutionPlan {
  nodes = [new PSEFramesResolver(), new PSEEdgeResolver()];
}
```

Here:

- `PSE` is best modeled as a plan/composite, not necessarily as a leaf resolver
- `PSE-FRAMES` and `PSE-EDGE` are leaf resolvers

This gives natural grouped introspection:

```text
PSE (PSE-FRAMES, PSE-EDGE)
```

without putting containment into the resolver interface.

## Suggested Class Hierarchy

```text
Resolver
  IdentifierResolver
    DirectIdentifierResolver
    PseIsinMapResolver
    YahooIsinSearchResolver
    FxNormalizationResolver (future / optional)

  AttributeResolver
    YahooQuoteResolver
    GoogleFxResolver
    PSEFramesResolver
    PSEEdgeResolver
    ArivaIsinResolver (future)
    LonIsinResolver (future)
    IbkrIsinResolver (future)
    TradingViewIsinResolver (future)

ResolverPlan
  IdentifierResolutionPlan
    DefaultIdentifierPlan
    ForcedIdentifierPlan

  AttributeResolutionPlan
    QuotePlan
    IsinAttributePlan
    SymbolAttributePlan
    PSEQuotePlan
    YahooQuotePlan
```

## Forced Routing

Forced routing should be planner behavior, not resolver behavior.

Forcing happens when the caller uses `IDENTIFIER@SOURCE`.

This remains a design goal, but it is currently deferred from the main
`ResolveFlow.resolveAttribute(...)` path. Some lower-level planner code still
models forced routing, but the high-level runtime lookup path does not yet
expose the full behavior described in this section.

Depending on the source and request family, that may build either:

- a `ForcedIdentifierPlan`
- a `ForcedAttributePlan`

Example:

```js
class ForcedAttributePlan extends AttributeResolutionPlan {
  constructor(resolver) {
    super();
    this.nodes = [resolver];
  }
}
```

So:

- `@PSE-FRAMES` means build `ForcedAttributePlan(new PSEFramesResolver())`
- `@IBKR` with `isin` means build `ForcedAttributePlan(new IbkrIsinResolver())`

No special "forced plan" contract is needed on the resolver itself.

## Test Invariants

### Static capability tests

- Every resolver used in a plan must satisfy `canHandle(request)` for that
  plan's request family.
- Forced-source requests should be validated by the planner against the chosen
  resolver.

### Fallback monotonicity tests

For a fallback chain:

```text
A -> B
```

`B` must be able to handle every request family that `A` may delegate on that
chain.

This should be checked in tests, not at runtime.

## Why This Is Better

- no runtime `pivot`
- simpler resolver contract
- explicit identifier-resolution graph
- explicit attribute-resolution graph
- containment belongs to plans
- force/fallback/grouping belong to plans
- easier extension for commodities later
