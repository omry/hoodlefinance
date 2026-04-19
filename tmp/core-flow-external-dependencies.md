# core.flow External Dependencies

`src/core/flow` is not yet self-contained. This note lists the remaining
current dependencies on modules outside `src/core/flow`, together with the
recommended removal strategy. Item 1 from the original checklist is already
complete and is recorded here for status.

## Current External Dependencies

### Completed: `src/core/resolver-services.ts`

- Previous usage:
  - `Resolver.initEnv(_services: ResolverServices): void`
  - `resolverServices?: ResolverServices` in `ResolveFlow` dependencies
- Status:
  - Removed from `src/core/flow`
  - Replaced with `Resolver.initEnv(_env: unknown): void`
  - Replaced with `resolverEnv?: unknown` in `ResolveFlow` dependencies

Implemented solution:

- `ResolverServices` no longer appears in `src/core/flow`.
- The flow-layer hook now uses a generic environment shape:
  - `Resolver.initEnv(_env: unknown): void`
- `ResolveFlow` dependencies now carry `resolverEnv?: unknown`.
- `ResolverServices` remains in `src/core/`.
- HoodleFinance code passes `ResolverServices` through the generic env slot.

### Completed / outdated checklist item: `src/core/resolver-registry.ts`

- Current checked status:
  - `src/core/flow/resolve-flow.ts` no longer imports
    `src/core/resolver-registry.ts`
  - no imports from `src/core/flow/*` to `../resolver-registry` remain
- Impact on `src/core/flow` isolation:
  - no longer a flow-layer external dependency
- Followup note:
  - `src/core/resolver-registry.ts` now appears to be orphaned or dead code,
    but that is a separate cleanup question from `core.flow` isolation

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

## Remaining Elimination Order

1. `resolver-services`
   completed
2. `resolver-registry`
   completed as a `core.flow` isolation item; check separately whether the file
   is now dead
3. `resolver-classes`
   still open; largest remaining coupling point and requires moving
   plan-compilation ownership

## Key Constraint

- `ResolveFlow` the class already lives in `src/core/flow/resolve-flow.ts`
- the remaining problem is not file location, but ownership and imports
- the top-level `src/core/resolve-flow.ts` should remain as the HoodleFinance
  wrapper for `RawRequestInput`, `resolveAttribute`, and
  `resolveAttributeWithTrace`

## Assumptions

- “External dependency” means any import from `src/core/flow/*` to a module
  outside `src/core/flow`.
- Do not include app-level wrappers or runtime consumers as dependencies of
  `core.flow`; list only imports originating from files inside `src/core/flow`.
- Do not propose dependency injection as the solution pattern.
