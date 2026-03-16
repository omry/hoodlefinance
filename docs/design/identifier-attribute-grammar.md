# Identifier And Attribute Grammar

This note documents the current grammar used by `HOODLEFINANCE` for both identifiers and attributes, then sketches a few cleanup directions for future iteration.

It is intentionally split into:

- current state
- inconsistency inventory
- proposed design directions

This is not a statement that any cleanup has already shipped. The current-state sections describe behavior that exists today in code, docs, and tests.

The narrower note at `docs/design/symbol-exchange-attributes.md` remains useful background for the symbol/exchange output work, but this document is meant to cover the broader grammar surface.

## Purpose And Scope

`HOODLEFINANCE` currently accepts multiple identifier forms and multiple families of attribute names.

Those forms grew from practical needs:

- exchange-prefixed stock identifiers
- Yahoo-style suffix identifiers
- direct ISIN input
- FX pair input
- best-effort identifier-format output
- exchange-specific `isin` resolvers

Today, those forms are workable but not fully uniform. The same separator can mean different things in different contexts, and attribute qualifiers are not always arranged in the same direction.

This note covers:

- public identifier forms
- public attribute forms
- internal or testing-oriented qualifier ideas only as design inputs for later discussion

This note does not change the public API.

## Current Identifier Grammar

### Bare Identifiers

Some identifiers are accepted without any explicit prefix or suffix:

- equity examples such as `GOOG`
- FX examples such as `EURUSD` and `BTCUSD`
- direct ISIN examples such as `IE00B4L5YX21`

Bare input is interpreted by detection rules rather than by a single explicit grammar family.

### Exchange-Prefixed Identifiers

Many identifiers use `:` as a leading namespace or exchange marker:

- `NASDAQ:GOOG`
- `LON:SJPA`
- `ETR:ZPRX`
- `SGX:D05`
- `TLV:POLI`
- `PSE:BDO`
- `CURRENCY:EURUSD`
- `ISIN:IE00B4L5YX21`

These do not all mean the same thing semantically:

- `NASDAQ:`, `LON:`, `SGX:`, and similar prefixes act like exchange selectors
- `PSE:` acts like a dedicated project routing prefix
- `CURRENCY:` acts like a type namespace for FX parsing
- `ISIN:` acts like a type namespace for direct ISIN input

From a syntax point of view they all look like `prefix:value`, but the prefix role is not uniform.

### Yahoo-Style Suffixed Identifiers

Some identifiers use Yahoo-style market suffixes:

- `SJPA.L`
- `ZPRX.DE`
- `9988.HK`
- `D05.SI`
- `POLI.TA`

Here `.` acts as a market suffix separator, not as a general-purpose qualifier system.

### FX-Specific Forms

FX input has two accepted forms:

- bare six-letter pairs such as `EURUSD`, `USDPHP`, and `BTCUSD`
- `CURRENCY:`-prefixed pairs such as `CURRENCY:EURUSD` and `CURRENCY:ETHUSD`

FX parsing is strict:

- the pair must be six letters long
- each leg must resolve to a supported 3-character currency or crypto unit
- unsupported explicit `CURRENCY:` input fails clearly
- unsupported bare six-letter input falls back to non-FX ticker handling

Same-currency pairs such as `USDUSD` short-circuit locally.

### Identifier Normalization Model

Current identifier handling is practical rather than canonical:

- exchange-prefixed tickers are often normalized toward Yahoo symbols for quote fetches
- Yahoo-style suffix identifiers are inferred back into exchange identity when needed
- `PSE:` has explicit handling instead of relying on Yahoo normalization alone
- FX pairs are parsed into a project-specific pair model with both Google-style and Yahoo-style renderings
- direct ISIN input resolves into another identifier form before quote lookup

So the system already contains a best-effort identifier conversion layer, but it is spread across several code paths rather than exposed as one uniform grammar model.

## Current Attribute Grammar

### Plain Attributes

Several attributes are simple unqualified names:

- `price`
- `name`
- `currency`
- `tradetime`
- `datadelay`
- `volume`
- `high`
- `low`
- `close`
- `change`
- `changepct`
- `symbol`
- `exchange`
- `isin`

These are the most direct attribute names in the system.

### Suffix-Qualified Attributes

Some attributes use a `base:qualifier` pattern:

- `symbol:google`
- `symbol:yahoo`
- `exchange:google`
- `exchange:yahoo`

In this family:

- the base concept comes first
- the suffix selects a representation style
- the unqualified form chooses a default

Current defaults:

- `symbol` means `symbol:google`
- `exchange` means `exchange:google`

### Source Selection For `isin`

Source selection for `isin` now lives on the identifier side rather than in separate attribute spellings.

