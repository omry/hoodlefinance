---
status: Archived
updated: 2026-04-11
summary: Historical note for an intermediate TypeScript routing migration phase that has since been completed and cleaned up.
---

# TypeScript Routing Migration

> Historical note: this document captures an intermediate TypeScript routing
> migration phase. The routing core has since moved past this scaffold.
> Prefer [`hoodlefinance-routing-design.md`](./hoodlefinance-routing-design.md),
> [`final-dag-shape-redesign.md`](./final-dag-shape-redesign.md), and
> [`resolve-flow-rendering.md`](./resolve-flow-rendering.md) for current
> guidance.

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
- `hf_materializePlanFromSpec_`, `hf_resolveRoutingNode_`, `hf_buildResolvePlan_`
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

- Revisit the not implemented `HOODLEFINANCE_ROUTES()` prior to release of the TS version.

  - `DIRECT` became `ATTRIBUTE-IDENTITY`.
  - `DIRECT-IDENTIFIER` became `RESOLVED-IDENTIFIER`.
  - `LOCAL` became `FX-IDENTITY`.
  - `GOOGLE` became `GOOGLE-FX`.
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
- Do a naming pass against `docs/design/routing/hoodlefinance-routing-design.md` so the
  code reads more like the routing design and less like the legacy runtime table
  names.
- Do a test-driven parity pass between the legacy runtime and the TypeScript
  migration surface.
  - Compare the legacy test coverage against `test-ts/**/*.test.js` and use the
    missing cases as an explicit migration checklist.
  - Prioritize behavior-sensitive areas where the TS runtime can appear green
    while still missing host or adapter parity, such as preferred REIT symbol
    handling, source-specific fallbacks, and Apps Script-specific wiring.
- Normalize identity resolution plan. right now its half hard-coded
- Transition `src/core/fx-normalization.ts` to fetch `currency-codes.json` from GitHub at runtime instead of inlining it in the bundle, similar to other data files.
- ~~Evaluate converting to a real execution plan DAG representation that is then executed by the engine.~~ **Resolved:** the graph builder will be a compiler over `buildResolvePlan` — see `docs/design/routing/routing-graph.md` for the updated design. The plan is the map; the graph builder reads it rather than restating routing decisions.

## Open/Closed Principle Violations in TS Core

The TypeScript port has achieved 100% functional parity on Areas 1–4, but **11 major OCP violations** remain that prevent adding new extensions without modifying existing code. This section catalogs them for future refactoring.

### OCP Violation Categories

#### 🔴 **Critical: Block Core Extensions**

1. **Hard-Coded Attribute Extraction Switch** (`src/core/attribute-extraction.ts:153–227`)
   - 20+ hardcoded attribute cases. Adding new attributes requires modifying the switch statement.
   - **Impact**: Blocks custom attributes, experimental attributes, provider-specific extensions.
   - **Fix Strategy**: Attribute registry + polymorphic extraction interface.
   - **Effort**: High | **Priority**: High (Areas 2–4 depend on this)

2. **Hard-Coded ISIN Source Routing** (`src/core/isin-lookup.ts:242–343`)
   - If/else chains for PSE, LON, TRADINGVIEW. New country ISIN sources require code changes.
   - **Impact**: Blocks adding ARIVA, IBKR, or new regional exchanges (Area 6 blocker).
   - **Fix Strategy**: ISIN source registry + spec-driven routing.
   - **Effort**: Medium | **Priority**: High (needed for Area 6)

3. **Static Exchange-to-Source Mappings** (`src/core/isin-lookup.ts:61–106`)
   - 80+ hard-coded exchange abbreviations (ISIN_SOURCE_BY_EXCHANGE, TRADINGVIEW_EXCHANGE_BY_YAHOO_EXCHANGE).
   - **Impact**: Adding new exchanges requires changing constants, not specs.
   - **Fix Strategy**: Move to spec-driven registry (EXCHANGE_SPECS_BY_CODE).
   - **Effort**: Low | **Priority**: Medium (quick win)

