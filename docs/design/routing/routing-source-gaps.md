# Routing Source Gaps

This note records the main gaps between the current routing design and the
current implementation around source identity, source introspection, and source
overrides.

The routing core is much cleaner than before:

- identifier resolution and attribute resolution are explicit phases
- plans and resolvers are first-class objects
- runtime execution follows the plan graph instead of mutating a fallback graph

But source-related behavior is still not modeled cleanly enough.

## Main Gap

The code still uses several overlapping ideas of "source":

- resolver name
- trace label
- user-facing source override such as `@YAHOO`
- grouped source name such as `PSE`
- runtime winning source

Those are related, but they are not the same thing.

Today the implementation still leaks between those layers.

## Current Problems

### 1. Source Identity Is Not One Thing

The same upstream service may appear under different identities depending on
context.

Example:

- `TradingviewFundResolver`
  - resolver name: `TRADINGVIEW-FUND`
  - trace label: `TRADINGVIEW`
- `HOODLEFINANCE_TRADINGVIEW_ISIN_RESOLVER_`
  - resolver name: `TRADINGVIEW`
  - trace label: `TRADINGVIEW`

So "TradingView" exists as more than one attribute resolver, but only one of
them maps directly to the `@TRADINGVIEW` override today.

This is why user-facing source behavior is hard to explain cleanly.

### 2. Reachable Plan Nodes And Valid Overrides Are Mixed Together

Source introspection currently tries to answer more than one question at once:

- which nodes are present in the plan?
- which explicit overrides are allowed?
- which source might actually succeed at runtime?

Those are different.

Example:

- `TLV:KSMF59`
  - planned attribute path: `YAHOO -> TRADINGVIEW`
  - valid forced quote override today: `@YAHOO`
  - runtime winner may be `TRADINGVIEW`

Showing one flat source list for this request is inherently ambiguous unless the
meaning is stated very clearly.

### 3. Identifier-Phase And Attribute-Phase Source Lists Need Different Rules

For `ISIN + price`, the request really means:

1. resolve the identifier
2. resolve the attribute

So source introspection for unresolved ISIN-like inputs should naturally show
two sets:

- identifier sources
- attribute sources unlocked by those identifier paths

That is now partially implemented, but only for quote-style requests.

Direct `isin` attribute introspection still does not have the same phase-aware
model.

### 4. Grouped Sources Are Not First-Class Objects

`PSE` is currently treated as a grouped user-facing source that expands to:

- `PSE-FRAMES`
- `PSE-EDGE`

But the grouping still lives in formatting/config code rather than as a true
first-class source object with its own semantics.

That makes these questions awkward:

- is `PSE` itself a resolvable source?
- is it only a grouped label?
- when should `PSE-FRAMES` and `PSE-EDGE` be shown?
- when is `@PSE` valid versus `@PSE-FRAMES` and `@PSE-EDGE`?

### 5. Resolver Capability And Override Capability Are Not The Same Contract

Resolvers now expose:

- `canHandle(request)`

Some identifier resolvers also expose:

- `getAttributeOverrideSources(request)`

That is a step in the right direction, but it is still partial.

The real model we seem to want is closer to:

- can this resolver participate in planning?
- what user-facing source name does it correspond to?
- what override names does it enable?
- in which phase?
- is it directly forceable or only reachable as part of a larger plan?

Those questions do not yet have one formal interface.

## Consequences

These gaps show up as confusing behavior such as:

- a source appearing in a source list but not being a valid explicit override
- a runtime winning source not being clearly represented in the override model
- grouped sources being displayed differently depending on phase
- implementation needing extra mapping tables just to explain plan structure

## Likely Direction

The clean direction is probably:

1. Introduce a first-class source descriptor model
   - source id
   - display label
   - phase
   - whether it is grouped
   - whether it is directly forceable
   - whether it is only a fallback node

2. Make resolvers expose source descriptors instead of ad hoc names plus trace
   labels plus override logic.

3. Make source introspection explicit about which question it answers:
   - valid overrides
   - planned nodes
   - runtime trace

4. Keep grouped sources such as `PSE` as first-class source descriptors rather
   than formatting-only sugar.

## Short Version

The routing phases are in much better shape now, but source semantics are still
under-modeled.

The biggest remaining design problem is that the code still lacks one canonical
object that answers:

- what source is this?
- in which phase?
- can the user force it?
- is it only a grouped label?
- is it only a fallback runtime node?
