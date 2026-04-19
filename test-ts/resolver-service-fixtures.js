const {
  TestResolverServices,
} = require("../dist/ts/runtime/TestResolverServices.js");
const { createStaticResourceHttpFetch } = require("./resource-fixtures.js");

function createTestResolverServices(overrides = {}) {
  return new TestResolverServices(overrides);
}

function createStaticResolverServices(overrides = {}) {
  return createTestResolverServices({
    httpFetch: createStaticResourceHttpFetch(),
    getCachedJson: () => null,
    getCachedString: () => "",
    putCachedJson: (_key, value) => value,
    putCachedString: (_key, value) => value,
    ...overrides,
  });
}

function createTestEnv(overrides = {}) {
  return createStaticResolverServices(overrides);
}

module.exports = {
  createTestEnv,
  createStaticResolverServices,
  createTestResolverServices,
};