#### 🟠 **High: Affects Maintainability & Extensibility**

4. **Hard-Coded Request Type Routing** (`src/core/quote-routing.ts:23–49`)
   - If/else chains only handle "fx" and "equity". New request types require routing logic changes.
   - **Impact**: Blocks futures, options, bonds, commodities without code modification.
   - **Fix Strategy**: Polymorphic routing via request type interface + specs.
   - **Effort**: Medium | **Priority**: Medium (needed for new financial instruments)

5. **Manual Type Checking in Resolvers** (`src/core/concrete-resolvers.ts:258+`)
   - 6+ resolvers with `instanceof RequestInput` checks instead of polymorphic dispatch.
   - **Impact**: Adding new request types requires checking all resolver implementations.
   - **Fix Strategy**: Type-based dispatch via request interface.
   - **Effort**: Medium | **Priority**: High (foundational for extensibility)

6. **Manual Dependency Injection** (`src/core/concrete-resolvers.ts:309+`)
   - 5+ resolvers with manual `typeof` dependency checks in `fromSpec()` methods.
   - **Impact**: Adding optional dependencies requires modifying fromSpec() implementations.
   - **Fix Strategy**: Spec-driven dependency declarations.
   - **Effort**: Medium | **Priority**: Medium (consolidates pattern)

#### 🟡 **Medium: Architectural Debt**

7. **Hard-Coded Special Market Logic** (`src/core/concrete-resolvers.ts:1337–1358`)
   - Israeli fund fallback logic hard-coded in TradingviewFundResolver.
   - **Impact**: Supporting new special markets (Arab exchanges, SSE, BSE) requires code changes.
   - **Fix Strategy**: Declarative special-case specs for markets.
   - **Effort**: Low–Medium | **Priority**: Low (niche use case)

8. **Spec System with Manual Bypass** (`src/core/resolver-materialization.ts:55–57`)
   - `resolversByCode` parameter allows mixing spec-driven and non-spec-driven registration.
   - **Impact**: Inconsistent registration patterns, spec system loses authority.
   - **Fix Strategy**: Enforce materialization path or document bypass explicitly.
   - **Effort**: Low | **Priority**: Low (consistency issue)

9. **Public Methods as Extension Points** (`src/core/resolver-classes.ts:96+`)
   - Methods like `getAttributeOverrideSources()` are public but meant only for override.
   - **Impact**: Confuses API surface; unclear which methods are truly public.
   - **Fix Strategy**: Extract extension interface, hide abstract patterns.
   - **Effort**: Low | **Priority**: Low (documentation/clarity only)

#### 🟢 **Lower Priority: Refactoring Only**

10. **Multiple Ref Type Handlers** (`src/core/resolver-classes.ts:420–442`)
    - Each ref type (routeClassRef, routePathRef, routeStateBuilderRef) needs separate code.
    - **Impact**: Adding new ref types requires modifying materializeOptions().
    - **Fix Strategy**: Generic ref handler pattern.
    - **Effort**: Low | **Priority**: Very Low

