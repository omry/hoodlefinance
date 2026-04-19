const { ResolveFlow } = require("../dist/ts/core/index.js");

function createRuntimePlanLookup(definition, registry, resolverEnv) {
  const flow = new ResolveFlow(definition, registry, resolverEnv);

  return {
    getNode: (code) => flow.getResolver(code),
    getPlanNode: (code) => flow.getResolver(code),
  };
}

module.exports = {
  createRuntimePlanLookup,
};