Examples:

- `PSE:BDO@PSE`
- `SJPA.L@LON`
- `ZPRV.DE@ARIVA`
- `GOOG@IBKR`
- `ZPRX.DE@TRADINGVIEW`

In this model:

- the base attribute stays `isin`
- the identifier can carry an optional source override
- the unqualified `isin` attribute still delegates to a default exchange-aware resolver when no override is present

### Internal And Testing-Oriented Qualifier Ideas

There is current interest in adding non-public testing hooks such as `price:yahoo` or `price:google`.

Those names are not part of the current public API and are not implemented today. They are useful design examples because they would naturally join the same qualifier space as `symbol:yahoo` and `exchange:google`.

## Semantic Roles Of Separators

### `:` In Identifiers

In identifier input, `:` currently serves several roles:

- exchange selector in `NASDAQ:GOOG`
- project routing marker in `PSE:BDO`
- FX type namespace in `CURRENCY:EURUSD`
- direct-ISIN namespace in `ISIN:IE00B4L5YX21`

So `:` does not mean only "exchange". It often means "explicit namespace", but the namespace type varies.

### `.` In Identifiers

In identifier input, `.` is primarily a Yahoo-style market suffix separator:

- `.L`
- `.DE`
- `.HK`
- `.SI`
- `.TA`

This is a distinct grammar family from the colon-prefixed identifier forms.

### `:` In Attributes

In attribute names, `:` is currently used for representation/style qualifiers such as:

- `symbol:yahoo`
- `symbol:google`
- `exchange:yahoo`
- `exchange:google`

So the attribute namespace is now simpler than before, but still distinct from identifier syntax.

## Current Inconsistency Inventory

### Identifiers Still Mix Subject And Source Hints

`PSE:BDO`, `ISIN:IE00...`, and `PSE:BDO@PSE` all carry different kinds of routing information inside the identifier.

That is cleaner than putting resolver names into attributes, but it still means the identifier grammar carries both "what" and "where" concerns.

### Identifiers Mix Exchange Prefixes And Type Prefixes

`NASDAQ:GOOG` looks structurally similar to `CURRENCY:EURUSD` and `ISIN:IE00...`, but the prefix meaning is different:

- exchange selection
- type selection
- dedicated routing

The syntax is consistent, but the semantics are not.

### Identifiers And Attributes Reuse `:` Differently

In identifiers, `:` is part of the input locator syntax.

In attributes, `:` is part of the attribute qualifier syntax.

That reuse is manageable in practice because identifiers and attributes live in different function arguments, but it still means the same visual form does not carry one shared conceptual model across the API.

### Identifiers Use `.` Suffixes While Attributes Do Not

Identifier suffixes such as `.L` and `.TA` are meaningful input forms.

Attribute qualification uses `:`, not `.`.

So suffix notation exists in both domains, but with different separators and different meanings.

### Default Forms Are Not Uniform

Some unqualified names are defaults for a qualified family:

- `symbol` -> `symbol:google`
- `exchange` -> `exchange:google`

Some are umbrella dispatch points:

- `isin` chooses a default resolver based on inferred exchange

Some are standalone concepts:

- `price`
- `currency`
- `name`

This means a bare attribute name can mean:

- a true base attribute
- a default style alias
- a dispatcher into resolver-specific logic

### Internal Testing Hooks Would Need To Pick A Side

If future testing-only attributes such as `price:yahoo` are added, they would naturally align with the existing `base:qualifier` family.

That would keep style-oriented attribute qualification consistent, but it would also make the split between identifier-side source selection and attribute-side style selection more important to explain clearly.

## Proposed Design Directions

This section is intentionally forward-looking. The proposals below are design candidates, not current behavior.

### Goals

Any cleanup direction should aim to:

- separate the concepts of subject, source, requested field, and output style
- make the role of each separator easier to explain
- reduce ambiguity about whether source selection belongs to the identifier or the attribute
- preserve compatibility where practical
- leave room for internal testing hooks without making the public API harder to understand
- keep identifier input flexible enough for real-world market data workflows

### Leading Direction: Source On The Identifier, Style On The Attribute

The clearest direction so far is:

- identifiers describe what we want data about
- attributes describe what we want to know about it
- source selection belongs primarily to the identifier
- style selection belongs to the attribute when needed

Under that model:

- `GOOG`, `BTCUSD`, `PSE:BDO`, and `ISIN:IE00...` still identify the subject
- `price`, `name`, `currency`, `isin`, `symbol`, and `exchange` remain attribute requests
- `symbol:yahoo` and `symbol:google` remain style choices for the returned symbol representation
- `exchange:yahoo` and `exchange:google` remain style choices for the returned exchange representation

