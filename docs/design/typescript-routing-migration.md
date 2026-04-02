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

## Current-to-Future Mapping

- `hf_parseAttributeRequest_`, `hf_parseTickerRequest_`, `RequestInput`, `EquityRequest`, `FxRequest`
  Future home: `src/core/request.ts`
- `Resolver`, `AttemptResolver`, `ResolverPlan`, `IdentifierResolutionPlan`, `AttributeResolutionPlan`
  Future home: `src/core/resolvers.ts`
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
