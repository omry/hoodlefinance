# Hoodlefinance Routing Design Sketch

This sketch separates routing into two explicit phases:

1. Identifier resolution
2. Attribute resolution

The goal is to make routing explicit and composable by separating identifier
resolution from attribute resolution.

Removing implicit runtime `pivot` behavior is a consequence of that design, not
the primary goal.

## Core Idea

- The public input is two strings: `identifier` and `attribute`.
- Identifier resolvers turn those raw inputs into a typed request object for
  the resolved identifier family.
- Attribute resolvers take that typed request and return the
  requested attribute value.
- Plans own graph structure, fallback order, and containment.
- Resolvers own only capability and execution. Plans are also resolvers, so
  nested plans and leaf resolvers share the same basic contract.

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

```js
class RequestInput {
  // Original identifier string from the caller.
  identifier;

  // Requested attribute, for example: "price", "isin", "symbol".
  attribute;
}
```

## Typed Request Types

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

## Phase Functions

```js
// Resolve the raw request input into the typed request object used by downstream
// attribute resolution.
//
// This phase is responsible for identifier interpretation, normalization, and
// discovery across identifier families such as securities, ISIN-backed inputs,
// FX pairs, and commodities. It should also split identifiers into structured
// fields such as exchange and symbol when that is useful for downstream
// resolution.
//
// Returns ResolutionResult. On success, `value` is one of the typed
// request objects such as EquityRequest, FxRequest, or CommodityRequest.
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

- for identifier resolvers, `request` means `RequestInput`
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
- IBKR/LON/ARIVA/TradingView ISIN plans

## Composite Resolver Plans

Containment lives in plans, not resolvers.

Example:

```js
class PSEQuotePlan extends AttributeResolutionPlan {
  nodes = [
    new PSEFramesResolver(),
    new PSEEdgeResolver(),
  ];
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
    FxNormalizationResolver

  AttributeResolver
    YahooQuoteResolver
    GoogleFxResolver
    PSEFramesResolver
    PSEEdgeResolver
    ArivaIsinResolver
    LonIsinResolver
    IbkrIsinResolver
    TradingViewIsinResolver

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
- easier extension for commodities late
