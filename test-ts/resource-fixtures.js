const PSE_ISIN_MAP_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/pse-isin-map.properties";
const CURRENCY_CODES_URL =
  "https://raw.githubusercontent.com/omry/hoodlefinance/main/data/currency-codes.json";

const TEST_PSE_ISIN_MAP_TEXT = "PHY077751022=PSE:BDO\n";
const TEST_CURRENCY_CODES_TEXT =
  '{"aliases":{},"canonicalCodes":["USD","EUR"],"cryptoCodes":[]}';

function createTextHttpResponse(text, responseCode = 200) {
  return {
    getContentText() {
      return String(text || "");
    },
    getResponseCode() {
      return responseCode;
    },
  };
}

function createStaticResourceHttpFetch(overrides = {}) {
  const resourceTextByUrl = {
    [PSE_ISIN_MAP_URL]: TEST_PSE_ISIN_MAP_TEXT,
    [CURRENCY_CODES_URL]: TEST_CURRENCY_CODES_TEXT,
    ...overrides,
  };

  return function httpFetch(url) {
    return createTextHttpResponse(resourceTextByUrl[String(url)] || "");
  };
}

module.exports = {
  CURRENCY_CODES_URL,
  PSE_ISIN_MAP_URL,
  TEST_CURRENCY_CODES_TEXT,
  TEST_PSE_ISIN_MAP_TEXT,
  createTextHttpResponse,
  createStaticResourceHttpFetch,
};
