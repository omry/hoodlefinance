# TypeScript Routing Migration: Parity Tracker & Baseline Audit

This document serves as the authoritative ground-truth for the migration of the `hoodlefinance.js` functional core to the new TypeScript routing subsystem.

## Audit Policy: "Measure Twice, Cut Once"
1.  **Baseline Grounding**: All parity percentages are calculated via "Branch Counting"—matching every functional if/switch/map rule in the legacy source (8,570 lines) against the TS core.
2.  **No Stealth Fixes**: Fixes for parity gaps are strictly forbidden without a corresponding failing test and explicit user approval.
3.  **Verification**: 11 parity test suites in `test-ts/` serve as the measurement baseline.

## TypeScript Test Coverage Tracker

| # | Functional Area | TS Coverage Progress | Notes |
| :- | :--- | :--- | :--- |
| 1 | Ticker Normalization & Symbol Parsing | **100%** | All 9 branches match, including FX suffix and crypto dash rules. |
| 2 | Architecture: Routing & Resolution Plans | **100%** | All materialization and selection branches match exactly. |
| 3 | Identifiers (`isin` Lookups) | **100%** | All 7 branches match, including exchange metadata mapping (Line 407). |
| 4 | Quote Data & Attributes Resolution | **85%** | 14.5/17 branches. Gap: `isin` attribute and currency conversion logic. |
| 5 | Batching, Performance, and Caching | **66%** | 2/3 branches. Gap: Job deduplication found in line 2688. |
| 6 | Provider-Specific Integrations | **50%** | 2/4 branches. Gap: Map caching (line 1650) and scraper freshness. |
| 7 | Apps Script Infrastructure & Meta Utilities | **0%** | 0/3 branches. Missing versioning and compare utils (line 1173). |
| 8 | Caching & Global Persistence Infrastructure | **0%** | 0/3 branches. Missing serialization, key versioning, and property chunking. |
| 9 | Resource Metadata Parsing (Currency Codes) | **0%** | 0/4 branches. Missing resource JSON parser (line 1542). |
| 10 | Provider-Specific Integration Logic (TradingView/LON) | **33%** | 1/3 branches. Gap: Quote code extraction (line 7365). |
| 11 | Advanced Error Handling & Normalization | **33%** | 1/3 branches. Gap: Yahoo OTC 404 translation (line 8341). |

## Identified Gaps (Resolution Queue)
- [ ] **Area 1**: Implement FX Pair `=X` suffix logic in `ticker-normalization.ts`.
- [ ] **Area 3**: Implement Google-style exchange aliases (NASDAQGS, NGM) in `isin-lookup.ts`.
- [ ] **Area 4**: Implement `isin` attribute extraction and `price@USD` conversion support.
- [ ] **Area 5**: Implement job deduplication in `executeRouteJobs` orchestration.