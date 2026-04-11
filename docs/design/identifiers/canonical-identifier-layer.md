---
status: Draft
updated: 2026-04-11
summary: Planned canonical internal identifier model with provider-specific rendering.
---

# Canonical Identifier Layer

This note describes a planned refactor that keeps one canonical internal identifier model and derives provider-specific lookup and rendering forms from it.

The goal is to make identifier handling consistent across:

- preferred REIT symbols
- ordinary equity tickers
- FX pairs
- ISIN-driven lookups
- provider-specific output styles such as Google and Yahoo symbol forms

## Summary

Today the code already separates some identifier and routing concerns, but it still carries provider-specific symbol behavior in several places.

The planned design is to treat the parsed request as the source of truth and derive provider lookup forms from that request as needed.

That should let us keep one internal meaning for an instrument while still supporting:

- Yahoo lookup symbols
- Google-style symbol output
- provider-specific quote adapters
- current user-facing identifier forms

## Current Shape

The current request model already has some structure:

- `RequestInput` parses the raw identifier and attribute
- `EquityRequest` carries equity-specific fields
- `FxRequest` carries FX-specific fields

Even so, provider-specific forms still leak into the request and routing layers.

Examples:

- `yahooSymbol` is often used as an internal lookup value
- symbol rendering depends on fetched quote context
- preferred REIT handling needs special logic to switch between Google-style and Yahoo-style forms

That works today, but it makes it harder to reason about where symbol translation belongs.

## Proposed Model

The planned model is:

1. Parse the user input once into a canonical internal identity.
2. Attach that identity to the request object.
3. Let each provider adapter derive the lookup form it needs.
4. Let symbol and exchange renderers derive the requested output style from the same identity.

That means the canonical identity should describe what the user meant, not how a specific provider wants it encoded.

Provider-specific forms should stay derived:

- Yahoo can ask for the Yahoo lookup symbol
- Google-style rendering can ask for the Google form
- PSE and other providers can derive their own lookup shapes if needed

## Rollout

The refactor should be phased, not a single big-bang rewrite.

Recommended order:

1. Add the canonical identity object to the existing request types.
2. Move preferred REIT translation onto adapter/helper code that derives provider forms from the canonical identity.
3. Reduce direct reliance on provider-specific fields such as `yahooSymbol` in routing decisions.
4. Extend the same model to the remaining identifier families once the equity path is stable.

## Compatibility

This plan is intended to stay compatible with the current public API.

The existing request classes remain the transition point:

- `RequestInput` still parses the raw user input
- `EquityRequest` and `FxRequest` still exist as runtime request types
- provider lookup and symbol rendering become derived views of the canonical identity, not separate sources of truth

## Design Constraint

The canonical layer should work for all identifier families, but provider lookup may still differ by adapter.

That is the main reason the design uses a canonical identity plus provider adapters instead of a single universal canonical symbol string.
