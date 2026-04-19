# core.flow External Dependencies

`src/core/flow` is not yet self-contained. This note lists the remaining
current dependencies on modules outside `src/core/flow`, together with the
recommended removal strategy.

## Current External Dependencies

### 1. `src/core/resolver-classes.ts`

- Used by:
  - `src/core/flow/resolve-flow.ts`
- Current usage:
  - `Resolver` type import
  - `buildPlanNodeFromSpec`
  - `PLAN_RESOLVER_CLASSES_BY_NAME`
- Why it breaks isolation:
  - The generic flow compiler still relies on HoodleFinance-owned plan-node
    classes and plan-node materialization logic.

Recommended solution:

- Remove all imports from `flow/resolve-flow.ts` to `resolver-classes.ts`.
- Keep HoodleFinance-specific plan classes in `src/core/resolver-classes.ts`.
- Move only the generic base resolver types to `src/core/flow`.
- Move plan-node compilation ownership out of `flow/resolve-flow.ts`:
  - `flow/resolve-flow.ts` should not know the HoodleFinance plan registry
  - the HoodleFinance adapter in `src/core/resolve-flow.ts` should own
    plan-node recognition/materialization
- Since DI is out of scope, the recommended shape is:
  - keep the generic `ResolveFlow` class in `src/core/flow`
  - move HoodleFinance-specific runtime-node compilation glue out of
    `src/core/flow`
  - make `src/core/resolve-flow.ts` the adapter that wires HoodleFinance plan
    classes to the generic flow runtime

## Key Constraint

- `ResolveFlow` the class already lives in `src/core/flow/resolve-flow.ts`
- the remaining problem is not file location, but ownership and imports
- the top-level `src/core/resolve-flow.ts` should remain as the HoodleFinance
  wrapper for `RawRequestInput`, `resolveAttribute`, and
  `resolveAttributeWithTrace`

## Assumptions

- "External dependency" means any import from `src/core/flow/*` to a module
  outside `src/core/flow`.
- Do not include app-level wrappers or runtime consumers as dependencies of
  `core.flow`; list only imports originating from files inside `src/core/flow`.
- Do not propose dependency injection as the solution pattern.