11. **Attribute Type-Specific Resolution** (`src/core/request-resolution.ts:332–360`)
    - Each attribute type (isin, price, symbol, etc.) has special handling in resolveRequestValue().
    - **Impact**: Same as violation #1 but at resolution layer.
    - **Fix Strategy**: Polymorphic attribute resolution.
    - **Effort**: Medium | **Priority**: Low (covered by #1 fix)

### OCP Refactoring Roadmap

Suggested phasing to migrate from hard-coded chains to spec-driven systems:

**Phase A: Foundation (Areas 5–6 prep)** — Address violations #2, #3, #4
- Migrate ISIN source routing to spec-driven system (enables Area 6: ARIVA, IBKR)
- Convert exchange mappings to spec-based lookups
- Introduce request-type routing polymorphism
- **Effort**: 3–4 days | **Enables**: Area 6 parity work

**Phase B: Extensibility (Architectural) — Address violations #1, #5, #6
- Extract attribute extraction into polymorphic interface + registry
- Replace `instanceof` checks with type-based dispatch in resolvers
- Consolidate dependency injection into spec declarations
- **Effort**: 4–5 days | **Enables**: Custom attributes, new request types

**Phase C: Polish (Technical Debt)** — Address violations #7–11
- Normalize special-case logic (Israeli funds, etc.)
- Document/enforce spec-bypass policy
- Clarify extension interfaces
- Generic ref handler
- **Effort**: 2–3 days | **Enables**: Cleaner codebase

### Migration Path for Violations

When adding new functionality (e.g., Area 6 ARIVA support, Area 9 versioning), check this table:

| If Adding… | Then Fix Violation… | Before Adding | Effort |
| :--- | :--- | :--- | :--- |
| New ISIN source (ARIVA, IBKR) | #2, #3 | Spec-driven ISIN routing | 1–2 days |
| New exchange | #3 | Exchange spec registry | Few hours |
| New attribute type | #1 | Attribute extraction registry | 1–2 days |
| New financial instrument (futures, options) | #4, #5 | Polymorphic request routing | 2–3 days |
| New dependency injection pattern | #6 | Spec-driven dependencies | Few hours |
| New special market handling | #7 | Declarative special-case specs | Few hours |

## Parity Tracker & Baseline Audit

This section serves as the authoritative ground-truth for the migration of the `hoodlefinance.js` functional core to the new TypeScript routing subsystem.

### Audit Policy: "Measure Twice, Cut Once"
1.  **Baseline Grounding**: All parity percentages are calculated via "Branch Counting"—matching every functional if/switch/map rule in the legacy source (8,570 lines) against the TS core.
2.  **No Stealth Fixes**: Fixes for parity gaps are strictly forbidden without a corresponding failing test and explicit user approval.
3.  **Verification**: 11 parity test suites in `test-ts/` serve as the measurement baseline.

### TypeScript Test Coverage Tracker

| # | Functional Area | TS Coverage Progress | Notes |
| :- | :--- | :--- | :--- |
| 1 | Ticker Normalization & Symbol Parsing | **100%** | All 9 branches match, including FX suffix and crypto dash rules. |
| 2 | Architecture: Routing & Resolution Plans | **100%** | All materialization and selection branches match exactly. |
| 3 | Identifiers (`isin` Lookups) | **100%** | All 7 branches match, including exchange metadata mapping (Line 407). |
| 4 | Quote Data & Attributes Resolution | **100%** | All 17 branches match, including `isin` and `price@USD` logic (Line 6325). |
| 5 | Batching, Performance, and Caching | **66%** | 2/3 branches. Gap: Job deduplication found in line 2688. |
| 6 | Provider-Specific Integrations | **50%** | 2/4 branches. Gap: Map caching (line 1650) and scraper freshness. |
| 7 | Apps Script Infrastructure & Meta Utilities | **0%** | 0/3 branches. Missing versioning and compare utils (line 1173). |
| 8 | Caching & Global Persistence Infrastructure | **0%** | 0/3 branches. Missing serialization, key versioning, and property chunking. |
| 9 | Resource Metadata Parsing (Currency Codes) | **0%** | 0/4 branches. Missing resource JSON parser (line 1542). |
| 10 | Provider-Specific Integration Logic (TradingView/LON) | **33%** | 1/3 branches. Gap: Quote code extraction (line 7365). |
| 11 | Advanced Error Handling & Normalization | **33%** | 1/3 branches. Gap: Yahoo OTC 404 translation (line 8341). |

### Identified Gaps (Resolution Queue)
- [ ] **Area 1**: Implement FX Pair `=X` suffix logic in `ticker-normalization.ts`.
- [ ] **Area 3**: Implement Google-style exchange aliases (NASDAQGS, NGM) in `isin-lookup.ts`.
- [ ] **Area 5**: Implement job deduplication in `executeRouteJobs` orchestration.
- [ ] **Area 9**: Fetch `currency-codes.json` from GitHub at runtime instead of inlining it in the bundle to reduce bundle size.
