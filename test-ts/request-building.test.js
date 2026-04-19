const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildTypedRequestFromParsedInput,
  buildTypedRequestFromResolvedTicker,
  createRequestInput,
  extractIsinFromRequestInput,
} = require("../dist/ts/core/index.js");

function createDeps() {
  return {
    extractTickerExchange(ticker) {
      const parts = String(ticker).split(":");
      return parts.length > 1 ? parts[0].trim().toUpperCase() : "";
    },
    extractYahooExchangeFromSymbol(symbol) {
      return String(symbol).endsWith(".PS") ? "PSE" : "";
    },
    looksLikeIsraeliFundYahooSymbol(symbol) {
      return String(symbol).startsWith("KSM.");
    },
    looksLikeIsin(value) {
      return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(String(value));
    },
    normalizeAttribute(attribute) {
      return String(attribute == null ? "price" : attribute).trim() || "price";
    },
    normalizeTickerWithoutIsin(ticker) {
      return String(ticker).trim().toUpperCase();
    },
    parseAttributeRequest(attribute) {
      return {
        baseAttribute: String(attribute).split("@")[0].toLowerCase(),
        outputCode: "",
        rawAttribute: String(attribute),
        wantsOutputCurrency: false,
      };
    },
    parseFxTicker(ticker) {
      const value = String(ticker).trim().toUpperCase();
      if (value !== "EURUSD") {
        return null;
      }

      return {
        baseCanonicalCode: "EUR",
        quoteCanonicalCode: "USD",
        yahooChartSymbol: "EURUSD=X",
      };
    },
    parseTickerRequest(ticker) {
      const value = String(ticker).trim();
      const atIndex = value.lastIndexOf("@");
      const candidateTicker = atIndex > 0 ? value.slice(0, atIndex).trim() : "";
      const candidateSource =
        atIndex > 0
          ? value
              .slice(atIndex + 1)
              .trim()
              .toUpperCase()
          : "";

      if (candidateTicker && candidateSource === "?") {
        return {
          infoMode: "source-name",
          ticker: candidateTicker,
        };
      }

      if (candidateTicker && candidateSource) {
        return {
          infoMode: "source-override",
          ticker: candidateTicker,
        };
      }

      if (candidateTicker) {
        return {
          infoMode: "source-list",
          ticker: candidateTicker,
        };
      }

      return { infoMode: "", ticker: value };
    },
  };
}

test("createRequestInput parses request state without classifying it", () => {
  const deps = createDeps();

  const equity = createRequestInput("GOOG", "price", deps);
  const fx = createRequestInput("EURUSD", "price", deps);
  const isin = createRequestInput("US02079K1079", "price", deps);

  assert.equal(equity.classification, undefined);
  assert.equal(equity.fxPair, null);
  assert.equal(fx.classification, undefined);
  assert.equal(fx.fxPair.baseCanonicalCode, "EUR");
  assert.equal(isin.classification, undefined);
  assert.equal(isin.fxPair, null);
});

test("createRequestInput strips unsupported source suffixes", () => {
  const deps = createDeps();
  const input = createRequestInput("GOOG@YAHOO", "price", deps);

  assert.equal(input.attribute, "price");
  assert.equal(input.infoMode, "source-override");
  assert.equal(input.ticker, "GOOG");
  assert.equal(input.classification, undefined);
});

test("isin extraction stays simple and explicit", () => {
  const deps = createDeps();
  const isinInput = createRequestInput("ISIN:US02079K1079", "price", deps);

  assert.equal(
    extractIsinFromRequestInput(isinInput, deps.looksLikeIsin),
    "US02079K1079",
  );
});

test("buildTypedRequestFromParsedInput returns the expected typed request variants", () => {
  const deps = createDeps();
  const originalInput = createRequestInput("PSE:BDO", "price", deps);

  const pseRequest = buildTypedRequestFromParsedInput(
    originalInput,
    createRequestInput("PSE:BDO", "price", deps),
    12,
    deps,
  );
  assert.equal(pseRequest.requestType, "equity");
  assert.equal(pseRequest.exchange, "PSE");
  assert.equal(pseRequest.symbol, "BDO");

  const fxRequest = buildTypedRequestFromParsedInput(
    createRequestInput("EURUSD", "price", deps),
    createRequestInput("EURUSD", "price", deps),
    3,
    deps,
  );
  assert.equal(fxRequest.requestType, "fx");
  assert.equal(fxRequest.baseCurrency, "EUR");
  assert.equal(fxRequest.quoteCurrency, "USD");

  const equityRequest = buildTypedRequestFromParsedInput(
    createRequestInput("TLV:KSMF59", "price", deps),
    createRequestInput("KSM.F59.TA", "price", deps),
    7,
    deps,
  );
  assert.equal(equityRequest.requestType, "equity");
  assert.equal(equityRequest.yahooSymbol, "KSM.F59.TA");
  assert.equal(equityRequest.allowTradingviewFallback, true);
});

test("buildTypedRequestFromResolvedTicker reuses RequestInput creation", () => {
  const deps = createDeps();
  const originalInput = createRequestInput("US02079K1079", "price", deps);
  const resolved = buildTypedRequestFromResolvedTicker(
    originalInput,
    "GOOG",
    5,
    deps,
  );

  assert.equal(resolved.requestType, "equity");
  assert.equal(resolved.yahooSymbol, "GOOG");
  assert.equal(resolved.identifierResolutionMs, 5);
});

test("default FX parsing does not classify arbitrary 6-8 letter identifiers as FX", () => {
  const input = createRequestInput("ABCDEFGH", "price");

  assert.equal(input.classification, undefined);
  assert.equal(input.fxPair, null);
});

test("default FX parsing preserves explicit CURRENCY validation errors", () => {
  assert.throws(
    () => createRequestInput("CURRENCY:ZZZ.USD", "price"),
    /must use supported 3- or 4-character currency codes/,
  );

  assert.throws(
    () => createRequestInput("CURRENCY:NOT-A-PAIR", "price"),
    /must look like CURRENCY:USDEUR or CURRENCY:USDT\.USD/,
  );
});