This gives the system a clearer conceptual split:

- identifier = what
- attribute = which fact
- style qualifier = how to render that fact
- source override = where to force lookup for debugging

### Proposed Identifier Source Override

The proposed source override syntax is:

- `identifier@SOURCE`

Examples:

- `BTCUSD@YAHOO`
- `BTCUSD@GOOGLE`
- `GOOG@YAHOO`
- `PSE:BDO@YAHOO`
- `ISIN:IE00B4L5YX21@IBKR`

Intended semantics:

- without `@SOURCE`, the implementation deduces the source from the identifier and uses normal fallback behavior
- with `@SOURCE`, the explicit source overrides the deduced source
- the override is a debug tool, not a user-facing convenience feature
- when a source is forced, there is no fallback
- if the forced source does not resolve the instrument correctly, the request fails at that source

That means `PSE:BDO@YAHOO` is intentionally allowed to fail, or even to resolve unexpectedly, because the point of the override is to inspect what Yahoo does when forced.

### Proposed Error-Handling Policy

For normal identifiers without a source override:

- source is deduced from the identifier and existing routing logic
- the implementation may keep using its normal "try harder" behavior when a path is unavailable or incomplete

For `identifier@SOURCE`:

- the forced source is authoritative for that lookup
- no automatic fallback should run after a forced-source failure
- the failure should be reported as a failure of that source, not silently rerouted elsewhere

This keeps the first version of source override small and easy to explain.

### Why This Direction Helps

- it removes provider choice from the attribute namespace
- it keeps style qualifiers independent from quote-provider choice
- it matches the fact that source choice affects routing and resolution, not just value formatting
- it gives internal debugging a sharp, explicit mechanism without expanding the public surface too early

It also creates a cleaner model for `isin`:

- identifier-level ISIN input stays an identifier concern
- asking for `isin` stays an attribute concern
- source-specific resolver choice moves to identifier-side `@SOURCE`

### Tension: Resolver Sources Vs Quote Sources

One real tension remains: not every source participates in the system the same way.

Roughly speaking, sources fall into three capability patterns:

- quote-oriented sources such as Yahoo or Google
- resolver-oriented sources such as ARIVA, IBKR, TradingView, or PSE for specific metadata paths
- mixed or market-specific sources that do some of both

This tension shows up most clearly around `isin`.

The likely design implication is:

- the source namespace can stay unified
- but each attribute may support only a subset of sources
- `price` and `close` are not necessarily available from the same source set as `isin`

That capability model is still cleaner than encoding provider choice directly into both identifier and attribute syntax.

### Current FX Preference

For crypto and FX specifically, the current practical direction is:

- prefer `GOOGLE` as the primary quote source
- treat `TRADINGVIEW` as a possible supplemental source later, not the default FX path

This is based on the current implementation and recent live checks:

- Google Finance is already the active crypto/FX source for the broad path in this project
- Google has shown better practical pair coverage than Yahoo in recent live probes
- TradingView clearly exposes some crypto/forex symbols, but is currently a better fit for resolver-style or supplemental use than for the main FX routing path

That does not rule out future TradingView-based FX support. It just means the design should treat it as an additive path, not as the default source to optimize around first.

### Future Extension Space

The first version does not need source chains or explicit fallback-policy suffixes.

However, the `identifier@SOURCE` form intentionally leaves room for later extensions if needed, such as:

- ordered source lists
- explicit fallback-policy markers
- more structured capability checks

Those should only be added later if real use cases justify the extra grammar.

### Open Questions For Future Iteration

- Should `@SOURCE` stay strictly internal/debug-only, or eventually become a documented advanced feature?
- Which source names belong in the initial override namespace: `YAHOO`, `GOOGLE`, `PSE`, `IBKR`, `ARIVA`, `TRADINGVIEW`, or a smaller subset?
- Should forced-source errors surface the raw source failure directly, or be normalized into a project-specific error message?
- Should `CURRENCY:` and `ISIN:` continue to look like exchange-prefixed identifiers, or should future design language describe them as namespaces first and exchange prefixes second?

## Working Conclusion

The current system is functional but not fully uniform:

- identifiers use both prefix and suffix forms
- identifiers also now carry optional `@SOURCE` overrides
- the same separators carry different meanings in different contexts

The strongest cleanup direction so far is:

- identifier chooses the subject
- identifier may optionally force the source with `@SOURCE`
- attribute chooses the requested fact
- attribute qualifiers such as `:yahoo` or `:google` stay style-oriented rather than source-oriented

That does not mean the current API is broken. It does mean future additions should be made with this explicit grammar model in mind instead of extending the syntax ad hoc.
