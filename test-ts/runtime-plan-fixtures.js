const { Flow } = require("../dist/ts/core/index.js");

function createRuntimePlanLookup(definition, registry, nodeEnv) {
  const flow = new Flow(definition, registry, nodeEnv);

  return {
    getNode: (code) => flow.getNode(code),
    getPlanNode: (code) => flow.getNode(code),
  };
}

module.exports = {
  createRuntimePlanLookup,
};
