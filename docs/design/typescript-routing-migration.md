# TypeScript Routing Migration

This repo's next TypeScript step should start with the routing core rather than a whole-file conversion of `hoodlefinance.js`.

## Why This Boundary

The current routing subsystem already has explicit internal shapes and phases:

- request parsing and classification
- typed request construction
- resolver and resolver-plan abstractions
- spec-driven plan materialization
- route job preparation and execution

That makes the routing core a better first TypeScript target than the Apps Script shell, UI hooks, or deployment code.

## Initial Scaffold

The first source tree is intentionally model-first:

- `src/core/request.ts`
  Mirrors `RequestInput`, `EquityRequest`, `FxRequest`, and the parsed ticker and attribute shapes.
- `src/core/planner.ts`
  Mirrors runtime plans, route jobs, resolution results, and the canonical resolve-plan shape.
- `src/core/plan-specs.ts`
  Mirrors the resolver and resolver-plan spec objects that currently live in `hoodlefinance.js`.
- `src/core/index.ts`
  Re-exports the core model surface.

This scaffold does not replace any runtime code yet. It exists to establish stable contracts before extraction.

The first executable extraction is the request-parsing layer:

- `src/core/request-parsing.ts`
  Mirrors the current attribute and ticker parsing contract from `hoodlefinance.js`.
- `test-ts/request-parsing.test.js`
  Verifies the compiled TypeScript output against the current parser behavior.

## Current-to-Future Mapping

- `hf_parseAttributeRequest_`, `hf_parseTickerRequest_`, `RequestInput`, `EquityRequest`, `FxRequest`
  Future home: `src/core/request.ts`
- `Resolver`, `IdentifierResolver`, `AttributeResolver`, `ResolverPlan`, `IdentifierResolutionPlan`, `AttributeResolutionPlan`
  Future home: `src/core/resolvers.ts`
- `RouteExecutionResolver`
  Internal helper for batch-oriented route execution. Useful implementation seam, but not part of the public routing design vocabulary.
- `HOODLEFINANCE_RESOLVER_SPECS_BY_CODE_`, `HOODLEFINANCE_PLAN_SPECS_BY_CODE_`
  Future home: `src/core/plan-specs.ts`
- `hf_materializePlanFromSpec_`, `hf_resolveRoutingNode_`, `hf_buildIdentifierResolutionPlan_`, `hf_buildResolvePlan_`
  Future home: `src/core/planner.ts`
- `hf_createRouteJob_`, `hf_prepareRouteJob_`, `hf_applyRouteResult_`, `hf_getRouteExecutor_`, `hf_executeRouteJobs_`
  Future home: `src/core/route-jobs.ts`

## Suggested Phases

1. Keep `hoodlefinance.js` as the production runtime boundary.
2. Extract request and planner models into TypeScript modules with no behavior changes.
3. Move pure routing and plan-building logic into TypeScript.
4. Move resolver implementations once the planner contracts settle.
5. Leave Apps Script entrypoints and UI glue for later, after the core modules stabilize.

## Build Posture

For now, TypeScript is configured for type-checking only.

- `npm run typecheck` checks `src/**/*.ts`
- no runtime build output is generated yet
- no Apps Script deploy behavior changes yet

That keeps the migration reversible while the module boundaries are still being proven out.

## Deferred Cleanup List

These are known naming and boundary issues that should be revisited after more of
the routing subsystem is migrated. They are intentionally deferred so the
transition can preserve runtime behavior first.

- Rename vague resolver/spec codes that mirror the current runtime but do not
  communicate intent clearly.
  - `DIRECT` should become a more explicit attribute-side name (WIP, still cleanup to do)
- Revisit `FunctionValueResolver` as an implementation detail rather than a
  first-class routing concept.
- Collapse temporary constructor dependency bundles in concrete resolvers once
  the runtime wiring is clearer.
  - Example: `YahooIsinSearchResolverDependencies` is acceptable migration
    scaffolding, but should not be assumed to be the final design shape.
- Replace legacy empty-string "not found / not applicable" helper returns with
  clearer nullable results where appropriate.
  - Example: PSE ISIN map lookup should likely return `null` instead of `""`
    once runtime-parity constraints are no longer driving the API.
- Tighten the request boundary.
  - Separate core request modeling from debug-only source override parsing.
  - Re-introduce debug-only override and introspection support deliberately at
    the boundary layer once the core plan path is stable.
    - Explicitly deferred examples: `@SOURCE` forced routing and `@?`
      source-name inspection are not part of the current TypeScript CLI
      contract yet.
  - For ISIN attribute lookup, keep the migration scope limited to the sources
    that are functionally needed by the current TypeScript user path.
    - Current in-scope sources: `DIRECT`, `PSE`, `LON`, and `TRADINGVIEW`.
    - Runtime-only sources such as `ARIVA` and `IBKR` are not near-term
      migration targets unless a real user-facing gap makes them necessary.
  - Reduce how much parser-derived and runtime-wiring behavior lives in
    `src/core/request.ts`.
- Reduce public leakage from `src/core/index.ts` so low-level normalization and
  helper modules are not exported as if they are design-level API.
- Revisit the explicit `PSE` fast path in `src/core/request-building.ts` and
  decide whether it belongs in a more explicit exchange/equity normalization
  layer.
- Revisit runtime execution concepts such as `RouteJob` once the migrated core
  is more complete, to see whether the mutable execution record can become
  smaller and easier to reason about.
- Do a naming pass against `docs/design/hoodlefinance-routing-design.md` so the
  code reads more like the routing design and less like the legacy runtime table
  names.
- Do a test-driven parity pass between the legacy runtime and the TypeScript
  migration surface.
  - Compare the legacy test coverage against `test-ts/**/*.test.js` and use the
    missing cases as an explicit migration checklist.
  - Prioritize behavior-sensitive areas where the TS runtime can appear green
    while still missing host or adapter parity, such as preferred REIT symbol
    handling, source-specific fallbacks, and Apps Script-specific wiring.
