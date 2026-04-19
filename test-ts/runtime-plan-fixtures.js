const { ResolveFlow } = require("../dist/ts/core/index.js");

function createRuntimePlanLookup(definition, deps) {
  const flow = new ResolveFlow(
    definition,
    deps.registry,
    deps.resolverEnv,
  );

  return {
    getNode: (code) => flow.getResolver(code),
    getPlanNode: (code) => flow.getResolver(code),
  };
}

module.exports = {
  createRuntimePlanLookup,
};
